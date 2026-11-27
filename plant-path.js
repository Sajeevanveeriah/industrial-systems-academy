(() => {
  "use strict";
  function node(tag, text, css) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (css) el.className = css;
    return el;
  }
  function link(text, href) {
    const el = node("a", text);
    el.href = href;
    return el;
  }
  const subsystem = {
    rack: [
      "Fit the servers and power equipment",
      "Select a device from the tray, inspect its height and fit it at the lowest free rack unit shown on its schedule. Fit both hosts, the switch and UPS.",
      "Compare the elevation to the schedule. Try an occupied slot and check that the original device stays in place.",
      "rack",
    ],
    patch: [
      "Wire the cabinet",
      "Switch to the rear view. Select a device socket, then its partner on the drawing. Follow the power path first, then patch host networking and PLC inputs and outputs.",
      "The eleven connections must agree with the port schedule. A connected cable can still be on the wrong port.",
      "rack",
    ],
    host: [
      "Install the host software and guests",
      "Install a hypervisor on each fitted host, configure the virtual switch and VLAN, then provision the guests at their assigned addresses.",
      "Check guest placement and unique IP addresses against the deployment schedule.",
      "controls",
    ],
    roles: [
      "Install the application services",
      "Choose an application package and its target VM, install it and bind the service to its upstream data source.",
      "An installed package and a working service binding are separate checks. Verify both for each application.",
      "controls",
    ],
    plc: [
      "Fit and program the controller",
      "Fit the CPU and I/O cards in the assigned slots and set the controller address. Write the enable condition and the transition for each operation, then compile and exercise the program.",
      "Test an open process permissive before a healthy start. A stage must lead to the next approved MES operation.",
      "controls",
    ],
    scada: [
      "Commission the SCADA tags and historian",
      "For each tag, choose the data source, quality alias, engineering unit and gain. Set the alarm and collection policies; test healthy, stale and tripped samples.",
      "Confirm that scaled values are correct, bad data raises the expected alarm and history stores changed good-quality samples.",
      "controls",
    ],
    hmi: [
      "Build the operator screen",
      "Name the screen and add widgets for batch, stage, mass, progress, running state, alarm and stock. Bind each widget to a compatible commissioned tag.",
      "On the running plant floor, compare the screen's batch ID and mass with MES. Interrupt the tag feed and inspect the quality displayed.",
      "controls",
    ],
    mes: [
      "Configure production execution",
      "Enter the recipe identifier and append the ten operations in material-flow order. Compare your route with the installed PLC transitions.",
      "The route starts at receiving and ends at dispatch, with every processing step present once.",
      "systems",
    ],
    erp: [
      "Map the SAP adapter",
      "Map consumption, finished receipt, yield and scrap fields. Choose the individual event ID as the unique posting key.",
      "Pause the interface on a training run, restore it and replay queued events twice. The second replay must leave stock unchanged.",
      "systems",
    ],
  };
  const business = [
    "Release the order and receive potatoes",
    "Specify the finished product, planned yield and destination. Release the order, enter the supplier lot and receive enough potatoes for the batch charge.",
    "Trace the raw receipt and production issue by batch ID. After packing and dispatch, compare physical quantities with posted SAP movements.",
    "systems",
  ];
  const genealogy = [
    "Verify the finished batch",
    "Follow the same lot and order through every stage. Expand the recorded recipes and compare each input plus additions with output plus removals.",
    "The packed quantity must match dispatch. Resolve queued SAP movements before handing over or starting a further batch.",
    "process",
  ];
  function context(root, view, detail, index) {
    root.replaceChildren();
    let row = null,
      worked = "";
    if (view === "rack") row = subsystem.rack;
    if (view === "installation") row = subsystem[detail] || subsystem.rack;
    if (view === "business") row = business;
    if (view === "history") row = genealogy;
    if (view === "floor") {
      const s = FryProcess.stages[index];
      if (!s) return;
      row = [
        s.name + " commissioning",
        s.setup,
        "Mount the " +
          s.machine +
          ", connect " +
          s.sensor +
          " and " +
          s.actuator +
          ", then prove fault recovery. " +
          s.outcome,
        "process",
      ];
      worked =
        s.parameter +
        " = " +
        s.target +
        " " +
        s.unit +
        " in the worked recipe.";
    }
    if (!row) return;
    const box = node("aside", undefined, "path-instruction");
    box.append(node("strong", "Step guide · " + row[0]), node("p", row[1]));
    const more = node("details");
    more.append(node("summary", "How to verify this step"), node("p", row[2]));
    if (worked) more.append(node("p", worked));
    more.append(link("Open the complete guide →", "#guide/" + row[3]));
    box.append(more);
    root.append(box);
  }
  function mount(root, state, detail, services) {
    root.replaceChildren();
    root.append(
      node("h2", "Plant build guide"),
      node(
        "p",
        "Use the next action to continue your project. The chapters below explain how to build, check and troubleshoot each part.",
      ),
    );
    const card = node("section", undefined, "path-progress");
    const rows = [];
    function add(title, ok, why, url) {
      rows.push({ title, ok, why, url });
    }
    const site = SiteBuild.check(state.site);
    add("Build and accept the site", site.ok, site.why, "#site");
    for (const c of FryInstall.check(state.installation))
      add(
        subsystem[c.id]?.[0] || c.label,
        c.ok,
        c.why,
        ["rack", "patch"].includes(c.id) ? "#rack" : "#installation/" + c.id,
      );
    for (const [title, url, test] of [
      [
        "Receive, clear and put away the potato lot in Momentum",
        "#momentum",
        BatchMomentum.ready(state),
      ],
      ["Schedule and release the order in APS", "#aps", BatchAPS.ready(state)],
    ])
      add(title, test.ok, test.why, url);
    for (const [i, s] of FryProcess.stages.entries()) {
      const recorded = state.events.some((e) => e.index === i);
      const checked = FryProcess.check(i, state.configs[i]);
      add(
        "Commission and operate " + s.name,
        recorded,
        recorded
          ? "Stage result recorded."
          : checked.ok
            ? "Station ready. Run the operation and release the batch."
            : checked.why,
        "#floor/" + s.id,
      );
    }
    const queued = FryLedger.summary(state).queued;
    add(
      "Reconcile the dispatch",
      state.events.length === 10 && !queued,
      queued
        ? queued + " postings await SAP acknowledgement."
        : "Compare the finished weight and posting history.",
      "#sap",
    );
    const next = rows.find((r) => !r.ok);
    card.append(node("h3", next ? "Next action" : "Project complete"));
    if (next)
      card.append(link(next.title + " →", next.url), node("p", next.why));
    else card.append(link("Inspect the dispatched batch →", "#history"));
    const details = node("details");
    details.append(
      node(
        "summary",
        "Project checklist · " +
          rows.filter((r) => r.ok).length +
          " of " +
          rows.length +
          " complete",
      ),
    );
    const list = node("ol");
    for (const r of rows) {
      const li = node("li");
      li.append(
        link(r.title, r.url),
        node("small", r.ok ? "Complete" : "Pending"),
      );
      list.append(li);
    }
    details.append(list);
    card.append(details);
    root.append(card);
    if (services) {
      const handover = node("section", undefined, "path-instruction");
      handover.append(
        node("strong", "Facility services handover"),
        node("p", services.why),
        link("Open the four area checks →", "#facility"),
      );
      root.append(handover);
    }
    const guide = node("section");
    root.append(guide);
    const chapter = [
      "plot",
      "buildings",
      "utilities",
      "acceptance",
      "rack",
      "controls",
      "systems",
      "process",
    ].includes(detail)
      ? detail
      : "plot";
    SiteGuide.mount(guide, chapter);
  }
  window.PlantPath = { mount, context };
})();
