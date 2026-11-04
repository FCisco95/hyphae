# Local presentation validation — 2026-11-04

Source: `fe53deec33245c5c1daa2cc9b7d23d422b4639ff`. Local documentation/media candidate only; no production backend, scoring call, wallet or transaction was used.

## Environment and runner

Windows native, Node 24.8.0, installed pnpm 10.29.3, agent-browser 0.41.2, isolated headless Chrome 156.0.8078.80. This is one observed environment, not a Windows support matrix or a Node 22 execution result.

`node examples/read-sdk-demo/run.mjs` failed during the disposable consumer installation: PATH resolution selected Corepack and attempted to run a missing pnpm 12.16.1 entrypoint. `pnpm exec node ...` also failed. The successful launch set process-local `npm_execpath` to the existing pnpm 10.29.3 JavaScript entrypoint, then invoked the same Node runner. No global tool configuration or product code was changed. The runner packed/built the SDK and consumer and served only `127.0.0.1:8788`.

## Observed browser results

| Check | Result |
|---|---|
| Fern healthy | DemoA, open epoch, 2 contributions, 1 counted, 1 pending, 75 points, unavailable allocation/payment |
| Moss healthy | DemoB, closed/paused, zero counts/points; allocation unavailable/no_payable_members |
| Simulated 503 | Counts, points, allocation/payment cleared to Unavailable; explicit unknown-not-zero message |
| Deliberate recovery | Healthy read and Read again restored Moss zero counts and original settlement caveats |
| Width | Demo document scrollWidth equals viewport at 1280, 390 and 320 px; no horizontal document overflow |

Network inspection showed loopback document/assets/configuration and synthetic `/v1/communities/DemoA|DemoB` requests. A missing local favicon returned 404. Domain restriction limited the isolated browser to `127.0.0.1`. Package installation is a separate registry-capable build step.

## Media inspected

- [Fern overview](media/read-overview.png): 1280 px desktop, all fixture/payment caveats retained.
- [Unavailable state](media/read-unavailable.png): 1280 px desktop, simulated 503 on Moss.
- [Moss mobile](media/read-mobile.png): 390 px, full-page, fixture badge and settlement caveats retained.
- [Reviewed recording](media/read-demo-reviewed.webm): 27 seconds, 1280×1200, 5 fps, no audio. Fern → Moss → 503 → restored Moss, with LOCAL FIXTURES visible. Extracted frames were visually inspected at each state; the complete output decoded with FFmpeg without errors.

Capture tooling returned a pipe-closed error when stopping the active recording. The saved 27-second stream nevertheless contained all four required states and decoded cleanly. It was remuxed without re-encoding into the reviewed file above, then decoded and probed again. Earlier incomplete or control-only takes are not selected media.

The fixture's existing decorative green/system-font styling differs from the monochrome/Kumbh production identity. No runtime styling was changed. These are engineering-demo evidence, kept separate from the README hero. The README uses existing monochrome branding and monochrome explanatory diagrams. No recoloring or runtime redesign is part of this candidate.

## README preview and limits

The final README and engineering document were submitted to GitHub's render-only Markdown API (`POST /markdown`, GFM mode, repository context). Both returned HTML; no commit, repository file, release or deployment was created. The public-safe candidate text was sent for rendering; no private handoff or screenshot was submitted.

The returned HTML was displayed locally with a review stylesheet, without remote assets. README light/dark desktop and dark 390 px captures were inspected. Both the theme-selected wordmark and pipeline SVG loaded, and document scrollWidth equalled 390 px. This validates GitHub's Markdown output plus local layout; it does not claim pixel-identical GitHub CSS.

Mermaid blocks were replaced by self-contained, authored SVG diagrams, preserving the same flow edges. No renderer or dependency was installed. Both SVGs have accessible titles/descriptions, white backgrounds and monochrome ink, with no script, external resources or decorative green. The contribution flow was inspected at 390 px; the wider architecture was inspected at desktop size and is also described by the source table. No GitHub Mermaid runtime is required.

No full product tests, scoring benchmarks, production health checks, registration or payment flows were run. No upload/publication occurred. The repository documentation allowlist still ignores `docs/portfolio/`; the candidate needs that path boundary resolved before future publication.
