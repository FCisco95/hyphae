import { defineConfig } from "vitest/config";

export default defineConfig({
  // Suites share one database and each runs the migrations, so files run one at a time.
  test: {
    include: ["src/**/*.pg.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
