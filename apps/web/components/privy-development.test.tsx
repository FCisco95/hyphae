// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivyDevelopmentProvider, PrivyDevelopmentSession } from "./privy-development.js";

const sdk = vi.hoisted(() => ({
  ready: true,
  authenticated: false,
  login: vi.fn(),
  logout: vi.fn(async () => {}),
  config: undefined as Record<string, unknown> | undefined,
  error: undefined as (() => void) | undefined,
}));
vi.mock("@privy-io/react-auth", () => ({
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
  usePrivy: () => ({ ready: sdk.ready, authenticated: sdk.authenticated, logout: sdk.logout }),
  useLogin: ({ onError }: { onError: () => void }) => {
    sdk.error = onError;
    return { login: sdk.login };
  },
}));
vi.mock("@privy-io/react-auth/solana", () => ({
  toSolanaWalletConnectors: () => ({ fixture: true }),
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  sdk.ready = true;
  sdk.authenticated = false;
  sdk.config = undefined;
  sdk.logout.mockImplementation(async () => {});
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("No member/network reads allowed here");
    }),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(provider = false) {
  await act(async () =>
    root.render(
      provider ? <PrivyDevelopmentProvider appId="fixture-dev" /> : <PrivyDevelopmentSession />,
    ),
  );
}
function button(label: string) {
  const found = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label,
  );
  if (!found) throw new Error(`Missing ${label}`);
  return found;
}
describe("provider-only development session", () => {
  it("offers explicit email and existing Solana login without creating wallets", async () => {
    await render(true);
    await act(async () => button("Sign in with email").click());
    expect(sdk.login).toHaveBeenLastCalledWith({ loginMethods: ["email"] });
    await act(async () => button("Use an existing Solana wallet").click());
    expect(sdk.login).toHaveBeenLastCalledWith({ loginMethods: ["wallet"] });
    expect(sdk.config).toMatchObject({
      appearance: { walletChainType: "solana-only" },
      embeddedWallets: { ethereum: { createOnLogin: "off" }, solana: { createOnLogin: "off" } },
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not offer login until the SDK is ready", async () => {
    sdk.ready = false;
    await render();
    expect(button("Sign in with email").disabled).toBe(true);
    expect(button("Use an existing Solana wallet").disabled).toBe(true);
  });
  it("reports development authentication without accessing private member records", async () => {
    sdk.authenticated = true;
    await render();
    expect(container.textContent).toContain("Signed in to the development app");
    expect(container.textContent).toContain("Private community access stays disabled");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("masks authenticated success during logout and allows retry after failure", async () => {
    sdk.authenticated = true;
    let fail!: (reason?: unknown) => void;
    sdk.logout.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    await render();
    await act(async () => button("Sign out").click());
    expect(container.textContent).not.toContain("Signed in to the development app");
    expect(button("Signing out…").disabled).toBe(true);
    await act(async () => fail(new Error("fixture")));
    expect(container.textContent).toContain("Sign-out did not finish");
    await act(async () => button("Retry sign out").click());
    expect(container.textContent).toContain("Signed out of this test");
    expect(container.textContent).not.toContain("Signed in to the development app");
  });
  it("allows a new login after signing out without showing the stale SDK session", async () => {
    sdk.authenticated = true;
    await render();
    await act(async () => button("Sign out").click());
    expect(container.textContent).toContain("Signed out of this test");
    sdk.authenticated = false;
    await render();
    await act(async () => button("Sign in with email").click());
    sdk.authenticated = true;
    await render();
    expect(container.textContent).toContain("Signed in to the development app");
  });
  it("turns provider login errors into a retry instruction", async () => {
    await render();
    await act(async () => sdk.error?.());
    expect(container.textContent).toContain("Sign-in did not finish");
    expect(button("Sign in with email").disabled).toBe(false);
  });
});
