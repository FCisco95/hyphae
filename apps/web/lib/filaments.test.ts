import { describe, expect, it } from "vitest";
import { growFilaments } from "./filaments.js";

const drawing = { count: 14, width: 1600, height: 920 };
const points = (d: string) =>
  [...d.matchAll(/-?\d+(?:\.\d+)?/g)]
    .map((m) => Number(m[0]))
    .reduce<number[][]>((pairs, v, i) => {
      if (i % 2 === 0) pairs.push([v]);
      else pairs[pairs.length - 1]?.push(v);
      return pairs;
    }, []);

describe("growFilaments", () => {
  it("draws the same network for the same seed, so the server and the browser agree", () => {
    const a = growFilaments({ seed: 7, ...drawing });
    expect(growFilaments({ seed: 7, ...drawing })).toEqual(a);
    expect(growFilaments({ seed: 8, ...drawing })).not.toEqual(a);
  });

  it("starts each filament at the mark's edge and keeps every point inside the drawing", () => {
    const all = growFilaments({ seed: 20260916, ...drawing });
    expect(all.filter((f) => f.depth === 0)).toHaveLength(drawing.count);
    for (const f of all) {
      const pts = points(f.d);
      expect(pts.length).toBeGreaterThanOrEqual(3);
      for (const [x = 0, y = 0] of pts) {
        expect(Math.abs(x)).toBeLessThanOrEqual(drawing.width / 2);
        expect(Math.abs(y)).toBeLessThanOrEqual(drawing.height / 2);
      }
      if (f.depth === 0) {
        const [x = 0, y = 0] = pts[0] ?? [];
        expect(Math.hypot(x, y)).toBeGreaterThanOrEqual(100);
      }
    }
  });

  it("branches at most twice deep", () => {
    const depths = new Set(growFilaments({ seed: 20260916, ...drawing }).map((f) => f.depth));
    expect([...depths].every((d) => d >= 0 && d <= 2)).toBe(true);
    expect(depths.has(1)).toBe(true);
  });
});
