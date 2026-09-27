import type {
  CommunityV1,
  ContributionRowV1,
  ContributionsV1,
  ContributionV1,
  EpochV1,
  LeaderboardV1,
  LooseEpochV1,
  RevisionV1,
} from "@hyphae/core";
import { CUSTODY_POLICY_URL, CUSTODY_SUMMARY } from "@hyphae/core";
import {
  creditSentence,
  explorerTx,
  multiplier,
  networkName,
  STATE,
  shortId,
  shortWallet,
  sol,
  utc,
} from "../lib/format.js";
import { settlementOf } from "../lib/settlement.js";

// Pure views over parsed read-API responses. Pages fetch; these only render.

type Wallet = Pick<ContributionRowV1, "wallet" | "wallet_status">;

function WalletCell({ w }: { w: Wallet }) {
  if (w.wallet_status === "verified" && w.wallet) {
    return (
      <span className="mono" title={w.wallet}>
        {shortWallet(w.wallet)}
      </span>
    );
  }
  return (
    <span className="muted">{w.wallet_status === "unverified" ? "unverified" : "no wallet"}</span>
  );
}

function StatusBadge({ epoch }: { epoch: Pick<EpochV1, "status" | "final"> }) {
  const label = {
    scheduled: "Scheduled",
    open: "Open",
    closing: "Closing",
    closed: "Final",
  }[epoch.status];
  return <span className={`badge badge-${epoch.status}`}>{label}</span>;
}

// A cached page can outlive a failed refresh; the read time makes its age visible.
function AsOf({ at }: { at: string }) {
  return <p className="muted small">Data as of {utc(at)}.</p>;
}

export function UnavailableView() {
  return (
    <section className="notice">
      <p>
        The audit data can't be read right now. Nothing is shown rather than a guess. Reload the
        page in a minute.
      </p>
    </section>
  );
}

