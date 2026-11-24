"use client";

import type {
  OperatorBuildState,
  OperatorInitBuild,
  OperatorInitSubmit,
  OperatorPublishBuild,
  OperatorPublishSubmit,
} from "@hyphae/admin-client/source";
import { getBase58Decoder, getBase64Encoder, getTransactionDecoder } from "@solana/kit";
import { getWallets } from "@wallet-standard/app";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { sol, utc } from "../lib/format.js";

// The operator page's publish and init (roadmap item 3, part B). The API builds the exact
// transaction the CLI would and keeps its bytes; this panel shows every number it commits to,
// asks the admin's wallet (or the Ledger through `publish-sign`) to sign it, and sends back only
// the signature. It never builds, changes or sends a transaction itself.

type Account = { address: string; chains: readonly string[] };
type Wallet = { name: string; features: Record<string, unknown> };
type Connect = { connect(): Promise<{ accounts: readonly Account[] }> };
type SignTransaction = {
  signTransaction(
    ...inputs: { account: Account; transaction: Uint8Array; chain?: string }[]
  ): Promise<readonly { signedTransaction: Uint8Array }[]>;
};
const CONNECT = "standard:connect";
const SIGN_TX = "solana:signTransaction";

const TEXT: Record<string, string> = {
  community_unknown: "Unknown community.",
  community_held: "Payouts for this community are on hold. Nothing can be published.",
  no_payout_policy: "This community has no payout policy.",
  community_not_on_chain: "The community is not bound to its on-chain account.",
  publisher_not_admin: "This wallet is not the community's on-chain admin.",
  build_unknown: "That transaction was replaced or already used. Prepare it again.",
  expired: "The transaction expired before it was sent. Prepare it again.",
  signature_invalid:
    "The signature does not match the transaction this page built. Nothing was sent.",
  plan_changed: "The plan changed since this transaction was built. Nothing was sent.",
  not_setup: "This community is not recorded for setup with this wallet.",
  fee_recipient_mismatch: "That fee recipient is not the recorded one.",
  community_exists: "The community is already initialized on-chain.",
  fee_recipient_invalid: "The fee recipient is not a System-owned wallet on this network.",
  program_missing: "The Hyphae program is not deployed on this network.",
  wallet_changed:
    "Your wallet changed the transaction (for example, it added a fee instruction), so its signature would not match. Nothing was sent. Use the Solana CLI method.",
  wrong_account: "Connect the admin wallet this session signed in with.",
  disabled: "Publishing from this page is turned off.",
  forbidden: "This wallet is not allowed to do this.",
  unauthorized: "Your session ended. Sign in again.",
  invalid_request: "That input is not valid.",
};
const UNAVAILABLE = "Unavailable right now. Try again in a minute.";
const explain = (code: string) => TEXT[code] ?? UNAVAILABLE;

async function call(path: string, method: "GET" | "POST", body?: unknown) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    ...(method === "POST"
      ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) }
      : {}),
  });
  const data = (await response.json().catch(() => ({ error: "unavailable" }))) as Record<
    string,
    unknown
  >;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "unavailable");
  return data;
}

function signingWallets(): Wallet[] {
  return (getWallets().get() as unknown as Wallet[]).filter(
    (w) => CONNECT in w.features && SIGN_TX in w.features,
  );
}

// The wallet's signature over exactly the bytes the API built, or a refusal code.
export function signatureFromWallet(
  signedTransaction: Uint8Array,
  message: Uint8Array,
  wallet: string,
): { ok: true; signature: string } | { ok: false; code: "wallet_changed" } {
  let decoded: ReturnType<ReturnType<typeof getTransactionDecoder>["decode"]>;
  try {
    decoded = getTransactionDecoder().decode(signedTransaction);
  } catch {
    return { ok: false, code: "wallet_changed" };
  }
  const bytes = new Uint8Array(decoded.messageBytes);
  const same = bytes.length === message.length && bytes.every((b, i) => b === message[i]);
  const signature = (decoded.signatures as Record<string, Uint8Array | null>)[wallet];
  if (!same || !signature || Object.keys(decoded.signatures).length !== 1)
    return { ok: false, code: "wallet_changed" };
  return { ok: true, signature: getBase58Decoder().decode(signature) };
}

export function cliCommand(network: string, message: string): string {
  return `node --import tsx scripts/publish-sign.ts --network ${network === "solana:mainnet" ? "mainnet" : "devnet"} --signer "ledger:44'/501'/2'/0'" --message ${message}`;
}

