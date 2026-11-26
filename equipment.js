(() => {
  "use strict";

  const stations = [
    {
      id: "io",
      name: "Photoeye & digital I/O",
      group: "Sensing",
      parts:
        "A photoelectric sensor changes its output when an object changes the received light. The input card must accept the output type: a sourcing PNP output supplies positive voltage to a compatible sinking input; NPN acts in the opposite direction. Read the exact device diagram rather than guessing wire colours.",
      software:
        "Record the field device, connector, I/O station, channel, polarity and symbolic name. In this rig PE01 is wired to DI04 and indicates carton present when blocked. Keep electrical level distinct from the normalised business meaning.",
      measure:
        "Present and remove an opaque test carton in the simulator. Match the sensor indication, DI04 and PE01 at both states. A lit indicator alone does not verify the controller mapping.",
      chain: [
        "Carton blocks beam",
        "PE01 output",
        "DI04 input image",
        "CartonPresent",
      ],
      caseText:
        "The electrical input responds to the carton, but the PLC tag does not follow. Reconcile the channel and polarity mapping.",
      stimuli: ["Clear beam", "Block beam"],
      setting: "Symbolic input mapping",
      options: ["DI03, active high", "DI04, active low", "DI04, active high"],
      correct: 2,
      traces: [
        [
          ["DI04 = 0", "CartonPresent = 0"],
          ["DI04 = 1", "CartonPresent = 0"],
        ],
        [
          ["DI04 = 0", "CartonPresent = 1"],
          ["DI04 = 1", "CartonPresent = 0"],
        ],
        [
          ["DI04 = 0", "CartonPresent = 0"],
          ["DI04 = 1", "CartonPresent = 1"],
        ],
      ],
      explain:
        "Wrong channel: the mapped point never follows DI04. Inverted polarity: both transitions arrive but the tag states mean the reverse. Correct mapping follows both transitions.",
      source: "ifm · optical sensor data sheet",
      link: "https://media.ifm.com/dam/9a648493-2edb-4586-af00-75d2ac81df5d/Original/OPU200-01_EN-GB.pdf",
    },
    {
      id: "vfd",
      name: "Drive & conveyor",
      group: "Actuation",
      parts:
        "A variable frequency drive (VFD) controls electrical power delivered to the motor. Gear ratio and roller diameter then relate shaft motion to belt travel. A drive frequency display is not a direct belt-speed measurement.",
      software:
        "Document rated motor data from the nameplate, reference source, engineering units, acceleration profile and status feedback. This reduced model concerns reference selection only; it does not commission motor protection or a physical drive.",
      measure:
        "Compare requested and reported frequency after the simulated ramp, then check an independent belt measurement. Here 25 Hz corresponds to 0.50 m/s on a proven training rig. This conversion is not universal.",
      chain: [
        "PLC reference",
        "VFD reference source",
        "Drive output",
        "Measured belt speed",
      ],
      caseText:
        "The conveyor runs at a fixed slow speed despite changes to the PLC request. Select the reference source that reproduces both commanded operating points.",
      stimuli: ["Request 15 Hz", "Request 25 Hz"],
      setting: "Active reference",
      options: [
        "Keypad preset: 10 Hz",
        "Fieldbus reference",
        "Fieldbus, half scaling",
      ],
      correct: 1,
      traces: [
        [
          ["Drive = 10 Hz", "Belt = 0.20 m/s"],
          ["Drive = 10 Hz", "Belt = 0.20 m/s"],
        ],
        [
          ["Drive = 15 Hz", "Belt = 0.30 m/s"],
          ["Drive = 25 Hz", "Belt = 0.50 m/s"],
        ],
        [
          ["Drive = 7.5 Hz", "Belt = 0.15 m/s"],
          ["Drive = 12.5 Hz", "Belt = 0.25 m/s"],
        ],
      ],
      explain:
        "A fixed drive output suggests a local reference; a proportional half-speed error suggests scaling. A correct reference is still checked against the simulated belt measurement.",
      source: "Danfoss · Facts Worth Knowing about AC Drives",
      link: "https://assets.danfoss.com/documents/latest/242341/AV446558536912en-000101.pdf",
    },
    {
      id: "plc",
      name: "PLC & engineering project",
      group: "Control",
      parts:
        "The controller CPU executes its loaded project; an engineering workstation holds the source, symbols, hardware layout and task configuration. An edited offline project does not prove which logic is running.",
      software:
        "Map the normalised input into a cyclic task and use persistent edge history to count arrivals once. Record project revision and compare the installed build identity before attributing a behaviour to source code.",
      measure:
        "Begin with input low and count zero. Apply a sequence of sampled levels. One pulse held high for several scans must count once; two arrivals separated by low must count twice.",
      chain: ["Input image", "Cyclic task", "Edge memory", "Arrival counter"],
      caseText:
        "A held input increments the batch count repeatedly. Choose the counting instruction semantics that pass both scan traces. Each test starts with previous input low.",
      stimuli: ["Trace 0,1,1,1,0", "Trace 0,1,0,1,0"],
      setting: "Counter trigger",
      options: ["Every high scan", "Every transition", "Rising edge only"],
      correct: 2,
      traces: [
        [
          ["3 high scans", "Counter = 3"],
          ["2 high scans", "Counter = 2"],
        ],
        [
          ["2 transitions", "Counter = 2"],
          ["4 transitions", "Counter = 4"],
        ],
        [
          ["1 rising edge", "Counter = 1"],
          ["2 rising edges", "Counter = 2"],
        ],
      ],
      explain:
        "A held signal is a level, not a new physical event on each scan. Count false-to-true transitions once and preserve the previous state between task executions.",
      source: "Siemens · S7-1200 cyclic organisation blocks",
      link: "https://docs.tia.siemens.cloud/r/en-us/v21/functional-description-of-s7-1200-cpus-s7-1200/organization-blocks-s7-1200/cyclic-obs-s7-1200",
    },
    {
      id: "network",
      name: "Industrial switch & zones",
      group: "Transport",
      parts:
        "An access switch connects endpoints, an uplink carries selected traffic and a router or firewall controls routed boundaries. A port link LED only establishes a physical link.",
      software:
        "In this model the historian endpoint sends untagged frames on an access port assigned to VLAN 42. An existing tagged uplink and upstream policy permit the historian path only on VLAN 42.",
      measure:
        "Retain the port identity, negotiated link, VLAN membership and named service readback. Test the real application path, not just the edge port’s carrier state.",
      chain: [
        "Historian NIC",
        "Access port",
        "Tagged VLAN 42 uplink",
        "SCADA client read",
      ],
      caseText:
        "The link is up at both ends but no sample arrives. Test a local physical observation and then an end-to-end read.",
      stimuli: ["Inspect Ethernet carrier", "Read historian from client"],
      setting: "Port assignment",
      options: [
        "Access VLAN 24",
        "Access VLAN 42",
        "Administratively disabled",
      ],
      correct: 1,
      traces: [
        [
          ["Carrier = up", "NIC = linked"],
          ["VLAN = 24", "Sample = unreachable"],
        ],
        [
          ["Carrier = up", "NIC = linked"],
          ["VLAN = 42", "Sample = received"],
        ],
        [
          ["Carrier = down", "NIC = unlinked"],
          ["Port = disabled", "Sample = unreachable"],
        ],
      ],
      explain:
        "A working carrier cannot identify a VLAN. An incorrect access assignment places traffic in the wrong forwarding domain even when both cables are sound.",
      source: "NIST · Guide to Operational Technology Security",
      link: "https://csrc.nist.gov/pubs/sp/800/82/r3/final",
    },
    {
      id: "robot",
      name: "Robot servo & tool frame",
      group: "Motion",
      parts:
        "Servo drives close joint loops using encoder feedback. The pendant lets the operator select frames and teach poses. A joint reaching its setpoint does not prove the physical tool tip is in the right place.",
      software:
        "A tool centre point (TCP) is an offset from the flange. A work frame locates the fixture relative to the robot base. This planar translation exercise holds orientation fixed so an offset error is visible as the same displacement at both targets.",
      measure:
        "Use two model fiducials with known XY coordinates. Confirm physical tool position relative to both, not just that the robot reports motion complete. Coordinate errors here are simulated, not a procedure for moving a real robot.",
      chain: [
        "Fixture target",
        "Work-frame transform",
        "Commanded joints",
        "Tool tip at fiducial",
      ],
      caseText:
        "The fixture moved +20 mm along base X after calibration. Two fiducials are now at base X = 120 mm and 220 mm. Apply the updated fixture offset.",
      stimuli: ["Target fixture X = 100 mm", "Target fixture X = 200 mm"],
      setting: "Fixture origin in base X",
      options: ["0 mm", "−20 mm", "+20 mm"],
      correct: 2,
      traces: [
        [
          ["Command X = 100 mm", "Tip error = −20 mm"],
          ["Command X = 200 mm", "Tip error = −20 mm"],
        ],
        [
          ["Command X = 80 mm", "Tip error = −40 mm"],
          ["Command X = 180 mm", "Tip error = −40 mm"],
        ],
        [
          ["Command X = 120 mm", "Tip error = 0 mm"],
          ["Command X = 220 mm", "Tip error = 0 mm"],
        ],
      ],
      explain:
        "A common offset at two different points is consistent with a frame translation error. Changing both individual taught points would hide the wrong fixture origin.",
      source: "Universal Robots · teaching TCP position",
      link: "https://www.universal-robots.com/manuals/EN/HTML/SW5_25/Content/prod-usr-man/software/PolyScope/content/installation_g5/teaching_TCP_position.htm",
    },
    {
      id: "scada",
      name: "HMI & SCADA gateway",
      group: "Supervision",
      parts:
        "An operator panel or workstation displays tags supplied by the supervisory gateway. The visible faceplate may remain open even when its upstream device is offline.",
      software:
        "Bind value, quality and source timestamp to the same tag. Define distinct running, stopped and unknown presentations. Do not convert loss of communication into a healthy stopped indication.",
      measure:
        "Compare a valid stopped signal with a disconnected source that retains its last value. The second test must show the last-known state as stale or unknown, not as a current measurement.",
      chain: [
        "PLC run feedback",
        "Gateway tag quality",
        "HMI state binding",
        "Operator decision",
      ],
      caseText:
        "Both a stopped conveyor and a disconnected PLC appear as a green icon. Select a binding that preserves the meaning of the source.",
      stimuli: ["Good sample: stopped", "Lost link: last sample stopped"],
      setting: "Faceplate binding",
      options: [
        "Last value only",
        "Value + quality + source time",
        "Invert Boolean value",
      ],
      correct: 1,
      traces: [
        [
          ["Quality = good", "Display = stopped"],
          ["Quality = bad", "Display = stopped"],
        ],
        [
          ["Quality = good", "Display = stopped"],
          ["Quality = bad", "Display = unknown / stale"],
        ],
        [
          ["Quality = good", "Display = running"],
          ["Quality = bad", "Display = running"],
        ],
      ],
      explain:
        "Good quality and a false run bit support a current stopped indication. A frozen false bit from a bad-quality source does not.",
      source: "Inductive Automation · tag platform",
      link: "https://docs.inductiveautomation.com/docs/8.3/platform/tags",
    },
    {
      id: "history",
      name: "Historian & trend",
      group: "Time series",
      parts:
        "The historian writes selected samples to storage. A smooth chart can be a line between stored points, not a continuous record of the process.",
      software:
        "Set the observation interval to suit the shortest required event. In this bounded model acquisition and storage both use fixed periodic sampling, with no interpolation or deadband. All schedules start at t = 0.",
      measure:
        "A diagnostic pulse is high during 70 ≤ t < 90 ms. A second high window lasts from 200 to 350 ms. Verify that each window contains a stored high sample, and retain the actual timestamps.",
      chain: [
        "Source waveform",
        "Sample schedule",
        "Stored timestamp/value",
        "Trend query",
      ],
      caseText:
        "A short transfer pulse vanishes from the stored trend. Select the slowest available sampling option that actually captures both supplied traces.",
      stimuli: ["Short pulse: 70–90 ms", "Long pulse: 200–350 ms"],
      setting: "Periodic sample interval",
      options: ["100 ms", "50 ms", "20 ms"],
      correct: 2,
      traces: [
        [
          ["Samples: 0, 100 ms", "Stored high: none"],
          ["Samples: 200, 300 ms", "Stored high: 2 samples"],
        ],
        [
          ["Samples: 50, 100 ms", "Stored high: none"],
          ["Samples: 200, 250, 300 ms", "Stored high: 3 samples"],
        ],
        [
          ["Samples: 60, 80, 100 ms", "Stored high: at 80 ms"],
          ["Samples: 200 to 340 ms", "Stored high: 8 samples"],
        ],
      ],
      explain:
        "The 20 ms grid includes 80 ms; the slower grids miss this particular short pulse. Production requirements need worst-case pulse width, sample jitter and upstream acquisition to be checked as well.",
      source: "Inductive Automation · configuring tag history",
      link: "https://www.docs.inductiveautomation.com/docs/8.3/ignition-modules/tag-historian/configuring-tag-history",
    },
    {
      id: "server",
      name: "Host OS & virtual machines",
      group: "Infrastructure",
      parts:
        "A physical host supplies CPU, RAM, network adapters and storage to the hypervisor. A guest operating system hosts the application and database services. Two VMs on the same storage do not have independent storage failure domains.",
      software:
        "Separate short-term checkpoints from independent application-consistent backups. Define dependency order, backup interval, retention and the permissions needed for an isolated restore.",
      measure:
        "This exercise assumes a successful restore takes 18 minutes from an available independent copy. Acceptance requires service within 30 minutes and at most 15 minutes of lost samples. Verify both the running VM and a business query.",
      chain: [
        "Hypervisor datastore",
        "Guest OS and services",
        "Backup destination",
        "Restored sample query",
      ],
      caseText:
        "The local datastore is lost at 12:00. Select a recovery design that survives the loss and meets the agreed recovery point. The listed restore times are scenario measurements.",
      stimuli: ["Inspect last recoverable copy", "Restore and query sample"],
      setting: "Recovery design",
      options: [
        "Local checkpoint at 11:59",
        "Independent copy at 11:50",
        "Independent copy at 11:00",
      ],
      correct: 1,
      traces: [
        [
          ["Datastore = lost", "Recoverable copy = none"],
          ["Restore = unavailable", "Query = failed"],
        ],
        [
          ["Last sample = 11:50", "Data gap = 10 min"],
          ["Query restored = 12:18", "Service outage = 18 min"],
        ],
        [
          ["Last sample = 11:00", "Data gap = 60 min"],
          ["Query restored = 12:18", "Service outage = 18 min"],
        ],
      ],
      explain:
        "A fast restore cannot repair a poor recovery point. The 11:50 independent copy meets both targets in the scenario; a local checkpoint vanished with its datastore.",
      source: "Microsoft Learn · Hyper-V checkpoints",
      link: "https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/checkpoints",
    },
    {
      id: "mes",
      name: "MES & production execution",
      group: "Operations",
      parts:
        "The execution client connects the operator and work centre to a job. Application services register production, consumption or disposition. A station terminal, scanner and server are transport and capture devices, not the job identity itself.",
      software:
        "Bind the item, active order, operation, work centre and event identity before registration. Keep scrap and accepted output distinct. Duplicate delivery must not add a second physical completion.",
      measure:
        "Send one accepted-unit event C17 and replay its identical payload. Verify the job reference remains T24 and the accepted total changes once. A different physical completion requires a new identity.",
      chain: [
        "PLC completion",
        "Active job T24",
        "MES registration C17",
        "Order actuals",
      ],
      caseText:
        "A lost acknowledgement causes a completion to be redelivered. Select the policy that counts the physical event exactly once and attributes it to the correct job. Each probe starts with an empty ledger.",
      stimuli: ["Deliver C17 once", "Deliver C17 twice"],
      setting: "Registration policy",
      options: [
        "Append every delivery to T24",
        "Deduplicate but assign oldest job",
        "Deduplicate by source and event on T24",
      ],
      correct: 2,
      traces: [
        [
          ["Job = T24", "Accepted units = 1"],
          ["Job = T24", "Accepted units = 2"],
        ],
        [
          ["Job = T23", "Accepted units = 1"],
          ["Job = T23", "Accepted units = 1"],
        ],
        [
          ["Job = T24", "Accepted units = 1"],
          ["Job = T24", "Accepted units = 1"],
        ],
      ],
      explain:
        "De-duplication and attribution solve different problems. Record the trusted source and event ID with its business effect as one durable transaction.",
      source: "Microsoft Learn · manufacturing execution registration",
      link: "https://learn.microsoft.com/en-us/dynamics365/supply-chain/production-control/registration-manufacturing-execution",
    },
    {
      id: "erp",
      name: "SAP ERP & inventory postings",
      group: "Enterprise",
      parts:
        "ERP is an application role, not a controller or a piece of line hardware. A client and integration service submit business events to an application and database. A successful network reply does not by itself establish correct stock.",
      software:
        "In this public SAP S/4HANA production-order example, issue input material against the order; confirm operation yield and scrap; receive the accepted output into inventory. Backflush or automatic receipt can combine some postings depending on configuration. Do not also post the same movement manually.",
      measure:
        "Training order T24 consumes 24 input kits, with yield 22 and scrap 2. Starting stock is 100 input kits and zero finished units. Reconcile component stock, confirmation and finished stock; retain the linked document identifiers.",
      chain: [
        "Production order T24",
        "Goods issue: 24 kits",
        "Confirmation: 22 yield / 2 scrap",
        "Goods receipt: 22 finished",
      ],
      caseText:
        "The order quantity is 24 but only 22 units passed. Compare a material ledger and an order confirmation after running each posting policy.",
      stimuli: ["Read posting movements", "Reconcile stock and confirmation"],
      setting: "Posting policy",
      options: [
        "Receive planned quantity",
        "Issue once; confirm actuals; receive yield",
        "Manual issue plus same backflush",
      ],
      correct: 1,
      traces: [
        [
          ["Issue = 24", "Receipt = 24"],
          [
            "Input left = 76; finished = 24",
            "Confirmation = 22 yield / 2 scrap",
          ],
        ],
        [
          ["Issue = 24", "Receipt = 22"],
          [
            "Input left = 76; finished = 22",
            "Confirmation = 22 yield / 2 scrap",
          ],
        ],
        [
          ["Issue = 48", "Receipt = 22"],
          [
            "Input left = 52; finished = 22",
            "Confirmation = 22 yield / 2 scrap",
          ],
        ],
      ],
      explain:
        "Order quantity is not accepted output. Component stock is 100 − 24 = 76 and finished stock is 22. The example teaches business semantics; it does not identify any site implementation.",
      source: "SAP Learning · processing production orders",
      link: "https://learning.sap.com/courses/executing-basic-erp-processes-with-sap-s-4hana/processing-production-orders",
    },
  ];

  const nav = document.getElementById("stations");
  const work = document.getElementById("work");
  const memoryKey = "signalworks-equipment-practice-v1";
  let attempts = {};
  try {
    const saved = JSON.parse(localStorage.getItem(memoryKey) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved))
      attempts = saved;
  } catch {
    /* Practice remains available when browser storage is unavailable. */
  }

  function save() {
    try {
      localStorage.setItem(memoryKey, JSON.stringify(attempts));
    } catch {
      /* Keep this session in memory. */
    }
  }
  function el(tag, text, className) {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    if (className) item.className = className;
    return item;
  }
  function getAttempt(station) {
    const old = attempts[station.id];
    if (
      old &&
      Number.isInteger(old.setting) &&
      old.setting >= 0 &&
      old.setting < station.options.length &&
      Array.isArray(old.observed) &&
      old.observed.every((n) => n === 0 || n === 1)
    )
      return old;
    return (attempts[station.id] = { setting: 0, observed: [] });
  }
  function navDraw(current) {
    nav.replaceChildren(el("p", "Choose a station", "kicker"));
    stations.forEach((station, index) => {
      const a = el("a");
      a.href = "#" + station.id;
      if (station.id === current.id) a.setAttribute("aria-current", "page");
      a.append(
        el("b", String(index + 1).padStart(2, "0")),
        el("span", station.name),
      );
      nav.append(a);
    });
  }
  function show() {
    const station =
      stations.find((item) => item.id === location.hash.slice(1)) ||
      stations[0];
    const attempt = getAttempt(station);
    navDraw(station);
    const heading = el("h2", station.name);
    work.replaceChildren(el("p", station.group, "station-meta"), heading);
    const signal = el("ol", undefined, "flow");
    signal.setAttribute("aria-label", "Signal to system path");
    station.chain.forEach((step) => {
      const li = el("li");
      li.append(el("span", step));
      signal.append(li);
    });
    work.append(signal);
    const notes = el("dl");
    for (const [label, text] of [
      ["Hardware", station.parts],
      ["Software settings", station.software],
      ["Commissioning test", station.measure],
    ]) {
      const row = el("div", undefined, "reading");
      row.append(el("dt", label), el("dd", text));
      notes.append(row);
    }
    const bench = el("section", undefined, "case");
    bench.append(
      el("p", "Fault bench", "cap"),
      el("h3", "Diagnose and verify"),
      el("p", station.caseText),
    );
    const label = el("label", station.setting);
    const selector = el("select");
    selector.setAttribute("aria-label", station.setting);
    station.options.forEach((option, i) => {
      const item = el("option", option);
      item.value = String(i);
      selector.append(item);
    });
    selector.value = String(attempt.setting);
    label.append(selector);
    bench.append(label);
    const bar = el("div", undefined, "tools");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Apply test conditions");
    const display = el("div", undefined, "output");
    display.setAttribute("role", "status");
    const verdict = el("p", undefined, "verdict");
    verdict.setAttribute("aria-live", "polite");
    const buttons = station.stimuli.map((stimulus, i) => {
      const button = el("button", stimulus);
      button.type = "button";
      button.addEventListener("click", () => {
        attempt.observed = attempt.observed.filter((n) => n !== i).concat(i);
        save();
        refresh();
      });
      bar.append(button);
      return button;
    });
    function refresh() {
      const last = attempt.observed.at(-1);
      buttons.forEach((button, i) =>
        button.setAttribute("aria-pressed", String(i === last)),
      );
      display.replaceChildren(
        el("span", "Simulated instrument readback", "cap"),
      );
      if (last === undefined)
        display.append(
          el("p", "Apply a test condition to read the instruments."),
        );
      else
        station.traces[attempt.setting][last].forEach((line) =>
          display.append(el("p", line)),
        );
      verdict.className = "verdict";
      if (new Set(attempt.observed).size < 2) {
        verdict.textContent = attempt.observed.length
          ? "One condition tested. Run the other condition before accepting the setting."
          : "Test both conditions on the same setting. Changing a setting clears the previous observations.";
      } else {
        const pass = attempt.setting === station.correct;
        verdict.classList.add(pass ? "pass" : "fail");
        verdict.textContent =
          (pass ? "Accepted. " : "Not accepted. ") + station.explain;
      }
    }
    selector.addEventListener("change", () => {
      attempt.setting = Number(selector.value);
      attempt.observed = [];
      save();
      refresh();
    });
    const reset = el("button", "Restart this fault bench", "reset");
    reset.type = "button";
    reset.addEventListener("click", () => {
      attempt.setting = 0;
      attempt.observed = [];
      selector.value = "0";
      save();
      refresh();
    });
    bench.append(bar, display, verdict, reset);
    const source = el("p", undefined, "src");
    source.append("Primary reference: ");
    const link = el("a", station.source);
    link.href = station.link;
    source.append(
      link,
      ". Read 26 November 2026. Examples and test values are simulated.",
    );
    work.append(notes, bench, source);
    refresh();
  }
  window.addEventListener("hashchange", () => {
    if (location.hash === "#work") {
      work.focus();
      return;
    }
    show();
    if (window.matchMedia("(max-width:760px)").matches)
      work.scrollIntoView({ block: "start" });
  });
  show();
})();
