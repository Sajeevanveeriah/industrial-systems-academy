"use strict";
const projects = [
  {
    id: "server",
    title: "Build and recover a server",
    kit: "Disposable Windows or Linux VM · isolated virtual network",
    brief:
      "Your fictional historian configuration has to survive a lost working copy. Establish a network baseline, back up one configuration and restore it to a different directory. This tests a file-level recovery, not recovery of an entire VM.",
    steps: [
      "Create a disposable VM on an isolated virtual switch. Record the OS, vCPU count, memory, virtual disk capacity and adapter name. Choose a non-overlapping private subnet for this lab. Record address, prefix, DNS and time source; a machine without a default route can still communicate on its own subnet.",
      "In a new empty user-writable directory, run the block for your operating system. The example makes a tiny historian configuration, records its checksum and restores it under a separate path.",
      "Time the restore. Record the reference and recovered hashes, the values you recovered and the VM baseline. Identify what this exercise does not protect: operating system configuration, running services and transactions after the backup.",
    ],
    sample:
      'Windows PowerShell\nGet-NetIPConfiguration\nw32tm /query /status\nNew-Item -ItemType Directory backup,restored\n"timezone=UTC" | Set-Content historian.conf\nCopy-Item historian.conf backup\nCopy-Item backup/historian.conf restored\nGet-FileHash historian.conf,restored/historian.conf\n\nLinux shell\nip address show\nip route show\ntimedatectl status\nmkdir backup restored\nprintf "timezone=UTC\\n" > historian.conf\ncp historian.conf backup/\ncp backup/historian.conf restored/\nsha256sum historian.conf restored/historian.conf',
    fault:
      "In the disposable VM only, change timezone=UTC to timezone=local in the restored copy. Recalculate its hash, observe the mismatch, then restore that copy from the known backup again.",
    checks: [
      "The recorded prefix, DNS and clock state describe the test host; any missing time source is identified.",
      "The deliberately changed copy has a different hash; the final restored copy matches the original.",
      "The measured restore time and the scope of this backup are recorded.",
    ],
  },
  {
    id: "network",
    title: "Trace a packet through a switch",
    kit: "Network simulator or a paper topology · two isolated VLANs",
    brief:
      "A PLC and engineering station must exchange local traffic. A historian belongs to a second subnet. Design the path before you add any routing.",
    steps: [
      "Draw one managed switch: access port 1 in VLAN 10 for PLC 10.10.10.20/24, port 2 in VLAN 10 for station 10.10.10.30/24, port 3 in VLAN 20 for historian 10.10.20.40/24. Reserve .1 in each subnet for a simulated router. Keep these addresses inside the simulator.",
      "Predict the first exchange between the two VLAN 10 hosts. With empty ARP caches, the station broadcasts a request inside VLAN 10; the PLC replies. Identify where the switch learns each source MAC and which ports see the broadcast.",
      "Add a router-on-a-stick to a tagged trunk carrying VLANs 10 and 20. Set each host gateway to its own .1 address. Trace a packet from station to historian: source and destination IP remain fixed, while the Ethernet addresses change at the router. Record forward and return paths.",
    ],
    sample:
      "Unrouted: station → switch / VLAN 10 → PLC\nRouted: station → VLAN 10 gateway → router → VLAN 20 → historian\nEvidence table: source | destination | expected next hop | observed result | reason",
    fault:
      "In the simulator only, remove VLAN 20 from the trunk. Predict which local test still passes, then restore the VLAN and repeat both tests.",
    checks: [
      "The local PLC path works before routing is added; the inter-VLAN path does not.",
      "The routed path works only when the VLANs, gateways, trunk and return route agree.",
      "The simulated trunk fault fails the inter-VLAN test without breaking station-to-PLC traffic.",
    ],
  },
  {
    id: "controls",
    title: "Scale and time a control loop",
    kit: "Spreadsheet or PLC simulator · simulated tank only",
    brief:
      "A simulated tank transmitter maps 4 to 20 mA onto 0 to 200 kPa. A controller samples every 100 ms. Prove the scaling, alarm delay and direction of correction before considering a real controller.",
    steps: [
      "Create columns for scan number, input current, calculated pressure, quality and consecutive high scans. Calculate pressure from the linear span; make quality a separate flag so an out-of-range signal cannot masquerade as a genuine zero.",
      "Use 4, 12 and 20 mA as endpoint and midpoint tests. For valid samples strictly above 150 kPa, increment a counter; reset it on any other sample. Trigger an exercise alarm at the tenth consecutive high sample.",
      "For a simple proportional-control experiment, start at 80 kPa and target 100 kPa. Every 0.1 s calculate error = setpoint minus pressure and command = clamp(50 + 2 × error, 0, 100) percent. Use the synthetic plant update below. Explain why the command falls as pressure approaches target; contrast proportional action with accumulated integral error and derivative response to rate of change.",
    ],
    sample:
      "pressure_kPa = (input_mA - 4) × 200 / 16\nvalid = 4 ≤ input_mA ≤ 20    (exercise assumption)\nplant: pressure_next = pressure_now + 0.1 × (command_pct - 50)\nFirst scan: error = 20; command = 90%; pressure_next = 84 kPa.",
    fault:
      "Simulate 3 mA, then nine high samples followed by a low sample. Mark bad quality for the first case and show that the interruption resets the high counter. This is a sample-count exercise, not a certified elapsed-time or safety function.",
    checks: [
      "4, 12 and 20 mA give 0, 100 and 200 kPa; 3 mA is flagged invalid.",
      "Nine consecutive high samples do not alarm; ten do; an intervening normal sample resets the count.",
      "The first simulated pressure update is 84 kPa and the next command is lower than 90%.",
    ],
  },
  {
    id: "historian",
    title: "Audit historian data with SQL",
    kit: "SQLite scratch database · synthetic one-minute pressure series",
    brief:
      "The daily average looks plausible, but duplicate timestamps and bad-quality samples are reaching a report. Separate ingestion counts from usable observations before aggregating.",
    steps: [
      "Run the example in a new in-memory SQLite database. Each row records a minute offset, a pressure in kPa and a quality code. An event is expected every minute from 0 through 4 inclusive.",
      "Count all rows, distinct minute offsets, and duplicate timestamps. Identify the missing minute explicitly. Reject bad-quality rows; for this exercise only, collapse exact duplicate observations before aggregation. Conflicting good values at one timestamp would require a separate resolution rule.",
      "Compare the raw and filtered means and explain why the filtered result is not proof of uninterrupted sampling. Specify whether a production report should display a quality flag, suppress an average, or present a coverage measure when observations are missing.",
    ],
    sample:
      "CREATE TABLE samples(minute INTEGER, kpa REAL, quality TEXT);\nINSERT INTO samples VALUES (0,100,'good'),(1,110,'good'),\n(1,110,'good'),(3,999,'bad'),(4,120,'good');\nSELECT minute,COUNT(*) FROM samples GROUP BY minute;\nSELECT AVG(kpa) FROM samples;\nSELECT AVG(kpa) FROM (SELECT DISTINCT minute,kpa FROM samples WHERE quality='good');",
    fault:
      "In the scratch simulation, insert a second good value of 115 kPa at minute 1. Group by minute and count distinct valid pressure values. Flag the conflict rather than silently averaging it away.",
    checks: [
      "Before fault injection there are five rows, four distinct minutes and no minute 2.",
      "The raw mean is 287.8 kPa; the accepted mean is 110 kPa from three distinct good minutes out of five expected.",
      "After injection the minute 1 conflict is detected and the report is not silently accepted.",
    ],
  },
  {
    id: "robotics",
    title: "Prove a robot work frame",
    kit: "2D sketch or spreadsheet · virtual positions in mm",
    brief:
      "A robot receives a point in fixture coordinates. Commission the transformation on paper before trusting a pick position. This model uses translation and a planar rotation only.",
    steps: [
      "Place the fixture origin at base coordinates (400, 200) mm. Rotate the fixture axes +90° counter-clockwise from the base axes. Draw labelled base and fixture axes, including positive directions.",
      "Transform fixture points A=(0,0), B=(100,0) and C=(0,50) into the base frame with the equations below. Confirm the transformed distances AB and AC, not just the origin.",
      "Add a planar tool offset of +20 mm along the flange x axis. At flange yaw +90° relative to base the offset points along base +y. To place the tool centre at target B, subtract that rotated offset from the desired tool-centre position to obtain the flange command.",
    ],
    sample:
      "base_x = 400 + cos(θ) × fixture_x - sin(θ) × fixture_y\nbase_y = 200 + sin(θ) × fixture_x + cos(θ) × fixture_y\nθ = +90°; use radians if your spreadsheet functions require them.\nTest A checks translation; tests B and C expose rotation/sign errors.",
    fault:
      "Change the simulated frame rotation to -90°. The origin still passes. Record the measured discrepancy at B, then reinstate the correct angle. Do not move a physical robot for this exercise.",
    checks: [
      "Base A, B and C are (400,200), (400,300) and (350,200) mm within 0.1 mm.",
      "Flange command for B at yaw +90° is (400,280) mm for the specified tool.",
      "The incorrect rotation misses B by 200 mm despite passing the origin check.",
    ],
  },
  {
    id: "acceptance",
    title: "Accept an order from OT to ERP",
    kit: "Order-to-pallet simulation · a fictional acceptance record",
    brief:
      "A work order authorises six good cartons. A reject and a repeated interface message must not create stock. Prepare factory acceptance testing (FAT), site acceptance testing (SAT) and an operator recovery record.",
    steps: [
      "Define ownership: ERP releases the order; MES dispatches and counts accepted cartons; the robot cell reports outcomes; ERP posts unique accepted stock movements. Write the order identifier, event identifier, units, expected count and acknowledgement into an interface table.",
      "In Sim labs, open Order to pallet. Dispatch an order, generate a reject, then six accepted cartons. Attempt closure before posting. Record the produced, rejected and accepted counts, replay posting and compare the second stock balance with the first.",
      "Create distinct evidence rows. FAT: simulated order, duplicate posting and premature closure. SAT: proposed isolated-site checks for time alignment, approved mappings, operator access and restore readiness; mark them untested. Write a recovery runbook: pause the interface, preserve the event ledger, identify its last acknowledgement, replay only using stable identifiers, reconcile quantities and obtain release from the named role.",
    ],
    sample:
      "Case | Preconditions | Stimulus | Expected | Observed | Evidence | Disposition\nFAT-01 | Order released | Six good + one reject | Six booked | Record result\nSAT-01 | Approved test window | Compare timestamps and unit mapping | Within agreed tolerance | Not executed",
    fault:
      "Run the simulated post twice and attempt early closure. Record whether the system rejects the transition or safely deduplicates it. A successful browser simulation is not site acceptance.",
    checks: [
      "The ledger accounts for seven robot cycles, six accepted cartons and one reject, with six booked units.",
      "The duplicate post does not increase inventory; early closure is refused.",
      "The record separates observed FAT evidence from proposed SAT checks and identifies who authorises recovery.",
    ],
  },
];

