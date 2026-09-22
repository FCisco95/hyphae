// Usage: node --env-file=<abs .env> --import tsx scripts/reward-intake.ts <mint> pause|resume
// Explicit reward intake pause (O4). Epochs keep their schedule; admission returns `paused`.
import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { db } from "../src/db.js";
import { setRewardIntakePaused } from "../src/rewards/config.js";

const [mint, action] = process.argv.slice(2);
if (!mint || (action !== "pause" && action !== "resume")) {
  throw new Error("usage: reward-intake <mint> pause|resume");
}
const community = await db.query.communities.findFirst({ where: eq(communities.mint, mint) });
if (!community) throw new Error(`no community with mint ${mint}`);
const pausedAt = await setRewardIntakePaused(db, {
  communityId: community.id,
  paused: action === "pause",
});
console.log(
  pausedAt
    ? `${community.name}: reward intake paused at ${pausedAt.toISOString()}`
    : `${community.name}: reward intake resumed`,
);
process.exit(0);
