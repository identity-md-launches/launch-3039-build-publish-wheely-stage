# Validation record

The worker's own report, not an independent certification. The revision evidence below supersedes the earlier report where behavior changed.

## Revision, 2026-11-06

**Completion: fixes implemented and static export rebuilt; current rendered verification is incomplete because browsers cannot launch on this machine.** No styling, fonts, assets, dependencies or routes were redesigned.

### Reproduction and corrections

The four reports were reproduced before any source edit with the real React components and live-state reducer in a scratch jsdom harness. These establish the state and event-handler failures; jsdom does not render layout, scroll the page, activate checkboxes from native Space defaults, or paint canvas pixels.

| Finding | Before the fix | Source correction | Recheck |
| --- | --- | --- | --- |
| High: older cached responses keep ACTIVE telemetry live | After replies at +1.75, +3.5 and +5.25 seconds with an older `generatedAt`, retained state stayed `live`, age `0`, RPM `72000` | `src/lib/live.ts:56`: recalculate age using the retained reading and clock; expire live state without accepting old payload values or reviving offline state | At +5.25 s: `stale`, age `5.25`, original RPM and anchor retained. Unit tests cover exact threshold, clock skew, offline preservation, fresh recovery and frozen stage input with zero spin/lines/sparks |
| Medium: ready instructions promise unavailable Run/Space behavior | The ready hint said “Tap Run or press Space” while the rendered button said “Start race” | `src/desk/GhostRace.tsx:206`: explicitly choose Start race first, then use Run/Space; keep the 30 m goal and rhythm guidance | Component check confirms control names and sequence. Actual page scrolling was not measured |
| Medium: race intercepts Space on OBS controls | Both keydown and keyup events from the focused OBS checkbox had `defaultPrevented=true` | `src/desk/GhostRace.tsx:159`: ignore events from form controls, editable content, links and other buttons in both listeners; identify the race action by ref | Both events remain uncancelled. Checks cover descendants, inputs, textarea, select, links, buttons, editable content; document/race-action shortcuts and held-key suppression still work |
| Medium: suspension extends the 60-second heat | First frame after a +65 s performance-clock jump left phase `running` and `59.9 s left` | `src/desk/GhostRace.tsx:117`, `src/lib/race.ts:53`: absolute heat deadline, full elapsed time, cap only motion integration, timeout takes precedence on expiry. `src/desk/GhostRace.tsx:106` rejects wheel readings received after the deadline | First resumed frame: `done`, `0.0 s left`, time result. A +20 s gap leaves 40 s and bounded ghost movement. A post-deadline wheel increment is excluded |

All four required answers are in `.imd-responses.json`. Permanent regressions are in `tests/live.test.ts`, `tests/race.test.ts` and `tests/e2e/run.mjs`. The latter adds six browser cases: cached replies on both routes, ready keyboard guidance, OBS keyboard controls, suspended expiry/restart and partial frame gaps.

### Commands and results

To respect the repository's dependency-directory restriction, `package.json`, `package-lock.json`, source, tests and build configuration were copied to `test/scratch/worktree/`. All dependency/cache/browser downloads stayed in scratch. The final build used a fresh `npm ci` from the unchanged lockfile; its export was copied back to `dist/`, removing obsolete generated chunks. Scratch files are excluded from submission.

| Actual command / check | Result |
| --- | --- |
| `npm ci --prefix test/scratch/worktree --cache test/scratch/npm-cache --no-audit --no-fund` | Passed |
| `npm exec -- vitest run tests/revision.dom.test.ts` in the scratch copy, before edits | Four tests failed with the values recorded above |
| Scratch Vitest suite after edits, including the expanded DOM harness | 61/61 passed: 47 deliverable unit tests and 14 component checks |
| `npm run typecheck` in the final scratch copy | Passed |
| `npm run build` in the final scratch copy | Passed; 37 modules transformed |
| `npm test` after reinstalling the unchanged lockfile and removing the scratch DOM test | 47/47 passed |
| `node --check tests/e2e/run.mjs` | Passed |
| Static export integrity check | Both HTML entries have title/favicon/description/OG metadata; all 16 relative local asset references resolve. No export symlinks, sourcemaps or dependency archives |
| Same-process HTTP smoke check using `serveDist()` and Node fetch | Could not complete: loopback request failed with `UND_ERR_SOCKET` / “other side closed”. Filesystem asset checks above passed; HTTP serving was not certified |
| `node test/scratch/worktree/tests/e2e/run.mjs` from the repository root, against `dist/` | Exited 1 at browser launch, before any browser assertion |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` with explicit scratch Playwright/browser paths | Exited 2: `render=false`, Chromium exited during startup. No layout/contrast/screenshots were measured |

The browser tool itself also failed to initialize: Chromium reported “Socket path too long”. Command-line Chromium reported “Target page, context or browser has been closed” and `SIGTRAP`. A compatible scratch browser download also could not launch. These are runtime limitations, not requester-input requirements. The scratch probe output is `test/scratch/taste/taste.json`; there are no new screenshots to claim.

Packaging check: `dist/` is 593,660 bytes; the complete source/export/documentation deliverable is under 1.1 MiB, and changed/new deliverable files are under 512 KiB, within the 8 MiB budget. Obsolete hashed chunks and writable launch caches were removed. No dependency directory or downloaded archive is in the deliverable. `package.json`, `package-lock.json` and `.gitignore` match their original hashes; no ignore-file edit was needed.

### Better Interface review coverage

The pinned workflow, six domains' core principles and documentation method were read. This is a scoped revision review of the affected shared live state and race controls, preserving the established theatre design.

| Domain | Revision coverage | Limitations |
| --- | --- | --- |
| Accessibility | Checked source and DOM events: native controls and labels retained; both key listeners respect focused controls; document/race shortcuts retained; original focus and reduced-motion rules unchanged | Native keyboard defaults, visible focus, screen readers and physical devices not verified here |
| Layout | Checked source: hint remains after the 56px primary action; no CSS, DOM order or breakpoints changed | 320/390/1440 rendering, first-screen action position, clipping and zoom not remeasured |
| Writing | Checked: Start race → Run/Space guidance matches actual controls; goal and stumble instruction retained; stale age and timeout text reflect state | No new wording finding remains |
| Typography | Checked source: existing type scale, tabular numbers, font files and wrapping rules unchanged | Revised hint wrapping not rendered |
| Colors | Checked source: existing tokens and status words retained; stale values use the existing frozen-state styling | No new contrast ratios measured; earlier ratios below are historical |
| UI | Checked state behavior: old responses expire, motion inputs freeze, timing survives large frame gaps, post-deadline data excluded; normal race unit tests still pass | Canvas pixel freeze, animations and OBS itself not rendered in this revision |

`DESIGN.md` updates only the implemented keyboard, freshness and heat-timing behavior. Public hosting/repository publication was not changed or verified in this revision; no public URL is claimed. The local `dist/` export remains the deliverable for publication.

## Earlier accepted build report (historical)

The following records the previous round's checks. Its browser pass counts, screenshots, measured contrast and live API samples were not repeated successfully during this revision and do not certify the revised export.

**Earlier completion statement: Complete for the stated scope, with the limitations listed below.**

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
