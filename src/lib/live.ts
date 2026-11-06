// Pure state for the live feed. Every page renders from LiveState, so the rules below decide
// what is shown: never invent a number, and freeze the last good one when the feed goes quiet.

import { captionFor } from "./captions";
import { DEFAULT_STALE_AFTER_SECONDS, type Anchor, type Measurement, type ParsedStatus } from "./status";

export type Link = "connecting" | "live" | "stale" | "offline";

export interface Celebration {
  id: number;
  round: bigint;
  caption: string;
}

export interface LiveState {
  link: Link;
  /** Last good reading. Frozen unless link is "live". */
  reading: Measurement | null;
  /** Last good builder.anchor. Frozen unless link is "live". */
  anchor: Anchor | null;
  /** True when the feed is live but builder.anchor is missing from the current answer. */
  anchorMissing: boolean;
  ageSeconds: number | null;
  staleAfterSeconds: number;
  celebration: Celebration | null;
  /** Newest server time seen, and the local time it was first seen. Absorbs viewer clock skew. */
  serverClock: { serverMs: number; localMs: number } | null;
}

export const initialLiveState: LiveState = {
  link: "connecting",
  reading: null,
  anchor: null,
  anchorMissing: false,
  ageSeconds: null,
  staleAfterSeconds: DEFAULT_STALE_AFTER_SECONDS,
  celebration: null,
  serverClock: null,
};

function nextClock(state: LiveState, generatedAtMs: number | null, nowMs: number): LiveState["serverClock"] {
  if (generatedAtMs === null) return state.serverClock;
  // A frozen generatedAt keeps its first local time, so a stuck cache still ages out.
  if (state.serverClock && generatedAtMs <= state.serverClock.serverMs) return state.serverClock;
  return { serverMs: generatedAtMs, localMs: nowMs };
}

function ageOf(observedAtMs: number | null, clock: LiveState["serverClock"], nowMs: number): number | null {
  if (observedAtMs === null) return null;
  const serverNow = clock ? clock.serverMs + (nowMs - clock.localMs) : nowMs;
  return Math.max(0, serverNow - observedAtMs) / 1000;
}

export function applyStatus(state: LiveState, status: ParsedStatus, nowMs: number): LiveState {
  // A cache can answer out of order. Discard its values, but keep aging the retained reading.
  if (status.generatedAtMs !== null && state.serverClock && status.generatedAtMs < state.serverClock.serverMs) {
    const ageSeconds = ageOf(state.reading?.observedAtMs ?? null, state.serverClock, nowMs);
    return {
      ...state,
      ageSeconds,
      link: state.link === "live" && (ageSeconds === null || ageSeconds > state.staleAfterSeconds) ? "stale" : state.link,
    };
  }
  const serverClock = nextClock(state, status.generatedAtMs, nowMs);
  const m = status.measurement;
  const staleAfterSeconds = m?.staleAfterSeconds ?? state.staleAfterSeconds;
  const ageSeconds = m ? ageOf(m.observedAtMs, serverClock, nowMs) : null;
  const fresh = !!m && m.freshness === "online" && ageSeconds !== null && ageSeconds <= staleAfterSeconds;

  if (!fresh) {
    // Numbers stay frozen. A page that opens during an outage has no last good reading of its
    // own, so it shows what the feed last reported, marked stale.
    return {
      ...state,
      link: m?.freshness === "offline" ? "offline" : "stale",
      reading: state.reading ?? m,
      anchor: state.anchor ?? status.anchor,
      anchorMissing: false,
      ageSeconds,
      staleAfterSeconds,
      serverClock,
    };
  }

  let celebration = state.celebration;
  const previous = state.anchor?.round ?? null;
  const round = status.anchor?.round ?? null;
  if (previous !== null && round !== null && round > previous) {
    celebration = {
      id: (celebration?.id ?? 0) + 1,
      round,
      caption: captionFor(round, status.anchor?.blockHeight ?? null),
    };
  }

  return {
    ...state,
    link: "live",
    reading: m,
    anchor: status.anchor ?? state.anchor,
    anchorMissing: !status.anchor,
    ageSeconds,
    staleAfterSeconds,
    celebration,
    serverClock,
  };
}

export function applyFailure(state: LiveState, nowMs: number): LiveState {
  return {
    ...state,
    link: "offline",
    anchorMissing: false,
    ageSeconds: ageOf(state.reading?.observedAtMs ?? null, state.serverClock, nowMs),
  };
}

/** Distance the wheel has covered since the last settled round, or null when it cannot be known. */
export function roundDistanceMm(reading: Measurement | null, anchor: Anchor | null): bigint | null {
  const work = reading?.workUnits ?? null;
  const distance = reading?.distanceMm ?? null;
  const settled = anchor?.cumulativeWork ?? null;
  if (work === null || distance === null || settled === null || work === 0n || work < settled) return null;
  return ((work - settled) * distance) / work;
}
