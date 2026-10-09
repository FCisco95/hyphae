import type { CommunityV1, PublicRaids } from "@hyphae/core";
import type { Result } from "../lib/api.js";
import { communityIntake } from "../lib/community-intake.js";
import type { CommunityPresentation } from "../lib/community-presentation.js";
import { utc } from "../lib/format.js";
import { BOT, RUBRICS } from "../lib/links.js";
import { RaidsView } from "./raids.js";
import { ButtonLink, Panel, StatusPill } from "./ui.js";

type CommunityProps = {
  community: CommunityV1;
  presentation?: CommunityPresentation;
  raids?: Result<PublicRaids>;
  loginEnabled?: boolean;
};

function CommunityIntro({
  community,
  presentation,
  page,
  raids,
}: CommunityProps & { page: "overview" | "about" | "join" }) {
  const base = `/c/${encodeURIComponent(community.mint)}`;
  const intake = communityIntake(community, raids);
  const current = intake.epoch;
  const tabs = [
    { key: "overview", label: "Overview", href: base },
    { key: "raids", label: "Live raids", href: `${base}#raids` },
    { key: "about", label: "Project context", href: `${base}/about` },
    { key: "join", label: "Get started", href: `${base}/join` },
    { key: "me", label: "Your account", href: `${base}/me` },
  ];
  return (
    <>
      <nav className="community-nav" aria-label="Community">
        {tabs.map((tab) => (
          <a key={tab.key} href={tab.href} aria-current={page === tab.key ? "page" : undefined}>
            {tab.label}
          </a>
        ))}
        <a href={current ? `${base}/e/${current.index}` : `${base}#epochs`}>Contribution audit</a>
      </nav>
      <header className="community-head">
        <div>
          <p className="eyebrow">{page === "overview" ? "Community workspace" : community.name}</p>
          <div className="community-identity">
            <h1>
              {page === "overview"
                ? community.name
                : page === "about"
                  ? "Understand the project."
                  : "Start contributing."}
            </h1>
            {presentation?.pilot ? <StatusPill tone="open">Pilot</StatusPill> : null}
          </div>
          <p className="community-lead">
            {page === "overview"
              ? "Do useful work. Understand the rules. Follow the evidence."
              : page === "about"
                ? "How this community uses Hyphae to record and review contributions."
                : "Your route from joining the community to submitting your first piece of work."}
          </p>
          <p className="muted small">Powered by Hyphae</p>
        </div>
        <aside className="community-round" aria-label="Current reward epoch">
          <p className="eyebrow">Right now</p>
          <h2>
            {current
              ? intake.expired
                ? `Epoch ${current.index} reward intake has closed.`
                : intake.state === "unconfirmed"
                  ? `Epoch ${current.index}`
                  : `Epoch ${current.index} is open.`
              : "No open epoch"}
          </h2>
          <p>
            {intake.state === "unconfirmed"
              ? "Reward intake cannot be confirmed right now."
              : `Reward intake is ${intake.state === "closed" ? "closed" : intake.state === "paused" ? "paused" : community.reward_intake}.`}
          </p>
          {current ? (
            <p className="small muted">
              {intake.expired ? "Closed" : "Closes"} {utc(current.closes_at)}.
            </p>
          ) : null}
          {current ? (
            <a href={`${base}/e/${current.index}`}>Read this epoch&apos;s rules and audit →</a>
          ) : (
            <p className="small muted">
              No epoch is open right now. <a href={`${base}#epochs`}>Check the epoch history.</a>
            </p>
          )}
          <p className="small muted">Data as of {utc(intake.asOf)}.</p>
        </aside>
      </header>
    </>
  );
}

