import { createHash, randomUUID } from "node:crypto";
import type { BlockhashLifetime } from "../payout/chain.js";
import type { InitTarget } from "../payout/community-init.js";
import type { PublishArgs } from "../payout/publish.js";

// Transactions the operator page built and handed to the admin's wallet, in this API process's
// memory (one API machine, as the sessions). A build is bound to the session, mint and wallet that
// asked for it, holds the exact message bytes the wallet must sign and what they were built from,
// and is used once. Nothing here is a key or a signature the API made.

export const BUILD_TTL_MS = 120_000;
// How long a finished build stays visible to the page's status poll.
const KEEP_MS = 10 * 60_000;
const MAX_BUILDS = 200;
// How many messages keep an owner at once (see owners below).
const MAX_OWNERS = 5000;

export type BuildState = "awaiting_signature" | "submitting" | "done" | "failed" | "expired";

export type BuildPlan =
  | { kind: "publish"; args: PublishArgs; epochIndex: number }
  | { kind: "init"; target: InitTarget; community: string; vault: string };

export interface BuildRecord {
  id: string;
  sessionId: string;
  mint: string;
  wallet: string;
  plan: BuildPlan;
  messageBytes: Uint8Array;
  lifetime: BlockhashLifetime;
  createdAt: Date;
  expiresAt: Date;
  state: BuildState;
  // The transaction's signature once it was sent.
  signature: string | null;
  endedAt: Date | null;
}

export type Taken =
  | { status: "ok"; build: BuildRecord }
  | { status: "refused"; reason: "build_unknown" | "expired" };

export function buildStore(opts: { now?: () => number; max?: number; maxOwners?: number } = {}) {
  const now = opts.now ?? Date.now;
  const max = opts.max ?? MAX_BUILDS;
  const maxOwners = opts.maxOwners ?? MAX_OWNERS;
  // Insertion order is creation order.
  const builds = new Map<string, BuildRecord>();
  // A message belongs to the session that built it first until a block height read from the
  // chain is past its last valid height: no wall clock proves a blockhash expired (a stalled
  // chain keeps it valid). ed25519 is deterministic, so one admin signature fits every build of
  // the same bytes; without this, a session could submit a signature another session obtained
  // (review rounds 2 to 5). Full: new builds are refused, never an owner evicted. The restart
  // case (an empty table) is closed by the build's start-height floor (publish.ts).
  const owners = new Map<string, { sessionId: string; lastValid: bigint }>();
  const fingerprint = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  // The highest block height read from the chain.
  let observed = -1n;

  const end = (b: BuildRecord, state: BuildState, t: number) => {
    b.state = state;
    b.endedAt = new Date(t);
  };
  const sweep = (t: number) => {
    for (const [id, b] of builds) {
      if (b.state === "awaiting_signature" && b.expiresAt.getTime() <= t) end(b, "expired", t);
      if (b.endedAt && b.endedAt.getTime() + KEEP_MS <= t) builds.delete(id);
    }
    for (const [key, o] of owners) if (observed > o.lastValid) owners.delete(key);
  };

  return {
    // One open build per community: a new build ends the one before it.
    put(input: Omit<BuildRecord, "id" | "createdAt" | "state" | "signature" | "endedAt">) {
      const t = now();
      sweep(t);
      const key = fingerprint(input.messageBytes);
      if (!owners.has(key) && owners.size >= maxOwners)
        throw new Error("builds: too many recent messages; try again in a while");
      for (const b of builds.values())
        if (b.mint === input.mint && b.state === "awaiting_signature") end(b, "expired", t);
      while (builds.size >= max) {
        const oldest = builds.keys().next().value;
        if (oldest === undefined) break;
        builds.delete(oldest);
      }
      const build: BuildRecord = {
        ...input,
        id: randomUUID(),
        createdAt: new Date(t),
        expiresAt: new Date(Math.min(input.expiresAt.getTime(), t + BUILD_TTL_MS)),
        state: "awaiting_signature",
        signature: null,
        endedAt: null,
      };
      builds.set(build.id, build);
      // The first session keeps the bytes; a later build of them never takes them over.
      if (!owners.has(key))
        owners.set(key, {
          sessionId: build.sessionId,
          lastValid: build.lifetime.lastValidBlockHeight,
        });
      return build;
    },
    // Taken once, before any other check looks at it: whatever happens next, it is spent. Only
    // the session that built it, for the same community and kind, can take it.
    take(id: string, who: { sessionId: string; mint: string; kind: BuildPlan["kind"] }): Taken {
      const t = now();
      const b = builds.get(id);
      if (
        !b ||
        b.sessionId !== who.sessionId ||
        b.mint !== who.mint ||
        b.plan.kind !== who.kind ||
        b.state !== "awaiting_signature"
      )
        return { status: "refused", reason: "build_unknown" };
      if (b.expiresAt.getTime() <= t) {
        end(b, "expired", t);
        return { status: "refused", reason: "expired" };
      }
      // The same bytes, first built by another session: its signature must not land here.
      // Missing means freed: the chain is past its height, so the bytes can no longer land.
      const owner = owners.get(fingerprint(b.messageBytes));
      if (!owner || owner.sessionId !== who.sessionId) {
        end(b, "failed", t);
        return { status: "refused", reason: "build_unknown" };
      }
      b.state = "submitting";
      return { status: "ok", build: b };
    },
    // A block height read from the chain (a submit's check); it frees messages past their height.
    observe(height: bigint) {
      if (height > observed) observed = height;
      sweep(now());
    },
    finish(build: BuildRecord, state: "done" | "failed" | "expired", signature: string | null) {
      build.signature = signature ?? build.signature;
      end(build, state, now());
    },
    // The session's latest build for this community.
    latest(sessionId: string, mint: string): BuildRecord | null {
      return this.recent(sessionId, mint).at(-1) ?? null;
    },
    // The session's recent builds for this community, oldest first: a page polls its own build
    // by id, so another tab's newer build is never read as its outcome.
    recent(sessionId: string, mint: string, limit = 5): BuildRecord[] {
      sweep(now());
      const mine = [...builds.values()].filter((b) => b.sessionId === sessionId && b.mint === mint);
      return mine.slice(-limit);
    },
  };
}

export type BuildStore = ReturnType<typeof buildStore>;
