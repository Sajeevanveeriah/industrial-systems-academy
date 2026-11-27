import { copyFile, mkdir, readdir } from "node:fs/promises";

const assets = [
  "index.html",
  "stage-lessons.html",
  "stage-handbook.pdf",
  "stage-narration.js",
  "stage-course.js",
  "stage-course.css",
  "study.html",
  "study.css",
  "study-link.js",
  "study-film.mp4",
  "study-film.vtt",
  "study-notes.pdf",
  "app.js",
  "style.css",
  "lessons.js",
  "labs.html",
  "labs.js",
  "labs.css",
  "fieldwork.html",
  "fieldwork.js",
  "fieldwork.css",
  "room.html",
  "room.js",
  "room.css",
  "room-view.js",
  "room-guide.html",
  "room-guide.css",
  "room-sizing.js",
  "production.html",
  "production.css",
  "production.js",
  "production-machines.js",
  "production-controls.js",
  "line-sequence.js",
  "line-scene.js",
  "line-workspace.js",
  "line-workspace.css",
  "equipment.html",
  "equipment.css",
  "equipment.js",
  "vendor-labs.html",
  "vendor-labs.js",
  "vendor-momentum.js",
  "vendor-aveva.js",
  "vendor-aps.js",
  "sap-practice.js",
  "fries.html",
  "facility-services.html",
  "facility-services.js",
  "facility-services.css",
  "fries.css",
  "fries.js",
  "batch-momentum.js",
  "batch-aps.js",
  "batch-aveva.js",
  "batch-journey.js",
  "batch-journey.css",
  "plant-path.js",
  "site-guide.js",
  "site-build.js",
  "site-build.css",
  "site-scene.js",
  "fry-scene.js",
  "fry-rack.js",
  "fry-process.js",
  "fry-install.js",
  "fry-install.css",
  "fry-ledger.js",
  "fry-ledger.css",
];
const output = new URL("./dist/", import.meta.url);
await mkdir(output, { recursive: true });
const existing = await readdir(output);
if (existing.some((file) => file !== "stage-media" && !assets.includes(file))) {
  throw new Error(
    "dist contains unexpected files. Use a clean checkout to build the public site.",
  );
}
for (const file of assets) {
  await copyFile(new URL(file, import.meta.url), new URL(file, output));
}
const stageFolder = new URL("stage-media/", output);
await mkdir(stageFolder, { recursive: true });
const films = [
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
].flatMap((id) => [id + ".mp4", id + ".vtt"]);
if ((await readdir(stageFolder)).some((f) => !films.includes(f)))
  throw Error("Unexpected files in staged media directory.");
for (const film of films)
  await copyFile(
    new URL("stage-media/" + film, import.meta.url),
    new URL(film, stageFolder),
  );
console.log(`Packaged ${assets.length + films.length} site assets in dist/`);
