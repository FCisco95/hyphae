import { z } from "zod";

const STATUS_RE = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/;

export interface XPost {
  id: string;
  handle: string;
  text: string;
  url: string;
}

export function parsePostUrl(url: string): { handle: string; id: string } | null {
  const m = STATUS_RE.exec(url);
  return m ? { handle: m[1] as string, id: m[2] as string } : null;
}

const OEmbed = z.object({ author_name: z.string(), author_url: z.url(), html: z.string() });

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&mdash;": "—",
  "&nbsp;": " ",
};

function textFromHtml(html: string): string {
  const inner = /<p[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
  return inner
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39|mdash|nbsp);/g, (e) => ENTITIES[e] ?? e)
    .trim();
}

// publish.x.com/oembed is public and unauthenticated; one call per post, no API credits.
export async function fetchPost(url: string): Promise<XPost | null> {
  const parsed = parsePostUrl(url);
  if (!parsed) return null;
  const canonical = `https://x.com/${parsed.handle}/status/${parsed.id}`;
  const res = await fetch(
    `https://publish.x.com/oembed?omit_script=1&url=${encodeURIComponent(canonical)}`,
    {
      headers: { "user-agent": "hyphae/0.1 (+https://hyphae.fun)" },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!res.ok) return null;
  const body = OEmbed.safeParse(await res.json());
  if (!body.success) return null;
  const handle = new URL(body.data.author_url).pathname.slice(1);
  return {
    id: parsed.id,
    handle,
    text: textFromHtml(body.data.html),
    url: `https://x.com/${handle}/status/${parsed.id}`,
  };
}
