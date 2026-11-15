# Layouts and workspace interaction

The persistent Canvas is the main surface. `Simulator` composes a compact `TopBar`, seven-resource HUD, CAPCOM, floating stage tools, and the flight deck. Geometry, tours, camera selection, highlighting and quote previews are device-local presentation state; design, gates, roles and commands remain core/store authority. This page describes implementation contracts, not executed browser evidence; evidence belongs in [VERIFICATION.md](./VERIFICATION.md).

## Shell and stages

Home and the single mission-selection screen use static SVG illustrations, not another renderer. Setup defaults to Aspiring and offers four missions, a level switch and optional 2–4-player shared-screen roles. Language, sound and reduced motion remain on Home; independent display depth and playback live in Settings. Explicit display choices survive level changes. The existing preparation/commit/rollback handshake and one retained Canvas remain unchanged.

Seven guarded stages are presented as five chapters: Briefing (Need & goals, Concept, Requirements), Build (Design), Test & launch (Build & verify and preflight Implement), Fly (Implement), Debrief (Review). The stepper is a progress list, not window navigation or permission to bypass gates. One top-bar primary action guides, advances, launches or controls time according to actual state. Help contains replayable tours, the mission manual, every model-limit topic, roles, advanced tools, new-attempt and end-session actions.

## Panels collapse in place

`DOCKED_PANEL_IDS = ['mission', 'readiness', 'review', 'log']` retain stable programmatic identities, with visible titles Workshop, Details, Review and Log. Only Workshop starts expanded. The old MissionHeader, PanelDock, substep tab strip and store-backed Tour have been retired.

