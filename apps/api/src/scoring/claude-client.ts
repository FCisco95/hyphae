import Anthropic, { type ClientOptions } from "@anthropic-ai/sdk";
import type { JevDeps } from "../rewards/evaluation.js";
import { REWARD_CALL_TIMEOUT_MS } from "./run.js";
import type { JevRegistry, JevTransport } from "./scorers.js";

// Upper bound on one Claude question call; the reconciliation horizon is built on the reward call
// timeout, so it must not exceed it.
export const CLAUDE_CALL_TIMEOUT_MS = REWARD_CALL_TIMEOUT_MS;

export interface ClaudeClientOptions {
  apiKey: string;
  timeoutMs?: number;
  fetch?: ClientOptions["fetch"];
}

// Like jevTransport: the committed body goes out as it is, once. A retry after a possibly executed
// request could bill twice, so every failure goes to reconciliation instead. Logging is off because
// the SDK's debug level logs request bodies, which hold member text.
export function claudeTransport(options: ClaudeClientOptions): JevTransport {
  if (!options.apiKey) throw new Error("scoring: ANTHROPIC_API_KEY is not set");
  const timeoutMs = options.timeoutMs ?? CLAUDE_CALL_TIMEOUT_MS;
  const client = new Anthropic({
    apiKey: options.apiKey,
    maxRetries: 0,
    timeout: timeoutMs,
    logLevel: "off",
    ...(options.fetch && { fetch: options.fetch }),
  });
  return async (request) => {
    const started = Date.now();
    // The SDK's timeout stops once the headers arrive, and the body is read after that with no
    // limit; this deadline covers the whole call, so aborting it also ends a stalled body read.
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), timeoutMs);
    try {
      const response = await client.messages.create(
        request as Anthropic.MessageCreateParamsNonStreaming,
        { signal: deadline.signal },
      );
      return { response, latencyMs: Date.now() - started, mode: "live" };
    } catch (err) {
      // The SDK reports our abort as a caller abort; the dispatch record should say it timed out.
      if (deadline.signal.aborted) {
        throw new Error(`claude: no complete response within ${timeoutMs} ms`, { cause: err });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
}

// The Claude question scorers need only the Anthropic key the prompt path already uses, so they
// are on wherever it is set; an epoch uses one only once an amendment pins it.
export function claudeDepsFromEnv(
  cfg: { ANTHROPIC_API_KEY?: string | undefined },
  registry: JevRegistry,
): JevDeps | undefined {
  if (!cfg.ANTHROPIC_API_KEY) return undefined;
  return { registry, transport: claudeTransport({ apiKey: cfg.ANTHROPIC_API_KEY }) };
}