export function CommunityOverview({
  community,
  presentation,
  raids,
  loginEnabled,
}: CommunityProps) {
  const base = `/c/${encodeURIComponent(community.mint)}`;
  const result = raids ?? { ok: false as const, reason: "unavailable" as const };
  const { epoch: current, accepting, state } = communityIntake(community, result);
  return (
    <>
      <CommunityIntro
        community={community}
        presentation={presentation}
        page="overview"
        raids={result}
      />
      <RaidsView community={community} result={result} loginEnabled={loginEnabled} />
      <section className="community-path" aria-labelledby="community-path-title">
        <div className="community-section-head">
          <p className="eyebrow">Your next step</p>
          <h2 id="community-path-title">A clear place to begin.</h2>
        </div>
        <ol className="community-path-cards">
          <li>
            <span className="path-number" aria-hidden="true">
              01
            </span>
            <h3>Understand the project</h3>
            <p>See how work is reviewed, what becomes public and what a score actually means.</p>
            <a href={`${base}/about`}>Read the context →</a>
          </li>
          <li>
            <span className="path-number" aria-hidden="true">
              02
            </span>
            <h3>Set yourself up</h3>
            <p>Find the registered group, link your own wallet and take the pinned rules test.</p>
            <a href={`${base}/join`}>Follow the join guide →</a>
          </li>
          <li>
            <span className="path-number" aria-hidden="true">
              03
            </span>
            <h3>Follow the work</h3>
            <p>Read contributions, scoring reasons and corrections in the public epoch audit.</p>
            <a href={current ? `${base}/e/${current.index}` : "#epochs"}>Browse the audit →</a>
          </li>
        </ol>
      </section>
      <section className="community-next" aria-labelledby="community-next-title">
        <div>
          <p className="eyebrow">Participate</p>
          <h2 id="community-next-title">
            {accepting
              ? "Ready to contribute?"
              : state === "paused"
                ? "Reward intake is paused."
                : state === "unconfirmed"
                  ? "Live raid status is unavailable right now."
                  : "Prepare for the next epoch."}
          </h2>
          <p>
            {accepting
              ? "Read the raids above, then use the registered group's submission flow to send your own work."
              : "You can read the rules and set up your wallet. Check that reward intake is open before submitting new work."}
          </p>
        </div>
        <ButtonLink href={accepting ? "#raids" : `${base}/join`}>
          {accepting ? "Find a raid" : "Get ready"}
        </ButtonLink>
      </section>
    </>
  );
}

export function AboutView({ community, presentation }: CommunityProps) {
  const base = `/c/${encodeURIComponent(community.mint)}`;
  const { epoch: current } = communityIntake(community);
  return (
    <>
      <CommunityIntro community={community} presentation={presentation} page="about" />
      <div className="community-context">
        <section aria-labelledby="context-purpose">
          <p className="eyebrow">The purpose</p>
          <h2 id="context-purpose">Work with a record behind it.</h2>
          <p>
            Hyphae records work done for a token community. Members submit their own work, an AI
            reviews it against the published rubric, and code applies the pinned credit rules. The
            audit lets you see the contribution, its score and the reasoning behind it.
          </p>
          <p>
            Each reward period is an epoch. Read its rules before participating: they determine what
            counts, when work closes and which conditions an eligible allocation needs.
          </p>
          <div className="actions">
            <ButtonLink href={`${base}/join`}>Get started</ButtonLink>
            <ButtonLink href={current ? `${base}/e/${current.index}` : `${base}#epochs`} secondary>
              Read the audit
            </ButtonLink>
          </div>
        </section>
        <aside className="context-note">
          <p className="eyebrow">Before you begin</p>
          <h2>A score is a record, not a promise.</h2>
          <p>
            Open-epoch points are provisional. A rules-test pass and a verified wallet are
            eligibility conditions; they do not guarantee payment.
          </p>
          <p>
            Allocation, publication and payment are separate states. Payment requires a confirmed
            claim receipt. Use the epoch audit to check the actual state.
          </p>
        </aside>
      </div>
      <section className="community-faq" aria-labelledby="context-questions">
        <div className="community-section-head">
          <p className="eyebrow">Know what you are joining</p>
          <h2 id="context-questions">Before your first submission.</h2>
        </div>
        <details>
          <summary>Where do I find work and take the quiz?</summary>
          <p>
            In the registered Telegram group, use <code>/help brief</code> for open raids and
            <code> /rules</code> for the pinned private test. Joining, the test and personal
            progress currently use the bot; this website shows their guide and the public audit.
          </p>
        </details>
        <details>
          <summary>Why do I need to link a wallet?</summary>
          <p>
            A signed message proves ownership of your wallet. Pasting an address is insufficient.
            Use the group&apos;s private <code>/link</code> flow; it moves no funds. A later claim
            requires a separate transaction.
          </p>
        </details>
        <details>
          <summary>What will other people see?</summary>
          <p>
            Your submitted work, evidence, scores and verified wallet may appear in the public
            audit. Do not submit private information or forward your wallet-link session. Read{" "}
            <a href="/security#privacy">the privacy details</a> before joining.
          </p>
        </details>
        <details>
          <summary>Where can I check the rules and the system?</summary>
          <p>
            Read the <a href={RUBRICS}>published rubrics</a>, the selected epoch&apos;s pinned
            configuration and <a href="/security">security and trust</a>. Reasons and correction
            history explain how raw quality becomes credited quality and points.
          </p>
        </details>
      </section>
    </>
  );
}

