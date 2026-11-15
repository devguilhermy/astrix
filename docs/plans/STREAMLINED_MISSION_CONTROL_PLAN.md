# Streamlined mission control

Status: approved 2026-11-15 with amendments 1-4.

## Intent and method

Operate-mode refinement, not a replacement visual world. Preserve the dark space-first identity, cyan action accent, seven resource categories, guarded mission stages, deterministic core, and the single retained Canvas. Spatial thesis: **look at the spacecraft; read one contextual next action; reach requirements, hardware and workspace navigation together at the bottom.** Use proximity and progressive disclosure instead of several competing HUD islands.

Read Impeccable distill, layout and Operate playbooks. The context launcher initially required workspace selection; it then resolved the explicitly assigned Simulator target. PRODUCT.md/DESIGN.md are missing, so the incumbent is visual authority; no unrelated design-system capture is proposed. As a delegated worker with a fully specified brief, decisions below substitute for a separate user interview. Read craft-floor immediately before approved source work. Mechanical detector runs once over the finished changed UI, not during planning.

## Baseline research

Frozen committed app (5ab4440) at `http://127.0.0.1:5177/`; initial desktop observations also used the dev server before concurrent HMR reset the attempt. First Light / Aspiring, solo, browser interactions only: accept objective, visit Concept and Requirements, preview/install Earth camera, freeze, verify, launch, inspect flight, explicitly End mission under Help, then open debrief. This is an ended attempt, not a successful mission claim.

Screenshots: `/tmp/astrix-ui-before/{setup,need-goals,concept,requirements,build,verify,launch,flight,debrief}-{1440,390,320}.png` (1440×900; 390×844; 320×844). Debrief was recaptured after dismissing its tour. Baseline measures below are CSS pixels from DOM rectangles, not screenshot estimates.

### Measured problems

| Problem | Source | Observed geometry / consequence |
|---|---|---|
| Primary action and its explanation are separate | `ui/shell/TopBar.tsx:17-29`, `ui/guide/CapcomCard.tsx:21-26` | Desktop primary is at y≈2 while CAPCOM starts (1168,56), 264×262. CAPCOM's no-step Show me merely focuses the top primary. The same instruction appears in summary, heading and button. |
| Phone spends a second header row on Continue | `shell.css:249-255` | Top bar is 92px at 390px, versus 48px desktop. This row is a full-width 44px primary plus seven tiny progress dots. |
| Mission requirements are a scrolled stage island, not a persistent mission reference | `ui/phases/Journey.tsx:25` | Requirements live inside Workshop at (200,502), 380×390 desktop; the lower goals are below its fold. They disappear on changing stage, while users need them during Build and flight. |
| Hardware options are isolated from their owner | `three/AppCanvas.tsx:176`, `ui/scene/WorkbenchControls.tsx:13-18`, `ui/scene/scene.css:31` | Spacecraft slots are a separate 280×46 disclosure at (1148,709), distant from Workshop. Camera is another 280×100 island at (1148,786). |
| Phone default hides virtually all scene behind the active tool | `ui/layout/panelLayout.ts:63-66`, `shell.css:267-275` | At 390px Build: resources y92–265 (173px), CAPCOM y269–315 (46px), Workshop y323–740 (417px), two rows of pills y748–836 (88px). Camera and slots occupy the same region behind Workshop. |
| Phone flight tips into reading layout unexpectedly | `ui/layout/useWindowViewport.ts:19-25`, `ui/layout/panelLayout.ts:69-71`, `ui/flight/FlightBar.tsx:48-58` | At 390px flight: resource strip grows to 218px; CAPCOM bottom 368px. The full flight deck leaves <260px, activating document flow. Workshop begins y803, deck y1724 (239px); essential time controls are off-screen. |
| Collapsed panel controls repeat navigation in scattered positions | `ui/layout/windows.ts:96-106`, `ui/layout/DraggablePanel.tsx:144-161` | Desktop Details, Review, Log occupy 220×44 pills; phones reserve 88px for pills independent of actual opened panel. |
| Tours under-describe the controls and fall back past unavailable content | `ui/tour/tours.ts:7-11`, `ui/tour/TourHost.tsx:25-29` | Build has five steps, slots points at the whole collapsed disclosure; confirm falls back to Parts. Flight groups all commands into Hotbar and omits individual time speeds/options. |

