# WHEELY Stage design system

Extracted from the final source. Measured contrast and rendered checks are in [VALIDATION.md](VALIDATION.md).

## Overview

WHEELY Stage serves two audiences: streamers who add a transparent overlay to OBS, and viewers who keep a second screen open during a stream. The one visual idea is a small velvet theatre whose lead performer is a hamster, with every movement coming from the real wheel.

The character is dark, warm and playful: oxblood surfaces, butter gold, chunky rounded display type. The stage carries the personality, so the interface around it stays plain, with no decorative gradients, stickers or glows.

Two rules hold on every page:

- **State is honest.** Colour, motion and numbers only claim what the feed supports. A frozen reading loses its status colour, and the stage stops moving.
- **The stage is the hero.** It comes first in reading order, ahead of the numbers and controls.

## Colors

Defined in `src/shared/tokens.css`. Components use the semantic tier only. The format is hex.

### Surfaces

| Token | Value | Use |
| --- | --- | --- |
| `--color-page` | `#1b0b10` (`--oxblood-950`) | Desk page background |
| `--color-surface` | `#2a1118` (`--oxblood-900`) | Race panel, URL field |
| `--color-surface-raised` | `#3c1822` (`--oxblood-800`) | Neutral badges and chips, secondary buttons, notices |
| `--color-surface-hover` | `#5a2431` (`--oxblood-700`) | Secondary button hover |
| `--color-line` | `#5a2431` (`--oxblood-700`) | Dashed lane track |
| `--color-plate` | `rgb(27 11 16 / 0.88)` | Overlay HUD and ticker plates, legible over any footage |

### Text

| Token | Value | Use |
| --- | --- | --- |
| `--color-text` | `#fbefdc` (`--cream-100`) | Primary text and values |
| `--color-text-muted` | `#d9c4b0` (`--cream-300`) | Labels, helper text, frozen values |
| `--color-on-action` | `#1b0b10` (`--oxblood-950`) | Text on any filled colour |

### Roles

| Token | Value | Use |
| --- | --- | --- |
| `--color-action` | `#f5c453` (`--butter-400`) | Primary button, brand name, caption fill, ticker brand, finish line |
| `--color-action-hover` | `#ffd97d` (`--butter-300`) | Primary button hover |
| `--color-focus` | `#ffd97d` (`--butter-300`) | Focus ring |
| `--color-active` | `#7ce8bd` (`--mint-300`) | ACTIVE badge, RPM value while active |
| `--color-stale` | `#ffb86b` (`--amber-300`) | STALE chip, stumbling Run button |
| `--color-offline` | `#ff9c9c` (`--rose-300`) | OFFLINE chip |

Status is always carried by a word as well as a colour.

### Art palette

The `COLOR` object in `src/stage/renderStage.ts`, and the literal fills in `MiniHamster` (`src/desk/GhostRace.tsx`), are illustration colours. They are not interface tokens, so keep them out of components.

## Typography

| Role | Family | Weight | Source |
| --- | --- | --- | --- |
| Brand, section headings, primary button, ticker brand | Bagel Fat One (`--font-display`) | 400, the only weight it has | `src/shared/tokens.css`, latin woff2 from `@fontsource/bagel-fat-one` |
| Everything else | Nunito Variable (`--font-body`) | 400 (`--weight-body`), 800 (`--weight-strong`) | `src/shared/tokens.css`, latin woff2 from `@fontsource-variable/nunito` |

Only the latin subset of each font is bundled.

### Desk sizes (`src/desk/desk.css`)

| Size | Line height | Use |
| --- | --- | --- |
| 14px | 1.3 to 1.5 | Labels, helper text, notices, badges, footer |
| 16px | 1.5 | Body, OBS steps, URL, race clock |
| 20px | 1.2 | Primary button |
| 28px | 1.1 to 1.15 | Brand, section headings; secondary stat values below 60rem |
| 40px | 1.15 | Lead stat values below 60rem; secondary stat values from 60rem |
| 56px | 1.15 | Lead stat values from 60rem |

### Overlay sizes (`src/overlay/overlay.css`)

Sizes are multiples of `--u`, so they scale with the canvas.

| Size | Use |
| --- | --- |
| `15u` | Labels, badge, chip, age |
| `18u` | Ticker line |
| `20u` | Caption, ticker brand |
| `30u` | Stat values |

### Rules

- Changing numbers use `font-variant-numeric: tabular-nums`. Nunito's digits were measured at equal width.
- Long values wrap with `overflow-wrap: anywhere` and are never clipped.
- Headings use `text-wrap: balance`, and descriptions use `text-wrap: pretty`.
- Tracking on display type is `-0.01em`. Body text has none.
- Sentence case everywhere, except the status words ACTIVE, IDLE, STALE and OFFLINE and the brand name.

## Layout

### Desk

