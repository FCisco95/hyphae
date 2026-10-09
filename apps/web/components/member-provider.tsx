"use client";

import { PrivyProvider, useLinkAccount, useLogin, usePrivy } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { useCallback, useEffect, useRef, useState } from "react";
import { MemberAccountView, type MemberViewState } from "./member-account.js";
import { readMemberState, requestGeneration } from "./member-session.js";

type Community = { mint: string; name: string };

export function MemberProvider({ appId, community }: { appId: string; community: Community }) {
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
      <MemberSession community={community} />
    </PrivyProvider>
  );
}

export function MemberSession({ community }: { community: Community }) {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const [resolved, setResolved] = useState<{ key: string | null; state: MemberViewState }>({
    key: null,
    state: { kind: "loading" },
  });
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [logoutPhase, setLogoutPhase] = useState<"idle" | "pending" | "failed" | "done">("idle");
  const generation = useRef(requestGeneration());
  const suppressed = useRef(false);
  const logoutSubject = useRef<string | undefined>(undefined);
  const subject = useRef(user?.id);
  subject.current = user?.id;
  const telegram = user?.telegram?.telegramUserId;
  const requestKey = user?.id
    ? JSON.stringify([community.mint, user.id, telegram ?? null, revision])
    : null;
  // Mask the previous identity during render, before the next effect can clear its response.
  const state: MemberViewState =
    logoutPhase === "pending"
      ? { kind: "signing_out" }
      : logoutPhase === "failed"
        ? { kind: "signout_failed" }
        : logoutPhase === "done" || (!authenticated && ready)
          ? { kind: "logged_out" }
          : resolved.key === requestKey
            ? resolved.state
            : { kind: "loading" };
  const setState = useCallback(
    (next: MemberViewState) => setResolved({ key: requestKey, state: next }),
    [requestKey],
  );
  const refresh = useCallback(() => {
    generation.current.invalidate();
    setState({ kind: "loading" });
    setNotice("");
    setRevision((current) => current + 1);
  }, [setState]);
  const { login } = useLogin({
    onError: () => setNotice("Sign-in did not finish. Try again or use email."),
  });
  const { linkTelegram } = useLinkAccount({
    onSuccess: ({ user: linked }) => {
      if (linked.id === subject.current) refresh();
    },
    onError: () => {
      refresh();
      setNotice("Telegram was not connected. You can try again.");
    },
  });
  useEffect(() => {
    const reads = generation.current;
    reads.invalidate();
    if (suppressed.current && logoutSubject.current !== subject.current) {
      suppressed.current = false;
      setLogoutPhase("idle");
    }
    if (!ready) {
      setState({ kind: "loading" });
      return;
    }
    if (!authenticated) {
      suppressed.current = false;
      setLogoutPhase("idle");
      setState({ kind: "logged_out" });
      return;
    }
    if (suppressed.current) {
      return;
    }
    if (!requestKey) {
      setState({ kind: "loading" });
      return;
    }
    setState({ kind: "loading" });
    void reads
      .run(async (signal) => {
        try {
          // Let the provider renew its session; the access credential is never forwarded by JS.
          await getAccessToken();
          signal.throwIfAborted();
          let result = await readMemberState(community.mint, signal);
          if (result.kind === "logged_out") {
            await getAccessToken();
            signal.throwIfAborted();
            result = await readMemberState(community.mint, signal);
          }
          return result.kind === "logged_out" ? ({ kind: "session_expired" } as const) : result;
        } catch {
          return { kind: "unavailable" } as MemberViewState;
        }
      }, setState)
      .catch(() => {});
    return () => reads.invalidate();
  }, [ready, authenticated, requestKey, community.mint, getAccessToken, setState]);

  const signOut = () => {
    suppressed.current = true;
    logoutSubject.current = subject.current;
    setLogoutPhase("pending");
    generation.current.invalidate();
    setState({ kind: "signing_out" });
    setNotice("");
    const signingOutSubject = subject.current;
    void logout().then(
      () => {
        if (signingOutSubject === subject.current) setLogoutPhase("done");
      },
      () => {
        if (signingOutSubject === subject.current) setLogoutPhase("failed");
      },
    );
  };
  const beginLogin = (method: "email" | "wallet") => {
    suppressed.current = false;
    setLogoutPhase("idle");
    generation.current.invalidate();
    setState({ kind: "logged_out" });
    setNotice("");
    login({ loginMethods: [method] });
  };
  const connectTelegram = () => {
    generation.current.invalidate();
    setState({ kind: "loading" });
    setNotice("");
    linkTelegram();
  };
  return (
    <MemberAccountView
      community={community}
      state={state}
      notice={notice}
      emailLogin={() => beginLogin("email")}
      walletLogin={() => beginLogin("wallet")}
      linkTelegram={connectTelegram}
      logout={signOut}
      refresh={refresh}
    />
  );
}
