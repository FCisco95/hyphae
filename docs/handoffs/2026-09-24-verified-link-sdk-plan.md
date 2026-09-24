---
date: 2026-09-24
summary: Implementation plan for verified wallet linking in Hyphae through the published `@organichub/verify@0.1.0` SDK (the Sentinel adoption route). The bot hands each member a private, single-use link; a small page on the api origin asks the wallet to sign a readable message; one database transaction verifies the proof, consumes it and links the wallet. Wallet history is append-only so a relink never retargets a frozen epoch. Hold gating is a separate plan. Plan only; nothing implemented. Six owner decisions listed before execution.
---

# Verified wallet linking (Sentinel SDK) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pasted `/link <wallet>` with a signed-message proof verified by `@organichub/verify@0.1.0`, so a reward can only ever go to a wallet its owner proved they control, and a later relink cannot redirect an epoch that has already closed.

**Architecture:** In a group, `/link` sends the member a deep link to a private chat with the bot. The private chat confirms the member really belongs to that community, then opens a 15-minute, single-use link session and sends a URL of the form `<LINK_ORIGIN>/link#<token>`. That URL serves a static page, and the page asks a Wallet Standard wallet to sign a readable message. The api builds the SDK identity from the link session alone, never from the request body. A tenant-bound `VerificationStore` consumes the proof, uses up the session and writes the member wallet in one PostgreSQL transaction. `member_wallet_links` keeps the append-only wallet history; `walletAt(member, closesAt)` is the only read a payout may use.

**Tech Stack:** `@organichub/verify` 0.1.0 (exact version), Hono 4 + `@hono/node-server`, grammY, Drizzle 0.45 on Postgres (PGlite for unit tests, Docker Postgres 17 for `*.pg.test.ts`), `@wallet-standard/app` 1.1.1 in the browser page, tsup, vitest, `@solana/kit` for test keys.

**Spec:** the consumer contract `docs/guides/hyphae-verify-sdk-consumer.md` in `FCisco95/mycel-sentinel` (sections 1–5, 7 and 8 apply; section 6, the hold gate, is out of scope here). The schedule rulings (`docs/handoffs/2026-09-23-schedule-rulings.md`) require verified linking before any real mainnet payment to testers, and require that a wallet change cannot retarget a frozen epoch manifest (O2).

## Owner decisions (answer before Task 1)

Each item has a recommendation. The tasks below are written for the recommended option.

| # | Decision | Recommended | Alternative |
|---|---|---|---|
| D1 | Pasted `/link <wallet>` after this ships | Remove it. Existing pasted members keep scoring but are **not payable** until they verify. | Keep both paths (every payout read then has to filter on method). |
| D2 | A verified proof for a wallet another member holds (pasted or verified) | Refuse with a fixed message ("already linked to another member; ask an admin"). No automatic takeover. | Verified proof takes a pasted wallet from its holder (needs `members.wallet` nullable plus a notice flow). |
| D3 | Which wallet a closed epoch pays | The wallet whose link was valid at the epoch's `closesAt` (`walletAt`). A relink applies only to epochs closing after it commits. | Pay the current wallet at settlement time (breaks O2). |
| D4 | Where the signing page lives | On the api origin (`LINK_ORIGIN`, Fly), served by Hono. Same origin as the proof endpoints: no CORS, and the message's origin matches the page. | `apps/web` on Vercel once it exists (needs CORS and a second origin in the message). |
| D5 | Proof chain | `solana:mainnet` (the MYCEL mint is on mainnet). | `solana:devnet` for the Oct 3–5 devnet run; the value is config (`LINK_CHAIN`). |
| D6 | Adoption authorization | This plan is the adoption gate artifact. Executing it needs Cisco's explicit yes, and it starts only after R5 merges (calendar: Oct 6–8, or earlier if a window opens). | — |

## Global Constraints

- Dependency is exactly `"@organichub/verify": "0.1.0"`: no caret, tilde, tag, git URL, workspace link or tarball. The lockfile is committed and `npm audit signatures` must pass in this consumer (consumer guide §8).
- The browser may submit only: link token, wallet address, and the SDK proof fields (`requestId`, `nonce`, `message`, `signature`). Community, Telegram user, origin and chain always come from the server-side link session and config (§1).
- The page uses exactly two wallet features, `standard:connect` and `solana:signMessage`. No other wallet feature is referenced anywhere in Hyphae (a Sentinel security invariant).
- Never log, persist or return: raw signature, nonce, proof message, link token, RPC URL, SQL text, error `cause`/stack. Responses use fixed codes: `proof_rejected`, `wallet_taken`, `link_expired`, `link_unavailable` (§4, §5).
- All proof and session time comes from `clock_timestamp()` in Postgres, never from `Date.now()`. Proof lifetime is exactly 5 minutes (`WALLET_PROOF_LIFETIME_MS`); link-session lifetime is 15 minutes.
- Proof consumption, session consumption and the member wallet write commit together or not at all (§3).
- Hard repo rule unchanged: no `organic-app` code or files are touched.
- Neon migration apply and Fly deploy are **not** part of this plan; each needs its own authorization.

## Review Focus

1. **A link URL forwarded or clicked by someone else.** Expected: whoever opens it can only link a wallet *they* sign for to the member who received the URL; because the URL is sent only in a private chat and is single-use and short-lived, forwarding is the member's own act. Pinned by Task 7 (link is sent in a private chat only, never in the group) and Task 4 (wrong-user session refused).
2. **Wallet app changes the signed bytes (prefixes, normalizes line endings).** Expected: fixed "Link failed. Start again with /link.", nothing linked. Pinned by Task 6 (client refuses when `signedMessage` differs) and Task 5 (server rejects a message that differs from the issued one).
3. **Member relinks after an epoch closed.** Expected: the closed epoch still resolves to the old wallet. Pinned by Task 2 (`walletAt` returns the old wallet at the old `closesAt`).
4. **Network drop on the verify call after the database committed.** Expected: the page asks for status and reports "linked", and does not tell the member to start again. Pinned by Task 5 (lost-acknowledgement test, committed and aborted variants).
5. **User leaves the community group between `/link` and signing.** Expected: the link still completes (membership is checked when the session opens, not later), and the session expires in 15 minutes. That is accepted behavior, documented in Task 8 so the next reviewer does not read it as a bug.

---

## File map

| File | Responsibility |
|---|---|
| `packages/db/src/schema.ts` (modify) | `link_sessions`, `wallet_proof_requests`, `member_wallet_links` tables |
| `packages/db/drizzle/NNNN_verified_wallet_links.sql` (generate + append backfill) | Migration; `NNNN` is the next free number when generated |
| `apps/api/src/env.ts` (modify) | `LINK_ORIGIN`, `LINK_CHAIN` |
| `apps/api/src/link/proof-config.ts` | `TenantProofConfig` for Hyphae |
| `apps/api/src/link/session.ts` | open/resolve link sessions, token digest |
| `apps/api/src/link/wallet-links.ts` | `applyVerifiedWallet` (member write + history), `walletAt` |
| `apps/api/src/link/store.ts` | tenant-bound `VerificationStore` |
| `apps/api/src/link/routes.ts` | `GET /link`, `POST /link/request`, `/link/verify`, `/link/status` |
| `apps/api/src/link/page/index.html`, `page/client.ts`, `page/wallet.ts` | signing page (browser bundle) |
| `apps/api/tsup.page.config.ts` | browser bundle to `dist/public` |
| `apps/api/src/link/test-wallet.ts` | Ed25519 test signer (tests only) |
| `apps/api/src/bot/commands/link.ts` (rewrite) | group `/link` → private deep link; private `/start link_<id>` → session URL |
| `apps/api/src/bot/index.ts`, `server.ts` (modify) | wiring |
| `apps/api/src/bot/commands/me.ts` (modify) | "unverified" hint for pasted members |

---

### Task 1: SDK dependency, proof config and env

**Files:**
- Modify: `apps/api/package.json`, `pnpm-lock.yaml`, `apps/api/src/env.ts`, `.env.example`
- Create: `apps/api/src/link/proof-config.ts`
- Test: `apps/api/src/link/proof-config.test.ts`

**Interfaces:**
- Produces: `proofConfig(): TenantProofConfig`; `env.LINK_ORIGIN: string` (https origin, no path); `env.LINK_CHAIN: "solana:mainnet" | "solana:devnet"`.

- [ ] **Step 1: Rebase check.** Run `git fetch origin && git rebase origin/main` in the worktree. R4/R5 must already be merged (D6). Re-read `apps/api/src/bot/commands/me.ts` and `packages/db/src/schema.ts` before editing; R4/R5 change both.

- [ ] **Step 2: Add the exact dependency and verify provenance**

```bash
pnpm --filter @hyphae/api add @organichub/verify@0.1.0 --save-exact
pnpm --filter @hyphae/api add @wallet-standard/app@1.1.1 --save-exact --save-dev
grep -n '"@organichub/verify": "0.1.0"' apps/api/package.json
cd apps/api && npm audit signatures && cd ../..
```

