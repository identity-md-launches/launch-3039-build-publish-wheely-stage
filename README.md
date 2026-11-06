# WHEELY Stage

A stream companion for Squeekchain Genesis Code. A cartoon hamster performs on a velvet-curtained stage, and everything it does comes from the real wheel's telemetry.

- **`/overlay/`** is a transparent OBS Browser Source: the stage, a HUD and a ticker.
- **`/`** is the viewer's second screen: the same live fields in large type, plus the Ghost Race mini-game.

There is no wallet, no keys, no contracts and no backend. It is a static site that polls the public `https://api.squeekchain.com/v1/status`.

## Add the overlay to OBS

1. In OBS, add a **Browser Source**.
2. Paste the overlay URL: `<your site address>/overlay/?hud=1&stage=1&ticker=1`. The Set up OBS panel on the desk page builds and copies this URL for you.
3. Set the size to **1920×1080** or **1280×720**. The layout scales to fit either.
4. Enable transparency by keeping the default Custom CSS, which sets a transparent background. The page paints no background of its own.

### Module toggles

Every module is on by default. Turn one off with `0`, `false`, `off` or `no`.

| Query | Module |
| --- | --- |
| `stage=0` | Hamster stage, celebrate flash and caption |
| `hud=0` | ACTIVE/IDLE badge, RPM, distance, settled round, block height. The STALE/OFFLINE chip moves onto the stage. |
| `ticker=0` | One-line ticker built from live fields |

## What drives what

| Field in `/v1/status` | Effect |
| --- | --- |
| `measurement.coreStatus` | `ACTIVE` wakes the hamster. Anything else shows `IDLE`: sleepy pose, dim sparks, slow breathing. |
| `measurement.rpmMilli` | RPM readout (`rpmMilli / 1000`). Speed-line density and spark rate scale with it, reaching full intensity at 120 RPM. |
| `measurement.speedMmPerSecond` | Wheel spin when above 0, as if the drawing were a wheel of 880 mm circumference, capped at 3 turns a second so the spokes do not strobe. |
| `measurement.distanceMm` | Distance in km, and the live lane in the Ghost Race. |
| `measurement.freshness`, `observedAt`, `staleAfterSeconds` | `STALE` or `OFFLINE` chip. Numbers freeze and all stage motion stops. |
| `builder.anchor.settledThroughRound` | Settled round. An increase fires a short flash, confetti and one caption from `src/lib/captions.ts`. |
| `builder.anchor.blockHeight` | Block height. |

Rules the code keeps:

- **Polling:** every 1.75 s on a self-rescheduling timer, so requests never overlap. Each request has a 5 s timeout, and `Retry-After` is honoured on error responses.
- **Bigint-safe:** counters stay `bigint` from parsing through formatting. Drawing uses a clamped number, and the text never does.
- **Never invented:** a failed request, a non-2xx answer or a malformed body shows Offline. With no reading yet, the fields show `--` and the curtains stay closed.
- **Partial answers:** the API sometimes leaves out `builder.anchor`. The feed stays live and the last settled round is kept.
- **Age:** measured against the server's `generatedAt`, so a wrong clock on the viewer's PC cannot fake or hide staleness. Repeated or older cached responses still age out the retained reading without rolling its numbers back.

### Ghost Race

Your ghost races the live wheel over 30 m, with a 60-second limit.

- Choose **Start race**, then tap **Run** or press **Space**. About three taps a second holds top speed (1.4 m/s). Tapping faster than about nine a second makes the ghost stumble. Space keeps its normal behavior when another control, such as an OBS checkbox, has focus.
- Leaving the tab does not pause the heat. An expired heat ends on the first resumed frame; wheel updates received after the deadline do not count toward it.
- The wheel lane moves only when the API reports new distance, and nothing is interpolated. In samples taken while the wheel was idle, readings changed about once a minute, so the lane moves in steps.
- Before a heat, the lane shows distance since the last settled round: unsettled work units (`cumulativeWorkUnits - anchor.cumulativeWork`) times the wheel's own distance per unit (`distanceMm / cumulativeWorkUnits`).
- Score: 10 points per metre, plus 10 per second left on the clock if your ghost reached the line first.
- The best score is kept only in this browser's `localStorage`. A heat run while the signal is down is labelled practice and is not saved.

## Install, preview and rebuild

Requires Node 20.11 or newer.

```bash
npm ci            # install from the lockfile
npm run dev       # development server
npm run build     # typecheck, then write the static export to dist/
npm run preview   # serve dist/ locally, then open / and /overlay/
```

`dist/` is committed and is what gets hosted. All asset URLs are relative (`base: "./"`), and `/overlay/` is a real exported route, so the site works at a domain root, an IPFS gateway subpath or an ENS name without server rewrites. Rebuild and commit `dist/` after any source change.

## Tests

```bash
npm run typecheck
npm test                    # unit tests for parsing, freshness, celebration, race and stage scaling
npx playwright install chromium   # first time only
npm run test:e2e            # browser tests of dist/ at a subpath, with a mocked API
API_LIVE=1 npm run test:e2e # also reads the real API once
```

## Validation results

Revision checked on 2026-11-06. All four reported defects were reproduced with component/state tests and fixed. Full evidence, current browser limitations and the earlier build's historical review: [VALIDATION.md](VALIDATION.md).

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; rebuilt `dist/` included |
| `npm test` | 47 of 47 passed |
| Scratch React/jsdom component checks | 14 of 14 passed; four original reproductions failed before the fixes |
| `node --check tests/e2e/run.mjs` | Passed; six browser regressions added |
| E2E suite and `taste.mjs` design probe | Attempted, unable to launch Chromium; no current rendered pass claimed |

Build and unit commands ran in an identical scratch copy installed with the unchanged lockfile, to keep dependency directories out of the deliverable. The scratch-only DOM harness did not add a production or project dependency.

Known limitations:

- **Current browser verification is incomplete.** The browser tool failed with a socket-path-length error; command-line Chromium exited during startup with `SIGTRAP`. The production E2E suite and design probe could not measure the revised export. Actual scrolling, native checkbox activation, canvas pixels and the revised first screen therefore remain unverified in this revision. The previous build's rendered results are retained as historical evidence only.
- **No live API sample was taken in this revision.** Earlier live samples were IDLE; ACTIVE, celebrations and moving wheel distance were checked with fixtures in the previous round.
- **WebKit and Safari remain unverified.** The earlier round lacked WebKit's system libraries; this revision did not retry WebKit.
- **OBS itself was not run.** The earlier round checked transparency in headless Chromium, which is a similar engine but is not OBS.

## Project layout

```
index.html, overlay/index.html   the two exported routes
src/lib/      API parsing, freshness rules, poller, captions, ticker, race rules
src/stage/    canvas renderer, animation engine, telemetry-to-motion rules
src/overlay/  OBS page
src/desk/     second screen, Ghost Race, OBS setup panel
src/shared/   design tokens and status components
tests/        unit tests; tests/e2e/ holds the browser suite
DESIGN.md     the implemented design system
```

## Credits

All hamster, wheel and theatre art is original and drawn in code. Fonts are self-hosted from Fontsource: Bagel Fat One and Nunito, both under the SIL Open Font License.

Community stream companion · Uses public api.squeekchain.com · Not financial advice
