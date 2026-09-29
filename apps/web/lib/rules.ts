import type { LooseEpochV1 } from "@hyphae/core";
import type { Result } from "./api.js";

// The MYCEL rubrics the study page covers: 1.2.0 since epoch 1, 1.3.1 planned from epoch 4.
export const VERSIONS = ["1.2.0", "1.3.1"] as const;
export type Version = (typeof VERSIONS)[number];

export type RulesStatus =
  | { state: "known"; epoch: number; now: Version }
  | { state: "other"; epoch: number; version: string }
  | { state: "unknown" };

const covered = (v: string): v is Version => (VERSIONS as readonly string[]).includes(v);

// Which rules apply now is read, not assumed: the open epoch's pinned rubric.
export async function rulesStatus(
  epochs: readonly { index: number; status: string }[] | null,
  read: (index: number) => Promise<Result<LooseEpochV1>>,
): Promise<RulesStatus> {
  const open = epochs?.find((e) => e.status === "open");
  if (!open) return { state: "unknown" };
  const epoch = await read(open.index);
  if (!epoch.ok || epoch.data.status !== "open") return { state: "unknown" };
  const version = epoch.data.config.rubric_version;
  return covered(version)
    ? { state: "known", epoch: open.index, now: version }
    : { state: "other", epoch: open.index, version };
}

export interface GradedExample {
  id: string; // the case in docs/rubrics/eval/mycel-synthetic-review.json
  post: string;
  reply: string;
  note?: string;
  grade: [number, number]; // the founder's grade, for the rules rubric 1.3.1 carries
  credited: [number, number]; // what production credits for that grade and the case's flags
  reason: string | null; // why credited differs from the grade (creditReason)
  why: string;
  under120?: string; // how rubric 1.2.0 grades it differently
}

const HARD_ZERO = ["guideline breach", "off topic", "spam"];

export const exampleGroup = (e: GradedExample): "earns" | "nothing" | "never" =>
  e.credited[0] >= 60 ? "earns" : e.reason && HARD_ZERO.includes(e.reason) ? "never" : "nothing";

