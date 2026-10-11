"use client";

import { ReadApiV1Loose } from "@hyphae/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { afterSendRead, attemptClaim, awaitReceipt, type ClaimRead } from "../lib/claim.js";
import { sol } from "../lib/format.js";
import {
  type Account,
  type ClaimWallet,
  claimWallets,
  connect,
  disconnectWallet,
  onAccountChange,
  onWalletRegister,
  signAndSend,
} from "../lib/wallet.js";
import { ClaimSummary } from "./claim.js";
import { Tx } from "./views.js";

type Load = { state: "idle" | "loading" } | ClaimRead;
type Send =
  | { state: "idle" | "signing" }
  | { state: "sent" | "unresolved"; signature: string }
  | { state: "wallet_timeout" }
  | { state: "failed"; message: string };

const WALLET_MS = 60_000;
const READ_MS = 10_000;
const POLLS = 20;
const POLL_MS = 3_000;
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function ClaimPanel({ mint, index }: { mint: string; index: number }) {
  const [wallets, setWallets] = useState<ClaimWallet[] | null>(null);
  const [linked, setLinked] = useState<{ w: ClaimWallet; account: Account } | null>(null);
  const [load, setLoad] = useState<Load>({ state: "idle" });
  const [send, setSend] = useState<Send>({ state: "idle" });
  const [picker, setPicker] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const generation = useRef(0);
  const walletGeneration = useRef(0);
  const route = useRef({ mint, index });
  const activeClaim = useRef<number | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(
    () => () => {
      generation.current += 1;
      walletGeneration.current += 1;
      activeClaim.current = null;
      for (const timer of timers.current) clearTimeout(timer);
    },
    [],
  );

  useEffect(() => {
    setWallets(claimWallets());
    return onWalletRegister(() => setWallets(claimWallets()));
  }, []);

  const clearWallet = useCallback(() => {
    generation.current += 1;
    walletGeneration.current += 1;
    activeClaim.current = null;
    for (const timer of timers.current) clearTimeout(timer);
    timers.current.clear();
    setLinked(null);
    setLoad({ state: "idle" });
    setSend({ state: "idle" });
    setConnecting(null);
  }, []);

  useEffect(() => {
    if (route.current.mint !== mint || route.current.index !== index) {
      route.current = { mint, index };
      clearWallet();
    }
  }, [mint, index, clearWallet]);

  useEffect(() => {
    if (!linked) return;
    return onAccountChange(linked.w, (accounts) => {
      if (accounts[0]?.address !== linked.account.address) clearWallet();
    });
  }, [linked, clearWallet]);

  async function read(wallet: string): Promise<ClaimRead> {
    const path = `/api/claims/${encodeURIComponent(mint)}/${index}/${encodeURIComponent(wallet)}`;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), READ_MS);
    try {
      const r = await fetch(path, { cache: "no-store", signal: abort.signal });
      if (r.status === 404) return { state: "none" };
      if (!r.ok) return { state: "unavailable" };
      const parsed = ReadApiV1Loose.claim.safeParse(await r.json());
      return parsed.success ? { state: "ready", claim: parsed.data } : { state: "unavailable" };
    } catch {
      return { state: "unavailable" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function choose(w: ClaimWallet) {
    const id = ++generation.current;
    walletGeneration.current += 1;
    setPicker(false);
    setConnecting(w.name);
    setSend({ state: "idle" });
    const timer = setTimeout(() => {
      if (id !== generation.current) return;
      generation.current += 1;
      setConnecting(null);
      setSend({
        state: "failed",
        message: "Your wallet did not respond. Close its pending request and try again.",
      });
    }, WALLET_MS);
    timers.current.add(timer);
    try {
      const account = await connect(w);
      if (id !== generation.current) return;
      clearTimeout(timer);
      setLinked({ w, account });
      setConnecting(null);
      setLoad({ state: "loading" });
      const fresh = await read(account.address);
      if (id === generation.current) setLoad(fresh);
    } catch (e) {
      if (id !== generation.current) return;
      setConnecting(null);
      setSend({ state: "failed", message: messageOf(e) });
    } finally {
      clearTimeout(timer);
      timers.current.delete(timer);
    }
  }

  function disconnect() {
    clearWallet();
    if (linked) void disconnectWallet(linked.w).catch(() => {});
  }

  async function claim() {
    if (!linked || load.state !== "ready" || activeClaim.current !== null) return;
    const wallet = linked.account.address;
    const id = ++generation.current;
    const walletId = walletGeneration.current;
    let reportId = id;
    activeClaim.current = id;
    setSend({ state: "signing" });
    const timer = setTimeout(() => {
      if (reportId === generation.current) setSend({ state: "wallet_timeout" });
    }, WALLET_MS);
    timers.current.add(timer);
    try {
      const { read: fresh, signature } = await attemptClaim(
        wallet,
        () => read(wallet),
        (c, transaction) => {
          if (id !== generation.current) throw new Error("This claim attempt was cancelled.");
          return signAndSend(linked.w, linked.account, c.network, transaction);
        },
      );
      if (id !== generation.current) {
        // A recheck may finish before a late approval. Retain its signature for the same
        // connected wallet when no newer signing attempt is active.
        if (!signature || walletId !== walletGeneration.current || activeClaim.current !== null)
          return;
        reportId = ++generation.current;
        activeClaim.current = reportId;
      }
      clearTimeout(timer);
      setLoad((shown) =>
        shown.state === "ready" && shown.claim.payment.status === "paid" ? shown : fresh,
      );
      if (!signature) {
        setSend({ state: "idle" });
        return;
      }
      setSend({ state: "sent", signature });
      // Paid is shown only once the receipt is read on-chain.
      const receipt = await awaitReceipt(
        () => {
          if (reportId !== generation.current) throw new Error("Receipt check cancelled.");
          return read(wallet);
        },
        POLLS,
        () => new Promise((resolve) => setTimeout(resolve, POLL_MS)),
      );
      if (reportId !== generation.current) return;
      setLoad((shown) =>
        shown.state === "ready" && shown.claim.payment.status === "paid"
          ? shown
          : afterSendRead(fresh, receipt.read).shown,
      );
      if (receipt.state === "unresolved") setSend({ state: "unresolved", signature });
    } catch (e) {
      if (id === generation.current) setSend({ state: "failed", message: messageOf(e) });
    } finally {
      if (activeClaim.current === reportId) activeClaim.current = null;
      clearTimeout(timer);
      timers.current.delete(timer);
    }
  }

  // A fresh read after an unresolved send. A claim still claimable can be signed again; the
  // attempt reads it once more first, so a receipt that has appeared meanwhile signs nothing.
  async function recheck() {
    if (!linked || load.state !== "ready") return;
    const id = ++generation.current;
    activeClaim.current = null;
    const next = afterSendRead(load, await read(linked.account.address));
    if (id !== generation.current) return;
    setLoad(next.shown);
    if (next.resolved) setSend({ state: "idle" });
  }

  if (!linked) {
    return (
      <section className="panel">
        <h2>Connect the wallet you verified</h2>
        <p className="muted">
          Choose your wallet to read its allocation. Connecting moves no funds.
        </p>
        <button
          type="button"
          disabled={wallets === null || connecting !== null}
          onClick={() => setPicker(true)}
        >
          Connect wallet
        </button>
        {connecting && (
          <p className="wallet-wait" role="status">
            Waiting for {connecting}…
          </p>
        )}
        {send.state === "failed" && (
          <p className="notice" role="alert">
            {send.message}
          </p>
        )}
        {picker && wallets && (
          <WalletPicker
            wallets={wallets}
            back={`/c/${mint}/e/${index}`}
            onChoose={choose}
            onClose={() => setPicker(false)}
          />
        )}
      </section>
    );
  }

  return (
    <>
      <section className="connected-wallet" aria-label="Connected wallet">
        <div>
          <strong>{linked.w.name} connected</strong>
          <p className="mono wallet-address">{linked.account.address}</p>
        </div>
        <button className="button-secondary" type="button" onClick={disconnect}>
          Disconnect
        </button>
      </section>
      {load.state === "loading" && <p className="muted">Reading your allocation…</p>}
      {load.state === "none" && (
        <p className="banner">No allocation for this wallet in epoch {index}.</p>
      )}
      {load.state === "unavailable" && (
        <div className="notice" role="alert">
          <p>Your allocation can't be read right now. Nothing here is a zero.</p>
          <button
            type="button"
            onClick={async () => {
              const id = ++generation.current;
              setLoad({ state: "loading" });
              const fresh = await read(linked.account.address);
              if (id === generation.current) setLoad(fresh);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {load.state === "ready" && (
        <>
          <ClaimSummary claim={load.claim} />
          {load.claim.payment.status === "claimable" &&
            (send.state === "idle" || send.state === "failed") && (
              <p>
                <button type="button" onClick={claim}>
                  Claim {sol(load.claim.amount_lamports)}
                </button>
              </p>
            )}
          {load.claim.payment.status !== "paid" && (
            <SendStatus send={send} network={load.claim.network} onRecheck={recheck} />
          )}
        </>
      )}
    </>
  );
}

// A phone browser has no wallet extension; a wallet app's own browser does.
export function NoWallet({ back }: { back: string }) {
  return (
    <section className="notice">
      <p>No Solana wallet that can sign and send transactions was found in this browser.</p>
      <p>
        On a phone, open this page in your wallet app's browser (Phantom, Solflare or Backpack). On
        a computer, install a wallet extension and reload. Your allocation stays{" "}
        <a href={back}>on the epoch's audit page</a> either way.
      </p>
    </section>
  );
}

export function SendStatus({
  send,
  network,
  onRecheck,
}: {
  send: Send;
  network: "solana:devnet" | "solana:mainnet";
  onRecheck: () => void;
}) {
  switch (send.state) {
    case "signing":
      return (
        <p className="wallet-wait" role="status">
          Waiting for your wallet… Check its approval window.
        </p>
      );
    case "wallet_timeout":
      return (
        <div className="notice" role="alert">
          <p>
            Your wallet has not returned a signature after 60 seconds. Cancel the pending request in
            your wallet before retrying. A late approval may still send it.
          </p>
          <button type="button" onClick={onRecheck}>
            I cancelled it — check again
          </button>
        </div>
      );
    case "sent":
      return (
        <p className="muted">
          Sent in <Tx signature={send.signature} network={network} />. Waiting for its receipt
          on-chain…
        </p>
      );
    case "unresolved":
      return (
        <p className="notice">
          Sent in <Tx signature={send.signature} network={network} />. No receipt has appeared
          on-chain yet; the transaction may have been dropped.{" "}
          <button type="button" onClick={onRecheck}>
            Check again
          </button>
        </p>
      );
    case "failed":
      return <p className="notice">{send.message}</p>;
    default:
      return null;
  }
}

function WalletPicker({
  wallets,
  back,
  onChoose,
  onClose,
}: {
  wallets: ClaimWallet[];
  back: string;
  onChoose: (wallet: ClaimWallet) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="wallet-picker"
      aria-labelledby="wallet-picker-title"
      onCancel={onClose}
    >
      <div className="wallet-picker-head">
        <h2 id="wallet-picker-title">Choose your wallet</h2>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            dialog.current?.close();
            onClose();
          }}
        >
          Close
        </button>
      </div>
      {wallets.length === 0 ? (
        <NoWallet back={back} />
      ) : (
        <div className="wallet-options">
          {wallets.map((wallet) => (
            <button
              type="button"
              key={wallet.name}
              onClick={() => {
                dialog.current?.close();
                onChoose(wallet);
              }}
            >
              {wallet.name}
            </button>
          ))}
        </div>
      )}
    </dialog>
  );
}
