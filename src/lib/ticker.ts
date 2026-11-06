// Ticker lines built only from real fields. Empty values drop their line instead of guessing.

import type { LiveState } from "./live";
import { formatInt, formatKm, formatRpm } from "./status";

export const TICKER_SWAP_MS = 7000;

export function tickerLines(live: LiveState): string[] {
  if (live.link === "connecting") return ["Waiting for the first wheel reading."];
  const hasData = live.reading !== null;
  if (live.link === "offline") {
    return [
      hasData
        ? "Unable to reach the wheel feed. Numbers are frozen."
        : "Unable to reach the wheel feed. Retrying.",
    ];
  }
  if (live.link === "stale") return ["Wheel readings are not fresh. Numbers are frozen."];

  const lines: string[] = [];
  const { reading, anchor } = live;
  if (reading?.active && reading.rpmMilli !== null) lines.push(`The wheel is turning at ${formatRpm(reading.rpmMilli)} RPM.`);
  if (reading && !reading.active) lines.push("The wheel is idle. Quiet on the set, please.");
  if (anchor?.round != null && anchor.blockHeight != null) {
    lines.push(`Round ${formatInt(anchor.round)} is settled at block ${formatInt(anchor.blockHeight)}.`);
  }
  if (reading?.distanceMm != null) lines.push(`${formatKm(reading.distanceMm)} km on the wheel so far.`);
  return lines.length ? lines : ["Waiting for the next wheel reading."];
}
