import { communities, epochs, members, rewardConfigs } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onboardingWelcome } from "../bot/commands/onboarding.js";
import { admitContribution } from "../rewards/intake.js";
import { createTestDb, seedCommunity } from "../rewards/test-db.js";
import { parseSetupManifest, setupPlan } from "./manifest.js";
import { applyCommunitySetup, checkCommunitySetup } from "./registration.js";
import { manifest, telegramFor } from "./test-fixture.js";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(async () => {
  await t.close();
});
const parsed = () => parseSetupManifest(manifest());
const apply = (m = parsed()) => applyCommunitySetup(t.db, m, setupPlan(m).hash, telegramFor(m));

describe("operator-assisted community registration", () => {
  it("checks a new target read-only and rejects unreviewed apply before any provider read", async () => {
    const m = parsed();
    expect(await checkCommunitySetup(t.db, m, telegramFor(m))).toMatchObject({ status: "ready" });
    expect(await t.db.select().from(communities)).toEqual([]);
    const reader = telegramFor(m);
    const read = vi.spyOn(reader, "getMe");
    await expect(applyCommunitySetup(t.db, m, "0".repeat(64), reader)).rejects.toThrow(
      "plan_mismatch",
    );
    expect(read).not.toHaveBeenCalled();
  });

  it("registers two independent communities and renders their own welcome/audit destinations", async () => {
    const first = parsed();
    const second = parseSetupManifest(manifest("Beta", true));
    const old = await seedCommunity(t.db);
    const before = await t.db
      .select()
      .from(communities)
      .where(eq(communities.id, old.community.id));
    for (const m of [first, second]) {
      expect(await apply(m)).toMatchObject({ status: "created", communityId: m.communityId });
      const [row] = await t.db.select().from(communities).where(eq(communities.id, m.communityId));
      expect(row?.rewardIntakePausedAt).toBeInstanceOf(Date);
      expect(row?.firstPaidEpoch).toBeNull();
      expect(row?.chainAddress).toBeNull();
      const [epoch] = await t.db.select().from(epochs).where(eq(epochs.communityId, m.communityId));
      expect(epoch?.opensAt.toISOString()).toBe(m.activationTime);
      const reply = vi.fn();
      await onboardingWelcome(
        t.db,
        {
          from: { id: Number(m.adminTelegramUserId) },
          chat: { type: "supergroup", id: Number(m.telegramChatId) },
          msg: { message_id: 1 },
          reply,
        } as never,
        "https://hyphae.test",
      );
      const text = reply.mock.calls[0]?.[0];
      expect(text).toContain(m.name);
      expect(text).toContain(`/c/${m.mint}`);
      expect(text).not.toContain(m.name === "Alpha" ? second.mint : first.mint);
    }
    expect(
      await t.db.select().from(communities).where(eq(communities.id, old.community.id)),
    ).toEqual(before);
  });

  it("keeps a new community on paused reward intake rather than the legacy scoring path", async () => {
    const m = parsed();
    await apply(m);
    const [member] = await t.db
      .insert(members)
      .values({
        communityId: m.communityId,
        telegramUserId: 12n,
        wallet: "FixtureWallet",
        linkMethod: "signature",
      })
      .returning();
    if (!member) throw new Error("fixture member missing");
    const result = await admitContribution(t.db, {
      communityId: m.communityId,
      memberId: member.id,
      contribution: {
        kind: "text",
        url: null,
        text: "real work",
        oembed: null,
        telegramMessageId: 1,
      },
      artifactKey: "text:fixture",
      idempotencyKey: "tg:-100100:1",
      capture: { source: "telegram_text", capturedAt: new Date().toISOString(), limitations: [] },
    });
    expect(result).toMatchObject({ status: "paused" });
    const rows = await t.db.execute(sql`select count(*)::int as n from contributions`);
    expect(rows.rows[0]?.n).toBe(0);
  });

  it("returns an exact repeat without resetting intake, overwriting history or adding epochs", async () => {
    const m = parsed();
    await apply(m);
    await t.db
      .update(communities)
      .set({ rewardIntakePausedAt: null })
      .where(eq(communities.id, m.communityId));
    expect(await apply(m)).toMatchObject({ status: "existing", communityId: m.communityId });
    const [row] = await t.db.select().from(communities);
    expect(row?.rewardIntakePausedAt).toBeNull();
    expect(await t.db.select().from(epochs)).toHaveLength(1);
    expect(await t.db.select().from(rewardConfigs)).toHaveLength(1);
  });

  it("refuses a different UUID, mint, chat, administrator or configuration without changing the existing row", async () => {
    const m = parsed();
    await apply(m);
    const before = await t.db.select().from(communities);
    const second = manifest("Beta", true);
    for (const candidate of [
      { ...second, mint: m.mint },
      { ...second, telegramChatId: m.telegramChatId },
      { ...second, communityId: m.communityId },
      { ...manifest(), adminTelegramUserId: "12" },
      { ...manifest(), approvalReference: "unrelated-approval" },
      { ...manifest(), botUserId: "98" },
      { ...manifest(), database: { ...manifest().database, port: 55434 } },
    ]) {
      const input = parseSetupManifest(candidate);
      await expect(apply(input)).rejects.toThrow("registration_conflict");
    }
    expect(await t.db.select().from(communities)).toEqual(before);
  });

  it("rolls back community creation if pinned-epoch creation fails", async () => {
    await t.db.execute(
      sql`create function reject_setup_epoch() returns trigger language plpgsql as $$ begin raise exception 'private DB failure'; end; $$`,
    );
    await t.db.execute(
      sql`create trigger reject_setup_epoch before insert on epochs for each row execute function reject_setup_epoch()`,
    );
    await expect(apply()).rejects.toThrow("setup_outcome_unknown");
    expect(await t.db.select().from(communities)).toEqual([]);
    expect(await t.db.select().from(rewardConfigs)).toEqual([]);
  });

  it("refuses elapsed activation or failed Telegram evidence before leaving any registration", async () => {
    const elapsed = parseSetupManifest({
      ...manifest(),
      activationTime: "2000-01-01T00:00:00.000Z",
    });
    await expect(apply(elapsed)).rejects.toThrow("activation_not_future");
    const m = parsed();
    const reader = telegramFor(m);
    reader.getMe = async () => ({ id: 98, is_bot: true });
    await expect(applyCommunitySetup(t.db, m, setupPlan(m).hash, reader)).rejects.toThrow(
      "telegram_bot_mismatch",
    );
    expect(await t.db.select().from(communities)).toEqual([]);
  });
});
