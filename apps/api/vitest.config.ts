import { configDefaults, defineConfig } from "vitest/config";

// Real-Postgres tests need a disposable server; they run through `test:pg`, never silently here.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, "**/*.pg.test.ts"] },
});
