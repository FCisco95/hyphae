export const PARTICIPANT_KEYS = [
  ["/setup", "/me"],
  ["/link", "/rules"],
  ["/help brief", "/help"],
  ["/notifications"],
] as const;

export interface OnboardingCommunity {
  name: string;
  mint: string;
  webOrigin: string;
  paused: boolean;
  epoch: {
    index: number;
    closesAt: Date;
    rubricVersion: string | null;
    rulesQuestions: number | null;
  } | null;
}

const GENERIC =
  "Hyphae scores real work for token communities. Begin in your registered community group: reply to a raid to earn points, /link a wallet to be paid, take /rules, and check /me. Adding the bot does not register a group. Ask the community owner for its verified invite.";
const OWN_LINK =
  "On a phone, open your ORIGINAL private bot URL (including its fragment) in a compatible wallet browser. Never forward it or send it to support. Use your own link from the official bot; cancel any transfer, approval or seed-phrase request. After signing, check your own /me.";
const utc = (date: Date) => `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;

function audit(c: OnboardingCommunity): string {
  try {
    const url = new URL(c.webOrigin);
    if (url.protocol === "https:" && url.origin === c.webOrigin) {
      return `${url.origin}/c/${encodeURIComponent(c.mint)}${c.epoch ? `/e/${c.epoch.index}` : ""}`;
    }
  } catch {
    /* Invalid configuration must not produce a clickable destination. */
  }
  return "Audit link unavailable; ask the owner.";
}

const limited = (text: string, length: number) => {
  const characters = Array.from(text);
  return characters.length > length ? `${characters.slice(0, length).join("")}…` : text;
};

const heading = (c: OnboardingCommunity) =>
  [
    limited(c.name, 120),
    "Powered by Hyphae",
    `Reward intake ${c.paused ? "paused" : "open"}.`,
    c.epoch
      ? `Epoch ${c.epoch.index} closes ${utc(c.epoch.closesAt)}.`
      : "No reward epoch is open.",
  ].join("\n");

export function welcomeContent(c?: OnboardingCommunity): string {
  if (!c) return GENERIC;
  return [
    heading(c),
    "Start here",
    "/setup — Guided setup: a short checklist in a private chat. Start here.\n/link — Link your own wallet privately. This signs a free message.\n/rules — Take this epoch's rules test in the private bot chat.\n/me — Your wallet and epoch progress (replied in this group).\n/help brief — Current brief and audit.\n/help — How scores and payment work.\n/notifications — Choose private raid alerts for this community.",
    "Your work, evidence and verified wallet may appear in the public audit. Points do not promise payment.",
    OWN_LINK,
    "Private raid alerts are optional: /notifications. Stop them from the private bot chat at any time.",
    audit(c),
  ].join("\n\n");
}

export function helpContent(c?: OnboardingCommunity): string {
  if (!c) return GENERIC;
  const rules = !c.epoch
    ? "No open epoch; ask the owner which rules apply. The existing /rules command may still offer the latest pinned test."
    : c.epoch.rulesQuestions
      ? `Rubric ${c.epoch.rubricVersion}: /rules requires ${c.epoch.rulesQuestions}/${c.epoch.rulesQuestions}, strictly before ${utc(c.epoch.closesAt)}. A pass is only one payment condition.`
      : "No rules test available; ask the owner. Never assume another community's quiz applies.";
  return [
    heading(c),
    "Rules and score help",
    rules,
    "Raw quality is the model's assessment. Credited quality applies the pinned rules; reasons and correction history explain the difference. Timing and accepted effort determine exact point units, combined before whole-point rounding.",
    "Open the exact raid’s private Submit button, then send your own reply/quote URL. Use /receipt <receipt ID> privately to refresh its result, or /issue <receipt ID> <reason> to report a scoring issue. X oEmbed does not verify the target relation or your account ownership.",
    "Pending means no decision yet. Open-epoch points are provisional; final points belong to the closed snapshot and are not SOL.",
    "Allocation states what was assigned. Publication is required before it is claimable. Paid requires a confirmed claim receipt. Positive points, a wallet verified at close, rules, holder, author/duplicate and safety gates all apply.",
    "/link signs a free readable message. /claim later signs a transaction on the claim page. Use /me for your own progress and /help brief for the active brief. Ask the owner about evidence or corrections before close.",
    OWN_LINK,
    "Private raid alerts are optional: /notifications. Stop them from the private bot chat at any time.",
    audit(c),
  ].join("\n\n");
}

interface BriefTask {
  brief: string;
  targetUrl: string | null;
  opensAt: Date;
  closesAt: Date;
}

function briefEntry(task: BriefTask): string {
  let target = "";
  if (task.targetUrl) {
    try {
      const url = new URL(task.targetUrl);
      if (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        /^(x|twitter)\.com$/.test(url.hostname) &&
        /^\/[A-Za-z0-9_]+\/status\/\d+$/.test(url.pathname)
      )
        target = `${url.origin}${url.pathname}`;
    } catch {
      /* Untrusted task values remain text, never arbitrary action URLs. */
    }
  }
  return `${limited(task.brief, 1000) || "Ask the owner for this task's brief."}\n${target}\nTask opens ${utc(task.opensAt)}; closes ${utc(task.closesAt)}.`;
}

export function briefContent(c: OnboardingCommunity, tasks: BriefTask[]): string {
  return [
    heading(c),
    tasks.length
      ? tasks.map((t, i) => `Current brief ${i + 1}\n${briefEntry(t)}`).join("\n\n")
      : "No active brief. Ask the owner before submitting linked work.",
    "Use the exact raid’s private Submit my reply or Submit my quote button. Links never select a raid automatically. Several raids can be open at once. A task window does not extend the epoch’s intake deadline.",
    audit(c),
  ].join("\n\n");
}
