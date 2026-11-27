(() => {
  "use strict";
  const views = new WeakMap();
  const unit = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });
  const phases = ["draft", "held", "released", "posted"];
  const names = {
    draft: "Weigh and identify",
    held: "Inspect held lot",
    released: "Put away and post",
    posted: "Receipt recorded",
  };
  const kg = (n) => (Number.isFinite(n) ? unit.format(n) + " kg" : "Unknown");
  const clean = (v) =>
    String(v ?? "")
      .trim()
      .toUpperCase();
  const numeric = (v) =>
    v == null || String(v).trim() === "" ? NaN : Number(v);
  const equal = (a, b) =>
    Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.005;
  const esc = (v) =>
    String(v ?? "").replace(
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
  const ok = (why) => ({ ok: true, why }),
    bad = (why) => ({ ok: false, why });
  function work(state) {
    const suffix = String(state.batchId ?? "").replace(/^FRY-/, "");
    const orderSuffix = String(state.orderId ?? "").replace(/^PO-/, "");
    const charge = state.initialKg,
      tare = 4200;
    const lot =
      Number.isInteger(state.n) && state.n > 0
        ? "POT-" + (2600 + state.n)
        : "POT-" + suffix;
    return {
      purchase: "PUR-" + orderSuffix,
      lot,
      gross: tare + charge,
      tare,
      net: charge,
      source: "WB-" + suffix,
      sample: "QA-" + suffix,
      bin: "RAW-A2",
      receipt: state.batchId + "/raw-receipt",
    };
  }
  const reportRef = (w, m) => w.sample + (m.retested ? "-R1" : "");
  function fresh(state) {
    return {
      batchId: state.batchId,
      orderId: state.orderId,
      source: "learner",
      stage: "draft",
      lot: "",
      kg: 0,
      purchaseRef: null,
      sourceId: null,
      grossKg: null,
      tareKg: null,
      qualityRef: null,
      qualityAt: null,
      location: null,
      receiptId: null,
      receivedAt: null,
      report: "pending",
      draft: {},
    };
  }
  function sameBatch(m, state) {
    return m && m.batchId === state.batchId && m.orderId === state.orderId;
  }
  function hasReceipt(state) {
    return (
      Number.isFinite(state.ledger?.receiptKg) &&
      state.ledger.receiptKg > 0 &&
      !!clean(state.ledger.lot)
    );
  }
  function prior(state) {
    if (!hasReceipt(state)) return null;
    return {
      ...fresh(state),
      source: "prior",
      stage: "posted",
      lot: state.ledger.lot,
      kg: state.ledger.receiptKg,
      receiptId: work(state).receipt,
    };
  }
  function example(state) {
    const m = state.momentum;
    if (sameBatch(m, state) && m.stage === "posted") return m;
    const existing = prior(state);
    if (existing) state.momentum = existing;
    return existing;
  }
  function ready(state) {
    if (!state || !Number.isFinite(state.initialKg) || state.initialKg <= 0)
      return bad(
        "The production batch needs a positive planned potato charge.",
      );
    const m = state.momentum,
      l = state.ledger;
    if (!sameBatch(m, state) || m.stage !== "posted")
      return bad(
        "Complete Momentum receiving for this batch, including quality disposition and put-away.",
      );
    if (
      !l ||
      !hasReceipt(state) ||
      m.lot !== l.lot ||
      !equal(m.kg, l.receiptKg) ||
      m.receiptId !== work(state).receipt
    )
      return bad(
        "Reconcile the receipt evidence with the current raw-lot balance and receipt identifier.",
      );
    if (m.kg + 0.005 < state.initialKg)
      return bad("The recorded receipt is short of the current batch charge.");
    if (m.source === "prior")
      return ok(
        "A prior released raw receipt covers this batch. " +
          m.lot +
          " supplies " +
          kg(m.kg) +
          ".",
      );
    const w = work(state);
    if (
      m.source !== "learner" ||
      m.purchaseRef !== w.purchase ||
      m.sourceId !== w.source ||
      m.lot !== w.lot ||
      !equal(m.grossKg, w.gross) ||
      !equal(m.tareKg, w.tare) ||
      !equal(m.grossKg - m.tareKg, m.kg) ||
      m.qualityRef !== reportRef(w, m) ||
      m.location !== w.bin ||
      !Number.isFinite(Date.parse(m.receivedAt))
    )
      return bad(
        "Check the weighbridge, quality release and storage evidence against this batch.",
      );
    return ok(
      "Lot " +
        m.lot +
        " was quality released and received into " +
        m.location +
        " for " +
        state.orderId +
        ".",
    );
  }
  function allocated(state) {
    return (
      typeof state.batchId === "string" &&
      !!state.batchId.trim() &&
      typeof state.orderId === "string" &&
      !!state.orderId.trim()
    );
  }
  function weigh(state, m) {
    const w = work(state),
      d = m.draft;
    if (!allocated(state))
      return bad(
        "Open a plant batch with an allocated batch ID and production order reference before recording its delivery.",
      );
    if (
      clean(d.purchase) !== w.purchase ||
      clean(d.order) !== clean(state.orderId)
    )
      return bad(
        "Match the raw purchase reference and the consuming production order shown on the delivery docket. They identify different records.",
      );
    if (clean(d.lot) !== w.lot)
      return bad(
        "The supplier label reads " +
          w.lot +
          ". Scan the lot from this delivery.",
      );
    const gross = numeric(d.gross),
      tare = numeric(d.tare),
      net = numeric(d.net);
    if (
      !Number.isFinite(gross) ||
      !Number.isFinite(tare) ||
      tare < 0 ||
      gross <= tare
    )
      return bad(
        "Enter both scale readings. Gross must exceed the tare weight.",
      );
    if (!equal(gross, w.gross) || !equal(tare, w.tare))
      return bad(
        "Re-read " +
          w.source +
          ". Its gross is " +
          kg(w.gross) +
          " and its tare is " +
          kg(w.tare) +
          ".",
      );
    if (!equal(net, gross - tare))
      return bad(
        "Subtract tare from gross. Use the measured net quantity for the held lot.",
      );
    if (!equal(net, state.initialKg))
      return bad(
        "The weighed lot must cover this exercise’s batch charge of " +
          kg(state.initialKg) +
          ".",
      );
    Object.assign(m, {
      stage: "held",
      lot: w.lot,
      kg: net,
      grossKg: gross,
      tareKg: tare,
      purchaseRef: w.purchase,
      sourceId: w.source,
      report: "pending",
    });
    return ok(
      "Weighbridge receipt held. " +
        kg(net) +
        " is waiting for a signed result. It is still unavailable to production.",
    );
  }
  function release(state, m) {
    const w = work(state),
      d = m.draft;
    if (d.disposition === "hold")
      return ok(
        "Hold retained. Production availability is zero until a matching sample is released and put away.",
      );
    if (m.report === "pending")
      return bad(
        "Request the signed inspection result. A pending sample cannot release the lot.",
      );
    if (m.report === "mismatch")
      return bad(
        "The report identifies another supplier lot. Hold this delivery and request its matching result.",
      );
    if (m.report === "failed")
      return bad(
        "The simulated result failed. Keep the held quantity unavailable and request a documented retest in this training case.",
      );
    if (m.report !== "approved" || clean(d.sample) !== reportRef(w, m))
      return bad(
        "Enter the matching signed sample reference " +
          reportRef(w, m) +
          " after checking its lot and decision.",
      );
    if (d.disposition !== "release")
      return bad(
        "Choose release against the matched, approved sample to authorise put-away.",
      );
    Object.assign(m, {
      stage: "released",
      qualityRef: reportRef(w, m),
      qualityAt: new Date().toISOString(),
    });
    return ok(
      "Quality release recorded. Move the lot to the reserved raw-material location before posting the inventory receipt.",
    );
  }
  function post(state, m) {
    const w = work(state),
      d = m.draft;
    if (!allocated(state))
      return bad(
        "The batch and order references must still be allocated before posting its raw receipt.",
      );
    if (d.bin !== w.bin || clean(d.scan) !== m.lot)
      return bad(
        "Scan " +
          m.lot +
          " at the reserved raw potato bin " +
          w.bin +
          ". Dock staging and finished stores cannot complete this put-away.",
      );
    if (
      m.source !== "learner" ||
      m.stage !== "released" ||
      m.qualityRef !== reportRef(w, m) ||
      m.lot !== w.lot ||
      !equal(m.kg, w.net)
    )
      return bad(
        "The current batch needs its own weighed and quality-released lot.",
      );
    if (
      hasReceipt(state) ||
      state.ledger?.moves?.some((row) => row?.id === w.receipt)
    )
      return bad(
        "A shared raw receipt already exists. Inspect its ledger record before proceeding. A second receipt was not submitted.",
      );
    if (typeof window.FryLedger?.receiveLot !== "function")
      return bad(
        "The plant ledger receiving interface is unavailable. Reopen the complete plant workspace.",
      );
    const result = window.FryLedger.receiveLot(state, { lot: m.lot, kg: m.kg });
    if (result?.ok !== true)
      return bad(
        String(result?.why || "The shared ledger did not confirm the receipt."),
      );
    if (state.ledger.lot !== m.lot || !equal(state.ledger.receiptKg, m.kg))
      return bad(
        "The ledger returned a different lot or quantity. Reconcile its receipt before continuing.",
      );
    Object.assign(m, {
      stage: "posted",
      location: w.bin,
      receiptId: w.receipt,
      receivedAt: new Date().toISOString(),
    });
    return ok(
      "Posted " +
        kg(m.kg) +
        " to " +
        w.bin +
        ". Movement " +
        m.receiptId +
        " now supplies the production batch.",
    );
  }
  function displayTime(value) {
    if (!value || !Number.isFinite(Date.parse(value)))
      return "Time unavailable in prior receipt";
    return new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "shortOffset",
    }).format(new Date(value));
  }
  function field(m, id, label, type = "text", options = []) {
    const val = m.draft?.[id] ?? "";
    if (type === "select")
      return (
        "<label>" +
        esc(label) +
        '<select data-bm-field="' +
        id +
        '"><option value="">Choose an entry</option>' +
        options
          .map(
            ([v, t]) =>
              '<option value="' +
              esc(v) +
              '"' +
              (v === val ? " selected" : "") +
              ">" +
              esc(t) +
              "</option>",
          )
          .join("") +
        "</select></label>"
      );
    return (
      "<label>" +
      esc(label) +
      '<input data-bm-field="' +
      id +
      '" autocomplete="off" ' +
      (type === "number"
        ? 'type="number" min="0" step=".01" inputmode="decimal"'
        : 'type="text" maxlength="60" spellcheck="false"') +
      ' value="' +
      esc(val) +
      '"></label>'
    );
  }
  const facts = (rows) =>
    '<dl class="bm-facts">' +
    rows
      .map(
        ([a, b]) => "<div><dt>" + esc(a) + "</dt><dd>" + esc(b) + "</dd></div>",
      )
      .join("") +
    "</dl>";
  const action = (id, text) =>
    '<button type="button" data-bm="' + id + '">' + esc(text) + "</button>";
  const form = (id, fields, submit) =>
    '<form data-bm-form="' +
    id +
    '" novalidate><div class="bm-fields">' +
    fields.join("") +
    '</div><button class="bm-primary" type="submit" data-bm-submit="' +
    id +
    '">' +
    esc(submit) +
    "</button></form>";
  function panel(state, m) {
    const w = work(state);
    if (m.stage === "draft")
      return (
        facts([
          ["Training purchase reference", w.purchase],
          [
            "Allocated production order",
            state.orderId + " · " + (state.ledger?.status || "Draft"),
          ],
          ["Supplier dispatch label", w.lot],
          [
            "Weighbridge " + w.source,
            "Gross " + kg(w.gross) + " / tare " + kg(w.tare),
          ],
          ["Planned batch charge", kg(state.initialKg)],
        ]) +
        form(
          "weigh",
          [
            field(m, "purchase", "Raw purchase reference"),
            field(m, "order", "Consuming production order"),
            field(m, "lot", "Supplier lot"),
            field(m, "gross", "Gross (kg)", "number"),
            field(m, "tare", "Tare (kg)", "number"),
            field(m, "net", "Calculated net (kg)", "number"),
          ],
          "Record weighed lot on hold",
        )
      );
    if (m.stage === "held") {
      const report =
        {
          pending: "No report received",
          mismatch: w.sample + "-X / " + w.lot + "-X / approved",
          failed: reportRef(w, m) + " / " + w.lot + " / failed",
          approved: reportRef(w, m) + " / " + w.lot + " / approved",
        }[m.report] || "No report received";
      return (
        facts([
          ["Held lot", m.lot + " / " + kg(m.kg)],
          ["Signed training result", report],
        ]) +
        '<div class="bm-actions">' +
        action(
          "fetch",
          m.report === "failed"
            ? "Request signed retest"
            : "Request matching signed result",
        ) +
        action("mismatch", "Inject wrong-lot report") +
        action("fail", "Inject failed result") +
        "</div>" +
        form(
          "release",
          [
            field(m, "sample", "Signed sample reference"),
            field(m, "disposition", "Quality disposition", "select", [
              ["hold", "Keep on hold"],
              ["release", "Release matching lot"],
            ]),
          ],
          "Apply quality disposition",
        )
      );
    }
    if (m.stage === "released")
      return (
        facts([
          ["Released supplier lot", m.lot + " / " + kg(m.kg)],
          ["Quality evidence", m.qualityRef],
          ["Storage reservation", w.bin + " / raw potato bin"],
          ["Shared posting key", w.receipt],
        ]) +
        form(
          "post",
          [
            field(m, "scan", "Scan put-away lot"),
            field(m, "bin", "Destination location", "select", [
              ["RAW-A2", "RAW-A2 · raw potato bin"],
              ["DOCK-01", "DOCK-01 · inbound staging"],
              ["FG-02", "FG-02 · frozen goods"],
            ]),
          ],
          "Confirm put-away and post receipt",
        )
      );
    return (
      "<p>" +
      esc(
        m.source === "prior"
          ? "This workspace opened with a previously released raw receipt. The shared ledger provides its lot and quantity. The historical weighbridge, inspection and bin records are unavailable."
          : "Receiving is complete. The production ledger now holds this exact lot and quantity.",
      ) +
      "</p>" +
      facts([
        ["Shared ledger movement", m.receiptId || "Unrecorded"],
        ["Receipt time", displayTime(m.receivedAt)],
        [
          "Source",
          m.source === "prior"
            ? "Prior / seeded ledger receipt"
            : m.sourceId + " / " + m.qualityRef,
        ],
        ["Raw lot and quantity", String(m.lot) + " / " + kg(m.kg)],
      ])
    );
  }
  function evidence(m) {
    if (m.source !== "learner" || m.stage === "draft") return "";
    const events = Array.isArray(m.qualityEvents) ? m.qualityEvents : [];
    return (
      "<details><summary>Recorded receiving evidence</summary>" +
      facts([
        ["Weighbridge and purchase", m.sourceId + " / " + m.purchaseRef],
        [
          "Gross, tare and net",
          kg(m.grossKg) + " / " + kg(m.tareKg) + " / " + kg(m.kg),
        ],
        ["Supplier lot", m.lot],
      ]) +
      (events.length
        ? "<ol>" +
          events
            .map(
              (e) =>
                "<li>" +
                esc(e.event) +
                " · " +
                esc(e.ref) +
                " · " +
                esc(displayTime(e.at)) +
                "</li>",
            )
            .join("") +
          "</ol>"
        : "<p>The next record is the supplier-lot quality result.</p>") +
      (m.stage === "posted"
        ? facts([
            ["Confirmed location", m.location],
            ["Shared inventory movement", m.receiptId],
            ["Posting time", displayTime(m.receivedAt)],
          ])
        : "") +
      "</details>"
    );
  }
  function guidance(state, m) {
    const w = work(state);
    switch (m.stage) {
      case "draft":
        return [
          "Capture the purchase reference, current production order and supplier identity. Weighbridge net mass determines the actual quantity held.",
          "Use " +
            w.purchase +
            ", " +
            state.orderId +
            " and " +
            w.lot +
            ". Subtract " +
            kg(w.tare) +
            " from " +
            kg(w.gross) +
            " to obtain " +
            kg(w.net) +
            ".",
        ];
      case "held":
        return [
          "Check the result against this lot. A wrong-lot or failed sample keeps the charge unavailable. The fault buttons let you practise that decision.",
          "Request the matching signed result, enter " +
            reportRef(w, m) +
            " and release " +
            w.lot +
            ". For a failed training sample, retain the hold before requesting the signed retest.",
        ];
      case "released":
        return [
          "Confirm the physical lot and bin. This action posts a single inbound movement through the shared plant ledger.",
          "Scan " +
            w.lot +
            " into " +
            w.bin +
            ". Check that the shared movement ID is " +
            w.receipt +
            " and the posted quantity is " +
            kg(m.kg) +
            ".",
        ];
      default:
        return [
          "Inspect the source and quantity in the shared batch ledger. The receipt is now available to the same production order.",
          "Compare " +
            m.receiptId +
            " and " +
            kg(m.kg) +
            " with the raw receipt in the ledger.",
        ];
    }
  }
  const css = `
    .bm-work{container-type:inline-size;background:#f4f8f4;color:#233a2f;border:1px solid #bbccc0;border-radius:12px;padding:clamp(13px,2vw,24px);font:15px/1.5 "Segoe UI",Arial,sans-serif;color-scheme:light}
    .bm-work *{box-sizing:border-box}.bm-work h2,.bm-work h3,.bm-work p{margin:0}.bm-work h2{letter-spacing:-.04em;font-size:clamp(23px,4vw,34px)}.bm-work h3{font-size:20px;letter-spacing:-.025em}
    .bm-meta,.bm-steps,.bm-actions,.bm-nav{display:flex;gap:6px 12px;flex-wrap:wrap;align-items:center}.bm-meta,.bm-steps{margin:7px 0 13px;color:#456353;font-size:12px}.bm-steps{list-style:none;padding:0}.bm-steps [aria-current=step]{color:#20553e;font-weight:700;text-decoration:underline;text-underline-offset:3px}
    .bm-facts,.bm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:8px;margin:11px 0}.bm-facts>div,.bm-kpis>div{padding:9px 11px;background:#eef5ed;border:1px solid #d2e0d5;border-radius:5px}.bm-kpis>div{background:#fff}.bm-facts dt,.bm-kpis dt{font:600 11px/1.45 Consolas,monospace;color:#4b6555}.bm-facts dd,.bm-kpis dd{margin:2px 0 0;overflow-wrap:anywhere}.bm-kpis dd{font-size:19px;font-weight:700}
    .bm-card{background:#fff;border:1px solid #bfcec3;border-radius:8px;padding:clamp(12px,2vw,19px)}.bm-guide{color:#3d5949;margin:4px 0 10px!important}.bm-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:8px;margin:12px 0}.bm-work label{display:grid;gap:4px;color:#385743;font-size:13px;align-content:end;font-weight:600}.bm-work input,.bm-work select,.bm-work button{font:inherit;max-width:100%}.bm-work input,.bm-work select{min-width:0;width:100%;color:#223c2c;padding:7px 8px;border:1px solid #9cb19f;border-radius:4px;background:#fff}.bm-work button{color:#24543c;border:1px solid #9fb7a4;background:#fff;border-radius:5px;padding:7px 11px;font-size:13px;font-weight:650;cursor:pointer}.bm-work .bm-primary{color:#fff;background:#285f45;border-color:#285f45}.bm-work :is(button,input,select):disabled{opacity:.66;cursor:default}.bm-work :focus-visible{outline:3px solid #35799a;outline-offset:2px}.bm-work details,.bm-nav{margin-top:12px}.bm-work summary{color:#23563d;cursor:pointer;font-weight:650}.bm-note:not(:empty),.bm-lock:not(:empty){padding:9px 11px;background:#e9f3e9;border-left:3px solid #679279;color:#2c543b;margin:10px 0 0}.bm-note[data-ok=false]:not(:empty),.bm-lock:not(:empty){background:#faefdd;border-color:#a37b42;color:#6e4618}.bm-work small{color:#476451}.bm-work a{color:#20563c}
    @container(max-width:540px){.bm-kpis{grid-template-columns:1fr 1fr}.bm-facts,.bm-fields{grid-template-columns:1fr 1fr}}@container(max-width:350px){.bm-fields,.bm-facts{grid-template-columns:1fr}}
  `;
  function mount(root, state, ctx = {}) {
    views.get(root)?.destroy();
    const style = document.createElement("style"),
      shell = document.createElement("section");
    style.textContent = css;
    shell.className = "bm-work";
    shell.setAttribute("aria-label", "Shared batch receiving");
    root.replaceChildren(style, shell);
    let notice = "",
      positive = true,
      disposed = false;
    const locked = () =>
      !!ctx.readonly ||
      !!(typeof ctx.locked === "function" ? ctx.locked() : ctx.locked);
    const current = () =>
      sameBatch(state.momentum, state) && phases.includes(state.momentum.stage)
        ? state.momentum
        : null;
    const forView = () => current() || prior(state) || fresh(state);
    function editable() {
      if (locked()) return null;
      let m = current();
      if (!m) {
        m = prior(state) || fresh(state);
        state.momentum = m;
      }
      if (!m.draft || typeof m.draft !== "object") m.draft = {};
      return m;
    }
    function report(r) {
      notice = r.why;
      positive = r.ok;
      const msg = shell.querySelector("[data-bm-note]");
      if (msg) {
        msg.dataset.ok = String(positive);
        msg.textContent = notice;
      }
    }
    function refresh() {
      if (disposed) return;
      const m = forView(),
        stage = m.stage,
        w = work(state),
        posted = hasReceipt(state) ? state.ledger.receiptKg : 0;
      const lockedMsg = ctx.readonly
        ? "Worked record. The batch evidence below is read-only."
        : locked()
          ? "Receiving is locked while this batch is running or already processed."
          : "";
      const guide = guidance(state, m);
      shell.innerHTML =
        '<small>Brighteye Momentum · workflow simulation</small><h2>Receive potatoes for this batch</h2><div class="bm-meta"><b>' +
        esc(state.batchId) +
        "</b><span>Production order " +
        esc(state.orderId) +
        "</span><span>Raw purchase " +
        esc(w.purchase) +
        '</span></div><p>Receive the supplier delivery against the allocated batch. Its signed inspection and put-away make the weighed quantity available for APS scheduling.</p><dl class="bm-kpis">' +
        [
          ["Batch charge", kg(state.initialKg)],
          ["Held at receiving", kg(stage === "held" ? m.kg : 0)],
          ["Released at staging", kg(stage === "released" ? m.kg : 0)],
          ["Raw stock received", kg(posted)],
        ]
          .map(
            ([a, b]) =>
              "<div><dt>" +
              a +
              '</dt><dd data-bm-kpi="' +
              esc(a) +
              '">' +
              esc(b) +
              "</dd></div>",
          )
          .join("") +
        '</dl><ol class="bm-steps" aria-label="Receipt progress">' +
        phases
          .map(
            (value, i) =>
              "<li " +
              (value === stage ? 'aria-current="step"' : "") +
              ">" +
              String(i + 1) +
              ". " +
              names[value] +
              (i < phases.indexOf(stage) ? " ✓" : "") +
              "</li>",
          )
          .join("") +
        '</ol><div class="bm-card"><h3 tabindex="-1" data-bm-heading>' +
        names[stage] +
        '</h3><p class="bm-guide">' +
        esc(guide[0]) +
        "</p>" +
        panel(state, m) +
        evidence(m) +
        '<p class="bm-lock">' +
        esc(lockedMsg) +
        '</p><p class="bm-note" data-bm-note role="status" aria-live="polite" data-ok="' +
        positive +
        '">' +
        esc(notice) +
        "</p><details><summary>Worked target and checks</summary><p>" +
        esc(guide[1]) +
        '</p></details></div><div class="bm-nav">' +
        action("aps", "Open APS scheduling") +
        (stage === "posted" ? action("ledger", "Inspect shared ledger") : "") +
        '</div><small>Fictional training documents. <a href="https://www.brighteye.be/warehouse-management-system" target="_blank" rel="noopener noreferrer">Brighteye warehouse workflows</a></small>';
      if (locked())
        shell
          .querySelectorAll("input,select,form button,.bm-actions button")
          .forEach((el) => (el.disabled = true));
    }
    function setDraft(e) {
      const k = e.target.dataset.bmField;
      if (!k || locked()) return;
      const m = editable();
      if (!m || m.stage === "posted") return;
      if (m.draft[k] !== e.target.value) {
        m.draft[k] = e.target.value;
        ctx.save?.();
      }
    }
    function recordQuality(m, event, ref) {
      if (!Array.isArray(m.qualityEvents)) m.qualityEvents = [];
      const last = m.qualityEvents.at(-1);
      if (last?.event === event && last?.ref === ref) return;
      m.qualityEvents.push({ event, ref, at: new Date().toISOString() });
    }
    function complete(result, before, m) {
      if (!result.ok) {
        report(result);
        return;
      }
      report(result);
      ctx.save?.();
      refresh();
      if (m.stage !== before)
        shell
          .querySelector("[data-bm-heading]")
          ?.focus({ preventScroll: true });
    }
    function click(e) {
      const b = e.target.closest("button[data-bm]");
      if (!b || !shell.contains(b) || b.disabled) return;
      const op = b.dataset.bm;
      if (op === "aps" || op === "ledger") {
        ctx.go?.(op === "aps" ? "aps" : "sap");
        return;
      }
      if (locked()) return;
      const m = editable();
      if (!m || m.stage !== "held") return;
      if (!["fetch", "fail", "mismatch"].includes(op)) return;
      const w = work(state);
      if (op === "fetch" && m.report === "failed" && !m.failureHeld) {
        report(
          bad(
            "First apply a hold against the failed sample. Then request its documented retest.",
          ),
        );
        return;
      }
      if (op === "fetch" && m.report === "failed") m.retested = true;
      m.report =
        op === "fetch" ? "approved" : op === "fail" ? "failed" : "mismatch";
      if (op === "fail") m.failureHeld = false;
      const ref = m.report === "mismatch" ? w.sample + "-X" : reportRef(w, m);
      recordQuality(m, m.report, ref);
      complete(
        ok(
          op === "fetch"
            ? "Matching signed report " +
                ref +
                " is available. Verify its lot before release."
            : op === "fail"
              ? "The simulated sample failed. Apply a hold and review the signed retest before releasing."
              : "A different lot was reported. Retain the hold and request the matching signed result.",
        ),
        m.stage,
        m,
      );
      shell
        .querySelector('[data-bm="' + op + '"]')
        ?.focus({ preventScroll: true });
    }
    function submit(e) {
      const f = e.target.closest("form[data-bm-form]");
      if (!f || !shell.contains(f)) return;
      e.preventDefault();
      if (locked()) {
        report(bad("This batch is locked for receiving edits."));
        return;
      }
      const m = editable(),
        before = m.stage,
        op = f.dataset.bmForm;
      if (
        !({ draft: "weigh", held: "release", released: "post" }[before] === op)
      )
        return;
      for (const el of f.querySelectorAll("[data-bm-field]"))
        m.draft[el.dataset.bmField] = el.value;
      const result =
        op === "weigh"
          ? weigh(state, m)
          : op === "release"
            ? release(state, m)
            : post(state, m);
      if (op === "release" && result.ok && m.draft.disposition === "hold") {
        if (m.report === "failed") m.failureHeld = true;
        recordQuality(m, "hold", reportRef(work(state), m));
      }
      if (op === "release" && result.ok && m.stage === "released")
        recordQuality(m, "released", m.qualityRef);
      complete(result, before, m);
    }
    shell.addEventListener("input", setDraft);
    shell.addEventListener("change", setDraft);
    shell.addEventListener("click", click);
    shell.addEventListener("submit", submit);
    refresh();
    const api = {
      refresh,
      update: refresh,
      destroy() {
        if (disposed) return;
        disposed = true;
        shell.removeEventListener("input", setDraft);
        shell.removeEventListener("change", setDraft);
        shell.removeEventListener("click", click);
        shell.removeEventListener("submit", submit);
        shell.remove();
        style.remove();
        views.delete(root);
      },
    };
    views.set(root, api);
    return api;
  }
  window.BatchMomentum = Object.freeze({ mount, ready, example });
})();
