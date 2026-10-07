import { describe, expect, it } from "vitest";
import { jevDepsFromEnv } from "./jev-config.js";
import type { JevRegistry, JevScorerDef } from "./scorers.js";

const def = { version: "reward-jev/1" } as JevScorerDef;
const registry: JevRegistry = new Map([[def.version, def]]);

describe("jevDepsFromEnv", () => {
  it("is off by default: no scorer deps, so nothing about production scoring changes", () => {
    expect(jevDepsFromEnv({}, registry)).toBeUndefined();
    expect(
      jevDepsFromEnv({ JEV_SCORING: "off", TYPESAFE_API_KEY: "tsk_x" }, registry),
    ).toBeUndefined();
  });

  it("when on, hands the evaluation the registry and a transport", () => {
    const deps = jevDepsFromEnv({ JEV_SCORING: "on", TYPESAFE_API_KEY: "tsk_x" }, registry);
    expect(deps?.registry).toBe(registry);
    expect(typeof deps?.transport).toBe("function");
  });

  it("when on without a key, fails at boot instead of stranding every Jev-pinned dispatch", () => {
    expect(() => jevDepsFromEnv({ JEV_SCORING: "on" }, registry)).toThrow(/TYPESAFE_API_KEY/);
  });

  it("when on with no registered scorer, fails at boot", () => {
    expect(() =>
      jevDepsFromEnv({ JEV_SCORING: "on", TYPESAFE_API_KEY: "tsk_x" }, new Map()),
    ).toThrow(/no Jev scorer is registered/);
  });
});
