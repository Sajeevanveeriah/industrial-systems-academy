(() => {
  "use strict";
  const catalogue = {
    intake: {
      name: "Potato intake",
      trim: "#ba7750",
      wall: "#d6c4a2",
      roof: "#a77756",
      width: 2.74,
      depth: 1.86,
      height: 1.23,
    },
    process: {
      name: "Process hall",
      trim: "#43877d",
      wall: "#d5ded1",
      roof: "#86a89b",
      width: 2.94,
      depth: 2.15,
      height: 1.58,
    },
    cold: {
      name: "Cold store",
      trim: "#528399",
      wall: "#d3e2e5",
      roof: "#a6c3ca",
      width: 2.81,
      depth: 2.09,
      height: 1.52,
    },
    utilities: {
      name: "Utility plant",
      trim: "#768e8b",
      wall: "#c6d4cc",
      roof: "#93aaa2",
      width: 2.81,
      depth: 1.93,
      height: 1.22,
    },
    control: {
      name: "Control building",
      trim: "#667766",
      wall: "#e9e1c5",
      roof: "#929e88",
      width: 2.48,
      depth: 1.67,
      height: 1.21,
    },
    dispatch: {
      name: "Dispatch dock",
      trim: "#536d93",
      wall: "#ccdadc",
      roof: "#8ca2af",
      width: 2.86,
      depth: 2.07,
      height: 1.38,
    },
  };
  const steel = "#a4b8b3",
    frameSteel = "#63878a",
    glass = "#6d9f9e",
    deep = "#415e60",
    slab = "#d3d5c7";
  const dx = 3.68,
    dz = 3.04,
    X = 3 * dx,
    Z = 2 * dz;
  const clamp = (v, l, h) => Math.max(l, Math.min(v, h));
  const validCell = (c) => Number.isInteger(c) && c >= 0 && c < 24;
  const centre = (c) => [
    -X + dx * ((c % 6) + 0.5),
    -Z + dz * (Math.floor(c / 6) + 0.5),
  ];
  const code = (c) =>
    String.fromCharCode(65 + Math.floor(c / 6)) + ((c % 6) + 1);
  const colours = new Map();
  function rgb(hex) {
    if (!colours.has(hex))
      colours.set(
        hex,
        [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255),
      );
    return colours.get(hex);
  }
  function shade(col, n) {
    const light =
      0.72 +
      Math.max(0, -0.45 * n[0] + 0.78 * n[1] + 0.43 * n[2]) * 0.29 +
      Math.max(0, n[1]) * 0.09;
    return rgb(col).map((v) => Math.min(1, v * light));
  }
  const css = (c) => "rgb(" + c.map((x) => Math.round(x * 255)).join(",") + ")";
  // Faces keep world coordinates for drawing, ray picking and the Canvas fallback.
  function geometry(transform) {
    const polys = [];
    function face(points, col, id = null) {
      if (transform) points = points.map(transform);
      const [a, b, c] = points,
        e = b.map((v, i) => v - a[i]),
        f = c.map((v, i) => v - a[i]);
      const n = [
        e[1] * f[2] - e[2] * f[1],
        e[2] * f[0] - e[0] * f[2],
        e[0] * f[1] - e[1] * f[0],
      ];
      const d = Math.hypot(...n) || 1;
      polys.push({
        pts: points,
        col: shade(
          col,
          n.map((x) => x / d),
        ),
        id,
      });
    }
    function box(x, y, z, w, h, d, col, id, angle = 0) {
      const co = Math.cos(angle),
        si = Math.sin(angle);
      const point = (a, b, c) => [
        x + a * co + c * si,
        y + b,
        z - a * si + c * co,
      ];
      const p = [
        [-1, 0, -1],
        [1, 0, -1],
        [1, 0, 1],
        [-1, 0, 1],
        [-1, 1, -1],
        [1, 1, -1],
        [1, 1, 1],
        [-1, 1, 1],
      ].map(([a, b, c]) => point((a * w) / 2, b * h, (c * d) / 2));
      [
        [0, 1, 2, 3],
        [4, 7, 6, 5],
        [0, 4, 5, 1],
        [3, 2, 6, 7],
        [0, 3, 7, 4],
        [1, 5, 6, 2],
      ].forEach((indices) =>
        face(
          indices.map((i) => p[i]),
          col,
          id,
        ),
      );
    }
    function cylinder(x, y, z, r, h, col, id, sides = 16) {
      const ring = (n, j) => [
        x + r * Math.cos((n * 2 * Math.PI) / sides),
        y + j * h,
        z + r * Math.sin((n * 2 * Math.PI) / sides),
      ];
      const top = [];
      for (let i = 0; i < sides; i++) {
        face([ring(i, 0), ring(i, 1), ring(i + 1, 1), ring(i + 1, 0)], col, id);
        top.unshift(ring(i, 1));
      }
      face(top, col, id);
    }
    function beam(a, b, y, w, h, col, id) {
      const dx = b[0] - a[0],
        dz = b[1] - a[1];
      box(
        (a[0] + b[0]) / 2,
        y,
        (a[1] + b[1]) / 2,
        Math.hypot(dx, dz),
        h,
        w,
        col,
        id,
        Math.atan2(-dz, dx),
      );
    }
    return { polys, box, cylinder, beam, face };
  }
  function normalise(site) {
    const buildings = {};
    for (const key of Object.keys(catalogue)) {
      const b = site?.buildings?.[key];
      if (
        b &&
        validCell(b.cell) &&
        Number.isInteger(b.level) &&
        b.level >= 0 &&
        b.level <= 3
      )
        buildings[key] = { cell: b.cell, level: b.level };
    }
    const links = [];
    for (const link of Array.isArray(site?.links) ? site.links : []) {
      const from = link?.from?.split?.(".")[0],
        to = link?.to?.split?.(".")[0];
      if (
        Object.hasOwn(buildings, from) &&
        Object.hasOwn(buildings, to) &&
        from !== to &&
        typeof link.service === "string"
      )
        links.push({
          from,
          to,
          fromPort: link.from.split(".")[1] || "",
          toPort: link.to.split(".")[1] || "",
          service: link.service,
        });
    }
    const entrance = validCell(site?.surveyPlan?.entrance)
      ? site.surveyPlan.entrance
      : null;
    const reserve = Array.isArray(site?.surveyPlan?.reserve)
      ? [...new Set(site.surveyPlan.reserve.filter(validCell))]
      : [];
    const roads = Object.fromEntries(
      ["gate", "receiving", "outbound"].map((k) => [
        k,
        validCell(site?.roads?.[k]) ? site.roads[k] : null,
      ]),
    );
    return {
      survey: site?.survey === true,
      access: site?.access === true,
      surveyPlan: { entrance, reserve },
      roads,
      buildings,
      links,
    };
  }
  function adjacent(a, b) {
    return (
      validCell(a) &&
      validCell(b) &&
      Math.abs((a % 6) - (b % 6)) +
        Math.abs(Math.floor(a / 6) - Math.floor(b / 6)) ===
        1
    );
  }
  function orientation(site, key) {
    const cell = site.buildings[key]?.cell;
    const apron =
      key === "intake"
        ? site.roads.receiving
        : key === "dispatch"
          ? site.roads.outbound
          : null;
    if (!adjacent(cell, apron)) return 0;
    const [x, z] = centre(cell),
      [ax, az] = centre(apron);
    return Math.atan2(ax - x, az - z);
  }
  function rotateAt(point, around, angle) {
    const x = point[0] - around[0],
      z = point[2] - around[1],
      c = Math.cos(angle),
      s = Math.sin(angle);
    return [around[0] + c * x + s * z, point[1], around[1] - s * x + c * z];
  }
  function solidBeam(g, a, b, width, height, col, id) {
    const d = b.map((v, i) => v - a[i]),
      len = Math.hypot(...d);
    if (len < 0.0001) return;
    const hor = Math.hypot(d[0], d[2]);
    const n = hor < 0.0001 ? [1, 0, 0] : [-d[2] / hor, 0, d[0] / hor];
    const k = [
      (d[1] * n[2] - d[2] * n[1]) / len,
      (d[2] * n[0] - d[0] * n[2]) / len,
      (d[0] * n[1] - d[1] * n[0]) / len,
    ];
    const ring = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([j, h]) =>
        p.map((v, i) => v + (j * width * n[i]) / 2 + (h * height * k[i]) / 2),
      );
    const p = ring(a),
      q = ring(b);
    g.face(p, col, id);
    g.face(q.slice().reverse(), col, id);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      g.face([p[i], q[i], q[j], p[j]], col, id);
    }
  }
  function tree(g, x, z, r, tone) {
    g.cylinder(x, 0.016, z, 0.07 * r, 0.54 * r, "#896c4f", null, 7);
    const rings = [
      Array.from({ length: 7 }, (_, j) => [
        x + r * 0.41 * Math.cos((j * 2 * Math.PI) / 7),
        0.48 * r,
        z + r * 0.37 * Math.sin((j * 2 * Math.PI) / 7),
      ]),
      Array.from({ length: 7 }, (_, j) => [
        x + r * 0.57 * Math.cos(((j + 0.28) * 2 * Math.PI) / 7),
        (0.81 + 0.05 * Math.sin(j)) * r,
        z + r * 0.48 * Math.sin(((j + 0.28) * 2 * Math.PI) / 7),
      ]),
      Array.from({ length: 7 }, (_, j) => [
        x + r * 0.31 * Math.cos(((j + 0.62) * 2 * Math.PI) / 7),
        1.07 * r,
        z + r * 0.29 * Math.sin(((j + 0.62) * 2 * Math.PI) / 7),
      ]),
    ];
    for (let j = 0; j < 7; j++)
      for (let k = 0; k < 2; k++) {
        let b = (j + 1) % 7;
        g.face([rings[k][j], rings[k + 1][j], rings[k + 1][b]], tone);
        g.face([rings[k][j], rings[k + 1][b], rings[k][b]], tone);
      }
    const top = [x + 0.03 * r, 1.25 * r, z - 0.03 * r];
    for (let j = 0; j < 7; j++)
      g.face([rings[2][j], top, rings[2][(j + 1) % 7]], tone);
  }
  function grass(g, site) {
    const turf = ["#b9cf9b", "#c1d5a3", "#c5d9a7", "#b9cf9f"];
    g.box(0, -0.57, 0, 2 * X + 2.17, 0.26, 2 * Z + 2.24, "#a99576");
    g.box(0, -0.31, 0, 2 * X + 2.18, 0.24, 2 * Z + 2.25, "#b9aa88");
    g.box(0, -0.075, 0, 2 * X + 2.2, 0.075, 2 * Z + 2.27, "#afc799");
    for (let cell = 0; cell < 24; cell++) {
      const [x, z] = centre(cell);
      g.box(
        x,
        0.001,
        z,
        dx - 0.025,
        0.009,
        dz - 0.025,
        turf[(cell + Math.floor(cell / 6)) % 4],
        cell,
      );
      if (site.survey) {
        for (const a of [-1, 1])
          for (const b of [-1, 1]) {
            g.box(
              x + a * (dx / 2 - 0.15),
              0.01,
              z + b * (dz / 2 - 0.15),
              0.053,
              0.14,
              0.054,
              "#b59066",
              cell,
            );
            g.box(
              x + a * (dx / 2 - 0.15),
              0.145,
              z + b * (dz / 2 - 0.15),
              0.056,
              0.055,
              0.056,
              "#e5a347",
              cell,
            );
          }
      }
    }
    for (let i = 0; i <= 6; i++)
      g.box(
        -X + i * dx,
        0.012,
        0,
        0.023,
        0.008,
        2 * Z,
        site.survey ? "#9caa87" : "#a4bb91",
      );
    for (let i = 0; i <= 4; i++)
      g.box(
        0,
        0.012,
        -Z + i * dz,
        2 * X,
        0.008,
        0.023,
        site.survey ? "#9caa87" : "#a4bb91",
      );
    // The surrounding windbreak and mature trees belong to the landscape.
    const trees = [
      [-0.97, -0.97, 1.02],
      [-0.87, -0.99, 0.83],
      [-0.76, -0.98, 0.97],
      [-0.31, -0.99, 0.87],
      [-0.23, -0.98, 1.26],
      [0.39, -0.98, 0.95],
      [0.48, -0.99, 1.12],
      [0.9, -0.98, 1.04],
      [0.99, -0.93, 0.91],
      [-0.98, 0.24, 0.92],
      [-0.98, 0.4, 1.14],
      [-0.98, 0.52, 0.79],
      [0.99, 0.11, 0.81],
      [0.99, 0.24, 1.01],
    ];
    trees.forEach(([x, z, r], i) =>
      tree(
        g,
        x * (X + 0.56),
        z * (Z + 0.74),
        r,
        ["#7fa67b", "#88ad79", "#76a085"][i % 3],
      ),
    );
    for (const cell of site.surveyPlan.reserve) {
      const [x, z] = centre(cell);
      const oval = (r, col, offset) =>
        g.face(
          Array.from({ length: 18 }, (_, n) => {
            const a = (-2 * Math.PI * n) / 18,
              noise = 1 + 0.09 * Math.sin(3 * a);
            return [
              x + Math.cos(a) * r * noise,
              0.027 + offset,
              z + Math.sin(a) * r * 0.63 * noise,
            ];
          }),
          col,
          cell,
        );
      oval(1.12, "#a3b385", 0);
      oval(0.91, "#83aba2", 0.005);
      for (let j = 0; j < 6; j++)
        g.box(
          x - 0.79 + j * 0.3,
          0.03,
          z + 0.43 + Math.sin(j) * 0.04,
          0.031,
          0.2 + 0.07 * Math.cos(j),
          0.028,
          "#739366",
          cell,
        );
    }
    if (validCell(site.surveyPlan.entrance) && !site.access) {
      const [x, z] = centre(site.surveyPlan.entrance);
      for (const side of [-1, 1]) {
        g.box(
          x - 0.8,
          0.012,
          z + side * 0.43,
          0.07,
          0.32,
          0.07,
          "#827c59",
          site.surveyPlan.entrance,
        );
        g.box(
          x - 0.8,
          0.32,
          z + side * 0.43,
          0.1,
          0.066,
          0.1,
          "#d3b15c",
          site.surveyPlan.entrance,
        );
      }
    }
    if (site.access) roads(g, site);
  }
  function roadRoutes(site) {
    if (window.SiteBuild?.roadPaths) return window.SiteBuild.roadPaths(site);
    // Standalone preview uses the same orthogonal neighbours and route priorities.
    const { gate, receiving, outbound } = site.roads;
    if (!validCell(gate) || !validCell(receiving) || !validCell(outbound))
      return {};
    const occupied = new Set([
      ...site.surveyPlan.reserve,
      ...Object.values(site.buildings).map((b) => b.cell),
    ]);
    function path(end, avoid) {
      const queue = [[gate]],
        seen = new Set([gate]);
      for (const route of queue) {
        const n = route.at(-1);
        if (n === end) return route;
        for (const t of [n - 6, n - 1, n + 1, n + 6])
          if (
            adjacent(n, t) &&
            !occupied.has(t) &&
            !seen.has(t) &&
            (t !== avoid || t === gate)
          ) {
            seen.add(t);
            queue.push([...route, t]);
          }
      }
      return [];
    }
    return {
      raw: path(receiving, outbound),
      finished: path(outbound, receiving),
    };
  }
  function roads(g, site) {
    const gate = validCell(site.roads.gate)
        ? site.roads.gate
        : (site.surveyPlan.entrance ?? 12),
      [gx, gz] = centre(gate);
    const asphalt = "#7a8d88",
      kerb = "#cbd0bf",
      stripe = "#eadfb1";
    const paved = (a, b, width, id) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.01) return;
      g.beam(a, b, 0.04, width + 0.12, 0.036, kerb, id);
      g.beam(a, b, 0.077, width, 0.022, asphalt, id);
      for (let c = 0.41; c < len - 0.22; c += 0.87) {
        const q = (t) => [
          a[0] + ((b[0] - a[0]) * t) / len,
          a[1] + ((b[1] - a[1]) * t) / len,
        ];
        g.beam(q(c - 0.16), q(c + 0.16), 0.101, 0.037, 0.009, stripe, id);
      }
    };
    paved([-X - 1.03, gz], [gx, gz], 0.82, gate);
    for (const s of [-1, 1]) {
      g.box(
        -X - 0.47,
        0.08,
        gz + s * 0.52,
        0.125,
        0.43,
        0.125,
        "#658077",
        gate,
      );
      g.box(-X - 0.47, 0.5, gz + s * 0.52, 0.145, 0.066, 0.145, stripe, gate);
    }
    const routes = roadRoutes(site),
      segments = new Set();
    for (const [key, path, apron] of [
      ["intake", routes.raw, site.roads.receiving],
      ["dispatch", routes.finished, site.roads.outbound],
    ]) {
      if (!Array.isArray(path) || !path.length || !site.buildings[key])
        continue;
      for (let j = 1; j < path.length; j++) {
        const a = path[j - 1],
          b = path[j],
          token = [a, b].sort((u, v) => u - v).join("/");
        if (!segments.has(token)) {
          segments.add(token);
          paved(centre(a), centre(b), 0.72, b);
        }
      }
      if (!adjacent(site.buildings[key].cell, apron)) continue;
      const origin = centre(site.buildings[key].cell),
        start = centre(apron),
        angle = orientation(site, key);
      // The dock door faces its actual neighbouring apron. Stop the drive at that facade.
      const dock = [
        origin[0] + Math.sin(angle) * (catalogue[key].depth / 2 + 0.12),
        origin[1] + Math.cos(angle) * (catalogue[key].depth / 2 + 0.12),
      ];
      paved(start, dock, 1.16, apron);
      g.box(start[0], 0.1, start[1], 1.25, 0.012, 1.03, "#93a19a", apron);
    }
  }
  function architecture(g, key, b) {
    const d = catalogue[key],
      [cx, cz] = centre(b.cell),
      id = b.cell,
      w = d.width,
      deepZ = d.depth,
      h = d.height;
    const P = (x, y, z) => [cx + x, y, cz + z];
    const box = (x, y, z, w, h, zs, c, angle = 0) =>
      g.box(...P(x, y, z), w, h, zs, c, id, angle);
    const tube = (x, y, z, r, h, c, n = 12) =>
      g.cylinder(...P(x, y, z), r, h, c, id, n);
    const beam = (a, e, width, thick, c) =>
      solidBeam(g, P(...a), P(...e), width, thick, c, id);
    const panel = (pts, c) =>
      g.face(
        pts.map((v) => P(...v)),
        c,
        id,
      );
    const x1 = -w / 2,
      x2 = w / 2,
      z1 = -deepZ / 2,
      z2 = deepZ / 2,
      base = 0.23,
      top = base + h;
    const front = z2 + 0.014;
    function rollingDoor(x, z, width, height) {
      box(x, base, z, width, 0.032 + height, 0.046, "#536768");
      box(
        x,
        base + 0.04,
        z + 0.029,
        width - 0.09,
        height - 0.07,
        0.018,
        "#9aa9a4",
      );
      for (let n = 1; n < 6; n++)
        box(
          x,
          base + (n * height) / 6,
          z + 0.045,
          width - 0.1,
          0.025,
          0.01,
          "#748a83",
        );
      box(x, base + height, z + 0.035, width + 0.08, 0.074, 0.106, d.trim);
    }
    function glazing(x, y, z, width, height) {
      box(x, y, z, width, height, 0.036, "#4b6363");
      box(x, y + 0.03, z + 0.022, width - 0.065, height - 0.06, 0.022, glass);
      for (let k = 1; k < Math.ceil(width / 0.42); k++)
        box(
          x - width / 2 + (width * k) / Math.ceil(width / 0.42),
          y,
          z + 0.035,
          0.03,
          height,
          0.025,
          steel,
        );
    }
    function entry(x, z) {
      box(x, base, z, 0.31, 0.66, 0.065, "#516c64");
      box(x, base + 0.34, z + 0.035, 0.22, 0.23, 0.018, glass);
      box(x + 0.1, base + 0.28, z + 0.049, 0.04, 0.035, 0.022, slab);
      box(x, 0.093, z + 0.13, 0.41, 0.09, 0.23, slab);
    }
    function gable(x, z, width, depth, y, rise, colour) {
      const left = x - width / 2,
        right = x + width / 2,
        far = z - depth / 2,
        near = z + depth / 2;
      panel(
        [
          [left, y, far],
          [right, y, far],
          [right, y + rise, z],
          [left, y + rise, z],
        ],
        colour,
      );
      panel(
        [
          [left, y + rise, z],
          [right, y + rise, z],
          [right, y, near],
          [left, y, near],
        ],
        colour,
      );
      panel(
        [
          [left, y, near],
          [left, y + rise, z],
          [left, y, far],
        ],
        d.wall,
      );
      panel(
        [
          [right, y, far],
          [right, y + rise, z],
          [right, y, near],
        ],
        d.wall,
      );
      for (let j = 0; j < 7; j++) {
        const u = left + 0.12 + (j * (width - 0.24)) / 6;
        beam(
          [u, y + 0.012, far],
          [u, y + rise + 0.012, z],
          0.023,
          0.023,
          steel,
        );
        beam(
          [u, y + rise + 0.012, z],
          [u, y + 0.012, near],
          0.023,
          0.023,
          steel,
        );
      }
      beam(
        [left, y + rise + 0.01, z],
        [right, y + rise + 0.01, z],
        0.076,
        0.045,
        steel,
      );
    }
    function roofFan(x, y, z, r) {
      box(x, y, z, r * 2.45, 0.16, r * 2.42, "#91a7a6");
      tube(x, y + 0.16, z, r, 0.045, "#415c62", 16);
      for (let n = 0; n < 3; n++) {
        const a = n * 2.095;
        box(
          x + 0.32 * r * Math.cos(a),
          y + 0.209,
          z + 0.32 * r * Math.sin(a),
          1.1 * r,
          0.019,
          0.24 * r,
          steel,
          -a,
        );
      }
      tube(x, y + 0.229, z, r * 0.18, 0.025, d.trim, 10);
    }
    function skin() {
      box(0, base, 0, w, h, deepZ, d.wall);
      for (let n = 1; n < 9; n++) {
        const x = x1 + (n * w) / 9;
        box(x, base + 0.02, front, 0.012, h - 0.04, 0.012, "#a6b7ad");
      }
      for (let n = 1; n < 6; n++)
        box(
          x1 - 0.007,
          base + 0.02,
          z1 + (n * deepZ) / 6,
          0.012,
          h - 0.04,
          0.015,
          "#acbcb0",
        );
      box(0, top - 0.115, front, w, 0.12, 0.047, d.trim);
    }
    // A surveyed footprint has set-out boards and string lines but no poured structure.
    if (b.level === 0) {
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          box(
            sx * (w / 2 + 0.035),
            0.019,
            sz * (deepZ / 2 + 0.035),
            0.066,
            0.24,
            0.064,
            "#b18a58",
          );
          box(
            sx * (w / 2 - 0.065),
            0.195,
            sz * (deepZ / 2 + 0.04),
            0.31,
            0.06,
            0.04,
            "#d1af77",
          );
          box(
            sx * (w / 2 + 0.035),
            0.195,
            sz * (deepZ / 2 - 0.065),
            0.04,
            0.06,
            0.31,
            "#d1af77",
          );
        }
      for (const sz of [-1, 1])
        box(0, 0.212, (sz * deepZ) / 2, w, 0.016, 0.016, "#eee4b5");
      for (const sx of [-1, 1])
        box((sx * w) / 2, 0.212, 0, 0.016, 0.016, deepZ, "#eee4b5");
      return;
    }
    box(0, 0.026, 0, w + 0.2, 0.094, deepZ + 0.19, "#b8b69f");
    box(0, 0.12, 0, w + 0.12, 0.11, deepZ + 0.13, slab);
    if (b.level === 1) {
      for (const sx of [-1, 0, 1])
        for (const sz of [-1, 1]) {
          box(
            sx * (w / 2 - 0.1),
            base,
            sz * (deepZ / 2 - 0.1),
            0.23,
            0.075,
            0.22,
            "#a8b2a8",
          );
          for (const u of [-0.048, 0.048])
            tube(
              sx * (w / 2 - 0.1) + u,
              base + 0.075,
              sz * (deepZ / 2 - 0.1),
              0.015,
              0.15,
              "#8c7358",
              6,
            );
        }
      tube(x1 + 0.4, base, z1 + 0.38, 0.066, 0.2, "#688e8d", 8);
      for (const sx of [-1, 1])
        box((sx * w) / 4, base + 0.001, 0, 0.012, 0.007, deepZ, "#a9afa2");
      return;
    }
    if (b.level === 2) {
      for (const sx of [-1, 0, 1]) {
        const x = sx * (w / 2 - 0.07);
        for (const sz of [-1, 1]) {
          const z = sz * (deepZ / 2 - 0.065);
          box(x, base, z, 0.1, h, 0.12, frameSteel);
          box(x, base, z, 0.21, 0.05, 0.22, steel);
          beam([x, top, z], [x, top + 0.24, 0], 0.065, 0.071, steel);
          beam([x, top - 0.24, z], [x, top, 0.7 * z], 0.043, 0.045, steel);
        }
      }
      for (const sz of [-1, 0, 1])
        beam(
          [x1, top + (sz === 0 ? 0.24 : 0), sz * (deepZ / 2 - 0.065)],
          [x2, top + (sz === 0 ? 0.24 : 0), sz * (deepZ / 2 - 0.065)],
          0.085,
          0.078,
          frameSteel,
        );
      beam(
        [x1 + 0.07, base, z1 + 0.065],
        [0, top, z1 + 0.065],
        0.047,
        0.047,
        steel,
      );
      beam(
        [0, top, z1 + 0.065],
        [x2 - 0.07, base, z1 + 0.065],
        0.047,
        0.047,
        steel,
      );
      return;
    }
    if (key === "intake") {
      const x = -0.38;
      box(x, base, -0.26, 1.62, 0.91, 1.28, d.wall);
      rollingDoor(-0.45, 0.39, 0.74, 0.73);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          box(
            sx * (w / 2 - 0.085),
            base,
            sz * (deepZ / 2 - 0.085),
            0.075,
            h,
            0.075,
            frameSteel,
          );
      gable(0, 0, w + 0.12, deepZ + 0.14, top, 0.26, d.roof);
      for (let n = 0; n < 8; n++)
        box(0.36 + n * 0.1, base + 0.004, 0.34, 0.041, 0.016, 0.75, deep);
      box(0.79, base + 0.07, -0.57, 0.66, 0.46, 0.55, "#a6b6ae");
    } else if (key === "process") {
      skin();
      box(0, top, 0, w + 0.12, 0.09, deepZ + 0.11, d.roof);
      for (const z of [-0.58, 0.1, 0.74]) {
        panel(
          [
            [x1 - 0.035, top + 0.1, z - 0.32],
            [x2 + 0.035, top + 0.1, z - 0.32],
            [x2 + 0.035, top + 0.33, z + 0.16],
            [x1 - 0.035, top + 0.33, z + 0.16],
          ],
          d.roof,
        );
        box(0, top + 0.1, z + 0.15, w, 0.23, 0.04, glass);
      }
      rollingDoor(0.61, front, 0.78, 0.86);
      glazing(-0.64, base + 0.74, front, 0.99, 0.34);
      for (const x of [-0.84, -0.41]) {
        tube(x, top + 0.16, z1 + 0.23, 0.095, 0.62, steel);
        tube(x, top + 0.76, z1 + 0.23, 0.14, 0.056, deep);
      }
      entry(-1.17, front);
    } else if (key === "cold") {
      skin();
      box(0, top, 0, w + 0.13, 0.11, deepZ + 0.13, d.roof);
      for (const x of [-0.61, 0.1, 0.8]) roofFan(x, top + 0.11, -0.4, 0.23);
      rollingDoor(-0.18, front, 0.85, 1.03);
      box(-0.18, base + 1.1, front + 0.095, 1.06, 0.07, 0.27, d.trim);
      for (const sx of [-1, 1])
        tube(-0.18 + sx * 0.51, 0.15, front + 0.14, 0.045, 0.38, "#d9aa59");
      box(0.92, base + 0.22, front + 0.052, 0.32, 0.35, 0.11, steel);
    } else if (key === "utilities") {
      box(-0.65, base, -0.04, 1.23, h, deepZ - 0.14, d.wall);
      gable(-0.65, -0.04, 1.38, deepZ + 0.01, top, 0.12, d.roof);
      entry(-0.96, front - 0.12);
      for (const x of [0.32, 0.94]) {
        tube(x, base, -0.36, 0.26, 0.96, "#b9c8c2", 18);
        tube(x, base + 0.94, -0.36, 0.277, 0.065, steel, 18);
        tube(x, base + 1.01, -0.36, 0.082, 0.075, d.trim, 12);
        tube(x, base + 0.16, -0.36, 0.27, 0.037, d.trim, 18);
        beam(
          [x, base + 0.82, -0.36],
          [x, base + 0.82, 0.4],
          0.065,
          0.065,
          "#668c89",
        );
        tube(x, base + 0.11, 0.42, 0.036, 0.72, "#668c89");
      }
      box(0.65, base, 0.53, 0.95, 0.38, 0.4, frameSteel);
      for (let n = 0; n < 6; n++)
        box(0.3 + 0.14 * n, base + 0.08, 0.74, 0.059, 0.23, 0.026, deep);
      tube(-0.62, top + 0.06, -0.46, 0.11, 0.72, steel);
      tube(-0.62, top + 0.77, -0.46, 0.15, 0.06, deep);
    } else if (key === "control") {
      skin();
      box(0, top, 0, w + 0.18, 0.095, deepZ + 0.18, d.roof);
      for (const sz of [-1, 1])
        box(
          0,
          top + 0.086,
          sz * (deepZ / 2 + 0.02),
          w + 0.12,
          0.075,
          0.075,
          d.wall,
        );
      glazing(-0.56, base + 0.45, front, 1.1, 0.49);
      glazing(0.79, base + 0.45, front, 0.63, 0.49);
      entry(0.29, front);
      box(0.28, base + 0.82, front + 0.16, 0.54, 0.06, 0.36, d.trim);
      box(-0.63, top + 0.1, -0.31, 0.46, 0.24, 0.44, steel);
      roofFan(-0.63, top + 0.34, -0.31, 0.15);
      for (let j = 0; j < 2; j++) {
        box(x1 - 0.035, base + 0.48, -0.43 + j * 0.57, 0.054, 0.43, 0.4, glass);
      }
    } else {
      skin();
      gable(0, 0, w + 0.15, deepZ + 0.12, top, 0.116, d.roof);
      box(0, base, front + 0.14, w + 0.09, 0.16, 0.32, "#9aa49b");
      for (const x of [-0.74, 0.1]) {
        rollingDoor(x, front + 0.02, 0.62, 0.81);
        box(x, base + 0.9, front + 0.1, 0.8, 0.1, 0.2, d.trim);
        for (const s of [-1, 1])
          box(x + s * 0.34, base + 0.03, front + 0.27, 0.062, 0.13, 0.1, deep);
        box(x, base + 1.07, front + 0.028, 0.2, 0.1, 0.026, "#e6d9aa");
      }
      entry(0.94, front);
      for (let n = 0; n < 5; n++)
        box(
          -0.94 + n * 0.22,
          base + 0.166,
          front + 0.23,
          0.085,
          0.01,
          0.14,
          "#dcb970",
        );
    }
  }
  function utilityColour(service) {
    const s = service.toLowerCase();
    if (/power|electric|supply|energy/.test(s)) return "#b77823";
    if (/waste|effluent|drain/.test(s)) return "#776d48";
    if (/product|transfer/.test(s)) return "#987540";
    if (/water|wash/.test(s)) return "#3485a1";
    if (/network|data|fibre|fiber|control|ether/.test(s)) return "#785d9e";
    if (/cold|cool|refrig|glycol|chill/.test(s)) return "#358a88";
    if (/heat|steam|gas/.test(s)) return "#bd4e38";
    if (/instrument air|compressed air/.test(s)) return "#375b91";
    let hash = 0;
    for (const c of s) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    return ["#59816d", "#886857", "#627996"][hash % 3];
  }
  const serviceSlots = [
    "power",
    "water",
    "chilled loop",
    "network",
    "product transfer",
    "wastewater",
    "process heat",
    "instrument air",
  ];
  const endpointSlots = {
    power: 0,
    water: 1,
    chilled: 2,
    network: 3,
    product: 4,
    wastewater: 5,
    treatment: 5,
    heat: 6,
    air: 7,
  };
  function serviceSlot(service) {
    return Math.max(0, serviceSlots.indexOf(service.toLowerCase()));
  }
  function serviceSocket(site, link, end) {
    const key = link[end],
      name = link[end + "Port"],
      slot = Object.hasOwn(endpointSlots, name)
        ? endpointSlots[name]
        : serviceSlot(link.service);
    const origin = centre(site.buildings[key].cell);
    const offset = (slot - 3.5) * 0.235;
    const p = rotateAt(
      [origin[0] + offset, 0, origin[1] + catalogue[key].depth / 2 + 0.105],
      origin,
      orientation(site, key),
    );
    return [p[0], p[2]];
  }
  function services(g, site) {
    site.links.forEach((l) => {
      const a = site.buildings[l.from].cell,
        b = site.buildings[l.to].cell,
        A = centre(a),
        B = centre(b),
        col = utilityColour(l.service),
        offset = (serviceSlot(l.service) - 3.5) * 0.105,
        h = 0.242 + 0.008 * (serviceSlot(l.service) % 2);
      if (a === b) return;
      // Route along plot boundaries with visible connections at both building entries.
      const railX = B[0] - dx / 2 + 0.12 + offset;
      const rowA = A[1] + dz / 2 - 0.12 + offset,
        rowB = B[1] + dz / 2 - 0.12 + offset;
      const start = serviceSocket(site, l, "from"),
        end = serviceSocket(site, l, "to");
      const path = [start, [start[0], rowA]];
      if (Math.floor(a / 6) !== Math.floor(b / 6))
        path.push([railX, rowA], [railX, rowB]);
      path.push([end[0], rowB], end);
      for (let j = 1; j < path.length; j++) {
        const u = path[j - 1],
          v = path[j],
          length = Math.hypot(v[0] - u[0], v[1] - u[1]);
        if (length < 0.001) continue;
        g.beam(
          u,
          v,
          h,
          0.057,
          0.055,
          col,
          j === 1 ? a : j === path.length - 1 ? b : null,
        );
        const supports = Math.max(1, Math.ceil(length / 1.82));
        for (let k = 0; k < supports; k++) {
          const f = k / supports;
          g.box(
            u[0] + (v[0] - u[0]) * f,
            0.077,
            u[1] + (v[1] - u[1]) * f,
            0.092,
            h - 0.075,
            0.095,
            steel,
          );
        }
      }
      for (const [p, id] of [
        [start, a],
        [end, b],
      ]) {
        g.cylinder(p[0], 0.08, p[1], 0.08, h + 0.07, col, id, 10);
        g.cylinder(p[0], h + 0.12, p[1], 0.091, 0.05, deep, id, 10);
        g.cylinder(p[0], h + 0.17, p[1], 0.06, 0.016, col, id, 10);
      }
    });
  }
  function model(site) {
    const g = geometry();
    grass(g, site);
    for (const [key, b] of Object.entries(site.buildings)) {
      const origin = centre(b.cell),
        angle = orientation(site, key);
      if (angle === 0) architecture(g, key, b);
      else {
        const rotated = geometry((p) => rotateAt(p, origin, angle));
        architecture(rotated, key, b);
        g.polys.push(...rotated.polys);
      }
    }
    services(g, site);
    return g.polys;
  }
  function selection(cell) {
    if (!validCell(cell)) return [];
    const g = geometry(),
      [x, z] = centre(cell),
      hx = dx / 2 - 0.105,
      hz = dz / 2 - 0.105;
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        g.box(
          x + a * (hx - 0.18),
          0.09,
          z + b * hz,
          0.43,
          0.025,
          0.07,
          "#286f63",
          cell,
        );
        g.box(
          x + a * hx,
          0.09,
          z + b * (hz - 0.18),
          0.07,
          0.025,
          0.43,
          "#286f63",
          cell,
        );
      }
    return g.polys;
  }
  function depthRenderer(staticFaces) {
    const surface = document.createElement("canvas");
    let gl;
    try {
      gl = surface.getContext("webgl", {
        alpha: true,
        antialias: true,
        depth: true,
      });
    } catch {
      return null;
    }
    if (!gl) return null;
    function make(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    const vs = make(
      gl.VERTEX_SHADER,
      "attribute vec3 p;attribute vec3 c;uniform vec3 eye;uniform vec3 right;uniform vec3 up;uniform vec3 front;uniform vec2 scale;varying vec3 tint;void main(){vec3 d=p-eye;float z=dot(d,front);gl_Position=vec4(scale.x*dot(d,right),scale.y*dot(d,up),z-0.48,z);tint=c;}",
    );
    const fs = make(
      gl.FRAGMENT_SHADER,
      "precision mediump float;varying vec3 tint;void main(){gl_FragColor=vec4(tint,1.0);}",
    );
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    const fixed = gl.createBuffer(),
      variable = gl.createBuffer(),
      P = gl.getAttribLocation(program, "p"),
      C = gl.getAttribLocation(program, "c");
    const uniforms = Object.fromEntries(
      ["eye", "right", "up", "front", "scale"].map((k) => [
        k,
        gl.getUniformLocation(program, k),
      ]),
    );
    function mesh(faces) {
      const count = faces.reduce((n, f) => n + 3 * (f.pts.length - 2), 0),
        data = new Float32Array(count * 6);
      let i = 0;
      for (const f of faces)
        for (let j = 1; j < f.pts.length - 1; j++)
          for (const v of [f.pts[0], f.pts[j], f.pts[j + 1]]) {
            data[i++] = v[0];
            data[i++] = v[1];
            data[i++] = v[2];
            data[i++] = f.col[0];
            data[i++] = f.col[1];
            data[i++] = f.col[2];
          }
      return data;
    }
    let staticCount = 0;
    function install(faces) {
      const data = mesh(faces);
      staticCount = data.length / 6;
      gl.bindBuffer(gl.ARRAY_BUFFER, fixed);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    }
    install(staticFaces);
    function drawBuffer(buffer, count) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(P);
      gl.vertexAttribPointer(P, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(C);
      gl.vertexAttribPointer(C, 3, gl.FLOAT, false, 24, 12);
      gl.drawArrays(gl.TRIANGLES, 0, count);
    }
    return {
      install,
      render(ctx, cam, faces, w, h, dpr) {
        if (gl.isContextLost()) return false;
        const W = Math.round(w * dpr),
          H = Math.round(h * dpr);
        if (surface.width !== W || surface.height !== H) {
          surface.width = W;
          surface.height = H;
        }
        gl.viewport(0, 0, W, H);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.useProgram(program);
        for (const key of ["eye", "right", "up", "front"])
          gl.uniform3fv(uniforms[key], cam[key]);
        gl.uniform2f(uniforms.scale, (cam.focal * 2) / w, (cam.focal * 2) / h);
        drawBuffer(fixed, staticCount);
        const data = mesh(faces);
        gl.bindBuffer(gl.ARRAY_BUFFER, variable);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
        drawBuffer(variable, data.length / 6);
        ctx.drawImage(surface, 0, 0, w, h);
        return true;
      },
      destroy() {
        gl.deleteBuffer(fixed);
        gl.deleteBuffer(variable);
        gl.deleteProgram(program);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      },
    };
  }
  const cameras = {
    overview: { centre: [0, -0.32, 0], yaw: -0.42, pitch: 0.7, d: 29.0 },
    top: { centre: [0, 0.15, 0], yaw: 0, pitch: 1.47, d: 25.5 },
    detail: { centre: [0, 0.77, 0], yaw: -0.36, pitch: 0.77, d: 6.8 },
  };
  function mount(canvas, onPlot) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("The site viewer needs a canvas.");
    const original = {
      label: canvas.getAttribute("aria-label"),
      tab: canvas.getAttribute("tabindex"),
      description: canvas.getAttribute("aria-description"),
      touch: canvas.style.touchAction,
      cursor: canvas.style.cursor,
    };
    if (!canvas.hasAttribute("tabindex")) canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      (original.label || "Interactive construction site.") +
        " Drag to orbit and pinch or scroll to zoom. Arrow keys focus neighbouring plots. Shift and arrow keys orbit, plus and minus zoom, and Home resets the camera. Press Enter to select the current plot.",
    );
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    let site = normalise({}),
      fixed = model(site),
      signature = JSON.stringify(site);
    const gpu = depthRenderer(fixed),
      removers = [],
      fingers = new Map();
    let cam = { ...cameras.overview },
      basis = null,
      preset = "overview",
      request = 0,
      w = 1,
      h = 1,
      lastPolys = [],
      selected = null,
      drag = false,
      start = null,
      disposed = false,
      plotLabels = [];
    const on = (obj, id, fn, opts) => {
      obj.addEventListener(id, fn, opts);
      removers.push(() => obj.removeEventListener(id, fn, opts));
    };
    function project(p) {
      const [x, y, z] = p.map((v, i) => v - basis.eye[i]),
        d = x * basis.front[0] + y * basis.front[1] + z * basis.front[2];
      if (d < 0.25) return null;
      return [
        w * 0.5 + (basis.focal * (x * basis.right[0] + z * basis.right[2])) / d,
        h * 0.5 -
          (basis.focal *
            (x * basis.up[0] + y * basis.up[1] + z * basis.up[2])) /
            d,
        d,
      ];
    }
    function polygons2d(polys) {
      const out = [];
      for (const p of polys) {
        const pts = p.pts.map(project);
        if (!pts.every(Boolean)) continue;
        const maxY = Math.max(...p.pts.map((v) => v[1]));
        // A single slab face spans the whole scene. Draw it before local objects
        // even when its centre is closer to the camera than rear equipment.
        const layer =
          maxY <= 0
            ? -5
            : maxY <= 0.012
              ? -4
              : maxY <= 0.021
                ? -3
                : maxY <= 0.04
                  ? -2
                  : maxY <= 0.115
                    ? -1
                    : 0;
        out.push({
          pts,
          col: p.col,
          id: p.id,
          layer,
          depth: pts.reduce((a, b) => a + b[2], 0) / pts.length,
        });
      }
      return out;
    }
    // A plot behind an enclosed building must not be labelled on the building's roof.
    function blocked(target, buildings, current) {
      const vector = target.map((v, i) => v - basis.eye[i]);
      return buildings.some(([key, b]) => {
        if (b.cell === current || b.level < 2) return false;
        const [x, z] = centre(b.cell),
          d = catalogue[key],
          turn = Math.abs(Math.sin(orientation(site, key))) > 0.5;
        const halfX = (turn ? d.depth : d.width) / 2,
          halfZ = (turn ? d.width : d.depth) / 2;
        const lo = [x - halfX, 0.23, z - halfZ],
          hi = [x + halfX, d.height + 0.53, z + halfZ];
        let entry = 0,
          exit = 1;
        for (let axis = 0; axis < 3; axis++) {
          if (Math.abs(vector[axis]) < 0.000001) {
            if (basis.eye[axis] < lo[axis] || basis.eye[axis] > hi[axis])
              return false;
            continue;
          }
          const a = (lo[axis] - basis.eye[axis]) / vector[axis],
            b = (hi[axis] - basis.eye[axis]) / vector[axis];
          entry = Math.max(entry, Math.min(a, b));
          exit = Math.min(exit, Math.max(a, b));
          if (entry > exit) return false;
        }
        return entry < 0.992 && exit > 0;
      });
    }
    function labels() {
      plotLabels = [];
      const compact = w < 510 && preset !== "detail";
      const font = compact ? 9 : 11;
      const buildings = Object.entries(site.buildings);
      for (let c = 0; c < 24; c++) {
        const [x, z] = centre(c),
          match = buildings.find(([, b]) => b.cell === c),
          focus = c === selected;
        if (preset === "detail") continue;
        const d = match ? catalogue[match[0]] : null;
        const labelY = match
          ? [0.25, 0.3, d.height + 0.5, d.height + 0.66][match[1].level]
          : 0.12;
        const point = [x, labelY, z];
        if (blocked(point, buildings, c)) continue;
        const anchor = project(point);
        if (
          !anchor ||
          anchor[0] < 4 ||
          anchor[0] > w - 4 ||
          anchor[1] < 4 ||
          anchor[1] > h - 8
        )
          continue;
        // Put the address on its plot and keep only one long building label visible.
        const label = code(c),
          tw = compact ? 18 : 24,
          th = compact ? 13 : 17;
        const left = clamp(anchor[0] - tw / 2, 2, w - tw - 2),
          top = clamp(anchor[1] - th * 0.25, 2, h - th - 2);
        ctx.beginPath();
        ctx.roundRect(left, top, tw, th, 3);
        ctx.fillStyle = focus ? "#1c5f53" : match ? "#eef3e7" : "#e8efda";
        ctx.fill();
        ctx.strokeStyle = focus ? "#1c5f53" : match ? "#80968a" : "#a4b692";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = focus ? "#fff" : "#374a3d";
        ctx.font = "600 " + font + "px Consolas,monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, left + tw / 2, top + th / 2);
        plotLabels.push({ x: left, y: top, w: tw, h: th, cell: c });
      }
      if (validCell(selected)) {
        const [x, z] = centre(selected),
          match = buildings.find(([, b]) => b.cell === selected);
        const text = match
          ? catalogue[match[0]].name +
            " / " +
            ["Set-out", "Foundation", "Steel frame", "Enclosed"][match[1].level]
          : site.surveyPlan.reserve.includes(selected)
            ? "Flood reserve"
            : site.surveyPlan.entrance === selected
              ? "Road entrance"
              : site.roads.outbound === selected
                ? "Dispatch apron"
                : site.roads.receiving === selected
                  ? "Receiving apron"
                  : "Available plot";
        const height = match
          ? [
              0.27,
              0.4,
              catalogue[match[0]].height + 0.48,
              catalogue[match[0]].height + 0.68,
            ][match[1].level]
          : 0.14;
        const pt = project([x, height, z]);
        if (pt && pt[0] > 0 && pt[0] < w && pt[1] > 0 && pt[1] < h) {
          ctx.font = "600 11px Consolas,monospace";
          const msg = code(selected) + " / " + text;
          const bw = Math.min(w - 12, ctx.measureText(msg).width + 16),
            bh = 22;
          const left = clamp(pt[0] - bw / 2, 5, w - bw - 5),
            top = clamp(pt[1] - 39, 5, h - bh - 5);
          ctx.strokeStyle = "#355e4e";
          ctx.beginPath();
          ctx.moveTo(clamp(pt[0], left + 3, left + bw - 3), top + bh);
          ctx.lineTo(pt[0], pt[1]);
          ctx.stroke();
          ctx.beginPath();
          ctx.roundRect(left, top, bw, bh, 5);
          ctx.fillStyle = "#285746";
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(msg, left + bw / 2, top + bh / 2, bw - 9);
        }
      }
      if (preset === "detail" && validCell(selected)) {
        for (const link of site.links.filter((l) =>
          ["process heat", "instrument air"].includes(l.service.toLowerCase()),
        )) {
          const key =
            site.buildings[link.from].cell === selected
              ? "from"
              : site.buildings[link.to].cell === selected
                ? "to"
                : null;
          if (!key) continue;
          const socket = serviceSocket(site, link, key),
            pt = project([socket[0], 0.51, socket[1]]);
          if (!pt || pt[0] < 8 || pt[0] > w - 8 || pt[1] < 25 || pt[1] > h - 8)
            continue;
          const isHeat = link.service.toLowerCase() === "process heat",
            bg = utilityColour(link.service);
          const x = clamp(pt[0] + (isHeat ? -24 : 24), 24, w - 24),
            y = clamp(pt[1] + (isHeat ? 20 : 39), 19, h - 12);
          const text = link[key + "Port"] || link.service;
          ctx.font = "600 10px Consolas,monospace";
          const tw = ctx.measureText(text).width + 11;
          ctx.strokeStyle = bg;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(pt[0], pt[1]);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.roundRect(x - tw / 2, y - 8, tw, 16, 3);
          ctx.fillStyle = bg;
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, x, y);
        }
      }
      if (w >= 295) {
        const dir = [-basis.right[2], basis.up[2]],
          length = Math.hypot(...dir) || 1;
        const n = dir.map((v) => v / length),
          x = w - 22,
          y = 26;
        ctx.strokeStyle = "#426355";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 6 * n[0], y - 6 * n[1]);
        ctx.lineTo(x + 8 * n[0], y + 8 * n[1]);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 10 * n[0], y + 10 * n[1]);
        ctx.lineTo(x + 4 * n[0] - 3 * n[1], y + 4 * n[1] + 3 * n[0]);
        ctx.lineTo(x + 4 * n[0] + 3 * n[1], y + 4 * n[1] - 3 * n[0]);
        ctx.closePath();
        ctx.fillStyle = "#426355";
        ctx.fill();
        ctx.font = "600 10px Consolas,monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("N", x + 17 * n[0], y + 17 * n[1]);
      }
      const unique = [...new Set(site.links.map((l) => l.service))];
      let x = 8,
        y = 8;
      for (const service of unique) {
        ctx.font = "600 10px Consolas,monospace";
        const text = service.replace(/[-_]/g, " "),
          bw = ctx.measureText(text).width + 25;
        if (x + bw > w - 47) {
          x = 8;
          y += 19;
        }
        ctx.fillStyle = "#eef5eaf0";
        ctx.beginPath();
        ctx.roundRect(x, y, bw, 16, 3);
        ctx.fill();
        ctx.fillStyle = utilityColour(service);
        ctx.fillRect(x + 4, y + 6, 10, 4);
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "#374e41";
        ctx.fillText(text, x + 17, y + 8);
        x += bw + 4;
      }
    }
    function paint() {
      request = 0;
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (
        canvas.width !== Math.round(w * dpr) ||
        canvas.height !== Math.round(h * dpr)
      ) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sy = Math.sin(cam.yaw),
        cy = Math.cos(cam.yaw),
        sp = Math.sin(cam.pitch),
        cp = Math.cos(cam.pitch);
      basis = {
        right: [cy, 0, -sy],
        front: [-sy * cp, -sp, -cy * cp],
        up: [-sy * sp, cp, -cy * sp],
        focal:
          preset === "detail"
            ? Math.min(h * 1.3, w * 1.1)
            : Math.min(h * 1.48, w * 0.92),
      };
      if (preset !== "detail") {
        // Fit the complete land parcel at the default zoom. Use the preset
        // distance here so an intentional wheel zoom can still crop the site.
        const reference = cameras[preset].d;
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        for (const x of [-X - 1.14, X + 1.14])
          for (const z of [-Z - 1.15, Z + 1.15])
            for (const y of [-0.6, 1.48]) {
              const q = [
                x - cam.centre[0],
                y - cam.centre[1],
                z - cam.centre[2],
              ];
              const depth = reference + dot(q, basis.front);
              const fx =
                ((w * 0.5 - 10) * depth) /
                Math.max(0.001, Math.abs(dot(q, basis.right)));
              const fy =
                ((h * 0.5 - 12) * depth) /
                Math.max(0.001, Math.abs(dot(q, basis.up)));
              basis.focal = Math.min(
                basis.focal,
                Math.max(1, fx),
                Math.max(1, fy),
              );
            }
      }
      basis.eye = cam.centre.map((v, i) => v - basis.front[i] * cam.d);
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#f2f9f6");
      bg.addColorStop(1, "#dbe9e3");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      lastPolys = selection(selected);
      if (!gpu?.render(ctx, basis, lastPolys, w, h, dpr)) {
        const paths = polygons2d(fixed.concat(lastPolys)).sort(
          (a, b) => a.layer - b.layer || b.depth - a.depth,
        );
        for (const p of paths) {
          ctx.beginPath();
          ctx.moveTo(p.pts[0][0], p.pts[0][1]);
          for (let i = 1; i < p.pts.length; i++)
            ctx.lineTo(p.pts[i][0], p.pts[i][1]);
          ctx.closePath();
          ctx.fillStyle = css(p.col);
          ctx.fill();
        }
      }
      labels();
    }
    function queue() {
      if (!disposed && !request) request = requestAnimationFrame(paint);
    }
    function camera(name) {
      preset = Object.hasOwn(cameras, name) ? name : "overview";
      cam = { ...cameras[preset] };
      if (preset === "detail") {
        const [x, z] = centre(selected ?? 8);
        cam.centre = [x, 0.77, z];
        const key = Object.keys(site.buildings).find(
          (id) => site.buildings[id].cell === (selected ?? 8),
        );
        if (key) cam.yaw += orientation(site, key);
      }
      queue();
    }
    function draw(nextSite, selectedCell) {
      const next = normalise(nextSite),
        nextSignature = JSON.stringify(next);
      if (nextSignature !== signature) {
        site = next;
        signature = nextSignature;
        fixed = model(site);
        gpu?.install(fixed);
      }
      const cell = validCell(selectedCell) ? selectedCell : null,
        changed = cell !== selected;
      selected = cell;
      if (preset === "detail" && changed) camera("detail");
      else queue();
    }
    function inspect(cell) {
      if (!validCell(cell)) return;
      selected = cell;
      if (preset === "detail") camera("detail");
      else queue();
      onPlot?.(cell);
    }
    function pick(x, y) {
      const label = plotLabels.find(
        (a) => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h,
      );
      if (label) return label.cell;
      if (!basis) return null;
      let nearest = Infinity,
        found = null;
      for (const poly of polygons2d(fixed.concat(lastPolys))) {
        const a = poly.pts[0];
        for (let i = 1; i + 1 < poly.pts.length; i++) {
          const b = poly.pts[i],
            c = poly.pts[i + 1],
            det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
          if (Math.abs(det) < 0.03) continue;
          const wa =
              ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det,
            wb =
              ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det,
            wc = 1 - wa - wb;
          if (wa < 0 || wb < 0 || wc < 0) continue;
          const d = 1 / (wa / a[2] + wb / b[2] + wc / c[2]);
          if (d < nearest) {
            nearest = d;
            found = poly.id;
          }
        }
      }
      if (validCell(found)) return found;
      // A click on an access road or service corridor still identifies its plot.
      const nx = (x - w / 2) / basis.focal,
        ny = (h / 2 - y) / basis.focal;
      const ray = basis.front.map(
        (v, i) => v + nx * basis.right[i] + ny * basis.up[i],
      );
      if (ray[1] >= 0) return null;
      const t = (0.02 - basis.eye[1]) / ray[1];
      if (t <= 0) return null;
      const col = Math.floor((basis.eye[0] + ray[0] * t + X) / dx),
        row = Math.floor((basis.eye[2] + ray[2] * t + Z) / dz);
      return col >= 0 && col < 6 && row >= 0 && row < 4 ? row * 6 + col : null;
    }
    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    function gesture() {
      const pts = [...fingers.values()];
      if (pts.length > 1) {
        drag = true;
        start = {
          span: Math.max(
            1,
            Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]),
          ),
          d: cam.d,
        };
      } else
        start = pts.length
          ? { p: pts[0], yaw: cam.yaw, pitch: cam.pitch }
          : null;
    }
    const zoom = (d) => {
      cam.d = clamp(d, preset === "detail" ? 3.0 : 13, 50);
      queue();
    };
    on(canvas, "pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!fingers.size) drag = false;
      fingers.set(e.pointerId, local(e));
      canvas.setPointerCapture(e.pointerId);
      canvas.focus({ preventScroll: true });
      canvas.style.cursor = "grabbing";
      gesture();
    });
    on(canvas, "pointermove", (e) => {
      if (!fingers.has(e.pointerId)) return;
      const p = local(e);
      fingers.set(e.pointerId, p);
      const pts = [...fingers.values()];
      if (start?.span && pts.length > 1) {
        zoom(
          (start.d * start.span) /
            Math.max(
              1,
              Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]),
            ),
        );
        return;
      }
      if (!start?.p) return;
      const dx = p[0] - start.p[0],
        dy = p[1] - start.p[1];
      if (Math.hypot(dx, dy) > 4) drag = true;
      if (drag) {
        cam.yaw = start.yaw - dx * 0.009;
        cam.pitch = clamp(start.pitch + dy * 0.006, 0.08, 1.49);
        queue();
      }
    });
    function end(e, cancelled) {
      if (!fingers.has(e.pointerId)) return;
      if (!cancelled && !drag && fingers.size === 1) inspect(pick(...local(e)));
      fingers.delete(e.pointerId);
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
      gesture();
      canvas.style.cursor = "grab";
    }
    on(canvas, "pointerup", (e) => end(e, false));
    on(canvas, "pointercancel", (e) => end(e, true));
    on(canvas, "lostpointercapture", (e) => end(e, true));
    on(
      canvas,
      "wheel",
      (e) => {
        e.preventDefault();
        zoom(cam.d * Math.exp(clamp(e.deltaY, -150, 150) * 0.002));
      },
      { passive: false },
    );
    on(canvas, "keydown", (e) => {
      const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      if (arrows.includes(e.key)) {
        if (e.shiftKey) {
          if (e.key === "ArrowLeft") cam.yaw -= 0.12;
          if (e.key === "ArrowRight") cam.yaw += 0.12;
          if (e.key === "ArrowUp")
            cam.pitch = clamp(cam.pitch + 0.095, 0.08, 1.49);
          if (e.key === "ArrowDown")
            cam.pitch = clamp(cam.pitch - 0.095, 0.08, 1.49);
        } else {
          const current = selected ?? 0;
          const next =
            e.key === "ArrowLeft"
              ? current - (current % 6 > 0 ? 1 : 0)
              : e.key === "ArrowRight"
                ? current + (current % 6 < 5 ? 1 : 0)
                : e.key === "ArrowUp"
                  ? Math.max(current % 6, current - 6)
                  : Math.min(18 + (current % 6), current + 6);
          selected = selected === null ? 0 : next;
          if (preset === "detail") camera("detail");
          canvas.setAttribute(
            "aria-description",
            "Focused plot " + code(selected) + ". Press Enter to select it.",
          );
        }
      } else if (e.key === "Enter" || e.key === " ") inspect(selected ?? 0);
      else if (e.key === "+" || e.key === "=") zoom(cam.d * 0.86);
      else if (e.key === "-") zoom(cam.d * 1.14);
      else if (e.key === "Home") camera("overview");
      else return;
      e.preventDefault();
      queue();
    });
    const observer = new ResizeObserver(queue);
    observer.observe(canvas);
    queue();
    return {
      draw,
      camera,
      destroy() {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(request);
        observer.disconnect();
        removers.forEach((f) => f());
        gpu?.destroy();
        fingers.clear();
        if (original.label === null) canvas.removeAttribute("aria-label");
        else canvas.setAttribute("aria-label", original.label);
        if (original.tab === null) canvas.removeAttribute("tabindex");
        else canvas.setAttribute("tabindex", original.tab);
        if (original.description === null)
          canvas.removeAttribute("aria-description");
        else canvas.setAttribute("aria-description", original.description);
        canvas.style.touchAction = original.touch;
        canvas.style.cursor = original.cursor;
      },
    };
  }
  window.SiteScene = Object.freeze({ mount });
})();