Layout assessment: spacecraft is visual centre, but the eye zigzags from upper-right instruction to lower-left task to lower-right slots and back to upper-right Continue. Grouping is achieved by multiple bordered containers, not task proximity. On phones all density is consumed by persistent chrome. Long localized action labels already wrap, but the duplicated action location adds unnecessary height. Refinement should remove duplication, not controls or scientific evidence.

## Proposed composition

### 1440×900 (desktop ≥900)

```text
┌ ASTRIX  First Light · Aspiring / Build             Help Settings ┐ 48
│ resources        scene status                                  │
│ seven badges                                                   │
│                   SPACECRAFT / ORBIT                           │
│                                                                │
│   Workshop (380×~320, draggable; only expanded tools float)      │
│                                                                │
├ CAPCOM · Add Earth camera                 Explain [Show me →]   ┤ ~56
│ Requirements ▾  Spacecraft slots ▾  Checklist ▾                 │
│ Mission stage [Build / equipment ▾]   Workshop Details Review Log│ ~56
└────────────────────────────────────────────────────────────────┘
```

Bottom control is one quiet, edge-anchored surface, not a full-width stack of cards. On wide screens guidance and navigation share two compact rows; target default height ≤128px (flight ≤172px). The old top primary and old floating CAPCOM go away. Persistent bottom buttons replace collapsed panel pills, not supplement them. Expanded tools keep their draggable/resizable headers and geometry options. Default Workshop shrinks to ~320px height above the controller; only it is initially expanded on desktop.

Scene-share gate: conservative area-union measurement of visible HUD surfaces (header, resources, controller, expanded Workshop, scene widgets; overlaps count once), excluding tours/modals and deliberate expanded trays/tools. At 1440×900 the default Build and flight scene share must remain ≥60%; the controller's default closed disclosures and compact flight timeline are essential to that budget. If measurements miss it, reduce default Workshop height and controller wrapping, never shrink controls/text below accessible sizes.

### 390×844 (compact)

```text
┌ ASTRIX  First Light                 Help Settings ┐ 48
│ seven resources, existing 4/3 columns            │ ~174–218
│                                                  │
│                 SPACECRAFT                      │
│                                                  │
│ [opened tool: one adjustable sheet, if requested]│
├ CAPCOM · contextual instruction                 ┤
│                       [single primary →]        │
│ Requirements ▾  Slots ▾  Checklist ▾             │
│ Mission stage [Build / equipment ▾]              │
│ Workshop     Details       Review       Log      │
└──────────────────────────────────────────────────┘
```

Use 44px touch targets, compact 4-column navigation; header stays one row. Mobile tools start closed, rather than covering the scene before the user asks. Show me and nav buttons reveal the actual sheet; normal semantic focus returns to the corresponding bottom button on collapse. Bottom control remains reachable, not beyond a 1700px document. Flight commands/timeline open inside one upward content tray so the deck does not force reading mode on a normal-height phone. Time primary stays visible when flight options are closed.

### 320×844 and short/zoomed reading

```text
┌ ASTRIX  First Light               ? Settings ┐
│ seven resources in 4/3 columns               │
│                   SCENE                     │
├ instruction (wrap, no truncation)            ┤
│ [primary, full width]                       │
│ Requirements ▾   Slots ▾   Checklist ▾      │
│ stage [full-width native select]            │
│ Workshop  Details  Review  Log               │
└─────────────────────────────────────────────┘
```

No document horizontal scrolling; shorter labels only where meaning remains explicit. Trays have bounded vertical scroll; their controls retain 44px targets. On genuinely short/zoomed screens preserve reading mode: header/resources/scene/tools/controller in document flow, no permanent scroll lock and no tiny substitute UI. Do not let an *expanded tray* itself trigger compact↔reading oscillation: layout classification uses the closed controller footprint, while effective panel bounds avoid the current measured controller top.

## Bottom mission-control anatomy

