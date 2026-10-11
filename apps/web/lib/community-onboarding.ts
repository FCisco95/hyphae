import { APP_REPO, COMMUNITY_SETUP } from "./links.js";

export const COMMUNITY_SETUP_PROMPT = `Help me prepare my token community for Hyphae, a contribution and payout protocol on Solana.

Read the current public documentation first:
- Overview: ${APP_REPO}
- Community setup: ${COMMUNITY_SETUP}

Ask me for the community name, token mint and Solana network, Telegram contribution group, and the community administrator who can approve setup. Identify any missing information instead of inventing it. Keep numeric Telegram IDs and owner details in private notes or files outside the public repository. Never ask for seed phrases, private keys or credentials in chat.

Explain the current boundary: setup is operator-assisted, not a public self-service signup. Each community needs its own registered Telegram group and audit page; adding the bot alone does not register it. The setup tool can prepare an offline plan, check the exact bot/group/admin and database target, and apply an explicitly approved plan to register a paused community with a future epoch. Registration does not create an on-chain community or vault, fund it, activate it, or publish a payout.

Help me prepare a private setup brief and, if I have the application checkout, a manifest and offline plan using the documented setup tool. Use supported, published reward configuration; leave unresolved choices for operator review. Keep per-member rules-test and hold outcomes private; public eligibility reporting uses aggregates only.

Do not apply a plan, write production data, deploy, send Telegram messages, activate a community, change reward rules, or initiate funding or signing without separate explicit authorization for that action. Stop after preparation and explain the next operator step.

Return a short setup checklist, the missing inputs, and a reviewable setup brief. Distinguish what is ready from what still needs approval.`;
