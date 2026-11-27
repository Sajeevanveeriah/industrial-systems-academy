const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

// Independent expected I/O, recipe and mass readbacks for the ten training stages.
const cases = [
  [
    "receive",
    "Metering hopper and weigh belt",
    "AI01",
    "belt scale load",
    "AO01",
    "feeder speed demand",
    100,
    "Restore load-cell signal and verify zero",
    1000,
  ],
  [
    "wash",
    "Rotary washer and stone separator",
    "AI02",
    "wash flow transmitter",
    "AO02",
    "wash pump speed",
    80,
    "Restore flow feedback and confirm circulation",
    980,
  ],
  [
    "peel",
    "Batch steam peeler and skin remover",
    "DI03",
    "vessel cycle complete",
    "DO03",
    "batch sequencer request",
    16,
    "Confirm completed batch and restore handshake",
    921.2,
  ],
  [
    "cut",
    "Hydraulic strip cutter and sliver sorter",
    "AI04",
    "cutter feed flow",
    "DO04",
    "product feed enable",
    10,
    "Re-establish feed-flow proof",
    888.958,
  ],
  [
    "blanch",
    "Continuous water blancher",
    "AI05",
    "blancher belt encoder",
    "AO05",
    "blancher conveyor speed",
    90,
    "Restore encoder and verify travel time",
    895.18,
  ],
  [
    "dry",
    "Through-air belt dryer",
    "AI06",
    "outlet belt scale",
    "AO06",
    "circulation fan demand",
    6,
    "Restore outlet scale and match both batch intervals",
    841.469,
  ],
  [
    "fry",
    "Continuous fryer and oil filter",
    "AI07",
    "fryer conveyor encoder",
    "AO07",
    "fryer belt speed demand",
    45,
    "Restore circulation proof before feed",
    744.7,
  ],
  [
    "freeze",
    "Fluidised-bed belt freezer",
    "AI08",
    "freezer return-air temperature",
    "AO08",
    "freezer belt speed demand",
    12,
    "Restore fresh air measurement and confirm zone readiness",
    744.7,
  ],
  [
    "pack",
    "Multihead weigher and bagger",
    "AI09",
    "checkweigher net weight",
    "DO09",
    "bag discharge request",
    1000,
    "Restore checkweight and verify a reference pack",
    744,
  ],
  [
    "dispatch",
    "Pallet transfer and dock scanner",
    "DI10",
    "pallet ID scan valid",
    "DO10",
    "dock transfer release",
    2,
    "Rescan the matching pallet and confirm dock lane",
    744,
  ],
];
const keyFor = (id) => "signalworks.fries.stage.v1." + id;
const stored = (p, id) =>
  p.evaluate((key) => JSON.parse(localStorage.getItem(key)), keyFor(id));
const assertNear = (got, expected, label) =>
  assert(
    Math.abs(got - expected) < 0.002,
    label + ": expected " + expected + ", got " + got,
  );
