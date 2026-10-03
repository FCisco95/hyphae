import { describe, expect, it } from "vitest";
import { communityPresentation } from "./community-presentation.js";

const valid = {
  pilot: true,
  telegramInvite: "https://t.me/+GenuineInviteFixture",
  supportUrl: "https://support.test/help",
};

describe("verified community presentation", () => {
  it("has no production owner links or default community status", () => {
    expect(communityPresentation("HudkzEWpcUnTYFZMMcbNdwk1S5Am26J2SyEh4NfFworg")).toBeUndefined();
    expect(communityPresentation("OtherMint")).toBeUndefined();
  });

  it("looks up only the exact mint, without inheriting a record", () => {
    expect(communityPresentation("MintAbc", { MintAbc: valid })).toEqual(valid);
    expect(communityPresentation("OtherMint", { MintAbc: valid })).toBeUndefined();
    expect(communityPresentation("toString", {})).toBeUndefined();
    expect(communityPresentation("MintAbc", Object.create({ MintAbc: valid }))).toBeUndefined();
  });

  it("allows optional status with no invite/support, without a name override", () => {
    expect(communityPresentation("MintAbc", { MintAbc: { pilot: true } })).toEqual({ pilot: true });
    expect(
      communityPresentation("MintAbc", { MintAbc: { ...valid, name: "MYCEL" } }),
    ).toBeUndefined();
  });

  it.each([
    "http://t.me/+Invite",
    "javascript:alert(1)",
    "https://t.me.evil.test/+Invite",
    "https://user:password@t.me/+Invite",
    "https://t.me/+Invite#private-token",
    "https://t.me/+Invite?token=private-token",
    "https://t.me/",
    "https://t.me/owner/post/1",
    "https://t.me:444/+Invite",
    "https://t.me/%2BInvite",
  ])("omits unsafe or incomplete invite %s", (telegramInvite) => {
    expect(
      communityPresentation("MintAbc", { MintAbc: { ...valid, telegramInvite } }),
    ).toBeUndefined();
  });

  it.each([
    "http://support.test/help",
    "https://user:password@support.test/help",
    "https://support.test/#token",
    "https://support.test/?token=x",
    "https://localhost/help",
    "data:text/html,help",
  ])("omits unsafe support %s", (supportUrl) => {
    expect(communityPresentation("MintAbc", { MintAbc: { ...valid, supportUrl } })).toBeUndefined();
  });

  it("accepts verified public and legacy invite routes too", () => {
    for (const telegramInvite of [
      "https://t.me/registered_group",
      "https://t.me/joinchat/GenuineInviteFixture",
    ]) {
      expect(communityPresentation("MintAbc", { MintAbc: { telegramInvite } })).toEqual({
        telegramInvite,
      });
    }
  });
});
