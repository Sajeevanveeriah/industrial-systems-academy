(function () {
  "use strict";
  const stages = [
    "receive",
    "wash",
    "peel",
    "cut",
    "blanch",
    "dry",
    "fry",
    "freeze",
    "pack",
    "dispatch",
  ];
  const toleranceKg = 0.02;
  const sample = {
    product: "Frozen straight-cut fries",
    destination: "Cold store DC-02",
    plannedKg: 700,
    lot: "POT-2601",
    receiptKg: 1000,
  };
  const units = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });
  const kg = (n) => units.format(n) + " kg";
  const ok = (why) => ({ ok: true, why });
  const bad = (why) => ({ ok: false, why });
  const close = (a, b) =>
    Math.abs(a - b) <=
    toleranceKg + Number.EPSILON * Math.max(Math.abs(a), Math.abs(b), 1);
  const finite = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;
  const esc = (value) =>
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
  function empty() {
    return {
      status: "Draft",
      product: "",
      destination: "",
      plannedKg: 0,
      lot: "",
      receiptKg: 0,
      online: true,
      stages: [],
      moves: [],
    };
  }
  function solved() {
    return { ...empty(), ...sample, status: "Released" };
  }
  function movement(state, id, code, material, qty, direction) {
    const l = state.ledger;
    const key = state.batchId + "/" + id;
    if (!l.moves.some((m) => m.id === key))
      l.moves.push({
        id: key,
        batchId: state.batchId,
        orderId: state.orderId,
        code,
        material,
        qty,
        direction,
        posted: l.online && !l.moves.some((row) => !row.posted),
      });
  }
  function ensure(state) {
    const l = (state.ledger ||= empty());
    if (!Array.isArray(l.stages)) l.stages = [];
    if (!Array.isArray(l.moves)) l.moves = [];
    if (l.receiptKg > 0 && l.lot)
      movement(
        state,
        "raw-receipt",
        "101",
        "Raw potatoes",
        l.receiptKg,
        "receipt",
      );
    return l;
  }
  function receiveLot(state, { lot, kg: qty }) {
    const ledger = ensure(state);
    if (typeof lot !== "string" || !lot.trim() || !finite(qty) || qty <= 0)
      return bad(
        "Enter the supplier lot and a positive measured receipt mass.",
      );
    lot = lot.trim();
    if (ledger.receiptKg > 0)
      return ledger.lot === lot && close(ledger.receiptKg, qty)
        ? ok("Previously recorded receipt acknowledged.")
        : bad("A different receipt is already recorded on this batch.");
    if (ledger.stages.length)
      return bad("This batch is already in production.");
    ledger.lot = lot;
    ledger.receiptKg = qty;
    ensure(state);
    return ok("Raw receipt recorded for " + lot + ".");
  }
  function releaseOrder(state, { product, destination, plannedKg }) {
    const ledger = ensure(state);
    if (!validOrder({ product, destination, plannedKg }))
      return bad("Enter a product, planned finished mass and destination.");
    if (ledger.status === "Released") {
      return ledger.product === product &&
        ledger.destination === destination &&
        ledger.plannedKg === plannedKg
        ? ok("Original order release acknowledged.")
        : bad("The released order already contains different planning data.");
    }
    if (ledger.stages.length || ledger.receiptKg < state.initialKg)
      return bad(
        "A released raw lot must cover the batch charge before scheduling.",
      );
    Object.assign(ledger, {
      product,
      destination,
      plannedKg,
      status: "Released",
    });
    return ok("Order released for the scheduled batch.");
  }
  function setOnline(state, value) {
    ensure(state).online = value === true;
    return {
      ...ok(
        value
          ? "Interface restored. Replay queued postings."
          : "Interface paused. Further movements will queue.",
      ),
      count: 0,
    };
  }
  function replay(state) {
    const ledger = ensure(state);
    if (!ledger.online)
      return { ...bad("Restore the interface before replay."), count: 0 };
    const pending = ledger.moves.filter((row) => !row.posted);
    for (const move of pending) move.posted = true;
    return {
      ...ok(pending.length + " new postings acknowledged."),
      count: pending.length,
    };
  }
  function validOrder(l) {
    return (
      typeof l.product === "string" &&
      !!l.product.trim() &&
      typeof l.destination === "string" &&
      !!l.destination.trim() &&
      finite(l.plannedKg) &&
      l.plannedKg > 0
    );
  }
  function ready(state) {
    const l = ensure(state);
    if (l.status !== "Released")
      return bad("Release the production order in MES and SAP practice.");
    if (!validOrder(l))
      return bad(
        "Enter the finished product, planned yield and receiving destination.",
      );
    if (!finite(state.initialKg) || state.initialKg <= 0)
      return bad("The batch needs a positive raw charge.");
    if (
      !l.lot ||
      !finite(l.receiptKg) ||
      l.receiptKg + toleranceKg < state.initialKg
    )
      return bad(
        "Receive a raw potato lot covering the " +
          kg(state.initialKg) +
          " batch charge.",
      );
    return ok("Order released and raw lot available.");
  }
  function dispatch(state) {
    const l = ensure(state);
    if (!l.stages.some((e) => e.stage === "pack"))
      return bad("Complete packing before dispatching finished stock.");
    return ok(
      l.online
        ? "Packed goods available for dispatch."
        : "Packed goods available. The simulated SAP goods issue will queue offline.",
    );
  }
  function record(state, e) {
    if (
      !e ||
      e.batchId !== state.batchId ||
      !Number.isInteger(e.index) ||
      stages[e.index] !== e.stage ||
      !e.stage ||
      e.id !== state.batchId + "-" + String(e.index + 1).padStart(2, "0")
    )
      return bad(
        "The stage event does not match this batch identity or routing.",
      );
    const l = ensure(state);
    const keys = ["inputKg", "addedKg", "removedKg", "outputKg"];
    const prior = l.stages.find((row) => row.id === e.id);
    if (prior) {
      if (prior.stage !== e.stage || !keys.every((k) => prior[k] === e[k]))
        return bad(
          "This stage identifier already has different quantities. The original weights remain recorded.",
        );
      return ok("Previously recorded stage acknowledged.");
    }
    const setup = ready(state);
    if (!setup.ok) return setup;
    if (l.stages.length !== e.index)
      return bad("Record each operation once in routing order.");
    if (!keys.every((k) => finite(e[k])))
      return bad("Stage weights must be finite and non-negative.");
    if (!close(e.inputKg, l.stages.at(-1)?.outputKg ?? state.initialKg))
      return bad("The input weight does not match the preceding stage output.");
    if (!close(e.inputKg + e.addedKg - e.removedKg, e.outputKg))
      return bad(
        "The measured input, addition, removal and output do not balance.",
      );
    if (e.stage === "dispatch") {
      const permitted = dispatch(state);
      if (!permitted.ok) return permitted;
      if (e.addedKg !== 0 || e.removedKg !== 0 || !close(e.outputKg, e.inputKg))
        return bad(
          "Dispatch the packed quantity without a process gain or loss.",
        );
    }
    const entry = {
      id: e.id,
      batchId: e.batchId,
      orderId: state.orderId,
      index: e.index,
      stage: e.stage,
      inputKg: e.inputKg,
      addedKg: e.addedKg,
      removedKg: e.removedKg,
      outputKg: e.outputKg,
      note: String(e.note || ""),
    };
    l.stages.push(entry);
    if (e.index === 0)
      movement(
        state,
        e.id + "/raw-issue",
        "261",
        "Raw potatoes",
        e.inputKg,
        "issue",
      );
    if (e.addedKg > 0 && e.stage === "fry")
      movement(
        state,
        e.id + "/oil-issue",
        "261",
        "Oil absorbed",
        e.addedKg,
        "issue",
      );
    if (e.stage === "pack")
      movement(
        state,
        e.id + "/finished-receipt",
        "101",
        l.product,
        e.outputKg,
        "receipt",
      );
    if (e.stage === "dispatch")
      movement(
        state,
        e.id + "/delivery-issue",
        "601",
        l.product,
        e.outputKg,
        "dispatch",
      );
    return ok("Recorded " + e.id + " at " + kg(e.outputKg) + ".");
  }
  function summary(state) {
    const l = ensure(state);
    const packed = l.stages.find((s) => s.stage === "pack")?.outputKg || 0;
    const dispatched =
      l.stages.find((s) => s.stage === "dispatch")?.outputKg || 0;
    const posted = l.moves.filter((m) => m.posted);
    const postedQty = (end) =>
      posted
        .filter((m) => m.id.endsWith(end))
        .reduce((sum, m) => sum + m.qty, 0);
    return {
      received: l.receiptKg,
      finished: packed,
      dispatched,
      queued: l.moves.filter((m) => !m.posted).length,
      sapFinished:
        postedQty("/finished-receipt") - postedQty("/delivery-issue"),
      sapDispatched: postedQty("/delivery-issue"),
      rawRemaining: l.receiptKg - (l.stages[0]?.inputKg || 0),
      sapRaw: postedQty("/raw-receipt") - postedQty("/raw-issue"),
      additions: l.stages.reduce((n, e) => n + e.addedKg, 0),
      removals: l.stages.reduce((n, e) => n + e.removedKg, 0),
      currentWeight: l.stages.at(-1)?.outputKg ?? 0,
    };
  }
  const facts = (items) =>
    '<dl class="fl-facts">' +
    items
      .map(
        ([k, v]) => "<div><dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd></div>",
      )
      .join("") +
    "</dl>";
  const table = (caption, headers, rows) =>
    '<div class="fl-table"><table><caption>' +
    esc(caption) +
    "</caption><thead><tr>" +
    headers.map((h) => '<th scope="col">' + esc(h) + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows
      .map(
        (row) =>
          "<tr>" + row.map((v) => "<td>" + esc(v) + "</td>").join("") + "</tr>",
      )
      .join("") +
    "</tbody></table></div>";
  function mount(root, state, onChange = () => {}, options = {}) {
    const shell = document.createElement("section");
    shell.className = "fry-ledger";
    root.replaceChildren(shell);
    let notice = "";
    function render() {
      const l = ensure(state),
        s = summary(state),
        locked = l.status === "Released",
        hasReceipt = l.receiptKg > 0;
      const received = hasReceipt ? kg(l.receiptKg) : "Awaiting receipt";
      const rawUsed = l.stages[0]?.inputKg || 0;
      const recon = rawUsed + s.additions - s.removals - s.currentWeight;
      shell.innerHTML =
        `<section class="fl-panel"><div class="fl-head"><div><p class="fl-kicker">MES / SAP inventory practice</p><h2>Release and reconcile the batch</h2></div><strong>` +
        esc(state.orderId) +
        " · " +
        esc(state.batchId) +
        `</strong></div>
      <p>Release the order, receive the raw lot and follow each measured process gain and loss through to the delivery.</p>
      <details><summary>Worked order and posting example</summary><p>For the 1,000 kg potato batch, plan 700 kg of frozen straight-cut fries for Cold store DC-02. Receive lot POT-2601, then issue the actual potato charge to the order. For example, a stage taking 850 kg and removing 30 kg hands 820 kg to the next operation. Packing creates finished stock at its measured output. Dispatch issues that quantity to the delivery.</p></details>
      <div class="fl-actions"><a href="#momentum">Receive and release the raw lot in Momentum →</a><a href="#aps">Schedule the batch in APS →</a><a href="#sap">Trace SAP documents →</a></div>` +
        (options.example && !locked && !hasReceipt
          ? '<button data-do="sample">Apply worked receipt and schedule</button>'
          : "") +
        facts([
          ["Order status", l.status],
          ["Raw lot receipt", received],
          ["Batch charge", kg(state.initialKg)],
          ["Goods destination", l.destination || "Unassigned"],
        ]) +
        "</section>" +
        '<section class="fl-panel"><h3>MES batch genealogy</h3>' +
        facts([
          ["Raw issued", kg(rawUsed)],
          ["Process additions", kg(s.additions)],
          ["Process removals", kg(s.removals)],
          ["Latest output", kg(s.currentWeight)],
          ["Mass balance residual", kg(recon)],
          ["Physically dispatched", kg(s.dispatched)],
        ]) +
        (l.stages.length
          ? table(
              "Measured stage events",
              [
                "Stage and event",
                "Input kg",
                "Added kg",
                "Removed kg",
                "Output kg",
                "Evidence",
              ],
              l.stages.map((e) => [
                e.stage + " · " + e.id,
                units.format(e.inputKg),
                units.format(e.addedKg),
                units.format(e.removedKg),
                units.format(e.outputKg),
                e.note,
              ]),
            )
          : "<p>Stage records appear here when the plant completes each operation.</p>") +
        '</section><section class="fl-panel"><div class="fl-head"><h3>Simulated SAP inventory</h3><div class="fl-actions"><button data-do="online">' +
        (l.online ? "Take interface offline" : "Restore interface") +
        '</button><button data-do="replay">Replay queued postings</button></div></div><p>Interface ' +
        (l.online ? "online" : "offline") +
        '. Each movement identifier can post once. Restore the interface and replay queued movements in order to reconcile SAP with physical stock. <a href="https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/ee6ff9b281d8448f96b4fe6c89f2bdc8/8b7b5fe73ef54063a2bfcfbe83cebd38.html" target="_blank" rel="noopener">SAP movement type reference ↗</a></p>' +
        facts([
          ["Physical raw balance", kg(s.rawRemaining)],
          ["SAP raw balance", kg(s.sapRaw)],
          ["Packed to date", kg(s.finished)],
          ["SAP finished on hand", kg(s.sapFinished)],
          ["SAP dispatched", kg(s.sapDispatched)],
          ["Queued postings", s.queued],
        ]) +
        (l.moves.length
          ? table(
              "Inventory movements",
              ["Movement ID", "Type", "Material", "Quantity", "Status"],
              l.moves.map((m) => [
                m.id,
                m.code + " · " + m.direction,
                m.material,
                kg(m.qty),
                m.posted ? "Posted" : "Queued",
              ]),
            )
          : "<p>Receive a lot to create the first stock movement.</p>") +
        '</section><p class="fl-notice" role="status"></p>';
      shell.querySelector(".fl-notice").textContent = notice;
    }
    shell.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-do]");
      if (!button || button.disabled) return;
      const l = ensure(state),
        action = button.dataset.do;
      switch (action) {
        case "sample":
          if (l.status !== "Draft" || l.stages.length || l.receiptKg > 0)
            return;
          if (!options.example) return;
          notice = options.example();
          break;
        case "online":
          notice = setOnline(state, !l.online).why;
          break;
        case "replay":
          notice = replay(state).why;
          break;
      }
      onChange();
      render();
      shell
        .querySelector('[data-do="' + action + '"]:not(:disabled)')
        ?.focus({ preventScroll: true });
    });
    render();
    return { refresh: render };
  }
  window.FryLedger = Object.freeze({
    receiveLot,
    releaseOrder,
    setOnline,
    replay,
    empty,
    solved,
    ready,
    record,
    dispatch,
    summary,
    mount,
  });
})();
