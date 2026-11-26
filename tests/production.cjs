const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

async function check() {
  const base =
    process.argv[2] ||
    pathToFileURL(path.resolve(__dirname, "..") + path.sep).href;
  const browser = await chromium.launch(
    process.env.QA_BROWSER ? { channel: process.env.QA_BROWSER } : {},
  );
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 940 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL("room.html", base).href);
    await page.locator("[data-stage=Floor]").waitFor();
    assert.equal(await page.locator("[data-stage]").count(), 5);
    const canvas = page.locator("#room-view");
    await canvas.focus();
    const image = await canvas.evaluate((c) => c.toDataURL());
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      (img) => document.querySelector("#room-view").toDataURL() !== img,
      image,
    );
    await page.goto(new URL("index.html", base).href);
    await page.locator("#room-preview[data-ready=true]").waitFor();
    await page
      .getByRole("link", { name: /Enter the production workshop/ })
      .click();
    const byWork = (id) => page.locator('[data-work="' + id + '"]').click();
    const stage = (id) =>
      page.locator('#stations a[href="#' + id + '"]').click();
    const readNotice = () => page.locator("#work-notice").innerText();
    const waitCartons = (count) =>
      page.waitForFunction((n) => {
        const s = JSON.parse(localStorage.getItem("signalworks.production.v1"));
        return s.order.events.length === n && !s.carton;
      }, count);
    await page.locator("#target").fill("2");
    await byWork("release");
    await byWork("dispatch");
    assert.match(await readNotice(), /mismatch/);
    await page.locator("#route").selectOption("CTN-06");
    await byWork("dispatch");
    await stage("line");
    await byWork("cycle");
    assert.match(await readNotice(), /servers/i);
    await stage("servers");
    const checkServers = page.getByRole("button", {
      name: "Run server acceptance checks",
    });
    await checkServers.click();
    await page.getByText(/0 \/ 10 acceptance/).waitFor();
    const specs = [
      [
        "Historian server",
        "hist-01",
        "10.42.8.21",
        "History collector",
        "4841",
        "Append samples",
      ],
      [
        "MES application server",
        "mes-01",
        "10.42.8.22",
        "Production API",
        "8443",
        "Post completions",
      ],
    ];
    for (const [title, name, ip, service, port, permission] of specs) {
      const card = page.locator("article").filter({
        has: page.getByRole("heading", { name: title, exact: true }),
      });
      for (const [field, value] of Object.entries({
        "Host name": name,
        "IPv4 address": ip,
        "Default gateway": "10.42.8.1",
        "DNS resolver": "10.42.8.10",
        "Listener TCP port": port,
      }))
        await card.getByLabel(field, { exact: true }).fill(value);
      for (const [field, value] of Object.entries({
        "Running service": service,
        "Listener binding": "Service NIC",
        "Database permission": permission,
      }))
        await card.getByLabel(field, { exact: true }).selectOption(value);
      if (name === "hist-01")
        await card.getByLabel("Retention (whole days)").fill("30");
      else {
        await card
          .getByLabel("Backup destination")
          .selectOption("Independent repository");
        await card.getByLabel("Backup interval (minutes)").fill("15");
      }
    }
    await checkServers.click();
    await page.getByText("10 / 10 acceptance checks passed").waitFor();
    await stage("plc");
    const perform = (id) => page.locator('[data-a="' + id + '"]').click();
    await page.locator("textarea").fill("RUN := GUARD AND AUTO;");
    await perform("compile");
    await perform("prove");
    assert.equal(
      await page.evaluate(
        () =>
          SWControls.evaluatePLC(
            JSON.parse(localStorage.getItem("signalworks.production.v1")),
            { auto: true, part: true, guard: true },
          ).run,
      ),
      false,
    );
    await page
      .locator("textarea")
      .fill("PERMIT := GUARD AND AUTO; RUN := PERMIT AND PART;");
    await perform("compile");
    await perform("prove");
    await stage("scada");
    for (const [title, type, tag, pos] of [
      ["Conveyor run", "lamp", "lastRun", "1"],
      ["Cartons accepted", "count", "order.good", "4"],
    ]) {
      await page.locator("[name=title]").fill(title);
      await page.locator("[name=type]").selectOption(type);
      await page.locator("[name=tag]").selectOption(tag);
      await page.locator("[name=position]").selectOption(pos);
      await page.getByRole("button", { name: "Place widget" }).click();
    }
    await page.locator("[data-mode=runtime]").click();
    await perform("validate");
    await stage("robot");
    const sliders = page.getByRole("slider");
    for (const [goal, a, b] of [
      ["pick", "12", "45"],
      ["place", "125", "35"],
    ]) {
      await sliders.nth(0).fill(a);
      await sliders.nth(1).fill(b);
      await page
        .getByRole("button", { name: "Teach " + goal, exact: true })
        .click();
    }
    await page.getByRole("button", { name: "Test accepted carton" }).click();
    await page.getByText(/Accepted-carton test: passed/).waitFor();
    await page.getByRole("button", { name: "Test rejected carton" }).click();
    await page.getByText(/Reject hold: passed/).waitFor();
    await stage("trace");
    await byWork("interface");
    await stage("sequence");
    await page.locator("[data-seq=example]").click();
    const code = page.locator("[data-seq-code]");
    const source = await code.inputValue();
    await code.fill(
      source.replace(
        "ACCEPTED ? TRANSFER : REJECT",
        "ACCEPTED ? REJECT : TRANSFER",
      ),
    );
    await page.locator("[data-seq=compile]").click();
    await page.locator("[data-seq=prove]").click();
    assert.equal(
      await page.evaluate(() =>
        SWSequence.ready(
          JSON.parse(localStorage.getItem("signalworks.production.v1")),
        ),
      ),
      false,
    );
    await code.fill(source);
    await page.locator("[data-seq=compile]").click();
    await page.locator("[data-seq=prove]").click();
    await stage("line");
    await page.locator("#guard").selectOption("no");
    await byWork("cycle");
    assert.match(await readNotice(), /PLC output OFF/i);
    await page.locator("#guard").selectOption("yes");
    await page.locator("#quality").selectOption("Reject");
    await byWork("cycle");
    await waitCartons(1);
    await page.locator("#quality").selectOption("Pass");
    await byWork("cycle");
    await waitCartons(2);
    await byWork("cycle");
    await waitCartons(3);
    await page
      .locator("#screen-live")
      .getByText("Cartons accepted", { exact: true })
      .waitFor();
    assert.match(await page.locator("#screen-live").innerText(), /2/);
    await stage("trace");
    await byWork("close");
    assert.match(await readNotice(), /blocked/);
    await byWork("post");
    assert.match(await readNotice(), /offline/);
    await byWork("interface");
    await byWork("post");
    assert.match(await readNotice(), /3 new/);
    await byWork("post");
    assert.match(await readNotice(), /0 new/);
    await byWork("close");
    assert.match(await readNotice(), /closed/i);
    await page.reload();
    assert.match(await page.locator("#order-badge").innerText(), /Closed/);
    assert.equal(await page.locator("tbody tr").count(), 3);
    await stage("scada");
    await page.locator('[data-mode="design"]').click();
    await page.locator("[data-screen]").selectOption("diagnostics");
    await page.locator("[name=title]").fill("Accepted cartons by cycle");
    await page.locator("[name=type]").selectOption("trend");
    await page.locator("[name=tag]").selectOption("order.events.accepted");
    await page.getByRole("button", { name: "Place widget" }).click();
    await page.locator('[data-mode="runtime"]').click();
    await page.getByText("Cycle 3: 2 accepted").waitFor();
    await stage("trace");
    await byWork("new");
    await page.locator("#target").fill("3");
    await page.locator("#sku").selectOption("CTN-12");
    await byWork("receive");
    assert.equal(await page.locator("#target").inputValue(), "3");
    assert.equal(await page.locator("#sku").inputValue(), "CTN-12");
    await stage("trace");
    await page.getByText(/Closed order WO-4201/).click();
    await page
      .getByText(/WO-4201-003.*Posted/)
      .first()
      .waitFor();
    await page.setViewportSize({ width: 375, height: 812 });
    for (const id of [
      "trace",
      "servers",
      "plc",
      "sequence",
      "scada",
      "robot",
      "line",
      "orders",
    ]) {
      await stage(id);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "width at " + id,
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        base,
        room: "direct load, five stages and orbit",
        workstations: await page.locator("#stations a").count(),
        cartons: 3,
        accepted: 2,
        rejects: 1,
        erpDuplicatePostings: 0,
        closedAfterReload: true,
        mobile: 375,
        errors,
      }),
    );
  } finally {
    await browser.close();
  }
}
check().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
