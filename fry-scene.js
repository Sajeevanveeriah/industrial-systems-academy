(() => {
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
  const names = [
    "Receiving hopper",
    "Rotary washer",
    "Peeler",
    "Strip cutter",
    "Blancher",
    "Air dryer",
    "Fryer",
    "Freezing tunnel",
    "Weigher and bagger",
    "Dispatch dock",
  ];
  const material = [
    "Field potatoes",
    "Washed potatoes",
    "Peeled potatoes",
    "Raw strips",
    "Blanched strips",
    "Dried strips",
    "Golden fries",
    "Frozen fries",
    "Bagged fries in cartons",
    "Palletised cartons",
  ];
  const hues = [
    "#aa7347",
    "#419ba5",
    "#49927a",
    "#647f91",
    "#529eaf",
    "#62959a",
    "#be8741",
    "#619eb6",
    "#65937a",
    "#956d48",
  ];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    mix = (a, b, t) => a + (b - a) * t;
  const deck = 1.12,
    spacing = 3.24,
    row = 2.08;
  const stations = stages.map((_, i) => [
    spacing * ((i < 5 ? i : 9 - i) - 2),
    i < 5 ? -row : row,
  ]);
  const floorBounds = [-8.5, 8.8, -3.65, 3.75];
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
  function geometry() {
    const polys = [];
    function face(points, col, id = null) {
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
  const steel = "#b4c7c7",
    dark = "#405763",
    silver = "#d9e2de",
    blue = "#568c94",
    amber = "#e4ac50";
  function kit(g, i) {
    const [cx, cz] = stations[i],
      dir = i < 5 ? 1 : -1;
    function point(a, y, b) {
      return [cx + dir * a, y, cz + b];
    }
    function box(a, y, b, w, h, d, col, angle = 0) {
      g.box(...point(a, y, b), w, h, d, col, i, angle * dir);
    }
    function tube(a, y, b, r, h, col, n = 14) {
      g.cylinder(...point(a, y, b), r, h, col, i, n);
    }
    function plate(pts, col) {
      const v = pts.map(([a, y, b]) => point(a, y, b));
      g.face(dir < 0 ? v.reverse() : v, col, i);
    }
    // Cross-sections of horizontal drums. A cutaway sector shows material inside.
    function drum(
      x,
      y,
      z,
      length,
      r,
      colour,
      { open = false, angle = 0, sectors = 16 } = {},
    ) {
      for (let j = 0; j < sectors; j++) {
        const a = (j * 2 * Math.PI) / sectors + angle,
          b = ((j + 1) * 2 * Math.PI) / sectors + angle;
        if (
          open &&
          Math.cos((a + b) / 2) > 0.06 &&
          Math.sin((a + b) / 2) > -0.44
        )
          continue;
        const q = (end, t) => [
          x + (end * length) / 2,
          y + r * Math.cos(t),
          z + r * Math.sin(t),
        ];
        plate([q(-1, a), q(-1, b), q(1, b), q(1, a)], colour);
      }
    }
    function legs(w = 1.82, d = 1.1, h = 0.83) {
      for (const a of [-w / 2, w / 2])
        for (const b of [-d / 2, d / 2]) {
          box(a, 0.022, b, 0.17, 0.05, 0.17, dark);
          box(a, 0.072, b, 0.075, h - 0.072, 0.075, steel);
        }
      box(0, 0.28, -d / 2, w, 0.07, 0.05, steel);
      box(0, 0.28, d / 2, w, 0.07, 0.05, steel);
    }
    function motor(x, y, b, col = blue) {
      box(x, y, b, 0.35, 0.28, 0.37, col);
      for (let j = 0; j < 4; j++)
        box(x - 0.13 + j * 0.086, y + 0.025, b, 0.034, 0.25, 0.4, dark);
    }
    function consolePanel(x, y, b) {
      box(x, y, b, 0.39, 0.32, 0.12, silver);
      box(x, y + 0.11, b + 0.069, 0.28, 0.13, 0.025, "#384d55");
      box(x, y + 0.134, b + 0.087, 0.21, 0.06, 0.015, "#88bfb2");
      box(x - 0.09, y + 0.045, b + 0.075, 0.055, 0.052, 0.024, "#bf6047");
      box(x + 0.08, y + 0.045, b + 0.075, 0.055, 0.052, 0.024, "#599879");
    }
    function tank(x, y, z, w, h, d, water, wall) {
      box(x, y, z, w, 0.095, d, wall);
      for (const side of [-1, 1])
        box(x, y + 0.085, z + side * (d / 2 - 0.035), w, h, 0.07, wall);
      for (const side of [-1, 1])
        box(
          x + side * (w / 2 - 0.045),
          y + 0.11,
          z,
          0.09,
          h - 0.13,
          d - 0.11,
          wall,
        );
      box(x, y + h - 0.07, z, w - 0.14, 0.025, d - 0.15, water);
      for (const side of [-1, 1])
        box(
          x,
          y + h + 0.07,
          z + side * (d / 2 - 0.035),
          w + 0.04,
          0.055,
          0.09,
          silver,
        );
    }
    return { point, box, tube, plate, drum, legs, motor, consolePanel, tank };
  }
  function machine(g, i) {
    const { box, tube, plate, drum, legs, motor, consolePanel, tank } = kit(
        g,
        i,
      ),
      colour = hues[i];
    if (i === 0) {
      // A tilted bulk tipper feeds the tapered open receiving hopper.
      legs(1.74, 1.22, 0.68);
      box(-0.61, 0.41, -0.4, 1.37, 0.15, 0.78, dark);
      for (const a of [-1.12, -0.23])
        for (const b of [-0.77, -0.04]) {
          box(a, 0.16, b, 0.29, 0.35, 0.15, "#42545b");
          box(a, 0.25, b + 0.04, 0.14, 0.13, 0.14, steel);
        }
      const profile = [
        [-1.42, 1.68],
        [-0.17, 1.22],
        [-0.11, 1.49],
        [-1.37, 2.12],
      ];
      for (const b of [-0.96, -0.09])
        plate(
          profile.map(([a, y]) => [a, y, b]),
          "#c58d57",
        );
      plate(
        [
          [-1.42, 1.68, -0.96],
          [-1.42, 1.68, -0.09],
          [-0.17, 1.22, -0.09],
          [-0.17, 1.22, -0.96],
        ],
        "#b68953",
      );
      plate(
        [
          [-1.37, 2.12, -0.96],
          [-1.37, 2.12, -0.09],
          [-1.42, 1.68, -0.09],
          [-1.42, 1.68, -0.96],
        ],
        "#cb9d67",
      );
      const outer = [
        [-0.46, -0.61],
        [0.83, -0.61],
        [0.83, 0.63],
        [-0.46, 0.63],
      ];
      for (let j = 0; j < 4; j++) {
        const p = outer[j],
          q = outer[(j + 1) % 4];
        plate(
          [
            [p[0], 1.6, p[1]],
            [q[0], 1.6, q[1]],
            [q[0] * 0.48 + 0.16, 0.87, q[1] * 0.46],
            [p[0] * 0.48 + 0.16, 0.87, p[1] * 0.46],
          ],
          silver,
        );
      }
      box(0.2, 0.76, 0, 0.68, 0.19, 0.63, colour);
      motor(0.68, 0.57, 0.46);
      consolePanel(0.65, 0.85, 0.68);
    } else if (i === 1) {
      legs();
      tank(0, 0.6, 0, 2.16, 0.49, 1.12, "#68b9bf", steel);
      drum(0, 1.26, -0.04, 1.7, 0.52, "#86b5b6", { open: true });
      for (const a of [-0.83, -0.32, 0.32, 0.83])
        drum(a, 1.26, -0.04, 0.055, 0.545, "#71979a");
      // Longitudinal ribs and the open hoop ends expose the rotating wash drum.
      for (const theta of [-1.1, -0.5, 0.98, 1.58, 2.2]) {
        box(
          0,
          1.26 + 0.51 * Math.cos(theta),
          -0.04 + 0.51 * Math.sin(theta),
          1.7,
          0.033,
          0.043,
          silver,
        );
      }
      for (let j = 0; j < 5; j++)
        box(-0.72 + j * 0.35, 1.89, -0.13, 0.065, 0.105, 0.065, blue);
      box(0, 2.0, -0.13, 1.85, 0.07, 0.072, blue);
      for (const a of [-0.86, 0.86])
        box(a, 0.99, -0.57, 0.064, 1.04, 0.075, silver);
      motor(0.76, 0.69, 0.63);
      consolePanel(-0.48, 0.8, 0.63);
    } else if (i === 2) {
      legs(1.68, 1.03, 0.73);
      tube(0, 0.56, 0, 0.57, 0.16, dark);
      tube(0, 0.72, 0, 0.68, 0.46, "#85a79d", 18);
      for (let j = 0; j < 12; j++) {
        const a = (j * 2 * Math.PI) / 12;
        if (Math.sin(a) > 0.36) continue;
        tube(
          0.57 * Math.cos(a),
          1.17,
          0.57 * Math.sin(a),
          0.099,
          0.5,
          silver,
          8,
        );
      }
      box(0, 1.14, -0.5, 1.26, 0.35, 0.17, steel);
      box(0.38, 1.51, -0.45, 0.47, 0.2, 0.37, "#83aa9d");
      motor(-0.62, 0.66, 0.17);
      box(-0.77, 0.94, 0, 0.53, 0.16, 0.57, steel);
      box(0.78, 0.94, 0, 0.53, 0.16, 0.57, steel);
      consolePanel(0.45, 0.82, 0.61);
    } else if (i === 3) {
      legs();
      box(0, 0.65, 0, 1.98, 0.36, 0.99, steel);
      box(0, 1.005, 0, 1.86, 0.08, 0.72, "#789295");
      for (const s of [-1, 1]) box(0, 1.0, s * 0.49, 1.83, 0.13, 0.075, colour);
      for (const s of [-1, 1])
        box(0.02, 1.04, s * 0.42, 0.12, 0.67, 0.075, dark);
      box(0.02, 1.68, 0, 0.16, 0.095, 0.91, amber);
      for (let j = 0; j < 6; j++)
        box(0.02, 1.11, -0.34 + j * 0.135, 0.033, 0.5, 0.022, silver);
      for (let j = 0; j < 4; j++)
        box(0.019, 1.16 + j * 0.12, 0, 0.04, 0.02, 0.77, silver);
      box(-0.56, 1.13, -0.27, 0.55, 0.24, 0.3, silver);
      motor(0.69, 0.76, 0.57);
      consolePanel(-0.7, 0.82, 0.53);
    } else if (i === 4) {
      legs(1.74, 1.2, 0.7);
      tank(0, 0.67, 0, 2.13, 0.49, 1.19, "#80c4c7", steel);
      for (const a of [-0.55, 0.5]) {
        box(a, 1.15, -0.55, 0.11, 0.59, 0.1, silver);
        box(a, 1.71, -0.18, 0.115, 0.076, 0.76, silver);
        tube(a, 1.55, -0.56, 0.1, 0.24, colour);
      }
      tube(0.82, 0.16, -0.76, 0.17, 1.39, blue);
      tube(0.82, 1.5, -0.76, 0.24, 0.11, silver);
      motor(-0.76, 0.67, 0.66);
      consolePanel(0.43, 0.8, 0.67);
    } else if (i === 5) {
      legs();
      box(0, 0.92, 0, 2.12, 0.17, 1.06, steel);
      for (let j = 0; j < 10; j++)
        box(-0.91 + j * 0.2, 1.092, 0, 0.058, 0.019, 0.83, blue);
      for (const a of [-0.78, 0.78]) box(a, 0.78, -0.5, 0.14, 1.1, 0.14, dark);
      box(0, 1.81, -0.3, 1.94, 0.36, 0.65, steel);
      for (const a of [-0.59, 0, 0.59]) {
        tube(a, 2.17, -0.31, 0.24, 0.1, blue);
        tube(a, 2.27, -0.31, 0.15, 0.03, dark);
        box(a, 1.51, -0.26, 0.28, 0.31, 0.24, blue);
      }
      consolePanel(-0.67, 0.8, 0.56);
    } else if (i === 6) {
      legs(1.84, 1.14, 0.68);
      tank(0, 0.64, 0, 2.2, 0.55, 1.24, "#d6a44e", "#b8b090");
      box(-0.06, 1.71, -0.4, 1.48, 0.2, 0.62, silver);
      box(-0.06, 1.91, -0.4, 1.0, 0.18, 0.47, steel);
      for (const a of [-0.43, 0.36]) {
        tube(a, 2.09, -0.4, 0.16, 0.57, steel);
        tube(a, 2.64, -0.4, 0.2, 0.065, dark);
      }
      for (const a of [-0.76, 0.65])
        box(a, 1.22, -0.59, 0.085, 0.5, 0.09, steel);
      for (let j = 0; j < 4; j++)
        box(-0.7 + j * 0.25, 0.83, 0.64, 0.15, 0.045, 0.04, amber);
      consolePanel(0.64, 0.82, 0.67);
      motor(-0.78, 0.48, -0.43);
    } else if (i === 7) {
      legs(1.78, 1.12, 0.64);
      box(0, 0.67, 0, 2.18, 0.43, 1.25, "#a8c0c9");
      box(0, 1.11, -0.58, 2.06, 1.02, 0.12, "#abd0d5");
      box(0, 1.96, -0.28, 2.22, 0.16, 0.77, "#dbebec");
      for (const a of [-0.74, 0, 0.74]) {
        box(a, 1.11, 0.53, 0.08, 0.97, 0.085, blue);
        tube(a, 2.12, -0.3, 0.24, 0.09, blue);
        tube(a, 2.215, -0.3, 0.162, 0.022, dark);
        for (let n = 0; n < 3; n++)
          box(
            a + 0.065 * Math.cos(n * 2.09),
            2.24,
            -0.3 + 0.065 * Math.sin(n * 2.09),
            0.16,
            0.017,
            0.046,
            steel,
            n * 2.09,
          );
      }
      for (let j = 0; j < 5; j++)
        box(-0.82 + j * 0.19, 0.81, 0.647, 0.07, 0.17, 0.018, blue);
      consolePanel(0.61, 0.79, 0.655);
    } else if (i === 8) {
      legs(1.77, 1.09, 0.68);
      box(0, 0.77, 0, 2.1, 0.32, 1.08, steel);
      for (const a of [-0.73, 0.73])
        for (const b of [-0.5, 0.5]) box(a, 1.05, b, 0.08, 1.17, 0.09, dark);
      box(0, 2.2, 0, 1.77, 0.13, 1.17, silver);
      tube(-0.15, 2.34, -0.2, 0.19, 0.4, silver, 16);
      for (let bin = 0; bin < 8; bin++) {
        const a = (bin * Math.PI) / 4;
        box(
          -0.15 + 0.3 * Math.cos(a),
          2.35,
          -0.2 + 0.3 * Math.sin(a),
          0.24,
          0.21,
          0.19,
          "#9fb6ad",
          a,
        );
      }
      tube(-0.15, 2.65, -0.2, 0.17, 0.15, steel, 14);
      box(-0.15, 1.78, -0.13, 0.42, 0.4, 0.4, silver);
      for (const a of [-0.4, 0.4]) box(a, 1.57, 0, 0.15, 0.12, 0.7, colour);
      box(0.68, 1.6, 0.59, 0.42, 0.49, 0.1, steel);
      consolePanel(0.68, 1.68, 0.66);
      motor(0.74, 0.73, -0.62);
    } else {
      box(0, 0.03, 0, 2.57, 0.36, 1.74, "#91a39d");
      box(0, 0.38, 0, 2.62, 0.07, 1.79, "#bec9bd");
      for (const b of [-0.48, 0, 0.48])
        box(0.27, 0.45, b, 1.13, 0.12, 0.12, "#a17e51");
      for (let j = 0; j < 6; j++)
        box(-0.23 + j * 0.19, 0.57, 0, 0.15, 0.075, 1.18, "#d3ae75");
      for (const a of [-1.02, 1.02]) {
        box(a, 0.48, -0.88, 0.12, 1.9, 0.15, dark);
        tube(a, 0.47, 0.83, 0.085, 0.64, amber);
      }
      box(0, 0.44, -0.94, 2.27, 2.05, 0.13, "#a0afaa");
      for (let j = 0; j < 10; j++)
        box(0, 0.55 + j * 0.17, -0.855, 1.88, 0.035, 0.025, steel);
      box(0, 2.45, -0.86, 2.5, 0.16, 0.36, silver);
    }
  }
  const bendX = 8.15;
  const fullInstall = Array(10).fill(true);
  function linkRoute(i) {
    const a = stations[i],
      b = stations[i + 1];
    return i === 4 ? [a, [bendX, a[1]], [bendX, b[1]], b] : [a, b];
  }
  function pointAlong(points, t) {
    const lengths = points
      .slice(1)
      .map((v, i) => Math.hypot(v[0] - points[i][0], v[1] - points[i][1]));
    let rest = clamp(t, 0, 1) * lengths.reduce((n, v) => n + v, 0);
    for (let j = 0; j < lengths.length; j++) {
      if (rest <= lengths[j] || j === lengths.length - 1) {
        const f = clamp(rest / lengths[j], 0, 1);
        return [
          mix(points[j][0], points[j + 1][0], f),
          mix(points[j][1], points[j + 1][1], f),
        ];
      }
      rest -= lengths[j];
    }
  }
  function lotPosition(index, p) {
    let horizontal;
    if (p <= 0.5) {
      if (index === 0)
        horizontal = pointAlong(
          [[stations[0][0] - 1.2, stations[0][1] - 0.53], stations[0]],
          p * 2,
        );
      else horizontal = pointAlong(linkRoute(index - 1), 0.5 + p);
    } else if (index === 9)
      horizontal = pointAlong(
        [stations[9], [stations[9][0] - 0.26, stations[9][1]]],
        (p - 0.5) * 2,
      );
    else horizontal = pointAlong(linkRoute(index), p - 0.5);
    let y = deck + 0.025;
    if (index === 0)
      y += p <= 0.5 ? mix(0.68, 0.42, p * 2) : mix(0.42, 0, (p - 0.5) * 2);
    if (index === 9) y -= 0.49 * clamp((p - 0.25) / 0.25, 0, 1);
    if (index === 1 || index === 2 || index === 4 || index === 6)
      y += Math.sin(Math.PI * p) * 0.08;
    return [horizontal[0], y, horizontal[1]];
  }
  function plant(installed) {
    const g = geometry(),
      [xmin, xmax, zmin, zmax] = floorBounds;
    g.box(
      (xmin + xmax) / 2,
      -0.14,
      (zmin + zmax) / 2,
      xmax - xmin,
      0.13,
      zmax - zmin,
      "#c3d1cb",
    );
    for (let x = Math.ceil(xmin); x < xmax; x++)
      g.box(x, -0.009, 0.05, 0.012, 0.006, zmax - zmin, "#a8bbb4");
    for (let z = Math.ceil(zmin); z < zmax; z++)
      g.box(0.15, -0.009, z, xmax - xmin, 0.006, 0.012, "#a8bbb4");
    for (const side of [-1, 1])
      g.box(0, 0.001, side * 0.56, 15.6, 0.008, 0.035, "#d3ae62");
    for (let i = 0; i < 10; i++) {
      const [x, z] = stations[i],
        dir = i < 5 ? 1 : -1;
      g.box(
        x,
        0.002,
        z,
        2.94,
        0.018,
        2.03,
        installed[i] ? "#afc6ba" : "#d0dcd3",
        i,
      );
      if (installed[i]) {
        g.box(x + 0.075, 0.022, z - 0.06, 2.31, 0.008, 1.39, "#9fb5aa", i);
        machine(g, i);
        // Painted side rails carry each machine's identification colour.
        if (i !== 0 && i !== 9) {
          const k = kit(g, i);
          k.box(0, 0.76, 0.606, 1.26, 0.059, 0.034, hues[i]);
          for (const a of [-0.66, 0.66])
            k.box(a, 0.749, 0.609, 0.035, 0.08, 0.04, dark);
        }
      } else {
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) {
            g.box(
              x + sx * 1.15,
              0.024,
              z + sz * 0.82,
              0.33,
              0.042,
              0.044,
              hues[i],
              i,
            );
            g.box(
              x + sx * 1.3,
              0.024,
              z + sz * 0.69,
              0.045,
              0.042,
              0.3,
              hues[i],
              i,
            );
          }
        g.box(x, 0.034, z, 1.2, 0.045, 0.74, "#becfc5", i);
      }
      if (i === 9) continue;
      const route = linkRoute(i);
      const pts = [...route];
      pts[0] = [x + dir * 0.98, z];
      const [nx, nz] = stations[i + 1];
      pts[pts.length - 1] = [nx - (i + 1 < 5 ? 1 : -1) * 0.98, nz];
      for (let j = 0; j < pts.length - 1; j++) {
        const a = pts[j],
          b = pts[j + 1],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          length = Math.hypot(dx, dz),
          ox = -dz / length,
          oz = dx / length;
        g.beam(a, b, 0.94, 0.67, 0.14, installed[i] ? "#738d90" : "#adbfb9", i);
        for (const side of [-1, 1]) {
          const r1 = [a[0] + ox * side * 0.35, a[1] + oz * side * 0.35],
            r2 = [b[0] + ox * side * 0.35, b[1] + oz * side * 0.35];
          g.beam(r1, r2, 1.045, 0.048, 0.082, steel, i);
          g.box(
            (r1[0] + r2[0]) / 2,
            0.03,
            (r1[1] + r2[1]) / 2,
            0.075,
            0.92,
            0.075,
            steel,
            i,
          );
        }
        const steps = Math.max(1, Math.floor(length / 0.23));
        for (let k = 0; k < steps; k++) {
          const f = (k + 0.5) / steps,
            c = [mix(a[0], b[0], f), mix(a[1], b[1], f)];
          g.beam(
            [c[0] - 0.31 * ox, c[1] - 0.31 * oz],
            [c[0] + 0.31 * ox, c[1] + 0.31 * oz],
            1.084,
            0.078,
            0.023,
            "#a7bab8",
            i,
          );
        }
      }
    }
    return g.polys;
  }
  function potato(g, x, y, z, r, tint, offset, id) {
    const lat = 5,
      lon = 8,
      radius = (a, k) =>
        r * (1 + 0.055 * Math.sin(3 * a + offset) * Math.cos(k));
    function point(i, j) {
      const a = (2 * Math.PI * j) / lon + offset,
        phi = (Math.PI * i) / lat - Math.PI / 2,
        rr = radius(a, phi);
      return [
        x + rr * 1.22 * Math.cos(phi) * Math.cos(a),
        y + r * 0.79 * Math.sin(phi),
        z + rr * 0.89 * Math.cos(phi) * Math.sin(a),
      ];
    }
    for (let i = 0; i < lat; i++)
      for (let j = 0; j < lon; j++) {
        const pts = [
          point(i, j),
          point(i + 1, j),
          point(i + 1, j + 1),
          point(i, j + 1),
        ];
        if (i === 0) pts.pop();
        if (i === lat - 1) pts.splice(1, 1);
        g.face(pts, tint, id);
      }
  }
  function activity(frame) {
    const g = geometry(),
      i = frame.index,
      p = frame.progress,
      point = lotPosition(i, p);
    const form = i === 0 ? 0 : Math.max(0, i - (p < 0.5 ? 1 : 0));
    const [x, y, z] = point;
    if (frame.batch) {
      if (form <= 2) {
        const shades = [
          ["#966a40", "#ae7e4e", "#bc9061"],
          ["#c69a62", "#cdaa75", "#b9905b"],
          ["#edce8d", "#e9d8a0", "#f0d99e"],
        ][form];
        for (let n = 0; n < 7; n++) {
          const a = n * 2.4,
            dist = 0.1 * Math.sqrt(n),
            xx = x + dist * Math.cos(a),
            zz = z + 0.76 * dist * Math.sin(a);
          potato(
            g,
            xx,
            y + 0.09 + (n === 0 ? 0.11 : 0),
            zz,
            0.112 + (n % 3) * 0.012,
            shades[n % 3],
            n * 0.73,
            i,
          );
          if (form === 0)
            g.box(
              xx - 0.019,
              y + 0.17 + (n === 0 ? 0.11 : 0),
              zz,
              0.039,
              0.013,
              0.028,
              "#765737",
              i,
            );
        }
      } else if (form < 8) {
        const shades = {
          3: ["#e9d59a", "#f7e0ac"],
          4: ["#efcf89", "#f6dc96"],
          5: ["#e7c46e", "#ead289"],
          6: ["#e6a741", "#f3bd58"],
          7: ["#e4cf9d", "#eddbad"],
        }[form];
        for (let n = 0; n < 12; n++) {
          const a = n * 2.4,
            r = 0.07 * Math.sqrt(n);
          g.box(
            x + r * Math.cos(a),
            y + 0.018 + (n % 3) * 0.035,
            z + r * Math.sin(a),
            0.3 + (n % 3) * 0.035,
            0.061,
            0.063,
            shades[n % 2],
            i,
            a * 0.34,
          );
          if (form === 7 && n % 2 === 0)
            g.box(
              x + r * Math.cos(a),
              y + 0.081 + (n % 3) * 0.035,
              z + r * Math.sin(a),
              0.075,
              0.01,
              0.042,
              "#faf6dc",
              i,
              a * 0.34,
            );
        }
      } else {
        for (const s of [-1, 1]) {
          const xx = x + 0.191 * s;
          g.box(xx, y, z, 0.357, 0.31, 0.425, "#bd925f", i);
          const open = i === 8 && p < 0.82;
          if (open) {
            // A film pouch fills each outer carton before its flaps close.
            g.box(xx, y + 0.311, z, 0.31, 0.009, 0.38, "#715a3e", i);
            g.box(xx, y + 0.318, z, 0.24, 0.11, 0.26, "#dce6d4", i, 0.11 * s);
            g.box(xx, y + 0.422, z, 0.24, 0.021, 0.047, "#5f9186", i, 0.11 * s);
            g.box(xx, y + 0.362, z + 0.135, 0.15, 0.04, 0.012, "#6f9b87", i);
          } else g.box(xx, y + 0.311, z, 0.069, 0.006, 0.428, "#ecd392", i);
          g.box(xx, y + 0.091, z + 0.215, 0.22, 0.132, 0.012, "#f6f2de", i);
          for (let k = 0; k < 5; k++)
            g.box(
              xx - 0.08 + k * 0.034,
              y + 0.117,
              z + 0.224,
              0.014,
              0.075,
              0.009,
              "#435a54",
              i,
            );
        }
      }
    }
    if (frame.running && frame.installed[i]) {
      const s = kit(g, i),
        phase = p * Math.PI * 2;
      if (i === 1)
        for (let n = 0; n < 5; n++)
          s.box(
            -0.72 + n * 0.35,
            1.29 + ((n * 0.19 + p * 4) % 1) * 0.44,
            -0.13,
            0.039,
            0.13,
            0.045,
            "#76c2ca",
          );
      if (i === 2)
        for (let n = 0; n < 4; n++) {
          const a = phase * 4 + (n * Math.PI) / 2;
          s.tube(
            0.47 * Math.cos(a),
            1.15,
            0.47 * Math.sin(a),
            0.068,
            0.16,
            "#acc3ac",
            8,
          );
        }
      if (i === 3)
        s.box(
          0.015,
          1.5 + 0.1 * Math.cos(phase * 5),
          0,
          0.077,
          0.045,
          0.77,
          silver,
        );
      if (i === 4 || i === 6)
        for (let n = 0; n < 7; n++) {
          const a = n * 2.131;
          s.tube(
            0.66 * Math.cos(a),
            1.16 + 0.05 * Math.cos(phase * 4 + a),
            0.37 * Math.sin(a),
            0.05,
            0.019,
            i === 4 ? "#b4e1dc" : "#edc572",
            8,
          );
        }
      if (i === 5 || i === 7)
        for (const xx of [-0.6, 0, 0.6]) {
          s.box(
            xx,
            i === 5 ? 2.31 : 2.25,
            -0.3,
            0.31,
            0.022,
            0.054,
            steel,
            phase * 5,
          );
          s.box(
            xx,
            i === 5 ? 2.31 : 2.25,
            -0.3,
            0.31,
            0.022,
            0.054,
            steel,
            phase * 5 + Math.PI / 2,
          );
        }
      if (i === 8)
        for (const side of [-1, 1])
          s.box(
            side * (0.27 + 0.15 * Math.cos(phase * 3)),
            1.49,
            0,
            0.074,
            0.09,
            0.5,
            blue,
          );
    }
    return {
      polys: g.polys,
      point: [x, y + (form >= 8 ? 0.34 : 0.24), z],
      form,
    };
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
    overview: { centre: [0.13, 0.48, 0.0], yaw: -0.16, pitch: 0.75, d: 19.5 },
    station: { centre: [0, 1, 0], yaw: -0.63, pitch: 0.45, d: 4.75 },
    top: { centre: [0.1, 0.25, 0], yaw: 0, pitch: 1.48, d: 19.0 },
  };
  function mount(canvas, onInspect) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("The fry plant viewer needs a canvas.");
    const original = {
      label: canvas.getAttribute("aria-label"),
      tab: canvas.getAttribute("tabindex"),
      touch: canvas.style.touchAction,
      cursor: canvas.style.cursor,
    };
    if (!canvas.hasAttribute("tabindex")) canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      (original.label || "Interactive French fry processing plant.") +
        " Drag to orbit, pinch or scroll to zoom. Use arrows to orbit, plus or minus to zoom, and Home for overview. Press Enter to inspect each station in sequence. Keys 1 to 9 select stations 1 to 9 and 0 selects dispatch.",
    );
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    let fixed = plant(fullInstall);
    const gpu = depthRenderer(fixed),
      removers = [],
      fingers = new Map();
    let frame = {
        index: 0,
        progress: 0,
        running: false,
        batch: "",
        installed: [...fullInstall],
      },
      cam = { ...cameras.overview },
      basis = null,
      preset = "overview",
      request = 0,
      w = 1,
      h = 1,
      lastPolys = [],
      selected = null,
      drag = false,
      start = null,
      disposed = false;
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
          maxY < -0.008 ? -4 : maxY <= 0 ? -3 : maxY <= 0.015 && !p.id ? -2 : 0;
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
    function badge(point, text, highlight = false) {
      const p = project(point);
      if (!p || p[0] < 0 || p[0] > w || p[1] < 0 || p[1] > h || !text) return;
      const px = w < 420 ? 10 : 11;
      ctx.font = "600 " + px + "px Consolas, monospace";
      const tw = ctx.measureText(text).width,
        bw = Math.min(tw + 17, Math.max(35, w - 12)),
        bh = 21;
      const x = clamp(p[0] - bw / 2, 5, w - bw - 5);
      const preferred = clamp(p[1] - bh - (highlight ? 31 : 18), 6, h - bh - 4);
      const candidates = [
        preferred,
        preferred - 25,
        preferred - 50,
        p[1] + 17,
        p[1] + 42,
      ].map((y) => clamp(y, 6, h - bh - 4));
      const y =
        candidates.find((y) =>
          stationLabels.every(
            (label) =>
              x + bw + 3 < label.x ||
              x > label.x + label.w + 3 ||
              y + bh + 3 < label.y ||
              y > label.y + label.h + 3,
          ),
        ) ?? preferred;
      ctx.strokeStyle = highlight ? "#306b64" : "#685136";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(clamp(p[0], x + 4, x + bw - 4), y < p[1] ? y + bh : y);
      ctx.lineTo(p[0], p[1]);
      ctx.stroke();
      ctx.fillStyle = highlight ? "#21514d" : "#fff8e7";
      ctx.strokeStyle = highlight ? "#21514d" : "#ad9368";
      ctx.beginPath();
      ctx.roundRect(x, y, bw, bh, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = highlight ? "#ffffff" : "#4e3d27";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + bw / 2, y + bh / 2, Math.max(1, bw - 8));
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
          preset === "station"
            ? Math.min(h * 1.3, w * 1.1)
            : Math.min(h * 1.48, w * 0.92),
      };
      basis.eye = cam.centre.map((v, i) => v - basis.front[i] * cam.d);
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#f2f9f6");
      bg.addColorStop(1, "#dbe9e3");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const active = activity(frame);
      lastPolys = active.polys;
      if (!gpu?.render(ctx, basis, active.polys, w, h, dpr)) {
        const paths = polygons2d(fixed.concat(active.polys)).sort(
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
      if (preset !== "station") {
        const labels = [];
        for (let i = 0; i < stations.length; i++) {
          const [xx, zz] = stations[i];
          const anchor = project([xx, 0.1, zz + 0.94]);
          if (
            !anchor ||
            anchor[0] < -20 ||
            anchor[0] > w + 20 ||
            anchor[1] < 0 ||
            anchor[1] > h - 4
          )
            continue;
          const compact = w < 650;
          const text = compact
            ? String(i + 1)
            : String(i + 1).padStart(2, "0") + " " + stages[i].toUpperCase();
          ctx.font = "600 " + (compact ? 9 : 10) + "px Consolas,monospace";
          const tw = ctx.measureText(text).width + 9,
            th = 16;
          const lx = clamp(anchor[0] - tw / 2, 3, w - tw - 3),
            ly = clamp(anchor[1] + 2, 2, h - th - 2);
          ctx.fillStyle = frame.installed[i] ? "#2d504a" : "#eef4ed";
          ctx.strokeStyle = frame.installed[i] ? "#2d504a" : "#8b9e91";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(lx, ly, tw, th, 3);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = frame.installed[i] ? "#ffffff" : "#405a47";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, lx + tw / 2, ly + th / 2);
          labels.push({ x: lx, y: ly, w: tw, h: th, i });
        }
        stationLabels = labels;
      } else stationLabels = [];
      if (frame.batch) {
        const label =
          w < 550 && preset !== "station"
            ? frame.batch
            : frame.batch + " / " + material[active.form];
        badge(active.point, String(label));
      } else if (selected !== null || preset === "station") {
        const i = selected ?? frame.index,
          [xx, zz] = stations[i];
        badge(
          [xx, frame.installed[i] ? 1.75 : 0.12, zz],
          names[i] + (frame.installed[i] ? "" : " / empty bay"),
          true,
        );
      }
    }
    function queue() {
      if (!disposed && !request) request = requestAnimationFrame(paint);
    }
    function camera(name) {
      preset = ["overview", "station", "top"].includes(name)
        ? name
        : "overview";
      cam = { ...cameras[preset] };
      if (preset === "station") {
        const [xx, zz] = stations[selected ?? frame.index];
        cam.centre = [xx, 1.07, zz];
      }
      queue();
    }
    function draw(next = {}) {
      const previousIndex = frame.index;
      const installed = Array.isArray(next.installed)
        ? stages.map((_, i) => !!next.installed[i])
        : frame.installed;
      if (installed.some((enabled, i) => enabled !== frame.installed[i])) {
        fixed = plant(installed);
        gpu?.install(fixed);
      }
      frame = {
        index: clamp(Math.trunc(Number(next.index) || 0), 0, 9),
        progress: clamp(Number(next.progress) || 0, 0, 1),
        batch: typeof next.batch === "string" ? next.batch : "",
        running: !!next.running,
        installed,
      };
      if (frame.index !== previousIndex) {
        selected = null;
        if (preset === "station") camera("station");
      }
      queue();
    }
    function inspect(id) {
      if (!Number.isInteger(id) || id < 0 || id > 9) return;
      selected = id;
      if (preset === "station") camera("station");
      else queue();
      onInspect?.(id);
    }
    let stationLabels = [];
    function pick(x, y) {
      const label = stationLabels.find(
        (label) =>
          x >= label.x &&
          x <= label.x + label.w &&
          y >= label.y &&
          y <= label.y + label.h,
      );
      if (label) return label.i;
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
      return found;
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
      cam.d = clamp(d, preset === "station" ? 3.0 : 10, 38);
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
      switch (e.key) {
        case "ArrowLeft":
          cam.yaw -= 0.12;
          break;
        case "ArrowRight":
          cam.yaw += 0.12;
          break;
        case "ArrowUp":
          cam.pitch = clamp(cam.pitch + 0.08, 0.08, 1.49);
          break;
        case "ArrowDown":
          cam.pitch = clamp(cam.pitch - 0.08, 0.08, 1.49);
          break;
        case "+":
        case "=":
          zoom(cam.d * 0.88);
          break;
        case "-":
          zoom(cam.d * 1.12);
          break;
        case "Home":
          camera("overview");
          break;
        case "Enter":
          inspect(((selected ?? -1) + 1) % 10);
          break;
        default:
          if (/^[0-9]$/.test(e.key))
            inspect(e.key === "0" ? 9 : Number(e.key) - 1);
          else return;
      }
      e.preventDefault();
      queue();
    });
    const observer = new ResizeObserver(queue);
    observer.observe(canvas);
    queue();
    return {
      draw,
      camera,
      focusStation(index) {
        if (!Number.isInteger(index) || index < 0 || index >= stages.length)
          return;
        selected = index;
        camera("station");
      },
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
        canvas.style.touchAction = original.touch;
        canvas.style.cursor = original.cursor;
      },
    };
  }
  window.FryScene = Object.freeze({ mount });
})();
