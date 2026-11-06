import type { LiveState } from "../lib/live";

/** ACTIVE or IDLE from measurement.coreStatus. Empty until a first reading exists. */
export function CoreBadge({ live }: { live: LiveState }) {
  if (!live.reading) return null;
  const active = live.reading.active;
  return <span className={`badge ${active ? "badge-active" : "badge-idle"}`}>{active ? "ACTIVE" : "IDLE"}</span>;
}

const CHIP = {
  connecting: { label: "Connecting", className: "chip-connecting" },
  stale: { label: "STALE", className: "chip-stale" },
  offline: { label: "OFFLINE", className: "chip-offline" },
} as const;

/** Only shown when the numbers cannot be trusted as current. */
export function FreshnessChip({ live }: { live: LiveState }) {
  if (live.link === "live") return null;
  const chip = CHIP[live.link];
  return <span className={`chip ${chip.className}`}>{chip.label}</span>;
}

export function ageText(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds < 90) return `${Math.round(seconds)} s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

export function freshnessLine(live: LiveState): string {
  const age = ageText(live.ageSeconds);
  switch (live.link) {
    case "connecting":
      return "Waiting for the first update";
    case "live":
      return age ? `Updated ${age} ago` : "Live";
    case "stale":
      return age ? `Frozen, last update ${age} ago` : "Frozen at the last update";
    case "offline":
      return live.reading ? (age ? `Frozen, last update ${age} ago` : "Frozen at the last update") : "No updates yet, retrying";
  }
}
