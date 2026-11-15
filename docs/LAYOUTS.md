# Layouts and workspace interaction

The persistent Canvas is the main surface. `Simulator` composes a compact identity-only `TopBar`, seven-resource HUD, floating tools and one bottom `MissionControl`. The approved [streamlined plan](./plans/STREAMLINED_MISSION_CONTROL_PLAN.md) supersedes the earlier separate CAPCOM/top-primary/pill layout. Camera, tours, highlighting, geometry and inspection remain device-local; mission changes use public store actions and authoritative core/session checks. Executed evidence belongs in [VERIFICATION.md](./VERIFICATION.md).

## Shell and bottom mission control

Home/setup retain static SVG, four scenarios, language/sound/motion and shared-screen roles. Setup now presents Aspiring/Expert as icon-bearing, explicitly selected toggle cards with their unchanged rule descriptions. Team setup starts expanded; each player has a horizontal responsibility column that reflows on narrow screens. Native role dropdowns swap owners, while Add responsibility preserves the existing multi-role allocation model; no role is lost or duplicated. The local-start card explains solo/shared-screen play and uses the existing preparation callback. The separate `/host` link remains LAN entry, not an implied running server. Preparation/commit/rollback and one retained Canvas are unchanged. TopBar contains brand, mission/level, Help and Settings only: no Continue or progress-dot navigation.

`MissionControl` owns the sole `#mission-primary`: Show me for a real blocker, Continue, Go for launch, Launch, event advance/cancel, pause/resume, capture confirmation, pending-decision focus or terminal Review. Guidance names the task and owner once. Refusals and independent pause reasons remain visible; opening help or closing a tour never automatically resumes.

The controller groups:

- **Requirements:** the actual `missionRequirements` targets/results, with complete owner/method/revision evidence and adjacent Explain. One implementation (`phases/Requirements.tsx`) remains available through Build, flight and debrief; the Requirements stage opens it instead of duplicating it inside Workshop.
- **Spacecraft slots:** presentation toggles, every actual bus category and installed-component inspection. Selecting a category during Build reveals Workshop; there is no automatic installation. Flight/debrief hardware is view-only. Turntable is unavailable under reduced motion.
- **Checklist:** real completion, owners and per-task Show me routes. Opening it never completes a task.
- **Flight options:** existing commands, detailed timeline, warp, event advance/cancel, pilot and Log receipts, embedded rather than another fixed deck. With options closed, next light/shadow/contact edge and absolute T+ time, an advance action and next contact remain visible. Unknown edges remain unknown, not a fabricated forecast.
- **Mission navigation:** five visible gated desktop chapters (Briefing, Build, Test & launch, Fly, Debrief), plus native stage/substep selection. Compact uses the select only. All seven stages remain named; unreached or disallowed destinations are disabled. Store/core guards remain final authority. Navigation never approves, freezes, launches or advances time.
- **Panels:** Workshop, Details, Review and Log buttons with expanded state and badges replace scattered collapsed header pills. Optional LAN presence wraps inline, with no additional fixed chrome.

This is the user's newly requested bottom navigation, not restoration of the former tab dock: no seven-tab stage row, no duplicate panel pills, no top primary and no permanently open flight timeline. One options tray opens at a time; Escape/re-toggle/Close returns focus to its trigger. Panel navigation clears the tray before revealing its destination.

## Panel state and geometry

`MISSION_PANEL_IDS = ['mission','readiness','review','log']`; `PANEL_IDS` additionally includes transient `part`. `useWindows` retains independent desktop rectangle, compact height/full-height intent, stacking, scroll positions and focus memory. Closed tools are hidden and consume no scene area; bottom navigation is their stable focus/entry point. Expanded panels retain draggable/resizable headers, eight desktop resize handles, keyboard movement and click/numeric sizing options. Preferred and clamped effective rectangles stay separate; resize never destroys desktop intent.

Only Workshop starts expanded on desktop, with a bounded 380×320 default above mission control; entering flight closes it to preserve the default scene area. Compact begins with a clear scene and no selected tool, while preserving desktop expansion/geometry intent. One compact sheet is selected at a time; the obsolete 88px collapsed-pill reserve is removed. Closing contained focus returns to `control-panel-<id>` or the connected simulator heading. `expandWindow`/`showWindow` still reveal before focus, open enclosing disclosures and scroll the actual target into view.

