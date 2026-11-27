(() => {
  "use strict";

  const references = {
    line: [
      "Heat and Control · French fry processing equipment",
      "https://www.heatandcontrol.com/solutions/french-fries-potato-co-products",
    ],
    fryer: [
      "Heat and Control · continuous French fry fryer",
      "https://www.heatandcontrol.com/model/french-fry-fryer",
    ],
    freezer: [
      "JBT Frigoscandia · fluidised-bed IQF freezer",
      "https://www.jbtc.com/foodtech/wp-content/uploads/sites/2/2022/11/JBT_FLoFREEZE_2022.pdf",
    ],
    pack: [
      "Ishida · weighing frozen produce",
      "https://www.ishidaeurope.com/en/about-us/case-studies-and-events/case-studies/pinguin-speed-accuracy-reliability-and-flexibility-ishida-weighers-tick-all-the-boxes-for-frozen-vegetable-packing/",
    ],
    dispatch: [
      "GS1 · logistics labels and unit identity",
      "https://ref.gs1.org/guidelines/logistic-label/",
    ],
  };
  const stages = [
    {
      id: "receive",
      name: "Receiving",
      machine: "Metering hopper and weigh belt",
      material: "Metered raw potatoes",
      parameter: "Feed rate",
      unit: "kg/min",
      target: 100,
      min: 90,
      max: 110,
      sensor: "AI01 · belt scale load",
      actuator: "AO01 · feeder speed demand",
      setup:
        "Use belt load and measured speed to calculate mass flow. Record the supplier lot against the incoming batch before the hopper feeds the washer.",
      reason:
        "A stable incoming rate keeps the washer fed without overflowing its inlet.",
      fault: "Belt scale quality lost",
      recovery: "Restore load-cell signal and verify zero",
      test: "A missing weight signal must hold the feeder. Check that the lot identity and last valid mass record survive the hold.",
      outcome: "Matched lot ID and feed rate within the training window.",
      balance:
        "Whole potatoes cross the receiving scale. The model records no product loss here.",
      reference: "line",
    },
    {
      id: "wash",
      name: "Washing",
      machine: "Rotary washer and stone separator",
      material: "Washed whole potatoes",
      parameter: "Wash-water flow",
      unit: "L/min",
      target: 80,
      min: 72,
      max: 88,
      sensor: "AI02 · wash flow transmitter",
      actuator: "AO02 · wash pump speed",
      setup:
        "Map the recirculation flow transmitter into engineering units and send the flow loop output to the wash pump. The separator removes entrained stones and soil.",
      reason:
        "Flow supplies washing action and carries loose soil to the separation stream.",
      fault: "Wash flow missing",
      recovery: "Restore flow feedback and confirm circulation",
      test: "Hold upstream feed when flow feedback is missing. Check the circulation indication before releasing material.",
      outcome: "Clean potato stream with debris counted separately.",
      balance:
        "The soil and stones branch leaves the wet washing system separately. Recirculated water stays outside this product-mass boundary.",
      reference: "line",
    },
    {
      id: "peel",
      name: "Peeling",
      machine: "Batch steam peeler and skin remover",
      material: "Peeled potatoes",
      parameter: "Model exposure timer",
      unit: "s",
      target: 16,
      min: 14,
      max: 18,
      sensor: "DI03 · vessel cycle complete",
      actuator: "DO03 · batch sequencer request",
      setup:
        "Send one sequence request per batch and wait for the equipment controller’s completion signal before transfer. The local machine controller owns the vessel sequence.",
      reason:
        "The model couples exposure time to peel removal. Extending the cycle increases simulated trim loss.",
      fault: "Cycle completion absent",
      recovery: "Confirm completed batch and restore handshake",
      test: "Hold discharge until the completed-batch acknowledgement matches the outstanding request. Keep the batch ID open during the hold.",
      outcome: "A completed batch and a separate peel-loss record.",
      balance: "The skin-removal branch collects loosened peel and trim.",
      reference: "line",
    },
    {
      id: "cut",
      name: "Cutting",
      machine: "Hydraulic strip cutter and sliver sorter",
      material: "Graded raw strips",
      parameter: "Installed cutter pitch",
      unit: "mm",
      target: 10,
      min: 10,
      max: 10,
      sensor: "AI04 · cutter feed flow",
      actuator: "DO04 · product feed enable",
      setup:
        "Record the installed cutter-grid size in the recipe. The controller checks the grid against the product assignment, then enables the hydraulic feed when flow proof is valid.",
      reason:
        "This order calls for a 10 mm strip grid. Editing the recipe records a physical setup choice and cannot change the grid in metal.",
      fault: "Feed-flow proof lost",
      recovery: "Re-establish feed-flow proof",
      test: "Stop accepting potatoes into the cutting stream while flow proof is missing. Recover the proof before requesting feed.",
      outcome:
        "10 mm grid assigned and fines diverted from the accepted strips.",
      balance: "A separate grading branch captures slivers and off-cuts.",
      reference: "line",
    },
    {
      id: "blanch",
      name: "Blanching",
      machine: "Continuous water blancher",
      material: "Blanched strips",
      parameter: "Model residence time",
      unit: "s",
      target: 90,
      min: 84,
      max: 96,
      sensor: "AI05 · blancher belt encoder",
      actuator: "AO05 · blancher conveyor speed",
      setup:
        "Bind the wash-through belt speed reference and encoder. Convert residence time into belt speed using effective travel length divided by target time. This exercise holds bath conditions fixed.",
      reason:
        "The residence timer determines exposure in the model. Compare measured travel time with the order recipe.",
      fault: "Belt encoder stale",
      recovery: "Restore encoder and verify travel time",
      test: "Pause transfer on stale speed feedback. Time a simulated marker across the belt after recovery.",
      outcome:
        "Verified residence time with water pickup and solids loss separately accounted.",
      balance:
        "The material model includes absorbed water and soluble solids removed in blanch water.",
      reference: "line",
    },
    {
      id: "dry",
      name: "Drying",
      machine: "Through-air belt dryer",
      material: "Surface-dried strips",
      parameter: "Model mass reduction",
      unit: "%",
      target: 6,
      min: 5,
      max: 7,
      sensor: "AI06 · outlet belt scale",
      actuator: "AO06 · circulation fan demand",
      setup:
        "Reconcile inlet and outlet belt masses for the same batch interval. Adjust the fan demand in this model to reach the recipe mass-reduction target.",
      reason:
        "Removing surface water reduces the water load entering the fryer. A mass change alone cannot identify the product’s absolute moisture content.",
      fault: "Outlet scale signal invalid",
      recovery: "Restore outlet scale and match both batch intervals",
      test: "Hold transfer when inlet and outlet masses cannot be compared over a common batch window.",
      outcome:
        "Measured model mass reduction inside the agreed training window.",
      balance: "Water removed by the dryer exits as vapour.",
      reference: "line",
    },
    {
      id: "fry",
      name: "Par-frying",
      machine: "Continuous fryer and oil filter",
      material: "Par-fried strips",
      parameter: "Model belt residence",
      unit: "s",
      target: 45,
      min: 42,
      max: 48,
      sensor: "AI07 · fryer conveyor encoder",
      actuator: "AO07 · fryer belt speed demand",
      setup:
        "Use encoder feedback to verify time through the simulated oil bath. Separate the strip-conveyor speed loop from the oil circulation and filtration subsystems.",
      reason:
        "Residence changes the simulated balance of moisture evaporation and absorbed oil. This exercise does not specify an oil temperature or food release criterion.",
      fault: "Oil circulation permissive lost",
      recovery: "Restore circulation proof before feed",
      test: "The feed is held when the equipment reports unavailable circulation. The simulated permissive must return healthy before production resumes.",
      outcome: "Water loss and oil addition posted separately for the batch.",
      balance:
        "The oil circuit recirculates. Only absorbed oil enters the product ledger; evaporated water leaves it.",
      reference: "fryer",
    },
    {
      id: "freeze",
      name: "Freezing",
      machine: "Fluidised-bed belt freezer",
      material: "Frozen loose fries",
      parameter: "Model cold-zone residence",
      unit: "min",
      target: 12,
      min: 11,
      max: 13,
      sensor: "AI08 · freezer return-air temperature",
      actuator: "AO08 · freezer belt speed demand",
      setup:
        "Trend return-air temperature and command the belt speed for the simulated residence. Verify independent product measurements during actual qualification.",
      reason:
        "Time in the model cold zone changes the predicted product condition. A return-air sensor measures the air at its location.",
      fault: "Return-air sample stale",
      recovery: "Restore fresh air measurement and confirm zone readiness",
      test: "A retained numerical value is insufficient after communications loss. Require fresh quality and time before releasing the batch.",
      outcome: "Valid cold-zone reading and complete model residence interval.",
      balance:
        "Freezing changes product condition; this simplified freezer assumes no product mass change.",
      reference: "freezer",
    },
    {
      id: "pack",
      name: "Packing",
      machine: "Multihead weigher and bagger",
      material: "Sealed bags of fries",
      parameter: "Net bag target",
      unit: "g",
      target: 1000,
      min: 1000,
      max: 1000,
      sensor: "AI09 · checkweigher net weight",
      actuator: "DO09 · bag discharge request",
      setup:
        "Match the multihead target and post-fill check to the order’s net bag size. Keep packaging tare separate from product net mass. Each accepted discharge keeps its batch identity.",
      reason:
        "The example order requires 1,000 g bags. A partial bag stays as loose carryover outside the packed lot.",
      fault: "Checkweigher signal invalid",
      recovery: "Restore checkweight and verify a reference pack",
      test: "Hold release without valid net weight. Verify the reference pack before accepting another bag.",
      outcome:
        "Complete bags reconciled against bulk input and loose carryover.",
      balance: "Packaging film is outside the net-food mass balance.",
      reference: "pack",
    },
    {
      id: "dispatch",
      name: "Dispatch",
      machine: "Pallet transfer and dock scanner",
      material: "Dispatched palletised bags",
      parameter: "Dock lane assignment",
      unit: "lane",
      target: 2,
      min: 2,
      max: 2,
      sensor: "DI10 · pallet ID scan valid",
      actuator: "DO10 · dock transfer release",
      setup:
        "Link the scanned logistics unit to order, lot and dock lane. Bind the transfer release to a verified identity and a confirmed destination.",
      reason:
        "This training shipment is allocated to lane 2. A valid scan for another lane cannot release this order.",
      fault: "Pallet identity unreadable",
      recovery: "Rescan the matching pallet and confirm dock lane",
      test: "Keep the load in staging while its identity is unknown. Reconcile the order and pallet before authorising a dock transfer.",
      outcome:
        "A matched shipment and one dispatch entry for the finished lot.",
      balance:
        "No net product mass changes at dispatch. The movement changes inventory location and shipment status.",
      reference: "dispatch",
    },
  ];

  function emptyStage() {
    return {
      machine: "",
      sensor: "",
      actuator: "",
      setpoint: "",
      faultState: "untested",
    };
  }

  function solvedStage(index) {
    const s = stages[index];
    return {
      machine: s.machine,
      sensor: s.sensor,
      actuator: s.actuator,
      setpoint: s.target,
      faultState: "proved",
    };
  }

  function isInstalled(index, config) {
    return Boolean(stages[index] && config?.machine === stages[index].machine);
  }

  function fieldIssue(index, config) {
    const s = stages[index];
    if (!s || !config) return "Select a valid station.";
    if (!isInstalled(index, config)) return "Fit the " + s.machine + ".";
    if (config.sensor !== s.sensor) return "Connect input " + s.sensor + ".";
    if (config.actuator !== s.actuator)
      return "Connect output " + s.actuator + ".";
    const raw = config.setpoint;
    const number = Number(raw);
    if (
      (typeof raw !== "number" && typeof raw !== "string") ||
      String(raw).trim() === "" ||
      !Number.isFinite(number) ||
      number < s.min ||
      number > s.max
    ) {
      const range = s.min === s.max ? s.target : s.min + " to " + s.max;
      return (
        "Set " + s.parameter.toLowerCase() + " to " + range + " " + s.unit + "."
      );
    }
    return "";
  }

  function check(index, config) {
    const issue = fieldIssue(index, config);
    if (issue) return { ok: false, why: issue };
    if (config.faultState === "tripped")
      return {
        ok: false,
        why: "Fault hold active. Select the recovery action and verify the station.",
      };
    if (config.faultState !== "proved")
      return {
        ok: false,
        why: "Exercise the simulated fault, then verify recovery.",
      };
    return { ok: true, why: stages[index].outcome };
  }

  function operate(index, config, inputKg) {
    const verdict = check(index, config);
    if (!verdict.ok) throw new Error(verdict.why);
    if (
      typeof inputKg !== "number" ||
      !Number.isFinite(inputKg) ||
      inputKg < 0 ||
      !Number.isSafeInteger(Math.round(inputKg * 1000))
    ) {
      throw new RangeError(
        "Supply a finite non-negative batch mass in kg within gram resolution.",
      );
    }
    const s = stages[index];
    const inputG = Math.round(inputKg * 1000);
    const setpoint = Number(config.setpoint);
    let addedG = 0,
      removedG = 0,
      detail = "";
    switch (s.id) {
      case "receive":
        detail =
          "At " +
          setpoint +
          " kg/min the model feeds this batch in " +
          (inputKg / setpoint).toFixed(2) +
          " min.";
        break;
      case "wash":
        removedG = Math.round(inputG * 0.02);
        break;
      case "peel":
        removedG = Math.round(inputG * (0.06 + 0.002 * (setpoint - 16)));
        break;
      case "cut":
        removedG = Math.round(inputG * 0.035);
        break;
      case "blanch":
        addedG = Math.round((inputG * 0.015 * setpoint) / 90);
        removedG = Math.round(inputG * 0.008);
        break;
      case "dry":
        removedG = Math.round((inputG * setpoint) / 100);
        break;
      case "fry":
        addedG = Math.round((inputG * 0.045 * setpoint) / 45);
        removedG = Math.round((inputG * 0.16 * setpoint) / 45);
        break;
      case "pack": {
        const bags = Math.floor(inputG / setpoint);
        removedG = inputG - bags * setpoint;
        detail =
          bags +
          " complete bags at " +
          setpoint +
          " g; " +
          (removedG / 1000).toFixed(3) +
          " kg returns to the loose-product buffer.";
        break;
      }
    }
    return {
      outputKg: (inputG + addedG - removedG) / 1000,
      addedKg: addedG / 1000,
      removedKg: removedG / 1000,
      note: [s.balance, detail].filter(Boolean).join(" "),
    };
  }

  function element(tag, text) {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    return item;
  }

  function selectField(title, values, initial) {
    const label = element("label", title);
    const select = element("select");
    select.setAttribute("aria-label", title);
    select.append(new Option("Choose…", ""));
    for (const value of values) select.append(new Option(value, value));
    select.value = initial || "";
    label.append(select);
    return { label, select };
  }

  function action(title, click) {
    const button = element("button", title);
    button.type = "button";
    button.addEventListener("click", click);
    return button;
  }

  function terminals(index, kind) {
    const bay = String(index + 1).padStart(2, "0");
    const [channel, description] = stages[index][kind].split(" · ");
    return {
      device:
        "JB" +
        bay +
        ":" +
        (kind === "sensor" ? "S1" : "A1") +
        " · " +
        description,
      plc: "PLC-01:" + channel,
      type: {
        AI: "analogue input",
        DI: "digital input",
        AO: "analogue output",
        DO: "digital output",
      }[channel.slice(0, 2)],
    };
  }

  function mount(root, index, config, onChange) {
    const s = stages[index];
    const panel = element("section");
    panel.className = "fry-stage-bench";
    const style = element(
      "style",
      `
      .fry-stage-bench{color:#20372f;background:#f8faf5;border:1px solid #bfcec2;border-radius:.7rem;padding:clamp(.8rem,2vw,1.4rem);min-width:0}
      .fry-stage-bench h3,.fry-stage-bench h4{color:#173d2d;margin:.25rem 0 .6rem}.fry-stage-bench p{color:#374d42;line-height:1.5;margin:.55rem 0}
      .fry-stage-bench .fp-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,13rem),1fr));gap:.65rem;margin:.7rem 0}
      .fry-stage-bench label{display:grid;gap:.25rem;align-content:end;font-size:.93rem;font-weight:650;color:#244837}
      .fry-stage-bench input,.fry-stage-bench select,.fry-stage-bench button{font:inherit;color:#193728;border:1px solid #769581;background:white;border-radius:.35rem;padding:.48rem;max-width:100%;min-width:0}
      .fry-stage-bench button{cursor:pointer;background:#e9f2df;font-weight:650;margin-right:.4rem}.fry-stage-bench button:disabled{opacity:.58;cursor:default}.fry-stage-bench :focus-visible{outline:3px solid #345fbb;outline-offset:2px}
      .fry-stage-bench details{margin:.65rem 0}.fry-stage-bench summary{font-weight:650;cursor:pointer}.fry-stage-bench .fp-test{margin:1rem 0 .5rem;padding:.7rem;border-left:3px solid #6e9778;background:#eef3ea}
      .fry-stage-bench .fp-state{font-weight:650;min-height:1.5em}.fry-stage-bench a{color:#145c43;text-decoration:underline}.fry-stage-bench small{display:block;color:#435b4d}
    `,
    );
    style.textContent += `
      .fp-install{background:#eff4ec;border:1px solid #bacdbd;border-radius:.55rem;padding:.8rem;margin:.8rem 0}
      .fp-bay{border:2px dashed #8b9d8e;padding:.6rem;border-radius:.4rem}.fp-bay[data-mounted=true]{border-style:solid;background:#d4eacb}
      .fp-actions{display:flex;align-items:center;flex-wrap:wrap;gap:.4rem;margin:.4rem 0}.fp-cable{padding:.7rem;border:1px solid #bdcdbf;border-radius:.4rem;background:white;min-width:0}.fp-cable[data-connected=true]{border-color:#598755;background:#f2faeb}
      .fp-cable label{margin:.5rem 0}.fp-route{font:600 .86rem/1.5 Consolas,monospace;overflow-wrap:anywhere}.fp-install .fp-fields{align-items:stretch}
    `;
    const intro = element("p", s.setup);
    const spec = element(
      "p",
      "Recipe objective: " + s.target + " " + s.unit + ". " + s.reason,
    );
    const fields = element("div");
    fields.className = "fp-fields";
    const status = element("p");
    status.className = "fp-state";
    status.setAttribute("role", "status");
    const trip = element("button", "Inject station fault");
    trip.type = "button";
    const recover = element("button", "Verify recovery");
    recover.type = "button";
    const recoveryLabel = element("label", "Recovery action");
    const recovery = element("select");
    recovery.setAttribute("aria-label", "Recovery action");
    for (const v of [
      "",
      s.recovery,
      "Acknowledge the alarm only",
      "Discard the batch record",
    ]) {
      const choice = element("option", v || "Select an action");
      choice.value = v;
      recovery.append(choice);
    }
    recoveryLabel.append(recovery);
    let feedback = "";
    function update() {
      const issue = fieldIssue(index, config);
      trip.disabled = Boolean(issue) || config.faultState === "tripped";
      recovery.disabled = config.faultState !== "tripped";
      recover.disabled = recovery.disabled;
      status.textContent = feedback || check(index, config).why;
      refreshRig();
    }
    function mutated() {
      update();
      if (typeof onChange === "function") onChange(config);
    }
    function change(key, value) {
      config[key] = value;
      config.faultState = "untested";
      feedback = "";
      recovery.value = "";
      mutated();
    }
    const neighbours = [
      index,
      (index + 1) % stages.length,
      (index + 4) % stages.length,
    ];
    const hardware = element("section");
    hardware.className = "fp-install";
    const bay = element("p");
    bay.className = "fp-bay";
    const inventory = selectField(
      "Equipment inventory",
      neighbours.map((i) => stages[i].machine).sort(),
      config.machine,
    );
    const mountMachine = action("Mount selected machine", () => {
      if (inventory.select.value !== s.machine) {
        feedback =
          "Mount refused. Select the machine assigned to this process bay.";
        update();
        return;
      }
      change("machine", s.machine);
    });
    const unmount = action("Unmount machine", () => {
      if (config.sensor || config.actuator) {
        feedback =
          "Disconnect both signal paths before unmounting the machine.";
        update();
        return;
      }
      inventory.select.value = "";
      change("machine", "");
    });
    const inventoryActions = element("div");
    inventoryActions.className = "fp-actions";
    inventoryActions.append(mountMachine, unmount);
    hardware.append(
      element("h4", "Mount the equipment"),
      element(
        "p",
        "Select the " + s.machine + " from inventory and mount it in this bay.",
      ),
      bay,
      inventory.label,
      inventoryActions,
    );
    const cables = element("div");
    cables.className = "fp-fields";
    const cableUpdates = [];
    for (const kind of ["sensor", "actuator"]) {
      const sensor = kind === "sensor";
      const ends = terminals(index, kind);
      const wired = () => config[kind] === s[kind];
      const candidates = neighbours.map((i) => terminals(i, kind));
      const device = selectField(
        sensor ? "Sensor device socket" : "Actuator device socket",
        candidates.map((t) => t.device).sort(),
        wired() ? ends.device : "",
      );
      const port = selectField(
        sensor ? "PLC input terminal" : "PLC output terminal",
        candidates.map((t) => t.plc).sort(),
        wired() ? ends.plc : "",
      );
      const card = element("div");
      card.className = "fp-cable";
      const trace = element("p");
      trace.className = "fp-route";
      const from = sensor ? ends.device : ends.plc;
      const to = sensor ? ends.plc : ends.device;
      const connect = action("Connect " + kind + " cable", () => {
        if (!isInstalled(index, config)) return;
        if (
          device.select.value !== ends.device ||
          port.select.value !== ends.plc
        ) {
          feedback =
            "Connection refused. Match the " +
            ends.type +
            " path from " +
            from +
            " to " +
            to +
            ".";
          update();
          return;
        }
        change(kind, s[kind]);
      });
      const disconnect = action("Disconnect " + kind + " cable", () => {
        device.select.value = "";
        port.select.value = "";
        change(kind, "");
      });
      const actions = element("div");
      actions.className = "fp-actions";
      actions.append(connect, disconnect);
      card.append(
        element(
          "h4",
          sensor ? "Sensor to PLC input" : "PLC output to actuator",
        ),
        element("small", ends.type + " signal path"),
        trace,
      );
      card.append(
        ...(sensor ? [device.label, port.label] : [port.label, device.label]),
        actions,
      );
      cables.append(card);
      cableUpdates.push((installed) => {
        trace.textContent =
          (wired() ? "Connected: " : "Drawing: ") + from + " → " + to;
        card.dataset.connected = String(wired());
        device.select.disabled = port.select.disabled = !installed || wired();
        connect.disabled = !installed || wired();
        disconnect.disabled = !wired();
      });
    }
    hardware.append(cables);
    function refreshRig() {
      const installed = isInstalled(index, config);
      bay.textContent = installed
        ? "Mounted in bay: " + s.machine
        : "Bay empty";
      bay.dataset.mounted = String(installed);
      inventory.select.disabled = installed;
      mountMachine.disabled = installed;
      unmount.disabled = !installed;
      for (const updateCable of cableUpdates) updateCable(installed);
    }
    const setLabel = element("label", s.parameter + " (" + s.unit + ")");
    const number = element("input");
    number.type = "number";
    number.step = "any";
    number.value = config.setpoint ?? "";
    number.addEventListener("change", () => change("setpoint", number.value));
    setLabel.append(number);
    fields.append(setLabel);
    const assist = element("details");
    assist.append(
      element("summary", "Station drawing and I/O schedule"),
      element(
        "p",
        "Machine: " +
          s.machine +
          ". Input: " +
          s.sensor +
          ". Output: " +
          s.actuator +
          ".",
      ),
      element("p", "Acceptance: " + s.outcome + " " + s.balance),
    );
    const test = element("div");
    test.className = "fp-test";
    test.append(
      element("h4", s.fault),
      element("p", s.test),
      trip,
      recoveryLabel,
      recover,
    );
    trip.addEventListener("click", () => {
      if (fieldIssue(index, config)) return;
      config.faultState = "tripped";
      feedback = "Fault injected: " + s.fault + ". Material transfer is held.";
      recovery.value = "";
      mutated();
    });
    recover.addEventListener("click", () => {
      if (config.faultState !== "tripped") return;
      if (recovery.value !== s.recovery) {
        feedback =
          "Hold remains active. Restore the missing evidence before accepting recovery.";
        update();
        return;
      }
      config.faultState = "proved";
      feedback = "Recovery passed. " + s.outcome;
      mutated();
    });
    const [name, href] = references[s.reference];
    const ref = element("a", name);
    ref.href = href;
    const source = element("small", "Equipment reference: ");
    source.append(ref, ". Read 27 November 2026.");
    const disclaimer = element(
      "small",
      "All recipe windows, yield coefficients and test readings are fictional classroom values. Use approved product and food-safety specifications when working with real equipment.",
    );
    panel.append(
      element("h3", s.name + " commissioning"),
      intro,
      assist,
      hardware,
      element("h4", "Set the recipe"),
      spec,
      fields,
      test,
      status,
      disclaimer,
      source,
    );
    root.replaceChildren(style, panel);
    update();
  }

  window.FryProcess = {
    stages,
    emptyStage,
    solvedStage,
    isInstalled,
    check,
    operate,
    mount,
  };
})();
