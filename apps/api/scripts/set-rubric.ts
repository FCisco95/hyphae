// Usage: node --env-file=<abs .env> --import tsx scripts/set-rubric.ts <mint> <path/to/rubric.json>
// Replaces a community's rubric in place. Past scoring runs keep their own rubric_version.
import { readFileSync } from "node:fs";
import { RubricSchema } from "@hyphae/core";
import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { db } from "../src/db.js";

const [mint, file] = process.argv.slice(2);
if (!mint || !file) throw new Error("usage: set-rubric <mint> <rubric.json>");
const rubric = RubricSchema.parse(JSON.parse(readFileSync(file, "utf8")));
const [row] = await db
  .update(communities)
  .set({ rubric, rubricVersion: rubric.version })
  .where(eq(communities.mint, mint))
  .returning({ name: communities.name, rubricVersion: communities.rubricVersion });
if (!row) throw new Error(`no community with mint ${mint}`);
console.log(`${row.name}: rubric ${row.rubricVersion} (${rubric.community})`);
process.exit(0);
