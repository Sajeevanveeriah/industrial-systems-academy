const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
(async () => {
  const base =
    process.argv[2] ||
    pathToFileURL(path.resolve(__dirname, "..") + path.sep).href;
  const twin = process.argv[3] === "twin";
  const browser = await chromium.launch(
    process.env.QA_BROWSER ? { channel: process.env.QA_BROWSER } : {},
  );
  try {
    const p = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    p.setDefaultTimeout(12000);
    let errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    if (twin && base.startsWith("file:")) {
      await p.goto(new URL("facility-services/index.html", base).href);
    } else if (twin) {
      await p.goto(base + "#plant");
      await p
        .locator('[data-facility-handoff] a[href*="facility-services"]')
        .click();
    } else {
      await p.goto(new URL("fries.html?mode=fitout#facility", base).href);
    }
    const get = (k) => p.locator('[data-fs="' + k + '"]');
    const run = () => get("run").click();
    const state = () => get("result").getAttribute("data-state");
    await get("workspace-mode").selectOption("build");
    await p.locator("[data-fs-area=office]").click();
    await run();
    assert.equal(await state(), "fail");
    for (const [id, val] of Object.entries({
      panel: "Fern",
      uplink: "Leaf",
      camera: "A",
      ap: "B",
      condition: "dry",
      profile: "enabled",
    }))
      await p.locator('[data-setting="' + id + '"]').selectOption(val);
    await p.locator("[data-setting=budget]").fill("27");
    await run();
    assert.equal(await state(), "pass");
    await p.locator("[data-setting=fault]").selectOption("freeze");
    await run();
    assert.equal(await state(), "fail");
    assert.match(await get("readbacks").innerText(), /link up/i);
    await p.reload();
    await get("result").waitFor();
    assert.equal(await state(), "fail");
    await p.locator("[data-setting=fault]").selectOption("normal");
    await run();
    assert.equal(await state(), "pass");
    await get("workspace-mode").selectOption("worked");
    for (const area of ["office", "storage", "production", "services"]) {
      await p.locator('[data-fs-area="' + area + '"]').click();
      await run();
      assert.equal(await state(), "pass");
    }
    await p.setViewportSize({ width: 375, height: 812 });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (!twin) {
      await p.goto(new URL("fries.html?mode=worked#facility", base).href);
      assert(await get("workspace-mode").isDisabled());
      assert.equal(await state(), "pass");
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        base,
        twin,
        areas: 4,
        officeManual: true,
        serviceFault: true,
        persistence: true,
        mobile: 375,
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
