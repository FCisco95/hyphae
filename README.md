# Hyphae

Hyphae is a proof-of-contribution layer for token communities. Members do real work for a community, an AI scores it against public guidelines and shows its reasoning, and each epoch's payouts are committed to Solana as a merkle root, next to the hash of the epoch's full audit record. Each community has a SOL vault; a contributor claims their share from it with a merkle proof, signed by their own wallet, once.

Built solo for [Colosseum's Crypto World's Fair](https://colosseum.com/worldsfair) (2026-09-14 → 2026-10-12), under the Organic/MYCEL umbrella. The build log is [docs/BUILDLOG.md](docs/BUILDLOG.md).

## Status

| Part | State |
|---|---|
| Telegram bot, AI scoring and reward epochs | Live for the MYCEL community. |
| Public audit site | Live at **[hyphae-delta.vercel.app](https://hyphae-delta.vercel.app)**, reading the production API. |
| Read API v1 | Live at `https://hyphae-api.fly.dev/v1`, every route included, a wallet's claims among them. The reference is at [`/docs`](https://hyphae-api.fly.dev/docs) and the OpenAPI 3.1 document at [`/v1/openapi.json`](https://hyphae-api.fly.dev/v1/openapi.json). |
| Solana program (`programs/hyphae`): vaults, epoch roots, one-time claims | Deployed on **mainnet** and on **devnet**, at the same address, `EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E`. On mainnet its upgrade authority is a Ledger hardware wallet, `2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR`, and its hash is the verified build's. No community, vault or payout exists on mainnet yet. A publish, a claim and a refused duplicate claim are recorded on devnet in [docs/handoffs/2026-09-27-devnet-proof.md](docs/handoffs/2026-09-27-devnet-proof.md). |
| Soulbound Token-2022 points | Planned, not built. |

## Set up a community

Each token community uses its own registered Telegram group and `/c/<mint>` audit page. The shared bot provides community-specific welcome/help, rules, submissions and progress. Adding the bot alone does not register a group.

The [operator setup guide](docs/community/SETUP-INTEGRATION.md) describes the local `community-setup` tool: offline plan, read-only checks, then an explicitly approved registration that starts paused with a pinned epoch and no payment eligibility. Current setup is operator-assisted; an Organic owner-authorized integration and a self-service administrator interface are not built. No new production community or Telegram setting is changed by publishing this code.

## Read API

Public, read-only, unauthenticated JSON at `https://hyphae-api.fly.dev/v1`. The reference is at [`/docs`](https://hyphae-api.fly.dev/docs), which renders the OpenAPI 3.1 document at [`/v1/openapi.json`](https://hyphae-api.fly.dev/v1/openapi.json). The document is generated from the same schemas the API's tests check its responses with. To run it locally, see [Develop](#develop).

For a runnable, schema-validated reader and the community/launchpad adoption boundaries, see the [integration guide](docs/community/INTEGRATING.md). The example uses the current public API; it is local repository tooling, not a published SDK or self-service setup.

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

[Business Source License 1.1](LICENSE), converting to the GPL v2.0 or later on 2028-10-12. This repository is private; the program, its verifiable build and the rubrics are published at [FCisco95/hyphae-program](https://github.com/FCisco95/hyphae-program) under the same licence.
