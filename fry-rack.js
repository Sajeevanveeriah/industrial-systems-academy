(() => {
  "use strict";
  const devices = {
    ups: { name: "UPS", size: 2, prefix: "UPS.", finish: "ups" },
    hostA: {
      name: "Compute host A",
      size: 2,
      prefix: "HOST-A.",
      finish: "host",
    },
    hostB: {
      name: "Compute host B",
      size: 2,
      prefix: "HOST-B.",
      finish: "host",
    },
    sw: { name: "Managed switch", size: 1, prefix: "SW.", finish: "switch" },
  };
  const leadNames = {
    "UPS.OUT": "Protected PDU supply",
    "PDU.1": "Host A power",
    "PDU.2": "Host B power",
    "PDU.3": "Switch power",
    "SW.P1": "Host A Ethernet",
    "SW.P2": "Host B Ethernet",
    "SW.P3": "PLC Ethernet",
    "DI.0": "Start request",
    "DI.1": "Process guard status",
    "DI.2": "Line ready",
    "DO.0": "Line enable",
  };
  const groups = [
    {
      name: "Power distribution",
      code: "PDU",
      ports: ["PDU.IN", "PDU.1", "PDU.2", "PDU.3"],
    },
    { name: "Controller", code: "CPU", ports: ["PLC.ETH"] },
    { name: "Digital inputs", code: "DI-8", ports: ["DI.0", "DI.1", "DI.2"] },
    { name: "Digital outputs", code: "DO-8", ports: ["DO.0"] },
    {
      name: "Field simulator",
      code: "SIM",
      ports: ["SIM.START", "SIM.GUARD", "SIM.READY", "SIM.ENABLE"],
    },
  ];
  const wireColours = {
    power: "#a85a16",
    ethernet: "#166b9c",
    signal: "#387a50",
    incorrect: "#a44450",
  };
  const mounts = new WeakMap();
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
  const wireType = (s) =>
    s.startsWith("PDU.") || s === "UPS.OUT" || s.endsWith(".PWR")
      ? "power"
      : s === "PLC.ETH" || s.endsWith(".NIC") || s.startsWith("SW.P")
        ? "ethernet"
        : "signal";
  const deviceFor = (s) =>
    Object.keys(devices).find((id) => s.startsWith(devices[id].prefix));
  const isPair = (wire, a, b) =>
    Array.isArray(wire) &&
    wire.length === 2 &&
    ((wire[0] === a && wire[1] === b) || (wire[0] === b && wire[1] === a));
  function wires(s) {
    return Array.isArray(s.patch) ? s.patch : [];
  }
  function mounted(s, id) {
    const u = s.rack?.[id];
    return Number.isInteger(u) && u >= 1 && u + devices[id].size - 1 <= 12;
  }
  function placement(s, id, unit) {
    if (
      !devices[id] ||
      !Number.isInteger(unit) ||
      unit < 1 ||
      unit + devices[id].size - 1 > 12
    )
      return "The chassis extends outside the 12U rack. Select a lower starting unit.";
    const end = unit + devices[id].size - 1;
    for (const other of Object.keys(devices)) {
      if (other === id || !mounted(s, other)) continue;
      const start = s.rack[other];
      if (start <= end && unit < start + devices[other].size)
        return (
          "U" +
          unit +
          " overlaps " +
          devices[other].name +
          " at U" +
          start +
          ". Choose adjacent free units."
        );
    }
    return "";
  }
  const style = `
.frb {
  container-type: inline-size;
  --fi-ink: #203a34;
  --fi-muted: #496258;
  --fi-border: #b9cac0;
  --fi-green: #235e49;
  background: #f7faf7;
  color: var(--fi-ink);
  font:
    15px/1.45 "Segoe UI",
    Arial,
    sans-serif;
  border: 1px solid var(--fi-border);
  border-radius: 15px;
  padding: clamp(12px, 2.3vw, 25px);
  overflow: hidden;
}
.frb * {
  box-sizing: border-box;
}
.frb h3,
.frb h4,
.frb p {
  margin: 0;
}
.frb button {
  font: inherit;
  cursor: pointer;
  color: var(--fi-ink);
}
.frb button:focus-visible,
.frb summary:focus-visible {
  outline: 3px solid #166d9d;
  outline-offset: 3px;
}
.frb-top,
.frb-tools,
.frb-switch,
.frb-title,
.frb-legend,
.frb-devices {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.frb-top,
.frb-title {
  justify-content: space-between;
}
.frb-top h3 {
  font-size: clamp(1.3rem, 3vw, 1.8rem);
  letter-spacing: -0.04em;
}
.frb-switch {
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--fi-border);
  background: #e6eee7;
  border-radius: 8px;
}
.frb-switch button,
.frb-devices button,
.frb-action {
  border: 1px solid transparent;
  padding: 6px 10px;
  background: transparent;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 600;
}
.frb-switch button[aria-pressed="true"],
.frb-devices button[aria-pressed="true"] {
  background: var(--fi-green);
  color: #fff;
  border-color: var(--fi-green);
}
.frb-brief {
  color: var(--fi-muted);
  margin: 9px 0 12px !important;
}
.frb-tools {
  justify-content: space-between;
  padding: 10px 0;
  border-block: 1px solid var(--fi-border);
  margin-bottom: 13px;
}
.frb-devices button,
.frb-action {
  background: #fff;
  border-color: var(--fi-border);
}
.frb button:disabled {
  cursor: default;
  opacity: 0.68;
}
.frb-status {
  background: #e7f2e9;
  border-left: 3px solid #56846a;
  margin: 10px 0 !important;
  padding: 9px 11px;
  color: #224b36;
  min-height: 38px;
}
.frb-status[data-tone="error"] {
  background: #f9ede5;
  border-color: #ac7140;
  color: #754016;
}
.frb-bench {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr);
  gap: clamp(14px, 3vw, 34px);
  position: relative;
  isolation: isolate;
  padding: 8px 8px 12px;
  background:
    repeating-linear-gradient(90deg, transparent 0 29px, #dbe5db 30px), #e9f0e9;
  border-radius: 10px;
}
.frb-wires {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}
.frb-box {
  min-width: 0;
  align-self: start;
  padding: 8px;
  background: linear-gradient(125deg, #e4ebe7, #b9c8bf);
  border: 2px solid #798d82;
  border-radius: 8px;
  box-shadow: 3px 5px 0 #909e9160;
}
.frb-title {
  padding: 3px 3px 8px;
  gap: 5px;
  color: #273f36;
}
.frb-title h4 {
  font-size: 15px;
  line-height: 1.25;
}
.frb-title small,
.frb-panel small,
.frb-summary,
.frb .frb-count {
  font:
    600 11px/1.4 Consolas,
    monospace;
  color: #475e52;
}
.frb-slots {
  display: grid;
  grid-template-rows: repeat(12, 38px);
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 2px;
  padding: 4px;
  background: #63766b;
  border: 2px solid #4a5a51;
  border-radius: 4px;
  position: relative;
}
.frb-bench[data-view="rear"] .frb-slots {
  grid-template-rows: repeat(12, 43px);
}
.frb-u,
.frb-slot {
  border: 0;
  border-radius: 1px;
  min-width: 0;
  font:
    600 11px/1 Consolas,
    monospace !important;
}
.frb-u {
  position: relative;
  z-index: 3;
  background: #dae3da;
  color: #324d3c;
  padding: 0;
}
.frb-u:before,
.frb-u:after {
  content: "";
  display: block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  margin: 3px auto;
  background: #778c7b;
}
.frb-slot {
  background: repeating-linear-gradient(0deg, #d2ddd4 0 8px, #c8d4ca 9px);
  color: #55685b !important;
  text-align: right;
  padding: 0 6px;
}
.frb-slot:hover,
.frb-u:hover,
.frb-slot.frb-drop {
  background: #e5f4da;
  outline: 2px solid #6d9962;
  outline-offset: -2px;
}
.frb-chassis {
  grid-column: 2;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  position: relative;
  border: 1px solid #647c70;
  border-inline: 5px double #637a6c;
  border-radius: 3px;
  padding: 3px 6px;
  background: linear-gradient(100deg, #e5ebe5, #b5c4be);
  color: #20372e;
}
.frb-front {
  z-index: 3;
  text-align: left;
  cursor: pointer;
}
.frb-chassis.frb-selected {
  box-shadow: inset 0 0 0 2px #286749;
}
.frb-chassis.frb-ups {
  background: linear-gradient(100deg, #708177, #43594e);
  color: #fff !important;
}
.frb-chassis.frb-switch {
  background: linear-gradient(110deg, #acccc7, #90b6b0);
}
.frb-chassis b {
  font-size: 11px;
  line-height: 1.15;
  letter-spacing: 0;
}
.frb-vents {
  flex: 1;
  min-width: 12px;
  height: 52%;
  background: repeating-linear-gradient(
    90deg,
    #53665f 0 3px,
    transparent 3px 7px
  );
  opacity: 0.8;
}
.frb-drives {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 1;
}
.frb-drives i {
  display: inline-block;
  height: 24px;
  flex: 1;
  background: #485d56;
  border-radius: 2px;
  border-bottom: 4px solid #859b8c;
}
.frb-screen {
  width: 23px;
  height: 10px;
  border: 2px solid #375248;
  background: #b0d5ac;
}
.frb-rear {
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 2px;
  padding: 2px 3px;
}
.frb-rear b {
  font:
    600 9px/1 Consolas,
    monospace;
}
.frb-ports {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: flex-start;
}
.frb-port {
  position: relative;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 26px;
  padding: 3px 5px;
  border: 1px solid #84988a;
  border-radius: 3px;
  background: #fbfdf9;
  color: #294538 !important;
  font:
    600 10px/1.15 Consolas,
    monospace !important;
  white-space: nowrap;
}
.frb-port i {
  display: inline-block;
  background: #35493f;
  width: 11px;
  height: 9px;
  border: 1px solid #a9baae;
  border-bottom: 3px solid #728e7d;
  border-radius: 1px;
}
.frb-port[data-type="power"] i {
  border-radius: 50%;
  height: 11px;
}
.frb-port[data-type="signal"] i {
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    #57705e 0 43%,
    #e8f2e6 43% 57%,
    #57705e 57%
  );
}
.frb-port[data-connected="true"] {
  border-color: var(--socket);
  box-shadow: inset 0 -2px var(--socket);
}
.frb-port[data-target="true"] {
  outline: 2px dashed #759a68;
  outline-offset: 1px;
}
.frb-port[aria-pressed="true"] {
  color: white !important;
  background: #215e49;
  outline: 2px solid #215e49;
}
.frb-rear .frb-port {
  font-size: 9px !important;
  min-height: 17px;
  padding: 2px 3px;
  gap: 2px;
}
.frb-rear .frb-port i {
  width: 7px;
  height: 7px;
}
.frb-rear .frb-ports {
  gap: 3px;
  flex-wrap: nowrap;
}
.frb-panel {
  position: relative;
  border: 1px solid #91a295;
  border-left: 5px solid var(--socket);
  border-radius: 3px;
  background: #eaf0e9;
  margin-bottom: 8px;
  padding: 9px 8px 10px;
}
.frb-panel:last-child {
  margin-bottom: 0;
}
.frb-panel .frb-title {
  padding: 0 0 7px;
}
.frb-panel h5 {
  margin: 0;
  font-size: 13px;
}
.frb-panel small {
  font-size: 9px;
}
.frb-legend {
  font-size: 12px;
  color: var(--fi-muted);
  margin: 9px 0 0;
}
.frb-legend i {
  display: inline-block;
  width: 17px;
  height: 4px;
  vertical-align: middle;
  margin-right: 3px;
  border-radius: 3px;
}
.frb-guide {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--fi-border);
}
.frb-guide summary {
  cursor: pointer;
  font-weight: 700;
}
.frb-schedule {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  margin-top: 10px;
}
.frb-lead {
  font-size: 12px !important;
  text-align: left;
  background: #fff;
  border: 1px solid var(--fi-border);
  border-radius: 5px;
  padding: 7px 8px;
}
.frb-lead span {
  display: block;
  font:
    11px/1.4 Consolas,
    monospace;
  color: var(--fi-muted);
}
.frb-lead[aria-pressed="true"] {
  border-color: var(--fi-green);
  box-shadow: inset 2px 0 var(--fi-green);
}
.frb-footnote {
  margin-top: 6px !important;
  color: var(--fi-muted);
  font-size: 12px;
}
.frb-loose {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
  padding: 4px 0;
}
.frb-loose button {
  padding: 3px 6px;
}
@container (max-width:650px) {
  .frb-bench {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    padding-right: 18px;
  }
  .frb-box {
    padding: 6px;
  }
  .frb-top {
    gap: 10px;
  }
  .frb-slots {
    grid-template-rows: repeat(12, 31px);
  }
  .frb-bench[data-view="rear"] .frb-slots {
    grid-template-rows: repeat(12, 32px);
  }
  .frb-schedule {
    grid-template-columns: 1fr;
  }
  .frb-brief {
    font-size: 14px;
  }
  .frb-slot {
    font-size: 9px !important;
  }
  .frb-title h4 {
    font-size: 14px;
  }
  .frb-rear.frb-switch {
    flex-direction: row;
    align-items: center;
    gap: 3px;
  }
  .frb-rear.frb-switch b {
    display: none;
  }
}
.frb-jacks {
  display: flex;
  gap: 4px;
  flex: 1;
  justify-content: flex-end;
}
.frb-jacks i {
  display: block;
  height: 14px;
  width: 16px;
  border: 2px solid #81968c;
  border-bottom-width: 4px;
  background: #30483d;
  box-shadow: inset 0 2px 0 #263d32;
}
.frb-drives i {
  position: relative;
}
.frb-drives i:after {
  content: "";
  position: absolute;
  inset: 4px 5px auto auto;
  width: 5px;
  height: 3px;
  background: #bdd2b4;
}
.frb-drives i:before {
  content: "";
  position: absolute;
  inset: 10px 4px auto;
  width: auto;
  height: 4px;
  border-block: 1px solid #748b7d;
}
@container (max-width:340px) {
  .frb-bench[data-view="rear"] .frb-slots {
    grid-template-rows: repeat(12, 40px);
  }
  .frb-rear .frb-ports {
    flex-wrap: wrap;
    gap: 2px;
  }
  .frb-rear.frb-switch {
    align-content: center;
  }
}
@media (prefers-reduced-motion: reduce) {
  .frb * {
    scroll-behavior: auto;
  }
}
`;
  function mount(root, s, onChange, readonly = false) {
    mounts.get(root)?.destroy();
    const design = window.FryInstall.solved(),
      schedule = design.patch;
    const known = new Set(schedule.flat());
    const css = document.createElement("style");
    css.textContent = style;
    const wrapper = document.createElement("section");
    wrapper.className = "frb";
    wrapper.setAttribute("aria-label", "Physical rack and wiring bench");
    wrapper.innerHTML =
      '<div class="frb-top"><h3>Rack and wiring bench</h3><div class="frb-switch" role="group" aria-label="Cabinet view"><button type="button" data-view="front">Front elevation</button><button type="button" data-view="rear">Rear patching</button></div></div><p class="frb-brief"></p><div class="frb-tools"></div><p class="frb-status" role="status" aria-live="polite"></p><div class="frb-bench"></div><div class="frb-legend" aria-label="Cable colours"></div><details class="frb-guide" open><summary>Endpoint schedule <span class="frb-count"></span></summary><p class="frb-footnote">Select a lead to locate its two sockets.</p><div class="frb-schedule"></div><div class="frb-extra"></div></details>';
    root.replaceChildren(css, wrapper);
    const find = (selector) => wrapper.querySelector(selector);
    let view = "front",
      device = "ups",
      pending = null,
      target = null,
      notice = "",
      tone = "",
      paintRequest = 0,
      disposed = false;
    const legend = find(".frb-legend");
    legend.innerHTML = Object.entries(wireColours)
      .map(
        ([type, col]) =>
          '<span><i style="background:' +
          col +
          '"></i>' +
          {
            power: "Power",
            ethernet: "Ethernet",
            signal: "Digital I/O",
            incorrect: "Check pairing",
          }[type] +
          "</span>",
      )
      .join("");
    function say(message, isError = false) {
      notice = message;
      tone = isError ? "error" : "normal";
      find(".frb-status").textContent = message;
      find(".frb-status").dataset.tone = tone;
    }
    function connection(port) {
      return wires(s).find(
        (pair) => Array.isArray(pair) && pair.includes(port),
      );
    }
    function peer(pair, port) {
      return pair[0] === port ? pair[1] : pair[0];
    }
    function expected(a, b) {
      return schedule.some((w) => isPair(w, a, b));
    }
    function ports(list) {
      return (
        '<div class="frb-ports">' +
        list
          .map((p) => {
            const connected = connection(p),
              type = wireType(p),
              right = connected && expected(...connected);
            const targetPort = target !== null && schedule[target]?.includes(p);
            const title =
              p +
              (connected ? ", connected to " + peer(connected, p) : ", open");
            return (
              '<button type="button" class="frb-port" data-port="' +
              esc(p) +
              '" data-type="' +
              type +
              '" data-connected="' +
              !!connected +
              '" data-target="' +
              targetPort +
              '" aria-pressed="' +
              (pending === p) +
              '" aria-label="' +
              esc(title) +
              '" title="' +
              esc(title) +
              '" style="--socket:' +
              wireColours[connected && !right ? "incorrect" : type] +
              '"><i aria-hidden="true"></i><span>' +
              esc(p) +
              "</span></button>"
            );
          })
          .join("") +
        "</div>"
      );
    }
    function rackSlots() {
      const slots = [];
      for (let u = 12; u >= 1; u--) {
        const row = 13 - u;
        const occupant = Object.keys(devices).find(
          (id) =>
            mounted(s, id) &&
            u >= s.rack[id] &&
            u < s.rack[id] + devices[id].size,
        );
        const caption =
          "U" + u + " / " + (occupant ? devices[occupant].name : "free");
        const disabled = readonly || view === "rear" ? " disabled" : "";
        slots.push(
          '<button type="button" data-unit="' +
            u +
            '" class="frb-u" style="grid-area:' +
            row +
            ' / 1" aria-label="' +
            esc(
              readonly || view === "rear"
                ? caption
                : "Mount " +
                    devices[device].name +
                    " starting at U" +
                    u +
                    ", " +
                    (occupant ? devices[occupant].name : "free"),
            ) +
            '"' +
            disabled +
            ">U" +
            u +
            "</button>",
        );
        if (!occupant) {
          slots.push(
            '<button type="button" data-slot="' +
              u +
              '" class="frb-slot" style="grid-area:' +
              row +
              ' / 2" aria-label="Free U' +
              u +
              '"' +
              disabled +
              ">Free</button>",
          );
        }
      }
      for (const [id, d] of Object.entries(devices)) {
        if (!mounted(s, id)) continue;
        const u = s.rack[id],
          pos = "grid-row:" + String(14 - u - d.size) + " / span " + d.size;
        const range =
          d.size === 1 ? "U" + u : "U" + u + " to U" + (u + d.size - 1);
        const shell =
          "frb-chassis frb-" +
          d.finish +
          (id === device ? " frb-selected" : "");
        if (view === "rear") {
          slots.push(
            '<div class="' +
              shell +
              ' frb-rear" style="' +
              pos +
              '"><b>' +
              esc(d.name) +
              " / " +
              range +
              "</b>" +
              ports([...known].filter((p) => deviceFor(p) === id)) +
              "</div>",
          );
          continue;
        }
        const grille =
          id === "ups"
            ? '<span class="frb-vents"></span><span class="frb-screen"></span>'
            : id === "sw"
              ? '<span class="frb-jacks" aria-hidden="true"><i></i><i></i><i></i><i></i></span>'
              : '<span class="frb-drives"><i></i><i></i><i></i><i></i></span>';
        slots.push(
          '<button type="button" class="' +
            shell +
            ' frb-front" data-chassis="' +
            id +
            '" draggable="' +
            !readonly +
            '" aria-pressed="' +
            (id === device) +
            '" aria-label="' +
            esc(d.name + " fitted at " + range) +
            '" style="' +
            pos +
            '"><b>' +
            esc(d.name) +
            "<br>" +
            range +
            "</b>" +
            grille +
            "</button>",
        );
      }
      return slots.join("");
    }
    function panels() {
      return groups
        .map(
          (g) =>
            '<div class="frb-panel" style="--socket:' +
            wireColours[wireType(g.ports[0])] +
            '"><div class="frb-title"><h5>' +
            g.name +
            "</h5><small>" +
            g.code +
            "</small></div>" +
            ports(g.ports) +
            "</div>",
        )
        .join("");
    }
    function refresh() {
      if (disposed) return;
      if (pending && deviceFor(pending) && !mounted(s, deviceFor(pending)))
        pending = null;
      wrapper
        .querySelectorAll(".frb-switch [data-view]")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.view === view)),
        );
      find(".frb-brief").textContent = readonly
        ? "Inspect the fitted equipment, then switch to rear patching to trace the worked installation."
        : view === "front"
          ? "Select or drag a device, then choose its lowest rack unit. The work order reserves U1 and U2 for the UPS."
          : "Select a socket and its partner to fit a lead. Select both ends of an existing lead to unplug it.";
      const mountedCount = Object.keys(devices).filter((id) =>
        mounted(s, id),
      ).length;
      if (view === "front") {
        find(".frb-tools").innerHTML =
          '<div class="frb-devices" role="group" aria-label="Device tray">' +
          Object.entries(devices)
            .map(
              ([id, d]) =>
                '<button type="button" draggable="' +
                !readonly +
                '" data-device="' +
                id +
                '" aria-pressed="' +
                (id === device) +
                '">' +
                d.name +
                " · " +
                d.size +
                "U</button>",
            )
            .join("") +
          "</div>" +
          (readonly
            ? ""
            : '<button type="button" class="frb-action" data-remove ' +
              (mounted(s, device) ? "" : "disabled") +
              ">Remove selected device</button>");
      } else {
        const chooseText = pending
          ? "First socket: " + pending
          : "Choose the first socket";
        find(".frb-tools").innerHTML =
          '<b class="frb-summary">' +
          esc(readonly ? "Worked wiring schedule" : chooseText) +
          "</b>" +
          (readonly
            ? ""
            : '<button type="button" class="frb-action" data-cancel ' +
              (pending ? "" : "disabled") +
              ">Cancel socket selection</button>");
      }
      const bench = find(".frb-bench");
      bench.dataset.view = view;
      bench.innerHTML =
        '<div class="frb-box"><div class="frb-title"><h4>Compute rack</h4><small>12U / ' +
        mountedCount +
        ' of 4 fitted</small></div><div class="frb-slots">' +
        rackSlots() +
        '</div></div><div class="frb-box"><div class="frb-title"><h4>Power and control cabinet</h4><small>Field I/O</small></div>' +
        panels() +
        '</div><canvas class="frb-wires" aria-hidden="true"></canvas>';
      const passed = schedule.filter(([a, b]) =>
        wires(s).some((w) => isPair(w, a, b)),
      ).length;
      find(".frb-count").textContent =
        passed + " / " + schedule.length + " matched";
      find(".frb-schedule").innerHTML = schedule
        .map(([a, b], i) => {
          const matched = wires(s).some((w) => isPair(w, a, b));
          return (
            '<button class="frb-lead" type="button" data-lead="' +
            i +
            '" aria-pressed="' +
            (i === target) +
            '">' +
            esc(leadNames[a] || a) +
            " · " +
            (matched ? "Connected" : "Open") +
            "<span>" +
            esc(a) +
            " ↔ " +
            esc(b) +
            "</span></button>"
          );
        })
        .join("");
      find(".frb-extra").innerHTML = wires(s)
        .map((w, i) => {
          if (!Array.isArray(w) || w.length !== 2) return "";
          const absent = w.some(
            (p) => !known.has(p) || (deviceFor(p) && !mounted(s, deviceFor(p))),
          );
          if (!absent && expected(...w)) return "";
          const why = absent ? "Device missing" : "Check pairing";
          return (
            '<div class="frb-loose"><span>' +
            esc(w.join(" ↔ ")) +
            " · " +
            why +
            "</span>" +
            (readonly
              ? ""
              : '<button type="button" class="frb-action" data-drop="' +
                i +
                '">Unplug</button>') +
            "</div>"
          );
        })
        .join("");
      find(".frb-status").textContent =
        notice ||
        (readonly
          ? "Worked installation. Select a socket to inspect its connection."
          : view === "front"
            ? "Selected " + devices[device].name + ". Choose a rack unit."
            : "Choose a socket or locate a lead using the schedule.");
      find(".frb-status").dataset.tone = tone;
      queue();
    }
    function renderWires() {
      paintRequest = 0;
      if (disposed || view !== "rear") return;
      const bench = find(".frb-bench"),
        canvas = bench.querySelector("canvas"),
        rect = bench.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * scale);
      canvas.height = Math.round(rect.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      const sockets = new Map(
        [...bench.querySelectorAll("[data-port]")].map((el) => [
          el.dataset.port,
          el,
        ]),
      );
      const cabinets = bench.querySelectorAll(".frb-box"),
        r = cabinets[0].getBoundingClientRect(),
        f = cabinets[1].getBoundingClientRect(),
        stacked = f.top > r.top + 20;
      const coord = (el) => {
        const a = el.querySelector("i").getBoundingClientRect();
        return {
          x: a.left - rect.left + a.width / 2,
          y: a.top - rect.top + a.height / 2,
          rack: el.closest(".frb-box") === cabinets[0],
        };
      };
      const rows = wires(s)
        .map((wire, i) => ({ wire, i }))
        .filter(
          ({ wire }) =>
            Array.isArray(wire) && sockets.has(wire[0]) && sockets.has(wire[1]),
        );
      const highlighted = (wire) =>
        wire.includes(pending) ||
        (target !== null && isPair(wire, ...schedule[target]));
      rows.sort(
        (a, b) => Number(highlighted(a.wire)) - Number(highlighted(b.wire)),
      );
      for (const { wire, i } of rows) {
        const a = coord(sockets.get(wire[0])),
          b = coord(sockets.get(wire[1]));
        const offset = ((i % 11) - 5) * 1.05;
        const gap = (f.left + r.right) / 2 - rect.left;
        const route = stacked
          ? rect.width - 10 + offset
          : a.rack && b.rack
            ? r.right - rect.left - 2 + offset
            : !a.rack && !b.rack
              ? f.right - rect.left - 5 + offset
              : gap + offset;
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.bezierCurveTo(a.x, a.y + 16, route, a.y + 8, route, a.y + 18);
          ctx.lineTo(route, b.y + 18);
          ctx.bezierCurveTo(route, b.y + 8, b.x, b.y + 16, b.x, b.y);
        };
        const colour =
          wireColours[expected(...wire) ? wireType(wire[0]) : "incorrect"];
        const active = highlighted(wire);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.setLineDash([]);
        path();
        ctx.strokeStyle = "#f7fbf3";
        ctx.lineWidth = active ? 6.1 : 4.1;
        ctx.stroke();
        path();
        ctx.strokeStyle = colour;
        ctx.lineWidth = active ? 4.0 : 2.2;
        if (!expected(...wire)) ctx.setLineDash([5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    function queue() {
      if (!disposed && !paintRequest)
        paintRequest = requestAnimationFrame(renderWires);
    }
    function commit(message, focusSelector) {
      notice = message;
      tone = "normal";
      refresh();
      onChange?.(s);
      if (!disposed && focusSelector)
        find(focusSelector)?.focus({ preventScroll: true });
    }
    function mountUnit(u) {
      if (readonly || view !== "front") return;
      const issue = placement(s, device, u);
      if (issue) {
        say(issue, true);
        return;
      }
      if (s.rack?.[device] === u) {
        say(devices[device].name + " is already fitted at U" + u + ".");
        return;
      }
      s.rack ??= {};
      s.rack[device] = u;
      const check =
        device === "ups" && u !== 1
          ? " The work order reserves U1 and U2 for this UPS."
          : "";
      commit(
        devices[device].name + " mounted starting at U" + u + "." + check,
        '[data-unit="' + u + '"]',
      );
    }
    function unmount() {
      if (readonly || !mounted(s, device)) return;
      const attached = wires(s).filter(
        (w) => Array.isArray(w) && w.some((p) => deviceFor(p) === device),
      );
      delete s.rack[device];
      if (attached.length)
        s.patch = wires(s).filter((w) => !attached.includes(w));
      pending = null;
      commit(
        devices[device].name +
          " removed. " +
          attached.length +
          " attached lead" +
          (attached.length === 1 ? "" : "s") +
          " unplugged.",
        '[data-device="' + device + '"]',
      );
    }
    function socket(p) {
      if (!known.has(p)) return;
      view = "rear";
      const wired = connection(p);
      if (readonly) {
        pending = p;
        say(
          wired
            ? p + " is connected to " + peer(wired, p) + "."
            : p + " is open.",
        );
        refresh();
        focusPort(p);
        return;
      }
      if (!pending) {
        pending = p;
        say(
          wired
            ? p +
                " is connected to " +
                peer(wired, p) +
                ". Select that socket to unplug the lead."
            : p + " selected. Choose its partner.",
        );
        refresh();
        focusPort(p);
        return;
      }
      const a = pending;
      if (p === a) {
        pending = null;
        say("Socket selection cleared.");
        refresh();
        focusPort(p);
        return;
      }
      const existing = wires(s).findIndex((w) => isPair(w, a, p));
      if (existing >= 0) {
        s.patch.splice(existing, 1);
        pending = null;
        commit(a + " and " + p + " unplugged.", '[data-port="' + p + '"]');
        return;
      }
      if (connection(a) || wired) {
        say(
          "A socket is occupied. Select both ends of its existing lead to unplug it first.",
          true,
        );
        return;
      }
      if (wireType(a) !== wireType(p)) {
        say(
          "These sockets use different interfaces. Choose another " +
            wireType(a) +
            " socket or cancel.",
          true,
        );
        return;
      }
      s.patch ??= [];
      s.patch.push([a, p]);
      pending = null;
      commit(
        a +
          " connected to " +
          p +
          ". " +
          (expected(a, p)
            ? "The lead matches the schedule."
            : "This pairing differs from the endpoint schedule."),
        '[data-port="' + p + '"]',
      );
    }
    function focusPort(p) {
      find('[data-port="' + p + '"]')?.focus({ preventScroll: true });
    }
    function chooseDevice(id) {
      if (!devices[id]) return;
      device = id;
      pending = null;
      notice =
        devices[id].name +
        " selected" +
        (mounted(s, id) ? " at U" + s.rack[id] : "") +
        (readonly ? "." : ". Choose a starting unit to fit or move it.");
      tone = "normal";
      refresh();
    }
    function click(e) {
      const b = e.target.closest("button");
      if (!b || !wrapper.contains(b) || b.disabled) return;
      const d = b.dataset;
      if (d.view) {
        view = d.view;
        pending = null;
        notice = "";
        tone = "";
        refresh();
        return;
      }
      if (d.device || d.chassis) {
        chooseDevice(d.device || d.chassis);
        find('[data-device="' + device + '"]')?.focus({ preventScroll: true });
        return;
      }
      if (d.unit || d.slot) {
        mountUnit(Number(d.unit || d.slot));
        return;
      }
      if (d.port) {
        socket(d.port);
        return;
      }
      if (d.lead !== undefined) {
        target = Number(d.lead);
        view = "rear";
        pending = null;
        const [a, z] = schedule[target];
        const missing = [a, z]
          .map(deviceFor)
          .filter((id) => id && !mounted(s, id));
        say(
          (leadNames[a] || "Lead") +
            ": " +
            a +
            " ↔ " +
            z +
            "." +
            (missing.length
              ? " Fit " +
                [...new Set(missing)]
                  .map((id) => devices[id].name)
                  .join(" and ") +
                " to expose its sockets."
              : " Both sockets are outlined."),
        );
        refresh();
        find('[data-lead="' + target + '"]')?.focus({ preventScroll: true });
        return;
      }
      if (b.hasAttribute("data-cancel")) {
        pending = null;
        notice = "Socket selection cleared.";
        tone = "normal";
        refresh();
        return;
      }
      if (readonly) return;
      if (b.hasAttribute("data-remove")) unmount();
      if (d.drop !== undefined) {
        const i = Number(d.drop),
          w = wires(s)[i];
        if (!Array.isArray(w)) return;
        s.patch.splice(i, 1);
        pending = null;
        commit(w.join(" and ") + " unplugged.");
      }
    }
    let dragId = null;
    function dragStart(e) {
      const b = e.target.closest("[data-device],[data-chassis]");
      if (readonly || view !== "front" || !b || !e.dataTransfer) return;
      dragId = b.dataset.device || b.dataset.chassis;
      e.dataTransfer.setData("text/plain", dragId);
      e.dataTransfer.effectAllowed = "move";
    }
    function dragOver(e) {
      if (!dragId || readonly || view !== "front") return;
      const b = e.target.closest("[data-slot],[data-unit]");
      if (!b) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
    function drop(e) {
      const b = e.target.closest("[data-slot],[data-unit]");
      if (!dragId || readonly || !b) return;
      e.preventDefault();
      device = dragId;
      dragId = null;
      const u = Number(b.dataset.slot || b.dataset.unit);
      refresh();
      mountUnit(u);
    }
    function dragEnd() {
      dragId = null;
    }
    wrapper.addEventListener("click", click);
    wrapper.addEventListener("dragstart", dragStart);
    wrapper.addEventListener("dragover", dragOver);
    wrapper.addEventListener("drop", drop);
    wrapper.addEventListener("dragend", dragEnd);
    const observer = new ResizeObserver(queue);
    observer.observe(find(".frb-bench"));
    refresh();
    const api = {
      update: refresh,
      destroy() {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(paintRequest);
        observer.disconnect();
        wrapper.remove();
        css.remove();
        mounts.delete(root);
      },
    };
    mounts.set(root, api);
    return api;
  }
  window.FryRack = Object.freeze({ mount });
})();
