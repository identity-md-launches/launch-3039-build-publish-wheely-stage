import type { LiveState } from "../lib/live";
import { formatInt, formatKm, formatRpm } from "../lib/status";
import { useCaption, useLive } from "../lib/useLive";
import { CoreBadge, FreshnessChip, freshnessLine } from "../shared/LiveBits";
import { StageCanvas } from "../stage/StageCanvas";
import { GhostRace } from "./GhostRace";
import { ObsSetup } from "./ObsSetup";

function problemText(live: LiveState): string {
  if (live.link === "offline") {
    return live.reading
      ? "Unable to reach api.squeekchain.com. The numbers below are frozen until it answers. Retrying every 2 seconds."
      : "Unable to reach api.squeekchain.com, so there are no numbers to show. Retrying every 2 seconds.";
  }
  if (live.link === "stale") return "Wheel readings are out of date. The numbers below are frozen at the last good reading.";
  if (live.anchorMissing) return "The settled round is temporarily missing from the feed. Showing the last one seen.";
  return "";
}

/** Floats over the stage floor, so a notice never moves the Run button during a heat. */
function StageNotice({ live }: { live: LiveState }) {
  const caption = useCaption(live);
  const problem = problemText(live);
  return (
    <div className="stage-notice" role="status">
      {problem ? (
        <p className="notice notice-problem" data-testid="notice">
          {problem}
        </p>
      ) : caption ? (
        <p className="notice notice-caption" data-testid="caption">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

function Stats({ live }: { live: LiveState }) {
  const { reading, anchor } = live;
  return (
    <section className="live" aria-label="Live wheel telemetry" data-link={live.link} data-core={reading?.active ? "active" : "idle"}>
      <dl className="stats">
        <div className="stat stat-lead">
          <dt>RPM</dt>
          <dd className="stat-rpm">
            <span data-field="rpm">{formatRpm(reading?.rpmMilli ?? null)}</span>
            <CoreBadge live={live} />
          </dd>
        </div>
        <div className="stat stat-lead">
          <dt>Distance km</dt>
          <dd data-field="km">{formatKm(reading?.distanceMm ?? null)}</dd>
        </div>
        <div className="stat">
          <dt>Settled round</dt>
          <dd data-field="round">{formatInt(anchor?.round ?? null)}</dd>
        </div>
        <div className="stat">
          <dt>Block height</dt>
          <dd data-field="block">{formatInt(anchor?.blockHeight ?? null)}</dd>
        </div>
      </dl>
      <div className="live-status">
        <FreshnessChip live={live} />
        <span className="live-age">{freshnessLine(live)}</span>
      </div>
    </section>
  );
}

export function Desk() {
  const live = useLive();
  return (
    <div className="desk">
      <header className="desk-header">
        <div className="brand">
          <h1 className="brand-name">WHEELY Stage</h1>
          <p className="brand-line">A live hamster stage driven by a real wheel.</p>
        </div>
        <a className="header-link" href="#obs">
          Set up OBS
        </a>
      </header>

      <main>
        <div className="desk-grid">
          <div className="desk-show">
            <div className="desk-stage">
              <StageCanvas live={live} className="desk-canvas" />
              <StageNotice live={live} />
            </div>
            <Stats live={live} />
          </div>
          <GhostRace live={live} />
        </div>
        <ObsSetup />
      </main>

      <footer className="desk-footer">
        <p>
          Community stream companion · Uses public{" "}
          <a href="https://api.squeekchain.com/v1/status" rel="noreferrer">
            api.squeekchain.com
          </a>{" "}
          · Not financial advice
        </p>
      </footer>
    </div>
  );
}
