# Changelog

Shipped changes, newest first. Evidence for each entry is in [VERIFICATION.md](./VERIFICATION.md); scope and decisions are in the linked plans.

## Unreleased — Design & Play and decision-based exploration

**Integrated verification in progress; see the newest verification record before claiming release acceptance.**

- Replaced the player-facing studio/stage/signoff workflow with a mission board, bounded quick design and one turn workspace for Aspiring and Expert.
- Added engine-backed feasibility witnesses, real kit/ambition/approach constraints, preview/commit/receipt contracts and same-condition retries.
- Adapted the short lessons and original challenges, retaining powered ascent, finite-fuel maneuvers, reduced lunar flight and objective evidence.
- Added local decision-boundary saves, explicit invalid-save/write-failure handling and a discovery/debrief loop.
- Protocol 3: controllers propose, the host commits; removed the production host flight clock. Stale/duplicate commitments, reconnect and idle-time behavior have dedicated regression coverage.
- Retained optional GMAT initial-state interchange and sampled-trajectory inspection outside the normal play loop.
- Reconciled canonical architecture, gameplay, simulation, UI, multiplayer and NASA-resource documentation with the approved revision.

The prior unreleased Expert Studio and automatic 15-card workflow were superseded by this revision; older entries below describe their original builds, not the current interaction.

## 2026-11-15 — Bottom mission control and LAN groundwork

### Interface

- Consolidated the contextual instruction and primary action into one bottom mission controller; removed the separate top-bar Continue and floating CAPCOM card.
- Moved requirements, spacecraft slots and checklist into disclosed bottom trays. Added chapter/stage navigation and four panel buttons in the same surface instead of scattered collapsed panel pills.
- Embedded flight controls in the controller, retaining the next geometric event summary and advance action when the flight tray is closed.
- Extended tours to individual controller options, with progress counts, Skip and state-specific Build/Launch/Flight/Debrief coverage. Component inspection remains device-local and anchored clear of the controller.
- Refined mission setup: icon toggle cards for Aspiring/Expert, team controls expanded by default, horizontal player columns with role dropdowns (reflowing on narrow screens), and informative local-play/LAN entry cards. Role reassignment swaps/transfers ownership without losing a required discipline.
- Design and baseline measurements: [reviewed UI plan](./plans/STREAMLINED_MISSION_CONTROL_PLAN.md).

### LAN groundwork

- Added pure `@astrix/session` authority shared by static solo/hot-seat and the Bun room: mission transactions, actor/role permissions, scoped pauses, bounded snapshots/history, request validation and deduplicated outcomes.
- Added `bun run host`: selected private-interface HTTP serving, loopback-only host bootstrap, one in-memory authoritative room, QR/manual invitations, host admission and a four-device cap including the display.
- Added lobby ownership/Ready controls, presence, reconnect/resynchronization, stale-input handling, browser-refresh continuity and explicit host-only continuation. LAN browsers project snapshots rather than stepping their own simulation.
- Added locally bundled MIT `qrcode-generator`; recorded attribution and notices. Removed the startup recovery button's inline JavaScript handler for the host's self-only script CSP; allowed bundled data-font URLs separately.
- Deployment and plaintext trusted-LAN boundary: [MULTIPLAYER.md](./MULTIPLAYER.md).

### Scope and evidence

- Dedicated phone design/flight consoles (multiplayer W5/W6) are not implemented. This is admission/session/network groundwork, not complete phone gameplay.
- Bun process loss ends the room; no internet matchmaking, persistent room restore or host migration. Physical iOS/Android, access-point isolation, firewall and suspension testing remain separate from desktop-browser checks.
- Current observed checks and limitations are recorded in [VERIFICATION.md](./VERIFICATION.md).
- Canonical architecture, simulation, rendering, layout, science UX, resources, missions and deployment guidance were reconciled with the implementation. [Delivery report](./reports/STREAMLINED_UI_LAN_REPORT.md) records scope, integration findings and remaining qualification limits.

## 2026-11-15 — Guided, immersive redesign (rules v4)

Implements Line B of the [guided immersive redesign plan](./plans/GUIDED_IMMERSIVE_REDESIGN_PLAN.md). Commits `0156efe`, `e77e7df` and the documentation commit that adds this file.

### Breaking

