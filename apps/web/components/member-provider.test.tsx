// @vitest-environment jsdom
import { act, type ReactNode, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemberProvider, MemberSession } from "./member-provider.js";

// Only provider/network boundaries are fixtures; the mounted component and its effects are real.
const sdk = vi.hoisted(() => ({
  unstableToken: false,
  state: {
    ready: true,
    authenticated: false,
    user: undefined as { id: string; telegram?: { telegramUserId: string } } | undefined,
  },
  token: vi.fn(async () => "fixture-only"),
  logout: vi.fn(async () => {}),
  login: vi.fn((_options: { loginMethods: string[] }) => {}),
  link: vi.fn(() => {}),
  linkCallbacks: undefined as
    | { onSuccess: (params: { user: { id: string } }) => void; onError: () => void }
    | undefined,
  loginCallbacks: undefined as { onError: () => void } | undefined,
  config: undefined as Record<string, unknown> | undefined,
}));
vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({
    ...sdk.state,
    getAccessToken:
      sdk.unstableToken && sdk.token.mock.calls.length < 3 ? () => sdk.token() : sdk.token,
    logout: sdk.logout,
  }),
  useLogin: (callbacks: { onError: () => void }) => {
    sdk.loginCallbacks = callbacks;
    return { login: sdk.login };
  },
  useLinkAccount: (callbacks: NonNullable<typeof sdk.linkCallbacks>) => {
    sdk.linkCallbacks = callbacks;
    return { linkTelegram: sdk.link };
  },
  PrivyProvider: ({
    children,
    config,
  }: {
    children: ReactNode;
    config: Record<string, unknown>;
  }) => {
    sdk.config = config;
    return children;
  },
}));
vi.mock("@privy-io/react-auth/solana", () => ({
  toSolanaWalletConnectors: () => ({ fixture: true }),
}));

const community = { mint: "MintA", name: "Fixture community" };
const wallet = "So11111111111111111111111111111111111111112";
const account = {
  community,
  as_of: "2026-10-09T12:00:00.000Z",
  state: "member",
  wallet: { address: wallet, status: "signature" },
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  sdk.unstableToken = false;
  sdk.state = { ready: true, authenticated: false, user: undefined };
  sdk.logout.mockImplementation(async () => {});
  sdk.token.mockImplementation(async () => "fixture-only");
  sdk.config = undefined;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", async () => Response.json(account));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () => {
    root.render(<MemberSession community={community} />);
  });
}
function button(label: string) {
  const element = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label,
  );
  if (!element) throw new Error(`button absent: ${label}`);
  return element;
}
const signedIn = () => {
  sdk.state = {
    ready: true,
    authenticated: true,
    user: { id: "did:privy:fixture", telegram: { telegramUserId: "123" } },
  };
};

