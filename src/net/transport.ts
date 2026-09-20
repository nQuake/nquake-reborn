// Fetching one file: a byte stream with retries. Transient failures (network
// errors, 5xx, 429) back off and retry; a 404 is final — the manifest and
// the tree disagree, which retrying won't fix.

export interface Transport {
  open(
    url: string,
    expectedSize: number,
    signal?: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>>;
  text(url: string, signal?: AbortSignal): Promise<string>;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export function createHttpTransport(
  fetchImpl: typeof fetch = fetch,
  opts: { attempts?: number; baseDelayMs?: number } = {},
): Transport {
  const attempts = opts.attempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 800;

  async function request(url: string, signal?: AbortSignal): Promise<Response> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      try {
        const res = await fetchImpl(url, { signal, cache: "default" });
        if (res.ok) return res;
        if (!RETRYABLE.has(res.status)) throw new HttpError(res.status, url);
        lastError = new HttpError(res.status, url);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        if (e instanceof HttpError && !RETRYABLE.has(e.status)) throw e;
        lastError = e;
      }
      if (i < attempts - 1) {
        await delay(baseDelayMs * 2 ** i + Math.random() * 250, signal);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  return {
    async open(url, _expectedSize, signal) {
      const res = await request(url, signal);
      if (!res.body) throw new Error(`No body for ${url}`);
      return res.body;
    },
    async text(url, signal) {
      return (await request(url, signal)).text();
    },
  };
}
