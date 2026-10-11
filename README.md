# Hyphae

Hyphae is a proof-of-contribution layer for token communities. Members do real work for a community, an AI scores it against public guidelines and shows its reasoning, and each epoch's payouts are committed to Solana as a merkle root, next to the hash of the epoch's full audit record. Each community has a SOL vault; a contributor claims their share from it with a merkle proof, signed by their own wallet, once.

Built solo for [Colosseum's Crypto World's Fair](https://colosseum.com/worldsfair) (2026-09-14 → 2026-10-12), under the Organic/MYCEL umbrella. The build log is [docs/BUILDLOG.md](docs/BUILDLOG.md).

## Status

**October 10, 2026: epoch 2 paid on Solana mainnet.** All four payees claimed **1,238,881,509 lamports**, with **0 unclaimed**; three of the four payees are non-founder community members. [Finalized payout and claim receipts](docs/demo/2026-10-10-mainnet-payout.md#finalized-transactions).

| Part | State and evidence |
|---|---|
| Solana program: vaults, epoch roots, one-time claims | Mainnet and devnet program `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`. Mainnet upgrade authority is the Ledger `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`; the [October 11 mainnet hash re-read](docs/demo/2026-10-10-mainnet-payout.md#program-hash-re-read-october-11) matches the verified build. |
| MYCEL community and vault | Mainnet community [HRkBN4…XbRX](https://solscan.io/account/HRkBN4sX7NyPEfa4SfRoTsP1dynmPDLMYbY7qLa4XbRX) and vault [AC3zkG…oG86K](https://solscan.io/account/AC3zkGQ9abJs6sssaY5nDX8Qjv2UM19r4JYLgcHoG86K), created in C16 [aensGhPg…aQJSghNX](https://explorer.solana.com/tx/aensGhPgR8XBz5unAugUd9bJai3WbyUoJFwCLKmGn5kqUjsTNYNSQXR9oraAx9FitJac74tK9fYyCTBaQJSghNX); funded with 1.5 SOL in C18 [5spBxwDa…i1c7rjtj](https://explorer.solana.com/tx/5spBxwDa9jbMbvZup3bR1aU5t2HVoYb24U2JLvX4dx8U6GJehDr1i1pgepxqTtodJf2ykRTP95dHGMBqi1c7rjtj). |
| Epoch 2 payout | C20 [4qhKtnsV…Xop6EnLm](https://explorer.solana.com/tx/4qhKtnsVD78xpvRPdi7TQ1fcF86FjiueCFZNq6a11yfSQ7Q4UeXboGaRtzTDtyMnFbDtVywHGzgytrXqXop6EnLm) committed the root and audit hash, sent the 0.045 SOL Treasury fee and allocated 1,238,881,509 lamports. [All four claim receipts](docs/demo/2026-10-10-mainnet-payout.md#finalized-transactions) confirm 4/4 paid, 0 unclaimed; [live settlement](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2). |
| Published IDL | [2sS66trK…aBj9ArgZ](https://explorer.solana.com/tx/2sS66trKN2myWW4cKSX2Yie3K2G9dDhqgE84aWvr9aZrm5R3hDpCmewFxN8GXzAj8kxYtYrNE8hw2F9haBj9ArgZ); [canonical metadata](https://solscan.io/account/zxj1hrV2pYRuHC65TvUVsRssMUvzu8bZ7YKWkPTrc9d). Solscan decodes the [claim receipts](docs/demo/2026-10-10-mainnet-payout.md#finalized-transactions). |
| Telegram bot, AI scoring and public audit site | Live for MYCEL; [epoch 2 audit](https://hyphae-delta.vercel.app/c/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/e/2) records 33 contributions from 9 members and the mainnet settlement. |
| Read API v1 | Live, including [epoch-2 settlement](https://hyphae-api.fly.dev/v1/communities/HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg/epochs/2), wallet claims, [signed C21 wallet record](https://hyphae-api.fly.dev/v1/wallets/MAoRn1JFD66gcXHiCqcAgppXBCR4TP8pKT4XV7HVhAB/record), [`/docs`](https://hyphae-api.fly.dev/docs) and [`/v1/openapi.json`](https://hyphae-api.fly.dev/v1/openapi.json). |
| October 11 post-payout release | Reviewed claim recovery, [wallet page](https://hyphae-delta.vercel.app/wallet/MAoRn1JFD66gcXHiCqcAgppXBCR4TP8pKT4XV7HVhAB), Actions and schedule notice live. Rules-test/hold checklists stay private; public allocation/payment receipts remain public. [E0–E6 execution and smoke receipts](docs/demo/2026-10-11-release-plan.md#record). |
| Soulbound Token-2022 points | Planned, not built; the [program source](https://github.com/FCisco95/hyphae-program/tree/main/programs/hyphae/src) has no points mint. |

## Set up a community

Each token community uses its own registered Telegram group and `/c/<mint>` audit page. The shared bot provides community-specific welcome/help, rules, submissions and progress. Adding the bot alone does not register a group.

The [operator setup guide](docs/community/SETUP-INTEGRATION.md) describes the local `community-setup` tool: offline plan, read-only checks, then an explicitly approved registration that starts paused with a pinned epoch and no payment eligibility. Current setup is operator-assisted; an Organic owner-authorized integration and a self-service administrator interface are not built. No new production community or Telegram setting is changed by publishing this code.

## Read API

Public, read-only, unauthenticated JSON at `https://hyphae-api.fly.dev/v1`. The reference is at [`/docs`](https://hyphae-api.fly.dev/docs), which renders the OpenAPI 3.1 document at [`/v1/openapi.json`](https://hyphae-api.fly.dev/v1/openapi.json). The document is generated from the same schemas the API's tests check its responses with. To run it locally, see [Develop](#develop).

For the locally packed standalone TypeScript read SDK, a runnable reader and community/launchpad adoption boundaries, see the [integration guide](docs/community/INTEGRATING.md). Package installation is verified in a separate Node/browser consumer; npm publication and self-service setup remain separate.

- A section the API cannot confirm is `{ "status": "unavailable", "reason": … }`, never a zero.
- Settlement and payments are read against Solana. A transaction is shown only when the chain proves it created the account it names.
- Every response carries `RateLimit-*` headers. Past 300 requests a minute from one address, the API answers `429` with `Retry-After`.

## Integrate in 10 lines

A wallet's leaves in every community, newest first, each with its proof and its payment status (`paid` with the claim transaction, `claimable`, or `unavailable` with a reason). This reads the first 100; `total_claims` counts them all, and `offset` pages on. A wallet with no leaf in a published epoch gets `total_claims: 0` and an empty `claims`, not a `404`.

```js
const API = process.env.HYPHAE_API ?? "https://hyphae-api.fly.dev/v1";
const wallet = process.argv[2];
const { claims } = await (await fetch(`${API}/wallets/${wallet}/claims?limit=100`)).json();
```

Check each proof yourself: rebuild the 89-byte leaf, then hash up the sorted pairs to the root. It is the same computation the program runs before it pays.

```js
import { createHash } from "node:crypto";
import { getAddressEncoder } from "@solana/kit";

const sha = (...parts) => createHash("sha256").update(Buffer.concat(parts)).digest();
const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
for (const c of claims) {
  let node = sha(Buffer.of(0), Buffer.from(getAddressEncoder().encode(wallet)), u64(c.epoch.index),
    u64(c.score), u64(c.amount_lamports), Buffer.from(c.evidence_hash, "hex"));
  for (const p of c.proof.map((h) => Buffer.from(h, "hex")))
    node = sha(Buffer.of(1), ...(Buffer.compare(node, p) <= 0 ? [node, p] : [p, node]));
  console.log(c.community.mint, c.epoch.index, c.amount_lamports, c.payment.status, node.toString("hex") === c.root);
}
```

`root` is the root of the epoch account at `epoch_address`. Read that account to check it without trusting the API. To claim, read `/v1/communities/{mint}/epochs/{index}/claims/{wallet}` right before signing: it adds a recent blockhash.

## Funding a community's vault (for Organic and other integrators)

A community is the pair (token mint, the admin key that publishes its epochs). Its vault is a program-derived address, so an integrator derives it without calling Hyphae, and funds it with an ordinary SOL transfer:

```js
import { address, getAddressEncoder, getProgramDerivedAddress } from "@solana/kit";

const HYPHAE = address("EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E");
const enc = getAddressEncoder();
const [community] = await getProgramDerivedAddress({ programAddress: HYPHAE, seeds: ["community", enc.encode(mint), enc.encode(admin)] });
const [vault] = await getProgramDerivedAddress({ programAddress: HYPHAE, seeds: ["vault", enc.encode(community)] });
```

- The vault's seeds are `["vault", community]`, where `community` is the program-derived address of `["community", mint, admin]`. The admin is a seed, so a community is the pair, not the mint alone.
- SOL leaves the vault only through the program: each published epoch sends the 3% Hyphae fee to the recipient fixed when the community was created, and each claim pays one leaf of a published root, once. Who is trusted with what is under [Custody during the pilot](#custody-during-the-pilot).
- An epoch can only allocate SOL that no earlier epoch has allocated and nobody has claimed yet.
- The program is on mainnet and on devnet at the same address, so a vault's address is the same on both, and it exists only on a network where its community was created. Check that the community exists on the network you use before sending anything.

Organic's bagworker sweep can target this address. Nothing in this repository changes Organic's code.

## Custody during the pilot

**Pilot policy.** Hyphae's publisher key sets each epoch's payout list, so you trust it with that epoch's pot. We keep that key on a hardware wallet and fund one epoch at a time, just before it pays. The program has no withdraw instruction: SOL leaves the vault only through member claims and the 3% fee. The program can still be upgraded. The upgrade key is held the same way, and any upgrade is announced here before it is used.

## Develop

Requires pnpm 10 and Node 22. The Solana program builds in WSL or Linux with Anchor 1.0.1 and Solana CLI 3.1.

```sh
pnpm install
pnpm test && pnpm typecheck && pnpm lint
pnpm --filter @hyphae/api test:pg          # Postgres 17 in Docker
anchor build && cargo test -p hyphae --tests
python3 tests/h_contract_vectors.py        # the commitment vectors, with Python's standard library
```

CI runs the same checks on every push. The program builds weekly.

To run the read API locally on a disposable database with the demo community:

```sh
docker run -d --rm --name hyphae-pg -p 55433:5432 -e POSTGRES_PASSWORD=local -e POSTGRES_DB=hyphae postgres:17
export DATABASE_URL=postgres://postgres:local@127.0.0.1:55433/hyphae
pnpm --filter @hyphae/db exec drizzle-kit migrate
cd apps/api && node --import tsx src/http/demo-seed.ts && pnpm build
# The bot and scoring variables must be set but are not used by the read API.
TELEGRAM_BOT_TOKEN=000000000:local-placeholder-token TELEGRAM_WEBHOOK_SECRET=local-placeholder \
  ANTHROPIC_API_KEY=unused LINK_ORIGIN=https://localhost PORT=8787 \
  READ_RPC_URL=https://api.devnet.solana.com node dist/server.js
```

Then open `http://localhost:8787/docs`. `publish.devnet.test.ts` can add a real devnet publication to the same database (`HYPHAE_DEVNET_DATABASE_URL`).

## License

[Business Source License 1.1](LICENSE), converting to the GPL v2.0 or later on 2028-10-12. This repository is public; the program, its verifiable build and the rubrics are also published at [FCisco95/hyphae-program](https://github.com/FCisco95/hyphae-program) under the same licence.
