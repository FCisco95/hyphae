import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHyphaeReadClient, HyphaeReadError } from "@hyphae/read-client";

export { HyphaeReadError as ReadError } from "@hyphae/read-client";

// The operator example consumes the same packaged client as an external adopter.
export async function readCommunity(
  mint: string,
  {
    api = "https://hyphae-api.fly.dev/v1",
    fetchImpl = fetch,
    timeoutMs = 10_000,
  }: { api?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
) {
  const client = createHyphaeReadClient({ baseUrl: api, fetch: fetchImpl, timeoutMs });
  const community = await client.getCommunity(mint);
  if (community.current_epoch === null) return { community, epoch: null };
  if (community.current_epoch < 1) throw new HyphaeReadError("schema_mismatch");
  const epoch = await client.getEpoch(mint, community.current_epoch);
  return { community, epoch };
}

async function main() {
  const [mint, api, ...extra] = process.argv.slice(2);
  if (!mint || extra.length) {
    console.error(
      JSON.stringify({
        error: "invalid_input",
        usage: "read-community.ts <mint> [https://api-host/v1]",
      }),
    );
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(await readCommunity(mint, api === undefined ? {} : { api }), null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(
      JSON.stringify(
        error instanceof HyphaeReadError
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
