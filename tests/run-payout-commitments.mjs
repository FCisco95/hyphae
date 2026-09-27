import { existsSync, readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

// Supplemental Node 22.15+ runner for the same cases used by Vitest. It runs PGlite in-process
// and needs no compiler subprocess. It does not replace the full Vitest/PostgreSQL release gate.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        error.code === "ERR_MODULE_NOT_FOUND" &&
        specifier.startsWith(".") &&
        specifier.endsWith(".js")
      ) {
        const candidate = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
        if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true };
      }
      throw error;
    }
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".ts")) {
      return {
        format: "module",
        source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8"), {
          mode: "transform",
          sourceUrl: url,
        }),
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

const { commitmentCases } = await import("../apps/api/src/payout/commitments.test-cases.ts");
commitmentCases((name, run) => test(name, run));
