import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../../packages/read-client/node_modules/esbuild/lib/main.js";

const home = fileURLToPath(new URL("./", import.meta.url));
const sdk = fileURLToPath(new URL("../../packages/read-client/", import.meta.url));
function run(args, cwd) {
  const result = spawnSync("pnpm", args, { cwd, encoding: "utf8", timeout: 120_000 });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);
}

export async function buildDemo() {
  const archive = join(sdk, "dist/hyphae-read-client-0.1.0.tgz");
  run(["pack", "--out", archive], sdk);
  const consumer = mkdtempSync(join(tmpdir(), "hyphae-reference-adopter-"));
  try {
    writeFileSync(
      join(consumer, "package.json"),
      JSON.stringify({
        name: "hyphae-reference-adopter",
        version: "0.0.0",
        private: true,
        type: "module",
        dependencies: { "@hyphae/read-client": `file:${archive}` },
      }),
    );
    run(["install", "--offline", "--ignore-scripts"], consumer);
    copyFileSync(join(home, "app.js"), join(consumer, "app.js"));
    const output = join(home, "dist");
    mkdirSync(output, { recursive: true });
    await build({
      entryPoints: [join(consumer, "app.js")],
      outfile: join(output, "app.js"),
      bundle: true,
      platform: "browser",
      target: "es2022",
      format: "esm",
      minify: true,
    });
    for (const file of ["index.html", "style.css", "server.mjs", "fixtures.mjs"])
      copyFileSync(join(home, file), join(output, file));
    writeFileSync(join(output, "package.json"), JSON.stringify({ private: true, type: "module" }));
    return output;
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
}
