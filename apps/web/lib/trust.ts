import { APP_REPO, GITHUB, VERIFY_BUILD } from "./links.js";

// The security and trust page and docs/SECURITY.md say the same things: trust.test.ts holds every
// claim's sentence and every evidence link to both. A claim without evidence does not ship.

export interface Evidence {
  label: string;
  href: string;
}

export interface Claim {
  text: string;
  evidence: Evidence[];
}

export interface TrustSection {
  id: string;
  title: string;
  lead?: string;
  claims: Claim[];
}

export const PROGRAM_ID = "EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E";
export const ADMIN_LEDGER = "2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR";
export const FEE_VAULT = "rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK";
// `solana-verify get-program-hash` of the mainnet and devnet programs, reproduced by two clean
// builds (docs/handoffs/2026-09-28-verifiable-build-and-deploy-rehearsal.md).
export const VERIFIED_HASH = "7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac";

// Security reports go to GitHub's private vulnerability reporting on the public program repo
// (Cisco's ruling, 2026-10-07): no personal address is published.
export const REPORT_URL = `${GITHUB}/security/advisories/new`;

export const AI_REVIEW_NOTE = "independently reviewed by AI reviewers, not a third-party audit";

const program = (path: string): Evidence => ({
  label: path.split("/").pop() ?? path,
  href: `${GITHUB}/blob/main/programs/hyphae/${path}`,
});
const file = (path: string, label = path.split("/").pop() ?? path): Evidence => ({
  label,
  href: `${APP_REPO}/blob/main/${path}`,
});
const address = (value: string, label: string): Evidence => ({
  label,
  href: `https://explorer.solana.com/address/${value}`,
});

const CUSTODY = { label: "custody policy", href: `${GITHUB}#custody-during-the-pilot` };
const PROGRAM_REVIEW = file("docs/handoffs/2026-09-25-r6-anchor-built.md", "program review");
const MAINNET_RECEIPT = file(
  "docs/handoffs/2026-10-02-c13-mainnet-receipt.md",
  "mainnet deploy receipt",
);
const WALLETS = file("docs/WALLETS.md", "key registry");
const SCHEMA = file("packages/db/src/schema.ts", "database schema");
const READ_SERVICE = file("apps/api/src/http/read-service.ts", "read API");
const BUILDLOG = file("docs/BUILDLOG.md", "build log");

