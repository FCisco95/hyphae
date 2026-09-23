import { communities, rewardConfigProposals } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrapRewardEpochs, buildRewardConfigPayload } from "./config.js";
import { stageRubric } from "./staging.js";
import { at, createTestDb, rubric, seedCommunity } from "./test-db.js";

const T0 = new Date("2026-10-01T00:00:00.000Z");
const rubricB = { ...rubric, version: "1.3.0" };

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const stagedVersion = async (communityId: string) => {
  const [row] = await t.db.select().from(communities).where(eq(communities.id, communityId));
  return row?.rubricVersion;
};

describe("stageRubric", () => {
  it("leaves the staging rubric unchanged when the bootstrap fails", async () => {
    const { community } = await seedCommunity(t.db);
    await expect(
      stageRubric(
        t.db,
        { communityId: community.id, rubric: rubricB, activateAt: T0, proposedBy: "test" },
        { clock: at(new Date(T0.getTime() + 1000)) },
      ),
    ).rejects.toThrow(/future/);
    expect(await stagedVersion(community.id)).toBe(rubric.version);
  });

  it("leaves the staging rubric unchanged when the proposal is a no-op", async () => {
    const { community } = await seedCommunity(t.db);
    await bootstrapRewardEpochs(
      t.db,
      {
        communityId: community.id,
        payload: buildRewardConfigPayload(rubricB),
        opensAt: T0,
        proposedBy: "test",
      },
      { clock: at(new Date(T0.getTime() - 3600_000)) },
    );
    await t.db
      .update(communities)
      .set({ rubricVersion: "0.9.0" })
      .where(eq(communities.id, community.id));
    await expect(
      stageRubric(
        t.db,
        { communityId: community.id, rubric: rubricB, proposedBy: "test" },
        { clock: at(new Date(T0.getTime() + 1000)) },
      ),
    ).rejects.toThrow(/already pinned/);
    expect(await stagedVersion(community.id)).toBe("0.9.0");
  });

  it("records the proposal and updates the staging rubric together", async () => {
    const { community } = await seedCommunity(t.db);
    await bootstrapRewardEpochs(
      t.db,
      {
        communityId: community.id,
        payload: buildRewardConfigPayload(rubric),
        opensAt: T0,
        proposedBy: "test",
      },
      { clock: at(new Date(T0.getTime() - 3600_000)) },
    );
    const result = await stageRubric(
      t.db,
      { communityId: community.id, rubric: rubricB, proposedBy: "test" },
      { clock: at(new Date(T0.getTime() + 1000)) },
    );
    expect(result.kind).toBe("proposed");
    expect(await stagedVersion(community.id)).toBe("1.3.0");
    const pending = await t.db
      .select()
      .from(rewardConfigProposals)
      .where(eq(rewardConfigProposals.communityId, community.id));
    expect(pending.map((p) => p.status).sort()).toEqual(["activated", "pending"]);
  });

  it("only stages the rubric for a community without reward epochs", async () => {
    const { community } = await seedCommunity(t.db);
    const result = await stageRubric(
      t.db,
      { communityId: community.id, rubric: rubricB, proposedBy: "test" },
      { clock: at(T0) },
    );
    expect(result).toEqual({ kind: "staged_only" });
    expect(await stagedVersion(community.id)).toBe("1.3.0");
  });
});
