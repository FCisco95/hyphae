// Bound bytes while streaming, including a body whose reader ignores cancellation.
export async function boundedJson(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  signal: AbortSignal,
): Promise<unknown> {
  signal.throwIfAborted();
  const reader = body?.getReader();
  if (!reader) throw new Error("missing_body");
  let cancel = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    cancel = () => reject(new Error("cancelled"));
    signal.addEventListener("abort", cancel, { once: true });
  });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await Promise.race([reader.read(), cancelled]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("oversized_body");
      chunks.push(value);
    }
    const data = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } finally {
    signal.removeEventListener("abort", cancel);
    void reader.cancel().catch(() => {});
  }
}
