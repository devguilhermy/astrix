# Credits and provenance

## Project and licence

ASTRIX Mission Studio is developed for the NASA Space Apps 2026 **Space Mission Design Game** challenge. The repository uses Apache-2.0 (`LICENSE`). NASA, USGS and CSA links are references, not endorsements. No NASA logo, insignia, original Void Protocol branding, unknown-origin audio or sci-fi ship model is bundled.

The source owner authorized reuse of selected Void Protocol components. Only the adapted components listed in the final per-file table below are part of this release; the complete Void Protocol repository is not relicensed or bundled.

## Scientific, educational and data references

| Resource | Publisher | Use |
|---|---|---|
| [Space Mission Design Game](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/) | NASA Space Apps | Challenge requirements |
| [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf) | NASA CSLI | CubeSat packaging and mass limits; listed challenge resource |
| [Design and Develop Science Missions](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf) | NASA | Mission phases and system disciplines; listed challenge resource |
| [Concept Maturity Levels](https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299) | NASA/JPL | Design-stage terminology; listed challenge resource |
| [Mission Design Lab](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/) | NASA Goddard | Collaborative discipline roles; listed challenge resource |
| [GMAT](https://software.nasa.gov/software/GSC-19468-1) | NASA | Independent orbital reference run; listed challenge resource. Runtime Apache-2.0, used outside the repository, not bundled. See docs/research/gmat-validation.md |
| [Mission Viz](https://nasa.github.io/mission-viz/) | NASA | Orbit visualization reference; listed challenge resource, not copied assets |
| [Build It Yourself: telescope game](https://science.nasa.gov/mission/webb/game-build-it-yourself/) | NASA | Design-and-review game precedent; listed challenge resource |
| [Digital Games and Activities](https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp) | Canadian Space Agency | Educational game precedent and educator links; listed challenge resource |
| [Earth](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html), [Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html), [Sun](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html) fact sheets | NASA NSSDCA | Physical constants in the simplified model; extra sources |
| [SmallSats definition](https://www.nasa.gov/smallsat-institute/what-are-smallsats-and-cubesats/) | NASA | Small spacecraft class definition; extra source, not a flight qualification |
| [RadLab](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) | NASA OSDR | Committed ISS DosTel1 radiation sample, May 10–11 2024; extra source |
| [DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | NASA GSFC/CCMC | Archived event metadata and narrative context; extra source |
| [Mars solar-storm article](https://www.nasa.gov/solar-system/planets/mars/nasa-watches-mars-light-up-during-epic-solar-storm/) | NASA | Curiosity RAD surface-dose context; not an orbital-dose measurement |
| [Astrogeology catalogue](https://astrogeology.usgs.gov/) | USGS | User-provided nasa.json export, mission facet counts and product links; title-based product associations are heuristic |

Source URLs, dates, assumptions and processing methods are also recorded with the committed snapshots and in the game's sources panel. Data and catalogue values are not presented as live telemetry. Linking a third-party thumbnail does not transfer ownership or imply that every linked product has the same licence; consult the linked product's metadata before downstream reuse.

## Surface map assets

| Bundled asset | Source and credit | Epoch, projection and use |
|---|---|---|
| `apps/web/public/textures/earth-blue-marble-1024.png` | [NASA SVS exact image](https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-1024.png), [source and credit](https://svs.gsfc.nasa.gov/2915/): NASA/Goddard Space Flight Center Scientific Visualization Studio; Blue Marble Next Generation courtesy Reto Stockli (NASA/GSFC) and NASA Earth Observatory | Historical MODIS composite; the page describes June–September 2001 observations and also lists 2004 BMNG. Global 1024×512 longitude/latitude map. Not current weather. NASA [media-use guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) apply; no endorsement implied. |
| `apps/web/public/textures/mars-viking-1024.jpg` | [USGS exact sample](https://astrogeology.usgs.gov/ckan/dataset/dfdc2242-52dc-4126-bc89-03af8253ae79/resource/0d7b31dc-0b2e-4ca6-89dc-e3c1404c0232/download/mars_viking_clrmosaic_global_1024.jpg), [catalogue](https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m): USGS Astrogeology Science Center and NASA Viking | Viking 1976–1980 images; red/violet and synthesized green. Simple cylindrical, planetocentric positive east, −180° to 180°. USGS lists public-domain access and no use constraints. Historical composite, not live imagery. |
| `apps/web/public/textures/starmap-2020-{4096,1024}.jpg` | [NASA SVS Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/), [exact 4k EXR](https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr): NASA/Goddard Space Flight Center Scientific Visualization Studio; Gaia DR2: ESA/Gaia/DPAC ([citation instructions](https://gea.esac.esa.int/archive/documentation/GDR2/Miscellaneous/sec_credit_and_citation_instructions/)) | Celestial ICRF/J2000 map; right ascension zero at centre, increasing left. Converted to sRGB JPEG; LOW resized to 1024×512. Not live observations. |
| `apps/web/public/textures/earth-blue-black-marble-4096.webp` | [Blue Marble Next Generation base map](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/) ([January 2004 exact image](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg)), NASA Earth Observatory / NASA Goddard, Reto Stockli; [Black Marble maps](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/) ([2016 grayscale exact image](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144897/BlackMarble_2016_3km_gray.jpg)), NASA Earth Observatory / NASA Goddard / NASA-NOAA Suomi NPP VIIRS | Historical cloudless day RGB and grayscale night luminance packed into lossless WebP alpha at 4096×2048. Night tint is illustrative. Source/derivative records are in `public/textures/asset-sources.json`; no artificial city positions or current-weather claim. |

Display is illustrative: image orientation is mapped to the reduced uniformly rotating body, not a precision IAU surface model. Image data are separate from JS bundle size and core simulation state.

## Third-party runtime libraries

Versions below were observed after the initial `bun install`; the resolved lockfile is authoritative.

| Library | Version | Licence |
|---|---|---|
| React / React DOM | 19.3.1 | MIT |
| Zustand | 5.1.0 | MIT |
| three | 0.183.2 | MIT |
| @react-three/fiber | 9.8.2 | MIT |
| @react-three/drei | 10.7.9 | MIT |
| lucide-react / lucide-static | 1.73.0 | ISC |
| i18next | 25.10.10 | MIT |
| react-i18next | 16.6.6 | MIT |
| i18next-browser-languagedetector | 8.3.0 | MIT |
| @fontsource/rajdhani / @fontsource/jetbrains-mono | 5.3.0 | OFL-1.1 |

Bun, TypeScript, Vite, Tailwind CSS and their tooling dependencies are development tools. Their licence files are distributed with the installed packages. Preserve dependency notices when redistributing bundles or fonts.

## AI assistance

AI assistance was used for research, planning, source adaptation, implementation, translation and verification. No externally generated AI image/video or audio asset is bundled; spacecraft geometry, science diagrams and tones are procedural application code. The submission must disclose AI assistance independently of this repository notice.

## Void Protocol adaptation record

Pinned source: `~/dev/void_protocol` commit `218625d`, owner-authorized for this project. Each file below carries the matching attribution header and is distributed under the project Apache-2.0 licence.

| ASTRIX file | Void Protocol source at `218625d` | Adaptation |
|---|---|---|
| `packages/core/src/rng.ts` | `packages/shared/src/world/terrain/terrainNoise.ts` | mulberry32 arithmetic only; explicit serializable RNG state |
| `packages/core/src/review/engine.ts` | `apps/web/src/advisor/engine.ts` | ASTRIX domain types, discrete design review, operational hysteresis |
| `packages/core/src/review/engine.test.ts` | `apps/web/src/advisor/engine.test.ts` | Behavioral cases adapted to ASTRIX rules |
| `apps/web/src/audio/cueTone.ts` | `apps/web/src/advisor/cueTone.ts` | Cue family mapping |
| `apps/web/src/audio/tones.ts` | `apps/web/src/utils/soundManager.ts` | Context/master gain and procedural playTone excerpt only; no file-based sounds |
| `apps/web/src/i18n/config.ts` | `apps/web/src/i18n/config.ts` | English and Brazilian Portuguese only |
| `apps/web/src/store/events.ts` | `apps/web/src/stores/gameEvents.ts` | ASTRIX event types |
| `apps/web/src/three/AdaptivePixelBudget.tsx` | `apps/web/src/rendering/AdaptivePixelBudget.tsx` | Removed benchmark dependency |
| `apps/web/src/three/WebGLFailureNotice.tsx` | `apps/web/src/rendering/WebGLFailureNotice.tsx` | Existing DOM sibling; retains controls on failure |
| `apps/web/src/three/pixelBudget.ts` | `apps/web/src/rendering/pixelBudget.ts` | Copied arithmetic policy |
| `apps/web/src/three/previewSnapshots.tsx` | `apps/web/src/rendering/previewSnapshots.tsx` | ASTRIX spacecraft; shared renderer/render targets; explicit Color destination for Three.js 0.183 |
| `apps/web/src/three/quality.ts` | `apps/web/src/rendering/quality.ts` | ASTRIX quality tiers and frame probe |
| `apps/web/src/ui/primitives/ApplicationErrorPanel.tsx` | `apps/web/src/components/ui/ApplicationErrorPanel.tsx` | ASTRIX styles, Lucide, translations and honest generic rendering-error copy |
| `apps/web/src/ui/primitives/classes.ts` | `apps/web/src/components/ui/hudLabel.ts` | Readable labels; opaque surfaces; removed blur |
| `apps/web/src/ui/layout/DraggablePanel.tsx` | `apps/web/src/components/ui/AuraStrip.tsx` | PATTERN: collapse inside the same draggable header; ASTRIX geometry and accessibility |
| `apps/web/src/ui/hud/ResourceGrid.tsx` | `apps/web/src/components/ui/ResourceGrid.tsx` | ADAPT: seven ASTRIX resources, responsive shell, no VP resource stores |
| `apps/web/src/ui/hud/ResourceBadge.tsx` | `apps/web/src/components/ui/ResourceBadge.tsx`, `StatusBar.tsx` | ADAPT: semantic badge, quote ghost fill, threshold pulse; no robot cards |
| `apps/web/src/ui/guide/CueHighlight.tsx` | `apps/web/src/components/ui/CueHighlight.tsx` | ADAPT: transient tracked DOM outline, no VP world overlays |
| `apps/web/src/ui/guide/cueStore.ts` | `apps/web/src/stores/cueStore.ts` | ADAPT: request/expiry/subscription only |
| `apps/web/src/ui/guide/cueTargets.ts` | `apps/web/src/advisor/cueTargets.ts` | ADAPT: visible target and collapsed-pill resolution |
| `apps/web/src/ui/tour/TourSpotlight.tsx` | `apps/web/src/components/ui/TourSpotlight.tsx` | ADAPT: continuously tracked cut-out, viewport clamp and reduced motion |
| `apps/web/src/ui/tour/TourCard.tsx` | `apps/web/src/components/ui/TourSpotlight.tsx` | ADAPT: clamped/compact card placement, existing ASTRIX focus/inert handling |
| `apps/web/src/ui/tour/TourHost.tsx` | `apps/web/src/components/ui/GuidedTour.tsx` | ADAPT: device-local per-surface tours, readiness and pause integration |
| `apps/web/src/ui/tour/tours.ts` | `apps/web/src/components/ui/tourSteps.ts` | ADAPT data shape: all mission-specific step content is new |
| `apps/web/src/ui/tour/tourNavigation.ts` | `apps/web/src/components/ui/tourNavigation.ts` | COPY: navigation helper plus attribution |
| `apps/web/src/ui/layout/trackedTargets.ts` | `apps/web/src/stores/uiTracking.ts` | ADAPT: tracked targets and listeners outside Zustand; viewport-pixel rectangles |
| `apps/web/src/ui/layout/panelPlacement.ts` | `apps/web/src/utils/panelPlacement.ts` | ADAPT: beside-silhouette placement, containment and the manual-drag gate over ASTRIX workspace rectangles |
| `apps/web/src/three/spacecraft/projectBounds.ts` | `apps/web/src/rendering/celestial/projectBodyBounds.ts` | PATTERN: conservative projected silhouette; independent implementation |
| `apps/web/src/three/space/Skybox.tsx` | `apps/web/src/components/StarfieldSkybox.tsx` | PATTERN: camera-centred vacuum sphere, far depth; independent implementation |
| `apps/web/src/three/space/starfieldShader.ts` | `apps/web/src/rendering/starfieldShader.ts` | PATTERN: angular cells/density layers only; independent shader and integer hash. Dave Hoskins hash not copied |
| `apps/web/src/three/camera/approach.ts` | `apps/web/src/utils/flightInput.ts` | ADAPT: exponential approach formula only |
| `apps/web/src/three/camera/modes.ts` | `apps/web/src/constants/flightTuning.ts` | ADAPT: selected camera easing rates, no flight dynamics |
| `apps/web/src/three/camera/CameraRig.tsx` | `apps/web/src/components/CameraController.tsx` | PATTERN: wall-clock chase, quick look and idle recenter; original ASTRIX pose/clearance rig |
| `apps/web/src/three/space/FloatingOrigin.ts` | `apps/web/src/rendering/renderOrigin.ts` | PATTERN: CPU origin subtraction before float upload; ASTRIX km/basis |
| `apps/web/src/three/spacecraft/RcsPuffs.tsx` | `apps/web/src/components/RcsThrusters.tsx`, `rendering/rcsBurstMath.ts` | PATTERN: independently authored bounded paired-vent illustration from actual slew, not hardware/fuel simulation; no `rcsShader` copied |
| `apps/web/src/ui/flight/pilotState.ts` | `apps/web/src/utils/flightInput.ts`, `constants/flightTuning.ts` | ADAPT selected sensitivity; PATTERN input routing. All mission commands, authority and transport are ASTRIX |

The floating-panel implementation is original ASTRIX code, informed by Void Protocol's draggable HUD pattern. Its panel positions, roles, scientific simulation, mission content and source registries are not copied from the Void Protocol world.

No upstream licence declaration was found in the pinned VP root or package metadata. The selected reuse above is owner-authorized and distributed under the ASTRIX Apache-2.0 licence as recorded in the reuse report §8.6; this is not an assertion that VP as a whole is Apache-2.0 or MIT. Third-party material is credited separately.

The 2026 interface refresh in `apps/web/src/index.css`, `shell.css`, `ui/layout/windows.css` and `ui/scene/scene.css` follows the owner-authorized Void Protocol `docs/fullstack/UI_STYLE.md` and `hudLabel.ts` design vocabulary (neutral hairlines, compact Rajdhani labels, semantic accents and 4 px corners), adapted for ASTRIX's readable educational content and portrait layout. `HomeIllustration.tsx` is original static ASTRIX SVG artwork; no Void Protocol logo, imagery or other visual assets are included.

The complete direct-runtime licence texts are preserved in `THIRD_PARTY_NOTICES.txt` and copied into the static site's public files with these credits.
