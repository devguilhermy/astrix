export const MAX_FRAME_BYTES = 8192;
export const MAX_QUEUE = 256;
export const MAX_BUFFER_BYTES = 256 * 1024;
/** Bounded fixed windows; callers allow multiple devices per IP. Boundary bursts are possible. */
export class RateLimit {
  private readonly windows = new Map<string, { start: number; count: number }>();
  constructor(private readonly limit: number, private readonly windowMs: number, private readonly now = Date.now, private readonly cap = 1024) {}
  consume(key: string): boolean {
    const now = this.now(); let entry = this.windows.get(key);
    if (!entry || now - entry.start >= this.windowMs) {
      for (const [id, value] of this.windows) if (now - value.start >= this.windowMs) this.windows.delete(id);
      if (this.windows.size >= this.cap && !this.windows.has(key)) return false;
      entry = { start: now, count: 0 }; this.windows.set(key, entry);
    }
    return ++entry.count <= this.limit;
  }
}
export function requestBoundary(request: Request, host: string, originRequired: boolean): boolean {
  if (request.headers.get('host') !== host || new URL(request.url).host !== host) return false;
  const origin = request.headers.get('origin');
  return originRequired ? origin === `http://${host}` : origin === null || origin === `http://${host}`;
}
/** Reject before parsing; do not trust Content-Length alone. */
export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new Error('BAD_MESSAGE');
  if (Number(request.headers.get('content-length') ?? 0) > MAX_FRAME_BYTES) throw new Error('BAD_MESSAGE');
  if (!request.body) throw new Error('BAD_MESSAGE');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_FRAME_BYTES) throw new Error('BAD_MESSAGE'); chunks.push(value); } }
  finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
