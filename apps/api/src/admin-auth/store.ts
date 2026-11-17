import { createHash, randomBytes, randomUUID } from "node:crypto";
import { type OperatorMessageFields, operatorMessage } from "./message.js";

// Sign-in challenges and operator sessions, in this API process's memory. No table, no secret:
// a restart signs everyone out, which is fine while one API machine serves the admin surface.
// The store keeps a session's sha256 only, never the token it handed out.

export const CHALLENGE_TTL_MS = 5 * 60_000;
export const SESSION_TTL_MS = 4 * 3_600_000;
const PER_WALLET = 3;
const TOKEN = /^hop_[A-Za-z0-9_-]{43}$/;

export interface Challenge extends OperatorMessageFields {
  id: string;
  message: string;
}

export interface OperatorSessionRecord {
  mint: string;
  wallet: string;
  createdAt: Date;
  expiresAt: Date;
}

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export function operatorAuthStore(
  opts: { now?: () => number; maxChallenges?: number; maxSessions?: number } = {},
) {
  const now = opts.now ?? Date.now;
  const maxChallenges = opts.maxChallenges ?? 1000;
  const maxSessions = opts.maxSessions ?? 500;
  const challenges = new Map<string, Challenge>();
  // Insertion order is creation order: the first entry is the oldest.
  const sessions = new Map<string, OperatorSessionRecord>();

  const sweepChallenges = (t: number) => {
    for (const [id, c] of challenges) if (c.expiresAt.getTime() <= t) challenges.delete(id);
  };
  const sweepSessions = (t: number) => {
    for (const [key, s] of sessions) if (s.expiresAt.getTime() <= t) sessions.delete(key);
  };

  return {
    // Null when the store is full of open challenges: refuse rather than evict a live one.
    issue(
      input: Omit<OperatorMessageFields, "nonce" | "issuedAt" | "expiresAt">,
    ): Challenge | null {
      const t = now();
      if (challenges.size >= maxChallenges) sweepChallenges(t);
      if (challenges.size >= maxChallenges) return null;
      const fields: OperatorMessageFields = {
        ...input,
        nonce: randomBytes(32).toString("base64url"),
        issuedAt: new Date(t),
        expiresAt: new Date(t + CHALLENGE_TTL_MS),
      };
      const challenge = { ...fields, id: randomUUID(), message: operatorMessage(fields) };
      challenges.set(challenge.id, challenge);
      return challenge;
    },
    // Removes the challenge before anything else looks at it: one attempt per challenge, a
    // failed attempt included. Null when unknown, already taken or expired.
    take(id: string): Challenge | null {
      const challenge = challenges.get(id);
      if (!challenge) return null;
      challenges.delete(id);
      return challenge.expiresAt.getTime() > now() ? challenge : null;
    },
    open(input: { mint: string; wallet: string }): {
      token: string;
      session: OperatorSessionRecord;
    } {
      const t = now();
      sweepSessions(t);
      const mine = [...sessions].filter(([, s]) => s.wallet === input.wallet);
      for (const [key] of mine.slice(0, Math.max(0, mine.length - PER_WALLET + 1)))
        sessions.delete(key);
      while (sessions.size >= maxSessions) {
        const oldest = sessions.keys().next().value;
        if (oldest === undefined) break;
        sessions.delete(oldest);
      }
      const token = `hop_${randomBytes(32).toString("base64url")}`;
      const session = {
        mint: input.mint,
        wallet: input.wallet,
        createdAt: new Date(t),
        expiresAt: new Date(t + SESSION_TTL_MS),
      };
      sessions.set(digest(token), session);
      return { token, session };
    },
    session(token: string): OperatorSessionRecord | null {
      if (!TOKEN.test(token)) return null;
      const key = digest(token);
      const session = sessions.get(key);
      if (!session) return null;
      if (session.expiresAt.getTime() <= now()) {
        sessions.delete(key);
        return null;
      }
      return session;
    },
    end(token: string): boolean {
      return TOKEN.test(token) && sessions.delete(digest(token));
    },
    // The on-chain admin changed: every session of that wallet for that community ends.
    endWallet(input: { mint: string; wallet: string }): void {
      for (const [key, s] of sessions)
        if (s.mint === input.mint && s.wallet === input.wallet) sessions.delete(key);
    },
    // Tests only: the keys the store holds.
    debugKeys(): IterableIterator<string> {
      return sessions.keys();
    },
  };
}

export type OperatorAuthStore = ReturnType<typeof operatorAuthStore>;
