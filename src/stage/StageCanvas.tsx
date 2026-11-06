import { useEffect, useMemo, useRef } from "react";
import type { LiveState } from "../lib/live";
import { clampToNumber } from "../lib/status";
import { describeStage, speedLineCount, sparksPerSecond, wheelDegreesPerSecond, type StageInput, type StageMode } from "./scene";
import { StageEngine } from "./StageEngine";

export function stageInputFrom(live: LiveState): StageInput {
  const reading = live.reading;
  let mode: StageMode;
  if (!reading) mode = "closed";
  else if (live.link !== "live") mode = "frozen";
  else mode = reading.active ? "active" : "idle";
  return {
    mode,
    // Clamped only for drawing. The HUD keeps formatting the exact bigint values.
    rpmMilli: clampToNumber(reading?.rpmMilli ?? null, 1_000_000),
    speedMmPerSecond: clampToNumber(reading?.speedMmPerSecond ?? null, 1_000_000),
    celebrationId: live.celebration?.id ?? 0,
  };
}

export function StageCanvas({ live, className }: { live: LiveState; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const engine = useRef<StageEngine | null>(null);
  const input = stageInputFrom(live);
  const { mode, rpmMilli, speedMmPerSecond, celebrationId } = input;
  const stable = useMemo<StageInput>(
    () => ({ mode, rpmMilli, speedMmPerSecond, celebrationId }),
    [mode, rpmMilli, speedMmPerSecond, celebrationId],
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const stage = new StageEngine(canvas);
    engine.current = stage;
    const measure = () => {
      const box = canvas.getBoundingClientRect();
      stage.resize(box.width, box.height, window.devicePixelRatio || 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    measure();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => stage.setReducedMotion(motion.matches);
    motion.addEventListener("change", onMotion);
    onMotion();
    // The canvas draws text, so redraw once the display font is ready.
    void document.fonts?.ready.then(measure);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
      stage.stop();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.setInput(stable);
  }, [stable]);

  return (
    <canvas
      ref={ref}
      className={className}
      role="img"
      aria-label={describeStage(stable)}
      data-mode={stable.mode}
      data-speed-lines={speedLineCount(stable)}
      data-sparks-per-second={sparksPerSecond(stable).toFixed(1)}
      data-wheel-degrees-per-second={wheelDegreesPerSecond(stable).toFixed(1)}
      data-celebration={stable.celebrationId}
    />
  );
}
