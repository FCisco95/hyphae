"use client";

import { ReadApiV1Loose } from "@hyphae/core";
import { useEffect, useState } from "react";
import { attemptClaim, type ClaimRead } from "../lib/claim.js";
import { shortWallet, sol } from "../lib/format.js";
import {
  type Account,
  type ClaimWallet,
  claimWallets,
  connect,
  onWalletRegister,
  signAndSend,
} from "../lib/wallet.js";
import { ClaimSummary } from "./claim.js";
import { Tx } from "./views.js";

type Load = { state: "idle" | "loading" } | ClaimRead;
type Send =
  | { state: "idle" | "signing" }
  | { state: "sent"; signature: string }
  | { state: "failed"; message: string };

const POLLS = 20;
const POLL_MS = 3_000;
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function ClaimPanel({ mint, index }: { mint: string; index: number }) {
  const [wallets, setWallets] = useState<ClaimWallet[] | null>(null);
  const [linked, setLinked] = useState<{ w: ClaimWallet; account: Account } | null>(null);
  const [load, setLoad] = useState<Load>({ state: "idle" });
  const [send, setSend] = useState<Send>({ state: "idle" });

  useEffect(() => {
    setWallets(claimWallets());
    return onWalletRegister(() => setWallets(claimWallets()));
  }, []);

  async function read(wallet: string): Promise<ClaimRead> {
    const path = `/api/claims/${encodeURIComponent(mint)}/${index}/${encodeURIComponent(wallet)}`;
    try {
      const r = await fetch(path, { cache: "no-store" });
      if (r.status === 404) return { state: "none" };
      if (!r.ok) return { state: "unavailable" };
      const parsed = ReadApiV1Loose.claim.safeParse(await r.json());
      return parsed.success ? { state: "ready", claim: parsed.data } : { state: "unavailable" };
    } catch {
      return { state: "unavailable" };
    }
  }

  async function choose(w: ClaimWallet) {
    try {
      const account = await connect(w);
      setLinked({ w, account });
      setSend({ state: "idle" });
      setLoad({ state: "loading" });
      setLoad(await read(account.address));
    } catch (e) {
      setSend({ state: "failed", message: messageOf(e) });
    }
  }

  async function claim() {
    if (!linked || load.state !== "ready") return;
    const wallet = linked.account.address;
    setSend({ state: "signing" });
    try {
      const { read: fresh, signature } = await attemptClaim(
        wallet,
        () => read(wallet),
        (c, transaction) => signAndSend(linked.w, linked.account, c.network, transaction),
      );
      setLoad(fresh);
      if (!signature) {
        setSend({ state: "idle" });
        return;
      }
      setSend({ state: "sent", signature });
      // Paid is shown only once the receipt is read on-chain.
      for (let i = 0; i < POLLS; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        const next = await read(wallet);
        if (next.state === "ready" && next.claim.payment.status === "paid") {
          setLoad(next);
          return;
        }
      }
    } catch (e) {
      setSend({ state: "failed", message: messageOf(e) });
    }
  }

  if (!linked) {
    if (wallets === null) return <p className="muted">Looking for a wallet…</p>;
    if (wallets.length === 0) {
      return (
        <p className="notice">
          No Solana wallet that can sign and send transactions was found in this browser.
        </p>
      );
    }
    return (
      <section className="panel">
        <h2>Connect the wallet you verified</h2>
        {wallets.map((w) => (
          <p key={w.name}>
            <button type="button" onClick={() => choose(w)}>
              Connect {w.name}
            </button>
          </p>
        ))}
        {send.state === "failed" && <p className="notice">{send.message}</p>}
      </section>
    );
  }

  return (
    <>
      <p className="muted">
        Connected <span className="mono">{shortWallet(linked.account.address)}</span>.
      </p>
      {load.state === "loading" && <p className="muted">Reading your allocation…</p>}
      {load.state === "none" && (
        <p className="banner">No allocation for this wallet in epoch {index}.</p>
      )}
      {load.state === "unavailable" && (
        <p className="notice">Your allocation can't be read right now. Nothing here is a zero.</p>
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
          {send.state === "signing" && <p className="muted">Waiting for your wallet…</p>}
          {send.state === "sent" && load.claim.payment.status !== "paid" && (
            <p className="muted">
              Sent in <Tx signature={send.signature} network={load.claim.network} />. Waiting for
              its receipt on-chain…
            </p>
          )}
          {send.state === "failed" && <p className="notice">{send.message}</p>}
        </>
      )}
    </>
  );
}
