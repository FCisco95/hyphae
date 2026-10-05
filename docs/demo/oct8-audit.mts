// Read-only audit for the October 8-9 first-payout sitting. It writes nothing.
//
// From apps/api (the packet's working directory), with the .env path from the packet:
//   node --env-file=$hyphaeEnv --import tsx ../../docs/demo/oct8-audit.mts [epoch-index]
//
// One repeatable-read, read-only transaction holds everything it reports:
//   1. the C18b inventories, run from the packet's own SQL block so the two cannot drift;
//   2. the real payout gate (`payoutGateIn`), which says `not_final` until the epoch is closed;
//   3. each member's effective result, linked wallet, rules-test pass and expected allocation.
// The member's current MYCEL balance is one extra finalized RPC read, shown for orientation only:
// the gate counts a hold result read after the close, not this one.
//
// Its output names members and contributions by ID so a correction can be targeted. Keep it
// private; the public receipt needs counts and the verdict only.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { db } from "../../apps/api/src/db.js";
import { walletAt } from "../../apps/api/src/link/wallet-links.js";
import { payoutGateIn } from "../../apps/api/src/payout/gate.js";
import { passesBefore, rulesTestFor } from "../../apps/api/src/payout/rules-test.js";
import { readOnly } from "../../apps/api/src/pg.js";
import { selectEffective } from "../../apps/api/src/rewards/effective.js";
import { allocate } from "../../packages/core/src/allocation.js";

const apiRequire = createRequire(join(process.cwd(), "package.json"));
const { sql } = await import(pathToFileURL(apiRequire.resolve("drizzle-orm")).href);

const MINT = "HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg";
const GROSS_LAMPORTS = 500_000_000n;
const epochIndex = Number(process.argv[2] ?? 2);

// The packet's C18b block, minus its transaction control (this script owns the transaction).
const packet = readFileSync(
  new URL("./2026-10-08-first-payout-readiness.md", import.meta.url),
  "utf8",
);
const blocks = [...packet.matchAll(/```sql\n([\s\S]*?)```/g)]
  .map((m) => m[1])
  .filter((b) => b.includes("begin transaction isolation level repeatable read read only"));
if (blocks.length !== 1) throw new Error(`expected one C18b SQL block, found ${blocks.length}`);
const statements = blocks[0]
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s && !/^(begin|commit)\b/i.test(s));
if (statements.length !== 4 || !statements[0].startsWith("set local statement_timeout")) {
  throw new Error(`C18b block changed shape: ${statements.length} statements`);
}

