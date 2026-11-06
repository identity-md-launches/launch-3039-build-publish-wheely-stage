// Polls the status endpoint on a self-rescheduling timer, so requests never overlap.

import { parseStatus, STATUS_URL, type ParsedStatus } from "./status";

export const POLL_INTERVAL_MS = 1750;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_RETRY_AFTER_MS = 30_000;

export interface PollerHandlers {
  onStatus: (status: ParsedStatus) => void;
  onFailure: () => void;
}

export interface PollerOptions {
  url?: string;
  intervalMs?: number;
  fetchImpl?: typeof fetch;
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  const seconds = header === null ? Number.NaN : Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, MAX_RETRY_AFTER_MS) : null;
}

/** Starts polling immediately and returns a function that stops it. */
export function startPoller(handlers: PollerHandlers, options: PollerOptions = {}): () => void {
  const { url = STATUS_URL, intervalMs = POLL_INTERVAL_MS, fetchImpl = fetch.bind(globalThis) } = options;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: AbortController | undefined;

  const poll = async () => {
    const controller = new AbortController();
    inFlight = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let delay = intervalMs;
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) {
        delay = Math.max(delay, retryAfterMs(response) ?? 0);
        throw new Error(`Status answered ${response.status}`);
      }
      const status = parseStatus(await response.json());
      if (!stopped) handlers.onStatus(status);
    } catch {
      if (!stopped) handlers.onFailure();
    } finally {
      clearTimeout(timeout);
    }
    if (!stopped) timer = setTimeout(() => void poll(), delay);
  };

  void poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
    inFlight?.abort();
  };
}
