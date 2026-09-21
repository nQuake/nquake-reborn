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

/**
 * What one file costs: a fixed overhead — an HTTPS round trip to the CDN,
 * then creating and closing the file — plus a per-byte transfer cost. Both
 * are fitted by least squares over the files that most recently finished.
 *
 * An nQuake install needs both terms to estimate anything useful, because it
 * is two different workloads in a row. The queue runs largest first: ~70
 * files carry nearly all of the ~180 MB, and then ~450 more carry almost no
 * bytes at all but one round trip each. An ETA made of bytes and measured
 * bandwidth alone — which is what this replaced — reads fine for the first
 * half and then claims "16 minutes left" for the twenty seconds of round
 * trips that are actually left, because throughput in bytes collapses when
 * the work stops being about bytes.
 *
 * Durations are measured with the pool running, so they already include
 * whatever contention `concurrency` workers cause each other; dividing the
 * fitted total by the same concurrency takes it back out again.
 */
export class FileCostMeter {
  private samples: { bytes: number; ms: number }[] = [];

  constructor(private window = 60) {}

  /** Record a file that finished: how big it was and how long it took. */
  add(bytes: number, ms: number): void {
    this.samples.push({ bytes: Math.max(0, bytes), ms: Math.max(0, ms) });
    if (this.samples.length > this.window) {
      this.samples.splice(0, this.samples.length - this.window);
    }
  }

  /**
   * Seconds to finish `files` files totalling `bytes` at this concurrency,
   * or null while there is too little to fit a line to.
   */
  estimate(files: number, bytes: number, concurrency: number): number | null {
    const n = this.samples.length;
    if (n < 3) return null;
    if (files <= 0) return 0;
    let sx = 0;
    let sy = 0;
    for (const s of this.samples) {
      sx += s.bytes;
      sy += s.ms;
    }
    const mx = sx / n;
    const my = sy / n;
    let sxx = 0;
    let sxy = 0;
    for (const s of this.samples) {
      sxx += (s.bytes - mx) ** 2;
      sxy += (s.bytes - mx) * (s.ms - my);
    }
    // Per byte, then per file: a run of equal-sized files says nothing about
    // the slope, so it all becomes overhead rather than a wild extrapolation.
    const perByte = sxx > 0 ? Math.max(0, sxy / sxx) : 0;
    const perFile = Math.max(0, my - perByte * mx);
    const ms = files * perFile + perByte * Math.max(0, bytes);
    return ms / Math.max(1, concurrency) / 1000;
  }
}
