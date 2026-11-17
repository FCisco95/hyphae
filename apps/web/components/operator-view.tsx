import type { OperatorEpoch, OperatorOverview, OperatorSession } from "@hyphae/admin-client/source";
import type { ReactNode } from "react";
import { explorerAddress, sol, utc } from "../lib/format.js";
import { OperatorPayable, OperatorSignIn, OperatorSignOut } from "./operator-client.js";
import { Panel, Stat, Stats } from "./ui.js";

// The operator page: one read-only page per community, phone first. Nothing on it signs,
// publishes or sends; the payout itself stays the Ledger `publish-epoch run` command.

const BLOCKERS: Record<string, string> = {
  legacy_epoch: "legacy epoch (before payouts)",
  already_published: "already published",
  not_final: "scores not final yet",
  before_first_paid_epoch: "before the first paid epoch",
  no_rules_test_defined: "no rules test for this community",
  snapshot_mismatch: "snapshot changed",
  duplicate_wallet: "two members share a wallet",
  hold_checks_pending: "token hold checks pending",
  no_payable_members: "nobody payable",
};
const DECISIONS: Record<string, string> = {
  distribution_planned: "planned, waiting for the Ledger",
  rolled_over: "rolled over (below threshold)",
  distributed: "paid in a later distribution",
  other: "decided",
};

export function OperatorShell({
  name,
  mint,
  children,
}: {
  name: string;
  mint: string;
  children: ReactNode;
}) {
  return (
    <div className="operator">
      <nav className="community-nav" aria-label="Community">
        <a href={`/c/${encodeURIComponent(mint)}`}>Overview</a>
        <a href={`/c/${encodeURIComponent(mint)}/manage`}>Manage</a>
        <a href={`/c/${encodeURIComponent(mint)}/operator`} aria-current="page">
          Operator
        </a>
      </nav>
      <header className="management-heading">
        <p className="muted">{name}</p>
        <h1>Operator</h1>
        <p>Payout gate, top-up, raids and job health. Read-only.</p>
      </header>
      {children}
    </div>
  );
}

export function OperatorNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title}>
      <div className="operator-notice">{children}</div>
    </Panel>
  );
}

export const OperatorDisabled = () => (
  <OperatorNotice title="Turned off">
    <p>The operator page is turned off. Nothing here is available until the API enables it.</p>
  </OperatorNotice>
);
export const OperatorUnavailable = () => (
  <OperatorNotice title="Unavailable">
    <p>The operator page is unavailable right now. Try again in a minute.</p>
  </OperatorNotice>
);

export function OperatorSignedOut({ mint, expired }: { mint: string; expired?: boolean }) {
  return (
    <OperatorNotice title="Sign in">
      <p>
        {expired ? "Your session ended. " : ""}Sign in with the community's on-chain admin wallet.
        Only that wallet is accepted.
      </p>
      <OperatorSignIn mint={mint} />
    </OperatorNotice>
  );
}

export function OperatorForbidden() {
  return (
    <OperatorNotice title="Not the admin">
      <p>This wallet is not the community's on-chain admin, or the admin changed.</p>
      <OperatorSignOut />
    </OperatorNotice>
  );
}

function gateLine(e: OperatorEpoch): string {
  if (e.published) return "Published";
  if (e.gate.status === "not_evaluated") return e.status === "open" ? "Open" : "Not judged";
  if (e.gate.status === "ready") return "Ready";
  return `Blocked: ${e.gate.blockers.map((b) => BLOCKERS[b] ?? b.replaceAll("_", " ")).join(", ")}`;
}

function TopUp({ top }: { top: OperatorOverview["top_up"] }) {
  if (top.status === "ok") {
    if (top.outcome === "planned")
      return (
        <p>
          Epoch {top.epoch_index} is planned. Publish it with the Ledger:{" "}
          <code className="mono">publish-epoch run</code>.
        </p>
      );
    return (
      <p>
        Epoch {top.epoch_index} rolled over.{" "}
        {top.lamports === null
          ? "Top-up unknown: the payout policy sets no reward share."
          : top.lamports === "0"
            ? "No top-up needed: the vault already meets the threshold."
            : `Top-up needed: ${sol(top.lamports)} (${top.lamports} lamports) to the vault.`}
      </p>
    );
  }
  const text: Record<typeof top.status, string> = {
    none: "No decided epoch is waiting: nothing to top up.",
    held: "Payouts for this community are on hold, so no top-up is computed.",
    no_policy: "This community has no payout policy, so the settle loop does not run.",
    not_bound: "The community is not bound to an on-chain account.",
    chain_unavailable: "The chain could not be read. Try again in a minute.",
  };
  return <p>{text[top.status]}</p>;
}

