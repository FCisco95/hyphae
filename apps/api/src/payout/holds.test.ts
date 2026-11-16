import { describe, expect, it } from "vitest";
import { communityHold, MYCEL_MINT } from "./holds.js";

describe("recorded community holds", () => {
  it("holds MYCEL until a commit lifts it", () => {
    expect(communityHold(MYCEL_MINT)?.reason).toMatch(/held/i);
  });

  it("holds no other community", () => {
    expect(communityHold("7dsxLdz2BeakoH3bjB1WzHtK3t6fHC3PoP4hs2Z3C6EQ")).toBeNull();
  });
});
