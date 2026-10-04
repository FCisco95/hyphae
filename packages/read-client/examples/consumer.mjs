import { createHyphaeReadClient, HyphaeReadError } from "@hyphae/read-client";

const [mint, baseUrl] = process.argv.slice(2);
if (!mint) throw new Error("Usage: node consumer.mjs <registered-mint> [https://api-host/v1]");
const client = createHyphaeReadClient(baseUrl === undefined ? {} : { baseUrl });

try {
  const community = await client.getCommunity(mint);
  const epoch =
    community.current_epoch === null ? null : await client.getEpoch(mint, community.current_epoch);
  console.log(JSON.stringify({ community, epoch }, null, 2));
} catch (error) {
  console.error(
    error instanceof HyphaeReadError
      ? JSON.stringify({
          error: error.code,
          status: error.status,
          retry_after_seconds: error.retryAfterSeconds,
        })
      : JSON.stringify({ error: "unavailable" }),
  );
  process.exitCode = 1;
}
