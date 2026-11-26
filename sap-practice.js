/* Read-only SAP-style production posting exercise. No ERP connection or ledger writes. */
(function () {
  "use strict";
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
  const fields = [
    ["issue", "Component issue quantity (blanks)"],
    ["receipt", "Finished receipt quantity (cartons)"],
    ["yield", "Operation yield (cartons)"],
    ["scrap", "Operation scrap (cartons)"],
  ];
  const preview = [
    { id: "PREVIEW-A", lot: "Preview lot", accepted: true },
    { id: "PREVIEW-R", lot: "Preview lot", accepted: false },
  ];
  function movement(name, label) {
    return (
      "<label>" +
      label +
      '<select name="' +
      name +
      '"><option value="">Choose movement</option><option value="101">101</option><option value="261">261</option><option value="none">No movement</option></select></label>'
    );
  }
  function mount(container, state) {
    const order = state?.order || {};
    const synthetic = !Array.isArray(order.events) || order.events.length === 0;
    const events = synthetic ? preview : order.events;
    container.innerHTML =
      '<section class="card" aria-label="SAP posting workbench"><h3>SAP-style posting workbench</h3><p>Translate one packing event into component consumption, finished stock and operation confirmation. This worksheet reads the order ledger but never posts to it or to SAP.</p>' +
      '<p class="hint">' +
      (synthetic
        ? "Synthetic preview: the selected order has no completed cycles. Practise with an accepted or rejected sample."
        : "Using this order’s recorded carton events. Checks below are per event, not cumulative order totals.") +
      "</p>" +
      "<label>Source carton event<select data-sap-event>" +
      events
        .map(
          (e, i) =>
            '<option value="' +
            i +
            '">' +
            esc(e.id) +
            " · " +
            (e.accepted ? "Accepted" : "Rejected") +
            "</option>",
        )
        .join("") +
      '</select></label><p data-sap-record class="notice"></p>' +
      "<p>In this line model every completed cycle consumes one blank, including rejects. Only accepted cartons become finished stock. Each cycle contributes one carton to either yield or scrap, never both. Enter positive movement magnitudes or zero; choose “No movement” where no inventory document line is needed.</p>" +
      '<form data-sap-form novalidate><div class="fields">' +
      movement("issueType", "Component movement type") +
      movement("receiptType", "Finished movement type") +
      fields
        .map(
          ([id, label]) =>
            "<label>" +
            label +
            '<input name="' +
            id +
            '" type="number" min="0" max="1" step="1" inputmode="numeric" autocomplete="off"></label>',
        )
        .join("") +
      '</div><div class="actions"><button class="primary" type="submit">Reconcile worksheet</button></div></form><div data-sap-result role="status" aria-live="polite"></div>' +
      '<details><summary>Why 261 and 101? SAP references</summary><p>In the standard production-order examples, 261 issues a consumed component against the order; 101 receives produced material into stock against the order. Yield and scrap describe the operation result. They are not themselves movement types. This lab uses no finished-stock receipt for a rejected carton.</p><p>A real plant may backflush components or trigger goods receipt automatically. Reporting steps, control keys, reservations and integration mappings determine which system posts each movement. Check the configured route before proposing a second posting.</p><p>Official SAP documentation, read 26 November 2026: <a href="https://help.sap.com/doc/f6b2ab2222794bebad4c0dcd33138e71/latest/en-US/SAP_DMC_Integration_Guide_enUS.pdf">Digital Manufacturing Integration Guide: scrap and goods movements</a>; <a href="https://help.sap.com/doc/d05ef074b81d8262101cdf1cfb902988/2608/en-US/55E_S4CLD2608_BPD_EN_BE.pdf">S/4HANA Cloud process example: goods receipt for production order</a>. The exercise itself does not require these links.</p></details></section>';
    const panel = container.firstElementChild,
      select = panel.querySelector("[data-sap-event]"),
      form = panel.querySelector("form"),
      result = panel.querySelector("[data-sap-result]");
    const current = () => events[Number(select.value)];
    function selectEvent() {
      const e = current();
      form.reset();
      result.replaceChildren();
      const stateText = synthetic
        ? "Synthetic record; no posting status."
        : Array.isArray(order.posted) && order.posted.includes(e.id)
          ? "Already acknowledged by the simulated ERP ledger."
          : "Not yet acknowledged by the simulated ERP ledger.";
      panel.querySelector("[data-sap-record]").textContent =
        (synthetic ? "Preview order" : order.id) +
        " · " +
        e.id +
        " · Lot: " +
        (e.lot || order.lot || "not recorded") +
        " · Inspection: " +
        (e.accepted ? "accepted. " : "rejected. ") +
        stateText;
    }
    select.addEventListener("change", selectEvent);
    form.addEventListener("input", () => result.replaceChildren());
    form.addEventListener("submit", (evt) => {
      evt.preventDefault();
      const e = current(),
        accepted = e.accepted === true,
        fd = new FormData(form);
      const raw = fields.map(([key]) => String(fd.get(key) ?? "").trim());
      if (
        raw.some(
          (v) =>
            v === "" ||
            !Number.isInteger(Number(v)) ||
            Number(v) < 0 ||
            Number(v) > 1,
        ) ||
        !fd.get("issueType") ||
        !fd.get("receiptType")
      ) {
        result.textContent =
          "Incomplete worksheet. Select both movement types and enter a whole quantity of 0 or 1 in every field.";
        return;
      }
      const expected = [
        1,
        Number(accepted),
        Number(accepted),
        Number(!accepted),
      ];
      const issues = [];
      if (fd.get("issueType") !== "261")
        issues.push(
          "Component movement: this event consumes a blank against the production order, so use 261.",
        );
      if (fd.get("receiptType") !== (accepted ? "101" : "none"))
        issues.push(
          accepted
            ? "Finished movement: the accepted carton enters stock; use 101 in this scenario."
            : "Finished movement: the rejected carton never enters finished stock. Select No movement, not a zero-quantity 101 posting.",
        );
      const explanations = [
        "Even a rejected cycle consumed the blank.",
        accepted
          ? "The accepted carton enters finished stock."
          : "A reject contributes no finished stock.",
        accepted
          ? "An accepted inspection contributes to operation yield."
          : "A rejected carton is not operation yield.",
        accepted
          ? "A good carton is not scrap."
          : "The failed inspection contributes one unit of scrap.",
      ];
      raw.forEach((v, i) => {
        if (Number(v) !== expected[i])
          issues.push(
            fields[i][1] + ": expected " + expected[i] + ". " + explanations[i],
          );
      });
      if (issues.length) {
        result.innerHTML =
          "<p><strong>Not reconciled.</strong></p><ul>" +
          issues.map((text) => "<li>" + esc(text) + "</li>").join("") +
          "</ul>";
        return;
      }
      result.innerHTML =
        '<p class="notice"><strong>Reconciled: ' +
        esc(e.id) +
        ".</strong> Component stock −1 blank; finished stock " +
        (accepted ? "+1 carton" : "unchanged") +
        "; operation yield " +
        expected[2] +
        ", scrap " +
        expected[3] +
        ". Worksheet only: no stock or posting status changed.</p>";
    });
    selectEvent();
  }
  window.SWSAP = { mount };
})();
