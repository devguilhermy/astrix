# Layouts and workspace interaction

The persistent Canvas is the main surface. `Simulator` composes a compact identity-only `TopBar`, seven-resource HUD, floating tools and one bottom `MissionControl`. The approved [streamlined plan](./plans/STREAMLINED_MISSION_CONTROL_PLAN.md) supersedes the earlier separate CAPCOM/top-primary/pill layout. Camera, tours, highlighting, geometry and inspection remain device-local; mission changes use public store actions and authoritative core/session checks. Executed evidence belongs in [VERIFICATION.md](./VERIFICATION.md).

## Shell and bottom mission control

Setup separates Learn, Challenge and Expert Create. Learn offers short, scoped missions; Challenge retains the four original briefs; Create opens the local mission library and editor. Aspiring/Expert remain explicit level cards. Team setup starts expanded with reflowing player columns and role dropdowns that preserve one owner per discipline. Local start and `/host` remain distinct entry paths. Preparation/commit/rollback and the retained Canvas remain unchanged. TopBar contains identity, Help and Settings, not a competing Continue. These rules-v5 surfaces are awaiting integration/browser verification.

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

The automatic first-mission curriculum contains **15 concept cards total**, split Welcome 3, Build 5, Launch 2, Flight 3 and Debrief 2. This is not a separate allowance of 15 per stage. The optional Choice card is Help-only and never extends the automatic chain. Cards group related controls and use visible target alternatives rather than enumerating every control.

`astrix.tour-concepts.v3` stores concept completion and a curriculum-wide opt-out; older history remains readable so prior skips are respected. Skip, Escape or declining the Expert offer suppresses remaining automatic interruptions. Help replay does not erase that choice. Tours reveal only device-local trays, disclosures and inspection state, restoring them on exit; they never change stage/substep, mission, hardware, approvals or commands. Static tours add/remove their own pause without auto-resume. LAN tours do not pause the shared clock and instead expose an explicit team-pause action.

Modal retains inert/focus trapping and connected-opener return. Scientific Explain keeps one immutable opening snapshot and uses `showWindow`/controller reveal for real destinations. ErrorBoundary surrounds stage tools, not Canvas/HUD; local retry clears only its `error` reason. Help and mission control remain reachable.

## Mission Studio and trajectory planning

`ui/create/MissionStudio.tsx` groups identity, vehicle, environment, start, trajectory/support, objectives, termination and review. Field issues use stable schema paths and focusable destinations. Save retains an editable draft; Publish creates an immutable revision; Export validates before download; Fly validates current input before preparing an attempt. Storage and import failures are explicit. Neither a deferred validation badge nor a stale preview authorizes execution.

`ui/flightplan/` provides launcher/ascent and burn controls, preview outcomes, trajectory plots and flown records. Heavy recommendations/previews use cancellable workers; replacing the request or design invalidates stale results. Applying a result requires a normal authorized quote/commit. Predicted paths and planned burns remain visually distinct from flown samples and executed events.

## LAN surfaces and device-local presentation

The main computer opens `/host` for admission, QR/manual invitation, role allocation and readiness, then enters the shared mission with the same Canvas/controller. `/join` is a compact phone pairing, readiness, presence and team-pause surface; stale/disconnected/revoked states are explicit. Dedicated phone design and flight consoles are not implemented. Joining a room does not turn local camera, panels, tours or explanation state into shared presentation commands. Optional phone reading and visibility do not stop the authoritative clock; shared pause policy is documented in [Simulation](./SIMULATION.md) and deployment in [Multiplayer](./MULTIPLAYER.md).

## Verification ownership

Focused tests cover primary policy and stage guards, zero-area collapse and compact bounds, unchanged Component anchoring, timeline edge selection, per-option tour coverage, copy parity and pilot fixtures using public mission actions. The UI worker may inspect the live browser at 1440×900, 390×844 and 320px; Main runs consolidated tests/typecheck/build and records observed verification. No test execution is implied by these contracts.
