# Simulator refinement specification and implementation plan

**Status: implemented; verification evidence recorded in [VERIFICATION.md](./VERIFICATION.md#refinement-verification--workflow-profiles-and-immersion). Unverified acceptance cases remain listed there.** **Superseded in part (2026-11-15)** by the [guided immersive redesign](./plans/GUIDED_IMMERSIVE_REDESIGN_PLAN.md) (§10 D1/D5): the top window dock and workspace tabs are replaced by collapse-in-place panels, and camera follow/automatic shots are explicit modes. Current behaviour is in [LAYOUTS.md](./LAYOUTS.md) and [RENDERIZATION.md](./RENDERIZATION.md); references below to the dock, tabs or a camera that never follows are historical. Initial research and source inspection: 2026-11-14. The specification below records intended behavior, not a claim that every acceptance case has passed. The workflow amendment below supersedes the original six-top-level-tab and equipment-kit wording.

Audience: first-time learners starting around **12–13**, secondary/university students, educators and technically experienced users. Technical mode is an engineering-learning simulator, **not flight-qualified operational software**. Age is guidance, not an account field, gate or reason to deny explanations.

## Approved workflow and immersion amendment

The user clarified that **3D kits mean mission scenes**, not just sets of spacecraft parts. Every mission has a complete visual context, reused across four freely inspectable workflow stages:

| Main stage | Internal substeps | Scene and immersion |
|---|---|---|
| Engineering | Mission brief, spacecraft platform, equipment and resource trade-offs | Mission-specific assembly/workbench; installed hardware distinguished from illustrative preview equipment |
| Planning | Orbit, trajectory, communications and operating strategy | Earth or Mars mission environment, route and operational context; schematic cues explicitly labelled |
| Launch | Readiness, configuration review, roles and sign-offs | Mission-specific departure/readiness presentation; any launch sequence is optional, skippable and not a claimed ascent simulation |
| Control | Operations, decisions, telemetry and results | Live mission environment, observable command/resource consequences and retained results context |

These are **navigation stages, not flight-state transitions**. All remain inspectable during flight. Engineering becomes as-flown/read-only after launch; changing a tab never launches, resets, resumes, acknowledges a decision or mutates the spacecraft. Mission/profile choice is part of the brief and remains available through the header.

Immersion starts at mission selection, rather than being postponed to a final cinematic layer. Distinct mission scenes and contextual explanations ship with navigation and camera work; command consequences follow actual core telemetry. Camera movement remains user-directed. Decorative transitions must respect reduced motion and never delay controls or replace truthful loading. Sound remains opt-in. Science abstractions, exaggerated scale and unsupported ascent/trajectory fidelity remain visible.

## Review navigation

- [1. Scope and requirement map](#1-scope-and-requirement-map)
- [2. Current implementation and root constraints](#2-current-implementation-and-root-constraints)
- [3. Product and state decisions](#3-product-and-state-decisions)
- [4. Starting page and truthful loading](#4-starting-page-and-truthful-loading)
- [5. Free navigation and persistent mission header](#5-free-navigation-and-persistent-mission-header)
- [6. Camera interaction and mission-specific 3D kits](#6-camera-interaction-and-mission-specific-3d-kits)
- [7. Window minimization, restoration and resizing](#7-window-minimization-restoration-and-resizing)
- [8. Educative and Technical mission profiles](#8-educative-and-technical-mission-profiles)
- [9. Technical subsystem specification](#9-technical-subsystem-specification)
- [10. Mobile, keyboard and assistive technology](#10-mobile-keyboard-and-assistive-technology)
- [11. Contracts, ownership and clean migration](#11-contracts-ownership-and-clean-migration)
- [12. Execution sequence and integration gates](#12-execution-sequence-and-integration-gates)
- [13. Acceptance and verification matrix](#13-acceptance-and-verification-matrix)
- [14. Risks and review decisions](#14-risks-and-review-decisions)
- [15. Primary research references](#15-primary-research-references)

## 1. Scope and requirement map

| ID | Requested behavior | Proposed complete outcome |
|---|---|---|
| R1 | Drag the world to visualize | Orbit/pan/zoom the camera without changing spacecraft attitude, commands, resources or time; equivalent buttons and keyboard operation |
| R2 | Switch tabs at any time | Independent workspace views, including inspectable preflight/flight/results views, without changing actual mission lifecycle |
| R2a | Launch and status always in the header | One authoritative mission-control strip, visible regardless of selected view or minimized panels |
| R2b | Mission selection changes visualization; each mission has a kit | Scenario-specific scene/spacecraft/context configuration, used consistently for preview, preparation and flight |
| R3 | Technical and Educative missions for a wider audience | Different rule/control profiles, separate from display depth and challenge difficulty; all three existing scenarios support both |
| R4 | Fix collapse, minimize to top tabs, restore position/size, resize | Independent dockable windows with actual minimize controls, retained rectangles, bounded resize and non-drag alternatives |
| R5 | Starting page, explainers and loading entry | Accessible Home → real preparation → simulator flow, with explicit failure/cancel handling and no fabricated loading percentage |
| R6 | Responsive and accessible mobile | Reflow to 320 CSS px, touch/keyboard/screen-reader paths, safe areas, zoom and compact windows without losing operational capability |

This proposal does **not** add the twelve research-only missions, online multiplayer, accounts, real DSN scheduling, imported commercial CAD, a new general-purpose windowing framework or a flight-certification claim. The existing three mission identities, explicit scientific provenance, local shared-screen roles, Lucide styling and static deployment remain.

All behavior below is proposed unless explicitly identified as current or observed. Numeric UI dimensions are design targets. New engineering coefficients are model assumptions until individually sourced and validated; a NASA reference for a phenomenon does not calibrate a fictional spacecraft.

## 2. Current implementation and root constraints

| Evidence | Current behavior | Consequence for the refinement |
|---|---|---|
| [App.tsx](../apps/web/src/App.tsx), `MissionHeader` | Phase navigation renders spans with `aria-current`, not buttons | It must become real view navigation, not merely clickable styling |
| [store/index.ts](../apps/web/src/store/index.ts), `setPhase`, `launch`, `advance` | `phase` governs both mounted screens and actual execution; preflight transitions are adjacent-only and flight locks editing | Free tabs cannot reuse `setPhase` or relax simulation guards |
| `Transport` in App.tsx; [Launch.tsx](../apps/web/src/ui/phases/Launch.tsx) | Transport exists only in Operate; launch action is inside the mission panel | Minimized or changed views can hide critical controls |
| [Goal.tsx](../apps/web/src/ui/phases/Goal.tsx) | Highlighted mission is component-local `selected` | Renderer cannot observe selection until `startScenario` commits it |
| [AppCanvas.tsx](../apps/web/src/three/AppCanvas.tsx), `Scene` | Goal always builds First Light's Engineer Earth preview | Selecting Storm Watch or Red Relay does not select their preview kit |
| AppCanvas.tsx, `SceneFraming` | Camera is imperatively reframed on phase/design/size changes; no camera controls are mounted | Adding OrbitControls alone would compete with framing and repeatedly lose user viewpoint |
| [DraggablePanel.tsx](../apps/web/src/ui/layout/DraggablePanel.tsx) | Icon is inside the drag-handle button; no separate minimize/collapse handler or minimized state | The reported non-working collapse is accepted as the repro. Source shows the missing interaction; no browser repro was rerun |
| [panelLayout.ts](../apps/web/src/ui/layout/panelLayout.ts) | Automatic dimensions and per-phase local positions; no stored user width/height | Restore-size and resize need explicit geometry state, not a CSS-only icon fix |
| [index.css](../apps/web/src/index.css), current [LAYOUTS.md](./LAYOUTS.md) | Body minimum is 340 px, fixed chrome, compact bottom switcher, no safe-area policy | 320 px reflow and the new top dock require a deliberate compact layout |
| [contracts.ts](../packages/core/src/contracts.ts), [catalog.ts](../packages/core/src/catalog.ts) | Difficulty changes tuning; Guided/Technical changes presentation only | New mission profiles must change rules explicitly without hijacking either existing axis |
| [main.tsx](../apps/web/src/main.tsx) | App mounts directly with no entry flow | Home/loading must precede simulator readiness instead of adding a decorative delay |

Existing canonical pages remain descriptions of the current implementation: [ARCHITECTURE](./ARCHITECTURE.md), [RENDERIZATION](./RENDERIZATION.md), [LAYOUTS](./LAYOUTS.md), [MISSIONS](./MISSIONS.md), [RESOURCES](./RESOURCES.md), [SIMULATION](./SIMULATION.md) and [SCIENCE_UX](./SCIENCE_UX.md). Update them only as corresponding behavior actually lands.

## 3. Product and state decisions

### 3.1 Keep five independent concepts

| Concept | Proposed owner | Meaning and allowed change |
|---|---|---|
| Application screen | App shell | Home, Loading or Simulator; not a flight phase |
| Selected workspace view | UI store | Mission, Spacecraft, Design, Trajectory, Operations or Results; freely selectable |
| Actual mission lifecycle | Core/session orchestration | Setup, cruise, capture pending, operating or terminal; changed only by explicit commands/transitions |
| Mission profile | Immutable run configuration | Educative or Technical; changes rules, controls and modeled subsystems |
| Presentation/difficulty | Preferences/run configuration respectively | Guided/Detailed changes explanation depth; Cadet/Engineer/Flight Director changes challenge within a profile |

Rename the visible **Technical details** presentation to **Detailed view**, and its internal value to `DETAILED`, so Technical unambiguously identifies a mission rule profile. A Technical mission can use Guided explanations; an Educative mission can expose precise numbers. Language, assistance and accessibility are not proficiency tests.

### 3.2 Non-negotiable invariants

1. Switching view tabs, moving/resizing/minimizing windows or moving the camera never launches, resets, acknowledges an event, issues a spacecraft command or consumes random state.
2. A live flight uses a frozen design/profile/rules-version snapshot. Looking at Design in flight does not make the spacecraft editable.
3. Launch validation is one core authority; the header cannot bypass roles, readiness, profile constraints or sign-offs.
4. Closing help, loading completion, returning from Home, restoring a panel and changing tabs never automatically resume a paused flight.
5. Selecting another mission can preview its kit, but discarding a live or edited run requires an explicit confirmation. One active flight is maintained; this is not an implicit multi-mission save system.
6. A single Canvas/renderer serves the simulator and every mission kit. Miniatures reuse render targets; no extra WebGL contexts per card, page or profile.
7. Visible and assistive status identifies Preview versus live flight, actual lifecycle and pause reason, independently of the selected view.
8. Educational abstraction is labelled. Camera modes change the view only; explicit Pilot mode sends actor-checked attitude commands. An overlay is not a measurement and assisted recovery is not professional success. The approved [guided immersive redesign](./plans/GUIDED_IMMERSIVE_REDESIGN_PLAN.md), Line B, supersedes the older dock, setup, fixed-pointing and no-follow recommendations below.

### 3.3 Mission/profile switching policy

- Home selection chooses mission and profile before entry. Within Simulator, a persistent Mission selector is always available.
- Opening the mission/profile chooser during a live flight pauses it and records the reason. Selecting a candidate updates `previewMissionId` and the preview kit immediately, with a visible **Preview — active flight paused** label; live telemetry remains bound to the active mission and is not overlaid onto the candidate.
- **Cancel:** restore the active kit/camera/view and unchanged run; remain paused with explicit Resume.
- **Start selected mission/profile:** confirm loss of the current unsaved flight/design where applicable; prepare the candidate, then atomically create its setup session. Keep the old session until preparation succeeds, so a failed import does not destroy it.
- Preflight profile change can retain hardware only through an explicit compare/revalidate confirmation; otherwise offer the chosen profile's charged starter. Never silently remove parts, grant fuel or erase an over-limit design to make a profile fit.
- A profile switch after launch creates a new attempt; it cannot rewrite the current run's constraints or score namespace.
- Browser reload still does not restore flights. Returning to Home within the same mounted app can preserve the in-memory paused run, with a truthful **Return to paused mission** action.

## 4. Starting page and truthful loading

### 4.1 Home content

Home must work without creating a WebGL context. Use designed static SVG/Lucide illustrations, not hidden live canvases to generate its cards.

Required content:

- What ASTRIX teaches: connected decisions about a spacecraft, its trajectory, operations and science return.
- A short build → launch → operate → understand explainer, with a concrete camera/radio/power example.
- Three distinct mission cards, each with goal, major trade-off, difficulty/context and mission-specific illustration.
- Educative/Technical comparison with honest fidelity limitations; suggest Educative for a first visit without age-gating anyone.
- Local solo/shared-screen play explanation; keyboard/touch camera controls and Explain behavior.
- Prominent language, reduced-motion, sound-off and accessibility/controls access before entering.
- Scientific evidence versus game assumptions; direct source/credits links and no NASA endorsement claim.
- Primary Enter Simulator; Return to paused mission only if one actually exists in memory. Home does not claim a previous flight was saved across reload.

No compulsory tutorial, quiz, account, age collection, artificial countdown or minimum reading time. Returning users can enter directly.

### 4.2 Preparation state machine

States: `IDLE → PREPARING → READY`, or `PREPARING → FAILED/CANCELED`. Individual readiness signals:

1. Simulator code/module available.
2. Selected mission kit/configuration available and validated.
3. Existing/new renderer context created successfully.
4. Required scene committed and first render completed; DOM controls mounted and named.

Optional fonts/thumbnails must not keep entry blocked indefinitely. Use system fonts until local fonts resolve; label a fallback honestly. Procedural kits currently do not require downloading planet models or NASA telemetry.

Display the current actual stage and an indeterminate native `<progress>` when work has no measurable total. If showing **2 of 4 preparation stages**, label it as completed stages, not download percentage. Do not use timers to animate 0–100% or a Drei loader whose empty asset count is falsely treated as complete initialization [S4, S5].

`onCreated` alone is not scene readiness. An acknowledged committed draw plus control readiness completes entry. Cached entry can complete immediately; there is no fake minimum loading duration.

### 4.3 Lifetime, failure and cancellation

- Lazy-load simulator code from the light Home shell; Home must not import the heavy renderer through a barrel that defeats splitting.
- Mount the simulator renderer once during preparation and keep it mounted when replacing the loading overlay. Do not mount a second Canvas as a loading preview.
- Use an attempt/session token for asynchronous completion. A canceled or superseded load cannot commit a late mission/kit or steal focus.
- Loading has Cancel, visible status, `aria-busy`, an established polite status region and a keyboard-reachable error action. Move focus to the simulator's named heading when entry is genuinely ready.
- A context/scene failure yields a real error state, not a simulator-ready badge. Preserve the previous paused session when switching fails. Retry only operations that can really be retried; a cached rejected module or unrecoverable context offers explicit Reload/Return Home rather than an endless fake retry animation.
- Ordinary mission-kit switches reuse the existing Canvas and cached modules; use a local preparation overlay only when actual asynchronous work remains.
- The initial HTML must contain a minimal loading/JavaScript-required message so a slow or failed entry bundle does not present an empty black page.

## 5. Free navigation and persistent mission header

### 5.1 View tabs

Keep six recognizable tabs: **Mission, Spacecraft, Design, Trajectory, Operations, Results**. They are available before launch, during flight, while decision-paused and after completion. Selecting one changes `activeView` only.

| Actual state | Tab behavior |
|---|---|
| Setup | Mission/Spacecraft/Design/Trajectory editable through normal quotes; Operations explains launch prerequisites; Results says no run exists |
| Cruise/capture pending | Every view inspectable; flight hardware read-only; Operations exposes arrival workflow; Results is explicitly provisional |
| Operating | Every view inspectable, same live flight continues unless already paused; no view transition itself pauses or resumes |
| Decision pending | Tabs still accessible; header keeps the unresolved decision visible; commands follow its normal validity rules; explicit resolution still required |
| Completed/failed | Every view inspectable; final results remain final. Redesign/New Attempt is an explicit reset, not a side effect of viewing Design |

A read-only message must explain why and offer **Start a redesign** as an explicit new-attempt action; it must not disable the entire tab. Operations-before-launch is a useful explanation, not a fabricated flight. Results-before-completion never records a best score or marks the mission complete.

Use APG tabs with one selected tab, roving tab index, labelled panel associations, Left/Right wrapping, Home/End and Enter/Space activation [S6]. Recommend manual activation initially; automatic activation is acceptable only after view changes have no noticeable latency. Hidden views must not remain keyboard-focusable. Preserve each view's scroll/form proposal state in a UI-owned draft rather than relying on unmount/remount side effects.

Activating a view restores/raises the Mission window if minimized, selects that view and leaves focus on the selected tab. Tab focus alone does not restore windows or trigger actions before activation. Panel minimization does not erase selected tab identity.

### 5.2 Persistent header composition

Order:

1. Mission identity and profile, with Mission/Profile chooser.
2. **Actual status:** setup/readiness, cruise, capture pending, running, paused with reason, completed or failed.
3. Primary operational action.
4. Compact battery, mission progress, contact and queued-command status where a flight exists.
5. Workspace tabs and the top window dock.

The primary action is state-derived: **Review launch / Launch**, **Advance cruise**, **Confirm capture**, **Resume/Pause**, **Resolve decision**, or **New attempt**. Only the applicable action is primary; unrelated lifecycle actions are not simultaneously enabled. A setup Launch action from any tab opens a review/confirmation anchored to the current revision and reruns readiness at confirmation.

Move the final launch authority out of the scrollable Launch screen; that screen retains ride, orbit, fuel and sign-off configuration. Remove duplicate primary launch/transport controls and route all entry points through shared commands. Header status must not be derived from `activeView` or inferred from a panel's visibility.

Readiness summarizes independent mass, room, energy, thermal/link/fuel checks rather than a misleading universal green badge. Unknown/uncomputed results say Not estimated. In flight, statuses come from actual state, not preflight budgets. Text and icons accompany color.

### 5.3 Pause and attention policy

Store explicit pause reasons: manual, decision, explanation, handoff, settings, hidden document, mission/profile chooser and graphics failure. They may coexist; closing one surface cannot clear a different reason. Resume is refused while an unresolved blocking reason remains. No new mode disables pause for technical users.

A new critical decision updates a persistent header banner and dock badge. Do not repeatedly steal keyboard focus or force a different view while someone is typing/reading. **Open decision** explicitly restores/raises the relevant window and focuses its heading. In both profiles simulation stops at the event boundary, so hidden panels cannot cause a player to miss an operational decision.

## 6. Camera interaction and mission-specific 3D kits

### 6.1 Camera control contract

Use the installed Drei `OrbitControls` on the existing camera/Canvas, not an independent render loop or a world-object transform [S1–S3].

- Desktop: left drag orbits, wheel/pinch-trackpad zooms, right drag pans; constrain distance/target so the subject cannot be lost inside the planet or outside a useful view.
- Provide visible Rotate left/right/up/down, Pan directions, Zoom in/out, Fit mission and Reset view controls in DOM. They support keyboard and single-pointer activation without dragging [S7].
- No global arrow-key listener: camera shortcuts apply only while the named camera control surface/toolbar has focus. They cannot steal typing, tab navigation, panel movement or flight shortcuts.
- Bind pointer listeners to the exposed Canvas, not `document` or the entire studio. Panel bodies, drag/resize/minimize controls, header and modal gestures never leak into the camera.
- Retain the one renderer and adaptive rendering budget. Reduced motion disables inertia, turntable and automatic cinematic motion. Explicit camera modes may follow the spacecraft; camera elapsed time is wall-clock, never simulation warp.
- A camera gesture does not pause/resume the simulation by itself, create commands or modify scientific `positionKm`, `mode`, energy, random state or score.
- Touch: expose an explicit **Explore 3D / Done** interaction toggle. Outside exploration, ordinary page gestures remain native. In exploration, one finger rotates and two fingers zoom/pan on the Canvas only; equivalent buttons remain available. Show instructions before capture, and never set page-wide `touch-action:none` [S8].

### 6.2 Stop framing from fighting the user

Replace the current effect tied to the entire `design` object with a camera controller that separates **initial fit**, **viewport projection** and **user pose**.

- Scene identity key: mission kit + semantic scene kind + session generation. Save pose/target per kit/scene kind in UI memory at interaction end, not in simulation state every frame.
- Fit a new scene identity once or on explicit Fit/Reset. A part quantity change, telemetry publication, window resize or tab revisit must not silently reset orientation.
- Header/panel/viewport reflow updates the usable framing rectangle/projection, not user orbit angles. Clamp only genuinely invalid zoom/target limits after bounds change.
- Chase, Inspect, Map, Workbench and Cinematic are explicit presentation modes. HUD measurements determine the optical clear band. Follow never changes the spacecraft state, and normal camera dragging does not issue attitude commands; Pilot is a separate explicit interaction mode.
- Save/restore camera pose for canceled mission previews. Controls and framing must share the same target and update protocol; do not leave `camera.lookAt()` and OrbitControls competing.
- Keep the one-Canvas, preview render-target and required `getClearColor(new Color())` invariant.

### 6.3 Mission kit registry

Create one typed registry keyed by the existing `ScenarioId`. It binds scene factory/configuration, central body, spacecraft visual family, distinctive hardware overlays, camera bounds/defaults, legend/text description and readiness/preload tasks. Registry entries reference shared components; do not duplicate the renderer for each mission or couple scene selection to `busId` alone.

| Kit | Distinctive visualization | Honest boundary |
|---|---|---|
| First Light | Earth imaging CubeSat, visible camera, observation footprint/target cue, station and downlink path | A schematic footprint is labelled illustrative unless a real footprint/resolution calculation is implemented |
| Storm Watch | Radiation-monitor CubeSat, Sun/Earth context, measured dose timeline linkage and instrument/safe-mode state | Do not draw invented calibrated 3D radiation belts from a single ISS dose record; any radiation halo is illustrative |
| Red Relay | Mars mapping SmallSat, mapper/dish/tank, transfer and capture views, queue/contact context | Transfer and exaggerated spacecraft scale remain labelled; no claim of real November launch ephemerides |

A kit's **identity preview** may show its mission-relevant instrument as a ghosted/labelled “mission equipment” item. The live/as-built model shows only installed equipment. Selecting a mission must not quietly grant a camera, monitor or mapper to the paid starter.

Mission chooser selection updates the kit immediately even before Start. Active view chooses a semantic scene within that kit: assembly for Spacecraft/Design, trajectory for Trajectory, live orbit/transfer for Operations, and retained mission context for Results. Mission view uses the highlighted candidate only when explicitly previewing; otherwise use the active kit. Same mission with two profiles shares geometry assets but can add technical diagnostics/legends.

Rapid A → B → C selection must finish on C. Dispose abandoned kit-specific resources/listeners, retain shared cached geometry/materials, and reject stale readiness callbacks. Home, miniatures and profile controls must not create additional WebGL contexts.

## 7. Collapse-in-place panels and resizing

### 7.1 Window model

The approved Line B shell uses four stable IDs: `mission` (Workshop), `readiness` (Details), `review` and `log`. They are separate from the seven core stages.

Each stores visibility (`EXPANDED`/`COLLAPSED`), preferred rectangle, front order, focus memory and per-view scroll. Compact height/full-height intent remains independent. This UI-only model never mutates mission state.

### 7.2 Collapse and expand

- A draggable header and separate chevron remain at each panel's own position. Chevron, header double-click and focused-header Enter/Space toggle collapse with `aria-expanded`/`aria-controls`.
- Collapse hides only the body, preserves preferred expanded geometry and anchors focus to the header. Moving a collapsed pill changes X/Y, not its saved width/height.
- There is no PanelDock or window navigation strip. Review/decision/log counts live on panel headers.
- Expand re-clamps the full rectangle, raises it and selects its compact sheet. `showWindow` reveals and focuses/scrolls a registered target after commit.
- Workshop alone starts expanded; other panels are pills outside the default central scene band. Actual decisions render in a centred flight overlay independently of panel visibility.
- Modal close restores a visible opener or header/main fallback, never a deleted dock.

### 7.3 Resize and movement

Desktop supports visible edge/corner resize handles; width/height are explicit, with a scrolling body rather than `maxHeight` pretending to be a saved size. Track the active pointer ID and use pointer capture. On pointer-up commit the rectangle; on Escape/pointercancel revert the current uncommitted gesture; always release capture on cancellation/loss.

Desktop minimums: Workshop 320×240 CSS px; Details 260×180; Review/Log 260×160. Minima shrink to available bounds. Maximum size excludes measured HUD/safe areas. Top/left resizing adjusts position; no control may be restored offscreen.

**Window options** supplies single-click directional movement and size increase/decrease, plus labelled numeric X/Y/width/height inputs for exact adjustments. This makes arbitrary geometry available without dragging; keyboard arrows alone are insufficient for WCAG 2.5.7 [S7]. Retain 10 px arrow movement and Shift 40 px on a focused handle; explicit width/height controls provide equivalent keyboard resizing. Free two-axis corners are not mislabelled as one-axis ARIA splitters.

A requested rectangle and an effective clamped rectangle are distinct. Temporary small-viewport clamping must not destroy the user's larger desktop size. On return to the prior layout class, restore the preferred rectangle and clamp only if still necessary. Reset layout restores defaults/minimization/front order only; it must not reset camera, design, run, commands or score. Provide a separate Reset camera.

### 7.4 Usable bounds and compact windows

A shared service measures visual viewport, HUD zones and safe areas. Desktop excludes top/flight chrome; compact also excludes resource and CAPCOM strips. Recompute after reflow, zoom, viewport/ResizeObserver changes and virtual-keyboard changes. MissionCamera uses these HUD zones for its clear band, not header-plus-dock.

- Wide layout: independently floating/resizable windows; opaque backgrounds remain.
- Compact: one adjustable bottom sheet, with other panels retained as their own header pills. Compact exclusivity preserves independent visibility and desktop geometry.
- Sheet height has drag, tap, keyboard and numeric controls plus full-height/restore-size actions.
- Short/zoomed viewports use Reading layout: same HUD order, same mounted scene, document-flow tools and collapse controls, without floating drag geometry.

“Restore last position and size” means exact geometry when it fits, otherwise a truthful clamped/adapted representation; never place a restored control offscreen to satisfy a literal stale coordinate.

## 8. Educative and Technical mission profiles

### 8.1 Two rule profiles, not age labels

| Dimension | Educative | Technical |
|---|---|---|
| Primary experience | Safe experimentation, clear goals, short decisions and visible consequences | Engineering trade-offs, constrained operations, fault diagnosis and evidence-based review |
| Default pacing | Self-paced decision advances; optional real-time playback | Continuous accelerated operation, always pausable; event-boundary stops retained |
| Display default | Guided, with precise details available | Detailed, with Guided explanations always available |
| Scientific base | Existing orbit/power/storage/light-time principles, simplified control choices | Same orbital base plus the bounded subsystem models below |
| Constraints | Physical class/geometry and conservation remain valid; curated simpler parts/options and explicitly generous resource allowance | Hard mission-specific EOL power, reserve, payload, thermal/link and capture-envelope requirements, in addition to mass/cost/roles |
| Hazards | Named, explainable teaching events; no unannounced irreversible random loss in default practice | Seeded, observable operational faults with diagnostic state, costly recovery and retained first-failure facts |
| Assistance | Explicit before/after action previews and practice retry at a named checkpoint | Tools/forecasts and explanations, but no automatic repair or checkpoint rewind counted as the same scored attempt |
| Objectives/report | Science progress plus choice → consequence recap; practice retries clearly marked | Science, margins, fault handling and assumptions, with profile/rules identity on results |
| Scores | Practice-oriented, assisted attempts labelled | Separate profile/difficulty/rules-version bests; no false cross-profile ranking |

No “professional” certification badge. Professionals can use Technical for transparent conceptual exercises; real mission design requires validated tools, hardware data and independent review outside this application.

### 8.2 Educative operating specification

- Continue/Advance to next event processes real simulated intervals and all intermediate resource/command/event boundaries. It is not a direct timestamp assignment that skips a hazard, fuel burn or Mars command delay.
- Real-time playback remains available. The default stops after each meaningful decision/teaching outcome and uses optional hints, never a timed comprehension test.
- Simplified composite actions such as Observe or Send science are explicit previews of ordinary role-checked commands. The UI explains required pointing, power, contact and, for Mars, pending delivery. It must not teleport data or automatically grant another player's permissions.
- Keep up to three in-memory named practice checkpoints (launch, arrival if relevant, latest decision). Retry restores design/run/random/queue/history coherently, clears subsequent receipts and marks the attempt as assisted. It is not a persisted save, arbitrary timeline editor or unlimited copied flight archive.
- Curated budget generosity is profile data, not hidden free parts. Mass limits and propellant conservation remain honest; unavailable actions explain how to make a valid design.
- A failed practice attempt offers retry/reproject with a short causal explanation. Detailed values, sources and assumptions are never locked away.

### 8.3 Technical operating specification

All three existing missions get a Technical variant, not just a harder Red Relay. Core rules include the mechanisms in §9, with mission-appropriate parameters/incident emphasis. Controls expose real modeled choices; a new warning with no observable state or useful response does not count as a simulated issue.

- Require the mission payload and sufficient baseline/EOL energy, eclipse reserve, viable data/recording capacity, legal communications and applicable capture margin before normal technical launch. Every refusal shows quantities and sources/assumptions. No generic “expert mode” bypass.
- Enforce the same technical constraints in solo and team play; solo must not evade critical requirements through automatic sign-offs.
- Support instrument duty control, normal/robust link mode, heater control, pointing reacquisition and onboard recovery. Ship role ownership, clear costs and Explain bindings with each control.
- Keep pause and Explain free. More controls must not imply faster time pressure or hide guidance.
- Tightening a budget alone is not this profile. Balance a supported, reproducibly viable hardware/control recipe for every mission/profile/difficulty combination; account for new engineering equipment rather than charging impossible extras against an unchanged exactly-full starter budget.
- Snapshot profile/rules version at run creation. Restart confirmation is required to change either after launch.

## 9. Technical subsystem specification

NASA chapters substantiate these engineering phenomena [S12–S16]; the following are proposed **reduced models**, not sourced spacecraft specifications or measured probabilities. Choose this bounded set instead of promising full thermal networks, six-degree-of-freedom attitude dynamics or a flight RF solver.

### T1 — Thermal state and heater trade-off

Add one equipment-bus temperature in kelvin, operating/survival ranges, thermal capacity in J/K, absorbed solar/body heat terms, internal electrical heat and radiative rejection. Conceptual balance:

`Cth × dT/dt = absorbed external heat + dissipated load + heater − radiative heat rejection`.

Area/view factors convert W/m² flux to W; never add flux directly to a power. Document omitted albedo/planetshine explicitly if not modeled; no atmospheric cooling in vacuum. Include heater hardware mass/volume/cost/rated W in quotes and power accounting. SmallSat/CubeSat use distinct authored bus parameter sets.

- Observable: temperature, safe range, heater demand, heat sources and a short trend.
- Control: Spacecraft `HEATER` mode Off/On/Automatic with documented thermostat hysteresis; safe-mode load shedding is separate.
- Behavior: sustained out-of-operating-range temperature inhibits the affected payload; surviving a warm/cold interval depends on actual heat/energy state. Threshold crossing emits a non-spamming event. Survival-range violation with a defined dwell produces a recorded failure, not instant arbitrary loss.
- Validation: dimensional consistency, fixed-input equilibrium, eclipse cooling/heater recovery, energy debit, threshold/dwell behavior and step-size sensitivity. Publish the lumped-model limitation beside its graph.

### T2 — Beginning/end-of-life power and battery margin

Replace Technical's abrupt generic aging story with a declared bounded degradation envelope over the exercise duration: monotonic array-output and battery-capacity factors with explicit beginning/end values. The short-mission acceleration is an authored teaching scenario, **not a claim that real arrays lose that capacity in 14 days**.

- Preflight shows BOL/EOL generation and eclipse reserve using the same coefficients applied in flight.
- In flight expose current array factor, nominal/current capacity and usable charge. Capacity loss cannot create energy; clamp excess charge with a visible degradation explanation.
- Player responses are larger arrays/battery before launch and actual duty/pointing/heater/link changes in flight. No repair command restores chemical battery health.
- Validation: no increasing degradation factors, no negative capacity, no duplicate aging loss, and a design that barely passes BOL but fails EOL is refused in Technical with the actual shortfall.

### T3 — Finite slew and degraded pointing

Replace Technical's instantaneous attitude switch with desired mode, current acquisition state and bounded settle/reacquisition time. Use a reduced pointing-quality factor, not invented angular-momentum physics.

- Observable: requested/current pointing, acquiring/settled/degraded state, time to settle and effect on payload/directional link.
- Controls: ordinary POINT requests plus Spacecraft `REACQUIRE_POINTING`. Reacquisition consumes declared power/time, suspends relevant observing and returns defined coarse capability after an actuator/sensor fault; it does not magically repair hardware.
- A seeded degraded-pointing incident has a stated cause class and recoverable/fallback behavior. In Mars missions the command still travels before recovery begins.
- Validation: no science/full directional-link throughput while required pointing is unsettled; repeated requests do not reset progress for free; commands received during faults obey the same state machine.
- Do not call this reaction-wheel saturation/desaturation unless torque, momentum capacity and unloading hardware/costs are actually added. In particular, Earth magnetic-torquer recovery cannot be assumed to work at Mars [S14].

### T4 — Contact, allocation and reduced link resilience

Separate geometric line of sight, assigned station availability and effective data-link state. Retain truthful assumed schedules; no live network API.

- Observable: the three conditions separately, next opportunity, normal/robust rate and the dominant reason transfer is unavailable.
- Control: Ground/Comms `LINK_MODE` Normal/Robust. Robust mode trades throughput for the explicitly modeled degraded-link tolerance; power and pointing effects are accounted for. It cannot transmit through an occulting planet or an unavailable station.
- Use an explicit reduced link-quality envelope/threshold, not an unvalidated dB “margin” label. Only present dB after a dimensionally complete link-budget model and its assumptions are implemented.
- Technical uplink requests gain `WAITING_CONTACT → IN_TRANSIT → DELIVERED/REFUSED/EXPIRED` states. Start propagation delay when a valid uplink window actually transmits the request; validate reception separately. An authored omnidirectional command receiver is distinct from high-rate Earth-pointed downlink.
- Give every command an explicit simulated-time expiry/validity window. A reset/brownout cannot silently execute an old operational request later. Preserve issue, transmission, arrival and final-result timestamps.
- Educative may retain the clearly labelled simpler light-time-only uplink model; its status must not claim the extra Technical contact scheduling.
- No separate telemetry-return-delay solver is promised here: local readouts remain idealized onboard state and must be labelled accordingly. Data sent at the spacecraft is not silently described as a light-time-delayed Earth acknowledgement.

### T5 — Onboard reset and recoverable faults

Add an authored, seeded computer-reset incident with explicit fault time, reboot/cooldown state and boot power requirements. It models a response class inspired by spacecraft fault management, not an inferred SEU probability from ISS absorbed dose [S16].

- Reset forces safe loads, stops payload/transmission and retains recorded science. It does not refill battery, repair lost instruments or erase the first failure.
- Model an independent low-rate recovery command path; ordinary payload/pointing requests received while rebooting are refused with `COMPUTER_REBOOTING`, while a permitted `RECOVER_COMPUTER` can request recovery when power and cooldown permit.
- In-transit requests retain their arrival times and are revalidated at receipt. Locally waiting contact requests retain issue/expiry but cannot transmit while their modeled ground/uplink conditions are invalid. No silent queue clearing or automatic replay of operational On commands after recovery.
- Recovery finishes in SAFE with instruments/send Off. A deliberate operational restart is required; every recovery message links its actual time/energy cost.
- Validation: fault at exact command arrival, insufficient power, expired request, repeated reset/recovery, safe-mode interactions and retained scientific/failure records.

### T6 — Capture reserve under a disclosed uncertainty envelope

Technical Red Relay adds a declared bounded capture-demand envelope around nominal Δv. Display nominal, upper planning requirement, loaded capability and reserve. Plan against the upper requirement through the same tank/mass/cost rules.

A seeded realization, sampled once per run and retained, determines the effective required burn within that envelope at confirmation. Consume its computed propellant; insufficient capability fails with the realized and planned quantities recorded. A successful result uses the nominal teaching orbit and explicitly states that **uncertainty is applied to burn demand, not propagated into a solved actual orbit**. This is preferable to fabricating precise orbital dispersions or probabilities. A true off-nominal orbit/navigation solver is out of this proposal.

### 9.1 Parameter and incident authoring contract

Before a subsystem is accepted as implemented, its checked-in definition must contain:

- Numeric value, units, allowed range, source ID or explicit authored-assumption note, and the mission/profile/rules version to which it applies.
- Relevant hardware mass, volume, energy, cost and environmental limits; no zero-cost invisible heater/controller.
- Event preconditions, seeded scheduling/realization, observable telemetry, commands, role ownership, pause/rearm policy, failure/recovery behavior and bilingual Explain content.
- An independently reasoned reference case or analytic bound, plus sensitivity to the assumed coefficient. Existing GMAT validation does not validate thermal, link or fault parameters.

This research does not claim calibrated coefficients. Implementation includes a parameter-authoring/validation deliverable, not arbitrary constants disguised as research. No newly invented manufacturer data or numerical failure-rate assertion is approved by this document.

### 9.2 Scenario emphasis and teaching continuity

| Mission | Educative focus | Technical focus |
|---|---|---|
| First Light | Camera → storage → radio → pointing/energy chain | Finite slew/degraded pointing, contact/link choice and BOL/EOL/thermal operating margins |
| Storm Watch | Observe versus protect, actual measured-profile context, safe retry | Monitor duty/retention under power/thermal constraints, recoverable onboard reset, command/restore sequence and transparent hazard assumptions |
| Red Relay | Wide versus close capture, weaker sunlight and visible delayed requests | Capture uncertainty reserve, thermal/EOL power, contact-gated delayed commands, link choice and fault recovery at distance |

Each Technical scenario must exercise at least one authored incident with a meaningful observable/countermeasure, not merely show dormant technical gauges. Avoid scheduling every fault simultaneously. Publish incident assumptions and retain seeded reproducibility; practice retries do not secretly reroll a harder/easier fault.

### 9.3 Time, numerical and score integrity

Preserve the explicit clock/RNG model. Camera/view/layout activity cannot affect random draws. The current implementation guarantees repeatability for the same stepping schedule, not arbitrary time partitions; new subsystems must not make stronger undocumented promises.

For this refinement, both real-time and Advance-to-event must use a common absolute simulation-step schedule and event boundaries. Store sub-tick remainder instead of consuming a new hazard draw per RAF fragment. Sample stochastic incident budgets/times once per defined process/event, not once per display frame. Compare warp/advance schedules for the same timed commands and require matching events/receipts/objectives within declared numerical tolerances.

Select thermal/internal integration substeps from stability/convergence evidence; do not blindly apply the existing 10-second maximum to a stiff new model. Keep bounded work per browser frame, carry remaining work transparently and yield without skipping a decision. Avoid allocating histories, forecasts or material resources on every frame.

Include `missionProfile`, `rulesVersion`, scenario, difficulty, seed and assisted/practice status in report/reproducibility identity. Best-score storage is namespaced by those rules/profile dimensions; existing scores are not reclassified as Technical achievements. Retain first failure and intervention costs. A terminal Technical failure after previously meeting the science target is still failure; show achieved science separately rather than reusing the current objective-only headline as proof of total success.

## 10. Mobile, keyboard and assistive technology

### 10.1 Responsive composition

Use usable-space measurements, not device names. Keep the existing 900 px breakpoint as an initial wide/compact boundary, but validate content and zoom rather than assuming a phone width implies an age/profile.

- Remove the 340 px body minimum. Ordinary Home, loading, header, dock, forms and prose reflow at 320 CSS px; larger technical tables scroll inside their own labelled region, not the whole page [S9].
- Use `dvh` and `visualViewport` where available, with layout-viewport fallback. Apply safe-area insets to header/dock, camera controls, sheet and dialogs; do not disable browser zoom.
- Wide: 48-pixel TopBar, left resource grid, right CAPCOM and scene-first floating tools, only Workshop expanded by default.
- Compact: seven badges in a four/three strip, one-line CAPCOM, retained panel pills and one adjustable sheet. The primary action remains visible.
- Reading: normal document flow and readable controls; the scene remains mounted/reachable. No full-scene guarantee in a 320×256 viewport replaces reflow.
- Desktop and compact geometry preferences are separate; orientation/keyboard changes do not erase the desktop rectangle. No feature or Technical control is desktop-only; use stacking, disclosures and scrollable content.
- All entry/header/dock/camera/window/decision actions target 44×44 CSS px where practicable. WCAG 2.2 AA's minimum is 24×24 or its defined exceptions, not 44×44 [S10].

### 10.2 Input and focus contracts

- Mouse, pen and touch drag/resize use pointer capture and explicit cancellation. Inputs/scrollbars/buttons do not initiate dragging. Avoid document-level `preventDefault` that blocks native page interaction.
- Provide non-drag pointer controls for camera, panel movement and resizing, plus keyboard equivalents. Tooltips alone do not name controls.
- Use native controls first; phase tabs follow APG, window dock uses ordinary buttons, independent floating windows are named regions rather than falsely modal dialogs.
- A modal makes all unrelated app regions inert, including header/camera/dock; Escape restores focus to a visible opener/fallback. Do not nest interactive controls in the drag handle.
- Bring a focused floating window above overlapping siblings without stealing its focus. Programmatic focus/Show me restores a minimized/compact-hidden target's window before focusing it.
- Respect reduced motion on Home, loading, camera fit and UI transitions; no decorative forced camera spinning or flashing fault effects. Keep motion controls separate from orbital science progression.
- Preserve text descriptions/DOM quantities for the scene. Every issue has text and an accessible evidence path, not just a colored halo or sound.
- Announce loading stages, mission readiness, decision availability, minimize/restore and errors through scoped live regions. Do not announce every frame, resize pixel or telemetry update. Detailed telemetry is read on request.
- Focus must remain visible; aim for full visibility above chrome. WCAG 2.4.11 AA requires not entirely obscured, a weaker minimum than this design target [S11].

## 11. Contracts, ownership and clean migration

### 11.1 Proposed contract outline

These are planned interfaces, not new exports currently present:

```ts
type AppScreen = 'HOME' | 'LOADING' | 'SIMULATOR';
type MissionProfileId = 'EDUCATIVE' | 'TECHNICAL';
type Presentation = 'GUIDED' | 'DETAILED';
type ViewTab = 'MISSION' | 'SPACECRAFT' | 'DESIGN' |
  'TRAJECTORY' | 'OPERATIONS' | 'RESULTS';
type MissionLifecycle = 'SETUP' | 'CRUISE' | 'CAPTURE_PENDING' |
  'OPERATING' | 'COMPLETED' | 'FAILED';
interface MissionRunConfig {
  scenarioId: ScenarioId;
  profileId: MissionProfileId;
  difficulty: DifficultyId;
  seed: number;
  rulesVersion: number;
}
interface WindowRect { x: number; y: number; width: number; height: number }
interface WindowState {
  visibility: 'OPEN' | 'MINIMIZED';
  preferredRect: WindowRect;
  effectiveRect: WindowRect;
  zOrder: number;
}
```

Core owns run configuration, actual lifecycle, profile validation, subsystem state and transitions. UI owns AppScreen, selected/preview mission, ViewTab, camera and window geometry. Profile definitions and kit registries have explicit identities but no reverse imports from core into React. Data owns evidence/topic descriptors; core may continue consuming its saved scientific profiles.

### 11.2 Core migration

- Add required profile/rules identity to design/run creation, budgets/forecast keys, flight cloning, selectors, scoring and reproducibility output. A profile must not be a mutable display preference read during stepping.
- Split current `Phase` responsibilities. Remove `setPhase` as a navigation API; replace its UI callers with view selection and its lifecycle responsibilities with validated session commands. Review snapshots receive real preflight/operate context, not whichever tab happens to be visible.
- Version internal flight state for the expanded contracts. There is no saved-flight import contract to maintain; reject unsupported state instead of guessing missing profile/subsystem values.
- Add the new command, receipt, event/refusal, history and failure fields as one coordinated contract change. Update all producers, consumers, role maps, previews, locale keys and tests; no legacy aliases that quietly retain old semantics.
- Preserve measured RadLab data and its provenance; add new engineering references/assumptions alongside it, not as overwritten “NASA telemetry”.
- Header readiness and preflight forecasts reuse core checks; subsystem effects appear in actual flight integration and reports, not UI-only warnings.

### 11.3 Browser migration and proposed files

| Ownership slice | Existing edit points | Proposed additions and responsibility |
|---|---|---|
| App shell and header | [App.tsx](../apps/web/src/App.tsx), [main.tsx](../apps/web/src/main.tsx), [store/index.ts](../apps/web/src/store/index.ts), [Launch.tsx](../apps/web/src/ui/phases/Launch.tsx) | `ui/screens/Home.tsx`, `Loading.tsx`; `ui/header/MissionControlHeader.tsx`, `ViewTabs.tsx`; loading/session coordination |
| Windows/mobile layout | [DraggablePanel.tsx](../apps/web/src/ui/layout/DraggablePanel.tsx), [panelLayout.ts](../apps/web/src/ui/layout/panelLayout.ts), [index.css](../apps/web/src/index.css), [Overlays.tsx](../apps/web/src/ui/panels/Overlays.tsx) | `ui/layout/PanelDock.tsx`, window-state reducer, geometry/viewport helpers and accessible Window options |
| Camera and kits | [AppCanvas.tsx](../apps/web/src/three/AppCanvas.tsx), [OrbitScene.tsx](../apps/web/src/three/OrbitScene.tsx), [SpacecraftModel.tsx](../apps/web/src/three/spacecraft/SpacecraftModel.tsx), [previewSnapshots.tsx](../apps/web/src/three/previewSnapshots.tsx) | `three/CameraController.tsx`, `MissionKitRegistry.ts`, mission-kit scene compositions; versioned semantic snapshot keys |
| Rule profiles/subsystems | [core contracts](../packages/core/src/contracts.ts), [catalogue](../packages/core/src/catalog.ts), [design](../packages/core/src/design.ts), [sim state](../packages/core/src/sim/state.ts), [commands](../packages/core/src/sim/commands.ts), [step](../packages/core/src/sim/step.ts), [score](../packages/core/src/score.ts) | Profile definitions and small domain modules for thermal, link/pointing/fault state; shared validation, no duplicate engine per profile |
| Teaching/evidence | [science.ts](../packages/data/src/science.ts), [scienceBindings.ts](../packages/data/src/scienceBindings.ts), [locales](../apps/web/src/i18n/locales/), [ScienceDrawer.tsx](../apps/web/src/ui/science/ScienceDrawer.tsx) | New profile/control/issue/home/loading topics, assumptions and EN/PT content; explicit target reveal before Show me |

No implementation files above are created by this planning task. During implementation, inspect language-server references before exported-symbol changes; the earlier source-navigation attempt found no active language server, so current research used direct file inspection.

Persisted settings need a one-time versioned migration from the old display value `TECHNICAL` to `DETAILED`, without creating a Technical mission by accident. Old best-score keys remain untouched but are not read as new-profile bests. Do not erase unrelated browser storage. Thumbnail/cache keys must include profile/kit identity and relevant visual configuration so equivalent revision numbers cannot show another mission's hardware.

Remove obsolete bottom-panel-switcher behavior, decorative collapse icon and duplicate primary launch/transport controls after their new owners work. Do not retain two layout stores or route the old `phase` through a compatibility shim.

## 12. Execution sequence and integration gates

This is the proposed full refinement scope, not a promise to implement only the easiest UI subset. Work can proceed in genuine parallel slices after shared contracts are agreed; one integration owner owns store/contracts/locale aggregation to avoid conflicting edits.

### Stage A — Freeze semantics and contracts

Define ViewTab versus lifecycle, preview versus active mission, profile/rules identity, pause reasons, command receipts and the window/kit contracts. Complete a migration/caller inventory. Write acceptance cases for free navigation without running them against a half-migrated app.

**Exit:** every current phase-sensitive consumer and every requested behavior has a named new owner; no ambiguous use of Technical remains.

### Stage B — Core profiles and parameter evidence

Implement both rule profiles and the six bounded Technical mechanisms; author all numeric values/provenance, coupled forecasts, launch checks, fault controls, command transport and score identity. Add deterministic integration/event handling and reference cases, keeping actual orbital calculations and saved science evidence distinguishable.

**Exit:** all three missions have complete profile definitions and physically/accounting-consistent strategies; no disabled Technical model stub or UI-only fault label. Parameter assumptions, unsupported fidelity and independent reference bounds are recorded.

### Stage C — Parallel interaction slices

1. Camera and mission kits, including immediate chooser previews, framing ownership, demand rendering and resource cleanup.
2. Window/dock/resize system, compact/Reading layouts and equivalent non-drag controls.
3. Home/loading/header/view navigation, integrating already-fixed lifecycle/profile APIs and bilingual explanations.

**Exit:** all slices meet contracts without importing each other's private state; one persistent Canvas; header remains an actual operational authority.

### Stage D — Integrate and cleanly remove old paths

Wire subsystem controls and telemetry into header, panels, scenes and explanations. Complete focus/target reveal, decision attention policy, launch review, mission/profile switch confirmation, readiness cancellation and settings/score migration. Remove the old phase-navigation coupling and obsolete duplicate controls.

**Exit:** no routes that accidentally launch/reset/resume; no mode switch that changes live rules; no missing EN/PT keys or inaccessible minimized control.

### Stage E — Verification and documentation

Run one integrated type/test/build pass after implementation converges, then targeted fixes/checks only where needed. Test actual pointer/touch/keyboard behavior in browser, all six mission/profile variants and the failure/slow-loading paths. Extend existing behavioral tests rather than asserting source text or mere component presence. Preserve independent physics/model references; do not blindly regenerate golden traces.

Update canonical component pages and VERIFICATION with observed evidence only. Check static evidence packaging and measured bundle/frame budgets after camera/kits/profile work. No new performance number or conformance claim is approved in this proposal.

**Exit:** the matrix below passes or actual remaining failures are explicitly presented for review; unfinished behavior is not called a complete refinement.

## 13. Acceptance and verification matrix

These are planned tests, **not tests executed for this document**.

| ID | Required observable acceptance |
|---|---|
| A01 / R1 | Drag, pan, zoom, fit and reset work while paused/running; scientific state/queue/RNG unchanged; idle demand loop settles |
| A02 / R1,R6 | Camera buttons and keyboard perform equivalent operations; panel, modal and text-field interaction never moves the camera; mobile Done restores native gestures |
| A03 / R2 | Every tab is reachable in setup, cruise, capture pending, running, decision-paused and terminal states without invoking lifecycle mutations |
| A04 / R2 | Live/provisional/no-result views are labelled correctly; preflight views are read-only for the active spacecraft after launch; no accidental hardware edits |
| A05 / R2a | With all panels minimized and every tab selected, the primary action, actual status, decision indicator and essential flight values remain reachable in header |
| A06 / R2a | Header launch reruns role/profile/readiness/revision checks; repeated activation cannot double-launch; tab selection alone never launches |
| A07 / R2b | First Light, Storm Watch and Red Relay show distinct kits immediately on selection; rapid selection cannot commit an obsolete kit; ghost preview equipment is not granted to design |
| A08 / R2b,R5 | Cancel or failure during a mission switch preserves the old paused state/design/camera; successful confirmation atomically starts the selected setup |
| A09 / R3 | Every scenario supports both profiles; profile changes actual enabled constraints/controls/fault behavior, not only text, budget or display depth |
| A10 / R3 | Guided/Detailed changes no physics; post-launch profile changes require a new attempt; bests/fixtures/reports include profile/rules identity |
| A11 / R3 | Thermal/reference, EOL power, finite pointing, link modes/uplink windows, reset recovery and capture-envelope cases have visible causes/costs/outcomes and bounded numerical tests |
| A12 / R3 | Core public-command playability covers 3 scenarios × 2 profiles × 3 difficulties = 18 supported cases, plus targeted adverse/edge seeds; no auto-winning production loadout |
| A13 / R3 | Same timed commands under supported warp/step schedules match the declared deterministic model; view/camera/locale changes do not consume stochastic events |
| A14 / R3 | Educative Advance processes intermediate events/costs; checkpoint retry restores RNG/receipts/history coherently and labels assistance; Technical does not count a rewind as the same scored attempt |
| A15 / R4 | Minimize each window, then all windows; restore independently to last fitting rectangle, content and scroll; dock focus/raise works without minimizing another wide-layout window |
| A16 / R4 | Resize/move via pointer, keyboard and non-drag pointer inputs; minimum/maximum bounds and top/left edges correct; cancel/lost capture cannot leave a stuck gesture |
| A17 / R4,R6 | Restore after viewport/header/dock/keyboard change clamps effective geometry without erasing preferred desktop rectangle; reset affects layout only |
| A18 / R4,R6 | Focused window is raised; minimizing redirects focus to dock; Show me restores its target window; modal close has a visible fallback when opener disappears |
| A19 / R5 | Cold/cached/slow entry shows genuine Home/loading stages, no fake percent, one Canvas, and no success before controls/first frame are ready |
| A20 / R5 | Cancel/retry/context/module failure ignores late callbacks, preserves old sessions when applicable and provides truthful error/reload actions |
| A21 / R6 | 320×568, 390×844, 768×1024, 844×390, 1280×720 and 1440×900 are usable; also test 320 CSS-px equivalent at 400% zoom and 200% text enlargement |
| A22 / R6 | Long EN/PT labels, notches, browser chrome and on-screen keyboard do not hide primary action/dock/focused fields; no required desktop-only control |
| A23 / R6 | Keyboard-only, mouse, pen and touch paths complete equivalent tasks; contrast, visible focus and status text survive low quality/reduced motion |
| A24 / R6 | NVDA with Firefox/Chrome, VoiceOver with Safari/iOS and TalkBack with Android Chrome announce tabs, dock state, regions, genuine loading and failure without telemetry chatter |
| A25 / all | Browser playthroughs complete all six mission/profile variants using real controls, including a genuine Technical failure/recovery case; screenshots/recordings include mobile and minimized-window operation |
| A26 / all | Normal regression suite, provenance/locale checks, independent model cases and static build pass; one WebGL context and measured bundle/runtime limits remain documented |

Manual mobile/screen-reader checks require the named actual environment; desktop viewport emulation is not proof of iOS VoiceOver or Android touch behavior. Human comprehension checks should include a first-time 12–13-year-old learner and technically experienced adults when appropriate consent/safeguards are available. They are separate from automated UI correctness and must not be fabricated.

## 14. Risks and review decisions

Recommended defaults are explicit so review can change material choices without another round of discovery.

| Decision | Recommendation | Trade-off / review impact |
|---|---|---|
| Technical fidelity | Six bounded mechanisms in §9, with assumptions and reference cases | Meaningful engineering depth without claiming professional trajectory, thermal, RF or hardware validation |
| Mode switching | Freely inspect; changing live rule profile starts a confirmed new attempt | Preserves scientific/score integrity instead of silently rewriting a flight |
| Mission switching | Immediate candidate preview, confirm before discarding active run | Slightly more state than instant reset, but protects unsaved work |
| Default first entry | Educative + Guided, Technical + Detailed suggested when chosen | Broad entry without removing precise science or guidance from either group |
| Self-paced practice | Explicit event advances and at most three in-memory named checkpoints | Friendly exploration without adding persistent save/history infrastructure |
| Mobile windows | In-place pills, one adjustable sheet, independent desktop geometry, Reading layout | Replaces the superseded top-dock contract |
| Camera | Explicit Chase/Inspect/Map/Workbench/Cinematic modes; reduced-motion safeguards | Camera remains separate from explicit actor-checked pilot commands |
| Scores and old settings | Versioned profile-specific scores; one-time display-setting migration | Existing baselines are not falsely compared with new Technical results |
| Scope | Three existing scenarios in both profiles; no new destinations in this refinement | New physics/UX work is already substantial; the twelve research concepts remain separate |

Main risks: lifecycle/view mixing can corrupt flight; uncontrolled framing can defeat dragging; UI pointers can leak into camera gestures; asynchronous readiness can commit the wrong mission; header/dock can consume the entire zoomed viewport; new fault thresholds can be scientifically misleading or render a mission unwinnable; per-frame RNG/thermal stepping can undermine reproducibility; unreviewed labels can confuse Technical rules with Detailed display.

Mitigation is built into the contracts and acceptance cases, not deferred to cosmetic polish. This proposal is ready for product/scope review, **not a request to treat source-dependent coefficients or future tests as already validated**.

## 15. Primary research references

References below were opened during this research or inspected by the research agents. They support the stated API/interaction/engineering concepts; their live documentation versions may be newer than installed dependencies. Check installed types/behavior before implementation. No external link availability guarantee or new hardware qualification is implied.

| ID | Source | Used for |
|---|---|---|
| S1 | [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) | Orbit/dolly/pan gestures, target/distance limits, update/reset lifecycle |
| S2 | [R3F scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance) | Demand rendering, invalidation, shared resources and avoiding unnecessary render work |
| S3 | [Drei controls](https://drei.docs.pmnd.rs/controls/introduction) | Existing controls manage updates/cleanup and demand-mode integration |
| S4 | [React Suspense](https://react.dev/reference/react/Suspense) | Actual code-loading boundaries; Suspense is not a generic detector of arbitrary effect work or renderer readiness |
| S5 | [MDN progressbar](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/progressbar_role) | Native progress, indeterminate semantics, accessible name and busy state |
| S6 | [WAI-ARIA APG Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | View-tab roles, activation, arrows and panel associations |
| S7 | [WCAG 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag single-pointer alternatives, separate from keyboard access |
| S8 | [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action) | Gesture ownership before interaction, cancellation and preserving browser zoom |
| S9 | [WCAG 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | 320 CSS-px reflow, zoom, ordinary content versus genuine two-dimensional exceptions |
| S10 | [WCAG 2.5.8 Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 24 px AA minimum/exceptions, distinguished from the stronger 44 px product target |
| S11 | [WCAG 2.4.11 Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Persistent-header/window focus visibility boundaries |
| S12 | [NASA Small Spacecraft Thermal Control](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/) | Thermal balance, allowable ranges, passive/active control and power-limited heaters |
| S13 | [NASA Small Spacecraft Power](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/) | Generation/storage/distribution, BOL/EOL, eclipse and degradation considerations |
| S14 | [NASA Guidance, Navigation and Control](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/) | Sensors/actuators, pointing and Earth-versus-deep-space magnetic-control limitations |
| S15 | [NASA Communications](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/) | Distinct uplink/downlink/crosslink and ground/space segment constraints |
| S16 | [NASA Small Spacecraft Avionics](https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics/) | CDH/OBC, watchdog/reset/mitigation concepts; page carries an archived-content notice, so not a current-policy or calibrated-failure-rate authority |
| S17 | [APG Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) | Window dock buttons versus toggle semantics |
| S18 | [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) | Pointer IDs, capture and cancel lifecycle |
| S19 | [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Loading/readiness/error announcements without forced focus changes |

Research result: the requested UX is compatible with the existing static architecture, but it requires a real separation of navigation, lifecycle and profile semantics. The refinement is not safely achievable by merely adding click handlers to the current phase spans and collapse icon.
