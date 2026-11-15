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
