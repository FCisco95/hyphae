import { Hono } from "hono";
import { expect, it } from "vitest";
import { createHyphaeAdminClient } from "../src/index.js";

// Wire-contract fixture only: actual Privy/Telegram authorization belongs to API tests.
it("exchanges GET/PUT with Hono, preserves pause timestamps, surfaces stale edits and revocation", async () => {
  let validToken = "current.app.token";
  let pausedAt: string | null = null;
  const response = () => ({
    state: "admin" as const,
    community: { mint: "CommunityA", name: "Community" },
    intake: { paused: pausedAt !== null, paused_at: pausedAt },
    as_of: "2026-11-06T19:00:00.000Z",
  });
  const app = new Hono();
  app.use("/admin/v1/*", async (c, next) => {
    if (c.req.header("authorization") !== `Bearer ${validToken}`) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  });
  app.get("/admin/v1/communities/CommunityA", (c) => c.json(response()));
  app.put("/admin/v1/communities/CommunityA/intake", async (c) => {
    expect(c.req.header("content-type")).toBe("application/json");
    const body = await c.req.json();
    expect(Object.keys(body).sort()).toEqual(["expected_paused_at", "paused"]);
    if (body.expected_paused_at !== pausedAt) return c.json({ error: "conflict" }, 409);
    pausedAt = body.paused ? (pausedAt ?? "2026-11-06T19:01:00.000Z") : null;
    return c.json(response());
  });
  const client = createHyphaeAdminClient({
    baseUrl: "http://localhost/admin/v1",
    getAccessToken: () => "current.app.token",
    fetch: async (input, init) => app.request(input, init),
  });
  const before = await client.getCommunity("CommunityA");
  const paused = await client.setIntakePaused("CommunityA", {
    paused: true,
    expected_paused_at: before.intake.paused_at,
  });
  expect(paused.intake).toEqual({ paused: true, paused_at: "2026-11-06T19:01:00.000Z" });
  const repeated = await client.setIntakePaused("CommunityA", {
    paused: true,
    expected_paused_at: paused.intake.paused_at,
  });
  expect(repeated.intake.paused_at).toBe("2026-11-06T19:01:00.000Z");
  await expect(
    client.setIntakePaused("CommunityA", {
      paused: false,
      expected_paused_at: before.intake.paused_at,
    }),
  ).rejects.toMatchObject({ code: "conflict", status: 409 });
  const resumed = await client.setIntakePaused("CommunityA", {
    paused: false,
    expected_paused_at: paused.intake.paused_at,
  });
  expect(resumed.intake).toEqual({ paused: false, paused_at: null });
  validToken = "rotated.app.token";
  await expect(client.getCommunity("CommunityA")).rejects.toMatchObject({
    code: "unauthorized",
    status: 401,
  });
});