const book = document.querySelector("#workbook");
const menu = document.querySelector("#projects");
const prefix = "signalworks.fieldwork.v1.";
const session = new Map();
function getNotes(id) {
  if (session.has(id)) return session.get(id);
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(prefix + id));
  } catch {}
  const entry = {
    notes: typeof saved?.notes === "string" ? saved.notes : "",
    checks: Array.isArray(saved?.checks)
      ? saved.checks.map((value) => value === true)
      : [],
  };
  session.set(id, entry);
  return entry;
}
function node(tag, value) {
  const el = document.createElement(tag);
  el.textContent = value;
  return el;
}
for (const project of projects) {
  const link = node("a", project.title);
  link.href = "#" + project.id;
  menu.append(link);
}
function showProject(moveFocus = false) {
  const p =
    projects.find((item) => item.id === location.hash.slice(1)) || projects[0];
  for (const link of menu.children) {
    if (link.hash === "#" + p.id) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  const data = getNotes(p.id);
  const title = node("h2", p.title);
  const steps = node("ol", "");
  for (const line of p.steps) steps.append(node("li", line));
  book.replaceChildren(
    node("small", p.kit),
    title,
    node("p", p.brief),
    node("h3", "Workshop procedure"),
    steps,
    node("pre", p.sample),
    node("h3", "Simulate a fault"),
    node("p", p.fault),
    node("h3", "Acceptance record"),
  );
  if (p.id === "acceptance") {
    const bench = node("a", "Open the order-to-pallet bench");
    bench.href = "labs.html#order";
    book.append(bench);
  }
  const note = node("textarea", "");
  note.id = "evidence";
  note.value = data.notes;
  const status = node("p", "");
  status.className = "state";
  status.setAttribute("role", "status");
  function refresh(saved = null) {
    const count = p.checks.filter((_, i) => data.checks[i]).length;
    const complete = count === p.checks.length && data.notes.trim() !== "";
    status.textContent =
      (complete
        ? "Evidence recorded."
        : count + " of " + p.checks.length + " checks recorded.") +
      (saved === false
        ? " Storage unavailable; changes last only in this tab."
        : "");
  }
  function persist() {
    let saved = true;
    try {
      localStorage.setItem(prefix + p.id, JSON.stringify(data));
    } catch {
      saved = false;
    }
    refresh(saved);
  }
  for (const [i, criterion] of p.checks.entries()) {
    const label = node("label", "");
    label.className = "criterion";
    const check = node("input", "");
    check.type = "checkbox";
    check.checked = !!data.checks[i];
    check.addEventListener("change", () => {
      data.checks[i] = check.checked;
      persist();
    });
    label.append(check, node("span", criterion));
    book.append(label);
  }
  const label = node("label", "Your evidence");
  label.htmlFor = note.id;
  const tip = node(
    "p",
    "Record observed values, expected values and differences. Tick a criterion only after checking it. Evidence stays in this browser; clearing site data removes it.",
  );
  tip.className = "note";
  note.addEventListener("input", () => {
    data.notes = note.value;
    persist();
  });
  book.append(node("h3", "Field notes"), label, note, tip, status);
  refresh();
  if (moveFocus) {
    book.focus();
    book.scrollIntoView({ block: "start" });
  }
}
document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  book.focus();
  book.scrollIntoView({ block: "start" });
});
window.addEventListener("hashchange", () => showProject(true));
showProject();
