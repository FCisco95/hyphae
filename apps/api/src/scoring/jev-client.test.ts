import { noul } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import { JEV_CALL_TIMEOUT_MS, jevTransport } from "./jev-client.js";
import { REWARD_CALL_TIMEOUT_MS } from "./run.js";

const body = {
  model: "jev-1.13.0",
  state: { contribution: "text" },
  questions: { low_effort: noul("Is the text low effort?") },
};
const answer = {
  model: "jev-1.13.0",
  answers: { quality: { type: "score", score: 2 } },
  usage: { input_tokens: 1800, output_tokens: 0 },
};

function server(handle: (call: number, init: RequestInit | undefined) => Promise<Response>) {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    seen.push({ url, init });
    return handle(seen.length, init);
  };
  return { seen, fetch };
}
const ok = () => Promise.resolve(Response.json(answer));

describe("jevTransport", () => {
  it("makes one live request and returns the response with its latency", async () => {
    const s = server(ok);
    const result = await jevTransport({ apiKey: "tsk_test", fetch: s.fetch })(body);
    expect(result).toMatchObject({ response: answer, mode: "live" });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(s.seen).toHaveLength(1);
    expect(s.seen[0]?.url).toContain("/v1/systemone");
    expect(JSON.parse(String(s.seen[0]?.init?.body))).toMatchObject({
      model: "jev-1.13.0",
      state: { contribution: "text" },
    });
  });

  it("never retries a server error: a retry after a possibly executed request could bill twice", async () => {
    const s = server(() => Promise.resolve(new Response("boom", { status: 500 })));
    await expect(jevTransport({ apiKey: "tsk_test", fetch: s.fetch })(body)).rejects.toThrow();
    expect(s.seen).toHaveLength(1);
  });

  it("never retries a rate limit", async () => {
    const s = server(() =>
      Promise.resolve(new Response("slow down", { status: 429, headers: { "retry-after": "1" } })),
    );
    await expect(jevTransport({ apiKey: "tsk_test", fetch: s.fetch })(body)).rejects.toThrow();
    expect(s.seen).toHaveLength(1);
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
      jevTransport({ apiKey: "tsk_test", fetch: s.fetch, timeoutMs: 60 })(body),
    ).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(s.seen).toHaveLength(1);
  });

  it("stays inside the reconciliation horizon's assumption about one call", () => {
    expect(JEV_CALL_TIMEOUT_MS).toBeLessThanOrEqual(REWARD_CALL_TIMEOUT_MS);
  });

  it("refuses to build without a key", () => {
    expect(() => jevTransport({ apiKey: "" })).toThrow(/TYPESAFE_API_KEY/);
  });
});
