import { writeFile } from "node:fs/promises";
import { defineConfig } from "tsup";
import { adminOpenApiDocument } from "./src/openapi.js";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "browser",
  target: "es2022",
  dts: true,
  clean: true,
  treeshake: true,
  onSuccess: async () => {
    await writeFile("dist/openapi.json", `${JSON.stringify(adminOpenApiDocument(), null, 2)}\n`);
  },
});
