import { defineConfig } from "tsup";

// The wallet-signing page: one browser bundle served by the api at /link/app.js.
export default defineConfig({
  entry: { app: "src/link/page/client.ts" },
  format: ["esm"],
  platform: "browser",
  target: "es2022",
  outDir: "dist/public",
  clean: false,
  minify: true,
  splitting: false,
  noExternal: [/.*/],
});
