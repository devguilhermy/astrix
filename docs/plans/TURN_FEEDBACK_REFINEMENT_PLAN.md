# ASTRIX11: turn feedback, mission report and density refinement plan

**Status:** approved by the owner and executing since 2026-11-15. Step 0 (§6) is done; the four work packages (§7) are delegated.

**Scope:** nine owner requests on top of the implemented [turn-based revision](./TURN_BASED_EXPLORATION_REVISION.md):

| # | Request | Section |
|---|---|---|
| R1 | Transmitting shows waves travelling to the planet | §5.1 |
| R2 | Observing shows the picture that was taken | §5.2 |
| R3 | End of mission shows the turns made, the results and the score | §5.3 |
| R4 | Much less scrolling on a normal 1080p screen | §5.4 |
| R5 | Custom favicon | §5.5 |
| R6 | The satellite must not touch or enter the body | §5.6 |
| R7 | Solar-system orbit lines more visible | §5.7 |
| R8 | Clicking a planet in Explore opens a NASA information panel | §5.8 |
| R9 | Aspiring / Expert chosen with toggle buttons, not a dropdown | §5.9 |

Work is split into one preparation step by the main agent (§6), four mechanical execution subagents with exclusive file ownership (§7), and one integration and verification pass by the main agent (§8). The open closure items of the turn-based revision §12 (unexplained `removeChild` exception, save/resume walkthrough) are not replaced by this plan; they are re-run on the artifact this plan produces (§8.3).

Core rules, saved-game schema, protocol and scoring are **not changed**. Everything here is presentation derived from committed engine state.

---

## 1. Evidence

Measured in the running application (`bun --bun vite`, Chromium, viewport 1920×1080 and 1920×940; a 1080p monitor leaves about 940 px of page height) and by reading the code.

### 1.1 Turn feedback is hidden

- After committing **Observe**, the right panel shows only "Select a plan" and a collapsed `Turn receipt` disclosure. The result (+17.5 MB stored, −1.7 Wh) is invisible until the player opens it: `ui/play/TurnWorkspace.tsx:57`.
- The scene draws no event at all. `three/AppCanvas.tsx:121-143` renders planet, trail, marker and hardware only. Nothing marks an observation, a contact or a downlink.
- The engine already supplies what is needed, with no core change:
  - `TurnReceipt.delta` (fuel, energy, stored, delivered) and `TurnReceipt.planId` (`kind.toLowerCase()`, `core/gameplay.ts:68,202`).
  - `history(sim)` samples with `positionKm`, `sunDir`, `stationPosKm`, `inContact`, `doseUGyH`, `socPct`, `downlinkedMB`, `flight.{earthRKm,moonRKm,centralBody}` (`core/contracts.ts:83`).

### 1.2 Debrief has no score and no picture of the flight

- `Debrief` (`TurnWorkspace.tsx:91-100`) is one 660 px text column: outcome, evidence list, discovery text, science library, comparison table, then buttons, then receipts in a disclosure.
- `scoreMission()` exists and is exported (`core/score.ts:22`, `core/index.ts:24`) with five weighted components and 0-5 stars, but the turn game never calls it. English and Portuguese labels `score.objective|efficiency|health|margins|team` already exist (`en.json:1028-1032`).
- Primary actions (Try another design / Retry) sit below about 1.5 screens of text.

### 1.3 Scrolling

| Surface | Scroll container | Visible height | Content height | Screens |
|---|---|---:|---:|---:|
| Mission board, 1920×1080 | `#play-main.document-panel` (660 px wide) | 926 | 2132 | 2.30 |
| Preparation choices, 1920×1080 | `.panel-scroll.preparation-choices` | 853 | 1253 | 1.47 |
| Preparation brief, 1920×1080 | `.panel-scroll.preparation-brief` | 777 | 822 | 1.06 |
| Turn choices, 1920×1080 | `.panel-scroll` | 595 | 595 | 1.00 |
| Turn preview, 1920×1080 | `.panel-scroll.turn-preview` | 780 | 780 | 1.00 |
| Debrief, 1920×1080 | `.debrief` (660 px wide) | 780 | 1879 | 2.41 |
| Debrief, 1920×940 | `.debrief` | 640 | 1879 | 2.94 |

Causes:

- Fixed chrome before any mission panel: header 76 px + resource grid 88 px + a toolbar row holding only "Hide panels" and "Quick tour" (52 px) + gaps. Panels start at y=234 of 1080 (`play.css:21,24-26,55`).
- Board and debrief use a single 660 px column while about 1,240 px of width stays empty (`play.css:64,247`).
- Preparation stacks kit and approach options vertically (`play.css:134-135`).
- A separate footer row holds only "Saved at this decision boundary" (`play.css:211`).

### 1.4 Spacecraft intersects the planet

- `three/committedScene.ts:68-71` lifts the displayed hardware to a fixed 1.28 planet radii. `AppCanvas.tsx:139` scales the model by `0.25 / max(bus dimension)`, which ignores deployables.
- Bounding radius of the displayed model in planet radii, from `three/spacecraft/slots.ts` and the deployed shapes in `parts/PartMesh.tsx:48-71`:

| Bus | Largest deployable | Hull radius | Lowest hull point at the 1.28 floor |
|---|---|---:|---:|
| CubeSat 3U | `SOLAR_WINGS` | 0.244 | 1.036 |
| SmallSat | `SS_SOLAR_400` (starter) | 0.393 | **0.887** |
| SmallSat | `SS_UHF_RELAY` whip | 0.370 | **0.910** |
| SmallSat | `SS_SOLAR_800` | 0.537 | **0.743** |
| Crew capsule | `CREW_SOLAR` | 0.263 | 1.017 |

- The surface is at 1.000 and the drawn atmosphere shell at 1.016 (Earth) or 1.009 (Mars). Every SmallSat mission (Raise Your Orbit, Leave Orbit Safely, Past Earth, Meet the Moon, Earth-to-Moon, Red Relay) can therefore push wings or antennas through the planet, depending on the committed attitude. That matches "during some turns".
- Nothing stops the user's own camera zoom/orbit from entering the planet either.

### 1.5 Solar map and Explore

- Orbit rings: `three/SolarSystemScene.tsx:78` uses colour `#93abc5` at opacity 0.13 through `SceneLine`, which is a 1-pixel `LineBasicMaterial` (`three/ScenePrimitives.tsx:6-14`). WebGL ignores line width, so the rings cannot be made thicker without a different primitive.
- Clicking a body only focuses the camera and swaps a two-line caption about image provenance (`SolarSystemScene.tsx:83-100`). No facts about the body are shown.
- NASA source verified today: [NSSDCA Planetary Fact Sheet - Metric](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) (last updated 13 November 2026) covers the eight planets and the Moon. The core source registry already cites its Earth, Moon, Mars and Sun sheets (`core/catalog.ts:108`).

### 1.6 Smaller items