Expected: the grep prints one line; `npm audit signatures` reports verified registry signatures and attestations for `@organichub/verify`. If attestation is missing, stop: the release gate (§8) fails.

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/link/proof-config.test.ts
import { formatWalletMessage } from "@organichub/verify";
import { describe, expect, it, vi } from "vitest";

vi.mock("../env.js", () => ({
  env: { LINK_ORIGIN: "https://api.hyphae.fun", LINK_CHAIN: "solana:mainnet" },
}));

describe("proofConfig", () => {
  it("is accepted by the SDK message formatter", async () => {
    const { proofConfig } = await import("./proof-config.js");
    const cfg = proofConfig();
    const issuedAt = new Date("2026-10-01T00:00:00.000Z");
    const message = formatWalletMessage(
      {
        walletAddress: "11111111111111111111111111111111",
        origin: cfg.origin,
        chain: cfg.chain,
        requestId: "00000000-0000-4000-8000-000000000000",
        nonce: Buffer.alloc(32, 1).toString("base64url"),
        issuedAt,
        expiresAt: new Date(issuedAt.getTime() + 5 * 60_000),
      },
      cfg,
    );
    expect(message).toContain("https://api.hyphae.fun");
    expect(message).toContain("Hyphae");
  });
});
```

- [ ] **Step 4: Run it and see it fail**

Run: `pnpm --filter @hyphae/api exec vitest run src/link/proof-config.test.ts`
Expected: FAIL, cannot find `./proof-config.js`.

- [ ] **Step 5: Implement**

```ts
// apps/api/src/env.ts, add to the Env object
  LINK_ORIGIN: z.url().refine((v) => new URL(v).protocol === "https:" && new URL(v).origin === v, {
    message: "LINK_ORIGIN must be a bare https origin",
  }),
  LINK_CHAIN: z.enum(["solana:mainnet", "solana:devnet"]).default("solana:mainnet"),
```

```ts
// apps/api/src/link/proof-config.ts
import type { TenantProofConfig } from "@organichub/verify";
import { env } from "../env.js";

// One config for every community: the page and the proof endpoints share the api origin (D4).
export const proofConfig = (): TenantProofConfig => ({
  origin: env.LINK_ORIGIN,
  chain: env.LINK_CHAIN,
  productName: "Hyphae",
  statement: "Link this wallet to your Hyphae member account. Signing is free and moves no funds.",
});
```

`.env.example`: add `LINK_ORIGIN=https://api.hyphae.fun` and `LINK_CHAIN=solana:mainnet`.

- [ ] **Step 6: Run the test.** Same command. Expected: PASS. If the formatter throws on `statement` (length or characters), shorten the statement until it passes, keeping "moves no funds".

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/env.ts .env.example apps/api/src/link/proof-config.ts apps/api/src/link/proof-config.test.ts
git commit -m "feat(link): pin @organichub/verify 0.1.0 and the Hyphae proof config"
```

---

### Task 2: Schema, migration, wallet history and `walletAt`

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/NNNN_verified_wallet_links.sql` (generated, then backfill appended)
- Create: `apps/api/src/link/wallet-links.ts` (`walletAt` only in this task)
- Test: `apps/api/src/link/wallet-links.test.ts`

**Interfaces:**
- Produces tables `linkSessions`, `walletProofRequests`, `memberWalletLinks`, enum `walletProofStatus`.
- Produces `walletAt(db: Db, memberId: string, at: Date): Promise<{ wallet: string; method: "paste" | "signature" } | undefined>`.

- [ ] **Step 1: Add the schema** (append to `packages/db/src/schema.ts`; `check`, `index`, `sql` are already imported)

```ts
// Single-use, 15-minute handle a member receives in a private chat. Only the token digest is stored.
export const linkSessions = pgTable(
  "link_sessions",
  {
    id: id(),
    communityId: uuid("community_id").notNull().references(() => communities.id),
    telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).notNull(),
    telegramUsername: text("telegram_username"),
    tokenDigest: text("token_digest").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, precision: 3 }),
    createdAt: createdAt(),
  },
  (t) => [index("link_sessions_community_user").on(t.communityId, t.telegramUserId)],
);

export const walletProofStatus = pgEnum("wallet_proof_status", ["pending", "consumed"]);

// One SDK proof request. Columns mirror the snapshot the SDK verifies (consumer guide §3).
export const walletProofRequests = pgTable(
  "wallet_proof_requests",
  {
    requestId: uuid("request_id").primaryKey(),
    communityId: uuid("community_id").notNull().references(() => communities.id),
    linkSessionId: uuid("link_session_id").notNull().references(() => linkSessions.id),
    telegramUserId: text("telegram_user_id").notNull(),
    walletAddress: text("wallet_address").notNull(),
    nonceHash: text("nonce_hash").notNull(), // hex SHA-256
    origin: text("origin").notNull(),
    chain: text("chain").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true, precision: 3 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }).notNull(),
    status: walletProofStatus("status").notNull().default("pending"),
    consumedAt: timestamp("consumed_at", { withTimezone: true, precision: 3 }),
  },
  (t) => [
    check("wallet_proof_lifetime", sql`${t.expiresAt} = ${t.issuedAt} + interval '5 minutes'`),
    index("wallet_proof_requests_session").on(t.linkSessionId),
  ],
);

// Append-only wallet history. members.wallet is the current value; payouts read this table (D3).
export const memberWalletLinks = pgTable(
  "member_wallet_links",
  {
    id: id(),
    communityId: uuid("community_id").notNull().references(() => communities.id),
    memberId: uuid("member_id").notNull().references(() => members.id),
    wallet: text("wallet").notNull(),
    method: linkMethod("method").notNull(),
    proofRequestId: uuid("proof_request_id").references(() => walletProofRequests.requestId),
    validFrom: timestamp("valid_from", { withTimezone: true, precision: 3 }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true, precision: 3 }),
  },
  (t) => [
    uniqueIndex("member_wallet_links_one_current").on(t.memberId).where(sql`${t.validTo} is null`),
    check(
      "member_wallet_links_signature_has_proof",
      sql`${t.method} <> 'signature' or ${t.proofRequestId} is not null`,
    ),
    check("member_wallet_links_interval", sql`${t.validTo} is null or ${t.validTo} > ${t.validFrom}`),
  ],
);
```

- [ ] **Step 2: Generate the migration and append the backfill**

```bash
pnpm --filter @hyphae/db exec drizzle-kit generate --name verified_wallet_links
```

Append to the generated SQL file (every existing member gets its current pasted wallet as an open history row):

```sql
--> statement-breakpoint
INSERT INTO "member_wallet_links" ("community_id", "member_id", "wallet", "method", "valid_from")
SELECT "community_id", "id", "wallet", "link_method", "linked_at" FROM "members";
```

Run: `pnpm --filter @hyphae/db exec drizzle-kit check`. Expected: no errors.

- [ ] **Step 3: Write the failing test**

```ts
// apps/api/src/link/wallet-links.test.ts
import { memberWalletLinks, members } from "@hyphae/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity, type TestDb } from "../rewards/test-db.js";
import { walletAt } from "./wallet-links.js";

let db: TestDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

describe("walletAt", () => {
  it("returns the wallet valid at a past instant after a relink (O2)", async () => {
    const { community } = await seedCommunity(db);
    const [m] = await db
      .insert(members)
      .values({ communityId: community.id, telegramUserId: 7n, wallet: "OldWallet1111111111111111111111111", linkMethod: "paste" })
      .returning();
    await db.insert(memberWalletLinks).values([
      { communityId: community.id, memberId: m!.id, wallet: "OldWallet1111111111111111111111111", method: "paste",
        validFrom: new Date("2026-10-01T00:00:00Z"), validTo: new Date("2026-10-05T00:00:00Z") },
      { communityId: community.id, memberId: m!.id, wallet: "NewWallet1111111111111111111111111", method: "paste",
        validFrom: new Date("2026-10-05T00:00:00Z") },
    ]);
    expect(await walletAt(db, m!.id, new Date("2026-10-04T23:59:59Z"))).toEqual({
      wallet: "OldWallet1111111111111111111111111", method: "paste",
    });
    expect(await walletAt(db, m!.id, new Date("2026-10-05T00:00:00Z"))).toEqual({
      wallet: "NewWallet1111111111111111111111111", method: "paste",
    });
    expect(await walletAt(db, m!.id, new Date("2026-09-30T00:00:00Z"))).toBeUndefined();
  });
});
```