export function OperatorView({
  overview,
  session,
}: {
  overview: OperatorOverview;
  session: OperatorSession;
}) {
  const { community } = overview;
  return (
    <>
      <div className="operator-session">
        <p className="small">
          Signed in as <span className="mono operator-wallet">{session.wallet}</span>, until{" "}
          {utc(session.expires_at)}.
        </p>
        <OperatorSignOut />
      </div>
      {overview.hold.held ? (
        <p className="operator-banner" role="status">
          Payouts are on hold for this community. Nothing is planned, messaged or published while
          the hold lasts.
        </p>
      ) : null}
      <div className="operator-grid">
        <Panel title="Top-up">
          <TopUp top={overview.top_up} />
          <Stats compact>
            <Stat label="Payout policy" value={overview.policy.present ? "Set" : "None"} />
            <Stat
              label="Community account"
              value={
                <a
                  href={explorerAddress(community.chain_address, community.network)}
                  className="mono"
                >
                  {community.chain_address.slice(0, 4)}…{community.chain_address.slice(-4)}
                </a>
              }
            />
          </Stats>
        </Panel>
        <Panel title="Job health">
          {overview.jobs.status === "unavailable" ? (
            <p>Job health is unavailable right now. That is not the same as zero failures.</p>
          ) : overview.jobs.groups.length === 0 ? (
            <p>No queued jobs for this community.</p>
          ) : (
            <table className="operator-table">
              <thead>
                <tr>
                  <th scope="col">Queue</th>
                  <th scope="col">State</th>
                  <th scope="col">Jobs</th>
                </tr>
              </thead>
              <tbody>
                {overview.jobs.groups.map((g) => (
                  <tr
                    key={`${g.name}:${g.state}`}
                    className={g.state === "failed" ? "is-failed" : ""}
                  >
                    <td>{g.name}</td>
                    <td>{g.state}</td>
                    <td>{g.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
      <Panel title="Payout gate per epoch">
        {overview.epochs.length === 0 ? (
          <p>No epochs yet.</p>
        ) : (
          <ul className="operator-epochs">
            {overview.epochs.map((e) => (
              <li key={e.index}>
                <div className="operator-epoch-head">
                  <strong>Epoch {e.index}</strong>
                  <span
                    className={`operator-gate gate-${e.published ? "published" : e.gate.status}`}
                  >
                    {gateLine(e)}
                  </span>
                </div>
                <p className="small muted">
                  {e.status === "open" ? "Closes" : "Closed"} {utc(e.closes_at)}
                  {e.decision ? ` · ${DECISIONS[e.decision]}` : ""}
                </p>
                {e.gate.status === "not_evaluated" ? null : (
                  <>
                    <p className="small">
                      {e.gate.payable} payable · {e.gate.held} held · {e.gate.not_payable} not
                      payable
                    </p>
                    <OperatorPayable mint={community.mint} index={e.index} />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Raids">
        <Stats compact>
          {overview.raids.by_state.length === 0 ? (
            <Stat label="Raids" value="None yet" />
          ) : (
            overview.raids.by_state.map((r) => (
              <Stat key={r.state} label={r.state} value={r.count} />
            ))
          )}
          {overview.raids.deliveries.map((d) => (
            <Stat key={d.status} label={`Alerts ${d.status}`} value={d.count} />
          ))}
        </Stats>
        {overview.raids.active.length > 0 ? (
          <ul className="operator-raids">
            {overview.raids.active.map((r) => (
              <li key={r.id}>
                {r.target_url ? (
                  <a href={r.target_url} rel="noreferrer noopener" target="_blank">
                    Active raid
                  </a>
                ) : (
                  "Active raid"
                )}{" "}
                <span className="small muted">closes {utc(r.closes_at)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
      <p className="small muted">As of {utc(overview.as_of)}.</p>
    </>
  );
}
