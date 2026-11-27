const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async () => {
  const base =
    process.argv[2] ||
    pathToFileURL(path.resolve(__dirname, "..") + path.sep).href;
  const browser = await chromium.launch(
    process.env.QA_BROWSER ? { channel: process.env.QA_BROWSER } : {},
  );
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const open = (mode, section) =>
      page.goto(new URL("fries.html?mode=" + mode + "#" + section, base).href);
    const workspace = page.locator("#workspace");
    const view = workspace.locator("canvas[data-sb-scene]");
    const action = (id) => workspace.locator('[data-sb="' + id + '"]');
    const field = (id) => workspace.locator('[data-sb-key="' + id + '"]');
    const step = (id) =>
      workspace.locator('[data-sb-step="' + id + '"]').click();
    const cell = (index) =>
      workspace.locator('[data-sb-cell="' + index + '"]').click();
    const status = () => workspace.locator("[data-sb-msg]").innerText();
    const state = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("signalworks.fries.v2.build")),
      );
    const go = (section) =>
      page.locator('.tabs a[href="#' + section + '"]').click();
    await open("build", "site");
    await view.waitFor();
    assert(await view.isVisible());
    const plotImage = () => view.evaluate((canvas) => canvas.toDataURL());
    await page.waitForFunction(() => {
      const canvas = document.querySelector("canvas[data-sb-scene]");
      return canvas && canvas.width > 320;
    });
    const blankImage = await plotImage();
    await view.focus();
    assert(await view.evaluate((canvas) => canvas === document.activeElement));
    await page.setViewportSize({ width: 375, height: 812 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "site should fit a narrow phone",
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const section of ["rack", "installation", "business", "floor"]) {
      await go(section);
      await workspace
        .getByRole("heading", { name: "Prepare the site for fit-out" })
        .waitFor();
      assert.equal(await workspace.locator("a[href='#site']").count(), 1);
    }
    await go("guide");
    assert.equal(await workspace.locator(".site-blocked").count(), 0);
    await go("site");
    await view.waitFor();

    const buildings = [
      [
        "intake",
        6,
        "Washable wet finish",
        "Washdown receiving slab",
        "Open unloading canopy",
      ],
      [
        "process",
        7,
        "Sealed hygienic finish",
        "Drained process floor",
        "Cleanable process frame",
      ],
      [
        "cold",
        8,
        "Insulated vapour-tight envelope",
        "Insulated cold-store floor",
        "Cold-envelope support frame",
      ],
      [
        "dispatch",
        9,
        "Weather-sealed dock",
        "Dock loading slab",
        "Clear-span dock frame",
      ],
      [
        "utilities",
        13,
        "Ventilated industrial finish",
        "Plant equipment base",
        "Service-access frame",
      ],
      [
        "control",
        14,
        "Dry filtered enclosure",
        "Dry equipment slab",
        "Enclosed services frame",
      ],
    ];
    const services = [
      ["utilities.power", "process.power", "Power"],
      ["utilities.water", "process.water", "Water"],
      ["utilities.chilled", "cold.chilled", "Chilled loop"],
      ["process.wastewater", "utilities.treatment", "Wastewater"],
      ["utilities.heat", "process.heat", "Process heat"],
      ["utilities.air", "process.air", "Instrument air"],
      ["control.network", "process.network", "Network"],
      ["cold.product", "dispatch.product", "Product transfer"],
    ];
    await action("survey").click();
    assert.match(await status(), /reserve/i);
    await field("survey-mode").selectOption("inspect");
    await cell(0);
    assert.match(
      await workspace.locator("[data-sb-reading]").innerText(),
      /98.20 m.*ponding/i,
    );
    await cell(12);
    assert.match(
      await workspace.locator("[data-sb-reading]").innerText(),
      /break in the west fence/i,
    );
    assert.equal((await state()).site.surveyPlan.reserve.length, 0);
    await field("survey-mode").selectOption("flood");
    await cell(0);
    await cell(1);
    await field("survey-mode").selectOption("entry");
    await cell(12);
    await action("survey").click();
    assert.equal((await state()).site.survey, true);
    await step("layout");
    for (const [id, index] of buildings) {
      await field("building").selectOption(id);
      if (id === "process") {
        await cell(6);
        await action("place").click();
        assert.match(await status(), /occupied/i);
        assert.equal((await state()).site.buildings.process, undefined);
      }
      await cell(index);
      await action("place").click();
      assert.equal((await state()).site.buildings[id].cell, index);
    }
    await page.reload();
    await view.waitFor();
    assert.equal(Object.keys((await state()).site.buildings).length, 6);
    await step("build");
    await action("frame").click();
    assert.match(await status(), /in order/i);
    for (const [id, , finish, foundation, frame] of buildings) {
      await field("building").selectOption(id);
      if (id === "intake") {
        await field("foundation").selectOption("Dry equipment slab");
        await action("foundation").click();
        assert.equal((await state()).site.buildings.intake.level, 0);
        assert.match(await status(), /washable receiving surface/i);
      }
      await field("foundation").selectOption(foundation);
      await action("foundation").click();
      await field("frame").selectOption(frame);
      await action("frame").click();
      await field("finish").selectOption(finish);
      await action("shell").click();
      assert.equal((await state()).site.buildings[id].level, 3);
    }
    await step("prove");
    await action("test").click();
    assert.match(await status(), /acceptance failed.*power/i);
    await action("commission").click();
    assert.equal((await state()).site.commissioned, false);
    await step("services");
    for (const [source, target, service] of services) {
      await field("source").selectOption(source);
      await field("target").selectOption(target);
      await field("service").selectOption(service);
      await action("link").click();
    }
    assert.equal((await state()).site.links.length, 8);
    await step("access");
    await field("gate").selectOption("12");
    await field("receiving").selectOption("12");
    await field("outbound").selectOption("15");
    await action("roads").click();
    assert.equal((await state()).site.access, true);
    await step("prove");
    await action("commission").click();
    assert.match(await status(), /run acceptance tests/i);
    await action("test").click();
    assert.match(await status(), /five site checks passed/i);
    await action("commission").click();
    assert.equal((await state()).site.commissioned, true);
    await page.reload();
    await view.waitFor();
    assert.equal((await state()).site.commissioned, true);
    await step("survey");
    assert.equal(await field("survey-mode").inputValue(), "inspect");
    const acceptedSurvey = JSON.stringify((await state()).site);
    await cell(12);
    await field("survey-mode").selectOption("entry");
    await cell(12);
    assert.equal(JSON.stringify((await state()).site), acceptedSurvey);
    await step("prove");
    for (const [id, section] of [
      ["intake", "floor/receive"],
      ["process", "floor/wash"],
      ["cold", "floor/freeze"],
      ["dispatch", "floor/dispatch"],
      ["utilities", "installation/host"],
      ["control", "rack"],
    ]) {
      await field("building").selectOption(id);
      const enter = workspace.locator("[data-sb-enter]");
      assert.equal(await enter.getAttribute("href"), "#" + section);
      await enter.click();
      assert.equal(new URL(page.url()).hash, "#" + section);
      assert.equal(await workspace.locator(".site-blocked").count(), 0);
      if (id === "control") {
        await workspace.locator('[data-device="ups"]').click();
        await workspace.locator('[data-unit="1"]').click();
        assert.equal((await state()).installation.rack.ups, 1);
      } else if (id === "utilities") {
        assert(await workspace.locator(".fry-install").isVisible());
      } else {
        assert(await workspace.locator("#station-config").isVisible());
      }
      await go("site");
      await step("prove");
    }
    await go("business");
    await workspace.locator(".fry-ledger").waitFor();
    await go("site");
    await step("build");
    await field("building").selectOption("control");
    await action("reopen").click();
    let site = (await state()).site;
    assert.equal(site.links.length, 7);
    assert.equal(site.buildings.control.level, 2);
    assert.equal(site.commissioned, false);
    await go("rack");
    await workspace
      .getByRole("heading", { name: "Prepare the site for fit-out" })
      .waitFor();
    await go("site");
    await step("build");
    await field("building").selectOption("control");
    await field("finish").selectOption("Dry filtered enclosure");
    await action("shell").click();
    await step("services");
    await field("source").selectOption("control.network");
    await field("target").selectOption("process.network");
    await field("service").selectOption("Network");
    await action("link").click();
    await step("prove");
    await action("test").click();
    await action("commission").click();
    site = (await state()).site;
    assert.equal(site.commissioned, true);
    assert.equal(site.links.length, 8);
    assert.notEqual(await plotImage(), blankImage);
    // Keep this same constructed site and exercise its fit-out through dispatch.
    await go("guide");
    assert.match(await workspace.innerText(), /Project checklist/);
    await workspace.locator('a[href="#rack"]').first().click();
    await workspace.locator('[data-device="ups"]').waitFor();
    await go("installation");
    for (const id of [
      "rack",
      "patch",
      "host",
      "roles",
      "plc",
      "scada",
      "hmi",
      "mes",
      "erp",
    ]) {
      await workspace.locator('[data-fi-tab="' + id + '"]').click();
      assert.match(
        await page.locator("#field-instruction").innerText(),
        /Step guide/,
      );
      await workspace
        .getByText("Worked configuration for", { exact: false })
        .filter({ visible: true })
        .first()
        .click();
      await workspace.locator("[data-fi=solve]").click();
    }
    await go("business");
    await workspace.locator("[data-do=sample]").click();
    await go("floor");
    for (let i = 0; i < 10; i++) {
      await workspace.locator("#stage-example").click();
      for (let scan = 0; scan < 4; scan++)
        await workspace.locator("#step").click();
      assert.equal(
        (await state()).events.length,
        i + 1,
        await workspace.locator("#feedback").innerText(),
      );
      if (i < 9) await workspace.locator("#transfer").click();
    }
    const completed = await state();
    assert.equal(completed.events.length, 10);
    assert.equal(completed.events.at(-1).stage, "dispatch");
    assert.equal(completed.events.at(-1).outputKg, 744);
    assert(completed.ledger.moves.every((m) => m.posted));
    await go("guide");
    await workspace
      .getByRole("heading", { name: "Project complete" })
      .waitFor();
    await go("history");
    await workspace
      .getByRole("button", {
        name: "Start another batch with this installation",
      })
      .click();
    assert.deepEqual((await state()).site, completed.site);
    assert.equal((await state()).history.length, 1);
    await open("worked", "site");
    await view.waitFor();
    await step("prove");
    assert(await action("commission").isDisabled());
    assert(await workspace.locator("[data-sb-enter]").isVisible());
    await step("build");
    assert(await action("foundation").isDisabled());
    await step("survey");
    assert(await action("survey").isDisabled());
    await action("guide").click();
    assert(await workspace.locator("[data-sb-guide]").isVisible());
    await open("solved", "rack");
    await workspace.locator('[data-device="ups"]').waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: vacant site through six buildings, eight services, witnessed handover, reopened shell and repairs, fit-out and ten fry stages to 744 kg dispatch; saved site retained for next batch; read-only and mobile checked at " +
        base,
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
