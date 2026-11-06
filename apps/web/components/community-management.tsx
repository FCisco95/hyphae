import type { CommunityV1 } from "@hyphae/core";
import type { ReactNode } from "react";
import { communityIntake } from "../lib/community-intake.js";
import { utc } from "../lib/format.js";
import { FundPanel } from "./fund.js";
import { Panel, Stat, Stats } from "./ui.js";

export function CommunityManagement({
  community,
  children,
}: {
  community: CommunityV1;
  children?: ReactNode;
}) {
  const base = `/c/${encodeURIComponent(community.mint)}`;
  const intake = communityIntake(community);
  return (
    <>
      <nav className="community-nav" aria-label="Community">
        <a href={base}>Overview</a>
        <a href={`${base}/about`}>Project context</a>
        <a href={`${base}/join`}>Get started</a>
        <a href={`${base}/me`}>Your account</a>
        <a href={`${base}/manage`} aria-current="page">
          Manage
        </a>
      </nav>
      <header className="management-heading">
        <p className="muted">{community.name}</p>
        <h1>Manage community</h1>
        <p>Review new submissions, the current epoch and the community vault.</p>
      </header>
      <Panel title="New submissions">
        <p className="management-status">
          {intake.state === "paused"
            ? "New submissions are paused."
            : intake.accepting
              ? "New submissions are open."
              : "No epoch is accepting new submissions."}
        </p>
        <Stats compact>
          <Stat label="Community mint" value={<span className="mono">{community.mint}</span>} />
          <Stat
            label="Current epoch"
            value={
              intake.epoch ? (
                <a href={`${base}/e/${intake.epoch.index}`}>Epoch {intake.epoch.index}</a>
              ) : (
                "No open epoch"
              )
            }
          />
          {intake.epoch ? (
            <Stat
              label={intake.expired ? "Closed" : "Closes"}
              value={utc(intake.epoch.closes_at)}
            />
          ) : null}
        </Stats>
        <p className="small muted">
          Public snapshot as of {utc(community.as_of)}. Intake controls new submissions; it does not
          indicate whether payouts are enabled.
        </p>
      </Panel>
      <section className="management-treasury" aria-labelledby="management-treasury-title">
        <h2 id="management-treasury-title">Treasury</h2>
        <p>Vault balance and amounts owed to published epochs are separate readings from Solana.</p>
        {community.vault ? (
          <FundPanel vault={community.vault} />
        ) : (
          <Panel title="Fund this community">
            <p className="banner">
              Vault details are unavailable. Do not send SOL until the vault can be confirmed.
            </p>
          </Panel>
        )}
      </section>
      {children ?? (
        <Panel title="Administrator controls">
          <p>
            Administrator controls are not available here right now. The public overview remains
            available.
          </p>
        </Panel>
      )}
    </>
  );
}
