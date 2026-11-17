import { describe, expect, it } from "vitest";
import { operatorAuthStore } from "./store.js";

const W1 = "CCgEo8Yzb5vpfuaCixZ8NVJqv8ssAzXmKm5vsfhfmhe2";
const W2 = "11111111111111111111111111111112";
const ask = {
  mint: "DemoMint111",
  wallet: W1,
  domain: "https://hyphae.test",
  network: "solana:devnet" as const,
};

function clock(start = Date.parse("2026-11-17T12:00:00.000Z")) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("operator challenge store", () => {
  it("issues a 5-minute challenge with a fresh 32-byte nonce and a message built from its fields", () => {
    const c = clock();
    const store = operatorAuthStore({ now: c.now });
    const a = store.issue(ask);
    const b = store.issue(ask);
    if (!a || !b) throw new Error("issue");
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.expiresAt.getTime() - a.issuedAt.getTime()).toBe(5 * 60_000);
    expect(a.message).toContain(`Nonce: ${a.nonce};`);
    expect(a.message).toContain(`Wallet: ${W1};`);
  });

  it("hands a challenge out once: a replay finds nothing", () => {
    const store = operatorAuthStore();
    const a = store.issue(ask);
    if (!a) throw new Error("issue");
    expect(store.take(a.id)?.nonce).toBe(a.nonce);
    expect(store.take(a.id)).toBeNull();
  });

  it("refuses an expired challenge and an unknown id", () => {
    const c = clock();
    const store = operatorAuthStore({ now: c.now });
    const a = store.issue(ask);
    if (!a) throw new Error("issue");
    c.advance(5 * 60_000);
    expect(store.take(a.id)).toBeNull();
    expect(store.take("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("refuses new challenges when full instead of evicting open ones, and sweeps expired ones", () => {
    const c = clock();
    const store = operatorAuthStore({ now: c.now, maxChallenges: 2 });
    const a = store.issue(ask);
    expect(store.issue(ask)).not.toBeNull();
    expect(store.issue(ask)).toBeNull();
    if (!a) throw new Error("issue");
    expect(store.take(a.id)).not.toBeNull();
    c.advance(5 * 60_000);
    expect(store.issue(ask)).not.toBeNull();
    expect(store.issue(ask)).not.toBeNull();
  });
});

describe("operator sessions", () => {
  it("opens a 4-hour session bound to one mint and wallet; the store keeps no token", () => {
    const c = clock();
    const store = operatorAuthStore({ now: c.now });
    const { token, session } = store.open({ mint: "DemoMint111", wallet: W1 });
    expect(token).toMatch(/^hop_[A-Za-z0-9_-]{43}$/);
    expect(session.expiresAt.getTime() - c.now()).toBe(4 * 3_600_000);
    expect(store.session(token)).toEqual(session);
    expect(JSON.stringify([...store.debugKeys()])).not.toContain(token.slice(4));
  });

  it("ends a session at its absolute expiry, with no sliding", () => {
    const c = clock();
    const store = operatorAuthStore({ now: c.now });
    const { token } = store.open({ mint: "DemoMint111", wallet: W1 });
    c.advance(4 * 3_600_000 - 1);
    expect(store.session(token)).not.toBeNull();
    c.advance(1);
    expect(store.session(token)).toBeNull();
  });

  it("signs out, refuses unknown and malformed tokens", () => {
    const store = operatorAuthStore();
    const { token } = store.open({ mint: "DemoMint111", wallet: W1 });
    expect(store.end(token)).toBe(true);
    expect(store.session(token)).toBeNull();
    expect(store.end(token)).toBe(false);
    expect(store.session("hop_x")).toBeNull();
    expect(store.session(`hop_${"A".repeat(43)}`)).toBeNull();
  });

  it("keeps at most 3 sessions per wallet (the oldest goes) and a global cap", () => {
    const c = clock();
    const store = operatorAuthStore({ now: c.now, maxSessions: 4 });
    const tokens = [1, 2, 3, 4].map(() => {
      c.advance(1);
      return store.open({ mint: "DemoMint111", wallet: W1 }).token;
    });
    expect(store.session(tokens[0] as string)).toBeNull();
    expect(tokens.slice(1).every((t) => store.session(t) !== null)).toBe(true);
    const other = [1, 2].map(() => {
      c.advance(1);
      return store.open({ mint: "DemoMint111", wallet: W2 }).token;
    });
    // Global cap 4: the oldest sessions overall go first.
    expect(store.session(tokens[1] as string)).toBeNull();
    expect(other.every((t) => store.session(t) !== null)).toBe(true);
  });

  it("ends every session of a wallet for a mint", () => {
    const store = operatorAuthStore();
    const a = store.open({ mint: "DemoMint111", wallet: W1 }).token;
    const b = store.open({ mint: "OtherMint", wallet: W1 }).token;
    store.endWallet({ mint: "DemoMint111", wallet: W1 });
    expect(store.session(a)).toBeNull();
    expect(store.session(b)).not.toBeNull();
  });
});