- No `<link rel="icon">` in `apps/web/index.html` or `apps/web/404.html`. The supplied logo is `apps/web/public/assets/logo.png` (512×426); the "A" mark with planet and rocket occupies roughly x 70-440, y 0-300.
- Challenge level is a native `<select>` (`ui/play/PlayApp.tsx:130`).

---

## 2. Decisions

Each has a default so execution is not blocked. Change any of them at review.

| ID | Decision | Default | Alternative |
|---|---|---|---|
| D1 | What "the picture that was taken" is | A **simulated frame**: a crop of the bundled NASA map centred on the spacecraft's ground track at that turn, shaded by the real Sun angle there, labelled as simulated. | Show a fixed archival NASA photo per mission. Rejected: it would not change with the player's orbit and would read as a real observation. |
| D2 | Score | Use core `scoreMission()` unchanged, so results stay comparable and versioned. In solo play the "Team review" component is full credit and is labelled as such. | Rebalance the score without the team component. Needs a rules-version change. |
| D3 | Mission report layout | 3D stays visible: left result panel, right detail panel, turn timeline docked along the bottom. | Full-screen report. Rejected: breaks the "3D always visible" rule. |
| D4 | Frames in saves | Not stored. Frames and turn positions are re-derived from the saved engine state on load. | Store images in the save: larger saves, schema change. |
| D5 | Design viewport | 1920×940 is the no-scroll target; 1366×768 is the secondary target. | 1920×1080 only. |
| D6 | Display size of the spacecraft | Normalise by the real hull radius including deployables, so every craft has the same on-screen extent and the same clearance. | Keep bus-based scale and raise the clearance per craft: SmallSat would float far from its true position. |

Honesty rules carried over: simulated results are never presented as NASA observations; positions and sizes in the solar map stay labelled schematic; waves and frames are drawn only from committed receipts, never from a preview.

---

## 3. Shared contracts

All four subagents code against these. Nothing else is shared.

### 3.1 Layout constants (desktop, width ≥ 1280)

| Constant | Old | New | Owner |
|---|---:|---:|---|
| Header height | 76 | 56 | B (`play.css`) |
| Resource grid top / height | 84 / 88 | 64 / 60 | B |
| Overlay top with resources (`--mission-resource-bottom`) | 180 | 132 | B |
| Overlay top without resources | 88 | 64 | B |
| Toolbar row ("Hide panels", "Quick tour") | 52 | 0, both move into the header | B |
| Footer save row | 44 | 0, becomes a header chip | B |
| Left / right panel width | 510 / 480 | unchanged | B |
| Report timeline dock height | n/a | 176 | C |
| Scene camera top inset with resources (`AppCanvas.tsx:56`) | 180 | 132 | A |
| Scene camera top inset without resources | 70 | 64 | A |
| Scene camera bottom inset: play / debrief | 100 / 100 | 100 / 200 | A |
| Scene camera right inset in solar focus with a body selected | 0 | 496 | A |

Rules ≤ 900 px keep their current structure; only the items named in §7 change there.

### 3.2 `turnMoments` (written by the main agent in §6, read-only for subagents)

File: `apps/web/src/ui/play/turnMoments.ts`. Pure, no React, no three.

```ts
import type { BodyId, ScoreBreakdown, TeamStats, TurnGameState, TurnPlanKind, TurnReceipt } from '@astrix/core';
export type Km3 = readonly [number, number, number];
export interface Subpoint { latDeg: number; lonDeg: number; sunElevationDeg: number }
export interface TurnMoment {
  index: number;              // 1-based, equals receipt.revision
  receiptId: string;
  kind: TurnPlanKind;         // receipt.planId.toUpperCase()
  startSec: number; endSec: number;
  interrupted: boolean;
  delta: TurnReceipt['delta'];
  capturedMB: number;         // max(0, delta.storedMB + delta.deliveredMB)
  deliveredMB: number;        // max(0, delta.deliveredMB)
  progress: number;           // mean progress of required evidence after the turn, 0..1
  body: BodyId;               // central body of the end sample
  positionKm: Km3 | null;     // central-body-relative, end of turn
  frame: Subpoint | null;     // ground point at the middle of the turn
  stationKm: Km3 | null;      // ground station, end of turn, same frame as positionKm
  inContact: boolean;
  doseUGyH: readonly { t: number; value: number }[];  // history samples inside the turn
  socPct: number | null;      // end of turn
}
export function subpoint(body: BodyId, rKm: Km3, sunDir: Km3, tSec: number, epochUTC?: string): Subpoint;
export function turnMoments(game: TurnGameState): readonly TurnMoment[];
export const SOLO_TEAM: TeamStats;
export function missionScore(game: TurnGameState): ScoreBreakdown & { rawTotal: number };
```

Longitude convention (matches `three/space/Planet.tsx`: map centre = longitude 0 on core +X at rotation 0, `rotation-y = bodyRotationAngle`):
`lonDeg = wrap180(deg(atan2(r.y, r.x) − bodyRotationAngle(body, t, epoch)))`, `latDeg = deg(asin(r.z / |r|))`, `sunElevationDeg = deg(asin(dot(r̂, sunDir)))`.

### 3.3 Component and prop contracts

```ts
// A  apps/web/src/three/AppCanvas.tsx (added props; existing props unchanged)
moments?: readonly TurnMoment[];
selectedTurn?: number | null;
onSelectTurn?: (index: number) => void;
solarBody: SolarBodyId | 'SYSTEM';
onSolarBody: (id: SolarBodyId | 'SYSTEM') => void;
// A  apps/web/src/three/SolarSystemScene.tsx (new export, text moved out of SolarSystemCaption)
export function solarImageNote(id: SolarBodyId, pt: boolean): string;

// C  apps/web/src/ui/play/feedback/TurnResultCard.tsx
export function TurnResultCard(props: { game: TurnGameState; moment: TurnMoment; compact?: boolean }): JSX.Element;
// C  apps/web/src/ui/play/feedback/ObservationFrame.tsx
export function ObservationFrame(props: { game: TurnGameState; moment: TurnMoment; size?: 'card' | 'thumb' }): JSX.Element | null;
// C  apps/web/src/ui/play/report/MissionReport.tsx
export function MissionReport(props: { game: TurnGameState; journal: readonly AttemptRecord[]; moments: readonly TurnMoment[];
  selectedTurn: number | null; onSelectTurn: (index: number) => void;
  onRetry: () => void; onRedesign: () => void; onTools: () => void; disabled: boolean }): JSX.Element;
// C  copy registration exports
export const feedbackEnglish: Record<string, string>, feedbackPortuguese: Record<string, string>;   // ui/play/feedback/copy.ts, keys prefixed "fb."

// D  packages/data/src/index.ts
export const SOLAR_FACTS: Readonly<Record<SolarFactId, SolarFact>>;   // see §7 WP-D for the shape
// D  apps/web/src/ui/play/solar/SolarBodyPanel.tsx
export function SolarBodyPanel(props: { body: SolarBodyId; onSelect: (id: SolarBodyId | 'SYSTEM') => void;
  onMissions?: (destination: BodyId) => void }): JSX.Element;
export const solarEnglish: Record<string, string>, solarPortuguese: Record<string, string>;         // ui/play/solar/copy.ts, keys prefixed "solar."

// B  apps/web/src/ui/play/TurnWorkspace.tsx (added props, forwarded to MissionReport)
moments: readonly TurnMoment[]; selectedTurn: number | null; onSelectTurn: (index: number) => void;
```

