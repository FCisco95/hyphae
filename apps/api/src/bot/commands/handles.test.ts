import { members } from "@hyphae/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, seedCommunity } from "../../rewards/test-db.js";
import { bindHandle, bindMemberHandle } from "./handles.js";

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

describe("bindMemberHandle", () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  beforeAll(async () => {
    t = await createTestDb();
  });
  afterAll(async () => {
    await t.close();
  });

  it("binds against the stored handles, not the ones the caller read earlier", async () => {
    const { member } = await seedCommunity(t.db);
    await t.db
      .update(members)
      .set({ xHandles: ["a", "b"] })
      .where(eq(members.id, member.id));
    expect(await bindMemberHandle(t.db, member.id, "c")).toEqual({
      ok: true,
      handles: ["a", "b", "c"],
      bound: true,
    });
    expect(await bindMemberHandle(t.db, member.id, "d")).toEqual({
      ok: false,
      handles: ["a", "b", "c"],
    });
    expect(await bindMemberHandle(t.db, member.id, "B")).toMatchObject({ ok: true, bound: false });
    const [row] = await t.db.select().from(members).where(eq(members.id, member.id));
    expect(row?.xHandles).toEqual(["a", "b", "c"]);
  });
});