(Adjust `seedCommunity`'s return destructuring to whatever `rewards/test-db.ts` returns at execution time.)

- [ ] **Step 4: Run it and see it fail**

Run: `pnpm --filter @hyphae/api exec vitest run src/link/wallet-links.test.ts`
Expected: FAIL, `walletAt` not exported.

- [ ] **Step 5: Implement `walletAt`**

```ts
// apps/api/src/link/wallet-links.ts
import { type Db, memberWalletLinks } from "@hyphae/db";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";

// The only wallet read a payout may use: the link valid at the epoch's closesAt (D3, O2).
export async function walletAt(db: Db, memberId: string, at: Date) {
  const [row] = await db
    .select({ wallet: memberWalletLinks.wallet, method: memberWalletLinks.method })
    .from(memberWalletLinks)
    .where(
      and(
        eq(memberWalletLinks.memberId, memberId),
        lte(memberWalletLinks.validFrom, at),
        or(isNull(memberWalletLinks.validTo), gt(memberWalletLinks.validTo, at)),
      ),
    );
  return row;
}
```

- [ ] **Step 6: Run the test.** Expected: PASS. Then `pnpm -r test` to confirm the migration applies cleanly under PGlite for every existing test.

- [ ] **Step 7: Commit**

```bash
git add packages/db apps/api/src/link/wallet-links.ts apps/api/src/link/wallet-links.test.ts
git commit -m "feat(db): link sessions, proof requests and append-only wallet history"
```

---

### Task 3: Link sessions

**Files:**
- Create: `apps/api/src/link/session.ts`
- Test: `apps/api/src/link/session.test.ts`

**Interfaces:**
- Produces:
  - `openLinkSession(db: Db, input: { communityId: string; telegramUserId: bigint; telegramUsername: string | null }): Promise<string>` returns the raw token (43-char base64url).
  - `resolveLinkSession(db: Db, token: string): Promise<{ session: LinkSession; community: Community } | undefined>` returns only an open, unexpired session.
  - `findLinkSession(db: Db, token: string)` is the same lookup ignoring open/expiry (used by `/link/status`).
  - `digestToken(token: string): string` (hex).

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/link/session.test.ts
import { linkSessions } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity, type TestDb } from "../rewards/test-db.js";
import { digestToken, openLinkSession, resolveLinkSession } from "./session.js";

let db: TestDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

