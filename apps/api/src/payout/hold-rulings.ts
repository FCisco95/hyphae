import { communities, type Db, epochs, holdChecks, holdRulings, members } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { HOLD_WINDOW_MS, payoutGateIn } from "./gate.js";

// Recording a hold ruling (Cisco, 2026-11-03, for MYCEL epoch 5): one epoch's members whose hold
// read never completed in the 24-hour window are not payable for that epoch. It is a recorded
// ruling, member by member, never a general rule: only members the gate holds on a check still
// pending or uncertain after the window are listed, and only they can be ruled.

export type UnreadHoldRefusal = "no_epoch" | "not_closed" | "window_open";

export interface UnreadHold {
  memberId: string;
  telegramUsername: string | null;
  wallet: string | null;
  holdStatus: "pending" | "uncertain";
  // The hold job's last recorded reason for the failed read, if any.
  checkReason: string | null;
}

export type UnreadHolds =
  | { status: "refused"; reason: UnreadHoldRefusal }
  | { status: "ok"; communityId: string; epochId: string; closesAt: Date; members: UnreadHold[] };

async function unreadIn(
  tx: Db,
  input: { mint: string; index: number; now: Date },
  forUpdate: boolean,
): Promise<UnreadHolds> {
  const query = tx
    .select({
      id: epochs.id,
      communityId: epochs.communityId,
      status: epochs.status,
      closesAt: epochs.closesAt,
    })
    .from(epochs)
    .innerJoin(communities, eq(communities.id, epochs.communityId))
    .where(and(eq(communities.mint, input.mint), eq(epochs.index, input.index)));
  const [epoch] = forUpdate ? await query.for("update", { of: epochs }) : await query;
  if (!epoch) return { status: "refused", reason: "no_epoch" };
  if (epoch.status !== "closed") return { status: "refused", reason: "not_closed" };
  if (input.now.getTime() <= epoch.closesAt.getTime() + HOLD_WINDOW_MS) {
    return { status: "refused", reason: "window_open" };
  }
  const ref = { communityId: epoch.communityId, epochId: epoch.id };
  const gate = await payoutGateIn(tx, ref, { clock: () => input.now });
  const held = new Set(
    gate.members
      .filter(
        (m) => m.status === "held" && m.reasons.length === 1 && m.reasons[0] === "hold_pending",
      )
      .map((m) => m.memberId),
  );
  const rows = await tx
    .select({
      memberId: holdChecks.memberId,
      status: holdChecks.status,
      reason: holdChecks.reason,
      telegramUsername: members.telegramUsername,
    })
    .from(holdChecks)
    .innerJoin(members, eq(members.id, holdChecks.memberId))
    .where(eq(holdChecks.epochId, epoch.id));
  const walletOf = new Map(gate.members.map((m) => [m.memberId, m.wallet]));
  const unread: UnreadHold[] = [];
  for (const r of rows) {
    if (!held.has(r.memberId)) continue;
    if (r.status !== "pending" && r.status !== "uncertain") continue;
    unread.push({
      memberId: r.memberId,
      telegramUsername: r.telegramUsername,
      wallet: walletOf.get(r.memberId) ?? null,
      holdStatus: r.status,
      checkReason: r.reason,
    });
  }
  unread.sort((a, b) => (a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0));
  return { status: "ok", ...ref, closesAt: epoch.closesAt, members: unread };
}

export function listUnreadHolds(
  db: Db,
  input: { mint: string; index: number; now: Date },
): Promise<UnreadHolds> {
  return unreadIn(db, input, false);
}

export type RecordOutcome =
  | { status: "refused"; reason: UnreadHoldRefusal | "nothing_to_rule" }
  | { status: "recorded"; epochId: string; count: number; members: UnreadHold[] };

// One ruling row per unread hold, in one transaction under the epoch row lock, from a list
// computed inside it: a hold result or a ruling recorded meanwhile is seen, never overridden.
export async function recordHoldRulings(
  db: Db,
  input: { mint: string; index: number; now: Date; reason: string; actor: string },
): Promise<RecordOutcome> {
  if (input.reason.trim() === "" || input.actor.trim() === "") {
    throw new Error("hold rulings: the reason and actor must not be blank");
  }
  return db.transaction(async (tx) => {
    const listed = await unreadIn(tx, input, true);
    if (listed.status === "refused") return listed;
    if (listed.members.length === 0) return { status: "refused", reason: "nothing_to_rule" };
    await tx.insert(holdRulings).values(
      listed.members.map((m) => ({
        epochId: listed.epochId,
        memberId: m.memberId,
        verdict: "not_payable",
        reason: input.reason,
        actor: input.actor,
      })),
    );
    return {
      status: "recorded" as const,
      epochId: listed.epochId,
      count: listed.members.length,
      members: listed.members,
    };
  });
}
