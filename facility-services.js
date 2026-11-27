(() => {
  "use strict";
  const markup = `<div class="fs-intro"><p class="fs-eyebrow">Industrial IT / Facility services</p>
      <h1>Facility fit-out workbench</h1>
      <p>Patch a camera and wireless access point, allocate Power over Ethernet (PoE), then prove each service from a test client. Each area is a separate fictional exercise.</p>
    </div>
    <div class="fs-toolbar"><div data-fs="areas" class="fs-buttons" role="group" aria-label="Work area"></div>
      <div class="fs-mode"><label>Workspace <select data-fs="workspace-mode"><option value="build">My build</option><option value="worked">Worked example</option></select></label></div>
    </div>
    <div data-fs="conflict" role="status" hidden>Another view saved newer facility settings. Load those settings to continue. <button type="button" data-fs="latest">Load latest settings</button></div>
    <section class="fs-brief" aria-label="Area work order">
      <div class="fs-illustration"><canvas data-fs="facility-art" role="img" aria-label="Illustrative facility form"></canvas><span data-fs="art-caption"></span></div>
      <div class="fs-ticket"><p class="fs-eyebrow">Work order</p><h2 data-fs="area-name"></h2><p data-fs="area-purpose"></p>
        <dl data-fs="job-card"></dl>
      </div>
    </section>
    <div class="fs-bench">
      <section class="fs-card"><div class="fs-section-top"><h2>Configure the bench</h2><button data-fs="reset" type="button">Reset this area</button></div>
        <form data-fs="setup" novalidate>
          <fieldset><legend>Patch and power</legend><div data-fs="ports" class="fs-fields"></div><div class="fs-face" data-fs="patch-face" aria-label="Current patch cabinet"></div></fieldset>
          <fieldset><legend>Service handover</legend><div data-fs="handover" class="fs-fields"></div></fieldset>
          <div class="fs-verify"><button class="fs-primary" data-fs="run" type="submit">Run handover checks</button><span data-fs="store" role="status"></span></div>
        </form>
      </section>
      <section class="fs-card fs-results" aria-label="Commissioning readback"><p class="fs-eyebrow">Test client</p><h2 data-fs="read-title">Commissioning readback</h2>
        <p data-fs="result" role="status" aria-live="polite"></p><div data-fs="readbacks"></div>
      </section>
    </div>`;
  const cases = {
    office: {
      name: "Office and welfare",
      purpose:
        "Bring a synthetic video stream and a wireless test client online in a dry staff-support space.",
      panel: "Fern",
      uplink: "Leaf",
      cam: "A",
      ap: "B",
      cameraW: 9,
      radioW: 14,
      reserve: 4,
      condition: "Dry-room handover",
      conditionId: "dry",
      proof: "The training work order includes a dry indoor mounting sign-off.",
      caption: "Staff support space",
      accent: "#759c85",
    },
    storage: {
      name: "Raw storage and handling",
      purpose:
        "Check a raw-material receiving bench that moves between cool storage and a warmer handoff area.",
      panel: "Ochre",
      uplink: "Grain",
      cam: "B",
      ap: "C",
      cameraW: 15,
      radioW: 16,
      reserve: 5,
      condition: "Condensation review",
      conditionId: "cold",
      proof:
        "The training work order requires suitability for condensation at the cold-to-warm transition.",
      caption: "Raw-material handling",
      accent: "#ac8760",
    },
    production: {
      name: "Production support",
      purpose:
        "Prepare the camera and maintenance wireless service for a production-support bench subject to routine cleaning.",
      panel: "Reed",
      uplink: "Mill",
      cam: "C",
      ap: "A",
      cameraW: 12,
      radioW: 18,
      reserve: 5,
      condition: "Cleaning exposure review",
      conditionId: "wash",
      proof:
        "The training handover calls for enclosure suitability and a signed cleaning-access review.",
      caption: "Production support",
      accent: "#b39052",
    },
    services: {
      name: "Wastewater and services",
      purpose:
        "Verify the monitoring and maintenance services of an illustrative treatment module in a damp, corrosive environment.",
      panel: "Slate",
      uplink: "Flow",
      cam: "A",
      ap: "C",
      cameraW: 16,
      radioW: 17,
      reserve: 6,
      condition: "Damp and corrosion review",
      conditionId: "damp",
      proof:
        "The training handover requires material and enclosure suitability for splash and corrosive exposure.",
      caption: "Water services module",
      accent: "#568b99",
    },
  };
  const keys = Object.keys(cases),
    mounts = new WeakMap();
  const blank = () => ({
    panel: "",
    uplink: "",
    camera: "",
    ap: "",
    budget: "",
    condition: "",
    profile: "",
    fault: "normal",
    witness: "",
  });
  function worked(c) {
    return {
      ...blank(),
      panel: c.panel,
      uplink: c.uplink,
      camera: c.cam,
      ap: c.ap,
      budget: String(c.cameraW + c.radioW + c.reserve),
      condition: c.conditionId,
      profile: "enabled",
    };
  }
  const signed = (r) =>
    JSON.stringify([
      r.panel,
      r.uplink,
      r.camera,
      r.ap,
      r.budget,
      r.condition,
      r.profile,
      r.fault,
    ]);
  function initial(options) {
    return {
      version: 1,
      mode: options.worked || options.readonly ? "worked" : "build",
      area: "office",
      areas: Object.fromEntries(
        keys.map((k) => [k, { build: blank(), worked: worked(cases[k]) }]),
      ),
    };
  }
  function storageKey(options) {
    return typeof options.storageKey === "string" && options.storageKey.trim()
      ? options.storageKey
      : "signalworks.facility-services.v1";
  }
  function rawSnapshot(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return undefined;
    }
  }
  function decode(options, raw) {
    const s = initial(options);
    if (options.readonly) return s;
    try {
      const stored = JSON.parse(raw || "null");
      if (stored?.version !== 1) return s;
      if (keys.includes(stored.area)) s.area = stored.area;
      if (["build", "worked"].includes(stored.mode)) s.mode = stored.mode;
      for (const k of keys)
        for (const m of ["build", "worked"]) {
          const v = stored.areas?.[k]?.[m];
          if (!v || typeof v !== "object") continue;
          for (const name of Object.keys(blank()))
            if (typeof v[name] === "string")
              s.areas[k][m][name] = v[name].slice(0, 260);
        }
    } catch {
      /* The bench stays available in memory when browser storage is restricted. */
    }
    return s;
  }
  const read = (title, ok, value, detail) => ({ title, ok, value, detail });
  function evaluate(c, r) {
    const path = r.panel === c.panel && r.uplink === c.uplink;
    const raw = String(r.budget).trim(),
      budget = raw ? Number(raw) : NaN;
    const valid = Number.isFinite(budget) && budget >= 0 && budget <= 100;
    const connectedCamera = ["A", "B", "C"].includes(r.camera);
    const connectedRadio = ["A", "B", "C"].includes(r.ap);
    const conflict = connectedCamera && connectedRadio && r.camera === r.ap;
    // The bench gives the camera priority when the supply cannot start both loads.
    const camOn = connectedCamera && !conflict && valid && budget >= c.cameraW;
    const radioOn =
      connectedRadio &&
      !conflict &&
      valid &&
      budget >= (camOn ? c.cameraW : 0) + c.radioW;
    const camRoute = path && r.camera === c.cam,
      radioRoute = path && r.ap === c.ap;
    const spare = valid ? budget - c.cameraW - c.radioW : NaN;
    const uplink = path && r.fault !== "uplink";
    const camService =
      camOn &&
      camRoute &&
      uplink &&
      r.profile === "enabled" &&
      r.fault !== "freeze";
    const radioService =
      radioOn &&
      radioRoute &&
      uplink &&
      r.profile === "enabled" &&
      r.fault !== "client";
    const endReason = (powered, routed, fault, diagnosis) => {
      if (conflict)
        return "Both leads claim the same socket. Give each endpoint its work-order port.";
      if (!powered)
        return "Check the fitted lead and available PoE. The camera has priority on this training supply.";
      if (!routed)
        return "Local carrier is present. Match the panel, uplink and endpoint label to the work order.";
      if (!uplink)
        return "The upstream loop test failed. Restore the simulated uplink before testing the endpoint.";
      if (r.profile !== "enabled")
        return "The endpoint is linked, but its service profile is uncommissioned. Apply the test service profile.";
      if (fault) return diagnosis;
      return "";
    };
    const tests = [
      read(
        "Upstream path",
        uplink,
        uplink ? "Loop reply received" : "No upstream reply",
        uplink
          ? "The labelled upstream endpoint returned the bench challenge."
          : path
            ? "Clear the simulated upstream interruption and repeat the loop check."
            : "Select the work-order panel and match its uplink label.",
      ),
      read(
        "Local patch",
        camRoute && radioRoute && !conflict,
        camRoute && radioRoute && !conflict
          ? "Both socket labels match"
          : "Patch schedule mismatch",
        conflict
          ? "Both leads occupy the same socket. Separate the camera and access point."
          : "Camera → " +
              c.cam +
              "; access point → " +
              c.ap +
              ". Physical carrier alone does not identify the intended service.",
      ),
      read(
        "PoE headroom",
        valid && spare >= c.reserve,
        valid
          ? spare >= 0
            ? spare + " W spare"
            : Math.abs(spare) + " W short of peak"
          : "Allocation missing",
        valid && spare >= c.reserve
          ? "Peak camera and radio demand plus the work-order reserve are covered."
          : "Allocate at least " +
              (c.cameraW + c.radioW + c.reserve) +
              " W for both peak loads and " +
              c.reserve +
              " W reserve. The training supply accepts 0 to 100 W.",
      ),
      read(
        "Environment release",
        r.condition === c.conditionId,
        r.condition === c.conditionId
          ? "Required record matched"
          : "Handover evidence missing",
        c.proof,
      ),
      read(
        "Camera · synthetic video",
        camService,
        (camOn ? "Link up" : "Link down") +
          " / " +
          (camService ? "frames advancing" : "no fresh frames"),
        camService
          ? "The synthetic test pattern advanced from frame 41 to frame 42 at the test client."
          : endReason(
              camOn,
              camRoute,
              r.fault === "freeze",
              "The session opened but consecutive samples repeated frame 41. Clear the frozen-feed fault and repeat the freshness check.",
            ),
      ),
      read(
        "Access point · test client",
        radioService,
        (radioOn ? "Link up" : "Link down") +
          " / " +
          (radioService
            ? "test transaction passed"
            : "test transaction failed"),
        radioService
          ? "The training client completed association and received the expected application reply."
          : endReason(
              radioOn,
              radioRoute,
              r.fault === "client",
              "The access point is powered but the client transaction received no application reply. Restore the simulated client service and retest.",
            ),
      ),
    ];
    return { ok: tests.every((t) => t.ok), tests };
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
  const select = (r, key, label, options, empty = true) =>
    "<label>" +
    esc(label) +
    '<select data-setting="' +
    key +
    '">' +
    (empty ? '<option value="">Choose a setting</option>' : "") +
    options
      .map(
        ([v, title]) =>
          '<option value="' +
          esc(v) +
          '"' +
          (r[key] === v ? " selected" : "") +
          ">" +
          esc(title) +
          "</option>",
      )
      .join("") +
    "</select></label>";
  function scene(canvas, area) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect(),
      w = rect.width,
      h = rect.height;
    if (!w || !h) return;
    const dpi = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpi);
    canvas.height = Math.round(h * dpi);
    ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#f3f8ed");
    bg.addColorStop(1, "#dcebe4");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const scale = Math.min(w / 9.25, h / 6.4);
    const P = ([x, y, z]) => [
      w * 0.5 + (x - z * 0.83) * scale,
      h * 0.69 + (x * 0.34 + z * 0.43 - y) * scale,
    ];
    const polygons = [];
    const shade = (hex, f) =>
      "#" +
      [1, 3, 5]
        .map((k) =>
          Math.min(255, Math.round(parseInt(hex.slice(k, k + 2), 16) * f))
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
    function face(points, col, layer = 0) {
      const depth =
        points.reduce((a, p) => a + p[0] * 0.8 + p[1] * 0.69 + p[2], 0) /
        points.length;
      polygons.push({ points: points.map(P), col, depth, layer });
    }
    function box(x, y, z, b, h, d, tint, layer = 0) {
      const l = x - b / 2,
        r = x + b / 2,
        back = z - d / 2,
        front = z + d / 2,
        top = y + h;
      face(
        [
          [l, top, back],
          [r, top, back],
          [r, top, front],
          [l, top, front],
        ],
        shade(tint, 1.07),
        layer,
      );
      face(
        [
          [l, y, front],
          [r, y, front],
          [r, top, front],
          [l, top, front],
        ],
        shade(tint, 0.9),
        layer,
      );
      face(
        [
          [r, y, back],
          [r, top, back],
          [r, top, front],
          [r, y, front],
        ],
        shade(tint, 0.73),
        layer,
      );
    }
    function cylinder(x, y, z, r, ht, col, sides = 16) {
      const at = (j, h) => [
        x + r * Math.cos((j * 2 * Math.PI) / sides),
        y + h,
        z + r * Math.sin((j * 2 * Math.PI) / sides),
      ];
      const top = [];
      for (let j = 0; j < sides; j++) {
        top.push(at(j, ht));
        const a = ((j + 0.5) * 2 * Math.PI) / sides;
        if (Math.sin(a) + Math.cos(a) > 0.0)
          face(
            [at(j, 0), at(j + 1, 0), at(j + 1, ht), at(j, ht)],
            shade(col, 0.76 + 0.15 * (1 - Math.cos(a))),
          );
      }
      face(top, shade(col, 1.07));
    }
    const metal = "#9aaea7",
      cream = "#dbdcca",
      dark = "#415b57",
      mint = "#92b7a2",
      wood = "#c39360",
      ocean = "#5c99a1";
    box(0, -0.2, 0, 5.45, 0.2, 3.86, "#92a495", -4);
    box(0, 0, 0, 5.47, 0.08, 3.88, "#d1ddc9", -3);
    for (let x = -2.5; x <= 2.5; x += 0.5)
      box(x, 0.081, 0, 0.012, 0.004, 3.84, "#b4c8b3", -2);
    for (let z = -1.5; z <= 1.5; z += 0.5)
      box(0, 0.081, z, 5.43, 0.004, 0.012, "#b4c8b3", -2);
    function backwall(ht, tint) {
      box(0, 0.08, -1.6, 5.0, ht, 0.13, tint, -1);
      box(-2.44, 0.08, -0.57, 0.13, ht * 0.67, 2.11, tint, -1);
    }
    function windowPanel(x, y, w, ht) {
      box(x, y, -1.51, w, ht, 0.06, dark, -0.8);
      box(x, y + 0.045, -1.47, w - 0.1, ht - 0.09, 0.025, "#92b4af", -0.7);
      box(x, y, -1.446, 0.035, ht, 0.014, cream, -0.6);
    }
    function shaft(x, y, z, len, r, tint) {
      const p = (a, t) => [
        x + (a * len) / 2,
        y + r * Math.cos(t),
        z + r * Math.sin(t),
      ];
      const q = [];
      for (let j = 0; j < 16; j++) {
        const a = (j * Math.PI) / 8,
          b = ((j + 1) * Math.PI) / 8;
        q.push(p(1, a));
        if (Math.sin((a + b) / 2) > 0.01 || Math.cos((a + b) / 2) > 0.01)
          face(
            [p(-1, a), p(1, a), p(1, b), p(-1, b)],
            shade(tint, 0.89 + 0.12 * Math.cos((a + b) / 2)),
          );
      }
      face(q, shade(tint, 0.78));
    }
    if (area === "office") {
      backwall(2.05, cream);
      windowPanel(-0.98, 0.95, 2.13, 0.83);
      windowPanel(1.05, 0.95, 1.22, 0.83);
      for (let i = 0; i < 3; i++) {
        box(-1.78 + i * 0.39, 0.09, -1.09, 0.36, 1.14, 0.51, mint);
        box(-1.78 + i * 0.39, 0.63, -0.82, 0.11, 0.04, 0.025, dark);
      }
      for (const x of [-0.65, 0.85])
        for (const z of [0.04, 0.68]) box(x, 0.09, z, 0.09, 0.72, 0.09, dark);
      box(0.1, 0.8, 0.36, 1.76, 0.1, 0.94, wood);
      box(0.1, 0.93, 0.15, 0.4, 0.04, 0.26, cream);
      for (const x of [-0.67, 0.78]) {
        box(x, 0.32, 1.02, 0.46, 0.13, 0.44, mint);
        box(x, 0.43, 1.23, 0.46, 0.4, 0.08, mint);
        box(x, 0.09, 1.04, 0.15, 0.26, 0.15, metal);
      }
      box(1.68, 0.09, -0.65, 0.76, 0.8, 0.6, cream);
      box(1.68, 0.89, -0.65, 0.83, 0.065, 0.63, wood);
    } else if (area === "storage") {
      backwall(1.12, "#b6beaa");
      const bin = (x, z, base) => {
        box(x, base, z, 0.94, 0.13, 0.75, wood);
        for (const side of [-1, 1])
          for (let j = 0; j < 3; j++) {
            box(
              x,
              base + 0.16 + j * 0.16,
              z + side * 0.35,
              0.98,
              0.1,
              0.055,
              wood,
            );
            box(
              x + side * 0.46,
              base + 0.16 + j * 0.16,
              z,
              0.045,
              0.1,
              0.71,
              wood,
            );
          }
        for (const a of [-0.2, 0.12])
          for (const b of [-0.15, 0.15])
            cylinder(x + a, base + 0.33, z + b, 0.17, 0.14, "#b28b58", 7);
      };
      bin(-1.68, -0.78, 0.09);
      bin(-0.56, -0.78, 0.09);
      bin(-1.68, 0.27, 0.09);
      const x = 0.95;
      for (const a of [-0.5, 0.5])
        for (const z of [-1.02, -0.28])
          box(x + a, 0.09, z, 0.075, 0.95, 0.075, metal);
      for (const s of [-1, 1])
        face(
          [
            [x - 0.73, 1.48, -0.65 + s * 0.53],
            [x + 0.73, 1.48, -0.65 + s * 0.53],
            [x + 0.31, 0.84, -0.65 + s * 0.23],
            [x - 0.31, 0.84, -0.65 + s * 0.23],
          ],
          shade(metal, s < 0 ? 0.85 : 1),
        );
      for (const s of [-1, 1])
        face(
          [
            [x + s * 0.73, 1.48, -1.18],
            [x + s * 0.73, 1.48, -0.12],
            [x + s * 0.31, 0.84, -0.42],
            [x + s * 0.31, 0.84, -0.88],
          ],
          shade(metal, s < 0 ? 0.8 : 0.92),
        );
      box(0.94, 0.67, 0.64, 1.05, 0.16, 1.59, dark);
      for (let j = 0; j < 8; j++)
        shaft(0.94, 0.85, -0.02 + j * 0.17, 1.0, 0.064, metal);
      for (const a of [0.55, 1.33]) box(a, 0.09, 1.2, 0.08, 0.56, 0.08, metal);
    } else if (area === "production") {
      backwall(1.63, "#b7ccc1");
      windowPanel(-1.28, 0.8, 1.5, 0.56);
      box(0.9, 0.1, -1.21, 0.86, 1.39, 0.59, metal);
      box(0.9, 0.64, -0.9, 0.51, 0.35, 0.05, dark);
      box(0.9, 0.71, -0.87, 0.34, 0.18, 0.019, "#a0c8ab");
      for (const a of [-0.77, 0.85])
        for (const b of [-0.11, 0.88]) box(a, 0.09, b, 0.14, 0.48, 0.14, dark);
      box(0.05, 0.56, 0.37, 2.1, 0.13, 1.37, metal);
      shaft(0.04, 0.99, 0.37, 1.24, 0.31, ocean);
      for (let j = 0; j < 6; j++)
        shaft(-0.5 + j * 0.18, 0.99, 0.37, 0.055, 0.33, "#739f9d");
      shaft(0.85, 0.97, 0.37, 0.42, 0.12, dark);
      box(0.7, 0.66, 0.37, 0.24, 0.17, 0.65, cream);
      box(-1.8, 0.09, 0.27, 0.65, 0.7, 0.81, wood);
      box(-1.8, 0.79, 0.27, 0.72, 0.076, 0.88, cream);
    } else {
      box(-0.7, 0.09, -0.13, 2.53, 0.31, 1.78, metal);
      box(-0.7, 0.4, -0.13, 2.35, 0.025, 1.57, "#85b6b0");
      for (const s of [-1, 1]) {
        box(-0.7, 0.4, -0.13 + s * 0.84, 2.55, 0.29, 0.13, cream);
        box(-0.7 + s * 1.21, 0.4, -0.13, 0.13, 0.29, 1.63, cream);
      }
      box(-0.73, 0.45, -0.17, 0.085, 0.18, 1.41, metal);
      for (const a of [-1.81, 0.41]) {
        box(a, 0.69, -0.92, 0.064, 0.45, 0.065, dark);
      }
      box(-0.7, 1.12, -0.92, 2.27, 0.045, 0.049, wood);
      box(-0.7, 0.69, -0.92, 2.35, 0.05, 0.28, metal);
      cylinder(1.48, 0.09, -0.64, 0.45, 1.42, metal);
      cylinder(1.48, 1.49, -0.64, 0.47, 0.07, ocean);
      cylinder(1.48, 1.56, -0.64, 0.12, 0.15, dark);
      box(0.65, 0.73, -0.61, 1.58, 0.105, 0.11, ocean);
      box(0.04, 0.48, -0.61, 0.1, 0.33, 0.11, ocean);
      box(1.43, 0.09, 0.81, 0.86, 0.13, 0.69, cream);
      shaft(1.43, 0.47, 0.81, 0.68, 0.19, ocean);
      box(1.43, 0.61, 0.81, 0.29, 0.15, 0.24, metal);
    }
    polygons.sort((a, b) => a.layer - b.layer || a.depth - b.depth);
    for (const p of polygons) {
      ctx.beginPath();
      p.points.forEach(([x, y], i) =>
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
      );
      ctx.closePath();
      ctx.fillStyle = p.col;
      ctx.fill();
      ctx.strokeStyle = "#38584c65";
      ctx.lineWidth = 0.55;
      ctx.stroke();
    }
  }
  function summary(state, readonly) {
    const passed = keys.filter((k) => {
      const r = state.areas[k][state.mode];
      return (readonly || r.witness === signed(r)) && evaluate(cases[k], r).ok;
    }).length;
    return {
      ok: passed === keys.length,
      why:
        (readonly ? "Worked example: " : "") +
        passed +
        " of " +
        keys.length +
        " area handovers verified.",
      passed,
      total: keys.length,
      mode: state.mode,
    };
  }
  function statusFor(options = {}) {
    return summary(
      decode(
        options,
        options.readonly ? null : rawSnapshot(storageKey(options)),
      ),
      options.readonly === true,
    );
  }
  // Compare and write in one exclusive critical section across browser tabs.
  // A readwrite IndexedDB transaction provides the fallback for non-secure origins.
  function storedRevision(raw) {
    try {
      return JSON.parse(raw || "null")?.writeId || null;
    } catch {
      return null;
    }
  }
  function lockWrite(key, task, revision) {
    const transaction = () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("signalworks.facility-write-lock", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("mutex");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction("mutex", "readwrite");
          let value, error;
          const store = tx.objectStore("mutex"),
            get = store.get(key);
          get.onsuccess = () => {
            try {
              value = task(get.result || null);
              if (value === true && revision) store.put(revision, key);
            } catch (e) {
              error = e;
              tx.abort();
            }
          };
          tx.oncomplete = () => {
            db.close();
            resolve(value);
          };
          tx.onabort = () => {
            db.close();
            reject(error || tx.error);
          };
        };
      });
    if (navigator.locks?.request) {
      return navigator.locks.request("signalworks.facility/" + key, () =>
        typeof indexedDB === "undefined" ? task(null) : transaction(),
      );
    }
    return transaction();
  }
  function mount(root, options = {}) {
    if (!root || typeof root.replaceChildren !== "function")
      throw new TypeError(
        "Choose a container for the facility services workbench.",
      );
    mounts.get(root)?.destroy();
    const key = storageKey(options),
      readonly = options.readonly === true;
    let base = readonly ? null : rawSnapshot(key),
      state = decode(options, base);
    let stale = false,
      epoch = 0,
      pending = Promise.resolve(),
      writes = 0,
      adoptedRevision = null;
    const shell = document.createElement("section");
    shell.className = "fs-work";
    shell.setAttribute("aria-label", "Facility services workbench");
    shell.innerHTML = markup;
    root.replaceChildren(shell);
    const get = (k) => shell.querySelector('[data-fs="' + k + '"]'),
      art = get("facility-art"),
      model = () => state.areas[state.area][state.mode],
      saveStatus = get("store");
    let frame = 0,
      disposed = false,
      saved = null;
    const choose = (values) => values.map((v) => [v, v]);
    const conditionOptions = keys.map((k) => [
      cases[k].conditionId,
      cases[k].condition,
    ]);
    function freeze() {
      if (stale || readonly) return;
      stale = true;
      epoch++;
      state = decode(options, base);
      render();
    }
    function noticeExternal() {
      if (disposed || readonly || stale || base === undefined) return;
      const latest = rawSnapshot(key);
      if (latest !== undefined && latest !== base) freeze();
    }
    function storageEvent(event) {
      if (event.key === key || event.key === null) noticeExternal();
    }
    function localEvent(event) {
      if (event.detail === key) noticeExternal();
    }
    function loadLatest() {
      if (disposed) return;
      if (readonly) {
        render();
        return;
      }
      if (writes && !stale) {
        render();
        return;
      }
      const latest = rawSnapshot(key);
      if (latest === undefined) {
        saved = false;
        render();
        return;
      }
      if (stale || latest !== base) {
        epoch++;
        base = latest;
        state = decode(options, latest);
        adoptedRevision = null;
        if (!storedRevision(latest)) {
          // An explicit reload can adopt an externally cleared or legacy record.
          const generation = epoch;
          pending = pending
            .then(() =>
              lockWrite(key, (revision) => {
                if (generation === epoch && rawSnapshot(key) === latest)
                  adoptedRevision = revision;
                return false;
              }),
            )
            .catch(() => {});
        }
        stale = false;
        saved = latest !== null ? true : null;
      }
      render();
    }
    function persist(notify = true) {
      if (readonly || stale) return;
      const previousData = JSON.stringify(state);
      const writeId =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-");
      const next = JSON.stringify({ ...state, writeId }),
        generation = epoch,
        report = summary(state, false);
      if (base === undefined) {
        saved = false;
        saveStatus.textContent = "Changes are available in this tab.";
        return;
      }
      writes++;
      pending = pending
        .then(() =>
          lockWrite(
            key,
            (revision) => {
              if (generation !== epoch || stale) return false;
              if (
                localStorage.getItem(key) !== base ||
                (revision &&
                  revision !== storedRevision(base) &&
                  revision !== adoptedRevision)
              ) {
                freeze();
                return false;
              }
              if (
                base !== null &&
                previousData === JSON.stringify(decode(options, base))
              )
                return false;
              localStorage.setItem(key, next);
              base = next;
              adoptedRevision = null;
              saved = true;
              return true;
            },
            writeId,
          ),
        )
        .then(
          (changed) => {
            if (!changed) return;
            // Other components mounted in this document do not receive storage events.
            window.dispatchEvent(
              new CustomEvent("signalworks:facility-save", { detail: key }),
            );
            if (!disposed) {
              saveStatus.textContent = "Saved in this browser.";
              if (notify && typeof options.onChange === "function")
                queueMicrotask(() => {
                  if (!disposed) options.onChange(report);
                });
            }
          },
          () => {
            saved = false;
            if (!disposed)
              saveStatus.textContent = "Changes are available in this tab.";
          },
        )
        .finally(() => {
          writes--;
        });
    }
    function queue() {
      if (disposed || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!disposed) scene(art, state.area);
      });
    }
    function results() {
      const r = model(),
        face = get("patch-face");
      face.innerHTML =
        "<b>" +
        esc(r.panel || "Unassigned") +
        ' cabinet</b><span class="fs-socket"><i></i>Uplink<strong>' +
        esc(r.uplink || "Open") +
        "</strong></span>" +
        ["A", "B", "C"]
          .map((id) => {
            const connected = [
              r.camera === id ? "Camera" : "",
              r.ap === id ? "AP" : "",
            ].filter(Boolean);
            return (
              '<span class="fs-socket" data-loaded="' +
              (connected.length > 0) +
              '"><i></i>' +
              id +
              "<strong>" +
              esc(connected.join(" + ") || "Open") +
              "</strong></span>"
            );
          })
          .join("");

      const cfg = model(),
        summary = get("result"),
        out = get("readbacks");
      const proved = readonly || cfg.witness === signed(cfg);
      if (!proved) {
        summary.dataset.state = "pending";
        summary.textContent =
          "Run the checks against the current setup. A configuration change requires a new test.";
        out.replaceChildren();
        return;
      }
      const result = evaluate(cases[state.area], cfg),
        passed = result.tests.filter((t) => t.ok).length;
      summary.dataset.state = result.ok ? "pass" : "fail";
      summary.textContent =
        (readonly ? "Worked readback. " : "") +
        (result.ok
          ? "Handover verified. Both endpoints delivered their test service and the area release is present."
          : passed +
            " of " +
            result.tests.length +
            " checks passed. Correct the findings below and rerun the handover.");
      out.innerHTML = result.tests
        .map(
          (r) =>
            '<div class="fs-reading" data-test="' +
            esc(r.title) +
            '" data-ok="' +
            r.ok +
            '"><small>' +
            esc(r.title) +
            "</small><b>" +
            esc(r.value) +
            "</b><p>" +
            esc(r.detail) +
            "</p></div>",
        )
        .join("");
    }
    function render() {
      if (disposed) return;
      const a = state.area,
        c = cases[a],
        r = model();
      get("areas").innerHTML = keys
        .map(
          (id) =>
            '<button type="button" data-fs-area="' +
            id +
            '" aria-pressed="' +
            (a === id) +
            '">' +
            esc(cases[id].name) +
            "</button>",
        )
        .join("");
      const mode = get("workspace-mode");
      mode.value = state.mode;
      mode.disabled = readonly || stale;
      get("area-name").textContent = c.name;
      get("area-purpose").textContent = c.purpose;
      get("art-caption").textContent = c.caption + " / illustrative cutaway";
      art.setAttribute(
        "aria-label",
        "Isolated perspective illustration of " + c.caption.toLowerCase() + ".",
      );
      get("job-card").innerHTML = [
        [
          "Fictional patch reference",
          c.panel + " cabinet / " + c.uplink + " uplink",
        ],
        [
          "Local socket assignment",
          "Camera " + c.cam + " / access point " + c.ap,
        ],
        [
          "Bench power specification",
          "Camera " +
            c.cameraW +
            " W + AP " +
            c.radioW +
            " W + reserve " +
            c.reserve +
            " W",
        ],
        ["Required area evidence", c.condition],
      ]
        .map(
          ([k, v]) =>
            "<div><dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd></div>",
        )
        .join("");
      get("ports").innerHTML =
        select(
          r,
          "panel",
          "Patch cabinet",
          choose(keys.map((k) => cases[k].panel)),
        ) +
        select(
          r,
          "uplink",
          "Upstream label",
          choose(keys.map((k) => cases[k].uplink)),
        ) +
        select(r, "camera", "Camera local socket", choose(["A", "B", "C"])) +
        select(r, "ap", "Access point local socket", choose(["A", "B", "C"])) +
        '<label>PoE allocation (W)<input type="number" min="0" max="100" step="any" inputmode="decimal" data-setting="budget" value="' +
        esc(r.budget) +
        '"></label>';
      get("handover").innerHTML =
        select(r, "condition", "Environmental evidence", conditionOptions) +
        select(r, "profile", "Endpoint service profile", [
          ["off", "Staged / service off"],
          ["enabled", "Commissioned test services"],
        ]) +
        select(
          r,
          "fault",
          "Simulated fault",
          [
            ["normal", "Normal service"],
            ["freeze", "Camera frame frozen"],
            ["client", "Client application unavailable"],
            ["uplink", "Upstream loop interrupted"],
          ],
          false,
        );
      get("reset").textContent =
        state.mode === "worked" ? "Restore worked setup" : "Clear this area";
      get("reset").hidden = readonly;
      shell
        .querySelectorAll("[data-setting]")
        .forEach((el) => (el.disabled = readonly || stale));
      get("run").hidden = readonly;
      get("run").disabled = stale;
      get("reset").disabled = stale;
      get("conflict").hidden = !stale;
      shell
        .querySelectorAll("[data-fs-area]")
        .forEach((b) => (b.disabled = stale));
      saveStatus.textContent = readonly
        ? "Read-only worked example."
        : saved === null
          ? "Changes save in this browser."
          : saved
            ? "Saved in this browser."
            : "Changes are available in this tab.";
      if (stale)
        saveStatus.textContent = "This view has an older saved version.";
      results();
      queue();
    }
    function click(e) {
      const b = e.target.closest("button");
      if (!b || !shell.contains(b)) return;
      if (b.dataset.fs === "latest") {
        loadLatest();
        return;
      }
      if (stale || b.disabled) return;
      if (b.dataset.fsArea && Object.hasOwn(cases, b.dataset.fsArea)) {
        if (state.area === b.dataset.fsArea) return;
        state.area = b.dataset.fsArea;
        persist(false);
        render();
        shell
          .querySelector('[data-fs-area="' + state.area + '"]')
          ?.focus({ preventScroll: true });
      } else if (b.dataset.fs === "reset" && !readonly) {
        const next =
          state.mode === "worked" ? worked(cases[state.area]) : blank();
        if (JSON.stringify(model()) === JSON.stringify(next)) return;
        state.areas[state.area][state.mode] = next;
        persist();
        render();
      }
    }
    function edit(e) {
      const el = e.target;
      if (readonly || stale) return;
      if (
        el === get("workspace-mode") &&
        ["build", "worked"].includes(el.value)
      ) {
        if (state.mode !== el.value) {
          state.mode = el.value;
          persist();
          render();
        }
        return;
      }
      const name = el.dataset.setting;
      if (!Object.hasOwn(blank(), name) || name === "witness") return;
      const r = model();
      if (r[name] !== el.value) {
        r[name] = el.value;
        r.witness = "";
        persist();
        results();
      }
    }
    function submit(e) {
      if (e.target !== get("setup")) return;
      e.preventDefault();
      if (readonly || stale) return;
      if (model().witness === signed(model())) return;
      model().witness = signed(model());
      persist();
      results();
    }
    function ready() {
      return summary(state, readonly);
    }
    window.addEventListener("storage", storageEvent);
    window.addEventListener("signalworks:facility-save", localEvent);
    shell.addEventListener("click", click);
    shell.addEventListener("change", edit);
    shell.addEventListener("input", edit);
    shell.addEventListener("submit", submit);
    const observer = new ResizeObserver(queue);
    observer.observe(art);
    render();
    const api = {
      refresh: loadLatest,
      whenSaved: () => pending,
      getState() {
        return { ...JSON.parse(JSON.stringify(state)), readonly, stale };
      },
      ready,
      destroy() {
        if (disposed) return;
        disposed = true;
        observer.disconnect();
        window.removeEventListener("storage", storageEvent);
        window.removeEventListener("signalworks:facility-save", localEvent);
        cancelAnimationFrame(frame);
        shell.removeEventListener("click", click);
        shell.removeEventListener("change", edit);
        shell.removeEventListener("input", edit);
        shell.removeEventListener("submit", submit);
        shell.remove();
        mounts.delete(root);
      },
    };
    mounts.set(root, api);
    return api;
  }
  window.FacilityServices = Object.freeze({ mount, statusFor });
  for (const root of document.querySelectorAll("[data-facility-services]"))
    mount(root);
})();
