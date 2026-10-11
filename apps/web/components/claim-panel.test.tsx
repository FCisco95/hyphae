// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import {
  type ClaimV1,
  epochAddress,
  HYPHAE_PROGRAM_ID,
  leafHash,
  receiptAddress,
  vaultAddress,
} from "@hyphae/core";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { address, getAddressEncoder } from "@solana/kit";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimPanel } from "./claim-panel.js";
import * as f from "./fixtures.js";

const sdk = vi.hoisted(() => ({
  connect: vi.fn(),
  send: vi.fn(),
  disconnect: vi.fn(),
  change: undefined as ((accounts: { address: string; chains: string[] }[]) => void) | undefined,
}));
vi.mock("../lib/wallet.js", () => ({
  claimWallets: () => [
    { name: "Phantom", features: {}, accounts: [] },
    { name: "Solflare", features: {}, accounts: [] },
  ],
  onWalletRegister: () => () => {},
  connect: sdk.connect,
  signAndSend: sdk.send,
  disconnectWallet: sdk.disconnect,
  onAccountChange: (_wallet: unknown, listener: typeof sdk.change) => {
    sdk.change = listener;
    return () => {
      sdk.change = undefined;
    };
  },
}));

let root: Root;
let container: HTMLDivElement;
let fetcher: ReturnType<typeof vi.fn>;
let claim: ClaimV1;
beforeAll(async () => {
  vi.stubGlobal("crypto", webcrypto);
  const community = address(f.claim.community_address);
  const wallet = address(f.claim.wallet);
  const epoch = await epochAddress(HYPHAE_PROGRAM_ID, community, 2n);
  claim = {
    ...f.claim,
    vault_address: await vaultAddress(HYPHAE_PROGRAM_ID, community),
    epoch_address: epoch,
    receipt_address: await receiptAddress(HYPHAE_PROGRAM_ID, epoch, wallet),
    root: bytesToHex(
      leafHash({
        wallet: new Uint8Array(getAddressEncoder().encode(wallet)),
        epochIndex: 2n,
        score: 255n,
        amount: 121_250_000n,
        evidenceHash: hexToBytes(f.claim.evidence_hash),
      }),
    ),
    proof: [],
  };
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("crypto", webcrypto);
  vi.clearAllMocks();
  sdk.change = undefined;
  sdk.disconnect.mockResolvedValue(undefined);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  sdk.connect.mockResolvedValue({ address: f.claim.wallet, chains: [f.claim.network] });
  sdk.send.mockImplementation(() => new Promise(() => {}));
  fetcher = vi.fn(async () => Response.json(claim));
  vi.stubGlobal("fetch", fetcher);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () => {
    root.render(<ClaimPanel mint="MintAbc" index={2} />);
  });
}
async function click(label: string) {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent === label);
  if (!button) throw new Error(`Missing button: ${label}`);
  await act(async () => {
    button.click();
    if (label.startsWith("Claim "))
      await vi.waitFor(() => {
        expect(sdk.send, container.textContent ?? "").toHaveBeenCalled();
      });
  });
}
async function connect() {
  await click("Connect wallet");
  await click("Phantom");
}

