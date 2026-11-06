import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import type { LiveState } from "../lib/live";
import { roundDistanceMm } from "../lib/live";
import {
  advance,
  HEAT_S,
  LAP_M,
  newHeat,
  readBest,
  score,
  startTracker,
  stride,
  trackWheel,
  writeBest,
  type Heat,
  type WheelTracker,
} from "../lib/race";
import { clampToNumber, formatMetres } from "../lib/status";

const RESTART_LOCK_MS = 900;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function MiniHamster({ ghost }: { ghost?: boolean }) {
  const fur = ghost ? "#cfe7f5" : "#dc9650";
  const belly = ghost ? "#f4fbff" : "#fdf0dc";
  return (
    <svg className="mini" viewBox="0 0 44 30" aria-hidden="true" opacity={ghost ? 0.85 : 1}>
      <ellipse cx="17" cy="17" rx="15" ry="11" fill={fur} />
      <ellipse cx="19" cy="21" rx="10" ry="6.5" fill={belly} />
      <circle cx="30" cy="12" r="9" fill={fur} />
      <circle cx="27" cy="4.5" r="3.4" fill={fur} />
      <ellipse cx="34" cy="16" rx="5" ry="4" fill={belly} />
      <circle cx="33" cy="10.5" r="1.8" fill="#2a1118" />
      <ellipse cx="39" cy="14" rx="1.6" ry="1.2" fill="#d9616f" />
    </svg>
  );
}

function Lane({ name, value, position, ghost }: { name: string; value: string; position: number; ghost?: boolean }) {
  return (
    <div className="lane">
      <div className="lane-label">
        <span>{name}</span>
        <strong>{value}</strong>
      </div>
      <div className="lane-track" data-position={position.toFixed(3)}>
        <div className="lane-runner" style={{ "--p": position } as CSSProperties}>
          <MiniHamster ghost={ghost} />
        </div>
      </div>
    </div>
  );
}

function resultText(heat: Heat, isBest: boolean): string {
  const points = score(heat);
  const gap = Math.abs(heat.ghostM - heat.wheelM).toFixed(1);
  const time = heat.t.toFixed(1);
  let line: string;
  if (heat.outcome === "ghost") {
    line =
      heat.wheelM > 0
        ? `You beat the wheel by ${gap} m in ${time} s. Score ${points}.`
        : `You reached the line in ${time} s and the wheel reported no new distance. Score ${points}.`;
  } else if (heat.outcome === "wheel") {
    line = `The wheel reached the line ${gap} m ahead of your ghost. Score ${points}.`;
  } else {
    line = `Time. Your ghost covered ${heat.ghostM.toFixed(1)} m and the wheel ${heat.wheelM.toFixed(1)} m. Score ${points}.`;
  }
  if (!heat.ranked) return `${line} Practice heat: not saved because the wheel signal dropped.`;
  return isBest ? `${line} New best.` : line;
}

export function GhostRace({ live }: { live: LiveState }) {
  const [heat, setHeat] = useState<Heat | null>(null);
  const [best, setBest] = useState<number | null>(() => readBest(safeStorage()));
  const [newBest, setNewBest] = useState(false);
  const [locked, setLocked] = useState(false);

  const isLive = live.link === "live";
  const reading = live.reading;
  const running = heat !== null && heat.outcome === null;

  const heatRef = useRef<Heat | null>(null);
  const trackerRef = useRef<WheelTracker>(startTracker(null, null));
  const liveRef = useRef(isLive);
  liveRef.current = isLive;

  const commit = useCallback((next: Heat | null) => {
    heatRef.current = next;
    setHeat(next);
  }, []);

  // Only real readings move the wheel lane.
  useEffect(() => {
    if (!running || !reading) return;
    trackerRef.current = trackWheel(trackerRef.current, reading.counterEpoch, reading.distanceMm);
  }, [running, reading]);

  // Runs for the length of a heat, and only then.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const current = heatRef.current;
      if (!current || current.outcome) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const wheelM = clampToNumber(trackerRef.current.travelled, Number.MAX_SAFE_INTEGER) / 1000;
      commit(advance(current, dt, wheelM, liveRef.current));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, commit]);

  // Settle the score when a heat ends, then hold the button briefly so a late tap cannot restart.
  const finished = heat?.outcome ?? null;
  useEffect(() => {
    if (!finished || !heat) return;
    const points = score(heat);
    if (heat.ranked && points > (best ?? 0)) {
      setBest(points);
      setNewBest(true);
      writeBest(safeStorage(), points);
    }
    setLocked(true);
    const timer = setTimeout(() => setLocked(false), RESTART_LOCK_MS);
    return () => clearTimeout(timer);
    // Runs once per finished heat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const start = () => {
    trackerRef.current = startTracker(reading?.counterEpoch ?? null, reading?.distanceMm ?? null);
    setNewBest(false);
    commit(stride(newHeat(isLive)));
  };

  const tap = useCallback(() => {
    const current = heatRef.current;
    if (current && !current.outcome) commit(stride(current));
  }, [commit]);

  // Space works anywhere on the page during a heat. A held key does not repeat strides.
  useEffect(() => {
    if (!running) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      if (!event.repeat) tap();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [running, tap]);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (running && event.button === 0) tap();
  };

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (locked) return;
    if (!running) start();
    // detail is 0 for Enter on the focused button. Pointer taps were counted on pointer down.
    else if (event.detail === 0) tap();
  };

  const stumbling = running && heat.t < heat.stumbleUntil;
  const roundMm = roundDistanceMm(reading, live.anchor);
  const wheelValue = running || finished
    ? `${(heat?.wheelM ?? 0).toFixed(1)} m since the start`
    : roundMm === null
      ? "-- m this round"
      : `${formatMetres(roundMm)} m this round`;

  let hint: string;
  if (finished && heat) hint = resultText(heat, newBest);
  else if (stumbling) hint = "Stumbled. Slow your taps and wait for your ghost to recover.";
  else if (running) hint = "Keep a steady rhythm of about three taps a second.";
  else if (!isLive) hint = "The wheel signal is down, so a heat now is practice and will not count toward your best.";
  else hint = "Beat the real wheel over 30 m. Tap Run or press Space about three times a second, because mashing makes your ghost stumble.";

  const label = running ? "Run" : finished ? "Race again" : "Start race";
  const clock = running || finished ? `${Math.max(0, HEAT_S - (heat?.t ?? 0)).toFixed(1)} s left` : `${HEAT_S} s heat`;

  return (
    <section className="race" aria-labelledby="race-title" data-phase={finished ? "done" : running ? "running" : "ready"}>
      <div className="race-head">
        <h2 id="race-title">Ghost race</h2>
        <p className="race-clock">{clock}</p>
      </div>

      <div className="lanes">
        <Lane name="Live wheel" value={wheelValue} position={(heat?.wheelM ?? 0) / LAP_M} />
        <Lane name="Your ghost" value={`${(heat?.ghostM ?? 0).toFixed(1)} m`} position={(heat?.ghostM ?? 0) / LAP_M} ghost />
      </div>

      <button
        type="button"
        className={`action${stumbling ? " action-stumble" : ""}`}
        aria-disabled={locked || undefined}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        {label}
      </button>

      <p className="race-hint" role="status">
        {hint}
      </p>

      <p className="race-best">
        {best === null ? "No best score yet." : `Best score: ${best}.`} Saved only in this browser.
      </p>
    </section>
  );
}
