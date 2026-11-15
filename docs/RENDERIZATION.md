# Rendering

Rendering illustrates committed scientific state; it never advances physics, spends fuel, acquires data or judges objectives. The **always-visible 3D scene is the main game surface**, with preparation, turn and debrief panels over it. The [turn-based revision](./plans/TURN_BASED_EXPLORATION_REVISION.md) removes engineering bureaucracy, not immersion. If WebGL fails, an explicit error leaves semantic mission controls usable rather than manufacturing a rendered success.

## Current surfaces

| Surface | Source | Authority boundary |
|---|---|---|
| Persistent space, destination and installed spacecraft scene | `apps/web/src/three/AppCanvas.tsx`, `three/spacecraft/SpacecraftModel.tsx` | Reads candidate design or committed telemetry; camera changes never advance mission time |
| Scientific flight geometry | Core flight state and optional evidence plots | Model-derived positions and frames, not a renderer-owned objective evaluator |
| External GMAT/OEM inspection | `apps/web/src/ui/advanced/AdvancedTools.tsx`, `apps/web/src/three/gmat/GmatScene.tsx` | Read-only reference data drawn in the shared Canvas: conic or sampled path, apsides, timed playback; no resource history or score |
| Decision preview and receipt | `apps/web/src/ui/play/TurnWorkspace.tsx` | Display results from the shared core resolver, not a web-side physical estimate |

The public landing is separate from the simulator. Its entry opens free solar-system exploration before the mission board. The overview includes Sun, eight planets and Moon with schematic spacing/radii and DOM alternatives to picking; exploration does not extend the core's supported mission bodies.

## Spacecraft context

One R3F Canvas stays mounted across solar exploration, mission selection, preparation, play, debrief and tools while the simulator is open; returning to the landing unmounts it with the rest of the simulator. It uses bounded pixel ratio and paid catalogue-derived spacecraft geometry. Destination/equipment previews are distinguished from committed flight state. Spacecraft enlargement and schematic separations are disclosed where used for legibility. Camera controls have labelled DOM/keyboard alternatives; installed hardware also has a textual manifest.

Successive decision snapshots preserve the user's camera orientation, zoom and pan. Following a changed craft position translates the camera and its target together; only a new mission/body/mode, focus selection or explicit Reset reframes the view. Scene framing accounts for the widened panels and persistent resource grid.

Context loss or a renderer error shows an explicit unavailable message while preserving mission controls and state. A visual failure must not abort, reset or silently advance a flight. Decorative motion is not required; reduced-motion preferences must not change physical results.

## Flight geometry

Core stores body/frame-qualified kilometre positions and km/s velocities. A displayed Cartesian path is a projection, not a map-coverage result or photographic observation. Central-body switches require consistent origins: never join Earth-relative samples to Moon-relative samples as one continuous line under a single body label.

A reached altitude does not prove a bound orbit. A sphere-of-influence crossing does not establish lunar capture. The objective evaluator, not a scene transition or camera shot, owns those claims. Flight history can be bounded/decimated, so displayed lines must not imply higher temporal fidelity than their samples.

Preview trajectories, measured history and imported reference samples are different data products. A prediction is not flown evidence; imported positions contain no actual game fuel, energy, crew or data history. Mars analytical cruise must not be illustrated as continuously simulated engineering telemetry.

## External trajectory viewing

GMAT initial-state export/import supports the explicitly documented Earth/Mars profile. The 3D GMAT view displays source, object, body, frame, time system and units; conics are ASTRIX two-body motion and trajectory positions between samples are linear display interpolation (see [GMAT support](./GMAT_SUPPORT.md)). Supported OEM uses EME2000/UTC with km and km/s. Unsupported lunar interchange is refused even though lunar gameplay exists.

The viewer offers XY/XZ projections, native time selection and optional playback. It draws separate segments and gaps. Position interpolation is linear only within a segment and across adjacent samples no more than 120 seconds apart. There is no extrapolation; a gap displays no craft and explains why. Decimation limits drawing work without inventing missing samples. Playback changes only reference-view time.

Uploaded text is parsed in a cancellable worker and never executed. Importing a supported initial state explicitly opens a compatible preparation candidate; normal constraints and real readiness certification still apply. Export is initial conditions, not a full mission sequence or independent validation of a whole flight.

## Provenance and verification

Procedural spacecraft geometry and plotted paths are application-generated illustrations. NASA/USGS imagery, references and mission comparisons retain their separate credits and limitations in [Resources](./RESOURCES.md) and [Credits](../CREDITS.md). None is NASA endorsement.

Functional checks exercise core-to-view data boundaries; browser inspection verifies persistent scene visibility, contextual turn panels, compact layouts, keyboard access and error behavior. It cannot establish scientific fidelity beyond the underlying model or human enjoyment. Record only observed results in [Verification](./VERIFICATION.md).

## 2026-11-15: clearance, turn feedback, replay, true-scale Explore and the ship

Details: [major improvements recap](./recaps/MAJOR_IMPROVEMENTS.md) §4.2, §4.5, §4.7, §4.8 and §6.

- **Hardware size:** `craftScale = 0.2 / hardwareRadiusM(design)`, where the radius includes deployed wings, whips and dishes, so every craft has a displayed hull radius of 0.2 planet radii.
- **Clearance:** displayed radius = `max(true, ground + (floor − ground) × smoothstep(0, 100 km, altitude))` with `ground = 1 + hull + 0.004` and `floor = shell + hull + 0.06`. The true-position marker and tether stay at telemetry. The camera is kept outside every body.
- **Lines:** `SceneLine` is drei's `Line` (screen-space width, optional dashes); transparent lines do not write depth.
- **Labels:** every in-scene `Html` goes through `SceneHtml`, which renders into a host that exists before the Canvas mounts. This removed the `removeChild` exception.
- **Turn feedback:** waves, link, dish, footprint and numbered turn markers are drawn only from committed receipts. When a turn does not end in contact, the link starts at the marked "Pass over the station" point.
- **Replay:** imperative updates inside the frame callback while playing; the Canvas stays `frameloop="demand"`. Reduced motion shows the end state only.
- **Night side:** a dim, cool fill (0.055) keeps terrain legible; it is display lighting, not data.
- **Sun:** drawn unlit from the STEREO + SDO 304 Å map, with no atmosphere shell. In a Sun-centred mission scene Earth is an enlarged, labelled marker.
- **Explore:** Sun radius 6; other radii to scale; compressed orbit radii; pick spheres and locator dots for small bodies. The ship takes over the camera while aboard and renders only while something moves.
