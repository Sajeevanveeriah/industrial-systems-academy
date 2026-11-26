"use strict";

const bench = document.querySelector("#bench");
const buttons = [...document.querySelectorAll("[data-lab]")];
const titles = {
  robot: [
    "Teach a planar robot",
    "Jog a two-link arm in its base frame. Bring the tool centre point to a fixture, prove the pick tolerance, and teach a position you can recall.",
  ],
  server: [
    "Commission the historian",
    "The historian must resolve a collector on its local subnet, route reports to the business network and timestamp events within 2 s of the lab reference. Read the commissioning sheet, select the settings, then inspect each test.",
  ],
  plc: [
    "Prove the transfer sequence",
    "A simulated controller samples the inputs once per scan. Prove a transfer from infeed to discharge, then interrupt the permissive during a second transfer and observe the restart behaviour.",
  ],
  order: [
    "Reconcile a packing order",
    "ERP has released order WO-104 for 6 accepted cartons. MES dispatches a robot-cell cycle; inspection sends accepted and rejected counts back as a pallet event. Booking the same event twice must not create stock twice.",
  ],
};
const initial = {
  robot: () => ({
    shoulder: 0,
    elbow: 0,
    target: "Pick nest",
    slot: "Position A",
    taught: {},
    result: "No pick tested.",
  }),
  server: () => ({
    mask: "255.255.255.240",
    gateway: "10.42.8.254",
    dns: "10.42.9.53",
    clock: "Local oscillator",
    tested: false,
  }),
  plc: () => ({
    permit: true,
    infeed: false,
    start: false,
    exit: false,
    reset: false,
    previousStart: false,
    phase: "Idle",
    cycles: 0,
    scans: 0,
    trace: "Awaiting first scan.",
  }),
  order: () => ({
    quality: "Pass",
    replay: "same",
    state: "Released",
    made: 0,
    scrap: 0,
    good: 0,
    erp: 0,
    events: [],
    booked: new Set(),
    trace: "Dispatch the released order to the robot cell.",
  }),
};
const sessions = Object.fromEntries(
  Object.entries(initial).map(([key, fn]) => [key, fn()]),
);
const labFromHash = () =>
  Object.hasOwn(titles, location.hash.slice(1))
    ? location.hash.slice(1)
    : "server";
let active = labFromHash();

