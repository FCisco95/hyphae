import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyWalletLink, privateWalletLink } from "./page/handoff.js";

const TOKEN = "A".repeat(43);
const ORIGIN = "https://api.hyphae.test";

describe("original private link", () => {
  it("builds only the fixed origin/link fragment from the captured valid token", () => {
    expect(privateWalletLink(ORIGIN, TOKEN)).toBe(`${ORIGIN}/link#${TOKEN}`);
  });
  it.each(["", "A".repeat(42), "A".repeat(44), `${"A".repeat(42)}!`, "../return?secret=x"])(
    "refuses invalid token %s",
    (token) => {
      expect(privateWalletLink(ORIGIN, token)).toBeUndefined();
    },
  );
  it.each([
    "http://api.hyphae.test",
    "https://user:pw@api.hyphae.test",
    `${ORIGIN}/other`,
    `${ORIGIN}?return=https://evil.test`,
    `${ORIGIN}#vendor`,
    "javascript:alert(1)",
  ])("refuses a non-fixed HTTPS origin %s", (origin) => {
    expect(privateWalletLink(origin, TOKEN)).toBeUndefined();
  });
  it("copies only on explicit invocation, and returns manual fallback on clipboard refusal", async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    const link = privateWalletLink(ORIGIN, TOKEN);
    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(link).toBeDefined();
    expect(await copyWalletLink(link ?? "", clipboard)).toBe(true);
    expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(`${ORIGIN}/link#${TOKEN}`);
    clipboard.writeText.mockRejectedValue(new Error("denied"));
    expect(await copyWalletLink(link ?? "", clipboard)).toBe(false);
    expect(await copyWalletLink(link ?? "")).toBe(false);
  });
});