`AttemptRecord` (owner C) gains optional `score?: number; stars?: number; turns?: number`. Missing fields stay valid, so existing saves and the save format version are untouched.

Shared helpers extracted from `TurnWorkspace.tsx` in Step 0 (read-only for every subagent except where §3.4 names an owner):

```ts
// apps/web/src/ui/play/Receipt.tsx     full receipt: boundary, deltas, interruption cause, evidence, events
export function Receipt(props: { receipt: TurnReceipt; definition: TurnGameState['design']['definition']; preview?: boolean }): JSX.Element;
// apps/web/src/ui/play/planIcons.ts
export const planIcons: Record<TurnPlanKind, LucideIcon>;
// apps/web/src/ui/play/Comparison.tsx  (owner C from here on: adds the score row)
export function Comparison(props: { previous: AttemptRecord; current: AttemptRecord }): JSX.Element;
```

`SolarFactId` (owner D, `@astrix/data`) is the same ten-member string union as `SolarBodyId` in `three/SolarSystemScene.tsx`. `SolarBodyPanel` types its props with `SolarFactId`, so it never imports from `three/**`; the two unions are mutually assignable.

### 3.5 Structural and CSS contract

Class-name prefixes are exclusive, so four style sheets never collide:

| Owner | New class prefix | Style sheet |
|---|---|---|
| A | `scene-fb-`, `solar-ring-` | `three/immersive.css` |
| B | anything else in `play.css`, never the prefixes of A, C, D | `ui/play/play.css` |
| C | `fb-`, `report-`, `jr-` | `ui/play/feedback/feedback.css`, `ui/play/report/report.css`, `ui/play/journal.css` |
| D | `dossier-` | `ui/play/solar/solar.css` |

Existing structural classes keep their meaning, and B keeps their rules: `.play-main.contextual-main`, `.contextual-workspace` (grid: left panel, scene gap, right panel; second row for a dock), `.context-panel`, `.panel-scroll`, `.panel-action`, `.context-panel-switch` (hidden on desktop; a tab row with `button[aria-pressed]` at ≤ 900 px), `.play-main[data-panels-open=false]` hiding `.context-panel` and `.context-panel-switch`, and the content classes `.play-page-heading`, `.icon-heading`, `.button`, `.text-button`, `.play-details`, `.play-evidence`, `.turn-receipt`, `.comparison-table`, `.science-*`, `.journal-*`. B removes only the `.debrief` rules.

- **`MissionReport` root (C):** `<section className="mission-report contextual-workspace active-{result|turns|science}">` containing, in order, `.context-panel-switch` (three buttons), `<section className="context-panel report-result">` (grid column 1), `<aside className="context-panel report-detail">` (grid column 3), and `<section className="report-timeline">` (second row, all columns, 176 px). C's style sheet handles which panel shows per `active-*` at ≤ 900 px, the 901-1279 px arrangement, and hides `.report-timeline` when `.play-main[data-panels-open=false]`.
- **`TurnResultCard` root (C):** `<article className="fb-card">`; with `compact`, `<article className="fb-card fb-card-compact">`. B places it and adds only outer spacing.
- **`SolarBodyPanel` root (D):** `<aside className="dossier context-panel">` filling its container (`height:100%`, internal `.panel-scroll`). B owns the container `.solar-dossier-slot`: absolutely positioned in the right panel slot on desktop (width `var(--mission-panel-right)`), a bottom sheet over the lower 55 % at ≤ 900 px.
- Colours, radii and type sizes follow the existing tokens in `play.css` (`--play-line`, panel background `#0c1924f5`, border `#49616e`, orange `#f6a047` / `#ffb767`).

### 3.4 File ownership

| Owner | Files |
|---|---|
| Main (§6, §8) | `ui/play/turnMoments.ts` + test, `ui/play/Receipt.tsx`, `ui/play/planIcons.ts`, `i18n/resources.ts`, `docs/**`, `README.md` |
| A SceneFeedback | `apps/web/src/three/**` (including `immersive.css`) |
| B ShellDensity | `ui/play/PlayApp.tsx`, `TurnWorkspace.tsx`, `Preparation.tsx`, `MissionResources.tsx`, `SolarWelcome.tsx`, `QuickTour.tsx`, `quickTour.css`, `play.css`, `copy.ts`, `presentation.test.tsx`, new `ui/play/LevelToggle.tsx`, `ui/missions/missionIllustration.css` |
| C MissionReport | new `ui/play/feedback/**`, new `ui/play/report/**`, new `ui/play/journal.css`, `ui/play/Journal.tsx`, `ui/play/Comparison.tsx`, `ui/play/persistence.ts`, `ui/play/persistence.test.ts`, `ui/play/Evidence.tsx` |
| D SolarDossier | `packages/data/**`, new `ui/play/solar/**`, `apps/web/public/**`, `apps/web/index.html`, `apps/web/404.html`, `CREDITS.md` |

Rules for every subagent:

- Edit only owned files. A needed change elsewhere is reported in the handoff, not made.
- Import other packages' components exactly by the paths and signatures in §3.3, even though they do not exist yet.
- New user-visible text ships in English and Brazilian Portuguese together. Scene code keeps the existing inline `pt ? … : …` pattern; panels use their own copy module.
- No typecheck, tests, build, lint or formatter mid-flight. The main agent runs them once after all four hand off.
- No stubs, placeholders or TODOs. No git commits.
- Keyboard access, visible focus, 44 px targets, reduced motion and 320 px reflow apply to every new control.
- Each subagent may spawn **at most two nested `sonic` subagents** for long mechanical work, and keeps the reasoning for itself (§7.0).

---

## 4. Target experience

1. **Observe turn.** On commit, a ring settles on the planet under the spacecraft and a thin sight line joins them. The right panel opens on a "Last turn" card with the simulated frame, its coordinates, the lighting, and "+17.5 MB stored".
2. **Transmit turn.** Orange wave fronts travel from the spacecraft to the ground-station dish on the surface for about six seconds, then leave a dashed link line. The card shows "+1.69 MB returned, 13.31 MB still on board" and the objective bar moving.
3. **Any other turn.** The card names what happened with before/after bars for energy, data and fuel, and the cause if the plan was interrupted.
4. **Mission end.** The score counts up beside the stars and its five components. A timeline along the bottom shows one chip per turn; selecting a chip highlights that turn's position on the 3D trail and shows its frame or reading. Retry and redesign are always on screen.
5. **Explore.** Orbits are clearly drawn. Clicking a planet opens a fact panel sourced from NASA; Earth, Moon and Mars offer "Missions here".
6. **Everywhere.** At 1920×940 the board, preparation, turn and report surfaces need no scrolling for their primary content.

