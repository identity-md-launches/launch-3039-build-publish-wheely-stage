import { useEffect, useState } from "react";
import type { LiveState } from "../lib/live";
import { parseModules } from "../lib/modules";
import { formatInt, formatKm, formatRpm } from "../lib/status";
import { TICKER_SWAP_MS, tickerLines } from "../lib/ticker";
import { useCaption, useLive } from "../lib/useLive";
import { CoreBadge, FreshnessChip, freshnessLine } from "../shared/LiveBits";
import { StageCanvas } from "../stage/StageCanvas";

function Hud({ live }: { live: LiveState }) {
  const { reading, anchor } = live;
  return (
    <section className="plate hud" aria-label="Wheel telemetry" data-link={live.link} data-core={reading?.active ? "active" : "idle"}>
      <div className="hud-status">
        <CoreBadge live={live} />
        <FreshnessChip live={live} />
        <span className="hud-age">{freshnessLine(live)}</span>
      </div>
      <dl className="hud-stats">
        <div className="hud-stat hud-stat-lead">
          <dt>RPM</dt>
          <dd data-field="rpm">{formatRpm(reading?.rpmMilli ?? null)}</dd>
        </div>
        <div className="hud-stat">
          <dt>Distance km</dt>
          <dd data-field="km">{formatKm(reading?.distanceMm ?? null)}</dd>
        </div>
        <div className="hud-stat">
          <dt>Settled round</dt>
          <dd data-field="round" key={live.celebration?.id ?? 0} className={live.celebration ? "hud-pop" : undefined}>
            {formatInt(anchor?.round ?? null)}
          </dd>
        </div>
        <div className="hud-stat">
          <dt>Block height</dt>
          <dd data-field="block">{formatInt(anchor?.blockHeight ?? null)}</dd>
        </div>
      </dl>
    </section>
  );
}

function Ticker({ live }: { live: LiveState }) {
  const lines = tickerLines(live);
  const [index, setIndex] = useState(0);
  const count = lines.length;
  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => setIndex((i) => i + 1), TICKER_SWAP_MS);
    return () => clearInterval(timer);
  }, [count]);
  const line = lines[index % count] ?? "";
  return (
    <section className="plate ticker" aria-label="Ticker" data-link={live.link}>
      <span className="ticker-brand">WHEELY</span>
      <p key={line} className="ticker-line">
        {line}
      </p>
    </section>
  );
}

export function Overlay() {
  const [modules] = useState(() => parseModules(window.location.search));
  const live = useLive();
  const caption = useCaption(live);
  const nothing = !modules.hud && !modules.stage && !modules.ticker;
  const showSide = modules.hud || modules.ticker || (modules.stage && caption !== null);

  return (
    <main className="overlay" data-modules={`${+modules.hud}${+modules.stage}${+modules.ticker}`}>
      <h1 className="visually-hidden">WHEELY Stage overlay</h1>
      {modules.stage && (
        <section className="ov-stage" aria-label="Hamster stage">
          <StageCanvas live={live} className="ov-canvas" />
          {!modules.hud && (
            <div className="ov-stage-chip">
              <FreshnessChip live={live} />
            </div>
          )}
        </section>
      )}
      {showSide && (
        <div className="ov-side">
          {modules.stage && (
            <div className="caption-slot" role="status">
              {caption && (
                <p className="caption" data-testid="caption">
                  {caption}
                </p>
              )}
            </div>
          )}
          {modules.hud && <Hud live={live} />}
          {modules.ticker && <Ticker live={live} />}
        </div>
      )}
      {nothing && <span className="visually-hidden">All overlay modules are turned off in this URL.</span>}
    </main>
  );
}
