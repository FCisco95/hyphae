import { describe, expect, it } from "vitest";
import { bindHandle } from "./handles.js";

describe("bindHandle", () => {
  it("first handle binds", () => {
    expect(bindHandle([], "FCisco95")).toEqual({ ok: true, handles: ["FCisco95"], bound: true });
  });

  it("a known handle matches case-insensitively without rebinding", () => {
    expect(bindHandle(["FCisco95"], "fcisco95")).toEqual({
      ok: true,
      handles: ["FCisco95"],
      bound: false,
    });
  });

  it("up to three handles per member", () => {
    const r = bindHandle(["a", "b"], "c");
    expect(r).toEqual({ ok: true, handles: ["a", "b", "c"], bound: true });
    expect(bindHandle(["a", "b", "c"], "d")).toEqual({ ok: false, handles: ["a", "b", "c"] });
  });
});