describe("link sessions", () => {
  it("stores only the digest and resolves the raw token", async () => {
    const { community } = await seedCommunity(db);
    const token = await openLinkSession(db, { communityId: community.id, telegramUserId: 42n, telegramUsername: "ana" });
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await db.select().from(linkSessions).where(eq(linkSessions.tokenDigest, digestToken(token)));
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).not.toContain(token);
    const found = await resolveLinkSession(db, token);
    expect(found?.community.id).toBe(community.id);
    expect(found?.session.telegramUserId).toBe(42n);
  });

  it("refuses malformed, unknown, used and expired tokens", async () => {
    const { community } = await seedCommunity(db);
    expect(await resolveLinkSession(db, "short")).toBeUndefined();
    expect(await resolveLinkSession(db, "A".repeat(43))).toBeUndefined();
    const used = await openLinkSession(db, { communityId: community.id, telegramUserId: 1n, telegramUsername: null });
    await db.update(linkSessions).set({ usedAt: sql`clock_timestamp()` }).where(eq(linkSessions.tokenDigest, digestToken(used)));
    expect(await resolveLinkSession(db, used)).toBeUndefined();
    const expired = await openLinkSession(db, { communityId: community.id, telegramUserId: 2n, telegramUsername: null });
    await db.update(linkSessions).set({ expiresAt: sql`clock_timestamp() - interval '1 second'` }).where(eq(linkSessions.tokenDigest, digestToken(expired)));
    expect(await resolveLinkSession(db, expired)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run and see it fail.** `pnpm --filter @hyphae/api exec vitest run src/link/session.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/link/session.ts
import { createHash, randomBytes } from "node:crypto";
import { communities, type Db, linkSessions } from "@hyphae/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const digestToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function openLinkSession(
  db: Db,
  input: { communityId: string; telegramUserId: bigint; telegramUsername: string | null },
) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(linkSessions).values({
    ...input,
    tokenDigest: digestToken(token),
    expiresAt: sql`clock_timestamp() + interval '15 minutes'`,
  });
  return token;
}

async function lookup(db: Db, token: string, openOnly: boolean) {
  if (!TOKEN.test(token)) return undefined;
  const [row] = await db
    .select({ session: linkSessions, community: communities })
    .from(linkSessions)
    .innerJoin(communities, eq(communities.id, linkSessions.communityId))
    .where(
      and(
        eq(linkSessions.tokenDigest, digestToken(token)),
        ...(openOnly
          ? [isNull(linkSessions.usedAt), gt(linkSessions.expiresAt, sql`clock_timestamp()`)]
          : []),
      ),
    );
  return row;
}

export const resolveLinkSession = (db: Db, token: string) => lookup(db, token, true);
export const findLinkSession = (db: Db, token: string) => lookup(db, token, false);
```

- [ ] **Step 4: Run the tests.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/link/session.ts apps/api/src/link/session.test.ts
git commit -m "feat(link): single-use link sessions stored by token digest"
```

---

### Task 4: Tenant-bound `VerificationStore` and the atomic link

**Files:**
- Modify: `apps/api/src/link/wallet-links.ts` (add `applyVerifiedWallet`)
- Create: `apps/api/src/link/store.ts`, `apps/api/src/link/test-wallet.ts`
- Test: `apps/api/src/link/store.test.ts` (PGlite), `apps/api/src/link/store.pg.test.ts` (real Postgres)

**Interfaces:**
- Consumes: `linkSessions`, `walletProofRequests`, `memberWalletLinks` (Task 2); `LinkSession`, `Community` rows (Task 3).
- Produces:
  - `type LinkRefusal = "wallet_taken" | "stale"`
  - `createLinkStore(db: Db, ctx: LinkContext): { store: VerificationStore; refusal(): LinkRefusal | undefined }`
  - `interface LinkContext { communityId: string; linkSessionId: string; telegramUserId: bigint; telegramUsername: string | null; tenant: TenantProofConfig }`
  - `applyVerifiedWallet(tx: Db, input: { communityId: string; telegramUserId: bigint; telegramUsername: string | null; wallet: string; proofRequestId: string }): Promise<"linked" | "wallet_taken">`
  - `testWallet(): Promise<{ address: string; sign(message: string): Promise<string> }>` (base64url signature)

- [ ] **Step 1: Test signer** (test-only helper; WebCrypto Ed25519 plus `@solana/kit`, key lives only in memory for the test)

```ts
// apps/api/src/link/test-wallet.ts
import { getAddressFromPublicKey } from "@solana/kit";

// Tests only: a throwaway in-memory Ed25519 key standing in for a user's wallet.
export async function testWallet() {
  const keys = (await crypto.subtle.generateKey("Ed25519", false, ["sign", "verify"])) as CryptoKeyPair;
  const address = await getAddressFromPublicKey(keys.publicKey);
  return {
    address: address as string,
    async sign(message: string) {
      const sig = await crypto.subtle.sign("Ed25519", keys.privateKey, new TextEncoder().encode(message));
      return Buffer.from(sig).toString("base64url");
    },
  };
}
```

- [ ] **Step 2: Write the failing PGlite tests** (behavior through the real SDK)

```ts
// apps/api/src/link/store.test.ts
import { consumeWalletProof, createVerificationRequest, parseProjectId, WalletProofError } from "@organichub/verify";
import { linkSessions, memberWalletLinks, members, walletProofRequests } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity, type TestDb } from "../rewards/test-db.js";
import { openLinkSession, resolveLinkSession } from "./session.js";
import { createLinkStore } from "./store.js";
import { testWallet } from "./test-wallet.js";

const tenant = { origin: "https://api.hyphae.test", chain: "solana:mainnet", productName: "Hyphae",
  statement: "Link this wallet to your Hyphae member account. Signing is free and moves no funds." } as const;

let db: TestDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

async function session(userId = 100n) {
  const { community } = await seedCommunity(db);
  const token = await openLinkSession(db, { communityId: community.id, telegramUserId: userId, telegramUsername: "u" });
  const found = (await resolveLinkSession(db, token))!;
  const ctx = { communityId: community.id, linkSessionId: found.session.id, telegramUserId: userId, telegramUsername: "u", tenant };
  const identity = { projectId: parseProjectId(community.id), userId: String(userId) };
  return { community, ctx, identity };
}

describe("tenant-bound store through the SDK", () => {
  it("links a proven wallet, consumes proof and session, writes history", async () => {
    const { community, ctx, identity } = await session();
    const w = await testWallet();
    const { store } = createLinkStore(db, ctx);
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    const out = await consumeWalletProof(store, identity,
      { requestId: req.requestId, nonce: req.nonce, message: req.message, signature: await w.sign(req.message) }, tenant);
    expect(out).toEqual({ status: "signature_verified" });
    const [m] = await db.select().from(members).where(eq(members.communityId, community.id));
    expect(m).toMatchObject({ wallet: w.address, linkMethod: "signature" });
    const [h] = await db.select().from(memberWalletLinks).where(eq(memberWalletLinks.memberId, m!.id));
    expect(h).toMatchObject({ wallet: w.address, method: "signature", proofRequestId: req.requestId, validTo: null });
    const [p] = await db.select().from(walletProofRequests).where(eq(walletProofRequests.requestId, req.requestId));
    expect(p!.status).toBe("consumed");
    const [s] = await db.select().from(linkSessions).where(eq(linkSessions.id, ctx.linkSessionId));
    expect(s!.usedAt).not.toBeNull();
  });

  it("rejects a replay of the winning proof without mutations", async () => {
    const { ctx, identity } = await session();
    const w = await testWallet();
    const { store } = createLinkStore(db, ctx);
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    const sig = await w.sign(req.message);
    await consumeWalletProof(store, identity, { ...req, signature: sig }, tenant);
    await expect(consumeWalletProof(store, identity, { ...req, signature: sig }, tenant)).rejects.toBeInstanceOf(WalletProofError);
  });

  it("refuses a signature from a different key, leaving proof pending and session open", async () => {
    const { ctx, identity } = await session();
    const w = await testWallet();
    const other = await testWallet();
    const { store } = createLinkStore(db, ctx);
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    await expect(consumeWalletProof(store, identity, { ...req, signature: await other.sign(req.message) }, tenant))
      .rejects.toBeInstanceOf(WalletProofError);
    const [p] = await db.select().from(walletProofRequests).where(eq(walletProofRequests.requestId, req.requestId));
    expect(p!.status).toBe("pending");
    const [s] = await db.select().from(linkSessions).where(eq(linkSessions.id, ctx.linkSessionId));
    expect(s!.usedAt).toBeNull();
  });

  it("a request from another community is absent, not forbidden", async () => {
    const a = await session(1n);
    const b = await session(1n);
    const w = await testWallet();
    const req = await createVerificationRequest(createLinkStore(db, a.ctx).store, a.identity, w.address, tenant);
    expect(await createLinkStore(db, b.ctx).store.findByRequestId(req.requestId)).toBeUndefined();
  });

  it("a request created for one Telegram user cannot be consumed by another", async () => {
    const { ctx, identity } = await session(10n);
    const w = await testWallet();
    const req = await createVerificationRequest(createLinkStore(db, ctx).store, identity, w.address, tenant);
    const intruder = { ...ctx, telegramUserId: 11n };
    await expect(consumeWalletProof(createLinkStore(db, intruder).store, { ...identity, userId: "11" },
      { ...req, signature: await w.sign(req.message) }, tenant)).rejects.toBeInstanceOf(WalletProofError);
  });

  it("refuses a wallet another member holds, with refusal wallet_taken and nothing consumed", async () => {
    const { community, ctx, identity } = await session(5n);
    const w = await testWallet();
    await db.insert(members).values({ communityId: community.id, telegramUserId: 6n, wallet: w.address, linkMethod: "paste" });
    const linked = createLinkStore(db, ctx);
    const req = await createVerificationRequest(linked.store, identity, w.address, tenant);
    await expect(consumeWalletProof(linked.store, identity, { ...req, signature: await w.sign(req.message) }, tenant))
      .rejects.toBeInstanceOf(WalletProofError);
    expect(linked.refusal()).toBe("wallet_taken");
    const [p] = await db.select().from(walletProofRequests).where(eq(walletProofRequests.requestId, req.requestId));
    expect(p!.status).toBe("pending");
  });

  it("a mutated snapshot field makes the final update affect zero rows and links nothing", async () => {
    const { ctx, identity } = await session();
    const w = await testWallet();
    const { store } = createLinkStore(db, ctx);
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    const row = (await store.findByRequestId(req.requestId))!;
    const ok = await store.verifySignature({ requestId: req.requestId, telegramUserId: identity.userId,
      walletAddress: w.address, nonceHash: Buffer.alloc(32), issuedAt: row.issuedAt, expiresAt: row.expiresAt });
    expect(ok).toBe(false);
    expect(await db.select().from(members).where(eq(members.wallet, w.address))).toHaveLength(0);
  });

  it("relink closes the old history row and opens a new one", async () => {
    const { community, ctx, identity } = await session(9n);
    const first = await testWallet();
    const s1 = createLinkStore(db, ctx).store;
    const r1 = await createVerificationRequest(s1, identity, first.address, tenant);
    await consumeWalletProof(s1, identity, { ...r1, signature: await first.sign(r1.message) }, tenant);
    const token = await openLinkSession(db, { communityId: community.id, telegramUserId: 9n, telegramUsername: "u" });
    const again = (await resolveLinkSession(db, token))!;
    const s2 = createLinkStore(db, { ...ctx, linkSessionId: again.session.id }).store;
    const second = await testWallet();
    const r2 = await createVerificationRequest(s2, identity, second.address, tenant);
    await consumeWalletProof(s2, identity, { ...r2, signature: await second.sign(r2.message) }, tenant);
    const rows = await db.select().from(memberWalletLinks).where(eq(memberWalletLinks.communityId, community.id));
    expect(rows.filter((r) => r.validTo === null).map((r) => r.wallet)).toEqual([second.address]);
    expect(rows.find((r) => r.wallet === first.address)!.validTo).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run and see them fail.** `pnpm --filter @hyphae/api exec vitest run src/link/store.test.ts`. Expected: FAIL, `./store.js` not found.

- [ ] **Step 4: Implement `applyVerifiedWallet`** (append to `wallet-links.ts`; merge the imports)

```ts
import { members } from "@hyphae/db";
import { ne, sql } from "drizzle-orm";

// Runs inside the proof transaction. Locks the member row first so a concurrent relink of the
// same member serializes here; the unique index on (community, wallet) settles cross-member races.
export async function applyVerifiedWallet(
  tx: Db,
  input: { communityId: string; telegramUserId: bigint; telegramUsername: string | null; wallet: string; proofRequestId: string },
): Promise<"linked" | "wallet_taken"> {
  const [holder] = await tx
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.communityId, input.communityId), eq(members.wallet, input.wallet),
      ne(members.telegramUserId, input.telegramUserId)));
  if (holder) return "wallet_taken"; // D2

  const [existing] = await tx
    .select()
    .from(members)
    .where(and(eq(members.communityId, input.communityId), eq(members.telegramUserId, input.telegramUserId)))
    .for("update");

  const now = sql`clock_timestamp()`;
  let memberId: string;
  if (existing) {
    memberId = existing.id;
    await tx.update(members)
      .set({ wallet: input.wallet, linkMethod: "signature", telegramUsername: input.telegramUsername, linkedAt: now })
      .where(eq(members.id, existing.id));
    await tx.update(memberWalletLinks).set({ validTo: now })
      .where(and(eq(memberWalletLinks.memberId, existing.id), isNull(memberWalletLinks.validTo)));
  } else {
    const [created] = await tx.insert(members)
      .values({ communityId: input.communityId, telegramUserId: input.telegramUserId,
        telegramUsername: input.telegramUsername, wallet: input.wallet, linkMethod: "signature" })
      .returning({ id: members.id });
    memberId = created!.id;
  }
  await tx.insert(memberWalletLinks).values({ communityId: input.communityId, memberId, wallet: input.wallet,
    method: "signature", proofRequestId: input.proofRequestId, validFrom: now });
  return "linked";
}
```

Note: the old row's `valid_to` and the new row's `valid_from` both read `clock_timestamp()` in later statements of the same transaction, so the new interval starts at or after the old one ends. `walletAt` uses half-open intervals, so there is no overlap. The `member_wallet_links_interval` check compares an old row's `valid_to` with that same row's own `valid_from`, so it holds whenever the relink happens at least 1 ms after the previous link.

- [ ] **Step 5: Implement the store**

```ts
// apps/api/src/link/store.ts
import type { TenantProofConfig, VerificationStore } from "@organichub/verify";
import { communities, type Db, linkSessions, walletProofRequests } from "@hyphae/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { applyVerifiedWallet } from "./wallet-links.js";

export interface LinkContext {
  communityId: string;
  linkSessionId: string;
  telegramUserId: bigint;
  telegramUsername: string | null;
  tenant: TenantProofConfig;
}
export type LinkRefusal = "wallet_taken" | "stale";

class Rollback extends Error {
  constructor(readonly reason: LinkRefusal) {
    super(reason);
  }
}

const clock = sql`clock_timestamp()`;

// Bound to one authenticated link session at construction (consumer guide §2). Nothing a
// request body carries can reach communityId, the Telegram user, origin or chain.
export function createLinkStore(db: Db, ctx: LinkContext) {
  let refusal: LinkRefusal | undefined;
  const scoped = (requestId: string) =>
    and(eq(walletProofRequests.requestId, requestId), eq(walletProofRequests.communityId, ctx.communityId),
      eq(walletProofRequests.linkSessionId, ctx.linkSessionId));

  const store: VerificationStore = {
    async databaseNow() {
      const [row] = await db
        .select({ ms: sql<number>`floor(extract(epoch from clock_timestamp()) * 1000)::double precision` })
        .from(communities)
        .where(eq(communities.id, ctx.communityId));
      if (!row) throw new Error("link: community missing");
      return new Date(row.ms);
    },

    async insert(input) {
      if (input.telegramUserId !== String(ctx.telegramUserId) || input.origin !== ctx.tenant.origin ||
          input.chain !== ctx.tenant.chain) throw new Error("link: identity mismatch");
      await db.insert(walletProofRequests).values({
        requestId: input.requestId, communityId: ctx.communityId, linkSessionId: ctx.linkSessionId,
        telegramUserId: input.telegramUserId, walletAddress: input.walletAddress,
        nonceHash: input.nonceHash.toString("hex"), origin: input.origin, chain: input.chain,
        issuedAt: input.issuedAt, expiresAt: input.expiresAt,
      });
    },

    async findByRequestId(requestId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) return undefined;
      const [row] = await db.select().from(walletProofRequests).where(scoped(requestId));
      if (!row) return undefined;
      return { requestId: row.requestId, telegramUserId: row.telegramUserId, walletAddress: row.walletAddress,
        nonceHash: Buffer.from(row.nonceHash, "hex"), origin: row.origin, chain: row.chain,
        issuedAt: row.issuedAt, expiresAt: row.expiresAt, status: row.status };
    },

    // Consumer guide §3. Order: lock session, lock request, member write (may block),
    // then the conditional transitions judged by clock_timestamp() after every wait.
    async verifySignature(input) {
      refusal = undefined;
      try {
        return await db.transaction(async (tx) => {
          await tx.select({ id: linkSessions.id }).from(linkSessions)
            .where(and(eq(linkSessions.id, ctx.linkSessionId), eq(linkSessions.communityId, ctx.communityId)))
            .for("update");
          await tx.select({ id: walletProofRequests.requestId }).from(walletProofRequests)
            .where(scoped(input.requestId)).for("update");

          if (input.telegramUserId !== String(ctx.telegramUserId)) throw new Rollback("stale");
          const outcome = await applyVerifiedWallet(tx, {
            communityId: ctx.communityId, telegramUserId: ctx.telegramUserId,
            telegramUsername: ctx.telegramUsername, wallet: input.walletAddress, proofRequestId: input.requestId,
          });
          if (outcome === "wallet_taken") throw new Rollback("wallet_taken");

          const proof = await tx.update(walletProofRequests)
            .set({ status: "consumed", consumedAt: clock })
            .where(and(
              scoped(input.requestId),
              eq(walletProofRequests.telegramUserId, input.telegramUserId),
              eq(walletProofRequests.walletAddress, input.walletAddress),
              eq(walletProofRequests.nonceHash, input.nonceHash.toString("hex")),
              eq(walletProofRequests.issuedAt, input.issuedAt),
              eq(walletProofRequests.expiresAt, input.expiresAt),
              eq(walletProofRequests.origin, ctx.tenant.origin),
              eq(walletProofRequests.chain, ctx.tenant.chain),
              eq(walletProofRequests.status, "pending"),
              sql`${walletProofRequests.issuedAt} <= clock_timestamp()`,
              sql`${walletProofRequests.expiresAt} > clock_timestamp()`,
              sql`${walletProofRequests.expiresAt} = ${walletProofRequests.issuedAt} + interval '5 minutes'`,
            ))
            .returning({ id: walletProofRequests.requestId });
          if (proof.length !== 1) throw new Rollback("stale");

          const session = await tx.update(linkSessions)
            .set({ usedAt: clock })
            .where(and(
              eq(linkSessions.id, ctx.linkSessionId), eq(linkSessions.communityId, ctx.communityId),
              eq(linkSessions.telegramUserId, ctx.telegramUserId), isNull(linkSessions.usedAt),
              sql`${linkSessions.expiresAt} > clock_timestamp()`,
            ))
            .returning({ id: linkSessions.id });
          if (session.length !== 1) throw new Rollback("stale");
          return true;
        });
      } catch (err) {
        if (err instanceof Rollback) {
          refusal = err.reason;
          return false;
        }
        // Unique violation on (community, wallet): another member won the same wallet concurrently.
        if ((err as { code?: string }).code === "23505") {
          refusal = "wallet_taken";
          return false;
        }
        throw err; // unknown outcome, including a lost COMMIT acknowledgement (the route reconciles)
      }
    },
  };
  return { store, refusal: () => refusal };
}
```

- [ ] **Step 6: Run the PGlite tests.** Expected: all PASS.

- [ ] **Step 7: Write the real-Postgres race tests**

```ts
// apps/api/src/link/store.pg.test.ts
import { fileURLToPath } from "node:url";
import { consumeWalletProof, createVerificationRequest, parseProjectId } from "@organichub/verify";
import { createDb, linkSessions, members, walletProofRequests } from "@hyphae/db";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedCommunity } from "../rewards/test-db.js";
import { openLinkSession, resolveLinkSession } from "./session.js";
import { createLinkStore } from "./store.js";
import { testWallet } from "./test-wallet.js";

const url = process.env.HYPHAE_TEST_PG_URL;
if (!url) throw new Error("HYPHAE_TEST_PG_URL is not set; run `pnpm test:pg`");
const pools = Array.from({ length: 6 }, () => createDb(url));
const a = pools[0]!;
const tenant = { origin: "https://api.hyphae.test", chain: "solana:mainnet", productName: "Hyphae",
  statement: "Link this wallet to your Hyphae member account. Signing is free and moves no funds." } as const;

beforeAll(async () => {
  await migrate(a, { migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)) });
});
afterAll(() => Promise.all(pools.map((p) => p.$client.end())));

async function setup(userId: bigint) {
  const { community } = await seedCommunity(a);
  const token = await openLinkSession(a, { communityId: community.id, telegramUserId: userId, telegramUsername: null });
  const s = (await resolveLinkSession(a, token))!;
  const ctx = { communityId: community.id, linkSessionId: s.session.id, telegramUserId: userId, telegramUsername: null, tenant };
  return { community, ctx, identity: { projectId: parseProjectId(community.id), userId: String(userId) } };
}

describe("proof consumption races (consumer guide §7)", () => {
  it("six concurrent valid submissions commit exactly one link", async () => {
    for (let round = 0; round < 20; round++) {
      const { community, ctx, identity } = await setup(BigInt(1000 + round));
      const w = await testWallet();
      const req = await createVerificationRequest(createLinkStore(a, ctx).store, identity, w.address, tenant);
      const sig = await w.sign(req.message);
      const results = await Promise.allSettled(pools.map((p) =>
        consumeWalletProof(createLinkStore(p, ctx).store, identity, { ...req, signature: sig }, tenant)));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await a.select().from(members).where(eq(members.communityId, community.id))).toHaveLength(1);
    }
  });

  it("a request that expires while waiting for the lock loses", async () => {
    const { ctx, identity } = await setup(2000n);
    const w = await testWallet();
    const store = createLinkStore(a, ctx).store;
    const req = await createVerificationRequest(store, identity, w.address, tenant);
    // Shift the whole 5-minute window so it ends 1.5 s from now.
    await a.update(walletProofRequests).set({
      // now() is fixed for the statement, so both columns share one instant and the lifetime check holds.
      issuedAt: sql`date_trunc('milliseconds', now()) - interval '5 minutes' + interval '1500 milliseconds'`,
      expiresAt: sql`date_trunc('milliseconds', now()) + interval '1500 milliseconds'`,
    }).where(eq(walletProofRequests.requestId, req.requestId));
    const row = (await store.findByRequestId(req.requestId))!;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const held = pools[1]!.transaction(async (tx) => {
      await tx.select().from(linkSessions).where(eq(linkSessions.id, ctx.linkSessionId)).for("update");
      await gate;
    });
    const attempt = createLinkStore(pools[2]!, ctx).store.verifySignature({ requestId: req.requestId,
      telegramUserId: identity.userId, walletAddress: w.address, nonceHash: row.nonceHash,
      issuedAt: row.issuedAt, expiresAt: row.expiresAt });
    await new Promise((r) => setTimeout(r, 2500));
    release();
    await held;
    expect(await attempt).toBe(false);
  });

  it("two members racing for one wallet: exactly one wins, the other gets wallet_taken", async () => {
    for (let round = 0; round < 20; round++) {
      const { community } = await seedCommunity(a);
      const w = await testWallet();
      const runs = [3000n + BigInt(round * 2), 3001n + BigInt(round * 2)].map(async (uid, i) => {
        const token = await openLinkSession(a, { communityId: community.id, telegramUserId: uid, telegramUsername: null });
        const s = (await resolveLinkSession(a, token))!;
        const ctx = { communityId: community.id, linkSessionId: s.session.id, telegramUserId: uid, telegramUsername: null, tenant };
        const identity = { projectId: parseProjectId(community.id), userId: String(uid) };
        const linked = createLinkStore(pools[i]!, ctx);
        const req = await createVerificationRequest(linked.store, identity, w.address, tenant);
        return consumeWalletProof(linked.store, identity, { ...req, signature: await w.sign(req.message) }, tenant)
          .then(() => "ok", () => linked.refusal());
      });
      expect((await Promise.all(runs)).sort()).toEqual(["ok", "wallet_taken"]);
    }
  });
});
```

- [ ] **Step 8: Run the pg suite.** `pnpm --filter @hyphae/api test:pg` (needs Docker). Expected: all PASS, including the existing reward concurrency tests.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/link
git commit -m "feat(link): tenant-bound verification store with one-transaction proof, session and wallet"
```

---

### Task 5: HTTP routes and lost-acknowledgement reconciliation

**Files:**
- Create: `apps/api/src/link/routes.ts`
- Modify: `apps/api/src/server.ts`
- Test: `apps/api/src/link/routes.test.ts`

**Interfaces:**
- Consumes: `resolveLinkSession`, `findLinkSession` (Task 3), `createLinkStore` (Task 4), `proofConfig` (Task 1).
- Produces: `linkRoutes(deps: { db: Db; tenant: TenantProofConfig; storeFactory?: typeof createLinkStore }): Hono`, mounted at `/link`.
  - `POST /link/request` body `{ token, wallet }` → 200 `{ requestId, nonce, message }` | 410 `{ error: "link_expired" }` | 400 `{ error: "proof_rejected" }` | 503 `link_unavailable`
  - `POST /link/verify` body `{ token, requestId, nonce, message, signature }` → 200 `{ status: "linked", wallet }` | 400 `proof_rejected` | 409 `wallet_taken` | 410 `link_expired` | 503 `link_unavailable`
  - `POST /link/status` body `{ token }` → 200 `{ linked: boolean, wallet?: string }`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/link/routes.test.ts
import { linkSessions } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity, type TestDb } from "../rewards/test-db.js";
import { linkRoutes } from "./routes.js";
import { digestToken, openLinkSession } from "./session.js";
import { createLinkStore } from "./store.js";
import { testWallet } from "./test-wallet.js";

const tenant = { origin: "https://api.hyphae.test", chain: "solana:mainnet", productName: "Hyphae",
  statement: "Link this wallet to your Hyphae member account. Signing is free and moves no funds." } as const;
let db: TestDb;
let close: () => Promise<void>;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());

const post = (app: ReturnType<typeof linkRoutes>, path: string, body: unknown) =>
  app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function fresh() {
  const { community } = await seedCommunity(db);
  return openLinkSession(db, { communityId: community.id, telegramUserId: 77n, telegramUsername: "x" });
}

describe("link routes", () => {
  it("request → sign → verify links the wallet; status reports it", async () => {
    const app = linkRoutes({ db, tenant });
    const token = await fresh();
    const w = await testWallet();
    const r1 = await post(app, "/request", { token, wallet: w.address });
    expect(r1.status).toBe(200);
    const req = await r1.json();
    const r2 = await post(app, "/verify", { token, ...req, signature: await w.sign(req.message) });
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ status: "linked", wallet: w.address });
    expect(await (await post(app, "/status", { token })).json()).toEqual({ linked: true, wallet: w.address });
  });

  it("rejects body-supplied identity fields (strict schema)", async () => {
    const app = linkRoutes({ db, tenant });
    const token = await fresh();
    const w = await testWallet();
    const r = await post(app, "/request", { token, wallet: w.address, communityId: "x", telegramUserId: "1" });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "proof_rejected" });
  });

  it("a non-base58 wallet is proof_rejected, not unavailable", async () => {
    const app = linkRoutes({ db, tenant });
    const token = await fresh();
    const r = await post(app, "/request", { token, wallet: "0".repeat(40) });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "proof_rejected" });
  });

  it("an unknown or used token is link_expired with no detail", async () => {
    const app = linkRoutes({ db, tenant });
    const w = await testWallet();
    const r = await post(app, "/request", { token: "B".repeat(43), wallet: w.address });
    expect(r.status).toBe(410);
    expect(await r.text()).toBe(JSON.stringify({ error: "link_expired" }));
  });

  it("a rewritten message is proof_rejected", async () => {
    const app = linkRoutes({ db, tenant });
    const token = await fresh();
    const w = await testWallet();
    const req = await (await post(app, "/request", { token, wallet: w.address })).json();
    const tampered = `${req.message}\n`;
    const r = await post(app, "/verify", { token, ...req, message: tampered, signature: await w.sign(tampered) });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "proof_rejected" });
  });

  it("lost commit acknowledgement (committed): 503, then status says linked", async () => {
    const lossy: typeof createLinkStore = (d, ctx) => {
      const real = createLinkStore(d, ctx);
      return { ...real, store: { ...real.store, async verifySignature(i) {
        await real.store.verifySignature(i);
        throw new Error("connection terminated");
      } } };
    };
    const app = linkRoutes({ db, tenant, storeFactory: lossy });
    const token = await fresh();
    const w = await testWallet();
    const req = await (await post(app, "/request", { token, wallet: w.address })).json();
    const r = await post(app, "/verify", { token, ...req, signature: await w.sign(req.message) });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "link_unavailable" });
    expect(await (await post(app, "/status", { token })).json()).toEqual({ linked: true, wallet: w.address });
  });

  it("lost acknowledgement (aborted): 503, status not linked, session still usable", async () => {
    const failing: typeof createLinkStore = (d, ctx) => {
      const real = createLinkStore(d, ctx);
      return { ...real, store: { ...real.store, async verifySignature() { throw new Error("connection terminated"); } } };
    };
    const token = await fresh();
    const w = await testWallet();
    const bad = linkRoutes({ db, tenant, storeFactory: failing });
    const req = await (await post(bad, "/request", { token, wallet: w.address })).json();
    expect((await post(bad, "/verify", { token, ...req, signature: await w.sign(req.message) })).status).toBe(503);
    expect(await (await post(bad, "/status", { token })).json()).toEqual({ linked: false });
    const [s] = await db.select().from(linkSessions).where(eq(linkSessions.tokenDigest, digestToken(token)));
    expect(s!.usedAt).toBeNull();
    const good = linkRoutes({ db, tenant });
    const again = await (await post(good, "/request", { token, wallet: w.address })).json();
    expect((await post(good, "/verify", { token, ...again, signature: await w.sign(again.message) })).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run and see them fail.** `pnpm --filter @hyphae/api exec vitest run src/link/routes.test.ts`. Expected: FAIL, `./routes.js` not found.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/link/routes.ts
import {
  consumeWalletProof, createVerificationRequest, parseProjectId, type TenantProofConfig, WalletProofError,
} from "@organichub/verify";
import { type Db, memberWalletLinks, walletProofRequests } from "@hyphae/db";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { findLinkSession, resolveLinkSession } from "./session.js";
import { createLinkStore } from "./store.js";

const Token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const RequestBody = z.strictObject({ token: Token, wallet: z.string().min(32).max(44) });
const VerifyBody = z.strictObject({
  token: Token, requestId: z.uuid(), nonce: z.string().max(64), message: z.string().max(2000),
  signature: z.string().max(100),
});
const StatusBody = z.strictObject({ token: Token });

type Code = "proof_rejected" | "wallet_taken" | "link_expired" | "link_unavailable";
const fail = (code: Code, op: string) => {
  // Fixed fields only: never the error, its cause, the body, token, nonce, message or signature.
  if (code === "link_unavailable") console.error("link", { code, op });
  return code;
};
// postgres-js and PGlite errors both carry a SQLSTATE `code`; SDK validation errors do not.
const isDbError = (err: unknown) => typeof (err as { code?: unknown })?.code === "string";

export function linkRoutes(deps: { db: Db; tenant: TenantProofConfig; storeFactory?: typeof createLinkStore }) {
  const { db, tenant } = deps;
  const makeStore = deps.storeFactory ?? createLinkStore;
  const app = new Hono();
  app.use("*", bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json({ error: "proof_rejected" }, 400) }));
  app.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
  });

  const context = (found: NonNullable<Awaited<ReturnType<typeof resolveLinkSession>>>) => ({
    ctx: { communityId: found.community.id, linkSessionId: found.session.id,
      telegramUserId: found.session.telegramUserId, telegramUsername: found.session.telegramUsername, tenant },
    identity: { projectId: parseProjectId(found.community.id), userId: String(found.session.telegramUserId) },
  });

  app.post("/request", async (c) => {
    const body = RequestBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: fail("proof_rejected", "request") }, 400);
    const found = await resolveLinkSession(db, body.data.token);
    if (!found) return c.json({ error: fail("link_expired", "request") }, 410);
    const { ctx, identity } = context(found);
    try {
      const out = await createVerificationRequest(makeStore(db, ctx).store, identity, body.data.wallet, tenant);
      return c.json({ requestId: out.requestId, nonce: out.nonce, message: out.message });
    } catch (err) {
      if (!isDbError(err) && err instanceof Error) return c.json({ error: fail("proof_rejected", "request") }, 400);
      return c.json({ error: fail("link_unavailable", "request") }, 503);
    }
  });

  app.post("/verify", async (c) => {
    const body = VerifyBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: fail("proof_rejected", "verify") }, 400);
    const found = await resolveLinkSession(db, body.data.token);
    if (!found) return c.json({ error: fail("link_expired", "verify") }, 410);
    const { ctx, identity } = context(found);
    const linked = makeStore(db, ctx);
    const { token: _token, ...proof } = body.data;
    try {
      await consumeWalletProof(linked.store, identity, proof, tenant);
      const [row] = await db.select({ wallet: walletProofRequests.walletAddress }).from(walletProofRequests)
        .where(and(eq(walletProofRequests.requestId, proof.requestId), eq(walletProofRequests.communityId, ctx.communityId)));
      return c.json({ status: "linked", wallet: row!.wallet });
    } catch (err) {
      if (linked.refusal() === "wallet_taken") return c.json({ error: fail("wallet_taken", "verify") }, 409);
      if (err instanceof WalletProofError) return c.json({ error: fail("proof_rejected", "verify") }, 400);
      return c.json({ error: fail("link_unavailable", "verify") }, 503);
    }
  });

  // Reconciliation after an unknown outcome (consumer guide §3): read durable state, never re-run effects.
  app.post("/status", async (c) => {
    const body = StatusBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: fail("proof_rejected", "status") }, 400);
    const found = await findLinkSession(db, body.data.token);
    if (!found?.session.usedAt) return c.json({ linked: false });
    const [row] = await db.select({ wallet: memberWalletLinks.wallet })
      .from(memberWalletLinks)
      .innerJoin(walletProofRequests, eq(walletProofRequests.requestId, memberWalletLinks.proofRequestId))
      .where(and(eq(walletProofRequests.linkSessionId, found.session.id), eq(walletProofRequests.status, "consumed"),
        eq(memberWalletLinks.communityId, found.community.id)));
    return c.json(row ? { linked: true, wallet: row.wallet } : { linked: false });
  });

  return app;
}
```

`server.ts`: `app.route("/link", linkRoutes({ db, tenant: proofConfig() }));`

- [ ] **Step 4: Run the tests.** Expected: PASS. Then run the whole api suite with `pnpm --filter @hyphae/api exec vitest run`. If the non-base58 test returns 503, the SDK threw an error that carries a `code`. In that case, narrow `isDbError` to the SQLSTATE shape (`/^[0-9A-Z]{5}$/`) and re-run.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/link/routes.ts apps/api/src/link/routes.test.ts apps/api/src/server.ts
git commit -m "feat(link): proof routes with fixed error codes and status reconciliation"
```

---

### Task 6: Signing page

**Files:**
- Create: `apps/api/src/link/page/index.html`, `apps/api/src/link/page/client.ts`, `apps/api/src/link/page/wallet.ts`, `apps/api/tsup.page.config.ts`
- Modify: `apps/api/package.json` (build script), `apps/api/src/link/routes.ts` (`GET /` and `GET /app.js`)
- Test: `apps/api/src/link/page.test.ts`

**Interfaces:**
- Consumes: `POST /link/request`, `/link/verify`, `/link/status` (Task 5).
- Produces: `GET /link` (HTML) and `GET /link/app.js` (bundle), both with a strict CSP.

- [ ] **Step 1: Write the failing test** (headers and page contract; wallet UI is covered by the manual check in Task 8)

```ts
// apps/api/src/link/page.test.ts
import { describe, expect, it } from "vitest";
import { linkRoutes } from "./routes.js";

describe("link page", () => {
  it("serves the page with a strict CSP and no referrer", async () => {
    const app = linkRoutes({ db: {} as never, tenant: {} as never });
    const r = await app.request("/");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-security-policy")).toBe(
      "default-src 'none'; script-src 'self'; connect-src 'self'; img-src data:; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    const html = await r.text();
    expect(html).toContain('<script type="module" src="/link/app.js"></script>');
    expect(html.match(/<script/g)).toHaveLength(1); // no inline script
  });
});
```

- [ ] **Step 2: Run and see it fail.** Expected: 404 on `/`.

- [ ] **Step 3: Page HTML** (`apps/api/src/link/page/index.html`)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hyphae · link wallet</title>
</head>
<body>
  <main>
    <h1>Link your wallet to Hyphae</h1>
    <p>Your wallet will ask you to <strong>sign a readable message</strong>. It is free and moves no funds.</p>
    <div id="wallets"></div>
    <p id="status" role="status"></p>
  </main>
  <script type="module" src="/link/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Wallet helper** (`page/wallet.ts`; reads only the two allowed features)

```ts
import { getWallets } from "@wallet-standard/app";

type Account = { address: string; chains: readonly string[] };
type StdWallet = { name: string; icon: string; accounts: readonly Account[]; features: Record<string, unknown> };
type Connect = { connect(): Promise<{ accounts: readonly Account[] }> };
type SignMessage = {
  signMessage(inputs: { account: Account; message: Uint8Array }[]): Promise<{ signature: Uint8Array; signedMessage: Uint8Array }[]>;
};

const CONNECT = "standard:connect";
const MESSAGE = "solana:signMessage";

// Wallets can inject after first paint.
export const onWalletRegister = (fn: () => void) => getWallets().on("register", fn);

export function messageWallets(): StdWallet[] {
  return (getWallets().get() as unknown as StdWallet[]).filter((w) => CONNECT in w.features && MESSAGE in w.features);
}

export async function connect(w: StdWallet): Promise<Account> {
  const { accounts } = await (w.features[CONNECT] as Connect).connect();
  const account = accounts[0];
  if (!account) throw new Error("no account");
  return account;
}

export async function sign(w: StdWallet, account: Account, message: string): Promise<string> {
  const bytes = new TextEncoder().encode(message);
  const [out] = await (w.features[MESSAGE] as SignMessage).signMessage([{ account, message: bytes }]);
  if (!out || out.signedMessage.length !== bytes.length || !out.signedMessage.every((b, i) => b === bytes[i]))
    throw new Error("wallet altered the message");
  let bin = "";
  for (const b of out.signature) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
```

- [ ] **Step 5: Page client** (`page/client.ts`)

```ts
import { connect, messageWallets, onWalletRegister, sign } from "./wallet.js";

const token = location.hash.slice(1);
history.replaceState(null, "", location.pathname); // drop the token from the address bar and history
const status = document.getElementById("status")!;
const list = document.getElementById("wallets")!;
const say = (t: string) => {
  status.textContent = t;
};

const TEXT: Record<string, string> = {
  proof_rejected: "Link failed. Start again with /link.",
  wallet_taken: "That wallet is already linked to another member. Ask a community admin.",
  link_expired: "This link expired or was already used. Send /link in your community again.",
  link_unavailable: "Link is unavailable right now. Try again.",
};
const linkedText = (wallet: string) => `Linked ${wallet.slice(0, 4)}…${wallet.slice(-4)}. You can close this page.`;

async function post(path: string, body: unknown) {
  const r = await fetch(`/link/${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({ error: "link_unavailable" })) };
}

async function run(w: ReturnType<typeof messageWallets>[number]) {
  list.replaceChildren();
  try {
    const account = await connect(w);
    say("Preparing message…");
    const req = await post("request", { token, wallet: account.address });
    if (!req.ok) return say(TEXT[req.data.error] ?? TEXT.link_unavailable!);
    say("Check your wallet and sign the message.");
    const signature = await sign(w, account, req.data.message);
    const done = await post("verify", {
      token, requestId: req.data.requestId, nonce: req.data.nonce, message: req.data.message, signature,
    });
    if (done.ok) return say(linkedText(done.data.wallet));
    if (done.data.error === "link_unavailable") {
      const s = await post("status", { token });
      if (s.ok && s.data.linked) return say(linkedText(s.data.wallet));
    }
    say(TEXT[done.data.error] ?? TEXT.link_unavailable!);
  } catch {
    say(TEXT.proof_rejected!);
  }
}

function render() {
  const wallets = messageWallets();
  list.replaceChildren();
  if (wallets.length === 0) say("No Solana wallet found in this browser. Open this link in your wallet app's browser.");
  else say("");
  for (const w of wallets) {
    const b = document.createElement("button");
    const img = document.createElement("img");
    img.src = w.icon;
    img.alt = "";
    img.width = 24;
    img.height = 24;
    b.append(img, ` ${w.name}`);
    b.onclick = () => void run(w);
    list.append(b);
  }
}

if (!/^[A-Za-z0-9_-]{43}$/.test(token)) say(TEXT.link_expired!);
else {
  render();
  onWalletRegister(render);
}
```

- [ ] **Step 6: Bundle and serve**

```ts
// apps/api/tsup.page.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { app: "src/link/page/client.ts" },
  format: ["esm"],
  platform: "browser",
  target: "es2022",
  outDir: "dist/public",
  clean: false,
  minify: true,
  splitting: false,
  noExternal: [/.*/],
});
```

`apps/api/package.json` scripts:
- `"build:page": "tsup --config tsup.page.config.ts && cp src/link/page/index.html dist/public/index.html"`
- `"build": "tsup && pnpm build:page"`

In `routes.ts`, add before the POST routes:

```ts
import { readFile } from "node:fs/promises";

const CSP = "default-src 'none'; script-src 'self'; connect-src 'self'; img-src data:; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
// dist/server.js → dist/public/*; tests run from src/link → src/link/page/index.html.
const asset = (name: string) =>
  readFile(new URL(`./public/${name}`, import.meta.url)).catch(() => readFile(new URL(`./page/${name}`, import.meta.url)));

app.get("/", async (c) => {
  c.header("Content-Security-Policy", CSP);
  return c.html((await asset("index.html")).toString());
});
app.get("/app.js", async (c) => {
  c.header("Content-Security-Policy", CSP);
  return c.body((await asset("app.js")).toString(), 200, { "content-type": "text/javascript; charset=utf-8" });
});
```

tsup bundles `routes.ts` into `dist/server.js`, so there `import.meta.url` is `dist/server.js` and `./public/` resolves to `dist/public/`. The Dockerfile needs no change, since `dist` is copied whole.

- [ ] **Step 7: Run tests and build**

```bash
pnpm --filter @hyphae/api exec vitest run src/link
pnpm --filter @hyphae/api build
ls apps/api/dist/public
grep -o 'solana:[A-Za-z]*' apps/api/dist/public/app.js | sort -u
```

Expected: tests PASS; `app.js` and `index.html` listed; the last command prints only `solana:signMessage`.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/link/page apps/api/src/link/page.test.ts apps/api/src/link/routes.ts apps/api/tsup.page.config.ts apps/api/package.json
git commit -m "feat(link): message-signing wallet page on the api origin with a strict CSP"
```

---

### Task 7: Bot flow (group → private chat → session URL)

**Files:**
- Rewrite: `apps/api/src/bot/commands/link.ts`
- Modify: `apps/api/src/bot/index.ts`, `apps/api/src/bot/commands/me.ts`
- Test: `apps/api/src/bot/commands/link.test.ts`

**Interfaces:**
- Consumes: `openLinkSession` (Task 3), `env.LINK_ORIGIN` (Task 1).
- Produces: pure helpers `startPayload(communityId: string): string` (`link_<uuid>`), `parseStartPayload(p: string): string | undefined`, `isMemberStatus(m: { status: string; is_member?: boolean }): boolean`; handlers `linkInGroup`, `linkStart`.

- [ ] **Step 1: Write the failing tests** (pure helpers; handler wiring is checked manually in Task 8)

```ts
// apps/api/src/bot/commands/link.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("../../db.js", () => ({ db: {} }));
vi.mock("../../env.js", () => ({ env: { LINK_ORIGIN: "https://api.hyphae.test" } }));

const { isMemberStatus, parseStartPayload, startPayload } = await import("./link.js");
const id = "3f1c2a9e-0b4d-4c8e-9f11-2a3b4c5d6e7f";

describe("link deep link", () => {
  it("round-trips a community id within Telegram's 64-char payload limit", () => {
    const p = startPayload(id);
    expect(p).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(parseStartPayload(p)).toBe(id);
  });
  it("rejects anything else", () => {
    for (const bad of ["", "link_", "link_not-a-uuid", `x${startPayload(id)}`, "link_../../"])
      expect(parseStartPayload(bad)).toBeUndefined();
  });
});

describe("isMemberStatus", () => {
  it("accepts members, admins, creators and restricted members only", () => {
    expect(isMemberStatus({ status: "member" })).toBe(true);
    expect(isMemberStatus({ status: "administrator" })).toBe(true);
    expect(isMemberStatus({ status: "creator" })).toBe(true);
    expect(isMemberStatus({ status: "restricted", is_member: true })).toBe(true);
    expect(isMemberStatus({ status: "restricted", is_member: false })).toBe(false);
    expect(isMemberStatus({ status: "left" })).toBe(false);
    expect(isMemberStatus({ status: "kicked" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run and see it fail.** Expected: FAIL, exports missing.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/bot/commands/link.ts
import { communities } from "@hyphae/db";
import { eq } from "drizzle-orm";
import type { CommandContext, Context } from "grammy";
import { db } from "../../db.js";
import { env } from "../../env.js";
import { openLinkSession } from "../../link/session.js";
import { reply } from "../reply.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const startPayload = (communityId: string) => `link_${communityId}`;
export const parseStartPayload = (p: string) => {
  const id = p.startsWith("link_") ? p.slice(5) : "";
  return UUID.test(id) ? id : undefined;
};
export const isMemberStatus = (m: { status: string; is_member?: boolean }) =>
  m.status === "member" || m.status === "administrator" || m.status === "creator" ||
  (m.status === "restricted" && m.is_member === true);

// In a group: never post a link URL here (anyone could open it). Point to a private chat instead (D1).
export async function linkInGroup(ctx: CommandContext<Context>) {
  const community = await db.query.communities.findFirst({
    where: eq(communities.telegramChatId, BigInt(ctx.chat.id)),
  });
  if (!community) return reply(ctx, "This chat is not a registered Hyphae community.");
  return reply(ctx, `Link your wallet privately: https://t.me/${ctx.me.username}?start=${startPayload(community.id)}`);
}

// Private chat via the deep link: confirm membership in that community, then hand out the URL.
export async function linkStart(ctx: CommandContext<Context>) {
  const from = ctx.from;
  const communityId = parseStartPayload(ctx.match);
  if (!from || !communityId) return false;
  const community = await db.query.communities.findFirst({ where: eq(communities.id, communityId) });
  if (!community) return ctx.reply("That community is not registered with Hyphae.");
  const member = await ctx.api.getChatMember(Number(community.telegramChatId), from.id).catch(() => undefined);
  if (!member || !isMemberStatus(member)) return ctx.reply(`Join ${community.name} first, then send /link there.`);
  const token = await openLinkSession(db, {
    communityId: community.id, telegramUserId: BigInt(from.id), telegramUsername: from.username ?? null,
  });
  return ctx.reply(
    `Open this within 15 minutes to link your wallet to ${community.name}:\n${env.LINK_ORIGIN}/link#${token}\n\n` +
      "Your wallet will ask you to sign a readable message. It is free and moves no funds. Do not forward this link.",
    { link_preview_options: { is_disabled: true } },
  );
}
```

`bot/index.ts`:

```ts
bot.command("start", async (ctx) => {
  if (ctx.chat.type === "private" && ctx.match.startsWith("link_") && (await linkStart(ctx)) !== false) return;
  return ctx.reply("Hyphae scores real work for token communities. In a community chat: /link, then /submit.");
});
bot.chatType(["group", "supergroup"]).command("link", linkInGroup);
bot.chatType("private").command("link", (ctx) => ctx.reply("Send /link in your community chat."));
```

`me.ts`: after loading `member`, when `member.linkMethod === "paste"` add a line `"Wallet not verified. Send /link to verify it (needed before any payout)."`. Change the not-linked text to `"Not linked yet. Send /link."`.

- [ ] **Step 4: Run the tests and the gate**

```bash
pnpm --filter @hyphae/api exec vitest run src/bot
pnpm -r test && pnpm -r typecheck && pnpm exec biome check . && git diff --check
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/bot
git commit -m "feat(bot): /link hands out a private single-use link; pasted wallets are no longer accepted"
```

---

### Task 8: Gate, docs, and the manual check

**Files:**
- Modify: `docs/BUILDLOG.md`, `docs/HANDOFF.md`, `docs/TESTING.md`
- Create: `docs/handoffs/<date>-verified-link-implemented.md`

- [ ] **Step 1: Full gate**

```bash
pnpm -r test
pnpm -r typecheck
pnpm exec biome check .
pnpm --filter @hyphae/db exec drizzle-kit check
pnpm --filter @hyphae/api test:pg
git diff --check
```

Expected: all green. Record the exact test counts in the snapshot.

- [ ] **Step 2: Acceptance matrix.** In the snapshot, map each consumer-guide §7 bullet to a test name. Bullets not covered by an automated test get a one-line reason. The §7 hold-gate block is out of scope (separate plan).

- [ ] **Step 3: Manual check (needs Cisco, no deploy).** Run the api locally behind an HTTPS tunnel. The SDK accepts only `https:` origins. Set `LINK_ORIGIN` to the tunnel origin and use a **test bot token and a test group**, never `@hyphaeprotocol_bot`. Then check:
  1. `/link` in the group posts only the `t.me` deep link.
  2. The private chat returns the URL. A non-member gets "Join … first".
  3. Phantom and Solflare each show a readable message and no other prompt.
  4. `/me` shows the verified wallet.
  5. Opening the same URL again shows "expired or already used".
  6. A second member proving the same wallet gets the `wallet_taken` text.
  7. In a supergroup where the bot is not an admin, `getChatMember` still answers for the requesting user. If it does not, the bot must be an admin, and this goes in the runbook.

- [ ] **Step 4: Records.** Update the BUILDLOG entry and HANDOFF. They must state these points:
  - "Verified linking is locally tested, not deployed; the migration is not on Neon."
  - The payout rule for R6 and settlement: resolve every recipient with `walletAt(memberId, epoch.closesAt)`, and require `method = 'signature'`. A pasted wallet is never payable.
  - Documented behavior (Review Focus 5): membership is checked when the session opens, not at signing.
  - Follow-ups not done here: the hold gate (`checkHold`, consumer guide §6) as its own plan; Neon apply and deploy under separate authorization; a BotFather menu text update.

- [ ] **Step 5: Commit and push**

```bash
git add docs
git commit -m "docs: record verified wallet linking (local), acceptance matrix and payout rule"
git push -u origin feat/verified-link-sdk
```

Open a PR. Merge only on Cisco's yes, after an independent review (Hyphae's per-stage review rule).

---

## Out of scope (separate authorization each)

- Hold gate (`checkHold`) on `/submit` and `/effort`: consumer guide §6, `minHoldUnits` already in the rubric. It needs two independent RPC providers (Helius + a non-Helius fallback), a caching decision and its own plan.
- Applying the migration on Neon, deploying to Fly, and setting `LINK_ORIGIN` in Fly secrets.
- R6 / settlement code that calls `walletAt`.
- Any admin override for D2 conflicts.

## Estimate

About 1.5–2 working days. Tasks 1–3 take roughly 2 hours. Task 4 is the hard one at about 4–5 hours (the pg race tests are what take the time). Task 5 takes about 2 hours, Task 6 about 2 hours, Task 7 about 1 hour, and Task 8 about 1 hour plus the manual check.
