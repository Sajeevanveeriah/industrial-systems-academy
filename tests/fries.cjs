const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
(async () => {
  const base =
    process.argv[2] ||
    pathToFileURL(path.resolve(__dirname, "..") + path.sep).href;
  const b = await chromium.launch(
    process.env.QA_BROWSER ? { channel: process.env.QA_BROWSER } : {},
  );
  try {
    const p = await b.newPage({ viewport: { width: 1440, height: 940 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.setDefaultTimeout(8000);
    const visit = (mode, section) =>
      p.goto(new URL("fries.html?mode=" + mode + "#" + section, base).href);
    const nav = (id) => p.locator('.tabs a[href="#' + id + '"]').click();
    await visit("build", "floor");
    await p.locator("#route button").first().waitFor();
    assert.equal(await p.locator("#route button").count(), 10);
    await p.locator("#go").click();
    assert.match(await p.locator("#feedback").innerText(), /Installation/);
    await nav("rack");
    for (const [device, unit] of [
      ["ups", 1],
      ["hostA", 3],
      ["hostB", 5],
      ["sw", 9],
    ]) {
      await p.locator('[data-device="' + device + '"]').click();
      await p.locator('[data-unit="' + unit + '"]').click();
    }
    await p.locator('button[data-view="rear"]').click();
    const leads = [
      ["UPS.OUT", "PDU.IN"],
      ["PDU.1", "HOST-A.PWR"],
      ["PDU.2", "HOST-B.PWR"],
      ["PDU.3", "SW.PWR"],
      ["SW.P1", "HOST-A.NIC"],
      ["SW.P2", "HOST-B.NIC"],
      ["SW.P3", "PLC.ETH"],
      ["DI.0", "SIM.START"],
      ["DI.1", "SIM.GUARD"],
      ["DI.2", "SIM.READY"],
      ["DO.0", "SIM.ENABLE"],
    ];
    for (const [a, b] of leads) {
      await p.locator('[data-port="' + a + '"]').click();
      await p.locator('[data-port="' + b + '"]').click();
    }
    assert.equal(
      await p.evaluate(
        () =>
          JSON.parse(localStorage.getItem("signalworks.fries.v1.build"))
            .installation.patch.length,
      ),
      11,
    );
    await nav("installation");
    for (const id of ["host", "roles", "plc", "scada", "hmi", "mes", "erp"]) {
      await p.locator('[data-fi-tab="' + id + '"]').click();
      await p
        .getByText("Worked configuration for", { exact: false })
        .filter({ visible: true })
        .first()
        .click();
      await p.locator("[data-fi=solve]").click();
    }
    await nav("business");
    await p.locator("[data-do=sample]").click();
    await nav("floor");
    const station = p.locator("#station-config");
    await station
      .getByLabel("Equipment inventory")
      .selectOption({ label: "Metering hopper and weigh belt" });
    await station
      .getByRole("button", { name: "Mount selected machine" })
      .click();
    for (const [label, value] of [
      ["Sensor device socket", "JB01:S1 · belt scale load"],
      ["PLC input terminal", "PLC-01:AI01"],
    ])
      await station.getByLabel(label).selectOption({ label: value });
    await station
      .getByRole("button", { name: "Connect sensor cable", exact: true })
      .click();
    for (const [label, value] of [
      ["PLC output terminal", "PLC-01:AO01"],
      ["Actuator device socket", "JB01:A1 · feeder speed demand"],
    ])
      await station.getByLabel(label).selectOption({ label: value });
    await station
      .getByRole("button", { name: "Connect actuator cable", exact: true })
      .click();
    await station.getByRole("spinbutton").fill("100");
    await station.getByRole("spinbutton").press("Tab");
    await station.getByRole("button", { name: "Inject station fault" }).click();
    await station
      .getByLabel("Recovery action")
      .selectOption({ label: "Restore load-cell signal and verify zero" });
    await station.getByRole("button", { name: "Verify recovery" }).click();
    await p.locator("#stale-input").click();
    assert.match(await p.locator("#operator").innerText(), /Stale quality/i);
    await p.locator("#stale-input").click();
    await p.locator("#go").click();
    await p.waitForFunction(() => document.querySelector("#bar").value > 0.05);
    await p.locator("#trip").click();
    assert.match(await p.locator("#flags").innerText(), /Held/);
    const progress = await p.locator("#bar").evaluate((e) => e.value);
    await p.reload();
    await p.locator("#bar").waitFor();
    assert.equal(await p.locator("#bar").evaluate((e) => e.value), progress);
    await p.locator("#step").click();
    assert.equal(await p.locator("#bar").evaluate((e) => e.value), progress);
    await p.locator("#trip").click();
    for (let i = 0; i < 4; i++)
      if (await p.locator("#step").isEnabled())
        await p.locator("#step").click();
    await p.locator("#trip").click();
    assert(await p.locator("#transfer").isDisabled());
    await p.locator("#trip").click();
    await p.locator("#stale-input").click();
    assert(await p.locator("#transfer").isDisabled());
    await p.locator("#stale-input").click();
    await p.locator("#transfer").click();
    assert.match(await p.locator("#current").innerText(), /Wash/);
    await nav("history");
    assert.equal(await p.locator("tbody tr").count(), 1);
    await visit("solved", "floor");
    const c = p.locator("#plant-canvas");
    await c.waitFor();
    let img = await c.evaluate((e) => e.toDataURL());
    await p.locator("[data-cam=top]").click();
    await p.waitForFunction(
      (im) => document.querySelector("#plant-canvas").toDataURL() !== im,
      img,
    );
    await p.locator("[data-cam=overview]").click();
    if (process.env.FRY_SCREENSHOT)
      await p.screenshot({ path: process.env.FRY_SCREENSHOT });
    await nav("business");
    await p.locator("[data-do=online]").click();
    await nav("floor");
    const read = () =>
      p.evaluate(() =>
        JSON.parse(localStorage.getItem("signalworks.fries.v1.solved")),
      );
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 4; j++) await p.locator("#step").click();
      assert(await p.locator("#go").isDisabled());
      const s = await read();
      assert.equal(s.events.length, i + 1);
      const e = s.events[i];
      assert.equal(e.batchId, s.batchId);
      assert.equal(e.inputKg, i ? s.events[i - 1].outputKg : 1000);
      assert(
        Math.abs(e.inputKg + e.addedKg - e.removedKg - e.outputKg) < 0.002,
      );
      if (i < 9) await p.locator("#transfer").click();
    }
    let s = await read();
    const ids = s.events.map((e) => e.stage);
    assert.deepEqual(ids, [
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
    ]);
    assert.equal(new Set(s.events.map((e) => e.id)).size, 10);
    const shipped = s.events[9].outputKg;
    assert(shipped > 0 && shipped < 1000);
    assert(s.ledger.moves.some((m) => !m.posted));
    await nav("history");
    assert.equal(
      await p
        .getByRole("button", {
          name: "Start another batch with this installation",
        })
        .count(),
      0,
    );
    await nav("business");
    await p.locator("[data-do=online]").click();
    await p.locator("[data-do=replay]").click();
    const posted = (await read()).ledger.moves;
    assert(posted.every((m) => m.posted));
    await p.locator("[data-do=replay]").click();
    assert.deepEqual((await read()).ledger.moves, posted);
    await nav("history");
    assert.equal(await p.locator("tbody tr").count(), 10);
    await p.reload();
    assert.equal(await p.locator("tbody tr").count(), 10);
    await p
      .getByRole("button", {
        name: "Start another batch with this installation",
      })
      .click();
    const fresh = await read();
    assert.equal(fresh.history[0].events.length, 10);
    assert.notEqual(fresh.batchId, s.batchId);
    assert.notEqual(fresh.ledger.lot, s.ledger.lot);
    await visit("worked", "history");
    assert.equal(await p.locator("tbody tr").count(), 10);
    await nav("installation");
    assert(await p.locator("[data-fi=solve]").isDisabled());
    await p.locator("[data-fi-tab=hmi]").click();
    assert(await p.locator("[data-fi=solve]").isDisabled());
    await p.setViewportSize({ width: 375, height: 812 });
    for (const tab of [
      "floor",
      "rack",
      "installation",
      "business",
      "history",
    ]) {
      await nav(tab);
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "width " + tab,
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        base,
        build:
          "nine subsystems, sample order, partial stage, PLC trip/reload/resume",
        stages: ids,
        shippedKg: shipped,
        postings: posted.map((m) => m.code),
        worked: "10 records",
        mobile: 375,
        errors,
      }),
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