1. **Context + primary:** migrate the exact state machine from TopBar into the controller. One visible `#mission-primary`, retaining `data-cue-target=primary`. Actual blockers select Show me; valid Continue, Go for launch, Launch, advance/cancel/pause/resume, capture confirmation, pending decision focus and terminal Review use existing public store actions. Preserve refusal rendering and pause reason explanations. Do not make navigation advance simulation.
2. **Requirements:** persistently available from briefing through debrief; extract the real `missionRequirements` UI out of Journey so there is one owner, same target/owner/method/revision/result and adjacent Explain, no synthesized readiness score. Auto-open when entering Requirements; no copied cards remaining in Workshop.
3. **Spacecraft slots:** relocate WorkbenchControls out of AppCanvas's overlay into controller content. Preserve exploded, dimensions, turntable (disabled for reduced motion), every actual bus catalogue category and installed component inspection. Category activation during Build also reveals the owning Workshop. In-flight/debrief components remain view-only; no edit bypass. Outside assembly, presentation-only controls are disabled or omitted with explicit context, component viewing remains available.
4. **Checklist:** retain actual next-step completion and owners, without repeating the next instruction three times. Adjacent Explain remains distinct from action. One bottom content tray at a time (requirements/slots/checklist/flight), native controls inside, explicit close/re-toggle.
5. **Mission UI navigation:** a labelled native select for the seven stages and the current stage's available substeps (not a second row of seven tabs). Use `STAGES`, `SUBSTEPS`, `furthestStage`, `evaluateJourneyStage`, terminal restrictions and existing `setStage`/`setSubstep` actions. Future/inaccessible destinations are disabled and named, not silently actionable. Selecting existing UI never signs off, freezes, launches or completes anything.
6. **Panel navigation:** four compact buttons Workshop/Details/Review/Log with badges, `aria-expanded`, `aria-controls`; use existing expand/collapse/show APIs. Remove off-surface collapsed pills and their 88px reserve. Transient Component remains anchored on desktop and a sheet on compact. Collapse focus fallback is the matching bottom nav, with Component's existing close behavior retained.
7. **Flight options:** mount existing Hotbar, timeline, pilot, warp and receipts within the controller tray, not another fixed deck. Remove duplicate Play/Next buttons already represented by the primary; retain a separately labelled explicit event-advance option when primary is pause/resume, warp speeds, cruise skip and capture behavior. Timeline collapsed by default. Each control is explained by tours, commands stay role/core checked.
8. **Team presence:** no-props `Presence` from LanHost is inline wrapping text inside controller; null offline. No extra fixed strip and no store changes in this slice.

The previous removal of a tab dock was correct for its brief. The user's current explicit request for bottom mission/panel navigation supersedes that restriction. This does **not** recreate the former chrome-heavy dock: no seven stage tabs, no duplicate floating panel pills, no second primary, no always-open timeline, one controller surface with compact native selection and four panel targets.

## Removal / consolidation

- TopBar retains brand, identity, progress and Help/Settings only; move primary/refusal/clock policy out, remove dead imports/styles.
- Replace CapcomCard with the controller; move shared guide context into a small guide helper if needed. No compatibility re-export.
- Remove the AppCanvas WorkbenchControls mount/import; one new shell mount owns it.
- Extract requirements from Journey; remove duplicate Go for launch button if it repeats the merged primary, keeping checks/signoffs.
- FlightBar becomes embedded content, no fixed geometry observer/second HUD inset authority; merged controller measurement owns bottom clearance.
- Remove collapsed pill CSS/geometry reserve and migrate collapse focus to bottom navigation. Preserve expanded panel gestures, numeric sizing, scroll/focus memory and preferred desktop intent.
- Camera stays scene-owned; reposition above measured controller (right on desktop, compact restrained widget), never duplicate CameraBridge.

## Tour coverage contract

Tours remain local and pause with reason `tour` only. Expand **presentation disclosures only** before spotlighting; do not install, freeze, select a new mission stage, sign off, issue a command, or advance time to manufacture a target. Restore presentation disclosure on finish/skip. Every emitted step targets visible actual content; no silent skipping of a control hidden inside a disclosure.

Shared mission-control tour steps (welcome and replayable from Help):

1. Contextual instruction/owner; 2. merged primary and its guarded meanings; 3. Explain; 4. Checklist open/close and completion; 5. Requirements open/close; 6. requirement results/targets and Detailed evidence; 7. requirements Explain; 8. mission stage selector, individually explaining Need/goals, Concept, Requirements, Build, Verify, Implement and terminal Debrief including disabled gates; 9. each available current-stage substep; 10. Workshop; 11. Details; 12. Review; 13. Log; 14. panel close/focus and geometry options; 15. resource badges; 16. camera/options and Help replay.

