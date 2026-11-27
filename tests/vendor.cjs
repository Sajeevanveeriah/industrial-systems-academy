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
      viewport: { width: 1280, height: 900 },
    });
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL("index.html", base).href);
    await page.getByRole("link", { name: /Production software labs/i }).click();
    const tab = (id) => page.locator('.products a[href="#' + id + '"]').click();
    const f = async (key, value) => {
      const x = page.locator('[data-mom-field="' + key + '"]');
      if ((await x.evaluate((el) => el.tagName)) === "SELECT")
        await x.selectOption(value);
      else await x.fill(value);
    };
    const submit = (key) =>
      page.locator('[data-mom-submit="' + key + '"]').click();
    await f("order", "PO-104");
    await f("lot", "POT-041");
    await f("net", "1000");
    await submit("receive");
    assert.match(
      await page.locator("[data-mom-feedback]").innerText(),
      /weight|mass|weigh|980/i,
    );
    await f("net", "980");
    await submit("receive");
    await page.locator("[data-mom=fetch]").click();
    await f("decision", "release");
    await submit("release");
    await f("bin", "RAW-A2");
    await f("confirmLot", "POT-041");
    await submit("putaway");
    await f("actual", "980");
    await f("variance", "short");
    await submit("post");
    assert.match(
      await page.locator("[data-mom-feedback]").innerText(),
      /20 kg/,
    );
    await page.locator("[data-mom-tab=dispatch]").click();
    for (const [k, v] of Object.entries({
      job: "WO-073",
      raw: "POT-041",
      issued: "800",
    }))
      await f(k, v);
    await submit("consume");
    for (const [k, v] of Object.entries({
      finished: "FIN-073",
      good: "600",
      byproduct: "150",
      loss: "50",
    }))
      await f(k, v);
    await submit("yield");
    await page.locator("[data-mom=fault]").click();
    for (const [k, v] of Object.entries({
      lot: "FIN-073",
      dock: "DS-02",
      shipQty: "540",
    }))
      await f(k, v);
    await submit("ship");
    await f("event", "SHIP-350");
    await submit("retry");
    assert.match(
      await page.locator("[data-mom-feedback]").innerText(),
      /60 kg/,
    );
    await tab("aveva");
    const action = (k) => page.locator('[data-av-action="' + k + '"]').click();
    await action("hmi-example");
    await action("deploy");
    for (let i = 0; i < 3; i++) await action("advance");
    await action("ack");
    assert.match(
      await page.locator('[data-av-output="message"]').innerText(),
      /remains active/i,
    );
    await page.locator("[data-av-tab=historian]").click();
    await action("hist-example");
    await action("query");
    assert.match(
      await page.locator('[data-av-output="result"]').innerText(),
      /16.2/,
    );
    await tab("aps");
    assert.match(await page.locator("[data-aps-status]").innerText(), /60 min/);
    await page
      .locator("#lesson-aps details")
      .filter({ has: page.locator("[data-aps=worked]") })
      .locator("summary")
      .click();
    await page.locator("[data-aps=worked]").click();
    assert.match(
      await page.locator("[data-aps-status]").innerText(),
      /all three orders finish on time/i,
    );
    await page.setViewportSize({ width: 375, height: 812 });
    for (const t of ["aps", "aveva", "momentum"]) {
      await tab(t);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "mobile width " + t,
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        base,
        lessons: 5,
        receiving: "980 kg",
        dispatch: "retry kept 60 kg",
        hmi: "acknowledged active",
        history: "peak 16.2 A",
        scheduling: "feasible",
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
