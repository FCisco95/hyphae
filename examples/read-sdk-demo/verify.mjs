import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildDemo } from "./build.mjs";

const modulePath = process.argv[2];
if (!modulePath)
  throw new Error("Usage: node examples/read-sdk-demo/verify.mjs /path/to/playwright/index.mjs");
const emptyStore = process.argv.includes("--empty-store")
  ? mkdtempSync(join(tmpdir(), "hyphae-cold-adopter-"))
  : undefined;
let output;
try {
  output = await buildDemo(
    emptyStore ? { storeDir: join(emptyStore, "store"), cacheDir: join(emptyStore, "cache") } : {},
  );
} finally {
  if (emptyStore) rmSync(emptyStore, { recursive: true, force: true });
}
const { createDemoServer } = await import(pathToFileURL(join(output, "server.mjs")).href);
const server = createDemoServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  const { chromium } = await import(pathToFileURL(modulePath).href);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  const ready = () =>
    page.waitForFunction(() => document.querySelector("#status").dataset.state === "ready");
  const failed = () =>
    page.waitForFunction(() => document.querySelector("#status").dataset.state === "error");
  const text = (key) => page.locator(`[data-value="${key}"]`).textContent();
  await ready();
  assert.equal(await text("mint"), "DemoA");
  assert.equal(await text("points"), "75");
  assert.match(await text("payment"), /Unavailable/);
  await page.selectOption("#community", "DemoB");
  await ready();
  assert.equal(await text("mint"), "DemoB");
  assert.equal(await text("points"), "0");
  assert.match(await text("allocation"), /no_payable_members/);
  await page.selectOption("#community", "DemoA");
  await ready();
  const failures = [];
  for (const scenario of ["unavailable", "malformed", "slow", "rate_limit"]) {
    await page.selectOption("#scenario", scenario);
    await failed();
    assert.equal(await text("points"), "Unavailable");
    assert.equal(await text("contributions"), "Unavailable");
    assert.equal(await text("payment"), "Unavailable");
    failures.push({ scenario, message: await page.locator("#status").textContent() });
    if (scenario === "rate_limit") {
      assert.equal(await page.locator("#reload").isDisabled(), true);
      await page.waitForFunction(() => !document.querySelector("#reload").disabled);
    }
    await page.selectOption("#scenario", "normal");
    await ready();
    assert.equal(await text("points"), "75");
  }
  // A slow, obsolete request must never populate the newly selected community.
  await page.selectOption("#scenario", "slow");
  await page.selectOption("#community", "DemoB");
  await page.selectOption("#scenario", "normal");
  await ready();
  assert.equal(await text("mint"), "DemoB");
  assert.equal(await text("points"), "0");
  await page.waitForTimeout(800);
  assert.equal(await text("points"), "0");
  const viewports = [];
  const shots = join(output, "screenshots");
  mkdirSync(shots, { recursive: true });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({ path: join(shots, `fixture-${width}.png`), fullPage: true });
    viewports.push({ width, overflow: false });
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.reload();
  await ready();
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "community");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "scenario");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "reload");
  await page.keyboard.press("Enter");
  await ready();
  assert.deepEqual(errors, []);
  const report = {
    status: "PASS",
    surface: `local fixture Chromium ${browser.version()}`,
    packedInstall: true,
    emptyStoreConsumer: Boolean(emptyStore),
    nativeWindowsProof: "UNKNOWN: no Windows machine available",
    communities: ["DemoA", "DemoB"],
    failures,
    obsoleteRequestIsolation: true,
    keyboard: "PASS",
    viewports,
    pageErrors: errors,
    screenshots: "dist/screenshots (all visibly labelled LOCAL FIXTURES)",
    phoneProof: false,
  };
  writeFileSync(join(output, "verification.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
