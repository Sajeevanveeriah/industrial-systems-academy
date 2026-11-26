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
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL("production.html?bench=reference#line", base).href);
    const step = () => page.locator("[data-line=step]").click(),
      read = () =>
        page.evaluate(() =>
          JSON.parse(localStorage.getItem("signalworks.reference-line.v1")),
        );
    const display = page.locator(".line-canvas");
    await display.waitFor();
    const capture = () => display.evaluate((c) => c.toDataURL());
    const startImage = await capture();
    await page.locator("[data-camera=robot]").click();
    await page.waitForFunction(
      (image) => document.querySelector(".line-canvas").toDataURL() !== image,
      startImage,
    );
    await page.locator("[data-camera=overview]").click();
    await step();
    let s = await read();
    const cancelled = s.carton.id;
    assert.equal(
      await page.locator('[data-key="physicalBlanks"]').innerText(),
      "11",
    );
    await page.locator("[data-line=cancel]").click();
    assert.equal((await read()).order.events.length, 0);
    assert.equal(
      await page.locator('[data-key="physicalBlanks"]').innerText(),
      "12",
    );
    await step();
    s = await read();
    const serial = s.carton.id;
    assert.notEqual(serial, cancelled);
    const feeding = await capture();
    while ((await read()).carton.stage === "feed") await step();
    assert(await page.locator('[data-line="cancel"]').isDisabled());
    assert.notEqual(await capture(), feeding);
    assert.match(
      await page.locator("#screen-live").innerText(),
      /At inspection camera\s+ON/i,
    );
    await page.reload();
    assert.equal((await read()).carton.id, serial);
    await page.locator(".line-mode").getByText("Paused").waitFor();
    await page.locator("[data-work=cycle]").click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("signalworks.reference-line.v1")).order
          .events.length === 1,
    );
    s = await read();
    assert.equal(s.order.events[0].id, serial);
    assert(s.order.events[0].scans.some((x) => x.includes("pickplace")));
    assert.deepEqual(s.order.posted, [serial]);
    assert.match(
      await page.locator("#screen-live").innerText(),
      /ERP finished stock\s+1/,
    );
    await page.locator("#line-online").selectOption("no");
    await page.locator("#quality").selectOption("Reject");
    await page.locator("[data-work=cycle]").click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("signalworks.reference-line.v1")).order
          .events.length === 2,
    );
    s = await read();
    assert.equal(s.order.events[1].accepted, false);
    assert(s.order.events[1].scans.some((x) => x.includes("divert")));
    assert.equal(s.order.posted.length, 1);
    await page.locator("#line-online").selectOption("yes");
    await page.locator("[data-line=post]").click();
    await page.locator("[data-line=post]").click();
    s = await read();
    assert.deepEqual(
      s.order.posted,
      s.order.events.map((e) => e.id),
    );
    assert.equal(s.order.good, 1);
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("signalworks.production.v1"),
      ),
      null,
    );
    await page.setViewportSize({ width: 375, height: 812 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (process.env.SW_SCREENSHOT) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.locator(".line-viewport").scrollIntoViewIfNeeded();
      await page.screenshot({ path: process.env.SW_SCREENSHOT });
    }
    await page.locator('a[href="#trace"]').first().click();
    await page.locator("[data-sap-event]").selectOption("1");
    const form = page.locator("[data-sap-form]");
    await form.locator("[name=issueType]").selectOption("261");
    await form.locator("[name=receiptType]").selectOption("none");
    for (const [name, value] of Object.entries({
      issue: "1",
      receipt: "0",
      yield: "0",
      scrap: "1",
    }))
      await form.locator('[name="' + name + '"]').fill(value);
    await form.getByRole("button").click();
    assert.match(
      await page.locator("[data-sap-result]").innerText(),
      /Reconciled:/,
    );
    assert.deepEqual((await read()).order, s.order);
    const other = await page.context().newPage();
    await other.goto(
      new URL("production.html?bench=reference#line", base).href,
    );
    await other.locator("#line-online").selectOption("no");
    await page.getByRole("button", { name: "Load latest work" }).waitFor();
    await page.getByRole("button", { name: "Load latest work" }).click();
    await page.locator("[data-sap-event]").waitFor();
    assert.equal((await read()).interfaceOnline, false);
    await other.close();
    await page.goto(new URL("equipment.html", base).href);
    const links = page.locator("#stations a");
    assert.equal(await links.count(), 10);
    for (let i = 0; i < 10; i++) {
      await links.nth(i).click();
      const probes = page
        .getByRole("group", { name: "Apply test conditions" })
        .getByRole("button");
      const verdicts = [];
      for (let opt = 0; opt < 3; opt++) {
        await page.locator("#work select").selectOption(String(opt));
        await probes.first().click();
        await probes.last().click();
        verdicts.push(await page.locator(".verdict").innerText());
      }
      assert.equal(verdicts.filter((v) => v.startsWith("Accepted.")).length, 1);
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        base,
        accepted: serial,
        rejected: s.order.events[1].id,
        cancelled,
        proof:
          "camera change, moving geometry, live HMI, pause/reload, both routes, automatic plus queued ERP booking, retained scan lineage, reference isolation, mobile, SAP reject worksheet, 10 equipment benches and 60 probe conditions",
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
