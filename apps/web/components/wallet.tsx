import type { WalletRecordEpochV1, WalletRecordV1 } from "@hyphae/core";
import { STATE, shortId, shortWallet, utc } from "../lib/format.js";
import { averageScore, payoutView, tallySentence, walletPath } from "../lib/record.js";
import { Stat, Stats } from "./ui.js";
import { StatusBadge, Tx, unavailableSentence } from "./views.js";

// A wallet's public record. Every number links to the audit page it comes from.

function Payout({ e }: { e: WalletRecordEpochV1 }) {
  const v = payoutView(e);
  switch (v.kind) {
    case "paid":
      return (
        <span className="paid">
          {v.amount}, paid in <Tx signature={v.claimTx} network={v.network} />
        </span>
      );
    case "claimable":
      return (
        <>
          {v.amount} allocated, not claimed yet.{" "}
          <a href={`/c/${e.community.mint}/e/${e.index}/claim`}>Claim page</a>
        </>
      );
    case "unconfirmed":
      return (
        <>
          {v.amount} allocated. {unavailableSentence(v.reason)}
        </>
      );
    case "none":
      return <>{v.text}</>;
    case "unavailable":
      return <>{unavailableSentence(v.reason)}</>;
  }
}

function EpochRecord({ e }: { e: WalletRecordEpochV1 }) {
  return (
    <article className="revision">
      <h3>
        <a href={`/c/${e.community.mint}/e/${e.index}`}>
          {e.community.name} · Epoch {e.index}
        </a>{" "}
        <StatusBadge epoch={{ status: e.status, final: e.status === "closed" }} />
      </h3>
      <p className="muted">
        {utc(e.opens_at)} → {utc(e.closes_at)} · member{" "}
        <span className="mono">{shortId(e.member_id)}</span>
      </p>
      <Stats compact>
        <Stat label="Contributions" value={tallySentence(e.totals)} />
        <Stat
          label="Average credited score"
          value={averageScore(e.totals.average_credited_quality)}
        />
        <Stat label="Exact points" value={e.totals.points} />
        <Stat label="Payout" value={<Payout e={e} />} />
      </Stats>
      <table className="stack">
        <thead>
          <tr>
            <th>Work</th>
            <th>Submitted</th>
            <th>Credited score</th>
            <th>Points</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {e.contributions.map((c) => (
            <tr key={c.id}>
              <td data-label="Work">
                <a href={`/contribution/${c.id}`}>{c.kind}</a>
              </td>
              <td data-label="Submitted">{utc(c.accepted_at)}</td>
              <td data-label="Credited score" className="num">
                {c.credited_quality ?? "—"}
              </td>
              <td data-label="Points" className="num">
                {c.points ?? "—"}
              </td>
              <td data-label="State">{STATE[c.state]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function RecordPager({ record }: { record: WalletRecordV1 }) {
  const base = walletPath(record.wallet);
  const prev = record.offset > 0 ? Math.max(0, record.offset - record.limit) : null;
  const next =
    record.offset + record.limit < record.total_epochs ? record.offset + record.limit : null;
  if (prev === null && next === null) return null;
  return (
    <nav className="pager">
      {prev !== null && <a href={`${base}?offset=${prev}`}>← Newer</a>}
      <span className="muted">
        {Math.min(record.offset + 1, record.total_epochs)}–
        {Math.min(record.offset + record.limit, record.total_epochs)} of {record.total_epochs}{" "}
        epochs
      </span>
      {next !== null && <a href={`${base}?offset=${next}`}>Older →</a>}
    </nav>
  );
}

export function WalletRecordView({ record }: { record: WalletRecordV1 }) {
  const t = record.totals;
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Wallet record</p>
        <h1>
          <span className="mono wallet-verified" title={`${record.wallet}, verified by signature`}>
            {shortWallet(record.wallet)}
          </span>
        </h1>
        <p className="muted">
          The epochs where this was a member's wallet, verified by signature, when the epoch closed
          or while it is open.
        </p>
        <p className="muted small">Data as of {utc(record.as_of)}.</p>
      </header>
      <Stats>
        <Stat label="Communities" value={t.communities} />
        <Stat label="Epochs" value={t.epochs} />
        <Stat
          label="Contributions"
          value={t.contributions}
          note={`${t.counted} scored, ${t.credited} credited`}
        />
        <Stat label="Average credited score" value={averageScore(t.average_credited_quality)} />
        <Stat label="Exact points" value={t.points} />
      </Stats>
      <p className="muted small">
        Scored: the contribution has a judgement. Credited: scored above zero. The average is over
        scored contributions. Points from an open epoch are provisional, and points do not promise
        payment.
      </p>
      {record.communities.length > 1 && (
        <table className="stack">
          <thead>
            <tr>
              <th>Community</th>
              <th>Epochs</th>
              <th>Contributions</th>
              <th>Average score</th>
              <th>Exact points</th>
            </tr>
          </thead>
          <tbody>
            {record.communities.map((c) => (
              <tr key={c.mint}>
                <td data-label="Community">
                  <a href={`/c/${c.mint}`}>{c.name}</a>
                </td>
                <td data-label="Epochs" className="num">
                  {c.totals.epochs}
                </td>
                <td data-label="Contributions">{tallySentence(c.totals)}</td>
                <td data-label="Average score" className="num">
                  {averageScore(c.totals.average_credited_quality)}
                </td>
                <td data-label="Exact points" className="num">
                  {c.totals.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2>Epochs</h2>
      {record.epochs.length === 0 ? (
        <p className="empty">No epochs on this page.</p>
      ) : (
        record.epochs.map((e) => (
          <EpochRecord key={`${e.community.mint}/${e.index}/${e.member_id}`} e={e} />
        ))
      )}
      <RecordPager record={record} />
    </>
  );
}

export function NoRecordView() {
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Wallet record</p>
        <h1>No public record</h1>
      </header>
      <p className="empty">No epoch shows this wallet.</p>
      <p className="muted">
        A wallet's record lists the epochs where it was a member's wallet, verified by signature,
        when the epoch closed or while it is open. It starts with that member's first contribution.
        A wallet that was only pasted, not signed, has no record.
      </p>
    </>
  );
}
