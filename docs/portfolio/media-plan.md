# Hyphae media plan

**Captured locally; pending editorial approval.** Source `fe53dee`, 2026-11-04. Three screenshots and a reviewed 27-second WebM exist locally. Nothing was uploaded. See [validation](VALIDATION.md). [README](../../README.md) · [Claim sources](ENGINEERING.md).

## Existing assets first

| Asset | Disposition |
|---|---|
| [Light wordmark](../../apps/web/public/brand/hyphae-wordmark.svg), [dark wordmark](../../apps/web/public/brand/hyphae-wordmark-dark.svg), [mark](../../apps/web/public/brand/hyphae-mark.svg) | Tracked branding; reuse the corresponding theme variant. |
| Local `docs/community/2026-10-02-epoch-2-desktop.png` and `2026-10-02-epoch-2-mobile.png` | Ignored historical captures, not current fixture-demo media; no republication approval. |
| Local `docs/community/2026-10-03-onboarding-desktop.png` and `2026-10-03-onboarding-mobile.png` | Ignored owner captures; not authorized for republication. |
| Demo output `examples/read-sdk-demo/dist/` | Ignored; absent at intake. The verifier can save captioned captures here for review. |

Keep monochrome framing. Green retains its verified/paid meaning; fixture health and points are not payment success. Preserve actual app typography; Kumbh Sans belongs in separately authored captions where available. Do not redesign the demo or fabricate scoring screens.

## Safe recording

Use only the [fixture app](../../examples/read-sdk-demo/README.md), started with its documented `node examples/read-sdk-demo/run.mjs` after dependencies are available. It binds to loopback and has no live mode. Builds may fetch packages, separately from community data. Local Windows execution passed with Node 24.8.0/pnpm 10.29.3 and an explicit process-local pnpm entrypoint; the direct runner command failed Corepack resolution. See the validation receipt.

Keep **LOCAL FIXTURES** visible in every shot, including mobile. Use a clean browser profile without wallet extensions, accounts, notifications or personal tabs. No backend configuration, real API data, identity, scoring call, signing or payment. Do not use `pnpm preview`.

## 30-second storyboard — three steps

| Step / time | Action and visible result | Caption / narration |
|---|---|---|
| 1 / 0–9 s | Fern collective, Healthy read: 2 contributions, 1 counted, 1 pending, 75 points. Keep allocation/payment visible. | “Public reads distinguish counted work, pending work and payment evidence. These are local fixtures.” |
| 2 / 9–17 s | Select Moss workshop: separate identity, closed/paused state and zero counts. | “A separate community has a real zero. Points and payments remain separate.” |
| 3 / 17–30 s | Select API unavailable · 503; hold on Unavailable. Select Healthy read, use Read again, hold on recovered Moss counts. | “A failed read is unknown, not zero. A deliberate healthy read restores the selected community.” |

503 is simulated, not a live outage; recovery is not a production health check. Trim pauses to stay within 20–40 seconds while keeping failure and recovery readable.

## Three planned stills

The three locally captured files below were visually inspected; public README embedding remains pending:

1. `docs/portfolio/media/read-overview.png` — desktop Fern, controls, fixture label and allocation/payment. Alt: “Local fixture reader showing Fern's counted and pending contributions; points are not payments.”
2. `docs/portfolio/media/read-unavailable.png` — same frame after synthetic 503. Alt: “Simulated 503 clears totals to Unavailable instead of showing zero.”
3. `docs/portfolio/media/read-mobile.png` — healthy Moss at 390 px. Alt: “Mobile local fixture reader showing the separate, empty Moss community.”

Capture desktop at 1280 px; inspect 390/320 px and light/dark readability without implying the fixture app implements a theme it lacks. Do not crop caveats. Record source SHA, Node/pnpm, OS, viewport, scenario, capture time and actual command result. Fixture observation timestamps are synthetic, not recording dates.

## Pending evidence

The README embeds only existing branding. The local video is `media/read-demo-reviewed.webm` (27 seconds, 1280×1200, 5 fps, silent). Add screenshot references after files exist and are reviewed. A video needs a real thumbnail and verified public destination. No empty links, “coming soon” banners, upload or hosting is part of this pass.

The contribution → rules → LLM evaluation → explanation/record pipeline is an **explanatory diagram**. Scoring footage is pending a separate safe, evidenced capture path; the read demo cannot substitute for it.

## Observed visual difference

The existing fixture app uses green body/button/points styling and system fonts; the main web product uses monochrome/Kumbh with semantic green. Captures preserve the actual fixture UI. No CSS was changed. Keep them as engineering-demo evidence, separate from the product hero. The README retains its monochrome wordmark and explanatory SVG. No runtime change or screenshot recoloring is needed for this candidate.

## Explanatory diagrams

`diagrams/contribution-flow.svg` and `diagrams/architecture.svg` are authored diagrams derived from the documented source flow, not screenshots or recordings. Both are self-contained monochrome SVGs with accessible descriptions. They replace renderer-dependent Mermaid blocks; no added package or font download is required.
