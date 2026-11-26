/* Signal Works: offline controller and supervisory-panel trainers. */
(function () {
  "use strict";

  const SAMPLE =
    "(* The three simulated inputs are sampled together. *)\nPERMIT := GUARD AND AUTO;\nRUN := PERMIT AND PART;";
  const inputNames = ["GUARD", "PART", "AUTO"];
  const reserved = new Set([
    ...inputNames,
    "TRUE",
    "FALSE",
    "NOT",
    "AND",
    "OR",
    "XOR",
  ]);
  const vectors = Array.from({ length: 8 }, (_, i) => ({
    guard: Boolean(i & 4),
    part: Boolean(i & 2),
    auto: Boolean(i & 1),
  }));
  const esc = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  const bit = (value) => (value ? "1" : "0");
  function compile(source) {
    if (!source.trim())
      throw Error("Enter an assignment to RUN, then compile.");
    if (source.length > 4000)
      throw Error("This training editor accepts up to 4,000 characters.");
    const regex = /\s+|\(\*[\s\S]*?\*\)|:=|[();]|[a-z_][a-z_0-9]*|[^]/giy;
    const tokens = [];
    for (const match of source.matchAll(regex)) {
      if (/^\s|^\(\*/.test(match[0])) continue;
      tokens.push({
        word: match[0].toUpperCase(),
        line: source.slice(0, match.index).split("\n").length,
      });
    }
    if (tokens.length > 400)
      throw Error("Split the exercise into a program of 400 tokens or fewer.");
    let pos = 0;
    const known = new Set(inputNames),
      statements = [];
    const peek = () => tokens[pos]?.word;
    function fail(message) {
      throw Error(
        "Line " +
          (tokens[pos]?.line || tokens.at(-1)?.line || 1) +
          ": " +
          message,
      );
    }
    function take(word) {
      if (peek() !== word) fail("Expected " + word + ".");
      pos++;
    }
    const levels = [["OR"], ["XOR"], ["AND"]];
    function atom() {
      const name = peek();
      if (name === "NOT") {
        pos++;
        return { op: "NOT", x: atom() };
      }
      if (name === "(") {
        pos++;
        const x = expression(0);
        take(")");
        return x;
      }
      if (name === "TRUE" || name === "FALSE") {
        pos++;
        return { constant: name === "TRUE" };
      }
      if (!known.has(name))
        fail(
          "Expected an input, a previously assigned name, NOT or a bracketed expression; found " +
            (name || "end of program") +
            ".",
        );
      pos++;
      return { name };
    }
    function expression(level) {
      if (level === levels.length) return atom();
      let lhs = expression(level + 1);
      while (levels[level].includes(peek())) {
        const op = peek();
        pos++;
        lhs = { op, x: lhs, y: expression(level + 1) };
      }
      return lhs;
    }
    while (pos < tokens.length) {
      const name = peek();
      if (!/^[A-Z_][A-Z_0-9]*$/.test(name) || reserved.has(name))
        fail(
          "Use a new name or RUN on the left of :=. Inputs and operators cannot be assigned.",
        );
      if (known.has(name)) fail("Assign each name only once per scan.");
      pos++;
      take(":=");
      const value = expression(0);
      take(";");
      statements.push({ name, value });
      known.add(name);
    }
    if (!known.has("RUN"))
      throw Error("Assign the Boolean output RUN before compiling.");
    return statements;
  }
  function scan(program, inputs) {
    const values = Object.create(null);
    for (const id of inputNames) values[id] = inputs[id.toLowerCase()] === true;
    function val(node) {
      if ("constant" in node) return node.constant;
      if ("name" in node) return values[node.name];
      const x = val(node.x);
      switch (node.op) {
        case "NOT":
          return !x;
        case "AND":
          return x && val(node.y);
        case "OR":
          return x || val(node.y);
        case "XOR":
          return x !== val(node.y);
      }
    }
    for (const assignment of program)
      values[assignment.name] = val(assignment.value);
    return values;
  }
  function truthRows(program) {
    return vectors.map((inputs) => {
      const expected = inputs.guard && inputs.part && inputs.auto;
      const actual = scan(program, inputs).RUN;
      return { ...inputs, expected, actual, pass: actual === expected };
    });
  }
  function evaluatePLC(state, inputs) {
    const plc = state?.plc;
    if (!plc?.proven || !plc.source || plc.compiled !== plc.source)
      return {
        run: false,
        reason:
          "PLC held: compile the current source and prove its eight input combinations.",
      };
    try {
      const code = compile(plc.source);
      if (!truthRows(code).every((r) => r.pass))
        return {
          run: false,
          reason: "PLC held: the program fails its permissive proof.",
        };
      const run = scan(code, inputs || {}).RUN;
      return {
        run,
        reason: run
          ? "RUN is true: guard, part and automatic mode are present."
          : "RUN is false: " +
            inputNames
              .filter((k) => inputs?.[k.toLowerCase()] !== true)
              .join(", ") +
            " not asserted.",
      };
    } catch (error) {
      return { run: false, reason: "PLC held: " + error.message };
    }
  }
  function plcState(state) {
    state.plc ||= {};
    const p = state.plc;
    if (typeof p.source !== "string") p.source = "";
    p.inputs ||= { guard: false, part: false, auto: false };
    return p;
  }
  function css() {
    if (document.getElementById("sw-control-style")) return;
    const s = document.createElement("style");
    s.id = "sw-control-style";
    s.textContent = `
    .swc{--s-line:#748b7e;--s-bg:#ffffff;--s-ink:#19332f;--s-muted:#496156;--s-accent:#006858;color-scheme:light;display:grid;gap:14px;color:var(--s-ink);min-width:0}
    .swc *{box-sizing:border-box}.swc h3,.swc h4,.swc p{margin:0}.swc p,.swc details{line-height:1.5}.swc .swc-note{color:var(--s-muted);font-size:.92rem}
    .swc .swc-card,.swc .swc-tile{padding:15px;border:1px solid var(--s-line);border-radius:9px;background:var(--s-bg);min-width:0}
    .swc .swc-card{display:grid;gap:12px}.swc .swc-controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .swc button,.swc input:not([type=checkbox]),.swc select,.swc textarea{font:inherit;color:var(--s-ink);border:1px solid var(--s-line);background:#f8fbf7;border-radius:5px;padding:8px 11px;max-width:100%}
    .swc button,.swc summary{cursor:pointer}.swc button:hover,.swc button:focus-visible{border-color:var(--s-accent)}.swc button.swc-primary,.swc button[aria-pressed=true]{background:#d9efe4;color:#104d3e;border-color:#43806c}
    .swc textarea{display:block;width:100%;min-height:132px;font:14px/1.6 Consolas,monospace;resize:vertical;tab-size:2}
    .swc .swc-msg{color:#165441;padding:7px 0;overflow-wrap:anywhere}.swc .swc-msg:not(:empty){padding:8px 12px;background:#e7f2ed;border-left:3px solid var(--s-accent)}.swc label{font-size:14px}.swc input[type=checkbox]{accent-color:var(--s-accent)}
    .swc .swc-grid{display:grid;gap:9px;grid-template-columns:repeat(2,minmax(0,1fr))}.swc .swc-grid label{display:grid;gap:4px}
    .swc table{width:100%;border-collapse:collapse;font:13px/1.4 Consolas,monospace}.swc th,.swc td{text-align:left;padding:5px 2px;border-bottom:1px solid var(--s-line);overflow-wrap:anywhere}
    .swc .swc-status{color:var(--s-accent);font:600 12px Consolas,monospace}.swc .swc-board{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .swc .swc-tile{overflow-wrap:anywhere}.swc .swc-tile strong,.swc .swc-tile small{display:block}.swc .swc-value{display:block;font:700 22px/1.7 Consolas,monospace;color:var(--s-accent)}.swc .swc-empty{border-style:dashed;background:#f0f5ef;color:var(--s-muted)}
    .swc .swc-tag{font:11px/1.5 Consolas,monospace;color:var(--s-muted)}.swc .swc-on,.swc .swc-off{display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--s-accent);margin-right:5px}.swc .swc-off{background:#63736a}.swc .swc-alarm{color:#884308}
    .swc .swc-at{display:flex;gap:12px;justify-content:space-between;align-items:center;min-width:0}.swc .swc-at small{color:var(--s-muted)}.swc details pre{font:13px/1.5 Consolas,monospace;white-space:pre-wrap}
    .swc-operator .swc-tile{padding:8px 10px}.swc-operator .swc-value{font-size:18px;line-height:1.45}.swc-operator .swc-empty{font-size:12px}
    .swc .swc-value details,.swc .swc-value small,.swc .swc-value .swc-note{font:13px/1.5 Consolas,monospace}.swc .swc-value ol{padding-left:2.5em}
    @media(max-width:460px){.swc .swc-card{padding:11px}.swc .swc-grid{grid-template-columns:1fr}.swc .swc-tile{padding:10px}.swc table{font-size:11px}}
    `;
    document.head.append(s);
  }
  function watch(values) {
    return (
      "<table><caption>Last scan watch table</caption><thead><tr><th>Variable</th><th>Kind</th><th>Value</th></tr></thead><tbody>" +
      Object.entries(values)
        .map(
          ([key, value]) =>
            "<tr><td>" +
            esc(key) +
            "</td><td>" +
            (inputNames.includes(key)
              ? "Input"
              : key === "RUN"
                ? "Output"
                : "Local") +
            "</td><td>" +
            bit(value) +
            "</td></tr>",
        )
        .join("") +
      "</tbody></table>"
    );
  }
  function proof(rows) {
    return (
      "<table><caption>Acceptance vectors: 1 = asserted</caption><thead><tr>" +
      ["Guard", "Part", "Auto", "Want", "RUN", "Result"]
        .map((k) => "<th>" + k + "</th>")
        .join("") +
      "</tr></thead><tbody>" +
      rows
        .map(
          (r) =>
            "<tr>" +
            [r.guard, r.part, r.auto, r.expected, r.actual]
              .map((v) => "<td>" + bit(v) + "</td>")
              .join("") +
            "<td>" +
            (r.pass ? "Pass" : "Fail") +
            "</td></tr>",
        )
        .join("") +
      "</tbody></table>"
    );
  }
  function renderPLC(root, ctx) {
    css();
    const p = plcState(ctx.state);
    root.innerHTML =
      '<section class="swc" aria-label="PLC programming workstation"><div class="swc-card"><h3>Program the run permissive</h3><p>RUN must be true only when GUARD, PART and AUTO are all true. Write a Boolean program, compile it, then prove it against all eight input combinations.</p><p class="swc-note">This is a simulated process permissive, not safety-rated logic. It cannot control equipment.</p><details><summary>Language reference and editable example</summary><p>Use case-insensitive names, := for assignment and ; to finish a statement. Inputs are read-only. Define locals before use and assign each name once. Highest to lowest precedence: NOT, AND, XOR, OR; parentheses override precedence. TRUE and FALSE are Boolean literals. Comments use (* and *). No timers, physical addresses or retained memory.</p><pre>' +
      esc(SAMPLE) +
      '</pre></details><label>Program source<textarea data-code maxlength="4000" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></label><div class="swc-controls"><button data-a="example">Load example</button><button data-a="compile">Compile</button><button class="swc-primary" data-a="prove">Prove all 8 scans</button></div><div class="swc-status" data-status></div><div class="swc-msg" data-message role="status"></div></div><div class="swc-card"><h4>Manual scan and watch</h4><p class="swc-note">Set the input image, then run a single scan. Manual scans are available even if the acceptance proof fails.</p><div class="swc-controls">' +
      inputNames
        .map(
          (k) =>
            '<label><input type="checkbox" data-input="' +
            k.toLowerCase() +
            '"> ' +
            k +
            "</label>",
        )
        .join("") +
      '<button data-a="scan">Scan once</button></div><div data-watch></div></div><div data-proof></div></section>';
    const base = root.querySelector(".swc"),
      q = (k) => base.querySelector(k),
      source = q("[data-code]"),
      msg = (m) => {
        q("[data-message]").textContent = m;
      };
    source.value = p.source;
    base.querySelectorAll("[data-input]").forEach((el) => {
      el.checked = Boolean(p.inputs[el.dataset.input]);
    });
    function status() {
      q("[data-status]").textContent = p.proven
        ? "PROVEN · ready for order execution"
        : p.compiled === p.source && p.source
          ? "COMPILED · proof required"
          : "DRAFT · compile required";
    }
    function edit() {
      p.source = source.value;
      p.compiled = null;
      p.proven = false;
      delete p.watch;
      delete p.rows;
      q("[data-watch]").innerHTML = "";
      q("[data-proof]").innerHTML = "";
      ctx.save();
      status();
      msg("Source changed; earlier compilation and proof no longer apply.");
    }
    status();
    if (p.watch) q("[data-watch]").innerHTML = watch(p.watch);
    if (Array.isArray(p.rows)) q("[data-proof]").innerHTML = proof(p.rows);
    source.addEventListener("input", edit);
    base.addEventListener("change", (e) => {
      if (e.target.dataset.input) {
        p.inputs[e.target.dataset.input] = e.target.checked;
        ctx.save();
      }
    });
    base.addEventListener("click", (e) => {
      const action = e.target.closest("[data-a]")?.dataset.a;
      if (!action) return;
      if (action === "example") {
        source.value = SAMPLE;
        edit();
        source.focus();
        return;
      }
      try {
        if (action !== "compile" && p.compiled !== p.source)
          throw Error("Compile the current source first.");
        const program = compile(p.source);
        if (action === "compile") {
          p.compiled = p.source;
          p.proven = false;
          delete p.rows;
          q("[data-proof]").innerHTML = "";
          msg(
            "Compiled " +
              program.length +
              " assignment(s). A successful compile does not establish correct behaviour.",
          );
        } else if (action === "scan") {
          p.watch = scan(program, p.inputs);
          q("[data-watch]").innerHTML = watch(p.watch);
          msg("Scan complete. RUN = " + bit(p.watch.RUN) + ".");
        } else {
          p.rows = truthRows(program);
          p.proven = p.rows.every((r) => r.pass);
          q("[data-proof]").innerHTML = proof(p.rows);
          msg(
            p.proven
              ? "8/8 passed. This program can now run the order."
              : p.rows.filter((r) => r.pass).length +
                  "/8 passed. Compare the failed input rows with the required RUN output.",
          );
          ctx.log(
            p.proven
              ? "PLC permissive proved across eight scans."
              : "PLC proof failed; order execution remains held.",
          );
        }
        ctx.save();
        status();
      } catch (error) {
        msg(error.message);
      }
    });
  }
  const tags = {
    "cell.atCamera": {
      label: "Inspection photoeye",
      kind: "bool",
      read: (s) => s.carton?.stage === "inspect",
    },
    "cell.conveyor": {
      label: "Infeed conveyor moving",
      kind: "bool",
      read: (s) => s.lastRun === true && s.carton?.stage === "feed",
    },
    "erp.finished": {
      label: "ERP stock for this SKU",
      kind: "number",
      read: (s) =>
        [...(s.archive || []), s.order]
          .filter((o) => o && o.sku === s.order.sku)
          .reduce(
            (total, o) =>
              total +
              o.events.filter((e) => e.accepted && o.posted.includes(e.id))
                .length,
            0,
          ),
    },
    "order.events.accepted": {
      label: "Accepted total by cycle",
      kind: "series",
      read: (s) => {
        let good = 0;
        return (Array.isArray(s.order?.events) ? s.order.events : []).map(
          (e) => (good += Number(e?.accepted === true)),
        );
      },
    },
    lastRun: {
      label: "Last PLC RUN",
      kind: "bool",
      read: (s) => s.lastRun === true,
    },
    "servers.ready": {
      label: "Server services ready",
      kind: "bool",
      read: (s) => s.servers?.ready === true,
    },
    "order.good": {
      label: "Accepted count",
      kind: "number",
      read: (s) => Number(s.order?.good) || 0,
    },
    "order.rejects": {
      label: "Rejected count",
      kind: "number",
      read: (s) => Number(s.order?.rejects) || 0,
    },
    "order.target": {
      label: "Order target",
      kind: "number",
      read: (s) => Number(s.order?.target) || 0,
    },
  };
  const types = {
    lamp: "Status lamp",
    count: "Counter",
    alarm: "Alarm when false",
    trend: "Historian trend",
  };
  function validWidget(w) {
    return (
      w &&
      Object.hasOwn(tags, w.tag) &&
      Object.hasOwn(types, w.type) &&
      Number.isInteger(w.position) &&
      w.position >= 1 &&
      w.position <= 6 &&
      typeof w.title === "string" &&
      Boolean(w.title.trim()) &&
      tags[w.tag].kind ===
        (w.type === "trend" ? "series" : w.type === "count" ? "number" : "bool")
    );
  }
  function panelValid(widgets) {
    return (
      Array.isArray(widgets) &&
      widgets.every(validWidget) &&
      new Set(widgets.map((w) => w.position)).size === widgets.length &&
      widgets.some((w) => w.type === "lamp" && w.tag === "lastRun") &&
      widgets.some((w) => w.type === "count" && w.tag === "order.good")
    );
  }
  function scadaReady(state) {
    return state?.scada?.verified === true && panelValid(state.scada.widgets);
  }
  const opts = (items, current) =>
    Object.entries(items)
      .map(
        ([id, label]) =>
          '<option value="' +
          esc(id) +
          '"' +
          (String(current) === id ? " selected" : "") +
          ">" +
          esc(label) +
          "</option>",
      )
      .join("");
  function trend(series) {
    if (!series.length)
      return '<span class="swc-note">No completed cycles yet.</span>';
    const width = 160,
      height = 48,
      last = series.length - 1,
      top = Math.max(1, series[last]);
    const points = [0, ...series]
      .map(
        (v, i) =>
          (3 + ((width - 6) * i) / series.length).toFixed(2) +
          "," +
          (height - 3 - ((height - 6) * v) / top).toFixed(2),
      )
      .join(" ");
    return (
      '<svg width="160" height="48" viewBox="0 0 160 48" aria-hidden="true" style="max-width:100%;display:block"><path d="M3 2V45H157" fill="none" stroke="#748b7e"/><polyline points="' +
      points +
      '" fill="none" stroke="#006858" stroke-width="2.5"/></svg><small>Cycle ' +
      series.length +
      ": " +
      series[last] +
      " accepted</small><details><summary>Cycle values</summary><ol>" +
      series.map((v) => "<li>" + v + " accepted</li>").join("") +
      "</ol></details>"
    );
  }
  function widgetTiles(state, editable, widgets = state?.scada?.widgets || []) {
    return [1, 2, 3, 4, 5, 6]
      .map((n) => {
        const o = widgets.find((v) => v?.position === n);
        if (!validWidget(o))
          return (
            '<div class="swc-tile swc-empty">Position ' + n + " · unused</div>"
          );
        const value = tags[o.tag].read(state);
        const display =
          o.type === "trend"
            ? trend(value)
            : o.type === "count"
              ? esc(value)
              : o.type === "alarm"
                ? value
                  ? "Normal"
                  : "Fault active"
                : '<i aria-hidden="true" class="' +
                  (value ? "swc-on" : "swc-off") +
                  '"></i>' +
                  (value ? "ON" : "OFF");
        return (
          '<div class="swc-tile"><strong>' +
          esc(o.title) +
          '</strong><div class="swc-value ' +
          (o.type === "alarm" && !value ? "swc-alarm" : "") +
          '">' +
          display +
          '</div><small class="swc-tag">' +
          esc(o.tag) +
          "</small>" +
          (editable
            ? '<button data-edit="' +
              n +
              '" aria-label="Edit ' +
              esc(o.title) +
              '">Edit</button>'
            : "") +
          "</div>"
        );
      })
      .join("");
  }
  function renderOperator(container, state) {
    css();
    container.innerHTML =
      '<section class="swc swc-operator" aria-label="Live operator panel"><div class="swc-board">' +
      widgetTiles(state, false) +
      "</div></section>";
  }
  function renderSCADA(root, ctx) {
    css();
    const s = (ctx.state.scada ||= {});
    if (!Array.isArray(s.widgets)) s.widgets = [];
    if (!s.screenName) s.screenName = "Main operator";
    if (!Array.isArray(s.screens))
      s.screens = [{ id: "diagnostics", name: "Diagnostics", widgets: [] }];
    let mode = "design",
      editing = null;
    function paint() {
      const extra = s.screens.find((o) => o.id === s.selectedScreen);
      const main = !extra,
        screen = extra || s;
      const choices = {
        main: s.screenName,
        ...Object.fromEntries(s.screens.map((o) => [o.id, o.name])),
      };
      const screenId = extra?.id || "main";
      const w = screen.widgets.find((o) => o.position === editing),
        def = w || {
          title: "",
          type: "lamp",
          tag: "lastRun",
          position:
            [1, 2, 3, 4, 5, 6].find(
              (n) => !screen.widgets.some((o) => o.position === n),
            ) || 1,
        };
      root.innerHTML =
        '<section class="swc" aria-label="SCADA panel builder"><div class="swc-card"><h3>Build the operator panel</h3><p>Place a status lamp linked to lastRun and a counter linked to order.good. Open operator runtime to validate the bindings and see values from this work order. The line always uses the main operator screen; use Diagnostics or create a separate screen for trends and alarms.</p><label>Active screen<select data-screen>' +
        opts(choices, screenId) +
        "</select></label>" +
        (mode === "design"
          ? '<div class="swc-controls"><label>Screen name<input data-screen-name maxlength="48" autocomplete="off"></label><button data-a="new-screen">Create screen</button><button data-a="rename-screen">Rename selected</button></div>'
          : "") +
        '<div class="swc-controls"><button data-mode="design" aria-pressed="' +
        (mode === "design") +
        '">Designer</button><button data-mode="runtime" aria-pressed="' +
        (mode === "runtime") +
        '">Operator runtime</button></div><div class="swc-status">' +
        (main
          ? scadaReady(ctx.state)
            ? "VERIFIED · required tags mapped"
            : "NOT VERIFIED · bind and test required tags"
          : extra.verified
            ? "VERIFIED · diagnostic bindings"
            : "DIAGNOSTICS · verify screen bindings") +
        "</div></div>" +
        (mode === "design"
          ? '<div class="swc-card"><h4>' +
            (w ? "Edit widget in position " + w.position : "Add a widget") +
            '</h4><form><div class="swc-grid"><label>Widget title<input name="title" maxlength="48" required></label><label>Widget type<select name="type">' +
            opts(types, def.type) +
            '</select></label><label>Source tag<select name="tag">' +
            opts(
              Object.fromEntries(
                Object.entries(tags).map(([k, t]) => [k, k + " · " + t.label]),
              ),
              def.tag,
            ) +
            '</select></label><label>Screen position<select name="position">' +
            opts(
              Object.fromEntries(
                [1, 2, 3, 4, 5, 6].map((n) => [
                  n,
                  "Row " + Math.ceil(n / 2) + ", " + (n % 2 ? "left" : "right"),
                ]),
              ),
              def.position,
            ) +
            '</select></label></div><div class="swc-controls"><button class="swc-primary" type="submit">' +
            (w ? "Update widget" : "Place widget") +
            "</button>" +
            (w
              ? '<button type="button" data-a="cancel">Cancel edit</button><button type="button" data-a="remove">Remove widget</button>'
              : "") +
            "</div></form></div>"
          : "") +
        '<div class="swc-card"><h4>' +
        (mode === "runtime" ? "Operator runtime" : "Layout preview") +
        '</h4><div class="swc-board"></div>' +
        (mode === "runtime"
          ? '<div class="swc-controls"><button data-a="validate" class="swc-primary">Validate runtime bindings</button><button data-a="sample">Sample live tags</button></div><p class="swc-note">Values reflect the last simulated order action, not an independent controller connection.</p>'
          : "") +
        '</div><div class="swc-msg" role="status"></div></section>';
      const base = root.querySelector(".swc"),
        form = base.querySelector("form"),
        board = base.querySelector(".swc-board"),
        message = (text) => {
          base.querySelector(".swc-msg").textContent = text;
        };
      function tiles() {
        board.innerHTML = widgetTiles(
          ctx.state,
          mode === "design",
          screen.widgets,
        );
      }
      tiles();
      base.querySelector("[data-screen]").addEventListener("change", (e) => {
        s.selectedScreen = e.target.value;
        editing = null;
        ctx.save();
        paint();
        root.querySelector("[data-screen]").focus();
      });
      if (form) {
        form.elements.title.value = def.title;
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const fd = new FormData(form),
            widget = {
              title: String(fd.get("title")).trim().slice(0, 48),
              type: fd.get("type"),
              tag: fd.get("tag"),
              position: Number(fd.get("position")),
            };
          if (!validWidget(widget)) {
            message(
              "Give the widget a title and a compatible tag: lamps and alarms use Boolean tags, counters use numeric tags, and the historian trend uses order.events.accepted.",
            );
            return;
          }
          if (
            screen.widgets.some(
              (o) => o.position === widget.position && o.position !== editing,
            )
          ) {
            message(
              "Position occupied. Choose a free position or edit the existing tile.",
            );
            return;
          }
          screen.widgets = screen.widgets.filter((o) => o.position !== editing);
          screen.widgets.push(widget);
          screen.verified = false;
          editing = null;
          ctx.save();
          paint();
          root.querySelector("[name=title]").focus();
          root.querySelector(".swc-msg").textContent =
            "Widget saved. Revalidate in operator runtime.";
        });
      }
      base.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.mode) {
          mode = b.dataset.mode;
          editing = null;
          paint();
          root.querySelector('[data-mode="' + mode + '"]').focus();
          return;
        }
        if (b.dataset.edit) {
          editing = Number(b.dataset.edit);
          paint();
          root.querySelector("[name=title]").focus();
          return;
        }
        const a = b.dataset.a;
        if (a === "new-screen" || a === "rename-screen") {
          const title = base
            .querySelector("[data-screen-name]")
            .value.trim()
            .slice(0, 48);
          if (!title) {
            message("Enter a name for the screen first.");
            return;
          }
          if (
            Object.entries(choices).some(
              ([id, name]) =>
                (a === "new-screen" || id !== screenId) &&
                name.toLowerCase() === title.toLowerCase(),
            )
          ) {
            message("A screen already uses that name. Choose a distinct name.");
            return;
          }
          if (a === "new-screen") {
            let i = 1;
            while (s.screens.some((o) => o.id === "screen-" + i)) i++;
            s.selectedScreen = "screen-" + i;
            s.screens.push({ id: s.selectedScreen, name: title, widgets: [] });
          } else if (main) s.screenName = title;
          else extra.name = title;
          editing = null;
          ctx.save();
          paint();
          root.querySelector("[data-screen]").focus();
          root.querySelector(".swc-msg").textContent =
            a === "new-screen"
              ? "Screen created. Add widgets to the new layout."
              : "Screen renamed.";
          return;
        }
        if (a === "cancel") {
          editing = null;
          paint();
          root.querySelector("[name=title]").focus();
          return;
        }
        if (a === "remove") {
          screen.widgets = screen.widgets.filter((o) => o.position !== editing);
          screen.verified = false;
          editing = null;
          ctx.save();
          paint();
          root.querySelector("[name=title]").focus();
          return;
        }
        if (a === "sample") {
          tiles();
          message("Operator values sampled from the current work order.");
          return;
        }
        if (a === "validate") {
          if (!main) {
            extra.verified =
              extra.widgets.length > 0 && extra.widgets.every(validWidget);
            ctx.save();
            paint();
            root.querySelector("[data-a=validate]").focus();
            root.querySelector(".swc-msg").textContent = extra.verified
              ? "Diagnostic screen bindings verified."
              : "Add a widget before validating this screen.";
            return;
          }
          s.verified = panelValid(s.widgets);
          ctx.save();
          ctx.log(
            s.verified
              ? "SCADA runtime bindings verified."
              : "SCADA runtime missing required mappings.",
          );
          paint();
          root.querySelector("[data-a=validate]").focus();
          root.querySelector(".swc-msg").textContent = s.verified
            ? "Runtime verified: RUN status and accepted quantity are correctly bound."
            : "Validation failed. Add a status lamp bound to lastRun and a counter bound to order.good, then retest.";
        }
      });
    }
    paint();
  }
  window.SWControls = {
    renderPLC,
    renderSCADA,
    renderOperator,
    evaluatePLC,
    scadaReady,
  };
})();
