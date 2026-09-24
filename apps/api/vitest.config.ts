import { configDefaults, defineConfig } from "vitest/config";

// Real-Postgres tests need a disposable server; they run through `test:pg`, never silently here.
// Every file boots PGlite and applies all migrations in beforeAll; under full parallel load that
// can exceed the 10 s default.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, "**/*.pg.test.ts"], hookTimeout: 30_000 },
});