---

## 5. Design per request

### 5.1 R1 Transmission waves (WP-A, card in WP-C)

- **Trigger:** the latest `TurnMoment` has `deliveredMB > 0`. Animated only when `game.revision` increased during this session for the same `game.identity`; on load or resume it is drawn static.
- **Source:** the displayed hardware position (`scene.craft`).
- **Target:** `moment.stationKm` converted with the scene's `renderPoint` when `moment.body === scene.body`. Otherwise (Mars relay, no surface station in frame) a point 1.6 units along the antenna boresight, body +Z rotated by `scene.attitude`, labelled "to Earth".
- **Drawing:** four ring meshes (`ringGeometry` inner 0.9, outer 1.0) facing the travel direction. Each travels source → target in 1.6 s, 0.4 s apart, radius growing 0.02 → 0.09, opacity following a sine envelope, colour `#ffb164`. Five cycles, then stop.
- **After the animation, and always under reduced motion:** a dashed link line at opacity 0.5, three static rings at 25 / 50 / 75 % of the path, and the existing `GroundDish` primitive on the surface at the station.
- **Frame loop:** the Canvas stays `frameloop="demand"`. A `useFrame` callback calls `invalidate()` only while pulses are active; an effect kicks the first frame when the revision changes.
- **Text equivalent:** a `role="status"` line in the scene caption, e.g. "Signal: 1.69 MB returned to the ground station".
- **Testable core:** `three/feedback/signalPath.ts` exports `pulseState(elapsedSec, index)` → `{ phase, opacity } | null` and `signalTarget(...)`.

### 5.2 R2 Observation picture (frame in WP-C, footprint in WP-A, Earth map in WP-D)

**Scene (A).** When the latest moment has `capturedMB > 0`: the existing `ObservationTarget` ring is placed on the surface at the true marker's nadir (marker direction × 1.003, radius 0.09, facing outward) with a sight line from the hardware. A 0.6 s scale-in plays once; static under reduced motion.

**Frame (C).** `ObservationFrame` draws to a 2D `<canvas>`; it does not depend on WebGL and so also works when the 3D view has failed.

- Source map per body (`feedback/frameSource.ts`): Earth `earth-blue-marble-2048.jpg` (new, WP-D; falls back to `earth-blue-marble-1024.png` on load error), Moon `moon-lro-2048.jpg`, Mars `mars-viking-1024.jpg`. The packed day/night Earth file is not used: its alpha channel is night-light data and cannot be read through a 2D canvas.
- Window (`feedback/frameWindow.ts`, pure): 16:10; longitude span 36° for a 2048 px map, 60° for 1024 px; latitude span = span × 10/16. Centre = `moment.frame`. Centre latitude is clamped so the window stays inside ±90°. A window crossing ±180° is drawn as two slices.
- Lighting: brightness = `0.18 + 0.82 × smoothstep(−6°, 12°, sunElevationDeg)`, applied as a black overlay. Label: day, twilight or night.
- Overlay: corner brackets and a metadata strip, e.g. `T+34 min · 12.4°S 48.2°W · Earth camera · +17.5 MB`.
- Caption, always visible: "Simulated frame built from the NASA Blue Marble archive at your ground track. Not a new observation." A night frame with data adds: "The model counts instrument data regardless of ground lighting."
- The canvas has `role="img"` and an `aria-label` carrying the same facts.

**Non-imaging missions (C).** If the definition's objective is `INSTRUMENT_HOURS`, the card shows `ReadingChart` instead: an SVG strip chart of `moment.doseUGyH` with minimum, maximum and unit, captioned "Replay of archived ISS RadLab readings along your simulated orbit."

### 5.3 R3 Mission report with score (WP-C, scene markers in WP-A)

Replaces `Debrief`. Same grid as the turn workspace so the scene stays visible (D3).

```
┌ header 56 ───────────────────────────────────────────────────────────────┐
├ resource grid 60 ────────────────────────────────────────────────────────┤
│ ┌ Result 510 ───────┐                          ┌ Detail 480 ───────────┐ │
│ │ Outcome · mission │                          │ [Turn][Science][Compare]│
│ │ Score ring ★★★★☆  │        3D scene          │ selected turn:         │ │
│ │ 5 component bars  │   trail + numbered       │ frame / reading / link │ │
│ │ Objectives        │   turn markers           │ deltas, events         │ │
│ │ [Try another][Retry]                         │                        │ │
│ └───────────────────┘                          └────────────────────────┘ │
│ ┌ Flight timeline 176 ───────────────────────────────────────────────────┐│
│ │ progress + energy lines                                               ││
│ │ [1 Observe][2 Transmit][3 Transmit][4 Transmit] …                     ││
│ └───────────────────────────────────────────────────────────────────────┘│
```

- **Result panel.** Outcome heading, mission name, elapsed time, assisted badge. `ScoreSummary`: total out of 100 in an SVG ring, 0-5 stars, then one row per component with its label (`t(component.key)`), a bar for `value`, and "contribution / maximum" points (`weight × value × 100` of `weight × 100`). Notes: solo team credit (D2); when the outcome is failure or incomplete and `rawTotal > 19`, "Required objectives were not achieved, so the score is capped at 19." Objectives list (`Evidence`). Discovery line. Actions pinned at the panel bottom.
- **Timeline dock.** An ordered list of turn buttons: number, plan icon, plan name, duration, up to two delta badges (energy, data stored, data returned, fuel), and an interruption mark. Above the chips, a 48 px SVG band aligned to them with objective progress after each turn and battery state of charge. Arrow keys move between chips (roving tabindex); Enter or click selects. Horizontal scroll with snap only beyond the width (about 14 chips at 1920 px). Default selection: the last turn that captured or returned data, otherwise the last turn.
- **Detail panel tabs.** *Turn*: `TurnResultCard` for the selected turn plus a disclosure with every receipt. *Science*: `ScienceConnection` and `ScienceLibrary` (secondary content; may scroll). *Compare*: the comparison table with an added score row, or the "no comparable attempt" note.
- **Scene (A).** At mission end the camera mode defaults to Orbit. Each moment with a position in the current central body gets a numbered marker on the trail; the selected one is enlarged and orange, and its observation footprint or signal link is drawn statically. Clicking a marker calls `onSelectTurn`.
- **Motion.** Score counts up over 0.9 s and chips fade in 40 ms apart. Both are instant under reduced motion.
- **Journal.** Each attempt row shows stars and score when recorded. `recordAttempt` stores `score`, `stars`, `turns`.
- **901-1279 px:** result and detail side by side on the left, timeline below. **≤ 900 px:** one sheet with a three-way switch (Result, Turns, Science); the timeline becomes a vertical list.

### 5.4 R4 Density (WP-B; report in WP-C)

Targets, measured the same way as §1.3:

