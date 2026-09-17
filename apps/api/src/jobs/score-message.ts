import { creditedScore, creditReason, type ScoreOutput } from "@hyphae/core";

export interface ScoreMessageInput {
  output: ScoreOutput;
  multiplier: number;
  url: string;
}

// What the member reads in the chat. Credit rule first, timing second, same order as the math.
export function scoreMessage({ output, multiplier, url }: ScoreMessageInput): string {
  const credited = creditedScore(output);
  const effective = Math.round(credited * multiplier);
  const why: string[] = [];
  const reason = creditReason(output);
  if (reason) why.push(reason);
  if (multiplier < 1) why.push(`timing ×${multiplier.toFixed(2)}`);
  const head =
    why.length > 0
      ? `Score ${effective}/100 (raw ${output.score}, ${why.join(", ")})`
      : `Score ${effective}/100`;
  const flags = output.flags.map((f) =>
    f === "ai_slop" && output.aiSlop.patterns.length > 0
      ? `${f} (${output.aiSlop.patterns.join(", ")})`
      : f,
  );
  return [
    head,
    ...(flags.length ? [`Flags: ${flags.join(", ")}`] : []),
    output.reasoning,
    url,
  ].join("\n");
}
