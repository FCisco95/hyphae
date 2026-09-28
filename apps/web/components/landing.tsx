import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LooseEpochV1 } from "@hyphae/core";
import { CUSTODY_POLICY, CUSTODY_POLICY_URL } from "@hyphae/core";
import { growFilaments } from "../lib/filaments.js";
import { explorerTx, networkName, shortWallet, sol, utc } from "../lib/format.js";
import type { LiveProof } from "../lib/landing.js";
import { API_DOCS, BUILDLOG, doc, GITHUB, LICENSE, README_STATUS, RUBRICS } from "../lib/links.js";
import { settlementOf } from "../lib/settlement.js";
import { MarkShapes } from "./brand.js";
import { ButtonLink, EvidenceLink, Section, Stat, Stats } from "./ui.js";
import { unavailableSentence } from "./views.js";

// The landing page. Every sentence comes from the README, the build log or an evidenced beat of the
// Oct 9 video script; every number is read from the API or cited from a recorded devnet run.

const FILAMENTS = growFilaments({ seed: 20260916, count: 14, width: 1600, height: 920 });
const PULSES = FILAMENTS.filter((f) => f.depth === 0).slice(0, 4);

function Filaments() {
  return (
    <svg className="filaments" viewBox="-800 -460 1600 920" aria-hidden="true">
      <defs>
        {/* Filaments thin out with distance from the mark, and fade before they reach the copy. */}
        <radialGradient id="filament-fade" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="780">
          <stop offset="0.1" stopColor="#fff" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="filament-side" gradientUnits="userSpaceOnUse" x1="-620" x2="-120">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <mask
          id="filament-mask"
          maskUnits="userSpaceOnUse"
          x="-800"
          y="-460"
          width="1600"
          height="920"
        >
          <rect x="-800" y="-460" width="1600" height="920" fill="url(#filament-fade)" />
        </mask>
        <mask
          id="filament-copy"
          maskUnits="userSpaceOnUse"
          x="-800"
          y="-460"
          width="1600"
          height="920"
        >
          <rect x="-800" y="-460" width="1600" height="920" fill="url(#filament-side)" />
        </mask>
      </defs>
      <g mask="url(#filament-mask)">
        <g mask="url(#filament-copy)" fill="none" stroke="currentColor" strokeLinecap="round">
          {FILAMENTS.map((f) => (
            <path
              key={f.d}
              className={`filament filament-${f.depth}`}
              d={f.d}
              pathLength={1}
              style={
                {
                  "--start": `${(f.start * 2.4).toFixed(2)}s`,
                  "--span": `${(f.span * 2.4).toFixed(2)}s`,
                } as React.CSSProperties
              }
            />
          ))}
          {PULSES.map((f, i) => (
            <path
              key={`pulse-${f.d}`}
              className="pulse"
              d={f.d}
              pathLength={1}
              style={{ "--delay": `${3 + i * 1.7}s` } as React.CSSProperties}
            />
          ))}
        </g>
      </g>
      <g transform="translate(-100 -100) scale(0.390625)">
        <MarkShapes />
      </g>
    </svg>
  );
}

export function Hero({ communityHref }: { communityHref: string }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <h1 id="hero-title">Proof of contribution for token communities.</h1>
          <p className="hero-who">
            For coin communities that want to pay the people doing their work, from a community
            vault, by published rules anyone can check.
          </p>
          <div className="actions">
            <ButtonLink href={communityHref}>Open the MYCEL community</ButtonLink>
            <ButtonLink href="/claim" secondary>
              Claim a payout
            </ButtonLink>
          </div>
          <p className="hero-note">
            Built solo for Colosseum's Crypto World's Fair.{" "}
            <a href={LICENSE} rel="noopener noreferrer">
              MIT licensed
            </a>
            .
          </p>
        </div>
        <div className="hero-art">
          <Filaments />
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "Do the work",
    text: "A member replies to or quotes the community's post on X, then sends the link to the Telegram bot.",
  },
  {
    title: "Graded in public",
    text: "An AI grades it against the community's published rubric and posts its reasoning back. The credit rules run in code, after the model answers.",
  },
  {
    title: "Committed to Solana",
    text: "When the week closes, every member's payout goes into one merkle root, published on-chain with the hash of the full audit record.",
  },
  {
    title: "Claimed by the member",
    text: "Each member claims their share from the community's vault with a merkle proof, signed by their own wallet, once.",
  },
];

export function HowItWorks() {
  return (
    <Section
      id="how"
      title="How it works"
      lead="Four steps, from a reply on X to a payout anyone can verify."
    >
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="step-node" aria-hidden="true">
              {i + 1}
            </span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
      <p className="muted small">
        The rubrics are public and versioned:{" "}
        <a href={RUBRICS} rel="noopener noreferrer">
          read them on GitHub
        </a>
        .
      </p>
    </Section>
  );
}