describe("ClaimPanel recovery", () => {
  it("offers one entry point and keeps the full connected address visible", async () => {
    await render();
    expect([...container.querySelectorAll("button")].map((b) => b.textContent)).toEqual([
      "Connect wallet",
    ]);
    await connect();
    expect(container.textContent).toContain("Phantom connected");
    expect(container.querySelector(".wallet-address")?.textContent).toBe(f.claim.wallet);
    await click("Disconnect");
    expect(container.querySelector(".wallet-address")).toBeNull();
    expect(container.textContent).toContain("Connect wallet");
  });

  it("recovers from a wallet connection that never returns and ignores its late result", async () => {
    let finish!: (a: { address: string; chains: string[] }) => void;
    sdk.connect.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render();
    await connect();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(container.textContent).toContain("Your wallet did not respond");
    await act(async () => {
      finish({ address: f.claim.wallet, chains: [f.claim.network] });
    });
    expect(container.querySelector(".wallet-address")).toBeNull();
    await connect();
    expect(container.querySelector(".wallet-address")?.textContent).toBe(f.claim.wallet);
  });

  it("times out wallet approval without sending again, then rechecks before offering a retry", async () => {
    await render();
    await connect();
    await click("Claim 0.12125 SOL");
    expect(sdk.send).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(container.textContent).toContain("Cancel the pending request");
    expect(container.querySelector(".wallet-address")?.textContent).toBe(f.claim.wallet);
    expect(sdk.send).toHaveBeenCalledTimes(1);
    const before = fetcher.mock.calls.length;
    await click("I cancelled it — check again");
    expect(fetcher.mock.calls.length).toBe(before + 1);
    expect(sdk.send).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Claim 0.12125 SOL");
  });

  it("never offers a second claim when the timeout check discovers an on-chain receipt", async () => {
    await render();
    await connect();
    await click("Claim 0.12125 SOL");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    fetcher.mockImplementation(async () =>
      Response.json({ ...claim, payment: { status: "paid", claim_tx: f.CLAIM_TX } }),
    );
    await click("I cancelled it — check again");
    expect(container.textContent).toContain("Paid in");
    expect(container.textContent).not.toContain("Claim 0.12125 SOL");
    expect(sdk.send).toHaveBeenCalledTimes(1);
  });

  it("does not let a late approval overwrite a disconnected wallet", async () => {
    let finish!: (signature: string) => void;
    sdk.send.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render();
    await connect();
    await click("Claim 0.12125 SOL");
    await click("Disconnect");
    await act(async () => {
      finish(f.CLAIM_TX);
    });
    expect(container.textContent).toContain("Connect wallet");
    expect(container.textContent).not.toContain("Sent in");
    expect(container.querySelector(".wallet-address")).toBeNull();
  });

  it("forgets the allocation when the wallet changes accounts", async () => {
    await render();
    await connect();
    await act(async () => {
      sdk.change?.([
        { address: "SysvarC1ock11111111111111111111111111111111", chains: [claim.network] },
      ]);
    });
    expect(container.querySelector(".wallet-address")).toBeNull();
    expect(container.textContent).toContain("Connect wallet");
    expect(container.textContent).not.toContain("Claim 0.12125 SOL");
  });

  it("does not open a signing request after disconnect during the fresh claim read", async () => {
    await render();
    await connect();
    let finish!: (response: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const button = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Claim 0.12125 SOL",
    );
    await act(async () => {
      button?.click();
    });
    await click("Disconnect");
    await act(async () => {
      finish(Response.json(claim));
    });
    expect(sdk.send).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Connect wallet");
  });

  it("opens only one signing request when the claim button is activated twice", async () => {
    await render();
    await connect();
    const button = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Claim 0.12125 SOL",
    );
    await act(async () => {
      button?.click();
      button?.click();
      await vi.waitFor(() => {
        expect(sdk.send).toHaveBeenCalledTimes(1);
      });
    });
    expect(sdk.send).toHaveBeenCalledTimes(1);
  });

  it("retains a late signature after a timeout recheck when no newer claim is active", async () => {
    let finish!: (signature: string) => void;
    sdk.send.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render();
    await connect();
    await click("Claim 0.12125 SOL");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await click("I cancelled it — check again");
    await act(async () => {
      finish(f.CLAIM_TX);
    });
    expect(container.textContent).toContain("Sent in");
    expect(container.textContent).not.toContain("Claim 0.12125 SOL");
    expect(sdk.send).toHaveBeenCalledTimes(1);
  });

  it("stops polling the receipt after disconnect", async () => {
    sdk.send.mockResolvedValue(f.CLAIM_TX);
    await render();
    await connect();
    await click("Claim 0.12125 SOL");
    expect(container.textContent).toContain("Sent in");
    await click("Disconnect");
    const before = fetcher.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(70_000);
    });
    expect(fetcher.mock.calls.length).toBe(before);
  });

  it("clears the connected allocation when the epoch changes", async () => {
    await render();
    await connect();
    await act(async () => {
      root.render(<ClaimPanel mint="MintAbc" index={3} />);
    });
    expect(container.querySelector(".wallet-address")).toBeNull();
    expect(container.textContent).toContain("Connect wallet");
    expect(container.textContent).not.toContain("Claim 0.12125 SOL");
  });
});
