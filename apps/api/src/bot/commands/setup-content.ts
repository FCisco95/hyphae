import { ALERT_PREFIX } from "../../raid-alerts/alerts.js";
import { rulesStartPayload } from "./rules.js";

export interface SetupState {
  communityId: string;
  name: string;
  mint: string;
  botUsername: string;
  joined: boolean;
  // unverified: a pasted address, which scores but can never be paid (D1).
  wallet: "none" | "unverified" | "verified";
  rules: "passed" | "todo" | "unavailable";
  alerts: boolean;
  replied: boolean;
  closesAt: Date | null;
  // The pinned minimum balance in whole tokens, or null when the mint's decimals are unknown.
  holdMin: string | null;
}

export interface SetupButton {
  label: string;
  callback?: string;
  url?: string;
  primary?: true;
}

export const SETUP_PREFIX = "setup_";
export const SETUP_LINK_PREFIX = "setup_link_";
export const setupPayload = (communityId: string): string => `${SETUP_PREFIX}${communityId}`;

// The exact amount, never rounded: "at least N" must not understate the pinned minimum.
export const formatTokens = (units: bigint, decimals: number): string => {
  const scale = 10n ** BigInt(decimals);
  const whole = (units / scale).toLocaleString("en-US");
  const fraction = (units % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
};

const utc = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
const shortMint = (mint: string) => `${mint.slice(0, 6)}…${mint.slice(-4)}`;
const escapeHtml = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// The five steps in order. A step that cannot be done yet (no rules test pinned) never blocks the
// ones after it.
export function setupContent(s: SetupState): { text: string; buttons: SetupButton[] } {
  const done = [
    s.joined,
    s.wallet === "verified",
    s.rules === "passed" || s.rules === "unavailable",
    s.alerts,
    s.replied,
  ];
  const next = done.indexOf(false);
  const mark = (i: number) => (done[i] ? "✅" : i === next ? "➡️" : "⬜");
  const lines = [
    `${mark(0)} 1. ${s.joined ? `Joined ${s.name}` : `Join ${s.name}, then tap Refresh`}`,
    `${mark(1)} 2. ${s.wallet === "verified" ? "Wallet verified" : "Link your wallet (one free signature, moves no funds)"}`,
    `${mark(2)} 3. ${
      s.rules === "passed"
        ? "Rules test passed"
        : s.rules === "unavailable"
          ? "Pass the rules test: no rules test is available yet"
          : "Pass the rules test (a short quiz, all answers right)"
    }`,
    `${mark(3)} 4. ${s.alerts ? "Raid alerts on" : "Raid alerts (optional): a private message when a raid opens"}`,
    `${mark(4)} 5. ${s.replied ? "First reply submitted" : "Send your first reply: open a raid message and tap Submit my reply"}`,
  ];

  const closes = s.closesAt ? utc(s.closesAt) : "the epoch closes";
  const hold = s.holdMin
    ? `at least ${s.holdMin} of the community token (mint ${shortMint(s.mint)})`
    : "at least the minimum balance of the community token set in the rules";
  const conditions = [
    `a wallet linked by signing before ${closes}`,
    `the rules test passed before ${closes}`,
    "at least one reply that counts for points",
    ...(s.holdMin === "0"
      ? []
      : [
          `${hold} in that wallet from the close until 24 hours after it (the balance is read once in that window and the result is final)`,
        ]),
  ];
  const needs = `To be paid you need all of these: ${conditions.join("; ")}. Points are not a payment: they only decide your share if you meet every condition.`;

  const text = [
    `Set up for ${s.name}`,
    lines.join("\n"),
    next === -1 ? "You are set up. Reply to the next raid to earn points." : "",
    needs,
  ]
    .filter(Boolean)
    .join("\n\n");

  const buttons: SetupButton[] = [];
  const step = (label: string, target: { callback: string } | { url: string }) =>
    buttons.push({ label, ...target, primary: true });
  if (next === 1 && s.joined)
    step("Link my wallet", { callback: `${SETUP_LINK_PREFIX}${s.communityId}` });
  if (next === 2 && s.rules === "todo") {
    step("Take the rules test", {
      url: `https://t.me/${s.botUsername}?start=${rulesStartPayload(s.communityId)}`,
    });
  }
  if (next === 3) {
    step("Turn on raid alerts", {
      url: `https://t.me/${s.botUsername}?start=${ALERT_PREFIX}${s.communityId}`,
    });
  }
  buttons.push({ label: "Refresh", callback: `${SETUP_PREFIX}${s.communityId}` });
  return { text, buttons };
}

// Sent as HTML so the link sits in <code>: one tap copies it on Telegram mobile and desktop.
export function linkMessage(communityName: string, url: string): string {
  return [
    `Link your wallet to ${escapeHtml(communityName)}.`,
    "1. Open the Phantom or Solflare app and go to its built-in browser.",
    "2. Tap the link below once to copy it, then paste it into that browser. Telegram's own browser cannot sign.",
    `<code>${escapeHtml(url)}</code>`,
    "Your wallet will ask you to sign a readable message. It is free and moves no funds. The link works for 15 minutes, once. Do not forward it.",
    "After signing, come back to /setup and tap Refresh.",
  ].join("\n\n");
}