const tabURL = (p, id, mode, view) => {
  const u = new URL(p.url());
  assert.equal(u.searchParams.get("mode"), mode);
  assert.equal(u.searchParams.get("stage"), id);
  assert.equal(u.hash, "#" + view + "/" + id);
};
async function videoCheck(p, tutorial, id) {
  const video = tutorial.locator("video");
  await video.waitFor();
  await video.evaluate((el) => {
    el.preload = "auto";
    el.muted = true;
    el.load();
  });
  await p.waitForFunction(
    (stage) =>
      document.querySelector('[data-stage-course="' + stage + '"] video')
        ?.readyState >= 2,
    id,
  );
  const meta = await video.evaluate((el) => ({
    url: el.dataset.sourceUrl || el.currentSrc,
    width: el.videoWidth,
    height: el.videoHeight,
    duration: el.duration,
    captions: [...el.querySelectorAll("track")].map((t) => ({
      lang: t.srclang,
      kind: t.kind,
    })),
  }));
  assert(
    new URL(meta.url, p.url()).pathname.endsWith("/stage-media/" + id + ".mp4"),
    meta.url,
  );
  assert(meta.width > 0 && meta.height > 0 && meta.duration > 0);
  assert(
    meta.captions.some(
      (t) => t.lang === "en" && ["subtitles", "captions"].includes(t.kind),
    ),
  );
  await video.evaluate(async (el) => {
    await el.play();
  });
  await p.waitForFunction(
    (stage) =>
      document.querySelector('[data-stage-course="' + stage + '"] video')
        .currentTime > 0.15,
    id,
  );
  const seekTo = await video.evaluate((el) => {
    el.pause();
    const t = el.duration * 0.65;
    el.currentTime = t;
    return t;
  });
  await p.waitForFunction(
    ({ stage, time }) => {
      const el = document.querySelector(
        '[data-stage-course="' + stage + '"] video',
      );
      return (
        el &&
        !el.seeking &&
        el.readyState >= 2 &&
        Math.abs(el.currentTime - time) < 0.5
      );
    },
    { stage: id, time: seekTo },
  );
  await p.waitForFunction(
    (stage) =>
      Array.from(
        document.querySelector('[data-stage-course="' + stage + '"] video')
          .textTracks,
      ).some((track) => track.cues?.length > 0),
    id,
  );
  const transcript = tutorial.locator(".stc-transcript");
  await transcript.locator("summary").click();
  assert((await transcript.innerText()).length > 60);
  const checkpoint = tutorial.locator(".stc-diagnosis");
  await checkpoint.locator("summary").click();
  assert((await checkpoint.innerText()).length > 60);
  return meta.duration;
}
async function mountStation(p, c, index) {
  const [
    ,
    machine,
    inputTag,
    inputName,
    outputTag,
    outputName,
    target,
    recovery,
  ] = c;
  const bench = p.locator("#station-config");
  const tap = (name) =>
    bench.getByRole("button", { name, exact: true }).click();
  const choose = (name, value) =>
    bench.getByLabel(name, { exact: true }).selectOption(value);
  const inventory = bench.getByLabel("Equipment inventory", { exact: true });
  assert.equal(await inventory.inputValue(), "");
  const other = await inventory
    .locator("option")
    .evaluateAll(
      (options, correct) =>
        options.find((o) => o.value && o.value !== correct).value,
      machine,
    );
  await inventory.selectOption(other);
  await tap("Mount selected machine");
  assert.match(await bench.locator(".fp-state").innerText(), /refused/i);
  assert.equal(
    await bench.locator(".fp-bay").getAttribute("data-mounted"),
    "false",
  );
  await inventory.selectOption(machine);
  await tap("Mount selected machine");
  const bay = String(index + 1).padStart(2, "0");
  await choose("Sensor device socket", "JB" + bay + ":S1 \u00b7 " + inputName);
  await tap("Connect sensor cable");
  assert.match(await bench.locator(".fp-state").innerText(), /refused/i);
  await choose("PLC input terminal", "PLC-01:" + inputTag);
  await tap("Connect sensor cable");
  await choose("PLC output terminal", "PLC-01:" + outputTag);
  await choose(
    "Actuator device socket",
    "JB" + bay + ":A1 \u00b7 " + outputName,
  );
  await tap("Connect actuator cable");
  assert.equal(
    await bench.locator(".fp-cable[data-connected=true]").count(),
    2,
  );
  const recipe = bench.getByRole("spinbutton");
  await recipe.fill("0");
  await recipe.press("Tab");
  assert(
    await bench
      .getByRole("button", { name: "Inject station fault" })
      .isDisabled(),
  );
  await recipe.fill(String(target));
  await recipe.press("Tab");
  await tap("Inject station fault");
  await choose("Recovery action", "Acknowledge the alarm only");
  await tap("Verify recovery");
  assert.match(await bench.locator(".fp-state").innerText(), /hold remains/i);
  await p.locator("#step").click();
  assert.equal(await p.locator("#bar").evaluate((e) => e.value), 0);
  await choose("Recovery action", recovery);
  await tap("Verify recovery");
  assert.match(
    await bench.locator(".fp-state").innerText(),
    /recovery passed/i,
  );
}

