const assert = require("node:assert/strict"),
  path = require("node:path"),
  { pathToFileURL } = require("node:url"),
  { chromium } = require("playwright");
(async () => {
  const base =
      process.argv[2] ||
      pathToFileURL(path.resolve(__dirname, "..") + path.sep).href,
    twin = process.argv[3] === "twin";
  const b = await chromium.launch(
    process.env.QA_BROWSER ? { channel: process.env.QA_BROWSER } : {},
  );
  try {
    const p = await b.newPage({ viewport: { width: 1280, height: 850 } });
    p.setDefaultTimeout(12000);
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    if (twin && base.startsWith("file:"))
      await p.goto(new URL("study/index.html", base).href);
    else {
      await p.goto(base + (twin ? "#plant" : "index.html"));
      await p
        .getByRole("link", { name: /Read or watch/i })
        .first()
        .click();
    }
    await p.locator("#line.chapter").waitFor();
    assert.equal(await p.locator(".chapter:not(.transcript)").count(), 5);
    const v = p.locator("video");
    await v.waitFor();
    await p.waitForFunction(()=>{const el=document.querySelector("video");return el.controls && el.readyState>=1;});
    await v.evaluate(async (el) => {
      el.muted = true;
      await el.play();
    });
    await p.waitForFunction(
      () => document.querySelector("video").currentTime > 1,
    );
    const media = await v.evaluate((el) => ({
      duration: el.duration,
      width: el.videoWidth,
      height: el.videoHeight,
    }));
    assert(media.duration > 120 && media.width >= 1280);
    await p.waitForFunction(() =>
      Array.from(document.querySelector("video").textTracks).some(
        (t) => t.cues?.length > 20,
      ),
    );
    await v.evaluate((el) => {
      el.pause();
      el.currentTime = el.duration * 0.7;
    });
    await p.waitForFunction(
      () =>
        document.querySelector("video").readyState >= 2 &&
        !document.querySelector("video").seeking,
    );
    await p.waitForFunction(()=>{const el=document.querySelector("video");return Math.abs(el.currentTime-el.duration*.7)<2;});
    for (const [scene, answer] of [
      ["healthy", "all"],
      ["fibre", "source"],
      ["stale", "receiver"],
    ]) {
      await p.locator("[data-sl-field=condition]").selectOption(scene);
      await p.locator("[data-sl-field=prediction]").selectOption(answer);
      await p.locator("[data-sl-action=sample]").click();
      await p.locator("[data-sl-action=check]").click();
      assert.match(
        await p.locator("[data-sl-out=feedback]").innerText(),
        /correct/i,
      );
    }
    for (const d of await p
      .locator(".chapter:not(.transcript) details")
      .all()) {
      await d.locator("summary").click();
      assert((await d.getAttribute("open")) !== null);
    }
    await p.setViewportSize({ width: 375, height: 812 });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errs, []);
    console.log({
      base,
      chapters: 5,
      media,
      captions: await v.evaluate((el) =>
        Array.from(el.textTracks).map((t) => t.cues?.length),
      ),
      networkCases: 3,
      mobile: 375,
      errors: errs,
    });
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