describe("mounted member login flow with provider fixtures", () => {
  it("does not reread when the SDK returns a new token callback on each render", async () => {
    signedIn();
    sdk.unstableToken = true;
    const fetch = vi.fn(async () => Response.json(account));
    vi.stubGlobal("fetch", fetch);
    await render();
    expect(fetch).toHaveBeenCalledOnce();
    expect(sdk.token).toHaveBeenCalledOnce();
    expect(container.textContent).toContain(wallet);
  });
  it("recovers after one renewed cookie read without another login", async () => {
    signedIn();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: "unauthorized" }, { status: 401 }))
      .mockResolvedValueOnce(Response.json(account));
    vi.stubGlobal("fetch", fetch);
    await render();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain(wallet);
    expect(sdk.login).not.toHaveBeenCalled();
  });
  it("renews once after a cookie401 and keeps persistent failure recoverable", async () => {
    signedIn();
    const fetch = vi.fn(async () => Response.json({ error: "unauthorized" }, { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    await render();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sdk.token).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Sign out to reconnect");
    expect(container.textContent).not.toContain("Sign in with email");
    expect(button("Sign out")).toBeDefined();
  });
  it("keeps a failed logout explicit and retryable without membership refresh", async () => {
    signedIn();
    sdk.logout.mockRejectedValueOnce(new Error("fixture failure"));
    await render();
    await act(async () => button("Sign out").click());
    expect(container.textContent).not.toContain(wallet);
    expect(container.textContent).toContain("Sign-out did not finish");
    expect(container.textContent).not.toContain("Try again");
    expect(container.textContent).not.toContain("Sign in with email");
    await act(async () => button("Sign out").click());
    expect(sdk.logout).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Sign in with email");
  });
  it("does not paint another community's wallet before passive effects run", async () => {
    signedIn();
    let selected = community;
    const frames: string[] = [];
    function ObserveFrame() {
      useLayoutEffect(() => {
        frames.push(container.textContent ?? "");
      });
      return <MemberSession community={selected} />;
    }
    await act(async () => root.render(<ObserveFrame />));
    expect(container.textContent).toContain(wallet);
    frames.length = 0;
    selected = { mint: "MintB", name: "Other community" };
    vi.stubGlobal("fetch", async () =>
      Response.json({
        ...account,
        community: selected,
        state: "telegram_required",
        wallet: undefined,
      }),
    );
    await act(async () => root.render(<ObserveFrame />));
    expect(frames[0]).not.toContain(wallet);
  });
  it("limits login to email or an existing Solana wallet and disables both embedded chains", async () => {
    await act(async () =>
      root.render(<MemberProvider appId="fixture-only" community={community} />),
    );
    expect(sdk.config?.embeddedWallets).toEqual({
      ethereum: { createOnLogin: "off" },
      solana: { createOnLogin: "off" },
    });
    expect(sdk.config?.appearance).toMatchObject({ walletChainType: "solana-only" });
    await act(async () => button("Sign in with email").click());
    expect(sdk.login).toHaveBeenLastCalledWith({ loginMethods: ["email"] });
    await act(async () => button("Use an existing Solana wallet").click());
    expect(sdk.login).toHaveBeenLastCalledWith({ loginMethods: ["wallet"] });
    expect(container.textContent).not.toContain("Current reward wallet");
  });
  it("keeps a canceled wallet login logged out", async () => {
    await render();
    await act(async () => {
      button("Use an existing Solana wallet").click();
      sdk.loginCallbacks?.onError();
    });
    expect(container.textContent).toContain("Sign-in did not finish");
    expect(container.textContent).not.toContain(wallet);
  });
  it("requires an explicit Telegram action and server read after linking", async () => {
    signedIn();
    let linked = false;
    vi.stubGlobal("fetch", async () =>
      Response.json(
        linked ? account : { community, as_of: account.as_of, state: "telegram_required" },
      ),
    );
    await render();
    expect(container.textContent).toContain("Connect your Telegram membership");
    expect(container.textContent).not.toContain(wallet);
    await act(async () => button("Connect Telegram").click());
    expect(sdk.link).toHaveBeenCalledOnce();
    linked = true;
    await act(async () => sdk.linkCallbacks?.onSuccess({ user: { id: "did:privy:fixture" } }));
    expect(container.textContent).toContain(wallet);
    expect(container.textContent).toContain("not a payment verdict");
  });
  it("does not call a canceled Telegram flow connected", async () => {
    signedIn();
    vi.stubGlobal("fetch", async () =>
      Response.json({ community, as_of: account.as_of, state: "telegram_required" }),
    );
    await render();
    await act(async () => {
      button("Connect Telegram").click();
      sdk.linkCallbacks?.onError();
    });
    expect(container.textContent).toContain("Telegram was not connected");
    expect(container.textContent).toContain("Connect your Telegram membership");
    expect(container.textContent).not.toContain(wallet);
  });
  it("clears private data immediately while provider logout is still pending", async () => {
    signedIn();
    sdk.logout.mockImplementation(() => new Promise(() => {}));
    await render();
    expect(container.textContent).toContain(wallet);
    await act(async () => button("Sign out").click());
    expect(container.textContent).not.toContain(wallet);
    expect(container.textContent).toContain("Signing out");
  });
  it("discards a late private response after logout", async () => {
    signedIn();
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    await render();
    await act(async () => button("Sign out").click());
    await act(async () => finish(Response.json(account)));
    expect(container.textContent).not.toContain(wallet);
    expect(container.textContent).toContain("Sign in with email");
  });
  it("drops the old profile as soon as the SDK subject changes", async () => {
    signedIn();
    await render();
    expect(container.textContent).toContain(wallet);
    sdk.state.user = { id: "did:privy:other" };
    vi.stubGlobal("fetch", async () =>
      Response.json({ community, as_of: account.as_of, state: "telegram_required" }),
    );
    await render();
    expect(container.textContent).not.toContain(wallet);
    expect(container.textContent).toContain("Connect your Telegram membership");
  });
  it("does not paint the previous user's wallet before passive effects run", async () => {
    signedIn();
    await render();
    const frames: string[] = [];
    function ObserveFrame() {
      useLayoutEffect(() => {
        frames.push(container.textContent ?? "");
      });
      return <MemberSession community={community} />;
    }
    await act(async () => root.render(<ObserveFrame />));
    frames.length = 0;
    sdk.state.user = { id: "did:privy:other" };
    vi.stubGlobal("fetch", async () =>
      Response.json({ community, as_of: account.as_of, state: "telegram_required" }),
    );
    await act(async () => root.render(<ObserveFrame />));
    expect(frames[0]).not.toContain(wallet);
  });
});
