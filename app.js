"use strict";
const tracks = Array.isArray(window.tracks) ? window.tracks : [];
const main = document.querySelector("main");
document.querySelector(".skip").addEventListener("click", (event) => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView({ block: "start" });
});
const stateKey = "signalworks.progress.v1";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
const trackById = (id) => tracks.find((track) => String(track.id) === id);
const keyFor = (track, index) => String(track.id) + ":" + index;
const courseLink = (track, index = 0) =>
  "#learn/" + encodeURIComponent(track.id) + "/" + index;
const lessonCount = tracks.reduce(
  (total, track) => total + track.lessons.length,
  0,
);
const validKeys = new Set(
  tracks.flatMap((t) => t.lessons.map((_, i) => keyFor(t, i))),
);
let saved = {};
let storageWorks = true;
try {
  saved = JSON.parse(localStorage.getItem(stateKey)) || {};
} catch {
  saved = {};
}
const completed = new Set(
  (Array.isArray(saved.done) ? saved.done : []).filter((k) => validKeys.has(k)),
);
let last = validKeys.has(saved.last) ? saved.last : null;
const storageNote = () =>
  storageWorks ? "" : " Progress is only available in this tab.";
function persist() {
  try {
    localStorage.setItem(
      stateKey,
      JSON.stringify({ done: [...completed], last }),
    );
  } catch {
    storageWorks = false;
  }
}
const colours = [
  ["#bcea91", "#2c3c2e"],
  ["#8bdac5", "#253c35"],
  ["#f0c086", "#42382a"],
  ["#a8c6e7", "#2b3942"],
  ["#c6afd9", "#3b3141"],
  ["#c7d789", "#363c29"],
  ["#f5b395", "#45352e"],
  ["#9dcdd4", "#2c3b3e"],
];
const labelling = [
  "RACK",
  "NETWORK",
  "CONTROL",
  "SIGNAL",
  "BATCH",
  "LEDGER",
  "MOTION",
  "SYSTEM",
];
function nextStudy() {
  if (last) {
    const [id, n] = last.split(":");
    const t = trackById(id);
    if (t && !completed.has(last)) return courseLink(t, +n);
    const pending = t?.lessons.findIndex(
      (_, i) => !completed.has(keyFor(t, i)),
    );
    if (pending >= 0) return courseLink(t, pending);
  }
  for (const t of tracks) {
    const pending = t.lessons.findIndex((_, i) => !completed.has(keyFor(t, i)));
    if (pending >= 0) return courseLink(t, pending);
  }
  return tracks.length ? courseLink(tracks[0]) : "#tracks";
}
function tile(t, index) {
  const [accent, wash] = colours[index % colours.length];
  const done = t.lessons.filter((_, i) => completed.has(keyFor(t, i))).length;
  const next = t.lessons.findIndex((_, i) => !completed.has(keyFor(t, i)));
  return (
    '<a class="tile" href="' +
    courseLink(t, Math.max(0, next)) +
    '" style="--tile:' +
    accent +
    ";--wash:" +
    wash +
    '"><div class="tile-top" aria-hidden="true"><canvas data-track="' +
    index +
    '"></canvas></div><div class="tile-details"><h3>' +
    esc(t.title) +
    "</h3><p>" +
    esc(t.summary) +
    '</p><div class="tile-foot"><small>' +
    (done
      ? done + " / " + t.lessons.length + " passed"
      : t.lessons.length + " lessons") +
    '</small><span aria-hidden="true">↗</span></div></div></a>'
  );
}
function dashboard(toTracks) {
  main.innerHTML =
    '<section class="hero"><div class="hero-copy"><div class="eyebrow"><i></i> Industrial Systems Academy</div><h1>Learn the<br>whole line.</h1><p>Follow a signal from the factory floor to the business systems above it. Build your skills in industrial IT, controls and robotics.</p><div class="actions"><a class="btn" href="' +
    nextStudy() +
    '">' +
    (last ? "Resume learning" : "Start learning") +
    ' <span aria-hidden="true">→</span></a><a class="quiet" href="labs.html">Explore sim labs <span aria-hidden="true">↗</span></a></div></div><div class="art" role="img" aria-label="Technical drawing of an articulated robot transferring a carton to a conveyor"><canvas id="robot-art"></canvas><div class="spec">FIG. 01 / PICK &amp; PLACE</div><div class="caption">ISOMETRIC STUDY / R-01</div></div></section><div class="workline"><b>Your progress</b><div class="meter" aria-hidden="true"><span style="width:' +
    (lessonCount ? (completed.size / lessonCount) * 100 : 0) +
    '%"></span></div><span class="count">' +
    completed.size +
    " / " +
    lessonCount +
    " lessons passed" +
    storageNote() +
    '</span></div><section class="track-section" id="tracks"><div class="section-head"><div><h2>Learning tracks</h2><p>Start with industrial IT, then follow the tracks in order through to systems integration.</p></div><input class="track-search" type="search" aria-label="Find a learning track" placeholder="Find a track…"></div><div class="grid" id="track-grid"></div><p class="empty" role="status" hidden></p></section>';
  const grid = document.querySelector("#track-grid");
  const empty = document.querySelector(".empty");
  function filter(query) {
    const q = query.toLowerCase().trim();
    const list = tracks
      .map((t, i) => ({ t, i }))
      .filter(({ t }) =>
        [t.id, t.title, t.summary, ...t.lessons.map((l) => l.title)]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    grid.innerHTML = list.map(({ t, i }) => tile(t, i)).join("");
    empty.hidden = !!list.length;
    empty.textContent = tracks.length
      ? "No tracks match. Try a topic such as PLC or robotics."
      : "The learning catalogue could not be loaded. Reload to try again.";
    scheduleDrawing();
  }
  filter("");
  document
    .querySelector(".track-search")
    .addEventListener("input", (e) => filter(e.target.value));
  if (toTracks)
    requestAnimationFrame(() =>
      document.querySelector("#tracks")?.scrollIntoView(),
    );
}
function readLesson(t, i) {
  const l = t.lessons[i];
  const currentKey = keyFor(t, i);
  last = currentKey;
  persist();
  const source = /^https?:\/\//.test(l.source)
    ? '<a class="reference" href="' +
      esc(l.source) +
      '" target="_blank" rel="noopener noreferrer">Read the official reference ↗</a>'
    : "";
  main.innerHTML =
    '<a class="back" href="#tracks">← Learning tracks</a><section class="course"><div class="course-head"><span class="kicker">Learning track</span><h1>' +
    esc(t.title) +
    '</h1><p class="lead">' +
    esc(t.summary) +
    '</p></div><div class="layout"><aside class="syllabus"><h2>Track lessons</h2>' +
    t.lessons
      .map(
        (lesson, j) =>
          '<a class="' +
          (i === j ? "selected" : "") +
          '" ' +
          (i === j ? 'aria-current="page"' : "") +
          ' href="' +
          courseLink(t, j) +
          '"><span>' +
          String(j + 1).padStart(2, "0") +
          "</span>" +
          esc(lesson.title) +
          (completed.has(keyFor(t, j))
            ? ' <span aria-label="Passed">✓</span>'
            : "") +
          "</a>",
      )
      .join("") +
    '</aside><article class="reading"><span class="kicker">Lesson ' +
    (i + 1) +
    " / " +
    t.lessons.length +
    "</span><h2>" +
    esc(l.title) +
    "</h2><p>" +
    esc(l.concept) +
    "</p><h3>Worked example</h3><p>" +
    esc(l.example) +
    '</p><section class="practice"><h3>Try it yourself</h3><p>' +
    esc(l.practice) +
    "</p></section>" +
    source +
    '<section class="quiz"><h3>Knowledge check</h3><p class="question">' +
    esc(l.question) +
    '</p><div class="choices">' +
    l.choices
      .map(
        (c, j) =>
          '<button type="button" class="choice" data-choice="' +
          j +
          '"><span>' +
          String.fromCharCode(65 + j) +
          "</span>" +
          esc(c) +
          "</button>",
      )
      .join("") +
    '</div><p class="feedback" aria-live="polite"></p></section><div class="lesson-next"></div></article></div></section>';
  const feedback = document.querySelector(".feedback");
  function showNext() {
    const next = i + 1 < t.lessons.length ? courseLink(t, i + 1) : "#tracks";
    document.querySelector(".lesson-next").innerHTML =
      '<a class="btn" href="' +
      next +
      '">' +
      (i + 1 < t.lessons.length ? "Next lesson" : "Back to tracks") +
      " →</a>";
  }
  if (completed.has(currentKey)) {
    feedback.textContent = "Previously passed." + storageNote();
    showNext();
  }
  document.querySelector(".choices").addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const correct = Number(btn.dataset.choice) === Number(l.answer);
    document
      .querySelectorAll(".choice")
      .forEach((b) => b.classList.remove("selected", "wrong"));
    btn.classList.add(correct ? "selected" : "wrong");
    feedback.classList.toggle("error", !correct);
    if (correct) {
      completed.add(currentKey);
      persist();
      showNext();
      const selected = document.querySelector(".syllabus a.selected");
      if (!selected.querySelector('[aria-label="Passed"]'))
        selected.insertAdjacentHTML(
          "beforeend",
          ' <span aria-label="Passed">✓</span>',
        );
    }
    feedback.innerHTML =
      "<strong>" +
      (correct ? "Correct." : "Not quite. Try again.") +
      "</strong> " +
      esc(l.why) +
      esc(storageNote());
  });
}
function render() {
  const hash = location.hash.slice(1);
  const m = /^learn\/([^/]+)\/(\d+)$/.exec(hash);
  let track;
  if (m) {
    try {
      track = trackById(decodeURIComponent(m[1]));
    } catch {
      /* Invalid encoded route. */
    }
  }
  const isLesson = track && track.lessons[Number(m[2])];
  document
    .querySelector("#home-nav")
    .classList.toggle("active", !isLesson && hash !== "tracks");
  document
    .querySelector("#tracks-nav")
    .classList.toggle("active", !!isLesson || hash === "tracks");
  document.querySelectorAll("header nav a").forEach((a) => {
    if (a.classList.contains("active")) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = isLesson
    ? track.lessons[Number(m[2])].title + " | Signal Works"
    : "Signal Works | Industrial Systems Academy";
  window.scrollTo({ top: 0, behavior: "instant" });
  if (isLesson) readLesson(track, Number(m[2]));
  else dashboard(hash === "tracks");
}
window.addEventListener("hashchange", () => {
  render();
  main.focus({ preventScroll: true });
});
function canvasFrame(canvas, w, h) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  const size = Math.min(rect.width / w, rect.height / h);
  ctx.translate((rect.width - w * size) / 2, (rect.height - h * size) / 2);
  ctx.scale(size, size);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return ctx;
}
function robotDrawing(canvas) {
  const c = canvasFrame(canvas, 510, 315);
  if (!c) return;
  const ink = "#243b2d",
    shadow = "#567650",
    mint = "#cce6ac",
    light = "#e6f3ce",
    mid = "#9dbd82";
  function path(points, fill, stroke = ink, width = 1.7, close = true) {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    if (close) c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.stroke();
    }
  }
  const line = (pts, col = ink, width = 1.4) =>
    path(pts, null, col, width, false);
  function oval(x, y, rx, ry, fill, stroke = ink, width = 1.7) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.stroke();
    }
  }
  function block(x, y, w, d, h, top = light, left = mid, right = shadow) {
    const a = [x, y],
      b = [x + w, y + w * 0.36],
      e = [x + w + d, y + (w - d) * 0.36],
      f = [x + d, y - d * 0.36];
    path([a, b, [b[0], b[1] + h], [x, y + h]], left);
    path([b, e, [e[0], e[1] + h], [b[0], b[1] + h]], right);
    path([a, f, e, b], top);
  }
  c.save();
  c.globalAlpha = 0.18;
  for (let n = -1400; n <= 1400; n += 23) {
    line(
      [
        [n, -100],
        [n + 900, 350],
      ],
      shadow,
      0.65,
    );
    line(
      [
        [n, -100],
        [n - 900, 350],
      ],
      shadow,
      0.65,
    );
  }
  c.restore();
  c.save();
  c.setLineDash([4, 5]);
  oval(239, 246, 142, 38, null, "#829e6b", 1);
  line(
    [
      [54, 247],
      [323, 302],
    ],
    "#78976c",
    1,
  );
  line(
    [
      [285, 40],
      [285, 240],
    ],
    "#78976c",
    1,
  );
  c.restore();
  path(
    [
      [65, 253],
      [166, 291],
      [264, 256],
      [171, 224],
    ],
    "#96ba76",
    null,
  );
  block(65, 243, 91, 83, 10, mid, "#92aa72", shadow);
  block(76, 236, 75, 69, 8, light, mid, shadow);
  oval(148, 236, 43, 14, shadow);
  path(
    [
      [105, 224],
      [105, 236],
      [148, 250],
      [191, 236],
      [191, 224],
    ],
    shadow,
    null,
  );
  oval(148, 224, 43, 14, mid);
  oval(148, 219, 35, 12, mint);
  path(
    [
      [119, 215],
      [120, 194],
      [132, 180],
      [153, 176],
      [173, 189],
      [178, 211],
      [167, 221],
      [144, 226],
    ],
    mid,
  );
  // Each arm casting has a shaded extrusion and a machined front face.
  function link(a, b, wa, wb) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy),
      nx = -dy / len,
      ny = dx / len;
    const face = [
      [a[0] + nx * wa, a[1] + ny * wa],
      [b[0] + nx * wb, b[1] + ny * wb],
      [b[0] - nx * wb, b[1] - ny * wb],
      [a[0] - nx * wa, a[1] - ny * wa],
    ];
    const rear = face.map(([x, y]) => [x + 12, y - 6]);
    path(rear, mid);
    face.forEach((p, j) =>
      path(
        [p, rear[j], rear[(j + 1) % 4], face[(j + 1) % 4]],
        j % 2 ? mid : shadow,
      ),
    );
    path(face, mint);
    line(
      [
        [a[0] + nx * (wa - 5), a[1] + ny * (wa - 5)],
        [b[0] + nx * (wb - 4), b[1] + ny * (wb - 4)],
      ],
      light,
      2.3,
    );
  }
  function joint(x, y, r) {
    oval(x + 9, y - 4, r, r, shadow);
    oval(x, y, r, r, mid);
    oval(x, y, r * 0.72, r * 0.72, mint);
    oval(x, y, r * 0.34, r * 0.34, shadow);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      oval(
        x + Math.cos(a) * r * 0.84,
        y + Math.sin(a) * r * 0.84,
        1.1,
        1.1,
        ink,
        null,
      );
    }
  }
  // Conveyor sits behind the robot wrist.
  block(295, 237, 10, 7, 29, mid, mid, shadow);
  block(409, 224, 10, 7, 30, mid, mid, shadow);
  block(327, 252, 10, 7, 28, mid, mid, shadow);
  block(435, 215, 10, 7, 29, mid, mid, shadow);
  block(285, 228, 47, 120, 13, mid, mid, shadow);
  for (let i = 0; i < 13; i++) {
    let x = 290 + i * 9.2,
      y = 228 - i * 3.31;
    line(
      [
        [x, y],
        [x + 39, y + 14],
      ],
      ink,
      3.4,
    );
    line(
      [
        [x, y - 0.6],
        [x + 39, y + 13.4],
      ],
      light,
      1.5,
    );
  }
  block(354, 199, 30, 27, 22, "#f4ebba", "#cebd82", "#b79862");
  line(
    [
      [366, 195],
      [396, 206],
      [396, 218],
    ],
    "#786d4c",
    2.5,
  );
  link([145, 196], [186, 112], 16, 13);
  joint(145, 196, 21);
  link([186, 112], [264, 73], 14, 10);
  joint(186, 112, 19);
  link([264, 73], [306, 111], 11, 9);
  joint(264, 73, 15);
  joint(306, 111, 12);
  link([306, 111], [316, 133], 7, 6);
  oval(316, 134, 11, 4, mid);
  path(
    [
      [308, 134],
      [304, 143],
      [305, 154],
      [311, 154],
      [310, 145],
      [314, 138],
    ],
    shadow,
  );
  path(
    [
      [321, 133],
      [330, 139],
      [332, 148],
      [326, 150],
      [324, 143],
      [318, 139],
    ],
    mid,
  );
  block(291, 151, 28, 24, 22, "#f4ebba", "#cebd82", "#b79862");
  line(
    [
      [301, 147],
      [329, 157],
      [329, 168],
    ],
    "#786d4c",
    2.6,
  );
  // Service harness routes round the outside of the elbow.
  c.beginPath();
  c.moveTo(140, 177);
  c.bezierCurveTo(152, 163, 147, 121, 169, 104);
  c.bezierCurveTo(187, 88, 202, 105, 225, 87);
  c.strokeStyle = ink;
  c.lineWidth = 4.6;
  c.stroke();
  c.strokeStyle = "#829d74";
  c.lineWidth = 1.5;
  c.stroke();
  line(
    [
      [178, 89],
      [153, 64],
      [91, 64],
    ],
    "#48694a",
    1,
  );
  oval(178, 89, 2, 2, ink, null);
  line(
    [
      [335, 164],
      [359, 150],
      [423, 150],
    ],
    "#48694a",
    1,
  );
  oval(335, 164, 2, 2, ink, null);
  c.font = "9px Consolas, monospace";
  c.fillStyle = ink;
  c.fillText("AXIS / J2", 92, 59);
  c.fillText("END EFFECTOR", 361, 145);
}
function moduleDrawing(canvas, index) {
  const c = canvasFrame(canvas, 235, 85);
  if (!c) return;
  const accent = colours[index % colours.length][0];
  c.strokeStyle = accent;
  c.fillStyle = accent;
  c.lineWidth = 1.55;
  const draw = (points) => {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  };
  const box = (x, y, w, h) => c.strokeRect(x, y, w, h);
  const ring = (x, y, r) => {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
  };
  c.save();
  c.globalAlpha = 0.17;
  for (let x = -240; x < 500; x += 11) {
    for (let y = 5; y < 85; y += 11) c.fillRect(x, y, 1, 1);
  }
  c.restore();
  c.font = "9px Consolas, monospace";
  c.fillText(
    labelling[index % 8] + " / " + String(index + 1).padStart(2, "0"),
    10,
    16,
  );
  switch (index % 8) {
    case 0:
      for (let j = 0; j < 3; j++) {
        const y = 17 + j * 14;
        box(113, y, 82, 11);
        for (let i = 0; i < 6; i++)
          draw([
            [122 + i * 4, y + 3],
            [122 + i * 4, y + 8],
          ]);
        ring(184, y + 5.5, 1.7);
      }
      break;
    case 1:
      for (const [x, y] of [
        [112, 18],
        [112, 58],
        [188, 14],
        [190, 57],
      ]) {
        draw([
          [153, 40],
          [x, 40],
          [x, y],
        ]);
        box(x - 6, y - 4, 12, 8);
      }
      box(145, 34, 16, 12);
      break;
    case 2:
      for (let j = 0; j < 2; j++) {
        const y = 28 + j * 23;
        draw([
          [97, y],
          [119, y],
        ]);
        draw([
          [119, y - 6],
          [119, y + 6],
        ]);
        draw([
          [126, y - 6],
          [126, y + 6],
        ]);
        draw([
          [126, y],
          [173, y],
        ]);
        ring(180, y, 6);
        draw([
          [186, y],
          [201, y],
        ]);
      }
      draw([
        [97, 16],
        [97, 64],
      ]);
      draw([
        [201, 16],
        [201, 64],
      ]);
      break;
    case 3:
      box(94, 15, 105, 45);
      draw([
        [98, 44],
        [110, 45],
        [119, 35],
        [131, 39],
        [139, 23],
        [148, 52],
        [158, 42],
        [168, 44],
        [175, 29],
        [183, 36],
        [194, 29],
      ]);
      break;
    case 4:
      for (let j = 0; j < 3; j++) {
        box(96 + j * 33, 30, 23, 20);
        draw([
          [100 + j * 33, 35],
          [113 + j * 33, 35],
        ]);
        if (j < 2)
          draw([
            [120 + j * 33, 40],
            [128 + j * 33, 40],
          ]);
      }
      break;
    case 5:
      box(103, 15, 88, 46);
      for (let j = 1; j < 4; j++)
        draw([
          [103, 15 + j * 11],
          [191, 15 + j * 11],
        ]);
      draw([
        [128, 15],
        [128, 61],
      ]);
      for (let j = 0; j < 3; j++)
        draw([
          [137, 32 + j * 11],
          [146 + j * 7, 32 + j * 11],
        ]);
      break;
    case 6:
      draw([
        [102, 59],
        [131, 29],
        [161, 20],
        [183, 40],
      ]);
      for (const [x, y] of [
        [102, 59],
        [131, 29],
        [161, 20],
        [183, 40],
      ])
        ring(x, y, 5);
      draw([
        [177, 49],
        [183, 43],
        [191, 46],
      ]);
      break;
    default:
      for (let j = 0; j < 3; j++) {
        const y = 15 + j * 12;
        draw([
          [102, y + 12],
          [148, y],
          [193, y + 12],
          [148, y + 24],
          [102, y + 12],
        ]);
      }
      break;
  }
}
let pendingFrame;
function scheduleDrawing() {
  cancelAnimationFrame(pendingFrame);
  pendingFrame = requestAnimationFrame(() => {
    const art = document.querySelector("#robot-art");
    if (art) robotDrawing(art);
    document
      .querySelectorAll("canvas[data-track]")
      .forEach((c) => moduleDrawing(c, Number(c.dataset.track)));
  });
}
window.addEventListener("resize", scheduleDrawing, { passive: true });
render();
