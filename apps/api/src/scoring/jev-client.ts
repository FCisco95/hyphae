import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { JevTransport } from "./scorers.js";

// Upper bound on one Jev call. It must stay under the reward call timeout, which the
// reconciliation horizon is built on.
export const JEV_CALL_TIMEOUT_MS = 30_000;

export interface JevClientOptions {
  apiKey: string;
  timeoutMs?: number;
  fetch?: (input: string, init?: RequestInit) => Promise<Response>;
}

// The one place the SDK is configured. Like callRewardModel, it never retries: a retry after a
// possibly executed request could bill twice, so every failure goes to reconciliation instead.
// Logging is off because the SDK's debug level logs request bodies, which hold member text.
export function jevTransport(options: JevClientOptions): JevTransport {
  if (!options.apiKey) throw new Error("scoring: TYPESAFE_API_KEY is not set");
  const client = new TypeSafeClient({
    apiKey: options.apiKey,
    timeout: options.timeoutMs ?? JEV_CALL_TIMEOUT_MS,
    retry: { maxRetries: 0 },
    logLevel: "off",
    ...(options.fetch && { fetch: options.fetch }),
  });
  return async (request) => {
    const started = Date.now();
    const response = await client.systemOne(request as Parameters<typeof client.systemOne>[0]);
    return { response, latencyMs: Date.now() - started, mode: "live" };
  };
}
