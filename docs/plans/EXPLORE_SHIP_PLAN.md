# ASTRIX11: Explore ship plan

**Status:** written and built on 2026-11-15 by the ExploreShip subagent (WP-G of the [turn feedback refinement plan](./TURN_FEEDBACK_REFINEMENT_PLAN.md), request R13). The code lives in `apps/web/src/three/explore/`. The main agent wires it into `three/AppCanvas.tsx` (§7). Nothing outside `three/explore/**` and this file was changed.

**Owner request, verbatim:** "on the explore tab we should allow boarding a ship to explore the universe. add camera, ship and dragging."

The Explore tab is the `solar` view (`ui/play/PlayApp.tsx`: the header's Explore button navigates to `solar`). Boarding is presentation only. Flying never advances mission time, never touches the engine, the save or the session, and nothing in the flight is presented as a NASA observation.

---

## 1. Evidence

- **The scene.** `three/AppCanvas.tsx:268` renders `SolarSystemScene` in the solar view inside one `<Canvas frameloop="demand" logarithmicDepthBuffer>` (`:264`). `SOLAR_BODIES` (`three/SolarSystemScene.tsx:29`) follow plan §11.3: the Sun has radius 6 at the origin (`three/solar/scale.ts` `SUN_DISPLAY_RADIUS`), planets have radii 0.015 (Moon) to 0.6166 (Jupiter) on compressed orbits from 8.5 (Mercury) to 33 (Neptune), and the Moon sits 0.45 from Earth. The caption states the scale: sizes to scale with the Sun, distances compressed.
- **The camera.** `SceneCamera` (`AppCanvas.tsx:66-161`) is a drei `OrbitControls` with `makeDefault`, damping off under reduced motion, a clamp that keeps the camera outside every body (`:80`), and a view offset that frames the focus (`:94-104`). On mount it frames its context from scratch (`framedContext` starts null), and it sets `camera.near` and `camera.far` itself (`:128-129`). The initial field of view is 38° (`INITIAL_CAMERA`).
- **Keyboard.** The scene section handles arrows, plus, minus, zero and Home as orbit commands (`AppCanvas.tsx:241-246`) and ignores fields only.
- **Overlays.** In the solar view the caption sits top centre (`:277`), the camera controls sit bottom right (`:284-291`, `immersive.css` solar rules), `SolarWelcome` sits in the bottom-left document panel (a 100 px bottom sheet at ≤ 900 px), and a selected body opens the dossier slot on the right (a 55 % bottom sheet at ≤ 900 px, `PlayApp.tsx:152`). `.immersive-scene` is `pointer-events: none` with `auto` on its children, and the canvas already has `touch-action: none`.
- **A ship to show.** `three/spacecraft/SpacecraftModel.tsx` draws any `Design` in metres, body axes unchanged (+X panel normal, +Z boresight). `quickDesignBrief(defaultQuickDesign('PAST_EARTH')).design` is a SmallSat (0.8 m bus, deployed wings about 4.4 m across). With `workbench` off and `inspectable` off it draws no pick targets and no animations.
- **Shared camera helper.** `three/camera/approach.ts` `approachFactor(rate, dt) = 1 − e^(−rate·dt)` is the project's frame-rate-independent response; Explore reuses it rather than adding a second convention.
- **Inspiration.** Void Protocol's `docs/gameplay/CONTROLS_AND_PHYSICS.md` (read for ideas only): constant-velocity flight with drag and speed caps, frame-rate-independent exponential responses for steering and camera, avoidance that deflects a planned path perpendicular to an obstacle, a chase camera decoupled from physics, free look by dragging with auto recenter after about 3 s, a cockpit view that is never shaken, adaptive field of view, and a hard surface constraint inside the fixed step. No Void Protocol code was copied or adapted.

## 2. Decisions

Each has a default so execution was not blocked. Change any of them at review.

| ID | Decision | Default (built) | Alternative |
|---|---|---|---|
| E1 | Where boarding happens | A "Board the ship" button in the solar view; the ship appears just ahead of the current camera, so the view does not jump | Fixed spawn beside Earth: a jump cut, and it hides the body the player was looking at |
| E2 | Which ship | The bundled SmallSat illustration (`PAST_EARTH` quick design), enlarged to about 0.0066 units across and labelled "ship enlarged" | A new spaceship model: new asset, new provenance |
| E3 | What a drag does | As in Void Protocol (owner instruction, 2026-11-15): in manual flight a drag **steers the ship**; while the autopilot flies, or in free look (L or the HUD button), the same drag only **turns the view**. Both use Void's axes: dragging right turns right, dragging down turns down, so the scene slides against the pointer. Sensitivities are Void's: 0.003 rad per pixel to steer, 0.005 to look | "Grab the sky" look as the default (the first build): the scene followed the pointer, the opposite of Void on both axes |
| E4 | Flight model | Thrust under a selectable speed limit with gentle coasting drag and a strong brake; velocity swings toward the nose while thrusting | Pure Newtonian: hard to stop near bodies 0.015 units across |
| E5 | Units shown | Solar radii of the drawn Sun (R☉, 6 scene units), with "distances compressed"; distance to the target is also given in target radii | Kilometres: false, because distances between bodies are compressed |
| E6 | Collision | The ship never enters a body: a swept hard constraint at 1.15 × radius + 0.004 plus a closing-speed limit. No damage, no bounce | Collisions with consequences: not a flight game, and nothing to lose here |
| E7 | Autopilot speed | The selected speed limit, so the player controls it | A fixed fast cruise: surprising next to the manual limit |
| E8 | Target selection | A separate flight target (HUD select, or clicking a body while flying); it does not open the body dossier | Reuse the solar selection: on phones the dossier sheet would cover the flight pad |
| E9 | Saturn's ring | Not solid; the ship may pass through the ring plane | Ring collision: an extra shape for an illustrative ring |
| E10 | Persistence | None: every boarding starts at defaults (speed level 4 of 6, chase camera, drag steers, on-screen controls shown on every device) | Remember settings in `localStorage` |

## 3. The experience

### 3.1 Boarding and leaving

- Not boarded: the solar view is unchanged apart from a "Board the ship" button (bottom right, above the solar camera controls, moving with them when a body's dossier is open). Boarding with a body selected makes it the flight target and closes its dossier.
- Board: the orbit camera is unmounted, the ship appears in front of where the camera was, facing the same way, pushed outside any body it would overlap. The chase camera starts at the old camera pose, so the first frame is identical; the chase boom then settles (rigid under reduced motion). Focus moves to the HUD heading and a polite status line says how to fly. The scene caption and the solar camera controls are hidden while flying.
- Leave: "Leave ship" restores the camera's near plane, far plane and field of view, remounts the orbit camera, which reframes the system overview exactly as on first entry (boarding closed the body dossier, §7), and returns focus to the Board button. Leaving the solar view or a WebGL failure also leaves the ship.

### 3.2 Flight controls

| Input | Keyboard (physical keys) | Mouse | Touch (on-screen pad) |
|---|---|---|---|
| Thrust / reverse | W / S | — | hold ⇑ / ⇓ |
| Turn (yaw) | A / D or ← / → | drag left / right (default) | steering pad left / right |
| Nose up / down (pitch) | ↑ / ↓ | drag up / down (default): down lowers the nose | steering pad up / down |
| Roll | Q / E | — | hold ↺ / ↻ |
| Brake | Space (hold) | — | hold brake |
| Speed limit | − / + | HUD − / + | HUD − / + |
| Autopilot to target | P (Esc turns it off) | HUD button | HUD button |
| Camera chase / cockpit | C | HUD button | HUD button |
| Look around | — | drag while the autopilot flies, or in free look | the same |
| Free look: drag looks instead of steers | L | HUD button | pad's eye button or HUD button |
| Recenter view | R | HUD button | HUD button |
| Help | H | HUD button | HUD button |

- Keys are read by `event.code`, so the layout is positional on AZERTY and other keyboards. Keys typed into a field or select stay with the field; Space and Enter on a focused button activate the button; modified shortcuts (Ctrl, Alt, Meta) are left to the browser. Held keys are released on window blur and when the tab is hidden.
- Canvas drag uses one captured pointer (`setPointerCapture`), no pointer lock, mouse primary button, pen or the first finger. A second finger is ignored.
- The on-screen pad: an analog steering pad (radial deadzone 0.12, full deflection at the rim) and press-and-hold buttons for thrust, reverse, brake and roll. Each hold button also holds while Space or Enter is held on it, so it works from the keyboard. The pad is shown by default on every device, can be hidden with the on-screen controls toggle, and is shown again on the next boarding.
- Keyboard-only flight and touch-only flight are both complete: every action has a key, and every action has an on-screen control.

### 3.3 Camera

- **Chase** (default): 0.014 behind and 0.0035 above the ship in the view frame, stretching by up to 25 % at full speed. The offset relative to the ship eases at 9/s and the orientation at 10/s, so the ship stays framed at any speed; easing is applied to the ship-relative offset, never to the world position.
- **Cockpit**: at the nose (0.0016 ahead), rigid, ship model hidden, never shaken.
- **Free look**: 0.005 rad per dragged pixel; dragging right looks right and dragging down looks down. Pitch is limited to ±1.45 rad, yaw wraps. After 2.5 s without a look drag the view eases back to the nose at 2/s. R or the HUD button recenters at once.
- **Field of view** 55°, widening to 63° with the square of the speed fraction (eased at 4/s).
- **Shake**: chase only, only while thrusting fast, at most 0.00012 units.
- **Clearance**: the camera point is pushed out to 0.0015 above any surface; near plane 0.0002, far plane 4000 (the canvas uses a logarithmic depth buffer).

### 3.4 Speed

Six limits in scene units per second: 0.005, 0.02, 0.08, 0.3, 1 and 3 (level 4, 0.3/s, is the boarding default). At level 6 the ship crosses from the Sun to Neptune in about 11 s; at level 1 it moves about one ship length per second for close inspection. Acceleration is 1.5 × the limit per second (reverse half that); with no thrust the speed decays at 0.8/s and the ship comes to rest below 0.2 % of the limit; the brake adds 5/s. Lowering the limit slows the ship smoothly (4/s), never instantly.

### 3.5 Autopilot

With a target selected, P or the HUD button flies the ship to a stand-off point on the near side of the target: avoidance radius plus twice the body radius, between 0.03 and 3 units (Earth: about 0.18 from the centre; Jupiter: about 1.95; the Sun: about 9.9). The commanded velocity cruises at the speed limit, brakes on a constant-deceleration profile and settles exponentially (1.2/s). The ship turns toward its course at 1.6 rad/s and ends facing the target. A body on the planned straight path within 1.6 avoidance radii deflects the course perpendicular to the path, strongest when the path crosses its centre, so the autopilot flies around the Sun rather than into it. Any manual input (keys, pad, steer drag, brake) hands control back at once; a look drag does not. Changing or clearing the target switches it off. On arrival it reports "Arrived near …" and stops.

### 3.6 Collision avoidance

Two layers, both in the fixed step:

1. **Closing-speed limit.** For each body the ship is heading into, the speed toward it is limited to 0.0015 + 1.5 × clearance per second, where clearance is the distance to the avoidance sphere. Tangential and outward motion are untouched, and a course that misses the sphere by more than 5 % keeps its speed. A ship flown at a planet slows smoothly and settles on the sphere.
2. **Swept hard constraint.** Each step moves along a segment; if the segment enters an avoidance sphere (radius × 1.15 + 0.004), the ship stops on its surface and loses the inward part of its velocity, so it slides along the body. This holds at any speed, including one step longer than a body's diameter. The HUD then says "holding clear of the surface".

### 3.7 HUD

A panel (top left on desktop, top full width on phones) with: the heading and Leave ship; the target select; distance to the target's surface in R☉ and in target radii; speed and the current limit in R☉/s; the nearest body and its distance, with "holding clear of the surface" when on the avoidance sphere; command buttons (autopilot, speed − / level / +, cockpit, drag steers, recenter, on-screen controls, help); the honesty line "Schematic flight: sizes to scale with the Sun (R☉ = solar radius), distances compressed, ship enlarged. Mission time does not advance."; a polite status line for discrete events (autopilot engaged, arrived, off; camera; drag mode; speed limit; holding clear). Numbers that change every frame are never announced. A short line in the scene points from the ship toward the target. All text exists in English and Brazilian Portuguese through the inline `pt ? … : …` pattern. Every control is a native button or select, at least 44 px, with a visible focus ring.

### 3.8 Reduced motion

From the existing preference (`reducedMotion` prop): the chase camera is rigid (no easing), there is no shake, the field of view is fixed at 55°, the view never recenters on its own (R recenters instantly), and HUD transitions are off. Flight itself is unchanged: the ship moves only when the player or the autopilot flies it.

### 3.9 Mobile layout (≤ 900 px)

The panel spans the top under the header (`--explore-top`, default 108 px) with a three-column readout and a horizontally scrolling icon row (labels stay as accessible names). The pad sits above the 100 px solar welcome sheet (`--explore-pad-bottom`, default 112 px, plus the safe-area inset): steering pad left, a 3 × 2 grid of 46 px buttons right. At 320 px the readout drops to two columns and buttons to 44 px; nothing overflows horizontally. Touches on the HUD are DOM siblings of the canvas and never reach it; the HUD also stops pointer, touch and wheel propagation, and its pad has `touch-action: none` and no long-press menu.

## 4. Frame loop

- Simulation runs on a fixed 1/60 s step through an accumulator; at most 8 steps per frame, and a frame gap above 0.1 s is not replayed. After the demand loop has slept, the first frame runs a single step, so a key press after a pause does not jump.
- Rendering interpolates position and orientation between the last two steps.
- The flight calls `invalidate()` only while something moves: the ship has velocity or rotation, autopilot is engaged, a control is held or the pad deflected, a drag is in progress or pending, the chase camera or field of view has not settled, or the free look is off-centre and will recenter. Otherwise the canvas sleeps. Every control-store change wakes it.
- Telemetry reaches React at most every 0.1 s while moving, and once when the ship comes to rest, only when a visible value changed.

## 5. Modules

All under `apps/web/src/three/explore/`.

| File | Kind | Contents |
|---|---|---|
| `index.ts` | contract | `ExploreBody`, `ExploreTelemetry`, re-exports `ExploreFlight`, `ExploreHud` |
| `vecMath.ts` | pure | tuple vector and quaternion helpers, allocation-free with `out` arguments |
| `flightMath.ts` | pure, tested | flight state, fixed-step accumulator, `stepFlight`, speed limits, damping, closing-speed limit, swept constraint, autopilot goal, velocity and deflection, render interpolation |
| `cameraMath.ts` | pure, tested | chase and cockpit offsets, easing, free look and recentering, drag-to-look and drag-to-steer mapping, field of view, shake, camera clearance |
| `controls.ts` | pure store, tested | key bindings, deadzone, the shared control store (snapshot for the HUD, held inputs and drag deltas for the flight) |
| `telemetry.ts` | pure, tested | telemetry building and change detection, solar radius unit, holding-clear test |
| `ExploreFlight.tsx` | R3F | camera takeover and restore, ship model, engine glow, target bearing line, keyboard and canvas pointer input, the frame loop |
| `ExploreHud.tsx` | DOM | Board button, panel, help, steering pad, hold buttons, announcements |
| `explore.css` | style | `explore-` classes only |
| `*.test.ts` | tests | `flightMath`, `cameraMath`, `controls`, `telemetry` |

## 6. Contract

```ts
// apps/web/src/three/explore/index.ts
export interface ExploreBody { id: string; name: { en: string; pt: string }; position: readonly [number, number, number]; radius: number }
/** Inside <Canvas>, rendered in the solar view next to SolarSystemScene. Takes over the camera while boarded. */
export function ExploreFlight(props: { boarded: boolean; bodies: readonly ExploreBody[]; target: string | null; reducedMotion: boolean; onTelemetry: (telemetry: ExploreTelemetry) => void }): JSX.Element | null;
/** Outside <Canvas>, DOM overlay: board / leave button, HUD, on-screen flight controls, help. */
export function ExploreHud(props: { boarded: boolean; onBoard: () => void; onLeave: () => void; telemetry: ExploreTelemetry | null; bodies: readonly ExploreBody[]; target: string | null; onTarget: (id: string | null) => void; reducedMotion: boolean }): JSX.Element;
export interface ExploreTelemetry { speed: number; position: readonly [number, number, number]; nearest: { id: string; distance: number } | null; mode: 'chase' | 'cockpit' }
```

- `speed` is scene units per second; `position` is scene units; `nearest.distance` is the distance from the ship to that body's surface (centre distance minus radius) in scene units. The HUD converts to R☉ using the body with id `SUN` (6 units), falling back to 6.
- `ExploreFlight` renders nothing when not boarded. While boarded it owns `camera.position`, `quaternion`, `near`, `far` and `fov`, clears the view offset, and restores near, far and field of view when it unmounts or `boarded` turns false. It requires that no other controls drive the camera.
- `ExploreHud` must be rendered inside `.immersive-scene` (it inherits its `pointer-events: none` and the focus colour) and outside `.immersive-scene-render`.

## 7. Integration in `three/AppCanvas.tsx` (main agent)

```tsx
import { ExploreFlight, ExploreHud, type ExploreTelemetry } from './explore';

// In AppCanvas, after `failed` and the solar state:
const [boarded, setBoarded] = useState(false);
const [flightTarget, setFlightTarget] = useState<string | null>(null);
const [telemetry, setTelemetry] = useState<ExploreTelemetry | null>(null);
const flying = boarded && view === 'solar' && !failed;
useEffect(() => { if (view !== 'solar' || failed) setBoarded(false); }, [view, failed]);
const board = useCallback(() => { setFlightTarget(solarBody?.id ?? null); setTelemetry(null); setBoarded(true); onSolarBody('SYSTEM'); }, [solarBody, onSolarBody]);
const leave = useCallback(() => setBoarded(false), []);

// First line of `keyboard`: the flight owns the arrows, plus and minus while boarded.
if (flying) return;

// Inside <Canvas>, replacing the solar branch and the SceneCamera line:
{view === 'solar' ? <>
  <SolarSystemScene selected={solarSelection} onFocus={flying ? setFlightTarget : onSolarBody}/>
  <ExploreFlight boarded={flying} bodies={SOLAR_BODIES} target={flightTarget} reducedMotion={reducedMotion} onTelemetry={setTelemetry}/>
</> : <>…unchanged…</>}
{!flying && <SceneCamera scene={scene} mode={mode} view={view} command={command} reducedMotion={reducedMotion} solarFocus={solarFocus}/>}

// After the render div, inside the section:
{view === 'solar' && !flying && <SolarSystemCaption body={solarBody}/>}
{view === 'solar' && !failed && <ExploreHud boarded={flying} onBoard={board} onLeave={leave} telemetry={telemetry} bodies={SOLAR_BODIES} target={flightTarget} onTarget={setFlightTarget} reducedMotion={reducedMotion}/>}
// and wrap the camera controls: {!flying && <div className="immersive-scene-controls">…</div>}
```

- Disabling the orbit camera means **unmounting `SceneCamera`** (and with it the drei `OrbitControls makeDefault`). There is no `enabled` prop to set. On remount it reframes the solar selection from scratch and resets near and far, which is the intended return view. One quirk to know: `SceneCamera`'s `appliedCommand` ref restarts at 0 on remount, so a camera-button command issued before boarding is applied once more after leaving. Hiding the controls while flying means no new command can be issued meanwhile.
- `onFocus={flying ? setFlightTarget : onSolarBody}` makes clicking a body while flying choose the flight target instead of opening the dossier (decision E8). `SolarBodyId` is assignable to `string`.
- `board` hands the selected body over as the flight target and closes its dossier (`onSolarBody('SYSTEM')`), so the dossier panel or its phone bottom sheet never covers the HUD or the flight pad. After leaving, the orbit camera therefore reframes the system overview.
- Optional: while `flying`, the section's `aria-label` and `aria-keyshortcuts` describe orbit keys that no longer apply; switch them to "3D space view, flying the ship. Press H for flight keys." / "Vista espacial 3D, pilotando a nave. Pressione H para as teclas de voo." with `aria-keyshortcuts` removed.
- Optional placement tuning without editing `explore.css`: set `--explore-top`, `--explore-board-bottom` or `--explore-pad-bottom` on `.immersive-scene[data-view='solar']`.
- Telemetry updates re-render `AppCanvas` at most ten times a second while the ship moves, and not at all at rest.

## 8. Verification

- **Unit tests (written, run by the main agent):** `bun test apps/web/src/three/explore`. They cover: no position inside any avoidance sphere for 200 seeded starts at 1, 50 and 1,000 units/s with the limit removed; a single step longer than the Moon's diameter stopping on its near surface; a ship thrusting at Jupiter settling on its avoidance sphere; the closing-speed allowance; a pass-by keeping its speed; identical fixed steps at 30 and 60 fps; no burst after a long pause; the speed limit and its smooth lowering; coasting to rest, brake and the frame loop's rest test; turn directions; autopilot around the Sun to Mars, arrival at the stand-off distance facing Mars, hand-back on manual input; drag mappings; recentering with and without reduced motion; easing, snap, shake and field of view under reduced motion; camera clearance; key routing for fields and buttons; deadzone; the control store; telemetry.
- **Browser checks (main agent, built app):** board and leave at 1440 × 900, 390 × 844 and 320 × 568; fly to Mercury and the Moon with the keyboard only; fly with touch only (device emulation); autopilot from the overview to Neptune; ram Jupiter and Earth at the top speed and confirm the HUD says holding clear and the view never enters the body; reduced motion on: no easing on board, cockpit switch or recenter, no shake; the canvas stops rendering at rest (frame count stays constant in the performance panel); Leave restores the original overview framing and the caption and controls return.

## 9. Risks

| Risk | Mitigation |
|---|---|
| The HUD overlaps sibling panels whose layout other work packages own (welcome panel, dossier) | Flying hides the caption and solar controls; clicking a body while flying selects the target instead of opening the dossier; positions are CSS variables the integrator can tune |
| Float precision at 0.0002 near plane across a 33-unit scene | The canvas already uses a logarithmic depth buffer; positions are small numbers near the origin, no floating origin needed |
| Telemetry re-renders `AppCanvas` | Capped at 10 Hz and only when a visible value changed |
| Pointer drag that starts on a body also clicks it | Clicking while flying only changes the flight target, which is harmless |
| A future body list with overlapping avoidance spheres | Push-out runs three passes; overlapping spheres would make the ship rest between them, never inside |
| Keyboard conflict with the scene's orbit keys | The integrator returns early from `keyboard` while flying (§7) |
| The camera's original field of view is changed elsewhere while boarded | The flight saves and restores the value it found at boarding |

## 10. Out of scope

Gravity and orbital mechanics, landing or docking, damage, sound, a radar or off-screen target arrow, saving flight settings, gamepads, flight in other views, and any change to mission time, saves, the engine or the session.

## 11. Provenance

Void Protocol was used for ideas only, from `docs/gameplay/CONTROLS_AND_PHYSICS.md`; no file was adapted, so no CREDITS rows are needed. The ship is the existing ASTRIX SmallSat illustration. The exponential approach helper is the existing `three/camera/approach.ts`, already credited.
