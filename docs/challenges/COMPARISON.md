# Junior Astronaut Mission Trainer vs Space Mission Design Game

Both are 2026 Space Apps challenges at Intermediate / Beginner-Youth level that ask for a game teaching real engineering trade-offs. Details: [junior trainer](./junior-astronaut-mission-trainer.md) · [mission design](./space-mission-design-game.md) · [verified facts](../research/verified-facts.md).

## Side by side

| | Junior Astronaut Mission Trainer | Space Mission Design Game |
|---|---|---|
| Audience | Kids 7–12, fixed | Different knowledge levels; youth through intermediate |
| Core loop | **Survive over time**: split power each sol and react to events | **Design, then operate**: build a spacecraft against budgets, launch, simulate, review |
| Resources to track | 2–3 recommended (life support, power, shielding) | Mass, power, budget, data, comms, time; more systems by design |
| Real data in resources | **Strong**: DONKI, RadLab and OSDR APIs, Mars Trek tiles | **Weak**: documents and tools (CubeSat 101, CMLs, MDL, GMAT, Mission Viz); no data API |
| What judges reward (per page) | Real space-weather linkage, replayability, traceable data write-up | Working configuration + resource system, **up to 4-player collaboration**, simulation and evaluation, post-mission analysis |
| Precedents to beat | Few kid-level trade-off games | NASA's own Webb telescope game and the CSA OSIRIS-REx game already exist; the bar is higher |
| Hackathon scope | Small; a full loop is realistic in a weekend | Large; multiplayer and simulation are where the time goes |
| Research already done | Data pulled and checked (DONKI event, RadLab sample, Mars doses, Trek tiles, OSDR study) | Limits extracted (CubeSat mass classes, segments, CML stages); no gameplay data beyond that |
| Teams tab (2026-11-14) | Lists 2,009 teams | Lists 2,029 teams |

The two team counts are nearly identical. They may include all challenges rather than one each; I haven't verified that, so don't treat them as a measure of competition.

## Fit with what we already have

| Asset | Junior trainer | Mission design |
|---|---|---|
| **Void Protocol architecture** | Medium. Reuses the refusal codes, cue coach, death-details debrief, difficulty profiles and history chart. The 3D engine, economy and multiplayer go unused. | **High.** Its quote/refusal pattern (`resourceConversion`) *is* a mass and power budget check. Hardware slots and capacities (`gridCapacity`, ship caps, cargo hardware) map onto a spacecraft bus. The mission score formula and `GameOverPanel` post-mortem map onto the mission report. Difficulty profiles map onto scenarios. **Rooms and actors already exist for multiplayer**, matching the 4-player requirement. R3F/Three.js covers the orbit and spacecraft view. The Flight Manual and cue engine become a "design review" advisor. |
| `nasa.json` (USGS catalog) + visualizer | A Mars site image (Gale crater THEMIS products) | **Better**: the mission facets support the Webb-style "real missions like yours" reveal (e.g. a thermal-imaging Mars orbiter → Mars Odyssey's 119 products), and the visualizer can be embedded as the reveal screen |
| Verified radiation data | Central mechanic | Usable as an orbit hazard (RadLab ISS dose for LEO; Mars surface and deep-space comparisons) |

## Which is cooler

**The Space Mission Design Game.** You build a spacecraft from real parts against real limits (a 3U CubeSat under 4.00 kg, per CubeSat 101), pick a launch and an orbit, watch it fly, and four friends argue over the power budget. That has more depth, replay value and room to show off, and it naturally uses the 3D and multiplayer work Void Protocol already has. The junior trainer has the better *story* (the real May 2024 solar storm that hit Curiosity), but its mechanics are deliberately small for a 7-year-old.

## Which fits best

**Mission design, if the team can scope it**, because nearly every structural piece maps onto Void Protocol and `nasa.json` gives it a unique reveal. Three conditions:

1. **Scope multiplayer down.** Use local hot-seat or shared-screen roles first, and a lightweight WebSocket room second. Do not bring in Void Protocol's Postgres/auth/billing stack; the page says multiplayer "could" be included, not must.
2. **Source every number.** The resources contain no data API, so each part's mass, power, cost and data rate needs a citation (CubeSat 101, NASA mission pages) or a visible "game assumption" label. This is the main risk to credibility.
3. **Keep the simulation honest and coarse.** Use a table of orbit options with cited properties, not GMAT-grade propagation; GMAT can produce that table offline.

**Choose the junior trainer instead** if the team is one or two people, or wants the lowest-risk path to a polished entry. Its data grounding is already verified, its scope is small, and its judging criteria (real space weather, traceable data) are ones we can already meet.

## Shared work either way

- Pure turn reducer with typed refusal reasons ("why can't I do this?").
- Cue/coach rules linked to glossary and science cards with source links.
- End-of-run debrief: history chart plus cause analysis.
- i18n (EN/FR, matching CSA's bilingual material), reduced motion, no account, static deploy.
- A data-snapshot script that records the source URL and retrieval time for every embedded value.
