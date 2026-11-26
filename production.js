(() => {
  "use strict";
  const referenceMode =
    new URLSearchParams(location.search).get("bench") === "reference";
  const key = referenceMode
    ? "signalworks.reference-line.v1"
    : "signalworks.production.v1";
  const $ = (id) => document.getElementById(id);
  const root = $("station");
  const stations = [
    "orders",
    "servers",
    "plc",
    "sequence",
    "scada",
    "robot",
    "line",
    "trace",
  ];
  const recipe = {
    "CTN-06": "Six-pack carton",
    "CTN-12": "Twelve-pack carton",
  };
  const blankOrder = (n) => ({
    id: "WO-" + String(4200 + n),
    sku: "CTN-06",
    lot: "L-" + String(380 + n),
    target: 4,
    good: 0,
    rejects: 0,
    status: "Draft",
    route: "",
    events: [],
    posted: [],
    history: [],
  });
  const fresh = () => ({
    servers: {},
    plc: {},
    scada: {},
    robot: {},
    order: blankOrder(1),
    archive: [],
    journal: [],
    lastRun: false,
    infeed: true,
    guard: true,
    auto: true,
    quality: "Pass",
    interfaceOnline: true,
  });
  function referenceLine() {
    const state = fresh();
    const host = {
      prefix: "24",
      gateway: "10.42.8.1",
      dns: "10.42.8.10",
      bind: "Service NIC",
    };
    state.servers = {
      ready: true,
      checked: true,
      historian: {
        ...host,
        name: "hist-01",
        ip: "10.42.8.21",
        service: "History collector",
        port: "4841",
        grant: "Append samples",
        days: "30",
      },
      mes: {
        ...host,
        name: "mes-01",
        ip: "10.42.8.22",
        service: "Production API",
        port: "8443",
        grant: "Post completions",
        backup: "Independent repository",
        interval: "15",
      },
    };
    const permissive = "RUN := GUARD AND PART AND AUTO;";
    state.plc = { source: permissive, compiled: permissive, proven: true };
    state.sequence = window.SWSequence.reference();
    state.scada = {
      verified: true,
      widgets: [
        { position: 1, title: "Cell running", type: "lamp", tag: "lastRun" },
        {
          position: 2,
          title: "MES good cartons",
          type: "count",
          tag: "order.good",
        },
        {
          position: 3,
          title: "At inspection camera",
          type: "lamp",
          tag: "cell.atCamera",
        },
        {
          position: 4,
          title: "ERP finished stock",
          type: "count",
          tag: "erp.finished",
        },
        {
          position: 5,
          title: "Cartons rejected",
          type: "count",
          tag: "order.rejects",
        },
      ],
    };
    const pick = { shoulder: 12, elbow: 45 },
      place = { shoulder: 125, elbow: 35 };
    state.robot = {
      ready: true,
      goodTest: true,
      rejectTest: true,
      jog: { ...pick },
      pick,
      place,
    };
    Object.assign(state.order, { status: "Running", route: "CTN-06" });
    state.order.history.push({
      system: "Reference setup",
      action:
        "Example released and dispatched to PK-01 with preconfigured hardware, PLC logic and operator screen.",
    });
    return state;
  }
  let state = referenceMode ? referenceLine() : fresh();
  let writable = true;
  let savedVersion = null;
  let stale = false;
  try {
    savedVersion = localStorage.getItem(key);
    const data = JSON.parse(savedVersion);
    if (
      data?.order &&
      Array.isArray(data.order.events) &&
      Array.isArray(data.order.posted) &&
      Array.isArray(data.archive) &&
      Array.isArray(data.journal)
    ) {
      const orders = [data.order, ...data.archive];
      if (
        orders.every(
          (o) => o && Array.isArray(o.events) && Array.isArray(o.posted),
        )
      ) {
        for (const order of orders)
          if (!Array.isArray(order.history)) order.history = [];
        state = { ...state, ...data };
      }
    }
  } catch {
    /* A new workspace can still run when storage is unavailable. */
  }
  const initial = () => 12 + (state.receipts || 0);
  const allOrders = () => [...state.archive, state.order];
  const movementRows = (o) => o.events.filter((e) => o.posted.includes(e.id));
  const used = () => allOrders().reduce((sum, o) => sum + o.events.length, 0);
  function physicalBlanks() {
    const c = state.carton;
    const inCell =
      c &&
      c.orderId === state.order.id &&
      !state.order.events.some((e) => e.id === c.id);
    return initial() - used() - Number(Boolean(inCell));
  }
  const postedRaw = () =>
    allOrders().reduce((sum, o) => sum + movementRows(o).length, 0);
  const finished = (sku) =>
    allOrders()
      .filter((o) => o.sku === sku)
      .reduce(
        (sum, o) => sum + movementRows(o).filter((e) => e.accepted).length,
        0,
      );
  const esc = (s) =>
    String(s ?? "").replace(
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
  let station = "",
    feedback = "";
  const machines = window.SWMachines,
    controls = window.SWControls;
  function status() {
    const o = state.order;
    $("order-badge").innerHTML =
      "<strong>" +
      esc(o.id) +
      "</strong><span>" +
      esc(o.status) +
      " · " +
      o.good +
      "/" +
      o.target +
      " good</span>";
    const entries = [
      ["Servers", machines.serversReady(state)],
      [
        "PLC",
        state.plc &&
          controls.evaluatePLC(state, { guard: true, part: true, auto: true })
            .run,
      ],
      ["Sequence", window.SWSequence.ready(state)],
      ["SCADA", controls.scadaReady(state)],
      ["Robot", machines.robotReady(state)],
    ];
    $("rail").innerHTML = entries
      .map(
        ([name, ok]) =>
          '<b class="' +
          (ok ? "ready" : "") +
          '">' +
          (ok ? "●" : "○") +
          " " +
          name +
          " · " +
          (ok ? "ready" : "commission") +
          "</b>",
      )
      .join("");
  }
  function save() {
    if (stale) return;
    try {
      if (localStorage.getItem(key) !== savedVersion) {
        suspendStaleTab();
        return;
      }
      const version = JSON.stringify(state);
      localStorage.setItem(key, version);
      savedVersion = version;
    } catch {
      writable = false;
    }
    $("storage").textContent = writable
      ? ""
      : "Storage unavailable. Keep this tab open to retain the current exercise.";
    status();
  }
  function suspendStaleTab() {
    if (stale) return;
    stale = true;
    activeLine?.destroy();
    activeLine = null;
    root.inert = true;
    const notice = $("storage");
    notice.replaceChildren(
      document.createTextNode(
        "Another tab saved this workspace. This tab has paused. ",
      ),
    );
    const reload = document.createElement("button");
    reload.textContent = "Load latest work";
    reload.onclick = () => location.reload();
    notice.append(reload);
    notice.scrollIntoView({ block: "center" });
  }
  window.addEventListener("storage", (event) => {
    if (
      (event.key === key || event.key === null) &&
      localStorage.getItem(key) !== savedVersion
    )
      suspendStaleTab();
  });
  function log(text) {
    state.journal.push({
      order: state.order.id,
      text: String(text),
      time: new Date().toISOString(),
    });
    save();
  }
  function record(system, action) {
    if (state.order.status !== "Closed")
      state.order.history.push({ system, action });
    log(system + " · " + action);
  }
  const ctx = { state, save, log, refresh: () => render() };
  const facts = (items) =>
    '<div class="facts">' +
    items
      .map(
        ([k, v]) =>
          "<div><span>" +
          esc(k) +
          "</span><strong>" +
          esc(v) +
          "</strong></div>",
      )
      .join("") +
    "</div>";
  const action = (id, label, primary = false) =>
    '<button type="button" data-work="' +
    id +
    '" class="' +
    (primary ? "primary" : "") +
    '">' +
    label +
    "</button>";
  const message = () =>
    '<p class="notice" id="work-notice" role="status"' +
    (feedback ? "" : " hidden") +
    ">" +
    esc(feedback) +
    "</p>";
  const option = (value, label, selected) =>
    '<option value="' +
    esc(value) +
    '"' +
    (value === selected ? " selected" : "") +
    ">" +
    esc(label) +
    "</option>";
  const nav = (id, label) =>
    '<a class="btn" href="#' + id + '">' + label + " →</a>";
  function ordersUI() {
    const o = state.order;
    return (
      '<h2>Release and dispatch a production order</h2><p>Plan a short run for packing cell PK-01. Each cycle consumes one carton blank. A camera rejects a damaged carton before finished stock is booked.</p><div class="grid"><section class="card"><h3>ERP · production planning</h3>' +
      (o.status === "Draft"
        ? '<div class="fields"><label>Finished SKU<select id="sku">' +
          Object.entries(recipe)
            .map(([k, v]) => option(k, k + " · " + v, o.sku))
            .join("") +
          '</select></label><label>Good cartons ordered<input id="target" type="number" min="1" max="' +
          (initial() - used()) +
          '" step="1" value="' +
          o.target +
          '"></label></div><div class="actions">' +
          action("release", "Release order", true) +
          "</div>"
        : facts([
            ["Order", o.id],
            ["SKU", o.sku],
            ["Good required", o.target],
            ["Finished lot", o.lot],
            ["Blank stock lot", "BL-2601"],
          ])) +
      "<p>Opening stores balance for this exercise is 12 blanks. The inventory ledger updates when manufacturing events reach ERP.</p>" +
      facts([
        ["ERP blanks", initial() - postedRaw()],
        ["Physical blanks", physicalBlanks()],
        ["ERP finished · " + o.sku, finished(o.sku)],
      ]) +
      '<div class="actions">' +
      action("receive", "Receive 6 blanks") +
      "</div></section>" +
      '<section class="card"><h3>MES · dispatch</h3><p>Match the released SKU to the packing recipe, then dispatch it to PK-01. The order ID and material lot follow every carton.</p><label>Cell recipe<select id="route">' +
      option("", "Choose recipe", o.route) +
      Object.entries(recipe)
        .map(([k, v]) => option(k, v, o.route))
        .join("") +
      '</select></label><div class="actions">' +
      action("dispatch", "Dispatch to PK-01", true) +
      "</div>" +
      facts([
        ["State", o.status],
        ["Cell", "PK-01"],
      ]) +
      "</section></div>" +
      message() +
      '<h3>Commission the four workstations</h3><div class="actions">' +
      nav("servers", "Configure servers") +
      nav("plc", "Program controller") +
      nav("sequence", "Write the carton sequence") +
      nav("scada", "Build operator screen") +
      nav("robot", "Teach robot") +
      "</div>"
    );
  }
  function traceUI() {
    const o = state.order,
      booked = movementRows(o),
      postedGood = booked.filter((e) => e.accepted).length;
    const rows = o.events
      .map(
        (e) =>
          "<tr><td>" +
          "<details><summary>" +
          esc(e.id) +
          "</summary><p>" +
          esc(e.snapshot || e.summary) +
          "</p>" +
          (e.scans?.length
            ? "<ol>" +
              e.scans.map((scan) => "<li>" + esc(scan) + "</li>").join("") +
              "</ol>"
            : "") +
          "</details></td><td>BL-2601 → " +
          esc(e.lot) +
          "</td><td>" +
          esc(e.result) +
          "</td><td>−1 blank</td><td>" +
          (e.accepted ? "+1 carton" : "0 cartons") +
          "</td><td>" +
          (o.posted.includes(e.id) ? "Posted" : "Queued") +
          "</td></tr>",
      )
      .join("");
    return (
      "<h2>Reconcile the lot in MES and ERP</h2><p>Pause the interface, run the line and compare the physical count with ERP. Restore the interface and replay the events twice. Each event ID can move inventory once.</p>" +
      facts([
        ["Manufacturing order", o.id],
        ["MES good", o.good],
        ["ERP good · this order", postedGood],
        ["Awaiting acknowledgement", o.events.length - booked.length],
        ["ERP blanks on hand", initial() - postedRaw()],
      ]) +
      '<div class="actions">' +
      action(
        "interface",
        state.interfaceOnline ? "Pause ERP interface" : "Restore ERP interface",
      ) +
      action("post", "Post / replay events", true) +
      action("close", "Reconcile and close") +
      (o.status === "Closed" ? action("new", "Start next order") : "") +
      "</div>" +
      message() +
      '<section class="ledger"><h3>Material and finished stock movements</h3><table><thead><tr><th>Event</th><th>Lot</th><th>Inspection</th><th>Consumption</th><th>Receipt</th><th>ERP</th></tr></thead><tbody>' +
      rows +
      "</tbody></table>" +
      (rows
        ? ""
        : "<p>Dispatch an order and complete a cycle to create the first movement.</p>") +
      '</section><section class="ledger"><h3>Order history</h3><ol>' +
      o.history
        .map(
          (e) =>
            "<li><strong>" +
            esc(e.system) +
            "</strong> · " +
            esc(e.action) +
            "</li>",
        )
        .join("") +
      "</ol><details><summary>Engineering journal (" +
      state.journal.length +
      ")</summary><ol>" +
      state.journal
        .map((e) => "<li>" + esc(e.order) + " · " + esc(e.text) + "</li>")
        .join("") +
      "</ol></details></section>" +
      state.archive
        .map(
          (order) =>
            '<details class="ledger"><summary>Closed order ' +
            esc(order.id) +
            " · " +
            esc(order.sku) +
            " · " +
            order.good +
            " accepted</summary><p>Blank lot BL-2601 → finished lot " +
            esc(order.lot) +
            "</p><ol>" +
            order.events
              .map(
                (event) =>
                  "<li>" +
                  esc(event.snapshot || event.summary) +
                  " · " +
                  (order.posted.includes(event.id) ? "Posted" : "Queued") +
                  "</li>",
              )
              .join("") +
            "</ol></details>",
        )
        .join("")
    );
  }
  function checkStart() {
    const o = state.order;
    if (stale) return "This tab is paused. Load the latest saved workspace.";
    if (o.status !== "Running")
      return "No running MES order. Release the order in ERP and dispatch the matching recipe in MES.";
    if (o.good >= o.target)
      return "Good quantity reached. Reconcile the lot in ERP.";
    if (used() >= initial())
      return "Stores is empty. Receive more carton blanks at the order desk.";
    if (!machines.serversReady(state))
      return "MES cannot record the cycle. Commission the servers and prove the application path.";
    const result = controls.evaluatePLC(state, {
      guard: state.guard,
      part: state.infeed,
      auto: state.auto,
    });
    if (!result.run) return "PLC output OFF. " + result.reason;
    if (!controls.scadaReady(state))
      return "Operator screen is uncommissioned. Bind a run indicator and good count and prove runtime.";
    if (!machines.robotReady(state))
      return "Robot program has no proven pick and place. Teach and test the cell.";
    return "";
  }
  function commitCarton(carton) {
    const o = state.order;
    if (writable && localStorage.getItem(key) !== savedVersion)
      suspendStaleTab();
    if (stale) throw new Error("A newer workspace is saved in another tab.");
    if (carton.orderId !== o.id)
      throw new Error("Carton belongs to another order.");
    if (o.events.some((event) => event.id === carton.id)) return;
    const expected =
      o.id +
      "-" +
      String(o.cartonSerial || o.events.length + 1).padStart(3, "0");
    if (carton.id !== expected || carton.stage !== "complete")
      throw new Error("Carton has not reached its booking step.");
    const problem = checkStart();
    if (problem) throw new Error(problem);
    const { accepted, id } = carton;
    const summary =
      id +
      " · " +
      (accepted
        ? "inspection accepted; robot transferred carton"
        : "inspection rejected; conveyor diverted carton to reject bin") +
      " · lot " +
      o.lot;
    const stamp = new Date().toISOString();
    const snapshot =
      stamp +
      " | " +
      o.id +
      " | PK-01 | recipe " +
      o.sku +
      " | blank lot BL-2601 | PLC sampled AUTO=1, PART=1, GUARD=1, RUN=1 | " +
      summary +
      " | historian " +
      state.servers.historian.name +
      " | MES " +
      state.servers.mes.name;
    o.events.push({
      id,
      lot: o.lot,
      result: accepted ? "Pass" : "Reject",
      accepted,
      summary,
      snapshot,
      scans: (state.lineTrace || [])
        .filter((row) => row.order === o.id && row.text.startsWith(id + " · "))
        .map((row) => row.text),
    });
    if (accepted) o.good++;
    else o.rejects++;
    if (state.interfaceOnline) o.posted.push(id);
    record("PLC → cell → MES", summary);
    if (state.interfaceOnline)
      record(
        "ERP interface",
        id +
          " acknowledged. Goods issue: one blank. Finished receipt: " +
          (accepted ? "one carton." : "zero cartons."),
      );

    if (stale)
      throw new Error(
        "Another tab changed the saved ledger. Load the latest work.",
      );
    return summary;
  }
  function perform(id) {
    const o = state.order;
    switch (id) {
      case "receive":
        state.receipts = (state.receipts || 0) + 6;
        record("ERP stores", "Received 6 carton blanks into stores.");
        return "Six blanks received in physical stores and ERP.";
      case "release": {
        const n = $("target").valueAsNumber;
        if (o.status !== "Draft") return "Only a draft order can be released.";
        if (!Number.isInteger(n) || n < 1 || n > initial() - used())
          return "Enter a whole quantity within the available physical stock.";
        o.sku = $("sku").value;
        o.target = n;
        o.status = "Released";
        record("ERP", o.id + " released for " + n + " × " + o.sku + ".");
        return "Released to MES. Select the matching recipe and dispatch the order.";
      }
      case "dispatch":
        if (o.status !== "Released")
          return "MES dispatch requires a released order.";
        if ($("route").value !== o.sku)
          return "Recipe mismatch. Check the finished SKU on the ERP order.";
        o.route = o.sku;
        o.status = "Running";
        record(
          "MES",
          "PK-01 dispatched with " +
            recipe[o.sku] +
            " using blank lot BL-2601 for finished lot " +
            o.lot +
            ".",
        );
        return "Order running. Commission the workstations, then run the line.";
      case "interface":
        state.interfaceOnline = !state.interfaceOnline;
        record(
          "Interface",
          state.interfaceOnline ? "Service restored." : "Service paused.",
        );
        return state.interfaceOnline
          ? "Interface online. Post the queued events."
          : "Interface paused. Manufacturing events will queue in MES.";
      case "post": {
        if (!state.interfaceOnline)
          return "Interface offline. MES events remain queued.";
        const prior = o.posted.length;
        o.posted = o.events.map((e) => e.id);
        const response =
          o.posted.length -
          prior +
          " new ERP postings; " +
          prior +
          " previously acknowledged events ignored.";
        record("ERP interface", response);
        return response;
      }
      case "close":
        if (o.status === "Closed") return "Order already closed.";
        if (
          o.status !== "Running" ||
          o.good !== o.target ||
          o.posted.length !== o.events.length
        )
          return "Closure blocked. Meet the good quantity and acknowledge every accepted and rejected event.";
        state.lastRun = false;
        record(
          "ERP",
          o.id +
            " closed. " +
            o.events.length +
            " blanks consumed, " +
            o.good +
            " finished cartons received and " +
            o.rejects +
            " rejects accounted for.",
        );
        o.status = "Closed";
        return "Order closed and inventory reconciled.";
      case "new":
        if (o.status !== "Closed") return "Close the current order first.";
        state.archive.push(o);
        state.order = blankOrder(state.archive.length + 1);
        record("ERP", "New planning order.");
        location.hash = "orders";
        return "New order created.";
    }
  }
  let activeLine;
  function render() {
    if (stale) return;
    activeLine?.destroy();
    activeLine = null;
    const newStation = stations.includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : "orders";
    if (newStation !== station) feedback = "";
    station = newStation;
    for (const a of $("stations").children) {
      if (a.hash === "#" + station) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    root.replaceChildren();
    status();
    const editor = {
      servers: machines.renderServers,
      robot: machines.renderRobot,
      plc: controls.renderPLC,
      scada: controls.renderSCADA,
    }[station];
    if (editor) editor(root, ctx);
    else if (station === "sequence") window.SWSequence.mount(root, state, save);
    else if (station === "line") {
      activeLine = window.SWLineWorkspace.mount(root, {
        ...ctx,
        checkStart,
        commit: commitCarton,
        renderOperator: (container) =>
          controls.renderOperator(container, state),
        inventory: () => ({
          blanks: initial() - postedRaw(),
          physicalBlanks: physicalBlanks(),
          finished: finished(state.order.sku),
          queued: state.order.events.length - state.order.posted.length,
        }),
        post: () => perform("post"),
        go: (hash) => {
          location.hash = hash.replace(/^#/, "");
        },
      });
    } else {
      root.innerHTML = station === "orders" ? ordersUI() : traceUI();
      if (station === "trace") {
        const practice = document.createElement("section");
        root.append(practice);
        window.SWSAP.mount(practice, state);
      }
    }
  }
  root.addEventListener("click", (event) => {
    const b = event.target.closest("[data-work]");
    if (!b || station === "line") return;
    feedback = perform(b.dataset.work);
    save();
    render();
    const target = root.querySelector('[data-work="' + b.dataset.work + '"]');
    if (target) target.focus({ preventScroll: true });
  });
  root.addEventListener("change", (event) => {
    const id = event.target.id;
    if (station === "orders" && state.order.status === "Draft") {
      if (id === "sku") state.order.sku = event.target.value;
      if (
        id === "target" &&
        event.target.validity.valid &&
        event.target.value !== ""
      )
        state.order.target = event.target.valueAsNumber;
      if (id === "sku" || id === "target") save();
    }
  });
  document.querySelector(".skip").addEventListener("click", (e) => {
    e.preventDefault();
    root.focus();
  });
  document.getElementById("bench-mode").innerHTML = referenceMode
    ? 'Reference line · preconfigured for practice. <a href="production.html#orders">Open my commissioning workspace</a>'
    : '<a href="production.html?bench=reference#line">Try the preconfigured 3D line</a> · Your commissioning work is saved separately.';
  window.addEventListener("pagehide", () => activeLine?.destroy());
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) render();
  });
  window.addEventListener("hashchange", render);
  render();
})();
