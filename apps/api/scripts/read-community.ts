import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ReadApiV1Loose } from "@hyphae/core";
import type { z } from "zod";

const DEFAULT_API = "https://hyphae-api.fly.dev/v1";

export class ReadError extends Error {
  constructor(
    readonly code: string,
    readonly status?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}

// Public reads only: no ambient credentials, redirects, writes or automatic retries.
export async function readCommunity(
  mint: string,
  { api = DEFAULT_API, fetchImpl = fetch }: { api?: string; fetchImpl?: typeof fetch } = {},
) {
  if (!/^[A-Za-z0-9]{1,64}$/.test(mint)) throw new ReadError("invalid_mint");
  let base: URL;
  try {
    base = new URL(api);
  } catch {
    throw new ReadError("invalid_api_url");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (
    (base.protocol !== "https:" && !(base.protocol === "http:" && local)) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    !/^\/v1\/?$/.test(base.pathname)
  ) {
    throw new ReadError("invalid_api_url");
  }

  async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${base.href.replace(/\/$/, "")}${path}`, {
        headers: { accept: "application/json" },
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new ReadError(
        error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network_error",
      );
    }
    if (!response.ok) {
      const retry = response.headers.get("retry-after");
      const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : undefined;
      throw new ReadError(
        response.status === 404
          ? "not_found"
          : response.status === 429
            ? "rate_limited"
            : "http_error",
        response.status,
        seconds !== undefined && Number.isSafeInteger(seconds) ? seconds : undefined,
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ReadError("invalid_json");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ReadError("schema_mismatch");
    return parsed.data;
  }

  const community = await get(`/communities/${mint}`, ReadApiV1Loose.community);
  if (community.mint !== mint) throw new ReadError("identity_mismatch");
  if (community.current_epoch === null) return { community, epoch: null };
  if (community.current_epoch < 1) throw new ReadError("schema_mismatch");
  const epoch = await get(
    `/communities/${mint}/epochs/${community.current_epoch}`,
    ReadApiV1Loose.epoch,
  );
  if (epoch.community.mint !== mint || epoch.index !== community.current_epoch) {
    throw new ReadError("identity_mismatch");
  }
  return { community, epoch };
}

async function main() {
  const [mint, api, ...extra] = process.argv.slice(2);
  if (!mint || extra.length) {
    throw new ReadError("usage: read-community.ts <mint> [https://api-host/v1]");
  }
  console.log(JSON.stringify(await readCommunity(mint, api ? { api } : {}), null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(
      JSON.stringify(
        error instanceof ReadError
          ? {
              error: error.code,
              status: error.status,
              retry_after_seconds: error.retryAfterSeconds,
            }
          : { error: "unavailable" },
      ),
    );
    process.exitCode = 1;
  });
}
