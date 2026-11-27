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
      viewport: { width: 1366, height: 820 },
    });
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL("index.html", base).href);
    await page
      .getByRole("link", { name: "Run a linked software batch" })
      .click();
    const tab = (name) => page.locator('.tabs a[href="#' + name + '"]').click();
    const state = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("signalworks.fries.v1.batch")),
      );
    const set = async (attr, key, value) => {
      const el = page.locator("[" + attr + "=" + key + "]");
      if ((await el.evaluate((n) => n.tagName)) === "SELECT")
        await el.selectOption(value);
      else await el.fill(value);
    };
    const mom = (key, value) => set("data-bm-field", key, value),
      mop = (k) => page.locator("[data-bm-submit=" + k + "]").click();
    const av = (k) => page.locator("[data-bav-action=" + k + "]").click();
    await page.locator("[data-bm-field=lot]").waitFor();
    await tab("aps");
    assert.equal(
      await page.evaluate(() => BatchAPS.ready({ ledger: {} }).ok),
      false,
    );
    await tab("floor");
    assert(await page.locator("[data-bav-action=start]").isDisabled());
    assert.match(await page.locator("#feedback").innerText(), /Momentum/);
    await tab("momentum");
    for (const [k, v] of Object.entries({
      purchase: "PUR-7101",
      order: "PO-7101",
      lot: "POT-2601",
      gross: "5200",
      tare: "4200",
      net: "1000",
    }))
      await mom(k, v);
    await mop("weigh");
    assert.equal((await state()).ledger.receiptKg, 0);
    await page.locator("[data-bm=mismatch]").click();
    await mom("sample", "QA-1001");
    await mom("disposition", "release");
    await mop("release");
    assert.equal((await state()).momentum.stage, "held");
    await page.locator("[data-bm=fetch]").click();
    await mop("release");
    await mom("scan", "POT-2601");
    await mom("bin", "RAW-A2");
    await mop("post");
    let s = await state();
    assert.equal(s.ledger.status, "Draft");
    assert.equal(s.ledger.receiptKg, 1000);
    assert.equal(s.ledger.moves.length, 1);
    assert.equal(s.momentum.receiptId, s.ledger.moves[0].id);
    await page.reload();
    await tab("aps");
    await page.locator("[data-baps=worked]").click();
    await set("data-baps-field", "line", "PK-FLAKE");
    await page.locator("[data-baps=release]").click();
    assert.equal((await state()).ledger.status, "Draft");
    await page.locator("[data-baps=worked]").click();
    await page.locator("[data-baps=release]").click();
    s = await state();
    assert.equal(s.aps.plan.receiptId, s.momentum.receiptId);
    assert.equal(s.aps.plan.runStart, "08:00");
    assert.equal(s.ledger.status, "Released");
    await tab("floor");
    await av("start");
    await page.waitForFunction(
      () => document.querySelector("#bar").value > 0.05,
    );
    await av("trip");
    await page.waitForFunction(
      () => document.querySelector("#flags").textContent === "Held",
    );
    let held = await state();
    assert.equal(held.guard, false);
    await av("ack");
    assert.equal((await state()).guard, false);
    await av("trip");
    await av("stale");
    assert.equal((await state()).sensorStale, true);
    await av("stale");
    await tab("sap");
    await page.getByRole("button", { name: "Take interface offline" }).click();
    await tab("floor");
    for (let i = 0; i < 10; i++) {
      while ((await state()).events.length <= i) await av("step");
      if (i < 9) {
        await av("release");
        assert.doesNotMatch(
          await page.locator("#batch-route h3").innerText(),
          /Transfer the completed/i,
        );
      }
    }
    s = await state();
    assert.equal(s.events.length, 10);
    assert(
      s.events.every(
        (e) =>
          e.batchId === s.batchId &&
          e.rawLot === s.momentum.lot &&
          e.receiptId === s.momentum.receiptId &&
          e.line === s.aps.plan.line,
      ),
    );
    assert.equal(s.events.at(-1).outputKg, 744);
    assert.equal(s.ledger.moves.filter((m) => !m.posted).length, 4);
    assert(s.samples.some((r) => r.quality === "Stale"));
    assert.equal(s.samples.at(-1).eventId, s.events.at(-1).id);
    assert.equal(s.samples.at(-1).kg, 744);
    assert(s.samples.at(-1).ts.includes("09:40:00"));
    await av("query");
    assert.match(
      await page.locator("[data-bav-out=summary]").innerText(),
      /returned/,
    );
    await tab("sap");
    await page.getByRole("button", { name: "Restore interface" }).click();
    await page.getByRole("button", { name: "Replay queued events" }).click();
    const before = (await state()).ledger.moves;
    await page.getByRole("button", { name: "Replay queued events" }).click();
    assert.deepEqual((await state()).ledger.moves, before);
    assert(before.every((m) => m.posted));
    const fields = page.locator(".bj-answers input");
    for (const [i, v] of [1000, 1000, 37.866, 744, 744].entries())
      await fields.nth(i).fill(String(v));
    await page.getByRole("button", { name: "Check my reconciliation" }).click();
    assert.match(await page.locator(".bj-outcome").innerText(), /All five/);
    await page.reload();
    await page
      .getByText("Reconcile the posted quantities", { exact: true })
      .waitFor();
    await page.setViewportSize({ width: 375, height: 812 });
    for (const t of ["momentum", "aps", "floor", "sap"]) {
      await tab(t);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "overflow " + t,
      );
    }
    // A released v1 order may have a custom product and no historic APS data.
    const old = structuredClone(s);
    delete old.journeyVersion;
    delete old.momentum;
    delete old.aps;
    delete old.shiftDate;
    old.ledger.product = "Custom frozen fries";
    old.index = 1;
    old.progress = 0;
    old.events = old.events.slice(0, 1);
    old.ledger.stages = old.ledger.stages.slice(0, 1);
    old.ledger.moves = old.ledger.moves.slice(0, 2);
    old.samples = [];
    await page.evaluate(
      (data) =>
        localStorage.setItem(
          "signalworks.fries.v1.solved",
          JSON.stringify(data),
        ),
      old,
    );
    await page.goto(new URL("fries.html?mode=solved#floor", base).href);
    await av("step");
    const migrated = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("signalworks.fries.v1.solved")),
    );
    assert.equal(migrated.progress, 0.25);
    assert.equal(migrated.ledger.product, old.ledger.product);
    assert.equal(migrated.aps.source, "prior-release");
    assert(!migrated.aps.plan);
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        base,
        lot: s.momentum.lot,
        batch: s.batchId,
        order: s.orderId,
        slot: s.aps.plan.runStart + "–" + s.aps.plan.finish,
        operations: 10,
        shippedKg: 744,
        offlineQueued: 4,
        duplicatePostings: 0,
        errs: errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