- **Rules version 4.** Attitude is a rate-limited quaternion with +X solar-panel normal and +Z instrument/antenna boresight. Power, imaging and radio depend on where the spacecraft actually points, not on a mode name. Best scores are kept per rules version, so rules-v3 results stay separate and are not relabelled; rules-v3 flight snapshots are rejected. The golden test now replays invariants rather than fixed v3 traces.

### Added

- **Scene-first shell:** a slim top bar with five chapters (Briefing, Build, Test & launch, Fly, Debrief) over the unchanged seven core stages, plus one primary action.
- **Resource badges:** seven always-visible badges (mass, power, budget, data, comms, time, crew) with bars, FORECAST/LIVE state and before → after deltas from real core quotes.
- **CAPCOM next step** with **Show me**, which reveals and highlights the control or spacecraft slot without completing anything.
- **Spotlight tours** for Welcome, Build, Launch, Flight and Debrief. They are device-local, start automatically in Aspiring and are offered in Expert. A flight tour pauses with reason `tour` and never resumes by itself.
- **Spacecraft workbench:** a true-proportion model with one slot per part, ghost previews, exploded and dimension views, and an opt-in turntable.
- **Component panel:** click a part or slot (keyboard lists while building and in flight) to see its specifications, simulator constraints and live readings. On desktop it is anchored beside the part and follows it as the view moves until you drag it.
- **Open space:** a NASA SVS Deep Star Map sky, Blue/Black Marble Earth with day/night and atmosphere, the Sun from a low-precision ephemeris, a floating origin with logarithmic depth, a true-scale spacecraft in close shots and markers in map view. A procedural sky is the fallback.
- **Camera rig** with Chase, Inspect, Map, Workbench and Cinematic modes, keyboard shortcuts and a HUD-measured clear band.
- **Flight deck:** a forecast timeline (sunlight, eclipse, contact, events), a command hotbar, a centred decision overlay and event toasts.
- **Manual steering:** drag, `WASD/QE` or the touch pad sends `ATTITUDE_TARGET`. It needs contact for uncrewed missions, adds one-way light time at Mars and runs onboard for crew. It is limited to ≤10× warp and offers "Slow to 10× and steer".
- **Dry run:** `forecastMission` runs in a Web Worker before launch, with a disclosed DEFAULT policy. It is never scored.
- **Recovery surfaces:** a styled bilingual startup screen, layout and application error boundaries, an in-app 404 and a standalone `404.html`.

### Changed

- Setup is one screen: mission, level and an optional "Play as a team".
- Panels collapse in place to draggable pills; compact screens use one bottom sheet, and short or zoomed views use a reading layout.
- Aspiring copy is shorter. Disclaimers moved to Explain and Help → Model limits; none was deleted.
- After a terminal outcome, guidance points to the debrief, the replay and redesign. Redesign keeps the accepted brief and paid hardware, but freeze, verification and sign-offs are redone.

### Removed

- `MissionHeader`, `PanelDock`, the substep tab strip, the store-backed six-step tour, `MissionCamera`, the 200-point star field and the workbench floor.

### Fixed

- First Light's missing Earth camera is now surfaced during Build instead of one stage later.
- Earlier tour targets that no longer existed in the page are gone.
- Shader compilation in production (missing `<common>` before log-depth chunks).
- The setup route resolving to a filesystem URL.
- Quick steering taps that were lost before the next frame.
- A duplicate Sun in the transfer map.
- Panels and pilot controls covered by the flight deck or badges.
- At 320 px: a clipped top-bar label, scene widgets hidden behind the badges, and pill titles wrapping over their badges.

### Reuse and assets

- Void Protocol code, adapted or patterned only from pin `218625d`: tour spotlight and navigation, resource grid and badge, cue highlight, collapse-in-place header, tracked-panel placement and projection, camera easing and flight-input approach. No VP flight physics was copied. Rows are in [CREDITS.md](../CREDITS.md) and [void-protocol-reuse.md](./research/void-protocol-reuse.md).
- NASA texture sources and derivative commands are listed in `apps/web/public/textures/asset-sources.json`.

### Known limits

- Not built: engine burns (S3), the operations plan (W13) and multiplayer; the [LAN plan](./plans/MULTIPLAYER_LAN_PLAN.md) is separate.
- Gzip JavaScript is 663,604 B, 16 % above the rules-v3 baseline.
- Not walked in the browser: 200 % zoom, Crew Pathfinder steering and the Red Relay transfer and capture.
- The Aspiring 25-word limit is not measured.