export const TRUST_SECTIONS: TrustSection[] = [
  {
    id: "summary",
    title: "What you trust",
    claims: [
      {
        text: "You trust one key with each epoch's payout list. The publisher key decides which wallets an epoch pays and how much, and the program cannot tell a fair list from an unfair one: it could pay its own wallet any SOL in the vault that is not already assigned.",
        evidence: [program("src/instructions/publish_epoch.rs"), PROGRAM_REVIEW],
      },
      {
        text: "That key lives on a Ledger hardware wallet, and a community's vault is funded one epoch at a time, just before it pays, to limit what is exposed. Unclaimed SOL from earlier epochs stays in the vault, and the same Ledger can upgrade or close the program, so its control reaches everything still in the vault.",
        evidence: [CUSTODY, WALLETS],
      },
      {
        text: "Hyphae does not verify that an X account belongs to the member who submits it, or that a post really replies to or quotes the raid's post; both are recorded as unverified. A score is not proof of authorship.",
        evidence: [
          file("apps/api/src/bot/commands/handles.ts", "X handles"),
          file("packages/db/src/schema.ts", "submission record"),
        ],
      },
      {
        text: "The rest can be checked: the program on chain is byte for byte its public source, every score shows its reasoning, and every correction stays visible.",
        evidence: [
          { label: "verify the build", href: VERIFY_BUILD },
          file("apps/api/src/rewards/decisions.ts", "decision history"),
        ],
      },
    ],
  },
  {
    id: "admin",
    title: "What the admin can and cannot do",
    lead: "On chain, the program enforces the limits. Off chain, the operator's tools do.",
    claims: [
      {
        text: "The program has three instructions: create a community, publish an epoch, and claim. None of them withdraws or sweeps the vault.",
        evidence: [program("src/lib.rs")],
      },
      {
        text: "An epoch's payout root is published once and never changed: the epoch account can only be created, and no instruction writes its root again.",
        evidence: [program("src/instructions/publish_epoch.rs")],
      },
      {
        text: "SOL assigned to an earlier epoch and not yet claimed cannot be assigned again.",
        evidence: [program("src/instructions/publish_epoch.rs")],
      },
      {
        text: "The fee is 3% of each epoch's pot, paid to an address set when the community is created. No instruction changes the fee or that address.",
        evidence: [
          program("src/constants.rs"),
          program("src/instructions/initialize_community.rs"),
        ],
      },
      {
        text: "Each wallet claims its leaf once. The claim rebuilds the leaf from the signing wallet, so nobody can claim for someone else.",
        evidence: [program("src/instructions/claim.rs"), program("tests/program.rs")],
      },
      {
        text: "The program can be upgraded, and an upgrade could change any of the above. The upgrade key is the same Ledger, and any upgrade is announced in the public program repository before it is used.",
        evidence: [CUSTODY, MAINNET_RECEIPT],
      },
      {
        text: "A score is corrected only with the operator's command-line tool, with a reason and evidence. The correction is a new revision; the old one stays, and the contribution's public page shows who corrected it and why. A correction made after an epoch closes does not change that epoch's payout.",
        evidence: [
          file("apps/api/scripts/reward-correct.ts"),
          file("apps/api/src/rewards/decisions.ts"),
        ],
      },
      {
        text: "An epoch is judged by the rubric and the scorer it pinned: an AI scoring prompt, or a Jev question set. A configuration change is a proposal that takes effect no earlier than the next epoch, and at least two epochs after the last change. Each epoch's configuration is public in the read API; pending proposals are not public yet.",
        evidence: [
          file("apps/api/src/rewards/config.ts"),
          file("apps/api/src/scoring/jev-registry.ts", "Jev scorers"),
          READ_SERVICE,
        ],
      },
      {
        text: "During the pilot, the founder can amend an open epoch's scorer (its scoring prompt or Jev question set) with a public, announced, non-retroactive record. The record is made before it takes effect and says who, why and from when. An epoch's amendments form a chain: each starts from the scorer in force, a new one can be recorded only once the last is in effect, and there is no way back to the epoch's original scorer. An amendment applies only to contributions admitted from its time, and the rubric, credit rules and payout rules cannot change that way. The epoch page and the read API list every amendment, and the epoch's audit record commits them. First used on 2026-10-07: epoch 2 scores with reward-eval/2 from 18:00 UTC.",
        evidence: [
          file("apps/api/src/rewards/amendment.ts"),
          file("packages/core/src/commitments.ts"),
          READ_SERVICE,
          file("docs/rubrics/CHANGELOG.md", "rubric changelog"),
        ],
      },
      {
        text: "Only the community's designated admin opens, closes or cancels a raid, and closing or cancelling needs a stated reason, which is stored. Whether reward intake is open or paused is public in the read API.",
        evidence: [
          file("apps/api/src/bot/commands/raid.ts"),
          file("apps/api/src/bot/commands/raid-lifecycle.ts"),
          READ_SERVICE,
        ],
      },
    ],
  },
  {
    id: "chain",
    title: "What is on chain and what is not",
    claims: [
      {
        text: "On chain, for each epoch: the payout root, a hash of the epoch's audit record, the pot, the fee and the totals. For each claim: the wallet, its score, the amount and an evidence hash.",
        evidence: [program("src/state.rs")],
      },
      {
        text: "Off chain, in a Postgres database: the text and links of contributions, what the AI was asked and answered, decisions and corrections, rubrics and configurations, and member and wallet records.",
        evidence: [SCHEMA],
      },
      {
        text: "The audit record behind the on-chain hash is stored but not yet published. Today you can check your own leaf and proof against the root, but not recompute a whole epoch.",
        evidence: [file("packages/core/src/read-api.ts", "read API types"), READ_SERVICE],
      },
    ],
  },
  {
    id: "custody",
    title: "Keys and custody",
    claims: [
      {
        text: `The program's only upgrade authority on mainnet, and the key that publishes Hyphae Lab's epochs, is the Ledger ${ADMIN_LEDGER}. It was read back from the chain at deploy.`,
        evidence: [address(ADMIN_LEDGER, "Ledger on Solana Explorer"), MAINNET_RECEIPT],
      },
      {
        text: `Hyphae Lab's fee goes to the MYCEL Treasury, Squads vault ${FEE_VAULT}, which needs 2 of 3 signers to move funds. It is fixed when the community is created on mainnet, planned for 2026-10-08, and cannot change afterwards.`,
        evidence: [
          address(FEE_VAULT, "vault on Solana Explorer"),
          file("docs/handoffs/2026-09-27-keys-and-fee-rulings.md", "fee ruling"),
        ],
      },
      {
        text: "The temporary keys used to deploy were deleted after the deploy, and the deletions are recorded.",
        evidence: [WALLETS],
      },
    ],
  },
  {
    id: "build",
    title: "Verifiable build",
    claims: [
      {
        text: `Program ${PROGRAM_ID} runs on mainnet and devnet. Rebuilding its public source in Anchor's pinned Docker image gives the solana-verify hash ${VERIFIED_HASH}, the same hash the chain reports for the deployed program.`,
        evidence: [{ label: "verify the build", href: VERIFY_BUILD }, MAINNET_RECEIPT],
      },
      {
        text: "Not done yet: the on-chain verification record that lets explorers show the program as verified.",
        evidence: [file("docs/handoffs/2026-09-28-arc.md", "deploy plan")],
      },
    ],
  },
  {
    id: "reviews",
    title: "Independent reviews",
    lead: `Hyphae has been ${AI_REVIEW_NOTE}. Each review below was done by a model from a different family than the one that built the change. The reports are public, findings included.`,
    claims: [
      {
        text: "2026-09-25, the on-chain program: three Codex rounds, approved in the third. The finding that the admin can publish any root was kept as the pilot's custody model, not fixed.",
        evidence: [PROGRAM_REVIEW],
      },
      {
        text: "2026-10-03, community setup: Claude Opus approved it for local use with two fixes required, then approved the fixes.",
        evidence: [
          file("docs/reviews/2026-10-03-community-setup-opus-review.md", "review"),
          file("docs/reviews/2026-10-03-community-setup-opus-fixcheck.md", "fix check"),
        ],
      },
      {
        text: "2026-10-04, the read SDK and the adopter demo: Claude Opus accepted them after one round of fixes.",
        evidence: [
          file("docs/reviews/2026-10-04-sdk-initial-opus-review.md", "first review"),
          file("docs/reviews/2026-10-04-adopter-final-acceptance.md", "final acceptance"),
        ],
      },
      {
        text: "2026-10-04, raid alerts and the member journey (receipts, raid lifecycle, operator view): Claude Opus accepted both after rounds of fixes.",
        evidence: [
          file("docs/reviews/2026-10-04-raid-alerts-opus.md", "raid alerts"),
          file("docs/reviews/2026-10-04-member-journey.md", "member journey"),
        ],
      },
      {
        text: "2026-10-06, the wallet link page: Codex accepted it with one advisory, fixed.",
        evidence: [file("docs/reviews/2026-10-06-link-page.md", "review")],
      },
      {
        text: "2026-10-06, the scoring prompt reward-eval/2: Codex found the scoring itself clean and two defects in the evaluation script; both were fixed, and the fix was not reviewed again.",
        evidence: [file("docs/reviews/2026-10-06-reward-eval-2.md", "review")],
      },
      {
        text: "2026-10-07, prompt injection (our own test, not a review): seven replies that try to instruct the AI scorer each earned 0 in 3 of 3 runs, and a real reply with an injection appended was not scored higher.",
        evidence: [file("docs/rubrics/eval/reward-eval-2-injection.md", "result")],
      },
      {
        text: "2026-10-07, the Jev question set v4 (our own test, not a review): on 28 fixed reward cases it was right in 84 of 84 runs, all eight injection attempts at 0. On 64 new replies the founder labeled blind (then ruled on nine that broke his own written rules), it zeroed 2 of 36 he labeled pass and passed 1 of 24 he labeled zero; those misses are listed.",
        evidence: [file("docs/evals/jev-v4-calibration-2026-10-07.md", "calibration")],
      },
    ],
  },
  {
    id: "corrections",
    title: "When we get something wrong",
    claims: [
      {
        text: "Scores are never edited in place. A correction is appended with its reason and evidence and shown on the contribution's page.",
        evidence: [
          file("apps/api/src/rewards/decisions.ts"),
          file("apps/web/components/views.tsx", "receipt page"),
        ],
      },
      {
        text: "Changes to the rubric or the scorer are listed with the reason and the evidence behind them.",
        evidence: [file("docs/rubrics/CHANGELOG.md", "rubric changelog")],
      },
      {
        text: "Every release, decision and known limit is written down in the public build log, including what went wrong.",
        evidence: [BUILDLOG],
      },
    ],
  },
  {
    id: "report",
    title: "Report a problem",
    claims: [
      {
        text: "Report a security problem privately through GitHub's private vulnerability reporting on the public program repository. Please do not post it in the Telegram group or on X first. There is no paid bug bounty.",
        evidence: [{ label: "open a private report", href: REPORT_URL }],
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy and deletion",
    claims: [
      {
        text: "We store your Telegram user ID and username, up to three X handles, the wallet you signed with and its history, the text and links you submit, and the AI's scoring of them.",
        evidence: [SCHEMA],
      },
      {
        text: "Public receipts show a contribution's text, link, scores and reasons, a random member ID and the verified wallet. They never show your Telegram ID or username.",
        evidence: [READ_SERVICE],
      },
      {
        text: "These services receive some of it: Anthropic and TypeSafe (their AI models read your contribution and the post it answers; TypeSafe's Jev only for an epoch that pins it), Telegram (the bot), X (public post data through X's embed service), Neon (the database), Fly.io (the API and worker), Vercel (this site, which sees visitors' IP addresses and passes them to the API on Fly.io for rate limiting) and a Solana RPC provider (wallet balance checks).",
        evidence: [
          file("apps/api/src/env.ts", "service settings"),
          file("apps/api/src/scoring/jev-client.ts", "Jev client"),
          file("apps/api/src/x/oembed.ts", "X embed reader"),
          file("apps/web/lib/api.ts", "site's API client"),
          file("apps/api/src/http/rate-limit.ts", "rate limit"),
        ],
      },
      {
        text: "We keep this data while the community runs. On request, within 30 days, we delete your Telegram ID, username and X handles and end your wallet link. We cannot delete what is on Solana or the public receipts, because they are the audit trail: a receipt keeps the contribution's text and link (an X link names the account that posted it), its scores, and the wallet that was verified when its epoch closed.",
        evidence: [BUILDLOG, READ_SERVICE],
      },
      {
        text: "To ask, use the private report link above or ask your community's admin in Telegram. Deletion is done by hand today; there is no button for it yet.",
        evidence: [{ label: "open a private report", href: REPORT_URL }],
      },
    ],
  },
];
