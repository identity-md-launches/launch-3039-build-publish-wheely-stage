// Maps live telemetry to what the stage does. Pure, so the scaling rules can be tested.

export type StageMode =
  /** No reading has ever arrived: curtains closed. */
  | "closed"
  /** Feed stale or offline: the last pose holds and nothing moves. */
  | "frozen"
  /** coreStatus is not ACTIVE: asleep, dim sparks, slow breathing. */
  | "idle"
  /** coreStatus is ACTIVE: speed lines and sparks scale with rpmMilli. */
  | "active";

export interface StageInput {
  mode: StageMode;
  rpmMilli: number;
  speedMmPerSecond: number;
  /** Increments on each settled round. */
  celebrationId: number;
}

/** 120 RPM is treated as a flat-out hamster sprint. Anything faster stays at full intensity. */
export const FULL_INTENSITY_RPM_MILLI = 120_000;
export const MAX_SPEED_LINES = 34;
/** The drawn wheel stands in for a real one of this circumference, so the spin tracks real speed. */
export const DRAWN_WHEEL_CIRCUMFERENCE_MM = 880;
/** Above this the spokes would strobe backwards, so the drawing stops speeding up. */
const MAX_DEGREES_PER_SECOND = 1080;

export function intensity(rpmMilli: number): number {
  return Math.min(1, Math.max(0, rpmMilli / FULL_INTENSITY_RPM_MILLI));
}

export function speedLineCount(input: StageInput): number {
  return input.mode === "active" ? Math.round(intensity(input.rpmMilli) * MAX_SPEED_LINES) : 0;
}

export function sparksPerSecond(input: StageInput): number {
  if (input.mode === "active") return intensity(input.rpmMilli) * 110;
  return input.mode === "idle" ? 1.4 : 0;
}

export function wheelDegreesPerSecond(input: StageInput): number {
  if (input.mode !== "active" || input.speedMmPerSecond <= 0) return 0;
  return Math.min(MAX_DEGREES_PER_SECOND, (input.speedMmPerSecond / DRAWN_WHEEL_CIRCUMFERENCE_MM) * 360);
}

export function describeStage(input: StageInput): string {
  switch (input.mode) {
    case "closed":
      return "Stage with its curtains closed, waiting for the first wheel reading.";
    case "frozen":
      return "Stage paused with the curtains half drawn. The wheel signal is not fresh.";
    case "idle":
      return "Cartoon hamster asleep in its wheel on a dim stage.";
    case "active":
      return input.speedMmPerSecond > 0
        ? "Cartoon hamster running in its spinning wheel under a bright spotlight."
        : "Cartoon hamster awake in a still wheel under a bright spotlight.";
  }
}
