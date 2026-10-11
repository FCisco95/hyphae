// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMUNITY_SETUP_PROMPT } from "../lib/community-onboarding.js";
import { CommunityOnboarding } from "./community-onboarding.js";

let root: Root;
let container: HTMLDivElement;
const writeText = vi.fn();

beforeEach(async () => {
  writeText.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<CommunityOnboarding />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function copy() {
  await act(async () => {
    container.querySelector<HTMLButtonElement>(".onboarding-copy")?.click();
  });
}

describe("community setup prompt", () => {
  it("copies the complete setup instructions and confirms only after success", async () => {
    let finish!: () => void;
    writeText.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await copy();
    expect(writeText).toHaveBeenCalledWith(COMMUNITY_SETUP_PROMPT);
    expect(container.querySelector('[role="status"]')?.textContent).not.toContain("Paste it");
    await act(async () => finish());
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Paste it into your agent",
    );
  });

  it("reveals a selectable prompt when copying is denied and permits retry", async () => {
    writeText.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    await copy();
    expect(container.querySelector("details")?.open).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("Copy was blocked");
    const prompt = container.querySelector("textarea");
    expect(prompt?.value).toBe(COMMUNITY_SETUP_PROMPT);
    await act(async () => prompt?.focus());
    expect(prompt?.selectionStart).toBe(0);
    expect(prompt?.selectionEnd).toBe(COMMUNITY_SETUP_PROMPT.length);
    await copy();
    expect(container.querySelector(".onboarding-copy")?.textContent).toBe("Prompt copied");
  });

  it("can dismiss the card without invoking the clipboard", async () => {
    await act(async () => {
      container.querySelector<HTMLButtonElement>(".onboarding-dismiss")?.click();
    });
    expect(container.querySelector("aside")).toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });
});
