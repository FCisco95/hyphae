import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

const root = new URL("../../../", import.meta.url);
const web = fileURLToPath(new URL("../", import.meta.url));
const local = new URL(".env", root);
const values = existsSync(local)
  ? parseEnv(readFileSync(local, "utf8").replace(/^\uFEFF/, ""))
  : {};
// Recorded MYCEL pilot mint in the first-payout packet; local preview only.
const mint =
  process.argv[2] ||
  process.env.DEFAULT_MINT ||
  values.DEFAULT_MINT ||
  "HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg";
if (!/^[A-Za-z0-9]{1,64}$/.test(mint)) throw new Error("Invalid preview community mint");

const env = {
  ...process.env,
  HYPHAE_API_URL:
    process.env.HYPHAE_API_URL || values.HYPHAE_API_URL || "https://hyphae-api.fly.dev",
  HYPHAE_API_TOKEN:
    process.env.HYPHAE_API_TOKEN || values.HYPHAE_API_TOKEN || values.READ_API_WEB_TOKEN || "",
  DEFAULT_MINT: mint,
  PRIVY_LOGIN_ENABLED: "off",
  PRIVY_DEV_APP_ID: process.env.PRIVY_DEV_APP_ID || values.PRIVY_DEV_APP_ID || "",
};
// The preview needs public reads only. Never copy the API's secret configuration into it.
delete env.PRIVY_APP_SECRET;
delete env.PRIVY_VERIFICATION_KEY;
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const api = fileURLToPath(new URL("../../../apps/api/", import.meta.url));
const tsx = createRequire(new URL("../../../apps/api/package.json", import.meta.url)).resolve(
  "tsx",
);
let readerReady = false;
let readerFailed = false;
let stopping = false;
// Run just the new read-only feed locally; all existing public reads stay on deployed source.
const reader = spawn(
  process.execPath,
  ["--import", pathToFileURL(tsx).href, "scripts/preview-raids.ts"],
  {
    cwd: api,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      DATABASE_URL: process.env.DATABASE_URL || values.DATABASE_URL,
    },
    stdio: "inherit",
  },
);
reader.on("error", () => {
  readerFailed = true;
  console.error("Raid preview could not start.");
});
reader.on("exit", () => {
  if (readerReady && !stopping)
    console.error("The raid reader stopped. Restart pnpm preview to restore the feed.");
});
for (let attempt = 0; attempt < 30; attempt += 1) {
  if (readerFailed || reader.exitCode !== null) break;
  try {
    const response = await fetch("http://127.0.0.1:3011/health", {
      signal: AbortSignal.timeout(1000),
    });
    if (response.ok) {
      if ((await response.json()).pid !== reader.pid) {
        console.error("Port 3011 is in use by another process.");
        break;
      }
      readerReady = true;
      break;
    }
  } catch {
    /* Wait for the owned reader to listen. */
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
}
if (!readerReady) {
  reader.kill();
  console.error("Raid preview is unavailable; build not started.");
  process.exit(1);
}
env.HYPHAE_RAID_API_URL = "http://127.0.0.1:3011";
env.HYPHAE_LOCAL_PREVIEW = "on";
const build = spawnSync(process.execPath, [next, "build"], { cwd: web, env, stdio: "inherit" });
if (build.error) {
  reader.kill();
  throw build.error;
}
if (build.status !== 0) {
  reader.kill();
  process.exit(build.status ?? 1);
}

console.log(`\nCommunity preview: http://127.0.0.1:3010/c/${mint}`);
console.log("Login disabled. Existing public-read configuration stays server-side.\n");
if (env.PRIVY_DEV_APP_ID)
  console.log("Separate provider-only sign-in test: http://127.0.0.1:3010/dev/privy\n");
const server = spawn(
  process.execPath,
  [next, "start", "--hostname", "127.0.0.1", "--port", "3010"],
  {
    cwd: web,
    env,
    stdio: "inherit",
  },
);
server.on("error", () => {
  stopping = true;
  reader.kill();
  console.error("Preview could not start.");
  process.exitCode = 1;
});
server.on("exit", (code) => {
  stopping = true;
  reader.kill();
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
    server.kill(signal);
    reader.kill(signal);
  });
