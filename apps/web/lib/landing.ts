import type { CommunityV1, LooseEpochV1 } from "@hyphae/core";
import type { Result } from "./api.js";

// What the landing page can say about the default community right now, read from the API. Anything
// it can't read is a state to show, never a number made up to fill the gap.
export type LiveProof =
  | { state: "unconfigured" }
  | { state: "unavailable" }
  | {
      state: "ready";
      community: CommunityV1;
      // The open epoch, or the newest one; null before the first.
      epoch: LooseEpochV1 | "unavailable" | null;
      // The newest epoch past its close (frozen or still closing), whose settlement says what was
      // paid; null before the first close.
      closed: LooseEpochV1 | "unavailable" | null;
    };

export async function loadLiveProof(
  mint: string | undefined,
  readCommunity: (mint: string) => Promise<Result<CommunityV1>>,
  readEpoch: (mint: string, index: number) => Promise<Result<LooseEpochV1>>,
): Promise<LiveProof> {
  if (!mint) return { state: "unconfigured" };
  const community = await readCommunity(mint);
  if (!community.ok) return { state: "unavailable" };
  // The community lists its epochs newest first.
  const { current_epoch, epochs } = community.data;
  const shown = current_epoch ?? epochs[0]?.index ?? null;
  const closed = epochs.find((e) => e.status === "closed" || e.status === "closing")?.index ?? null;
  const read = async (index: number | null) => {
    if (index === null) return null;
    const r = await readEpoch(mint, index);
    return r.ok ? r.data : ("unavailable" as const);
  };
  const [epoch, closedEpoch] = await Promise.all([
    read(shown),
    closed === shown ? null : read(closed),
  ]);
  return {
    state: "ready",
    community: community.data,
    epoch,
    closed: closed === shown ? epoch : closedEpoch,
  };
}
