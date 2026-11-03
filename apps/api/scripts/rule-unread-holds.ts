// Usage: DATABASE_URL=<postgres url> node --import tsx scripts/rule-unread-holds.ts --mint <mint>
//   --epoch <index> --reason "<why>" --actor <who> [--apply]
// Records a hold ruling for one epoch (Cisco, 2026-11-03, for MYCEL epoch 5): every member whose
// hold read is still pending or uncertain after the 24-hour window is not payable for that epoch.
// A dry run unless --apply: it lists the members it would rule. It refuses before the window ends
// and never rules a member whose hold was read (holder or below). The database URL is read from
// the environment and never printed.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createDb, type Db } from "@hyphae/db";
import {
  listUnreadHolds,
  type RecordOutcome,
  recordHoldRulings,
  type UnreadHolds,
} from "../src/payout/hold-rulings.js";
import { BASE58 } from "./publish-epoch-cli.js";
import { databaseLabel } from "./server-community-cli.js";

export const RULE_USAGE =
  'usage: DATABASE_URL=... rule-unread-holds --mint <mint> --epoch <index> --reason "<why>" --actor <who> [--apply]';

export interface RuleArgs {
  apply: boolean;
  mint: string;
  index: number;
  reason: string;
  actor: string;
}

export function parseRuleArgs(argv: string[]): RuleArgs {
  const fail = (why: string): never => {
    throw new Error(`${why}\n${RULE_USAGE}`);
  };
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      mint: { type: "string" },
      epoch: { type: "string" },
      reason: { type: "string" },
      actor: { type: "string" },
      apply: { type: "boolean" },
    },
  });
  const mint = values.mint ?? "";
  if (!BASE58.test(mint)) fail("--mint must be a base58 address");
  if (!/^[1-9]\d{0,8}$/.test(values.epoch ?? "")) fail("--epoch must be a positive index");
  const reason = (values.reason ?? "").trim();
  if (reason === "") fail("--reason must say why");
  const actor = (values.actor ?? "").trim();
  if (actor === "") fail("--actor must name who rules");
  return { apply: values.apply ?? false, mint, index: Number(values.epoch), reason, actor };
}

export async function ruleUnreadHolds(
  argv: string[],
  deps: { db: Db; now?: Date; log?: (line: string) => void },
): Promise<UnreadHolds | RecordOutcome> {
  const args = parseRuleArgs(argv);
  const log = deps.log ?? console.log;
  const now = deps.now ?? new Date();
  const input = { mint: args.mint, index: args.index, now };
  const listed = await listUnreadHolds(deps.db, input);
  if (listed.status === "refused") {
    log(`refused: ${listed.reason}`);
    return listed;
  }
  log(
    `epoch ${args.index} of ${args.mint} (${listed.epochId}), closed ${listed.closesAt.toISOString()}`,
  );
  log(`${listed.members.length} member(s) with a hold read unresolved after the window:`);
  for (const m of listed.members) {
    log(
      `  ${m.memberId} @${m.telegramUsername ?? "-"} wallet ${m.wallet ?? "-"} hold ${m.holdStatus}${m.checkReason ? ` (${m.checkReason})` : ""}`,
    );
  }
  log(
    `ruling: not_payable for epoch ${args.index} only; reason "${args.reason}", actor ${args.actor}`,
  );
  if (!args.apply) {
    log("dry run: nothing written; --apply records one hold_rulings row per member listed");
    return listed;
  }
  const out = await recordHoldRulings(deps.db, {
    ...input,
    reason: args.reason,
    actor: args.actor,
  });
  log(out.status === "recorded" ? `recorded ${out.count} ruling(s)` : `refused: ${out.reason}`);
  return out;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("refused: set DATABASE_URL to the database to rule in");
    process.exit(1);
  }
  const db = createDb(url);
  console.log(`database ${databaseLabel(url)}`);
  ruleUnreadHolds(process.argv.slice(2), { db }).then(
    async (out) => {
      await db.$client.end();
      process.exit(out.status === "refused" ? 1 : 0);
    },
    async (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      await db.$client.end();
      process.exit(1);
    },
  );
}
