import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildDemo } from "./build.mjs";

const [modulePath, mode = "all"] = process.argv.slice(2);
if (!modulePath) throw new Error("Provide an existing Playwright entrypoint");
const output = await buildDemo();
const { createDemoServer } = await import(pathToFileURL(join(output, "server.mjs")).href);
const server = createDemoServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const origin = `http://127.0.0.1:${server.address().port}`;
  if (mode === "all" || mode === "bootstrap") {
    await page.route("**/demo.json", (route) =>
      route.fulfill({ status: 503, body: '{"error":"unavailable"}' }),
    );
    await page.goto(origin);
    await page.waitForTimeout(100);
    assert.equal(
      await page.locator("#status").getAttribute("data-state"),
      "error",
      "bootstrap failure must be visible",
    );
    assert.equal(await page.locator("#summary").getAttribute("aria-busy"), "false");
    assert.equal(await page.locator('[data-value="points"]').textContent(), "Unavailable");
    await page.unroute("**/demo.json");
    await page.click("#reload");
    await page.waitForFunction(() => document.querySelector("#status").dataset.state === "ready");
    assert.equal(await page.locator('[data-value="mint"]').textContent(), "DemoA");
  }
  if (mode === "all" || mode === "cooldown" || mode === "early-cooldown") {
    if (mode === "all" || mode === "early-cooldown") {
      await page.addInitScript(() => {
        const original = window.setTimeout;
        let firedEarly = false;
        window.__cooldownEarlyInjected = false;
        // Force a clock tick between retryUntil assignment and remaining-delay calculation.
        const now = Date.now;
        let ticks = 0;
        Date.now = () => now() + ticks++;
        window.setTimeout = (callback, delay, ...args) => {
          // SDK reads use 750ms and bootstrap uses 2000ms; target only the cooldown.
          if (!firedEarly && delay > 750 && delay <= 1000) {
            firedEarly = true;
            window.__cooldownEarlyInjected = true;
            return original(callback, 0, ...args);
          }
          return original(callback, delay, ...args);
        };
      });
    }
    let reads = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/v1/")) reads++;
    });
    await page.goto(origin);
    await page.waitForFunction(() => document.querySelector("#status").dataset.state === "ready");
    await page.selectOption("#scenario", "rate_limit");
    await page.waitForFunction(() => document.querySelector("#status").dataset.state === "error");
    if (mode === "all" || mode === "early-cooldown") {
      assert.equal(
        await page.evaluate(() => window.__cooldownEarlyInjected),
        true,
        "early cooldown injection must actually fire",
      );
    }
    const before = reads;
    assert.equal(
      await page.locator("#community").isDisabled(),
      true,
      "community trigger must share cooldown",
    );
    assert.equal(
      await page.locator("#scenario").isDisabled(),
      true,
      "scenario trigger must share cooldown",
    );
    await page.evaluate(() => {
      const community = document.querySelector("#community");
      community.value = "DemoB";
      community.dispatchEvent(new Event("change"));
      const scenario = document.querySelector("#scenario");
      scenario.value = "normal";
      scenario.dispatchEvent(new Event("change"));
      document.querySelector("#reload").click();
    });
    await page.waitForTimeout(100);
    assert.equal(reads, before, "no read trigger may bypass the cooldown");
    await page.waitForFunction(() => !document.querySelector("#reload").disabled, null, {
      timeout: 2500,
    });
    await page.click("#reload");
    await page.waitForFunction(() => document.querySelector("#status").dataset.state === "ready");
    assert.equal(await page.locator('[data-value="mint"]').textContent(), "DemoB");
  }
  console.log(
    JSON.stringify({
      status: "PASS",
      mode,
      bootstrapRecovery: mode === "all" || mode === "bootstrap",
      consistentCooldown: mode !== "bootstrap",
      earlyTimerRecovery: mode === "all" || mode === "early-cooldown",
    }),
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
