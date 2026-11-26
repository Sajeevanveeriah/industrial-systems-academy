(() => {
  "use strict";

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function prepare(root, title, intro) {
    const style = node("style");
    style.textContent = `
      .swm{color:#142d31;font:inherit;background:#f7faf8;border:1px solid #c7d6cf;border-radius:14px;padding:clamp(14px,3vw,28px);color-scheme:light}
      .swm *{box-sizing:border-box}.swm h2,.swm h3,.swm p{margin:0 0 .7rem;color:#142d31}.swm h3{font-size:1.12rem}.swm p{line-height:1.55}.swm .brief{background:#e3f1eb;padding:.75rem 1rem;border-left:4px solid #207653;border-radius:4px;margin:1rem 0}
      .swm .panels,.swm .fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:1rem;margin-block:.8rem}
      .swm .fields{grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr));gap:.7rem}.swm .sheet{padding:1rem;border:1px solid #b9cbc1;border-radius:9px;background:white;min-width:0}
      .swm label{display:grid;gap:.3rem;font-size:.9rem;font-weight:650}.swm input,.swm select,.swm button{font:inherit;color:#182b28}.swm input,.swm select{width:100%;min-width:0;padding:.5rem;background:#fff;border:1px solid #819c8f;border-radius:4px}
      .swm button{background:#f3f7f5;border:1px solid #829c91;padding:.52rem .8rem;border-radius:6px;cursor:pointer;font-weight:600}.swm button.main{background:#175c44;color:white;border-color:#175c44}.swm button:disabled{opacity:.55;cursor:not-allowed}
      .swm :focus-visible{outline:3px solid #3467cc;outline-offset:2px}.swm .bar{display:flex;flex-wrap:wrap;gap:.5rem;margin:.7rem 0}.swm .report{background:#edf3f0;border-radius:8px;padding:.8rem;margin-top:.8rem}.swm .report ul{margin:.5rem 0;padding-left:1.2rem}.swm .good{color:#12623e}.swm .bad{color:#973917}.swm figure{margin:0}.swm svg{width:100%;height:auto;display:block;background:#eaf3ed;border-radius:8px}.swm figcaption{font-size:.85rem;color:#375749;margin:.4rem 0}.swm .jog{display:grid;grid-template-columns:auto minmax(5rem,1fr) auto;gap:.4rem;align-items:end}.swm .jog input{padding:.55rem .25rem}.swm .jog label{margin:0}.swm .note{font-size:.9rem;color:#365247}.swm .status{min-height:1.6em;font-weight:650}
      @media(prefers-reduced-motion:reduce){.swm *{scroll-behavior:auto}}
    `;
    const panel = node("section", undefined, "swm");
    panel.append(node("h2", title), node("p", intro));
    root.replaceChildren(style, panel);
    return panel;
  }

  function addButton(parent, title, action, primary = false) {
    const button = node("button", title, primary ? "main" : "");
    button.type = "button";
    button.addEventListener("click", action);
    parent.append(button);
    return button;
  }

  function field(parent, label, value, options, change) {
    const wrapper = node("label", label);
    const input = node(options ? "select" : "input");
    input.setAttribute("aria-label", label);
    if (options) {
      for (const option of options) {
        const item = node("option", option);
        item.value = option;
        input.append(item);
      }
    } else {
      input.autocomplete = "off";
      input.spellcheck = false;
    }
    input.value = value ?? "";
    input.addEventListener(options ? "change" : "input", () =>
      change(input.value.trim()),
    );
    wrapper.append(input);
    parent.append(wrapper);
    return input;
  }

  const roleSpec = {
    historian: {
      title: "Historian server",
      name: "hist-01",
      ip: "10.42.8.21",
      service: "History collector",
      port: 4841,
      grant: "Append samples",
    },
    mes: {
      title: "MES application server",
      name: "mes-01",
      ip: "10.42.8.22",
      service: "Production API",
      port: 8443,
      grant: "Post completions",
    },
  };

  function serverReads(config) {
    const tests = [];
    const add = (pass, label, detail) =>
      tests.push({ pass: Boolean(pass), label, detail });
    for (const [id, spec] of Object.entries(roleSpec)) {
      const item = config[id] || {};
      const nameOK = item.name?.toLowerCase() === spec.name;
      const resolveOK = item.dns === "10.42.8.10" && nameOK;
      const routeOK =
        item.ip === spec.ip &&
        item.prefix === "24" &&
        item.gateway === "10.42.8.1" &&
        item.ip !== config[id === "mes" ? "historian" : "mes"]?.ip;
      const serviceOK =
        item.service === spec.service &&
        item.bind === "Service NIC" &&
        Number(item.port) === spec.port;
      add(
        resolveOK,
        spec.title + " / name lookup",
        resolveOK
          ? spec.name + " resolves via the internal DNS record."
          : "Match the reserved host name and internal resolver .10.",
      );
      add(
        routeOK,
        spec.title + " / routed path",
        routeOK
          ? "Address reservation, /24 and route agree."
          : "Check the reservation, unique address, prefix and .1 gateway.",
      );
      add(
        serviceOK && routeOK && resolveOK,
        spec.title + " / client session",
        serviceOK && routeOK && resolveOK
          ? "A named client session reaches the intended listener."
          : "An end-to-end session needs name resolution, a valid path, the assigned service, NIC binding and port.",
      );
      add(
        item.grant === spec.grant,
        spec.title + " / least privilege",
        item.grant === spec.grant
          ? "The service can perform its job but cannot administer the database."
          : "Select only the database operation this role requires.",
      );
    }
    const history = config.historian || {},
      mes = config.mes || {};
    const days = Number(history.days),
      interval = Number(mes.interval);
    add(
      Number.isInteger(days) && days >= 30 && days <= 90,
      "Historical query window",
      "Keep 30 to 90 complete days under the training retention policy.",
    );
    add(
      Number.isInteger(interval) &&
        interval > 0 &&
        interval <= 15 &&
        mes.backup === "Independent repository",
      "MES recovery point",
      "An independent destination and a backup interval of 1 to 15 whole minutes meet this design target; a schedule is not a restore test.",
    );
    return tests;
  }

  function serversReady(state) {
    const config = state?.servers || {};
    return (
      config.ready === true && serverReads(config).every((test) => test.pass)
    );
  }

  function renderServers(root, ctx) {
    const config = (ctx.state.servers ||= {});
    const panel = prepare(
      root,
      "Commission the application servers",
      "Configure two reserved hosts, then exercise their paths from a simulated client. These are training service bindings, not vendor defaults.",
    );
    panel.append(
      node(
        "p",
        "Design brief: VLAN 42, /24, gateway 10.42.8.1, DNS 10.42.8.10. The collector appends samples; MES posts completions. Neither account may administer the database.",
        "brief",
      ),
    );
    const cards = node("div", undefined, "panels");
    const report = node("div", undefined, "report");
    report.setAttribute("role", "status");
    const renderReport = (showTests) => {
      report.replaceChildren();
      if (!showTests) {
        report.append(
          node(
            "p",
            "Configuration not commissioned. Run the acceptance checks after editing.",
          ),
        );
        return;
      }
      const tests = serverReads(config);
      report.append(
        node(
          "strong",
          tests.filter((test) => test.pass).length +
            " / " +
            tests.length +
            " acceptance checks passed",
        ),
      );
      const list = node("ul");
      for (const test of tests)
        list.append(
          node(
            "li",
            (test.pass ? "Pass: " : "Fail: ") + test.label + ". " + test.detail,
            test.pass ? "good" : "bad",
          ),
        );
      report.append(list);
    };
    for (const [id, spec] of Object.entries(roleSpec)) {
      const item = (config[id] ||= {});
      const card = node("article", undefined, "sheet");
      const extra =
        id === "historian"
          ? "Retain 30 to 90 days."
          : "Back up to an independent repository at least every 15 minutes.";
      card.append(
        node("h3", spec.title),
        node(
          "p",
          spec.name +
            " · " +
            spec.ip +
            " · " +
            spec.service +
            " on TCP " +
            spec.port +
            ", bound to Service NIC. " +
            extra,
          "note",
        ),
      );
      const fields = node("div", undefined, "fields");
      const edit = (key, label, options, initial) => {
        if (item[key] === undefined && initial !== undefined)
          item[key] = initial;
        field(fields, label, item[key], options, (value) => {
          item[key] = value;
          config.ready = false;
          config.checked = false;
          renderReport(false);
          ctx.save();
        });
      };
      edit("name", "Host name");
      edit("ip", "IPv4 address");
      edit("prefix", "Prefix length", undefined, "24");
      edit("gateway", "Default gateway");
      edit("dns", "DNS resolver");
      edit(
        "service",
        "Running service",
        ["Stopped", "History collector", "Production API"],
        "Stopped",
      );
      edit(
        "bind",
        "Listener binding",
        ["Localhost only", "Service NIC"],
        "Localhost only",
      );
      edit("port", "Listener TCP port");
      edit(
        "grant",
        "Database permission",
        [
          "No grant",
          "Read only",
          "Append samples",
          "Post completions",
          "Database admin",
        ],
        "No grant",
      );
      if (id === "historian") edit("days", "Retention (whole days)");
      else {
        edit(
          "backup",
          "Backup destination",
          ["Same virtual disk", "Independent repository"],
          "Same virtual disk",
        );
        edit("interval", "Backup interval (minutes)");
      }
      card.append(fields);
      cards.append(card);
    }
    panel.append(cards);
    addButton(
      panel,
      "Run server acceptance checks",
      () => {
        config.checked = true;
        config.ready = serverReads(config).every((test) => test.pass);
        renderReport(true);
        ctx.log(
          config.ready
            ? "Historian and MES passed the server acceptance suite."
            : "Server acceptance reported unmet configuration requirements.",
        );
      },
      true,
    );
    panel.append(report);
    renderReport(config.checked === true);
  }

  const home = { shoulder: 80, elbow: 15 };
  const poses = {
    pick: { shoulder: 12, elbow: 45 },
    place: { shoulder: 125, elbow: 35 },
  };
  const deg = Math.PI / 180;
  const lengths = [88, 71];
  function geometry(pose) {
    const a = pose.shoulder * deg,
      b = (pose.shoulder + pose.elbow) * deg;
    const joint = [
      160 + lengths[0] * Math.cos(a),
      175 - lengths[0] * Math.sin(a),
    ];
    const tool = [
      joint[0] + lengths[1] * Math.cos(b),
      joint[1] - lengths[1] * Math.sin(b),
    ];
    return { joint, tool };
  }
  const targets = {
    pick: geometry(poses.pick).tool,
    place: geometry(poses.place).tool,
  };
  const tolerance = 6; // The drawing uses one model millimetre per viewBox unit.
  function inRange(pose) {
    return (
      pose &&
      Number.isFinite(pose.shoulder) &&
      pose.shoulder >= 0 &&
      pose.shoulder <= 150 &&
      Number.isFinite(pose.elbow) &&
      pose.elbow >= -45 &&
      pose.elbow <= 105
    );
  }
  function atTarget(pose, name) {
    if (!inRange(pose)) return false;
    const point = geometry(pose).tool;
    return (
      Math.hypot(point[0] - targets[name][0], point[1] - targets[name][1]) <=
      tolerance
    );
  }
  function robotReady(state) {
    const cell = state?.robot || {};
    return (
      cell.ready === true &&
      cell.goodTest === true &&
      cell.rejectTest === true &&
      atTarget(cell.pick, "pick") &&
      atTarget(cell.place, "place")
    );
  }

  function draw(svg, pose, load) {
    const { joint, tool } = geometry(pose);
    const points = (p) => p.join(" ");
    const [x, y] = tool;
    const carton = (cx, cy) =>
      '<g transform="translate(' +
      cx +
      " " +
      cy +
      ')"><rect x="-7" y="-6" width="14" height="12" rx="1" fill="#d99051" stroke="#643c22"/><path d="M0 -6v5" stroke="#fff1cd"/></g>';
    const platform = (target, label) =>
      '<g transform="translate(' +
      points(target) +
      ')"><rect x="-18" y="8" width="36" height="5" rx="2" fill="#69867c"/><circle r="6" fill="none" stroke="#21885c" stroke-dasharray="2 2"/><text y="27" text-anchor="middle" font-size="9">' +
      label +
      "</text></g>";
    svg.innerHTML =
      "<title>Two-joint robot with infeed on the right and outfeed on the left</title>" +
      '<path d="M16 179H304 M25 173v-20m0 20h20" stroke="#598273" fill="none"/><g fill="#375c4c" font-size="8"><text x="45" y="176">X</text><text x="22" y="150">Y</text></g>' +
      platform(targets.pick, "INFEED") +
      platform(targets.place, "OUTFEED") +
      (load === "placed"
        ? carton(...targets.place)
        : load === "carried"
          ? carton(x, y)
          : carton(...targets.pick)) +
      '<path d="M160 175L' +
      points(joint) +
      "L" +
      points(tool) +
      '" fill="none" stroke="#173e37" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M160 175L' +
      points(joint) +
      '" stroke="#5ab28d" stroke-width="5"/>' +
      '<circle cx="160" cy="175" r="8" fill="#275548"/><circle cx="' +
      joint[0] +
      '" cy="' +
      joint[1] +
      '" r="6" fill="#ebbf69" stroke="#173e37"/>' +
      '<path d="M' +
      (x - 5) +
      " " +
      (y + 4) +
      'v-6h10v6" stroke="#173e37" fill="none" stroke-width="2"/>' +
      '<g fill="#173e37" font-size="9" font-weight="bold"><text x="162" y="193">J1</text><text x="' +
      (joint[0] + 8) +
      '" y="' +
      joint[1] +
      '">J2</text></g>';
  }

  function renderRobot(root, ctx) {
    const cell = (ctx.state.robot ||= {});
    if (!inRange(cell.jog)) cell.jog = { ...home };
    const panel = prepare(
      root,
      "Teach the carton transfer cell",
      "Jog the two axes, teach both tool positions and demonstrate how the cell handles an accepted carton and a rejected one.",
    );
    panel.append(
      node(
        "p",
        "Teach targets: pick at J1 12°, J2 45°; place at J1 125°, J2 35°. J1 is measured from +X and J2 from link one. The tool must land within 6 model mm of each mark. A rejected carton must stay at infeed.",
        "brief",
      ),
    );
    const layout = node("div", undefined, "panels");
    const figure = node("figure", undefined, "sheet");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 320 202");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Robot arm, carton, infeed and outfeed");
    const caption = node("figcaption");
    figure.append(svg, caption);
    const controls = node("div", undefined, "sheet");
    controls.append(node("h3", "Manual jog"));
    const feedback = node("p", "", "status");
    feedback.setAttribute("role", "status");
    const taught = node("p", "", "note");
    const testState = node("p", "", "note");
    let busy = false;
    let lastFeedback = "";
    const inputs = {};
    const redraw = (pose = cell.jog, load = "waiting") => {
      draw(svg, pose, load);
      const [x, y] = geometry(pose).tool;
      caption.textContent =
        "J1 " +
        pose.shoulder.toFixed(1) +
        "°, J2 " +
        pose.elbow.toFixed(1) +
        "° · Tool X " +
        (x - 160).toFixed(1) +
        " mm, Y " +
        (175 - y).toFixed(1) +
        " mm from base.";
      const description = (name) =>
        cell[name]
          ? cell[name].shoulder + "° / " + cell[name].elbow + "°"
          : "not taught";
      taught.textContent =
        "Taught pick: " +
        description("pick") +
        " · Taught place: " +
        description("place");
      testState.textContent =
        "Accepted-carton test: " +
        (cell.goodTest ? "passed" : "not passed") +
        " · Reject hold: " +
        (cell.rejectTest ? "passed" : "not passed");
      feedback.textContent = lastFeedback;
    };
    function invalidate() {
      cell.ready = false;
      cell.goodTest = false;
      cell.rejectTest = false;
    }
    function jog(axis, value) {
      if (busy) return;
      const next = { ...cell.jog, [axis]: value };
      if (!inRange(next) || value === cell.jog[axis]) return;
      cell.jog = next;
      inputs[axis].value = value;
      invalidate();
      lastFeedback =
        "Manual jog. Taught coordinates are unchanged; re-run both acceptance tests.";
      redraw();
      ctx.save();
    }
    for (const [axis, text, min, max] of [
      ["shoulder", "J1 shoulder", 0, 150],
      ["elbow", "J2 elbow", -45, 105],
    ]) {
      const bar = node("div", undefined, "jog");
      const minus = addButton(bar, "−1°", () =>
        jog(axis, Math.max(min, cell.jog[axis] - 1)),
      );
      minus.setAttribute("aria-label", "Decrease " + text + " by one degree");
      const label = node("label", text + " (" + min + "° to " + max + "°)");
      const input = node("input");
      input.type = "range";
      input.min = min;
      input.max = max;
      input.step = "1";
      input.value = cell.jog[axis];
      input.addEventListener("input", () => jog(axis, Number(input.value)));
      label.append(input);
      bar.append(label);
      inputs[axis] = input;
      const plus = addButton(bar, "+1°", () =>
        jog(axis, Math.min(max, cell.jog[axis] + 1)),
      );
      plus.setAttribute("aria-label", "Increase " + text + " by one degree");
      controls.append(bar);
    }
    const buttons = node("div", undefined, "bar");
    for (const name of ["pick", "place"]) {
      addButton(buttons, "Teach " + name, () => {
        if (busy) return;
        cell[name] = { ...cell.jog };
        invalidate();
        lastFeedback =
          "Recorded " + name + " pose. Re-run both acceptance tests.";
        redraw();
        ctx.log(
          "Robot " +
            name +
            " pose taught at J1 " +
            cell.jog.shoulder +
            "°, J2 " +
            cell.jog.elbow +
            "°.",
        );
      });
    }
    controls.append(buttons, taught);
    layout.append(figure, controls);
    panel.append(layout);
    const tests = node("div", undefined, "bar");
    const setBusy = (value) => {
      busy = value;
      for (const item of panel.querySelectorAll("button,input"))
        item.disabled = value;
    };
    function record(type) {
      if (type === "accepted") cell.goodTest = true;
      else cell.rejectTest = true;
      cell.ready = Boolean(cell.goodTest && cell.rejectTest);
      ctx.log(
        type === "accepted"
          ? "Robot acceptance: one carton picked and placed at outfeed."
          : "Robot reject test: bad carton stayed at infeed; no transfer command issued.",
      );
    }
    function run(type) {
      if (busy) return;
      const missing = ["pick", "place"].filter(
        (name) => !atTarget(cell[name], name),
      );
      if (missing.length) {
        invalidate();
        lastFeedback =
          "Test blocked: " +
          missing.join(" and ") +
          " outside tolerance or not taught. Jog to the target and teach again.";
        redraw();
        ctx.log(
          "Robot cycle blocked before simulated motion: invalid taught pose.",
        );
        return;
      }
      if (type === "rejected") {
        lastFeedback = "Rejected carton held at infeed. No pick was issued.";
        record(type);
        redraw(cell.jog, "waiting");
        return;
      }
      setBusy(true);
      const waypoints = [cell.jog, cell.pick, cell.place];
      const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? 100
        : 1450;
      const start = performance.now();
      lastFeedback = "Transferring accepted carton…";
      const frame = (now) => {
        if (!svg.isConnected) return;
        const phase = Math.min(2, (2 * (now - start)) / duration);
        const index = phase < 1 ? 0 : 1;
        const t = Math.max(0, phase - index);
        const lerp = (key) =>
          waypoints[index][key] +
          t * (waypoints[index + 1][key] - waypoints[index][key]);
        redraw(
          { shoulder: lerp("shoulder"), elbow: lerp("elbow") },
          phase < 1 ? "waiting" : "carried",
        );
        if (phase < 2) {
          requestAnimationFrame(frame);
          return;
        }
        cell.jog = { ...cell.place };
        inputs.shoulder.value = cell.jog.shoulder;
        inputs.elbow.value = cell.jog.elbow;
        lastFeedback = "Transfer complete. One carton is at outfeed.";
        setBusy(false);
        record(type);
        redraw(cell.jog, "placed");
      };
      requestAnimationFrame(frame);
    }
    addButton(tests, "Test accepted carton", () => run("accepted"), true);
    addButton(tests, "Test rejected carton", () => run("rejected"));
    panel.append(tests, feedback, testState);
    redraw();
  }

  function installLineCell(container) {
    const figure = node("figure");
    figure.style.cssText =
      "margin:0;background:#eaf3ed;color:#173e37;border:1px solid #bfd3c7;border-radius:10px;overflow:hidden";
    const drawing = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    drawing.setAttribute("viewBox", "0 0 320 202");
    drawing.setAttribute("role", "img");
    drawing.setAttribute(
      "aria-label",
      "Articulated robot: inspected infeed at right, accepted outfeed at left",
    );
    drawing.style.cssText =
      "width:100%;height:auto;max-height:260px;display:block";
    const caption = node("figcaption");
    caption.style.cssText =
      "color:#244536;margin:0;padding:.5rem .8rem;font-size:.9rem";
    figure.append(drawing, caption);
    container.replaceChildren(figure);
    return { drawing, caption };
  }

  function showCell(container, state) {
    if (!container) return;
    const { drawing, caption } = installLineCell(container);
    const pose = inRange(state?.robot?.jog) ? state.robot.jog : home;
    draw(drawing, pose, "waiting");
    caption.textContent =
      "Robot cell at rest. Inspect the carton at the right infeed; transfer accepted cartons to the left outfeed.";
  }

  function playCycle(container, state, accepted) {
    if (!container) return;
    const cell = state?.robot || {};
    if (!atTarget(cell.pick, "pick") || !atTarget(cell.place, "place")) {
      showCell(container, state);
      container.querySelector("figcaption").textContent =
        "No motion replay: both taught tool positions must be in tolerance.";
      return;
    }
    const { drawing, caption } = installLineCell(container);
    const pick = { ...cell.pick },
      place = { ...cell.place };
    if (!accepted) {
      draw(drawing, inRange(cell.jog) ? cell.jog : home, "waiting");
      caption.textContent =
        "Inspection rejected the carton at infeed. No pick was issued; the carton remains here for clearance.";
      return;
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reduced ? 80 : 1200;
    const start = performance.now();
    caption.textContent =
      "Inspection passed. Feed-forward replay of the taught pick and place.";
    function frame(now) {
      if (!drawing.isConnected) return;
      const phase = Math.min(1, Math.max(0, (now - start) / duration));
      const t = phase;
      const interpolate = (key) => pick[key] + t * (place[key] - pick[key]);
      draw(
        drawing,
        { shoulder: interpolate("shoulder"), elbow: interpolate("elbow") },
        t < 1 ? "carried" : "placed",
      );
      if (phase < 1) {
        requestAnimationFrame(frame);
        return;
      }
      caption.textContent =
        "Feed-forward replay complete. The accepted carton is at the outfeed.";
    }
    requestAnimationFrame(frame);
  }

  window.SWMachines = {
    renderServers,
    renderRobot,
    serversReady,
    robotReady,
    showCell,
    playCycle,
  };
})();