// Run 7 of the devnet proof (docs/handoffs/2026-09-27-devnet-proof.md): Hyphae's admin key on a
// Ledger signs the community, the deposit and the publication; a member claims, then is refused.
export const DEVNET_RUN = [
  {
    what: "A community and its vault are created, signed by Hyphae's admin key on a Ledger.",
    signature:
      "2xkfBYCqiJhQupUL6gB7P9m6DkpgomVkysYMw5bRVveAZvBDmSwzZ7C3kfSVDpaY5PFoN7mcwXbQ8KPHhStvsENo",
  },
  {
    what: "The vault is funded with 0.05 SOL.",
    signature:
      "2Af95ffYBU6fE11G7hJryYeASkD85HsZ1ikfbbHu1srBp72hWHSzaJRAiqZuRVj65EFxoYJQgRu6Z3dKb8agaoof",
  },
  {
    what: "The epoch is published as one merkle root: 0.030460365 SOL allocated to 3 members, and the 3% fee.",
    signature:
      "3oJ4T6NeYonVRgi1JBfofsRHEkd5RfuTKaEhUc7AHqFL8Pio2r2s6o4n7YtLm7zMPpLCw38mDa1efEzBBpAgy6DD",
  },
  {
    what: "A member claims 0.012125 SOL with a merkle proof.",
    signature:
      "5ccGT1yLxySoRKjUZftCooXmbxk35WrJ71XFVuH8rfXxaKNiufPkzgLRdAbywRoLjoTL4DvFv3daYTgGyp8a3SmK",
  },
  {
    what: "The same claim, sent again, is refused on-chain.",
    signature:
      "5ob9A3Sg7DYoxCAMLDyX5EpuT2jSF6QBsruPRLf4tdTdTCSkfZCdXSkMuWLuqkFEPQC3eQJVGgzosxdLQbA2EknP",
  },
] as const;

function Payout({ closed }: { closed: LooseEpochV1 | "unavailable" | null }) {
  if (closed === null) return <p className="banner">No epoch has closed yet.</p>;
  if (closed === "unavailable") {
    return (
      <p className="notice">The newest closed epoch can't be read right now. Nothing is guessed.</p>
    );
  }
  if (closed.status === "closing") {
    return (
      <p className="banner">
        Epoch {closed.index} closed at {utc(closed.closes_at)}. Final numbers appear when the
        snapshot is written (within minutes).
      </p>
    );
  }
  const a = settlementOf(closed).allocation;
  if (a.status !== "published") {
    return (
      <p className="banner">
        Epoch {closed.index}: {unavailableSentence(a.reason)}
      </p>
    );
  }
  return (
    <p className="banner">
      Epoch {closed.index} was published on {networkName(a.network)}: {sol(a.allocated_lamports)}{" "}
      allocated to {a.payable_members} members, in{" "}
      <EvidenceLink
        href={explorerTx(a.publish_tx, a.network)}
        value={a.publish_tx}
        shown={shortWallet(a.publish_tx)}
      />
      .
    </p>
  );
}

// While the page streams, the proof section says it is reading, rather than showing nothing.
type ProofState = LiveProof | { state: "loading" };

function Live({ live }: { live: ProofState }) {
  if (live.state === "loading") {
    return (
      <p className="loading" role="status">
        Reading the live numbers…
      </p>
    );
  }
  if (live.state === "unconfigured") {
    return <p className="notice">No community is configured for this site.</p>;
  }
  if (live.state === "unavailable") {
    return (
      <p className="notice">
        The read API can't be reached right now, so no live number is shown rather than a guess.
      </p>
    );
  }
  const { community, epoch } = live;
  return (
    <>
      <h3>{community.name}</h3>
      <p className="muted small">From the public read API. Data as of {utc(community.as_of)}.</p>
      {epoch === null && <p className="empty">No reward epoch yet.</p>}
      {epoch === "unavailable" && (
        <p className="notice">This epoch can't be read right now. Nothing is guessed.</p>
      )}
      {epoch !== null && epoch !== "unavailable" && (
        <Stats>
          <Stat
            label="Epoch"
            value={epoch.index}
            note={
              epoch.closed
                ? `Closed ${utc(epoch.closes_at)}`
                : `${epoch.status === "scheduled" ? "Opens" : "Open until"} ${utc(
                    epoch.status === "scheduled" ? epoch.opens_at : epoch.closes_at,
                  )}`
            }
          />
          <Stat
            label="Contributions"
            value={epoch.counts.contributions}
            note={`${epoch.counts.counted} counted`}
          />
          <Stat label="Members" value={epoch.counts.members} note="with work in this epoch" />
          <Stat label="Rubric" value={epoch.config.rubric_version} note="public and versioned" />
        </Stats>
      )}
      <Payout closed={live.closed} />
      {epoch !== null && epoch !== "unavailable" && (
        <div className="actions">
          <ButtonLink href={`/c/${community.mint}/e/${epoch.index}`} secondary>
            Open epoch {epoch.index}'s audit
          </ButtonLink>
        </div>
      )}
    </>
  );
}

