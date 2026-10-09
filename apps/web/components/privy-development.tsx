"use client";
import { PrivyProvider, useLogin, usePrivy } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { useState } from "react";

export function PrivyDevelopmentProvider({ appId }: { appId: string }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: { theme: "light", accentColor: "#171717", walletChainType: "solana-only" },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors({ shouldAutoConnect: false }) },
        },
        embeddedWallets: { ethereum: { createOnLogin: "off" }, solana: { createOnLogin: "off" } },
      }}
    >
      <PrivyDevelopmentSession />
    </PrivyProvider>
  );
}

export function PrivyDevelopmentSession() {
  const { ready, authenticated, logout } = usePrivy();
  const [phase, setPhase] = useState<"idle" | "pending" | "failed" | "done">("idle");
  const [notice, setNotice] = useState("");
  const { login } = useLogin({ onError: () => setNotice("Sign-in did not finish. Try again.") });
  const signOut = async () => {
    setPhase("pending");
    setNotice("");
    try {
      await logout();
      setPhase("done");
    } catch {
      setPhase("failed");
    }
  };
  const signIn = (method: "email" | "wallet") => {
    setPhase("idle");
    setNotice("");
    login({ loginMethods: [method] });
  };
  const signedIn = ready && authenticated && phase === "idle";
  return (
    <section className="member-account" aria-labelledby="privy-test-title">
      <p className="muted">Hyphae · Local development</p>
      <h1 id="privy-test-title">Try signing in</h1>
      <p>Test email or an existing Solana wallet with Hyphae Development.</p>
      <p className="small muted">
        Private community access stays disabled. This test does not link Telegram, change your
        reward wallet or create a wallet.
      </p>
      <div role="status" aria-live="polite" aria-atomic="true">
        {!ready ? <p>Connecting to Privy…</p> : null}
        {notice ? <p>{notice}</p> : null}
        {signedIn ? <p>Signed in to the development app. You can now test sign-out.</p> : null}
        {phase === "pending" ? <p>Signing out of the development app…</p> : null}
        {phase === "failed" ? (
          <p>Sign-out did not finish. Retry before leaving this test.</p>
        ) : null}
        {phase === "done" ? <p>Signed out of this test.</p> : null}
      </div>
      <div className="member-actions">
        {signedIn || phase === "pending" || phase === "failed" ? (
          <button
            className="button button-secondary"
            type="button"
            disabled={phase === "pending"}
            onClick={() => {
              void signOut();
            }}
          >
            {phase === "pending"
              ? "Signing out…"
              : phase === "failed"
                ? "Retry sign out"
                : "Sign out"}
          </button>
        ) : (
          <>
            <button
              className="button"
              type="button"
              disabled={!ready || authenticated}
              onClick={() => signIn("email")}
            >
              Sign in with email
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={!ready || authenticated}
              onClick={() => signIn("wallet")}
            >
              Use an existing Solana wallet
            </button>
          </>
        )}
      </div>
      <p className="small">
        <a href="/community">Return to the community</a>
      </p>
    </section>
  );
}
