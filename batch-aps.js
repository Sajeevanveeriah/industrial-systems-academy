/* Finite-capacity reservation for the active simulated fry order. All times are plant-local virtual minutes. */
(function () {
  "use strict";
  const LINE = "PK-FRY",
    PRODUCT = "Frozen straight-cut fries",
    OPEN = 420,
    CLOSE = 780,
    DEADLINE = 585,
    RATE = 600,
    MIN_SETUP = 20;
  const bookings = [
    { id: "Neighbour N-41", family: "Coated fries", start: 420, end: 460 },
    {
      id: "Neighbour N-43",
      family: "Straight-cut fries",
      start: 600,
      end: 680,
    },
  ];
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
  const clock = (minute) =>
    Number.isFinite(minute)
      ? String(Math.floor(minute / 60)).padStart(2, "0") +
        ":" +
        String(minute % 60).padStart(2, "0")
      : "";
  function minutes(value) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  }
  function momentum(state) {
    const api = window.BatchMomentum;
    if (!api?.ready)
      return {
        ok: false,
        why: "Commission the Momentum batch before scheduling.",
      };
    const test = api.ready(state);
    return test === true
      ? { ok: true, why: "" }
      : test && typeof test === "object"
        ? test
        : { ok: false, why: "Complete the Momentum batch handover first." };
  }
  function defaults(state, worked = false) {
    const l = state.ledger || {};
    return {
      line: worked ? LINE : "",
      slot: worked ? "07:40" : "07:00",
      due: "09:45",
      changeoverMin: worked ? 20 : 0,
      product: l.product || PRODUCT,
      destination: l.destination || "Cold store DC-02",
      plannedKg:
        l.plannedKg > 0
          ? l.plannedKg
          : Math.round(Number(state.initialKg) * 0.7),
    };
  }
  function inspect(state, draft) {
    const l = state.ledger || {},
      errors = [],
      setup = Number(draft.changeoverMin),
      yieldKg = Number(draft.plannedKg);
    const start = minutes(draft.slot),
      due = minutes(draft.due),
      raw = Number(state.initialKg),
      runMin = Math.ceil((raw * 60) / RATE);
    const validSetup =
      String(draft.changeoverMin ?? "").trim() !== "" &&
      Number.isInteger(setup) &&
      setup >= 0 &&
      setup <= 120;
    const at =
      Number.isFinite(start) && validSetup && Number.isFinite(runMin)
        ? start + setup
        : NaN;
    const end = at + runMin,
      late =
        Number.isFinite(end) && Number.isFinite(due)
          ? Math.max(0, end - due)
          : null;
    if (
      !state.orderId ||
      !state.batchId ||
      !l.lot ||
      !(raw > 0) ||
      !(Number(l.receiptKg) >= raw)
    )
      errors.push("Receive a named raw lot covering the active batch charge.");
    if (draft.line !== LINE)
      errors.push(
        "Select PK-FRY. PK-FLAKE is a flake line and cannot run this frozen-fry route.",
      );
    if (draft.product !== PRODUCT)
      errors.push(
        "The active straight-cut route requires the frozen straight-cut fries product.",
      );
    if (!String(draft.destination || "").trim())
      errors.push(
        "Enter the receiving destination for the released production order.",
      );
    if (!Number.isFinite(yieldKg) || yieldKg <= 0 || yieldKg > raw)
      errors.push(
        "Enter a positive planned finished quantity within the raw potato charge for this exercise.",
      );
    if (!validSetup)
      errors.push("Enter a whole changeover allowance from 0 to 120 minutes.");
    if (!Number.isFinite(start) || start < OPEN || start >= CLOSE)
      errors.push(
        "Set the beginning of the reservation inside the 07:00 to 13:00 shift.",
      );
    if (!Number.isFinite(due) || due <= OPEN || due > DEADLINE)
      errors.push(
        "Set the due time after shift opening and no later than the 09:45 customer cutoff.",
      );
    if (Number.isFinite(start) && Number.isFinite(end)) {
      const previous = bookings.filter((b) => b.end <= start).at(-1);
      const minimum =
        !previous || previous.family === "Coated fries" ? MIN_SETUP : 0;
      if (setup < minimum)
        errors.push(
          "The previous setup is coated. Reserve at least 20 minutes to change to straight-cut fries.",
        );
      if (end > CLOSE)
        errors.push("The reservation runs beyond the 13:00 shift end.");
      for (const hold of bookings)
        if (start < hold.end && end > hold.start)
          errors.push(
            "Capacity conflict with " +
              hold.id +
              " (" +
              clock(hold.start) +
              " to " +
              clock(hold.end) +
              ").",
          );
      if (late > 0)
        errors.push(
          "Finish " +
            clock(end) +
            " misses the selected due time by " +
            late +
            " min.",
        );
    }
    const plan = {
      batchId: state.batchId,
      orderId: state.orderId,
      lot: l.lot,
      receiptId: state.momentum?.receiptId,
      receiptKg: l.receiptKg,
      chargeKg: raw,
      product: draft.product,
      destination: String(draft.destination || "").trim(),
      plannedKg: yieldKg,
      line: draft.line,
      slot: draft.slot,
      due: draft.due,
      changeoverMin: setup,
      runMin,
      setupStart: clock(start),
      runStart: clock(at),
      finish: clock(end),
      lateMin: late,
    };
    return { errors, plan };
  }
  function ready(state) {
    const p = state?.aps?.plan,
      l = state?.ledger;
    const old = state?.aps?.prior;
    if (
      !p &&
      old &&
      state.aps.source === "prior-release" &&
      l?.status === "Released" &&
      old.batchId === state.batchId &&
      old.orderId === state.orderId &&
      old.product === l.product &&
      old.destination === l.destination &&
      old.plannedKg === l.plannedKg &&
      momentum(state).ok
    ) {
      return {
        ok: true,
        why: "Earlier production release retained. No original scheduling slot was recorded.",
      };
    }
    if (!p || !l)
      return {
        ok: false,
        why: "Submit a feasible APS reservation for this batch.",
      };
    const linked = momentum(state);
    if (!linked.ok)
      return {
        ok: false,
        why: linked.why || "The Momentum handover is incomplete.",
      };
    const { errors, plan } = inspect(state, p);
    if (errors.length) return { ok: false, why: errors[0] };
    for (const key of Object.keys(plan))
      if (p[key] !== plan[key])
        return {
          ok: false,
          why: "The saved schedule differs from this batch, receipt or calculated slot. Review the reservation.",
        };
    if (
      l.status !== "Released" ||
      l.product !== p.product ||
      l.destination !== p.destination ||
      l.plannedKg !== p.plannedKg
    )
      return {
        ok: false,
        why: "The ledger order and APS release fields do not match.",
      };
    return {
      ok: true,
      why:
        "Order " +
        p.orderId +
        " has a reserved " +
        p.line +
        " run from " +
        p.runStart +
        " to " +
        p.finish +
        ".",
    };
  }
  function example(state) {
    const draft = defaults(state, true),
      test = inspect(state, draft);
    return { draft, plan: test.errors.length ? null : test.plan };
  }
  function slot(state) {
    if (!state?.aps?.plan || !ready(state).ok) return null;
    const p = state.aps.plan;
    return {
      startMin: minutes(p.runStart),
      endMin: minutes(p.finish),
      setupStartMin: minutes(p.setupStart),
      line: p.line,
    };
  }
  function mount(root, state, ctx = {}) {
    const stored = state.aps || {},
      defaultDraft = defaults(state);
    let d = { ...defaultDraft, ...(stored.draft || stored.plan || {}) },
      msg = "";
    const lineLabels = {
      "": "Select a dispatch line",
      "PK-FRY": "PK-FRY · frozen fry line",
      "PK-FLAKE": "PK-FLAKE · flake line",
    };
    const locked = () =>
      Boolean(
        ctx.readonly ||
        (typeof ctx.locked === "function" ? ctx.locked() : ctx.locked) ||
        state.events?.length ||
        state.ledger?.stages?.length ||
        state.index > 0 ||
        state.progress > 0,
      );
    function persistDraft() {
      state.aps = { ...state.aps, draft: { ...d } };
      ctx.save?.();
    }
    function values() {
      const result = { ...d };
      for (const el of root.querySelectorAll("[data-baps-field]"))
        result[el.dataset.bapsField] = el.value;
      return result;
    }
    function lineField() {
      return (
        '<label>Production line<select data-baps-field="line">' +
        Object.entries(lineLabels)
          .map(
            ([id, name]) =>
              '<option value="' +
              id +
              '"' +
              (id === d.line ? " selected" : "") +
              ">" +
              name +
              "</option>",
          )
          .join("") +
        "</select></label>"
      );
    }
    const input = (name, title, type, attrs = "") =>
      "<label>" +
      title +
      '<input data-baps-field="' +
      name +
      '" type="' +
      type +
      '" value="' +
      esc(d[name]) +
      '" ' +
      attrs +
      "></label>";
    function paint() {
      root.innerHTML =
        '<section class="card baps" data-baps-root aria-label="Batch APS scheduling"><h3>Reserve the line for this batch</h3><p>Book time for the received potato lot and release its production order. Each existing booking occupies PK-FRY for its entire interval. The plant uses a virtual clock for this shift.</p>' +
        '<p class="notice" data-baps-identity>Batch ' +
        esc(state.batchId) +
        " · Order " +
        esc(state.orderId) +
        " · Lot " +
        esc(state.ledger?.lot || "awaiting receipt") +
        " · Received " +
        esc(state.ledger?.receiptKg || 0) +
        " kg · Charge " +
        esc(state.initialKg) +
        " kg</p>" +
        "<details><summary>Shift brief and worked settings</summary><p>PK-FRY accepts straight-cut fries at 600 kg of raw charge per hour. PK-FLAKE has a different process route. Shift hours are 07:00 to 13:00. The preceding coated family needs 20 minutes of changeover. The customer cutoff is 09:45. You can test a tighter internal due time.</p><p>For a 1,000 kg raw charge, reserve PK-FRY at 07:40 after N-41. Allow 20 minutes for changeover. The 100-minute production run begins at 08:00 and finishes at 09:40, five minutes before the cutoff. A worked order targets 700 kg finished product.</p></details>" +
        '<div class="fields">' +
        lineField() +
        input("slot", "Start of reservation", "time") +
        input(
          "changeoverMin",
          "Changeover allowance (min)",
          "number",
          'min="0" max="120" step="1"',
        ) +
        input("due", "Order due time", "time") +
        input(
          "plannedKg",
          "Planned finished quantity (kg)",
          "number",
          'min="0.01" step="any"',
        ) +
        input(
          "destination",
          "Receiving destination",
          "text",
          'maxlength="100"',
        ) +
        "</div>" +
        "<p>Product · " +
        esc(d.product) +
        '</p><div class="actions"><button type="button" data-baps="worked">Load worked settings</button><button type="button" data-baps="earliest">Find earliest feasible slot</button><button type="button" data-baps="release" class="primary">Submit schedule and release order</button></div>' +
        '<div data-baps-timeline></div><p data-baps-feedback role="status" aria-live="polite"></p><p data-baps-active></p></section>';
      root.querySelectorAll("[data-baps-field],[data-baps]").forEach((el) => {
        el.disabled = locked();
      });
      update();
    }
    const q = (selector) => root.querySelector(selector);
    function update() {
      const test = inspect(state, d),
        p = test.plan;
      const entries = bookings.map((b) => ({
        time: b.start,
        html:
          "<li><b>" +
          b.id +
          "</b> · PK-FRY · " +
          b.family +
          " · " +
          clock(b.start) +
          " to " +
          clock(b.end) +
          "</li>",
      }));
      if (d.line === LINE && p.runStart && p.finish)
        entries.push({
          time: minutes(d.slot),
          html:
            "<li><b>" +
            esc(p.orderId) +
            "</b> · changeover " +
            esc(p.setupStart) +
            " to " +
            esc(p.runStart) +
            " · production " +
            esc(p.runStart) +
            " to " +
            esc(p.finish) +
            " (" +
            esc(p.runMin) +
            " min) · due " +
            esc(d.due) +
            "</li>",
        });
      entries.sort((a, b) => a.time - b.time);
      q("[data-baps-timeline]").innerHTML =
        "<h4>PK-FRY shift timeline</h4><ol>" +
        entries.map((e) => e.html).join("") +
        "</ol>" +
        (test.errors.length
          ? '<div class="notice warning"><strong>Revise the proposal</strong><ul>' +
            test.errors.map((e) => "<li>" + esc(e) + "</li>").join("") +
            "</ul></div>"
          : '<p class="notice">Feasible slot. Capacity, family changeover and due time all pass.</p>');
      const committed = ready(state);
      q("[data-baps-active]").textContent =
        (committed.ok ? "Active reservation. " : "Release check. ") +
        committed.why;
      q("[data-baps-feedback]").textContent = locked()
        ? "This batch schedule is read-only during operation or in worked mode."
        : msg;
    }
    function earliest() {
      if (d.line !== LINE) {
        msg = "Select the eligible PK-FRY line before searching for a slot.";
        update();
        return;
      }
      for (let m = OPEN; m < CLOSE; m++) {
        const candidate = { ...d, slot: clock(m) };
        if (!inspect(state, candidate).errors.length) {
          d = candidate;
          msg =
            "Earliest feasible start found at " +
            d.slot +
            ". Review and submit the proposal.";
          persistDraft();
          paint();
          return;
        }
      }
      msg =
        "No feasible slot with these constraints. Check the changeover, due time, raw lot and planned quantity.";
      update();
    }
    function release() {
      const gate = momentum(state),
        test = inspect(state, d);
      if (!gate.ok) {
        msg =
          gate.why ||
          "Complete the Momentum handover before releasing this schedule.";
        update();
        return;
      }
      if (test.errors.length) {
        msg = test.errors[0];
        update();
        return;
      }
      const l = state.ledger,
        p = test.plan;
      const identical =
        ready(state).ok &&
        Object.keys(p).every((k) => state.aps.plan[k] === p[k]);
      if (identical) {
        msg = "This exact order and time slot are already released.";
        update();
        return;
      }
      if (typeof window.FryLedger?.releaseOrder !== "function") {
        msg = "The order-release interface is unavailable.";
        update();
        return;
      }
      const receiptId = l.lot,
        orderId = state.orderId,
        batchId = state.batchId;
      const released = window.FryLedger.releaseOrder(state, {
        product: p.product,
        destination: p.destination,
        plannedKg: p.plannedKg,
      });
      if (released?.ok !== true) {
        msg = released?.why || "The ledger declined this release.";
        update();
        return;
      }
      if (
        state.ledger?.lot !== receiptId ||
        state.orderId !== orderId ||
        state.batchId !== batchId
      ) {
        msg =
          "The batch identity changed during release. Review the ledger before submitting another reservation.";
        update();
        return;
      }
      state.aps = { draft: { ...d }, plan: p };
      ctx.save?.();
      msg =
        "Reservation committed for " +
        p.orderId +
        " on " +
        p.line +
        " with " +
        p.plannedKg +
        " kg planned output.";
      update();
    }
    paint();
    root.oninput = (e) => {
      if (!e.target.hasAttribute("data-baps-field") || locked()) return;
      d = values();
      persistDraft();
      msg = "Draft updated. Submit to commit these settings.";
      update();
    };
    root.onchange = (e) => {
      if (!e.target.hasAttribute("data-baps-field") || locked()) return;
      const next = values();
      if (JSON.stringify(next) === JSON.stringify(d)) return;
      d = next;
      persistDraft();
      msg = "Draft updated. Submit to commit these settings.";
      update();
    };
    root.onclick = (e) => {
      const b = e.target.closest("[data-baps]");
      if (!b || locked()) return;
      if (b.dataset.baps === "worked") {
        d = defaults(state, true);
        msg = "Worked settings loaded for review. Submit to release the order.";
        persistDraft();
        paint();
      } else if (b.dataset.baps === "earliest") earliest();
      else if (b.dataset.baps === "release") release();
    };
  }
  window.BatchAPS = { mount, ready, example, slot };
})();
