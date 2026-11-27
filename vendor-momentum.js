(() => {
  "use strict";
  const mounts = new WeakMap();
  const sources = {
    warehouse: [
      "Momentum warehouse management",
      "https://www.brighteye.be/warehouse-management-system",
    ],
    quality: [
      "Brighteye’s bulk-receipt case study",
      "https://www.brighteye.be/articles/quality-assurance-nutreco",
    ],
    batch: [
      "Momentum batch management",
      "https://www.brighteye.be/batch-management-system",
    ],
  };
  const clean = (value) =>
    String(value ?? "")
      .trim()
      .toUpperCase();
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
  const amount = (value) =>
    value === undefined || String(value).trim() === "" ? NaN : Number(value);
  const kg = (n) => n.toLocaleString("en-AU") + " kg";
  const initial = () => ({
    receiving: { step: 0, report: "pending" },
    dispatch: {
      step: 0,
      loseAck: false,
      forward: false,
      backward: false,
      trace: "",
    },
  });
  const stageNames = {
    receiving: [
      "Record receipt",
      "Check quality",
      "Put away",
      "Confirm receipt",
    ],
    dispatch: [
      "Consume raw lot",
      "Record yield",
      "Dispatch",
      "Confirm delivery",
      "Trace the lot",
    ],
  };
  const labels = {
    receiving: "Receive a raw lot",
    dispatch: "Consume, dispatch and trace",
  };
  const storageKey = "signalworks.momentum.workflow.v1";
  function read() {
    const s = initial();
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (!stored) return s;
      for (const id of Object.keys(s)) {
        const v = stored[id];
        if (
          !v ||
          !Number.isInteger(v.step) ||
          v.step < 0 ||
          v.step > stageNames[id].length
        )
          continue;
        s[id].step = v.step;
      }
      if (
        ["pending", "mismatch", "approved"].includes(stored.receiving?.report)
      )
        s.receiving.report = stored.receiving.report;
      if (s.receiving.step >= 2) s.receiving.report = "approved";
      const d = s.dispatch,
        old = stored.dispatch || {};
      d.loseAck = d.step === 2 && old.loseAck === true;
      if (d.step >= 4) {
        d.forward = old.forward === true;
        d.backward = old.backward === true;
        if (d.step === 5) d.forward = d.backward = true;
        d.trace = ["forward", "backward"].includes(old.trace) ? old.trace : "";
      }
    } catch {
      /* The workspace also works with browser storage disabled. */
    }
    return s;
  }
  function save(s) {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(s));
    } catch {
      /* Controls retain this session's changes in memory. */
    }
  }
  function result(ok, message) {
    return { ok, message };
  }
  function runReceiving(s, action, data) {
    if (action === "mismatch" && s.step === 1) {
      s.report = "mismatch";
      return result(
        true,
        "The incoming report belongs to POT-014. Compare it with the receipt before deciding on release.",
      );
    }
    if (action === "fetch" && s.step === 1) {
      s.report = "approved";
      return result(
        true,
        "The signed training result Q-041 is available for POT-041. Check both identifiers before release.",
      );
    }
    if (action === "receive" && s.step === 0) {
      if (data.order !== "PO-104")
        return result(
          false,
          "Match the delivery note to purchase order PO-104. The production order records material usage later.",
        );
      if (clean(data.lot) !== "POT-041")
        return result(
          false,
          "Scan the supplier label POT-041. A different lot would break the link to the inspection sample.",
        );
      if (amount(data.net) !== 980)
        return result(
          false,
          "Calculate the weighbridge net from 5,340 kg gross minus 4,360 kg tare. Enter the delivered mass in kilograms.",
        );
      s.step++;
      return result(
        true,
        "Receipt R-104 holds 980 kg against POT-041. Production availability is zero while quality checks are open.",
      );
    }
    if (action === "release" && s.step === 1) {
      if (data.decision === "hold")
        return result(
          true,
          "Hold retained. All 980 kg remain unavailable. Request a matching signed result when ready to release.",
        );

      if (s.report === "pending")
        return result(
          false,
          "The lab result is pending. Request the signed result and keep the delivery on hold.",
        );
      if (s.report === "mismatch")
        return result(
          false,
          "Q-014 identifies POT-014. Keep POT-041 on hold and request its matching signed result.",
        );
      if (data.decision !== "release")
        return result(
          false,
          "The matched sample is approved. Choose release to authorise put-away for this exercise.",
        );
      s.step++;
      return result(
        true,
        "Q-041 released POT-041. The released lot is still at inbound staging until its physical move is recorded.",
      );
    }
    if (action === "putaway" && s.step === 2) {
      if (data.bin !== "RAW-A2")
        return result(
          false,
          "The reservation names RAW-A2. Put the potatoes into that raw-material bin and keep finished-goods staging free.",
        );
      if (clean(data.confirmLot) !== "POT-041")
        return result(
          false,
          "The put-away movement needs the same supplier lot that was released. Check R-104.",
        );
      s.step++;
      return result(
        true,
        "Movement MV-104 put 980 kg into RAW-A2. The full quantity is available for production.",
      );
    }
    if (action === "post" && s.step === 3) {
      if (amount(data.actual) !== 980)
        return result(
          false,
          "Use the verified receipt mass of 980 kg for the ERP message. The ordered quantity was 1,000 kg.",
        );
      if (data.variance !== "short")
        return result(
          false,
          "The delivered amount is 20 kg below the purchase order. Record a short delivery and retain the outstanding balance.",
        );
      s.step++;
      return result(
        true,
        "ERP receipt acknowledgement ACK-104 covers 980 kg. The purchase order retains a 20 kg shortfall.",
      );
    }
    return result(
      false,
      "This action belongs to another step. Use the current work instruction.",
    );
  }
  function runDispatch(s, action, data) {
    if (action === "fault" && s.step === 2) {
      s.loseAck = !s.loseAck;
      return result(
        true,
        s.loseAck
          ? "The dispatch confirmation will lose its acknowledgement once. Keep the event identifier for recovery."
          : "Acknowledgement delivery restored for the next dispatch.",
      );
    }
    if (action === "consume" && s.step === 0) {
      if (data.job !== "WO-073")
        return result(
          false,
          "Consume raw material against manufacturing order WO-073. SO-350 is the outbound demand.",
        );
      if (!data.raw)
        return result(false, "Choose the material lot to issue to the order.");
      if (data.raw !== "POT-041")
        return result(
          false,
          "POT-042 is on quality hold. Choose the released lot from RAW-A2.",
        );
      if (amount(data.issued) !== 800)
        return result(
          false,
          "The feeder records 800 kg for WO-073. Post that actual consumption against the released lot.",
        );
      s.step++;
      return result(
        true,
        "Consumption C-073 attributed 800 kg to WO-073. There are 180 kg left in RAW-A2.",
      );
    }
    if (action === "yield" && s.step === 1) {
      if (clean(data.finished) !== "FIN-073")
        return result(
          false,
          "The pallet label names FIN-073. Use that finished lot to preserve the link to WO-073.",
        );
      if (amount(data.good) !== 600 || amount(data.byproduct) !== 150)
        return result(
          false,
          "Use the packing scale and by-product ticket separately. They record 600 kg of finished fries and 150 kg of by-product.",
        );
      const loss = amount(data.loss);
      if (loss !== 50)
        return result(
          false,
          "Balance the 800 kg input after subtracting finished goods and by-product. Enter the remaining process loss.",
        );
      s.step++;
      return result(
        true,
        "FIN-073 contains 600 kg. The order balances with 150 kg of by-product and 50 kg process loss, giving 75% finished yield.",
      );
    }
    if (action === "ship" && s.step === 2) {
      if (data.lot !== "FIN-073" || data.dock !== "DS-02")
        return result(
          false,
          "The shipping instruction allocates FIN-073 to dispatch zone DS-02. Match both fields to the pick ticket.",
        );
      if (amount(data.shipQty) !== 540)
        return result(
          false,
          "SO-350 requests 540 kg. Pick that quantity and retain the remaining 60 kg of FIN-073 in the cold store.",
        );
      s.step = s.loseAck ? 3 : 4;
      s.loseAck = false;
      return result(
        true,
        s.step === 3
          ? "The physical dispatch was recorded once. ERP acknowledgement is missing. Retry event SHIP-350 using its original identifier."
          : "Shipment DEL-350 sent 540 kg to CHILL-DC-02. ERP acknowledged SHIP-350. Trace both directions to close the exercise.",
      );
    }
    if (action === "retry" && s.step === 3) {
      if (clean(data.event) !== "SHIP-350")
        return result(
          false,
          "Reuse SHIP-350 from the original dispatch event. A new identifier risks posting the same stock movement twice.",
        );
      s.step = 4;
      return result(
        true,
        "ERP acknowledged the original SHIP-350. Dispatch stays at 540 kg and finished stock stays at 60 kg.",
      );
    }
    if (action === "trace" && s.step >= 4) {
      const raw = clean(data.query),
        dir = data.direction;
      if (!dir) return result(false, "Choose a trace direction.");
      if (dir === "forward" && raw === "POT-041") {
        s.forward = true;
        s.trace = "forward";
      } else if (dir === "backward" && raw === "DEL-350") {
        s.backward = true;
        s.trace = "backward";
      } else
        return result(
          false,
          dir === "forward"
            ? "Start the forward trace with the consumed supplier lot POT-041."
            : "Start the backward trace with shipment DEL-350 from the dispatch record.",
        );
      if (s.forward && s.backward) s.step = 5;
      return result(
        true,
        s.step === 5
          ? "Both trace directions are proven. The remaining 60 kg of FIN-073 and the dispatched 540 kg both descend from POT-041."
          : "Trace recorded. Run the other direction to verify the chain from both ends.",
      );
    }
    return result(
      false,
      "This action belongs to another step. Use the current work instruction.",
    );
  }
  function field(key, label, opts) {
    if (Array.isArray(opts))
      return (
        "<label>" +
        esc(label) +
        '<select data-mom-field="' +
        key +
        '"><option value="">Choose an entry</option>' +
        opts
          .map(
            ([v, title]) =>
              '<option value="' + esc(v) + '">' + esc(title) + "</option>",
          )
          .join("") +
        "</select></label>"
      );
    return (
      "<label>" +
      esc(label) +
      '<input data-mom-field="' +
      key +
      '" ' +
      (opts === "number"
        ? 'type="number" min="0" step="1" inputmode="numeric"'
        : 'type="text" maxlength="36" spellcheck="false" autocomplete="off"') +
      "></label>"
    );
  }
  const btn = (op, text, primary = false) =>
    '<button type="button" data-mom="' +
    op +
    '" class="' +
    (primary ? "mom-primary" : "") +
    '">' +
    esc(text) +
    "</button>";
  const facts = (rows) =>
    '<dl class="mom-facts">' +
    rows
      .map(
        ([a, b]) => "<div><dt>" + esc(a) + "</dt><dd>" + esc(b) + "</dd></div>",
      )
      .join("") +
    "</dl>";
  const form = (op, fields, button) =>
    '<form data-mom-form="' +
    op +
    '" novalidate><div class="mom-fields">' +
    fields.join("") +
    '</div><button type="submit" class="mom-primary" data-mom-submit="' +
    op +
    '">' +
    esc(button) +
    "</button></form>";
  function receiving(s) {
    switch (s.step) {
      case 0:
        return (
          facts([
            ["Purchase order", "PO-104 · 1,000 kg raw potatoes"],
            ["Delivery note DN-44", "Supplier lot POT-041"],
            ["Weighbridge WB-17", "Gross 5,340 kg · tare 4,360 kg"],
          ]) +
          form(
            "receive",
            [
              field("order", "Order reference", [
                ["PO-104", "PO-104 · purchase"],
                ["WO-073", "WO-073 · production"],
              ]),
              field("lot", "Supplier lot from delivery note"),
              field("net", "Delivered net mass (kg)", "number"),
            ],
            "Record held receipt",
          )
        );
      case 1:
        return (
          facts([
            ["Receipt", "R-104 · POT-041 · 980 kg held"],
            [
              "Lab report",
              s.report === "pending"
                ? "Awaiting signed sample"
                : s.report === "mismatch"
                  ? "Q-014 · POT-014 · approved"
                  : "Q-041 · POT-041 · approved",
            ],
          ]) +
          '<div class="mom-actions">' +
          btn(
            "fetch",
            s.report === "mismatch"
              ? "Request matching lab result"
              : "Request signed lab result",
          ) +
          btn("mismatch", "Inject mismatched report") +
          "</div>" +
          form(
            "release",
            [
              field("decision", "Quality disposition", [
                ["hold", "Keep on hold"],
                ["release", "Release matched lot"],
              ]),
            ],
            "Apply disposition",
          )
        );
      case 2:
        return (
          facts([
            ["Released material", "POT-041 · 980 kg at inbound staging"],
            ["Put-away reservation", "RAW-A2 · raw storage"],
            ["Destination check", "FG-B1 holds finished goods"],
          ]) +
          form(
            "putaway",
            [
              field("confirmLot", "Lot on movement label"),
              field("bin", "Destination bin", [
                ["RAW-A2", "RAW-A2 · raw storage"],
                ["FG-B1", "FG-B1 · cold store"],
              ]),
            ],
            "Confirm physical put-away",
          )
        );
      case 3:
        return (
          facts([
            ["ERP order", "PO-104 · 1,000 kg ordered"],
            ["Stock movement", "R-104 · 980 kg received and released"],
          ]) +
          form(
            "post",
            [
              field("actual", "Receipt quantity for ERP (kg)", "number"),
              field("variance", "Purchase-order balance", [
                ["full", "Close as fully delivered"],
                ["short", "Record short delivery"],
              ]),
            ],
            "Post actual receipt",
          )
        );
      default:
        return '<p class="mom-complete"><strong>Raw lot ready.</strong> POT-041 is released in RAW-A2. Use the evidence register to reconcile the purchasing shortfall with the available stock.</p>';
    }
  }
  function dispatch(s) {
    switch (s.step) {
      case 0:
        return (
          facts([
            ["Opening stock", "POT-041 · 980 kg released in RAW-A2"],
            ["Other stock", "POT-042 · 240 kg on quality hold"],
            [
              "Feeder record FD-073",
              "800 kg issued to production order WO-073",
            ],
          ]) +
          form(
            "consume",
            [
              field("job", "Consumption order", [
                ["WO-073", "WO-073 · production"],
                ["SO-350", "SO-350 · sales"],
              ]),
              field("raw", "Raw lot", [
                ["POT-042", "POT-042 · held"],
                ["POT-041", "POT-041 · released"],
              ]),
              field("issued", "Actual raw material (kg)", "number"),
            ],
            "Consume material on order",
          )
        );
      case 1:
        return (
          facts([
            ["Order input", "WO-073 · 800 kg of POT-041"],
            ["Pack scale", "FIN-073 · 600 kg packed fries"],
            ["By-product ticket", "150 kg recovered peel and trim"],
          ]) +
          form(
            "yield",
            [
              field("finished", "Finished pallet lot"),
              field("good", "Finished output (kg)", "number"),
              field("byproduct", "By-product (kg)", "number"),
              field("loss", "Unrecovered process loss (kg)", "number"),
            ],
            "Balance and receive finished lot",
          )
        );
      case 2:
        return (
          facts([
            ["Sales order SO-350", "540 kg to CHILL-DC-02"],
            ["Pick ticket PK-350", "FIN-073 · zone DS-02"],
            ["Finished stock", "600 kg available from WO-073"],
          ]) +
          '<div class="mom-actions">' +
          btn(
            "fault",
            s.loseAck
              ? "Restore acknowledgement delivery"
              : "Inject lost ERP acknowledgement",
          ) +
          "</div>" +
          form(
            "ship",
            [
              field("lot", "Picked lot", [
                ["POT-041", "POT-041 · potatoes"],
                ["FIN-073", "FIN-073 · finished fries"],
              ]),
              field("dock", "Shipment zone", [
                ["RAW-A2", "RAW-A2 · receiving"],
                ["DS-02", "DS-02 · dispatch"],
              ]),
              field("shipQty", "Quantity to dispatch (kg)", "number"),
            ],
            "Dispatch against sales order",
          )
        );
      case 3:
        return (
          facts([
            ["Delivery record", "DEL-350 · 540 kg physically dispatched"],
            ["Outbound event", "SHIP-350 · acknowledgement pending"],
            ["Stock after dispatch", "60 kg available"],
          ]) +
          form(
            "retry",
            [field("event", "Original dispatch event identifier")],
            "Retry confirmation",
          )
        );
      default:
        return (
          facts([
            ["Forward lookup", "Use supplier lot POT-041"],
            ["Backward lookup", "Use delivery DEL-350"],
          ]) +
          form(
            "trace",
            [
              field("direction", "Trace direction", [
                ["forward", "Supplier lot to delivery"],
                ["backward", "Delivery to supplier lot"],
              ]),
              field("query", "Starting identifier"),
            ],
            "Run trace",
          ) +
          (s.trace ? traceTable(s.trace) : "")
        );
    }
  }
  function traceTable(direction) {
    const chain = [
      ["Supplier lot", "POT-041", "800 kg consumed, 180 kg raw stock remains"],
      ["Manufacturing order", "WO-073", "800 kg in, 600 kg finished"],
      ["Finished lot", "FIN-073", "540 kg dispatched, 60 kg retained"],
      ["Delivery", "DEL-350", "540 kg for SO-350"],
      ["Destination", "CHILL-DC-02", "Delivery confirmed against SHIP-350"],
    ];
    return (
      "<h5>" +
      esc(
        direction === "forward"
          ? "Forward trace from POT-041"
          : "Backward trace from DEL-350",
      ) +
      '</h5><ol class="mom-trace">' +
      (direction === "forward" ? chain : chain.slice(0, 4).reverse())
        .map(
          ([title, id, qty]) =>
            "<li><strong>" +
            id +
            "</strong> · " +
            title +
            "<small>" +
            qty +
            "</small></li>",
        )
        .join("") +
      "</ol>"
    );
  }
  function evidence(id, s) {
    if (id === "receiving")
      return [
        [
          s.step >= 1,
          "R-104",
          "DN-44 matched to PO-104. POT-041 received at 980 kg on hold.",
        ],
        [s.step >= 2, "Q-041", "Matching signed inspection released POT-041."],
        [s.step >= 3, "MV-104", "980 kg moved from inbound staging to RAW-A2."],
        [
          s.step >= 4,
          "ACK-104",
          "ERP accepted 980 kg actual against 1,000 kg ordered. Outstanding 20 kg.",
        ],
      ].filter(([show]) => show);
    return [
      [true, "Opening balance", "POT-041 has 980 kg released in RAW-A2."],
      [
        s.step >= 1,
        "C-073",
        "800 kg of POT-041 consumed on WO-073. Raw balance 180 kg.",
      ],
      [
        s.step >= 2,
        "FIN-073",
        "600 kg finished, 150 kg by-product and 50 kg process loss.",
      ],
      [
        s.step >= 3,
        "SHIP-350",
        "DEL-350 dispatched 540 kg of FIN-073 against SO-350. Finished balance 60 kg.",
      ],
      [
        s.step >= 4,
        "ACK-350",
        "ERP confirmed the physical dispatch for CHILL-DC-02.",
      ],
      [
        s.forward,
        "Forward trace",
        "POT-041 reaches DEL-350. Finished inventory retains 60 kg.",
      ],
      [
        s.backward,
        "Backward trace",
        "DEL-350 originated in WO-073 using POT-041.",
      ],
    ].filter(([show]) => show);
  }
  function kpis(id, s) {
    if (id === "receiving")
      return [
        ["Physically received", kg(s.step >= 1 ? 980 : 0)],
        ["Quality hold", kg(s.step === 1 ? 980 : 0)],
        ["Available in RAW-A2", kg(s.step >= 3 ? 980 : 0)],
        ["ERP receipt", kg(s.step >= 4 ? 980 : 0)],
      ];
    return [
      ["Raw stock", kg(s.step >= 1 ? 180 : 980)],
      ["Finished stock", kg(s.step >= 3 ? 60 : s.step >= 2 ? 600 : 0)],
      ["Finished yield", s.step >= 2 ? "75%" : "Awaiting output"],
      ["Dispatched", kg(s.step >= 3 ? 540 : 0)],
    ];
  }
  const target = {
    receiving:
      "Match PO-104 and POT-041. Calculate 980 kg net, hold the receipt, obtain matching report Q-041, release and put away to RAW-A2. Report 980 kg actual and 20 kg short to ERP.",
    dispatch:
      "Consume 800 kg of released POT-041 against WO-073. Record FIN-073 with 600 kg of finished fries, 150 kg of by-product and 50 kg process loss. Dispatch 540 kg through DS-02. If confirmation is lost, reuse SHIP-350. Trace forward from POT-041 and backward from DEL-350.",
  };
  const sheet = `
.mom-work {
  color: #203932;
  background: #f5f8f4;
  border: 1px solid #bdcec3;
  border-radius: 12px;
  padding: clamp(14px, 2vw, 25px);
  font:
    15px/1.5 "Segoe UI",
    Arial,
    sans-serif;
  container-type: inline-size;
  color-scheme: light;
}
.mom-work * {
  box-sizing: border-box;
}
.mom-work h3,
.mom-work h4,
.mom-work h5,
.mom-work p {
  margin: 0;
}
.mom-work h3 {
  font-size: clamp(23px, 4vw, 36px);
  line-height: 1.15;
  letter-spacing: -0.04em;
}
.mom-work h4 {
  font-size: 21px;
  letter-spacing: -0.025em;
}
.mom-work h5 {
  font-size: 15px;
  margin: 12px 0 5px;
}
.mom-kicker,
.mom-caption,
.mom-kpis dt {
  font:
    650 11px/1.5 Consolas,
    monospace;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #3f6557;
}
.mom-kicker {
  margin-bottom: 5px !important;
}
.mom-lede {
  max-width: 78ch;
  color: #486256;
  margin: 9px 0 15px !important;
}
.mom-tabs,
.mom-actions,
.mom-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
}
.mom-work button,
.mom-work input,
.mom-work select {
  font: inherit;
}
.mom-work button {
  cursor: pointer;
  border: 1px solid #9eb4a5;
  border-radius: 5px;
  color: #214c38;
  background: #fff;
  padding: 7px 11px;
  font-size: 13px;
  font-weight: 650;
}
.mom-work button:hover {
  border-color: #236448;
}
.mom-work .mom-primary,
.mom-tabs button[aria-pressed="true"] {
  background: #245e46;
  border-color: #245e46;
  color: #fff;
}
.mom-work :is(button, input, select, summary, a):focus-visible {
  outline: 3px solid #407995;
  outline-offset: 3px;
}
.mom-tools {
  justify-content: space-between;
}
.mom-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 15px 0;
}
.mom-kpis > div,
.mom-card {
  border: 1px solid #c0cec4;
  border-radius: 8px;
  background: #fff;
}
.mom-kpis > div {
  padding: 10px 12px;
}
.mom-kpis dd {
  margin: 3px 0 0;
  font-weight: 700;
  font-size: clamp(17px, 2vw, 23px);
  line-height: 1.15;
  color: #234937;
}
.mom-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 15px;
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  font-size: 12px;
  color: #52645a;
}
.mom-steps li[aria-current="step"] {
  color: #1e5a43;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.mom-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 0.95fr);
  gap: 12px;
  align-items: start;
}
.mom-card {
  margin: 0;
  padding: clamp(13px, 2vw, 20px);
}
.mom-facts {
  margin: 10px 0 15px;
  padding: 10px 12px;
  background: #edf4ed;
  border-left: 3px solid #79a28a;
  font-size: 13px;
}
.mom-facts > div {
  margin: 3px 0;
}
.mom-facts dt {
  font-weight: 650;
}
.mom-facts dd {
  margin: 1px 0 5px;
  color: #3c574b;
}
.mom-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 155px), 1fr));
  gap: 10px;
  margin: 11px 0;
}
.mom-fields label {
  display: grid;
  gap: 4px;
  align-content: end;
  color: #415b50;
  font-size: 13px;
  font-weight: 600;
}
.mom-fields select,
.mom-fields input {
  width: 100%;
  min-width: 0;
  background: #fff;
  border-radius: 4px;
  border: 1px solid #93a99a;
  padding: 7px 9px;
  color: #243a2f;
}
.mom-evidence,
.mom-trace {
  margin: 8px 0 0;
  padding-left: 1.35rem;
  font-size: 13px;
}
.mom-evidence li,
.mom-trace li {
  padding: 7px 0;
  border-bottom: 1px solid #d7e3d8;
}
.mom-evidence small,
.mom-trace small {
  display: block;
  color: #4b6155;
  font-size: 12px;
}
.mom-help {
  color: #475e50;
  font-size: 13px;
}
.mom-feedback:not(:empty) {
  margin: 12px 0 0;
  background: #e8f4e9;
  border-left: 3px solid #52835e;
  padding: 9px 11px;
  color: #234d32;
  font-size: 14px;
}
.mom-feedback[data-ok="false"]:not(:empty) {
  background: #fff1de;
  color: #74430c;
  border-left-color: #ae7537;
}
.mom-complete {
  padding: 10px 0;
}
.mom-work details {
  margin-top: 13px;
  font-size: 14px;
}
.mom-work summary {
  cursor: pointer;
  font-weight: 650;
  color: #20523c;
}
.mom-work details p {
  margin-top: 6px;
}
.mom-sources {
  font-size: 12px;
  color: #4a6055;
  margin: 13px 0 0 !important;
}
.mom-sources a {
  color: #1e5c43;
  text-underline-offset: 2px;
}
.mom-next {
  margin-top: 10px;
}
@container (max-width:700px) {
  .mom-layout {
    grid-template-columns: 1fr;
  }
  .mom-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (max-width:350px) {
  .mom-tabs button {
    font-size: 12px;
  }
  .mom-fields {
    grid-template-columns: 1fr;
  }
  .mom-kpis > div {
    padding: 8px;
  }
}
`;
  function mount(root) {
    mounts.get(root)?.destroy();
    const state = read(),
      style = document.createElement("style"),
      outer = document.createElement("section");
    style.textContent = sheet;
    outer.className = "mom-work";
    outer.setAttribute("aria-label", "Brighteye Momentum workflow simulation");
    root.replaceChildren(style, outer);
    let active = "receiving",
      message = "",
      lastOK = true,
      disposed = false;
    function render() {
      if (disposed) return;
      const st = state[active],
        steps = stageNames[active],
        complete = st.step === steps.length;
      const list = evidence(active, st);
      const sourceKeys =
        active === "receiving"
          ? ["warehouse", "quality"]
          : ["warehouse", "batch"];
      const summary =
        active === "receiving"
          ? "Reconcile a weighbridge ticket with purchasing, keep a delivery on quality hold and make the released quantity available to production."
          : "Use a separate opening balance of 980 kg of released POT-041. Follow consumption, yield and shipment through to the supplier and customer in both directions.";
      let body = active === "receiving" ? receiving(st) : dispatch(st);
      if (complete && active === "receiving")
        body +=
          '<div class="mom-next">' +
          btn("next", "Start consumption and dispatch") +
          "</div>";
      outer.innerHTML =
        '<p class="mom-kicker">Workflow simulation</p><h3>Brighteye Momentum workflows</h3><p class="mom-lede">Practise warehouse, quality and manufacturing decisions in a fictional potato plant. The orders, screens and quantities belong to this exercise.</p><div class="mom-tools"><div class="mom-tabs" role="group" aria-label="Choose workflow">' +
        Object.keys(labels)
          .map(
            (id) =>
              '<button type="button" data-mom-tab="' +
              id +
              '" aria-pressed="' +
              (active === id) +
              '">' +
              labels[id] +
              "</button>",
          )
          .join("") +
        "</div>" +
        btn("reset", "Reset this lesson") +
        '</div><p class="mom-lede">' +
        summary +
        '</p><dl class="mom-kpis">' +
        kpis(active, st)
          .map(
            ([title, value]) =>
              "<div><dt>" +
              title +
              '</dt><dd data-mom-kpi="' +
              esc(title) +
              '">' +
              esc(value) +
              "</dd></div>",
          )
          .join("") +
        '</dl><ol class="mom-steps" aria-label="Workflow progress">' +
        steps
          .map(
            (label, i) =>
              "<li " +
              (st.step === i ? 'aria-current="step"' : "") +
              ">" +
              String(i + 1) +
              ". " +
              label +
              (i < st.step ? " ✓" : "") +
              "</li>",
          )
          .join("") +
        '</ol><div class="mom-layout"><article class="mom-card"><p class="mom-caption">' +
        esc(labels[active]) +
        '</p><h4 tabindex="-1" data-mom-heading>' +
        esc(complete ? "Workflow complete" : steps[st.step]) +
        "</h4>" +
        body +
        '</article><aside class="mom-card"><h4>Evidence register</h4>' +
        (list.length
          ? '<ol class="mom-evidence">' +
            list
              .map(
                ([, id, text]) =>
                  "<li><strong>" +
                  id +
                  "</strong><small>" +
                  text +
                  "</small></li>",
              )
              .join("") +
            "</ol>"
          : '<p class="mom-help">The first entry appears when the weighed delivery is recorded.</p>') +
        '</aside></div><p class="mom-feedback" data-mom-feedback role="status" aria-live="polite" data-ok="' +
        lastOK +
        '">' +
        esc(message) +
        '</p><details class="mom-worked"><summary>Worked target</summary><p>' +
        target[active] +
        '</p></details><p class="mom-sources">Documented workflow basis · ' +
        sourceKeys
          .map(
            (k) =>
              '<a target="_blank" rel="noopener noreferrer" href="' +
              sources[k][1] +
              '">' +
              sources[k][0] +
              "</a>",
          )
          .join(" · ") +
        " · Read 27 November 2026.</p>";
    }
    function report(action, fields) {
      const st = state[active],
        before = st.step;
      const response = (active === "receiving" ? runReceiving : runDispatch)(
        st,
        action,
        fields,
      );
      lastOK = response.ok;
      message = response.message;
      if (response.ok) {
        save(state);
        render();
        if (st.step !== before)
          outer
            .querySelector("[data-mom-heading]")
            .focus({ preventScroll: true });
        else
          outer
            .querySelector(
              '[data-mom="' + action + '"],[data-mom-submit="' + action + '"]',
            )
            ?.focus({ preventScroll: true });
      } else {
        const feedback = outer.querySelector("[data-mom-feedback]");
        feedback.dataset.ok = "false";
        feedback.textContent = message;
      }
    }
    function choose(id) {
      active = id;
      message = "";
      lastOK = true;
      render();
      outer
        .querySelector('[data-mom-tab="' + id + '"]')
        .focus({ preventScroll: true });
    }
    function click(event) {
      const b = event.target.closest("button");
      if (!b || !outer.contains(b)) return;
      if (b.dataset.momTab) {
        choose(b.dataset.momTab);
        return;
      }
      const action = b.dataset.mom;
      if (!action) return;
      if (action === "next") {
        choose("dispatch");
        return;
      }
      if (action === "reset") {
        state[active] = initial()[active];
        save(state);
        message =
          "This lesson has returned to its opening stock and documents.";
        lastOK = true;
        render();
        outer
          .querySelector('[data-mom="reset"]')
          .focus({ preventScroll: true });
        return;
      }
      report(action, {});
    }
    function submit(event) {
      const form = event.target.closest("[data-mom-form]");
      if (!form || !outer.contains(form)) return;
      event.preventDefault();
      const fields = Object.fromEntries(
        [...form.querySelectorAll("[data-mom-field]")].map((el) => [
          el.dataset.momField,
          el.value,
        ]),
      );
      report(form.dataset.momForm, fields);
    }
    outer.addEventListener("click", click);
    outer.addEventListener("submit", submit);
    render();
    const api = {
      destroy() {
        if (disposed) return;
        disposed = true;
        outer.removeEventListener("click", click);
        outer.removeEventListener("submit", submit);
        outer.remove();
        style.remove();
        mounts.delete(root);
      },
    };
    mounts.set(root, api);
    return api;
  }
  window.MomentumLessons = Object.freeze({ mount });
})();