class Element {
  children: Element[] = [];
  textContent = "";
  value = "";
  hidden = false;
  disabled = false;
  readOnly = false;
  src = "";
  alt = "";
  width = 0;
  height = 0;
  onclick: (() => void) | null = null;
  focus = vi.fn();
  select = vi.fn();
  append(...items: (Element | string)[]) {
    this.children.push(...items.filter((x): x is Element => x instanceof Element));
  }
  replaceChildren(...items: Element[]) {
    this.children = items;
  }
}
const browser = vi.hoisted(() => ({
  wallets: [] as { name: string; icon: string }[],
  register: undefined as (() => void) | undefined,
  connect: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("./page/wallet.js", () => ({
  messageWallets: () => browser.wallets,
  onWalletRegister: (fn: () => void) => {
    browser.register = fn;
  },
  connect: browser.connect,
  sign: browser.sign,
}));

function page(token = TOKEN) {
  const nodes = Object.fromEntries(
    [
      "status",
      "wallets",
      "copy-link",
      "copy-status",
      "manual-copy",
      "private-link",
      "retry",
      "signing-origin",
    ].map((id) => [id, new Element()]),
  );
  const node = (id: string) => {
    const value = nodes[id];
    if (!value) throw new Error(`missing test node ${id}`);
    return value;
  };
  node("manual-copy").hidden = true;
  node("retry").hidden = true;
  node("private-link").readOnly = true;
  const location = { origin: ORIGIN, pathname: "/link", hash: `#${token}` };
  const replaceState = vi.fn(() => {
    location.hash = "";
  });
  const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
  const storage = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() };
  const fetch = vi.fn(
    async (
      url: string,
      _init: RequestInit,
    ): Promise<{ ok: boolean; json(): Promise<Record<string, unknown>> }> => {
      if (url === "/link/request")
        return {
          ok: true,
          json: async () => ({
            requestId: "request",
            nonce: "nonce",
            message: "UNCHANGED readable message",
          }),
        };
      if (url === "/link/verify")
        return { ok: true, json: async () => ({ wallet: "Wallet111111111111111111111111111111" }) };
      return { ok: true, json: async () => ({ linked: false }) };
    },
  );
  vi.stubGlobal("document", { getElementById: node, createElement: () => new Element() });
  vi.stubGlobal("location", location);
  vi.stubGlobal("history", { replaceState });
  vi.stubGlobal("navigator", { clipboard });
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("fetch", fetch);
  return { node, replaceState, clipboard, storage, fetch, location };
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  browser.wallets = [];
  browser.register = undefined;
  browser.connect
    .mockReset()
    .mockResolvedValue({ address: "Wallet111111111111111111111111111111" });
  browser.sign.mockReset().mockResolvedValue("signature");
});

describe("actual page client handoff and retry", () => {
  it("captures original fragment before removal, makes no automatic copy/request, and never stores it", async () => {
    const h = page();
    await import("./page/client.js");
    expect(h.replaceState).toHaveBeenCalledExactlyOnceWith(null, "", "/link");
    expect(h.location.hash).toBe("");
    expect(h.clipboard.writeText).not.toHaveBeenCalled();
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.node("manual-copy").hidden).toBe(true);
    h.node("copy-link").onclick?.();
    await vi.waitFor(() =>
      expect(h.clipboard.writeText).toHaveBeenCalledExactlyOnceWith(`${ORIGIN}/link#${TOKEN}`),
    );
    expect(h.storage.setItem).not.toHaveBeenCalled();
    expect(h.storage.getItem).not.toHaveBeenCalled();
  });

  it("reveals selectable readonly manual copy only after explicit copy failure and restores control focus", async () => {
    const h = page();
    h.clipboard.writeText.mockRejectedValue(new Error("denied"));
    await import("./page/client.js");
    expect(h.node("private-link").value).toBe("");
    h.node("copy-link").onclick?.();
    await vi.waitFor(() => expect(h.node("manual-copy").hidden).toBe(false));
    expect(h.node("private-link").value).toBe(`${ORIGIN}/link#${TOKEN}`);
    expect(h.node("private-link").readOnly).toBe(true);
    expect(h.node("private-link").select).toHaveBeenCalled();
    expect(h.node("copy-status").textContent).toMatch(/select|copy/i);
  });

  it("does not reveal a delayed clipboard fallback after signing has started", async () => {
    const h = page();
    browser.wallets = [{ name: "Fixture wallet", icon: "data:image/png;base64," }];
    let denyCopy: (() => void) | undefined;
    h.clipboard.writeText.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          denyCopy = () => reject(new Error("denied"));
        }),
    );
    browser.connect.mockImplementation(() => new Promise(() => {}));
    await import("./page/client.js");
    h.node("copy-link").onclick?.();
    h.node("wallets").children[0]?.onclick?.();
    denyCopy?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.node("manual-copy").hidden).toBe(true);
    expect(h.node("private-link").value).toBe("");
  });

  it("preserves the existing token-gated flow on local HTTP while disabling private-link copy", async () => {
    const h = page();
    h.location.origin = "http://localhost:3102";
    browser.wallets = [{ name: "Fixture wallet", icon: "data:image/png;base64," }];
    await import("./page/client.js");
    expect(h.node("wallets").children).toHaveLength(1);
    expect(h.node("copy-link").disabled).toBe(true);
    expect(h.node("copy-status").textContent).toContain("HTTPS");
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it("disables copy and wallet actions for a missing/invalid token, never copying the stripped address", async () => {
    const h = page("wrong");
    await import("./page/client.js");
    expect(h.node("copy-link").disabled).toBe(true);
    h.node("copy-link").onclick?.();
    expect(h.clipboard.writeText).not.toHaveBeenCalled();
    expect(h.node("status").textContent).toMatch(/expired|fresh.*\/link/i);
    expect(h.node("wallets").children).toHaveLength(0);
  });

  it("shows no-wallet advice, then a late wallet without automatically connecting", async () => {
    const h = page();
    await import("./page/client.js");
    expect(h.node("status").textContent).toContain("No Solana wallet found");
    browser.wallets = [{ name: "Fixture wallet", icon: "data:image/png;base64," }];
    browser.register?.();
    expect(h.node("wallets").children).toHaveLength(1);
    expect(browser.connect).not.toHaveBeenCalled();
    expect(browser.sign).not.toHaveBeenCalled();
  });

  it("keeps cancellation deliberate: a retry restores wallet selection without signing or resending", async () => {
    const h = page();
    browser.wallets = [{ name: "Fixture wallet", icon: "data:image/png;base64," }];
    browser.sign.mockRejectedValueOnce(new Error("cancel"));
    await import("./page/client.js");
    h.node("wallets").children[0]?.onclick?.();
    await vi.waitFor(() => expect(h.node("retry").hidden).toBe(false));
    expect(h.fetch.mock.calls.map(([url]) => url)).toEqual(["/link/request"]);
    h.node("retry").onclick?.();
    expect(h.node("wallets").children).toHaveLength(1);
    expect(browser.sign).toHaveBeenCalledTimes(1);
    expect(h.node("manual-copy").hidden).toBe(true);
  });

  it.each(["link_expired", "wallet_taken"])(
    "handles %s without automatic retry or reusable copy",
    async (error) => {
      const h = page();
      browser.wallets = [{ name: "Fixture wallet", icon: "data:image/png;base64," }];
      h.fetch.mockImplementation(async () => ({ ok: false, json: async () => ({ error }) }));
      await import("./page/client.js");
      h.node("wallets").children[0]?.onclick?.();
      await vi.waitFor(() => expect(h.node("copy-link").disabled).toBe(true));
      expect(h.node("retry").hidden).toBe(true);
      expect(h.node("manual-copy").hidden).toBe(true);
      expect(h.node("private-link").value).toBe("");
      expect(browser.sign).not.toHaveBeenCalled();
      expect(h.fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("treats inherited object names in API errors as unavailable, never as copy or retry instructions", async () => {
    const h = page();
    browser.wallets = [{ name: "Fixture wallet", icon: "data:image/png;base64," }];
    h.fetch.mockImplementation(async () => ({
      ok: false,
      json: async () => ({ error: "constructor" }),
    }));
    await import("./page/client.js");
    h.node("wallets").children[0]?.onclick?.();
    await vi.waitFor(() =>
      expect(h.node("status").textContent).toContain("Check your own /me first"),
    );
    expect(h.node("retry").hidden).toBe(true);
  });

  it("handles the real wallet_taken response from verify without status resend or copy", async () => {
    const h = page();
    browser.wallets = [{ name: "Fixture wallet", icon: "data:image/png;base64," }];
    h.fetch.mockImplementation(async (url) => ({
      ok: url === "/link/request",
      json: async () =>
        url === "/link/request"
          ? { requestId: "request", nonce: "nonce", message: "UNCHANGED readable message" }
          : { error: "wallet_taken" },
    }));
    await import("./page/client.js");
    h.node("wallets").children[0]?.onclick?.();
    await vi.waitFor(() => expect(h.node("status").textContent).toContain("another member"));
    expect(h.fetch.mock.calls.map(([url]) => url)).toEqual(["/link/request", "/link/verify"]);
    expect(h.node("copy-link").disabled).toBe(true);
    expect(h.node("retry").hidden).toBe(true);
  });

  it("reconciles an uncertain verify once through status, never resending proof", async () => {
    const h = page();
    browser.wallets = [{ name: "Fixture wallet", icon: "data:image/png;base64," }];
    h.fetch.mockImplementation(async (url) => ({
      ok: url === "/link/request",
      json: async () =>
        url === "/link/request"
          ? { requestId: "request", nonce: "nonce", message: "UNCHANGED readable message" }
          : { error: "link_unavailable" },
    }));
    await import("./page/client.js");
    h.node("wallets").children[0]?.onclick?.();
    await vi.waitFor(() => expect(h.fetch).toHaveBeenCalledTimes(3));
    expect(h.fetch.mock.calls.map(([url]) => url)).toEqual([
      "/link/request",
      "/link/verify",
      "/link/status",
    ]);
    await vi.waitFor(() =>
      expect(h.node("status").textContent).toContain("Check your own /me first"),
    );
    expect(h.node("retry").hidden).toBe(true);
    browser.register?.();
    expect(h.node("wallets").children).toHaveLength(0);
    expect(h.fetch).toHaveBeenCalledTimes(3);
  });

  it("preserves proof bytes/body, confirms shortened wallet and own /me, then clears copy", async () => {
    const h = page();
    browser.wallets = [{ name: "Fixture wallet", icon: "data:image/png;base64," }];
    await import("./page/client.js");
    h.node("wallets").children[0]?.onclick?.();
    await vi.waitFor(() => expect(h.node("status").textContent).toContain("Linked"));
    expect(browser.sign).toHaveBeenCalledWith(
      browser.wallets[0],
      { address: "Wallet111111111111111111111111111111" },
      "UNCHANGED readable message",
    );
    expect(JSON.parse(String(h.fetch.mock.calls[1]?.[1].body))).toEqual({
      token: TOKEN,
      requestId: "request",
      nonce: "nonce",
      message: "UNCHANGED readable message",
      signature: "signature",
    });
    expect(h.node("status").textContent).toContain("own /me");
    expect(h.node("copy-link").disabled).toBe(true);
    expect(
      h.fetch.mock.calls.every(([url, init]) => !url.includes(TOKEN) && init.method === "POST"),
    ).toBe(true);
    expect(h.storage.setItem).not.toHaveBeenCalled();
  });
});
