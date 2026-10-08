import { type ClaimV1, claimInstruction, HYPHAE_PROGRAM_ID } from "@hyphae/core";
import { hexToBytes } from "@noble/hashes/utils.js";
import {
  address,
  createNoopSigner,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from "@solana/kit";
import { describe, expect, it } from "vitest";
import {
  afterSendRead,
  attemptClaim,
  awaitReceipt,
  type ClaimRead,
  claimTransaction,
} from "./claim.js";
import { BLOCKHASH, COMMUNITY, OTHER, servedClaim as served, WALLET } from "./claim-fixture.js";

describe("claimTransaction", () => {
  it("builds the program's claim for the connected wallet, which pays and signs, and nothing else", async () => {
    const claim = await served();
    const tx = getTransactionDecoder().decode(await claimTransaction(claim, WALLET));
    // One signature slot, the wallet's, still empty: the page signs nothing itself.
    expect(Object.entries(tx.signatures)).toEqual([[WALLET, null]]);
    const message = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
    if (!("instructions" in message)) throw new Error("expected a v0 message");
    expect(message.staticAccounts[0]).toBe(WALLET);
    expect(message.lifetimeToken).toBe(BLOCKHASH);
    expect(message.instructions).toHaveLength(1);
    const [ix] = message.instructions;
    expect(message.staticAccounts[ix?.programAddressIndex as number]).toBe(HYPHAE_PROGRAM_ID);
    const expected = claimInstruction({
      programId: HYPHAE_PROGRAM_ID,
      claimant: createNoopSigner(address(WALLET)),
      community: COMMUNITY,
      vault: address(claim.vault_address),
      epoch: address(claim.epoch_address),
      receipt: address(claim.receipt_address),
      score: 255n,
      amount: 121_250_000n,
      evidenceHash: hexToBytes(claim.evidence_hash),
      proof: claim.proof.map(hexToBytes),
    });
    expect(new Uint8Array(ix?.data ?? [])).toEqual(new Uint8Array(expected.data ?? []));
    expect(ix?.accountIndices?.map((i: number) => message.staticAccounts[i])).toEqual(
      expected.accounts?.map((a) => a.address),
    );
  });

  it("refuses to build what it cannot check from public data", async () => {
    const claim = await served();
    const refused = [
      ["another wallet", { ...claim }, OTHER],
      ["another program", { ...claim, program_id: OTHER }, WALLET],
      ["an account that does not derive", { ...claim, receipt_address: OTHER }, WALLET],
      ["an amount the proof does not reach", { ...claim, amount_lamports: "121250001" }, WALLET],
      [
        "a paid leaf",
        { ...claim, payment: { status: "paid", claim_tx: `4${"C".repeat(86)}` } },
        WALLET,
      ],
      [
        "an unconfirmed status",
        { ...claim, payment: { status: "unavailable", reason: "chain_unavailable" } },
        WALLET,
      ],
    ] as const;
    for (const [what, c, wallet] of refused) {
      await expect(claimTransaction(c as ClaimV1, wallet), what).rejects.toThrow(/claim:/);
    }
  });
});

describe("attemptClaim", () => {
  const lifetimeOf = (tx: Uint8Array) => {
    const message = getCompiledTransactionMessageDecoder().decode(
      getTransactionDecoder().decode(tx).messageBytes,
    );
    return message.lifetimeToken;
  };

  it("reads the claim again right before each signing, and signs that fresh read", async () => {
    const claim = await served();
    const events: string[] = [];
    const blockhashes = [BLOCKHASH, OTHER];
    const read = async (): Promise<ClaimRead> => {
      const recent_blockhash = blockhashes[events.filter((e) => e === "read").length] as string;
      events.push("read");
      return {
        state: "ready",
        claim: { ...claim, payment: { ...claim.payment, recent_blockhash } } as ClaimV1,
      };
    };
    const signed: string[] = [];
    const send = async (_c: ClaimV1, tx: Uint8Array) => {
      events.push("sign");
      signed.push(lifetimeOf(tx));
      return `5${"S".repeat(86)}`;
    };
    // A first attempt the wallet rejects, then a retry: each signs a blockhash read just before.
    await expect(
      attemptClaim(WALLET, read, async () => {
        events.push("sign");
        throw new Error("rejected in the wallet");
      }),
    ).rejects.toThrow(/rejected/);
    const out = await attemptClaim(WALLET, read, send);
    expect(out.signature).toBe(`5${"S".repeat(86)}`);
    expect(signed).toEqual([OTHER]);
    expect(events).toEqual(["read", "sign", "read", "sign"]);
  });

  it("signs nothing when the fresh read is paid, unavailable or gone", async () => {
    const claim = await served();
    const paid: ClaimRead = {
      state: "ready",
      claim: { ...claim, payment: { status: "paid", claim_tx: `4${"C".repeat(86)}` } },
    };
    for (const fresh of [paid, { state: "unavailable" }, { state: "none" }] as ClaimRead[]) {
      let signs = 0;
      const out = await attemptClaim(
        WALLET,
        async () => fresh,
        async () => {
          signs += 1;
          return "never";
        },
      );
      expect(out).toEqual({ read: fresh, signature: null });
      expect(signs).toBe(0);
    }
  });
});

describe("awaitReceipt", () => {
  it("stops at the first read that shows the receipt paid", async () => {
    const claim = await served();
    const paid: ClaimRead = {
      state: "ready",
      claim: { ...claim, payment: { status: "paid", claim_tx: `4${"C".repeat(86)}` } },
    };
    const reads = [{ state: "ready", claim } as ClaimRead, paid];
    let waits = 0;
    const out = await awaitReceipt(
      async () => reads.shift() ?? paid,
      5,
      async () => {
        waits += 1;
      },
    );
    expect(out).toEqual({ state: "paid", read: paid });
    expect(waits).toBe(2);
  });

  // A wallet can return a signature for a transaction that never lands.
  it("gives up as unresolved, with the last read, after its polls find no receipt", async () => {
    const claim = await served();
    const claimable: ClaimRead = { state: "ready", claim };
    let reads = 0;
    const out = await awaitReceipt(
      async () => {
        reads += 1;
        return claimable;
      },
      3,
      async () => {},
    );
    expect(out).toEqual({ state: "unresolved", read: claimable });
    expect(reads).toBe(3);
  });
});

describe("afterSendRead", () => {
  it("keeps the claim on screen through a failed read, and stays unresolved", async () => {
    const claim = await served();
    const shown: ClaimRead = { state: "ready", claim };
    for (const failed of [{ state: "unavailable" }, { state: "none" }] as ClaimRead[]) {
      expect(afterSendRead(shown, failed)).toEqual({ shown, resolved: false });
    }
    const unconfirmed: ClaimRead = {
      state: "ready",
      claim: { ...claim, payment: { status: "unavailable", reason: "chain_unavailable" } },
    };
    expect(afterSendRead(shown, unconfirmed)).toEqual({ shown: unconfirmed, resolved: false });
  });

  it("resolves once the chain says paid or still claimable", async () => {
    const claim = await served();
    const shown: ClaimRead = { state: "ready", claim };
    const paid: ClaimRead = {
      state: "ready",
      claim: { ...claim, payment: { status: "paid", claim_tx: `4${"C".repeat(86)}` } },
    };
    expect(afterSendRead(shown, paid)).toEqual({ shown: paid, resolved: true });
    expect(afterSendRead(shown, shown)).toEqual({ shown, resolved: true });
  });
});
