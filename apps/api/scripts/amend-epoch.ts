// Usage: node --env-file=<abs .env> --import tsx scripts/amend-epoch.ts <mint> --epoch <n> \
//   --prompt <version> --effective-at <iso with Z> --actor "<name>" --reason "<public reason>" [--plan]
// Records a pilot amendment of the open epoch's scoring prompt or Jev scorer
// (src/rewards/amendment.ts): from the effective time on, contributions admitted in that epoch are
// judged by the given registered version. A later amendment may follow once the previous one is in
// effect. --plan runs every check and prints the record, then rolls the transaction back. A
// refused amendment changes nothing.
import { communities, rewardConfigs } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { db } from "../src/db.js";
import { amendEpochPrompt } from "../src/rewards/amendment.js";
import { JEV_REGISTRY } from "../src/scoring/jev-registry.js";
import { parseAmendArgs } from "./amend-epoch-args.js";

const { mint, plan, input } = parseAmendArgs(process.argv.slice(2));
const community = await db.query.communities.findFirst({ where: eq(communities.mint, mint) });
if (!community) throw new Error(`no community with mint ${mint}`);

class PlanOnly extends Error {}
try {
  await db.transaction(async (tx) => {
    const row = await amendEpochPrompt(tx, {
      ...input,
      registry: JEV_REGISTRY,
      communityId: community.id,
    });
    const [to] = await tx
      .select({ digest: rewardConfigs.digest })
      .from(rewardConfigs)
      .where(eq(rewardConfigs.id, row.toConfigId));
    console.log(
      JSON.stringify(
        {
          outcome: plan ? "plan only: nothing recorded" : "recorded",
          community: community.name,
          epoch: input.epochIndex,
          amendment_id: plan ? null : row.id,
          effective_at: row.effectiveAt.toISOString(),
          recorded_at: row.recordedAt.toISOString(),
          from: { prompt: row.fromPromptVersion, template_hash: row.fromPromptTemplateHash },
          to: {
            prompt: row.toPromptVersion,
            template_hash: row.toPromptTemplateHash,
            config_digest: to?.digest.slice(0, 12),
          },
          actor: row.actor,
          reason: row.reason,
        },
        null,
        2,
      ),
    );
    if (plan) throw new PlanOnly();
  });
} catch (err) {
  if (!(err instanceof PlanOnly)) throw err;
}
process.exit(0);
