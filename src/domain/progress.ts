// Download speed and ETA, smoothed. Pure: the caller feeds timestamps.

export class RateMeter {
  private samples: { t: number; bytes: number }[] = [];
  private total = 0;

  constructor(private windowMs = 5000) {}

  add(bytes: number, now: number): void {
    this.total += bytes;
    this.samples.push({ t: now, bytes: this.total });
    const cutoff = now - this.windowMs;
    while (this.samples.length > 2 && (this.samples[0]?.t ?? 0) < cutoff) {
      this.samples.shift();
    }
  }

  /** Bytes per second over the recent window (0 until there are two samples). */
  rate(now: number): number {
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    if (!first || !last || first === last) return 0;
    const dt = Math.max(now - first.t, last.t - first.t, 1) / 1000;
    return (last.bytes - first.bytes) / dt;
  }

  /** Seconds left for `remaining` bytes at the current rate, or null. */
  eta(remaining: number, now: number): number | null {
    const r = this.rate(now);
    if (r <= 0) return null;
    return remaining / r;
  }
}