// Sixteen replies the founder graded for the rules in rubric 1.3.1, word for word from the
// review file.
export const EXAMPLES: readonly GradedExample[] = [
  {
    id: "synthetic-receipt-specific-criticism",
    post: "Every scored contribution now has a public receipt with the rubric version, model, reasoning, prompt hash, and evidence hash. Admin corrections are appended instead of replacing the original score.",
    reply:
      "Receipts show how a score was produced, but they don't explain why a submission was rejected before scoring. Can the public page include those rejection reasons too?",
    grade: [90, 90],
    credited: [90, 90],
    reason: null,
    why: "Genuine interest, in a natural voice, from someone trying to improve the product. Useful criticism has the same chance as praise.",
  },
  {
    id: "synthetic-honest-reward-disclosure",
    post: "Every scored contribution now has a public receipt with the rubric version, model, reasoning, prompt hash, and evidence hash. Admin corrections are appended instead of replacing the original score.",
    reply:
      "Disclosure: I can earn Hyphae points for this reply. The evidence hash still matters because changing the model output would change the receipt, so edits can't be hidden.",
    grade: [90, 90],
    credited: [90, 90],
    reason: null,
    why: "It explains how the evidence hash works, clearly from someone who knows the project. An honest disclosure does not lower the grade.",
  },
  {
    id: "synthetic-grounded-uncertain-price",
    post: "This epoch generated 12 SOL in protocol fees, up from 6 SOL last epoch. The eligible contribution pool grew 20%, while MYCEL supply stayed unchanged.",
    reply:
      "If fee growth holds while supply stays flat, a higher MYCEL valuation could make sense. Two epochs still isn't enough to call it a trend though.",
    grade: [85, 85],
    credited: [85, 85],
    reason: null,
    why: "Real reasoning from the post's own numbers, framed as uncertain, with its own counterpoint.",
    under120:
      "Under rubric 1.2.0 this reply is a breach and earns 0: it says where a specific coin's price could go.",
  },
  {
    id: "synthetic-polished-strong-original-control",
    post: "A Hyphae receipt keeps the model output, rubric version, and any later admin correction in one public audit trail.",
    reply:
      "A score receipt is more than a number. Not just model output, but a trail anyone can inspect. Hyphae is showing that contribution rewards don't need a black box.",
    grade: [75, 80],
    credited: [75, 80],
    reason: null,
    why: "It confirms the post in its own words, like a normal community comment: fine, not exceptional. One polished contrast is not AI writing.",
  },
  {
    id: "synthetic-holder-with-product-reason",
    post: "Hyphae commits each epoch's complete score set to Solana as a Merkle root. Contributors receive non-transferable points first, then treasury rewards settle from the epoch allocation.",
    reply:
      "I hold MYCEL, and the delayed settlement makes sense to me because the epoch can be audited as one complete set before the treasury splits.",
    grade: [75, 75],
    credited: [75, 75],
    reason: null,
    why: "On topic and natural, and saying you hold is allowed. It adds little beyond the post, so it is good rather than great.",
  },
  {
    id: "synthetic-single-ai-word-false-positive-control",
    post: "A Hyphae receipt keeps the model output, rubric version, and any later admin correction in one public audit trail.",
    reply:
      "This transparency is crucial for contributors because they can match each score to the receipt and see every later correction.",
    grade: [75, 75],
    credited: [75, 75],
    reason: null,
    why: "Organic, and what you would expect in reply to the post. One word like “crucial” does not make a reply AI-written.",
  },
  {
    id: "synthetic-image-context-limitation",
    post: "A new way to inspect every score. pic.x.com/hyphae-demo",
    reply:
      "Putting the model score and admin correction side by side makes the audit trail much easier to follow.",
    note: "The post's image was not available to the grader.",
    grade: [75, 75],
    credited: [75, 75],
    reason: null,
    why: "Acceptable if the image shows that side-by-side layout. The grader cannot see images yet, so it must not guess what they show or call the reply off-topic for that alone.",
  },
  {
    id: "synthetic-receipt-specific-praise",
    post: "Every scored contribution now has a public receipt with the rubric version, model, reasoning, prompt hash, and evidence hash. Admin corrections are appended instead of replacing the original score.",
    reply:
      "The append-only correction is the bit I care about. Anyone can compare the model's first call with the admin override instead of trusting a cleaned-up final number.",
    grade: [70, 70],
    credited: [70, 70],
    reason: null,
    why: "Specific and useful, but the staged setup before “is the bit I care about” reads like a typical AI answer. A direct first-person reaction sounds more natural.",
  },
  {
    id: "synthetic-multiple-ai-writing-signals",
    post: "A Hyphae receipt keeps the model output, rubric version, and any later admin correction in one public audit trail.",
    reply:
      "This groundbreaking initiative serves as a testament to Hyphae's pivotal role in the evolving Web3 landscape, highlighting its commitment to transparency, innovation, and community empowerment.",
    grade: [70, 70],
    credited: [0, 0],
    reason: "reads AI-written, capped at 40, below the 60 floor",
    why: "Over-complimentary and not organic: a stack of AI phrases (“testament”, “pivotal”, “evolving landscape”) and a list of three buzzwords.",
  },
  {
    id: "synthetic-popularity-no-quality-bonus",
    post: "The first public score receipts are live on the contribution page.",
    reply: "Amazing project! 5,000 views already. LFG 🚀",
    grade: [35, 35],
    credited: [0, 0],
    reason: "below the 60 floor",
    why: "Blind shilling: it reacts to the view count, not to the post. Views and likes earn no bonus.",
  },
  {
    id: "synthetic-question-already-answered",
    post: "Epoch claims open Friday at 16:00 UTC and close Sunday at 16:00 UTC. Use /claim in the bot during that window.",
    reply: "When do claims close?",
    grade: [10, 10],
    credited: [0, 0],
    reason: "below the 60 floor",
    why: "It breaks no rule, but the answer is already in the post.",
  },
  {
    id: "synthetic-holder-only",
    post: "Hyphae commits each epoch's complete score set to Solana as a Merkle root. Contributors receive non-transferable points first, then treasury rewards settle from the epoch allocation.",
    reply: "I hold MYCEL.",
    grade: [0, 0],
    credited: [0, 0],
    reason: "below the 60 floor",
    why: "Allowed, but it adds nothing, and the post is not about holders.",
  },
  {
    id: "synthetic-unsupported-price-with-hedge",
    post: "This epoch generated 12 SOL in protocol fees, up from 6 SOL last epoch. The eligible contribution pool grew 20%, while MYCEL supply stayed unchanged.",
    reply: "MYCEL to $1 easy, NFA.",
    grade: [50, 50],
    credited: [0, 0],
    reason: "guideline breach",
    why: "A bare price target. “NFA” adds a little caution but no reasoning, so it is still a breach.",
  },
  {
    id: "synthetic-buy-guaranteed-gains",
    post: "This epoch generated 12 SOL in protocol fees, up from 6 SOL last epoch. The eligible contribution pool grew 20%, while MYCEL supply stayed unchanged.",
    reply: "Fees doubled, so buy MYCEL now. Guaranteed 10x.",
    grade: [0, 0],
    credited: [0, 0],
    reason: "guideline breach",
    why: "A buy instruction and a guaranteed return: each alone breaks the rules.",
  },
  {
    id: "synthetic-project-name-wrong-topic",
    post: "The public score page now shows the original model grade beside every admin correction.",
    reply: "I am really excited to see what AI trading agents will look like on MYCEL.",
    grade: [50, 50],
    credited: [0, 0],
    reason: "off topic",
    why: "Naming MYCEL does not make it relevant: it misses what the post is about.",
  },
  {
    id: "synthetic-code-only-spam",
    post: "The next epoch starts Monday. Read the published rubric before submitting a contribution.",
    reply: "7F3K-91QZ",
    grade: [0, 0],
    credited: [0, 0],
    reason: "spam",
    why: "A code with no meaning in context: spam.",
  },
];
