(() => {
  "use strict";
  const key = "signalworks.production.v1";
  const $ = (id) => document.getElementById(id);
  const root = $("station");
  const stations = [
    "orders",
    "servers",
    "plc",
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
  let state = fresh();
  let writable = true;
  try {
    const data = JSON.parse(localStorage.getItem(key));
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
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      writable = false;
    }
    $("storage").textContent = writable
      ? ""
      : "Storage unavailable. Keep this tab open to retain the current exercise.";
    status();
  }
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
        ["Physical blanks", initial() - used()],
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
      nav("scada", "Build operator screen") +
      nav("robot", "Teach robot") +
      "</div>"
    );
  }
  const flag = (id, label, checked) =>
    '<label><select id="' +
    id +
    '">' +
    option("yes", "Yes", checked ? "yes" : "no") +
    option("no", "No", checked ? "yes" : "no") +
    "</select>" +
    label +
    "</label>";
  function lineUI() {
    const o = state.order;
    return (
      '<h2>Operate packing cell PK-01</h2><p>Set the field inputs, then run one carton. Watch your PLC output, taught robot cycle, inspection result and MES counters. Try one reject, then make up the shortfall.</p><div class="grid"><section class="card"><h3>Operator station</h3><div class="fields">' +
      flag("guard", "Process permissive healthy", state.guard) +
      flag("infeed", "Blank present at infeed", state.infeed) +
      flag("auto", "Automatic mode selected", state.auto) +
      '<label>Next camera result<select id="quality">' +
      option("Pass", "Accept carton", state.quality) +
      option("Reject", "Reject carton", state.quality) +
      '</select></label></div><div class="actions">' +
      action("cycle", "Execute one cycle", true) +
      action("stop", "Stop cell") +
      "</div>" +
      message() +
      '</section><section class="card"><h3>Production readback</h3><div class="lineflow"><span>Inspect infeed</span> → <span class="' +
      (state.lastRun ? "running" : "") +
      '">Robot</span> → <span>Finished stock</span></div><p>' +
      esc(o.events.at(-1)?.summary || "No carton has completed a cycle.") +
      "</p>" +
      facts([
        ["PLC run output", state.lastRun ? "ON" : "OFF"],
        ["MES accepted", o.good + " / " + o.target],
        ["MES rejected", o.rejects],
        ["Physical blanks", initial() - used()],
      ]) +
      '<div class="actions">' +
      nav("scada", "Open SCADA") +
      nav("trace", "Trace the lot") +
      '</div></section></div><div class="grid live-panels"><section class="card"><h3>Robot cycle replay</h3><div id="cell-live"></div></section><section class="card"><h3>Your operator screen</h3><div id="screen-live"></div></section></div>'
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
          "</p></details></td><td>BL-2601 → " +
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
  function cycle() {
    const o = state.order;
    state.lastRun = false;
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
    state.lastRun = true;
    const accepted = state.quality === "Pass",
      id = o.id + "-" + String(o.events.length + 1).padStart(3, "0");
    const summary =
      id +
      " · " +
      (accepted
        ? "inspection accepted; robot transferred carton"
        : "inspection rejected; carton held at infeed and booked to scrap") +
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
      result: state.quality,
      accepted,
      summary,
      snapshot,
    });
    if (accepted) o.good++;
    else o.rejects++;
    record("PLC → robot → MES", summary);
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
      case "cycle":
        return cycle();
      case "stop":
        state.lastRun = false;
        record("PLC", "Operator stopped the cell.");
        return "Run output OFF. Stock and order quantities are unchanged.";
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
  function render() {
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
    else
      root.innerHTML = { orders: ordersUI, line: lineUI, trace: traceUI }[
        station
      ]();
    if (station === "line") {
      machines.showCell(document.getElementById("cell-live"), state);
      controls.renderOperator(document.getElementById("screen-live"), state);
    }
  }
  root.addEventListener("click", (event) => {
    const b = event.target.closest("[data-work]");
    if (!b) return;
    const previous = state.order.events.length;
    feedback = perform(b.dataset.work);
    save();
    render();
    if (b.dataset.work === "cycle" && state.order.events.length > previous)
      machines.playCycle(
        document.getElementById("cell-live"),
        state,
        state.order.events.at(-1).accepted,
      );
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
    if (
      !["guard", "infeed", "auto", "quality"].includes(id) ||
      station !== "line"
    )
      return;
    state[id] =
      id === "quality" ? event.target.value : event.target.value === "yes";
    if (!state.guard || !state.infeed || !state.auto) state.lastRun = false;
    save();
    render();
    document.getElementById(id)?.focus({ preventScroll: true });
  });
  document.querySelector(".skip").addEventListener("click", (e) => {
    e.preventDefault();
    root.focus();
  });
  window.addEventListener("hashchange", render);
  render();
})();
