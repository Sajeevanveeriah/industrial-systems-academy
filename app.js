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
const previewState = {
  bay: "service",
  facing: "cold",
  slots: { ups: 1, server: 5, switch: 9, patch: 10 },
  cables: { power: true, uplink: true, host: true },
  powered: true,
};
let roomPreview = null,
  sitePreview = null;
function stopRoomPreview() {
  sitePreview?.destroy();
  sitePreview = null;
  roomPreview?.destroy();
  roomPreview = null;
}
function mountRoomPreview() {
  const canvas = document.querySelector("#room-preview");
  const status = document.querySelector("#preview-status");
  const buttons = [...document.querySelectorAll("[data-preview-camera]")];
  try {
    roomPreview = window.SignalRoom.createRoomView(canvas, () => {});
    roomPreview.update(previewState);
    function markView(name) {
      for (const button of buttons) {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.previewCamera === name),
        );
      }
    }
    function switchView(name) {
      roomPreview.camera(name);
      markView(name);
    }
    canvas.addEventListener("roomcamera", (event) => markView(event.detail));
    for (const button of buttons) {
      button.disabled = false;
      button.addEventListener("click", () =>
        switchView(button.dataset.previewCamera),
      );
    }
    canvas.addEventListener("keydown", (event) => {
      const name = { 1: "room", 2: "rack", 3: "rear" }[event.key];
      if (name) {
        event.preventDefault();
        switchView(name);
      }
    });
    switchView("room");
    status.textContent = "Drag to orbit, or choose a camera.";
    canvas.dataset.ready = "true";
  } catch {
    stopRoomPreview();
    canvas.hidden = true;
    document.querySelector(".preview-controls").hidden = true;
    status.textContent =
      "The room preview is unavailable on this device. Open the build guide for an illustrated walkthrough.";
  }
}
window.addEventListener("pagehide", stopRoomPreview);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) render();
});
function dashboard(toTracks) {
  main.innerHTML =
    '<div class="workline"><b>Your progress</b><div class="meter" aria-hidden="true"><span style="width:' +
    (lessonCount ? (completed.size / lessonCount) * 100 : 0) +
    '%"></span></div><span class="count">' +
    completed.size +
    " / " +
    lessonCount +
    " lessons passed" +
    storageNote() +
    '</span></div><section class="track-section" id="tracks"><div class="section-head"><div><h2>Learning tracks</h2><p>Study the principles behind each workstation, then apply them on the line.</p><a id="study-link" class="study-link" href="#tracks">Start learning</a></div><input class="track-search" type="search" aria-label="Find a learning track" placeholder="Find a track…"></div><div class="grid" id="track-grid"></div><p class="empty" role="status" hidden></p></section>';
  const hero = document.querySelector("#room-hero").content.cloneNode(true);
  main.prepend(hero);
  const resume = document.querySelector("#study-link");
  resume.href = nextStudy();
  resume.textContent = last ? "Resume learning" : "Start learning";
  mountRoomPreview();
  sitePreview = window.SiteScene.mount(
    document.querySelector("#fry-preview"),
    () => {},
  );
  sitePreview.draw(window.SiteBuild.solved(), null);
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
  const stations = {
    it: ["servers", "Servers and network"],
    net: ["servers", "Servers and network"],
    plc: ["plc", "PLC"],
    scada: ["scada", "SCADA"],
    robot: ["robot", "Robot cell"],
    mes: ["orders", "MES and ERP"],
    erp: ["orders", "MES and ERP"],
    systems: ["", "Integrated production workshop"],
  };
  const [station, stationTitle] = stations[t.id] || stations.systems;
  const stationLink = document.createElement("a");
  stationLink.className = "station-practice";
  stationLink.href = "production.html" + (station ? "#" + station : "");
  stationLink.textContent = "Practise in the workshop: " + stationTitle + " →";
  document.querySelector(".practice").append(stationLink);
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
  stopRoomPreview();
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
    document
      .querySelectorAll("canvas[data-track]")
      .forEach((c) => moduleDrawing(c, Number(c.dataset.track)));
  });
}
window.addEventListener("resize", scheduleDrawing, { passive: true });
render();
