import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const SKIP = new Set(["node_modules", ".next", "dist"]);

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) ? [path] : [];
  });
}

// Three ways the code reads its environment: a property of process.env, an `env` alias of
// process.env, and the api's schema, which parses process.env whole.
function namesRead(): Set<string> {
  const names = new Set<string>();
  for (const file of ["apps", "packages"].flatMap((d) => sources(join(root, d)))) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1] as string);
    if (/\benv = process\.env;/.test(text))
      for (const m of text.matchAll(/\benv\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1] as string);
    if (/Env\.parse\(process\.env\)/.test(text))
      for (const m of text.matchAll(/^ {2}([A-Z][A-Z0-9_]*):/gm)) names.add(m[1] as string);
  }
  return names;
}

describe(".env.example", () => {
  it("names every environment variable the code reads", () => {
    const example = readFileSync(join(root, ".env.example"), "utf8");
    const listed = new Set([...example.matchAll(/^#? ?([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
    const read = namesRead();
    expect(read.size).toBeGreaterThan(20);
    expect([...read].filter((name) => !listed.has(name)).sort()).toEqual([]);
  });
});
