(() => {
  "use strict";
  const format = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });
  const alarms = {
    guard: "Process permissive open",
    quality: "PLC tag feed stale",
  };
  const pens = { kg: ["Batch mass", "kg"], progress: ["Stage progress", "%"] };
  function clock(ts) {
    return new Date(ts).toISOString().slice(11, 23);
  }
  function timestamp(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return typeof value === "string" && value.trim() ? Date.parse(value) : NaN;
  }
  function styles() {
    if (document.getElementById("sw-batch-aveva-style")) return;
    const sheet = document.createElement("style");
    sheet.id = "sw-batch-aveva-style";
    sheet.textContent = `
      .bav{display:grid;gap:12px;min-width:0;color:#183c31;color-scheme:light}.bav *{box-sizing:border-box}.bav h2,.bav h3,.bav p,.bav dl{margin:0}
      .bav .bav-card{background:#fff;border:1px solid #bdcdc1;border-radius:9px;padding:clamp(12px,2vw,19px);display:grid;gap:10px;min-width:0;grid-template-columns:minmax(0,1fr)}
      .bav .bav-controls,.bav .bav-head{display:flex;flex-wrap:wrap;align-items:center;gap:7px}.bav .bav-head{justify-content:space-between}
      .bav button,.bav select,.bav input{font:inherit;border:1px solid #7b9684;border-radius:5px;padding:6px 9px;color:#1a422e;background:#fafcf8;min-width:0;max-width:100%;min-height:36px}
      .bav button{cursor:pointer;font-weight:650}.bav button:disabled{opacity:.53;cursor:default}.bav button.primary{background:#205c42;color:white}
      .bav .bav-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(145px,100%),1fr));gap:7px}.bav label{display:grid;gap:3px;color:#365342;font-size:.84rem;min-width:0}
      .bav .bav-grid>div{background:#f0f6ed;border:1px solid #ceddcd;border-radius:5px;padding:6px 9px}.bav dt{font-size:.78rem}.bav dd{margin:0;font-weight:700;overflow-wrap:anywhere}
      .bav .bav-fault{background:#fff0da!important;border-color:#be8650!important}.bav .bav-help,.bav summary,.bav .bav-status{font-size:.88rem}.bav summary,.bav a{color:#17583c}.bav summary{cursor:pointer;font-weight:650}
      .bav .bav-scroll{max-height:220px;overflow:auto}.bav table{width:100%;font-size:.83rem;border-collapse:collapse;text-align:left}.bav th,.bav td{padding:5px 7px;border-bottom:1px solid #d4dfd4}.bav th{background:#eef5ea}.bav canvas{width:100%;height:188px;display:block;background:#f6f9f2;border-radius:5px}
      .bav .bav-events{max-height:136px;overflow:auto;margin:0;padding-left:1.35em;font-size:.85rem}.bav .bav-check{display:inline-flex;align-items:center;gap:5px}.bav .bav-check input{min-height:0}
      .bav-dock .bav-card{padding:10px;gap:6px}.bav-dock h2{font-size:1.12rem;letter-spacing:-.025em}.bav-dock h3{font-size:.94rem}.bav-dock .bav-head>a{font-size:.78rem}
      .bav-dock [data-bav-out="tags"]{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.bav-dock [data-bav-out="alarms"]{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}
      .bav-dock .bav-grid>div{padding:4px 6px}.bav-dock dt{font-size:.69rem;line-height:1.2}.bav-dock dd{font-size:.82rem;line-height:1.25}
      .bav-dock .bav-controls{gap:4px}.bav-dock button{min-height:30px;font-size:.79rem;padding:4px 7px}.bav-dock [data-bav-out="notice"]:empty{display:none}
      .bav :focus-visible{outline:3px solid #a85523;outline-offset:2px}
    `;
    document.head.append(sheet);
  }
  const button = (key, label, primary = false) =>
    '<button type="button" data-bav-action="' +
    key +
    '"' +
    (primary ? ' class="primary"' : "") +
    ">" +
    label +
    "</button>";
  const select = (key, label, choices) =>
    "<label>" +
    label +
    '<select data-bav-field="' +
    key +
    '">' +
    choices
      .map(([v, t]) => '<option value="' + v + '">' + t + "</option>")
      .join("") +
    "</select></label>";
  function freshAlarmRecord(batchId) {
    return { batchId, flags: {}, events: [] };
  }
  function mount(root, state, ctx) {
    styles();
    const el = document.createElement("section");
    el.className = "bav";
    root.replaceChildren(el);
    const readonly = Boolean(ctx.readonly);
    const currentRecord = state.avevaAlarmRecord;
    let store =
      currentRecord?.batchId === state.batchId &&
      currentRecord?.flags &&
      Array.isArray(currentRecord.events)
        ? currentRecord
        : freshAlarmRecord(state.batchId);
    if (readonly) store = JSON.parse(JSON.stringify(store));
    let dock = null;
    const q = (s) => el.querySelector(s) || dock?.querySelector(s),
      field = (k) => q('[data-bav-field="' + k + '"]'),
      out = (k) => q('[data-bav-out="' + k + '"]'),
      act = (k) => q('[data-bav-action="' + k + '"]');
    el.innerHTML =
      `<section class="bav-card"><div class="bav-head"><h2>InTouch operator practice</h2><a href="#installation">Configure operator tags →</a></div>
      <p class="bav-help">Operate the batch shown in the 3D plant. Stage progress, measured mass and alarm events follow the same PLC commands.</p>
      <dl data-bav-out="tags" class="bav-grid"></dl><div class="bav-controls">` +
      button("start", "Start / resume", true) +
      button("hold", "Hold") +
      button("step", "Step 25%") +
      button("release", "Release to next stage") +
      '</div><div class="bav-controls">' +
      button("trip", "Open process permissive") +
      button("stale", "Simulate stale PLC tags") +
      '</div><div class="bav-head"><h3>Alarm summary</h3>' +
      button("ack", "Acknowledge outstanding alarms") +
      '</div><dl data-bav-out="alarms" class="bav-grid"></dl><ol data-bav-out="events" class="bav-events"></ol><p data-bav-out="notice" role="status"></p>' +
      "<details><summary>Practise a hold and recovery</summary><p>Start the stage, then open the process permissive. Observe the same held batch in the 3D view. Acknowledge the alarm while the permissive is open. Restore the permissive and resume. Repeat with the tag feed stale, and compare the quality events with the historian samples.</p></details></section>" +
      '<section class="bav-card"><div class="bav-head"><h2>Historian Client trend</h2><label class="bav-check"><input type="checkbox" data-bav-field="follow" checked>Follow new samples</label></div><p class="bav-help">Query this batch’s timestamped stage measurements. The window ends at the newest batch sample. Process steps can share timestamps and sampling intervals vary with the commands.</p><div class="bav-grid">' +
      select(
        "pen",
        "Trend pen",
        Object.entries(pens).map(([k, [name, unit]]) => [
          k,
          name + " (" + unit + ")",
        ]),
      ) +
      select("stage", "Stage", [["all", "Entire batch"]]) +
      select("window", "Time window", [
        ["all", "Whole recorded batch"],
        ["15", "Latest 15 seconds"],
        ["60", "Latest 60 seconds"],
        ["300", "Latest 5 minutes"],
      ]) +
      select("quality", "Sample quality", [
        ["all", "All qualities"],
        ["good", "Good only"],
      ]) +
      '</div><div class="bav-controls">' +
      button("query", "Run historical query", true) +
      "</div>" +
      '<p data-bav-out="summary" class="bav-status"></p><canvas data-bav-out="chart" role="img" aria-label="Batch trend shown numerically in the sample table below"></canvas><div class="bav-scroll"><table><caption>Returned samples in chronological order</caption><thead><tr><th scope="col">UTC</th><th scope="col">Operation</th><th scope="col">Value</th><th scope="col">Quality</th><th scope="col">Command</th></tr></thead><tbody data-bav-out="rows"></tbody></table></div>' +
      "<details><summary>Trace a stage</summary><p>Step through a station, select its name and run a stage-progress query. Compare the recorded commands with their timestamps. Switch the pen to batch mass and inspect a completed operation. A gap in the archive has no measured value.</p></details>" +
      '<p class="bav-help">Signal Works simulates these workflows. <a href="https://docs.aveva.com/bundle/intouch-hmi-2023/page/319322.html" target="_blank" rel="noopener">AVEVA alarm states ↗</a> · <a href="https://docs.aveva.com/bundle/sp-omi-awc-2026/page/244593.html" target="_blank" rel="noopener">AVEVA Historian Client Trend ↗</a></p></section>';
    if (ctx.dock) {
      dock = document.createElement("section");
      dock.className = "bav bav-dock";
      ctx.dock.replaceChildren(dock);
      const operator = el.firstElementChild;
      const log = document.createElement("section");
      log.className = "bav-card";
      const title = document.createElement("h3");
      title.textContent = "Batch alarm and recovery log";
      log.append(
        title,
        operator.querySelector(".bav-help"),
        operator.querySelector(".bav-events"),
        operator.querySelector("details"),
      );
      dock.append(operator);
      el.prepend(log);
    }
    const stationNames = new Map(
      (window.FryProcess?.stages || []).map((stage) => [stage.id, stage.name]),
    );
    for (const [id, name] of stationNames)
      field("stage").add(new Option(name, id));
    const preferences = store.query;
    if (preferences) {
      for (const key of ["pen", "stage", "window", "quality"]) {
        if (
          Array.from(field(key).options).some(
            (option) => option.value === preferences[key],
          )
        )
          field(key).value = preferences[key];
      }
      field("follow").checked = preferences.follow !== false;
    }
    let frozen = !field("follow").checked,
      disposed = false,
      lastCount = -1,
      lastSample = null,
      plot = null;
    let filter = { pen: "kg", stage: "all", window: "all", quality: "all" };
    function addEvent(code, text) {
      const utc = timestamp(ctx.now?.());
      store.events.push({
        code,
        text,
        ts: Number.isFinite(utc) ? utc : Date.now(),
        stage: ctx.tags().stage,
      });
    }
    function saveAlarms() {
      if (readonly) return;
      state.avevaAlarmRecord = store;
      ctx.save();
    }
    function trackAlarms() {
      const signals = {
        guard: state.guard === false,
        quality: state.sensorStale === true,
      };
      let changed = false;
      for (const [key, active] of Object.entries(signals)) {
        const previous = (store.flags[key] ||= {
          active: false,
          pending: false,
          acknowledged: false,
        });
        if (previous.active === active) continue;
        previous.active = active;
        if (active) {
          previous.pending = true;
          previous.acknowledged = false;
        }
        addEvent(
          key,
          alarms[key] + (active ? " · active" : " · returned to normal"),
        );
        changed = true;
      }
      if (changed) saveAlarms();
    }
    function tiles(parent, items) {
      const fragment = document.createDocumentFragment();
      for (const [label, value, alert] of items) {
        const block = document.createElement("div"),
          dt = document.createElement("dt"),
          dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = String(value ?? "Unavailable");
        block.append(dt, dd);
        if (alert) block.className = "bav-fault";
        fragment.append(block);
      }
      parent.replaceChildren(fragment);
    }
    function alarmRows() {
      tiles(
        out("alarms"),
        Object.entries(alarms).map(([k, label]) => {
          const f = store.flags[k];
          const text = f.active
            ? f.acknowledged
              ? "Active · acknowledged"
              : "Active · unacknowledged"
            : f.pending
              ? "Returned · awaiting acknowledgement"
              : f.acknowledged
                ? "Normal · acknowledged"
                : "Normal";
          return [label, text, f.active || f.pending];
        }),
      );
      const events = out("events");
      events.replaceChildren();
      for (const row of store.events.slice(-30).reverse()) {
        const li = document.createElement("li");
        li.textContent =
          clock(row.ts) + " UTC · " + row.stage + " · " + row.text;
        events.append(li);
      }
      act("ack").disabled =
        readonly || !Object.values(store.flags).some((v) => v.pending);
    }
    function samples() {
      const rows = [];
      let legacy = 0;
      const pen = filter.pen;
      for (const row of state.samples || []) {
        if ((row.batchId ?? row.batch) !== state.batchId) continue;
        const ts = timestamp(row.ts);
        if (!Number.isFinite(ts)) {
          legacy++;
          continue;
        }
        const raw = pen === "kg" ? (row.kg ?? row.mass) : row.progress;
        const value =
          typeof raw === "number" && Number.isFinite(raw) ? raw : null;
        const quality =
          typeof row.quality === "string" ? row.quality : "Unknown";
        rows.push({
          ts,
          stageId: row.stageId,
          stage: row.stage || stationNames.get(row.stageId) || row.stageId,
          command: row.command || "",
          value,
          quality,
        });
      }
      rows.sort((a, b) => a.ts - b.ts);
      const last = rows.at(-1)?.ts || 0;
      const cutoff =
        filter.window === "all"
          ? -Infinity
          : last - Number(filter.window) * 1000;
      return {
        legacy,
        rows: rows.filter(
          (row) =>
            row.ts >= cutoff &&
            (filter.stage === "all" ||
              filter.stage === row.stageId ||
              stationNames.get(filter.stage) === row.stage),
        ),
      };
    }
    function chart() {
      if (!plot || disposed) return;
      const canvas = out("chart"),
        width = canvas.clientWidth,
        height = canvas.clientHeight;
      if (!width || !height) return;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const c = canvas.getContext("2d");
      if (!c) return;
      c.scale(scale, scale);
      c.font = "11px Consolas,monospace";
      c.fillStyle = "#405e4d";
      const all = plot.all,
        valid = plot.shown.filter((r) => r.value !== null);
      if (!valid.length) {
        c.fillText("No measured values in this selection.", 12, 28);
        return;
      }
      const lower = Math.min(...valid.map((r) => r.value)),
        upper = Math.max(...valid.map((r) => r.value));
      const padding = Math.max(1, (upper - lower) * 0.1),
        lo = Math.max(0, lower - padding),
        hi = upper + padding;
      const first = all[0].ts,
        last = all.at(-1).ts,
        left = 60,
        right = width - 15,
        top = 17,
        bottom = height - 27;
      const x = (t) =>
        last === first
          ? (left + right) / 2
          : left + ((right - left) * (t - first)) / (last - first);
      const y = (v) => bottom - ((bottom - top) * (v - lo)) / (hi - lo);
      c.strokeStyle = "#c4d5c6";
      c.fillText(pens[filter.pen][1], 5, 10);
      for (const n of [lo, (lo + hi) / 2, hi]) {
        c.beginPath();
        c.moveTo(left, y(n));
        c.lineTo(right, y(n));
        c.stroke();
        c.fillText(format.format(n), 4, y(n) + 3);
      }
      c.fillText(clock(first), left, bottom + 16);
      if (first !== last) {
        c.textAlign = "right";
        c.fillText(clock(last), right, bottom + 16);
        c.textAlign = "left";
      }
      let prev = null;
      for (const r of all) {
        if (r.value === null) {
          prev = null;
          continue;
        }
        const ok = r.quality.toLowerCase() === "good",
          px = x(r.ts),
          py = y(r.value);
        if (ok) {
          c.strokeStyle = "#146d52";
          c.fillStyle = c.strokeStyle;
          c.lineWidth = 2;
          if (prev && prev.stage === r.stage) {
            c.beginPath();
            c.moveTo(x(prev.ts), y(prev.value));
            c.lineTo(px, py);
            c.stroke();
          }
          c.beginPath();
          c.arc(px, py, 3, 0, Math.PI * 2);
          c.fill();
          prev = r;
        } else {
          prev = null;
          if (filter.quality === "good") continue;
          c.strokeStyle = "#9f4a21";
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(px - 3, py - 3);
          c.lineTo(px + 3, py + 3);
          c.moveTo(px - 3, py + 3);
          c.lineTo(px + 3, py - 3);
          c.stroke();
        }
      }
    }
    function query() {
      filter = {
        pen: field("pen").value,
        stage: field("stage").value,
        window: field("window").value,
        quality: field("quality").value,
      };
      const { rows, legacy } = samples(),
        good = rows.filter((row) => row.quality.toLowerCase() === "good");
      const shown = filter.quality === "good" ? good : rows;
      plot = { all: rows, shown };
      const dateRange = rows.length
        ? " · " +
          new Date(rows[0].ts).toISOString() +
          " to " +
          new Date(rows.at(-1).ts).toISOString()
        : "";
      out("summary").textContent =
        shown.length +
        " returned · " +
        good.length +
        " good · " +
        (rows.length - good.length) +
        " other quality" +
        dateRange +
        (legacy
          ? " · " + legacy + " older samples without timestamps omitted."
          : "");
      const table = out("rows"),
        fragment = document.createDocumentFragment();
      for (const r of shown) {
        const tr = document.createElement("tr");
        for (const text of [
          new Date(r.ts).toISOString(),
          r.stage,
          r.value === null
            ? "Unavailable"
            : format.format(r.value) + " " + pens[filter.pen][1],
          r.quality,
          r.command,
        ]) {
          const td = document.createElement("td");
          td.textContent = text;
          tr.append(td);
        }
        fragment.append(tr);
      }
      if (!shown.length) {
        const tr = document.createElement("tr"),
          td = document.createElement("td");
        td.colSpan = 5;
        td.textContent = "No timestamped samples match this batch and window.";
        tr.append(td);
        fragment.append(tr);
      }
      table.replaceChildren(fragment);
      chart();
    }
    function update() {
      if (disposed) return;
      trackAlarms();
      const t = ctx.tags(),
        quality =
          t.quality?.["PLC.Quality"] ?? (state.sensorStale ? "Stale" : "Good");
      tiles(out("tags"), [
        ["Batch", t.batch],
        ["Production order", state.orderId],
        ["Raw lot", state.ledger?.lot || "Unassigned"],
        ["Stage", t.stage],
        [
          quality === "Good"
            ? "Measured lot mass"
            : "Last lot mass · stale feed",
          format.format(t.mass) + " kg",
          quality !== "Good",
        ],
        ["Stage progress", format.format(t.progress) + " %"],
        ["Run indication", t.running ? "Running" : "Stopped"],
        ["PLC tag quality", quality, quality !== "Good"],
      ]);
      const allowed = ctx.canStart(),
        canStart = typeof allowed === "boolean" ? allowed : allowed === "";
      for (const key of ["start", "step"])
        act(key).disabled = readonly || t.running || !canStart;
      act("hold").disabled = readonly || !t.running;
      act("release").disabled = readonly || !ctx.canTransfer();
      act("trip").disabled = act("stale").disabled = readonly;
      act("trip").textContent = state.guard
        ? "Open process permissive"
        : "Restore process permissive";
      act("stale").textContent = state.sensorStale
        ? "Restore PLC tag feed"
        : "Simulate stale PLC tags";
      alarmRows();
      const samples = state.samples || [];
      if (
        !plot ||
        (!frozen &&
          (samples.length !== lastCount || samples.at(-1) !== lastSample))
      ) {
        lastCount = samples.length;
        lastSample = samples.at(-1);
        query();
      }
    }
    function onAction(event) {
      const b = event.target.closest("[data-bav-action]");
      if (!b || b.disabled) return;
      const id = b.dataset.bavAction;
      if (id === "query") {
        query();
        return;
      }
      if (readonly) return;
      if (id === "ack") {
        for (const [key, flag] of Object.entries(store.flags)) {
          if (!flag.pending) continue;
          flag.pending = false;
          flag.acknowledged = true;
          addEvent(key, alarms[key] + " · operator acknowledged");
        }
        saveAlarms();
        out("notice").textContent = "Acknowledgement recorded for this batch.";
        update();
      } else if (
        ["start", "hold", "step", "release", "trip", "stale"].includes(id)
      ) {
        ctx[id]();
        update();
      }
    }
    el.addEventListener("click", onAction);
    dock?.addEventListener("click", onAction);
    el.addEventListener("change", (event) => {
      if (!event.target.dataset.bavField) return;
      frozen = !field("follow").checked;
      store.query = {
        pen: field("pen").value,
        stage: field("stage").value,
        window: field("window").value,
        quality: field("quality").value,
        follow: !frozen,
      };
      saveAlarms();
      if (!frozen || event.target !== field("follow")) query();
    });
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(chart) : null;
    observer?.observe(out("chart"));
    update();
    return {
      update,
      destroy() {
        disposed = true;
        observer?.disconnect();
        dock?.remove();
        el.remove();
      },
    };
  }
  window.BatchAveva = Object.freeze({ mount });
})();
