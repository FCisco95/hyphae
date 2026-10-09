import type { CommunityV1, PublicRaid, PublicRaids } from "@hyphae/core";
import type { Result } from "../lib/api.js";
import { communityIntake } from "../lib/community-intake.js";
import { utc } from "../lib/format.js";
import { ButtonLink } from "./ui.js";

function RaidCard({
  raid,
  accepting,
  base,
}: {
  raid: PublicRaid;
  accepting: boolean;
  base: string;
}) {
  const active = raid.status === "open";
  return (
    <article className="raid-card">
      <div className="raid-card-heading">
        <h3 className="raid-title">
          {raid.post?.handle
            ? `Post by @${raid.post.handle}`
            : raid.post
              ? "X post"
              : "Community raid"}
        </h3>
        <span className={`raid-status raid-status-${raid.status}`}>
          {raid.status === "open"
            ? "Open"
            : raid.status === "scheduled"
              ? "Scheduled"
              : raid.status === "cancelled"
                ? "Cancelled"
                : "Closed"}
        </span>
      </div>
      <p className="raid-deadline">
        {active || raid.status === "scheduled" ? "Closes" : "Scheduled deadline"}{" "}
        <time dateTime={raid.closes_at}>{utc(raid.closes_at)}</time>
      </p>
      {raid.status === "scheduled" ? (
        <p className="small muted">
          Opens <time dateTime={raid.opens_at}>{utc(raid.opens_at)}</time>.
        </p>
      ) : null}
      {raid.post ? (
        <div className="raid-post">
          <span className="raid-post-source">X post</span>
          {raid.post.text ? (
            <blockquote>{raid.post.text}</blockquote>
          ) : (
            <p>Open the original post to read it on X.</p>
          )}
          <a href={raid.post.url} target="_blank" rel="noopener noreferrer">
            Open original post
          </a>
          {raid.post.text ? (
            <p className="small muted">Recorded post text; the original may have changed.</p>
          ) : null}
        </div>
      ) : (
        <p className="muted">
          {raid.status === "scheduled"
            ? "Post details appear when this raid opens."
            : raid.status === "cancelled"
              ? "Post details are hidden for cancelled raids."
              : "The original post link is unavailable."}
        </p>
      )}
      {raid.brief ? (
        <p className="raid-brief">
          <strong>Brief:</strong> {raid.brief}
        </p>
      ) : null}
      {active && accepting ? (
        <a className="raid-participate" href={`${base}/join#submit`}>
          How to submit your work
        </a>
      ) : null}
    </article>
  );
}

export function RaidsView({
  community,
  result,
  loginEnabled = false,
}: {
  community: CommunityV1;
  result: Result<PublicRaids>;
  loginEnabled?: boolean;
}) {
  const base = `/c/${encodeURIComponent(community.mint)}`;
  const {
    epoch,
    feed: data,
    expired: epochExpired,
    accepting,
    state,
  } = communityIntake(community, result);
  const active =
    data?.raids.filter((raid) => raid.status === "open" || raid.status === "scheduled") ?? [];
  const recent =
    data?.raids.filter((raid) => raid.status === "closed" || raid.status === "cancelled") ?? [];
  return (
    <section id="raids" className="community-live" aria-labelledby="live-raids-title">
      <div className="community-workspace">
        <div className="raid-feed">
          <div className="community-section-head raid-feed-heading">
            <h2 id="live-raids-title">Live raids</h2>
            <p className="muted">Find a post, read the brief and add your own contribution.</p>
          </div>
          {!data ? (
            <div className="raid-empty">
              <h3 className="raid-empty-title">Raids are unavailable right now</h3>
              <p>
                We could not read the raid feed. Reload to try again; this does not mean there are
                no raids.
              </p>
            </div>
          ) : active.length ? (
            <div className="raid-list">
              {active.map((raid) => (
                <RaidCard key={raid.id} raid={raid} accepting={accepting} base={base} />
              ))}
            </div>
          ) : (
            <div className="raid-empty">
              <h3 className="raid-empty-title">No open raids right now</h3>
              <p>
                Check back for the next brief. You can read the project context and prepare your
                account meanwhile.
              </p>
            </div>
          )}
          {data ? (
            <p className="small muted">
              Raid data as of {utc(data.as_of)}. Updates every 30 seconds while this page is
              visible.
            </p>
          ) : null}
          {recent.length ? (
            <details className="raid-recent">
              <summary>Recently closed raids ({recent.length})</summary>
              <div className="raid-list">
                {recent.map((raid) => (
                  <RaidCard key={raid.id} raid={raid} accepting={false} base={base} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
        <aside className="community-account-entry" aria-labelledby="account-entry-title">
          <h2 id="account-entry-title">Your community account</h2>
          <p>
            {loginEnabled
              ? "Sign in with email or your existing Solana wallet through Privy."
              : "Email and Solana wallet sign-in (via Privy) is not available yet."}
          </p>
          <ButtonLink href={`${base}/me`} secondary={!loginEnabled}>
            Open your account
          </ButtonLink>
          <p className="small muted">
            No wallet is created for you. Sign-in availability is shown on the account page.
          </p>
          <div className="raid-intake-note">
            <h3 className="raid-note-title">Before you contribute</h3>
            {epochExpired && epoch ? (
              <p>
                Reward intake for epoch {epoch.index} closed at{" "}
                <time dateTime={epoch.closes_at}>{utc(epoch.closes_at)}</time>. Check the next epoch
                before submitting reward work.
              </p>
            ) : state === "paused" ? (
              <p>Reward intake is paused. Read the briefs and check back before submitting.</p>
            ) : state === "unconfirmed" ? (
              <p>Reward intake cannot be confirmed right now. Check back before submitting.</p>
            ) : epoch ? (
              <p>
                Reward intake closes <time dateTime={epoch.closes_at}>{utc(epoch.closes_at)}</time>.
                A raid can run longer than the epoch; its deadline does not extend reward intake.
              </p>
            ) : (
              <p>No reward epoch is open. Check the next epoch before submitting reward work.</p>
            )}
            <a href={`${base}/join`}>Read the setup guide</a>
          </div>
        </aside>
      </div>
    </section>
  );
}
