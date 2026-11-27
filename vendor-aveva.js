(() => {
  "use strict";

  const drive = "FRY.CV101.Current";
  const running = "FRY.CV101.Running";
  const speed = "FRY.CV101.Speed";
  const tags = {
    [drive]: { unit: "A", label: "Drive current", key: "amps" },
    [running]: { unit: "BOOL", label: "Run feedback", key: "run" },
    [speed]: { unit: "%", label: "Speed feedback", key: "speed" },
  };
  const alarmReference =
    "https://docs.aveva.com/bundle/intouch-hmi-2023/page/319322.html";
  const clientReference =
    "https://docs.aveva.com/bundle/sp-omi-awc-2026/page/244593.html";
  const retrievalReference =
    "https://docs.aveva.com/bundle/sp-omi-awc-2023/page/244944.html";
  const reference = (url, title) =>
    '<a target="_blank" rel="noopener" href="' + url + '">' + title + " ↗</a>";
  const inputs = [
    [0, 8.2, true, 60, true],
    [1, 8.6, true, 61, true],
    [2, 12.4, true, 66, true],
    [3, 15.4, true, 70, true],
    [4, 21.9, true, 69, false],
    [6, 16.2, true, 70, true],
    [7, 11.3, true, 62, true],
    [8, 9.0, true, 61, true],
    [9, 8.4, true, 60, true],
    [10, 0.2, false, 0, true],
  ].map(([minute, amps, run, speed, good]) => ({
    minute,
    amps,
    run,
    speed,
    good,
  }));
  const stamp = (minute) => "08:" + String(minute).padStart(2, "0");
  const options = (keys) =>
    '<option value="">Choose a tag</option>' +
    keys
      .map(
        (k) =>
          '<option value="' + k + '">' + k + " (" + tags[k].unit + ")</option>",
      )
      .join("");
  const rawValue = (point, tag) => point[tags[tag].key];
  const good = (point, tag) => tag !== drive || point.good;
  const fmt = (v, tag) =>
    tag === running
      ? v
        ? "Running"
        : "Stopped"
      : String(v) + " " + tags[tag].unit;
  const clean = () => ({
    binding: null,
    i: 0,
    alarm: false,
    ack: false,
    pending: false,
    events: [],
    captured: [],
  });
  function styles() {
    if (document.getElementById("sw-aveva-style")) return;
    const el = document.createElement("style");
    el.id = "sw-aveva-style";
    el.textContent = `
      .av-lesson{display:grid;gap:13px;color:#183a30;color-scheme:light;min-width:0;font:inherit}.av-lesson *{box-sizing:border-box}
      .av-lesson h2,.av-lesson h3,.av-lesson p,.av-lesson dl{margin:0}.av-lesson h2{font-size:clamp(1.6rem,3vw,2.5rem);line-height:1.12;letter-spacing:-.04em}
      .av-lesson nav,.av-actions{display:flex;align-items:center;flex-wrap:wrap;gap:7px}.av-lesson button,.av-lesson input,.av-lesson select{font:inherit;color:#193e32;border:1px solid #849e8d;background:white;border-radius:5px;padding:7px 10px;min-height:38px;max-width:100%}
      .av-lesson button{cursor:pointer;font-weight:650}.av-lesson button[aria-pressed=true],.av-lesson .av-primary{background:#205f46;color:white;border-color:#205f46}.av-lesson button:disabled{opacity:.5;cursor:default}
      .av-content,.av-pane>*,.av-lesson label,.av-lesson select{min-width:0}.av-pane{grid-template-columns:minmax(0,1fr);background:#fff;border:1px solid #b6cabb;border-radius:10px;display:grid;gap:10px;align-content:start;padding:clamp(13px,2vw,22px);min-width:0}
      .av-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}.av-fields,.av-metrics{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(min(155px,100%),1fr))}.av-lesson label{display:grid;gap:4px;font-size:.88rem;color:#405e4c}
      .av-metrics>div{background:#edf5ec;border:1px solid #c8d9c8;border-radius:5px;padding:8px}.av-metrics dt{font-size:.78rem;color:#3e5c4a}.av-metrics dd{font-weight:700;margin:1px 0;overflow-wrap:anywhere}
      .av-bad{background:#fff0dc!important;color:#72390c!important}.av-lesson .av-msg:not(:empty){background:#edf3df;border-left:3px solid #648e57;border-radius:2px;padding:8px 10px}
      .av-lesson summary,.av-lesson a{color:#205d44}.av-lesson summary{cursor:pointer;font-weight:650}.av-lesson details p{margin:.4rem 0}.av-lesson .av-log{padding-left:1.3rem;margin:0;max-height:165px;overflow:auto}
      .av-lesson table{border-collapse:collapse;width:100%;text-align:left;font-size:.88rem}.av-lesson th,.av-lesson td{padding:5px;border-bottom:1px solid #d3e1d4}.av-lesson caption{text-align:left;font-weight:650;margin:4px 0}
      .av-lesson canvas{width:100%;height:205px;display:block;background:#f5f8f1;border-radius:6px}.av-chart{min-width:0}
      .av-lesson .av-sources{font-size:.85rem}.av-lesson :focus-visible{outline:3px solid #a95a20;outline-offset:2px}
      @media(max-width:760px){.av-grid{grid-template-columns:1fr}.av-pane{padding:13px}.av-lesson canvas{height:185px}}
    `;
    document.head.append(el);
  }
  function mount(root, initialTab = "intouch") {
    styles();
    const section = document.createElement("section");
    section.className = "av-lesson";
    root.replaceChildren(section);
    section.innerHTML =
      '<nav aria-label="AVEVA practice workstations"><button data-av-tab="intouch">InTouch HMI</button><button data-av-tab="historian">Historian Client</button></nav><div class="av-content"></div>';
    const body = section.querySelector(".av-content");
    const q = (sel) => section.querySelector(sel);
    const field = (k) => q('[data-av-field="' + k + '"]');
    const out = (k) => q('[data-av-output="' + k + '"]');
    const htmlField = (k, label, control) =>
      "<label>" +
      label +
      control.replace("FIELD", 'data-av-field="' + k + '"') +
      "</label>";
    const action = (id, label, primary = false) =>
      '<button type="button" data-av-action="' +
      id +
      '"' +
      (primary ? ' class="av-primary"' : "") +
      ">" +
      label +
      "</button>";
    const msg = '<p class="av-msg" data-av-output="message" role="status"></p>';
    let h = clean(),
      tab = "intouch",
      observer = null;
    let draft = { analog: "", run: "", threshold: 14 };
    let history = {
      source: "archive",
      tag: drive,
      start: "08:00",
      end: "08:10",
      quality: "all",
      answer: "",
    };
    let result = null;
    function metric(parent, name, value, bad = false) {
      const wrap = document.createElement("div"),
        dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = name;
      dd.textContent = value;
      wrap.append(dt, dd);
      if (bad) wrap.className = "av-bad";
      parent.append(wrap);
    }
    function sample() {
      const p = inputs[h.i];
      if (!h.captured.some((point) => point.minute === p.minute))
        h.captured.push(p);
      if (!p.good) {
        h.events.push(
          stamp(p.minute) + " · Current quality bad. Alarm evaluation held.",
        );
        return;
      }
      const active = p.amps >= h.binding.threshold;
      if (active && !h.alarm) {
        h.alarm = true;
        h.ack = false;
        h.pending = true;
        h.events.push(
          stamp(p.minute) + " · High current active at " + p.amps + " A.",
        );
      } else if (!active && h.alarm) {
        h.alarm = false;
        h.events.push(
          stamp(p.minute) +
            " · Current returned below the limit at " +
            p.amps +
            " A.",
        );
      }
    }
    function panel() {
      const tiles = out("metrics");
      tiles.replaceChildren();
      const p = inputs[h.i],
        enabled = Boolean(h.binding);
      metric(
        tiles,
        "Time (UTC)",
        enabled ? stamp(p.minute) : "Waiting for binding",
      );
      metric(tiles, "Conveyor", enabled ? fmt(p.run, running) : "Unbound");
      metric(
        tiles,
        "Motor current",
        !enabled ? "Unbound" : p.good ? fmt(p.amps, drive) : "Bad quality",
        enabled && !p.good,
      );
      let alarm = "Normal";
      if (h.alarm)
        alarm = h.ack ? "Active · acknowledged" : "Active · unacknowledged";
      else if (h.pending) alarm = "Returned · awaiting acknowledgement";
      else if (h.ack) alarm = "Returned · acknowledged";
      metric(
        tiles,
        "High current alarm",
        enabled ? alarm : "Unbound",
        enabled && (h.alarm || h.pending),
      );
      const list = out("events");
      list.replaceChildren();
      for (const event of h.events.slice().reverse()) {
        const li = document.createElement("li");
        li.textContent = event;
        list.append(li);
      }
      q('[data-av-action="ack"]').disabled = !enabled || !h.pending;
      q('[data-av-action="advance"]').disabled =
        !enabled || h.i === inputs.length - 1;
    }
    function intouch() {
      body.innerHTML =
        '<div class="av-pane"><h2>Commission a conveyor display</h2><p>Bind the CV101 drive current and run feedback. Put the simulated operator screen into service, step through a load excursion and acknowledge the alarm. Each step also captures a sample for the Historian Client exercise.</p></div><div class="av-grid"><section class="av-pane"><h3>Window configuration</h3><div class="av-fields">' +
        htmlField(
          "analog",
          "Current indication",
          "<select FIELD>" + options(Object.keys(tags)) + "</select>",
        ) +
        htmlField(
          "run",
          "Run lamp",
          "<select FIELD>" + options(Object.keys(tags)) + "</select>",
        ) +
        htmlField(
          "threshold",
          "High current limit (A)",
          '<input FIELD type="number" min="1" max="20" step="0.1">',
        ) +
        '</div><div class="av-actions">' +
        action("deploy", "Apply bindings and start", true) +
        action("hmi-example", "Load worked bindings") +
        "</div><details><summary>Commissioning brief</summary><p>Bind the numeric indication to FRY.CV101.Current in amperes and the lamp to FRY.CV101.Running. The exercise alarm is active at or above the chosen current limit. Acknowledgement records operator awareness. The measured current determines when the high condition clears.</p><p>Use 14 A for the worked route. At 08:03 acknowledge the active alarm. Step past the bad-quality sample and observe the return at 08:07. Repeat with acknowledgement after the return to compare the event order.</p></details>" +
        msg +
        '</section><section class="av-pane"><h3>Operator screen</h3><dl class="av-metrics" data-av-output="metrics"></dl><div class="av-actions">' +
        action("advance", "Advance sample", true) +
        action("ack", "Acknowledge alarm") +
        '</div><h3>Alarm and quality events</h3><ol class="av-log" data-av-output="events"></ol></section></div><p class="av-sources">Signal Works exercise with simulated tags. ' +
        reference(alarmReference, "AVEVA InTouch alarm states") +
        "</p>";
      for (const key of Object.keys(draft)) field(key).value = draft[key];
      panel();
    }
    function minute(time) {
      if (!/^\d{2}:\d{2}$/.test(time)) return NaN;
      return Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) - 480;
    }
    function chart() {
      const canvas = out("chart");
      if (!canvas || !result) return;
      const width = canvas.clientWidth,
        height = canvas.clientHeight;
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const c = canvas.getContext("2d");
      if (!c) return;
      c.scale(dpr, dpr);
      const left = 45,
        right = width - 12,
        top = 20,
        bottom = height - 27;
      const r = result,
        scale = r.tag === drive ? 25 : 100,
        span = Math.max(1, r.end - r.start);
      const x = (t) => left + ((right - left) * (t - r.start)) / span;
      const y = (v) => bottom - ((bottom - top) * v) / scale;
      c.font = "11px Consolas,monospace";
      c.fillStyle = "#3b5847";
      c.strokeStyle = "#c4d2c2";
      for (const n of [0, scale / 2, scale]) {
        c.beginPath();
        c.moveTo(left, y(n));
        c.lineTo(right, y(n));
        c.stroke();
        c.fillText(String(n), 3, y(n) + 3);
      }
      c.fillText(tags[r.tag].unit, 4, 12);
      c.fillText(stamp(r.start), left, bottom + 16);
      c.textAlign = "right";
      c.fillText(stamp(r.end), right, bottom + 16);
      c.textAlign = "left";
      let previous = null;
      for (const p of r.points) {
        const valid = good(p, r.tag),
          px = x(p.minute),
          py = y(rawValue(p, r.tag));
        if (valid) {
          c.strokeStyle = "#126c51";
          c.lineWidth = 2.5;
          if (previous && p.minute === previous.minute + 1) {
            c.beginPath();
            c.moveTo(x(previous.minute), y(rawValue(previous, r.tag)));
            c.lineTo(px, py);
            c.stroke();
          }
          c.fillStyle = c.strokeStyle;
          c.beginPath();
          c.arc(px, py, 3.5, 0, Math.PI * 2);
          c.fill();
          previous = p;
        } else {
          previous = null;
          if (r.quality === "all") {
            c.strokeStyle = "#a5441c";
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(px - 4, py - 4);
            c.lineTo(px + 4, py + 4);
            c.moveTo(px - 4, py + 4);
            c.lineTo(px + 4, py - 4);
            c.stroke();
          }
        }
      }
    }
    function renderResult() {
      const panel = out("result");
      if (!result) {
        panel.textContent =
          "Run a query to display the trend and its recorded values.";
        return;
      }
      const r = result,
        valid = r.points.filter((p) => good(p, r.tag)),
        visible = r.quality === "all" ? r.points : valid;
      panel.innerHTML =
        '<dl class="av-metrics"></dl><div class="av-chart"><canvas data-av-output="chart" role="img" aria-label="Historical trend. Recorded values and quality flags are available in the following table."></canvas></div><p>Green circles are valid observations. Orange crosses mark bad-quality readings when shown. Gaps break the trace.</p><table><caption>Query results, UTC</caption><thead><tr><th>Time</th><th>Value</th><th>Quality</th></tr></thead><tbody></tbody></table>';
      const metrics = panel.querySelector("dl"),
        values = valid.map((p) => rawValue(p, r.tag));
      metric(
        metrics,
        "Valid samples",
        valid.length + " / " + (r.end - r.start + 1) + " expected",
      );
      metric(metrics, "Missing minutes", r.end - r.start + 1 - r.points.length);
      metric(metrics, "Bad quality", r.points.length - valid.length);
      metric(
        metrics,
        "Peak valid value",
        values.length ? fmt(Math.max(...values), r.tag) : "No valid value",
      );
      for (const p of visible) {
        const tr = document.createElement("tr");
        for (const value of [
          stamp(p.minute),
          fmt(rawValue(p, r.tag), r.tag),
          good(p, r.tag) ? "Good" : "Bad",
        ]) {
          const td = document.createElement("td");
          td.textContent = value;
          tr.append(td);
        }
        panel.querySelector("tbody").append(tr);
      }
      if (!visible.length) {
        const tr = document.createElement("tr"),
          td = document.createElement("td");
        td.colSpan = 3;
        td.textContent = "No returned rows match this selection.";
        tr.append(td);
        panel.querySelector("tbody").append(tr);
      }
      observer?.disconnect();
      if (typeof ResizeObserver === "function") {
        observer = new ResizeObserver(chart);
        observer.observe(panel.querySelector("canvas"));
      }
      chart();
    }
    function historian() {
      body.innerHTML =
        '<div class="av-pane"><h2>Investigate the conveyor excursion</h2><p>Query stored samples over an inclusive UTC time window. The archived shift expects one observation per minute from 08:00 to 08:10. Compare the highest valid drive current with the reported 21.9 A reading.</p></div><div class="av-grid"><section class="av-pane"><h3>Trend query</h3><div class="av-fields">' +
        htmlField(
          "source",
          "Data source",
          '<select FIELD><option value="archive">Archived shift</option><option value="live">This HMI exercise run</option></select>',
        ) +
        htmlField(
          "tag",
          "Trend pen",
          "<select FIELD>" + options([drive, speed]) + "</select>",
        ) +
        htmlField("start", "Start time (UTC)", '<input type="time" FIELD>') +
        htmlField("end", "End time (UTC)", '<input type="time" FIELD>') +
        htmlField(
          "quality",
          "Display quality",
          '<select FIELD><option value="all">All recorded samples</option><option value="good">Good samples only</option></select>',
        ) +
        '</div><div class="av-actions">' +
        action("query", "Run query", true) +
        action("hist-example", "Load worked query") +
        "</div><details><summary>Worked investigation</summary><p>Select the archived drive current from 08:03 through 08:07 and include all qualities. Of five expected minutes, three have good values, one has bad quality and one is absent. The highest good reading is 16.2 A. Filtering the display leaves the coverage gap in the evidence.</p></details>" +
        msg +
        "<h3>Record your finding</h3>" +
        htmlField(
          "answer",
          "Which conclusion do the query results support?",
          '<select FIELD><option value="">Choose a finding</option><option value="gap">The returned series has missing or bad-quality observations.</option><option value="complete">Every expected observation in this window is good.</option><option value="empty">There are no recorded observations for this pen and window.</option></select>',
        ) +
        action("judge", "Check finding") +
        '</section><section class="av-pane"><h3>Historian Client trend</h3><div data-av-output="result" class="av-pane"></div></section></div><p class="av-sources">Browser exercise using a local sample archive. ' +
        reference(clientReference, "AVEVA Historian Client Trend") +
        " · " +
        reference(retrievalReference, "Full retrieval") +
        "</p>";
      for (const key of Object.keys(history)) field(key).value = history[key];
      renderResult();
    }
    function display(which) {
      observer?.disconnect();
      observer = null;
      tab = which === "historian" ? "historian" : "intouch";
      for (const b of section.querySelectorAll("[data-av-tab]"))
        b.setAttribute("aria-pressed", String(b.dataset.avTab === tab));
      if (tab === "intouch") intouch();
      else historian();
    }
    function query() {
      const start = minute(history.start),
        end = minute(history.end);
      if (
        !tags[history.tag] ||
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end > 10 ||
        start > end
      ) {
        result = null;
        renderResult();
        out("message").textContent =
          "Choose a pen and an ordered time window within 08:00 to 08:10 UTC.";
        return;
      }
      const rows = history.source === "archive" ? inputs : h.captured;
      if (
        history.source !== "archive" &&
        (!rows.length || end > rows.at(-1).minute)
      ) {
        result = null;
        renderResult();
        out("message").textContent = rows.length
          ? "Current-run history ends at " +
            stamp(rows.at(-1).minute) +
            " UTC. Shorten the requested window or acquire more samples."
          : "Acquire a sample on the InTouch HMI before querying the current run.";
        return;
      }
      result = {
        tag: history.tag,
        start,
        end,
        quality: history.quality,
        points: rows.filter((p) => p.minute >= start && p.minute <= end),
      };
      renderResult();
      out("message").textContent =
        "Query complete for " +
        history.tag +
        ", " +
        history.start +
        " to " +
        history.end +
        " UTC.";
    }
    section.addEventListener("input", (e) => {
      const k = e.target.dataset.avField;
      if (!k) return;
      if (tab === "intouch") draft[k] = e.target.value;
      else {
        history[k] = e.target.value;
        if (k !== "answer") {
          result = null;
          observer?.disconnect();
          renderResult();
          out("message").textContent =
            "Query settings changed. Run the query again.";
        }
      }
    });
    section.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      if (b.dataset.avTab) {
        display(b.dataset.avTab);
        return;
      }
      const message = out("message");
      switch (b.dataset.avAction) {
        case "hmi-example":
          draft = { analog: drive, run: running, threshold: 14 };
          intouch();
          out("message").textContent =
            "Worked configuration loaded. Apply it to start a new run.";
          break;
        case "deploy": {
          const limit = Number(draft.threshold);
          if (draft.analog !== drive || draft.run !== running) {
            message.textContent =
              "Check the source and engineering unit. The numeric display needs CV101.Current in amperes and the run lamp needs CV101.Running.";
            break;
          }
          if (
            draft.threshold === "" ||
            !Number.isFinite(limit) ||
            limit < 1 ||
            limit > 20
          ) {
            message.textContent =
              "Set a high-current limit between 1 and 20 A for this exercise.";
            break;
          }
          h = clean();
          h.binding = { threshold: limit };
          h.events.push(
            "08:00 · Bindings applied and operator display online.",
          );
          sample();
          panel();
          message.textContent =
            "Operator screen online. Advance samples to observe load and alarm state.";
          result = null;
          break;
        }
        case "advance":
          if (!h.binding || h.i >= inputs.length - 1) break;
          h.i++;
          sample();
          panel();
          message.textContent =
            "Sample acquired at " + stamp(inputs[h.i].minute) + " UTC.";
          break;
        case "ack":
          if (!h.pending) break;
          h.pending = false;
          h.ack = true;
          h.events.push(
            stamp(inputs[h.i].minute) +
              " · Operator acknowledged high current.",
          );
          panel();
          message.textContent = h.alarm
            ? "Acknowledged. The measured high condition remains active."
            : "Acknowledged after return. The measured condition is normal.";
          break;
        case "hist-example":
          history = {
            source: "archive",
            tag: drive,
            start: "08:03",
            end: "08:07",
            quality: "all",
            answer: "",
          };
          result = null;
          historian();
          out("message").textContent =
            "Worked window selected. Run the query to retrieve samples.";
          break;
        case "query":
          query();
          break;
        case "judge": {
          if (!result) {
            message.textContent = "Run a query first.";
            break;
          }
          const expected = !result.points.length
            ? "empty"
            : result.points.length < result.end - result.start + 1 ||
                result.points.some((p) => !good(p, result.tag))
              ? "gap"
              : "complete";
          message.textContent =
            history.answer === expected
              ? "Correct. The finding matches the recorded timestamps and quality flags."
              : "Review the valid sample count, missing minutes and quality flags for this window.";
          break;
        }
      }
    });
    display(initialTab);
    return {
      destroy() {
        observer?.disconnect();
        section.remove();
      },
    };
  }
  window.AvevaLessons = Object.freeze({ mount });
})();
