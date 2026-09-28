// Hyphae growing out of the mark, for the landing page's hero: each filament is a seeded random walk
// with side branches, drawn as a smooth path. One seed always draws the same network, so the server
// render and every visit agree. Units: the mark's radius is 100, centred on the origin.

export interface Filament {
  d: string;
  // 0 for a filament from the mark, 1 and 2 for its branches and theirs.
  depth: number;
  // When it starts to grow, and for how long, as fractions of the growth animation.
  start: number;
  span: number;
}

// mulberry32
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Point = readonly [number, number];

const r1 = (v: number) => Math.round(v * 10) / 10;

// Quadratic segments through the midpoints of the walk: smooth, and one command per step.
function smooth(points: readonly Point[]): string {
  const [first, ...rest] = points;
  if (!first || rest.length === 0) return "";
  let d = `M${r1(first[0])} ${r1(first[1])}`;
  for (let i = 0; i < rest.length - 1; i++) {
    const p = rest[i] as Point;
    const q = rest[i + 1] as Point;
    d += `Q${r1(p[0])} ${r1(p[1])} ${r1((p[0] + q[0]) / 2)} ${r1((p[1] + q[1]) / 2)}`;
  }
  const last = rest[rest.length - 1] as Point;
  return `${d}L${r1(last[0])} ${r1(last[1])}`;
}

export function growFilaments({
  seed,
  count,
  width,
  height,
}: {
  seed: number;
  count: number;
  // The drawing's extent around the mark; walks stop at its edge.
  width: number;
  height: number;
}): Filament[] {
  const rand = random(seed);
  const out: Filament[] = [];
  const inside = ([x, y]: Point) => Math.abs(x) < width / 2 && Math.abs(y) < height / 2;

  function walk(from: Point, heading: number, depth: number, steps: number, start: number) {
    const points: Point[] = [from];
    let angle = heading;
    const branches: Array<[Point, number, number]> = [];
    for (let i = 0; i < steps; i++) {
      // Wander a little, and drift back towards the heading so a filament never curls up.
      angle += (rand() - 0.5) * 0.42 + (heading - angle) * 0.1;
      const step = (depth === 0 ? 26 : 20) * (0.8 + rand() * 0.4);
      const prev = points[points.length - 1] as Point;
      const next: Point = [prev[0] + Math.cos(angle) * step, prev[1] + Math.sin(angle) * step];
      if (!inside(next)) break;
      points.push(next);
      if (depth < 2 && i > 1 && rand() < (depth === 0 ? 0.13 : 0.09)) {
        const side = rand() < 0.5 ? -1 : 1;
        branches.push([next, angle + side * (0.45 + rand() * 0.5), i]);
      }
    }
    if (points.length < 3) return;
    const span = Math.min(0.9, 0.35 + points.length / 90);
    out.push({ d: smooth(points), depth, start, span });
    for (const [at, a, i] of branches) {
      walk(
        at,
        a,
        depth + 1,
        depth === 0 ? 10 + Math.floor(rand() * 12) : 6 + Math.floor(rand() * 6),
        start + (span * i) / points.length,
      );
    }
  }

  for (let i = 0; i < count; i++) {
    // Mostly sideways, as on the brand banner: alternate right and left, with a wider fan on the
    // right, where nothing sits beside the mark.
    const right = i % 2 === 0;
    const heading = (right ? 0 : Math.PI) + (rand() - 0.5) * (right ? 1.6 : 0.8);
    const from: Point = [Math.cos(heading) * 102, Math.sin(heading) * 102];
    walk(from, heading, 0, 34 + Math.floor(rand() * 16), 0.04 * i);
  }
  return out;
}
