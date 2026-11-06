# Validation record

The worker's own report for the final source, run on 2026-11-06. It is not an independent certification.

**Completion: Complete for the stated scope, with the limitations listed below.**

## Scope and assumptions

- **Reviewed:** the production export in `dist/`, served at the subpath `/ipfs/wheely-test/` to expose broken relative URLs. Pages: `/overlay/` and `/` (the brief allows `/desk` or `/`; this build uses `/`).
- **Hosting and repository:** the brief asks for a public GitHub repo and a hosted site. The assignment's instructions state that hosting and publication happen after this job, from the committed export, so neither was done here.
- **Inferred choices:**
  - Full intensity at 120 RPM.
  - A drawn wheel of 880 mm circumference for spin.
  - A 30 m lap and 60 s heat for the race.
  - The ticker swaps lines rather than scrolling, which is easier to read on stream and has no motion when frozen.

## Brief requirements

| Requirement | Status | Evidence |
| --- | --- | --- |
| Transparent page at 1280×720 and 1920×1080 | Met | E2E: computed backgrounds, alpha 0 in an empty region, all modules inside both frames |
| `?hud=1&stage=1&ticker=1`, default all on | Met | E2E: six query combinations |
| Original hamster and wheel art | Met | Drawn in `src/stage/renderStage.ts`, no image assets |
| IDLE: sleepy pose, dim sparks, slow breathing | Met | E2E: frames change; screenshots viewed |
| ACTIVE: lines and sparks scale with `rpmMilli`, spin tracks speed above 0 | Met, mocked | E2E at 30, 100 and 40 RPM, including speed 0 |
| Round increase: flash and one rotating caption | Met, mocked | E2E: fires once, no fire on load, caption rotates |
| HUD fields, including BigInt-safe values | Met | E2E and unit tests, values above 2^53 exact |
| STALE or OFFLINE chip, frozen numbers, no fake motion | Met | E2E: identical canvas pixels across time while stale and offline |
| No wallet, keys, contracts or token claims | Met | E2E text check; no such code or dependency |
| Desk: same fields, larger type, branding | Met | Screenshots at 320, 390, 768, 1024 and 1440 |
| Ghost Race, client-only, local score | Met | E2E: full heat by click and keyboard, best score survives a reload |
| OBS blurb and footer copy | Met | E2E |
| Poll every 1.5 to 2 s | Met | E2E: measured interval within 1400 to 2100 ms; `POLL_INTERVAL_MS` is 1750 |
| Network or CORS failure shows Offline, nothing invented | Met | E2E: aborted requests, HTTP 500, malformed body. CORS itself was not separately simulated; a CORS failure surfaces as the same rejected `fetch`. The real API sends `access-control-allow-origin: *`. |
| No console errors on the happy path | Met | E2E on the real API |
| Public GitHub repo and hosted HTTPS site | After review | Handled after this job, per the assignment |

## Better Interface coverage

Guide: `.imd/reads/skills/better-interface/REFERENCE.md`. Core principles of all six domains were read and applied during the build.

| Domain | Status | Evidence | Not performed |
| --- | --- | --- | --- |
| Accessibility | Checked | Native controls, keyboard walk (Tab, Enter, Space) in E2E, focus ring viewed, labels, `role="status"` regions, canvas `role="img"` with state text, reduced-motion E2E, forced-colors emulation viewed | No screen-reader session. No physical device. Native 200% zoom not run; a 640px viewport showed no overflow, which is only an approximation. |
| Layout | Checked | Widths 320, 390, 640, 768, 1024, 1280, 1440, 1920; logical properties; no overflow | RTL mirror (English-only product, not applicable). Pseudo-localization not run. |
| Writing | Checked | Source review: verb-first buttons, errors state the failure and the next step | None |
| Typography | Checked | Probe: 2 families, 2 weights, at most 6 sizes. Digit widths measured equal (all 24px at 40px). Fonts confirmed loaded. | None |
| Colors | Checked | Ratios below, computed from token values and the plate's alpha | Pairs over the canvas art are not measured; all interface text there sits on its own solid fill. |
| UI | Checked | Named transition properties, press scale, status has words as well as colour, stage motion stops when frozen | None |

Theme switching and dialogs: not applicable, the product has neither.

### Measured contrast

| Pair | Ratio |
| --- | --- |
| Text on page | 16.77 |
| Muted on page | 11.32 |
| Text on surface | 15.51 |
| Muted on surface | 10.47 |
| Text on raised | 13.73 |
| Muted on raised (frozen badge) | 9.27 |
| Brand gold on page | 11.71 |
| Label on action | 11.71 |
| Label on action hover | 14.04 |
| ACTIVE badge | 12.83 |
| STALE chip | 11.18 |
| OFFLINE chip | 9.52 |
| Active RPM on page | 12.83 |
| Focus ring on page | 14.04 |
| Focus ring on surface | 12.98 |
| Overlay text on plate over white footage | 12.34 |
| Overlay muted on plate over white footage | 8.33 |
| Overlay active RPM on plate over white footage | 9.43 |
| Overlay gold on plate over white footage | 8.61 |
| Overlay text on plate over black footage | 16.98 |
| Overlay caption | 11.71 |