| Surface | 1920×940 | 1366×768 |
|---|---|---|
| Mission board, default three offers | no scroll | ≤ 1.3 screens |
| Mission board, all offers expanded | ≤ 1.0 screen | ≤ 1.8 screens |
| Preparation choices | no scroll | ≤ 1.2 screens |
| Preparation brief | no scroll | ≤ 1.1 screens |
| Turn choices and preview | no scroll | no scroll |
| Mission report: result panel, timeline | no scroll | no scroll |

Changes:

1. **Shell.** Apply §3.1. "Hide panels", "Quick tour" and the save status move into the header's right group; the save chip is a small popover with Export, Import and GMAT tools. `data-tour` anchors keep their names.
2. **Resource grid.** One row per cell: icon, label and value on a single line, meter beneath; 60 px tall.
3. **Board.** Panel width `min(1040px, 62vw)` at ≥ 1280. One toolbar row: destination tabs on the left, level toggle (§5.9) on the right. Title, one-line intro and "Design & Play" share one row. The three primary offers form a three-column card grid (illustration 96 px, title, goal line, decisions estimate, button). "More missions" expands into compact three-column cards without illustration. "Resume saved mission" becomes a strip at the top of the board.
4. **Preparation choices.** Remove the intro paragraph (it stays in the quick tour). Kit and approach become three-column option cards like ambition; descriptions remain fully visible at 0.84 rem. Vertical gaps 1.2 rem → 0.8 rem.
5. **Preparation brief.** Heading and list margins halved; no content removed.
6. **Turn workspace.** The right panel leads with the "Last turn" card (§5.1-5.2). With a plan selected, the preview leads and the card collapses to one summary line that expands on activation. The `Turn receipt` disclosure keeps events and identifiers. The duplicate fuel line under the objective is removed; fuel stays in the card and in details.

### 5.5 R5 Favicon (WP-D)

- Source: the "A" mark cropped from `public/assets/logo.png` (start with `370x300+70+0`; adjust by ≤ 20 px if the rocket tip or the orange arc is clipped), centred with 40 px padding on a 512×512 tile, colour `#dfedfb`, corner radius 96. The pale tile keeps the navy letter visible on dark browser tabs, as in the header.
- Outputs: `public/favicon.ico` (16, 32, 48), `public/assets/favicon-32.png`, `public/assets/favicon-192.png`, `public/assets/favicon-512.png`, `public/assets/apple-touch-icon.png` (180), `public/site.webmanifest` (name ASTRIX11, theme `#061329`, background `#061329`, the 192 and 512 icons).
- `index.html` and `404.html` get `icon`, `apple-touch-icon` and `manifest` links, written like the existing `/assets/logo.png` reference in `index.html` and as `./…` in `404.html`.
- The LAN host needs no change: `apps/host/src/static.ts` serves any public file and its CSP allows same-origin images and manifests.

### 5.6 R6 Spacecraft clearance (WP-A)

1. `three/spacecraft/extent.ts`: `hardwareRadiusM(design)` = the largest of the bus half-diagonal and, per installed instance, `|instance position| + reach`. Reach by shape, always for the deployed state so the clearance never jumps: wings `[x/2, y/2, 1.22z]`, whip `[x/2, y/2, 3.8z]`, dish `[x/2, y/2, 0.84z]`, others `size/2`.
2. `CommittedScene` gains `craftScale` and `hullRadius`. `craftScale = 0.2 / hardwareRadiusM`, so every craft has a displayed hull radius of 0.2 (D6). `PhysicalWorld` uses `scene.craftScale` instead of `0.25 / size`.
3. Clearance floor = `shell + hullRadius + 0.06`, where `shell = 1 + (EARTH ? 100 : 30) / radiusKm` as in `Planet.tsx:72`. The hardware is lifted radially to at least the floor. A zero-length marker falls back to +X. The cyan marker and tether stay at the true telemetry position.
4. Secondary body: if the scene shows the Moon (Earth-centred) or Earth (Moon-centred), the hardware is also kept at least `bodyRadius + hullRadius + 0.06` from its centre, pushed along the separation.
5. Camera: an `OrbitControls` change handler keeps the camera at radius ≥ `shell + 0.03` from the central body, so user zoom and orbit cannot enter the planet.
6. The scale-and-sources note keeps saying that hardware is enlarged and its surface clearance is schematic.

### 5.7 R7 Orbit lines (WP-A)

