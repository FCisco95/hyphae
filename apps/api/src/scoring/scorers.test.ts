import { promptTemplateHash } from "@hyphae/core";
import { describe, expect, it } from "vitest";
import { type JevScorerDef, jevTemplateHash, pinHash, routeFor } from "./scorers.js";

const def = (over: Partial<JevScorerDef> = {}): JevScorerDef => ({
  version: "reward-jev/1",
  effortVersion: "reward-eval/2",
  templateHash: "a".repeat(64),
  model: "typesafe:jev-1.13.0",
  request: () => ({ body: {}, hash: "b".repeat(64) }),
  run: async () => {
    throw new Error("not called");
  },
  ...over,
});
const registry = (d: JevScorerDef) => new Map([[d.version, d]]);

describe("pinHash", () => {
  it("is the core template hash for a registered prompt version", () => {
    expect(pinHash("reward-eval/2")).toBe(promptTemplateHash("reward-eval/2"));
  });

  it("is the scorer's template hash for a registered Jev version", () => {
    expect(pinHash("reward-jev/1", registry(def()))).toBe("a".repeat(64));
  });

  it("is null for a Jev version nobody registered", () => {
    expect(pinHash("reward-jev/1")).toBeNull();
    expect(pinHash("reward-jev/1", new Map())).toBeNull();
  });
});

describe("jevTemplateHash", () => {
  const set = {
    id: "v4",
    criteria: { context_fit: "q1" },
    weights: { quality: 0.5, criteria: 0.5 },
  };

  it("pins the model and every question, whatever the key order", () => {
    const reordered = {
      weights: { criteria: 0.5, quality: 0.5 },
      criteria: { context_fit: "q1" },
      id: "v4",
    };
    expect(jevTemplateHash("jev-1.13.0", set)).toBe(jevTemplateHash("jev-1.13.0", reordered));
    expect(jevTemplateHash("jev-1.13.0", set)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when a question, a weight or the model changes", () => {
    const base = jevTemplateHash("jev-1.13.0", set);
    expect(jevTemplateHash("jev-1.14.0", set)).not.toBe(base);
    expect(jevTemplateHash("jev-1.13.0", { ...set, criteria: { context_fit: "q2" } })).not.toBe(
      base,
    );
    expect(
      jevTemplateHash("jev-1.13.0", { ...set, weights: { quality: 0.6, criteria: 0.4 } }),
    ).not.toBe(base);
  });
});

describe("routeFor", () => {
  it("sends every purpose of an Anthropic prompt version to the prompt path", () => {
    for (const purpose of ["quality", "quality_effort", "effort"] as const) {
      expect(routeFor("reward-eval/2", purpose)).toEqual({
        kind: "prompt",
        version: "reward-eval/2",
      });
    }
  });

  it("sends only quality of a Jev version to Jev; effort judgments stay on the effort version", () => {
    const d = def();
    const r = registry(d);
    expect(routeFor("reward-jev/1", "quality", r)).toEqual({ kind: "jev", def: d });
    expect(routeFor("reward-jev/1", "quality_effort", r)).toEqual({
      kind: "prompt",
      version: "reward-eval/2",
    });
    expect(routeFor("reward-jev/1", "effort", r)).toEqual({
      kind: "prompt",
      version: "reward-eval/2",
    });
  });

  it("has no route for a Jev version that is not registered", () => {
    expect(routeFor("reward-jev/1", "quality")).toBeNull();
  });
});