- `.desk` has a `max-width` of 1360px, with inline padding of 16px (safe-area aware) below 60rem and 32px from 60rem.
- Below 60rem, one column in reading order: stage, stats, Ghost Race, OBS setup, footer. At 390×844 the Start race button is on the first screen.
- From 60rem, `.desk-grid` splits into `1.25fr / 1fr`. The race panel stretches to the height of the show column, with its lanes taking the spare height.
- From 80rem, the four stats sit in one row. Below that they form a 2×2 grid.
- The stage canvas keeps `aspect-ratio: 16 / 9.5` and fills the column width.
- Notices float over the stage floor (`.stage-notice`), so they never move the Run button during a heat.

### Overlay

- `--u: min(100vw / 1280, 100vh / 720)` is one unit of a 1280×720 canvas, so 1080p renders the same layout at 1.5×.
- `.overlay` is fixed to the viewport and anchored bottom-left with `28u` padding, leaving the rest of the frame clear for the broadcast.
- The stage is `340u` square, followed by a `540u` side column holding caption, HUD and ticker.
- The ticker reserves room for two lines, so a longer line never pushes the HUD up.
- At an aspect ratio of 1:1 or narrower, the modules stack and `--u` becomes `100vw / 620`. This is for phone previews. OBS canvases do not reach it.

### Stage canvas

- Logical height is always 400, and logical width is `400 × aspect`, so one renderer serves both the square overlay and the wide desk stage.
- Curtains anchor to the edges and the wheel stays centred.
- The backing store follows the element size and caps device pixel ratio at 2.

## Elevation & Depth

The interface is flat, with no shadows. Depth comes from tonal steps: page, surface, raised. The overlay uses translucent plates because it sits over unknown footage. Depth inside the stage is painted into the art.

## Shapes

| Radius | Use |
| --- | --- |
| 999px | Status badges and chips |
| 20px | Race panel |
| 14px | Primary button |
| 12px | Secondary buttons, notices, URL field |
| `16u` | Overlay plates and caption |

The stage's arch with a gold frame is the signature shape. Keep it for the stage alone.

## Components

No component library is exported. These are patterns to reuse from source.

| Component | Source | Notes |
| --- | --- | --- |
| `StageCanvas` | `src/stage/StageCanvas.tsx` | Takes `LiveState`. Modes: `closed` (no reading yet), `frozen` (stale or offline), `idle`, `active`. Exposes `role="img"`, a description of the current state, and `data-*` readouts used by tests. |
| Motion rules | `src/stage/scene.ts` | Maps telemetry to speed lines, sparks and spin. Change motion scaling here, not in the renderer. |
| `CoreBadge`, `FreshnessChip`, `freshnessLine` | `src/shared/LiveBits.tsx` | Status words. The chip renders only when numbers cannot be trusted as current. |
| Primary button, `.action` | `src/desk/desk.css` | One per view. 56px minimum height. Hover changes colour, press scales to 0.96 when motion is allowed, `aria-disabled` dims it. `.action-stumble` marks the stumble state. |
| Secondary button, `.secondary` | `src/desk/desk.css` | For `button` and `a`. 44px minimum height. |
| `Lane` | `src/desk/GhostRace.tsx` | Label row plus a track. Position is the `--p` custom property, from 0 to 1. |
| `.notice` | `src/desk/desk.css` | `.notice-problem` is neutral and states what failed and what happens next. `.notice-caption` is the gold celebration line. Rendered in a stable `role="status"` region. |
| Overlay plates, `.plate` | `src/overlay/overlay.css` | Wrap any new overlay module in this so it stays legible over footage. |
| Live state | `src/lib/live.ts`, `src/lib/useLive.ts` | `useLive()` is the one source of live data for both pages. |

Keyboard and focus:

- All controls are native elements, with a 3px `--color-focus` ring on `:focus-visible`.
- During a heat, Space counts as a stride anywhere on the page, Enter works on the focused button, and a held key does not repeat.

Motion:

- Transitions name their properties (`scale, background-color`) and run for 120ms.
- Under `prefers-reduced-motion: reduce` the stage draws still frames, the CSS animations do not run, and press scaling and smooth scrolling are off.

## Do's and Don'ts

- **Do** route new live numbers through `src/lib/status.ts` so they stay `bigint`, and show `--` when a value is missing.
- **Do** drive any new motion from telemetry in `scene.ts`, and return zero for `frozen` and `closed`.
- **Do** place controls and notices so that nothing moves the Run button during a heat.
- **Do** reserve `--color-action` for the primary action and brand moments, not for static data.
- **Don't** interpolate or smooth a number you display. Only the wheel's drawn spin eases toward its target.
- **Don't** paint a background on the overlay page. Only plates and the stage may paint.
- **Don't** use a scrolling marquee. The ticker swaps one line at a time and stops when the feed is stale.
- **Don't** add a third font weight, a seventh type size, or an all-caps label above a heading.

### Adding another page

1. Add an HTML entry and list it under `rollupOptions.input` in `vite.config.ts`, so it exports as a real static route.
2. Import `src/shared/tokens.css`, and use `useLive()` for data.
3. Start from the `.desk` wrapper and `.desk-grid`. Put the stage first if the page has one.
4. Reuse `.action`, `.secondary`, `.notice`, `CoreBadge` and `FreshnessChip`.
