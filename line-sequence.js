/* Offline, manufacturer-independent sequence exercise for the packing line. */
(function () {
  "use strict";
  const REFERENCE = [
    "FEED: CONVEY WHEN AT_CAMERA -> INSPECT",
    "INSPECT: INSPECT WHEN INSPECTED -> ACCEPTED ? TRANSFER : REJECT",
    "TRANSFER: PICKPLACE WHEN PLACED -> COMPLETE",
    "REJECT: DIVERT WHEN REJECTED -> COMPLETE",
    "COMPLETE: BOOK END",
  ].join("\n");
  const stages = ["feed", "inspect", "transfer", "reject", "complete"];
  const actions = ["convey", "inspect", "pickplace", "divert", "book"];
  const sensors = {
    AT_CAMERA: "atCamera",
    INSPECTED: "inspected",
    ACCEPTED: "accepted",
    PLACED: "placed",
    REJECTED: "rejected",
  };
  const cleanInputs = () =>
    Object.fromEntries(Object.values(sensors).map((k) => [k, false]));
  const esc = (v) =>
    String(v).replace(
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
  const compiled = new Map();
  function parse(source) {
    if (typeof source !== "string" || !source.trim())
      throw Error("Write a program or load the reference first.");
    if (source.length > 4000)
      throw Error("The exercise accepts at most 4,000 characters.");
    if (compiled.has(source)) return compiled.get(source);
    const program = Object.create(null);
    for (const [i, raw] of source.split(/\r?\n/).entries()) {
      const line = raw.split("#")[0].trim().toUpperCase();
      if (!line) continue;
      const fail = (reason) => {
        throw Error("Line " + (i + 1) + ": " + reason);
      };
      const m =
        /^([A-Z_]+)\s*:\s*([A-Z_]+)\s+(END|WHEN\s+([A-Z_]+)\s*->\s*([A-Z_]+)(?:\s*\?\s*([A-Z_]+)\s*:\s*([A-Z_]+))?)$/.exec(
          line,
        );
      if (!m)
        fail(
          "Expected STAGE: ACTION WHEN SIGNAL -> NEXT, a conditional destination or STAGE: ACTION END.",
        );
      const id = m[1].toLowerCase(),
        action = m[2].toLowerCase();
      if (!stages.includes(id)) fail("Unknown stage " + m[1] + ".");
      if (!actions.includes(action))
        fail("Unknown output action " + m[2] + ".");
      if (program[id]) fail("Stage " + m[1] + " is already defined.");
      const r = { action, end: m[3] === "END" };
      if (!r.end) {
        if (!Object.hasOwn(sensors, m[4]))
          fail("Unknown guard signal " + m[4] + ".");
        r.guard = sensors[m[4]];
        if (m[6]) {
          if (!Object.hasOwn(sensors, m[5]))
            fail("Unknown branch signal " + m[5] + ".");
          r.branch = sensors[m[5]];
          r.yes = m[6].toLowerCase();
          r.no = m[7].toLowerCase();
        } else r.yes = m[5].toLowerCase();
        if (!stages.includes(r.yes) || (r.no && !stages.includes(r.no)))
          fail("Every destination must be a declared line stage.");
      }
      program[id] = r;
    }
    for (const stage of stages)
      if (!program[stage])
        throw Error(
          "Missing stage " +
            stage.toUpperCase() +
            ". Define every stage exactly once.",
        );
    if (compiled.size >= 16) compiled.clear();
    compiled.set(source, program);
    return program;
  }
  function scan(program, stage, inputs) {
    const row = program[stage];
    if (!row) throw Error("Unknown sequence stage: " + String(stage));
    if (row.end || inputs?.[row.guard] !== true)
      return { action: row.action, next: stage };
    return {
      action: row.action,
      next: row.branch && inputs?.[row.branch] !== true ? row.no : row.yes,
    };
  }
  function wanted(stage, input) {
    switch (stage) {
      case "feed":
        return input.atCamera ? "inspect" : "feed";
      case "inspect":
        return !input.inspected
          ? "inspect"
          : input.accepted
            ? "transfer"
            : "reject";
      case "transfer":
        return input.placed ? "complete" : "transfer";
      case "reject":
        return input.rejected ? "complete" : "reject";
      default:
        return "complete";
    }
  }
  function traceBranch(program, accept) {
    const timeline = [
      {},
      { atCamera: true },
      {},
      { inspected: true, accepted: accept },
      {},
      accept ? { placed: true } : { rejected: true },
      {},
    ];
    const rows = [];
    let stage = "feed";
    for (const fields of timeline) {
      const inputs = { ...cleanInputs(), ...fields };
      const out = scan(program, stage, inputs);
      rows.push({
        stage,
        ...out,
        signals:
          Object.keys(inputs)
            .filter((k) => inputs[k])
            .join(", ") || "None",
      });
      stage = out.next;
    }
    return rows;
  }
  const proofs = new Map();
  function prove(source) {
    if (proofs.has(source)) return proofs.get(source);
    const program = parse(source),
      problems = [];
    let good = 0;
    for (const [i, stage] of stages.entries()) {
      for (let mask = 0; mask < 32; mask++) {
        const input = Object.fromEntries(
          Object.values(sensors).map((key, bit) => [
            key,
            Boolean(mask & (1 << bit)),
          ]),
        );
        const out = scan(program, stage, input),
          expected = wanted(stage, input);
        if (out.action === actions[i] && out.next === expected) {
          good++;
          continue;
        }
        if (problems.length < 4)
          problems.push(
            stage.toUpperCase() +
              " with " +
              (Object.keys(input)
                .filter((k) => input[k])
                .join(", ") || "no sensors asserted") +
              ": expected " +
              actions[i] +
              " → " +
              expected +
              ", got " +
              out.action +
              " → " +
              out.next +
              ".",
          );
      }
    }
    if (!program.complete.end)
      problems.push(
        "COMPLETE must use END to declare the terminal booking stage.",
      );
    const result = {
      pass: good === 160 && problems.length === 0,
      good,
      problems,
      accepted: traceBranch(program, true),
      rejected: traceBranch(program, false),
    };
    if (proofs.size >= 16) proofs.clear();
    proofs.set(source, result);
    return result;
  }
  function ready(state) {
    const s = state?.sequence;
    if (!s?.proven || !s.source || s.source !== s.compiled) return false;
    try {
      return prove(s.source).pass;
    } catch {
      return false;
    }
  }
  function step(state, stage, inputs) {
    if (!ready(state))
      throw Error(
        "Line sequence is not commissioned. Compile and prove both production routes.",
      );
    if (!stages.includes(stage))
      throw Error("Unknown sequence stage: " + String(stage));
    return scan(parse(state.sequence.source), stage, inputs);
  }
  function traceTable(rows) {
    return (
      "<table><thead><tr><th>Stage</th><th>Asserted</th><th>Action</th><th>Next</th></tr></thead><tbody>" +
      rows
        .map(
          (r) =>
            "<tr>" +
            [r.stage, r.signals, r.action, r.next]
              .map((v) => "<td>" + esc(v) + "</td>")
              .join("") +
            "</tr>",
        )
        .join("") +
      "</tbody></table>"
    );
  }
  function styles() {
    if (document.getElementById("sw-sequence-style")) return;
    const el = document.createElement("style");
    el.id = "sw-sequence-style";
    el.textContent =
      ".sws{display:grid;gap:16px;color:#19332f;color-scheme:light}.sws .sws-box{background:white;border:1px solid #a2b6aa;border-radius:10px;padding:clamp(12px,2vw,22px);display:grid;gap:10px;min-width:0}.sws h3,.sws h4,.sws p{margin:0}.sws p,.sws summary{line-height:1.5}.sws .sws-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.sws label{display:grid;gap:4px}.sws textarea{width:100%;box-sizing:border-box;min-height:180px;resize:vertical;font:14px/1.6 Consolas,monospace;white-space:pre-wrap;background:#f7fbf7;color:#19332f}.sws pre{overflow-wrap:anywhere;white-space:pre-wrap;background:#eff5ef;padding:10px}.sws button,.sws input,.sws select,.sws textarea{border:1px solid #748b7e;border-radius:5px;padding:7px;color:#19332f;background:#f7fbf7}.sws .sws-action{background:#d9efe4;border-color:#43806c;color:#104d3e}.sws .sws-note{color:#496156;font-size:.92rem}.sws .sws-out:not(:empty){border-left:3px solid #006858;padding:8px 12px;background:#e7f2ed}.sws summary,.sws button{cursor:pointer}.sws table{width:100%;border-collapse:collapse;font:13px/1.4 Consolas,monospace}.sws th,.sws td{border-bottom:1px solid #cedbd1;text-align:left;padding:5px 2px;overflow-wrap:anywhere}.sws .sws-row label{display:inline-flex;align-items:center}.sws details+details{margin-top:8px}.sws [data-seq-proof]{min-width:0}";
    document.head.append(el);
  }
  function mount(root, state, save) {
    styles();
    const s = (state.sequence ||= {});
    if (typeof s.source !== "string") s.source = "";
    let stage = "feed",
      history = [];
    root.innerHTML =
      '<section class="sws" aria-label="Line sequence workbench"><div class="sws-box"><h3>Program the line sequence</h3><p>The run permissive enables the cell. This separate step program decides what the cell does next: convey, inspect, transfer or divert, then book one result.</p><p class="sws-note">A manufacturer-independent process simulation. No field equipment or safety functions are connected.</p><details><summary>Sequence language, signals and reference program</summary><p>Declare each stage once, one rule per line. Names are case-insensitive; # starts a comment. The action belongs to the current stage. WHEN waits for a sampled Boolean input; otherwise the stage holds. A ? TRUE_DEST : FALSE_DEST branch selects its destination only when the guard is true. END is terminal. The line books once on entry to COMPLETE.</p><p>Inputs: AT_CAMERA means a carton arrived at inspection; INSPECTED means a result is available; ACCEPTED is that result. PLACED confirms deposit at the pallet. REJECTED confirms diversion to the reject lane.</p><pre>' +
      esc(REFERENCE) +
      '</pre></details><label>Transition program<textarea data-seq-code maxlength="4000" spellcheck="false" autocapitalize="off"></textarea></label><div class="sws-row"><button type="button" data-seq="example">Load reference for editing</button><button type="button" data-seq="compile">Compile transitions</button><button type="button" data-seq="prove" class="sws-action">Prove both routes</button></div><details><summary>Use the reference without writing it from scratch</summary><p>Commissioning the reference replaces the text in this editor, compiles it and runs the same proof as a learner-written program.</p><button type="button" data-seq="reference">Commission reference sequence</button></details><strong data-seq-status></strong><div data-seq-msg class="sws-out" role="status"></div></div><div class="sws-box"><h4>Single-step test station</h4><p class="sws-note">Set the simulated sensors and advance one scan. Inputs remain set until changed; restart clears them. No material or stock is booked in this test station.</p><div class="sws-row">' +
      Object.entries(sensors)
        .map(
          ([label, id]) =>
            '<label><input type="checkbox" data-seq-input="' +
            id +
            '">' +
            label +
            "</label>",
        )
        .join("") +
      '</div><div class="sws-row"><button type="button" data-seq="tick">Advance one scan</button><button type="button" data-seq="restart">Restart at FEED</button><span data-seq-stage></span></div><div data-seq-watch></div></div><div data-seq-proof></div></section>';
    const q = (css) => root.querySelector(css),
      editor = q("[data-seq-code]"),
      msg = (m) => {
        q("[data-seq-msg]").textContent = m;
      };
    editor.value = s.source;
    function status() {
      q("[data-seq-status]").textContent = ready(state)
        ? "Commissioned · accepted and rejected routes proved"
        : s.source && s.compiled === s.source
          ? "Compiled · route proof required"
          : "Draft · not commissioned";
      q("[data-seq-stage]").textContent = "Test stage: " + stage.toUpperCase();
    }
    function clearBench() {
      stage = "feed";
      history = [];
      q("[data-seq-watch]").innerHTML = "";
      root.querySelectorAll("[data-seq-input]").forEach((i) => {
        i.checked = false;
      });
    }
    function showProof(p) {
      q("[data-seq-proof]").innerHTML =
        '<div class="sws-box"><h4>Route proof: ' +
        p.good +
        '/160 input combinations matched</h4><p class="sws-note">Five stages × all 32 combinations of the five sensors. Both traces below execute the current program, including a waiting scan at each moving stage.</p>' +
        (p.problems.length
          ? "<ul>" +
            p.problems.map((text) => "<li>" + esc(text) + "</li>").join("") +
            "</ul>"
          : "") +
        "<details><summary>Accepted carton trace</summary>" +
        traceTable(p.accepted) +
        "</details><details><summary>Rejected carton trace</summary>" +
        traceTable(p.rejected) +
        "</details></div>";
    }
    function edit() {
      s.source = editor.value;
      s.compiled = null;
      s.proven = false;
      s.tested = false;
      clearBench();
      q("[data-seq-proof]").innerHTML = "";
      save();
      status();
      msg("Program changed. Compile and prove it before running the line.");
    }
    editor.addEventListener("input", edit);
    if (s.tested && s.compiled === s.source) {
      try {
        showProof(prove(s.source));
      } catch {
        /* A stale saved draft can still be edited. */
      }
    }
    status();
    q(".sws").addEventListener("click", (e) => {
      const kind = e.target.closest("[data-seq]")?.dataset.seq;
      if (!kind) return;
      if (kind === "example") {
        editor.value = REFERENCE;
        edit();
        editor.focus();
        return;
      }
      if (kind === "restart") {
        clearBench();
        status();
        msg("Test station restarted. The order has not changed.");
        return;
      }
      try {
        if (kind === "reference") {
          editor.value = REFERENCE;
          edit();
        }
        if (kind === "compile" || kind === "reference") {
          const program = parse(s.source);
          s.compiled = s.source;
          s.proven = false;
          s.tested = false;
          q("[data-seq-proof]").innerHTML = "";
          clearBench();
          save();
          status();
          msg(
            "Compiled " +
              Object.keys(program).length +
              " stages. Route proof is still required.",
          );
          if (kind === "compile") return;
        }
        if (!s.source || s.compiled !== s.source)
          throw Error("Compile the current transition program first.");
        if (kind === "prove" || kind === "reference") {
          const proof = prove(s.source);
          s.proven = proof.pass;
          s.tested = true;
          showProof(proof);
          save();
          status();
          msg(
            proof.pass
              ? "Both routes passed. This sequence is commissioned."
              : "Route proof failed. Review the first mismatches and revise the transition program.",
          );
          return;
        }
        if (kind === "tick") {
          const inputs = Object.fromEntries(
            [...root.querySelectorAll("[data-seq-input]")].map((i) => [
              i.dataset.seqInput,
              i.checked,
            ]),
          );
          const out = scan(parse(s.source), stage, inputs);
          history.push({
            stage,
            ...out,
            signals:
              Object.keys(inputs)
                .filter((k) => inputs[k])
                .join(", ") || "None",
          });
          history = history.slice(-20);
          stage = out.next;
          q("[data-seq-watch]").innerHTML = traceTable(history);
          status();
          msg(
            "Scan " +
              history.at(-1).stage +
              " → " +
              out.next +
              "; action: " +
              out.action +
              ". Showing the latest 20 scans.",
          );
        }
      } catch (error) {
        msg(error.message);
      }
    });
  }
  function reference() {
    const result = prove(REFERENCE);
    return {
      source: REFERENCE,
      compiled: REFERENCE,
      proven: result.pass,
      tested: true,
    };
  }
  window.SWSequence = { mount, ready, step, reference };
})();
