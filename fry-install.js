/* Standalone fry-plant commissioning simulator. All addresses and device identities are fictional. */
(function () {
  "use strict";
  const stages = [
    "receive",
    "wash",
    "peel",
    "cut",
    "blanch",
    "dry",
    "fry",
    "freeze",
    "pack",
    "dispatch",
  ];
  const units = {
    ups: ["UPS", 2, 1],
    hostA: ["Compute host A", 2, 3],
    hostB: ["Compute host B", 2, 5],
    sw: ["Managed switch", 1, 9],
  };
  const pairs = [
    ["UPS.OUT", "PDU.IN", "Protected PDU supply"],
    ["PDU.1", "HOST-A.PWR", "Compute host A power"],
    ["PDU.2", "HOST-B.PWR", "Compute host B power"],
    ["PDU.3", "SW.PWR", "Switch power"],
    ["SW.P1", "HOST-A.NIC", "Host A data"],
    ["SW.P2", "HOST-B.NIC", "Host B data"],
    ["SW.P3", "PLC.ETH", "Controller data"],
    ["DI.0", "SIM.START", "Start request"],
    ["DI.1", "SIM.GUARD", "Process guard status"],
    ["DI.2", "SIM.READY", "Line ready status"],
    ["DO.0", "SIM.ENABLE", "Line enable indication"],
  ];
  const rolePlan = {
    hmi: ["SCADA server", "control", "hostA", "10.42.20.21", "plc.tags"],
    history: ["Historian", "history", "hostB", "10.42.20.22", "scada.tags"],
    mes: [
      "MES application",
      "execution",
      "hostB",
      "10.42.20.23",
      "historian.events",
    ],
    erp: ["ERP adapter", "adapter", "hostB", "10.42.20.24", "mes.confirmed"],
  };
  const names = {
    rack: "Rack",
    patch: "Patching",
    host: "Hosts and VMs",
    roles: "Applications",
    plc: "PLC",
    scada: "SCADA tags and history",
    hmi: "HMI screens",
    mes: "MES",
    erp: "SAP adapter",
  };
  const signals = {
    batch: "text",
    stage: "text",
    mass: "number",
    progress: "bar",
    running: "lamp",
    alarm: "alarm",
    stock: "number",
  };
  const tagSpecs = {
    batch: ["MES.BatchId", "MES.Quality", "text", 1],
    stage: ["PLC.Stage", "PLC.Quality", "text", 1],
    mass: ["PLC.Mass_g", "PLC.Quality", "kg", 0.001],
    progress: ["PLC.Progress_permille", "PLC.Quality", "%", 0.1],
    running: ["PLC.Run", "PLC.Quality", "bool", 1],
    alarm: ["PLC.TripText", "PLC.Quality", "text", 1],
    stock: ["ERP.Stock_kg", "ERP.Quality", "kg", 1],
  };
  const tagDefaults = () => ({
    bindings: {},
    alarmMode: "",
    historyMode: "",
    proof: "",
    lastRecorded: null,
    samples: [],
  });
  const refTags = () => {
    const sc = tagDefaults();
    for (const [name, [source, quality, unit, gain]] of Object.entries(
      tagSpecs,
    ))
      sc.bindings[name] = { source, quality, unit, gain };
    sc.alarmMode = "trip-or-stale";
    sc.historyMode = "good-on-change";
    const test = tagTest(sc);
    if (test.ok) sc.proof = tagSignature(sc);
    return sc;
  };
  function bindingIssue(sc, tag) {
    const row = sc?.bindings?.[tag],
      spec = tagSpecs[tag];
    if (!row || !spec) return "Configure the source for " + tag + ".";
    const [source, quality, unit, gain] = spec;
    if (row.source !== source) return tag + " source should be " + source + ".";
    if (row.quality !== quality)
      return tag + " quality should follow " + quality + ".";
    if (row.unit !== unit || Number(row.gain) !== gain)
      return tag + " needs scale " + gain + " and unit " + unit + ".";
    return "";
  }
  function tagSignature(sc) {
    return JSON.stringify([
      Object.keys(tagSpecs).map((t) => {
        const v = sc?.bindings?.[t];
        return [v?.source, v?.quality, v?.unit, Number(v?.gain)];
      }),
      sc?.alarmMode,
      sc?.historyMode,
    ]);
  }
  function tagValue(sc, tag, raw, qualities) {
    const problem = bindingIssue(sc, tag);
    if (problem) return { quality: "Bad", reason: problem };
    const b = sc.bindings[tag];
    if (qualities[b.quality] !== "Good")
      return {
        quality: "Stale",
        reason: "Source quality reports stale or unavailable data.",
      };
    if (!Object.hasOwn(raw, b.source) || raw[b.source] == null)
      return { quality: "Bad", reason: "Waiting for a source sample." };
    const input = raw[b.source];
    if (["kg", "%"].includes(b.unit)) {
      if (typeof input !== "number" || !Number.isFinite(input))
        return { quality: "Bad", reason: "Expected a numeric sample." };
      return {
        quality: "Good",
        value: Number((input * Number(b.gain)).toFixed(6)),
        unit: b.unit,
      };
    }
    return { quality: "Good", value: input, unit: b.unit };
  }
  function testSample(sc, mode, previous) {
    const stale = mode === "stale",
      trip = mode === "trip";
    const raw = {
      "PLC.Mass_g": trip ? 12000 : 15000,
      "PLC.TripText": trip ? "Drive overload" : "",
      "PLC.Run": !trip,
    };
    const qualities = { "PLC.Quality": stale ? "Stale" : "Good" };
    const mass = tagValue(sc, "mass", raw, qualities),
      alarm = tagValue(sc, "alarm", raw, qualities);
    const alarmText =
      alarm.quality !== "Good"
        ? sc.alarmMode === "trip-or-stale"
          ? "Quality alarm"
          : "Clear"
        : alarm.value && ["trip-only", "trip-or-stale"].includes(sc.alarmMode)
          ? "Trip alarm"
          : "Clear";
    const record =
      mass.quality === "Good" &&
      (sc.historyMode === "all-good" ||
        (sc.historyMode === "good-on-change" && previous !== mass.value));
    return {
      mode,
      quality: mass.quality,
      mass: mass.value,
      alarm: alarmText,
      record,
    };
  }
  function tagTest(sc) {
    for (const tag of Object.keys(tagSpecs)) {
      const why = bindingIssue(sc, tag);
      if (why) return { ok: false, why };
    }
    const good = testSample(sc, "good"),
      steady = testSample(sc, "good", good.mass),
      stale = testSample(sc, "stale", good.mass),
      trip = testSample(sc, "trip", good.mass);
    if (
      good.quality !== "Good" ||
      good.mass !== 15 ||
      good.alarm !== "Clear" ||
      trip.mass !== 12 ||
      trip.alarm !== "Trip alarm" ||
      stale.quality !== "Stale" ||
      stale.alarm !== "Quality alarm"
    )
      return {
        ok: false,
        why: "Use trip-or-stale alarming. A stale source and a process trip must each raise a distinct alarm.",
      };
    if (!good.record || steady.record || stale.record || !trip.record)
      return {
        ok: false,
        why: "Use good-on-change history. Collect a changed good value and suppress duplicate or stale samples.",
      };
    return {
      ok: true,
      why: "Source, quality, 15 kg/12 kg scaling, two alarms and history collection passed.",
    };
  }
  const mappings = {
    issue: "261",
    receipt: "101",
    yield: "accepted",
    scrap: "rejected",
    key: "eventId",
  };
  const mappingOptions = {
    issue: ["", "101", "261"],
    receipt: ["", "101", "261"],
    yield: ["", "accepted", "rejected"],
    scrap: ["", "accepted", "rejected"],
    key: ["", "eventId", "batchId"],
  };
  const REFERENCE = [
    "RUN := START AND GUARD AND READY;",
    ...stages.map(
      (id, i) =>
        id.toUpperCase() +
        " WHEN RUN -> " +
        (stages[i + 1] || "done").toUpperCase() +
        ";",
    ),
  ].join("\n");
  const clone = (obj) => JSON.parse(JSON.stringify(obj));
  const blank = () => ({
    rack: {},
    patch: [],
    host: {
      hostA: { os: "", vSwitch: "", vlan: "" },
      hostB: { os: "", vSwitch: "", vlan: "" },
      vms: {},
    },
    roles: {},
    plc: { cpu: "", di: "", dout: "", address: "", source: "", compiled: "" },
    scada: tagDefaults(),
    hmi: { title: "", widgets: [] },
    mes: { recipe: "", route: [] },
    erp: {},
  });
  function worked() {
    const s = blank();
    Object.entries(units).forEach(([id, row]) => (s.rack[id] = row[2]));
    s.patch = pairs.map(([a, b]) => [a, b]);
    for (const id of ["hostA", "hostB"])
      s.host[id] = { os: "Hypervisor OS", vSwitch: "vOT", vlan: "20" };
    for (const [id, [, vm, host, address, binding]] of Object.entries(
      rolePlan,
    )) {
      s.host.vms[vm] = { host, address };
      s.roles[id] = { vm, binding };
    }
    s.plc = {
      cpu: "CPU-01",
      di: "DI-8",
      dout: "DO-8",
      address: "10.42.20.10",
      source: REFERENCE,
      compiled: REFERENCE,
    };
    s.scada = refTags();
    s.hmi = {
      title: "Fry line overview",
      widgets: Object.entries(signals).map(([tag, type]) => ({
        title: tag[0].toUpperCase() + tag.slice(1),
        tag,
        type,
      })),
    };
    s.mes = { recipe: "FRY-01", route: [...stages] };
    s.erp = { ...mappings };
    return s;
  }
  function rackIssue(rack) {
    const occupied = new Set();
    for (const [key, [label, size]] of Object.entries(units)) {
      const n = rack[key];
      if (!Number.isInteger(n) || n < 1 || n + size - 1 > 12)
        return "Fit " + label + " inside the 12U cabinet.";
      if (key === "ups" && n !== 1)
        return "This cabinet design reserves U1 and U2 for the UPS.";
      for (let k = n; k < n + size; k++) {
        if (occupied.has(k)) return "U" + k + " is assigned twice.";
        occupied.add(k);
      }
    }
    return "";
  }
  function patchIssue(inst) {
    for (const [a, b, why] of pairs)
      if (
        !inst.patch.some(
          ([x, y]) => (x === a && y === b) || (x === b && y === a),
        )
      )
        return (
          why + " is open or paired incorrectly. Check " + a + " ↔ " + b + "."
        );
    return "";
  }
  const cache = new Map();
  function parse(source) {
    if (typeof source !== "string" || !source.trim())
      throw Error("Write the RUN expression and stage transitions first.");
    if (source.length > 5000)
      throw Error("The training program is limited to 5,000 characters.");
    if (cache.has(source)) return cache.get(source);
    const code = source
      .toUpperCase()
      .replace(/#[^\n]*/g, "")
      .trim();
    if (!code.endsWith(";"))
      throw Error("End each statement with a semicolon.");
    const statements = code
      .slice(0, -1)
      .split(";")
      .map((t) => t.trim());
    const labels = new Map();
    function expression(raw, names) {
      const tokens = raw.match(/[A-Z_]+|\S/g) || [];
      let i = 0;
      function atom() {
        const word = tokens[i++];
        if (word === "NOT") {
          const child = atom();
          return (data) => !child(data);
        }
        if (word === "(") {
          const child = or();
          if (tokens[i++] !== ")")
            throw Error("Close the bracket in the Boolean expression.");
          return child;
        }
        if (!names.includes(word))
          throw Error(
            "Unknown signal or operator " +
              (word || "at end of expression") +
              ".",
          );
        return (data) => data[word] === true;
      }
      function and() {
        let v = atom();
        while (tokens[i] === "AND") {
          i++;
          const a = v,
            b = atom();
          v = (data) => a(data) && b(data);
        }
        return v;
      }
      function or() {
        let v = and();
        while (tokens[i] === "OR") {
          i++;
          const a = v,
            b = and();
          v = (data) => a(data) || b(data);
        }
        return v;
      }
      const fn = or();
      if (i !== tokens.length)
        throw Error("Unexpected expression token " + tokens[i] + ".");
      return fn;
    }
    const head = /^RUN\s*:=\s*([\s\S]+)$/.exec(statements.shift());
    if (!head)
      throw Error("Start with RUN := followed by a Boolean expression.");
    const run = expression(head[1], ["START", "GUARD", "READY"]);
    for (const stmt of statements) {
      const rule = /^([A-Z]+)\s+WHEN\s+([\s\S]+?)\s*->\s*([A-Z]+)$/.exec(stmt);
      if (!rule)
        throw Error(
          "Write STAGE WHEN expression -> NEXT; for each process stage.",
        );
      const from = rule[1].toLowerCase(),
        to = rule[3].toLowerCase();
      if (!stages.includes(from) || !(to === "done" || stages.includes(to)))
        throw Error("Unknown stage in " + stmt + ".");
      if (labels.has(from)) throw Error("Stage " + from + " is defined twice.");
      labels.set(from, {
        to,
        fn: expression(rule[2], ["RUN", "START", "GUARD", "READY"]),
      });
    }
    for (const id of stages)
      if (!labels.has(id)) throw Error("Missing stage " + id + ".");
    const program = { run, labels };
    if (cache.size >= 12) cache.clear();
    cache.set(source, program);
    return program;
  }
  function step(program, id, inputs) {
    const data = {
      START: inputs.start === true,
      GUARD: inputs.guard === true,
      READY: inputs.ready === true,
    };
    const run = program.run(data),
      line = program.labels.get(id);
    return {
      run: run && (!line || line.fn({ ...data, RUN: run })),
      next: line?.to || id,
    };
  }
  function prove(code) {
    for (const [i, id] of stages.entries()) {
      for (let n = 0; n < 8; n++) {
        const x = { start: !!(n & 1), guard: !!(n & 2), ready: !!(n & 4) };
        const out = step(code, id, x);
        if (out.next !== (stages[i + 1] || "done"))
          throw Error(
            "At " +
              id +
              " the recipe needs " +
              (stages[i + 1] || "done") +
              " next, but the program selects " +
              out.next +
              ".",
          );
        if (out.run !== (n === 7))
          throw Error(
            "At " +
              id +
              " with START=" +
              Number(x.start) +
              ", GUARD=" +
              Number(x.guard) +
              ", READY=" +
              Number(x.ready) +
              ", the enable output is " +
              Number(out.run) +
              ".",
          );
      }
    }
  }
  function validPLC(p) {
    if (p.cpu !== "CPU-01" || p.di !== "DI-8" || p.dout !== "DO-8")
      return "Fit CPU-01, DI-8 and DO-8 to the training backplane.";
    if (p.address !== "10.42.20.10")
      return "Assign the reserved controller address 10.42.20.10.";
    if (!p.compiled || p.compiled !== p.source)
      return "Compile and prove the current sequence.";
    try {
      prove(parse(p.compiled));
      return "";
    } catch (e) {
      return e.message;
    }
  }
  function permit(s, inputs = {}) {
    const p = s?.plc;
    if (!p || validPLC(p) || (inputs.stage && !stages.includes(inputs.stage)))
      return false;
    return step(parse(p.compiled), inputs.stage || "receive", inputs).run;
  }
  function nextStage(inst, id) {
    if (!stages.includes(id) || !inst?.plc || validPLC(inst.plc)) return null;
    const next = parse(inst.plc.compiled).labels.get(id).to;
    return next === "done" ? "END" : next;
  }
  function check(s) {
    const inst = { ...blank(), ...s };
    const verifiers = {
      rack: () => rackIssue(inst.rack),
      patch: () =>
        patchIssue(inst) ||
        (rackIssue(inst.rack) &&
          "Complete the rack to energise and link the patched equipment."),
      host: () => {
        for (const id of ["hostA", "hostB"]) {
          const h = inst.host[id];
          if (
            h?.os !== "Hypervisor OS" ||
            h.vSwitch !== "vOT" ||
            String(h.vlan) !== "20"
          )
            return (
              "Install the hypervisor OS and bind vOT to VLAN 20 on " +
              units[id][0] +
              "."
            );
        }
        for (const [, vm, host, addr] of Object.values(rolePlan)) {
          const v = inst.host.vms?.[vm];
          if (v?.host !== host || v?.address !== addr)
            return (
              "Create VM " +
              vm +
              " on " +
              units[host][0] +
              " with " +
              addr +
              "."
            );
        }
        return "";
      },
      roles: () => {
        for (const [id, [label, vm, , addr, binding]] of Object.entries(
          rolePlan,
        )) {
          const d = inst.roles[id];
          if (
            d?.vm !== vm ||
            d?.binding !== binding ||
            inst.host.vms?.[vm]?.address !== addr
          )
            return (
              "Install " +
              label +
              " on VM " +
              vm +
              " and bind " +
              binding +
              " once its VM is available."
            );
        }
        return "";
      },
      plc: () => validPLC(inst.plc),
      scada: () => {
        const tested = tagTest(inst.scada);
        if (!tested.ok) return tested.why;
        return inst.scada.proof === tagSignature(inst.scada)
          ? ""
          : "Run the commissioning proof on the current tag provider configuration.";
      },
      hmi: () => {
        if (!String(inst.hmi.title || "").trim())
          return "Name the operator screen.";
        for (const [tag, type] of Object.entries(signals))
          if (
            !inst.hmi.widgets?.some(
              (w) => w.tag === tag && w.type === type && w.title?.trim(),
            )
          )
            return "Add a " + type + " widget bound to " + tag + ".";
        return "";
      },
      mes: () =>
        inst.mes.recipe !== "FRY-01" ||
        inst.mes.route?.join(",") !== stages.join(",")
          ? "Assign recipe FRY-01 and build the ten-stage routing in process order."
          : "",
      erp: () => {
        for (const [k, v] of Object.entries(mappings))
          if (inst.erp[k] !== v)
            return "Set " + k + " to " + v + " for this exercise.";
        return "";
      },
    };
    return Object.entries(names).map(([id, label]) => {
      const why = verifiers[id]();
      return {
        id,
        label,
        ok: !why,
        why: why || "Configuration matches the work order.",
      };
    });
  }
  const esc = (v) =>
    String(v ?? "").replace(
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
  const opt = (v, label, picked) =>
    '<option value="' +
    esc(v) +
    '"' +
    (String(v) === String(picked) ? " selected" : "") +
    ">" +
    esc(label) +
    "</option>";
  const field = (key, label, choices, value) =>
    "<label>" +
    esc(label) +
    '<select data-fi-key="' +
    key +
    '">' +
    choices
      .map((c) =>
        Array.isArray(c)
          ? opt(c[0], c[1], value)
          : opt(c, c || "Choose", value),
      )
      .join("") +
    "</select></label>";
  const input = (k, label, v = "") =>
    "<label>" +
    label +
    '<input data-fi-key="' +
    k +
    '" maxlength="60" autocomplete="off" value="' +
    esc(v) +
    '"></label>';
  const button = (key, label, cls = "") =>
    '<button type="button" data-fi="' +
    key +
    '" class="' +
    cls +
    '">' +
    esc(label) +
    "</button>";
  const actions = (...items) =>
    '<div class="fi-actions">' + items.join("") + "</div>";
  const grid = (...items) =>
    '<div class="fi-fields">' + items.join("") + "</div>";
  const list = (rows) =>
    '<ul class="fi-ledger">' +
    rows.map((r) => "<li>" + r + "</li>").join("") +
    "</ul>";
  const portSet = pairs.flatMap((p) => p.slice(0, 2));
  const workOrder = {
    rack: "Install the UPS at the bottom, then fit both compute hosts and the switch wherever their rack units fit. The offered elevation puts the UPS at U1, hosts A and B at U3 and U5, and the switch at U9.",
    patch:
      "Use the endpoint schedule below to patch the virtual rack and the simulated 24 V digital signals. Every socket accepts one lead. Select either end first. The PDU and simulated I/O trainer are pre-provisioned.",
    host: "On both physical hosts install Hypervisor OS, create virtual switch vOT and assign VLAN 20. Provision the four named VMs using the host and reserved address in the deployment schedule.",
    roles:
      "Install each application on its VM. Then configure the service binding for that application. The commissioning check traces each binding to the expected VM address.",
    plc: "Fit CPU-01 in CPU slot 0, DI-8 in input slot 1 and DO-8 in output slot 2. Assign 10.42.20.10. Write an enable expression and one transition per stage. Commissioning tests ten stages against all eight START, GUARD and READY input combinations.",
    scada:
      "Map seven logical tags to the simulated OPC namespace. For each tag, bind the value node, its source quality, the engineering unit and the multiplier. Configure alarms for process trip and stale data. The historian must store only changed samples of good quality.",
    hmi: "Name your screen and create seven labelled widgets. Bind batch and stage to text, mass and stock to numeric readouts, progress to a bar, running to a lamp and alarm to an alarm indicator.",
    mes:
      "Enter FRY-01 as the recipe identifier. Append operations to the route in this order: " +
      stages.join(" → ") +
      ".",
    erp: "Map component issue to 261, finished goods receipt to 101, yield to accepted material and scrap to rejected material. Use eventId as the unique posting key so separate events from the same batch can be reconciled.",
  };
  function schedule() {
    return list(
      Object.values(rolePlan).map(
        ([role, vm, host, address, binding]) =>
          "<span><b>" +
          role +
          "</b> · " +
          vm +
          " on " +
          units[host][0] +
          " · " +
          address +
          " · " +
          binding +
          "</span>",
      ),
    );
  }
  function operator(root, s, tags = {}) {
    if (!root) return;
    const h = s?.hmi || {},
      ws = Array.isArray(h.widgets) ? h.widgets : [];
    const raw = {},
      quality = {};
    for (const [tag, [source, alias, unit, gain]] of Object.entries(tagSpecs)) {
      if (Object.hasOwn(tags, tag)) {
        const v = tags[tag];
        raw[source] =
          ["kg", "%"].includes(unit) && typeof v === "number" ? v / gain : v;
        quality[alias] = tags.quality?.[alias] || "Good";
      }
    }
    root.innerHTML =
      '<section class="fry-operator" aria-label="Configured operator screen"><h4>' +
      esc(h.title || "Operator screen") +
      '</h4><div class="fi-tiles">' +
      (ws.length
        ? ws
            .map((w) => {
              const sample = tagValue(s?.scada, w.tag, raw, quality),
                has = sample.quality === "Good",
                v = sample.value;
              let value = has ? v : sample.quality + " quality";
              if (has && w.type === "lamp") value = v ? "ON" : "OFF";
              if (has && w.type === "alarm")
                value =
                  typeof v === "string" ? v || "Clear" : v ? "Active" : "Clear";
              const pct = Number(v);
              const bar =
                has && w.type === "bar" && Number.isFinite(pct)
                  ? '<progress max="100" value="' +
                    Math.max(0, Math.min(100, pct)) +
                    '" aria-label="' +
                    esc(w.title) +
                    '"></progress>'
                  : "";
              return (
                '<div class="fi-tile" data-fi-quality="' +
                esc(sample.quality) +
                '"><b>' +
                esc(w.title) +
                "</b><output>" +
                esc(value) +
                (has && ["kg", "%"].includes(sample.unit)
                  ? " " + esc(sample.unit)
                  : "") +
                "</output>" +
                bar +
                "<small>" +
                esc(w.tag) +
                " · " +
                esc(sample.quality) +
                (sample.reason ? " · " + esc(sample.reason) : "") +
                "</small></div>"
              );
            })
            .join("")
        : '<p class="fi-help">Add widgets in HMI / SCADA to display line tags here.</p>') +
      "</div></section>";
  }
  function mount(root, s, onChange) {
    const initial = blank();
    for (const id of Object.keys(initial))
      if (s[id] == null) s[id] = initial[id];
    s.host.vms ||= {};
    s.hmi.widgets ||= [];
    s.mes.route ||= [];
    let tab = "rack",
      device = "ups",
      host = "hostA",
      role = "hmi",
      vm = "control",
      scTag = "mass",
      notice = "";
    function page() {
      if (tab === "rack") {
        const used = (u) =>
          Object.entries(s.rack).find(
            ([id, v]) => units[id] && u >= v && u < v + units[id][1],
          )?.[0];
        const rack = Array.from({ length: 12 }, (_, i) => {
          const u = 12 - i,
            id = used(u);
          return (
            '<button type="button" data-fi-u="' +
            u +
            '" data-fi-fitted="' +
            Boolean(id) +
            '" aria-label="Mount selected device at U' +
            u +
            '">U' +
            u +
            " · " +
            (id ? esc(units[id][0]) : "Free") +
            "</button>"
          );
        }).join("");
        return (
          field(
            "device",
            "Device to mount",
            Object.entries(units).map(([id, [name, height]]) => [
              id,
              name + " (" + height + "U)",
            ]),
            device,
          ) +
          '<div class="fi-rack" aria-label="Rack elevation, top to bottom">' +
          rack +
          "</div>" +
          actions(button("unmount", "Uninstall selected device"))
        );
      }
      if (tab === "patch") {
        return (
          "<p><b>Endpoint schedule</b></p>" +
          list(
            pairs.map(
              ([a, b, why]) =>
                "<span>" + why + " · " + a + " ↔ " + b + "</span>",
            ),
          ) +
          grid(
            field("from", "First socket", ["", ...portSet]),
            field("to", "Second socket", ["", ...portSet]),
          ) +
          actions(button("connect", "Connect lead", "fi-primary")) +
          list(
            s.patch.map(
              ([a, b], i) =>
                "<span>" +
                esc(a) +
                " ↔ " +
                esc(b) +
                '</span><button type="button" data-fi-drop="' +
                i +
                '">Unplug</button>',
            ),
          )
        );
      }
      if (tab === "host") {
        const h = s.host[host] || {},
          v = s.host.vms[vm] || {};
        return (
          schedule() +
          field(
            "host",
            "Physical host",
            [
              ["hostA", "Compute host A"],
              ["hostB", "Compute host B"],
            ],
            host,
          ) +
          grid(
            field("os", "OS image", ["", "Hypervisor OS", "Desktop OS"], h.os),
            input("vSwitch", "Virtual switch name", h.vSwitch),
            input("vlan", "Access VLAN", h.vlan),
          ) +
          actions(button("save-host", "Install / update host")) +
          "<h4>Virtual machine provisioning</h4>" +
          field(
            "vm",
            "VM name",
            Object.values(rolePlan).map((r) => r[1]),
            vm,
          ) +
          grid(
            field(
              "vmHost",
              "Compute placement",
              [
                ["hostA", "Compute host A"],
                ["hostB", "Compute host B"],
              ],
              v.host,
            ),
            input("vmAddr", "Guest address", v.address),
          ) +
          actions(button("save-vm", "Provision / update VM")) +
          list(
            Object.entries(s.host.vms).map(
              ([id, x]) =>
                esc(id) +
                " · " +
                esc(units[x.host]?.[0]) +
                " · " +
                esc(x.address),
            ),
          )
        );
      }
      if (tab === "roles") {
        const x = s.roles[role] || {};
        return (
          schedule() +
          field(
            "role",
            "Application package",
            Object.entries(rolePlan).map(([id, r]) => [id, r[0]]),
            role,
          ) +
          field(
            "roleVm",
            "Installation target",
            ["", ...Object.keys(s.host.vms)],
            x.vm,
          ) +
          actions(button("install-role", "Install application")) +
          field(
            "binding",
            "Service data binding",
            ["", ...Object.values(rolePlan).map((r) => r[4])],
            x.binding,
          ) +
          actions(button("bind", "Apply service settings")) +
          list(
            Object.entries(s.roles).map(
              ([id, x]) =>
                esc(rolePlan[id]?.[0]) +
                " · " +
                esc(x.vm) +
                " · " +
                esc(x.binding || "unbound"),
            ),
          )
        );
      }
      if (tab === "plc") {
        const p = s.plc;
        return (
          grid(
            field("cpu", "CPU slot 0", ["", "CPU-01"], p.cpu),
            field("di", "Input slot 1", ["", "DI-8", "DO-8"], p.di),
            field("dout", "Output slot 2", ["", "DO-8", "DI-8"], p.dout),
            input("addr", "CPU address", p.address),
          ) +
          actions(button("save-plc", "Install modules and set address")) +
          "<details><summary>Program grammar and worked sequence</summary><p>The first statement assigns RUN using START, GUARD and READY. Use NOT, AND, OR and parentheses. Each remaining rule is STAGE WHEN expression → NEXT, typed with the ASCII arrow shown below. RUN may appear in stage expressions. DONE ends dispatch. # introduces a line comment. This program models process permissions.</p><pre>" +
          esc(REFERENCE) +
          '</pre></details><label>Editable sequence program<textarea data-fi-key="code" spellcheck="false" maxlength="5000">' +
          esc(p.source) +
          "</textarea></label>" +
          actions(
            button("load-code", "Load example into editor"),
            button("compile", "Compile and prove", "fi-primary"),
          ) +
          "<h4>Controller scan</h4>" +
          field("scanStage", "Stage", stages, "receive") +
          '<div class="fi-actions">' +
          ["start", "guard", "ready"]
            .map(
              (k) =>
                '<label><input type="checkbox" data-fi-bit="' +
                k +
                '"> ' +
                k.toUpperCase() +
                "</label>",
            )
            .join("") +
          "</div>" +
          actions(button("scan", "Sample one scan"))
        );
      }
      if (tab === "scada") {
        const sc = s.scada,
          row = sc.bindings[scTag] || {};
        return (
          "<details><summary>OPC namespace and engineering schedule</summary>" +
          list(
            Object.entries(tagSpecs).map(
              ([k, [node, q, u, g]]) =>
                esc(k) +
                " ← " +
                esc(node) +
                " · " +
                esc(q) +
                " · " +
                g +
                " × raw · " +
                esc(u),
            ),
          ) +
          "</details>" +
          field("sc-tag", "Logical tag", Object.keys(tagSpecs), scTag) +
          grid(
            field(
              "sc-source",
              "OPC value node",
              ["", ...Object.values(tagSpecs).map((r) => r[0])],
              row.source,
            ),
            field(
              "sc-quality",
              "Quality alias",
              ["", "PLC.Quality", "MES.Quality", "ERP.Quality"],
              row.quality,
            ),
            field(
              "sc-unit",
              "Engineering unit",
              ["", "kg", "%", "text", "bool"],
              row.unit,
            ),
            input("sc-gain", "Multiplier", row.gain),
          ) +
          actions(button("bind-tag", "Apply tag binding")) +
          grid(
            field(
              "sc-alarm",
              "Alarm behaviour",
              [
                ["", "Choose"],
                ["trip-only", "Process trip only"],
                ["trip-or-stale", "Process trip or stale source"],
              ],
              sc.alarmMode,
            ),
            field(
              "sc-history",
              "Historian collection",
              [
                ["", "Choose"],
                ["all-good", "Every good sample"],
                ["good-on-change", "Changed good values only"],
              ],
              sc.historyMode,
            ),
          ) +
          actions(
            button("save-collection", "Apply alarm and history settings"),
          ) +
          '<h4>Provider test source</h4><p class="fi-help">The bench emits 15,000 g for normal running and 12,000 g for a drive trip. A stale sample carries the previous raw reading with a stale quality flag.</p>' +
          field("sc-sample", "Sample condition", [
            ["good", "Healthy signal"],
            ["stale", "Stale PLC feed"],
            ["trip", "Drive trip"],
          ]) +
          actions(
            button("inject", "Sample test source"),
            button("prove-tags", "Run commissioning proof", "fi-primary"),
          ) +
          (sc.samples.length
            ? "<p><b>Latest test observations</b></p>" +
              list(
                sc.samples.map(
                  (x) =>
                    esc(x.mode) +
                    " · " +
                    esc(x.quality) +
                    " · " +
                    (x.quality === "Good"
                      ? esc(x.mass) + " kg"
                      : "value withheld") +
                    " · " +
                    esc(x.alarm) +
                    " · " +
                    (x.record ? "historian write" : "no historian write"),
                ),
              )
            : "")
        );
      }
      if (tab === "hmi") {
        return (
          input("screen", "Screen title", s.hmi.title) +
          actions(button("save-screen", "Save screen name")) +
          grid(
            input("title", "Widget label"),
            field("tag", "Live tag", Object.keys(signals)),
            field("type", "Widget type", [
              "text",
              "number",
              "bar",
              "lamp",
              "alarm",
            ]),
          ) +
          actions(button("widget", "Add / update binding", "fi-primary")) +
          list(
            s.hmi.widgets.map(
              (w, i) =>
                "<span>" +
                esc(w.title) +
                " · " +
                esc(w.type) +
                " ← " +
                esc(w.tag) +
                '</span><button type="button" data-fi-del-widget="' +
                i +
                '">Remove</button>',
            ),
          ) +
          "<div data-fi-preview></div>"
        );
      }
      if (tab === "mes") {
        return (
          input("recipe", "Recipe identifier", s.mes.recipe) +
          actions(button("save-recipe", "Save recipe")) +
          field("operation", "Route operation", stages) +
          actions(
            button("append", "Append operation"),
            button("pop", "Remove last operation"),
          ) +
          "<ol>" +
          s.mes.route.map((op) => "<li>" + esc(op) + "</li>").join("") +
          "</ol>"
        );
      }
      return (
        grid(
          ...Object.entries(mappingOptions).map(([k, opts]) =>
            field(
              k,
              {
                issue: "Component issue",
                receipt: "Finished goods receipt",
                yield: "Operation yield",
                scrap: "Operation scrap",
                key: "Unique posting key",
              }[k],
              opts,
              s.erp[k],
            ),
          ),
        ) + actions(button("save-erp", "Apply adapter mapping", "fi-primary"))
      );
    }
    function paint() {
      const results = check(s),
        active = results.find((r) => r.id === tab);
      root.innerHTML =
        '<section class="fry-install" aria-label="Hardware and software commissioning"><nav class="fi-nav" aria-label="Commissioning subsystems">' +
        results
          .map(
            (r) =>
              '<button type="button" data-fi-tab="' +
              r.id +
              '" aria-pressed="' +
              (r.id === tab) +
              '">' +
              esc(r.label) +
              " · " +
              (r.ok ? "pass" : "open") +
              "</button>",
          )
          .join("") +
        '</nav><article class="fi-panel"><h3>' +
        esc(names[tab]) +
        '</h3><p class="fi-help">' +
        esc(workOrder[tab]) +
        '</p><div class="fi-result ' +
        (active.ok ? "" : "fi-open") +
        '" data-fi-check>' +
        esc(active.why) +
        "</div>" +
        page() +
        "<details><summary>Worked configuration for " +
        esc(names[tab]) +
        "</summary><p>" +
        esc(workOrder[tab]) +
        "</p>" +
        button("solve", "Apply worked configuration for this subsystem") +
        '</details><div data-fi-msg role="status" aria-live="polite"></div></article></section>';
      root.querySelector("[data-fi-msg]").textContent = notice;
      if (tab === "hmi")
        operator(root.querySelector("[data-fi-preview]"), s, {});
    }
    const val = (k) =>
      root.querySelector('[data-fi-key="' + k + '"]')?.value.trim() || "";
    const feedback = (m) => {
      notice = m;
      root.querySelector("[data-fi-msg]").textContent = m;
    };
    function mutate(message, selector) {
      notice = message;
      paint();
      onChange?.(s);
      root
        .querySelector(selector || '[data-fi-tab="' + tab + '"]')
        ?.focus({ preventScroll: true });
    }
    function installU(n) {
      if (n + units[device][1] - 1 > 12) {
        feedback("The chassis extends above U12. Pick a lower starting unit.");
        return;
      }
      const overlap = Object.entries(s.rack).find(
        ([key, start]) =>
          key !== device &&
          start < n + units[device][1] &&
          n < start + units[key][1],
      );
      if (overlap) {
        feedback(
          "That location overlaps " +
            units[overlap[0]][0] +
            ". Select free adjacent units.",
        );
        return;
      }
      s.rack[device] = n;
      mutate(
        units[device][0] + " mounted at U" + n + ".",
        '[data-fi-u="' + n + '"]',
      );
    }
    function command(k) {
      if (k === "solve") {
        s[tab] = clone(worked()[tab]);
        mutate("Applied the worked configuration for " + names[tab] + ".");
        return;
      }
      if (k === "unmount") {
        delete s.rack[device];
        mutate(
          "Selected device removed. Check the rack and patch dependencies.",
        );
        return;
      }
      if (k === "connect") {
        const a = val("from"),
          b = val("to");
        if (!a || !b || a === b) {
          feedback("Select two different named sockets.");
          return;
        }
        if (s.patch.some((w) => w.includes(a) || w.includes(b))) {
          feedback(
            "Socket already occupied. Unplug its existing lead before moving it.",
          );
          return;
        }
        s.patch.push([a, b]);
        mutate("Lead connected. Compare the pair to the endpoint schedule.");
        return;
      }
      if (k === "save-host") {
        s.host[host] = {
          os: val("os"),
          vSwitch: val("vSwitch"),
          vlan: val("vlan"),
        };
        mutate("Host OS and virtual switch configuration stored.");
        return;
      }
      if (k === "save-vm") {
        const h = val("vmHost"),
          addr = val("vmAddr");
        if (s.host[h]?.os !== "Hypervisor OS") {
          feedback("Install the hypervisor OS on the target host first.");
          return;
        }
        if (
          !/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(addr) ||
          addr.split(".").some((x) => Number(x) > 255)
        ) {
          feedback("Enter a valid dotted IPv4 address.");
          return;
        }
        if (
          Object.entries(s.host.vms).some(
            ([id, row]) => id !== vm && row.address === addr,
          )
        ) {
          feedback("Guest address already assigned to another VM.");
          return;
        }
        s.host.vms[vm] = { host: h, address: addr };
        mutate("Guest VM provisioned.");
        return;
      }
      if (k === "install-role") {
        const target = val("roleVm");
        if (!s.host.vms[target]) {
          feedback("Provision and select the target VM first.");
          return;
        }
        s.roles[role] = { vm: target, binding: "" };
        mutate("Application installed. Apply the service binding next.");
        return;
      }
      if (k === "bind") {
        if (!s.roles[role]?.vm) {
          feedback(
            "Install this application before applying its service settings.",
          );
          return;
        }
        s.roles[role].binding = val("binding");
        mutate("Service binding updated.");
        return;
      }
      if (k === "save-plc") {
        Object.assign(s.plc, {
          cpu: val("cpu"),
          di: val("di"),
          dout: val("dout"),
          address: val("addr"),
        });
        mutate("Controller chassis and address saved.");
        return;
      }
      if (k === "load-code") {
        s.plc.source = REFERENCE;
        s.plc.compiled = "";
        mutate(
          "Editable example loaded. Compile and prove it.",
          '[data-fi-key="code"]',
        );
        return;
      }
      if (k === "compile") {
        try {
          const code = parse(s.plc.source);
          prove(code);
          s.plc.compiled = s.plc.source;
          mutate(
            "All 80 stage/input cases passed. Compiled sequence installed.",
            '[data-fi="compile"]',
          );
        } catch (error) {
          s.plc.compiled = "";
          mutate(
            "Compile / proof failed. " + error.message,
            '[data-fi-key="code"]',
          );
        }
        return;
      }
      if (k === "scan") {
        try {
          const code = parse(s.plc.source),
            stage = val("scanStage"),
            inputs = Object.fromEntries(
              [...root.querySelectorAll("[data-fi-bit]")].map((el) => [
                el.dataset.fiBit,
                el.checked,
              ]),
            );
          const r = step(code, stage, inputs);
          feedback(
            "Test scan at " +
              stage +
              ". ENABLE " +
              (r.run ? "ON. Next stage " + r.next : "OFF. Hold " + stage) +
              ".",
          );
        } catch (e) {
          feedback(e.message);
        }
        return;
      }
      if (k === "bind-tag") {
        const gain = val("sc-gain");
        s.scada.bindings[scTag] = {
          source: val("sc-source"),
          quality: val("sc-quality"),
          unit: val("sc-unit"),
          gain: gain === "" ? "" : Number(gain),
        };
        s.scada.proof = "";
        s.scada.samples = [];
        s.scada.lastRecorded = null;
        mutate(
          "Updated " +
            scTag +
            " binding. Retest the provider before starting the line.",
        );
        return;
      }
      if (k === "save-collection") {
        s.scada.alarmMode = val("sc-alarm");
        s.scada.historyMode = val("sc-history");
        s.scada.proof = "";
        s.scada.samples = [];
        s.scada.lastRecorded = null;
        mutate("Alarm and collection rules saved. Retest the provider.");
        return;
      }
      if (k === "inject") {
        const sc = s.scada;
        const out = testSample(sc, val("sc-sample"), sc.lastRecorded);
        if (out.record) sc.lastRecorded = out.mass;
        sc.samples.push(out);
        sc.samples = sc.samples.slice(-12);
        mutate(
          "Test observation " +
            out.mode +
            " · " +
            out.quality +
            " · " +
            out.alarm +
            " · " +
            (out.record ? "historian write" : "no historian write") +
            ".",
        );
        return;
      }
      if (k === "prove-tags") {
        const test = tagTest(s.scada);
        s.scada.proof = test.ok ? tagSignature(s.scada) : "";
        mutate(test.why);
        return;
      }
      if (k === "save-screen") {
        s.hmi.title = val("screen");
        mutate("Screen title saved.");
        return;
      }
      if (k === "widget") {
        const title = val("title"),
          tag = val("tag"),
          type = val("type");
        if (!title) {
          feedback("Give the widget an operator-facing label.");
          return;
        }
        if (signals[tag] !== type) {
          feedback("The " + tag + " tag needs a " + signals[tag] + " widget.");
          return;
        }
        const old = s.hmi.widgets.findIndex((x) => x.tag === tag);
        const w = { title, tag, type };
        if (old >= 0) s.hmi.widgets.splice(old, 1, w);
        else s.hmi.widgets.push(w);
        mutate("Widget bound to " + tag + ".");
        return;
      }
      if (k === "save-recipe") {
        s.mes.recipe = val("recipe");
        mutate("Recipe identifier saved.");
        return;
      }
      if (k === "append") {
        const operation = val("operation");
        if (s.mes.route.includes(operation)) {
          feedback("Operation already on this routing.");
          return;
        }
        s.mes.route.push(operation);
        mutate("Added " + operation + " to route.");
        return;
      }
      if (k === "pop") {
        s.mes.route.pop();
        mutate("Last route operation removed.");
        return;
      }
      if (k === "save-erp") {
        s.erp = Object.fromEntries(
          Object.keys(mappings).map((key) => [key, val(key)]),
        );
        mutate("Adapter fields saved.");
      }
    }
    paint();
    // Listeners belong to this mount and are replaced if the parent reuses its container.
    root.onchange = (e) => {
      const k = e.target.dataset.fiKey;
      if (k === "sc-tag") scTag = val(k);
      else if (k === "device") device = val(k);
      else if (k === "host") host = val(k);
      else if (k === "vm") vm = val(k);
      else if (k === "role") role = val(k);
      else return;
      notice = "";
      paint();
      root.querySelector('[data-fi-key="' + k + '"]').focus();
    };
    root.oninput = (e) => {
      if (e.target.dataset.fiKey !== "code") return;
      s.plc.source = e.target.value;
      s.plc.compiled = "";
      feedback("Program edited. Compile and prove the new source.");
      onChange?.(s);
      const checkBox = root.querySelector("[data-fi-check]");
      if (checkBox) {
        checkBox.textContent = validPLC(s.plc);
        checkBox.classList.add("fi-open");
      }
      const plcTab = root.querySelector('[data-fi-tab="plc"]');
      if (plcTab) plcTab.textContent = "PLC · open";
    };
    root.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b || !root.contains(b)) return;
      if (b.dataset.fiTab) {
        tab = b.dataset.fiTab;
        notice = "";
        paint();
        root.querySelector('[data-fi-tab="' + tab + '"]').focus();
        return;
      }
      if (b.dataset.fiU) {
        installU(Number(b.dataset.fiU));
        return;
      }
      if (b.hasAttribute("data-fi-drop")) {
        s.patch.splice(Number(b.dataset.fiDrop), 1);
        mutate("Lead unplugged.");
        return;
      }
      if (b.hasAttribute("data-fi-del-widget")) {
        s.hmi.widgets.splice(Number(b.dataset.fiDelWidget), 1);
        mutate("Widget removed.");
        return;
      }
      if (b.dataset.fi) command(b.dataset.fi);
    };
  }
  window.FryInstall = {
    mount,
    empty: blank,
    solved: worked,
    check,
    permit,
    nextStage,
    stagePermit: (s, id, x) => permit(s, { ...x, stage: id }),
    operator,
  };
})();
