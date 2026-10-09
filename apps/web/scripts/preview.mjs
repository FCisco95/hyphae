import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = new URL("../../../", import.meta.url);
const web = fileURLToPath(new URL("../", import.meta.url));
const local = new URL(".env", root);
const values = existsSync(local) ? parseEnv(readFileSync(local, "utf8")) : {};
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
};
// The preview needs public reads only. Never copy the API's secret configuration into it.
delete env.PRIVY_APP_SECRET;
delete env.PRIVY_VERIFICATION_KEY;
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const build = spawnSync(process.execPath, [next, "build"], { cwd: web, env, stdio: "inherit" });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

console.log(`\nCommunity preview: http://127.0.0.1:3010/c/${mint}`);
console.log("Login disabled. Existing public-read configuration stays server-side.\n");
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
  console.error("Preview could not start.");
  process.exitCode = 1;
});
server.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
