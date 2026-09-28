import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og.js";
import { growFilaments } from "../lib/filaments.js";
import { MARK_HALF, WORDMARK_LETTERS } from "./brand.js";

// Social cards (Open Graph), drawn on the dark theme like the brand banner: the mark with its
// filaments, and the page's one line.

export const OG_SIZE = { width: 1200, height: 630 };

const INK = "#f4f4f4";
const PAPER = "#0a0a0a";
const MUTED = "#939393";

const uri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

// The mark and its filaments as one SVG, centred on the mark (radius 100), fading before the
// words on the left, as in the landing page's hero.
function art(): string {
  const filaments = growFilaments({ seed: 20260916, count: 14, width: 1600, height: 920 })
    .map((f) => {
      const [width, opacity] = [
        [1.1, 0.8],
        [0.8, 0.6],
        [0.6, 0.45],
      ][f.depth] ?? [0.6, 0.45];
      return `<path d="${f.d}" stroke-width="${width}" stroke-opacity="${opacity}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-800 -460 1600 920">
<defs><radialGradient id="f" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="780"><stop offset="0.1" stop-color="#fff"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="s" gradientUnits="userSpaceOnUse" x1="-620" x2="-120"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.6" stop-color="#fff" stop-opacity="0.25"/><stop offset="1" stop-color="#fff"/></linearGradient>
<mask id="m" maskUnits="userSpaceOnUse" x="-800" y="-460" width="1600" height="920"><rect x="-800" y="-460" width="1600" height="920" fill="url(#f)"/></mask>
<mask id="c" maskUnits="userSpaceOnUse" x="-800" y="-460" width="1600" height="920"><rect x="-800" y="-460" width="1600" height="920" fill="url(#s)"/></mask></defs>
<g mask="url(#m)"><g mask="url(#c)" fill="none" stroke="${INK}" stroke-linecap="round">${filaments}</g></g>
<g transform="translate(-100 -100) scale(0.390625)"><circle cx="256" cy="256" r="256" fill="${PAPER}"/><circle cx="256" cy="256" r="249" fill="none" stroke="${INK}" stroke-width="14"/>
<g fill="${INK}"><path d="${MARK_HALF}"/><path transform="matrix(-1 0 0 1 512 0)" d="${MARK_HALF}"/></g></g>
</svg>`;
}

function letters(): string {
  const first = WORDMARK_LETTERS[0]?.[0] ?? 0;
  const paths = WORDMARK_LETTERS.map(
    ([x, d]) => `<path transform="translate(${x} 176.5)" d="${d}"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${first} 176.5 ${1920 - first} 200"><g fill="${INK}">${paths}</g></svg>`;
}

async function fonts() {
  const dir = join(process.cwd(), "assets/fonts");
  const [medium, bold] = await Promise.all([
    readFile(join(dir, "KumbhSans-Medium.woff")),
    readFile(join(dir, "KumbhSans-ExtraBold.woff")),
  ]);
  return [
    { name: "Kumbh Sans", data: medium, weight: 500 as const, style: "normal" as const },
    { name: "Kumbh Sans", data: bold, weight: 800 as const, style: "normal" as const },
  ];
}

export async function card({
  context,
  title,
  footer,
}: {
  context: string;
  title: string;
  footer: string;
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: PAPER,
        color: INK,
        fontFamily: "Kumbh Sans",
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: ImageResponse draws plain elements. */}
      <img
        src={uri(art())}
        width={2000}
        height={1150}
        alt=""
        style={{ position: "absolute", left: -10, top: -260 }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 760,
          height: "100%",
          padding: "64px 0 60px 72px",
        }}
      >
        {/* biome-ignore lint/performance/noImgElement: ImageResponse draws plain elements. */}
        <img src={uri(letters())} width={170} height={26} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, fontWeight: 500, color: MUTED, marginBottom: 18 }}>
            {context}
          </div>
          <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.06, letterSpacing: -1.5 }}>
            {title}
          </div>
        </div>
        <div style={{ fontSize: 24, fontWeight: 500, color: MUTED }}>{footer}</div>
      </div>
    </div>,
    { ...OG_SIZE, fonts: await fonts() },
  );
}