export function Proof({ live }: { live: ProofState }) {
  return (
    <Section
      id="proof"
      title="Proof you can check"
      lead="Numbers read from Hyphae's public API as this page loads, and every transaction of a full run on Solana devnet."
    >
      <div className="proof-grid">
        <div className="proof-live">
          <Live live={live} />
        </div>
        <div className="proof-chain">
          <h3>A full run on Solana devnet</h3>
          <ol className="timeline">
            {DEVNET_RUN.map((step) => (
              <li key={step.signature}>
                <p>{step.what}</p>
                <EvidenceLink
                  href={explorerTx(step.signature, "solana:devnet")}
                  value={step.signature}
                  shown={shortWallet(step.signature)}
                  network="devnet"
                />
              </li>
            ))}
          </ol>
          <p className="muted small">
            These transactions are on devnet.{" "}
            <a href={README_STATUS} rel="noopener noreferrer">
              The README's status
            </a>{" "}
            says what is deployed where;{" "}
            <a href={doc("docs/handoffs/2026-09-27-devnet-proof.md")} rel="noopener noreferrer">
              the full record
            </a>{" "}
            has every account and signature.
          </p>
        </div>
      </div>
    </Section>
  );
}

// `solana-verify get-program-hash` of the devnet program, reproduced by two clean builds
// (docs/handoffs/2026-09-28-verifiable-build-and-deploy-rehearsal.md).
export const VERIFIED_HASH = "7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac";

export function Trust() {
  return (
    <Section
      id="trust"
      title="What you trust, in writing"
      lead="The code, who holds each key, and the custody rules are all public."
    >
      <div className="trust-grid">
        <article>
          <h3>The program is its source</h3>
          <p>
            The program on devnet is byte for byte what this repository builds in Anchor's pinned
            Docker image.
          </p>
          <p className="muted small">solana-verify hash</p>
          <EvidenceLink
            href={doc("docs/handoffs/2026-09-28-verifiable-build-and-deploy-rehearsal.md")}
            value={VERIFIED_HASH}
            shown={`${VERIFIED_HASH.slice(0, 8)}…${VERIFIED_HASH.slice(-4)}`}
          />
        </article>
        <article className="trust-policy">
          <h3>Keys on a hardware wallet</h3>
          <blockquote>{CUSTODY_POLICY}</blockquote>
          <p className="muted small">
            <a href={CUSTODY_POLICY_URL} rel="noopener noreferrer">
              Custody during the pilot
            </a>
            , in the README.
          </p>
        </article>
        <article>
          <h3>Only a signed wallet is paid</h3>
          <p>
            To be paid, a member proves their wallet by signing a message. Pasting an address isn't
            enough. A closed week always pays the wallet that was verified at its close.
          </p>
        </article>
        <article>
          <h3>Open source, MIT</h3>
          <p>
            Every line is{" "}
            <a href={GITHUB} rel="noopener noreferrer">
              on GitHub
            </a>
            , and{" "}
            <a href={BUILDLOG} rel="noopener noreferrer">
              the build log
            </a>{" "}
            records every session.
          </p>
        </article>
      </div>
    </Section>
  );
}

// The README's "Integrate in 10 lines", word for word (landing.test.tsx holds them together). It
// lives in a text file because it is code on display, not code this app runs.
export const INTEGRATION = readFileSync(
  join(process.cwd(), "content/integration.txt"),
  "utf8",
).trimEnd();

export function Integrate() {
  return (
    <Section
      id="integrate"
      title="For communities and integrators"
      lead="Everything on this site is in a public API, and any project can fund a community's vault."
    >
      <div className="integrate-grid">
        <div>
          <h3>Read everything</h3>
          <p>
            Public, read-only JSON: communities, weeks, every score with its reasons, and every
            claim with its proof. A section the API cannot confirm is marked unavailable, never a
            zero. The production API does not serve this example's wallet-claims route yet; the
            README says how to run the whole API locally meanwhile.
          </p>
          <h3>Fund a vault</h3>
          <p>
            A vault's address comes from the coin and its admin, so any project can find it and fund
            it with an ordinary SOL transfer. SOL leaves the vault only through the program: the 3%
            fee, and one claim per leaf of a published root. The program is on devnet only. Check
            its address on the network you use before sending anything.
          </p>
          <div className="actions">
            <ButtonLink href={API_DOCS} secondary>
              Read the API docs
            </ButtonLink>
          </div>
        </div>
        <figure className="integrate-code">
          <figcaption>
            Check every proof yourself: rebuild the leaf, then hash up to the root. It is the same
            computation the program runs before it pays.
          </figcaption>
          <pre className="code">
            <code>{INTEGRATION}</code>
          </pre>
        </figure>
      </div>
    </Section>
  );
}
