"use client";

import { getBase58Decoder } from "@solana/kit";
import { getWallets } from "@wallet-standard/app";
import { useEffect, useState } from "react";

// Browser half of the operator page. It never holds the session token: the proxy routes set and
// read the httpOnly cookie. The only signature asked for is the one-line sign-in message.

type Account = { address: string; chains: readonly string[] };
type SignWallet = { name: string; features: Record<string, unknown> };
type Connect = { connect(): Promise<{ accounts: readonly Account[] }> };
type SignMessage = {
  signMessage(
    ...inputs: { account: Account; message: Uint8Array }[]
  ): Promise<readonly { signature: Uint8Array }[]>;
};
type Challenge = { challenge_id: string; message: string; expires_at: string };

const CONNECT = "standard:connect";
const SIGN = "solana:signMessage";

const messages: Record<string, string> = {
  unauthorized: "The signature did not match, or the sign-in message expired. Start again.",
  forbidden: "This wallet is not the community's on-chain admin.",
  not_found: "Unknown community.",
  disabled: "The operator page is turned off.",
  invalid_request: "That input is not valid.",
};
const UNAVAILABLE = "Unavailable right now. Try again in a minute.";
const explain = (code: string): string => messages[code] ?? UNAVAILABLE;

async function post(path: string, body: unknown): Promise<{ ok: boolean; data: unknown }> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
  return { ok: response.ok, data: await response.json().catch(() => ({ error: "unavailable" })) };
}
const errorOf = (data: unknown) =>
  typeof data === "object" &&
  data !== null &&
  typeof (data as { error?: unknown }).error === "string"
    ? (data as { error: string }).error
    : "unavailable";

function signWallets(): SignWallet[] {
  return (getWallets().get() as unknown as SignWallet[]).filter(
    (w) => CONNECT in w.features && SIGN in w.features,
  );
}

export function OperatorSignIn({ mint }: { mint: string }) {
  const [wallets, setWallets] = useState<SignWallet[]>([]);
  const [mode, setMode] = useState<"wallet" | "cli">("wallet");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cliWallet, setCliWallet] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [signature, setSignature] = useState("");

  useEffect(() => {
    setWallets(signWallets());
    return getWallets().on("register", () => setWallets(signWallets()));
  }, []);

  async function finish(challengeId: string, sig: string) {
    const result = await post("/api/operator/session", {
      challenge_id: challengeId,
      signature: sig,
    });
    if (!result.ok) throw new Error(errorOf(result.data));
    window.location.reload();
  }

  async function ask(wallet: string): Promise<Challenge> {
    const result = await post("/api/operator/challenge", { mint, wallet });
    if (!result.ok) throw new Error(errorOf(result.data));
    return result.data as Challenge;
  }

  async function withWallet(w: SignWallet) {
    setError(null);
    setBusy(true);
    try {
      const { accounts } = await (w.features[CONNECT] as Connect).connect();
      const account = accounts[0];
      if (!account) throw new Error("unavailable");
      const c = await ask(account.address);
      const [out] = await (w.features[SIGN] as SignMessage).signMessage({
        account,
        message: new TextEncoder().encode(c.message),
      });
      if (!out) throw new Error("unauthorized");
      await finish(c.challenge_id, getBase58Decoder().decode(out.signature));
    } catch (e) {
      setError(explain(e instanceof Error ? e.message : "unavailable"));
    } finally {
      setBusy(false);
    }
  }

  async function cliChallenge() {
    setError(null);
    setBusy(true);
    try {
      setChallenge(await ask(cliWallet.trim()));
      setSignature("");
    } catch (e) {
      setError(explain(e instanceof Error ? e.message : "unavailable"));
    } finally {
      setBusy(false);
    }
  }

  async function cliFinish() {
    if (!challenge) return;
    setError(null);
    setBusy(true);
    try {
      await finish(challenge.challenge_id, signature.trim());
    } catch (e) {
      setChallenge(null);
      setError(explain(e instanceof Error ? e.message : "unavailable"));
    } finally {
      setBusy(false);
    }
  }

  const command = challenge
    ? `solana sign-offchain-message -k usb://ledger "${challenge.message}"`
    : "";
  return (
    <div className="operator-signin">
      <div className="operator-tabs" role="tablist" aria-label="Sign-in method">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "wallet"}
          onClick={() => setMode("wallet")}
        >
          Browser wallet
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "cli"}
          onClick={() => setMode("cli")}
        >
          Solana CLI (Ledger)
        </button>
      </div>
      {mode === "wallet" ? (
        <div role="tabpanel">
          {wallets.length === 0 ? (
            <p className="muted">
              No wallet that can sign messages was found in this browser. Use the Solana CLI method.
            </p>
          ) : (
            <ul className="operator-wallets">
              {wallets.map((w) => (
                <li key={w.name}>
                  <button type="button" disabled={busy} onClick={() => withWallet(w)}>
                    Sign in with {w.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="operator-cli">
          <label>
            Admin wallet address
            <input
              className="mono"
              value={cliWallet}
              onChange={(e) => setCliWallet(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <button type="button" disabled={busy || cliWallet.trim() === ""} onClick={cliChallenge}>
            Get the sign-in message
          </button>
          {challenge ? (
            <>
              <p className="small">
                Run this, approve it on the Ledger, then paste the signature it prints. If the admin
                is not the Ledger's first account, use {'"usb://ledger?key=<account>"'}. It expires
                at {challenge.expires_at.slice(11, 16)} UTC.
              </p>
              <pre className="operator-command mono">{command}</pre>
              <button type="button" onClick={() => navigator.clipboard?.writeText(command)}>
                Copy command
              </button>
              <label>
                Signature
                <input
                  className="mono"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
              <button type="button" disabled={busy || signature.trim() === ""} onClick={cliFinish}>
                Sign in
              </button>
            </>
          ) : null}
        </div>
      )}
      <p className="small muted">
        The message proves you control the wallet. It approves no transaction and moves no funds.
      </p>
      {error ? (
        <p className="operator-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function OperatorSignOut() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/operator/session", {
          method: "DELETE",
          credentials: "same-origin",
        }).catch(() => undefined);
        window.location.reload();
      }}
    >
      Sign out
    </button>
  );
}

export function OperatorPayable({ mint, index }: { mint: string; index: number }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; wallets: string[] }
    | { kind: "error"; code: string }
  >({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  async function load() {
    setState({ kind: "loading" });
    try {
      const response = await fetch(
        `/api/operator/${encodeURIComponent(mint)}/epochs/${index}/payable`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const data = await response.json().catch(() => ({ error: "unavailable" }));
      if (!response.ok) return setState({ kind: "error", code: errorOf(data) });
      setState({ kind: "ok", wallets: (data as { wallets: string[] }).wallets });
    } catch {
      setState({ kind: "error", code: "unavailable" });
    }
  }
  if (state.kind === "idle" || state.kind === "loading")
    return (
      <button type="button" disabled={state.kind === "loading"} onClick={load}>
        {state.kind === "loading" ? "Loading…" : "Show payable wallets"}
      </button>
    );
  if (state.kind === "error") return <p className="operator-error">{explain(state.code)}</p>;
  const { wallets } = state;
  return (
    <div className="operator-payable">
      <p className="small">
        {wallets.length} payable {wallets.length === 1 ? "wallet" : "wallets"}, sorted by address.
      </p>
      <ol className="mono">
        {wallets.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ol>
      {wallets.length > 0 ? (
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(wallets.join("\n"));
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy wallets"}
        </button>
      ) : null}
    </div>
  );
}
