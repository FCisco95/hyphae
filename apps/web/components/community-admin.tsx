"use client";

import { useLinkAccount, useLogin, usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { type AdminState, renewAdminSession, requestAdminState } from "../lib/admin-session.js";
import { utc } from "../lib/format.js";
import { CommunityLoginProvider } from "./community-login-provider.js";
import { requestGeneration } from "./member-session.js";

type Community = { mint: string; name: string };
export function AdminProvider({ appId, community }: { appId: string; community: Community }) {
  return (
    <CommunityLoginProvider appId={appId}>
      <AdminSession community={community} />
    </CommunityLoginProvider>
  );
}

export function AdminSession({ community }: { community: Community }) {
  const { ready, authenticated, user, getAccessToken, logout } = usePrivy();
  const tokenReader = useRef(getAccessToken);
  tokenReader.current = getAccessToken;
  const [revision, setRevision] = useState(0);
  const key = user?.id
    ? JSON.stringify([community.mint, user.id, user.telegram?.telegramUserId ?? null, revision])
    : null;
  const current = useRef(key);
  current.current = ready && authenticated ? key : null;
  const subject = useRef(user?.id);
  subject.current = user?.id;
  const [resolved, setResolved] = useState<{ key: string | null; state: AdminState }>({
    key: null,
    state: { kind: "loading" },
  });
  const [logoutPhase, setLogoutPhase] = useState<"idle" | "pending" | "failed" | "done">("idle");
  const suppressed = useRef(false);
  const logoutSubject = useRef<string | undefined>(undefined);
  const reads = useRef(requestGeneration());
  const mutation = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    key: string;
    pausedAt: string | null;
    desired: boolean;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const state: AdminState = !ready
    ? { kind: "loading" }
    : !authenticated || logoutPhase === "done"
      ? { kind: "logged_out" }
      : resolved.key === key
        ? resolved.state
        : { kind: "loading" };
  const account = logoutPhase === "idle" && state.kind === "admin" ? state.account : null;
  const busy = busyKey !== null && busyKey === key;
  const confirm = account && confirmation?.key === key ? confirmation : null;
  const setState = useCallback((next: AdminState) => setResolved({ key, state: next }), [key]);
  const cancelWork = useCallback(() => {
    reads.current.invalidate();
    mutation.current?.abort();
    writing.current = false;
    setBusyKey(null);
    setConfirmation(null);
  }, []);
  const refresh = useCallback(() => {
    cancelWork();
    setState({ kind: "loading" });
    setNotice("");
    setRevision((value) => value + 1);
  }, [cancelWork, setState]);
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
    const generation = reads.current;
    generation.invalidate();
    mutation.current?.abort();
    writing.current = false;
    setConfirmation(null);
    setBusyKey(null);
    setNotice("");
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
    if (suppressed.current || !key) return;
    setState({ kind: "loading" });
    void generation
      .run(async (signal) => {
        try {
          await renewAdminSession(() => tokenReader.current(), signal);
          let result = await requestAdminState(community.mint, signal);
          if (result.kind === "logged_out") {
            await renewAdminSession(() => tokenReader.current(), signal);
            result = await requestAdminState(community.mint, signal);
          }
          return result.kind === "logged_out" ? ({ kind: "session_expired" } as const) : result;
        } catch {
          return { kind: "unavailable" } as const;
        }
      }, setState)
      .catch(() => {});
    return () => {
      generation.invalidate();
      mutation.current?.abort();
    };
  }, [ready, authenticated, key, community.mint, setState]);
  const signOut = () => {
    suppressed.current = true;
    logoutSubject.current = subject.current;
    cancelWork();
    setLogoutPhase("pending");
    setState({ kind: "logged_out" });
    setNotice("");
    const signingOut = subject.current;
    void logout().then(
      () => {
        if (subject.current === signingOut) setLogoutPhase("done");
      },
      () => {
        if (subject.current === signingOut) setLogoutPhase("failed");
      },
    );
  };
  const beginLogin = (method: "email" | "wallet") => {
    suppressed.current = false;
    cancelWork();
    setLogoutPhase("idle");
    setNotice("");
    login({ loginMethods: [method] });
  };
  const save = async () => {
    if (!confirm || !key || current.current !== key || writing.current || suppressed.current)
      return;
    const requestKey = key;
    const abort = new AbortController();
    mutation.current = abort;
    writing.current = true;
    setBusyKey(key);
    setNotice("");
    try {
      await renewAdminSession(() => tokenReader.current(), abort.signal);
      if (abort.signal.aborted || current.current !== requestKey || suppressed.current) return;
      // Never retry a write, including after token renewal or an ambiguous network failure.
      const result = await requestAdminState(community.mint, abort.signal, {
        paused: confirm.desired,
        expected_paused_at: confirm.pausedAt,
      });
      if (abort.signal.aborted || current.current !== requestKey || suppressed.current) return;
      setConfirmation(null);
      if (result.kind === "admin") refresh();
      else if (result.kind === "logged_out") setState({ kind: "session_expired" });
      else setState(result);
    } catch {
      if (!abort.signal.aborted && current.current === requestKey && !suppressed.current) {
        setConfirmation(null);
        setState({ kind: "write_unknown" });
      }
    } finally {
      if (mutation.current === abort) {
        mutation.current = null;
        writing.current = false;
        setBusyKey(null);
      }
    }
  };
  return (
    <section className="member-account" aria-labelledby="community-admin-title">
      <div className="member-account-heading">
        <h2 id="community-admin-title">Administrator controls</h2>
        {authenticated && logoutPhase !== "pending" && logoutPhase !== "done" ? (
          <button type="button" className="button button-secondary" onClick={signOut}>
            Sign out
          </button>
        ) : null}
      </div>
      <p>Pause or resume new submissions only. This does not change payouts or epoch dates.</p>
      <div aria-live="polite" aria-atomic="true">
        {notice ? <p role="status">{notice}</p> : null}
        {logoutPhase === "pending" ? (
          <p role="status">Signing out…</p>
        ) : logoutPhase === "failed" ? (
          <p>
            Sign-out did not finish. Your session may still be active. Use Sign out to try again.
          </p>
        ) : (
          <>
            {state.kind === "logged_out" ? (
              <>
                <p>
                  Sign in to verify your administrator access for this community. Signing in with a
                  wallet does not grant administrator access or change your reward wallet.
                </p>
                <div className="member-actions">
                  <button type="button" className="button" onClick={() => beginLogin("email")}>
                    Sign in with email
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => beginLogin("wallet")}
                  >
                    Use an existing Solana wallet
                  </button>
                </div>
                <p className="small muted">
                  No wallet is created for you. If your hardware wallet cannot sign in, use email.
                </p>
              </>
            ) : null}
            {state.kind === "loading" ? <p role="status">Checking administrator access…</p> : null}
            {state.kind === "session_expired" ? (
              <p>Sign out, then sign in again to reconnect your session.</p>
            ) : null}
            {state.kind === "forbidden" ? (
              <p>
                Administrator access could not be verified. Only this community&apos;s designated
                administrator with a current Telegram administrator role can change intake.
              </p>
            ) : null}
            {state.kind === "not_found" ? (
              <p>Administrator controls are not available for this community right now.</p>
            ) : null}
            {state.kind === "unavailable" ? (
              <p>Administrator settings could not be checked. Reload settings to try again.</p>
            ) : null}
            {state.kind === "rate_limited" ? (
              <p>Too many requests. Wait before reloading settings.</p>
            ) : null}
            {state.kind === "conflict" ? (
              <p>
                Settings changed since you loaded them. Reload settings before confirming another
                change.
              </p>
            ) : null}
            {state.kind === "write_unknown" ? (
              <p>
                The update could not be confirmed and may have been applied. Reload settings before
                trying again.
              </p>
            ) : null}
            {authenticated && !user?.telegram && state.kind !== "loading" ? (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  cancelWork();
                  setState({ kind: "loading" });
                  linkTelegram();
                }}
              >
                Connect Telegram
              </button>
            ) : null}
            {account ? (
              <>
                <p>
                  <strong>New submissions are {account.intake.paused ? "paused" : "open"}.</strong>
                </p>
                <p className="small muted">
                  Private settings read as of {utc(account.as_of)}
                  {account.intake.paused_at ? ` · paused ${utc(account.intake.paused_at)}` : ""}.
                </p>
                {confirm ? (
                  <fieldset className="admin-confirm">
                    <legend>
                      {confirm.desired ? "Pause new submissions?" : "Resume new submissions?"}
                    </legend>
                    <p>
                      {confirm.desired
                        ? "New contributions will not be accepted while intake is paused."
                        : "New contributions can be accepted within the current epoch and its existing rules."}
                    </p>
                    <div className="member-actions">
                      <button
                        type="button"
                        className="button"
                        disabled={busy}
                        onClick={() => void save()}
                      >
                        {busy ? "Saving…" : confirm.desired ? "Confirm pause" : "Confirm resume"}
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={busy}
                        onClick={() => setConfirmation(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </fieldset>
                ) : (
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      if (key)
                        setConfirmation({
                          key,
                          pausedAt: account.intake.paused_at,
                          desired: !account.intake.paused,
                        });
                    }}
                  >
                    {account.intake.paused ? "Resume new submissions" : "Pause new submissions"}
                  </button>
                )}
              </>
            ) : null}
            {state.kind !== "loading" &&
            state.kind !== "logged_out" &&
            state.kind !== "session_expired" ? (
              <div className="member-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={busy}
                  onClick={refresh}
                >
                  Reload settings
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