## Findings and fixes

All were found during this build, fixed, and rechecked.

| Severity | Location | Finding | Fix | Recheck |
| --- | --- | --- | --- | --- |
| High | `src/lib/race.ts:8` | Linear drag meant steady tapping covered about 13 m in 60 s, so the race could not be finished | Exponential drag, tuned so about 3 taps a second holds top speed; on-screen guidance corrected to match | Unit tests; E2E finishes a heat |
| High | `src/desk/Desk.tsx:21`, `src/desk/desk.css:103` | A caption or offline notice would push the Run button under the viewer's finger mid-heat | Notices float over the stage floor | New E2E confirms the button does not move |
| Medium | `src/desk/Desk.tsx:46`, `src/desk/desk.css:200`, `src/desk/desk.css:214` | Probe: status pill read as a kicker label above the RPM value | Badge sits beside the number; value boxes fit their content | Probe `eyebrows` passes |
| Medium | `src/desk/desk.css:88` | Offline probe: OFFLINE chip read as a kicker above "Ghost race" at 390 | Column gap raised to 28px | Offline probe passes |
| Medium | `src/desk/desk.css:173`, `src/overlay/overlay.css:122` | A bright ACTIVE badge beside frozen numbers overclaimed | Badge drops its status colour while stale or offline | Viewed in screenshot |
| Medium | `src/desk/desk.css:221`, `src/overlay/overlay.css:160` | Gold stat values used the action colour on static data | Values use text colour, RPM turns mint while active | Viewed in screenshot |
| Medium | `src/overlay/overlay.css:272` | A two-line ticker pushed the HUD up | Ticker reserves two lines; lines shortened | Viewed in screenshot |
| Low | `src/desk/desk.css:375` | OBS steps stretched to the height of the neighbouring column | `align-content: start` | Viewed in screenshot |
| Low | `src/desk/ObsSetup.tsx:52` | `aria-labelledby` on `<code>`, which does not support naming | Removed; the visible label sits directly above | Source |
| Low | `src/shared/tokens.css:37` | Secondary hover borrowed the line token | Added `--color-surface-hover` | Source |
| Low | `src/desk/Desk.tsx:15` | Playful wording in an error state | Replaced with plain wording | Source |
| Low | `src/shared/tokens.css:8` | An unneeded woff fallback was bundled | Own `@font-face`, woff2 only | Build output |
| Low | `src/stage/renderStage.ts:284`, `src/stage/renderStage.ts:323` | Hamster overlapped the hub; nightcap read as a strap | Hamster scaled down; nightcap redrawn | Viewed in screenshot |

## Verification

| Command | Result |
| --- | --- |
| `npm run build` (`tsc --noEmit`, then `vite build`) | Passed |
| `npm test` (Vitest) | 42 of 42 passed |
| `API_LIVE=1 npm run test:e2e` (Chromium) | 29 of 29 passed, including one read of the real API |
| `BROWSER=webkit npm run test:e2e` | Did not run: the browser could not launch because of missing system libraries |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | 16 of 16 passed |
| The same with `--offline` | 16 of 16 passed |
| `npm audit --omit=dev` | 0 vulnerabilities |

Probe detail: 4 type sizes in use at 390 and 5 at 1440; first-screen prose of 41 words at both 390 and 1440; no horizontal scroll at 320, 390 or 1440. It also reports 4 controls under the comfortable 44px size, all still above the 24px bar. The first screen was confirmed on the 390 screenshot: stage, live numbers and the Start race button are all visible.

The rendered checks used Playwright with Chromium in bounded foreground scripts that started their own preview. The IMD browser preview file (`test/scratch/browser/preview.json`) was not present, so the browser tool was not used. Screenshots were viewed for:

- Overlay: idle, active, sprint at 1080p, stale, offline with the HUD off, celebrating, phone width.
- Desk: 320, 390, 768, 1024, 1440, offline, frozen with keyboard focus, mid-race, race result, forced colors.

Screenshots were working files in `test/scratch/` and are not delivered.

## Limitations

- **ACTIVE on the real wheel was not observed.** All 49 samples in a two-minute run, and later single reads, were IDLE and online. ACTIVE, round celebrations and the moving wheel lane were tested with a mocked API using the live response's field names. The update rate while the wheel runs is unknown; while idle, readings changed about once a minute, and the settled round did advance in the real feed (367 to 370) during this work.
- **One early live response had no `builder.anchor`.** Its body was not kept. The parser and tests treat this as a partial answer.
- **WebKit and Safari are unverified.** The probe and E2E ran only in Chromium.
- **OBS itself was not run.** Transparency was checked by a no-background screenshot in headless Chromium.
- **Not performed:** screen-reader session, physical device, native browser zoom.
- **Reporting cadence can make the race one-sided.** If the wheel reports distance only rarely while running, the live lane may barely move during a 20 to 30 second heat. The lane deliberately shows only reported distance.
