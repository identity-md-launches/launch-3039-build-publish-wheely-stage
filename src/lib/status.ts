// Parsing for GET https://api.squeekchain.com/v1/status.
// Counters arrive as decimal strings and can outgrow Number.MAX_SAFE_INTEGER, so every
// counter stays a bigint until the moment it is formatted or clamped for drawing.

export const STATUS_URL = "https://api.squeekchain.com/v1/status";
export const DEFAULT_STALE_AFTER_SECONDS = 120;

export interface Measurement {
  freshness: string;
  active: boolean;
  observedAtMs: number | null;
  staleAfterSeconds: number;
  counterEpoch: string | null;
  rpmMilli: bigint | null;
  speedMmPerSecond: bigint | null;
  distanceMm: bigint | null;
  workUnits: bigint | null;
}

export interface Anchor {
  round: bigint | null;
  blockHeight: bigint | null;
  cumulativeWork: bigint | null;
}

export interface ParsedStatus {
  generatedAtMs: number | null;
  measurement: Measurement | null;
  anchor: Anchor | null;
}

/** Non-negative integer from a decimal string or a safe JSON number; anything else is null. */
export function toBig(value: unknown): bigint | null {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return BigInt(value.trim());
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  return null;
}

function toMs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseMeasurement(raw: unknown): Measurement | null {
  const m = record(raw);
  if (!m) return null;
  const stale = m.staleAfterSeconds;
  return {
    freshness: typeof m.freshness === "string" ? m.freshness : "unknown",
    active: m.coreStatus === "ACTIVE",
    observedAtMs: toMs(m.observedAt),
    staleAfterSeconds:
      typeof stale === "number" && Number.isFinite(stale) && stale > 0
        ? stale
        : DEFAULT_STALE_AFTER_SECONDS,
    counterEpoch: typeof m.counterEpoch === "string" ? m.counterEpoch : null,
    rpmMilli: toBig(m.rpmMilli),
    speedMmPerSecond: toBig(m.speedMmPerSecond),
    distanceMm: toBig(m.distanceMm),
    workUnits: toBig(m.cumulativeWorkUnits),
  };
}

function parseAnchor(raw: unknown): Anchor | null {
  const a = record(raw);
  if (!a) return null;
  return {
    round: toBig(a.settledThroughRound),
    blockHeight: toBig(a.blockHeight),
    cumulativeWork: toBig(a.cumulativeWork),
  };
}

/**
 * The API can answer with part of the payload (builder.anchor is sometimes absent), so each
 * block is optional. Throws only when the body is not a status object at all.
 */
export function parseStatus(raw: unknown): ParsedStatus {
  const root = record(raw);
  if (!root) throw new Error("Status response is not an object");
  const measurement = parseMeasurement(root.measurement);
  const anchor = parseAnchor(record(root.builder)?.anchor);
  if (!measurement && !anchor) throw new Error("Status response has no telemetry");
  return { generatedAtMs: toMs(root.generatedAt), measurement, anchor };
}

const GROUP = new Intl.NumberFormat("en-US");

export function formatInt(value: bigint | null): string {
  return value === null ? "--" : GROUP.format(value);
}

/** Rounded to one decimal with integer arithmetic: 45678n becomes "45.7". */
export function formatRpm(rpmMilli: bigint | null): string {
  if (rpmMilli === null) return "--";
  const tenths = (rpmMilli + 50n) / 100n;
  return `${GROUP.format(tenths / 10n)}.${tenths % 10n}`;
}

/** Millimetres as kilometres with three decimals: 6348818n becomes "6.349". */
export function formatKm(distanceMm: bigint | null): string {
  if (distanceMm === null) return "--";
  const metres = (distanceMm + 500n) / 1000n;
  return `${GROUP.format(metres / 1000n)}.${(metres % 1000n).toString().padStart(3, "0")}`;
}

/** Millimetres as metres with one decimal: 12345n becomes "12.3". */
export function formatMetres(distanceMm: bigint | null): string {
  if (distanceMm === null) return "--";
  const tenths = (distanceMm + 50n) / 100n;
  return `${GROUP.format(tenths / 10n)}.${tenths % 10n}`;
}

/** A bigint as a number for drawing, clamped so huge values cannot become Infinity. */
export function clampToNumber(value: bigint | null, max: number): number {
  if (value === null || value <= 0n) return 0;
  return value >= BigInt(max) ? max : Number(value);
}
