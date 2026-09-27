import { ReadApiV1Loose } from "@hyphae/core";
import { getJson } from "./api.js";

const enc = encodeURIComponent;

export const readCommunity = (mint: string) =>
  getJson(`/v1/communities/${enc(mint)}`, ReadApiV1Loose.community);
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