async function main() {
  const base =
    process.argv[2] ||
    pathToFileURL(path.resolve(__dirname, "..") + path.sep).href;
  const browser = await chromium.launch(
    process.env.QA_BROWSER ? { channel: process.env.QA_BROWSER } : {},
  );
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1360, height: 870 },
    });
    const p = await ctx.newPage(),
      errors = [];
    p.setDefaultTimeout(10000);
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(new URL("index.html", base).href);
    await p
      .locator('a[href*="stage-lessons.html"]')
      .filter({ visible: true })
      .first()
      .click();
    await p.locator("article.stage-card#receive").waitFor();
    const catalogue = p.url().split("#")[0];
    const durations = [],
      records = [];
    assert.equal(await p.locator("article.stage-card").count(), cases.length);
    for (const [index, c] of cases.entries()) {
      const [id, , , , , , , , outputKg] = c;
      if (index > 0) await p.goto(catalogue);
      const card = p.locator("article.stage-card#" + id);
      for (const [action, mode, view] of [
        ["Read", "practice", "lesson"],
        ["Practise", "practice", "floor"],
        ["Worked", "stageworked", "floor"],
      ]) {
        const href = await card
            .locator('a[aria-label^="' + action + '"]')
            .getAttribute("href"),
          url = new URL(href, catalogue);
        assert.equal(url.searchParams.get("mode"), mode);
        assert.equal(url.searchParams.get("stage"), id);
        assert.equal(url.hash, "#" + view + "/" + id);
      }
      await card.locator('a[aria-label^="Read"]').click();
      tabURL(p, id, "practice", "lesson");
      const reader = p.locator('[data-stage-course="' + id + '"]');
      durations.push(await videoCheck(p, reader, id));
      await reader.locator('[data-stage-action="practice"]').click();
      tabURL(p, id, "practice", "floor");
      await p.locator("#station-config .fp-bay").waitFor();
      await p.locator("#go").click();
      assert.equal(await p.locator("#bar").evaluate((el) => el.value), 0);
      // A brand-new station is saved on its first operating action.
      await p.locator("#stale-input").click();
      await p.locator("#stale-input").click();
      let s = await stored(p, id);
      assert.equal(s.index, index);
      assert.equal(s.events.length, index);
      const previous = JSON.stringify(s.events);
      await mountStation(p, c, index);
      const configured = await stored(p, id);
      assert.equal(configured.configs[index].faultState, "proved");
      assert.equal(configured.events.length, index);
      await p.goto(catalogue);
      await card.locator('a[aria-label^="Worked"]').click();
      tabURL(p, id, "stageworked", "floor");
      await p.locator("#operator").waitFor();
      assert(await p.locator("#go").isDisabled());
      assert(await p.locator("#step").isDisabled());
      assert(await p.locator("#restart-station").isHidden());
      assert(await p.locator("#stage-example").isHidden());
      assert(
        await p.locator("#station-config").getByRole("spinbutton").isDisabled(),
      );
      assert.equal(
        await p.locator("#station-config").getByRole("spinbutton").inputValue(),
        String(c[6]),
      );
      assert(
        (await p.locator("#business-live").innerText()).includes(
          index + 1 + " / 10",
        ),
      );
      assert.deepEqual(
        (await stored(p, id)).configs[index],
        configured.configs[index],
      );
      assert(
        !(await p.locator("#batch").innerText()).includes(configured.batchId),
        "Worked example requires its own batch identity",
      );
      if (id === "peel") {
        const beforeReplay = await stored(p, id);
        await p.locator("#worked-replay").click();
        await p.waitForFunction(() => {
          const x = document.querySelector("#bar").value;
          return x > 0 && x < 1;
        });
        await p.waitForFunction(
          () => !document.querySelector("#worked-replay").disabled,
        );
        assert.deepEqual(
          await stored(p, id),
          beforeReplay,
          "Read-only replay cannot change a learner attempt",
        );
      }
      await p.goto(catalogue);
      await card.locator('a[aria-label^="Practise"]').click();
      tabURL(p, id, "practice", "floor");
      await p.locator("#bar").waitFor();
      await p.locator("#stale-input").click();
      assert.match(await p.locator("#operator").innerText(), /stale/i);
      await p.locator("#step").click();
      assert.equal(await p.locator("#bar").evaluate((e) => e.value), 0);
      await p.locator("#stale-input").click();
      const canvas = p.locator("#plant-canvas"),
        img = await canvas.evaluate((e) => e.toDataURL());
      await p.locator('[data-cam="top"]').click();
      await p.waitForFunction(
        (old) => document.querySelector("#plant-canvas").toDataURL() !== old,
        img,
      );
      if (index === 0) {
        await p.locator("#go").click();
        await p.waitForFunction(() => document.querySelector("#bar").value > 0);
        await p.locator("#hold").click();
      }
      await p.locator("#step").click();
      const partial = await p.locator("#bar").evaluate((e) => e.value);
      assert(partial > 0 && partial < 1);
      await p.reload();
      await p.locator("#bar").waitFor();
      assert.equal(await p.locator("#bar").evaluate((e) => e.value), partial);
      for (let j = 0; j < 4 && (await p.locator("#step").isEnabled()); j++)
        await p.locator("#step").click();
      s = await stored(p, id);
      assert.equal(s.events.length, index + 1);
      assert.equal(s.index, index);
      const event = s.events[index];
      assert.equal(JSON.stringify(s.events.slice(0, index)), previous);
      assert.equal(new Set(s.events.map((e) => e.id)).size, s.events.length);
      assert.equal(event.stage, id);
      assert.equal(event.batchId, s.batchId);
      assert.equal(event.orderId, s.orderId);
      assertNear(
        event.inputKg,
        index ? cases[index - 1][8] : 1000,
        id + " input kg",
      );
      assertNear(event.outputKg, outputKg, id + " output kg");
      assertNear(
        event.inputKg + event.addedKg - event.removedKg,
        event.outputKg,
        id + " mass balance",
      );
      assert(
        s.samples.some(
          (sample) => sample.stageId === id && sample.eventId === event.id,
        ),
        "Missing historian event " + event.id,
      );
      assert(await p.locator("#step").isDisabled());
      assert(await p.locator("#go").isDisabled());
      const readback = await p.locator("#business-live").innerText();
      assert(
        readback.includes(index + 1 + " / 10"),
        id + " MES count missing on floor",
      );
      assert(readback.includes("Lot mass"), id + " missing material readback");
      assert((await p.locator("#batch").innerText()).includes(s.orderId));
      records.push({ id, event: event.id, kg: event.outputKg });
      await p.reload();
      await p.locator("#operator").waitFor();
      assert.deepEqual((await stored(p, id)).events[index], event);
    }
    assert.equal(new Set(records.map((r) => r.event)).size, 10);
    assert.equal(
      await p.evaluate(
        (keys) => keys.filter((k) => localStorage.getItem(k)).length,
        cases.map((c) => keyFor(c[0])),
      ),
      10,
    );
    const allKeys = cases.map((c) => keyFor(c[0]));
    const snapshots = () =>
      p.evaluate((keys) => keys.map((k) => localStorage.getItem(k)), allKeys);
    const beforeReset = await snapshots();
    p.once("dialog", (d) => d.dismiss());
    await p.locator("#restart-station").click();
    assert.deepEqual(
      await snapshots(),
      beforeReset,
      "Cancelled reset must preserve all ten attempts",
    );
    p.once("dialog", (d) => d.accept());
    await p.locator("#restart-station").click();
    const afterReset = await snapshots();
    assert.deepEqual(
      afterReset.slice(0, 9),
      beforeReset.slice(0, 9),
      "Other stages must survive reset",
    );
    const clean = JSON.parse(afterReset[9]);
    assert.equal(clean.events.length, 9);
    assert.equal(clean.configs[9].machine, "");
    assert.equal(clean.progress, 0);
    await p.reload();
    assert.equal(
      (await stored(p, "dispatch")).configs[9].faultState,
      "untested",
    );
    await p.setViewportSize({ width: 375, height: 812 });
    await p.goto(catalogue);
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p.goto(new URL("fries.html?mode=solved#floor/receive", base).href);
    await p.locator("#step").click();
    const liveBatch = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("signalworks.fries.v1.solved")),
    );
    await p.locator("#stage-reader-link").click();
    assert.match(p.url(), /mode=solved#lesson/);
    await p.locator('[data-stage-action="worked"]').click();
    await p.locator('[data-course-link="compare"]').click();
    await p.locator("#bar").waitFor();
    assert.match(p.url(), /mode=solved#floor/);
    assert.deepEqual(
      await p.evaluate(() =>
        JSON.parse(localStorage.getItem("signalworks.fries.v1.solved")),
      ),
      liveBatch,
    );
    assert.deepEqual(errors, []);
    console.log({
      base,
      stages: records,
      selectedVideos: durations.length,
      errors,
    });
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
