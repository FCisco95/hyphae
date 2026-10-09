import type { MemberAccount } from "@hyphae/core";
import { utc } from "../lib/format.js";
import { ButtonLink } from "./ui.js";

export type MemberViewState =
  | {
      kind:
        | "disabled"
        | "logged_out"
        | "loading"
        | "unavailable"
        | "rate_limited"
        | "signing_out"
        | "signout_failed"
        | "session_expired";
    }
  | { kind: "account"; account: MemberAccount };
export function MemberAccountView({
  community,
  state,
  emailLogin,
  walletLogin,
  linkTelegram,
  logout,
  refresh,
  notice,
}: {
  community: { mint: string; name: string };
  state: MemberViewState;
  emailLogin?: () => void;
  walletLogin?: () => void;
  linkTelegram?: () => void;
  logout?: () => void;
  refresh?: () => void;
  notice?: string;
}): React.ReactNode {
  const base = `/c/${encodeURIComponent(community.mint)}`;
  const account = state.kind === "account" ? state.account : null;
  return (
    <section className="member-account" aria-labelledby="member-account-title">
      <div className="member-account-heading">
        <div>
          <p className="muted">{community.name}</p>
          <h1 id="member-account-title">Your account</h1>
        </div>
        {logout &&
        state.kind !== "disabled" &&
        state.kind !== "logged_out" &&
        state.kind !== "signing_out" ? (
          <button className="button button-secondary" type="button" onClick={logout}>
            Sign out
          </button>
        ) : null}
      </div>
      {notice ? <p role="status">{notice}</p> : null}
      <div aria-live="polite" aria-atomic="true">
        {state.kind === "disabled" ? (
          <>
            <h2>Sign-in is not available yet</h2>
            <p>You can still read the project context and use the existing member setup guide.</p>
            <ButtonLink href={`${base}/join`}>Open the setup guide</ButtonLink>
          </>
        ) : null}
        {state.kind === "logged_out" ? (
          <>
            <h2>Keep your membership connected.</h2>
            <p>
              Sign in with email or an existing Solana wallet, then connect your Telegram
              membership.
            </p>
            <div className="member-actions">
              <button className="button" type="button" onClick={emailLogin} disabled={!emailLogin}>
                Sign in with email
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={walletLogin}
                disabled={!walletLogin}
              >
                Use an existing Solana wallet
              </button>
            </div>
            <p className="small muted">
              Signing in does not set your reward wallet. No wallet is created for you.
            </p>
            <p className="small muted">
              If your hardware wallet does not support message sign-in, use email.
            </p>
          </>
        ) : null}
        {state.kind === "loading" ? <p role="status">Checking your account…</p> : null}
        {state.kind === "signing_out" ? <p role="status">Signing out…</p> : null}
        {state.kind === "signout_failed" ? (
          <p>
            Sign-out did not finish. Your session may still be active. Use Sign out to try again.
          </p>
        ) : null}
        {state.kind === "session_expired" ? (
          <>
            <h2>Sign out to reconnect</h2>
            <p>
              We could not verify your sign-in after refreshing it. Sign out, then sign in again.
            </p>
          </>
        ) : null}
        {state.kind === "unavailable" || state.kind === "rate_limited" ? (
          <>
            <h2>We could not check your membership</h2>
            <p>
              {state.kind === "rate_limited"
                ? "Too many checks. Wait a moment before trying again."
                : "Your account or community membership could not be verified. Try again shortly."}
            </p>
            <button
              className="button button-secondary"
              type="button"
              onClick={refresh}
              disabled={!refresh}
            >
              Try again
            </button>
          </>
        ) : null}
        {account?.state === "telegram_required" ? (
          <>
            <h2>Connect your Telegram membership</h2>
            <p>
              Connect the Telegram account you use in this community. This finds your existing
              member record and does not replace your reward wallet.
            </p>
            <button
              className="button"
              type="button"
              onClick={linkTelegram}
              disabled={!linkTelegram}
            >
              Connect Telegram
            </button>
          </>
        ) : null}
        {account?.state === "join_required" ? (
          <>
            <h2>Join the community group</h2>
            <p>
              Your connected Telegram account is not currently a member of this community&apos;s
              group.
            </p>
            <ButtonLink href={`${base}/join`}>Open the setup guide</ButtonLink>
            <button
              className="button button-secondary"
              type="button"
              onClick={refresh}
              disabled={!refresh}
            >
              Check again
            </button>
          </>
        ) : null}
        {account?.state === "member_not_registered" ? (
          <>
            <h2>Finish your member setup</h2>
            <p>
              Your Telegram membership is connected. Use the existing setup flow to establish your
              Hyphae member record.
            </p>
            <ButtonLink href={`${base}/join`}>Open the setup guide</ButtonLink>
            <button
              className="button button-secondary"
              type="button"
              onClick={refresh}
              disabled={!refresh}
            >
              Check again
            </button>
          </>
        ) : null}
        {account?.state === "member" ? (
          <>
            <h2>Current reward wallet</h2>
            <p className="member-wallet mono">{account.wallet.address ?? "No wallet linked"}</p>
            <p>
              {account.wallet.status === "signature"
                ? "Signature recorded"
                : account.wallet.status === "paste"
                  ? "Pasted wallet · no signature recorded"
                  : "Link a wallet through the setup guide."}
            </p>
            <p className="small muted">
              This is the current record, not a payment verdict. Close-time checks determine the
              payment wallet.
            </p>
            <p className="small muted">Read as of {utc(account.as_of)}.</p>
            <div className="member-actions">
              <ButtonLink href={`${base}/join`} secondary>
                Wallet and member setup
              </ButtonLink>
              <button
                className="button button-secondary"
                type="button"
                onClick={refresh}
                disabled={!refresh}
              >
                Refresh account
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