type Handoff = { build: { id: string; expires_at: string }; transaction: string; message: string };

// Asks for the admin's signature: a browser wallet's signTransaction, or the CLI and a paste.
function Sign({
  wallet,
  network,
  handoff,
  busy,
  onSigned,
}: {
  wallet: string;
  network: string;
  handoff: Handoff;
  busy: boolean;
  onSigned: (signature: string) => void;
}) {
  const [mode, setMode] = useState<"wallet" | "cli">("wallet");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setWallets(signingWallets());
    return getWallets().on("register", () => setWallets(signingWallets()));
  }, []);
  const message = new Uint8Array(getBase64Encoder().encode(handoff.message));

  async function withWallet(w: Wallet) {
    setError(null);
    try {
      const { accounts } = await (w.features[CONNECT] as Connect).connect();
      const account = accounts.find((a) => a.address === wallet);
      if (!account) throw new Error("wrong_account");
      const [out] = await (w.features[SIGN_TX] as SignTransaction).signTransaction({
        account,
        transaction: new Uint8Array(getBase64Encoder().encode(handoff.transaction)),
        chain: network,
      });
      if (!out) throw new Error("unavailable");
      const checked = signatureFromWallet(out.signedTransaction, message, wallet);
      if (!checked.ok) throw new Error(checked.code);
      onSigned(checked.signature);
    } catch (e) {
      setError(explain(e instanceof Error ? e.message : "unavailable"));
    }
  }

  const command = cliCommand(network, handoff.message);
  return (
    <div className="operator-signin">
      <div className="operator-tabs" role="tablist" aria-label="Signing method">
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
              No wallet that can sign transactions was found in this browser. Use the Solana CLI
              method.
            </p>
          ) : (
            <ul className="operator-wallets">
              {wallets.map((w) => (
                <li key={w.name}>
                  <button type="button" disabled={busy} onClick={() => withWallet(w)}>
                    Sign with {w.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="operator-cli">
          <p className="small">
            In <code className="mono">apps/api</code>, run this, compare what it prints with the
            summary above, approve on the Ledger, then paste the signature. If the admin is not the
            Ledger's account 2, change the path.
          </p>
          <pre className="operator-command mono">{command}</pre>
          <button type="button" onClick={() => navigator.clipboard?.writeText(command)}>
            Copy command
          </button>
          <label>
            Signature
            <input
              className="mono"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            disabled={busy || pasted.trim() === ""}
            onClick={() => onSigned(pasted.trim())}
          >
            Send
          </button>
        </div>
      )}
      <p className="small muted">
        Expires at {utc(handoff.build.expires_at)}. Only the signature is sent back; the API sends
        the transaction it built, and only if every check still passes.
      </p>
      {error ? (
        <p className="operator-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="operator-summary">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
const mono = (s: string) => <span className="mono operator-wallet">{s}</span>;
const lamports = (l: string) => `${sol(l)} (${l} lamports)`;

type Awaiting<T> = Extract<T, { status: "awaiting_signature" }>;

function publishOutcome(out: Exclude<OperatorPublishBuild, { status: "awaiting_signature" }>) {
  switch (out.status) {
    case "refused":
      return explain(out.reason);
    case "waiting":
      return `Epoch ${out.epoch_index} is not final yet${out.blockers.length ? `: ${out.blockers.join(", ").replaceAll("_", " ")}` : ""}.`;
    case "nothing_due":
      return "Nothing is due: no closed epoch waits for a decision.";
    case "rolled_over":
      return `Epoch ${out.epoch_index} rolled over (${out.reason.replaceAll("_", " ")}). Nothing was sent; the lamports stay in the vault.`;
    case "published":
      return `Epoch ${out.epoch_index} was already on-chain and is now recorded (${out.signature}).`;
  }
}

// A finished build as the poll reads it. A failed build with a signature was sent: it may be
// on-chain without its record, and preparing again records it rather than sending twice.
export const unconfirmedText = (signature: string) =>
  `Sent (${signature}), but its confirmation failed: it may or may not be on-chain. Prepare it again before signing anything new: an epoch already on-chain is recorded, never sent twice.`;

// A failed build without a signature proves nothing either way: a chain lookup or the record may
// have failed with the epoch already on-chain (review round 3). Only an expired build is known
// unsent: it expires before anything is sent.
export function pollText(b: OperatorBuildState): string {
  if (b.state === "done") return `Published: ${b.signature}`;
  if (b.signature)
    return `Sent (${b.signature}) but not recorded yet. Prepare it again: an epoch already on-chain is recorded, never sent twice.`;
  if (b.state === "expired") return "The transaction expired before it was sent. Prepare it again.";
  return "The outcome is not known yet. Prepare it again before signing anything new: an epoch already on-chain is recorded, never sent twice.";
}

// This page's own build in a status answer, once it has finished. Another tab's newer build is
// never read as this one's outcome (review round 1, P3); an unfinished build keeps the poll going.
export function finishedBuild(data: unknown, id: string): OperatorBuildState | null {
  const builds = (data as { builds?: unknown })?.builds;
  if (!Array.isArray(builds)) return null;
  const mine = (builds as OperatorBuildState[]).find((b) => b?.id === id);
  return mine && (mine.state === "done" || mine.state === "failed" || mine.state === "expired")
    ? mine
    : null;
}

function Polling({
  mint,
  buildId,
  onState,
}: {
  mint: string;
  buildId: string;
  onState: (s: OperatorBuildState | null) => void;
}) {
  const report = useRef(onState);
  report.current = onState;
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      for (let i = 0; i < 40 && !stop; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const data = await call(
            `/api/operator/${encodeURIComponent(mint)}/publish/status`,
            "GET",
          );
          const done = finishedBuild(data, buildId);
          if (done) return report.current(done);
        } catch {
          // Keep polling: the send may still be confirming.
        }
      }
      if (!stop) report.current(null);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [mint, buildId]);
  return <p role="status">Sent. Waiting for the confirmation…</p>;
}

export function OperatorPublish({ mint, wallet }: { mint: string; wallet: string }) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "busy" }
    | { kind: "built"; out: Awaiting<OperatorPublishBuild> }
    | { kind: "polling"; buildId: string }
    | { kind: "result"; text: string; ok: boolean }
  >({ kind: "idle" });
  const base = `/api/operator/${encodeURIComponent(mint)}/publish`;

  async function prepare() {
    setState({ kind: "busy" });
    try {
      const out = (await call(`${base}/build`, "POST", {})) as OperatorPublishBuild;
      if (out.status === "awaiting_signature") return setState({ kind: "built", out });
      setState({ kind: "result", text: publishOutcome(out), ok: out.status !== "refused" });
    } catch (e) {
      setState({ kind: "result", text: explain(e instanceof Error ? e.message : ""), ok: false });
    }
  }
  async function submit(buildId: string, signature: string) {
    setState({ kind: "busy" });
    try {
      const out = (await call(`${base}/submit`, "POST", {
        build_id: buildId,
        signature,
      })) as OperatorPublishSubmit;
      setState(
        out.status === "published"
          ? {
              kind: "result",
              ok: true,
              text: `Published epoch ${out.epoch_index}: ${out.signature}`,
            }
          : out.status === "unconfirmed"
            ? { kind: "result", ok: false, text: unconfirmedText(out.signature) }
            : { kind: "result", ok: false, text: explain(out.reason) },
      );
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      // A slow confirmation can outlive the request: the API keeps going, so ask it.
      if (code === "unavailable") return setState({ kind: "polling", buildId });
      setState({ kind: "result", text: explain(code), ok: false });
    }
  }

  if (state.kind === "polling")
    return (
      <Polling
        mint={mint}
        buildId={state.buildId}
        onState={(b) =>
          setState(
            b
              ? { kind: "result", ok: b.state === "done", text: pollText(b) }
              : {
                  kind: "result",
                  ok: false,
                  text: "No answer yet. Prepare it again: an epoch already on-chain is recorded, never sent twice.",
                },
          )
        }
      />
    );
  if (state.kind === "built") {
    const s = state.out.summary;
    return (
      <div className="operator-publish">
        <p>
          Check every line. The wallet (or the Ledger) shows less than this, so this is what you
          approve.
        </p>
        <Rows
          rows={[
            ["Network", s.network],
            [
              "Epoch",
              `${s.epoch_index} (pays ${s.epochs_paid} ${s.epochs_paid === 1 ? "epoch" : "epochs"})`,
            ],
            ["Gross", lamports(s.gross_lamports)],
            ["Fee", `${lamports(s.fee_lamports)}, ${s.fee_bps / 100}%`],
            ["Net", lamports(s.net_lamports)],
            ["Allocated", lamports(s.allocated_lamports)],
            ["Cap remainder / dust", `${s.cap_remainder_lamports} / ${s.dust_lamports} lamports`],
            ["Payable wallets", s.payable_wallets],
            ["Root", mono(s.root)],
            ["Audit hash", mono(s.audit_hash)],
            ["Fee payer (admin)", mono(s.accounts.fee_payer)],
            ["Community", mono(s.accounts.community)],
            ["Vault", mono(s.accounts.vault)],
            ["Fee recipient", mono(s.accounts.fee_recipient)],
            ["Epoch account", mono(s.accounts.epoch)],
            ["Message hash (Ledger)", mono(s.message_hash)],
          ]}
        />
        <Sign
          wallet={wallet}
          network={s.network}
          handoff={state.out}
          busy={false}
          onSigned={(signature) => submit(state.out.build.id, signature)}
        />
        <button type="button" onClick={() => setState({ kind: "idle" })}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <div className="operator-publish">
      <p>
        Plans the next decided epoch as <code className="mono">publish-epoch run</code> does and
        shows the transaction before anything is signed. An epoch below the threshold rolls over.
      </p>
      <button type="button" disabled={state.kind === "busy"} onClick={prepare}>
        {state.kind === "busy" ? "Working…" : "Prepare the next publish"}
      </button>
      {state.kind === "result" ? (
        <p className={state.ok ? "" : "operator-error"} role={state.ok ? "status" : "alert"}>
          {state.text}
        </p>
      ) : null}
    </div>
  );
}

export function OperatorInit({ mint, wallet }: { mint: string; wallet: string }) {
  const [fee, setFee] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "busy" }
    | { kind: "built"; out: Awaiting<OperatorInitBuild> }
    | { kind: "result"; text: string; ok: boolean }
  >({ kind: "idle" });
  const base = `/api/operator/${encodeURIComponent(mint)}/init`;

  async function prepare() {
    setState({ kind: "busy" });
    try {
      const out = (await call(`${base}/build`, "POST", {
        fee_recipient: fee.trim(),
      })) as OperatorInitBuild;
      if (out.status === "awaiting_signature") return setState({ kind: "built", out });
      setState({ kind: "result", text: explain(out.reason), ok: false });
    } catch (e) {
      setState({ kind: "result", text: explain(e instanceof Error ? e.message : ""), ok: false });
    }
  }
  async function submit(buildId: string, signature: string) {
    setState({ kind: "busy" });
    try {
      const out = (await call(`${base}/submit`, "POST", {
        build_id: buildId,
        signature,
      })) as OperatorInitSubmit;
      setState(
        out.status === "initialized"
          ? {
              kind: "result",
              ok: true,
              text: `Initialized: community ${out.community}, vault ${out.vault} (${out.signature}). Binding it to this community is the next, separate step (bind-community).`,
            }
          : out.status === "unconfirmed"
            ? { kind: "result", ok: false, text: unconfirmedText(out.signature) }
            : { kind: "result", ok: false, text: explain(out.reason) },
      );
    } catch (e) {
      setState({ kind: "result", text: explain(e instanceof Error ? e.message : ""), ok: false });
    }
  }

  if (state.kind === "built") {
    const s = state.out.summary;
    return (
      <div className="operator-publish">
        <p>The fee recipient can never change after this. Check every line.</p>
        <Rows
          rows={[
            ["Network", s.network],
            ["Mint", mono(s.mint)],
            ["Admin (signer, payer)", mono(s.admin)],
            ["Community", mono(s.community)],
            ["Vault", mono(s.vault)],
            ["Fee recipient (permanent)", mono(s.fee_recipient)],
            ["Rent paid by the admin", lamports(s.rent_lamports)],
            ["Admin balance", lamports(s.admin_lamports)],
            ["Message hash (Ledger)", mono(s.message_hash)],
          ]}
        />
        <Sign
          wallet={wallet}
          network={s.network}
          handoff={state.out}
          busy={false}
          onSigned={(signature) => submit(state.out.build.id, signature)}
        />
        <button type="button" onClick={() => setState({ kind: "idle" })}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <div className="operator-publish">
      <label>
        Fee recipient (must be the recorded one)
        <input
          className="mono"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <button type="button" disabled={state.kind === "busy" || fee.trim() === ""} onClick={prepare}>
        {state.kind === "busy" ? "Working…" : "Prepare the initialization"}
      </button>
      {state.kind === "result" ? (
        <p className={state.ok ? "" : "operator-error"} role={state.ok ? "status" : "alert"}>
          {state.text}
        </p>
      ) : null}
    </div>
  );
}
