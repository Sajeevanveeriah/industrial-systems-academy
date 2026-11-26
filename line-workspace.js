/* Packing cell operator workspace. The sequencer, scene and order ledger are supplied by the workshop. */
(() => {
  "use strict";
  const stages = ["feed", "inspect", "transfer", "reject", "complete"];
  const labels = {
    idle: "Idle",
    feed: "Feed conveyor",
    inspect: "Camera inspection",
    transfer: "Robot transfer",
    reject: "Reject diverter",
    complete: "MES booking",
  };
  const sensorLabels = {
    atCamera: "At camera",
    inspected: "Inspected",
    accepted: "Vision pass",
    placed: "Placed",
    rejected: "Diverted",
  };
  const equipment = {
    conveyor: [
      "Drive and conveyor",
      "vfd",
      "The drive advances the blank towards inspection during FEED.",
    ],
    sensor: [
      "Photoeye and I/O",
      "io",
      "The arrival signal lets the PLC leave FEED and start inspection.",
    ],
    scanner: [
      "Inspection scanner",
      "mes",
      "The inspection result selects the transfer or reject route for this carton.",
    ],
    plc: [
      "PLC cabinet",
      "plc",
      "The downloaded sequence samples the inputs and selects the next action.",
    ],
    robot: [
      "Robot cell",
      "robot",
      "The taught pick and place poses move an accepted carton to the pallet.",
    ],
    pallet: [
      "Finished pallet",
      "erp",
      "A completed good carton becomes ERP finished stock after its event is acknowledged.",
    ],
  };
  const scanMs = 220;
  const stepSize = 0.25;
  const yesNo = (id, label) =>
    "<label>" +
    label +
    '<select id="' +
    id +
    '"><option value="yes">Yes</option><option value="no">No</option></select></label>';
  const readouts = [
    ["good", "MES accepted"],
    ["rejects", "MES rejected"],
    ["finished", "ERP finished stock"],
    ["physicalBlanks", "Physical blanks"],
    ["blanks", "ERP blanks"],
    ["queued", "Awaiting ERP"],
  ];
  function mount(root, ctx) {
    const state = ctx.state;
    const shell = document.createElement("section");
    shell.className = "sw-line";
    root.replaceChildren(shell);
    shell.innerHTML =
      `
      <div class="line-head"><div><p class="line-kicker">PK-01 / Operator workspace</p><h2>Run the packing line</h2><p>Follow one carton through the conveyor, camera and robot. The infeed reserves a blank from stores. Return it before inspection, or finish the cycle to book its outcome in MES.</p></div>
      <div class="line-links"><a href="#sequence">Edit PLC sequence</a><a href="equipment.html">Equipment workbench ↗</a></div></div>
      <section class="line-control"><div class="line-run-status"><strong class="line-mode"></strong><span class="line-id"></span><b class="line-stage"></b><progress class="line-progress" max="1" value="0" aria-label="Stage progress"></progress></div>
      <div class="line-buttons"><button type="button" data-work="cycle">Start carton</button><button type="button" data-work="stop">Pause</button><button type="button" data-line="step">Single scan</button><button type="button" data-line="cancel">Return blank</button></div>
      <p id="work-notice" role="status"></p></section>
      <div class="line-bench"><section class="line-viewport"><div class="line-view-head"><strong>Cell view</strong><div class="line-camera" aria-label="Camera views" role="group"></div></div>
      <canvas tabindex="0" class="line-canvas" aria-label="Interactive three-dimensional packing line"></canvas>
      <div class="line-inspect" aria-live="polite">Select equipment in the cell to inspect it.</div></section>
      <aside class="line-dock"><section class="line-hmi"><div class="line-heading"><h3>Your operator screen</h3><a href="#scada">Edit screen →</a></div><div id="screen-live"></div></section>
      <section class="line-ledger"><div class="line-heading"><h3>Production ledger</h3><a href="#trace">Trace lot →</a></div><div class="line-measures"></div></section></aside></div>
      <section class="line-sample"><h3>Last PLC input sample</h3><div class="line-sensors" aria-label="Last PLC input sample"></div></section>
      <div class="line-bottom"><section class="line-settings"><h3>Field inputs</h3><div class="line-fields">` +
      yesNo("line-power", "Cell power") +
      yesNo("guard", "Process permissive healthy") +
      yesNo("infeed", "Blank present at infeed") +
      yesNo("auto", "Automatic mode selected") +
      `<label>Camera result<select id="quality"><option value="Pass">Accept carton</option><option value="Reject">Reject carton</option></select></label></div>
      <div class="line-interface"><label>ERP interface<select id="line-online"><option value="yes">Online</option><option value="no">Offline</option></select></label><button type="button" data-line="post">Replay pending events</button></div></section>
      <section class="line-trace"><h3>PLC scan trace</h3><ol aria-label="Recent scans"></ol></section></div>`;
    const find = (selector) => shell.querySelector(selector);
    const canvas = find("canvas");
    const notice = find("#work-notice");
    const warn = (text) => {
      notice.textContent = text;
    };
    function labelledRow(parent, key, label) {
      const wrapper = document.createElement("div");
      const name = document.createElement("span");
      name.textContent = label;
      const value = document.createElement("strong");
      value.dataset.key = key;
      wrapper.append(name, value);
      parent.append(wrapper);
      return value;
    }
    const sensors = Object.entries(sensorLabels).map(([key, label]) => [
      key,
      labelledRow(find(".line-sensors"), key, label),
    ]);
    const measures = readouts.map(([key, label]) => [
      key,
      labelledRow(find(".line-measures"), key, label),
    ]);
    let active = false,
      frame = 0,
      lastScan = 0,
      destroyed = false,
      scene = null;
    const seq = window.SWSequence;
    state.linePower ??= true;
    state.lastRun = false;
    if (!Array.isArray(state.lineTrace)) state.lineTrace = [];
    const order = state.order;
    function serialFrom(id) {
      const prefix = order.id + "-";
      if (typeof id !== "string" || !id.startsWith(prefix)) return 0;
      const suffix = id.slice(prefix.length);
      const value = Number(suffix);
      return /^\d+$/.test(suffix) && Number.isSafeInteger(value) ? value : 0;
    }
    const persistedSerial = Number.isSafeInteger(order.cartonSerial)
      ? order.cartonSerial
      : 0;
    order.cartonSerial = Math.max(
      persistedSerial,
      order.events.length,
      order.events.reduce(
        (max, event) => Math.max(max, serialFrom(event.id)),
        0,
      ),
    );
    // Migrate the previous booking-count reservation only when it is the next unbooked id.
    if (
      !persistedSerial &&
      state.carton?.orderId === order.id &&
      serialFrom(state.carton.id) === order.cartonSerial + 1
    )
      order.cartonSerial++;
    const reservedId = () =>
      order.id + "-" + String(order.cartonSerial).padStart(3, "0");
    function validate(c) {
      return (
        c &&
        c.orderId === state.order.id &&
        c.id === reservedId() &&
        !order.events.some((event) => event.id === c.id) &&
        stages.includes(c.stage) &&
        Number.isFinite(c.t) &&
        c.t >= 0 &&
        c.t <= 1 &&
        typeof c.accepted === "boolean"
      );
    }
    if (state.carton && !validate(state.carton)) {
      state.carton = null;
      warn(
        "The saved carton no longer matches this order. No new movement was booked.",
      );
      ctx.save();
    } else if (state.carton)
      warn(
        "Saved carton paused. Check the field inputs, then resume or advance one scan.",
      );
    const fields = {
      "line-power": "linePower",
      guard: "guard",
      infeed: "infeed",
      auto: "auto",
      "line-online": "interfaceOnline",
    };
    for (const [id, key] of Object.entries(fields))
      find("#" + id).value = state[key] ? "yes" : "no";
    find("#quality").value = state.quality;
    function setCamera(name) {
      scene?.camera(name);
      for (const b of shell.querySelectorAll("[data-camera]"))
        b.setAttribute("aria-pressed", String(b.dataset.camera === name));
    }
    try {
      scene = window.SWLineScene.mount(canvas, (payload) => {
        const label =
          typeof payload === "string"
            ? payload
            : payload?.label || payload?.name || payload?.id;
        const part = equipment[label];
        if (!part) return;
        const link = document.createElement("a");
        link.href = "equipment.html#" + part[1];
        link.textContent = part[0] + " guide →";
        find(".line-inspect").replaceChildren(part[2] + " ", link);
      });
    } catch {
      canvas.hidden = true;
      find(".line-inspect").textContent =
        "The 3D view is unavailable. Cycle controls, sensors and PLC trace remain usable.";
    }
    function addCamera(id, label) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.camera = id;
      button.textContent = label;
      find(".line-camera").append(button);
    }
    if (scene) {
      addCamera("overview", "Overview");
      addCamera("robot", "Robot");
      addCamera("inspection", "Camera");
      setCamera("overview");
      canvas.addEventListener("keydown", (event) => {
        if (event.key === "Home")
          for (const button of shell.querySelectorAll("[data-camera]"))
            button.setAttribute(
              "aria-pressed",
              String(button.dataset.camera === "overview"),
            );
      });
    }
    function signalImage(c, t) {
      const stage = c?.stage;
      return {
        atCamera: (stage === "feed" && t >= 1) || stage === "inspect",
        inspected: stage === "inspect" && t >= 1,
        accepted:
          ((stage === "inspect" && t >= 1) ||
            stage === "transfer" ||
            stage === "complete") &&
          !!c?.accepted,
        placed: stage === "transfer" && t >= 1,
        rejected: stage === "reject" && t >= 1,
      };
    }
    function syncImage() {
      const c = state.carton;
      if (c) {
        c.sensors = signalImage(c, c.t);
        c.photoeye = c.sensors.atCamera;
      }
    }
    function paintScene(t = state.carton?.t || 0) {
      const c = state.carton;
      const last = c ? null : state.order.events.at(-1);
      scene?.draw({
        stage: c?.stage || (last ? "complete" : "idle"),
        t: last ? 1 : t,
        accepted: c?.accepted ?? last?.accepted ?? true,
        id: c?.id || last?.id || "",
        pick: state.robot?.pick,
        place: state.robot?.place,
      });
    }
    function refresh() {
      syncImage();
      const c = state.carton,
        o = state.order,
        signals = c?.sampledInputs || signalImage(c, c?.t || 0);
      find(".line-mode").textContent = active
        ? "Running"
        : c
          ? "Paused"
          : interlock()
            ? "Waiting"
            : "Ready";
      find(".line-id").textContent = c ? c.id : o.id + " · " + o.status;
      find(".line-stage").textContent = labels[c?.stage || "idle"];
      find(".line-progress").value = c?.t || 0;
      const cycle = find('[data-work="cycle"]');
      cycle.disabled = active;
      cycle.textContent = active
        ? "Cycle running"
        : c
          ? "Resume carton"
          : "Start carton";
      find('[data-work="stop"]').disabled = !active;
      find('[data-line="cancel"]').disabled =
        c?.stage !== "feed" || c.bookingAttempted === true;
      find('[data-line="step"]').disabled = active;
      find("#quality").disabled = !!c;
      for (const [key, node] of sensors) {
        node.textContent = signals[key] ? "ON" : "OFF";
        node.parentElement.classList.toggle("lit", signals[key]);
      }
      const inventory = ctx.inventory();
      for (const [key, node] of measures)
        node.textContent =
          key === "good"
            ? o.good + " / " + o.target
            : key === "rejects"
              ? o.rejects
              : String(inventory[key]);
      ctx.renderOperator(find("#screen-live"));
      const rows = state.lineTrace
        .filter((row) => row.order === o.id)
        .slice(-24)
        .reverse();
      const list = find(".line-trace ol");
      list.replaceChildren();
      if (!rows.length) {
        const row = document.createElement("li");
        row.textContent = "No scans recorded for this order.";
        list.append(row);
      }
      for (const row of rows) {
        const li = document.createElement("li");
        li.textContent = row.text;
        list.append(li);
      }
      paintScene();
    }
    function pause() {
      active = false;
      state.lastRun = false;
      cancelAnimationFrame(frame);
      frame = 0;
    }
    function interlock() {
      if (!state.linePower)
        return "Cell power is off. Restore power before running.";
      if (!state.guard || !state.infeed || !state.auto)
        return "PLC output OFF. Restore the process permissive, infeed presence and automatic mode.";
      return (
        ctx.checkStart() ||
        (!seq?.ready(state)
          ? "The PLC sequence is not proven. Open Edit PLC sequence and prove both routes."
          : "")
      );
    }
    function allow() {
      const reason = interlock();
      if (reason) {
        pause();
        warn(reason);
        ctx.save();
        refresh();
        return false;
      }
      return true;
    }
    function reserve() {
      if (state.carton) return true;
      order.cartonSerial++;
      state.carton = {
        id: reservedId(),
        orderId: state.order.id,
        accepted: state.quality === "Pass",
        stage: "feed",
        t: 0,
      };
      syncImage();
      ctx.save();
      return true;
    }
    function traceLine(c, action, next, inputs) {
      const signals =
        Object.keys(inputs)
          .filter((k) => inputs[k])
          .join(", ") || "no inputs asserted";
      state.lineTrace.push({
        order: c.orderId,
        text:
          c.id +
          " · " +
          c.stage +
          " " +
          Math.round(c.t * 100) +
          "% · " +
          action +
          " → " +
          next +
          " · " +
          signals,
      });
      if (state.lineTrace.length > 80)
        state.lineTrace.splice(0, state.lineTrace.length - 80);
    }
    function advance() {
      if (!allow()) return false;
      const c = state.carton;
      if (!validate(c)) {
        pause();
        warn("This carton is no longer current. No movement was booked.");
        state.carton = null;
        ctx.save();
        refresh();
        return false;
      }
      c.t = Math.min(1, c.t + stepSize);
      syncImage();
      let out;
      try {
        out = seq.step(state, c.stage, c.sensors);
      } catch (error) {
        pause();
        warn(String(error.message || error));
        ctx.save();
        refresh();
        return false;
      }
      c.sampledInputs = { ...c.sensors };
      traceLine(c, out.action, out.next, c.sensors);
      if (c.stage === "complete" && out.action === "book") {
        pause();
        if (c.bookingAttempted) {
          warn(
            "Booking was already attempted. Inspect the order ledger before continuing.",
          );
          refresh();
          return false;
        }
        c.bookingAttempted = true;
        ctx.save();
        if (destroyed) return false;
        try {
          ctx.commit(c);
        } catch (error) {
          warn(
            "Booking outcome unconfirmed. Inspect the ledger before starting again. " +
              String(error.message || error),
          );
          if (!destroyed) refresh();
          return false;
        }
        if (destroyed) return false;
        if (!state.order.events.some((event) => event.id === c.id)) {
          warn(
            "Booking has not been confirmed by the order ledger. No automatic retry will run.",
          );
          ctx.save();
          refresh();
          return false;
        }
        state.carton = null;
        state.lastRun = false;
        ctx.save();
        if (destroyed) return false;
        warn(
          c.id +
            " · " +
            (c.accepted ? "accepted" : "rejected") +
            " recorded in MES. " +
            (state.interfaceOnline
              ? "ERP interface online."
              : "ERP event queued while offline."),
        );
        refresh();
        return false;
      }
      if (out.next !== c.stage) {
        c.stage = out.next;
        c.t = 0;
      }
      syncImage();
      ctx.save();
      refresh();
      return true;
    }
    function animate(now) {
      if (!active || destroyed) return;
      const elapsed = Math.max(0, now - lastScan);
      if (elapsed >= scanMs) {
        lastScan = now;
        if (!advance()) return;
      } else
        paintScene(
          Math.min(1, (state.carton?.t || 0) + (stepSize * elapsed) / scanMs),
        );
      frame = requestAnimationFrame(animate);
    }
    function start(manual) {
      if (active || !allow()) return;
      if (state.carton?.bookingAttempted) {
        warn("Booking has already been attempted. Inspect the order ledger.");
        return;
      }
      reserve();
      if (manual) {
        warn("Advanced one PLC scan. Automatic motion is paused.");
        advance();
        return;
      }
      active = true;
      state.lastRun = true;
      lastScan = performance.now();
      warn("Running " + state.carton.id + ".");
      ctx.save();
      refresh();
      frame = requestAnimationFrame(animate);
    }
    shell.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || !shell.contains(button)) return;
      event.stopPropagation();
      if (button.dataset.camera) {
        setCamera(button.dataset.camera);
        return;
      }
      switch (button.dataset.work || button.dataset.line) {
        case "cycle":
          start(false);
          break;
        case "step":
          start(true);
          break;
        case "stop":
          pause();
          warn(
            "Carton paused before the next scan. Resume or step to continue.",
          );
          ctx.save();
          refresh();
          break;
        case "cancel": {
          const carton = state.carton;
          if (!carton) return;
          if (carton.stage !== "feed" || carton.bookingAttempted) {
            warn(
              "Inspection has started. Resume this carton to book its outcome; it cannot be returned as an unused blank.",
            );
            return;
          }
          pause();
          state.carton = null;
          const handling =
            carton.id +
            " · unused blank returned from the infeed to physical stores before inspection. No MES completion or ERP posting.";
          ctx.log(handling);
          if (destroyed) return;
          warn(handling);
          refresh();
          break;
        }
        case "post":
          warn(ctx.post());
          ctx.save();
          refresh();
          break;
      }
    });
    shell.addEventListener("change", (event) => {
      const el = event.target;
      if (!Object.hasOwn(fields, el.id) && el.id !== "quality") return;
      event.stopPropagation();
      if (el.id === "quality") state.quality = el.value;
      else state[fields[el.id]] = el.value === "yes";
      if (active && interlock()) {
        pause();
        warn("Paused: " + interlock() + " Restore the condition, then resume.");
      }
      ctx.save();
      refresh();
    });
    function hide() {
      if (!active) return;
      pause();
      warn("Carton paused while the workspace was hidden.");
      ctx.save();
      refresh();
    }
    const visibility = () => {
      if (document.hidden) hide();
    };
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", visibility);
    refresh();
    return {
      destroy() {
        destroyed = true;
        const wasActive = active;
        pause();
        if (wasActive) ctx.save();
        scene?.destroy();
        window.removeEventListener("pagehide", hide);
        document.removeEventListener("visibilitychange", visibility);
      },
    };
  }
  window.SWLineWorkspace = Object.freeze({ mount });
})();
