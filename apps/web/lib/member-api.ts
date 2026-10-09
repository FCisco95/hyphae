import { MemberAccountSchema } from "@hyphae/core";

const unavailable = () => ({ status: 503, body: { error: "unavailable" } });
const failures: Record<number, string> = {
  400: "invalid_request",
  401: "unauthorized",
  404: "not_found",
  429: "unavailable",
  503: "unavailable",
};

export async function readPrivateMember({
  mint,
  token,
  apiUrl,
  signal,
  webToken,
  visitor,
}: {
  mint: string;
  token: string;
  apiUrl: string;
  signal?: AbortSignal;
  webToken?: string;
  visitor?: string;
}): Promise<{ status: number; body: unknown }> {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) abort.abort();
  const timer = setTimeout(cancel, 5500);
  try {
    const url = new URL(apiUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return unavailable();
    if (
      !/^[A-Za-z0-9]{1,64}$/.test(mint) ||
      token.length > 4096 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
    )
      return unavailable();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (webToken && visitor && /^[0-9A-Fa-f:.]{1,45}$/.test(visitor)) {
      headers["x-hyphae-web-token"] = webToken;
      headers["x-hyphae-visitor"] = visitor;
    }
    const upstream = await fetch(
      `${url.origin}/member/v1/communities/${encodeURIComponent(mint)}/me`,
      {
        headers,
        cache: "no-store",
        redirect: "error",
        signal: abort.signal,
      },
    );
    if (upstream.status !== 200)
      return {
        status: failures[upstream.status] ? upstream.status : 503,
        body: { error: failures[upstream.status] ?? "unavailable" },
      };
    const reader = upstream.body?.getReader();
    if (!reader) return unavailable();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 16384) throw new Error("member_unavailable");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const data = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const parsed = MemberAccountSchema.safeParse(JSON.parse(new TextDecoder().decode(data)));
    if (!parsed.success || parsed.data.community.mint !== mint) return unavailable();
    return { status: 200, body: parsed.data };
  } catch {
    return unavailable();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    abort.abort();
  }
}