- `SceneLine` is re-implemented on drei's `Line` (screen-space width) and keeps its props, adding `width?: number` (default 1) and `dashed?: boolean`. Closed lines append the first point.
- Solar rings: colour = the body's colour mixed 35 % toward white, opacity 0.55, width 1.6 px, `depthWrite={false}`. The selected or hovered body's ring: opacity 0.95, width 2.6 px.
- New Moon ring centred on Earth (radius = the layout's Earth-Moon distance), opacity 0.5, width 1.2 px.
- Mission view: osculating orbit opacity 0.35 → 0.7 at 1.5 px; flown trail 2 px.

### 5.8 R8 Planet information panel (WP-D; state lifted by A and B)

- **Data.** `packages/data/solar-bodies.json`, committed, no runtime request. Values are transcribed from the NSSDCA sheet below (retrieved 2026-11-15); the Sun's row comes from `https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html`, fetched by WP-D.

| | Mercury | Venus | Earth | Moon | Mars | Jupiter | Saturn | Uranus | Neptune |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mass (10²⁴ kg) | 0.330 | 4.87 | 5.97 | 0.073 | 0.642 | 1898 | 568 | 86.8 | 102 |
| Diameter (km) | 4879 | 12,104 | 12,756 | 3475 | 6792 | 142,984 | 120,536 | 51,118 | 49,528 |
| Gravity (m/s²) | 3.7 | 8.9 | 9.8 | 1.6 | 3.7 | 23.1 | 9.0 | 8.7 | 11.0 |
| Escape velocity (km/s) | 4.3 | 10.4 | 11.2 | 2.4 | 5.0 | 59.5 | 35.5 | 21.3 | 23.5 |
| Length of day (h) | 4222.6 | 2802.0 | 24.0 | 708.7 | 24.7 | 9.9 | 10.7 | 17.2 | 16.1 |
| Distance from Sun (10⁶ km) | 57.9 | 108.2 | 149.6 | 0.384 (from Earth) | 228.0 | 778.5 | 1432.0 | 2867.0 | 4515.0 |
| Orbital period (days) | 88.0 | 224.7 | 365.2 | 27.3 | 687.0 | 4331 | 10,747 | 30,589 | 59,800 |
| Mean temperature (°C) | 167 | 464 | 15 | −20 | −65 | −110 | −140 | −195 | −200 |
| Moons | 0 | 0 | 1 | 0 | 2 | 95 | 274 | 28 | 16 |
| Rings | No | No | No | No | No | Yes | Yes | Yes | Yes |
| Global magnetic field | Yes | No | Yes | No | No | Yes | Yes | Yes | Yes |

- **Authored text** (English given here; WP-D adds Portuguese): one sentence per body and "Explored by" names, each linking to that body's page under `https://science.nasa.gov/` (`/sun/`, `/mercury/`, `/venus/`, `/earth/`, `/moon/`, `/mars/`, `/jupiter/`, `/saturn/`, `/uranus/`, `/neptune/`; WP-D confirms each URL answers before committing it).

| Body | Kind | Sentence | Explored by |
|---|---|---|---|
| Sun | Star | The star at the centre of the Solar System; its light powers every solar panel in ASTRIX11. | Parker Solar Probe, SDO, STEREO |
| Mercury | Terrestrial planet | The smallest planet and the closest to the Sun, with almost no atmosphere to hold heat. | Mariner 10, MESSENGER |
| Venus | Terrestrial planet | Nearly Earth's size, wrapped in a dense atmosphere that makes it the hottest planet. | Mariner 2, Magellan |
| Earth | Terrestrial planet | The only world known to have liquid water on its surface and life. | Landsat, Terra, International Space Station |
| Moon | Natural satellite | Earth's only natural satellite and the only other world people have walked on. | Apollo, Lunar Reconnaissance Orbiter, Artemis |
| Mars | Terrestrial planet | A cold desert world with a thin atmosphere and signs of ancient water. | Viking, Mars Odyssey, Mars Reconnaissance Orbiter, Perseverance |
| Jupiter | Gas giant | The largest planet, more than twice as massive as all the others combined. | Voyager, Galileo, Juno |
| Saturn | Gas giant | A gas giant circled by the most extensive ring system in the Solar System. | Pioneer 11, Voyager, Cassini |
| Uranus | Ice giant | An ice giant that rotates on its side. | Voyager 2 |
| Neptune | Ice giant | The most distant planet, dark, cold and whipped by supersonic winds. | Voyager 2 |

- **Panel.** `SolarBodyPanel`, 480 px, in the right panel slot of the solar view when a body is selected; it fits 796 px without scrolling.
  - Header: name, kind chip, previous / next body buttons, close (returns to the system overview).
  - Sentence.
  - Eight fact tiles with icons: diameter, mass, gravity, length of day, year, distance, mean temperature, moons.
  - "Compared with Earth": three bars (diameter, gravity, day length) on a logarithmic scale with the ratio printed.
  - Rings and magnetic-field flags.
  - "Explored by" links.
  - Image note for the globe (`solarImageNote`, moved out of the caption).
  - Earth, Moon, Mars: primary button "Missions here". Others: "Exploration only. Missions are available at Earth, Moon and Mars."
  - Source line: "NASA NSSDCA Planetary Fact Sheet, retrieved 2026-11-15" with the link.
- **State.** `solarBody` moves from `AppCanvas` local state to `PlayApp`, and is passed back to `AppCanvas` (controlled) and to the panel. Clicking a body, the existing body selector and the panel's previous / next buttons all change the same value.
- ≤ 900 px: the panel is a bottom sheet over the lower 55 % with its own scroll.

### 5.9 R9 Level toggle (WP-B)

`LevelToggle`: a `role="group"` labelled "Challenge level" with two `aria-pressed` buttons, 44 px high, icon + name (Rocket "Aspiring", Gauge "Expert"), orange selected state as in `.destination-tabs`. One description line under the group for the selected level. It replaces the `<select>` at `PlayApp.tsx:130`; the value and handler are unchanged.

---

## 6. Step 0: main agent, before delegation

1. Write `apps/web/src/ui/play/turnMoments.ts` per §3.2.
   - Time base: `tNow = telemetry(game.sim).t`; `t0 = tNow − Σ receipts.elapsedSec`; each moment's `startSec` / `endSec` accumulate from `t0`.
   - Samples: `history(game.sim)`; end sample = nearest `t` to `endSec`; frame sample = nearest to the turn's midpoint; `doseUGyH` = samples with `startSec ≤ t ≤ endSec`.
   - Position: mirror `committedScene.ts:79-82` (`flight.centralBody`, `earthRKm`, minus `moonRKm` when Moon-centred; otherwise `positionKm` with `design.orbit?.body ?? 'EARTH'`). `null` when its length is under 1 km.
   - `missionScore` = `scoreMission(game.sim, game.design, SOLO_TEAM)` plus `rawTotal = round(Σ weight × value × 100)`; `SOLO_TEAM = { roles: 1, signoffs: 0, blockedSignoffAttempts: 0, sev3Raised: 0, sev3ResolvedBeforeLaunch: 0 }`.
2. Write `turnMoments.test.ts`: play First Signal with observe then transmit through core (`createTurnGame`, `commitTurn`) and assert:
   - one moment per receipt, contiguous times ending at `telemetry.t`;
   - the observe moment has `capturedMB > 0`, the transmit moment `deliveredMB > 0`;
   - `subpoint` returns longitude 0 for a position on +X at rotation 0, and latitude 90 on +Z;
   - `missionScore(...).total` equals `scoreMission` for the same state.
3. Move `Comparison`, `Receipt` and `planIcons` out of `TurnWorkspace.tsx` into `ui/play/Comparison.tsx`, `ui/play/Receipt.tsx` and `ui/play/planIcons.ts`, so the report and the turn workspace share them without a circular import.
4. Mark this plan "approved, executing" and spawn the four subagents in one batch (§7).

**Done 2026-11-15:** `turnMoments.test.ts` passes (6 tests); the three helpers are extracted.

---

## 7. Delegation: four mechanical execution subagents

One `task` call, four tasks, default `task` agent. Shared context for all four: the repository path, this plan's path, "read §3 and your work package fully before editing", and the rules at the end of §3.4.

### 7.0 Nested `sonic` helpers

Each of the four subagents may spawn up to **two** nested `sonic` subagents (low-reasoning, mechanical). The parent keeps every decision; a helper only applies a fully specified change.

- **Parent keeps:** geometry and math, state and effect logic, contract exports, accessibility behaviour, anything that needs a choice, and reading the helper's result before handing off.
- **Helper gets:** a closed list of files inside the parent's ownership, the exact content or transformation to apply, and nothing to decide. Typical work: bilingual copy tables, CSS rule blocks from given numbers, data transcription, asset conversion commands, repetitive test cases, mechanical call-site updates.
- **Limits:** two helpers per subagent in total, not two at a time; helpers spawn nothing further; helpers never edit a file the parent is editing at the same moment; the same no-checks, no-stubs, no-commit rules apply.
- **Accountability:** the parent's handoff lists what each helper did and confirms the parent read the result. An unused allowance needs no explanation.

Suggested helper splits, to be used only when they save the parent real time:

| Package | Helper 1 | Helper 2 |
|---|---|---|
| WP-A | `SolarSystemScene.tsx` ring restyle and `solarImageNote` extraction (text moved verbatim) | `SceneLine` call-site updates plus `immersive.css` rule blocks |
| WP-B | `play.css` rewrite from the §3.1 and §5.4 numbers | `copy.ts` English/Portuguese keys and `presentation.test.tsx` updates |
| WP-C | `feedback/copy.ts`, `feedback.css`, `report.css` | `frameWindow.test.ts`, `timeline.test.ts`, `persistence.test.ts` cases from the parent's stated expectations |
| WP-D | `solar-bodies.json` transcription, `solarBodies.test.ts`, `solar/copy.ts` | Earth map download/conversion, favicon set, manifest, `asset-sources.json` and `CREDITS.md` rows |

### WP-A · `SceneFeedback`

**Solution space:** fixed designs; geometry and constants given in §5.1, §5.2, §5.6, §5.7.

**Target:** `apps/web/src/three/**` only.

**Change:**

1. `spacecraft/extent.ts` + `extent.test.ts` (§5.6 item 1). Test: the starter SmallSat radius exceeds its bus half-diagonal; a CubeSat without wings equals its bus half-diagonal.
2. `committedScene.ts`: add `craftScale`, `hullRadius`; clearance floor, zero-vector guard, secondary-body clearance (§5.6 items 2-4). New `committedScene.test.ts`: for the default quick design of all twelve missions at both levels, `|craft| − hullRadius ≥ shell + 0.05` and `marker` equals the telemetry position.
3. `AppCanvas.tsx`:
   - props per §3.3; `solarSelection` state removed in favour of `solarBody` / `onSolarBody`;
   - camera insets per §3.1; camera radius clamp (§5.6 item 5);
   - `scale={scene.craftScale}`;
   - at mission end, default camera mode Orbit (once per `scene.identity`);
   - render `TurnFeedback` and `TurnMarkers`; add the `role="status"` event line to the caption.
4. `feedback/signalPath.ts` + test, `feedback/TurnFeedback.tsx` (§5.1, §5.2 scene part), `feedback/TurnMarkers.tsx` (§5.3 scene part). Reuse `GroundDish` and `ObservationTarget` from `ScenePrimitives.tsx`.
5. `ScenePrimitives.tsx`: `SceneLine` on drei `Line` (§5.7). Check every existing caller still compiles by signature.
6. `SolarSystemScene.tsx`: ring styling, Moon ring, hover/selected highlight; export `solarImageNote`; `SolarSystemCaption` keeps only the name and the schematic note.
7. `immersive.css`: styles for the event line and marker labels; caption and controls positions follow §3.1.

**Acceptance (source-level, verified later by main):** contracts in §3.3 exported exactly; no file outside `three/**` edited; no animation runs under reduced motion; the Canvas remains `frameloop="demand"`.

**Handoff:** files changed, any contract deviation, anything that could not be done, and what each nested helper did.

### WP-B · `ShellDensity`

**Solution space:** fixed layout numbers in §3.1 and §5.4; wiring per §3.3.

**Target:** files listed for B in §3.4.

**Change:**

1. `play.css` + `PlayApp.tsx`: shell per §3.1 and §5.4 item 1 (header 56, toolbar and footer rows removed, header save chip).
2. `MissionResources.tsx` + CSS: 60 px single-row cells (§5.4 item 2). Mobile two-row grid unchanged.
3. `LevelToggle.tsx` (§5.9) and its use in `PlayApp.tsx`; delete the level `<select>`.
4. Board (§5.4 item 3): `MissionBoard` in `Preparation.tsx`, board markup in `PlayApp.tsx`, CSS.
5. Preparation choices and brief (§5.4 items 4-5).
6. `TurnWorkspace.tsx`:
   - new props per §3.3;
   - at mission end render `MissionReport` (import from `./report/MissionReport`) and delete the local `Debrief`;
   - "Last turn" block at the top of the preview panel using `TurnResultCard` (import from `./feedback/TurnResultCard`) with the latest moment; collapsed summary when a plan is selected (§5.4 item 6); `aria-live="polite"` on the block;
   - remove the duplicate fuel line.
7. `PlayApp.tsx` wiring:
   - `const moments = useMemo(() => game ? turnMoments(game) : [], [game])`;
   - `selectedTurn` state, reset to `null` when `game?.identity` changes;
   - `solarBody` state; pass `moments`, `selectedTurn`, `onSelectTurn`, `solarBody`, `onSolarBody` to `AppCanvas`, and the turn props to `TurnWorkspace`;
   - in the solar view with a body selected, render `SolarBodyPanel` (import from `./solar/SolarBodyPanel`) in the right panel slot; `onMissions` sets the destination and navigates to the board, as `onSelectDestination` does today.
8. `copy.ts`: new keys in both languages. `presentation.test.tsx`: update for the level toggle (two pressed-state buttons, no `select`), the board grid and the "Last turn" block.

**Acceptance:** every `data-tour` anchor name still present; no native `<select>` for level; imports match §3.3 exactly; ≤ 900 px rules still present.

**Handoff:** as WP-A, plus the list of removed CSS classes.

### WP-C · `MissionReport`

**Solution space:** fixed component set and layout in §5.2, §5.3.

**Target:** files listed for C in §3.4.

**Change:**

1. `feedback/copy.ts` (`fb.` keys, both languages, `useFeedbackCopy`), `feedback/feedback.css`.
2. `feedback/frameWindow.ts` + test (window rectangle, pole clamp, ±180° split, brightness curve), `feedback/frameSource.ts`, `feedback/ObservationFrame.tsx`.
3. `feedback/ReadingChart.tsx`, `feedback/SignalStrip.tsx` (spacecraft icon → moving dashes → dish icon, returned and remaining megabytes; static under reduced motion), `feedback/TurnResultCard.tsx`:
   - headline by `moment.kind` and outcome; interruption cause from the receipt's last auto-pause event (logic currently in `TurnWorkspace.tsx:69-73`);
   - body: `ObservationFrame` when `capturedMB > 0` and the mission is not `INSTRUMENT_HOURS`; `ReadingChart` when it is; `SignalStrip` when `deliveredMB > 0`; before/after bars otherwise;
   - four delta chips (fuel, energy, stored, returned) and objective progress before → after;
   - `compact` renders the one-line summary.
4. `report/report.css`, `report/ScoreSummary.tsx`, `report/TurnTimeline.tsx` + `report/timeline.test.ts` (default selection rule, roving index), `report/MissionReport.tsx` (§5.3, all three breakpoints).
5. `persistence.ts`: optional `score`, `stars`, `turns` on `AttemptRecord`, filled by `attemptRecord` from `missionScore` and `game.receipts.length`; `validRecord` accepts absent fields and rejects non-finite ones. `persistence.test.ts`: an old record without the fields still parses; a new one round-trips.
6. `Journal.tsx`: stars and score per attempt; compact rows; the science library inside a closed disclosure.
7. `Evidence.tsx`: only if `MissionReport` needs a compact variant of `Evidence`; otherwise untouched.

**Acceptance:** contracts in §3.3 exported exactly; the frame caption and the solo-team and score-cap notes are present in both languages; nothing imports from `three/**`.

**Handoff:** as WP-A.

### WP-D · `SolarDossier`

**Solution space:** fixed data and outputs in §5.5, §5.8; Portuguese text is the only authored content.

**Target:** files listed for D in §3.4.

**Change:**

1. `packages/data/solar-bodies.json`: `{ retrieved, sources: [...], bodies: { SUN … NEPTUNE } }`. Per body: `kind`, `massE24Kg`, `diameterKm`, `gravityMs2`, `escapeKms`, `dayHours`, `distanceE6Km`, `distanceFrom` (`SUN` or `EARTH`), `orbitDays`, `meanTempC`, `moons`, `rings`, `magneticField`, `sentence: { en, pt }`, `exploredBy: [{ name, url }]`, `factSheetUrl`. Planet and Moon numbers exactly as the table in §5.8. Sun: fetch the Sun fact sheet and transcribe mass, diameter (2 × volumetric mean radius), surface gravity, escape velocity, sidereal rotation period in hours and effective temperature (converted to °C); `distanceE6Km`, `orbitDays`, `moons` are `null`.
2. `packages/data/src/contracts.ts` (`SolarFactId`, `SolarFact`), `src/index.ts` (`SOLAR_FACTS`), `src/solarBodies.test.ts`: all ten ids present; every number finite or explicitly `null`; Earth diameter 12,756; every URL starts with `https://science.nasa.gov/` or `https://nssdc.gsfc.nasa.gov/`; both languages non-empty.
3. `ui/play/solar/copy.ts` (`solar.` keys, both languages), `solar.css`, `SolarBodyPanel.tsx` (§5.8), `SolarBodyPanel.test.tsx` (static render in both languages: Earth shows "Missions here", Jupiter shows the exploration-only note and 95 moons, the source line carries the retrieval date).
4. Earth frame map: read the Blue Marble original URL from the Earth entry's `originals` in `public/textures/asset-sources.json`, download it, convert with ImageMagick to `public/textures/earth-blue-marble-2048.jpg` (2048×1024, JPEG quality 88, metadata stripped), and add its record (files, source page, original, credit, processing, coordinates) to `asset-sources.json`. If the download fails, do not invent a file: report it; `ObservationFrame` then uses its 1024 px fallback.
5. Favicon set and manifest (§5.5) with ImageMagick; open the 512 px result and confirm the rocket tip and orange arc are complete; link tags in `index.html` and `404.html`.
6. `CREDITS.md`: rows for the NSSDCA fact sheets (data), the new Earth map, and the favicon (derived from the owner-supplied logo).

**Acceptance:** contracts in §3.3 exported exactly; no runtime network request is introduced; every committed number traces to the two NSSDCA pages.

**Handoff:** as WP-A, plus the fetched Sun values and the HTTP status of each `science.nasa.gov` link.

---

## 8. Integration and verification: main agent

### 8.1 Integration

1. Register `feedbackEnglish` / `feedbackPortuguese` and `solarEnglish` / `solarPortuguese` in `apps/web/src/i18n/resources.ts`.
2. Read each handoff; resolve contract deviations in the owning file.
3. `bun run typecheck`, `bun test`, `bun run build`, once each, after all four packages are in. Fix real causes; no casts or relaxed assertions.

### 8.2 Browser acceptance (built application through `bun run host`)

| Check | Pass condition |
|---|---|
| Observe turn, First Signal | Footprint ring and sight line appear; "Last turn" card shows a frame whose coordinates equal the moment's ground point; caption says simulated |
| Night-side observation | Frame is dark with the night label and the model note |
| Storm Watch observation | Strip chart instead of a frame |
| Transmit turn | Wave fronts travel to the dish, then a dashed link remains; status line announces megabytes returned; reduced motion shows the static version only |
| Mars transmit (Red Relay) | Waves leave along the antenna boresight, labelled to Earth |
| Reload during a mission | Feedback is static, not replayed |
| Mission end | Score, stars and five components visible without scrolling at 1920×940; total equals `scoreMission`; selecting a timeline chip moves the highlighted trail marker and the detail card; keyboard arrows work |
| Failure outcome | Capped score with its explanation |
| Density | The table in §5.4, measured with the script used for §1.3, recorded as before/after |
| Clearance | For each SmallSat mission, orbit the camera around the craft at two turns: no part enters the planet or its atmosphere shell; the camera cannot enter the planet |
| Solar map | Rings clearly visible in the overview screenshot; selected ring brighter; Moon ring present |
| Planet panel | Click, selector and previous/next all open the same body; Earth, Moon and Mars lead to their mission boards; values match the NSSDCA table; fits without scrolling at 1920×940 |
| Level toggle | Two buttons, pressed state announced, changes the offers |
| Favicon | `/favicon.ico` and the PNG icons answer 200 from the host on `/`, `/host` and `/join`; tab shows the mark |
| Languages and width | English and Portuguese; 320 px wide has no horizontal overflow on board, preparation, turn, report and planet panel |
| Multiplayer | The production host/controller script still passes; a controller sees the "Last turn" card after the host commits |

### 8.3 Carried-over closure

Run the open items of the turn-based revision §12 on this same build: trace the recorded `removeChild` exception, finish the save / reload / resume / debrief / journal / retry walkthrough, and stop obsolete preview services.

### 8.4 Documentation

- `docs/LAYOUTS.md`: shell constants, board grid, level toggle, "Last turn" card, mission report.
- `docs/RENDERIZATION.md`: hull-based scale and clearance, turn feedback, turn markers, fat lines.
- `docs/SCIENCE_UX.md`: simulated frame rules, score presentation, planet panel.
- `docs/RESOURCES.md`, `docs/INDEX.md`, `CREDITS.md`: NSSDCA fact sheets as a bundled data source, the new Earth map, favicon.
- `docs/CHANGELOG.md`, `docs/VERIFICATION.md`: what changed and what was observed, including the density table.
- Refresh public copies with `bun run prepare:public` and validate links.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Four agents code against components that do not exist yet | Exact paths and signatures in §3.3; one integration pass with typecheck before any browser work |
| A simulated frame is read as a real NASA image | Permanent caption, "simulated" in the card title, archival material stays in the separate Science tab |
| Frame is soft: 2048 px Earth ≈ 20 km per pixel, Mars 1024 px | Window sized to the map resolution; wide-field framing stated in the caption; a sharper Mars map is a later asset task |
| History is decimated on long missions, so a frame may be minutes off the true midpoint | Nearest-sample rule is documented in the card's details; objectives are never judged from it |
| Continuous rendering during waves on low-power GPUs | Demand frame loop resumes after about six seconds; no animation under reduced motion or the LOW quality tier's reduced-motion path |
| Normalised hull size makes small craft look as large as big ones | Already disclosed as "hardware enlarged"; the true size remains in component details |
| Denser panels hurt 320 px reflow or Portuguese wrapping | Mobile rules kept; both checked in §8.2 |
| Solo score includes full team credit | Labelled in the score breakdown (D2); changing it is a separate rules decision |
| NSSDCA values change (moon counts did in 2026) | Retrieval date shown in the panel and stored in the data file |

---

## 10. Out of scope

- Real downloaded imagery per observation, live NASA data, or any runtime network request.
- Core rule, score-weight, save-schema or protocol changes.
- New missions, new destinations, or missions at the exploration-only planets.
- Replacing the remaining native selects (goal, solar body) with custom pickers.
- Role-specific phone consoles.
