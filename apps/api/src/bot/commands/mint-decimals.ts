import { env } from "../../env.js";

const cache = new Map<string, number>();

// Decimals of a token mint from the read RPC, or undefined when it cannot be read in 2 seconds.
// Only a successful read is cached, so a flaky RPC never pins a wrong or missing answer.
export async function mintDecimals(mint: string): Promise<number | undefined> {
  const known = cache.get(mint);
  if (known !== undefined) return known;
  if (!env.READ_RPC_URL) return undefined;
  try {
    const res = await fetch(env.READ_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenSupply",
        params: [mint, { commitment: "finalized" }],
      }),
      signal: AbortSignal.timeout(2_000),
    });
    const decimals = ((await res.json()) as { result?: { value?: { decimals?: unknown } } }).result
      ?.value?.decimals;
    if (
      typeof decimals !== "number" ||
      !Number.isInteger(decimals) ||
      decimals < 0 ||
      decimals > 18
    )
      return undefined;
    cache.set(mint, decimals);
    return decimals;
  } catch {
    return undefined;
  }
}
