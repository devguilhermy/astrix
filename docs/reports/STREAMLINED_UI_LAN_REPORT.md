# Streamlined mission control and LAN groundwork — delivery report

2026-11-15. Current behavior is specified by the [canonical index](../INDEX.md); observed checks are recorded in [Verification](../VERIFICATION.md). This report covers the reviewed UI refinement and the separately scoped multiplayer W1–W4 groundwork, not completed multi-phone mission gameplay.

## Delivered interface

- One bottom contextual MissionControl replaces the separate CAPCOM surface, header Continue and scattered collapsed panel pills. It combines the real next action, requirements, spacecraft slots, checklist, flight options, gated chapter/substep navigation and tool visibility.
- Only one options tray opens at a time. Closed tools consume no scene area. Desktop Workshop has a bounded default and closes on entering flight; compact tools start closed. Expanded tools retain their geometry and keyboard alternatives.
- Flight keeps the next geometric edge, absolute T+ time, advance action and next contact visible with options closed. The detailed timeline, commands, warp and pilot controls are disclosed without becoming a second fixed deck.
- Component inspection remains view-only and anchored beside the projected part on desktop; dragging detaches it and Follow component restores tracking. Measured controller bounds protect the occupied bottom zone.
- Welcome, Build, Launch, Flight, Debrief and actual-quote Choice tours enumerate individual controls, show progress and retain Skip/Back/Next. Completion moved to device-local `astrix.tours.v2`; tours reveal controls without completing mission work or manufacturing transactions.
- Setup uses Aspiring/Expert icon toggle cards, an expanded team section, horizontal player columns with native responsibility dropdowns, narrow-screen reflow and an informative local-play card. Role reassignment preserves every required discipline; LAN entry stays separate.

The UI worker researched with Impeccable, wrote the [plan](../plans/STREAMLINED_MISSION_CONTROL_PLAN.md), and implemented it only after main review/amendment. Main owned integration and final canonical documentation.

## Delivered multiplayer foundation

| Layer | Implemented boundary |
|---|---|
| Pure session authority | Typed mission transactions, role/actor checks, revision-bound quotes/approvals, pause/decision policy, attempts/checkpoints, bounded replay/results/history and deterministic clock progression |
| Protocol | Runtime validation, no arbitrary design/resource writes, epoch/attempt/revision checks, correlated and deduplicated outcomes, bounded public snapshots and paged history |
| Bun host | Explicit private-interface selection, separate loopback bootstrap, local production assets, serialized room work, monotonic clock and explicit stall pause |
| Admission | Local QR/manual invitation, expiring tickets, host approval, role allocation, Ready and four device sessions including the host |
| Continuity | Stale-input protection, reconnect/resynchronization, browser-refresh recovery while Bun lives, revocation and explicit host-only continuation |
| Web projection | The existing public mission actions dispatch local session intents or remote intents; LAN browsers never step a second simulation |

Session/protocol integration and host/network integration were implemented by two independent workers under shared authority contracts. The host is plaintext HTTP/WebSocket on a trusted LAN, not an internet service. Details, commands and operator troubleshooting are in [Multiplayer](../MULTIPLAYER.md).

## Verification observed

| Check | Observed result |
|---|---|
| Consolidated typecheck | Passed, including host source |
| Consolidated test suite | 307 passed, 0 failed, 48 files, 51,340 assertions |
| Production build | Passed, 2,896 modules; existing large-chunk warning remains |
| Later compact-layout regression/resource checks | 18 passed; typecheck and build passed again |
| Final compact-navigation CSS | Production build passed after the narrower selector/panel-row change |
| Setup browser proof | 1440×900 and 320×844; icon cards, expanded team, actual role swap, reflow and local-play card; 320 px document width, no browser errors |
| LAN browser rehearsal | Actual private-address HTTP/WebSocket, host plus three client tabs; admission/Ready, shared mission, host/phone refresh recovery, fourth-phone refusal, host-only continuation |
| Host startup recovery | Corrected data-font CSP; blocked the dynamic app chunk, observed bilingual failure, restored requests and successfully used Reload under self-only scripts |
| Final UI browser proof | All six recorded tours walked without missing cutouts; 320/390 px flight stayed compact in en/pt-BR; keyboard focus return, touch emulation and app reduced motion exercised |
| Default desktop scene share | Build 61.72%; flight 65.48% at 1440×900 |
| Documentation | 205 local links across 18 pages resolved; fenced blocks balanced; public-doc preparation passed |

The initial combined run found one Unicode note-normalization defect and three stale pilot fixtures. The reducer normalization and public-action fixture setup were corrected; affected checks passed before the consolidated green run. Browser measurement also found 320 px flight controls pushed into document flow. Resource text wrapping, transient-notice classification and compact controller rows were corrected rather than reducing touch targets or weakening reading-layout thresholds. The full suite was not re-counted after the additional geometry regression; 307 is the observed consolidated result, not an inferred final total.

## Documentation cutover

Updated README and canonical Architecture, Layouts, Science UX, Rendering, Simulation, Resources and Missions to match implemented boundaries. Added the LAN operational runbook; aligned the index, challenge acceptance, plan statuses, verification record and changelog. In particular, removed stale claims about header Continue, draggable collapsed pills, tour-storage v1, universal reading pauses, all reloads losing a LAN room, and multiplayer being only a future plan. Scientific coefficients and physical-model claims were not changed by this UI/network wave.

## Explicit limits

- Dedicated phone design and flight consoles (W5/W6), network pose interpolation and full role-specific phone command journeys are not implemented.
- The browser rehearsal used separate desktop Chromium tabs and mobile viewports, not physical iOS/Android devices. Native-camera QR scanning, WAN-disconnected operation, AP isolation/firewall variations, storage denial, long reconnects and OS suspension remain unverified here.
- The Bun room is memory-only: browser refresh is recoverable while it lives, process exit is not. No host migration, persistent room restore, internet matchmaking or encrypted hostile-network deployment is claimed.
- Rules/core remain educational reduced models. This work does not establish flight qualification, a novice usability study, independent Portuguese/science review, new GPU-performance guarantees or a new end-to-end flight for every scenario/level.
- UI browser coverage was First Light/Aspiring, ended explicitly to reach terminal debrief, not a newly successful mission run. Other mission/Expert branches and OS-level reduced-motion emulation remain manually unverified. A transient graphics-interrupted notice recovered after reload/new attempt; cause remains uninvestigated. Impeccable's detector reported five incumbent styling findings, not a clean pass; details are in Verification.

The next separately scoped multiplayer work is the phone design/flight surfaces and physical-device qualification described in the [LAN plan](../plans/MULTIPLAYER_LAN_PLAN.md); it is not hidden behind a claim that groundwork equals complete multiplayer.
