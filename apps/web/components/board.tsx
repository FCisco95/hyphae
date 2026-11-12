import type { AllTimeLeaderboardV1, LeaderboardV1 } from "@hyphae/core";
import type { Result } from "../lib/api.js";
import { shortId, shortWallet } from "../lib/format.js";
import { walletPath } from "../lib/record.js";

// The top of the board, for one epoch or for all of them. The toggle is two links, so it works
// without a script and a visitor can share the one they are looking at. A member appears as a
// short random id and, only if they signed a link, their wallet: never a social handle.
export type BoardScope = "epoch" | "all";

export function CommunityBoard({
  base,
  scope,
  epochIndex,
  board,
}: {
  base: string;
  scope: BoardScope;
  epochIndex: number | null;
  board: Result<LeaderboardV1 | AllTimeLeaderboardV1>;
}) {
  const epochLabel = epochIndex === null ? "This epoch" : `Epoch ${epochIndex}`;
  return (
    <section id="leaderboard" className="board" aria-labelledby="board-title">
      <div className="board-head">
        <h2 id="board-title">Leaderboard</h2>
        <nav className="board-toggle" aria-label="Leaderboard scope">
          {epochIndex !== null ? (
            <a
              href={`${base}?board=epoch#leaderboard`}
              aria-current={scope === "epoch" ? "true" : undefined}
            >
              {epochLabel}
            </a>
          ) : null}
          <a
            href={`${base}?board=all#leaderboard`}
            aria-current={scope === "all" ? "true" : undefined}
          >
            All time
          </a>
        </nav>
      </div>
      {!board.ok ? (
        <p className="empty">The leaderboard cannot be read right now. Reload in a minute.</p>
      ) : board.data.entries.length === 0 ? (
        <p className="empty">Nobody has points here yet.</p>
      ) : (
        <>
          <table className="stack">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Member</th>
                <th>Wallet</th>
                <th>Points</th>
                <th>Counted</th>
              </tr>
            </thead>
            <tbody>
              {board.data.entries.map((e) => (
                <tr key={e.member_id}>
                  <td data-label="Rank" className="num">
                    {e.rank}
                  </td>
                  <td data-label="Member" className="mono">
                    {shortId(e.member_id)}
                  </td>
                  <td data-label="Wallet">
                    {e.wallet_status === "verified" && e.wallet ? (
                      <a className="mono wallet-verified" href={walletPath(e.wallet)}>
                        {shortWallet(e.wallet)}
                      </a>
                    ) : (
                      <span className="muted">
                        {e.wallet_status === "unverified" ? "unverified" : "no wallet"}
                      </span>
                    )}
                  </td>
                  <td data-label="Points" className="num">
                    {e.points}
                  </td>
                  <td data-label="Counted" className="num">
                    {e.counted} of {e.contributions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">
            Top {board.data.entries.length} of {board.data.total_entries} members.{" "}
            {scope === "all"
              ? "Every epoch added together."
              : epochIndex !== null && (
                  <a href={`${base}/e/${epochIndex}/leaderboard`}>The full epoch table</a>
                )}
            {board.data.final ? "" : " Open-epoch points are provisional."}
          </p>
        </>
      )}
    </section>
  );
}
