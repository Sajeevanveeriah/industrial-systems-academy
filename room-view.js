(() => {
  "use strict";
  /* A dependency-free perspective scene. Dimensions below are diagram units, not site dimensions. */
  const BAYS = { door: [-2.55, 0.25], service: [0, 0], cooler: [2.55, -0.25] };
  const EQUIPMENT = {
    patch: { height: 1, case: "#343e46", face: "#b2c0c1", tag: "PATCH" },
    switch: { height: 1, case: "#253944", face: "#80b8b9", tag: "SW" },
    server: { height: 2, case: "#343940", face: "#a4adae", tag: "SRV" },
    ups: { height: 2, case: "#22292c", face: "#7e8b9a", tag: "UPS" },
  };
  const DEFAULT = {
    bay: "service",
    facing: "cold",
    slots: { ups: 0, server: 0, switch: 0, patch: 0 },
    cables: { power: false, uplink: false, host: false },
    powered: false,
  };
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const blend = (hex, factor) =>
    "#" +
    [1, 3, 5]
      .map((i) =>
        clamp(Math.round(parseInt(hex.slice(i, i + 2), 16) * factor), 0, 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  // The depth pass resolves intersecting castings, small port faces and wires at oblique angles.
  // A 2D painter remains available on devices that cannot allocate a WebGL context.
  function createDepthPass() {
    const surface = document.createElement("canvas");
    let gl;
    try {
      gl = surface.getContext("webgl", {
        alpha: true,
        antialias: true,
        depth: true,
        premultipliedAlpha: false,
      });
    } catch {
      return null;
    }
    if (!gl) return null;
    function shader(type, source) {
      const item = gl.createShader(type);
      gl.shaderSource(item, source);
      gl.compileShader(item);
      return item;
    }
    const vs = shader(
      gl.VERTEX_SHADER,
      "attribute vec4 point;attribute vec3 colour;varying vec3 tint;void main(){gl_Position=point;tint=colour;}",
    );
    const fs = shader(
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
    const buffer = gl.createBuffer();
    const point = gl.getAttribLocation(program, "point"),
      colour = gl.getAttribLocation(program, "colour");
    const palette = new Map();
    function rgb(hex) {
      if (!palette.has(hex))
        palette.set(
          hex,
          [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255),
        );
      return palette.get(hex);
    }
    return {
      paint(ctx, objects, w, h, ratio) {
        if (gl.isContextLost()) return false;
        const pw = Math.round(w * ratio),
          ph = Math.round(h * ratio);
        if (surface.width !== pw || surface.height !== ph) {
          surface.width = pw;
          surface.height = ph;
        }
        const vertices = [];
        function vertex(p, t, bias = 0, dx = 0, dy = 0) {
          const z = p[2],
            cx = ((p[0] + dx) * 2) / w - 1,
            cy = 1 - ((p[1] + dy) * 2) / h;
          vertices.push(cx * z, cy * z, z - 0.54 - bias * z, z, ...t);
        }
        for (const o of objects) {
          if (o.label) continue;
          const pts = o.points;
          if (o.fill) {
            const t = rgb(o.fill);
            for (let i = 1; i + 1 < pts.length; i++) {
              vertex(pts[0], t);
              vertex(pts[i], t);
              vertex(pts[i + 1], t);
            }
          }
          if (o.stroke) {
            const t = rgb(o.stroke),
              edges = o.closed ? pts.length : pts.length - 1;
            for (let i = 0; i < edges; i++) {
              const a = pts[i],
                b = pts[(i + 1) % pts.length],
                dx = b[0] - a[0],
                dy = b[1] - a[1],
                len = Math.hypot(dx, dy);
              if (len < 0.02) continue;
              const x = (-dy / len) * o.line * 0.5,
                y = (dx / len) * o.line * 0.5,
                bias = 0.00006;
              vertex(a, t, bias, x, y);
              vertex(a, t, bias, -x, -y);
              vertex(b, t, bias, -x, -y);
              vertex(a, t, bias, x, y);
              vertex(b, t, bias, -x, -y);
              vertex(b, t, bias, x, y);
            }
          }
        }
        gl.viewport(0, 0, pw, ph);
        gl.clearColor(0, 0, 0, 0);
        gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(vertices),
          gl.STREAM_DRAW,
        );
        gl.enableVertexAttribArray(point);
        gl.vertexAttribPointer(point, 4, gl.FLOAT, false, 28, 0);
        gl.enableVertexAttribArray(colour);
        gl.vertexAttribPointer(colour, 3, gl.FLOAT, false, 28, 16);
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 7);
        ctx.drawImage(surface, 0, 0, w, h);
        return true;
      },
      destroy() {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      },
    };
  }
  function createRoomView(canvas, onPick) {
    const ctx = canvas.getContext("2d");
    const depthPass = createDepthPass();
    if (!ctx) throw new Error("The room viewer needs a 2D canvas context.");
    const originalLabel = canvas.getAttribute("aria-label");
    const originalTabIndex = canvas.getAttribute("tabindex");
    const originalTouchAction = canvas.style.touchAction,
      originalCursor = canvas.style.cursor;
    if (!canvas.hasAttribute("tabindex")) canvas.tabIndex = 0;
    const gestures =
      "Drag to orbit, pinch or scroll to zoom. Arrow keys rotate, plus and minus zoom; Home restores the room view.";
    canvas.setAttribute(
      "aria-label",
      (originalLabel?.trim() || "Interactive 3D server room.") + " " + gestures,
    );
    canvas.style.touchAction = "none";
    let state = DEFAULT,
      preset = "room",
      yaw = 0.62,
      pitch = 0.47,
      distance = 11.9,
      selected = null;
    let width = 1,
      height = 1,
      objects = [],
      hits = [],
      frame = 0,
      destroyed = false;
    let centre = [0, 1.05, 0],
      eye = [0, 0, 0],
      right = [1, 0, 0],
      up = [0, 1, 0],
      forward = [0, 0, -1],
      focal = 1;
    const listeners = [],
      pointers = new Map();
    let gesture = null,
      dragged = false;
    function listen(target, type, callback, options) {
      target.addEventListener(type, callback, options);
      listeners.push(() => target.removeEventListener(type, callback, options));
    }
    function project([x, y, z]) {
      const dx = x - eye[0],
        dy = y - eye[1],
        dz = z - eye[2];
      const depth = dx * forward[0] + dy * forward[1] + dz * forward[2];
      if (depth < 0.24) return null;
      return [
        width * 0.5 + (focal * (dx * right[0] + dz * right[2])) / depth,
        height * 0.5 - (focal * (dx * up[0] + dy * up[1] + dz * up[2])) / depth,
        depth,
      ];
    }
    function shape(
      points,
      fill,
      stroke = null,
      line = 1,
      id = null,
      layer = 0,
      closed = true,
    ) {
      const depthOf = (q) =>
        (q[0] - eye[0]) * forward[0] +
        (q[1] - eye[1]) * forward[1] +
        (q[2] - eye[2]) * forward[2];
      const clipped = [];
      let prev = points[points.length - 1],
        from = depthOf(prev);
      for (let i = 0; i < points.length; i++) {
        const curr = points[i],
          to = depthOf(curr);
        if ((closed || i > 0) && from < 0.27 !== to < 0.27) {
          const f = (0.27 - from) / (to - from);
          clipped.push(prev.map((v, k) => v + (curr[k] - v) * f));
        }
        if (to >= 0.27) clipped.push(curr);
        prev = curr;
        from = to;
      }
      if (clipped.length < (closed ? 3 : 2)) return;
      const projected = clipped.map(project);
      objects.push({
        points: projected,
        depth: projected.reduce((v, p) => v + p[2], 0) / points.length,
        fill,
        stroke,
        line,
        id,
        layer,
        closed,
      });
    }
    function box(x, y, z, w, h, d, colour, id = null, layer = 0) {
      // Emit only camera-facing surfaces to keep thin details legible at every orbit angle.
      const a = x - w / 2,
        b = x + w / 2,
        l = z - d / 2,
        r = z + d / 2,
        t = y + h;
      const edge = "#354443";
      if (eye[1] > t)
        shape(
          [
            [a, t, l],
            [b, t, l],
            [b, t, r],
            [a, t, r],
          ],
          blend(colour, 1.19),
          edge,
          0.65,
          id,
          layer,
        );
      if (eye[1] < y)
        shape(
          [
            [a, y, l],
            [a, y, r],
            [b, y, r],
            [b, y, l],
          ],
          blend(colour, 0.62),
          edge,
          0.65,
          id,
          layer,
        );
      if (eye[0] > b)
        shape(
          [
            [b, y, l],
            [b, t, l],
            [b, t, r],
            [b, y, r],
          ],
          blend(colour, 0.79),
          edge,
          0.65,
          id,
          layer,
        );
      if (eye[0] < a)
        shape(
          [
            [a, y, l],
            [a, y, r],
            [a, t, r],
            [a, t, l],
          ],
          blend(colour, 0.89),
          edge,
          0.65,
          id,
          layer,
        );
      if (eye[2] > r)
        shape(
          [
            [a, y, r],
            [b, y, r],
            [b, t, r],
            [a, t, r],
          ],
          colour,
          edge,
          0.65,
          id,
          layer,
        );
      if (eye[2] < l)
        shape(
          [
            [a, y, l],
            [a, t, l],
            [b, t, l],
            [b, y, l],
          ],
          blend(colour, 0.92),
          edge,
          0.65,
          id,
          layer,
        );
    }
    function stroke(points, colour, line = 1, layer = 0) {
      shape(points, null, colour, line, null, layer, false);
    }
    function textAt(
      point,
      label,
      colour,
      size = 10,
      align = "center",
      layer = 1,
    ) {
      const p = project(point);
      if (p)
        objects.push({
          label,
          points: [p],
          depth: p[2],
          fill: colour,
          size,
          align,
          layer,
        });
    }
    function floorMark(x, z, w, d, fill, outline, id) {
      shape(
        [
          [x - w / 2, 0.017, z - d / 2],
          [x + w / 2, 0.017, z - d / 2],
          [x + w / 2, 0.017, z + d / 2],
          [x - w / 2, 0.017, z + d / 2],
        ],
        fill,
        outline,
        1,
        id,
        -3,
      );
    }
    function drawRoom() {
      const floor = "#a8bbb3",
        wall = "#c5d2cb";
      box(0, -0.19, 0, 9, 0.19, 6.7, floor, null, -5);
      for (let x = -4; x <= 4; x++)
        stroke(
          [
            [x, 0.003, -3.34],
            [x, 0.003, 3.34],
          ],
          "#96a99e",
          0.65,
          -4,
        );
      for (let z = -3; z <= 3; z++)
        stroke(
          [
            [-4.48, 0.003, z],
            [4.48, 0.003, z],
          ],
          "#96a99e",
          0.65,
          -4,
        );
      // Hide a cutaway wall when the camera moves behind it.
      if (eye[2] > -2.85) {
        box(0, 0, -3.39, 9, 2.6, 0.14, wall, null, -5);
        for (let x = -4; x < 5; x++)
          stroke(
            [
              [x, 0.08, -3.309],
              [x, 2.56, -3.309],
            ],
            "#a5b8b0",
            0.7,
            -4,
          );
        box(0, 0.04, -3.28, 8.9, 0.12, 0.09, "#2f4544", null, -4);
        box(-2.72, 0.08, -3.23, 1.22, 2.28, 0.11, "#263638", "door", -4);
        box(-2.72, 0.1, -3.16, 1.05, 2.12, 0.065, "#a6b9b0", "door", -4);
        box(-2.72, 1.37, -3.11, 0.48, 0.48, 0.036, "#304b51", "door", -4);
        box(-2.38, 0.94, -3.07, 0.17, 0.045, 0.06, "#bdc9af", "door", -4);
        box(-2.72, 2.41, -3.22, 0.55, 0.12, 0.08, "#98c996", "door", -4);
        for (const x of [-0.75, 2.12]) {
          box(x, 2.28, -3.18, 1.48, 0.12, 0.25, "#37484b", null, -4);
          box(x, 2.27, -3.03, 1.34, 0.055, 0.027, "#ffffd7", null, -4);
        }
      }
      if (eye[0] > -3.95) {
        box(-4.52, 0, 0, 0.14, 1.56, 6.7, wall, null, -5);
        box(-4.43, 0.04, 0, 0.07, 0.12, 6.65, "#304441", null, -4);
        for (let z = -3; z < 4; z++)
          stroke(
            [
              [-4.441, 0.08, z],
              [-4.441, 1.53, z],
            ],
            "#a5b8b0",
            0.7,
            -4,
          );
      }
      // Cable basket and wall-mounted power distribution along the rear aisle.
      for (let x = -1.42; x < 3.53; x += 0.25)
        box(x, 1.65, -2.99, 0.022, 0.038, 0.26, "#819390", null, -3.5);
      box(1, 1.65, -2.84, 4.9, 0.075, 0.04, "#869a96", null, -3.5);
      box(-1.78, 0.63, -3.06, 0.56, 0.85, 0.24, "#81908d", null, -3.5);
      for (let j = 0; j < 3; j++)
        box(
          -1.78,
          0.84 + 0.14 * j,
          -2.925,
          0.34,
          0.072,
          0.038,
          "#303e40",
          null,
          -3.5,
        );
      // Cooler: air intake louvres, service handle and top fan.
      box(3.62, 0.04, -2.22, 1.1, 2.13, 0.78, "#cbd2c6", "cooler");
      box(3.62, 0.21, -1.812, 0.89, 1.53, 0.04, "#405658", "cooler");
      for (let k = 0; k < 12; k++)
        box(
          3.62,
          0.26 + k * 0.123,
          -1.776,
          0.81,
          0.038,
          0.03,
          "#81969a",
          "cooler",
        );
      box(3.62, 1.82, -1.788, 0.56, 0.18, 0.045, "#354848", "cooler");
      box(3.63, 1.88, -1.754, 0.23, 0.043, 0.02, "#b1d9b1", "cooler");
      for (const [key, [x, z]] of Object.entries(BAYS)) {
        const active = key === state.bay,
          accent = key === "service" ? "#426d57" : "#786236";
        floorMark(
          x,
          z,
          1.95,
          2.26,
          active ? "#bdd5c1" : "#c4cdc0",
          accent,
          key,
        );
        for (const sign of [-1, 1]) {
          floorMark(x, z + sign * 1.38, 1.75, 0.45, "#ccd8c7", "#829b85", key);
          for (let k = 0; k < 5; k++)
            stroke(
              [
                [x - 0.72 + k * 0.28, 0.025, z + sign * 1.23],
                [x - 0.56 + k * 0.28, 0.025, z + sign * 1.49],
              ],
              "#79947c",
              0.85,
              -2.8,
            );
        }
        if (preset === "room" && !active)
          textAt(
            [x, 0.04, z + 1.77],
            key.toUpperCase() + " BAY",
            "#304a3a",
            9,
            "center",
            -2.5,
          );
      }
    }
    function drawRack() {
      const [rx, rz] = BAYS[state.bay] || BAYS.service;
      const sign = state.facing === "hot" ? -1 : 1;
      function p(x, y, z) {
        return [rx + x * sign, y, rz + z * sign];
      }
      function part(x, y, z, w, h, d, col, id = "rack") {
        const v = p(x, y, z);
        box(...v, w, h, d, col, id);
      }
      const base = 0.33,
        u = 0.175,
        rackH = 2.69;
      function face(x, y, z, w, h, colour, id) {
        part(x, y, z, w, h, 0.021, colour, id);
      }
      function wire(arr, colour, thickness) {
        const points = arr.map((v) => p(...v));
        for (let i = 1; i < points.length; i++) {
          stroke([points[i - 1], points[i]], "#1b2426", thickness + 2);
          stroke([points[i - 1], points[i]], colour, thickness);
        }
      }
      floorMark(rx + 0.08, rz + 0.12, 1.63, 1.55, "#87998b", null, "rack");
      part(0, 0.11, 0, 1.51, 0.16, 1.17, "#3e4c4f");
      for (const x of [-0.61, 0.61])
        for (const z of [-0.44, 0.44]) {
          part(x, 0.009, z, 0.18, 0.105, 0.17, "#252c2a");
          part(x, 0.24, z, 0.092, rackH - 0.24, 0.093, "#6c7979");
        }
      part(0, 2.61, 0, 1.51, 0.12, 1.17, "#a5b4ad");
      for (let i = 0; i < 6; i++)
        part(-0.4 + i * 0.16, 2.736, -0.08, 0.065, 0.009, 0.42, "#405053");
      part(0, 0.25, -0.52, 1.32, 0.075, 0.05, "#384346");
      for (const x of [-0.72, 0.72]) {
        part(x, 0.23, 0, 0.055, 2.4, 1.13, "#74868a");
        for (let i = 0; i < 5; i++)
          part(x * 1.041, 2.22, -0.35 + i * 0.16, 0.014, 0.2, 0.065, "#334246");
      }
      // Continuous rails and rack ears with one mounting marker per unit.
      for (const x of [-0.63, 0.63]) {
        part(x, 0.27, 0.545, 0.073, 2.29, 0.08, "#98a39b");
        for (let j = 0; j < 12; j++)
          face(x, base + j * u + 0.05, 0.59, 0.024, 0.038, "#263338");
      }
      for (let j = 0; j < 12; j++) {
        const y = base + j * u;
        part(0, y + 0.007, -0.36, 1.15, 0.025, 0.22, "#526360");
        if (preset !== "room" && (eye[2] - rz) * sign > 0)
          textAt(
            p(-0.657, y + 0.073, 0.615),
            String(j + 1).padStart(2, "0"),
            "#243f37",
            8,
            "right",
          );
      }
      // Rear power strip and terminal detail.
      part(-0.63, 0.35, -0.565, 0.085, 2.12, 0.085, "#303837");
      for (let j = 0; j < 8; j++)
        face(-0.63, 0.46 + j * 0.205, -0.615, 0.044, 0.052, "#9d9d8d", "rack");
      for (const [id, def] of Object.entries(EQUIPMENT)) {
        const slot = Number(state.slots[id]);
        if (!slot) continue;
        const y = base + (slot - 1) * u,
          h = def.height * u - 0.02;
        part(0, y, 0, 1.22, h, 1, def.case, id);
        face(0, y, 0.57, 1.24, h, selected === id ? "#bad793" : def.face, id);
        face(0, y, -0.558, 1.18, h, def.face, id);
        for (const x of [-0.575, 0.575]) {
          face(x, y + 0.018, 0.6, 0.026, 0.035, "#2e3735", id);
          face(x, y + h - 0.05, 0.6, 0.026, 0.033, "#303834", id);
        }
        if (id === "patch" || id === "switch") {
          for (let j = 0; j < 12; j++) {
            const x = -0.44 + j * 0.074;
            face(x, y + 0.055, 0.591, 0.053, 0.051, "#1c2b2c", id);
            if (id === "switch")
              face(
                x,
                y + 0.118,
                0.595,
                0.024,
                0.013,
                state.powered ? "#b7eb92" : "#728073",
                id,
              );
          }
        } else if (id === "server") {
          for (let j = 0; j < 6; j++) {
            const x = -0.4 + j * 0.115;
            face(x, y + 0.044, 0.593, 0.086, h - 0.085, "#344448", id);
            face(x, y + 0.085, 0.605, 0.055, 0.021, "#98aaa2", id);
          }
          face(
            0.409,
            y + 0.13,
            0.602,
            0.086,
            0.046,
            state.powered ? "#99d695" : "#607069",
            id,
          );
        } else {
          for (let row = 0; row < 3; row++)
            for (let col = 0; col < 7; col++)
              face(
                -0.46 + col * 0.083,
                y + 0.058 + row * 0.065,
                0.596,
                0.06,
                0.024,
                "#242d32",
                id,
              );
          face(0.29, y + 0.105, 0.594, 0.24, 0.102, "#2c4545", id);
          face(
            0.29,
            y + 0.135,
            0.609,
            0.14,
            0.032,
            state.powered ? "#a7d68d" : "#6d8277",
            id,
          );
        }
        if (preset === "rack" && (eye[2] - rz) * sign > 1.3) {
          textAt(p(0.455, y + h - 0.045, 0.625), def.tag, "#152a27", 8);
        }
        for (let j = 0; j < 3; j++) {
          face(-0.42 + j * 0.14, y + 0.042, -0.578, 0.09, 0.076, "#253135", id);
        }
        face(0.34, y + 0.045, -0.578, 0.16, 0.082, "#202b30", id);
      }
      const je = (id, offset = 0.08) =>
        base + (Number(state.slots[id]) - 1) * u + offset;
      for (const id of ["server", "switch"]) {
        if (state.slots[id])
          wire(
            [
              [0.34, je(id), -0.61],
              [0.35, je(id) - 0.065, -0.685],
              [-0.5, je(id) - 0.09, -0.69],
              [-0.63, je(id) - 0.04, -0.625],
            ],
            "#8c958a",
            2,
          );
      }
      if (state.cables.power && state.slots.ups)
        wire(
          [
            [0.34, je("ups"), -0.61],
            [0.37, je("ups") - 0.06, -0.72],
            [0.5, je("ups") - 0.09, -0.73],
            [0.51, 0.29, -0.73],
            [-0.52, 0.26, -0.73],
            [-0.63, 0.42, -0.625],
          ],
          "#e8ad68",
          3.3,
        );
      if (state.cables.uplink && state.slots.patch && state.slots.switch)
        wire(
          [
            [-0.35, je("patch"), 0.608],
            [-0.35, je("patch") - 0.07, 0.72],
            [-0.49, je("patch") - 0.12, 0.74],
            [-0.49, je("switch") - 0.074, 0.74],
            [-0.4, je("switch"), 0.61],
          ],
          "#b2d77c",
          3,
        );
      if (state.cables.host && state.slots.switch && state.slots.server)
        wire(
          [
            [0.22, je("switch"), 0.61],
            [0.32, je("switch") - 0.07, 0.7],
            [0.77, je("switch") - 0.1, 0.69],
            [0.78, je("server") - 0.07, -0.69],
            [-0.42, je("server") - 0.06, -0.7],
            [-0.42, je("server"), -0.61],
          ],
          "#78ccda",
          3,
        );
    }
    function camera(name, announceReset = false) {
      const previous = preset;
      preset = ["room", "rack", "rear"].includes(name) ? name : "room";
      const flipped = state.facing === "hot" ? Math.PI : 0;
      if (preset === "room") {
        yaw = 0.59;
        pitch = 0.49;
        distance = 11.9;
      } else {
        yaw = flipped + (preset === "rear" ? Math.PI + 0.3 : 0.24);
        pitch = 0.15;
        distance = 4.1;
      }
      if (previous !== preset || announceReset)
        canvas.dispatchEvent(
          new CustomEvent("roomcamera", { detail: preset, bubbles: true }),
        );
      queue();
    }
    function draw() {
      frame = 0;
      if (destroyed) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(width * ratio),
        h = Math.round(height * ratio);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const backdrop = ctx.createLinearGradient(0, 0, 0, height);
      backdrop.addColorStop(0, "#f3faf7");
      backdrop.addColorStop(1, "#d5e4de");
      ctx.fillStyle = backdrop;
      ctx.fillRect(0, 0, width, height);
      const [rx, rz] = BAYS[state.bay] || BAYS.service;
      centre = preset === "room" ? [0, 1, 0] : [rx, 1.45, rz];
      const s = Math.sin(yaw),
        c = Math.cos(yaw),
        cp = Math.cos(pitch),
        sp = Math.sin(pitch);
      eye = [
        centre[0] + s * cp * distance,
        centre[1] + sp * distance,
        centre[2] + c * cp * distance,
      ];
      right = [c, 0, -s];
      forward = [-s * cp, -sp, -c * cp];
      up = [-s * sp, cp, -c * sp];
      focal =
        preset === "room"
          ? Math.min(height * 1.29, width * 1.06)
          : Math.min(height * 1.17, width * 1.5);
      objects = [];
      hits = [];
      drawRoom();
      drawRack();
      objects.sort((a, b) => a.layer - b.layer || b.depth - a.depth);
      const rendered = depthPass?.paint(ctx, objects, width, height, ratio);
      for (const obj of objects) {
        const p = obj.points;
        if (obj.label) {
          ctx.fillStyle = obj.fill;
          ctx.textAlign = obj.align;
          ctx.textBaseline = "middle";
          ctx.font = "600 " + obj.size + "px Consolas, monospace";
          ctx.fillText(obj.label, p[0][0], p[0][1]);
          continue;
        }
        if (rendered) {
          if (obj.closed && obj.fill) hits.push(obj);
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
        if (obj.closed) ctx.closePath();
        if (obj.fill) {
          ctx.fillStyle = obj.fill;
          ctx.fill();
        }
        if (obj.stroke) {
          ctx.strokeStyle = obj.stroke;
          ctx.lineWidth = obj.line;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.stroke();
        }
        if (obj.closed && obj.fill) hits.push(obj);
      }
      // A compact orientation triad stays readable while the stage rotates.
      if (width >= 330 && height >= 210) {
        const origin = [36, height - 30];
        for (const [axis, delta, col] of [
          ["X", [1, 0, 0], "#91461e"],
          ["Y", [0, 1, 0], "#37663c"],
          ["Z", [0, 0, 1], "#256474"],
        ]) {
          const dx = (delta[0] * right[0] + delta[2] * right[2]) * 16,
            dy = -(delta[0] * up[0] + delta[1] * up[1] + delta[2] * up[2]) * 16;
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.7;
          ctx.beginPath();
          ctx.moveTo(...origin);
          ctx.lineTo(origin[0] + dx, origin[1] + dy);
          ctx.stroke();
          ctx.fillStyle = col;
          ctx.font = "9px Consolas, monospace";
          ctx.textAlign = "center";
          ctx.fillText(axis, origin[0] + dx * 1.45, origin[1] + dy * 1.45);
        }
      }
    }
    function queue() {
      if (!destroyed && !frame) frame = requestAnimationFrame(draw);
    }
    function targetAt(x, y) {
      // Nearest ray intersection, not the drawing order: a front port stays
      // selectable even when its centre is farther away than the opposite rail.
      let closest = Infinity,
        id = null;
      for (const poly of hits) {
        const a = poly.points[0];
        for (let i = 1; i + 1 < poly.points.length; i++) {
          const b = poly.points[i],
            c = poly.points[i + 1];
          const det =
            (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
          if (Math.abs(det) < 0.01) continue;
          const wa =
            ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det;
          const wb =
              ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det,
            wc = 1 - wa - wb;
          if (wa < 0 || wb < 0 || wc < 0) continue;
          const depth = 1 / (wa / a[2] + wb / b[2] + wc / c[2]);
          if (depth <= closest) {
            closest = depth;
            id = poly.id;
          }
        }
      }
      return id;
    }
    function zoom(factor) {
      distance = clamp(
        distance * factor,
        preset === "room" ? 4.8 : 2.6,
        preset === "room" ? 22 : 9,
      );
      queue();
    }
    function xy(ev) {
      const r = canvas.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    }
    function beginGesture() {
      const pts = [...pointers.values()];
      if (pts.length > 1) {
        gesture = {
          span: Math.max(
            1,
            Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]),
          ),
          distance,
        };
        dragged = true;
      } else if (pts.length) gesture = { start: pts[0], yaw, pitch };
      else gesture = null;
    }
    listen(canvas, "pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!pointers.size) dragged = false;
      pointers.set(e.pointerId, xy(e));
      canvas.setPointerCapture(e.pointerId);
      canvas.focus({ preventScroll: true });
      beginGesture();
      canvas.style.cursor = "grabbing";
    });
    listen(canvas, "pointermove", (e) => {
      const pos = xy(e);
      if (!pointers.has(e.pointerId)) {
        canvas.style.cursor = targetAt(...pos) ? "pointer" : "grab";
        return;
      }
      pointers.set(e.pointerId, pos);
      const pts = [...pointers.values()];
      if (pts.length >= 2 && gesture?.span) {
        const span = Math.max(
          1,
          Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]),
        );
        zoom((gesture.distance * gesture.span) / (span * distance));
        return;
      }
      if (!gesture?.start) return;
      const dx = pos[0] - gesture.start[0],
        dy = pos[1] - gesture.start[1];
      if (Math.hypot(dx, dy) > 4) dragged = true;
      if (dragged) {
        yaw = gesture.yaw - dx * 0.009;
        pitch = clamp(gesture.pitch + dy * 0.006, 0.045, 1.24);
        queue();
      }
    });
    function release(e, cancelled) {
      if (!pointers.has(e.pointerId)) return;
      if (!cancelled && !dragged && pointers.size === 1) {
        const id = targetAt(...xy(e));
        if (id) {
          selected = id;
          onPick?.(id);
          queue();
        }
      }
      pointers.delete(e.pointerId);
      if (canvas.hasPointerCapture(e.pointerId))
        canvas.releasePointerCapture(e.pointerId);
      beginGesture();
      canvas.style.cursor = "grab";
    }
    listen(canvas, "pointerup", (e) => release(e, false));
    listen(canvas, "pointercancel", (e) => release(e, true));
    listen(canvas, "lostpointercapture", (e) => release(e, true));
    listen(
      canvas,
      "wheel",
      (e) => {
        e.preventDefault();
        zoom(Math.exp(clamp(e.deltaY, -160, 160) * 0.002));
      },
      { passive: false },
    );
    listen(canvas, "keydown", (e) => {
      switch (e.key) {
        case "ArrowLeft":
          yaw -= 0.13;
          break;
        case "ArrowRight":
          yaw += 0.13;
          break;
        case "ArrowUp":
          pitch = clamp(pitch + 0.1, 0.045, 1.24);
          break;
        case "ArrowDown":
          pitch = clamp(pitch - 0.1, 0.045, 1.24);
          break;
        case "+":
        case "=":
          zoom(0.86);
          break;
        case "-":
        case "_":
          zoom(1.16);
          break;
        case "Home":
          camera("room", true);
          break;
        default:
          return;
      }
      e.preventDefault();
      queue();
    });
    const observer = new ResizeObserver(queue);
    observer.observe(canvas);
    canvas.style.cursor = "grab";
    queue();
    return {
      update(next) {
        const previousFacing = state.facing;
        if (next && Object.hasOwn(next, "selected"))
          selected = Object.hasOwn(EQUIPMENT, next.selected)
            ? next.selected
            : null;
        state = {
          ...state,
          ...next,
          slots: { ...state.slots, ...next?.slots },
          cables: { ...state.cables, ...next?.cables },
        };
        if (preset !== "room" && previousFacing !== state.facing)
          camera(preset);
        else queue();
      },
      camera,
      destroy() {
        destroyed = true;
        depthPass?.destroy();
        cancelAnimationFrame(frame);
        observer.disconnect();
        listeners.forEach((remove) => remove());
        pointers.clear();
        hits = [];
        objects = [];
        if (originalLabel === null) canvas.removeAttribute("aria-label");
        else canvas.setAttribute("aria-label", originalLabel);
        if (originalTabIndex === null) canvas.removeAttribute("tabindex");
        else canvas.setAttribute("tabindex", originalTabIndex);
        canvas.style.touchAction = originalTouchAction;
        canvas.style.cursor = originalCursor;
      },
    };
  }
  window.SignalRoom = Object.freeze({ createRoomView });
})();
