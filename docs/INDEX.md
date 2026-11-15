# ASTRIX documentation

## Refinement specification and acceptance

[SIMULATOR_REFINEMENT_SPEC.md](./SIMULATOR_REFINEMENT_SPEC.md): historical refinement, superseded by the guided redesign where it specifies four-stage navigation, the dock, or no follow camera.

[MISSION_FLOW_REFINEMENT_SPEC.md](./MISSION_FLOW_REFINEMENT_SPEC.md): mission-design contracts: seven core stages, local collaboration, core authority, crew/CubeSat work, accessibility and optional GMAT tools. The [guided immersive redesign](./plans/GUIDED_IMMERSIVE_REDESIGN_PLAN.md) presents these as five chapters with a scene-first HUD.

## Canonical system documentation

These pages explain the **implemented system**. Start with Architecture, then follow the component relevant to your change. Source code defines current behavior; update its canonical page when that behavior changes. The implementation plan and research briefs preserve decisions and proposed work, not a second runtime specification.

| Page | Responsibility |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Packages, public contracts, state ownership, transactions, lifecycle, dependency boundaries and change routing |
| [MISSIONS.md](./MISSIONS.md) | Mission objectives, roles, control recipes, failures and replay |
| [RESOURCES.md](./RESOURCES.md) | Spacecraft budgets and constraints; scientific data acquisition, snapshots, provenance, evidence and redistribution |
| [SIMULATION.md](./SIMULATION.md) | Clocks, units, stepping order, physical model, command delivery, events, resource integration, history and scoring |
| [RENDERIZATION.md](./RENDERIZATION.md) | Persistent Three.js Canvas, scenes, display coordinates, thumbnails, quality, adaptive resolution and graphics failure boundaries |
| [LAYOUTS.md](./LAYOUTS.md) | Scene-first HUD, collapse-in-place draggable panels, responsive sheets, keyboard/pointer behavior and modals |
| [SCIENCE_UX.md](./SCIENCE_UX.md) | CAPCOM guidance, Show me, spotlight tours, copy depth, explanations and accessibility |
| [TECHNICAL_MODELS.md](./TECHNICAL_MODELS.md) | Six bounded engineering mechanisms, parameter units/ranges/provenance, reference bounds and limitations |

## Evidence and challenge alignment

- [VERIFICATION.md](./VERIFICATION.md): current rules-v3 delivery evidence, integrated and targeted checks, actual browser flights, GMAT/rendering observations and validation limits; earlier sections are historical. A procedure described elsewhere is not a claim that it was run.
- [CHALLENGE_ACCEPTANCE.md](./CHALLENGE_ACCEPTANCE.md): how implemented mechanics address the official Space Mission Design Game objective; submission eligibility remains separate.
- [Credits and provenance](../CREDITS.md), [project licence](../LICENSE) and [third-party notices](../THIRD_PARTY_NOTICES.txt).

## Design and implementation history

- [GAME_IMPLEMENTATION_PLAN.md](./GAME_IMPLEMENTATION_PLAN.md): original features, constraints, algorithms, execution plan and integration checklist. Use the canonical component pages above for current behavior.
- [GUIDED_IMMERSIVE_REDESIGN_PLAN.md](./plans/GUIDED_IMMERSIVE_REDESIGN_PLAN.md): approved Line B scope, implementation workstreams and acceptance criteria.
- [MULTIPLAYER_LAN_PLAN.md](./plans/MULTIPLAYER_LAN_PLAN.md): future main-computer/QR/phone play; follows the redesign and does not block it.
- [Space Mission Design Game design brief](./challenges/space-mission-design-brief.md): problem, product decisions, audience, scope and later Guided/floating-space decisions.
- [Earlier mission-design mockup](./challenges/space-mission-design-mockup.md): planning sketches, not screenshots or a description of the current default interface.
- [Original resource map](./challenges/space-mission-design-resources-map.md): planned resource-to-screen mapping; [RESOURCES.md](./RESOURCES.md) describes the implemented pipeline.

## Challenge research

- [Space Mission Design Game](./challenges/space-mission-design-game.md): recorded challenge text and listed resources.
- [Build a Junior Astronaut Mission Trainer](./challenges/junior-astronaut-mission-trainer.md): the alternative outpost challenge for ages 7–12, not the shipped ASTRIX mission game.
- [Comparison and recommendation](./challenges/COMPARISON.md): historical comparison of the two challenge directions.
- [Verified facts and data points](./research/verified-facts.md): researched values and source citations; computed teaching values remain qualified.
- [Independent GMAT reference](./research/gmat-validation.md): recorded external reference run and comparison context.
- [Junior trainer resource audit](./research/junior-trainer-resources-report.md): access notes, caveats and suggestions for that alternative challenge.
- [Void Protocol reuse report](./research/void-protocol-reuse.md): approved reuse decisions and pinned-source research. Actual adaptations are listed in [CREDITS.md](../CREDITS.md).

## Local research assets

- [nasa.json](../nasa.json): local USGS Astrogeology export, not live telemetry.
- [nasa-visualizer.html](../nasa-visualizer.html): standalone explorer for that export, separate from the React game.
- Original reuse source: `~/dev/void_protocol/` at `218625d`; no checkout is required to run the shipped game.

## Reading deployed documentation

Root dev/build preparation copies Markdown and notices into the static site's public files. It does not render a documentation website or deploy the repository source tree. Source-file links in these pages are repository-relative; use a repository checkout/viewer to follow them. See [RESOURCES.md](./RESOURCES.md#credits-and-public-document-packaging).
