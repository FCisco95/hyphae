import { parseArgs } from "node:util";
import { canonicalJson, ScoreFlag, sha256Hex } from "@hyphae/core";
import { z } from "zod";
import type { CorrectionInput } from "../src/rewards/decisions.js";

export const ACTOR = "script:reward-correct";
export const USAGE =
  'usage: reward-correct <contribution-id> --expected-revision <n> --reason "<text>" --evidence <ref> [--evidence <ref>…] [--raw-quality <0-100>] [--flags <a,b>|none] [--effort eligible|ineligible]';

const Changes = z.object({
  // Digits only: coercing "" (an unset shell variable) would yield 0.
  rawQuality: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(0).max(100))
    .optional(),
  flags: z.array(ScoreFlag).optional(),
  effort: z.enum(["eligible", "ineligible"]).optional(),
});

// Points are never an argument: the operator corrects classifications and the service re-derives.
export function parseCorrectionArgs(argv: string[]): Omit<CorrectionInput, "communityId"> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "expected-revision": { type: "string" },
      reason: { type: "string" },
      evidence: { type: "string", multiple: true },
      "raw-quality": { type: "string" },
      flags: { type: "string" },
      effort: { type: "string" },
    },
  });
  const [contributionId] = positionals;
  const reason = values.reason?.trim();
  const evidenceRefs = values.evidence ?? [];
  const expectedRevision = Number(values["expected-revision"]);
  const changes = Changes.parse({
    rawQuality: values["raw-quality"],
    flags:
      values.flags === undefined
        ? undefined
        : values.flags === "none"
          ? []
          : values.flags.split(","),
    effort: values.effort,
  });
  if (
    !contributionId ||
    !reason ||
    !evidenceRefs.length ||
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 1 ||
    Object.values(changes).every((v) => v === undefined)
  ) {
    throw new Error(USAGE);
  }
  const content = { contributionId, expectedRevision, changes, reason, evidenceRefs };
  return {
    ...content,
    actor: ACTOR,
    // The same command replays its own revision; a different correction never shares its key.
    idempotencyKey: `${ACTOR}:${sha256Hex(canonicalJson(content))}`,
  };
}