export function JoinView({ community, presentation }: CommunityProps) {
  const { epoch: current, accepting } = communityIntake(community);
  const base = `/c/${encodeURIComponent(community.mint)}`;
  return (
    <>
      <CommunityIntro community={community} presentation={presentation} page="join" />
      <div className="community-onboarding">
        <Panel title="Start here">
          <p>
            Use your own Telegram account and wallet. Your work, evidence and verified wallet may
            appear in the public audit.
          </p>
          <ol className="onboarding-steps">
            <li>
              <h3>Join the registered group</h3>
              {presentation?.telegramInvite ? (
                <ButtonLink href={presentation.telegramInvite} secondary>
                  Join community
                </ButtonLink>
              ) : (
                <p>Already a member? Begin there; otherwise ask its owner for an invite.</p>
              )}
              <p className="small muted">
                Joining the wider community does not register you for this group's rewards.
              </p>
            </li>
            <li>
              <h3>Verify your own wallet</h3>
              <p>
                Send <code>/link</code> in that group and follow its private bot link. The website
                cannot start this session for you. You can reply to raids and earn points before you
                link; a signature before the epoch closes is required for payment.
              </p>
              <p className="small muted">
                On a phone, use your wallet app's browser with the ORIGINAL bot URL, including its
                fragment. Never forward the link or send it to support.
              </p>
              <ButtonLink href={BOT} secondary>
                Open official bot
              </ButtonLink>
            </li>
            <li>
              <h3>Read this epoch's rules</h3>
              <p>
                Send <code>/rules</code> in the group to take its pinned private test. A pass is one
                eligibility condition, not a payment guarantee.
              </p>
              {current ? (
                <ButtonLink href={`${base}/e/${current.index}`} secondary>
                  Review pinned epoch
                </ButtonLink>
              ) : (
                <p className="small muted">
                  No reward epoch is open. Ask the owner which rules apply before participating.
                </p>
              )}
            </li>
            <li id="submit">
              <h3>Submit your own work</h3>
              {accepting ? (
                <p>
                  Use <code>/help brief</code> in the group to see the open raids. For a reply or
                  quote, use that raid&apos;s own Submit button; <code>/submit</code> is for
                  separate text work.
                </p>
              ) : (
                <p>
                  Reward submissions are not open right now. Read the pinned rules and check intake
                  before starting new reward work.
                </p>
              )}
              <p className="small muted">
                Use <code>/me</code> for your own wallet and progress. Open-epoch points are
                provisional.
              </p>
              {current ? (
                <ButtonLink href={`${base}/e/${current.index}`} secondary>
                  Open this week's contributions
                </ButtonLink>
              ) : null}
            </li>
          </ol>
          {presentation?.supportUrl ? (
            <div className="actions">
              <ButtonLink href={presentation.supportUrl} secondary>
                Contact community support
              </ButtonLink>
            </div>
          ) : (
            <p className="small muted">
              Need help? Ask the registered group's owner. Never share a seed phrase, signature or
              private wallet link.
            </p>
          )}
        </Panel>
        <Panel title="Understand your score">
          <p>
            Raw quality is the model's assessment; credited quality applies the pinned rules.
            Reasons and correction history explain the difference. Timing and accepted effort
            determine exact points, combined before whole-point rounding.
          </p>
          <p>
            <strong>Points do not promise payment.</strong> Eligibility also needs a wallet verified
            at close, the pinned rules pass and the existing holder, author/duplicate and safety
            gates.
          </p>
          <p>
            Allocation states what was assigned. Publication makes an eligible allocation claimable;
            paid requires a confirmed claim receipt. The epoch audit shows the actual state,
            including unavailable or no payout.
          </p>
          <p className="small muted">
            <code>/link</code> signs a free readable message and moves no funds; <code>/claim</code>{" "}
            later signs a transaction on the claim page. Check your own <code>/me</code> after
            linking.
          </p>
        </Panel>
      </div>
    </>
  );
}
