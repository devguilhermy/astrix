# Rendering

Rendering illustrates committed scientific state; it never advances physics, spends fuel, acquires data or judges objectives. The **always-visible 3D scene is the main game surface**, with preparation, turn and debrief panels over it. The [turn-based revision](./plans/TURN_BASED_EXPLORATION_REVISION.md) removes engineering bureaucracy, not immersion. If WebGL fails, an explicit error leaves semantic mission controls usable rather than manufacturing a rendered success.

## Current surfaces

| Surface | Source | Authority boundary |
|---|---|---|
| Persistent space, destination and installed spacecraft scene | `apps/web/src/three/AppCanvas.tsx`, `three/spacecraft/SpacecraftModel.tsx` | Reads candidate design or committed telemetry; camera changes never advance mission time |
| Scientific flight geometry | Core flight state and optional evidence plots | Model-derived positions and frames, not a renderer-owned objective evaluator |
| External GMAT/OEM inspection | `apps/web/src/ui/advanced/AdvancedTools.tsx` | Read-only sampled reference data, no resource history or score |
| Decision preview and receipt | `apps/web/src/ui/play/TurnWorkspace.tsx` | Display results from the shared core resolver, not a web-side physical estimate |

## Spacecraft context

One R3F Canvas stays mounted across mission selection, preparation, play, debrief and tools. It uses bounded pixel ratio and paid catalogue-derived spacecraft geometry. Destination/equipment previews are distinguished from committed flight state. Spacecraft enlargement and schematic separations are disclosed where used for legibility. Camera controls have labelled DOM/keyboard alternatives; installed hardware also has a textual manifest.

Context loss or a renderer error shows an explicit unavailable message while preserving mission controls and state. A visual failure must not abort, reset or silently advance a flight. Decorative motion is not required; reduced-motion preferences must not change physical results.

## Flight geometry

Core stores body/frame-qualified kilometre positions and km/s velocities. A displayed Cartesian path is a projection, not a map-coverage result or photographic observation. Central-body switches require consistent origins: never join Earth-relative samples to Moon-relative samples as one continuous line under a single body label.

A reached altitude does not prove a bound orbit. A sphere-of-influence crossing does not establish lunar capture. The objective evaluator, not a scene transition or camera shot, owns those claims. Flight history can be bounded/decimated, so displayed lines must not imply higher temporal fidelity than their samples.

Preview trajectories, measured history and imported reference samples are different data products. A prediction is not flown evidence; imported positions contain no actual game fuel, energy, crew or data history. Mars analytical cruise must not be illustrated as continuously simulated engineering telemetry.

## External trajectory viewing

GMAT initial-state export/import supports the explicitly documented Earth/Mars profile. The sampled ReportFile/OEM viewer displays source, object, body, frame, time system and units. Supported OEM uses EME2000/UTC with km and km/s. Unsupported lunar interchange is refused even though lunar gameplay exists.

The viewer offers XY/XZ projections, native time selection and optional playback. It draws separate segments and gaps. Position interpolation is linear only within a segment and across adjacent samples no more than 120 seconds apart. There is no extrapolation; a gap displays no craft and explains why. Decimation limits drawing work without inventing missing samples. Playback changes only reference-view time.

Uploaded text is parsed in a cancellable worker and never executed. Importing a supported initial state explicitly opens a compatible preparation candidate; normal constraints and real readiness certification still apply. Export is initial conditions, not a full mission sequence or independent validation of a whole flight.

## Provenance and verification

Procedural spacecraft geometry and plotted paths are application-generated illustrations. NASA/USGS imagery, references and mission comparisons retain their separate credits and limitations in [Resources](./RESOURCES.md) and [Credits](../CREDITS.md). None is NASA endorsement.

Functional checks exercise core-to-view data boundaries; browser inspection verifies persistent scene visibility, contextual turn panels, compact layouts, keyboard access and error behavior. It cannot establish scientific fidelity beyond the underlying model or human enjoyment. Record only observed results in [Verification](./VERIFICATION.md).