const report = await readOnly(db, async (tx) => {
  const [stamp] = await tx.execute(
    sql`select clock_timestamp() as audit_at, current_setting('transaction_read_only') as read_only`,
  );
  const [epoch] = await tx.execute(sql`
    select e.id as epoch_id, e.community_id, e.status, e.closes_at,
           c.chain_address, c.reward_intake_paused_at
    from epochs e join communities c on c.id = e.community_id
    where c.mint = ${MINT} and e.index = ${epochIndex}`);
  if (!epoch) throw new Error(`no epoch ${epochIndex} for ${MINT}`);

  const inventory = [];
  for (const statement of statements) inventory.push(await tx.execute(sql.raw(statement)));
  const [, clock, contributions, duplicateGroups] = inventory;

  const dispatches = await tx.execute(sql`
    select d.purpose, d.state, count(*)::int as n
    from reward_dispatches d
    where d.contribution_id in (select contribution_id from reward_intakes where epoch_id = ${epoch.epoch_id})
    group by d.purpose, d.state order by d.purpose, d.state`);
  const nominations = await tx.execute(sql`
    select state, count(*)::int as n from reward_nominations
    where epoch_id = ${epoch.epoch_id} group by state order by state`);

  const pendingDecisions = contributions.filter(
    (c: { revision: number | null }) => c.revision === null,
  );

  const gate = await payoutGateIn(tx, { communityId: epoch.community_id, epochId: epoch.epoch_id });

  // The same primitives the gate uses, so a member can be checked before the epoch is closed
  // (the gate itself returns no members until then). Hold is not judged here.
  const [config] = await tx.execute(
    sql`select rc.payload->'rubric' as rubric from epochs e
        join reward_configs rc on rc.id = e.reward_config_id where e.id = ${epoch.epoch_id}`,
  );
  const closesAt = new Date(epoch.closes_at);
  const test = rulesTestFor(config.rubric);
  const effective = await selectEffective(tx, epoch.epoch_id, closesAt);
  const passes = test
    ? await passesBefore(tx, {
        memberIds: effective.totals.map((t) => t.memberId),
        testId: test.id,
        before: closesAt,
      })
    : new Map<string, string>();
  const preview = [];
  for (const t of effective.totals) {
    const link = await walletAt(tx, t.memberId, new Date());
    preview.push({
      memberId: t.memberId,
      pointUnits: t.pointUnits,
      wholePoints: t.wholePoints,
      wallet: link?.method === "signature" ? link.wallet : null,
      rulesTestPassedBeforeClose: passes.get(t.memberId) ?? null,
    });
  }
  return {
    preview,
    minHoldUnits: config.rubric.minHoldUnits,
    auditAt: stamp.audit_at,
    readOnly: stamp.read_only,
    clock,
    epoch: {
      index: epochIndex,
      status: epoch.status,
      closesAt: epoch.closes_at,
      intakePausedAt: epoch.reward_intake_paused_at,
      chainAddress: epoch.chain_address,
    },
    c18b: {
      admittedRows: contributions.length,
      distinctOriginals: new Set(contributions.map((c: { original_id: string }) => c.original_id))
        .size,
      withoutDecision: pendingDecisions.length,
      dispatchesByPurposeState: dispatches,
      nominationsByState: nominations,
      duplicateGroups: duplicateGroups.length,
      rows: contributions,
      groups: duplicateGroups,
    },
    gate,
  };
});

// Payable before the close means points, a signed wallet and a rules-test pass; the hold result
// can only arrive after it, so a member with all three is expected, not yet decided.
const members = report.preview.map((m) => ({
  ...m,
  expectedPayable:
    BigInt(m.pointUnits) > 0n && m.wallet !== null && m.rulesTestPassedBeforeClose !== null,
}));

const expected = members.some((m) => m.expectedPayable)
  ? allocate(
      GROSS_LAMPORTS,
      members.map((m) => ({
        memberId: m.memberId,
        pointUnits: BigInt(m.pointUnits),
        payable: m.expectedPayable,
      })),
    )
  : null;

// Orientation only (see the header): the member's balance now, finalized.
const balances: Record<string, { raw: string; meetsMinHold: boolean }> = {};
for (const m of members) {
  if (!m.wallet || !process.env.READ_RPC_URL) continue;
  const res = await fetch(process.env.READ_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [m.wallet, { mint: MINT }, { encoding: "jsonParsed", commitment: "finalized" }],
    }),
  }).then((r) => r.json());
  type TokenAccount = {
    account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } };
  };
  const raw = (res.result?.value ?? []).reduce(
    (sum: bigint, a: TokenAccount) => sum + BigInt(a.account.data.parsed.info.tokenAmount.amount),
    0n,
  );
  balances[m.memberId] = { raw: raw.toString(), meetsMinHold: raw >= BigInt(report.minHoldUnits) };
}

const gateSummary =
  report.gate.status === "ready"
    ? { status: "ready", payable: report.gate.payable, members: report.gate.members }
    : { status: "blocked", blockers: report.gate.blockers, members: report.gate.members };

console.log(
  JSON.stringify(
    {
      auditAt: report.auditAt,
      readOnly: report.readOnly,
      epoch: report.epoch,
      c18b: report.c18b,
      gate: gateSummary,
      minHoldUnits: report.minHoldUnits,
      preview: members,
      mycelNowFinalized: balances,
      expectedAllocation: expected,
    },
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    1,
  ),
);
process.exit(0);
