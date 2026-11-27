/* Greenfield site trainer. Grid dimensions and acceptance rules belong to this fictional site. */
(function () {
  "use strict";
  const buildings = {
    intake: ["Raw intake", 6, "Washable wet finish", "floor/receive"],
    process: ["Process hall", 7, "Sealed hygienic finish", "floor/wash"],
    cold: ["Cold store", 8, "Insulated vapour-tight envelope", "floor/freeze"],
    utilities: [
      "Utilities",
      13,
      "Ventilated industrial finish",
      "installation/host",
    ],
    control: ["Control and server room", 14, "Dry filtered enclosure", "rack"],
    dispatch: ["Dispatch", 9, "Weather-sealed dock", "floor/dispatch"],
  };
  const buildingPackages = {
    intake: [
      "Washdown receiving slab",
      "Open unloading canopy",
      "Wet, dirty deliveries need a washable receiving surface.",
      "The canopy keeps the raw unloading face open for inbound loads.",
    ],
    process: [
      "Drained process floor",
      "Cleanable process frame",
      "Wash water needs a defined collection route to process treatment.",
      "The process hall needs cleanable exposed surfaces around the equipment.",
    ],
    cold: [
      "Insulated cold-store floor",
      "Cold-envelope support frame",
      "The cold store needs a floor assembly that maintains the thermal boundary.",
      "The frame must support the continuous cold-room envelope.",
    ],
    utilities: [
      "Plant equipment base",
      "Service-access frame",
      "The utility plant needs a base matched to equipment support.",
      "The service frame keeps maintenance and equipment replacement paths accessible.",
    ],
    control: [
      "Dry equipment slab",
      "Enclosed services frame",
      "The controls room needs a dry support surface for the equipment area.",
      "The enclosure protects controls and provides contained service routes.",
    ],
    dispatch: [
      "Dock loading slab",
      "Clear-span dock frame",
      "The dock interface must support the outbound handling zone.",
      "Clear loading paths prevent the frame from obstructing dispatch movements.",
    ],
  };
  function packages(id) {
    if (!Object.hasOwn(buildingPackages, id)) return null;
    const [foundation, frame, foundationWhy, frameWhy] = buildingPackages[id];
    return { foundation, frame, foundationWhy, frameWhy };
  }
  const services = [
    ["utilities.power", "process.power", "Power"],
    ["utilities.water", "process.water", "Water"],
    ["utilities.chilled", "cold.chilled", "Chilled loop"],
    ["control.network", "process.network", "Network"],
    ["cold.product", "dispatch.product", "Product transfer"],
    ["process.wastewater", "utilities.treatment", "Wastewater"],
    ["utilities.heat", "process.heat", "Process heat"],
    ["utilities.air", "process.air", "Instrument air"],
  ];
  const tabs = {
    survey: "Survey",
    layout: "Footprints",
    build: "Construction",
    services: "Utilities",
    access: "Road and docks",
    prove: "Acceptance",
  };
  const levels = ["Footprint", "Foundation", "Frame", "Shell"];
  const guideIds = {
    survey: "plot",
    layout: "buildings",
    build: "buildings",
    services: "utilities",
    access: "utilities",
    prove: "acceptance",
  };
  const plots = Array.from({ length: 24 }, (_, i) => i);
  const label = (n) =>
    plots.includes(n)
      ? "ABCD"[Math.floor(n / 6)] + ((n % 6) + 1)
      : "Unassigned";
  const levelNames = (n) => levels[n] || "Unplaced";
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
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const finitePlot = (n) => Number.isInteger(n) && n >= 0 && n < 24;
  const empty = () => ({
    buildings: {},
    links: [],
    survey: false,
    access: false,
    surveyPlan: { reserve: [], entrance: null },
    roads: { gate: null, receiving: null, outbound: null },
    witness: "",
    commissioned: false,
  });
  const surveyIssue = (s) => {
    const p = s?.surveyPlan || {},
      v = Array.isArray(p.reserve) ? p.reserve : [];
    if (v.length !== 2 || !v.includes(0) || !v.includes(1))
      return "Flag the two north-west low points A1 and A2 as the flood reserve.";
    if (p.entrance !== 12)
      return "The existing west-road opening is at C1. Mark it as the entrance.";
    return "";
  };
  const adjacent = (a, b) =>
    finitePlot(a) &&
    finitePlot(b) &&
    Math.abs((a % 6) - (b % 6)) +
      Math.abs(Math.floor(a / 6) - Math.floor(b / 6)) ===
      1;
  const neighbours = (n) =>
    [n - 6, n - 1, n + 1, n + 6].filter((k) => adjacent(n, k));
  function layoutIssue(s) {
    const b = s.buildings || {},
      occupied = new Map();
    for (const [id, [name]] of Object.entries(buildings)) {
      const n = b[id]?.cell;
      if (!finitePlot(n)) return "Place the " + name + " footprint.";
      if ([0, 1, 12].includes(n))
        return (
          name +
          " occupies " +
          label(n) +
          ", reserved for drainage or the road entrance. Move its footprint."
        );
      if (occupied.has(n))
        return name + " overlaps " + occupied.get(n) + " at " + label(n) + ".";
      occupied.set(n, name);
    }
    const spine = ["intake", "process", "cold", "dispatch"];
    for (let i = 1; i < spine.length; i++) {
      const a = b[spine[i - 1]].cell,
        n = b[spine[i]].cell;
      if (!adjacent(a, n) || n !== a + 1)
        return (
          "Keep " +
          buildings[spine[i]][0] +
          " immediately east of " +
          buildings[spine[i - 1]][0] +
          " for one-way material flow."
        );
    }
    if (!adjacent(b.utilities.cell, b.process.cell))
      return "Locate utilities beside the process hall to match the short service-route brief.";
    if (
      !adjacent(b.control.cell, b.utilities.cell) ||
      adjacent(b.control.cell, b.intake.cell)
    )
      return "Keep the control room beside utilities and away from the raw intake wall.";
    return "";
  }
  function buildIssue(s) {
    for (const [id, [name, , finish]] of Object.entries(buildings)) {
      const b = s.buildings?.[id];
      if (!b || b.level !== 3)
        return (
          "Complete the " + name + " footprint, foundation, frame and shell."
        );
      const pkg = packages(id);
      if (b.foundation !== pkg.foundation || b.frame !== pkg.frame)
        return (
          name +
          " needs its specified foundation and frame recorded. Rework to footprint and select the matching packages."
        );
      if (b.finish !== finish)
        return name + " requires " + finish + ". Rework its shell finish.";
    }
    return "";
  }
  function linkIssue(s) {
    const links = s.links || [];
    for (const [from, to, service] of services) {
      if (
        !links.some(
          (x) => x.from === from && x.to === to && x.service === service,
        )
      )
        return "Verify " + service + " from " + from + " to " + to + ".";
    }
    if (links.length !== services.length)
      return "Remove extra utility links that are outside the endpoint schedule.";
    return "";
  }
  function roadPaths(s) {
    const { gate, receiving, outbound } = s.roads || {};
    if (gate !== 12) return { why: "Use the surveyed entrance at C1." };
    if (!adjacent(s.buildings?.intake?.cell, receiving))
      return {
        why: "Choose a receiving apron directly beside the raw intake.",
      };
    if (!adjacent(s.buildings?.dispatch?.cell, outbound))
      return { why: "Choose an outbound apron beside dispatch." };
    if (receiving === outbound)
      return { why: "Use a distinct apron for finished goods." };
    const blocked = new Set([
      0,
      1,
      ...Object.values(s.buildings).map((b) => b.cell),
    ]);
    function path(end, avoid) {
      if (blocked.has(gate) || blocked.has(end)) return [];
      const queue = [[gate]],
        seen = new Set([gate]);
      for (const route of queue) {
        const tail = route.at(-1);
        if (tail === end) return route;
        for (const n of neighbours(tail)) {
          if (seen.has(n) || blocked.has(n) || (n === avoid && n !== gate))
            continue;
          seen.add(n);
          queue.push([...route, n]);
        }
      }
      return [];
    }
    const raw = path(receiving, outbound),
      finished = path(outbound, receiving);
    return {
      raw,
      finished,
      why:
        !raw.length || !finished.length
          ? "No clear vehicle route reaches both aprons while avoiding buildings, flood cells and the opposite dock. Choose other apron cells or rework the site layout."
          : "",
    };
  }
  function tests(s) {
    return [
      [
        "Survey",
        surveyIssue(s) ||
          (!s.survey
            ? "Run the survey check to record the surveyed reserve and entrance."
            : ""),
      ],
      ["Footprints and flow", layoutIssue(s)],
      ["Construction and finishes", buildIssue(s)],
      ["Utility connections", linkIssue(s)],
      [
        "Road and dock access",
        roadPaths(s).why ||
          (!s.access
            ? "Run the vehicle route test on the current dock plan."
            : ""),
      ],
    ];
  }
  function signature(s) {
    return JSON.stringify([
      s.surveyPlan.reserve.slice().sort((x, y) => x - y),
      s.surveyPlan.entrance,
      Object.keys(buildings).map((k) => {
        const b = s.buildings[k];
        return [b?.cell, b?.level, b?.foundation, b?.frame, b?.finish];
      }),
      s.links.map((x) => [x.from, x.to, x.service].join("|")).sort(),
      s.roads.gate,
      s.roads.receiving,
      s.roads.outbound,
    ]);
  }
  function check(site) {
    const s = { ...empty(), ...site };
    const fail = tests(s).find(([, why]) => why);
    if (fail) return { ok: false, why: fail[1] };
    if (s.witness !== signature(s))
      return {
        ok: false,
        why: "Run acceptance tests on the current construction record.",
      };
    if (!s.commissioned)
      return {
        ok: false,
        why: "Commission the site using the verified acceptance record.",
      };
    return {
      ok: true,
      why: "Survey, construction, utilities and vehicle routes passed. Site commissioned.",
    };
  }
  function solved() {
    const s = empty();
    s.surveyPlan = { reserve: [0, 1], entrance: 12 };
    s.survey = true;
    for (const [k, [, cell, finish]] of Object.entries(buildings))
      s.buildings[k] = {
        cell,
        finish,
        level: 3,
        foundation: packages(k).foundation,
        frame: packages(k).frame,
      };
    s.links = services.map(([from, to, service]) => ({ from, to, service }));
    s.roads = { gate: 12, receiving: 12, outbound: 15 };
    s.access = true;
    s.witness = signature(s);
    s.commissioned = true;
    return s;
  }
  const field = (k, title, options, value) =>
    "<label>" +
    esc(title) +
    '<select data-sb-key="' +
    k +
    '">' +
    options
      .map((row) => {
        const [val, text] = Array.isArray(row) ? row : [row, row];
        return (
          '<option value="' +
          esc(val) +
          '"' +
          (String(val) === String(value) ? " selected" : "") +
          ">" +
          esc(text) +
          "</option>"
        );
      })
      .join("") +
    "</select></label>";
  const button = (id, title, disable = false) =>
    '<button type="button" data-sb="' +
    id +
    '"' +
    (disable ? " disabled" : "") +
    ">" +
    esc(title) +
    "</button>";
  const header = (name, why, goal) =>
    "<h3>" +
    esc(name) +
    "</h3><p>" +
    esc(goal) +
    '</p><p class="sb-hint">' +
    esc(why) +
    "</p>";
  const hint = (content) =>
    '<details class="sb-hint"><summary>Worked example</summary><p>' +
    esc(content) +
    "</p></details>";
  const selectedBuildings = Object.entries(buildings).map(([id, [name]]) => [
    id,
    name,
  ]);
  const finishList = ["", ...Object.values(buildings).map((x) => x[2])];
  const plotOptions = [
    ["", "Choose a plot"],
    ...plots.map((n) => [n, label(n)]),
  ];
  const list = (rows) =>
    '<ul class="sb-roster">' +
    rows.map((x) => "<li>" + x + "</li>").join("") +
    "</ul>";
  function mount(root, site, onChange, readonly = false) {
    const s = readonly ? clone(site || empty()) : site || empty();
    for (const [k, v] of Object.entries(empty())) if (s[k] == null) s[k] = v;
    const noEdit = Boolean(readonly);
    let current = !s.survey
      ? "survey"
      : layoutIssue(s)
        ? "layout"
        : buildIssue(s)
          ? "build"
          : linkIssue(s)
            ? "services"
            : !s.access
              ? "access"
              : "prove";
    let picked = null,
      building =
        Object.keys(buildings).find((k) => !s.buildings[k]) || "intake",
      surveyMode = "inspect",
      camera = "overview",
      notice = "",
      acceptRows = null,
      routeReport = null,
      guideOpen = false;
    root.innerHTML =
      '<section class="sb-build"><div class="sb-layout"><section class="sb-viewport"><h3>Greenfield site plan</h3><canvas data-sb-scene aria-label="Interactive site model. Choose a plot here or use the labelled grid in the inspector."></canvas><div class="sb-actions" aria-label="Site camera">' +
      ["overview", "top", "detail"]
        .map(
          (k) =>
            '<button type="button" data-sb-camera="' +
            k +
            '">' +
            k[0].toUpperCase() +
            k.slice(1) +
            "</button>",
        )
        .join("") +
      '</div><div data-sb-selection></div></section><section class="sb-inspector" aria-label="Site construction inspector"><nav data-sb-nav aria-label="Construction stages"></nav><button type="button" data-sb="guide" aria-expanded="false">Field guide</button><div data-sb-guide class="sb-guide" hidden></div><div data-sb-panel></div><div data-sb-msg role="status" aria-live="polite"></div></section></div></section>';
    const q = (k) => root.querySelector(k),
      panel = q("[data-sb-panel]");
    const selections = new Map();
    const choiceKey = (key) =>
      current === "build" ? building + "." + key : current + "." + key;
    let scene = null,
      sceneIssue = "";
    function receivePlot(n) {
      if (!finitePlot(n)) return;
      picked = n;
      if (current === "survey" && !noEdit && surveyMode !== "inspect") {
        const p = s.surveyPlan;
        if (surveyMode === "entry" && p.entrance === n) {
          notice = label(n) + " is already the recorded entrance.";
          draw();
          return;
        }
        if (surveyMode === "flood") {
          const idx = p.reserve.indexOf(n);
          if (idx >= 0) p.reserve.splice(idx, 1);
          else p.reserve.push(n);
        } else p.entrance = n;
        s.survey = false;
        s.access = false;
        invalidate();
        notice =
          (surveyMode === "flood"
            ? "Updated flood reserve at "
            : "Entrance marked at ") +
          label(n) +
          ". Run the survey check.";
        save();
      } else
        notice =
          label(n) +
          " selected" +
          (current === "layout"
            ? ". Use Place footprint to position " +
              buildings[building][0] +
              "."
            : ".");
      draw();
    }
    if (window.SiteScene?.mount) {
      try {
        scene = window.SiteScene.mount(q("[data-sb-scene]"), receivePlot);
      } catch {
        sceneIssue =
          "The 3D view could not initialise. Use the labelled plot grid.";
      }
    } else
      sceneIssue = "The 3D view is unavailable. Use the labelled plot grid.";
    function invalidate() {
      s.witness = "";
      s.commissioned = false;
      acceptRows = null;
    }
    function save() {
      onChange?.(s);
    }
    function grid() {
      const cells = plots.map((n) => {
        const id = Object.keys(s.buildings).find(
          (id) => s.buildings[id].cell === n,
        );
        const tags = [
          id ? buildings[id]?.[0] : "",
          s.surveyPlan.reserve.includes(n) ? "Reserve" : "",
          s.surveyPlan.entrance === n ? "Gate" : "",
        ].filter(Boolean);
        return (
          '<button type="button" data-sb-cell="' +
          n +
          '" aria-pressed="' +
          (n === picked) +
          '" aria-label="' +
          esc(label(n) + (tags.length ? " " + tags.join(", ") : " vacant")) +
          '"><b>' +
          label(n) +
          "</b>" +
          (tags.length ? "<small>" + esc(tags.join(" · ")) + "</small>" : "") +
          "</button>"
        );
      });
      return (
        '<div class="sb-grid" role="group" aria-label="Parcel grid, rows A to D north to south, columns 1 to 6 west to east">' +
        cells.join("") +
        "</div>"
      );
    }
    function bField() {
      return field("building", "Building", selectedBuildings, building);
    }
    function accessFields() {
      return (
        '<div class="sb-fields">' +
        [
          ["gate", "Road gate"],
          ["receiving", "Raw receiving apron"],
          ["outbound", "Finished outbound apron"],
        ]
          .map(([k, t]) => field(k, t, plotOptions, s.roads[k] ?? ""))
          .join("") +
        "</div>"
      );
    }
    function remaining() {
      return Object.entries(buildings)
        .filter(
          ([id]) =>
            s.buildings[id]?.level !== 3 ||
            s.buildings[id]?.finish !== buildings[id][2] ||
            s.buildings[id]?.foundation !== packages(id).foundation ||
            s.buildings[id]?.frame !== packages(id).frame,
        )
        .map(([, x]) => x[0]);
    }
    function surveyReading(n) {
      if (!finitePlot(n))
        return "Choose a parcel cell for its spot level, drainage condition and access observation.";
      const elevation =
        n === 0
          ? 98.2
          : n === 1
            ? 98.4
            : 100.0 + (n % 6) * 0.14 + Math.floor(n / 6) * 0.19;
      const drainage =
        elevation < 99
          ? "Surface ponding and wetland vegetation. Below the 99.00 m reserve threshold."
          : "Ground drains away from this cell. Above the reserve threshold.";
      const access =
        n === 12
          ? "A break in the west fence meets the existing road."
          : n % 6 === 0
            ? "West boundary fence continuous. No vehicle opening."
            : "Interior or opposite boundary cell. No opening to west road.";
      return (
        label(n) +
        " · spot level " +
        elevation.toFixed(2) +
        " m. " +
        drainage +
        " " +
        access
      );
    }
    function stageBody() {
      const b = s.buildings[building],
        name = buildings[building][0];
      if (current === "survey")
        return (
          header(
            "Survey the parcel",
            "These are fictional classroom survey measurements against a local datum. Grade below 99.00 m with observed ponding forms the flood reserve. North is at the top (row A), west at the left (column 1). Find the existing opening in the west boundary fence.",
            "Mark the flood reserve and road opening before placing buildings.",
          ) +
          field(
            "survey-mode",
            "Marking tool",
            [
              ["inspect", "Inspect without marking"],
              ["flood", "Toggle a flood-reserve cell"],
              ["entry", "Mark road entrance"],
            ],
            surveyMode,
          ) +
          grid() +
          '<p data-sb-reading class="sb-status">' +
          esc(surveyReading(picked)) +
          "</p>" +
          "<p>Flood reserve: " +
          esc(s.surveyPlan.reserve.map(label).join(", ") || "Unmarked") +
          ". Entrance: " +
          label(s.surveyPlan.entrance) +
          ".</p>" +
          button("survey", "Check survey", noEdit) +
          hint(
            "Use the flood tool to select A1 and A2. Switch the marking tool to road entrance, select C1 and check the survey.",
          )
        );
      if (current === "layout")
        return (
          header(
            "Place building footprints",
            "Raw material enters on the west. Keep the sequence intake, process, cold and dispatch in four directly adjacent cells, moving east. Utilities shares a wall with process. Control sits beside utilities and away from intake.",
            "Select a building, select a plot, then place its footprint. Review the current layout diagnosis after each placement.",
          ) +
          bField() +
          grid() +
          button("place", "Place footprint", noEdit) +
          list(
            Object.entries(buildings).map(
              ([id, [n]]) => esc(n) + " · " + label(s.buildings[id]?.cell),
            ),
          ) +
          '<p class="sb-status">' +
          esc(layoutIssue(s) || "The arrangement passes the layout checks.") +
          "</p>" +
          hint(
            "Place raw intake B1, process hall B2, cold store B3 and dispatch B4. Place utilities C2 and control C3. To relocate an unfinished footprint, select it and place it on a new plot. A built shell needs rework first.",
          )
        );
      if (current === "build") {
        const pkg = packages(building),
          packageList = (k) => [
            ["", "Choose package"],
            ...Object.keys(buildings).map((id) => packages(id)[k]),
          ];
        const status = b
          ? levelNames(b.level) + " at " + label(b.cell)
          : "No footprint yet";
        return (
          header(
            "Build the selected structure",
            "Foundation supports the frame. The frame must be in place before closing the shell. Each department needs an envelope suited to its product or equipment.",
            "Complete the civil stages in order and inspect the selected finish.",
          ) +
          bField() +
          "<p><strong>" +
          esc(name) +
          "</strong> · " +
          esc(status) +
          " · " +
          esc(b?.finish || "finish unassigned") +
          "</p>" +
          '<div class="sb-fields">' +
          field(
            "foundation",
            "Foundation package",
            packageList("foundation"),
            b?.foundation || "",
          ) +
          field(
            "frame",
            "Frame package",
            packageList("frame"),
            b?.frame || "",
          ) +
          '</div><p class="sb-hint">' +
          esc(pkg.foundationWhy + " " + pkg.frameWhy) +
          '</p><div class="sb-actions">' +
          button("foundation", "Pour foundation", noEdit) +
          button("frame", "Erect frame", noEdit) +
          "</div>" +
          field(
            "finish",
            "Shell finish",
            finishList.map((x) => [x, x || "Choose finish"]),
            b?.finish || "",
          ) +
          '<div class="sb-actions">' +
          button("shell", "Close shell", noEdit) +
          button("reopen", "Reopen shell", noEdit) +
          button("rework", "Rework to footprint", noEdit) +
          "</div>" +
          "<p>" +
          esc(
            remaining().length
              ? "Outstanding: " + remaining().join(", ")
              : "All six shells and finishes pass.",
          ) +
          "</p>" +
          hint(
            "For " +
              name +
              ", select " +
              pkg.foundation +
              " and pour the foundation. Select " +
              pkg.frame +
              " and erect the frame. Select " +
              buildings[building][2] +
              " and close the shell. Reopen a completed shell to correct its finish. Reworking to footprint removes its finish and connected utility runs.",
          )
        );
      }
      if (current === "services")
        return (
          header(
            "Connect named utility endpoints",
            "Route wash effluent from the process hall to the utilities treatment inlet. Keep this circuit separate from process water and the flood reserve. The blancher and fryer use process heat, and pneumatic actuators require instrument air. Each endpoint accepts one connection.",
            "Complete the endpoint schedule after closing the buildings involved in each connection.",
          ) +
          list(
            services.map(
              ([a, b, k]) => esc(k) + " · " + esc(a) + " → " + esc(b),
            ),
          ) +
          '<div class="sb-fields">' +
          field(
            "source",
            "Source endpoint",
            [["", "Choose source"], ...services.map((x) => [x[0], x[0]])],
            "",
          ) +
          field(
            "target",
            "Target endpoint",
            [["", "Choose target"], ...services.map((x) => [x[1], x[1]])],
            "",
          ) +
          field(
            "service",
            "Service type",
            [["", "Choose service"], ...services.map((x) => x[2])],
            "",
          ) +
          "</div>" +
          button("link", "Connect service", noEdit) +
          list(
            s.links.map(
              (x, i) =>
                esc(x.service) +
                " · " +
                esc(x.from) +
                " → " +
                esc(x.to) +
                ' <button type="button" data-sb-unlink="' +
                i +
                '"' +
                (noEdit ? " disabled" : "") +
                ">Disconnect</button>",
            ),
          ) +
          '<p class="sb-status">' +
          esc(linkIssue(s) || "All endpoint pairs and types match.") +
          "</p>" +
          hint(
            "For chilled services, select utilities.chilled, cold.chilled and Chilled loop. For the wash-effluent return, select process.wastewater, utilities.treatment and Wastewater. Link utilities.heat to process.heat for the blancher and fryer. Link utilities.air to process.air for the pneumatic actuators. Match each service type to its endpoint pair. Disconnect a misrouted service to free its endpoints.",
          )
        );
      if (current === "access")
        return (
          header(
            "Configure road and dock access",
            "The two docks must be reachable from the surveyed gate through vacant plots. Each route avoids the opposite apron except at the common entrance. The route search excludes buildings and the flood reserve.",
            "Select a gate and separate receiving and outbound aprons. Test whether both vehicles can reach their respective buildings.",
          ) +
          accessFields() +
          button("roads", "Test vehicle routes", noEdit) +
          (routeReport
            ? '<p class="sb-status">' + esc(routeReport) + "</p>"
            : "") +
          hint(
            "For the worked footprints, use gate C1, raw apron C1 and finished apron C4. Outbound traffic can use the southern row to bypass utilities and the control room.",
          )
        );
      return (
        header(
          "Accept and commission the site",
          "Acceptance reruns the model checks against the actual survey, physical arrangement, shell finish, service pairs and drive paths. A later construction change requires renewed acceptance.",
          "Run the checks, correct each finding, then commission the site. Select a completed building to enter its work area.",
        ) +
        '<div class="sb-actions">' +
        button("test", "Run acceptance tests", noEdit) +
        button("commission", "Commission site", noEdit) +
        "</div>" +
        (acceptRows || s.witness || s.commissioned
          ? list(
              tests(s).map(
                ([n, why]) =>
                  "<strong>" + esc(n) + "</strong> · " + esc(why || "Pass"),
              ),
            )
          : "") +
        '<p class="sb-status">' +
        esc(check(s).why) +
        "</p>" +
        bField() +
        (check(s).ok
          ? '<a data-sb-enter href="#' +
            esc(buildings[building][3]) +
            '">Enter building: ' +
            esc(name) +
            "</a>"
          : "") +
        hint(
          "A successful test signs the current site configuration. Select Commission site to enable handover. Use Enter building to continue construction inside the selected building.",
        )
      );
    }
    function redrawGuide() {
      const pane = q("[data-sb-guide]"),
        toggle = q('[data-sb="guide"]');
      pane.hidden = !guideOpen;
      toggle.setAttribute("aria-expanded", String(guideOpen));
      if (guideOpen && window.SiteGuide?.mount)
        window.SiteGuide.mount(pane, guideIds[current]);
      else if (guideOpen)
        pane.textContent =
          "Use the worked example in the construction inspector for this stage.";
    }
    function draw() {
      q("[data-sb-nav]").innerHTML = Object.entries(tabs)
        .map(
          ([k, t]) =>
            '<button type="button" data-sb-step="' +
            k +
            '" aria-current="' +
            (k === current ? "step" : "false") +
            '">' +
            esc(t) +
            "</button>",
        )
        .join("");
      panel.innerHTML = stageBody();
      for (const field of panel.querySelectorAll("[data-sb-key]")) {
        const value = selections.get(choiceKey(field.dataset.sbKey));
        if (value !== undefined) field.value = value;
      }
      if (noEdit)
        panel.querySelectorAll("select").forEach((el) => {
          if (el.dataset.sbKey !== "building") el.disabled = true;
        });
      q("[data-sb-selection]").textContent = [
        sceneIssue,
        picked == null ? "" : label(picked) + " selected",
      ]
        .filter(Boolean)
        .join(" · ");
      q("[data-sb-msg]").textContent = notice;
      root
        .querySelectorAll("[data-sb-camera]")
        .forEach((el) =>
          el.setAttribute(
            "aria-pressed",
            String(el.dataset.sbCamera === camera),
          ),
        );
      scene?.draw(s, picked);
      redrawGuide();
    }
    const val = (k) => q('[data-sb-key="' + k + '"]')?.value || "";
    function invalidateRoad() {
      s.access = false;
      routeReport = null;
    }
    function apply(k) {
      const b = s.buildings[building];
      if (k === "survey") {
        const fail = surveyIssue(s);
        s.survey = !fail;
        return (
          fail ||
          "Survey passed. Open Footprints to select a building location."
        );
      }
      if (k === "place") {
        if (!s.survey || surveyIssue(s))
          return "Check the surveyed reserve and entrance first.";
        if (!finitePlot(picked))
          return "Select a plot in the 3D view or labelled grid first.";
        if ([0, 1, 12].includes(picked))
          return (
            label(picked) +
            " is reserved for drainage or the road entrance. Choose a free building plot."
          );
        const owner = Object.keys(s.buildings).find(
          (id) => id !== building && s.buildings[id].cell === picked,
        );
        if (owner)
          return (
            label(picked) +
            " is already occupied by " +
            buildings[owner][0] +
            "."
          );
        if (b?.cell === picked)
          return "The selected footprint is already at " + label(picked) + ".";
        if (b && b.level > 0)
          return "Rework the structure to its footprint in Construction before moving it.";
        s.buildings[building] = {
          cell: picked,
          level: 0,
          foundation: "",
          frame: "",
          finish: "",
        };
        invalidateRoad();
        invalidate();
        return (
          "Placed " + buildings[building][0] + " at " + label(picked) + "."
        );
      }
      if (["foundation", "frame", "shell", "reopen", "rework"].includes(k)) {
        if (!b) return "Place the selected building footprint first.";
        if (k === "rework" || k === "reopen") {
          if (k === "reopen" && b.level !== 3)
            return "Only a finished shell can be reopened.";
          if (k === "rework" && b.level === 0)
            return "This building is already a movable footprint.";
          b.level = k === "reopen" ? 2 : 0;
          b.finish = "";
          if (k === "rework") {
            b.foundation = "";
            b.frame = "";
          }
          s.links = s.links.filter(
            (x) => ![x.from, x.to].some((v) => v.split(".")[0] === building),
          );
          invalidate();
          return "Structure reopened. Repair its finish and reconnect affected services before acceptance.";
        }
        const layout = layoutIssue(s);
        if (layout) return layout;
        const target = { foundation: 1, frame: 2, shell: 3 }[k];
        if (b.level !== target - 1)
          return (
            "Current stage is " +
            levelNames(b.level) +
            ". Perform the next construction step in order."
          );
        if (k === "foundation" || k === "frame") {
          const p = packages(building),
            selected = val(k);
          if (selected !== p[k])
            return (
              "Select " +
              p[k] +
              " for " +
              buildings[building][0] +
              ". " +
              p[k + "Why"]
            );
          b[k] = selected;
        }
        if (k === "shell") {
          const chosen = val("finish");
          if (!chosen) return "Choose the installed shell finish.";
          b.finish = chosen;
        }
        b.level = target;
        invalidate();
        return (
          levelNames(target) +
          " completed for " +
          buildings[building][0] +
          "." +
          (target === 3 && b.finish !== buildings[building][2]
            ? " Inspection found the wrong finish. Reopen the shell and correct it."
            : "")
        );
      }
      if (k === "link") {
        const from = val("source"),
          to = val("target"),
          service = val("service");
        if (!from || !to || !service)
          return "Select the source, target and service type.";
        if ([from, to].some((v) => s.buildings[v.split(".")[0]]?.level !== 3))
          return "Finish both connected building shells before routing the service.";
        if (s.links.some((x) => x.from === from || x.to === to))
          return "One endpoint is already connected. Disconnect the existing run before changing it.";
        s.links.push({ from, to, service });
        invalidate();
        return services.some(
          ([a, b, k]) => a === from && b === to && k === service,
        )
          ? "Service connected."
          : "Connection recorded. Inspection found a mismatch with the schedule.";
      }
      if (k === "roads") {
        const p = roadPaths(s);
        s.access = !p.why;
        routeReport =
          p.why ||
          "Receiving: " +
            p.raw.map(label).join(" → ") +
            ". Outbound: " +
            p.finished.map(label).join(" → ") +
            ".";
        return routeReport;
      }
      if (k === "test") {
        acceptRows = tests(s);
        const fail = acceptRows.find((x) => x[1]);
        s.witness = fail ? "" : signature(s);
        if (fail) s.commissioned = false;
        return fail
          ? "Acceptance failed. " + fail[1]
          : "All five site checks passed. Commission the site to hand it over.";
      }
      if (k === "commission") {
        const fail = tests(s).find((x) => x[1]);
        if (fail) return fail[1];
        if (s.witness !== signature(s))
          return "Run acceptance tests after the last change.";
        s.commissioned = true;
        return "Site commissioned. Choose a building and enter its work area.";
      }
      return "";
    }
    function click(e) {
      const el = e.target.closest("button");
      if (!el || !root.contains(el)) return;
      if (el.dataset.sbCamera) {
        camera = el.dataset.sbCamera;
        scene?.camera(camera);
        draw();
        return;
      }
      if (el.dataset.sbStep) {
        current = el.dataset.sbStep;
        notice = "";
        draw();
        q('[data-sb-step="' + current + '"]').focus();
        return;
      }
      if (el.hasAttribute("data-sb-cell")) {
        receivePlot(Number(el.dataset.sbCell));
        q('[data-sb-cell="' + el.dataset.sbCell + '"]')?.focus();
        return;
      }
      if (el.dataset.sb === "guide") {
        guideOpen = !guideOpen;
        redrawGuide();
        return;
      }
      if (noEdit) return;
      if (el.hasAttribute("data-sb-unlink")) {
        s.links.splice(Number(el.dataset.sbUnlink), 1);
        invalidate();
        notice = "Service disconnected.";
      } else if (el.dataset.sb) notice = apply(el.dataset.sb);
      else return;
      save();
      draw();
      if (el.dataset.sb)
        q('[data-sb="' + el.dataset.sb + '"]')?.focus({ preventScroll: true });
    }
    function change(e) {
      const key = e.target.dataset.sbKey;
      if (key === "building") {
        building = e.target.value;
        picked = s.buildings[building]?.cell ?? null;
        notice = "";
        draw();
        q('[data-sb-key="building"]').focus();
        return;
      }
      if (noEdit) return;
      if (key === "survey-mode") {
        surveyMode = e.target.value;
        return;
      }
      if (
        [
          "foundation",
          "frame",
          "finish",
          "source",
          "target",
          "service",
        ].includes(key)
      ) {
        selections.set(choiceKey(key), e.target.value);
        return;
      }
      if (["gate", "receiving", "outbound"].includes(key)) {
        const value = e.target.value === "" ? null : Number(e.target.value);
        if (s.roads[key] === value) return;
        s.roads[key] = value;
        invalidateRoad();
        invalidate();
        save();
        draw();
        q('[data-sb-key="' + key + '"]').focus();
      }
    }
    root.addEventListener("click", click);
    root.addEventListener("change", change);
    draw();
    return {
      destroy() {
        root.removeEventListener("click", click);
        root.removeEventListener("change", change);
        scene?.destroy();
      },
    };
  }
  window.SiteBuild = { empty, solved, check, mount, roadPaths, packages };
})();