Build extension: slots disclosure; exploded; dimensions; turntable/reduced-motion reason; each actual catalogue category (battery, solar, computer, storage, pointing, radio, science, propulsion, thermal as available); installed-component inspection; Component find/close; Workshop all/guided categories; preview; quote gains/costs; explicit Install/Cancel when a quote is open; orbit UI route; freeze. Quote-only controls are explained when they exist and have dedicated replayable context, rather than substituting Parts for Install. New mission-control options use stable named tour targets; tests enumerate them and check tour coverage.

Launch extension: Return to Build, dry-run run/cancel/result/policy as available; checks; per-role approvals for teams; single Go for launch/Launch primary; optional launch storyboard play/skip/replay remains presentation only.

Flight extension: flight tray toggle; timeline toggle and contact advance; individually Sun/Target/Earth/Downlink/Safe/Deploy (only actual applicable deployment); pilot enable/disable, pad and attitude targets; clock primary; each warp speed (1/10/100/1000/10000), event advance/cancel, cruise skip/capture conditional state; receipts; instrument toggles/subsystems remain Workshop destinations; requirements/slots/view-only inspection and all four panel routes still covered. Conditional controls are explicitly described in appropriate state, never simulated by tour mutation.

Debrief extension: objective/score, evidence, replay controls, redesign, requirements results and unchanged bottom nav. Existing Help replay lists retain surface availability. Tour cards place above bottom targets on phones instead of covering them. Back/Next, arrows, Enter, Escape and Skip/Finish remain.

## Accessibility, localization, motion

- Native buttons/select/checkboxes; minimum 44px targets; no icon-only navigation or horizontal-only hidden destinations.
- DOM order matches context→primary→disclosures→mission UI select→panels. Label all grouped controls, `aria-expanded`/`aria-controls`, live completion/status remains restrained. Collapse restores corresponding connected visible opener/nav; programmatic Show me opens first, then focuses.
- Escape closes content tray and returns to its trigger, without competing with nested modal or panel Escape. Modal inert/trap semantics remain unchanged; tours restore focus, never automatically resume.
- All new prose in a `ui/guide/copy.ts` en/pt-BR module with minimal resources.ts registration, no locale JSON rewrite. Locale-number formatting; long pt-BR wraps, selects constrain width, status never relies solely on color.
- Existing OS/app reduced-motion paths disable turntable/pulse/scroll animation; layout changes require no animation. Touch controls do not leak gestures to Canvas; no required dragging.

## Files to change

Owned source: `ui/screens/Simulator.tsx`; `ui/shell/TopBar.tsx`; `ui/guide/{CapcomCard,nextSteps,showStep,cueTargets,...}` (replace obsolete card with MissionControl and small model/copy); `ui/phases/{Journey,Requirements}.tsx`; `ui/scene/{WorkbenchControls,scene.css}`; `three/{AppCanvas,camera/CameraRig}.tsx` only where measured bottom clearance requires it; `ui/layout/{windows,panelLayout,useWindowViewport,DraggablePanel,windows.css}`; `ui/flight/{FlightBar,Hotbar,flight.css}`; `ui/tour/{tours,TourHost,TourSpotlight,tourStore,...}`; `shell.css`; minimal shared i18n resources registration. Additional target attributes may touch inspector/flight controls as needed. No edits to store, App, Wizard or ui/multiplayer.

Tests: focused mission-control primary-policy/navigation tests; requirements render/model tests where appropriate; updated panel geometry/collapse-focus tests; tour coverage and disclosure reveal tests; translation key parity through existing integration checks. Do not run full tests/build/typecheck here; Main consolidates them. Browser verification is explicitly authorized for this slice.

Docs: update LAYOUTS (controller anatomy, responsive geometry, focus, nav), SCIENCE_UX (requirements/slots/guidance/clock relocation), RENDERIZATION (one Canvas, scene-control mount and measured clear band). Main owns changelog/verification/index.

## Acceptance checks

- Plan approved before first source edit.
- Inspect DOM: exactly one #mission-primary inside bottom mission control; none in TopBar. No floating CAPCOM and no duplicate slots/requirements/Go action.
- Complete First Light Aspiring through brief, camera quote/install, freeze, verify, launch, flight, explicit ended-attempt debrief at 1440/390/320; screenshots per stage after change.
- Measure default Build and flight visible HUD area union at 1440×900, scene ≥60%; verify controller/expanded panels do not overlap each other by default.
- 320px: no horizontal document overflow, each bottom action accessible, localized text wraps, one compact tool/tray at a time, default flight clock reachable without document scrolling.
- Keyboard traverse controls, open/close each tray, panel nav, stage/substep select; collapse and modal/tour focus return; touch alternatives/no accidental scene drag.
- Tours reveal every named mission-control option and each applicable dynamic category/flight option, including disabled-option explanation; no missing-target fallback silently replaces a control. Test manifest coverage.
- pt-BR and app/OS reduced motion: no unlocalized keys, clipping, auto turntable or pulse; simulation remains unchanged by tours/navigation.
- Existing core refusals, team actor signoffs, scientific Explain/evidence and one retained Canvas continue unchanged. LAN presence wraps without adding a dock.

