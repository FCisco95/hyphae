import { describe, expect, it } from "vitest";
import { memberLoginConfig } from "./member-login-config.js";

describe("member login activation", () => {
  it("stays disabled without explicit production cookie activation", () => {
    expect(memberLoginConfig({}, "fixture.test")).toBeNull();
    expect(
      memberLoginConfig({ appId: "fixture", cookieDomain: "fixture.test" }, "fixture.test"),
    ).toBeNull();
  });
  it("only enables the configured host", () => {
    const config = { appId: "fixture", cookieDomain: "fixture.test", enabled: "on" };
    expect(memberLoginConfig(config, "fixture.test")).toEqual({ appId: "fixture" });
    expect(memberLoginConfig(config, "localhost:3010")).toBeNull();
    expect(memberLoginConfig(config, "preview.vercel.app")).toBeNull();
    expect(memberLoginConfig(config, "fixture.test.attacker.test")).toBeNull();
  });
  it("refuses an incomplete or malformed cookie setup", () => {
    expect(memberLoginConfig({ appId: "fixture", enabled: "on" }, "fixture.test")).toBeNull();
    expect(
      memberLoginConfig(
        { appId: "fixture", cookieDomain: "https://fixture.test", enabled: "on" },
        "fixture.test",
      ),
    ).toBeNull();
  });
});
