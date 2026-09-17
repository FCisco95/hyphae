import { parsePostUrl } from "../../x/oembed.js";

export type SubmitArgs = { kind: "reply" | "quote"; url: string } | { kind: "text"; text: string };

// `/submit <link>` is a reply; `/submit quote <link>` is a quote; anything else is free-form text.
// oEmbed cannot tell a quote from a reply, so the member declares it and the URL dedupe catches
// the same post submitted twice.
export function parseSubmitArgs(raw: string): SubmitArgs | null {
  const text = raw.trim();
  if (!text) return null;
  const m = /^(quote)\s+(\S+)$/i.exec(text);
  if (m && parsePostUrl(m[2] as string)) return { kind: "quote", url: m[2] as string };
  if (parsePostUrl(text) && !/\s/.test(text)) return { kind: "reply", url: text };
  return { kind: "text", text };
}

export interface RaidArgs {
  url: string;
  hours: number;
  brief: string;
}

// `/raid <url> [hours] [brief…]`. The window defaults to the rubric's zeroAt so a raid stays
// open exactly as long as it can still earn credit.
export function parseRaidArgs(raw: string, zeroAtMinutes: number): RaidArgs | null {
  const [url = "", ...rest] = raw.trim().split(/\s+/);
  if (!url || !parsePostUrl(url)) return null;
  let hours = zeroAtMinutes / 60;
  if (rest.length && /^\d+(\.\d+)?$/.test(rest[0] as string)) {
    hours = Number(rest.shift());
    if (!(hours > 0)) return null;
  }
  return { url, hours, brief: rest.join(" ") };
}
