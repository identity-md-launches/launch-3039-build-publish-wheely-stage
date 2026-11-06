import { useMemo, useState } from "react";
import { overlayUrl, type OverlayModules } from "../lib/modules";

const TOGGLES: { key: keyof OverlayModules; label: string }[] = [
  { key: "stage", label: "Show the hamster stage" },
  { key: "hud", label: "Show the HUD" },
  { key: "ticker", label: "Show the ticker" },
];

export function ObsSetup() {
  const [modules, setModules] = useState<OverlayModules>({ hud: true, stage: true, ticker: true });
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const url = useMemo(() => overlayUrl(window.location.href, modules), [modules]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  };

  return (
    <section className="obs" id="obs" aria-labelledby="obs-title">
      <h2 id="obs-title">Add the overlay to OBS</h2>
      <div className="obs-grid">
        <ol className="obs-steps">
          <li>In OBS, add a Browser Source.</li>
          <li>Paste the overlay URL and set the size to 1920×1080 or 1280×720.</li>
          <li>Enable transparency by keeping the default Custom CSS, which sets a transparent background.</li>
        </ol>

        <div className="obs-url">
          <fieldset className="obs-toggles">
            <legend>Modules in the URL</legend>
            {TOGGLES.map(({ key, label }) => (
              <label key={key} className="toggle">
                <input
                  type="checkbox"
                  checked={modules[key]}
                  onChange={(event) => {
                    setModules((m) => ({ ...m, [key]: event.target.checked }));
                    setCopied("idle");
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <p className="obs-url-label">Overlay URL</p>
          <code className="obs-url-value" data-testid="overlay-url">
            {url}
          </code>
          <div className="obs-actions">
            <button type="button" className="secondary" onClick={() => void copy()}>
              Copy URL
            </button>
            <a className="secondary" href={url} target="_blank" rel="noreferrer">
              Open the overlay
            </a>
            <span className="obs-copied" role="status">
              {copied === "done" ? "Copied." : copied === "failed" ? "Unable to copy. Select the URL above and copy it." : ""}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
