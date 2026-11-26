import { copyFile, mkdir, readdir } from "node:fs/promises";

const assets = [
  "index.html",
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
];
const output = new URL("./dist/", import.meta.url);
await mkdir(output, { recursive: true });
const existing = await readdir(output);
if (existing.some((file) => !assets.includes(file))) {
  throw new Error(
    "dist contains unexpected files. Use a clean checkout to build the public site.",
  );
}
for (const file of assets) {
  await copyFile(new URL(file, import.meta.url), new URL(file, output));
}
console.log(`Packaged ${assets.length} site assets in dist/`);
