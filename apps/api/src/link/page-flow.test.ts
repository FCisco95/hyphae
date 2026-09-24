import { describe, expect, it } from "vitest";
import { type Post, verifyAndReconcile } from "./page/flow.js";

const proof = { requestId: "r", nonce: "n", message: "m", signature: "s" };

// A fake of the page's POST helper: each path answers, or rejects like a dropped connection.
const fake =
  (answers: Record<string, { ok: boolean; data: Record<string, unknown> } | "drop">): Post =>
  async (path) => {
    const answer = answers[path];
    if (!answer || answer === "drop") throw new TypeError("Failed to fetch");
    return answer;
  };

describe("verifyAndReconcile", () => {
  it("reports the linked wallet from /verify", async () => {
    const post = fake({ verify: { ok: true, data: { status: "linked", wallet: "W" } } });
    expect(await verifyAndReconcile(post, "t", proof)).toEqual({ linked: "W" });
  });

  it("asks /status when the /verify connection drops, and reports a committed link", async () => {
    const post = fake({
      verify: "drop",
      status: { ok: true, data: { linked: true, wallet: "W" } },
    });
    expect(await verifyAndReconcile(post, "t", proof)).toEqual({ linked: "W" });
  });

  it("asks /status after link_unavailable", async () => {
    const post = fake({
      verify: { ok: false, data: { error: "link_unavailable" } },
      status: { ok: true, data: { linked: true, wallet: "W" } },
    });
    expect(await verifyAndReconcile(post, "t", proof)).toEqual({ linked: "W" });
  });

  it("stays unavailable, never rejected, when neither answer arrives or nothing committed", async () => {
    expect(await verifyAndReconcile(fake({}), "t", proof)).toEqual({ error: "link_unavailable" });
    const none = fake({ verify: "drop", status: { ok: true, data: { linked: false } } });
    expect(await verifyAndReconcile(none, "t", proof)).toEqual({ error: "link_unavailable" });
  });

  it("passes a definite refusal through without asking /status", async () => {
    const post = fake({ verify: { ok: false, data: { error: "wallet_taken" } } });
    expect(await verifyAndReconcile(post, "t", proof)).toEqual({ error: "wallet_taken" });
  });
});