`PANEL_IDS` adds a fifth, transient `part` panel (Component). It is mounted only while a component is inspected: clicking an installed part on the spacecraft (workbench or close flight view), clicking a workbench slot, or using the keyboard equivalents (the scene's **Spacecraft slots → Components** buttons during Build, and **As flown** in the flight Workshop). It shows the catalogue specifications with teaching-assumption markers, the simulator constraints, and, in flight, live readings taken only from core telemetry. Viewing never installs, removes or commands anything. On desktop it opens beside the right-hand column and collapses in place like the others; Close returns focus to the opener. On compact layouts it is a one-at-a-time sheet that closes when another sheet opens, so compact header rows still count only the four docked panels.

`useWindows` stores `visibility: 'EXPANDED' | 'COLLAPSED'`, preferred desktop rectangle, independent compact height/full-height intent, front order, focus memory and per-view scroll offsets. A collapsed panel retains its own draggable header, badge and chevron at its desktop position; only its body is hidden. `setGeometry` records an explicit full desktop rectangle even while collapsed. Pill movement uses `setPosition`, updating only X/Y without overwriting expanded width/height. Compact sizing never writes either desktop intent. Collapsing is not mission cancellation.

- `collapse(id)` retains geometry and moves any contained focus to the stable `window-handle-<id>`.
- `expand(id)` expands in place, raises and selects the compact sheet; expansion derives a clamped rectangle without erasing preferred geometry.
- `expandWindow(id, {focus?})` expands before focusing the header after the React commit.
- `showWindow(id, selector?)` expands/raises/selects, resolves inside the destination, opens enclosing disclosures and focuses/scrolls the control. Missing controls fall back to the header.
- `resetLayout()` resets visibility/geometry/order, preserving content scroll memory and all mission state.

Chevron activation, header double-click, and Enter/Space on the header toggle collapse. The header exposes `aria-expanded` and `aria-controls`; focus stays anchored to it. Panel badges and a polite live announcement replace dock badges/focus fallback. There is no window navigation strip.

## Geometry and responsive composition

`useWindowViewport` mounts once in Simulator and measures visual viewport, safe areas and HUD zones. Resize/scroll observers coalesce work through animation frames. Desktop bounds exclude the top bar and flight deck. Compact bounds also exclude the resource strip and CAPCOM. `MissionCamera` measures the HUD zones for its optical clear band; it does not infer a vanished dock.

Preferred and effective rectangles stay separate. Temporary clamping never destroys desktop intent. `clampRectangle`, `resizeRectangle`, `moveRectangle` and `sheetRectangle` remain the shared finite/clamped geometry authority. Desktop minimums remain Workshop 320×240, Details 260×180, Review/Log 260×160 CSS pixels; bounds can shrink these minima. Default Workshop is a limited lower-left/centre panel, not full-height; other tools are header pills outside the central scene band. The default scene-share target is at least 60% at 1440×900, subject to measured browser verification.

- **Desktop (≥900 CSS px):** independently draggable/resizable panels; resources left, CAPCOM right; scene centre clear by default.
- **Compact:** seven badges in a four/three strip, one-line CAPCOM, one adjustable bottom sheet; other panels remain their own two-row header pills. `compactSheetBounds` reserves those headers for expanded geometry, drag drafts, keyboard sizing and numeric options alike. Switching sheets preserves independent visibility intent and desktop geometry.
- **Reading:** short/zoomed viewports use document flow in the same semantic order. Panel movement is disabled, collapse remains available, and the same retained scene remains reachable. No unreadably small text or permanent document scroll lock replaces reflow.

`layoutClass` still chooses reading below 260 usable pixels, or above 1.5× scale with under 440 usable pixels, then compact below 900 pixels. All seven resource badges remain present at 320 pixels. Values, labels, status equivalents and delta text wrap within fixed columns; none requires horizontal document scrolling.

## Pointer, keyboard and touch

Only the title/resize handles begin geometry gestures. Primary pointer capture, temporary drafts, opposite-edge anchoring and Escape/pointercancel/lost-capture cancellation are retained. DOM form, scroll and panel gestures do not leak into the Canvas.

Focused desktop headers move by 10 pixels with arrows or 40 with Shift. Compact Up/Down adjusts height. Options supply click movement/resize and labelled numeric coordinates/dimensions; resizing is never drag-only. Expanded desktop panels retain eight edge/corner handles. Collapsed pills remain draggable; expand re-clamps the full body.

Actual HUD controls accept pointer events; empty space passes through. Panels stay below header/modals. The flight decision is a centred scene overlay independent of Workshop visibility; command receipts and the event history remain in Log. All mission mutations still use normal actor-checked actions.

## Guidance, tours and focus

CAPCOM resolves actual requirement failures before severity-three cues, stage artifacts and improvements. First Light's missing camera is surfaced during Build. Show me reveals the owning control, selects a relevant category and highlights the corresponding model slot; it never installs, signs off or completes a task. Cue rectangles track draggable targets while visible and expire without mission changes.

Five short per-surface tours use `astrix.tours.v1`, independent of mission settings. Aspiring auto-starts after scene readiness; Expert receives an offer. Target cut-outs track motion; cards clamp to the viewport or become compact bottom sheets. Missing targets produce a navigable centred card. Back/Next, arrows, Enter, Skip/Finish and Escape preserve normal modal focus/inert handling and return to the opener/header. An in-flight tour adds only pause reason `tour`; closing never resumes automatically. Reduced motion disables pulses/transitions.

The shared Modal traps focus, makes unrelated branches inert and restores their previous state on cleanup. Its fallback is the header/main, not a deleted dock. Explain still captures one immutable opening snapshot, replaces related topics within one drawer, reveals reachable destinations through `showWindow`, and removes only its own pause reason on close.

`ErrorBoundary scope="layout"` surrounds stage tools, not Canvas/HUD. A tool failure pauses with `error`; local retry clears only that reason and leaves the scene and Help reachable.

## Maintenance and verification

Ownership: shell (`ui/shell`), resources (`ui/hud`), guidance (`ui/guide`), tours (`ui/tour`), panels (`ui/layout`), stage tools (`ui/phases`, `ui/workshop`). Scientific model boundaries stay reachable under Help → Model limits and adjacent Explain; Detailed presentation exposes technical evidence without a second shell.

Focused tests cover bounded geometry, collapse/expand intent retention and pill movement; resource thresholds, quote deltas and forecast/live units; next-step ordering/state completion/roles; tour navigation/persistence; and setup normalization. Pointer/touch cancellation, focus/inert restoration, target visibility, 320-pixel reflow, 200% zoom, both locales, reduced motion and actual scene share require browser verification by the integration owner. No new check is claimed here.