function field(key, label, options, value) {
  return (
    '<label class="field">' +
    label +
    '<select data-key="' +
    key +
    '">' +
    options
      .map(
        (option) =>
          "<option" +
          (option === value ? " selected" : "") +
          ">" +
          option +
          "</option>",
      )
      .join("") +
    "</select></label>"
  );
}
function toggle(key, label, on) {
  return (
    '<label class="toggle"><input data-key="' +
    key +
    '" type="checkbox"' +
    (on ? " checked" : "") +
    ">" +
    label +
    "</label>"
  );
}
function action(id, label, primary = false) {
  return (
    '<button data-action="' +
    id +
    '"' +
    (primary ? ' class="primary"' : "") +
    ">" +
    label +
    "</button>"
  );
}
function readings(items) {
  return (
    '<div class="readout">' +
    items
      .map(
        ([name, value]) =>
          "<div><small>" +
          name +
          "</small><strong>" +
          value +
          "</strong></div>",
      )
      .join("") +
    "</div>"
  );
}
function trace(lines) {
  return (
    '<div class="trace">' +
    lines
      .map(
        ([ok, title, detail]) =>
          '<p><b class="' +
          (ok ? "pass" : "") +
          '">' +
          title +
          "</b> " +
          detail +
          "</p>",
      )
      .join("") +
    "</div>"
  );
}
function serverChecks(s) {
  const local = s.mask === "255.255.255.0";
  return [
    [
      local,
      "Local collector:",
      local
        ? "The /24 matches the commissioning sheet; 10.42.8.70 is on-link."
        : "The /28 puts 10.42.8.70 outside the configured local subnet.",
    ],
    [
      local && s.gateway === "10.42.8.1",
      "Report route:",
      s.gateway !== "10.42.8.1"
        ? "The selected address is not the commissioned router."
        : local
          ? "The report router is on-link and matches the commissioning sheet."
          : "The specified router is outside the host subnet with this mask.",
    ],
    [
      s.dns === "10.42.8.10",
      "Name service:",
      s.dns === "10.42.8.10"
        ? "The selected resolver holds the collector record."
        : "This resolver has no record for collector.lab.",
    ],
    [
      s.clock === "Lab time reference",
      "Timestamp:",
      s.clock === "Lab time reference"
        ? "Measured offset +0.3 s, within the lab tolerance."
        : "The simulated free-running clock is +79 s ahead.",
    ],
  ];
}
function serverParts(s) {
  const checks = serverChecks(s),
    count = checks.filter((c) => c[0]).length;
  return [
    "<h3>Historian settings</h3>" +
      field(
        "mask",
        "Subnet mask",
        ["255.255.255.240", "255.255.255.0"],
        s.mask,
      ) +
      field(
        "gateway",
        "Default gateway",
        ["10.42.8.254", "10.42.8.1"],
        s.gateway,
      ) +
      field("dns", "DNS resolver", ["10.42.9.53", "10.42.8.10"], s.dns) +
      field(
        "clock",
        "Clock source",
        ["Local oscillator", "Lab time reference"],
        s.clock,
      ),
    action("test", "Run acceptance test", true),
    '<h3>Commissioning sheet</h3><div class="ledger">Host: 10.42.8.20/24\nCollector: 10.42.8.70 (collector.lab)\nReport router: 10.42.8.1\nAuthoritative lab DNS: 10.42.8.10\nTime source: lab reference; tolerance: ±2 s</div>' +
      readings([
        ["Checks", s.tested ? count + "/4" : "Not run"],
        ["Host", "HST-01"],
        ["Result", s.tested ? (count === 4 ? "Pass" : "Fail") : "Pending"],
      ]) +
      (s.tested
        ? trace(checks)
        : '<p class="hint">Run a baseline test before changing the default settings.</p>'),
  ];
}
function scan(s) {
  const edge = s.start && !s.previousStart;
  s.previousStart = s.start;
  s.scans++;
  if (!s.permit) {
    s.phase = "Tripped";
    s.trace = "Permissive absent: output off, trip latched.";
  } else if (s.phase === "Tripped") {
    if (s.reset && !s.start) {
      s.phase = "Idle";
      s.trace = "Permissive restored; reset accepted with Start released.";
    } else
      s.trace =
        "Trip stays latched. Restore the permissive, release Start and request Reset.";
  } else if (s.phase === "Moving") {
    if (s.exit) {
      s.phase = "Idle";
      s.cycles++;
      s.trace =
        "Discharge detected: motor off; one completed transfer counted.";
    } else s.trace = "Motor remains on; waiting for discharge detection.";
  } else if (edge && s.infeed && !s.exit && !s.reset) {
    s.phase = "Moving";
    s.trace = "Rising Start edge accepted: part present and discharge clear.";
  } else {
    s.trace =
      "Idle. Start requires a fresh rising edge, part at infeed, clear discharge and no reset request.";
  }
}
function plcParts(s) {
  return [
    "<h3>Simulated inputs</h3>" +
      toggle("permit", "Process permissive healthy", s.permit) +
      toggle("infeed", "Part at infeed", s.infeed) +
      toggle("start", "Start request", s.start) +
      toggle("exit", "Discharge sensor occupied", s.exit) +
      toggle("reset", "Reset request", s.reset) +
      '<p class="hint">Changing a switch stages an input. Advance a scan to sample it. Release Start for at least one scan before requesting another transfer.</p>',
    action("scan", "Advance one scan", true),
    "<h3>Controller readback</h3>" +
      readings([
        ["State", s.phase],
        ["Motor", s.phase === "Moving" ? "On" : "Off"],
        ["Transfers", s.cycles],
      ]) +
      trace([[s.phase !== "Tripped", "Scan " + s.scans + ":", s.trace]]) +
      '<ol class="record"><li>Stage infeed and Start, then scan.</li><li>Release Start, stage discharge and scan to book a transfer.</li><li>Clear discharge and start another transfer. Drop the permissive and scan. Restore it and scan before resetting: does the motor restart?</li></ol><p class="hint">This exercise models a process permissive, not a safety-rated control system.</p>',
  ];
}
function orderEvent(s, id) {
  if (id === "dispatch") {
    if (s.state !== "Released") {
      s.trace =
        "No dispatch issued: this order is already dispatched or closed.";
      return;
    }
    s.state = "Running";
    s.trace =
      "MES dispatched WO-104. The robot can now pick one carton per cycle.";
  } else if (id === "pick") {
    if (s.state !== "Running" || s.good >= 6) {
      s.trace =
        "Cycle refused: a running order with outstanding accepted quantity is required.";
      return;
    }
    s.made++;
    const accepted = s.quality === "Pass";
    s.good += Number(accepted);
    s.scrap += Number(!accepted);
    s.events.push({ id: "WO-104:" + s.made, accepted: Number(accepted) });
    s.trace = accepted
      ? "Vision accepted the carton. One good unit awaits transfer to ERP."
      : "Inspection rejected this carton. The cycle is traceable, but it contributes no finished stock.";
  } else if (id === "sync") {
    const before = s.booked.size;
    for (const event of s.events) {
      if (!s.booked.has(event.id)) {
        s.erp += event.accepted;
        s.booked.add(event.id);
      }
    }
    s.trace =
      s.booked.size -
      before +
      " new event(s) acknowledged. Existing event IDs were ignored; replay cannot add stock.";
  } else if (id === "close") {
    if (s.state === "Closed") {
      s.trace = "Order already closed. The evidence record is unchanged.";
      return;
    }
    if (s.good !== 6 || s.erp !== 6 || s.events.length !== s.booked.size) {
      s.trace =
        "Close blocked: need 6 accepted in MES, 6 posted to ERP and an acknowledgement for every event, including rejects.";
      return;
    }
    s.state = "Closed";
    s.trace =
      "Reconciliation passed. Release evidence: order WO-104, 6 accepted, " +
      s.scrap +
      " rejected, " +
      s.booked.size +
      " unique events acknowledged.";
  }
}
function orderParts(s) {
  return [
    "<h3>Cell and interface controls</h3>" +
      field(
        "quality",
        "Next inspection outcome",
        ["Pass", "Reject"],
        s.quality,
      ) +
      '<p class="hint">Dispatch the order. Try a rejected carton and a premature close, then make up the shortfall. Post the events twice and check whether booked stock changes.</p>',
    action("dispatch", "Dispatch") +
      action("pick", "Run robot cycle", true) +
      action("sync", "Post / replay events") +
      action("close", "Close order"),
    "<h3>Order WO-104</h3>" +
      readings([
        ["MES good", s.good + " / 6"],
        ["Rejected", s.scrap],
        ["ERP stock", s.erp],
      ]) +
      trace([
        [s.state === "Closed" || s.state === "Running", s.state + ":", s.trace],
      ]) +
      '<p class="ledger">Robot cycles: ' +
      s.made +
      "<br>Event acknowledgements: " +
      s.booked.size +
      " / " +
      s.events.length +
      "<br>MES to ERP variance: " +
      (s.good - s.erp) +
      " units<br>Last event ID: " +
      (s.events.at(-1)?.id || "None") +
      "</p>" +
      (s.state === "Closed"
        ? '<p class="hint">Capstone evidence: match total robot cycles to accepted plus rejected units, identify the last acknowledged event, and explain why a successful replay did not increase inventory.</p>'
        : ""),
  ];
}
const robotTargets = {
  "Pick nest": [160, 120],
  "Place nest": [-120, 160],
  "Distant nest": [300, 0],
};
function robotGeometry(s) {
  const theta = (s.shoulder * Math.PI) / 180;
  const phi = ((s.shoulder + s.elbow) * Math.PI) / 180;
  const joint = [160 * Math.cos(theta), 160 * Math.sin(theta)];
  const tip = [joint[0] + 120 * Math.cos(phi), joint[1] + 120 * Math.sin(phi)];
  const goal = robotTargets[s.target];
  const radius = Math.hypot(...goal);
  return {
    joint,
    tip,
    goal,
    error: Math.hypot(tip[0] - goal[0], tip[1] - goal[1]),
    reachable: radius >= 40 && radius <= 280,
  };
}
function jog(key, label, value) {
  return (
    '<label class="field pendant-jog">' +
    label +
    '<output data-angle="' +
    key +
    '">' +
    value +
    '°</output><input data-key="' +
    key +
    '" type="range" min="-180" max="180" step="1" value="' +
    value +
    '"></label>'
  );
}
function robotParts(s) {
  const { tip, goal, error, reachable } = robotGeometry(s);
  const taught =
    Object.entries(s.taught)
      .map(([name, pose]) => name + ": " + pose[0] + "°, " + pose[1] + "°")
      .join("<br>") || "No positions taught.";
  return [
    "<h3>Teach pendant</h3>" +
      field("target", "Target fixture", Object.keys(robotTargets), s.target) +
      jog("shoulder", "Shoulder angle", s.shoulder) +
      jog("elbow", "Relative elbow angle", s.elbow) +
      field(
        "slot",
        "Teach / recall slot",
        ["Position A", "Position B"],
        s.slot,
      ) +
      '<p class="hint">At zero both links point along +X. A positive joint angle turns anticlockwise. For the pick nest, try shoulder 0°, elbow 90°. For the place nest, rotate the shoulder by another 90°. Arrow keys jog 1°.</p>',
    action("pickTest", "Test pick", true) +
      action("teach", "Teach slot") +
      action("recall", "Recall slot"),
    '<h3>Plan view</h3><canvas id="robot-plot" width="760" height="610" aria-label="Plan view of the arm and target; exact coordinates are given below." role="img"></canvas>' +
      readings([
        ["Tool X", tip[0].toFixed(1) + " mm"],
        ["Tool Y", tip[1].toFixed(1) + " mm"],
        ["Error", error.toFixed(1) + " mm"],
      ]) +
      '<p class="hint">Target (' +
      goal.join(", ") +
      ") mm · " +
      (reachable ? "within radial reach" : "outside radial reach") +
      '. Pick tolerance: 5 mm.</p><p class="trace">' +
      s.result +
      '</p><p class="ledger">' +
      taught +
      "</p><details><summary>How the position is calculated</summary><p>Links are 160 mm and 120 mm. For shoulder angle A and relative elbow angle B, X = 160 cos(A) + 120 cos(A+B); Y = 160 sin(A) + 120 sin(A+B). The arm can reach radii from 40 to 280 mm in this ideal model. Pick error is the straight-line distance from the tool to the target.</p></details>",
  ];
}
function drawArm() {
  if (active !== "robot") return;
  const canvas = document.querySelector("#robot-plot");
  const ctx = canvas.getContext("2d");
  const { joint, tip, goal } = robotGeometry(sessions.robot);
  const origin = [365, 305],
    scale = 0.95;
  const point = ([x, y]) => [origin[0] + x * scale, origin[1] - y * scale];
  const line = (a, b, colour, width) => {
    ctx.beginPath();
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
  };
  const circle = (centre, r, colour, fill) => {
    ctx.beginPath();
    ctx.arc(...centre, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = colour;
      ctx.fill();
    } else {
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };
  for (let n = -300; n <= 300; n += 50) {
    line(point([n, -300]), point([n, 300]), "#243c30", 1);
    line(point([-320, n]), point([330, n]), "#243c30", 1);
  }
  for (const r of [40, 280]) circle(origin, r * scale, "#59846a", false);
  line(point([-320, 0]), point([330, 0]), "#62806d", 2);
  line(point([0, -300]), point([0, 300]), "#62806d", 2);
  ctx.font = "bold 22px monospace";
  ctx.fillStyle = "#b8f7d5";
  ctx.fillText("+X", 690, 313);
  ctx.fillText("+Y", 373, 25);
  ctx.lineCap = "round";
  line(origin, point(joint), "#70b69a", 12);
  line(point(joint), point(tip), "#d2f582", 9);
  circle(origin, 9, "#e8f1e6", true);
  circle(point(joint), 8, "#e8f1e6", true);
  circle(point(tip), 7, "#d2f582", true);
  const [x, y] = point(goal);
  circle([x, y], 14, "#ffbd71", false);
  line([x - 20, y], [x - 11, y], "#ffbd71", 3);
  line([x + 11, y], [x + 20, y], "#ffbd71", 3);
  ctx.fillStyle = "#ffd89d";
  ctx.fillText("Target", x > 620 ? x - 84 : x + 18, y - 12);
}
function robotAction(s, id) {
  const g = robotGeometry(s);
  if (id === "pickTest") {
    if (!g.reachable)
      s.result =
        "Pick refused: target is outside the reachable annulus. Changing the joint angles cannot solve this fixture.";
    else if (g.error <= 5)
      s.result = "Pick passed: the tool is within 5 mm of the target.";
    else
      s.result =
        "Pick refused: reachable fixture, but tool error exceeds 5 mm. Jog the joints and test again.";
  } else if (id === "teach") {
    s.taught[s.slot] = [s.shoulder, s.elbow];
    s.result = s.slot + " taught using the current joint angles.";
  } else if (id === "recall") {
    const pose = s.taught[s.slot];
    if (!pose) {
      s.result = "Recall refused: this slot has no taught position.";
      return;
    }
    [s.shoulder, s.elbow] = pose;
    for (const key of ["shoulder", "elbow"]) {
      bench.querySelector('[data-key="' + key + '"]').value = s[key];
      bench.querySelector('[data-angle="' + key + '"]').textContent =
        s[key] + "°";
    }
    s.result =
      s.slot + " recalled. Test the pick against the selected fixture.";
  }
}
const build = {
  server: serverParts,
  plc: plcParts,
  order: orderParts,
  robot: robotParts,
};
function render() {
  const [name, brief] = titles[active];
  const [settings, actions, monitor] = build[active](sessions[active]);
  bench.innerHTML =
    '<article class="console"><div class="overview"><span class="tag">SIMULATED WORKCELL</span><h2>' +
    name +
    "</h2><p>" +
    brief +
    '</p></div><div class="columns"><div class="settings">' +
    settings +
    '<div class="actions">' +
    actions +
    action("restart", "Reset lab") +
    '</div></div><div class="monitor" aria-live="polite" aria-atomic="true">' +
    monitor +
    "</div></div></article>";
  drawArm();
  buttons.forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.lab === active)),
  );
}
function updateMonitor() {
  bench.querySelector(".monitor").innerHTML = build[active](
    sessions[active],
  )[2];
  drawArm();
}
buttons.forEach((button) =>
  button.addEventListener("click", () => {
    location.hash = button.dataset.lab;
  }),
);
window.addEventListener("hashchange", () => {
  if (location.hash === "#main") return;
  active = labFromHash();
  render();
});
bench.addEventListener("input", (event) => {
  const input = event.target;
  if (active !== "robot" || input.type !== "range") return;
  sessions.robot[input.dataset.key] = Number(input.value);
  sessions.robot.result = "Pose changed. Test the pick at this pose.";
  bench.querySelector('[data-angle="' + input.dataset.key + '"]').textContent =
    input.value + "°";
  updateMonitor();
});
bench.addEventListener("change", (event) => {
  const input = event.target;
  if (!input.dataset.key || input.type === "range") return;
  const s = sessions[active];
  s[input.dataset.key] =
    input.type === "checkbox" ? input.checked : input.value;
  if (active === "server") {
    s.tested = false;
    updateMonitor();
  }
  if (active === "robot") {
    s.result =
      input.dataset.key === "target"
        ? "Fixture changed. Test this target."
        : "Teach slot selected.";
    updateMonitor();
  }
});
bench.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const id = button.dataset.action,
    s = sessions[active];
  if (id === "restart") {
    sessions[active] = initial[active]();
    render();
    bench.querySelector('[data-action="restart"]').focus();
    return;
  }
  if (active === "server") s.tested = true;
  else if (active === "plc") scan(s);
  else if (active === "robot") robotAction(s, id);
  else orderEvent(s, id);
  updateMonitor();
});
render();
