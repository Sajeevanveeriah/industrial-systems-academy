(() => {
  "use strict";
  const order = ["conveyor", "sensor", "scanner", "plc", "robot", "pallet"];
  const labels = {
    conveyor: "Infeed conveyor",
    sensor: "Photoelectric sensor",
    scanner: "Inspection scanner",
    plc: "PLC cabinet",
    robot: "SCARA transfer robot",
    pallet: "Dispatch pallet",
  };
  const home = { shoulder: 80, elbow: 15 },
    nominalPick = { shoulder: 12, elbow: 45 },
    nominalPlace = { shoulder: 125, elbow: 35 };
  const rad = Math.PI / 180,
    clamp = (x, a, b) => Math.max(a, Math.min(b, x)),
    mix = (a, b, t) => a + (b - a) * t;
  const ease = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  const lerpPose = (a, b, t) => ({
    shoulder: mix(a.shoulder, b.shoulder, t),
    elbow: mix(a.elbow, b.elbow, t),
  });
  const base = [-0.35, 0.72],
    unit = 0.021,
    deck = 1.0,
    palletDeck = 0.26,
    cartonH = 0.42;
  function arm(pose) {
    const a = pose.shoulder * rad,
      b = (pose.shoulder + pose.elbow) * rad;
    const joint = [
      base[0] + 88 * unit * Math.cos(a),
      base[1] - 88 * unit * Math.sin(a),
    ];
    return {
      joint,
      tool: [
        joint[0] + 71 * unit * Math.cos(b),
        joint[1] - 71 * unit * Math.sin(b),
      ],
    };
  }
  const pickStation = arm(nominalPick).tool,
    placeStation = arm(nominalPlace).tool;
  const xB = pickStation[0],
    zGate = 1.23,
    zStart = 3.65;
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
  function buildLine() {
    const g = geometry(),
      { box, cylinder, beam } = g,
      steel = "#829a9c",
      dark = "#374e55",
      ivory = "#dae5e2",
      robot = "#e99d40",
      aqua = "#287d80";
    // Workshop slab and inset floor markings. Each tile is flush with the next.
    box(0, -0.19, 0, 11, 0.18, 8.6, "#b6c8bf");
    function contact(x, z, w, d) {
      const pts = [];
      for (let n = 0; n < 24; n++) {
        const a = (-n * 2 * Math.PI) / 24;
        pts.push([x + w * Math.cos(a), 0.002, z + d * Math.sin(a)]);
      }
      g.face(pts, "#a5b7aa");
    }
    contact(base[0] + 0.11, base[1] - 0.08, 0.74, 0.58);
    contact(-1.95, 2.16, 0.61, 0.41);
    contact(placeStation[0] + 0.1, placeStation[1], 0.91, 0.9);
    for (let x = -5; x <= 5; x++)
      box(x, -0.009, 0, 0.012, 0.007, 8.55, "#859e94");
    for (let z = -4; z <= 4; z++)
      box(0, -0.009, z, 10.95, 0.007, 0.012, "#859e94");
    for (const s of [-1, 1]) {
      box(0.1, 0.003, s * 3.55, 8.25, 0.008, 0.035, "#b29152");
      box(s * 4.02 + 0.1, 0.003, 0, 0.035, 0.008, 7.14, "#b29152");
    }
    // Conveyor structure, cross members, levelling feet and drive motor.
    const id = "conveyor",
      end = -1.73,
      begin = 3.98,
      length = begin - end,
      mid = (begin + end) / 2;
    for (const z of [-1.4, 0.03, 1.6, 3.58]) {
      for (const x of [xB - 0.48, xB + 0.48]) {
        cylinder(x, 0.008, z, 0.13, 0.05, dark, id, 10);
        box(x, 0.055, z, 0.09, 0.75, 0.09, steel, id);
      }
      box(xB, 0.2, z, 1.01, 0.065, 0.06, steel, id);
    }
    for (const s of [-1, 1]) {
      box(xB + s * 0.55, 0.75, mid, 0.115, 0.21, length, ivory, id);
      box(xB + s * 0.55, 0.76, mid, 0.12, 0.06, length, "#258a87", id);
      box(xB + s * 0.52, 0.9, mid, 0.044, 0.12, length, dark, id);
    }
    box(xB, 0.83, mid, 1.05, 0.075, length, dark, id);
    for (let z = end + 0.08; z < begin; z += 0.2) {
      // A horizontal roller shaft with a convex crown, not a translated belt texture.
      const pt = (x, a) => [
        x,
        0.921 + 0.077 * Math.cos(a),
        z + 0.077 * Math.sin(a),
      ];
      for (let j = 0; j < 6; j++) {
        const a = -Math.PI / 2 + (j * Math.PI) / 6,
          b = a + Math.PI / 6;
        g.face(
          [pt(xB - 0.5, a), pt(xB - 0.5, b), pt(xB + 0.5, b), pt(xB + 0.5, a)],
          "#b5c5c4",
          id,
        );
      }
    }
    box(xB + 0.67, 0.55, 3.11, 0.36, 0.32, 0.42, aqua, id);
    for (let i = 0; i < 4; i++)
      box(xB + 0.67, 0.58, 2.94 + i * 0.1, 0.38, 0.24, 0.03, dark, id);
    // Sensor heads sit on opposite conveyor rails; an inspection gantry carries the barcode reader.
    for (const s of [-1, 1]) {
      box(xB + s * 0.62, 0.88, zGate, 0.09, 0.4, 0.1, steel, "sensor");
      box(xB + s * 0.6, 1.19, zGate, 0.16, 0.15, 0.19, "#304850", "sensor");
      box(xB + s * 0.51, 1.23, zGate, 0.02, 0.065, 0.08, "#e6ad4a", "sensor");
      box(xB + s * 0.68, 0.023, zGate, 0.16, 2.02, 0.15, "#529f9a", "scanner");
      box(xB + s * 0.68, 0.015, zGate, 0.31, 0.05, 0.3, dark, "scanner");
    }
    box(xB, 1.93, zGate, 1.51, 0.19, 0.17, aqua, "scanner");
    box(xB, 1.75, zGate, 0.31, 0.21, 0.3, dark, "scanner");
    box(xB, 1.73, zGate, 0.23, 0.024, 0.18, "#73cfd3", "scanner");
    for (let i = 0; i < 4; i++)
      box(
        xB - 0.5 + i * 0.22,
        1.99,
        zGate + 0.091,
        0.075,
        0.053,
        0.012,
        "#d6e7d8",
        "scanner",
      );
    // A right-angle powered spur leads to a low reject tote.
    const rz = pickStation[1];
    for (const s of [-1, 1])
      box(xB + 1.02, 0.68, rz + s * 0.36, 1.02, 0.13, 0.06, ivory, id);
    for (let i = 0; i < 6; i++)
      box(xB + 0.63 + i * 0.16, 0.81, rz, 0.12, 0.065, 0.67, steel, id);
    const binX = xB + 1.83;
    box(binX, 0.03, rz, 0.96, 0.09, 0.99, "#ab7951", id);
    for (const s of [-1, 1]) {
      box(binX + s * 0.455, 0.1, rz, 0.06, 0.54, 1.0, "#d29359", id);
      box(binX, 0.1, rz + s * 0.46, 0.93, 0.54, 0.055, "#dba66f", id);
    }
    // E-stop, terminal rows, cable gland, stack light and indicator windows on the PLC enclosure.
    const cx = -2.05,
      cz = 2.23;
    box(cx, 0.01, cz, 0.93, 0.12, 0.62, dark, "plc");
    box(cx, 0.13, cz, 0.86, 1.37, 0.49, "#d1ded9", "plc");
    box(cx, 0.19, cz + 0.254, 0.77, 1.24, 0.042, "#bdcdc9", "plc");
    box(cx, 1.0, cz + 0.286, 0.55, 0.25, 0.04, "#324e52", "plc");
    box(cx, 1.05, cz + 0.31, 0.43, 0.15, 0.022, "#8ec5ba", "plc");
    for (let i = 0; i < 4; i++)
      box(
        cx - 0.22 + i * 0.147,
        0.77,
        cz + 0.285,
        0.08,
        0.07,
        0.058,
        i === 0 ? "#b85643" : "#688c81",
        "plc",
      );
    for (let i = 0; i < 5; i++)
      box(cx, 0.28 + i * 0.061, cz + 0.28, 0.46, 0.018, 0.043, steel, "plc");
    cylinder(cx + 0.27, 1.5, cz, 0.048, 0.23, dark, "plc", 10);
    for (let i = 0; i < 3; i++)
      cylinder(
        cx + 0.27,
        1.72 + i * 0.097,
        cz,
        0.074,
        0.084,
        ["#79ac90", "#e3b452", "#c65c46"][i],
        "plc",
        10,
      );
    // Pallet is centred on the nominal place pose. Deck gaps expose the stringers and fork pockets.
    const [px, pz] = placeStation;
    for (const x of [-0.55, 0, 0.55])
      box(px + x, 0.012, pz, 0.16, 0.158, 1.35, "#a47f52", "pallet");
    for (let i = 0; i < 6; i++)
      box(
        px - 0.67 + i * 0.27,
        0.17,
        pz,
        0.225,
        0.09,
        1.38,
        "#d3b078",
        "pallet",
      );
    // SCARA pedestal. Horizontal shoulder and elbow axes follow the teaching pendant's XY plane.
    box(base[0], 0.01, base[1], 0.97, 0.12, 0.92, "#5f7578", "robot");
    for (const dx of [-0.37, 0.37])
      for (const dz of [-0.34, 0.34])
        cylinder(
          base[0] + dx,
          0.131,
          base[1] + dz,
          0.047,
          0.035,
          ivory,
          "robot",
          8,
        );
    cylinder(base[0], 0.13, base[1], 0.37, 0.22, "#3b565c", "robot", 20);
    cylinder(base[0], 0.35, base[1], 0.29, 1.37, "#c7d2cf", "robot", 22);
    cylinder(base[0], 1.69, base[1], 0.34, 0.3, robot, "robot", 22);
    return g.polys;
  }
  const example = {
    stage: "idle",
    t: 0,
    accepted: true,
    id: "",
    pick: nominalPick,
    place: nominalPlace,
  };
  // The PLC holds the workpiece beneath the scanner until its inspection scan
  // completes. The next state first conveys it out to the robot or reject spur.
  const transportFraction = 0.31;
  function stageMotion(frame) {
    const leaving = frame.stage === "transfer" || frame.stage === "reject";
    const travel = leaving ? clamp(frame.t / transportFraction, 0, 1) : 0;
    const action = leaving
      ? clamp((frame.t - transportFraction) / (1 - transportFraction), 0, 1)
      : 0;
    const atCamera =
      (frame.stage === "feed" && frame.t >= 1) || frame.stage === "inspect";
    return {
      leaving,
      travel,
      action,
      atCamera,
      inspected: frame.stage === "inspect" && frame.t >= 1,
    };
  }
  function position(frame) {
    const { stage, t } = frame;
    const pick = frame.pick,
      place = frame.place,
      P = arm(pick).tool,
      Q = arm(place).tool;
    let pose = home,
      box = [xB, deck, zStart],
      toolBase = 1.59;
    if (stage === "feed") box[2] = mix(zStart, zGate, ease(t));
    if (stage === "inspect") box = [xB, deck, zGate];
    const motion = stageMotion(frame);
    const station = stage === "transfer" ? P : pickStation;
    if (motion.leaving && t < transportFraction) {
      const progress = ease(motion.travel);
      box = [
        mix(xB, station[0], progress),
        deck,
        mix(zGate, station[1], progress),
      ];
      return { pose, box, toolBase };
    }
    if (stage === "reject" || (stage === "complete" && !frame.accepted)) {
      const k = stage === "complete" ? 1 : motion.action;
      box = [
        mix(pickStation[0], xB + 1.83, ease(k / 0.79)),
        mix(deck, 0.885, ease(k / 0.4)) - 0.76 * ease((k - 0.62) / 0.38),
        pickStation[1],
      ];
    }
    if (stage === "transfer") {
      const t = motion.action;
      if (t < 0.2) {
        pose = lerpPose(home, pick, ease(t / 0.2));
        box = [P[0], deck, P[1]];
      } else if (t < 0.32) {
        pose = pick;
        toolBase = mix(1.59, deck + cartonH, ease((t - 0.2) / 0.12));
        box = [P[0], deck, P[1]];
      } else if (t < 0.43) {
        pose = pick;
        toolBase = mix(deck + cartonH, 1.78, ease((t - 0.32) / 0.11));
        box = [P[0], toolBase - cartonH, P[1]];
      } else if (t < 0.68) {
        pose = lerpPose(pick, place, ease((t - 0.43) / 0.25));
        toolBase = 1.78;
        const q = arm(pose).tool;
        box = [q[0], toolBase - cartonH, q[1]];
      } else if (t < 0.8) {
        pose = place;
        toolBase = mix(1.78, palletDeck + cartonH, ease((t - 0.68) / 0.12));
        box = [Q[0], toolBase - cartonH, Q[1]];
      } else if (t < 0.88) {
        pose = place;
        toolBase = mix(palletDeck + cartonH, 1.59, ease((t - 0.8) / 0.08));
        box = [Q[0], palletDeck, Q[1]];
      } else {
        pose = lerpPose(place, home, ease((t - 0.88) / 0.12));
        box = [Q[0], palletDeck, Q[1]];
      }
    }
    if (stage === "complete" && frame.accepted) box = [Q[0], palletDeck, Q[1]];
    return { pose, box, toolBase };
  }
  function moving(frame) {
    const g = geometry(),
      { box, cylinder, beam } = g,
      model = position(frame),
      { joint, tool } = arm(model.pose);
    const id = "robot";
    beam(base, joint, 1.96, 0.38, 0.21, "#eba24e", id);
    beam(base, joint, 2.17, 0.24, 0.045, "#f7cc87", id);
    cylinder(joint[0], 1.93, joint[1], 0.235, 0.36, "#506369", id, 16);
    cylinder(joint[0], 2.28, joint[1], 0.18, 0.07, "#efb469", id, 16);
    beam(joint, tool, 2.13, 0.29, 0.15, "#eab065", id);
    beam(joint, tool, 2.28, 0.17, 0.04, "#fae1ad", id);
    cylinder(tool[0], 2.04, tool[1], 0.166, 0.3, "#41555a", id, 14);
    cylinder(
      tool[0],
      model.toolBase + 0.045,
      tool[1],
      0.051,
      2.14 - model.toolBase,
      "#859ba1",
      id,
      12,
    );
    cylinder(
      tool[0],
      model.toolBase + 0.021,
      tool[1],
      0.137,
      0.066,
      "#3b4c51",
      id,
      14,
    );
    for (const d of [-0.085, 0.085])
      cylinder(
        tool[0] + d,
        model.toolBase,
        tool[1],
        0.047,
        0.039,
        "#536361",
        id,
        10,
      );
    // Roller witness markings travel along the top surface, making shaft rotation visible.
    const motion = stageMotion(frame);
    const beltTravel =
      frame.stage === "feed" ? 5 * ease(frame.t) : 4 * ease(motion.travel);
    const phase = beltTravel * Math.PI * 2;
    for (let i = 0; i < 28; i++) {
      const k = -1.65 + i * 0.2;
      // Opposed witness marks rotate around the shaft and disappear on its underside.
      const angle =
        phase +
        (i % 3) * 0.14 +
        (Math.cos(phase + (i % 3) * 0.14) < 0 ? Math.PI : 0);
      box(
        xB + 0.03,
        0.922 + 0.077 * Math.cos(angle),
        k + 0.077 * Math.sin(angle),
        0.79,
        0.004,
        0.011,
        "#819793",
        "conveyor",
      );
    }
    const [x, y, z] = model.box;
    // A small status lamp on the sensor head indicates the PLC input, even
    // when the carton blocks the beam itself from view.
    for (const side of [-1, 1]) {
      box(
        xB + side * 0.57,
        1.28,
        zGate + 0.103,
        0.07,
        0.05,
        0.025,
        motion.atCamera ? "#ef9c4b" : "#435e60",
        "sensor",
      );
    }
    if (motion.atCamera) {
      box(xB, 1.27, zGate, 0.99, 0.013, 0.011, "#ef9c4b", "sensor");
    }
    if (frame.stage === "inspect") {
      // While sampling, the stripe sweeps the top label. Pass/fail only appears
      // on the completion sample, never while acquisition is still in progress.
      const stripeZ = zGate + mix(-0.14, 0.14, frame.t);
      box(
        xB,
        deck + cartonH + 0.021,
        stripeZ,
        0.46,
        0.009,
        0.016,
        "#326f70",
        "scanner",
      );
    }
    const inspectionLight = motion.inspected
      ? frame.accepted
        ? "#69b66f"
        : "#d56640"
      : frame.stage === "inspect"
        ? "#56b9c0"
        : "#475e61";
    box(
      xB + 0.52,
      1.985,
      zGate + 0.1,
      0.18,
      0.076,
      0.027,
      inspectionLight,
      "scanner",
    );
    const rejectExtension =
      frame.stage === "reject"
        ? Math.sin(Math.PI * clamp(motion.action / 0.68, 0, 1)) * 0.45
        : 0;
    box(
      xB - 0.7,
      0.74,
      pickStation[1],
      0.29,
      0.25,
      0.47,
      "#517878",
      "conveyor",
    );
    box(
      xB - 0.49 + rejectExtension * 0.5,
      1.085,
      pickStation[1],
      0.4 + rejectExtension,
      0.06,
      0.07,
      "#829b9e",
      "conveyor",
    );
    box(
      xB - 0.28 + rejectExtension,
      1.045,
      pickStation[1],
      0.055,
      0.15,
      0.42,
      "#b18b46",
      "conveyor",
    );
    box(x, y, z, 0.57, cartonH, 0.46, "#cb965d", null);
    box(x, y + cartonH + 0.002, z, 0.109, 0.006, 0.462, "#efd399", null);
    box(x - 0.15, y + cartonH + 0.007, z, 0.18, 0.006, 0.18, "#fff7de", null);
    for (let bar = 0; bar < 6; bar++) {
      box(
        x - 0.216 + bar * 0.022,
        y + cartonH + 0.014,
        z,
        0.009,
        0.004,
        0.11,
        "#48534a",
        null,
      );
    }
    box(x, y + 0.1, z + 0.233, 0.32, 0.2, 0.009, "#f8f5df", null);
    for (let i = 0; i < 9; i++)
      box(
        x - 0.126 + i * 0.03,
        y + 0.139,
        z + 0.241,
        i % 3 === 0 ? 0.016 : 0.008,
        0.11,
        0.008,
        "#344543",
        null,
      );
    return { polys: g.polys, point: [x, y + cartonH, z], pose: model.pose };
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
    const staticMesh = mesh(staticFaces);
    gl.bindBuffer(gl.ARRAY_BUFFER, fixed);
    gl.bufferData(gl.ARRAY_BUFFER, staticMesh, gl.STATIC_DRAW);
    function drawBuffer(buffer, count) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(P);
      gl.vertexAttribPointer(P, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(C);
      gl.vertexAttribPointer(C, 3, gl.FLOAT, false, 24, 12);
      gl.drawArrays(gl.TRIANGLES, 0, count);
    }
    return {
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
        drawBuffer(fixed, staticMesh.length / 6);
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
  const anchors = {
    conveyor: [xB, 1.04, 3.1],
    sensor: [xB + 0.6, 1.33, zGate],
    scanner: [xB, 2.15, zGate],
    plc: [-2.05, 1.55, 2.23],
    robot: [base[0], 2.24, base[1]],
    pallet: [placeStation[0], 0.29, placeStation[1]],
  };
  const cameras = {
    overview: { centre: [0, -0.14, 0.0], yaw: 0.64, pitch: 0.55, d: 13.9 },
    conveyor: { centre: [xB, 0.92, 1.2], yaw: 1.03, pitch: 0.44, d: 7.9 },
    inspection: { centre: [xB, 1.16, 1.57], yaw: 0.68, pitch: 0.34, d: 5.8 },
    robot: { centre: [-0.19, 1.19, -0.48], yaw: -0.2, pitch: 0.44, d: 8.5 },
    pallet: {
      centre: [placeStation[0], 0.68, placeStation[1]],
      yaw: -0.56,
      pitch: 0.47,
      d: 6.6,
    },
    plc: { centre: [-1.5, 0.94, 1.83], yaw: -0.25, pitch: 0.24, d: 5.7 },
    top: { centre: [0, 0.2, 0.2], yaw: 0, pitch: 1.43, d: 13.4 },
  };
  function mount(canvas, onInspect) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Line scene needs a canvas.");
    const original = {
      label: canvas.getAttribute("aria-label"),
      tab: canvas.getAttribute("tabindex"),
      touch: canvas.style.touchAction,
      cursor: canvas.style.cursor,
    };
    if (!canvas.hasAttribute("tabindex")) canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      (original.label || "Interactive carton line.") +
        " Drag to orbit, pinch or scroll to zoom. Use arrows to orbit, plus or minus to zoom, and Home for overview. Tab focuses the canvas; press Enter to inspect equipment, or use 1 through 6 for conveyor, sensor, scanner, PLC, robot or pallet.",
    );
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    const fixed = buildLine(),
      gpu = depthRenderer(fixed),
      removers = [],
      fingers = new Map();
    let frame = { ...example },
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
      const x = clamp(p[0] - bw / 2, 5, w - bw - 5),
        y = clamp(p[1] - bh - (highlight ? 31 : 18), 6, h - bh - 4);
      ctx.strokeStyle = highlight ? "#306b64" : "#685136";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(clamp(p[0], x + 4, x + bw - 4), y + bh);
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
        focal: Math.min(h * 1.3, w * 0.98),
      };
      basis.eye = cam.centre.map((v, i) => v - basis.front[i] * cam.d);
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#f2f9f6");
      bg.addColorStop(1, "#dbe9e3");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const active = moving(frame);
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
      if (frame.id) badge(active.point, String(frame.id));
      if (selected) badge(anchors[selected], labels[selected], true);
    }
    function queue() {
      if (!disposed && !request) request = requestAnimationFrame(paint);
    }
    function camera(name) {
      const aliases = {
        line: "overview",
        room: "overview",
        run: "overview",
        wide: "overview",
        orbit: "overview",
        scanner: "inspection",
        sensor: "inspection",
        close: "robot",
        overhead: "top",
        cell: "robot",
        transfer: "robot",
        infeed: "conveyor",
        dispatch: "pallet",
        front: "overview",
        isometric: "overview",
      };
      preset = cameras[name] ? name : aliases[name] || "overview";
      cam = { ...cameras[preset] };
      queue();
    }
    function draw(next) {
      function safePose(p, backup) {
        return p && Number.isFinite(p.shoulder) && Number.isFinite(p.elbow)
          ? p
          : backup;
      }
      frame = {
        ...example,
        ...next,
        t: clamp(Number(next?.t) || 0, 0, 1),
        pick: safePose(next?.pick, nominalPick),
        place: safePose(next?.place, nominalPlace),
      };
      queue();
    }
    function inspect(id) {
      if (id) {
        selected = id;
        queue();
        onInspect?.(id);
      }
    }
    function pick(x, y) {
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
      cam.d = clamp(d, preset === "overview" || preset === "top" ? 7 : 3.4, 23);
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
          inspect(order[(order.indexOf(selected) + 1) % order.length]);
          break;
        default:
          if (/^[1-6]$/.test(e.key)) inspect(order[Number(e.key) - 1]);
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
  window.SWLineScene = Object.freeze({ mount });
})();
