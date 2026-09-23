/** Bound the actual streamed body, including chunked requests with no Content-Length. */
export class RequestBodyError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function readRequestText(req: Request, maxBytes = 4_000_000): Promise<string> {
  const length = req.headers.get("content-length");
  if (length && Number(length) > maxBytes) throw new RequestBodyError("Request body is too large.", 413);
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { void reader.cancel().catch(() => {}); throw new RequestBodyError("Request body is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
export async function readRequestJson(req: Request, maxBytes?: number): Promise<unknown> {
  return JSON.parse(await readRequestText(req, maxBytes));
}
