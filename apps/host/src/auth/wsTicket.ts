import { randomBytes } from 'node:crypto';
export const secret = (): string => randomBytes(24).toString('base64url');
export interface TicketScope { roomId: string; deviceId: string; buildId: string }
export class WsTickets {
  private readonly entries = new Map<string, TicketScope & { expires: number }>();
  constructor(private readonly now = Date.now, private readonly ttlMs = 30_000, private readonly cap = 32) {}
  mint(scope: TicketScope): string {
    this.prune();
    if (this.entries.size >= this.cap) throw new Error('RATE_LIMITED');
    const ticket = secret(); this.entries.set(ticket, { ...scope, expires: this.now() + this.ttlMs }); return ticket;
  }
  consume(ticket: string, expected: Pick<TicketScope, 'roomId' | 'buildId'>): TicketScope | null {
    const entry = this.entries.get(ticket); this.entries.delete(ticket);
    if (!entry || entry.expires <= this.now() || entry.roomId !== expected.roomId || entry.buildId !== expected.buildId) return null;
    return { roomId: entry.roomId, deviceId: entry.deviceId, buildId: entry.buildId };
  }
  revoke(deviceId: string): void { for (const [key, entry] of this.entries) if (entry.deviceId === deviceId) this.entries.delete(key); }
  private prune(): void { for (const [key, entry] of this.entries) if (entry.expires <= this.now()) this.entries.delete(key); }
}
