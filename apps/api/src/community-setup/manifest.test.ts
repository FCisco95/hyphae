import { describe, expect, it } from "vitest";
import { parseSetupManifest, setupPlan } from "./manifest.js";
import { manifest } from "./test-fixture.js";

describe("community setup manifest", () => {
  it("binds the full reviewed configuration, not just the token or display name", () => {
    const m = manifest();
    const plan = setupPlan(parseSetupManifest(m));
    expect(plan.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(setupPlan(parseSetupManifest({ ...m })).hash).toBe(plan.hash);
    for (const patch of [
      { telegramChatId: "-100101" },
      { adminTelegramUserId: "12" },
      { botUserId: "98" },
      { environment: "production" },
      { approvalReference: "different-approval" },
      { activationTime: "2099-01-02T00:00:00.000Z" },
    ]) {
      expect(setupPlan(parseSetupManifest({ ...m, ...patch })).hash).not.toBe(plan.hash);
    }
  });

  it.each([
    { mint: "Mint1" },
    { communityId: "unknown" },
    { communityId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" },
    { name: " Alpha" },
    { name: "Alpha\nAdmin" },
    { telegramChatId: "100100" },
    { telegramChatId: "-9007199254740992" },
    { adminTelegramUserId: "0" },
    { botUserId: "9007199254740992" },
    { approvalReference: "" },
    { activationTime: "2099-01-01T00:00:00" },
  ])("refuses malformed targets/configuration without echoing input", (patch) => {
    expect(() => parseSetupManifest({ ...manifest(), ...patch })).toThrow("invalid_manifest");
  });

  it("refuses silently discarded fields at every configuration level", () => {
    const m = manifest();
    for (const value of [
      { ...m, token: "do-not-store" },
      { ...m, rewardConfig: { ...m.rewardConfig, unapproved: true } },
      {
        ...m,
        rewardConfig: { ...m.rewardConfig, credit: { ...m.rewardConfig.credit, bypass: true } },
      },
      {
        ...m,
        rewardConfig: { ...m.rewardConfig, rubric: { ...m.rewardConfig.rubric, extra: true } },
      },
    ])
      expect(() => parseSetupManifest(value)).toThrow("invalid_manifest");
  });

  it("refuses another community's rubric, invalid weights and an unknown prompt pin", () => {
    const m = manifest();
    for (const rewardConfig of [
      { ...m.rewardConfig, rubric: { ...m.rewardConfig.rubric, community: "MYCEL" } },
      {
        ...m.rewardConfig,
        rubric: {
          ...m.rewardConfig.rubric,
          criteria: [{ ...m.rewardConfig.rubric.criteria[0], weight: 0.5 }],
        },
      },
      {
        ...m.rewardConfig,
        scoring: { ...m.rewardConfig.scoring, promptTemplateHash: "0".repeat(64) },
      },
    ])
      expect(() => parseSetupManifest({ ...m, rewardConfig })).toThrow("invalid_manifest");
  });
});

describe("community setup manifest: payout fields", () => {
  const chainAddress = "7dsxLdz2BeakoH3bjB1WzHtK3t6fHC3PoP4hs2Z3C6EQ";

  it("takes the on-chain address and the first paid epoch, and binds both in the plan hash", () => {
    const m = manifest();
    const plan = setupPlan(parseSetupManifest(m));
    const withBoth = parseSetupManifest({ ...m, chainAddress, firstPaidEpoch: 3 });
    expect(withBoth).toMatchObject({ chainAddress, firstPaidEpoch: 3 });
    expect(setupPlan(withBoth).hash).not.toBe(plan.hash);
    expect(setupPlan(parseSetupManifest({ ...m, chainAddress })).hash).not.toBe(plan.hash);
    expect(setupPlan(parseSetupManifest({ ...m, firstPaidEpoch: 1 })).hash).not.toBe(plan.hash);
  });

  it("states both in the plan, so the operator reviews what will be written", () => {
    const plan = setupPlan(parseSetupManifest({ ...manifest(), chainAddress, firstPaidEpoch: 3 }));
    expect(plan).toMatchObject({ chainAddress, firstPaidEpoch: 3 });
    expect(setupPlan(parseSetupManifest(manifest()))).toMatchObject({
      chainAddress: null,
      firstPaidEpoch: null,
    });
  });

  it.each([
    { chainAddress: "not-an-address" },
    { chainAddress: "" },
    { firstPaidEpoch: 0 },
    { firstPaidEpoch: 1.5 },
    { firstPaidEpoch: "3" },
    { firstPaidEpoch: 2_147_483_648 },
  ])("refuses a malformed payout field", (patch) => {
    expect(() => parseSetupManifest({ ...manifest(), ...patch })).toThrow("invalid_manifest");
  });
});
