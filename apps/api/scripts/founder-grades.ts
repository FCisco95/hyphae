import { readFile, writeFile } from "node:fs/promises";
import { founderGrades } from "../src/scoring/founder-grades.js";

// Regenerates the harness fixture from the founder-scored review; run Biome's formatter after.
const dir = new URL("../../../docs/rubrics/eval/", import.meta.url);
const review = JSON.parse(await readFile(new URL("mycel-synthetic-review.json", dir), "utf8"));
await writeFile(
  new URL("mycel-synthetic.json", dir),
  `${JSON.stringify(founderGrades(review), null, 2)}\n`,
);
