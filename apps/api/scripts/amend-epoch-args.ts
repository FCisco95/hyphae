import { parseArgs } from "node:util";
import type { AmendInput } from "../src/rewards/amendment.js";
import { parseActivationTime } from "../src/rewards/config.js";

export const USAGE =
  'usage: amend-epoch <mint> --epoch <n> --prompt <version> --effective-at <iso with Z> --actor "<name>" --reason "<public reason>" [--plan]';

export function parseAmendArgs(argv: string[]): {
  mint: string;
  plan: boolean;
  input: Omit<AmendInput, "communityId">;
} {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      epoch: { type: "string" },
      prompt: { type: "string" },
      "effective-at": { type: "string" },
      actor: { type: "string" },
      reason: { type: "string" },
      plan: { type: "boolean" },
    },
  });
  const [mint] = positionals;
  const actor = values.actor?.trim();
  const reason = values.reason?.trim();
  const prompt = values.prompt?.trim();
  // Digits only: Number("") would read an unset shell variable as epoch 0.
  const epochIndex = /^[1-9]\d*$/.test(values.epoch ?? "") ? Number(values.epoch) : null;
  const effectiveAt = values["effective-at"];
  if (!mint || epochIndex === null || !prompt || !effectiveAt || !actor || !reason) {
    throw new Error(USAGE);
  }
  return {
    mint,
    plan: values.plan === true,
    input: {
      epochIndex,
      promptVersion: prompt,
      effectiveAt: parseActivationTime(effectiveAt),
      actor,
      reason,
    },
  };
}
