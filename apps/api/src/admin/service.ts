import { type AdminCommunity, AdminCommunitySchema, type AdminIntakeUpdate } from "@hyphae/core";
import { communities, type Db } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { dbClock, withCommunityLock } from "../rewards/config.js";
import { AdminError, assertActive, within } from "./guard.js";

type Community = typeof communities.$inferSelect;
export type AdminAuthorization = (community: Community, signal: AbortSignal) => Promise<void>;

function overview(community: Community, pausedAt: Date | null, now: Date): AdminCommunity {
  return AdminCommunitySchema.parse({
    state: "admin",
    community: { mint: community.mint, name: community.name },
    intake: { paused: pausedAt !== null, paused_at: pausedAt?.toISOString() ?? null },
    as_of: now.toISOString(),
  });
}

// The same lock used by reward admission protects designation, chat, CAS and intake state.
// No configuration, epoch, payout policy or reward history is changed here.
export async function administerCommunity(
  db: Db,
  input: {
    mint: string;
    actorId: bigint;
    signal: AbortSignal;
    deadline: number;
    authorize: AdminAuthorization;
    update?: AdminIntakeUpdate;
  },
): Promise<AdminCommunity> {
  assertActive(input.signal, input.deadline);
  return db.transaction(
    async (tx) => {
      assertActive(input.signal, input.deadline);
      const remaining = Math.max(1, input.deadline - Date.now());
      // SET LOCAL also works through the transaction-mode pooler; a queued lock cannot live
      // indefinitely after the HTTP deadline. A later callback still checks cancellation.
      await tx.execute(
        sql`select set_config('statement_timeout', ${String(remaining)}, true), set_config('lock_timeout', ${String(remaining)}, true)`,
      );
      const [selected] = await tx
        .select()
        .from(communities)
        .where(eq(communities.mint, input.mint));
      assertActive(input.signal, input.deadline);
      if (!selected) throw new AdminError("not_found", 404);
      if (selected.adminTelegramUserId !== input.actorId) throw new AdminError("forbidden", 403);
      if (!input.update) {
        await within(input.authorize(selected, input.signal), input.signal);
        // An overview must not hold the reward-writer lock during provider calls. Recheck
        // designation and the exact group with a fresh read before releasing any private data.
        const [current] = await tx
          .select()
          .from(communities)
          .where(eq(communities.id, selected.id));
        if (
          !current ||
          current.mint !== input.mint ||
          current.adminTelegramUserId !== input.actorId ||
          current.telegramChatId !== selected.telegramChatId
        )
          throw new AdminError("forbidden", 403);
        const now = await dbClock(tx, current.id);
        assertActive(input.signal, input.deadline);
        return overview(current, current.rewardIntakePausedAt, now);
      }
      return withCommunityLock(tx, selected.id, {}, async (locked, community) => {
        assertActive(input.signal, input.deadline);
        if (community.mint !== input.mint || community.adminTelegramUserId !== input.actorId)
          throw new AdminError("forbidden", 403);
        await within(input.authorize(community, input.signal), input.signal);
        assertActive(input.signal, input.deadline);
        let pausedAt = community.rewardIntakePausedAt;
        if (input.update) {
          const expected = input.update.expected_paused_at;
          if (
            (pausedAt?.getTime() ?? null) !==
            (expected === null ? null : new Date(expected).getTime())
          )
            throw new AdminError("conflict", 409);
          if ((pausedAt !== null) !== input.update.paused) {
            pausedAt = input.update.paused ? await dbClock(locked, community.id) : null;
            assertActive(input.signal, input.deadline);
            await locked.execute(
              sql`select set_config('statement_timeout', ${String(Math.max(1, input.deadline - Date.now()))}, true)`,
            );
            assertActive(input.signal, input.deadline);
            await locked
              .update(communities)
              .set({ rewardIntakePausedAt: pausedAt })
              .where(eq(communities.id, community.id));
            assertActive(input.signal, input.deadline);
          }
        }
        const now = await dbClock(locked, community.id);
        assertActive(input.signal, input.deadline);
        return overview(community, pausedAt, now);
      });
    },
    {
      isolationLevel: "read committed",
      ...(input.update ? {} : { accessMode: "read only" as const }),
    },
  );
}
