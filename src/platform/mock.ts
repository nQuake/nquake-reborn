// The simulated install: a `Destination` that remembers what was "written"
// and a transport that produces bytes at a believable rate without touching
// the network. Used on phones, in browsers without the File System Access
// API, and by the screenshot harness (`?mock=1`).

import type { Destination, DestinationEntry } from "./destination.ts";
import type { Transport } from "../net/transport.ts";

export class MockDestination implements Destination {
  readonly kind = "mock";
  readonly canSetExecutable = false;
  private files = new Map<string, { size: number; text?: string }>();

  constructor(readonly name = "nQuake (simulated)") {}

  async stat(path: string) {
    const f = this.files.get(path);
    return f ? { size: f.size } : null;
  }

  async readText(path: string) {
    return this.files.get(path)?.text ?? null;
  }

  async list(): Promise<DestinationEntry[]> {
    const top = new Set<string>();
    for (const p of this.files.keys()) top.add(p.split("/")[0] ?? p);
    return [...top].map((name) => ({
      name,
      kind: name.includes(".") ? "file" : "directory",
    }));
  }

  async openWrite(path: string): Promise<WritableStream<Uint8Array>> {
    let size = 0;
    const files = this.files;
    return new WritableStream<Uint8Array>({
      write(chunk) {
        size += chunk.byteLength;
      },
      close() {
        files.set(path, { size });
      },
    });
  }

  async writeText(path: string, text: string) {
    this.files.set(path, {
      size: new TextEncoder().encode(text).byteLength,
      text,
    });
  }

  async rename(path: string, newName: string) {
    const f = this.files.get(path);
    if (!f) return;
    this.files.delete(path);
    const dirs = path.split("/");
    dirs.pop();
    this.files.set([...dirs, newName].join("/"), f);
  }

  async setExecutable() {}

  /** Paths written so far (for tests and the done screen). */
  written(): string[] {
    return [...this.files.keys()];
  }
}

const MOCK_TEMPLATE = "// simulated template\n";

/**
 * A transport that streams zeroed chunks for `size` bytes at roughly
 * `bytesPerSecond`, shared across concurrent downloads so the total rate
 * stays believable. `maxTotalMs` caps the whole simulation so a 600 MB
 * pretend install doesn't take longer than a coffee.
 */
export function createMockTransport(opts: {
  bytesPerSecond?: number;
  totalBytes: number;
  maxTotalMs?: number;
  concurrency: number;
}): Transport {
  const maxTotalMs = opts.maxTotalMs ?? 25_000;
  const nominal = opts.bytesPerSecond ?? 40 * 1024 * 1024;
  // Speed up until the whole plan fits inside maxTotalMs.
  const rate = Math.max(nominal, (opts.totalBytes / maxTotalMs) * 1000);
  const perStream = rate / Math.max(1, opts.concurrency);
  const chunkSize = 256 * 1024;
  const tickMs = (chunkSize / perStream) * 1000;

  return {
    async open(_url, expectedSize, signal) {
      let sent = 0;
      const chunk = new Uint8Array(chunkSize);
      return new ReadableStream<Uint8Array>({
        async pull(controller) {
          if (signal?.aborted) {
            controller.error(new DOMException("Aborted", "AbortError"));
            return;
          }
          if (sent >= expectedSize) {
            controller.close();
            return;
          }
          const n = Math.min(chunkSize, expectedSize - sent);
          await new Promise((r) => setTimeout(r, Math.max(1, tickMs)));
          controller.enqueue(n === chunkSize ? chunk : chunk.subarray(0, n));
          sent += n;
        },
      });
    },
    async text() {
      return MOCK_TEMPLATE;
    },
  };
}
