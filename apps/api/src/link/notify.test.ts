import { describe, expect, it, vi } from "vitest";
import { linkedNotice, sendLinkedNotice } from "./notify.js";

const note = {
  telegramUserId: 4242n,
  communityId: "3f1c2a9e-0b4d-4c8e-9f11-2a3b4c5d6e7f",
  communityName: "Hyphae Lab",
  wallet: "MAoRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxVhAB",
};

describe("linked notice", () => {
  it("names the community and a short wallet, never a link or token", () => {
    const { text, callback } = linkedNotice(note);
    expect(text).toContain("Hyphae Lab");
    expect(text).toContain("MAoR…VhAB");
    expect(text).not.toContain(note.wallet);
    expect(text).not.toMatch(/https?:|#/);
    expect(callback).toBe(`setup_${note.communityId}`);
  });

  it("sends to the session's user with one Check my setup button", async () => {
    const send = vi.fn(async () => undefined);
    await sendLinkedNotice(send, note);
    expect(send).toHaveBeenCalledWith(
      4242,
      expect.stringContaining("Wallet linked"),
      `setup_${note.communityId}`,
    );
  });

  it("refuses a Telegram id that is not a safe integer", async () => {
    const send = vi.fn(async () => undefined);
    await sendLinkedNotice(send, { ...note, telegramUserId: 2n ** 60n });
    expect(send).not.toHaveBeenCalled();
  });
});
