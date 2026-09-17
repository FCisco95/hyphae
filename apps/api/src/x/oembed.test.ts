import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPost, parsePostUrl } from "./oembed.js";

const oembed = (html: string, author = "jack") =>
  new Response(
    JSON.stringify({ author_name: author, author_url: `https://x.com/${author}`, html }),
    { status: 200 },
  );

describe("x oembed", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses x.com and twitter.com status urls", () => {
    expect(parsePostUrl("https://x.com/jack/status/20?s=1")).toEqual({ handle: "jack", id: "20" });
    expect(parsePostUrl("https://twitter.com/jack/status/20")).toEqual({
      handle: "jack",
      id: "20",
    });
    expect(parsePostUrl("https://example.com/x")).toBeNull();
  });

  it("extracts text and author from the oembed html", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        oembed(
          '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">just setting up my twttr</p>&mdash; jack (@jack) <a href="https://x.com/jack/status/20?ref_src=twsrc%5Etfw">March 21, 2006</a></blockquote>\n\n',
        ),
      ),
    );
    const post = await fetchPost("https://x.com/jack/status/20");
    expect(post).toEqual({
      id: "20",
      handle: "jack",
      text: "just setting up my twttr",
      url: "https://x.com/jack/status/20",
    });
  });

  it("decodes entities and line breaks, strips inner tags", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        oembed(
          '<blockquote><p lang="en" dir="ltr">fees &amp; splits<br>on-chain &gt; off-chain <a href="https://t.co/abc">https://t.co/abc</a></p>&mdash; jack (@jack)</blockquote>',
        ),
      ),
    );
    const post = await fetchPost("https://x.com/jack/status/21");
    expect(post?.text).toBe("fees & splits\non-chain > off-chain https://t.co/abc");
  });

  it("returns null when the post is private or gone", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not Found", { status: 404 })));
    expect(await fetchPost("https://x.com/jack/status/22")).toBeNull();
  });

  it("uses the handle from author_url, not the pasted one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => oembed("<p>hi there</p>", "RealJack")));
    const post = await fetchPost("https://x.com/whoever/status/23");
    expect(post?.handle).toBe("RealJack");
  });
});
