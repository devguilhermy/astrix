# Graph Report - astrix  (2026-11-14)

## Corpus Check
- Large corpus: 233 files · ~753,274 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2287 nodes · 5745 edges · 122 communities (97 shown, 25 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 119 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Simulation Telemetry Tests
- Engineering Model Catalog
- Game Implementation Plan
- Mission Studio Refinement
- Orbital Physics
- Simulator Refinement
- Simulation State Contracts
- Simulation Step Logic
- Engineering Model Catalog
- GMAT Orbital Modeling
- Design Budget Interface
- Data Return / Science Return
- Mission Store and Phases
- Localization and Design Tests
- Application Scenario Wizard
- Simulator Interface
- Mission Lifecycle Screens
- Mission Lifecycle Screens
- Adaptive Rendering Quality
- CameraRig.tsx / modes.ts
- Draggable Panel Layout
- Data Exports and Snapshots
- Simulation Core API
- Scene Canvas and Camera
- Energy Budget / Mission Failure
- Spacecraft Resources and Evidence
- Root Package Dependencies
- Capture Burn / Rocket Equation
- Pointing / Safe Mode
- Radiation / Model Assumptions
- Data Exports and Snapshots
- Application Scenario Wizard
- Command Delay / Onboard Recovery
- Mission Header and Store
- Audio Cue Engine
- Scene Canvas and Camera
- Orbital Physics
- Mass Volume / Orbit Height
- Crew Atmosphere / Crew Inventories
- Mission Scene Rendering
- Scene Canvas and Camera
- Science Learning Topics
- Battery Storage / Eclipse
- Simulator Interface
- Crew Pathfinder Missions
- Requirements Verification / Mission Goal
- Science Teaching Interface
- Commands and Selectors
- Safety Margins / Systems Tradeoffs
- Audio Cue Engine
- Credits and Acceptance
- Engineering Model Constraints
- Research References
- TypeScript Compiler Configuration
- Scientific Data References
- Rendering Architecture
- CueHighlight.tsx / cueStore.ts
- Web Package Dependencies
- Mission Store and Phases
- Web Package Dependencies
- Workspace Interaction Layouts
- Localization and Design Tests
- Simulation Verification
- Scene Canvas and Camera
- Mission Concept Maturity
- Junior Astronaut Trainer
- Mission Design Brief
- NASA Science Mission Resources
- CubeSat References
- Localization and Design Tests
- Mission Rules and Evidence
- Accessibility Guidelines
- Deployment / Operational Cycle
- Localization and Design Tests
- GMAT Ephemeris Interchange
- Life Support References
- Guided Immersive Redesign
- Core Package Dependencies
- Draggable Panel Layout
- LAN Multiplayer Plan
- Mission Rules and Evidence
- resourceModel.ts / resourceModel
- Interface Styling Classes
- Challenge Comparison
- Earth Surface Texture
- Mission Role Assignments
- WorkbenchState / .selectCategory()
- Responsive window intent and focus / Pointer geometry gesture transaction
- Verified Science Facts
- Void Protocol Reuse
- NASA Design Process
- Data Package Exports
- Project Overview
- NASA Mission Visualizer
- Web Package Dependencies
- Aspiring learners see a topic-context introduction once per mission attempt, with replay and dismissal / Explanation entry opens a topic with its context and originating element
- Astrogeology Catalog
- Web Package Dependencies
- Mars Surface Texture
- Mission Design Stages
- Bilingual Web Entry
- Tour history validates known IDs and statuses; unavailable storage is nonfatal / A tour records its opener and persists offered, finished, or skipped state
- Mission Visualizer Reuse
- Unit quaternion canonical sign makes q and -q serialize identically / Attitude quaternion rotates body axes into MJ2000Eq inertial axes
- Mission Header and Store
- Body-Y pointing error is a deterministic calibration bias, not jitter
- Attitude points body +Z along target while projecting +X panel direction, with collinear fallback
- Slew takes shortest quaternion arc and clamps the allowed rotation

## God Nodes (most connected - your core abstractions)
1. `useMission` - 69 edges
2. `Mission Studio refinement — scoped implementation plan` - 67 edges
3. `ASTRIX Mission Studio: game implementation plan` - 66 edges
4. `MissionStore` - 65 edges
5. `Simulator refinement specification and implementation plan` - 58 edges
6. `telemetry()` - 52 edges
7. `computeBudgets()` - 46 edges
8. `scenarioById()` - 45 edges
9. `react` - 44 edges
10. `Design` - 41 edges

## Surprising Connections (you probably didn't know these)
- `GMAT interchange profile` --semantically_similar_to--> `Irregular sample gaps`  [INFERRED] [semantically similar]
  docs/research/gmat-validation.md → scripts/fixtures/gmat/mars-irregular.txt
- `Mission design resource map` --references--> `Space Mission Concept Development Using Concept Maturity Levels`  [EXTRACTED]
  docs/challenges/space-mission-design-resources-map.md → resources/space mission design maturity level.pdf
- `RosterChange` --references--> `RoleId`  [EXTRACTED]
  apps/web/src/store/index.ts → packages/core/src/contracts.ts
- `Concept maturity mission flow` --references--> `Concept Maturity Levels`  [EXTRACTED]
  docs/challenges/space-mission-design-mockup.md → resources/space mission design maturity level.pdf
- `Mission design core loop` --conceptually_related_to--> `Science mission segments`  [EXTRACTED]
  docs/challenges/space-mission-design-brief.md → resources/250323-design-and-develop-science-mission.pdf

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Expert bounded engineering mechanisms** — docs_technical_models_lumped_equipment_bus_thermal_balance, docs_technical_models_end_of_life_power_and_battery_degradation, docs_technical_models_finite_pointing_acquisition_and_coarse_recovery, docs_technical_models_contact_gated_command_transport, docs_technical_models_onboard_reset_and_powered_recovery, docs_technical_models_mars_capture_uncertainty_envelope [EXTRACTED 1.00]
- **Mission concept maturity progression** — resources_space_mission_design_maturity_level_cml_2_initial_feasibility, resources_space_mission_design_maturity_level_cml_3_trade_space, resources_space_mission_design_maturity_level_cml_4_point_design [EXTRACTED 1.00]
- **Four supported mission scenarios** — docs_missions_first_light, docs_missions_storm_watch, docs_missions_red_relay, docs_missions_crew_pathfinder [EXTRACTED 1.00]
- **Proposal visualization without changing the spacecraft design** — apps_web_src_three_spacecraft_model_design_instances, apps_web_src_three_spacecraft_model_abstract_room_packing, apps_web_src_three_spacecraft_parts_partmesh_preview_ghost, apps_web_src_three_spacecraft_workbenchstate_presentation_only [INFERRED 0.85]
- **Guidance step to visible expiring highlight** — apps_web_src_ui_guide_nextsteps_journey_guidance, apps_web_src_ui_guide_showstep_guide_navigation, apps_web_src_ui_guide_cuestore_cue_expiry, apps_web_src_ui_guide_cuetargets_visible_target_resolution, apps_web_src_ui_guide_cuehighlight_highlight_tracking [INFERRED 0.95]

## Communities (122 total, 25 thin omitted)

### Community 0 - "Simulation Telemetry Tests"
Cohesion: 0.08
Nodes (63): launchEarth(), reachLaunch(), Directional antenna gain falls with pointing error and reaches half power at beam half-angle, createStarterDesign(), Planning duty fractions forecast outcomes but actual commands fly the mission, listOrbitPresets(), rideCost(), LevelId (+55 more)

### Community 1 - "Engineering Model Catalog"
Cohesion: 0.06
Nodes (53): a(), BUSES, captureOrbits(), LEO_ORBITS, Capture fuel planning includes margin while realized arrival burn uses exact requirement, MODEL, part(), PART_BY_ID (+45 more)

### Community 2 - "Game Implementation Plan"
Cohesion: 0.03
Nodes (59): #1924, #1947, 3D scenes (one canvas), Accessibility, Agent A: CoreEngine, Agent B: DataContent, Agent C: WebUI, Architecture (+51 more)

### Community 3 - "Mission Studio Refinement"
Cohesion: 0.04
Nodes (53): Acceptance and verification, Actions and faults, Adversarial findings resolved by this revision, Aspiring and Expert levels, Atmosphere, scrubbers and finite stores, Authored mission envelope, Begin with the end product, Clean level cutover (+45 more)

### Community 4 - "Orbital Physics"
Cohesion: 0.09
Nodes (47): MissionPoseProvider(), CAPTURE_ORBITS, estimate(), stationAllocated(), analyticEclipseFraction(), bodyRotationAngle(), circularSpeed(), Planetary occultation and station allocation are separate conditions (+39 more)

### Community 5 - "Simulator Refinement"
Cohesion: 0.04
Nodes (47): Acceptance and verification matrix, Approved workflow and immersion amendment, Browser migration and proposed files, Camera interaction and mission-specific 3D kits, Contracts, ownership and clean migration, Core migration, Educative and Technical mission profiles, Educative operating specification (+39 more)

### Community 6 - "Simulation State Contracts"
Cohesion: 0.08
Nodes (48): ActorContext, AttitudeQuaternion, AttitudeTelemetry, AuditEntry, CaptureTelemetry, Commands distinguish onboard and ground transport and contact, transit, delivery, refusal, and expiration, CommandQueueEntry, ComputerTelemetry (+40 more)

### Community 7 - "Simulation Step Logic"
Cohesion: 0.12
Nodes (49): antennaGain(), scenarioById(), LinkTelemetry, isTechnical(), lifeFactor(), thermalStepK(), solarFactor(), summarizeMission() (+41 more)

### Community 8 - "Engineering Model Catalog"
Cohesion: 0.08
Nodes (32): RoomVolumes(), Dimensions(), CATEGORY_COLOURS, Surface, SURFACES, installedInstances(), PartInstance, previewInstance() (+24 more)

### Community 9 - "GMAT Orbital Modeling"
Cohesion: 0.09
Nodes (33): AdvancedTools(), intervalRange(), portugueseError(), advancedCopy, ViewerState, BodyId, OrbitChoice, addSample() (+25 more)

### Community 10 - "Design Budget Interface"
Cohesion: 0.08
Nodes (14): icons, ResourceBadge(), ResourceGrid(), partIcons, roleIcons, statusKey, categoryTopic, groupDefinitions (+6 more)

### Community 11 - "Data Return / Science Return"
Cohesion: 0.08
Nodes (43): Data Return, Data Storage, Ground Contact, Radio Links, Science Return, advice.DOWNLINK, budget.data, category.COMPUTER (+35 more)

### Community 12 - "Mission Store and Phases"
Cohesion: 0.06
Nodes (3): MissionStore, Command, ScenarioId

### Community 13 - "Localization and Design Tests"
Cohesion: 0.07
Nodes (25): flowEnglish, flowPortuguese, labels, modelEnglish, modelPortuguese, thermalLabels, refinementEnglish, refinementPortuguese (+17 more)

### Community 14 - "Application Scenario Wizard"
Cohesion: 0.09
Nodes (25): App(), EntryAttempt, EntryBoundary, PreparationStage, Screen, Simulator, ROLES, Scene caption discloses schematic scales, modeled orbit and transfer limitations (+17 more)

### Community 15 - "Simulator Interface"
Cohesion: 0.10
Nodes (26): configureAudio(), Audio cue per-id cooldown, CueId, lastPlayed, playCue(), resetAudioGate(), settings, cueToneOf() (+18 more)

### Community 16 - "Mission Lifecycle Screens"
Cohesion: 0.12
Nodes (25): Forecast versus live mission resources, Role and hardware category icon mapping, Before-and-after mission budget comparison, BudgetComparison(), Signoffs(), Collaboration(), Facilitated collaborative design notes, Design quote preview and stale protection (+17 more)

### Community 17 - "Mission Lifecycle Screens"
Cohesion: 0.15
Nodes (26): BudgetsPanel(), Localized refusal and contextual explanation, RefusalNote(), ReviewCoach(), DesignScreen(), HardwareCard(), Command queue preview and receipt lifecycle, CommandButton() (+18 more)

### Community 18 - "Adaptive Rendering Quality"
Cohesion: 0.11
Nodes (24): AdaptivePixelBudget(), PIXEL_SCALES, pixelBudgetDpr(), PixelBudgetState, stepPixelBudget(), applyFrameProbe(), classifyStaticTier(), detectQuality() (+16 more)

### Community 19 - "CameraRig.tsx / modes.ts"
Cohesion: 0.12
Nodes (20): approach(), approachFactor(), cameraClearance(), CameraAction, CameraBridge, CameraPose, CameraRig(), poses (+12 more)

### Community 20 - "Draggable Panel Layout"
Cohesion: 0.19
Nodes (26): DraggablePanel(), EDGES, Gesture, WindowOptions(), clamp(), clampRectangle(), defaultRectangle(), finite() (+18 more)

### Community 21 - "Data Exports and Snapshots"
Cohesion: 0.11
Nodes (20): DONKI_SNAPSHOT, RADLAB_PROFILE, USGS_MISSIONS, acquire(), Catalogue, CME_URL, extractMissions(), GST_URL (+12 more)

### Community 23 - "Scene Canvas and Camera"
Cohesion: 0.10
Nodes (21): GPU-timed adaptive pixel budget, AppCanvas(), AppCanvasProps, CommittedDraw(), RenderBoundary, Mission preview live and replay scenes, Stars(), LaunchPresentation (+13 more)

### Community 24 - "Energy Budget / Mission Failure"
Cohesion: 0.08
Nodes (31): Energy Budget, Mission Failure, Solar Distance, Thermal Control, advice.THERMAL, budget.power, category.SOLAR, category.THERMAL (+23 more)

### Community 25 - "Spacecraft Resources and Evidence"
Cohesion: 0.10
Nodes (28): Flight and rendering, Identity, workflow and transactions, Packages and authority, Persistence and limitations, System architecture, ASTRIX documentation, Canonical system documentation, Design and implementation history (+20 more)

### Community 26 - "Root Package Dependencies"
Cohesion: 0.07
Nodes (28): dependencies, @astrix/core, @astrix/data, devDependencies, @types/bun, @types/react, @types/react-dom, @types/three (+20 more)

### Community 27 - "Capture Burn / Rocket Equation"
Cohesion: 0.11
Nodes (29): Capture Burn, Capture Reserve, Orbit Shape, Propulsion, Rocket Equation, Specific Impulse, advice.FUEL, budget.deltaV (+21 more)

### Community 28 - "Pointing / Safe Mode"
Cohesion: 0.09
Nodes (29): Instrument Risk, Pointing, Pointing Recovery, Safe Mode, advice.CHARGE, advice.OBSERVE, advice.PROTECT, category.ADCS (+21 more)

### Community 29 - "Radiation / Model Assumptions"
Cohesion: 0.10
Nodes (28): External Trajectories, Initial Orbit State, Kepler Orbits, Model Assumptions, Orbital Period, Radiation, Scene Scale, Source Evidence (+20 more)

### Community 30 - "Data Exports and Snapshots"
Cohesion: 0.12
Nodes (16): fields, learningEnglish, learningPortuguese, Lesson, RadlabProfile, ScienceTopic, UsgsMission, EXTRA_SOURCES (+8 more)

### Community 31 - "Application Scenario Wizard"
Cohesion: 0.13
Nodes (20): Close(), Modal(), Modal inerts unrelated branches, traps focus, restores opener and closes on Escape, Tour card exposes step count, localized text, skip, back and next or finish, TourCard(), Active tour pauses mission and clears its pause reason on exit, Tour switches to step panel, focuses heading and navigates by keyboard, TourHost() (+12 more)

### Community 32 - "Command Delay / Onboard Recovery"
Cohesion: 0.09
Nodes (27): Command Delay, Light Time, Link Resilience, Onboard Recovery, Transfer Orbits, command.CAPTURE_CONFIRM, command.LINK_MODE, command.queue (+19 more)

### Community 33 - "Mission Header and Store"
Cohesion: 0.09
Nodes (13): emitGameEvent(), GameEventListener, subscribeGameEvents(), blockingReasons, initialSettings, PauseReason, Presentation, readBest() (+5 more)

### Community 34 - "Audio Cue Engine"
Cohesion: 0.13
Nodes (13): CueTone, useWorkbench, CapcomCard(), guideContext(), requestCue(), blockerOwner, journeySteps(), NextStep (+5 more)

### Community 35 - "Scene Canvas and Camera"
Cohesion: 0.14
Nodes (18): Explanation, liveMission, sceneKind, sceneRadius(), SceneStage, KmVector, MissionPose, PoseContext (+10 more)

### Community 36 - "Orbital Physics"
Cohesion: 0.20
Nodes (23): angleToDirectionDeg(), attitudeDistance(), attitudeTargetForDirection(), biasedAttitude(), cross(), normalizeAttitude(), rotateAttitudeVector(), slewAttitude() (+15 more)

### Community 37 - "Mass Volume / Orbit Height"
Cohesion: 0.12
Nodes (25): Coverage, Cubesat Size, Disposal Screening, Inclination, Launch Rides, Mass Volume, Orbit Height, Smallsat Class (+17 more)

### Community 38 - "Crew Atmosphere / Crew Inventories"
Cohesion: 0.13
Nodes (25): Crew Atmosphere, Crew Inventories, Crew Procedures, Crew Return, Mission Clock, advice.CREW_SUPPORT, command.CREW_CARTRIDGE, command.CREW_FAN (+17 more)

### Community 39 - "Mission Scene Rendering"
Cohesion: 0.34
Nodes (16): MissionComposition(), AssemblyScene(), deploymentPath, LaunchScene(), MISSION_SCENES, SceneVector, OrbitScene(), GroundDish() (+8 more)

### Community 40 - "Scene Canvas and Camera"
Cohesion: 0.11
Nodes (15): CameraAction, CameraBridge, CameraPose, MissionCamera(), poses, MissionSceneDefinition, acquireTexture(), LoadedTexture (+7 more)

### Community 41 - "Science Learning Topics"
Cohesion: 0.09
Nodes (22): Scientific accessibility (C16–C18), Summary, Scientific evidence provenance, UI evidence path and source registry, Entry, mission choice and contextual immersion, Explain: one contextual drawer, Level and information depth are different, Maintenance and verification ownership (+14 more)

### Community 42 - "Battery Storage / Eclipse"
Cohesion: 0.11
Nodes (23): Battery Storage, Eclipse, Power Aging, budget.eclipse, category.BATTERY, chart.battery, cue.BATTERY_ECLIPSE_SHORT, event.BATTERY_LOW (+15 more)

### Community 43 - "Simulator Interface"
Cohesion: 0.12
Nodes (14): blankSignoffs(), emptyCues(), emptyTeam(), Settings, useMission, getQualityOverride(), setQualityOverride(), DryRun() (+6 more)

### Community 44 - "Crew Pathfinder Missions"
Cohesion: 0.09
Nodes (22): #1947, Crew Pathfinder, Engine features by tier, Expansion research — not implemented, First Light, L10. POLAR_SCOUT: Polar Scout (lunar south pole), L11. FEAR_AND_PANIC: Fear & Panic (Phobos), L12. IRON_WORLD: Iron World (Mercury) (+14 more)

### Community 45 - "Requirements Verification / Mission Goal"
Cohesion: 0.10
Nodes (22): Concept Maturity, Mission Design, Mission Goal, Mission Segments, Outcome Replay, Requirements Verification, event.OBJECTIVE_MET, event.SESSION_ENDED (+14 more)

### Community 46 - "Science Teaching Interface"
Cohesion: 0.15
Nodes (14): STAGES, Scene caption displays stage-sensitive telemetry, deployment and instrument status, isScienceTopicId(), scienceTopic(), ScienceDiagram(), Science diagram selects energy, data, transfer or radiation visualization from topic metadata, Science topic reveal checks current mission state, stage and target visibility before navigating, Reveal switches stage and substep before opening and focusing the target after rendering (+6 more)

### Community 47 - "Commands and Selectors"
Cohesion: 0.20
Nodes (18): commandRole(), Earth crew return windows start at 12 hours and repeat every 90 minutes for 10 minutes, crewReturnFuel(), crewReturnWindow(), Crew deorbit fuel derives from apoapsis burn to an 80 km entry perigee, applyCommand(), applyDueCommands(), bootEnergyWh() (+10 more)

### Community 48 - "Safety Margins / Systems Tradeoffs"
Cohesion: 0.11
Nodes (21): Design Rounds, Game Budget, Operations Budget, Safety Margins, Systems Tradeoffs, budget.cost, budget.mass, cue.BUDGET_MARGIN_LOW (+13 more)

### Community 49 - "Audio Cue Engine"
Cohesion: 0.17
Nodes (17): PracticeCheckpoint, ActiveCue, CueEngineState, ReviewSnapshot, TeamStats, allGuidance, Cue evaluation preserves tracked hidden cues, cooldown and delayed clearing while limiting non-alerts, CuePreferences (+9 more)

### Community 50 - "Credits and Acceptance"
Cohesion: 0.11
Nodes (18): AI assistance, Credits and provenance, External scientific and visual attribution, NASA SVS exact image, Project and licence, source and credit, Surface map assets, Third-party runtime libraries (+10 more)

### Community 51 - "Engineering Model Constraints"
Cohesion: 0.12
Nodes (20): Red Relay, Bounded engineering models — rules 3, Contact-gated command transport, End-of-life power and battery degradation, Finite pointing acquisition and coarse recovery, Lumped equipment-bus thermal balance, Mars capture uncertainty envelope, NASA Communications (+12 more)

### Community 52 - "Research References"
Cohesion: 0.10
Nodes (20): APG Button, Drei controls, MDN Pointer Events, MDN progressbar, MDN touch-action, NASA Communications, NASA Guidance, Navigation and Control, NASA Small Spacecraft Avionics (+12 more)

### Community 53 - "TypeScript Compiler Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, baseUrl, esModuleInterop, jsx, lib, module, moduleResolution (+10 more)

### Community 54 - "Scientific Data References"
Cohesion: 0.11
Nodes (18): Astrogeology catalogue, Build It Yourself: telescope game, Concept Maturity Levels, CubeSat 101, Design and Develop Science Missions, Digital Games and Activities, DONKI, Earth (+10 more)

### Community 55 - "Rendering Architecture"
Cohesion: 0.11
Nodes (18): Core simulation authority, Camera controls and invariants, Clocks and frame scheduling, Complete mission contexts, not equipment bundles, Dependencies, omissions and verification ownership, Equivalent DOM and scoped keyboard input, Failure and resource boundaries, Hardware representation (+10 more)

### Community 56 - "CueHighlight.tsx / cueStore.ts"
Cohesion: 0.18
Nodes (3): CueHighlight(), useCueStore, resolveCueTarget()

### Community 57 - "Web Package Dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @astrix/core, @astrix/data, @fontsource/jetbrains-mono, @fontsource/rajdhani, i18next, i18next-browser-languagedetector, lucide-react (+8 more)

### Community 58 - "Mission Store and Phases"
Cohesion: 0.13
Nodes (11): Transactional simulator preparation, Bounded frame clock and visibility pause, Simulation event subscriber fan-out, listeners, Assisted practice checkpoint restoration, Cancellable self-paced event advance, Composable simulation pause reasons, Revision-bound design authority (+3 more)

### Community 59 - "Web Package Dependencies"
Cohesion: 0.15
Nodes (13): @astrix/core, @astrix/data, name, private, type, version, Production bundles split Three.js and React into dedicated chunks, lucide-react (+5 more)

### Community 60 - "Workspace Interaction Layouts"
Cohesion: 0.13
Nodes (15): Desktop, compact and reading layouts, Dialogs, inert backgrounds and Explain reveal, Equivalent pointer, touch and keyboard input, Explain sequence, Geometry authority, Layers and scroll ownership, Layouts and workspace interaction, Minimize, dock and restoration (+7 more)

### Community 61 - "Localization and Design Tests"
Cohesion: 0.18
Nodes (11): Assumption registry traverses model, part, ride, and scenario values and explains simulation limitations, ASSUMPTION_I18N_KEYS, CATALOG_I18N_KEYS, CORE_ENGLISH, CORE_I18N_DEFAULTS, CORE_I18N_KEYS, CUE_RULE_IDS, cueDefaults (+3 more)

### Community 62 - "Simulation Verification"
Cohesion: 0.15
Nodes (12): GMAT interchange profile, GMAT orbit reference results, Independent GMAT reference run, Initial condition export comparison, Browser mission flights, GMAT trajectory interchange, Implementation verification, Mission Studio rules v3 (+4 more)

### Community 63 - "Scene Canvas and Camera"
Cohesion: 0.22
Nodes (4): reviewPlayback, trajectoryViewer, HistorySample, zustand

### Community 64 - "Mission Concept Maturity"
Cohesion: 0.18
Nodes (11): CML 1 cocktail napkin, CML 2 initial feasibility, CML 3 trade space, CML 4 point design, CML 5 baseline concept, CML 6 integrated concept, CML 7 preliminary implementation baseline, CML checklists (+3 more)

### Community 65 - "Junior Astronaut Trainer"
Cohesion: 0.18
Nodes (10): Junior Astronaut Mission Trainer, Seven-sol game sketch, Space weather and radiation sources, Youth outpost survival game, Data sources by role, Junior trainer resource inventory, Junior trainer resource research, NASA catalog reuse guidance (+2 more)

### Community 66 - "Mission Design Brief"
Cohesion: 0.18
Nodes (12): Four mission roles, Guided science UX, Persistent space and floating panels, Space Mission Design brief, Spacecraft resource budgets, Concept maturity mission flow, Explained refusals, Launch and mission operations (+4 more)

### Community 67 - "NASA Science Mission Resources"
Cohesion: 0.18
Nodes (11): Mission design core loop, Mission design resource map, Resource coverage gaps, Resource to game screen mapping, BioNutrients-2 mission, Concept of operations, Design and Develop Science Missions, Mission needs and goals (+3 more)

### Community 68 - "CubeSat References"
Cohesion: 0.17
Nodes (12): Cal Poly listing, communications, CubeSat Design Specification Rev. 14.1, CubeSats, FCC 22-74 disposal order, FCC space stations, GNC, mission-assurance applicability (+4 more)

### Community 69 - "Localization and Design Tests"
Cohesion: 0.20
Nodes (8): Persistent bilingual language selection, english, portuguese, Localized React bootstrap, @fontsource/jetbrains-mono, @fontsource/rajdhani, i18next, i18next-browser-languagedetector

### Community 70 - "Mission Rules and Evidence"
Cohesion: 0.25
Nodes (8): Phase, CUE_RULES, DesignReview, designSnapshot(), Authored rules flag energy, storage, pointing, radio and capture shortcomings, OperateReview, operateSnapshot(), Review snapshots combine design budgets and live flight telemetry into phase-gated guidance

### Community 71 - "Accessibility Guidelines"
Cohesion: 0.18
Nodes (11): APG modal dialog, check answers, error summary, focus not obscured, GOV.UK question pages, redundant entry, UI/accessibility, USWDS step indicator (+3 more)

### Community 72 - "Deployment / Operational Cycle"
Cohesion: 0.27
Nodes (11): Command Transport, Deployment, Launch Commission, Operational Cycle, command.DEPLOY, command.DEPLOY_RETRY, event.DEPLOYMENT_ANOMALY, event.DEPLOYMENT_DONE (+3 more)

### Community 73 - "Localization and Design Tests"
Cohesion: 0.27
Nodes (10): Flight evidence and model boundaries, lessons, Bilingual structured science lessons, English localization catalogue, Brazilian Portuguese localization catalogue, add(), Localized engineering model disclosure, Bilingual and science registry integrity (+2 more)

### Community 74 - "GMAT Ephemeris Interchange"
Cohesion: 0.20
Nodes (10): CCSDS Orbit Data Messages, EphemerisFile, epoch, GMAT and visualization, NASA Blue Marble Next Generation, NASA Earth/Mars true-color comparison, NASA image/media usage guidelines, NASA mission-viz (+2 more)

### Community 75 - "Life Support References"
Cohesion: 0.20
Nodes (10): James & Macatangay, 2009, Jones 2016, Life support, NASA BVAD Rev. 2, 2022, NASA ECLS presentation, NASA Inspiration4 datasets, NASA-STD-3001 Vol. 2, Near Space Network support (+2 more)

### Community 76 - "Guided Immersive Redesign"
Cohesion: 0.20
Nodes (9): Approved Line B scope, CAPCOM next-step guide, Dry run before flight, Guided immersive redesign plan, Operations plan, Space scenes and camera rig, Spacecraft workbench, Steering and attitude tiers (+1 more)

### Community 77 - "Core Package Dependencies"
Cohesion: 0.20
Nodes (9): dependencies, @astrix/data, exports, @astrix/data, name, private, Core workspace publishes TypeScript source entrypoints and depends on data workspace, type (+1 more)

### Community 80 - "LAN Multiplayer Plan"
Cohesion: 0.22
Nodes (8): LAN multiplayer plan, LAN security model, Lobby and role assignment, Local authoritative Bun host, Phone consoles and big screen, Reconnect and fallback policy, Session authority and clock, Versioned multiplayer protocol

### Community 81 - "Mission Rules and Evidence"
Cohesion: 0.32
Nodes (6): AcceptedTrade, DesignNote, Workshop proposal stores before/after budgets and revision for display, never design authority, ActorRole, Budgets, MissionArtifacts

### Community 82 - "resourceModel.ts / resourceModel"
Cohesion: 0.36
Nodes (7): capacityStatus(), ratio(), reserveStatus(), RESOURCE_ORDER, ResourceId, resourceModel, ResourceValue

### Community 83 - "Interface Styling Classes"
Cohesion: 0.25
Nodes (7): Shared mission-studio visual class tokens, UI_CARD_CLASS, UI_CARD_SURFACE_CLASS, UI_LABEL_CLASS, UI_LABEL_ICON_SIZE, UI_LABEL_ROW_CLASS, UI_STRIP_CLASS

### Community 84 - "Challenge Comparison"
Cohesion: 0.25
Nodes (7): Challenge comparison, Junior trainer versus mission design, Reuse fit and shared work, Challenge resources, Design launch operate review loop, Mission engineering trade-offs, Space Mission Design Game challenge

### Community 85 - "Earth Surface Texture"
Cohesion: 0.29
Nodes (7): Continents and land cover, Earth, Earth Blue Marble texture, Equirectangular world map projection, Global Earth surface map, Oceans, Polar ice and snow

### Community 86 - "Mission Role Assignments"
Cohesion: 0.29
Nodes (5): GuideContext, Tour surface prioritizes review, then active flight, launch, build, and welcome, RoleId, JourneyStage, RequirementEvidence

### Community 88 - "Responsive window intent and focus / Pointer geometry gesture transaction"
Cohesion: 0.33
Nodes (7): Pointer geometry gesture transaction, Bounded and anchored window geometry, Window geometry and preference invariants, Visual viewport and safe-area measurement, Localized accessible window instructions, Responsive window intent and focus, Settings overlay pause ownership

### Community 89 - "Verified Science Facts"
Cohesion: 0.29
Nodes (7): Mars science facts, NASA catalog facts, Physics constants and class limits, Space Apps rules, Space weather and radiation, Spacecraft design facts, Verified facts and data points

### Community 90 - "Void Protocol Reuse"
Cohesion: 0.29
Nodes (6): Copied file procedure, Procedural audio reuse, Rendering infrastructure reuse, Reuse authorization and attribution, Simulation and logic patterns, Void Protocol reuse report

### Community 91 - "NASA Design Process"
Cohesion: 0.33
Nodes (6): CATTENS/IDC, 2024, Goddard IDC concurrent design process, 2016, GSFC Mission Design Lab, JPL CML dataset, MDL-inspired work, not NASA-grade certification, NASA process, MDL and maturity

### Community 92 - "Data Package Exports"
Cohesion: 0.33
Nodes (5): exports, name, private, type, version

### Community 93 - "Project Overview"
Cohesion: 0.33
Nodes (6): AI disclosure, ASTRIX Mission Studio, Data and reuse, Licence, Play, Run

### Community 94 - "NASA Mission Visualizer"
Cohesion: 0.33
Nodes (5): NASA Mission Viz repository archive, Ontology-driven Three.js orrery, Orbital propagator, RMarkdown orbit visualizations, X3Dom trajectory viewers

### Community 95 - "Web Package Dependencies"
Cohesion: 0.40
Nodes (5): devDependencies, tailwindcss, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 96 - "Aspiring learners see a topic-context introduction once per mission attempt, with replay and dismissal / Explanation entry opens a topic with its context and originating element"
Cohesion: 0.40
Nodes (5): Explanation entry opens a topic with its context and originating element, Science topic and context registry rejects missing identifiers and bindings, Aspiring learners see a topic-context introduction once per mission attempt, with replay and dismissal, Teaching context selects the first bound science topic, Eligible aspiring users auto-start a tour after delay unless a conflicting overlay is present

### Community 97 - "Astrogeology Catalog"
Cohesion: 0.40
Nodes (5): Catalog normalization and body inference, Local JSON loading fallback, Search and faceted filters, Timeline and catalog visualization, USGS Astrogeology Catalog Explorer

### Community 98 - "Web Package Dependencies"
Cohesion: 0.50
Nodes (4): scripts, build, dev, preview

### Community 99 - "Mars Surface Texture"
Cohesion: 0.67
Nodes (3): Mars, Mars Viking global surface texture, Planetary surface map

### Community 101 - "Mission Design Stages"
Cohesion: 0.67
Nodes (3): Responsive dock and window geometry, Six mission design stages and final review, Navigation and lifecycle separation

## Knowledge Gaps
- **549 isolated node(s):** `stageKey`, `@astrix/core`, `@astrix/data`, `@types/bun`, `@types/react` (+544 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 936 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Model Assumptions` connect `Radiation / Model Assumptions` to `Command Delay / Onboard Recovery`, `Data Return / Science Return`, `Requirements Verification / Mission Goal`, `Safety Margins / Systems Tradeoffs`, `Data Exports and Snapshots`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `stageKey`, `@astrix/core`, `@astrix/data` to the rest of the system?**
  _549 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Simulation Telemetry Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.08225108225108226 - nodes in this community are weakly interconnected._
- **Why does `SCIENCE_TOPICS` connect `Data Exports and Snapshots` to `Design Budget Interface`, `Science Teaching Interface`, `Mission Lifecycle Screens`, `Localization and Design Tests`, `Radiation / Model Assumptions`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `Engineering Model Catalog` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Why does `Science Return` connect `Data Return / Science Return` to `Mass Volume / Orbit Height`, `Simulation Step Logic`, `Battery Storage / Eclipse`, `Requirements Verification / Mission Goal`, `Energy Budget / Mission Failure`, `Pointing / Safe Mode`, `Radiation / Model Assumptions`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Game Implementation Plan` be split into smaller, more focused modules?**
  _Cohesion score 0.03278688524590164 - nodes in this community are weakly interconnected._

Note: host-agent semantic extraction token usage was unavailable; zero token counts do not represent measured usage.
