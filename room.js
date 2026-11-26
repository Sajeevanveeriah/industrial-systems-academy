(() => {
  "use strict";
  const { createRoomView } = window.SignalRoom || {};

  const byId = (id) => document.getElementById(id);
  const panels = ["Floor", "Rack", "Patch", "Network", "Prove"];
  const sizes = { ups: 2, server: 2, switch: 1, patch: 1 };
  const names = {
    ups: "UPS",
    server: "Historian server",
    switch: "Access switch",
    patch: "Patch panel",
  };
  const bays = {
    door: "Doorway",
    service: "Service bay",
    cooler: "Cooler zone",
  };
  const leads = {
    power: {
      name: "Protected power",
      a: "UPS · output A",
      b: "PDU · inlet",
      parts: ["ups"],
    },
    uplink: {
      name: "Distribution uplink",
      a: "Patch panel · P01",
      b: "Switch · uplink 1",
      parts: ["patch", "switch"],
    },
    host: {
      name: "Historian access",
      a: "Switch · access 04",
      b: "Server · NIC 1",
      parts: ["switch", "server"],
    },
  };
  const network = {
    address: [
      "Host address",
      "10.42.8.20",
      "The historian reservation is 10.42.8.20. Correct the host address before repeating the identity check.",
    ],
    prefix: [
      "Prefix length",
      "24",
      "A /24 prefix matches the services subnet. Fix the interface prefix.",
    ],
    gateway: [
      "Default gateway",
      "10.42.8.1",
      "Off-subnet reports cannot route. Configure 10.42.8.1 as the default gateway.",
    ],
    dns: [
      "DNS resolver",
      "10.42.8.10",
      "Name lookup fails. Use the lab resolver at 10.42.8.10.",
    ],
    vlan: [
      "Access VLAN",
      "42",
      "The historian is on the wrong logical network. Set switch access port 04 to VLAN 42.",
    ],
  };
  const defaults = () => ({
    bay: "door",
    facing: "hot",
    slots: { ups: 0, server: 0, switch: 0, patch: 0 },
    cables: { power: false, uplink: false, host: false },
    output: false,
    net: { address: "", prefix: "", gateway: "", dns: "", vlan: "" },
    fault: { utility: false, uplink: false },
    evidence: { baseline: false, battery: false, loss: false, recovery: false },
    tested: false,
    stage: "Floor",
  });
  const storeKey = "signal-works.room.v1";
  let storageAvailable = true;
  function read() {
    const result = defaults();
    let v;
    try {
      v = JSON.parse(localStorage.getItem(storeKey));
    } catch {
      return result;
    }
    if (!v || typeof v !== "object") return result;
    if (Object.hasOwn(bays, v.bay)) result.bay = v.bay;
    if (["hot", "cold"].includes(v.facing)) result.facing = v.facing;
    if (panels.includes(v.stage)) result.stage = v.stage;
    for (const key of Object.keys(sizes)) {
      const slot = v.slots?.[key];
      if (
        Number.isInteger(slot) &&
        slot > 0 &&
        !placementError(result.slots, key, slot)
      )
        result.slots[key] = slot;
    }
    for (const key of Object.keys(leads))
      result.cables[key] =
        v.cables?.[key] === true &&
        leads[key].parts.every((k) => result.slots[k] > 0);
    for (const key of Object.keys(network))
      if (typeof v.net?.[key] === "string")
        result.net[key] = v.net[key].slice(0, 30);
    for (const key of Object.keys(result.evidence))
      result.evidence[key] = v.evidence?.[key] === true;
    for (const key of Object.keys(result.fault))
      result.fault[key] = v.fault?.[key] === true;
    result.output = v.output === true && result.slots.ups > 0;
    result.tested = v.tested === true;
    return result;
  }
  function placementError(slots, id, u) {
    if (
      !Object.hasOwn(sizes, id) ||
      !Number.isInteger(u) ||
      u < 1 ||
      u + sizes[id] - 1 > 12
    )
      return "The device would extend outside U1 to U12. Pick a lower starting unit.";
    for (const [other, n] of Object.entries(slots)) {
      if (other !== id && n && u < n + sizes[other] && n < u + sizes[id])
        return (
          "That space is occupied by " +
          names[other] +
          ". Choose free units or move the other device."
        );
    }
    return "";
  }
  let state = read(),
    selected = "ups",
    view,
    preset = "room";
  const panel = byId("panel");
  const say = (message) => {
    byId("notice").textContent = message;
  };
  const escapeHtml = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  function save() {
    try {
      localStorage.setItem(storeKey, JSON.stringify(state));
    } catch {
      storageAvailable = false;
    }
    byId("storage").textContent = storageAvailable
      ? "Saved on this browser"
      : "Session only: browser storage unavailable";
  }
  function invalidate() {
    state.tested = false;
    for (const id of Object.keys(state.evidence)) state.evidence[id] = false;
  }
  function hasPower() {
    return Boolean(state.slots.ups && state.cables.power && state.output);
  }
  function localLink() {
    return Boolean(hasPower() && state.cables.host);
  }
  function hasLink() {
    return Boolean(localLink() && state.cables.uplink && !state.fault.uplink);
  }
  function tests() {
    return [
      [
        "Service clearance",
        state.bay === "service",
        state.bay === "door"
          ? "Rack obstructs the doorway. Relocate it to the service bay."
          : "Rack obstructs cooler servicing. Relocate it to the service bay.",
      ],
      [
        "Cold-aisle intake",
        state.facing === "cold",
        "Rack intake faces the hot aisle. Turn the cabinet intake towards the cold aisle.",
      ],
      [
        "Rack occupancy",
        Object.values(state.slots).every(Boolean),
        "A device is absent. Fit the UPS, historian, access switch and patch panel.",
      ],
      [
        "UPS support position",
        state.slots.ups === 1,
        "Mount the 2U UPS starting at U1 for this rack design.",
      ],
      [
        "Protected PDU feed",
        state.cables.power,
        "Rack PDU is isolated. Connect UPS output A to the PDU inlet.",
      ],
      [
        "UPS output enabled",
        state.output,
        "UPS output is disabled. Enable it under Patch after fitting the UPS.",
      ],
      [
        "Distribution patch lead fitted",
        state.cables.uplink,
        "Distribution path is open. Connect patch panel P01 to switch uplink 1.",
      ],
      [
        "Historian patch lead fitted",
        state.cables.host,
        "Historian NIC has no link. Connect switch access 04 to server NIC 1.",
      ],
      ...Object.entries(network).map(([id, [label, value, help]]) => [
        label,
        state.net[id] === value,
        help,
      ]),
    ];
  }
  function button(label, attrs = "", cls = "") {
    return (
      '<button type="button" ' +
      attrs +
      ' class="' +
      cls +
      '">' +
      label +
      "</button>"
    );
  }
  function option(value, label, picked) {
    return (
      '<option value="' +
      escapeHtml(value) +
      '"' +
      (picked ? " selected" : "") +
      ">" +
      escapeHtml(label) +
      "</option>"
    );
  }
  function selectField(id, label, options) {
    return (
      '<label class="field">' +
      label +
      '<select id="' +
      id +
      '">' +
      options +
      "</select></label>"
    );
  }
  const setButton = (label, key, value, chosen) =>
    button(
      label,
      'data-setting="' +
        key +
        '" data-value="' +
        value +
        '" aria-pressed="' +
        (chosen === value) +
        '"',
    );
  function floorPanel() {
    return (
      '<h3>Locate the rack</h3><p class="panel-note">Choose a bay on the floor plan. Keep the doorway and cooler service zone free.</p><div class="floor" aria-label="Floor plan">' +
      Object.entries(bays)
        .map(([id, label]) => setButton(label, "bay", id, state.bay))
        .join("") +
      '</div><h3>Rack intake</h3><p class="panel-note">Supply air enters the front; exhaust leaves the rear. Set the intake side.</p><div class="bay-choices">' +
      ["cold", "hot"]
        .map((v) =>
          setButton(
            v === "cold" ? "Cold aisle" : "Hot aisle",
            "facing",
            v,
            state.facing,
          ),
        )
        .join("") +
      "</div>"
    );
  }
  function rackPanel() {
    let map = "";
    for (let u = 12; u > 0; u--) {
      const id = Object.keys(sizes).find(
        (k) =>
          state.slots[k] &&
          u >= state.slots[k] &&
          u < state.slots[k] + sizes[k],
      );
      map += button(
        "U" +
          u +
          "<br>" +
          (id
            ? { ups: "UPS", switch: "SW", patch: "PATCH", server: "HOST" }[id]
            : "Free"),
        'data-fit-unit="' +
          u +
          '" aria-label="Install ' +
          names[selected] +
          " starting at U" +
          u +
          (id ? ", occupied by " + names[id] : ", free") +
          '"',
        "unit " + (id ? "used" : ""),
      );
    }
    const spaces = Array.from({ length: 12 }, (_, i) =>
      option(i + 1, "U" + (i + 1), i + 1 === (state.slots[selected] || 1)),
    ).join("");
    return (
      '<h3>Mount the devices</h3><p class="panel-note">Choose a device and its lowest unit. The UPS and server each occupy two adjacent units. U1 is the bottom. Click a unit below to install the selected device there, or use the two selectors.</p><div class="rackmap" aria-label="Occupied rack units">' +
      map +
      '</div><div class="form-row">' +
      selectField(
        "device",
        "Device",
        Object.keys(names)
          .map((id) =>
            option(id, names[id] + " (" + sizes[id] + "U)", id === selected),
          )
          .join(""),
      ) +
      selectField("unit", "Starting unit", spaces) +
      '</div><div class="actions">' +
      button("Install / move", 'data-act="install"', "primary") +
      button("Remove device", 'data-act="remove"') +
      "</div>"
    );
  }
  function portDiagram() {
    return (
      '<div class="portboard" role="group" aria-label="Rack port diagram">' +
      Object.entries(leads)
        .map(
          ([id, l]) =>
            '<div class="portpair"><small>' +
            l.name +
            (state.cables[id] ? " · CONNECTED" : " · OPEN") +
            "</small><div>" +
            [l.a, l.b]
              .map((port) =>
                button(
                  port,
                  'data-port="' + port + '" aria-pressed="false"',
                  "port " + (state.cables[id] ? "connected" : ""),
                ),
              )
              .join("") +
            "</div></div>",
        )
        .join("") +
      "</div>"
    );
  }
  function highlightPorts() {
    const a = byId("port-a").value,
      b = byId("port-b").value;
    panel.querySelectorAll("[data-port]").forEach((el) => {
      const chosen =
        el.dataset.port === a ? "A" : el.dataset.port === b ? "B" : "";
      el.dataset.chosen = chosen;
      el.setAttribute("aria-pressed", String(Boolean(chosen)));
    });
  }
  function patchPanel() {
    const ports = [...Object.values(leads).flatMap((l) => [l.a, l.b])];
    const choices =
      option("", "Choose port", true) +
      ports.map((p) => option(p, p, false)).join("");
    return (
      '<h3>Patch the rack</h3><p class="panel-note">Select both physical endpoints, then connect the lead. Port order does not matter. The PDU downstream feeds are pre-wired. Pick two ports in the diagram or use the selectors.</p>' +
      portDiagram() +
      '<div class="form-row">' +
      selectField("port-a", "From port", choices) +
      selectField("port-b", "To port", choices) +
      '</div><div class="actions">' +
      button("Connect lead", 'data-act="connect"', "primary") +
      "</div>" +
      Object.entries(leads)
        .map(
          ([id, l]) =>
            '<div class="connection"><div><strong>' +
            l.name +
            "</strong><br>" +
            l.a +
            " ↔ " +
            l.b +
            "<br><small>" +
            (state.cables[id] ? "Connected" : "Open") +
            "</small></div>" +
            (state.cables[id]
              ? button(
                  "Unplug",
                  'data-unplug="' + id + '" aria-label="Unplug ' + l.name + '"',
                )
              : "") +
            "</div>",
        )
        .join("") +
      '<div class="actions">' +
      button(
        state.output ? "Disable UPS output" : "Enable UPS output",
        'data-act="power"',
      ) +
      "</div>"
    );
  }
  function networkPanel() {
    return (
      '<h3>Address the historian</h3><p class="panel-note">The work order reserves 10.42.8.20/24. Router: 10.42.8.1. Resolver: 10.42.8.10. Historian switch port: access VLAN 42.</p><form id="network-form" novalidate><div class="form-row">' +
      Object.entries(network)
        .map(
          ([id, [label]]) =>
            '<label class="field">' +
            label +
            '<input name="' +
            id +
            '" maxlength="30" autocomplete="off" spellcheck="false" inputmode="' +
            (["prefix", "vlan"].includes(id) ? "numeric" : "decimal") +
            '" value="' +
            escapeHtml(state.net[id]) +
            '"></label>',
        )
        .join("") +
      '</div><button class="primary">Apply settings</button></form>'
    );
  }
  function provePanel() {
    const results = tests(),
      ev = state.evidence;
    const row = (name, pass, text) =>
      '<div class="result ' +
      (pass ? "" : "bad") +
      '"><strong>' +
      (pass ? "PASS" : "FAIL") +
      " · " +
      name +
      "</strong>" +
      (text ? "<p>" + text + "</p>" : "") +
      "</div>";
    const list = state.tested
      ? '<h3>Configuration checks</h3><p class="panel-note">These inspect the saved settings and fitted leads; live service states are shown separately above.</p><div>' +
        results
          .map(([label, ok, why]) => row(label, ok, ok ? "" : why))
          .join("") +
        "</div>"
      : "";
    const operating = state.tested
      ? '<div class="ledger"><strong>Live service state</strong><br>Rack utility feed: ' +
        (state.fault.utility ? "interrupted" : "available") +
        " · PDU: " +
        (hasPower() ? (state.fault.utility ? "battery" : "utility") : "off") +
        "<br>Upstream distribution power: independent, available<br>Host-to-switch physical link: " +
        (localLink() ? "UP" : "DOWN") +
        "<br>Upstream path: " +
        (hasLink()
          ? "UP"
          : state.fault.uplink
            ? "DOWN (upstream interruption)"
            : "DOWN") +
        "<br>One observation only. No elapsed time, battery depletion or endurance is modelled.</div>"
      : "";
    const stamp = (done, text) =>
      "<li>" + (done ? "Verified: " : "Pending: ") + text + "</li>";
    return (
      '<h3>Prove operation and recovery</h3><p class="panel-note">Record a healthy baseline, interrupt the rack’s utility feed, observe the UPS and restore power, interrupt the uplink, then restore it. Upstream distribution has independent power. Run a test at each fault and again with both services restored.</p><div class="faults">' +
      button(
        state.fault.utility
          ? "Restore rack utility feed"
          : "Interrupt rack utility feed",
        'data-fault="utility" aria-pressed="' + state.fault.utility + '"',
      ) +
      button(
        state.fault.uplink ? "Restore uplink" : "Interrupt upstream link",
        'data-fault="uplink" aria-pressed="' + state.fault.uplink + '"',
      ) +
      '</div><div class="actions">' +
      button("Run acceptance test", 'data-act="test"', "primary") +
      "</div>" +
      operating +
      '<ul class="help">' +
      stamp(ev.baseline, "healthy baseline") +
      stamp(ev.battery, "UPS continuity on loss of the rack utility feed") +
      stamp(ev.loss, "expected upstream loss while the host stays powered") +
      stamp(ev.recovery, "restored end-to-end connectivity") +
      "</ul>" +
      (ev.recovery
        ? "<p><strong>Work order accepted.</strong> The outage, link-loss and restored conditions have all been observed.</p>"
        : "") +
      '<p><a class="guide" href="room-guide.html">Open the installation and handover guide ↗</a></p>' +
      list
    );
  }
  function refresh() {
    byId("steps").innerHTML = panels
      .map((name, i) =>
        button(
          i + 1 + ". " + name,
          'data-stage="' +
            name +
            '" aria-pressed="' +
            (state.stage === name) +
            '"',
        ),
      )
      .join("");
    panel.innerHTML = {
      Floor: floorPanel,
      Rack: rackPanel,
      Patch: patchPanel,
      Network: networkPanel,
      Prove: provePanel,
    }[state.stage]();
    byId("readout").innerHTML = [
      ["Bay", bays[state.bay]],
      [
        "PDU",
        hasPower()
          ? state.fault.utility
            ? "On battery"
            : "Utility feed"
          : "Off",
      ],
      ["Host link", localLink() ? "Up" : "Down"],
      ["Upstream", hasLink() ? "Up" : "Down"],
    ]
      .map(
        ([label, val]) =>
          "<div><small>" + label + "</small><b>" + val + "</b></div>",
      )
      .join("");
    view?.update({
      bay: state.bay,
      facing: state.facing,
      slots: { ...state.slots },
      cables: { ...state.cables },
      powered: hasPower(),
      selected: state.stage === "Rack" ? selected : null,
    });
    save();
  }
  function syncCamera(name) {
    preset = name;
    byId("picked").textContent = {
      room: "Room overview",
      rack: "Rack view",
      rear: "Rear view",
    }[name];
    document
      .querySelectorAll("[data-camera]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.camera === name)),
      );
  }
  function camera(name) {
    view?.camera(name);
    syncCamera(name);
  }
  byId("room-view").addEventListener("roomcamera", (event) => {
    if (event.detail === "room") syncCamera("room");
  });
  function setStage(name) {
    state.stage = name;
    say("");
    refresh();
    camera(
      {
        Floor: "room",
        Rack: "rack",
        Patch: "rear",
        Network: "rack",
        Prove: "room",
      }[name],
    );
  }
  function picked(id) {
    if (Object.hasOwn(names, id)) {
      selected = id;
      setStage("Rack");
      byId("picked").textContent = names[id] + " selected";
    } else if (Object.hasOwn(bays, id)) {
      if (state.bay !== id) {
        state.bay = id;
        invalidate();
      }
      setStage("Floor");
      byId("picked").textContent = "Rack: " + bays[id];
      say("Rack relocated to " + bays[id] + " in the floor model.");
    } else if (id === "rack") {
      setStage("Rack");
      byId("picked").textContent = "Rack selected";
    }
  }
  function runTest() {
    state.tested = true;
    const failures = tests().filter(([, ok]) => !ok);
    if (failures.length)
      return (
        failures.length +
        " configuration check(s) failed. First finding: " +
        failures[0][2]
      );
    const e = state.evidence;
    if (!state.fault.utility && !state.fault.uplink) {
      if (e.baseline && e.battery && e.loss) {
        e.recovery = true;
        return "Recovered: the historian is powered and the full link and network configuration pass. Work order accepted.";
      }
      e.baseline = true;
      return "Healthy baseline recorded. Test the utility and uplink interruptions separately.";
    }
    if (!e.baseline)
      return "Restore utility and uplink, then test a healthy baseline before recording a fault.";
    if (state.fault.utility && state.fault.uplink)
      return "Two faults active: isolate one fault at a time. Restore one service and retest.";
    if (state.fault.utility) {
      e.battery = true;
      return "UPS continuity observed: the rack utility feed is absent; the PDU is on battery and the independently powered upstream path is available at this observation. This is not a runtime test.";
    }
    e.loss = true;
    return "Expected link loss observed: the host stays powered but upstream communication is down. Restore the uplink and retest.";
  }
  function handleAction(id) {
    if (id === "install") {
      const u = Number(byId("unit").value),
        problem = placementError(state.slots, selected, u);
      if (problem) return problem;
      if (state.slots[selected] === u)
        return names[selected] + " is already at U" + u + ".";
      state.slots[selected] = u;
      invalidate();
      return names[selected] + " mounted starting at U" + u + ".";
    }
    if (id === "remove") {
      if (!state.slots[selected]) return names[selected] + " is not installed.";
      state.slots[selected] = 0;
      for (const [k, l] of Object.entries(leads))
        if (l.parts.includes(selected)) state.cables[k] = false;
      if (selected === "ups") state.output = false;
      invalidate();
      return names[selected] + " removed; its attached leads are disconnected.";
    }
    if (id === "connect") {
      const a = byId("port-a").value,
        b = byId("port-b").value;
      if (!a || !b || a === b)
        return "Choose two different named ports before connecting.";
      const match = Object.entries(leads).find(
        ([, l]) => [l.a, l.b].includes(a) && [l.a, l.b].includes(b),
      );
      if (!match)
        return "Port pairing rejected. Match the two endpoints shown for a single service below.";
      const [k, l] = match,
        missing = l.parts.filter((p) => !state.slots[p]);
      if (missing.length)
        return (
          "Cannot connect: fit " +
          missing.map((p) => names[p]).join(" and ") +
          " first."
        );
      if (state.cables[k]) return "This lead is already connected.";
      state.cables[k] = true;
      invalidate();
      return l.name + " connected.";
    }
    if (id === "power") {
      if (!state.slots.ups) return "Fit the UPS before enabling its output.";
      state.output = !state.output;
      invalidate();
      return state.output ? "UPS output enabled." : "UPS output disabled.";
    }
    if (id === "test") return runTest();
  }
  document.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if (d.camera) {
      camera(d.camera);
      return;
    }
    if (d.stage) {
      setStage(d.stage);
      byId("steps")
        .querySelector('[data-stage="' + d.stage + '"]')
        .focus();
      return;
    }
    let message;
    if (d.port) {
      const a = byId("port-a"),
        bPort = byId("port-b");
      if (a.value === d.port) a.value = "";
      else if (bPort.value === d.port) bPort.value = "";
      else if (!a.value) a.value = d.port;
      else if (!bPort.value) bPort.value = d.port;
      else {
        a.value = d.port;
        bPort.value = "";
      }
      highlightPorts();
      say(
        a.value && bPort.value
          ? "Both endpoints selected. Connect the lead to validate the pair."
          : "Select the other port.",
      );
      return;
    }
    if (d.fitUnit) {
      byId("unit").value = d.fitUnit;
      message = handleAction("install");
    }
    if (d.setting) {
      if (state[d.setting] !== d.value) {
        state[d.setting] = d.value;
        invalidate();
      }
      message = "Floor configuration updated.";
    }
    if (d.unplug) {
      state.cables[d.unplug] = false;
      invalidate();
      message = leads[d.unplug].name + " disconnected.";
    }
    if (d.fault) {
      state.fault[d.fault] = !state.fault[d.fault];
      state.evidence.recovery = false;
      message =
        (d.fault === "utility" ? "Rack utility feed" : "Upstream uplink") +
        (state.fault[d.fault] ? " interrupted." : " restored.") +
        " Run the test to record the observation.";
    }
    if (d.act) message = handleAction(d.act);
    if (b.id === "reset") {
      if (
        !window.confirm(
          "Reset this simulated work order, including saved rack, settings and test evidence?",
        )
      )
        return;
      state = defaults();
      selected = "ups";
      camera("room");
      byId("picked").textContent = "Room overview";
      message = "Work order reset.";
    }
    if (message) {
      refresh();
      say(message);
      if (d.unplug)
        panel
          .querySelector('[data-port="' + leads[d.unplug].a + '"]')
          ?.focus({ preventScroll: true });
      else if (d.fitUnit)
        panel
          .querySelector('[data-fit-unit="' + d.fitUnit + '"]')
          ?.focus({ preventScroll: true });
      else if (d.act)
        panel
          .querySelector('[data-act="' + d.act + '"]')
          ?.focus({ preventScroll: true });
      else if (d.setting)
        panel
          .querySelector(
            '[data-setting="' + d.setting + '"][data-value="' + d.value + '"]',
          )
          ?.focus({ preventScroll: true });
      else if (d.fault)
        panel
          .querySelector('[data-fault="' + d.fault + '"]')
          ?.focus({ preventScroll: true });
    }
  });
  panel.addEventListener("change", (event) => {
    if (event.target.id === "port-a" || event.target.id === "port-b")
      highlightPorts();
    if (event.target.id === "device") {
      selected = event.target.value;
      refresh();
      byId("picked").textContent = names[selected] + " selected";
      byId("device").focus({ preventScroll: true });
    }
  });
  panel.addEventListener("submit", (event) => {
    if (event.target.id !== "network-form") return;
    event.preventDefault();
    const values = new FormData(event.target),
      next = {};
    for (const id of Object.keys(network))
      next[id] = String(values.get(id) || "").trim();
    if (Object.keys(network).some((id) => next[id] !== state.net[id]))
      invalidate();
    state.net = next;
    refresh();
    panel.querySelector("#network-form button").focus({ preventScroll: true });
    say(
      "Network profile applied. Run acceptance to test the addressing, routing, DNS and VLAN settings.",
    );
  });
  try {
    view = createRoomView(byId("room-view"), picked);
  } catch {
    byId("view-fallback").hidden = false;
  }
  refresh();
  camera(
    {
      Floor: "room",
      Rack: "rack",
      Patch: "rear",
      Network: "rack",
      Prove: "room",
    }[state.stage],
  );
  window.addEventListener("pagehide", (e) => {
    if (!e.persisted) view?.destroy();
  });
})();
