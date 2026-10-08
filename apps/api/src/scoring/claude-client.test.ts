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
