# Changelog

Shipped changes, newest first. Evidence for each entry is in [VERIFICATION.md](./VERIFICATION.md); scope and decisions are in the linked plans.

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