## Risks and decisions / recommendations

1. Bottom density can erase the space gained at top. **Recommendation:** closed content tray, short context sentence, single primary, compact select, four buttons; default mobile panels closed; flight options disclosed. Measure rather than assert scene share.
2. Geometry can feed back through reading-layout classification. **Recommendation:** classify using stable closed controller footprint; reserve actual height for effective geometry; reading remains only for genuine short/zoomed cases.
3. Tour control completeness is more demanding than current five short tours. **Recommendation:** full replayable mission-control coverage plus contextual quote/flight extensions; no automatic mission mutations and no broad whole-panel stand-in for individual controls.
4. Future stage choices must not become bypasses. **Recommendation:** mirror current guards for disabled affordances and retain store authority as final guard; direct current-stage substep navigation only through existing actions.
5. Concurrent session refactor may reload dev. **Recommendation:** frozen baseline for research; use public store API only, post-change visual pass after source lands; communicate only contract blockers.
6. No external assets or new visual framework are needed. No open product decision blocks this plan; Main may approve or revise scope before source work.

## Approval amendments (Main, 2026-11-15)

1. Desktop uses five visible gated chapter buttons (Briefing, Build, Test & launch, Fly, Debrief) plus a native stage/substep select. Compact uses the select only. Remove top progress dots; navigation has one owner.
2. With flight tray closed, retain a one-line next sunlight/shadow/contact edge, its T+ time and advance action. Next contact information never disappears with timeline closure.
3. Full per-control coverage retains stage extensions, visible n/N and Skip for auto-start Aspiring; Expert gets an offer. Coverage-manifest test is required.
4. Preserve Component anchoring/tracker exactly. Controller is an occupied `data-hud-zone="bottom"` and placement stays above it.

## Approved setup refinement (user follow-up, Main ownership transfer)

The follow-up explicitly requests icon-bearing Aspiring/Expert toggle cards, an initially expanded team section, horizontal player columns with role dropdowns, and an informative local-play card. Main approved this extension and transferred Wizard/style/copy/test ownership on 2026-11-15. Preserve the existing `/host` LAN entry and the current prepare/start callbacks; no level-rule or session-authority changes.

- Replace the thin level segmented row with two labelled `aria-pressed` cards, using existing Rocket/Gauge icons and existing truthful level descriptions. Selected state has text plus border, not color alone.
- Keep team setup visibly expanded by default. Player count still supports solo and 2–4 shared-screen participants. Role ownership remains a complete `Record<RoleId, playerIndex>`.
- Display one horizontal column per player. Each assigned responsibility is a native role dropdown; choosing an owned role swaps it with its present owner, so no role is duplicated or lost. An Add responsibility dropdown supports the existing many-roles-per-player model instead of silently limiting teams to one role per person. At 320px columns reflow in normal document flow.
- Make the existing local Start action a single large icon-bearing card-button: name local/shared-screen play, explain one-device operation and retained settings, then Start mission. The LAN link stays semantically separate and makes no claim that a host is already running.
- Add en/pt-BR copy, pure role-swap/transfer tests and focused markup checks. Preserve mission-required validation, explicit display-depth preference, draft persistence and callback semantics. Verify setup at all three requested widths/locales in a refreshed production snapshot.

### Measured compact-flight correction

Production proof exposed a 320px reading-mode regression: the resource strip and three-row footer pushed the clock below the fold. Main approved a structural correction, not a relaxed reading threshold: resource label text now wraps in an explicit flex child; transient pause notices do not select layout mode, while their actual height still bounds tools; at ≤360px the native screen selector sits beside four 44px panel targets, reducing navigation to two rows. Compact hides only the redundant static controller-name text; the labelled region, instruction, Explain, primary and every navigation action remain. Actual en/pt-BR browser proof is required after the refreshed build.
