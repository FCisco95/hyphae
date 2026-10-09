import { PublicRaidsSchema, ReadApiV1Loose } from "@hyphae/core";
import { getJson } from "./api.js";

const enc = encodeURIComponent;

export const readCommunity = (mint: string) =>
  getJson(`/v1/communities/${enc(mint)}`, ReadApiV1Loose.community);
export async function readRaids(mint: string) {
  // Explicit local production-build preview; Vercel never uses the loopback override.
  const preview =
    process.env.HYPHAE_LOCAL_PREVIEW === "on" &&
    !process.env.VERCEL &&
    process.env.HYPHAE_RAID_API_URL === "http://127.0.0.1:3011";
  const result = await getJson(`/v1/communities/${enc(mint)}/raids`, PublicRaidsSchema, fetch, {
    anonymous: true,
    visitor: null,
    ...(preview ? { baseUrl: "http://127.0.0.1:3011" } : {}),
  });
  if (result.ok && result.data.community.mint !== mint)
    return { ok: false, reason: "unavailable" } as const;
  return result;
}
export const readEpoch = (mint: string, index: string) =>
  getJson(`/v1/communities/${enc(mint)}/epochs/${enc(index)}`, ReadApiV1Loose.epoch);
export const readContributions = (mint: string, index: string, offset: number) =>
  getJson(
    `/v1/communities/${enc(mint)}/epochs/${enc(index)}/contributions?offset=${offset}&limit=50`,
    ReadApiV1Loose.contributions,
  );
export const readLeaderboard = (mint: string, index: string) =>
  getJson(
    `/v1/communities/${enc(mint)}/leaderboard?epoch=${enc(index)}&limit=100`,
    ReadApiV1Loose.leaderboard,
  );
export const readContribution = (id: string) =>
  getJson(`/v1/contributions/${enc(id)}`, ReadApiV1Loose.contribution);
export const readClaim = (mint: string, index: string, wallet: string, visitor: string | null) =>
  getJson(
    `/v1/communities/${enc(mint)}/epochs/${enc(index)}/claims/${enc(wallet)}`,
    ReadApiV1Loose.claim,
    fetch,
    { fresh: true, visitor },
  );
