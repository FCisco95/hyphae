import { describe, expect, it } from "vitest";
import { CLAUDE_CALL_TIMEOUT_MS, claudeDepsFromEnv, claudeTransport } from "./claude-client.js";
import { REWARD_CALL_TIMEOUT_MS } from "./run.js";
import type { JevRegistry, JevScorerDef } from "./scorers.js";

const body = {
  model: "claude-haiku-5-5",
  max_tokens: 8000,
  thinking: { type: "adaptive" },
  output_config: { effort: "medium" },
  system: "Answer the questions.",
  messages: [{ role: "user", content: "<content>\n{}\n</content>" }],
};
const answer = {
  id: "msg_01",
  type: "message",
  role: "assistant",
  model: "claude-haiku-5-5",
  content: [{ type: "text", text: "{}" }],
  stop_reason: "end_turn",
  stop_sequence: null,
  stop_details: null,
  usage: { input_tokens: 5000, output_tokens: 600 },
};

function server(handle: (call: number, init: RequestInit | undefined) => Promise<Response>) {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init });
    return handle(seen.length, init);
  };
  return { seen, fetch };
}
const ok = () => Promise.resolve(Response.json(answer));

// Headers at once, then the body on the server's own schedule. As fetch does, aborting the
// request's signal ends a body that is still being read.
function streamingServer(send: (body: ReadableStreamDefaultController<Uint8Array>) => () => void) {
  const state = { requests: 0, signal: undefined as AbortSignal | undefined, bodyCancelled: false };
  const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    state.requests += 1;
    const signal = init?.signal ?? undefined;
    state.signal = signal;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const stop = send(controller);
        signal?.addEventListener(
          "abort",
          () => {
            stop();
            state.bodyCancelled = true;
            controller.error(signal.reason);
          },
          { once: true },
        );
      },
    });
    return new Response(body, { headers: { "content-type": "application/json" } });
  };
  return { state, fetch };
}
const encoded = new TextEncoder().encode(JSON.stringify(answer));
// The whole answer, `size` bytes every `everyMs`.
function trickle(size: number, everyMs: number) {
  const progress = { sent: 0 };
  const send = (body: ReadableStreamDefaultController<Uint8Array>) => {
    const timer = setInterval(() => {
      body.enqueue(encoded.subarray(progress.sent, progress.sent + size));
      progress.sent += size;
      if (progress.sent >= encoded.length) {
        clearInterval(timer);
        body.close();
      }
    }, everyMs);
    return () => clearInterval(timer);
  };
  return { progress, send };
}

describe("claudeTransport", () => {
  it("sends the committed body as it is, once, and returns the response with its latency", async () => {
    const s = server(ok);
    const result = await claudeTransport({ apiKey: "sk-ant-test", fetch: s.fetch })(body);
    expect(result).toMatchObject({ response: answer, mode: "live" });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(s.seen).toHaveLength(1);
    expect(s.seen[0]?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(JSON.parse(String(s.seen[0]?.init?.body))).toEqual(body);
    expect(new Headers(s.seen[0]?.init?.headers).get("x-api-key")).toBe("sk-ant-test");
  });

  it("never retries a server error: a retry after a possibly executed request could bill twice", async () => {
    const s = server(() => Promise.resolve(new Response("boom", { status: 500 })));
    await expect(
      claudeTransport({ apiKey: "sk-ant-test", fetch: s.fetch })(body),
    ).rejects.toThrow();
    expect(s.seen).toHaveLength(1);
  });

  it("never retries an overload or a rate limit", async () => {
    for (const status of [529, 429]) {
      const s = server(() =>
        Promise.resolve(new Response("slow down", { status, headers: { "retry-after": "1" } })),
      );
      await expect(
        claudeTransport({ apiKey: "sk-ant-test", fetch: s.fetch })(body),
      ).rejects.toThrow();
      expect(s.seen).toHaveLength(1);
    }
  });

  it("never retries a timeout, and gives up at the configured time", async () => {
    const s = server(
      (_n, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const started = Date.now();
    await expect(
      claudeTransport({ apiKey: "sk-ant-test", fetch: s.fetch, timeoutMs: 60 })(body),
    ).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(s.seen).toHaveLength(1);
  });

  it("gives up at the deadline when the headers arrive but the body stalls", async () => {
    const s = streamingServer((body) => {
      const late = setTimeout(() => {
        body.enqueue(encoded);
        body.close();
      }, 1_000);
      return () => clearTimeout(late);
    });
    const started = Date.now();
    await expect(
      claudeTransport({ apiKey: "sk-ant-test", fetch: s.fetch, timeoutMs: 40 })(body),
    ).rejects.toThrow("claude: no complete response within 40 ms");
    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(35);
    expect(elapsed).toBeLessThan(500);
    expect(s.state.signal?.aborted).toBe(true);
    expect(s.state.bodyCancelled).toBe(true);
    expect(s.state.requests).toBe(1);
  });

  it("gives up at the deadline while the body is still arriving piece by piece", async () => {
    const t = trickle(4, 10);
    const s = streamingServer(t.send);
    await expect(
      claudeTransport({ apiKey: "sk-ant-test", fetch: s.fetch, timeoutMs: 50 })(body),
    ).rejects.toThrow("claude: no complete response within 50 ms");
    const sentAtDeadline = t.progress.sent;
    expect(sentAtDeadline).toBeGreaterThan(0);
    expect(sentAtDeadline).toBeLessThan(encoded.length);
    expect(s.state.signal?.aborted).toBe(true);
    expect(s.state.bodyCancelled).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(t.progress.sent).toBe(sentAtDeadline);
    expect(s.state.requests).toBe(1);
  });

  it("returns a body that finishes inside the deadline", async () => {
    const s = streamingServer(trickle(Math.ceil(encoded.length / 3), 5).send);
    const result = await claudeTransport({
      apiKey: "sk-ant-test",
      fetch: s.fetch,
      timeoutMs: 1_000,
    })(body);
    expect(result).toMatchObject({ response: answer, mode: "live" });
    expect(s.state.signal?.aborted).toBe(false);
    expect(s.state.requests).toBe(1);
  });

  it("stays inside the reconciliation horizon's assumption about one call", () => {
    expect(CLAUDE_CALL_TIMEOUT_MS).toBeLessThanOrEqual(REWARD_CALL_TIMEOUT_MS);
  });

  it("refuses to build without a key", () => {
    expect(() => claudeTransport({ apiKey: "" })).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("claudeDepsFromEnv", () => {
  const def = { version: "reward-eval/3" } as JevScorerDef;
  const registry: JevRegistry = new Map([[def.version, def]]);

  it("enables the Claude question scorers wherever the Anthropic key the prompt path uses is set", () => {
    const deps = claudeDepsFromEnv({ ANTHROPIC_API_KEY: "sk-ant-test" }, registry);
    expect(deps?.registry).toBe(registry);
    expect(typeof deps?.transport).toBe("function");
  });

  it("leaves them off without the key, so an epoch pinned to one is not ready instead of failing", () => {
    expect(claudeDepsFromEnv({}, registry)).toBeUndefined();
  });
});
