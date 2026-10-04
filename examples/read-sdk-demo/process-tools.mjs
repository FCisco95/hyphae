import { accessSync, constants, existsSync, realpathSync, statSync } from "node:fs";
import { basename, delimiter, extname, join, resolve, win32 } from "node:path";
import { pathToFileURL } from "node:url";

export function isPnpmEntrypoint(path) {
  return /^pnpm(?:\.(?:cjs|mjs|js|exe))?$/i.test(basename(path.replaceAll("\\", "/")));
}

function findPnpm() {
  const candidates = [];
  if (process.env.npm_execpath && isPnpmEntrypoint(process.env.npm_execpath))
    candidates.push(process.env.npm_execpath);
  for (const dir of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
    for (const suffix of [
      "pnpm",
      "pnpm.exe",
      "pnpm.cjs",
      "pnpm.js",
      "node_modules/pnpm/bin/pnpm.cjs",
      "node_modules/corepack/dist/pnpm.js",
      "../lib/node_modules/pnpm/bin/pnpm.cjs",
      "../lib/node_modules/corepack/dist/pnpm.js",
    ]) {
      candidates.push(join(dir, suffix));
    }
  }
  for (const candidate of candidates) {
    if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
    const path = realpathSync(candidate);
    if (/\.(?:cjs|mjs|js|exe)$/i.test(path)) return path;
    if (process.platform !== "win32" && extname(path) === "") {
      try {
        accessSync(path, constants.X_OK);
        return path;
      } catch {
        // Continue looking for an executable pnpm entrypoint.
      }
    }
  }
  throw new Error(
    "Cannot resolve pnpm's Node entrypoint. Run through pnpm exec node, or install pnpm 10.",
  );
}

// Execute JavaScript through Node; native executables run directly, without a shell.
export function pnpmInvocation(args, { cliPath = findPnpm(), nodePath = process.execPath } = {}) {
  if (/\.exe$/i.test(cliPath) || (process.platform !== "win32" && extname(cliPath) === ""))
    return { command: cliPath, args, shell: false };
  if (!/\.(?:cjs|mjs|js)$/i.test(cliPath))
    throw new Error("pnpm entrypoint must be JavaScript or a native executable");
  return { command: nodePath, args: [cliPath, ...args], shell: false };
}

export function isMainModule(
  moduleUrl,
  entry = process.argv[1],
  windows = process.platform === "win32",
) {
  if (!entry) return false;
  const path = windows ? win32.resolve(entry) : resolve(entry);
  return pathToFileURL(path, { windows }).href === moduleUrl;
}