The Component panel remains anchored beside the projected component silhouette on desktop. `PartTracker`, tracked placement, side hysteresis and detach-on-drag remain intact. The controller is an occupied `data-hud-zone="bottom"`; measured workspace bounds keep the anchored panel above it. Compact Component uses the normal transient sheet. Inspecting from bottom slots closes the tray; closing Component restores the slots tray/opener. Viewing never installs, removes or commands.

`useWindowViewport` is the single HUD measurement authority. It observes header, resources, controller and closed controller base. Actual controller height bounds tools; layout classification uses its closed base, excluding transient pause notices, so opening a tray or starting a tour cannot cause fixed↔reading oscillation. This classification exception does not remove the notice from occupied geometry. Safe-area and visual-viewport offsets are retained. `CameraRig` reads `[data-hud-zone]` and camera widgets clear the measured controller inset; the old CAPCOM/deck assumptions are removed.

## Responsive and accessible interaction

- **Desktop ≥900px:** resources left, scene centre, bounded expanded tools, one bottom controller. Default unobscured scene-share target remains ≥60% at 1440×900, measured by visible HUD rectangle union, excluding deliberate expanded trays/additional tools and modal tours. This is a browser gate, not a claim inferred from CSS.
- **Compact:** one-row 48px identity header, seven resources in 4/3 columns, bottom context/action/options/native screen selection/four panel targets. Resource detail subvalues remain in badge dialogs rather than forcing flight into document flow. At ≤360px the native screen selector shares a row with the four 44px panel targets; options retain their own row and the redundant visual controller title is omitted, not its accessible region name. All bottom controls retain 44px targets; text wraps at 320px without horizontal document scrolling.
- **Reading:** genuinely short or zoomed viewports retain document flow and normal scroll. Same scene and controls, no smaller substitute text, no permanent scroll lock. Movement is disabled; collapse/navigation and numeric alternatives remain.

Pointer/touch geometry gestures start only at handles; pointer capture, Escape and cancellation remain. Inputs/panels never leak gestures to Canvas. Desktop header arrows move 10px, Shift+arrows 40px; compact Up/Down adjusts height. Camera and pilot retain labelled non-drag alternatives. New copy is bilingual en/pt-BR. App/OS reduced motion disables pulses/turntable/transitions; disabled and result states have text equivalents.

## Tours, scientific help and recovery

Device-local `astrix.tours.v2` records Welcome, Build, Launch, Flight, Debrief and contextual Choice independently. The new version intentionally offers the new controls even to devices that finished the former shorter tours. Aspiring auto-starts after scene readiness; Expert receives an offer. Every card shows n/N, Back/Next and Skip/Finish; arrows/Enter/Escape remain. Help replays available tours; an actual quote offers its own Install/Cancel/Comparison tour rather than substituting Parts for a missing confirmation.

Each step names one control. Definitions include every chapter/stage/substep, panel route, slot toggle/category, actual installed component, requirement/evidence route, checklist task, resource, camera alternative, command, pilot axis and warp speed. Applicability is based on actual bus/stage/flight state; tours reveal presentation disclosures and view-only component inspection, never manufacture a quote or issue commands. Presentation tray/tool/disclosure/pilot/inspection state is restored on exit. In-flight tours add and remove only pause reason `tour`; no auto-resume. Coverage-manifest tests guard this inventory.

Modal retains inert/focus trapping and connected-opener return. Scientific Explain keeps one immutable opening snapshot and uses `showWindow`/controller reveal for real destinations. ErrorBoundary surrounds stage tools, not Canvas/HUD; local retry clears only its `error` reason. Help and mission control remain reachable.

## LAN surfaces and device-local presentation

The main computer opens `/host` for admission, QR/manual invitation, role allocation and readiness, then enters the shared mission with the same Canvas/controller. `/join` is a compact phone pairing, readiness, presence and team-pause surface; stale/disconnected/revoked states are explicit. Dedicated phone design and flight consoles are not implemented. Joining a room does not turn local camera, panels, tours or explanation state into shared presentation commands. Optional phone reading and visibility do not stop the authoritative clock; shared pause policy is documented in [Simulation](./SIMULATION.md) and deployment in [Multiplayer](./MULTIPLAYER.md).

## Verification ownership

Focused tests cover primary policy and stage guards, zero-area collapse and compact bounds, unchanged Component anchoring, timeline edge selection, per-option tour coverage, copy parity and pilot fixtures using public mission actions. The UI worker may inspect the live browser at 1440×900, 390×844 and 320px; Main runs consolidated tests/typecheck/build and records observed verification. No test execution is implied by these contracts.
