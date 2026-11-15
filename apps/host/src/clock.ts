/** Wall-clock scheduling is transport policy, never a client-supplied simulation delta. */
export class HostClock {
  private previous: number | null = null;
  constructor(private readonly tick: (seconds: number) => void, private readonly stall: () => void, private readonly now = () => performance.now(), private readonly catchUpMs = 1000, private readonly chunkMs = 100) {}
  pulse(): void {
    const current = this.now(); const previous = this.previous;
    if (previous !== null && current <= previous) return;
    this.previous = current;
    if (previous === null) return;
    const elapsed = current - previous;
    if (elapsed > this.catchUpMs) { this.stall(); return; }
    // One bounded chunk per dispatch; the room yields between queued chunks.
    for (let remaining = elapsed; remaining > 0; remaining -= this.chunkMs) this.tick(Math.min(this.chunkMs, remaining) / 1000);
  }
}
export class RoomQueue {
  private readonly jobs: (() => void)[] = [];
  private scheduled = false;
  constructor(private readonly cap = 256, private readonly schedule: (job: () => void) => void = job => { setTimeout(job, 0); }) {}
  enqueue(job: () => void, priority = false): boolean {
    if (this.jobs.length >= this.cap - (priority ? 0 : 1)) return false;
    if (priority) this.jobs.unshift(job); else this.jobs.push(job);
    if (!this.scheduled) { this.scheduled = true; this.schedule(() => this.drain()); }
    return true;
  }
  private drain(): void {
    const job = this.jobs.shift(); try { job?.(); } catch (error) { console.error('ASTRIX: room job failed; the room keeps running.', error); } finally {
      if (this.jobs.length) this.schedule(() => this.drain()); else this.scheduled = false;
    }
  }
}
