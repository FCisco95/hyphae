import type { Metadata } from "next";
import { notFound } from "next/navigation.js";
import { RaidRefresh } from "../../../components/raid-refresh.js";
import { CommunityView, UnavailableView } from "../../../components/views.js";
import { communityPresentation } from "../../../lib/community-presentation.js";
import { shownEpoch } from "../../../lib/epoch-phase.js";
import { readMemberLoginConfig } from "../../../lib/member-login-server.js";
import {
  readCommunity,
  readRaids,
  readStats,
  readTopAllTime,
  readTopOfEpoch,
} from "../../../lib/reads.js";

// The same read as the page (Next dedupes it).
export async function generateMetadata(props: {
  params: Promise<{ mint: string }>;
}): Promise<Metadata> {
  const r = await readCommunity((await props.params).mint);
  return { title: r.ok ? r.data.name : "Community" };
}

export default async function CommunityPage(props: {
  params: Promise<{ mint: string }>;
  searchParams?: Promise<{ board?: string | string[] }>;
}) {
  const { mint } = await props.params;
  const board = (await props.searchParams)?.board;
  const [r, raids, stats] = await Promise.all([
    readCommunity(mint),
    readRaids(mint),
    readStats(mint),
  ]);
  if (!r.ok) return r.reason === "not_found" ? notFound() : <UnavailableView />;
  const loginEnabled = !!(await readMemberLoginConfig());
  // The stats read gates the new panels: an API without it, or one that is slow, shows the page as
  // it was. Their leaderboard is read only when they will be shown.
  const epochIndex = shownEpoch(r.data)?.index ?? null;
  const scope = board === "all" || epochIndex === null ? ("all" as const) : ("epoch" as const);
  const panels = stats.ok
    ? {
        stats: stats.data,
        board: {
          scope,
          epochIndex,
          result:
            scope === "all" || epochIndex === null
              ? await readTopAllTime(mint)
              : await readTopOfEpoch(mint, epochIndex),
        },
      }
    : undefined;
  return (
    <>
      <RaidRefresh />
      <CommunityView
        community={r.data}
        presentation={communityPresentation(r.data.mint)}
        raids={raids}
        loginEnabled={loginEnabled}
        panels={panels}
      />
    </>
  );
}
