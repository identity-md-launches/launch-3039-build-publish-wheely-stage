// Ghost race rules, kept pure so they can be tested without a browser. Everything is local:
// no money, no wallet, no server. Times are seconds, distances metres.

export const LAP_M = 30;
export const HEAT_S = 60;
export const TOP_SPEED = 1.4;
const STRIDE_BOOST = 0.45;
const DRAG = 0.8;
const MASH_S = 0.11;
const STUMBLE_S = 0.6;

export type Outcome = "ghost" | "wheel" | "time";

export interface Heat {
  t: number;
  ghostM: number;
  wheelM: number;
  speed: number;
  lastStride: number;
  stumbleUntil: number;
  /** False once the live signal drops at any point, which makes the heat practice only. */
  ranked: boolean;
  outcome: Outcome | null;
}

export function newHeat(live: boolean): Heat {
  return {
    t: 0,
    ghostM: 0,
    wheelM: 0,
    speed: 0,
    lastStride: Number.NEGATIVE_INFINITY,
    stumbleUntil: 0,
    ranked: live,
    outcome: null,
  };
}

/**
 * Average speed settles at STRIDE_BOOST * taps per second / DRAG, capped at TOP_SPEED, so about
 * three taps a second holds top speed and tapping faster gains nothing.
 * One tap. Strides closer together than MASH_S make the ghost stumble and shed speed. */
export function stride(heat: Heat): Heat {
  if (heat.outcome || heat.t < heat.stumbleUntil) return heat;
  if (heat.t - heat.lastStride < MASH_S) {
    return { ...heat, speed: heat.speed * 0.4, stumbleUntil: heat.t + STUMBLE_S, lastStride: heat.t };
  }
  return { ...heat, speed: Math.min(TOP_SPEED, heat.speed + STRIDE_BOOST), lastStride: heat.t };
}

export function advance(heat: Heat, dt: number, wheelM: number, live: boolean): Heat {
  if (heat.outcome) return heat;
  const t = heat.t + Math.max(0, dt);
  // Elapsed time includes suspended frames. Only motion is capped, so a resumed frame cannot
  // teleport the ghost or extend the heat beyond its deadline.
  const motionDt = Math.min(0.1, Math.max(0, dt), Math.max(0, HEAT_S - heat.t));
  const speed = heat.speed * Math.exp(-DRAG * motionDt);
  const ghostM = heat.ghostM + ((heat.speed + speed) / 2) * motionDt;
  const outcome: Outcome | null =
    t >= HEAT_S ? "time" : ghostM >= LAP_M && ghostM >= wheelM ? "ghost" : wheelM >= LAP_M ? "wheel" : null;
  return {
    ...heat,
    t: Math.min(t, HEAT_S),
    ghostM: Math.min(ghostM, LAP_M),
    wheelM: Math.min(wheelM, LAP_M),
    speed,
    ranked: heat.ranked && live,
    outcome,
  };
}

/** 10 points per metre, plus 10 per second left on the clock if the ghost reached the line first. */
export function score(heat: Heat): number {
  const metres = Math.round(heat.ghostM * 10);
  return heat.outcome === "ghost" ? metres + Math.round((HEAT_S - heat.t) * 10) : metres;
}

export interface WheelTracker {
  epoch: string | null;
  last: bigint;
  travelled: bigint;
}

export function startTracker(epoch: string | null, distanceMm: bigint | null): WheelTracker {
  return { epoch, last: distanceMm ?? 0n, travelled: 0n };
}

/** Adds real distance only. A counter reset (new epoch or lower reading) rebases without a jump. */
export function trackWheel(tracker: WheelTracker, epoch: string | null, distanceMm: bigint | null): WheelTracker {
  if (distanceMm === null) return tracker;
  if (epoch !== tracker.epoch || distanceMm < tracker.last) return { ...tracker, epoch, last: distanceMm };
  return { epoch, last: distanceMm, travelled: tracker.travelled + (distanceMm - tracker.last) };
}

const BEST_KEY = "wheely-stage.best-score";

export function readBest(storage: Pick<Storage, "getItem"> | null): number | null {
  try {
    const value = Number(storage?.getItem(BEST_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeBest(storage: Pick<Storage, "setItem"> | null, value: number): void {
  try {
    storage?.setItem(BEST_KEY, String(value));
  } catch {
    // Private browsing can refuse storage. The best score simply lasts for this visit.
  }
}
