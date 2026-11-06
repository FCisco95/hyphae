// @vitest-environment jsdom
import { act, type ReactNode, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminProvider, AdminSession } from "./community-admin.js";

const sdk = vi.hoisted(() => ({
  state: {
    ready: true,
    authenticated: true,
    user: { id: "did:privy:A", telegram: { telegramUserId: "123" } } as
      | { id: string; telegram?: { telegramUserId: string } }
      | undefined,
  },
  token: vi.fn(async () => "fixture-only"),
  logout: vi.fn(async () => {}),
  login: vi.fn(),
  link: vi.fn(),
  config: undefined as Record<string, unknown> | undefined,
}));
vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({ ...sdk.state, getAccessToken: sdk.token, logout: sdk.logout }),
  useLogin: () => ({ login: sdk.login }),
  useLinkAccount: () => ({ linkTelegram: sdk.link }),
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
const community = { mint: "MintA", name: "Fixture" };
const overview = {
  state: "admin",
  community,
  intake: { paused: false, paused_at: null },
  as_of: "2026-11-06T18:00:00Z",
};
const paused = { ...overview, intake: { paused: true, paused_at: "2026-11-06T18:01:00Z" } };
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  sdk.state = {
    ready: true,
    authenticated: true,
    user: { id: "did:privy:A", telegram: { telegramUserId: "123" } },
  };
  sdk.token.mockImplementation(async () => "fixture-only");
  sdk.logout.mockImplementation(async () => {});
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(overview)),
  );
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
async function render(mint = "MintA", sibling?: ReactNode) {
  await act(async () =>
    root.render(
      <>
        <AdminSession community={{ ...community, mint }} />
        {sibling}
      </>,
    ),
  );
}
function button(label: string) {
  const found = [...container.querySelectorAll("button")].find(
    (node) => node.textContent === label,
  );
  if (!found) throw new Error(`missing button: ${label}`);
  return found;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("private community administration", () => {
  it("uses the existing explicit email/wallet login and never creates embedded wallets", async () => {
    sdk.state.authenticated = false;
    sdk.state.user = undefined;
    await act(async () => root.render(<AdminProvider appId="fixture" community={community} />));
    await click("Sign in with email");
    expect(sdk.login).toHaveBeenCalledWith({ loginMethods: ["email"] });
    await click("Use an existing Solana wallet");
    expect(sdk.login).toHaveBeenCalledWith({ loginMethods: ["wallet"] });
    expect(sdk.config).toMatchObject({
      embeddedWallets: { ethereum: { createOnLogin: "off" }, solana: { createOnLogin: "off" } },
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires confirmation and fresh read-back without optimistic state", async () => {
    const mutation = deferred<Response>();
    const readBack = deferred<Response>();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(overview))
      .mockImplementationOnce(() => mutation.promise)
      .mockImplementationOnce(() => readBack.promise);
    vi.stubGlobal("fetch", fetch);
    await render();
    await click("Pause new submissions");
    expect(fetch).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Confirm pause");
    await click("Confirm pause");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      credentials: "same-origin",
      body: JSON.stringify({ paused: true, expected_paused_at: null }),
    });
    expect(container.textContent).not.toContain("Resume new submissions");
    await act(async () => mutation.resolve(Response.json(paused)));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(container.textContent).not.toContain("Resume new submissions");
    await act(async () => readBack.resolve(Response.json(paused)));
    expect(container.textContent).toContain("Resume new submissions");
    expect(container.textContent).toContain("does not change payouts");
  });
  it("cancels confirmation without writing", async () => {
    await render();
    await click("Pause new submissions");
    await click("Cancel");
    expect(fetch).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain("Confirm pause");
  });
  it("resumes only with the latest observed pause timestamp", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(paused))
      .mockResolvedValueOnce(Response.json(overview))
      .mockResolvedValueOnce(Response.json(overview));
    vi.stubGlobal("fetch", fetch);
    await render();
    await click("Resume new submissions");
    await click("Confirm resume");
    expect(fetch.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ paused: false, expected_paused_at: paused.intake.paused_at }),
    );
    expect(container.textContent).toContain("Pause new submissions");
  });
  it("renews one expired cookie read and never loops on persistent 401", async () => {
    const fetch = vi.fn(async () => Response.json({ error: "unauthorized" }, { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    await render();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sdk.token).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("sign in again");
    expect(container.textContent).not.toContain("Pause new submissions");
  });
  it("requires sign-out after a rejected mutation credential without retrying the write", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(overview))
      .mockResolvedValueOnce(Response.json({ error: "unauthorized" }, { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    await render();
    await click("Pause new submissions");
    await click("Confirm pause");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("sign in again");
    expect(container.textContent).not.toContain("Sign in with email");
    expect(container.textContent).not.toContain("Pause new submissions");
  });
  it.each([403, 404, 429, 503])("provides no control when overview returns %s", async (status) => {
    vi.stubGlobal("fetch", async () => Response.json({ error: "unavailable" }, { status }));
    await render();
    expect(container.textContent).not.toContain("Pause new submissions");
    expect(container.textContent).toContain("Reload settings");
  });
  it("requires reloading after a conflict and never retries the write", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(overview))
      .mockResolvedValueOnce(Response.json({ error: "conflict" }, { status: 409 }))
      .mockResolvedValueOnce(Response.json(paused));
    vi.stubGlobal("fetch", fetch);
    await render();
    await click("Pause new submissions");
    await click("Confirm pause");
    expect(container.textContent).toContain("changed since");
    expect(container.textContent).not.toContain("Pause new submissions");
    expect(fetch).toHaveBeenCalledTimes(2);
    await click("Reload settings");
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(container.textContent).toContain("Resume new submissions");
  });
  it("blocks another write after an ambiguous failure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(overview))
      .mockRejectedValueOnce(new Error("network"));
    vi.stubGlobal("fetch", fetch);
    await render();
    await click("Pause new submissions");
    await click("Confirm pause");
    expect(container.textContent).toContain("may have been applied");
    expect(container.textContent).not.toContain("Pause new submissions");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("never sends a mutation after logout while token renewal is pending", async () => {
    await render();
    await click("Pause new submissions");
    const token = deferred<string>();
    sdk.token.mockImplementationOnce(() => token.promise);
    await click("Confirm pause");
    await click("Sign out");
    await act(async () => token.resolve("fixture"));
    expect(fetch).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain("Confirm pause");
  });
  it("never sends a mutation after authentication is lost while token renewal is pending", async () => {
    await render();
    await click("Pause new submissions");
    const token = deferred<string>();
    sdk.token.mockImplementationOnce(() => token.promise);
    await click("Confirm pause");
    sdk.state.authenticated = false;
    await render();
    await act(async () => token.resolve("fixture"));
    expect(fetch).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain("Confirm pause");
  });
  it("does not leave controls stuck when token renewal never resolves", async () => {
    await render();
    await click("Pause new submissions");
    vi.useFakeTimers();
    sdk.token.mockImplementationOnce(() => new Promise(() => {}));
    await click("Confirm pause");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5501);
    });
    expect(container.textContent).toContain("may have been applied");
    expect(fetch).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
  it("clears private controls immediately during failed logout", async () => {
    sdk.logout.mockRejectedValueOnce(new Error("failed"));
    await render();
    await click("Sign out");
    expect(container.textContent).toContain("Sign-out did not finish");
    expect(container.textContent).not.toContain("Pause new submissions");
  });
  it("masks the old community before passive effects and cancels its confirmation", async () => {
    await render();
    await click("Pause new submissions");
    const next = deferred<Response>();
    vi.stubGlobal("fetch", () => next.promise);
    let before = "";
    function Observe() {
      useLayoutEffect(() => {
        before = container.textContent ?? "";
      });
      return null;
    }
    await render("MintB", <Observe />);
    expect(before).not.toContain("Confirm pause");
    expect(before).not.toContain("Pause new submissions");
    await act(async () =>
      next.resolve(Response.json({ ...overview, community: { ...community, mint: "MintB" } })),
    );
    expect(container.textContent).toContain("Pause new submissions");
  });
  it("discards an old subject's pending write response", async () => {
    const mutation = deferred<Response>();
    const next = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(overview))
        .mockImplementationOnce(() => mutation.promise)
        .mockImplementationOnce(() => next.promise),
    );
    await render();
    await click("Pause new submissions");
    await click("Confirm pause");
    sdk.state.user = { id: "did:privy:B", telegram: { telegramUserId: "456" } };
    await render();
    await act(async () => mutation.resolve(Response.json(paused)));
    expect(container.textContent).not.toContain("Resume new submissions");
    await act(async () => next.resolve(Response.json({ error: "forbidden" }, { status: 403 })));
    expect(container.textContent).not.toContain("Resume new submissions");
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("offers Telegram linking without granting authority from the login wallet", async () => {
    sdk.state.user = { id: "did:privy:A" };
    vi.stubGlobal("fetch", async () => Response.json({ error: "forbidden" }, { status: 403 }));
    await render();
    await click("Connect Telegram");
    expect(sdk.link).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain("Pause new submissions");
  });
});
