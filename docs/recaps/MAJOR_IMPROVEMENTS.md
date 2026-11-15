# ASTRIX11: major improvements recap (2026-11-15)

This is the full record of one working session on ASTRIX11: what the owner asked for, what was built, how each part works, what was checked and what was not. It is written for someone who was not in the session.

- **Plans executed:** [turn feedback, mission report and density refinement](../plans/TURN_FEEDBACK_REFINEMENT_PLAN.md) and [Explore ship](../plans/EXPLORE_SHIP_PLAN.md).
- **Baseline:** commit `17d10d2`. Most of the work is in the owner's commits `343e070` and `241cdda`; the last integration fixes (§6), the drag-axis change (§5) and the documentation are uncommitted in the working tree at the time of writing.
- **Size:** 143 files changed between `17d10d2` and `241cdda` (7,439 lines added, 458 removed), plus 24 files in the working tree.

## 1. Requests and outcome

Thirteen owner requests arrived in four batches during the session. R1-R9 were researched and planned first and approved; R10-R12 and R13 were added while execution was under way; the drag-axis change came last.

| # | Request | Outcome |
|---|---|---|
| R1 | Transmit turns show waves travelling toward the planet | Built. Orange wave fronts travel from the spacecraft to the ground-station dish, then a dashed link and three rings remain. Static result seen in the browser; the animation itself was not captured in a screenshot (§7.3). |
| R2 | Observation turns show the picture that was taken | Built. A simulated frame cut from the bundled NASA map at the ground track, shaded by the Sun angle, always captioned as simulated. Seen in the browser. |
| R3 | Mission end shows the turns, the results and the score | Built. Mission report with score ring, stars, five components, objectives, a turn timeline and a per-turn detail panel; numbered turn markers in the scene. Seen in the browser. |
| R4 | Much less scrolling at 1080p | Built. Board, turn panels and report need no scrolling at 1920×940; preparation is at 1.05 screens (§7.2). |
| R5 | Custom favicon | Built. Icon set, manifest and link tags; the 192 px icon was inspected. |
| R6 | Satellite must not touch or enter the body | Built. Display size follows the real hull including deployables; clearance depends on altitude; the camera cannot enter a body. Covered by tests for all missions. |
| R7 | Orbit lines more visible | Built. Screen-space lines with real width; coloured, brighter rings; a Moon ring. Seen in the browser. |
| R8 | Clicking a planet opens a panel with NASA information | Built. Fact panel for the Sun, eight planets and the Moon from the NSSDCA fact sheets, bundled with the game. Seen for all ten bodies. |
| R9 | Aspiring / Expert as toggle buttons | Built. Two pressed-state buttons replace the dropdown. Seen in the browser. |
| R10 | Replay the movement between turns, with speed control; launches start on the ground | Built. Replay of the committed turn at 1×, 2×, 4×, 8× with pause, skip and replay; launch stack on the pad that rises through ascent. Seen in the browser for launch, observe and a one-day transmit turn. |
| R11 | Missions to the Sun | Built. The Sun is a fourth destination with one mission, Sun Sentinel, at both levels. A second mission, Close Pass, was not shipped (§4.6). Certified and played to success in core tests; in the browser the Sun tab, the mission card and the first observation turn were seen on the production build. |
| R12 | Explore shows planets to scale with the Sun; Sun large by default | Built. Sizes are true to scale (Earth is 1/109 of the Sun's diameter); distances stay compressed and say so. Seen in the browser. |
| R13 | Board a ship in Explore: camera, ship, dragging | Built. Ship with chase and cockpit cameras, keyboard, drag, touch pad, speed limit, autopilot to a body, and avoidance so it never enters a body. Flown in the browser. |
| — | Drag axes like Void Protocol | Built. A drag steers the ship by default; right turns right, down lowers the nose; on autopilot or in free look the same drag only turns the view. Measured in the browser (§5.3). |

## 2. How the work was organised

1. **Research and plan (R1-R9).** The running application was measured at 1920×1080 and 1920×940 and the code was read. The plan fixed six decisions (D1-D6), the shared contracts, the file ownership and four work packages. The owner approved it and allowed each subagent up to two nested low-reasoning helpers for mechanical slices. None of the subagents used that allowance.
2. **Step 0 by the main agent.** One shared, pure module, `apps/web/src/ui/play/turnMoments.ts`, so that the scene, the turn card and the report read the same derived data. `Receipt`, `Comparison` and `planIcons` were moved out of `TurnWorkspace.tsx` into their own files so the report and the turn workspace could share them.
3. **Scope added mid-flight.** R10-R12 became plan §11 with three more decisions (D7-D9). The mission scene was split from the Explore scene so two agents never edited the same file, and a core package was added for the Sun.
4. **Seven subagents in parallel, exclusive files:**

| Package | Owned | Delivered |
|---|---|---|
| A SceneFeedback | `three/**` except the solar scene and Explore ship | Clearance, fat lines, Sun as a rendered body, waves, footprint, turn markers, replay, launch stack, transport |
| B ShellDensity | `PlayApp`, `TurnWorkspace`, `Preparation`, `play.css`, `copy.ts`, tests, `LevelToggle` | Shell, board, preparation, level toggle, Sun tab, "Last turn" block, wiring |
| C MissionReport | `ui/play/feedback/**`, `ui/play/report/**`, journal, persistence | Turn result card, simulated frame, reading chart, signal strip, score, timeline, report, journal |
| D SolarDossier | `packages/data/**`, `ui/play/solar/**`, `public/**`, HTML entry files, `CREDITS.md` | Fact data, fact panel, Earth 2048 px map, favicon set |
| E SunMissions | `packages/core/**`, `packages/session/**`, remaining body-keyed web files | Sun as a body, Sun Sentinel, validation, GMAT frames, copy |
| F SolarScale | `three/SolarSystemScene.tsx`, `three/solar/**` | True-scale sizes, compressed orbits, rings, captions |
| G ExploreShip | `three/explore/**`, its own plan | Research, plan and build of the boardable ship |

5. **Integration by the main agent.** Copy registration, wiring of the Explore ship into the canvas, fixes found in the browser (§6), then typecheck, tests, build and browser checks.

The rules that made parallel work safe: one owner per file; fixed import paths and signatures agreed before anyone started; exclusive CSS class prefixes (`scene-fb-`, `fb-`, `report-`, `jr-`, `dossier-`, `solar-scale-`, `explore-`); no checks run by subagents except the core package, which had no other way to verify itself.

## 3. Decisions

| ID | Decision | Why |
|---|---|---|
| D1 | The observation "picture" is a simulated frame, not a photo | A fixed archive photo would not change with the player's orbit and would read as a real observation. The frame is always captioned "Simulated frame built from the NASA … archive at your ground track. Not a new observation." |
| D2 | The score is the engine's existing `scoreMission`, unchanged | Results stay comparable and versioned. In solo play the team component is full credit and the report says so. |
| D3 | The report keeps the 3D scene visible | The standing rule is that the scene is always visible; the report is two panels and a bottom timeline. |
| D4 | Frames and turn positions are not stored in saves | They are re-derived from saved engine history, so the save format is unchanged. |
| D5 | 1920×940 is the no-scroll target | A 1080p monitor leaves about 940 px of page height. |
| D6 | Every craft has the same on-screen hull radius | Size follows the real extent including wings and antennas (`craftScale = 0.2 / hardwareRadiusM`), so clearance is the same for every craft. |
| D7 | The replay is presentation of committed history only | It starts after the engine has resolved the turn, never changes state, can be skipped, and says that it interpolates. |
| D8 | The Sun is a fourth body; Sun missions start in a provided solar orbit | A solar orbit is what a launch to Earth escape already gives (STEREO, Helios), so there is no cruise phase or capture burn. Existing missions, digests and version numbers are untouched. |
| D9 | Explore is to scale in size, compressed in distance | At true distance Earth would be 215 solar radii away and no planet would be visible. |
| E3 | In the Explore ship a drag steers; on autopilot or in free look it turns the view | Owner instruction to follow Void Protocol's axes (§5.3). |

## 4. What was built, feature by feature

### 4.1 Shared turn data (`ui/play/turnMoments.ts`)

`turnMoments(game)` returns one `TurnMoment` per committed receipt: plan kind, start and end time, deltas, captured and returned megabytes, objective progress, central body, end-of-turn position, the ground point at the middle of the turn (latitude, longitude, Sun elevation), the station position, dose-rate samples and battery state of charge. It reads only `history(game.sim)` and the receipts.

- **Time base:** current telemetry time minus the sum of receipt durations; moments are contiguous.
- **Ground point:** `subpoint()` uses the same longitude convention as the planet texture (longitude 0 on core +X at rotation 0).
- **`passKm`** (added during integration): where the spacecraft was relative to the ground during the last station contact of the turn, rotated with the Earth to the end of the turn so it lines up with the station. See §6.4.
- **`missionScore(game)`:** the core score with `SOLO_TEAM`, plus `rawTotal` before the failure cap.

### 4.2 Turn feedback in the scene (R1, R2; `three/feedback/`)

- **Transmission.** When the latest turn returned data, four ring meshes travel from the source to the target in 1.6 s each, 0.4 s apart, for five cycles (9.2 s in total), then stop. Afterwards, on load, on resume and under reduced motion: a dashed link, three static rings and the `GroundDish` at the station.
  - Target: the ground station when it is in the scene's frame; Earth's marker in a Sun-centred scene; otherwise a point along the antenna boresight labelled "to Earth" (Mars).
- **Observation.** A ring on the surface beneath the true position and a sight line to the hardware; a 0.6 s scale-in once.
- **Text equivalent.** A `role="status"` line in the scene caption, for example "Turn 2: Transmit · Observation: 15 MB stored · Signal: 1.69 MB returned to the ground station".
- **Frame loop.** The canvas stays `frameloop="demand"`; frames are requested only while something animates.

### 4.3 Turn result card and simulated frame (R1, R2; `ui/play/feedback/`)

`TurnResultCard` leads the right panel after every commit ("Last turn") and is the detail view in the report.

- **`ObservationFrame`** draws on a 2D canvas, so it works even when WebGL has failed.
  - Maps: Earth `earth-blue-marble-2048.jpg` (new, falls back to the 1024 px file), Moon `moon-lro-2048.jpg`, Mars `mars-viking-1024.jpg`, Sun `sun-stereo-sdo-304-1024.jpg`.
  - Window: 16:10; 36° of longitude on a 2048 px map, 60° on a 1024 px map; clamped at the poles; split in two when it crosses ±180°.
  - Lighting: brightness `0.18 + 0.82 × smoothstep(−6°, 12°, Sun elevation)`; labels night below −6°, twilight to 6°, day above. The Sun's frame is not shaded.
  - A night frame adds "The model counts instrument data regardless of ground lighting."
- **`ReadingChart`** replaces the frame on radiation missions: a strip chart of the dose-rate samples inside the turn.
- **`SignalStrip`** for turns that returned data: megabytes returned and still on board.
- **Otherwise** before/after bars for energy, data and fuel, four delta chips and objective progress before → after. The interruption cause is shown when a plan stopped early.

### 4.4 Mission report with score (R3; `ui/play/report/`)

Replaces the old single-column debrief.

- **Result panel (left):** outcome, mission, elapsed time, score ring out of 100, stars, one row per component with points earned and maximum, the solo-team note, the cap note when a failed or incomplete run would have scored above 19, objectives, the discovery line, and the actions Try another design / Retry the same conditions.
- **Timeline dock (bottom, 176 px):** one chip per turn with number, plan icon, name, duration and up to two delta badges, under a band showing objective progress and battery charge. Arrow keys move between chips; the default selection is the last turn that captured or returned data.
- **Detail panel (right):** tabs Turn (the result card and every receipt), Science, Compare (same-seed comparison, now with a score row).
- **Scene:** Orbit camera by default at mission end; a numbered marker per turn on the trail, each a 44 px button; the selected turn's footprint or link is drawn.
- **Journal:** each attempt shows stars, score and turn count. `AttemptRecord` gained optional `score`, `stars`, `turns`; records without them still load.

Example from the browser check (First Signal, Aspiring, standard kit): **88 / 100, four stars**: mission progress 45/45, game-budget efficiency 3.3/15, healthy operational time 20/20, operating margins 10/10, team review 10/10.

### 4.5 Turn replay and launch from the ground (R10; `three/playback/`)

- **Trigger.** A commit in this session replays that turn. Loading, resuming and reduced motion show the end state at once.
- **Path.** Keyframes from recorded history inside the turn, plus one before the start and one from current telemetry. Direction is interpolated spherically and radius linearly, so sparse orbit samples (200-600 s apart) still draw a curve.
- **Clock.** Wall time at 1× is `clamp(6 + 3 × min(orbits, 6), 6, 24)` seconds. Beyond three orbits the first and last orbit each take 35 % of the time and everything between is a time-lapse.
- **Transport.** Play/pause, 1× 2× 4× 8×, skip, replay, progress bar, mission time, and at mission end "Replay flight". The speed is remembered in `localStorage` under `astrix.playback.speed`. A status line announces "Replaying turn 3: Transmit" and "Replay finished".
- **What moves.** Marker, tether, hardware position and attitude, body rotation, Sun direction, Moon and the growing trail, all through refs inside the frame callback. In Spacecraft mode the camera follows.
- **Launch.** While the phase is pre-launch or ascent, a schematic launch stack stands on the launch site and carries the spacecraft; it is on the pad before the first turn.
- **Clearance (R6).** `ground = 1 + hullRadius + 0.004`; `floor = shell + hullRadius + 0.06`; displayed radius = `max(true radius, ground + (floor − ground) × smoothstep(0, 100 km, altitude))`. On the pad the hull stands on the surface; in orbit it clears the atmosphere shell; it never intersects the planet. The Moon or Earth shown alongside is cleared the same way, and the camera is kept outside every body.

### 4.6 The Sun as a destination (R11; `packages/core`, `packages/session`)

- **Core.** `BodyId` gains `'SUN'`. `CONSTANTS.SUN` has the solar gravitational parameter, radius 695,700 km and a 25.38-day rotation, sourced from the NSSDCA Sun fact sheet. New trajectory model `HELIOCENTRIC_CONIC` and frame `SUN_J2000EQ`.
- **Sun-centred environment.** Position is Sun-relative; `sunDir` points at the Sun; there is never an eclipse; solar input scales with (1 AU / r)²; there is no ground station position; contact is a Deep Space Network line of sight to Earth that the solar disc can block; link rate and light time follow the spacecraft-Earth range; the radiation dose is an assumed 20 µGy/h and is labelled as an assumption.
- **Generalisation.** The Mars-only checks became one deep-space rule for Mars and Sun-centred flight. No state fields were added, so old saves replay unchanged. `RULES_VERSION` and `FLIGHT_MODEL_VERSION` are unchanged; existing definitions keep their digests.
- **Mission shipped: `SUN_SENTINEL`, "Sun Sentinel: Watch the Side of the Sun That Earth Cannot See".**
  - SmallSat in a near-circular solar orbit at 0.96 AU (eccentricity 0.005), 120° ahead of Earth, as NASA's STEREO-A. Orbit preset `SUN_AHEAD`, ride `RIDE_SOLAR_ORBIT` (cost 300).
  - Budget 700, 30 days, Deep Space Network, no storm, scheduled faults on, seed 20061026.
  - Goal: return 6,000 MB of solar maps. Required part `SS_MAPPER`; no new catalogue parts.
  - Expert adds two radiators because the craft is never in shadow.
  - All 54 combinations of level, kit, ambition and approach certify with a successful reference flight in 3-14 turns.
- **Mission not shipped: `SUN_CLOSE_PASS`.** At 0.3 AU the SmallSat thermal model settles near 498 K against a 360 K survival limit even with four radiators. No existing part can reject that heat, so Expert cannot certify, and shipping it at Aspiring only would hide the physics the mission is about.
- **Behaviour that moved.** `sunDirection('SUN', …)` now throws, because about the Sun the direction depends on the craft's position; `sunDirectionAt(body, positionKm, t, epoch)` replaces it. Three unused legacy scene files still call the old function.
- **Around the core.** `missionOffers('SUN', level)`; Sun tab on the board; mission illustration; science connection with the STEREO + SDO image; GMAT export with a Sun frame; session validation accepts the body. In a Sun-centred scene the planet component draws the Sun unlit, Earth is a labelled marker at its heliocentric position, and waves travel toward it.

### 4.7 Explore to scale (R12, R7, R8; `three/SolarSystemScene.tsx`, `three/solar/`, `ui/play/solar/`)

- **Sizes.** The Sun is drawn with radius 6; every other radius is `6 × diameter / 1,391,400 km` from the NSSDCA diameters: Mercury 0.0210, Venus 0.0522, Earth 0.0550, Moon 0.0150, Mars 0.0293, Jupiter 0.6166, Saturn 0.5198, Uranus 0.2204, Neptune 0.2136.
- **Distances.** Compressed orbit radii 8.5, 10.5, 12.5, 14.5, 19, 24, 28.5, 33; the Moon 0.45 from Earth. The default view frames the Sun through Mars.
- **Finding small bodies.** Invisible pick spheres of radius 0.4, labels, and a locator dot that fades once the globe is larger than a few pixels. A pick sphere yields to a visible globe behind it, so the Moon's sphere cannot steal a click on Earth.
- **Rings.** Body colour mixed 35 % toward white, 0.55 opacity, 1.6 px; selected or hovered 0.95 and 2.6 px; Moon ring 0.5 and 1.2 px. `SceneLine` is now drei's `Line`, which has real screen-space width.
- **Caption.** "Sizes are to scale with the Sun. Distances are compressed. Not an ephemeris." With a body selected: "Earth: 1/109 of the Sun's diameter".
- **Fact panel.** `packages/data/solar-bodies.json` holds mass, diameter, gravity, escape velocity, day length, distance, orbital period, temperature, moons, rings and magnetic field for ten bodies, transcribed from the NSSDCA Planetary Fact Sheet (last updated 13 November 2026) and Sun Fact Sheet (9 May 2024), retrieved 2026-11-15. The panel shows eight fact tiles, three "compared with Earth" bars on a logarithmic scale, flags, "Explored by" links to `science.nasa.gov` (all ten answered HTTP 200), the image note, the scale line and the source with its retrieval date. Sun, Earth, Moon and Mars offer "Missions here". Nothing is fetched at run time.

### 4.8 Explore ship (R13; `three/explore/`)

- **Boarding.** "Board the ship" in Explore; "Leave ship" returns to the orbit camera. While aboard, the welcome card, the caption and the camera buttons are hidden and the fact panel closes.
- **Flight model.** Fixed time step; thrust under a selectable speed limit (six levels); coasting drag and a brake; the velocity swings toward the nose while thrusting.
- **Never inside a body.** Every step stops the ship on a sphere of 1.15 × radius + 0.004 and slows it on approach. A test fires the ship at bodies from 200 seeded starts at up to 1,000 units/s and checks it never ends up inside one.
- **Autopilot.** With a target selected, flies to a stand-off point on the near side and holds.
- **Cameras.** Chase and cockpit; speed-dependent field of view; easing and shake that are removed under reduced motion.
- **Inputs.** Keys (WASD, arrows, Q/E, Space, −/+, P, C, L, R, H, Esc), pointer drag with pointer capture, and an on-screen steering pad with hold buttons on touch screens.
- **HUD.** Target select, distance to the target surface in solar radii and in target radii, speed and limit, nearest body, and the note "Schematic flight: sizes to scale with the Sun, distances compressed, ship enlarged. Mission time does not advance."
- **Ship.** The existing SmallSat model, enlarged; a short-range fill light was added so the side facing the camera is readable.
- **Void Protocol.** Ideas were taken from `docs/gameplay/CONTROLS_AND_PHYSICS.md`; no code was adapted, so no attribution rows were needed.

### 4.9 Density (R4), level toggle (R9), favicon (R5)

- **Shell.** Header 76 → 56 px; resource grid 88 → 60 px in one row per cell; the toolbar row and the footer row are gone. "Hide panels", "Quick tour" and a save chip (Export, Import, GMAT tools) live in the header. Panels start at 64 px, or 132 px when the resource grid shows (was 234 px).
- **Board.** `min(1040px, 62vw)` wide; resume strip, then destination tabs (Sun, Earth, Moon, Mars) and the level toggle in one row; three primary offers as cards with illustration; "More missions" as compact cards.
- **Preparation.** Ambition, kit and approach as three-column option cards; intro paragraph removed; brief margins halved.
- **Turn workspace.** "Last turn" card at the top of the right panel in a polite live region; it collapses to one line when a plan is selected.
- **Level toggle.** A labelled group of two `aria-pressed` buttons with one description line.
- **Favicon.** The "A" mark cropped from the supplied logo on a pale `#dfedfb` tile: `favicon.ico` (16, 32, 48), PNGs at 32, 192, 512, an Apple touch icon and `site.webmanifest`, linked from `index.html` and `404.html`.

## 5. Explore ship drag axes

### 5.1 What Void Protocol does (pinned commit `218625d`)

- In manual flight a drag steers the ship: `yaw = −dx × gain` about ship up and `pitch = dy × gain` about local −Z with +X forward (`packages/shared/src/systems/shipControl.ts`, `shipSteering.ts`). Dragging right turns the nose right; dragging down lowers it ("natural" vertical axis; the document calls the horizontal axis "inverted by default to align with standard flight yoke intuition").
- While the autopilot flies, or in free camera, the same drag orbits the camera and never touches the heading: `offset.y −= dx × 0.005`, `offset.z −= dy × 0.005` (`CameraController.tsx`).
- Sensitivities: 0.003 rad per pixel to steer, 0.005 to orbit.

### 5.2 What changed in ASTRIX11

| | First build | Now |
|---|---|---|
| Default drag | Looks around | Steers the ship |
| Drag on autopilot | Steered and cancelled the autopilot when in steer mode | Only turns the view |
| Look, drag right | View turns left ("grab the sky") | View turns right |
| Look, drag down | View looks up | View looks down |
| Steer, drag right / down | Nose right / nose down | Unchanged |
| Sensitivity | Steer 0.004 rad/px; look tied to field of view | Steer 0.003, look 0.005 rad/px |

Free look is still available with L or the HUD button. Files: `three/explore/cameraMath.ts`, `controls.ts`, `ExploreFlight.tsx`, `ExploreHud.tsx` and their tests; the Explore plan's decision E3 and controls table were updated.

### 5.3 Check

With a real pointer drag in the browser, aboard and facing the Sun: 150 px to the right moved the Sun's label 436 px to the left (the nose turned right); 120 px downward moved it up and off the top of the screen (the nose went down). Unit tests assert both directions for steering and looking, and that the two modes agree.

## 6. Defects found during integration and their fixes

1. **`removeChild` exception (carried over from the previous round, cause now known).** drei's `Html` creates a React root in its own element and re-creates it whenever its target element changes. Without an explicit `portal`, the target is `events.connected`, which is only known after the Canvas connects its events, so labels mounted in the first frame switch target once. The old root's unmount is deferred while React is rendering; the new root clears the shared element first; the deferred unmount then fails with "Failed to execute 'removeChild' on 'Node'". It was reproduced on the Explore → board transition together with the warning "Attempted to synchronously unmount a root while React was already rendering".
   - **Fix:** `three/SceneHtml.tsx` wraps `Html` with a stable `portal` host (`.immersive-scene-labels`) that exists before the Canvas mounts. All eight active label users go through it. The error and the warning did not recur in the later navigation checks.
2. **Night-side ground was black.** A launch at night showed the stack against nothing. The planet shader's night term rose from 0.003 to a dim, cool 0.055 fill; city lights are unchanged.
3. **Fact panel scrolled.** Tiles were one column (982 px of content in 715 px). Tiles now form two columns and spacing is tighter: seven bodies fit; Mars, Saturn and Neptune are 21-40 px over.
4. **Signal drawn through the planet.** Data comes down during a pass that usually ends before the turn does, so a link from the end-of-turn position to the station crossed the Earth. `turnMoments` now reports `passKm`, and the link is drawn from a marked "Pass over the station" point when the turn does not end in contact.
5. **Explore polish.** The board button overlapped the body selector; the welcome card stayed over the scene while flying; the ship was hard to see with the Sun ahead. All three fixed.
6. **Fallback overlapped the caption** when WebGL failed. The caption is now hidden while the fallback shows.
7. **Sun scene caption.** A Sun mission has no flight telemetry block, so the caption fell through to "Destination context, not a flight trajectory". It now shows the distance from the Sun in AU; other missions without that block show altitude.
8. **Phones.** The Explore welcome strip sat on top of the fact sheet; it is hidden while a body is selected at 900 px and below.
9. **Tests.** One presentation test matched the panel's `aria-label` instead of its heading; one persistence test compared mismatched types; one session test read `orbit` without narrowing; two Explore tests compared a narrowed literal. All corrected without weakening an assertion.

## 7. Verification

### 7.1 Automated

| Check | Result |
|---|---|
| `bun run typecheck` | Clean after integration and after the drag change. The closing run reports one error, in `apps/web/src/ui/advanced/playback.test.ts`, a file from separate GMAT-viewer work that was being edited in the working tree during this session (§7.4). |
| `bun test` (whole repository) | Closing run: 580 tests in 69 files, 579 pass, 1 fail (434 tests before this round). The failure is the same GMAT-viewer test. An earlier full run, before that file changed, was 571 pass, 0 fail. |
| `bun run build` | Passes |
| Core and session | 270 pass in the Sun package's own run, plus its corrected session test |
| New pure-module tests | `turnMoments`, `extent`, `committedScene`, `signalPath`, `playbackPath`, `playbackClock`, `frameWindow` (with `format`, `series`, `levels`), `timeline`, `persistence`, `solarBodies`, `SolarBodyPanel`, core `sun`, session `sun`, and four Explore files |

### 7.2 Density, measured in the browser (visible / content height in px)

| Surface | Before, 1920×1080 | After, 1920×940 |
|---|---|---|
| Mission board | 926 / 2132 (2.30 screens) | 862 / 862 (no scroll) |
| Preparation choices | 853 / 1253 (1.47) | 862 / 908 (1.05) |
| Preparation brief | 777 / 822 (1.06) | 786 / 786 (no scroll) |
| Turn choices | 595 / 595 | 661 / 661 |
| Turn preview | 780 / 780 | 794 / 794 |
| Debrief → report result panel | 780 / 1879 (2.41) | 476 / 480 |
| Report detail and timeline | — | 555 / 555 and 174 / 174 |
| Fact panel | — | fits for seven bodies; Mars +32, Saturn +40, Neptune +21 px |

### 7.3 Seen in the browser (development server, headless Chromium, 1920×940)

- Explore: large Sun, inner planets, rings, labels; selecting each of the ten bodies; "Missions here" from the Sun opening the board on the Sun tab with the Sun Sentinel card.
- Board, level toggle, preparation, replace-save dialog.
- Stay in Orbit: launch stack on the pad; launch replay with the transport; "Launch complete" card.
- Reload, then resume from the board: end state shown without replay.
- First Signal: observe (night frame at 49.2°N 66.5°W with the model note), three transmit turns (signal strip, status line, pass-over-the-station link), mission end.
- Report: score, stars, components, chips, selecting a chip, arrow-key movement, the three tabs, turn markers.
- Explore ship: board, thrust, autopilot toward Earth, cockpit toggle, leave, and the drag directions.

On the production build served by the LAN host (`192.168.155.101:3477`):

- `/favicon.ico`, the four PNG icons, `/site.webmanifest` and the new Earth map answer HTTP 200; `/host` and `/join` load.
- Sun Sentinel: prepared and started from the Sun tab; the first observation stored 4,210 MB and showed the Sun frame with its STEREO + SDO caption; the scene caption reads "0.96 AU from the Sun".
- Portuguese on the turn card, the status line and the fact panel, with no raw copy keys on the page.
- 320 px width: no horizontal overflow on the turn workspace, the board and the fact panel.
- Twelve view changes in a row (Explore with a body selected ↔ board ↔ journal, resume, mission ↔ Explore): no page errors and no console warnings, so the `removeChild` exception did not recur.

**Not checked in a browser:** the wave animation in motion (only its static end state); Sun Sentinel beyond its first turn; a Storm Watch reading chart; a Mars transmit; a failed mission's capped score; Portuguese on the report and the Explore ship; 1366×768; reduced motion; a multiplayer controller seeing the "Last turn" card; the browser tab actually showing the icon. Replay frame rate could not be judged: headless software rendering took about 1.1 s per frame in Orbit view, all of it native time outside JavaScript.

### 7.4 Closing run and the one failure

The closing run was made with nothing else using the machine: 579 of 580 tests pass and the production build succeeds.

The one failing test and the one typecheck error are both in `apps/web/src/ui/advanced/playback.test.ts` ("GMAT 3D view state > frames one period of an orbit and picks a speed that plays it in about half a minute": expected speed 600, received 60). That test, `trajectoryStore.ts`, `parser.worker.ts` and a new `apps/web/src/three/gmat/` folder were being changed in the working tree by separate GMAT-viewer work while this session ran. None of them belongs to the packages in §2 and they were left untouched. A run a few minutes earlier, before that file changed, had no failure.

One intermediate full run reported 1 failure and 1 error while the development server and the browser checks were loading the machine; the next run did not reproduce them.

## 8. Known limits

- The ascent only lifts the hardware about 0.07 planet radii on screen, because the clearance floor is close to the pad height. It is continuous and correct, but subtle in Orbit view.
- The true-position marker is drawn through the planet, so it can show when the craft is behind it.
- At mission end the transport panel sits over the lower middle of the scene.
- The board no longer shows each offer's description; it remains in preparation.
- The "Last turn" card stays at the top of the right panel instead of moving below the preview, so screen readers do not lose the live region at a commit.
- Three legacy scene files (`OrbitScene`, `SpaceBackdrop`, `useMissionPose`) would throw for a Sun orbit; the mission screen does not load them.
- Close Pass needs a heat-shield part or a different thermal model before it can ship.
- At 320 px some overlays still overlap: the replay transport sits over the caption in the turn view, and the board button over the body selector in Explore. Nothing overflows sideways.
- The replay's status announcement keeps the language it was spoken in if the language is switched afterwards.

## 9. Where things are

| Area | Path |
|---|---|
| Shared turn data | `apps/web/src/ui/play/turnMoments.ts` |
| Scene feedback, replay | `apps/web/src/three/feedback/`, `apps/web/src/three/playback/` |
| Clearance and hull size | `apps/web/src/three/committedScene.ts`, `three/spacecraft/extent.ts` |
| Stable label host | `apps/web/src/three/SceneHtml.tsx` |
| Turn card, frame | `apps/web/src/ui/play/feedback/` |
| Report, timeline, score | `apps/web/src/ui/play/report/` |
| Explore scale and rings | `apps/web/src/three/SolarSystemScene.tsx`, `three/solar/` |
| Fact data and panel | `packages/data/solar-bodies.json`, `apps/web/src/ui/play/solar/` |
| Explore ship | `apps/web/src/three/explore/` |
| Sun in the engine | `packages/core/src/mission/solarOrbits.ts`, `sim/environment.ts`, `sim/state.ts`, `physics.ts`, `mission/builtins.ts` |
| Shell, board, toggle | `apps/web/src/ui/play/PlayApp.tsx`, `play.css`, `LevelToggle.tsx`, `Preparation.tsx` |
| Icons | `apps/web/public/favicon.ico`, `public/assets/`, `public/site.webmanifest` |
