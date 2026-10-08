import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, transform } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const archive = join(root, "dist/hyphae-read-client-0.1.0.tgz");
const [mode, browserModule, ...extra] = process.argv.slice(2);
if (extra.length || (mode !== undefined && (mode !== "--browser" || !browserModule))) {
  throw new Error("Usage: verify-package.mjs [--browser /absolute/path/to/playwright/index.mjs]");
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout: 120_000 });
  if (result.status !== 0)
    throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

run("pnpm", ["pack", "--out", archive], root);
const files = run("tar", ["-tzf", archive], root).trim().split("\n").sort();
assert.deepEqual(
  files,
  [
    "package/LICENSE",
    "package/README.md",
    "package/dist/index.d.ts",
    "package/dist/index.js",
    "package/package.json",
  ].sort(),
);
const packed = JSON.parse(run("tar", ["-xOf", archive, "package/package.json"], root));
assert.equal(packed.private, true);
assert.deepEqual(packed.dependencies, { zod: "4.6.5" });
assert.equal(
  run("tar", ["-xOf", archive, "package/LICENSE"], root),
  readFileSync(join(root, "../../LICENSE"), "utf8"),
);

const temp = mkdtempSync(join(tmpdir(), "hyphae-sdk-consumer-"));
let server;
let webServer;
let apiBase = "";
let browser;
try {
  writeFileSync(
    join(temp, "package.json"),
    JSON.stringify({
      name: "hyphae-isolated-sdk-consumer",
      version: "0.0.0",
      private: true,
      type: "module",
      dependencies: { "@hyphae/read-client": `file:${archive}` },
    }),
  );
  run("pnpm", ["install", "--offline", "--ignore-scripts"], temp);
  const fixtureSource = readFileSync(join(root, "test/fixtures.ts"), "utf8");
  const { code } = await transform(fixtureSource, { loader: "ts", format: "esm" });
  const { responseFor } = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );

  const exercise = `
export async function exercise(c, requireRetryAfter = true) {
  const wallet = "11111111111111111111111111111111";
  const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const [a, b] = await Promise.all([c.getCommunity("CommunityA"), c.getCommunity("CommunityB")]);
  const epoch = await c.getEpoch(a.mint, 2);
  const rows = await c.getContributions(a.mint, 2, { offset: 3, limit: 10 });
  const board = await c.getLeaderboard(a.mint, 2);
  const contribution = await c.getContribution(id);
  const claim = await c.getClaim(a.mint, 2, wallet);
  const claims = await c.getWalletClaims(wallet);
  const record = await c.getWalletRecord(wallet);
  if (a.mint !== "CommunityA" || b.mint !== "CommunityB" || rows.offset !== 3 || board.epoch.index !== 2 || contribution.id !== id || claim.wallet !== wallet || claims.wallet !== wallet || record.wallet !== wallet)
    throw new Error("identity/paging mismatch");
  if (epoch.totals.point_units !== "9007199254740993" || claim.payment.status !== "unavailable")
    throw new Error("precision/payment mismatch");
  try { await c.getCommunity("Missing"); throw new Error("expected not_found"); }
  catch (error) { if (error.code !== "not_found") throw error; }
  try { await c.getCommunity("RateLimited"); throw new Error("expected rate limit"); }
  catch (error) { if (error.code !== "rate_limited" || (requireRetryAfter && error.retryAfterSeconds !== 30)) throw error; }
  return { status: "PASS", operations: 8, communities: [a.mint, b.mint], exactPointUnits: epoch.totals.point_units, payment: claim.payment.status };
}
`;
  writeFileSync(join(temp, "exercise.mjs"), exercise);
  writeFileSync(
    join(temp, "server.mjs"),
    `
import { createHyphaeReadClient } from "@hyphae/read-client";
import { exercise } from "./exercise.mjs";
console.log(JSON.stringify(await exercise(createHyphaeReadClient({ baseUrl: process.argv[2] }))));
`,
  );
  writeFileSync(
    join(temp, "consumer.ts"),
    `
import { createHyphaeReadClient, type Epoch, type Community } from "@hyphae/read-client";
const c = createHyphaeReadClient();
const community: Community = await c.getCommunity("CommunityA");
const epoch: Epoch = await c.getEpoch(community.mint, 2);
const units: string = epoch.totals.point_units;
// @ts-expect-error epoch indexes are numbers
c.getEpoch("CommunityA", "2");
// @ts-expect-error exact integers are strings
const rounded: number = epoch.totals.point_units;
// @ts-expect-error no registration endpoint exists in the public read SDK
c.registerCommunity("CommunityA");
void [units, rounded];
`,
  );
  run(
    process.execPath,
    [
      join(root, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--target",
      "ES2022",
      "consumer.ts",
    ],
    temp,
  );
  writeFileSync(
    join(temp, "browser-entry.mjs"),
    `
import { createHyphaeReadClient } from "@hyphae/read-client";
import { exercise } from "./exercise.mjs";
exercise(createHyphaeReadClient({ baseUrl: document.querySelector('meta[name="api-base"]').content }), false)
  .then(result => { window.sdkResult = result; })
  .catch(error => { window.sdkResult = { status: "FAIL", message: error.message }; });
`,
  );
  await build({
    entryPoints: [join(temp, "browser-entry.mjs")],
    outfile: join(temp, "browser.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "es2022",
    minify: true,
  });

  const handler = (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url === "/browser.js") {
      res.writeHead(200, { "content-type": "application/javascript" });
      res.end(readFileSync(join(temp, "browser.js")));
    } else if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        `<!doctype html><title>Local SDK fixture check</title><meta name="api-base" content="${apiBase}"><script type="module" src="/browser.js"></script>`,
      );
    } else if (req.url === "/v1/communities/Missing") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end('{"error":"not_found"}');
    } else if (req.url === "/v1/communities/RateLimited") {
      res.writeHead(429, { "content-type": "application/json", "retry-after": "30" });
      res.end('{"error":"unavailable"}');
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(responseFor(`http://127.0.0.1${req.url}`)));
    }
  };
  server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  apiBase = `${origin}/v1`;

  // Use an async child here: the local fixture server must keep answering while it runs.
  const { spawn } = await import("node:child_process");
  async function nodeConsumer(file, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [file, ...args], {
        cwd: temp,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      let error = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("consumer timeout"));
      }, 30_000);
      child.stdout.on("data", (data) => {
        output += data;
      });
      child.stderr.on("data", (data) => {
        error += data;
      });
      child.on("error", reject);
      child.on("close", (status) => {
        clearTimeout(timer);
        if (status === 0) resolve(JSON.parse(output));
        else reject(new Error(`consumer failed: ${error}`));
      });
    });
  }
  const node = await nodeConsumer("server.mjs", [`${origin}/v1`]);
  assert.equal(node.status, "PASS");
  copyFileSync(join(root, "examples/consumer.mjs"), join(temp, "example.mjs"));
  const example = await nodeConsumer("example.mjs", ["CommunityA", `${origin}/v1`]);
  assert.equal(example.community.mint, "CommunityA");
  let chromium = { status: "NOT_RUN" };
  if (process.argv.includes("--browser")) {
    const { chromium: engine } = await import(pathToFileURL(browserModule).href);
    browser = await engine.launch({ headless: true });
    webServer = createServer(handler);
    await new Promise((resolve) => webServer.listen(0, "127.0.0.1", resolve));
    const pageOrigin = `http://127.0.0.1:${webServer.address().port}`;
    assert.notEqual(pageOrigin, origin);
    const page = await browser.newPage();
    await page.goto(pageOrigin);
    await page.waitForFunction(() => window.sdkResult !== undefined);
    const result = await page.evaluate(() => window.sdkResult);
    assert.equal(result.status, "PASS", JSON.stringify(result));
    chromium = {
      ...result,
      version: browser.version(),
      crossOrigin: true,
      surface: "local desktop Chromium fixture; not phone proof",
    };
  }
  const report = {
    artifact: "dist/hyphae-read-client-0.1.0.tgz",
    sha256: createHash("sha256").update(readFileSync(archive)).digest("hex"),
    files,
    bytes: readFileSync(archive).length,
    node,
    types: "PASS",
    documentedExample: "PASS",
    browserBundleBytes: readFileSync(join(temp, "browser.js")).length,
    chromium,
  };
  writeFileSync(
    join(root, "dist/package-verification.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  if (webServer) await new Promise((resolve) => webServer.close(resolve));
  if (server) await new Promise((resolve) => server.close(resolve));
  rmSync(temp, { recursive: true, force: true });
}