export function CommunityView({ community }: { community: CommunityV1 }) {
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Community</p>
        <h1>{community.name}</h1>
        <p className="muted">
          Reward intake is {community.reward_intake}.{" "}
          {community.current_epoch !== null
            ? `Epoch ${community.current_epoch} is open.`
            : "No epoch is open right now."}
        </p>
        <AsOf at={community.as_of} />
      </header>
      {community.epochs.length === 0 ? (
        <p className="empty">No reward epoch yet.</p>
      ) : (
        <table className="stack">
          <thead>
            <tr>
              <th>Epoch</th>
              <th>Opens</th>
              <th>Closes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {community.epochs.map((e) => (
              <tr key={e.index}>
                <td data-label="Epoch">
                  <a href={`/c/${community.mint}/e/${e.index}`}>Epoch {e.index}</a>
                </td>
                <td data-label="Opens">{utc(e.opens_at)}</td>
                <td data-label="Closes">{utc(e.closes_at)}</td>
                <td data-label="Status">
                  <StatusBadge epoch={{ status: e.status, final: e.status === "closed" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function EpochBanner({ epoch }: { epoch: Pick<EpochV1, "status" | "closes_at" | "opens_at"> }) {
  if (epoch.status === "open") {
    return <p className="banner">Provisional: this epoch is still open.</p>;
  }
  if (epoch.status === "closing") {
    return (
      <p className="banner">
        Closed at {utc(epoch.closes_at)}. Final numbers appear when the snapshot is written (within
        minutes).
      </p>
    );
  }
  if (epoch.status === "scheduled") {
    return <p className="banner">This epoch opens at {utc(epoch.opens_at)}.</p>;
  }
  return null;
}

// P14. Every number is the published one, confirmed against the chain by the API; anything the
// chain cannot confirm is a sentence, never a zero.
export function unavailableSentence(reason: string): string {
  switch (reason) {
    case "no_settlement":
      return "Not allocated. No payout exists for this epoch.";
    case "before_first_paid_epoch":
      return "Retained: this epoch is before the first paid epoch.";
    case "chain_mismatch":
      return "The on-chain record does not match the published audit, so nothing is shown until it is reconciled.";
    default:
      return "The allocation can't be confirmed on-chain right now. Nothing here is a zero.";
  }
}

export function Tx({ signature, network }: { signature: string; network: Network }) {
  return (
    <a className="mono" href={explorerTx(signature, network)} rel="noopener noreferrer">
      {shortWallet(signature)}
    </a>
  );
}

type Network = "solana:devnet" | "solana:mainnet";

function CustodyNote() {
  return (
    <p className="muted small">
      {CUSTODY_SUMMARY}{" "}
      <a href={CUSTODY_POLICY_URL} rel="noopener noreferrer">
        The full policy
      </a>
      .
    </p>
  );
}

function SettlementPanel({ epoch }: { epoch: LooseEpochV1 }) {
  const { allocation: a, payment: p } = settlementOf(epoch);
  if (a.status !== "published") {
    return (
      <section className="panel">
        <h2>Settlement</h2>
        <p>{unavailableSentence(a.reason)}</p>
        <CustodyNote />
      </section>
    );
  }
  const tx = <Tx signature={a.publish_tx} network={a.network} />;
  return (
    <section className="panel">
      <h2>Settlement</h2>
      <p className="muted">
        Published on {networkName(a.network)} at {utc(a.published_at)} in {tx}. Root{" "}
        <span className="mono">{a.root.slice(0, 12)}</span>, audit hash{" "}
        <span className="mono">{a.audit_hash.slice(0, 12)}</span>.
      </p>
      <dl className="facts">
        <div>
          <dt>Gross pot</dt>
          <dd>{sol(a.gross_lamports)}</dd>
        </div>
        <div>
          <dt>Fee</dt>
          <dd>
            {sol(a.fee_lamports)} ({Number(a.fee_bps) / 100}%) to{" "}
            <span className="mono" title={a.fee_recipient}>
              {shortWallet(a.fee_recipient)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Net pot</dt>
          <dd>{sol(a.net_lamports)}</dd>
        </div>
        <div>
          <dt>Allocated</dt>
          <dd>
            {sol(a.allocated_lamports)} to {a.payable_members} payable members
          </dd>
        </div>
        <div>
          <dt>Retained: cap remainder</dt>
          <dd>{sol(a.cap_remainder_lamports)}</dd>
        </div>
        <div>
          <dt>Retained: dust</dt>
          <dd>{sol(a.dust_lamports)}</dd>
        </div>
        {p.status === "available" && (
          <>
            <div>
              <dt>Claimed</dt>
              <dd>{sol(p.claimed_lamports)}</dd>
            </div>
            <div>
              <dt>Unclaimed</dt>
              <dd>{sol(p.unclaimed_lamports)}</dd>
            </div>
          </>
        )}
      </dl>
      {p.status === "available" ? (
        <table className="stack">
          <thead>
            <tr>
              <th>Member</th>
              <th>Wallet</th>
              <th>Allocated</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {p.claims.map((c) => (
              <tr key={c.member_id}>
                <td data-label="Member" className="mono">
                  {shortId(c.member_id)}
                </td>
                <td data-label="Wallet" className="mono" title={c.wallet}>
                  {shortWallet(c.wallet)}
                </td>
                <td data-label="Allocated" className="num">
                  {sol(c.amount_lamports)}
                </td>
                <td data-label="Status">
                  {c.claim_tx ? (
                    <>
                      Paid in <Tx signature={c.claim_tx} network={a.network} />
                    </>
                  ) : (
                    "Claimable"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Payments: {unavailableSentence(p.reason)}</p>
      )}
      <p>
        <a href={`/c/${epoch.community.mint}/e/${epoch.index}/claim`}>Claim with your wallet →</a>
      </p>
      <CustodyNote />
    </section>
  );
}

function Pager({
  base,
  list,
}: {
  base: string;
  list: Pick<ContributionsV1, "offset" | "limit" | "total_contributions">;
}) {
  const prev = list.offset > 0 ? Math.max(0, list.offset - list.limit) : null;
  const next =
    list.offset + list.limit < list.total_contributions ? list.offset + list.limit : null;
  if (prev === null && next === null) return null;
  return (
    <nav className="pager">
      {prev !== null && <a href={`${base}?offset=${prev}`}>← Previous</a>}
      <span className="muted">
        {list.offset + 1}–{Math.min(list.offset + list.limit, list.total_contributions)} of{" "}
        {list.total_contributions}
      </span>
      {next !== null && <a href={`${base}?offset=${next}`}>Next →</a>}
    </nav>
  );
}

export function EpochView({ epoch, list }: { epoch: LooseEpochV1; list: ContributionsV1 }) {
  const base = `/c/${epoch.community.mint}/e/${epoch.index}`;
  const c = epoch.counts;
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">
          <a href={`/c/${epoch.community.mint}`}>{epoch.community.name}</a>
        </p>
        <h1>
          Epoch {epoch.index} <StatusBadge epoch={epoch} />
        </h1>
        <p className="muted">
          {utc(epoch.opens_at)} → {utc(epoch.closes_at)}
        </p>
        <AsOf at={epoch.as_of} />
      </header>
      <EpochBanner epoch={epoch} />
      <dl className="facts">
        <div>
          <dt>Rubric</dt>
          <dd>{epoch.config.rubric_version}</dd>
        </div>
        <div>
          <dt>Effort multiplier</dt>
          <dd>{multiplier(epoch.config.effort_multiplier_bps)}</dd>
        </div>
        <div>
          <dt>Effort slots</dt>
          <dd>{epoch.config.slot_limit} per member</dd>
        </div>
        <div>
          <dt>Contributions</dt>
          <dd>
            {c.contributions} ({c.counted} counted
            {c.pending ? `, ${c.pending} not scored yet` : ""}
            {c.pending_at_close + c.pending_reconciliation + c.excluded
              ? `, ${c.pending_at_close + c.pending_reconciliation + c.excluded} not counted`
              : ""}
            )
          </dd>
        </div>
        <div>
          <dt>Exact points</dt>
          <dd>{epoch.totals.points}</dd>
        </div>
      </dl>
      <p>
        <a href={`/c/${epoch.community.mint}/e/${epoch.index}/leaderboard`}>Leaderboard →</a>
      </p>
      <SettlementPanel epoch={epoch} />
      <h2>Contributions</h2>
      {list.contributions.length === 0 ? (
        <p className="empty">No contributions in this epoch yet.</p>
      ) : (
        <table className="stack">
          <thead>
            <tr>
              <th>Work</th>
              <th>Member</th>
              <th>Wallet</th>
              <th>Score</th>
              <th>Points</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {list.contributions.map((r) => (
              <tr key={r.id}>
                <td data-label="Work">
                  <a href={`/contribution/${r.id}`}>{r.kind}</a>
                  {r.url && (
                    <>
                      {" "}
                      <a className="muted" href={r.url} rel="noopener noreferrer">
                        ↗
                      </a>
                    </>
                  )}
                </td>
                <td data-label="Member" className="mono">
                  {shortId(r.member_id)}
                </td>
                <td data-label="Wallet">
                  <WalletCell w={r} />
                </td>
                <td data-label="Score">{r.selected ? creditSentence(r.selected) : "—"}</td>
                <td data-label="Points" className="num">
                  {r.selected
                    ? `${r.selected.points} (${multiplier(r.selected.multiplier_bps)})`
                    : "—"}
                </td>
                <td data-label="State">{STATE[r.state]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager base={base} list={list} />
    </>
  );
}

export function LeaderboardView({ board }: { board: LeaderboardV1 }) {
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">
          <a href={`/c/${board.community.mint}/e/${board.epoch.index}`}>
            Epoch {board.epoch.index}
          </a>
        </p>
        <h1>Leaderboard</h1>
        <p className="muted">
          {board.total_entries} members, {board.total_contributions} contributions. Whole points are
          rounded once per member, after adding up exact points.
        </p>
        <AsOf at={board.as_of} />
      </header>
      {!board.final && (
        <p className="banner">
          {board.closed
            ? "Final numbers appear when the snapshot is written (within minutes)."
            : "Provisional: this epoch is still open."}
        </p>
      )}
      {board.entries.length === 0 ? (
        <p className="empty">No contributions in this epoch yet.</p>
      ) : (
        <table className="stack">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Member</th>
              <th>Wallet</th>
              <th>Exact points</th>
              <th>Whole points</th>
              <th>Counted</th>
            </tr>
          </thead>
          <tbody>
            {board.entries.map((e) => (
              <tr key={e.member_id}>
                <td data-label="Rank" className="num">
                  {e.rank}
                </td>
                <td data-label="Member" className="mono">
                  {shortId(e.member_id)}
                </td>
                <td data-label="Wallet">
                  <WalletCell w={e} />
                </td>
                <td data-label="Exact points" className="num">
                  {e.points}
                </td>
                <td data-label="Whole points" className="num">
                  {e.whole_points}
                </td>
                <td data-label="Counted" className="num">
                  {e.counted} of {e.contributions}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function Revision({ r }: { r: RevisionV1 }) {
  const status = {
    selected: "Selected",
    superseded: "Superseded",
    late: "Late (after the close; changes nothing)",
  }[r.status];
  return (
    <article className="revision">
      <h3>
        Revision {r.revision} <span className={`badge badge-${r.status}`}>{status}</span>
      </h3>
      <p>{creditSentence(r)}</p>
      <p className="muted">
        Accepted {utc(r.accepted_at)} · effort {r.effort.replace("_", " ")} · timing{" "}
        {r.timing_bps / 100}% · multiplier {multiplier(r.multiplier_bps)} · {r.points} exact points
      </p>
      {r.flags.length > 0 && <p>Flags: {r.flags.join(", ")}</p>}
      <p>{r.explanation}</p>
      {r.effort_criteria && (
        <ul className="criteria">
          {(
            [
              ["Original substance", r.effort_criteria.original_substance],
              ["Inspectable work", r.effort_criteria.inspectable_work],
              ["Community contribution", r.effort_criteria.community_contribution],
            ] as const
          ).map(([label, c]) => (
            <li key={label}>
              {c.met ? "✓" : "✗"} {label}: {c.note}
            </li>
          ))}
        </ul>
      )}
      {r.model && (
        <dl className="provenance">
          <dt>Model</dt>
          <dd>{r.model.model}</dd>
          <dt>Prompt</dt>
          <dd className="mono">
            {r.model.prompt_version} · {r.model.prompt_hash.slice(0, 12)}
          </dd>
          <dt>Input hash</dt>
          <dd className="mono">{r.model.input_hash.slice(0, 12)}</dd>
          <dt>Output hash</dt>
          <dd className="mono">{r.model.output_hash.slice(0, 12)}</dd>
        </dl>
      )}
      {r.correction && (
        <dl className="provenance">
          <dt>Corrected by</dt>
          <dd className="mono">
            {r.correction.actor} ({r.correction.authority.replace("_", " ")})
          </dd>
          <dt>Reason</dt>
          <dd>{r.correction.reason}</dd>
          <dt>Evidence</dt>
          <dd>{r.correction.evidence_refs.join(", ")}</dd>
        </dl>
      )}
    </article>
  );
}

export function ContributionView({ c }: { c: ContributionV1 }) {
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">
          <a href={`/c/${c.community.mint}/e/${c.epoch.index}`}>Epoch {c.epoch.index}</a>
        </p>
        <h1>{c.selected ? creditSentence(c.selected) : STATE[c.state]}</h1>
        <p className="muted">
          {c.kind} by member <span className="mono">{shortId(c.member_id)}</span> · wallet{" "}
          <WalletCell w={c} /> · submitted {utc(c.accepted_at)}
        </p>
      </header>
      <p className="banner">{STATE[c.state]}</p>
      <section className="panel">
        <h2>The work</h2>
        <blockquote>{c.text}</blockquote>
        <p className="muted">
          Captured {utc(c.capture.captured_at)} from{" "}
          {c.capture.source === "x_oembed" ? "X" : "Telegram"}
          {c.url && (
            <>
              {" · "}
              <a href={c.url} rel="noopener noreferrer">
                original post
              </a>
            </>
          )}
          {c.capture.limitations.length > 0 &&
            ` · limitations: ${c.capture.limitations.join(", ")}`}
        </p>
      </section>
      <h2>Decisions</h2>
      {c.revisions.length === 0 ? (
        <p className="empty">No decision was recorded.</p>
      ) : (
        c.revisions.map((r) => <Revision key={r.revision} r={r} />)
      )}
    </>
  );
}
