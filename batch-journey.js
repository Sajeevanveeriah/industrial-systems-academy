(() => {
  "use strict";

  const stages = [
    ["receive", "Receiving"],
    ["wash", "Washing"],
    ["peel", "Peeling"],
    ["cut", "Cutting"],
    ["blanch", "Blanching"],
    ["dry", "Drying"],
    ["fry", "Par-frying"],
    ["freeze", "Freezing"],
    ["pack", "Packing"],
    ["dispatch", "Dispatch"],
  ];
  const routeLinks = [
    ["momentum", "Momentum receiving"],
    ["aps", "APS planning"],
    ["floor", "Plant floor"],
    ["sap", "SAP reconciliation"],
  ];
  const format = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 3 });
  const kg = (value) =>
    Number.isFinite(value) ? format.format(value) + " kg" : "Pending";
  const current = (row, state) =>
    row && row.batchId === state.batchId && row.orderId === state.orderId;

  function el(tag, text, cls) {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    if (cls) item.className = cls;
    return item;
  }
  function link(label, route, ctx) {
    const a = el("a", label);
    a.href = "#" + route;
    if (typeof ctx?.go === "function")
      a.addEventListener("click", (e) => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          ctx.go(route);
        }
      });
    return a;
  }
  function source(label, url) {
    const a = el("a", label);
    a.href = url;
    return a;
  }
  function button(title, fn, disabled = false) {
    const b = el("button", title);
    b.type = "button";
    b.disabled = disabled;
    b.addEventListener("click", fn);
    return b;
  }
  function selectedRecords(state) {
    const ledger = state.ledger || {};
    return {
      ledger,
      moves: (ledger.moves || []).filter((row) => current(row, state)),
      operations: (ledger.stages || []).filter((row) => current(row, state)),
      samples: (state.samples || []).filter(
        (row) =>
          (row.batchId ?? row.batch) === state.batchId &&
          (!row.orderId || row.orderId === state.orderId),
      ),
      receipt: current(state.momentum, state) ? state.momentum : null,
      plan: current(state.aps?.plan, state) ? state.aps.plan : null,
    };
  }
  function checks(state, rec) {
    const momentum = window.BatchMomentum?.ready(state) || {
      ok: false,
      why: "Open receiving to verify the lot.",
    };
    const aps = window.BatchAPS?.ready(state) || {
      ok: false,
      why: "Open planning to verify the line slot.",
    };
    const queued = rec.moves.filter((m) => !m.posted).length;
    return { momentum, aps, queued };
  }

  function nextTask(state, rec, flags) {
    const site = window.SiteBuild?.check(state.site);
    if (site && !site.ok)
      return [
        "Prepare the site",
        "site",
        site.why,
        "Check the survey, shells, utilities and access, then commission the site.",
        "A signed site acceptance enables the fitout.",
      ];
    const missing =
      state.installation &&
      window.FryInstall?.check(state.installation).find((row) => !row.ok);
    if (missing)
      return [
        "Commission " + missing.label,
        missing.id === "rack" || missing.id === "patch"
          ? "rack"
          : "installation/" + missing.id,
        missing.why,
        "Use the work order and rerun its commissioning check.",
        "The first unmet dependency is " + missing.label + ".",
      ];
    if (!flags.momentum.ok) {
      const m = rec.receipt;
      const guidance = {
        draft:
          "Use the delivery docket to identify the supplier lot and purchase reference. Deduct tare from gross, enter the measured net kg and place the lot on hold.",
        held: "Inspect the held lot. Match the signed sample reference to the supplier lot and record the quality disposition.",
        released:
          "Scan the released lot into RAW-A2. Compare its receipt event ID and net kg with the raw 101 movement.",
        posted:
          "Compare the lot, net weight and receipt event ID with the raw balance in the material ledger.",
      };
      return [
        "Receive and release the potato lot",
        "momentum",
        flags.momentum.why,
        guidance[m?.stage] || guidance.draft,
        m
          ? "Receiving status: " + m.stage + "."
          : "An accepted receipt links this lot to a raw 101 event.",
      ];
    }
    if (!flags.aps.ok)
      return [
        "Schedule the production order",
        "aps",
        flags.aps.why,
        "The worked 1,000 kg charge reserves PK-FRY at 07:40 with a 20-minute changeover. Processing begins at 08:00 and finishes at 09:40 before the 09:45 due time. Recalculate the run duration for another charge.",
        rec.plan
          ? "Review the current schedule against the revised order."
          : "The accepted slot records line, start, finish and due time.",
      ];
    const idx = state.index || 0;
    const spec = window.FryProcess?.stages?.[idx];
    const name = spec?.name || stages[idx]?.[1] || "Operation";
    if (rec.operations.length === stages.length) {
      if (flags.queued || rec.ledger.online === false)
        return [
          "Reconcile the SAP interface",
          "sap",
          flags.queued + " movement(s) await posting.",
          "Restore the interface, replay pending events, then replay again and compare movement IDs and quantities.",
          "The second replay should add zero movements.",
        ];
      return [
        "Prove the batch balance",
        "sap",
        "All ten stage records are available.",
        "Compare raw receipt, component issues, packed receipt and shipment. Enter the posted quantities in the reconciliation exercise.",
        "The raw lot, slot, stage records and material documents carry this batch identity.",
      ];
    }
    if (rec.operations.some((op) => op.index === idx))
      return [
        "Transfer the completed " + name.toLowerCase() + " batch",
        "floor/" + stages[idx][0],
        "The station has booked its output.",
        "Release the material to the next operation. Compare the new input with this station’s recorded output.",
        "Current output: " + kg(rec.operations.at(-1)?.outputKg) + ".",
      ];
    if (state.sensorStale || state.guard === false)
      return [
        "Restore the " + name.toLowerCase() + " permissive",
        "floor/" + stages[idx][0],
        state.sensorStale
          ? "The PLC data feed is stale."
          : "The process guard is open.",
        "Restore the simulated source or close the process guard, then verify fresh feedback before running.",
        "While held, the batch should keep its prior output and event count.",
      ];
    const machine = window.FryProcess?.check(idx, state.configs?.[idx]);
    if (machine && !machine.ok)
      return [
        "Commission " + name,
        "floor/" + stages[idx][0],
        machine.why,
        spec.setup +
          " Set " +
          spec.parameter.toLowerCase() +
          " to " +
          spec.target +
          " " +
          spec.unit +
          ".",
        spec.outcome,
      ];
    return [
      "Operate " + name,
      "floor/" + stages[idx][0],
      spec?.reason || "Complete the current process operation.",
      "Run the station or advance it in manual steps. Examine its recorded input, additions, removals and output before transferring.",
      spec?.outcome || "A stage event is present.",
    ];
  }
  function guide(root, state, ctx = {}) {
    if (!root) return;
    const rec = selectedRecords(state),
      flags = checks(state, rec),
      task = nextTask(state, rec, flags);
    const shell = el("section", undefined, "bj-guide");
    shell.setAttribute("aria-label", "Batch journey guide");
    shell.append(
      el("small", "Current batch · " + state.batchId + " · " + state.orderId),
      el("h3", task[0]),
      el("p", task[2]),
    );
    const status = el("ol", undefined, "bj-status");
    [
      flags.momentum.ok ? "Lot released" : "Lot awaiting release",
      rec.plan && flags.aps.ok
        ? "Slot published"
        : flags.aps.ok
          ? "Prior release retained"
          : "Slot awaiting release",
      rec.operations.length + "/10 operations",
      flags.queued + " SAP queued",
    ].forEach((t) => status.append(el("li", t)));
    const action = link(task[0] + " →", task[1], ctx);
    action.className = "bj-action";
    const tips = el("details");
    tips.append(
      el("summary", "Worked guidance and acceptance evidence"),
      el("p", task[3]),
      el("p", task[4]),
    );
    const currentStage = window.FryProcess?.stages?.[state.index];
    if (task[1].startsWith("floor") && currentStage) {
      tips.append(
        el(
          "p",
          "Station fault test: " +
            currentStage.fault +
            ". " +
            currentStage.test +
            " Recovery action: " +
            currentStage.recovery +
            ".",
        ),
      );
    } else if (task[1] === "momentum") {
      tips.append(
        el(
          "p",
          "If receipt fails, check the purchase and production order identities separately. Recheck gross minus tare, the quality sample reference and the put-away bin.",
        ),
      );
    } else if (task[1] === "aps") {
      tips.append(
        el(
          "p",
          "If the slot fails, check line eligibility, overlap with neighbouring bookings, setup duration and the due time. Recalculate after changing the lot or charge.",
        ),
      );
    } else if (task[1] === "sap") {
      tips.append(
        el(
          "p",
          "If on-hand stock disagrees, split raw and finished 101 receipts by material, then compare pending movement IDs with the posted ones.",
        ),
      );
    }
    const nav = el("nav", undefined, "bj-links");
    nav.setAttribute("aria-label", "Batch workstations");
    for (const [route, title] of routeLinks)
      nav.append(link(title, route, ctx));
    shell.append(status, action, tips, nav);
    root.replaceChildren(shell);
  }

  function grid(caption, heads, rows) {
    const wrap = el("div", undefined, "bj-table");
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", caption);
    const table = el("table");
    table.append(el("caption", caption));
    const heading = table.createTHead().insertRow();
    for (const head of heads) {
      const th = el("th", head);
      th.scope = "col";
      heading.append(th);
    }
    const body = table.createTBody();
    for (const cells of rows) {
      const tr = body.insertRow();
      for (const value of cells) tr.insertCell().textContent = value;
    }
    wrap.append(table);
    return wrap;
  }
  function facts(title, pairs) {
    const article = el("article");
    article.append(el("h4", title));
    const dl = el("dl");
    for (const [key, value] of pairs) {
      dl.append(el("dt", key), el("dd", value ?? "Unrecorded"));
    }
    article.append(dl);
    return article;
  }

  const categories = [
    ["Raw potato receipt · 101", "101", "/raw-receipt"],
    ["Raw potato issue · 261", "261", "/raw-issue"],
    ["Absorbed oil issue · 261", "261", "/oil-issue"],
    ["Finished product receipt · 101", "101", "/finished-receipt"],
    ["Outbound delivery issue · 601", "601", "/delivery-issue"],
  ];
  function challenge(parent, moves) {
    const pane = el("section", undefined, "bj-box");
    pane.append(
      el("h3", "Reconcile the posted quantities"),
      el(
        "p",
        "Use the material and event ID to distinguish the two receipt types and the two component issues. Enter positive kg for posted transactions only. Enter 0 where a category has no posted quantity.",
      ),
    );
    if (!moves.length) {
      pane.append(
        el(
          "p",
          "Post the first raw receipt in Momentum to begin the exercise.",
        ),
      );
      parent.append(pane);
      return;
    }
    const form = el("form");
    const fields = el("div", undefined, "bj-answers");
    const inputs = categories.map(([name]) => {
      const label = el("label", name);
      const input = el("input");
      input.type = "number";
      input.min = "0";
      input.step = "any";
      input.required = true;
      input.setAttribute("aria-label", name + " in kg");
      label.append(input);
      fields.append(label);
      return input;
    });
    const outcome = el("p", undefined, "bj-outcome");
    outcome.setAttribute("role", "status");
    const check = el("button", "Check my reconciliation");
    check.type = "submit";
    form.append(fields, check, outcome);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const mistakes = [];
      categories.forEach(([label, code, suffix], i) => {
        const value = moves
          .filter((m) => m.posted && m.code === code && m.id.endsWith(suffix))
          .reduce((n, m) => n + m.qty, 0);
        const correct =
          Number.isFinite(inputs[i].valueAsNumber) &&
          Math.abs(inputs[i].valueAsNumber - value) < 0.00051;
        inputs[i].setAttribute("aria-invalid", String(!correct));
        if (!correct) mistakes.push(label);
      });
      outcome.textContent = mistakes.length
        ? "Review " +
          mistakes.join(", ") +
          ". Inspect the posting state, material and quantity for each event."
        : "All five totals match the posted documents for this batch.";
    });
    pane.append(form);
    parent.append(pane);
  }

  function trace(root, state, ctx = {}) {
    if (!root) return;
    const rec = selectedRecords(state),
      flags = checks(state, rec),
      m = rec.receipt,
      p = rec.plan;
    const pane = el("section", undefined, "bj-trace");
    pane.append(
      el("h2", "Batch genealogy and SAP reconciliation"),
      el(
        "p",
        "Follow " +
          state.batchId +
          " from its incoming lot to the shipment against " +
          state.orderId +
          ".",
      ),
    );
    const cards = el("div", undefined, "bj-cards");
    cards.append(
      facts("Momentum receipt", [
        ["Lot", m?.lot],
        ["Received quantity", kg(m?.kg)],
        ["Quality reference", m?.qualityRef],
        ["Source ticket", m?.sourceId],
        ["Purchase reference", m?.purchaseRef],
        ["Receipt time", m?.receivedAt],
        ["Receiving state", m?.stage],
        ["Location", m?.location],
        ["Receipt event", m?.receiptId],
        [
          "Origin",
          m?.source === "prior"
            ? "Prior ledger record"
            : m?.source === "learner"
              ? "Learner receiving workflow"
              : "Awaiting receiving",
        ],
      ]),
    );
    cards.append(
      facts("APS work order", [
        ["Order", p?.orderId],
        ["Released lot", p?.lot],
        ["Reserved receipt", p?.receiptId],
        ["Assigned line", p?.line],
        ["Slot", p?.slot],
        ["Setup starts", p?.setupStart],
        ["Run starts", p?.runStart],
        ["Finish / due", p ? p.finish + " / " + p.due : undefined],
        ["Committed charge", kg(p?.chargeKg)],
      ]),
    );
    const postedKg = (suffix) =>
      rec.moves
        .filter((move) => move.posted && move.id.endsWith(suffix))
        .reduce((total, move) => total + move.qty, 0);
    cards.append(
      facts("Raw material balance", [
        ["Posted raw receipt · 101", kg(postedKg("/raw-receipt"))],
        ["Posted raw issue · 261", kg(postedKg("/raw-issue"))],
        [
          "SAP raw on hand",
          kg(postedKg("/raw-receipt") - postedKg("/raw-issue")),
        ],
        ["Planned batch charge", kg(state.initialKg)],
      ]),
    );
    pane.append(cards);
    if (m?.source === "prior" && !m.qualityRef)
      pane.append(
        el(
          "p",
          "The earlier ledger supplies lot and quantity. Its quality inspection reference was not recorded.",
        ),
      );
    if (m?.qualityEvents?.length)
      pane.append(
        grid(
          "Recorded lot quality decisions",
          ["Decision", "Reference", "UTC time"],
          m.qualityEvents.map((event) => [
            event.event,
            event.ref || "Unrecorded",
            event.at || "Unrecorded",
          ]),
        ),
      );
    if (!p && state.aps?.source === "prior-release")
      pane.append(
        el(
          "p",
          "This order was released in an earlier workshop. Its original schedule was not recorded.",
        ),
      );
    if (p && !flags.aps.ok)
      pane.append(el("p", "Schedule requires review: " + flags.aps.why));
    const pathRows = stages.map(([id, name]) => {
      const stage = rec.operations.find((o) => o.stage === id);
      const observations = rec.samples.filter(
        (s) => s.stageId === id || s.stage === name || s.stage === id,
      );
      const last = observations.at(-1);
      const ts = last?.ts == null ? NaN : new Date(last.ts).getTime();
      const stamp = Number.isFinite(ts)
        ? new Date(ts).toISOString()
        : "Time unrecorded";
      return [
        name,
        stage?.id || "Awaiting event",
        kg(stage?.inputKg),
        kg(stage?.addedKg),
        kg(stage?.removedKg),
        kg(stage?.outputKg),
        String(observations.length),
        last
          ? last.command +
            " · " +
            last.progress +
            "% · " +
            kg(last.kg ?? last.mass) +
            " · " +
            (last.quality || "Quality unrecorded") +
            " · " +
            stamp
          : "No sample",
      ];
    });
    pane.append(
      grid(
        "Ten-operation material trace and historian evidence",
        [
          "Operation",
          "Event",
          "Input",
          "Added",
          "Removed",
          "Output",
          "Samples",
          "Latest observed state",
        ],
        pathRows,
      ),
    );
    pane.append(
      el(
        "p",
        "Historian mass records the value available at the sample instant. The stage ledger records the booked output after the operation completes.",
      ),
    );
    const moves = rec.moves.map((m) => [
      m.id,
      m.code,
      m.material,
      kg(m.qty),
      m.direction,
      m.posted ? "Posted" : "Queued",
    ]);
    pane.append(
      grid(
        "Material movements for this order and batch",
        [
          "Event ID",
          "Movement",
          "Material",
          "Quantity",
          "Direction",
          "SAP state",
        ],
        moves,
      ),
    );
    if (!moves.length)
      pane.append(
        el(
          "p",
          "The first incoming raw-lot receipt will appear here when posted to the local movement ledger.",
        ),
      );
    const controls = el("section", undefined, "bj-box");
    controls.append(
      el("h3", "Interface outage and replay"),
      el(
        "p",
        "Pause posting before the next production event. Book the operation on the plant floor, return here to inspect the queue, then reconnect and replay twice. Compare the event IDs and posted quantities after each replay.",
      ),
    );
    const pending = flags.queued,
      online = rec.ledger.online !== false;
    controls.append(
      el(
        "strong",
        (online ? "Online" : "Offline") +
          " · " +
          pending +
          " queued · " +
          (rec.moves.length - pending) +
          " posted",
      ),
    );
    const buttons = el("div", undefined, "bj-buttons");
    function rerender(message) {
      if (!pane.isConnected) return;
      trace(root, state, ctx);
      const report = root.querySelector(".bj-operation");
      if (report) report.textContent = message;
    }
    buttons.append(
      button(
        online ? "Take interface offline" : "Restore interface",
        () => {
          const result = ctx.setOnline(!online);
          if (result?.ok === false) {
            rerender(result.why);
            return;
          }
          rerender(
            state.ledger.online === false
              ? "Interface offline. New model movements will queue."
              : "Interface online. Inspect pending events before replay.",
          );
        },
        ctx.readonly || typeof ctx.setOnline !== "function",
      ),
    );
    buttons.append(
      button(
        "Replay queued events",
        () => {
          const before = rec.moves.map((m) => m.id),
            posted = rec.moves.filter((m) => m.posted).length;
          const result = ctx.replay();
          if (result?.ok === false) {
            rerender(result.why);
            return;
          }
          const after = selectedRecords(state).moves;
          const changed = after.filter((m) => m.posted).length - posted;
          const same =
            before.length === after.length &&
            after.every((m, i) => m.id === before[i]);
          rerender(
            changed +
              " additional movement(s) posted. " +
              (same
                ? "The event IDs and movement count are unchanged."
                : "The set or order of movement IDs changed; inspect the ledger."),
          );
        },
        ctx.readonly || !online || typeof ctx.replay !== "function",
      ),
    );
    buttons.append(link("Detailed material ledger", "business", ctx));
    const report = el("p", "", "bj-operation");
    report.setAttribute("role", "status");
    controls.append(buttons, report);
    pane.append(controls);
    challenge(pane, rec.moves);
    const factsLink = el("details");
    factsLink.append(el("summary", "Workflow references and simulation scope"));
    const info = el(
      "p",
      "This exercise joins receiving, scheduling, control, history and enterprise postings in browser state. The deployed combination, interfaces and configuration at Dooen remain unverified.",
    );
    const sources = el("ul");
    for (const [name, url] of [
      [
        "Brighteye Momentum application modules",
        "https://www.brighteye.be/momentum-modules",
      ],
      [
        "DSR APS 4FACTORY production planning",
        "https://www.dsr.com.pl/planowanie-produkcji-aps/",
      ],
      [
        "SAP Learning production orders",
        "https://learning.sap.com/courses/executing-basic-erp-processes-with-sap-s-4hana/processing-production-orders",
      ],
    ]) {
      const li = el("li");
      li.append(source(name, url));
      sources.append(li);
    }
    factsLink.append(info, sources);
    pane.append(factsLink);
    root.replaceChildren(pane);
  }
  window.BatchJourney = { guide, trace };
})();
