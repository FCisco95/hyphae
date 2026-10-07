import { parsePostUrl } from "./oembed.js";

export interface EngageLink {
  label: string;
  url: string;
}

// X's web intents open the composer already attached to the raid post, so replying or quoting is
// one tap from Telegram. The quote intent attaches the canonical post address, which X shows as a
// quoted post.
export function engageLinks(postUrl: string): EngageLink[] {
  const post = parsePostUrl(postUrl);
  if (!post) return [{ label: "Open the post", url: postUrl }];
  const canonical = `https://x.com/${post.handle}/status/${post.id}`;
  return [
    { label: "Reply on X", url: `https://x.com/intent/tweet?in_reply_to=${post.id}` },
    { label: "Quote on X", url: `https://x.com/intent/tweet?url=${encodeURIComponent(canonical)}` },
  ];
}
