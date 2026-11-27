(() => {
  "use strict";
  const P = window.FryProcess,
    I = window.FryInstall,
    L = window.FryLedger;
  const $ = (id) => document.getElementById(id),
    root = $("workspace");
  const query = new URLSearchParams(location.search);
  const mode = query.get("mode");
  const stageMode = mode === "practice" || mode === "stageworked";
  const targetIndex = Math.max(
    0,
    P.stages.findIndex((s) => s.id === query.get("stage")),
  );
  const targetId = P.stages[targetIndex].id;
  const catalogue = window.StageCourseFiles?.catalogue || "stage-lessons.html";
  const kind = [
    "solved",
    "worked",
    "fitout",
    "batch",
    "stageworked",
    "practice",
  ].includes(mode)
    ? mode
    : "build";
  const readOnly = kind === "worked" || kind === "stageworked",
    key = stageMode
      ? "signalworks.fries.stage.v1." + targetId
      : kind === "build"
        ? "signalworks.fries.v2.build"
        : "signalworks.fries.v1." + (kind === "fitout" ? "build" : kind);
  const stages = P.stages,
    fmt = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });
  const html = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function blank(
    n = stageMode ? (kind === "stageworked" ? 301 : 201) + targetIndex : 1,
  ) {
    const seeded = kind === "solved" || kind === "worked" || stageMode;
    const installed = seeded || kind === "batch";
    const ledger = seeded ? L.solved() : L.empty();
    if (seeded) ledger.lot = "POT-" + (2600 + n);
    const fresh = {
      version: 1,
      journeyVersion: 1,
      site: kind === "build" ? SiteBuild.empty() : SiteBuild.solved(),
      n,
      batchId: "FRY-" + (1000 + n),
      orderId: "PO-" + (7100 + n),
      initialKg: 1000,
      ...(stageMode ? { shiftDate: "2026-01-01" } : {}),
      installation: installed ? I.solved() : I.empty(),
      configs: stages.map((_, i) =>
        installed ? P.solvedStage(i) : P.emptyStage(i),
      ),
      ledger,
      index: 0,
      progress: 0,
      guard: true,
      events: [],
      history: [],
      holdLog: [],
      samples: [],
    };
    if (seeded) adoptPrior(fresh);
    return fresh;
  }
  function adoptPrior(s, legacy = false) {
    if (s.ledger.receiptKg > 0 && s.ledger.lot) {
      L.summary(s);
      window.BatchMomentum.example(s);
    }
    if (legacy && s.ledger.status === "Released") {
      s.aps = {
        source: "prior-release",
        prior: {
          batchId: s.batchId,
          orderId: s.orderId,
          product: s.ledger.product,
          destination: s.ledger.destination,
          plannedKg: s.ledger.plannedKg,
        },
      };
    } else if (
      s.ledger.status === "Released" &&
      window.BatchMomentum.ready(s).ok
    ) {
      s.aps = window.BatchAPS.example(s);
      s.aps.source = "worked";
    }
    s.journeyVersion = 1;
  }
  function linked(s) {
    const intake = window.BatchMomentum.ready(s);
    return intake.ok ? window.BatchAPS.ready(s) : intake;
  }
  function exampleOrder() {
    if (
      readOnly ||
      stale ||
      kind === "batch" ||
      state.events.length ||
      state.ledger.receiptKg > 0 ||
      (state.momentum?.stage && state.momentum.stage !== "draft")
    )
      return "Continue the current handover.";
    const example = L.solved();
    const result = L.receiveLot(state, {
      lot: "POT-" + (2600 + state.n),
      kg: state.initialKg,
    });
    if (!result.ok) return result.why;
    const release = L.releaseOrder(state, example);
    if (!release.ok) return release.why;
    adoptPrior(state);
    return (
      "Worked lot, quality release and APS reservation loaded for " +
      state.batchId +
      "."
    );
  }
  function shiftMinute(s, p) {
    const slot = window.BatchAPS.slot(s);
    if (!slot) return null;
    return (
      slot.startMin +
      ((slot.endMin - slot.startMin) * (s.index + p)) / stages.length
    );
  }
  function stamp(s) {
    // Simulated planning shift is dated after receipt; real operating time is accelerated.
    const minute = shiftMinute(s, s.progress);
    if (minute === null) return new Date().toISOString();
    if (!s.shiftDate) {
      const receipt = Date.parse(s.momentum?.receivedAt || "");
      const base = new Date(Number.isFinite(receipt) ? receipt : Date.now());
      base.setUTCDate(base.getUTCDate() + 1);
      s.shiftDate = base.toISOString().slice(0, 10);
    }
    return new Date(
      Date.parse(s.shiftDate + "T00:00:00Z") + Math.round(minute * 60000),
    ).toISOString();
  }
  function makeEvent(s, i) {
    const inputKg = i === 0 ? s.initialKg : s.events[i - 1].outputKg;
    const result = P.operate(i, s.configs[i], inputKg);
    if (
      ![result.outputKg, result.addedKg, result.removedKg].every(
        Number.isFinite,
      ) ||
      Math.abs(inputKg + result.addedKg - result.removedKg - result.outputKg) >
        0.021
    )
      throw Error("Station balance failed. No result recorded.");
    return {
      ...result,
      id: s.batchId + "-" + String(i + 1).padStart(2, "0"),
      stage: stages[i].id,
      index: i,
      inputKg,
      batchId: s.batchId,
      orderId: s.orderId,
      rawLot: s.ledger.lot,
      receiptId: s.momentum?.receiptId,
      line: s.aps?.plan?.line,
      ts: stamp(s),
      recipe: JSON.parse(JSON.stringify(s.configs[i])),
    };
  }
  function book(s) {
    if (s.events.length !== s.index)
      throw Error("This station already has a result.");
    const e = makeEvent(s, s.index);
    if (e.stage === "dispatch") {
      const check = L.dispatch(s);
      if (!check.ok) throw Error(check.why);
    }
    const result = L.record(s, e);
    if (!result.ok) throw Error(result.why);
    s.events.push(e);
    s.progress = 1;
    sample("MES stage completion", e.id);
    return e;
  }
  let state = blank(),
    saved = null,
    stale = false,
    canSave = true;
  function seedStation() {
    const until = kind === "stageworked" ? targetIndex + 1 : targetIndex;
    for (let i = 0; i < until; i++) {
      state.index = i;
      state.progress = 1;
      book(state);
      state.events[i].origin = "Worked setup";
    }
    state.index = targetIndex;
    state.progress = readOnly ? 1 : 0;
    if (!readOnly) state.configs[targetIndex] = P.emptyStage(targetIndex);
    state.exercise = targetId;
  }
  if (stageMode) seedStation();
  else if (readOnly) {
    for (let i = 0; i < stages.length; i++) {
      state.index = i;
      state.progress = 1;
      sample("Worked example · stage complete");
      book(state);
    }
  }
  if (!readOnly)
    try {
      saved = localStorage.getItem(key);
      const record = JSON.parse(saved);
      if (
        record?.version === 1 &&
        (!stageMode ||
          (record.exercise === targetId &&
            record.index === targetIndex &&
            record.batchId === state.batchId)) &&
        record.configs?.length === stages.length &&
        Array.isArray(record.events) &&
        record.index >= 0 &&
        record.index < stages.length
      )
        state = record;
    } catch {
      canSave = false;
    }
  if (!state.journeyVersion) adoptPrior(state, true);
  if (!state.site)
    state.site = kind === "build" ? SiteBuild.empty() : SiteBuild.solved();
  let lessonReader = null,
    replayFrame = 0;
  let facilityBench = null,
    siteBench = null,
    avevaPanel = null;
  let view = "",
    scene = null,
    rack = null,
    active = false,
    selected = state.index,
    frame = 0,
    at = 0,
    from = 0,
    notice = "",
    lastPaint = -1;
  const complete = () => state.events.length > state.index,
    done = () => state.events.length === stages.length;
  const mass = () => state.events.at(-1)?.outputKg ?? state.initialKg;
  function stop() {
    active = false;
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function freezeStale() {
    stop();
    stale = true;
    root.inert = true;
    $("storage").replaceChildren(
      document.createTextNode("Another tab has saved this workspace. "),
    );
    const b = document.createElement("button");
    b.textContent = "Load latest work";
    b.onclick = () => location.reload();
    $("storage").append(b);
  }
  function save() {
    if (readOnly || stale || !canSave) return;
    try {
      if (localStorage.getItem(key) !== saved) {
        freezeStale();
        return;
      }
      const next = JSON.stringify(state);
      localStorage.setItem(key, next);
      saved = next;
    } catch {
      canSave = false;
      $("storage").textContent =
        "Browser storage unavailable. This exercise will last for this tab.";
    }
  }
  window.addEventListener("storage", (e) => {
    if (
      !readOnly &&
      (e.key === key || e.key === null) &&
      localStorage.getItem(key) !== saved
    )
      freezeStale();
  });
  function allowed() {
    if (readOnly)
      return "This is a completed example. Choose Operate installed plant to run it yourself.";
    if (stale) return "Load the current saved workspace.";
    const handover = SiteBuild.check(state.site);
    if (!handover.ok) return handover.why;
    if (state.sensorStale)
      return "SCADA process data is stale. Restore the PLC tag feed before operating this training line.";
    if (complete())
      return "Station complete. Release the batch to the next stage.";
    const unmet = I.check(state.installation).find((c) => !c.ok);
    if (unmet) return "Installation needed: " + unmet.label + ". " + unmet.why;
    const handoff = linked(state);
    if (!handoff.ok) return handoff.why;
    const release = L.ready(state);
    if (!release.ok) return release.why;
    const process = P.check(state.index, state.configs[state.index]);
    if (!process.ok) return process.why;
    if (
      !I.permit(state.installation, {
        start: true,
        guard: state.guard,
        ready: process.ok,
        stage: stages[state.index].id,
      })
    )
      return "PLC run output is off. Check the process permissive and compiled station logic.";
    if (stages[state.index].id === "dispatch") {
      const d = L.dispatch(state);
      if (!d.ok) return d.why;
    }
    return "";
  }
  function sample(command, eventId = null) {
    const cfg = state.configs[state.index],
      stage = stages[state.index];
    state.samples ||= [];
    state.samples.push({
      id: state.batchId + "/hist/" + (state.samples.length + 1),
      ts: stamp(state),
      quality: state.sensorStale ? "Stale" : "Good",
      orderId: state.orderId,
      lot: state.ledger.lot,
      eventId,
      stageId: stage.id,
      kg: state.events.at(-1)?.outputKg ?? state.initialKg,
      batch: state.batchId,
      stage: stage.name,
      command,
      progress: Math.round(state.progress * 100),
      setpoint: cfg.setpoint,
      unit: stage.unit,
      mass: state.events.at(-1)?.outputKg ?? state.initialKg,
      guard: state.guard,
    });
  }
  function tickProgress(p) {
    const problem = allowed();
    if (problem) {
      stop();
      notice = problem;
      save();
      update();
      return;
    }
    state.progress = Math.min(1, p);
    sample(active ? "PLC scan" : "Manual scan");
    if (state.progress >= 1) {
      stop();
      try {
        const e = book(state);
        notice =
          e.id +
          " recorded: " +
          fmt.format(e.outputKg) +
          " kg " +
          stages[state.index].material +
          ".";
        if (done()) notice += " Dispatch complete.";
      } catch (err) {
        state.progress = 0.99;
        notice = err.message;
      }
    }
    save();
    update();
  }
  function run() {
    const why = allowed();
    if (why) {
      notice = why;
      update();
      return;
    }
    if (active) return;
    active = true;
    from = state.progress;
    at = performance.now();
    lastPaint = -1;
    notice = "Operating " + stages[state.index].name + ".";
    update();
    let boundary = Math.floor(from * 10);
    function loop(now) {
      if (!active || stale) return;
      const p = Math.min(1, from + (now - at) / 4800);
      if (p >= 1) {
        tickProgress(1);
        return;
      }
      state.progress = p;
      if (Math.floor(p * 10) !== boundary) {
        boundary = Math.floor(p * 10);
        sample("Running");
        save();
        update();
      } else if (now - lastPaint > 34) {
        draw();
        lastPaint = now;
      }
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
  }
  function hold(reason) {
    if (active) {
      stop();
      sample(reason);
      state.holdLog.push({
        stage: stages[state.index].name,
        pct: Math.round(state.progress * 100),
        reason,
      });
      notice = reason;
      save();
    }
    if (view === "floor") update();
  }
  function transferPermitted() {
    return (
      !stageMode &&
      SiteBuild.check(state.site).ok &&
      linked(state).ok &&
      !readOnly &&
      !stale &&
      complete() &&
      !done() &&
      !state.sensorStale &&
      I.check(state.installation).every((c) => c.ok) &&
      I.permit(state.installation, {
        start: true,
        guard: state.guard,
        ready: true,
        stage: stages[state.index].id,
      })
    );
  }
  function release() {
    if (active || !transferPermitted()) return;
    const nextId = I.nextStage(state.installation, stages[state.index].id);
    const to = stages.findIndex((stage) => stage.id === nextId);
    if (to !== state.events.length) {
      notice =
        "PLC route does not match the next released MES operation. Check the installed program.";
      update();
      return;
    }
    state.index = to;
    selected = state.index;
    state.progress = 0;
    notice =
      "Transferred " + state.batchId + " to " + stages[selected].name + ".";
    save();
    floor();
  }
  function draw() {
    scene?.draw({
      index: state.index,
      progress: state.progress,
      running: active,
      batch: state.batchId,
      installed: state.configs.map((c, i) => P.isInstalled(i, c)),
    });
  }
  function recipeLocked() {
    return (
      readOnly ||
      active ||
      selected < state.events.length ||
      (selected === state.index && state.progress > 0)
    );
  }
  function metrics(list) {
    return (
      '<div class="metrics">' +
      list
        .map(
          ([k, v]) =>
            "<div><span>" +
            html(k) +
            "</span><strong>" +
            html(v) +
            "</strong></div>",
        )
        .join("") +
      "</div>"
    );
  }
  function tags() {
    return {
      batch: state.batchId,
      stage: stages[state.index].name,
      mass: mass(),
      progress: Math.round(state.progress * 100),
      running: active,
      alarm: !state.guard,
      stock: L.summary(state).sapFinished,
      quality: { "PLC.Quality": state.sensorStale ? "Stale" : "Good" },
    };
  }
  function update() {
    if (view !== "floor" || !$("batch")) return;
    $("batch").textContent = state.batchId + " / " + state.orderId;
    $("current").textContent = stages[state.index].name;
    $("recipe-tag").textContent =
      stages[state.index].parameter +
      " · " +
      (state.configs[state.index].setpoint === ""
        ? "unconfigured"
        : state.configs[state.index].setpoint + " " + stages[state.index].unit);
    const unmet = I.check(state.installation).find((c) => !c.ok);
    $("next-task").replaceChildren();
    if (!readOnly && !complete()) {
      const aid = document.createElement("a");
      if (unmet) {
        aid.href = ["rack", "patch"].includes(unmet.id)
          ? "#rack"
          : "#installation";
        aid.textContent = "Open " + unmet.label + " commissioning →";
      } else if (!linked(state).ok) {
        aid.href = window.BatchMomentum.ready(state).ok ? "#aps" : "#momentum";
        aid.textContent = aid.href.endsWith("#aps")
          ? "Reserve the line in APS →"
          : "Receive the potato lot in Momentum →";
      } else if (!P.check(state.index, state.configs[state.index]).ok) {
        aid.href = "#";
        aid.textContent = "Commission the current station →";
        aid.onclick = (e) => {
          e.preventDefault();
          inspect(state.index, true);
        };
      }
      if (aid.textContent) $("next-task").append(aid);
    }
    $("bar").value = state.progress;
    $("percent").textContent = Math.round(state.progress * 100) + "%";
    $("feedback").textContent =
      notice ||
      (complete()
        ? done()
          ? "Batch dispatched. Inspect the genealogy and stock movements."
          : "Stage recorded. Release the batch when ready."
        : allowed() ||
          "Station ready. Start or step through this operation. Workshop time is accelerated.");
    $("go").disabled = active || complete() || readOnly;
    $("step").disabled = active || complete() || readOnly;
    $("hold").disabled = !active;
    $("transfer").disabled = !transferPermitted();
    $("stale-input").disabled = readOnly;
    $("stale-input").textContent = state.sensorStale
      ? "Restore PLC tag feed"
      : "Simulate stale PLC tags";
    $("trip").disabled = readOnly;
    $("trip").textContent = state.guard
      ? "Open process permissive"
      : "Restore process permissive";
    $("flags").textContent = done()
      ? "Dispatched"
      : complete()
        ? "Awaiting transfer"
        : active
          ? "Running"
          : state.progress > 0
            ? "Held"
            : "Idle";
    const s = L.summary(state);
    $("business-live").innerHTML = metrics([
      ["Lot mass", fmt.format(mass()) + " kg"],
      ["Reserved line", state.aps?.plan?.line || "Awaiting APS"],
      [
        "Simulated shift (UTC)",
        state.aps?.plan ? stamp(state).slice(11, 19) : "Awaiting APS",
      ],
      ["MES operations recorded", state.events.length + " / " + stages.length],
      ["SAP finished stock", fmt.format(s.sapFinished) + " kg"],
      ["Dispatched", fmt.format(s.dispatched) + " kg"],
      ["Awaiting SAP", s.queued],
    ]);
    I.operator($("operator"), state.installation, tags());
    for (const b of $("route").children) {
      const i = Number(b.dataset.inspect);
      b.classList.toggle("done", i < state.events.length);
      b.classList.toggle("current", i === state.index);
      b.setAttribute("aria-pressed", String(i === selected));
    }
    if ($("station-config")) $("station-config").disabled = recipeLocked();
    $("stage-example").disabled = recipeLocked();
    $("recipe-state").textContent = recipeLocked()
      ? "Recorded or in-process recipe. Inspect the configuration here; future stages can be commissioned before their batch arrives."
      : "Mount the machine, connect the two I/O paths, set the recipe and prove fault recovery. Or load the worked station.";
    draw();
    if (stageMode) {
      updateCoach();
      return;
    }
    avevaPanel?.update();
    const stepKey = [
      state.batchId,
      state.events.length,
      state.index,
      state.guard,
      state.sensorStale,
      P.check(state.index, state.configs[state.index]).ok,
    ].join("/");
    if ($("batch-route").dataset.stageKey !== stepKey) {
      $("batch-route").dataset.stageKey = stepKey;
      window.BatchJourney.guide($("batch-route"), state, {
        go: goTo,
      });
    }
  }
  function teardown() {
    cancelAnimationFrame(replayFrame);
    replayFrame = 0;
    lessonReader?.destroy();
    lessonReader = null;
    facilityBench?.destroy();
    facilityBench = null;
    avevaPanel?.destroy();
    avevaPanel = null;
    siteBench?.destroy();
    siteBench = null;
    rack?.destroy();
    rack = null;
    if (scene) {
      scene.destroy();
      scene = null;
    }
  }
  function inspect(index, focus = false) {
    if (stageMode && index !== targetIndex) {
      notice =
        "This exercise controls " +
        stages[targetIndex].name +
        ". Choose another lesson from the catalogue.";
      update();
      return;
    }
    selected = index;
    if (!stageMode)
      window.PlantPath.context($("field-instruction"), "floor", "", index);
    $("picked").textContent = "Inspecting " + stages[index].name + ".";
    $("station-config").replaceChildren();
    P.mount($("station-config"), index, state.configs[index], (config) => {
      if (config) state.configs[index] = config;
      save();
      notice = "Station settings saved.";
      update();
    });
    if (!stageMode) {
      let lessonLink = $("stage-reader-link");
      if (!lessonLink) {
        lessonLink = document.createElement("a");
        lessonLink.id = "stage-reader-link";
        $("stage-example").after(lessonLink);
      }
      lessonLink.href = "#lesson/" + stages[index].id;
      lessonLink.textContent =
        "Read or watch the " + stages[index].name.toLowerCase() + " lesson →";
    }
    $("inspect-title").textContent = stages[index].name + " · station setup";
    update();
    if (focus) $("inspect-title").scrollIntoView({ block: "nearest" });
  }
  function floor() {
    teardown();
    root.innerHTML =
      '<div class="ophead"><h2>Plant floor</h2><span id="batch" class="lot"></span></div><div class="route" id="route" aria-label="Inspect process stages"></div><div class="panelset"><section class="box viewport"><div class="viewhead"><strong>Process line</strong><div class="buttons">' +
      ["overview", "station", "top"]
        .map(
          (x) =>
            '<button data-cam="' +
            x +
            '">' +
            {
              overview: "Whole line",
              station: "Follow batch",
              top: "Plan view",
            }[x] +
            "</button>",
        )
        .join("") +
      '</div></div><div class="runbar"><div class="ophead"><strong id="current"></strong><span><span id="flags" class="pill"></span> <span id="percent"></span></span></div><progress id="bar" max="1"></progress><div class="buttons"><button id="go" class="primary">Start / resume</button><button id="hold">Hold</button><button id="step">Step 25%</button><button id="transfer">Release to next stage</button></div></div><canvas tabindex="0" id="plant-canvas" aria-label="Interactive three-dimensional French fry plant"></canvas><div class="viewfoot"><strong id="recipe-tag"></strong><span id="picked">Drag to orbit. Select a machine to inspect its setup.</span><div class="buttons"><button id="stale-input">Simulate stale PLC tags</button><button id="trip">Open process permissive</button></div></div></section><aside class="dock"><div id="aveva-dock"></div><details class="box" open><summary>Configured plant HMI</summary><div id="operator"></div><a href="#installation">Configure screen and tags →</a></details><section class="box"><h3>MES and SAP readback</h3><div id="business-live"></div><a href="#business">Open the order and postings →</a></section><div class="statusline"><span id="feedback" role="status"></span><div id="next-task"></div></div></aside></div><section class="stage-editor"><h2 id="inspect-title"></h2><p id="recipe-state" class="subtle"></p><div class="buttons"><button id="stage-example">Apply worked station settings</button></div><fieldset id="station-config"></fieldset></section>';
    for (const [i, s] of stages.entries()) {
      const b = document.createElement("button");
      b.dataset.inspect = i;
      b.textContent = i + 1 + ". " + s.name;
      b.onclick = () => inspect(i, true);
      $("route").append(b);
    }
    scene = window.FryScene.mount($("plant-canvas"), (i) => inspect(i, true));
    root
      .querySelectorAll("[data-cam]")
      .forEach((b) => (b.onclick = () => scene.camera(b.dataset.cam)));
    $("go").onclick = run;
    $("hold").onclick = () =>
      hold("Operator hold. Resume to continue this batch.");
    $("step").onclick = () =>
      tickProgress(
        Math.min(1, (Math.floor(state.progress * 4 + 0.0001) + 1) / 4),
      );
    $("transfer").onclick = release;
    $("stale-input").onclick = () => {
      const wasRunning = active;
      state.sensorStale = !state.sensorStale;
      if (state.sensorStale) {
        hold("Stale PLC data; process hold and historian sampling suspended.");
        notice =
          "PLC tags are stale. Verify quality on the operator screen, then restore the feed.";
      } else notice = "Tag feed restored. Verify quality and resume.";
      if (!wasRunning || !state.sensorStale)
        sample(
          state.sensorStale ? "Tag quality stale" : "Tag quality restored",
        );
      save();
      update();
    };
    $("trip").onclick = () => {
      state.guard = !state.guard;
      if (!state.guard) {
        hold("PLC permissive open. Station stopped.");
        notice = "PLC permissive open. Restore before restart.";
      } else
        notice = "Process permissive restored. Start is a separate command.";
      save();
      update();
    };
    $("stage-example").onclick = () => {
      if (recipeLocked()) return;
      state.configs[selected] = P.solvedStage(selected);
      save();
      notice =
        "Applied the worked equipment, I/O and recipe for " +
        stages[selected].name +
        ".";
      inspect(selected);
    };
    if (kind === "batch") {
      $("go").parentElement.hidden = true;
      $("trip").parentElement.hidden = true;
      const widgets = $("operator").closest("details");
      widgets.open = false;
      root.querySelector(".dock").append(widgets);
    }
    if (stageMode) {
      mountPracticeFloor();
      inspect(targetIndex);
      scene.focusStation(targetIndex);
      return;
    }
    const station = document.createElement("section");
    station.id = "batch-aveva";
    root.querySelector(".stage-editor").before(station);
    avevaPanel = window.BatchAveva.mount(station, state, {
      tags,
      save,
      dock: $("aveva-dock"),
      now: () => stamp(state),
      readonly: readOnly,
      canStart: () => allowed() || (active ? "Already running." : ""),
      canTransfer: transferPermitted,
      start: run,
      hold: () => hold("Held from operator HMI."),
      step: () => $("step").click(),
      release,
      trip: () => $("trip").click(),
      stale: () => $("stale-input").click(),
    });
    inspect(selected);
  }
  function history() {
    const s = L.summary(state);
    root.innerHTML =
      '<section class="history-card"><h2>Batch genealogy</h2><p>Follow the same material lot through each completed operation. Added mass and removed mass explain the difference between the incoming and outgoing weight.</p>' +
      metrics([
        ["Batch", state.batchId],
        ["Production order", state.orderId],
        ["Raw potato lot", state.ledger.lot || "Awaiting receipt"],
        ["Potato charge", state.initialKg + " kg"],
        ["Latest batch mass", fmt.format(mass()) + " kg"],
        ["Dispatched", fmt.format(s.dispatched) + " kg"],
      ]) +
      "<table><thead><tr><th>Station / event</th><th>Input kg</th><th>Added kg</th><th>Removed kg</th><th>Output kg</th><th>Process evidence</th></tr></thead><tbody>" +
      state.events
        .map(
          (e) =>
            "<tr><td>" +
            html(stages[e.index].name) +
            "<small>" +
            html(e.id) +
            "</small></td><td>" +
            fmt.format(e.inputKg) +
            "</td><td>" +
            fmt.format(e.addedKg) +
            "</td><td>" +
            fmt.format(e.removedKg) +
            "</td><td>" +
            fmt.format(e.outputKg) +
            "</td><td><details><summary>" +
            html(e.note) +
            "</summary><pre>" +
            html(JSON.stringify(e.recipe, null, 2)) +
            "</pre></details></td></tr>",
        )
        .join("") +
      "</tbody></table>" +
      (!state.events.length
        ? '<p>No stations released yet. <a href="#floor">Open the plant floor</a>.</p>'
        : "") +
      "<p>" +
      state.holdLog.length +
      " operating holds recorded.</p>" +
      state.holdLog
        .map(
          (h) =>
            "<div>" +
            html(h.stage) +
            " · " +
            h.pct +
            "% · " +
            html(h.reason) +
            "</div>",
        )
        .join("") +
      "</section>";
  }
  function goTo(hash) {
    const next = "#" + hash.replace(/^#/, "");
    if (location.hash !== next) {
      location.hash = next;
      return;
    }
    const target =
      view === "floor" && !P.check(state.index, state.configs[state.index]).ok
        ? $("inspect-title")
        : view === "floor"
          ? $("aveva-dock")
          : root;
    target.scrollIntoView({ block: "start" });
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
  function stageUrl(i, mode, section) {
    const u = new URL(location.href);
    u.search = "";
    u.searchParams.set("mode", mode);
    u.searchParams.set("stage", stages[i].id);
    u.hash = section + "/" + stages[i].id;
    return u.href;
  }
  function restartStation() {
    if (
      kind !== "practice" ||
      stale ||
      !confirm(
        "Restart only this station attempt? Your other stages and full plant stay saved.",
      )
    )
      return;
    stop();
    state = blank();
    seedStation();
    selected = targetIndex;
    notice = "Station attempt restarted.";
    save();
    render();
  }
  function lesson(i) {
    const sourceMode = [
      "build",
      "fitout",
      "batch",
      "solved",
      "worked",
    ].includes(kind)
      ? kind
      : null;
    function openWorked() {
      const u = new URL(stageUrl(i, "stageworked", "floor"));
      if (sourceMode) u.searchParams.set("returnPlant", sourceMode);
      location.assign(u.href);
    }
    lessonReader = window.StageCourse.mount(root, i, {
      mode: kind,
      mediaUrls: window.StageCourseFiles?.media,
      practiceLabel: stageMode
        ? "Practise this station"
        : "Return to this station on my batch",
      openPractice: () =>
        stageMode
          ? location.assign(stageUrl(i, "practice", "floor"))
          : goTo("floor/" + stages[i].id),
      openWorked,
      openGuide: () => {
        location.hash = "guide/process";
      },
      practiceStatus:
        stageMode && !readOnly
          ? {
              ok: complete(),
              why: complete()
                ? "Station run recorded."
                : P.check(i, state.configs[i]).why,
            }
          : undefined,
      resetPractice: kind === "practice" ? restartStation : undefined,
    });
  }
  function mountPracticeFloor() {
    const panel = root.querySelector(".panelset"),
      editor = root.querySelector(".stage-editor"),
      dock = root.querySelector(".dock");
    panel.append(editor);
    panel.after(dock);
    for (const a of dock.querySelectorAll('a[href^="#"]')) a.hidden = true;

    const bar = document.createElement("section");
    bar.id = "practice-coach";
    bar.className = "box";
    bar.innerHTML =
      '<div class="practice-links"><a data-course-link="reader">Read / watch lesson</a><a data-course-link="compare"></a><a data-course-link="catalogue">All ten stages</a></div><h2></h2><p data-coach-step role="status"></p><p data-coach-evidence></p><div class="practice-links"><button type="button" id="worked-replay">Replay the worked operation</button><a data-course-link="next"></a><button type="button" id="restart-station">Restart this attempt</button></div>';
    root.prepend(bar);
    const item = (k) => bar.querySelector('[data-course-link="' + k + '"]');
    item("reader").href = stageUrl(targetIndex, "practice", "lesson");
    item("compare").href = stageUrl(
      targetIndex,
      readOnly ? "practice" : "stageworked",
      "floor",
    );
    item("compare").textContent = readOnly
      ? "Return to my attempt"
      : "Inspect worked example";
    const originMode = query.get("returnPlant");
    if (
      readOnly &&
      ["build", "fitout", "batch", "solved", "worked"].includes(originMode)
    ) {
      const u = new URL(location.href);
      u.search = "";
      u.searchParams.set("mode", originMode);
      u.hash = "floor/" + targetId;
      item("compare").href = u.href;
      item("compare").textContent = "Return to my plant batch";
      u.hash = "lesson/" + targetId;
      item("reader").href = u.href;
    }
    item("catalogue").href = catalogue;
    item("next").href =
      targetIndex < stages.length - 1
        ? stageUrl(targetIndex + 1, "practice", "lesson")
        : catalogue;
    item("next").textContent =
      targetIndex < stages.length - 1
        ? "Next lesson: " + stages[targetIndex + 1].name + " →"
        : "Return to all lessons →";
    $("worked-replay").hidden = !readOnly;
    $("worked-replay").onclick = () => {
      const button = $("worked-replay");
      button.disabled = true;
      const since = performance.now(),
        event = state.events[targetIndex],
        installation = state.configs.map((c, i) => P.isInstalled(i, c));
      function show(now) {
        const t = Math.min(1, (now - since) / 4800);
        scene.draw({
          index: targetIndex,
          progress: t,
          running: t < 1,
          batch: state.batchId,
          installed: installation,
        });
        $("bar").value = t;
        $("percent").textContent = Math.round(t * 100) + "%";
        $("flags").textContent = t < 1 ? "Example replay" : "Recorded";
        I.operator($("operator"), state.installation, {
          ...tags(),
          mass: t < 1 ? event.inputKg : event.outputKg,
          progress: Math.round(t * 100),
          running: t < 1,
        });
        if (t < 1) replayFrame = requestAnimationFrame(show);
        else {
          replayFrame = 0;
          button.disabled = false;
          update();
        }
      }
      replayFrame = requestAnimationFrame(show);
    };
    $("restart-station").hidden = readOnly;
    $("restart-station").onclick = restartStation;
    $("stage-example").hidden = true;
    $("recipe-state").textContent = readOnly
      ? "Inspect the completed configuration and compare its signals and recovery proof with your own."
      : "Configure this station using the guide. Inspecting the separate worked example preserves your attempt.";
    root
      .querySelector(".ophead")
      .setAttribute("aria-label", "Station exercise");
    $("route").hidden = true;
    $("transfer").hidden = true;
    const h = bar.querySelector("h2");
    h.textContent =
      (readOnly ? "Worked example · " : "Your task · ") +
      stages[targetIndex].name;
  }
  function updateCoach() {
    const bar = $("practice-coach");
    if (!bar) return;
    const i = targetIndex,
      c = state.configs[i],
      s = stages[i],
      e = state.events[i];
    const good = P.check(i, c).ok;
    let instruction;
    if (e)
      instruction = readOnly
        ? "Compare the mounted device, terminal pairs and recipe below with your own attempt."
        : "Stage passed. Your verified configuration ran on the 3D plant and its MES record is saved.";
    else if (!P.isInstalled(i, c))
      instruction =
        "1. Choose " +
        s.machine +
        " in the equipment inventory and mount it in the bay.";
    else if (c.sensor !== s.sensor)
      instruction =
        "2. Follow the I/O schedule and connect the field sensor to " +
        s.sensor +
        ".";
    else if (c.actuator !== s.actuator)
      instruction =
        "3. Connect the controller output to the actuator for " +
        s.actuator +
        ".";
    else if (
      c.setpoint === "" ||
      !Number.isFinite(Number(c.setpoint)) ||
      Number(c.setpoint) < s.min ||
      Number(c.setpoint) > s.max
    )
      instruction =
        "4. Set " +
        s.parameter +
        " to the worked target of " +
        s.target +
        " " +
        s.unit +
        " and apply the field by leaving it.";
    else if (!good)
      instruction =
        c.faultState === "tripped"
          ? "5. Investigate the injected fault. Choose the recovery action and verify the equipment is ready."
          : "5. Inject the station fault and observe the hold. Then prove recovery.";
    else
      instruction = active
        ? "6. Watch the material pass through the machine. Hold or resume if you need to inspect a change."
        : "6. Start this operation or step it in 25% increments. Check its output against the worked mass balance.";
    $("recipe-state").textContent = readOnly
      ? "Recorded configuration and recovery proof."
      : "Mount and wire the machine, set the recipe, then test the hold and recovery.";
    const step = bar.querySelector("[data-coach-step]");
    if (step.textContent !== instruction) step.textContent = instruction;
    const input =
      e?.inputKg ?? state.events[i - 1]?.outputKg ?? state.initialKg;
    const evidence = bar.querySelector("[data-coach-evidence]");
    evidence.textContent = e
      ? e.id +
        " · " +
        fmt.format(input) +
        " kg input + " +
        fmt.format(e.addedKg) +
        " kg added − " +
        fmt.format(e.removedKg) +
        " kg removed = " +
        fmt.format(e.outputKg) +
        " kg output. " +
        e.note
      : "Incoming batch " +
        state.batchId +
        " · " +
        fmt.format(input) +
        " kg. " +
        (i
          ? "Prior operations are supplied as worked records for this exercise."
          : "This is the first operation in the example batch.");
    bar.querySelector('[data-course-link="next"]').hidden = !e;
  }
  function render() {
    if (stale) return;
    if (active) hold("Paused on leaving the plant floor.");
    teardown();
    const [destination, detail] = location.hash.slice(1).split("/");
    view = destination;
    if (
      ![
        "site",
        "lesson",
        "guide",
        "floor",
        "rack",
        "facility",
        "installation",
        "business",
        "momentum",
        "aps",
        "sap",
        "history",
      ].includes(view)
    )
      view =
        kind === "build" ? "site" : kind === "batch" ? "momentum" : "floor";
    if (stageMode && !["lesson", "floor", "guide"].includes(view))
      view = "lesson";
    for (const a of document.querySelectorAll(".tabs a")) {
      if (a.hash === "#" + view) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    const journey = $("batch-route");
    journey.replaceChildren();
    if (stageMode) {
      let back = $("exercise-back");
      if (!back) {
        back = document.createElement("p");
        back.id = "exercise-back";
        $("workspace").before(back);
      }
      back.replaceChildren();
      back.hidden = view !== "guide";
      if (!back.hidden) {
        const a = document.createElement("a");
        a.href = stageUrl(targetIndex, kind, "floor");
        a.textContent =
          "Return to " + stages[targetIndex].name.toLowerCase() + " station →";
        back.append(a);
      }
    }
    const guide = $("field-instruction");
    guide.replaceChildren();
    if (view === "site") {
      root.replaceChildren();
      siteBench = window.SiteBuild.mount(
        root,
        state.site,
        (next) => {
          if (next) state.site = next;
          save();
        },
        readOnly,
      );
      return;
    }
    if (view === "guide") {
      const services = window.FacilityServices.statusFor({
        storageKey: key + ".facility",
        readonly: readOnly,
        worked: kind === "solved" || readOnly,
      });
      window.PlantPath.mount(root, state, detail, services);
      return;
    }
    const handover = SiteBuild.check(state.site);
    if (!handover.ok && view !== "history") {
      root.innerHTML =
        '<section class="box site-blocked"><h2>Prepare the site for fit-out</h2><p>' +
        html(handover.why) +
        '</p><a class="primary path-action" href="#site">Continue site construction →</a> <a href="#guide">See the build sequence</a></section>';
      return;
    }
    const go = goTo;
    const journeyPage = ["momentum", "aps", "floor", "sap"].includes(view);
    const refreshGuide = () => {
      if (journeyPage) window.BatchJourney.guide(journey, state, { go });
    };
    refreshGuide();
    const ctx = {
      go,
      readonly: readOnly,
      locked: () =>
        stale || active || state.progress > 0 || !!state.events.length,
      save: () => {
        save();
        refreshGuide();
      },
    };
    if (view === "momentum" || view === "aps") {
      const station = document.createElement("section");
      root.replaceChildren(station);
      (view === "momentum" ? window.BatchMomentum : window.BatchAPS).mount(
        station,
        state,
        ctx,
      );
      return;
    }
    if (view === "sap") {
      root.replaceChildren();
      const mutate = (fn) => {
        if (readOnly || stale)
          return { ok: false, why: "Read-only trace.", count: 0 };
        const result = fn();
        ctx.save();
        return result;
      };
      window.BatchJourney.trace(root, state, {
        ...ctx,
        setOnline: (v) => mutate(() => L.setOnline(state, v)),
        replay: () => mutate(() => L.replay(state)),
      });
      return;
    }
    if (view === "lesson") {
      const i = stageMode
        ? targetIndex
        : Math.max(
            0,
            stages.findIndex((s) => s.id === detail),
          );
      lesson(i);
      return;
    }
    const stageIndex = stages.findIndex((stage) => stage.id === detail);
    if (view === "floor") selected = stageIndex >= 0 ? stageIndex : state.index;
    window.PlantPath.context(guide, view, detail, selected);
    if (view === "floor") {
      if (stageMode) selected = targetIndex;
      floor();
      if (!stageMode && stageIndex >= 0) scene?.focusStation(stageIndex);
      return;
    }
    if (view === "history") {
      history();
      if (state.samples?.length) {
        const detail = document.createElement("details");
        detail.className = "history-card";
        const name = document.createElement("summary");
        name.textContent = "Historian samples (" + state.samples.length + ")";
        detail.append(name);
        const log = document.createElement("ol");
        for (const v of state.samples) {
          const li = document.createElement("li");
          li.textContent =
            v.batch +
            " · " +
            v.stage +
            " · " +
            v.command +
            " · " +
            v.progress +
            "% · recipe " +
            v.setpoint +
            " " +
            v.unit +
            " · " +
            fmt.format(v.mass) +
            " kg";
          log.append(li);
        }
        detail.append(log);
        root.append(detail);
      }
      if (!readOnly && done() && !L.summary(state).queued) {
        const next = document.createElement("button");
        next.textContent = "Start another batch with this installation";
        next.onclick = () => {
          const prior = {
            batchId: state.batchId,
            orderId: state.orderId,
            events: state.events,
            ledger: state.ledger,
            momentum: state.momentum,
            aps: state.aps,
            samples: state.samples,
            avevaAlarmRecord: state.avevaAlarmRecord,
            shiftDate: state.shiftDate,
            initialKg: state.initialKg,
            n: state.n,
            index: state.index,
            progress: state.progress,
          };
          const history = [...state.history, prior];
          const fresh = blank(state.n + 1);
          fresh.history = history;
          fresh.site = state.site;
          fresh.installation = state.installation;
          fresh.configs = state.configs;
          state = fresh;
          selected = 0;
          notice = "Installation retained. A new batch is ready for planning.";
          save();
          location.hash = kind === "batch" ? "momentum" : "floor";
        };
        root.append(next);
      }
      for (const past of state.history) {
        const item = document.createElement("details");
        const title = document.createElement("summary");
        title.textContent = past.batchId + " · completed batch";
        item.append(title);
        const table = document.createElement("ol");
        for (const e of past.events) {
          const li = document.createElement("li");
          li.textContent =
            e.id +
            " · " +
            stages[e.index].name +
            " · " +
            fmt.format(e.outputKg) +
            " kg";
          table.append(li);
        }
        item.append(table);
        const moves = document.createElement("ul");
        for (const move of past.ledger.moves) {
          const li = document.createElement("li");
          li.textContent =
            move.id +
            " · SAP " +
            move.code +
            " · " +
            move.material +
            " · " +
            fmt.format(move.qty) +
            " kg · " +
            (move.posted ? "posted" : "queued");
          moves.append(li);
        }
        item.append(moves);
        if (past.momentum && past.aps) {
          const trace = document.createElement("section");
          item.append(trace);
          item.addEventListener("toggle", () => {
            if (item.open && !trace.hasChildNodes())
              window.BatchJourney.trace(trace, past, {
                readonly: true,
                go: (hash) => {
                  location.hash = hash.replace(/^#/, "");
                },
              });
          });
        }
        root.append(item);
      }
      return;
    }
    const panel = document.createElement("div");
    root.replaceChildren(panel);
    if (view === "facility") {
      facilityBench = window.FacilityServices.mount(panel, {
        storageKey: key + ".facility",
        readonly: readOnly,
        worked: kind === "solved" || readOnly,
      });
      return;
    }
    if (view === "rack") {
      rack = window.FryRack.mount(
        panel,
        state.installation,
        (config) => {
          if (config) state.installation = config;
          save();
        },
        readOnly,
      );
      return;
    }
    if (view === "installation") {
      I.mount(panel, state.installation, (config) => {
        if (config) state.installation = config;
        save();
      });
      panel.addEventListener("click", (event) => {
        const tab = event.target.closest("[data-fi-tab]");
        if (tab)
          window.PlantPath.context(
            $("field-instruction"),
            "installation",
            tab.dataset.fiTab,
            selected,
          );
      });
      if (I.check(state.installation).some((row) => row.id === detail))
        panel.querySelector('[data-fi-tab="' + detail + '"]')?.click();
    } else
      L.mount(panel, state, save, {
        example: kind === "batch" || readOnly ? null : exampleOrder,
      });
    if (readOnly) {
      const lock = () =>
        panel
          .querySelectorAll("input,textarea,select,button:not([data-fi-tab])")
          .forEach((el) => {
            el.disabled = true;
          });
      lock();
      panel.addEventListener("click", () => queueMicrotask(lock));
    }
  }
  if (stageMode) {
    document.body.dataset.exercise = kind;
    $("mode").replaceChildren(
      new Option("Your station attempt", "practice"),
      new Option("Inspect worked station", "stageworked"),
    );
    document.querySelector(".mast h1").textContent = stages[targetIndex].name;
    document.querySelector(".mast h1+p").textContent =
      "One stage of the French fry plant. Your practice settings are saved separately for each stage.";
  }
  document
    .querySelectorAll('a[href="stage-lessons.html"]')
    .forEach((a) => (a.href = catalogue));
  $("mode").value = kind;
  $("mode").onchange = (e) => {
    if (stageMode) {
      location.assign(stageUrl(targetIndex, e.target.value, "floor"));
      return;
    }
    const u = new URL(location.href);
    u.searchParams.set("mode", e.target.value);
    u.searchParams.delete("stage");
    u.hash =
      e.target.value === "batch"
        ? "momentum"
        : e.target.value === "worked"
          ? "history"
          : e.target.value === "build"
            ? "site"
            : e.target.value === "fitout"
              ? "rack"
              : "floor";
    location.href = u.href;
  };
  $("mode-note").textContent = {
    practice:
      "Read or watch first, then install, wire and prove this machine on the plant.",
    stageworked:
      "Read-only example with the completed event. Your own attempt stays saved.",
    batch:
      "Installed plant with an empty material receipt and schedule. Start by weighing the delivery in Momentum. All four workstations share this batch.",
    fitout:
      "The buildings and utilities are commissioned. Install the systems inside them. Earlier build-from-rack work resumes here.",
    build:
      "Greenfield workshop. Start on vacant land and use the site guide to build and inspect the facility before equipment fit-out.",
    solved:
      "Solved installation and released order. Operate each stage yourself and inspect the settings that make it work.",
    worked:
      "Completed worked batch. Inspect the station settings, material balance and SAP movements.",
  }[kind];
  window.addEventListener("hashchange", render);
  document.querySelector(".skip").onclick = (e) => {
    e.preventDefault();
    root.focus();
  };
  window.addEventListener("pagehide", () => {
    if (active) hold("Paused when the browser left this workshop.");
    teardown();
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) render();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && active)
      hold("Paused while the workshop was hidden.");
  });
  render();
})();
