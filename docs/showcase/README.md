# The site, for review

Screenshots of the public site at `main`, taken 2026-09-28 from a production build (`next build && next start`) on this machine. The site goes public on Oct 1 (step 15 of `docs/handoffs/2026-10-01-cutover.md`), after Cisco reviews its copy here (step 10).

## Where each page's data comes from

| Page | Data |
|---|---|
| `/` (landing) | The live section reads a local read API on the demo seed (`apps/api/src/http/demo-seed.ts`, "Hyphae Demo"). The devnet rows are the real run 7 signatures (`docs/handoffs/2026-09-27-devnet-proof.md`). |
| community, epoch-final, leaderboard, contribution | The same local API and demo seed. |
| epoch (settled), claim | **Fixture data**: the web tests' fixtures (`apps/web/components/fixtures.ts`) served by a mock API, because no local database holds a published settlement. The signatures in them are placeholders. |
| unavailable | The site with its API unreachable. |

## Files

This folder has the dark theme; `docs/screenshots/` has the same pages in the light theme, at 1180 and 390 px.

| File | What |
|---|---|
| `landing-hero-1920-dark.png`, `landing-hero-1920-light.png` | The first screen of `/` at 1920 × 1080, as the Oct 9 video opens |
| `landing-1920-dark.png`, `landing-1920-light.png` | All of `/` at 1920 |
| `landing-1180-dark.png`, `landing-390-dark.png` | All of `/` at 1180 and on a phone |
| `community-{1180,390}-dark.png` | `/c/<mint>` |
| `epoch-{1180,390}-dark.png` | `/c/<mint>/e/<n>` with a published settlement (fixture) |
| `epoch-final-{1180,390}-dark.png` | `/c/<mint>/e/<n>`, a closed epoch with every contribution state (demo seed) |
| `leaderboard-{1180,390}-dark.png` | `/c/<mint>/e/<n>/leaderboard` |
| `contribution-{1180,390}-dark.png` | `/contribution/<id>`, a hard-zero score with a late correction |
| `claim-{1180,390}-dark.png` | `/c/<mint>/e/<n>/claim` in a browser with no wallet (fixture) |
| `unavailable-{1180,390}-dark.png` | Any page when the API can't be read |
| `og-landing.png`, `og-contribution.png` | The social cards for `/` and for a contribution |

## The landing page's words, and where each comes from

| Section | Text | Source |
|---|---|---|
| Hero | "Proof of contribution for token communities." | README, first paragraph: "a proof-of-contribution layer for token communities" |
| Hero | "For coin communities that want to pay the people doing their work, from a community vault, by published rules anyone can check." | Video beat 1 |
| Hero | "Built solo for Colosseum's Crypto World's Fair. MIT licensed." | README, second paragraph and licence |
| How it works | Step 1, "A member replies to or quotes the community's post on X, then sends the link to the Telegram bot." | Build log 2026-09-17 (evening): `/raid`, `/submit <link>` |
| How it works | Step 2, "An AI grades it against the community's published rubric and posts its reasoning back. The credit rules run in code, after the model answers." | Build log 2026-09-17 (evening): "Credit is computed in code, not by the model"; video beat 2 |
| How it works | Step 3, "When the week closes, every member's payout goes into one merkle root, published on-chain with the hash of the full audit record." | Video beat 5 |
| How it works | Step 4, "Each member claims their share from the community's vault with a merkle proof, signed by their own wallet, once." | README, first paragraph |
| Proof | Live numbers | Read from the API at page load; "can't be reached" when it can't |
| Proof | Five devnet transactions, labelled devnet | Run 7, `docs/handoffs/2026-09-27-devnet-proof.md`; all five are finalized on devnet (checked 2026-09-28), the fifth failing with `Custom: 0` as recorded |
| Trust | "The program on devnet is byte for byte what this repository builds in Anchor's pinned Docker image." and hash `7e902d1b…43ac` | Video beat 7; `docs/handoffs/2026-09-28-verifiable-build-and-deploy-rehearsal.md` |
| Trust | The custody policy | `CUSTODY_POLICY` in `packages/core`, word for word as approved on 2026-09-27 |
| Trust | "To be paid, a member proves their wallet by signing a message…" | Video beat 3, word for word |
| Trust | "The code, who holds each key, and the custody rules are all public." | The README's custody section and the key rulings (`docs/handoffs/2026-09-27-keys-and-fee-rulings.md`) |
| Trust | "Every line is on GitHub, and the build log records every session." | README licence; `docs/BUILDLOG.md` |
| For integrators | "Everything on this site is in a public API, and any project can fund a community's vault." and the two paragraphs | Video beat 8; README "Read API" and "Funding a community's vault" |
| For integrators | "The production API does not serve this example's wallet-claims route yet; the README says how to run the whole API locally meanwhile." | README "Read API": "not deployed yet; run it locally meanwhile". True from Oct 1 (`86ff258` serves the community and epoch routes) until Runbook C's C7; change it then |
| For integrators | "The program is on devnet only. Check its address on the network you use before sending anything." | README "Funding a community's vault", word for word; change it after Runbook C's C13 |
| For integrators | The code | README "Integrate in 10 lines", word for word (a test holds them together) |
| Footer | "Points are not money. An allocation or payment appears only once the chain confirms it. All times UTC." | The audit site's footer since 2026-09-24 |
