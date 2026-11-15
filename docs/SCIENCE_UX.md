# Scientific design without a science prerequisite

ASTRIX serves first-time learners starting around 12–13, secondary/university students, educators and technically experienced users. Age is guidance, not an account field or access gate. Simplify choices and explanations, not consequences. Technical missions remain engineering-learning models, not flight-qualified operational software. This page describes the current learning architecture and the scientific interaction requirements maintainers must preserve; [VERIFICATION.md](./VERIFICATION.md) separately records observed checks and limitations, not an external novice-participant study.

## 1. Level and information depth are different

`ASPIRING` and `EXPERT` select versioned rules and pacing. Aspiring receives a state-driven checklist in bottom mission control and first-entry tours; Expert sees the same controller, all catalogue choices and on-demand guidance. `GUIDED` and `DETAILED` remain independent presentation preferences. Defaults follow level unless the player explicitly chose display depth.

TeachingCard introductions are optional disclosures, not automatic paragraphs. Adjacent Explain and Help → Model limits retain the full topic registry, sources, assumptions and opening snapshots. Guidance is not evidence of mastery. Actual quotes, queued requests and observed outcomes remain distinct; opening help never completes a task or resumes execution.

No formula-solving quiz, acronym test, required reading or reward for opening help is introduced. The challenge is choosing costs/benefits from disclosed consequences.

## 2. Entry, mission choice and contextual immersion

Home is informational; one setup screen selects mission, level and local team before creating an attempt. Icon-bearing Aspiring/Expert toggle cards retain the actual level descriptions and never change physical rules. Team setup starts expanded with player columns and native responsibility dropdowns: swapping or transferring an assignment preserves one owner for every role, including multiple responsibilities per player. Columns reflow at 320px. The local-play card describes solo/shared-screen use; the separate LAN link requires a prepared host and trusted local network. Mission illustrations remain static SVG. Language, sound and reduced motion stay on Home; display depth/playback live in Settings. Explicit display-depth preferences, draft/last-started distinction and preparation rollback remain unchanged.

The journey moves through Need & goals, Concept, Requirements, Design, Build & verify and Implement, followed by terminal-only Review. Shared artifacts connect these steps; launch remains explicit and is subject to current core checks. Four concurrent launch, space, ground and user segments are not four separate phases.

## 3. Starting spacecraft and revisitable choices

`createStarterDesign(scenarioId, levelId)` in [catalog.ts](../packages/core/src/catalog.ts) creates an editable spacecraft. Every included part counts toward cost, mass and volume. A starter is not itself evidence of flight readiness.

[Design.tsx](../apps/web/src/ui/phases/Design.tsx) shows the category needed by the current guided step, with Show all parts and explicit category controls. Bottom mission control keeps requirements, spacecraft slots and the contextual primary together. Selecting a slot during Build selects and reveals the same Workshop category. Preview records a real quoted trade, shows the ghost and resource deltas, and requires explicit Install; removal uses the same safeguards. Full part descriptions and scientific limits remain under Details/Explain.

Clicking an installed spacecraft part or using bottom **Spacecraft slots → Components** (and Workshop **As flown** in flight) opens **Component**: function, owner, quantity, catalogue values (authored teaching values marked `*`), simulator constraints and actual live readings when available. During Design, **Find in Workshop** reveals the part card; nothing installs from the panel. Desktop anchoring still follows the projected part until dragged. Compact inspection closes the slots tray and restores it on close. This remains a learning surface with adjacent Explain, not a second quote path.

| Decision | Beginner-facing trade-off | Exact detail remains available |
|---|---|---|
| Instrument | Pictures/maps versus radiation monitoring; electricity, pointing and storage requirements | Mass, power, rate, metric and observing prerequisites |
| Solar panels | More generation versus heavier/pricier hardware | Reference-distance watts, mass and cost |
| Battery | Longer shadow reserve versus mass/room/cost | Capacity, usable forecast reserve and eclipse demand |
| Radio | More data returned versus transmit power/pointing cost | Rate, receive/transmit power and directional requirements |
| Earth orbit | Ride-compatible named paths, with current power/contact/observing consequences | Altitude, inclination, period, eclipse; free sliders only where the ride allows |
| Mars capture | Close, intermediate, balanced or wide capture paths; compare fuel and operational consequences | 400 km periapsis, apoapsides 400/5000/10000/33000 km, computed period/Δv/fuel |
| Mars fuel | Plan the amount needed for this design/path, with remaining mass room | Engine Isp, wet/dry mass, planning margin and rocket equation |
| Technical support | Thermal, lifetime power, pointing/link/computer recovery and capture reserve | Core forecasts, operating controls, failure facts and disclosed model assumptions |

Do not call a 97° orbit sun-synchronous: J2/precession is not modeled. Higher/wider orbits are not universally better. Ride restrictions remain real; explain the refusal and offer a ride comparison instead of silently changing it. The fuel planner is a quoted edit, not a free fill or automatic engine/bus upgrade. Extra fuel adds mass and cost; an infeasible plan stays unapplied.

### Gain/cost confirmation

Comparisons derive before/after budgets from a **core quote**, not a web calculator. The preview communicates improvement, cost and current mission consequence, with adjacent Explain. Confirmation checks the original revision and actor; stale previews cannot silently overwrite new edits. Session/core guards refuse in-flight editing, including LAN intents. Solo Go for launch explicitly records sign-offs and verifies the frozen revision before advancing to the launch gate; teams retain per-role approvals.

Unknown forecasts say “Not estimated yet”/choose a path, not zero or green. Recommendations do not automatically apply changes or guarantee a win. Operational pointing, power, contact, instrument state, delivery and hazards determine actual results. Technical planning assumptions and numerical provenance are owned by [TECHNICAL_MODELS.md](./TECHNICAL_MODELS.md), [SIMULATION.md](./SIMULATION.md) and [RESOURCES.md](./RESOURCES.md).

## 4. Readable, truthful dashboard

Do not merge incompatible quantities into a made-up readiness score.

| Group | Overview | Explanation/detail |
|---|---|---|
| Fits on the rocket | Separate mass and room capacity | Actual bus/ride limits; strict limits still enforced at rounded boundaries |
| Energy for the trip | Generation balance **and** shadow battery reserve, separately | W versus Wh, usable planning depth, eclipse and operating assumptions |
| Mission progress | Actual sent-home data or powered radiation-monitor hours / real target | Storage occupancy is a separate warning, not objective completion |
| Game budget | Spent / allowed units | Authored game units, never dollars or a real launch quote |
| Contextual Mars fuel | Capture requirement/reserve and feasible proposed amount | Δv, Isp, fuel mass, tank limit and uncertainty |

Targets remain 1500 MB / 5000 MB delivered or 24 monitor hours, not invented photo counts. Radiation-monitor objective hours are not silently redefined as all bytes collected. A power surplus does not prove battery survival, and stored data is not downlinked science. “Room for surprises” explains a safety margin; the precise percentage/assumption stays available.

The pure `resourceModel` maps design budgets, actual telemetry and the currently valid quote to seven fixed-order badges: mass, power, budget, data, comms, time and crew. FORECAST/LIVE is explicit; battery energy remains Wh and generation/load remain W. Contact/next opportunity, queued commands, storage/delivered progress, phase time and conditional crew runway remain distinct. Popovers expose subvalues, changing parts and Explain. `Budgets.tsx` and `TechnicalForecast` retain detailed forecast evidence in the collapsed Details panel.

## 5. Explain: one contextual drawer

The scientific interaction requirement is an explicit visible **BookOpen + Explain / Entenda** button, not hover-only tooltips or an unlabelled question mark. [ExplainButton.tsx](../apps/web/src/ui/science/ExplainButton.tsx) accepts a closed topic ID and optional context (default `ui.<topic>`), includes the translated topic in its accessible name, and records its actual opener.

Coverage belongs beside mission objectives, part/orbit comparisons, resource sublimits, commands, forecasts, scientific refusals, review cues, decisions, failure facts, chart axes, report facts and evidence. One button may explain a clearly labelled repeated group; a global glossary alone does not satisfy adjacent scientific coverage. Non-scientific language/volume/close controls do not need science explanations. Home/chooser mission cards, the brief and scientific workspace share the same drawer; their SVG illustrations are not another help system or WebGL canvas.

App mounts one [ScienceDrawer.tsx](../apps/web/src/ui/science/ScienceDrawer.tsx) outside the lazy Simulator, serving Home/chooser Explain, workspace Explain, glossary/search, related terms and report evidence without requiring WebGL. It displays:

1. **In one sentence:** plain-language meaning without unexplained acronyms.
2. **Why it matters here:** contextual prose plus actual opening design/budget/telemetry values. Missing values remain unknown, not fabricated examples.
3. **See it:** [ScienceDiagram.tsx](../apps/web/src/ui/science/ScienceDiagram.tsx) SVG with text equivalent; no extra WebGL context or implied full-fidelity visualization.
4. **What could you change:** benefits/costs, with “Show me” only for an available registered route. No automatic fix.
5. **Go deeper:** collapsed scientific/model detail, units and limitations. Equations explain; translations do not execute or duplicate formulas.
6. **Evidence and assumptions:** resolved source links, publisher/retrieval metadata, snapshot interval where applicable, and explicit reference/calculated/assumed distinctions.

Related topics, search results, Back and glossary replace the current topic in the **same** drawer. The opening snapshot remains unchanged while navigating topics. Unknown topic/source IDs throw rather than displaying a generic “coming soon” or invented fallback.

### Clock and side-effect contract

`openExplanation(topicId, contextId, opener)` first requests `pause('explanation')`, then captures design, budgets and latest live/published telemetry. Static play pauses for reading. In LAN play optional explanations are local, including on the host: the room can continue while the drawer retains its opening snapshot. Help remains available while already paused or while a physical decision is pending; it neither acknowledges nor replaces that decision.

Help itself never spends resources, advances time, consumes RNG, signs off a role, changes an instrument or queues a command. Pending delayed commands retain their timestamps/state. It carries no score penalty. Related/search navigation does not recapture drifting figures; LAN readers must not mistake the frozen explanatory context for current room telemetry.

`closeExplanation` removes only the explanation reason and restores the connected opener or `#mission-primary` fallback. **Never auto-resume.** Settings, chooser, Home, hidden-tab, graphics, decision and handoff reasons remain independent and follow the session's local/shared pause policy. Bottom mission control names remaining shared blockers; the host coordinates explicit LAN Resume. Optional phone reading, tours and visibility do not create a shared stop.

### Modal inert and focus

Shared [Modal](../apps/web/src/ui/primitives/index.tsx) labels the dialog, focuses/traps visible enabled controls, supports Escape/scrim/Close, makes unrelated ancestor branches inert and restores their previous states on cleanup. This includes header, controller, panels and scene controls. Focus returns to a visible opener or header/main fallback; closed tool focus returns to its bottom navigation button. These semantics are not proof of screen-reader certification.

### “Show me” now reveals hidden destinations

With a design and a visible simulator, the drawer resolves semantic topic targets through `revealTopic`, closes without restoring its opener, selects the permitted stage/section, then calls `showWindow` after the commit. The helper expands in place, raises/selects, opens enclosing disclosures and focuses/scrolls the target or stable header. Collapsed panels and inactive compact sheets remain reachable.

| Target | Destination |
|---|---|
| `mission-goal` | Need & goals / mission window |
| `design`, `parts` | Design equipment / mission window |
| `rides`, `orbit`, `fuel-planner` | Design orbit / mission window |
| `budgets`, fit/cost/energy/data budget targets | Readiness window |
| `commands`, `cruise`; `command-queue` | Implement Workshop; command receipts in Log |
| `report`, `dose-chart` | Review after a terminal outcome |
| `technical-*` | Implement operations in flight; technical forecast in readiness preflight |

On Home, before a design exists, or for an unroutable topic, help stays explanatory without a Show me action. Reveal changes workspace/focus only: no launch, command, decision acknowledgement or automatic resume. Implementing a new target requires both registry content and a route to an actual control.

## 6. Topic registry and six Technical topics

[science.ts](../packages/data/src/science.ts) owns `SCIENCE_TOPICS`; `ScienceTopicId` is `keyof` that authored registry. Entries define title/summary/context/consequence/deeper/limitations/diagram keys, diagram ID, evidence, related IDs and target. [scienceBindings.ts](../packages/data/src/scienceBindings.ts) binds UI/catalogue/event/refusal contexts. Web [registry.ts](../apps/web/src/ui/science/registry.ts) validates access. Content/localisation does not import core runtime or React.

| Topic group | Shipped IDs |
|---|---|
| Mission/design | `mission-goal`, `mission-design`, `concept-maturity`, `systems-tradeoffs` |
| Size/cost | `mass-volume`, `cubesat-size`, `smallsat-class`, `launch-rides`, `game-budget` |
| Power | `energy-budget`, `battery-storage`, `eclipse`, `solar-distance` |
| Data/communications | `data-return`, `data-storage`, `ground-contact`, `radio-links`, `pointing` |
| Orbits | `orbit-height`, `orbit-shape`, `inclination`, `orbital-period`, `coverage`, `kepler-orbits` |
| Transfer/control | `propulsion`, `specific-impulse`, `rocket-equation`, `transfer-orbits`, `capture-burn`, `light-time`, `command-delay` |
| Risk/evidence/results | `radiation`, `safe-mode`, `instrument-risk`, `model-assumptions`, `source-evidence`, `safety-margins`, `science-return`, `mission-failure` |

The six added Technical topics are working content, not reserved future-mission placeholders:

| Topic | Current visible consequence/action and reveal | Scientific boundary/evidence |
|---|---|---|
| `thermal-control` | Temperature, trend, operating/survival dwell, inhibited payload, heater OFF/ON/AUTO; `technical-thermal` | Single equipment-bus thermal model, not a spatial thermal solver; [NASA thermal control](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/) plus model assumptions |
| `power-aging` | BOL/EOL forecast, array/battery factors, lost capacity; `technical-power` or preflight forecast | Exercise-duration degradation is accelerated/authored, not calibrated short-duration chemical aging; [NASA power](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/) |
| `pointing-recovery` | Requested/state/quality/settling and explicit `REACQUIRE_POINTING`; `technical-pointing` | Finite slew/reacquisition abstraction, not reaction-wheel momentum unloading or rigid-body control; [NASA GNC](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/) |
| `link-resilience` | Geometry/allocation/uplink/quality/reason, NORMAL/ROBUST rate/power trade-off; `technical-link` | Dimensionless quality envelope, not calibrated dB/SNR or live DSN; [NASA communications](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/) |
| `onboard-recovery` | State, cooldown, boot time/energy/power and explicit `RECOVER_COMPUTER`; `technical-computer` | Authored fault/recovery timing, not a dose-derived reliability calibration; [NASA avionics](https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics/) |
| `capture-reserve` | Nominal/planning/available/reserve and realized capture Δv; `fuel-planner` | Bounded seeded burn-demand uncertainty, not navigation covariance/Monte Carlo trajectory dispersion; [NASA Mars fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) plus explicit assumptions |

`TechnicalSystems` in [TechnicalSystems.tsx](../apps/web/src/ui/phases/TechnicalSystems.tsx) also exposes duty-cycle controls through ordinary role-checked commands. All six topic families include limitations and related explanations. A general NASA chapter explains the phenomenon; it does **not** validate authored coefficients. Exact units/ranges/provenance belong to core model definitions and [TECHNICAL_MODELS.md](./TECHNICAL_MODELS.md).

All shipped topic prose and UI labels need English and Brazilian Portuguese. [i18n/config.ts](../apps/web/src/i18n/config.ts) initializes the languages; [i18n/resources.ts](../apps/web/src/i18n/resources.ts) integrates additional resource bundles with locale JSON. Numeric display uses the current locale. Key parity is necessary but does not prove scientific accuracy, adjacent coverage or understandable teaching.

## 7. Operation, decisions and causal reports

Friendly labels are not autopilot:

- **Charge** requests `POINT SUN`; it does not silently turn off instruments/downlink.
- **Observe** requests `POINT TARGET`; instrument on/off remains explicit, and its observing requirements still apply.
- **Point home** requests `POINT EARTH`; **Send** separately requests `DOWNLINK on`. The UI explains the combination rather than disguising it as a permission-bypassing bundle. Requested, queued, delivered and actually sending remain different states.
- **Protect spacecraft** requests `SAFE on`; exiting safe is also explicit. Safe mode is an operating strategy, not radiation shielding.
- Technical heater, link mode, duty, pointing and computer recovery use `CommandButton`/core quotes and the same actor/delivery rules. A successful request preview is not proof the command has applied onboard.

[FlightControls.tsx](../apps/web/src/ui/phases/FlightControls.tsx) supplies core quote/refusal previews and actor/transport receipts. Flight options are embedded in bottom mission control, not a second fixed deck. The single primary owns contextual clock control; a persistent summary retains next light/shadow/contact edge, absolute T+ time, its advance action and next contact even with the full timeline closed. Closing options never conceals when the next contact is. A centred DecisionOverlay remains visible regardless of tool visibility and preserves explicit options. Acknowledgement stays paused. Workshop retains instruments, crew procedures and technical subsystem controls; Log retains receipts/events.

[Report.tsx](../apps/web/src/ui/phases/Report.tsx) uses the authority-projected terminal review identity/outcome and requirement evidence, never recomputing a remote outcome from a reduced public snapshot. Review is terminal-only. Assisted/unassisted is a separate identity attribute. Level, rules version and seed separate new bests from older incomparable profile/difficulty results.

The report tells **choice → observed result → what to try next**, backed by actual design/telemetry/first-failure facts. Battery and delivered-results charts are primary; dose and score weights are Detailed content. Chart/failure/recommendation groups have Explain. Curated USGS mission/product links are contextual evidence with a labelled heuristic, not proof the fictional spacecraft produced those real datasets.

## 8. Scientific honesty guardrails

- Watts are a rate; watt-hours are stored energy. Never call both “battery power” or combine them into one energy score.
- Storage, collection, monitor hours and delivered data are distinct; show the objective's actual metric and units.
- Safe mode changes modeled operations, not radiation dose/shielding or guaranteed survival. Do not infer hardware loss probabilities from ISS dose readings.
- RadLab readings are an ISS snapshot replayed as an environment approximation, not a calibrated map for arbitrary player orbits. Co-occurrence with DONKI does not attribute each peak to a storm.
- Mars surface measurements remain surface facts; authored Mars-orbit hazards must be separately labelled.
- Higher/wider orbits are not universally safer/better. Compare current model results and disclose omissions: two-body dynamics, no J2/drag/third-body perturbations, simplified illumination/contact and heliocentric assumptions.
- Capture feasibility depends on actual dry mass, Isp, tank and fuel. Do not assert that one Δv universally breaks the 180 kg class, or that a planning upper bound guarantees realized success.
- Thermal temperature is a single-bus estimate; reduced link quality is not dB; accelerated aging is not real mission-life prediction; reacquisition is not momentum desaturation; command expiry is an authored operations rule.
- Camera modes never issue attitude commands. Close views use true-proportioned spacecraft and floating origin; maps use markers. Pilot input explicitly sends a core attitude target, with GROUND transport for uncrewed missions and ONBOARD for crew. Kinematic quaternion slew is not torque integration, thrust, a changed orbit or a guaranteed successful command.
- Readiness/refusal uses core validators in both presentations. Never turn missing forecasts green, hide strict limits behind rounded bars, promise repair through reload, or invent numerical examples as measurements. Static reload loses the active flight; LAN reconnect rehydrates only while the in-memory Bun room survives.

### Bottom mission control, tours and the copy diet

The pure next-step resolver orders mission payload/mass/eclipse/radio failures before severity-three cues, actual stage blockers and severity-two improvements. Design improvements wait until Build is reachable; returned-data shortfalls select radio rather than more instruments when core forecasts identify downlink as the bottleneck. Flight prioritizes pending decisions, deployment and operational cues. After a terminal outcome the steps are open the debrief, inspect the replay and redesign; operating cues no longer appear. Redesign keeps the accepted brief and paid hardware and reopens Build, but freeze, verification and sign-offs are redone; an unaccepted brief stays at Need & goals. Steps carry the requirement/cue/blocker owner; completion comes only from actual state. First Light exposes its missing Earth camera during Build, before readiness. Show me reveals and highlights a control/model slot without choosing equipment, signing, repairing or issuing commands.

Primary Aspiring prose blocks target at most 25 words. Resource teaching, hardware descriptions, provenance IDs, owner/method/revision evidence, maturity and disposal disclaimers move into Details, adjacent Explain or Help → Model limits; none is deleted. The report keeps actual objective return, failure title and one suggested experiment visible; the evidence remains expandable. A changed design is never silently installed during redesign. Test & launch offers an explicit Return to Build beside the forecast/checks, including prelaunch Implement; navigation never refreezes or repairs the design.

Welcome, Build, Launch, Flight, Debrief and quote-specific Choice tours are device-local. Aspiring starts after readiness; Expert receives an offer. `astrix.tours.v2` records each independently and introduces the new controls even on devices that finished the former shorter tours. Cards retain n/N, Skip, Back/Next, Finish, Escape and focus restoration. Each step names one actual control: every chapter/stage/substep, requirement, slot toggle/category/component, checklist task, panel route, resource/camera option, command/pilot axis and warp speed has coverage. Tours reveal presentation disclosures or view-only inspection, never install, freeze, approve, command or advance to manufacture a target. Actual quote controls receive their own tour rather than a Parts fallback. Presentation state is restored on exit. A flight tour removes only its own `tour` pause; no automatic resume.

The Requirements tray reuses actual targets/results through briefing, Build, flight and debrief; Detailed evidence remains available. Spacecraft slots move from the scene overlay to the same bottom controller. Desktop exposes five gated chapter buttons plus a native stage/substep selector; compact retains the selector and four panel buttons instead of repeated collapsed pills. This explicitly requested bottom navigation replaces, rather than adds to, the former scattered chrome. Navigation is not permission to bypass guards. One options tray opens at a time; its close returns to its trigger. Component inspection remains anchored beside the projected part on desktop and view-only in flight.

LAN pairing shows admission, assigned responsibilities, readiness, presence and stale/disconnected status. These establish shared identity and authority, not completed phone gameplay: dedicated role-specific design/flight consoles remain unimplemented. A personal role tab or explanation cannot claim another player's discipline or acknowledge a pending physical decision. See [Multiplayer](./MULTIPLAYER.md).

Disclosure relocation map:

| Previously primary | Current reachable location |
|---|---|
| Automatic resource lessons and W/Wh explanation | Badge popover → Explain; Help → Model limits |
| Full part descriptions and physical requirements | Component panel and Explain |
| Requirement IDs, method, owner, revision and unmodeled quality | Requirements Details; Detailed presentation |
| CML qualification and provider/CAD boundaries | Concept maturity and CubeSat-size topics |
| FCC/disposal screening uncertainty | Readiness Model limits → disposal-screening |
| Scene scale, frame, imagery and illustration limits | Scene status Explain → scene-scale |
| Detailed readiness/maturity provenance | Readiness Model limits; Details forecast |
| Report identity, traces, unsupported quality and replay limits | Expandable outcome/identity/replay evidence |


## 9. Maintenance and verification ownership

When adding a scientific field/control: extend core output/provenance, topic/binding/source registry, both languages, diagram text equivalent where appropriate, adjacent Explain, and an actual reveal route if Show me is offered. Keep the `core → data` boundary acyclic. No duplicate beginner calculator or executable formula in translations; displayed results come from core.

Source-level checks cover quote equivalence/refusals, seven-resource forecast/live mapping, component specifications/live readings, state-derived guidance ordering/completion, role ownership, tour navigation/persistence, setup defaults, complete topic locales, pause preservation and delayed receipts. Browser procedures cover target visibility, drag tracking, all collapse/tour controls, focus/inert restoration, 320 pixels/200% zoom, both locales, reduced motion and a complete mission journey. Novice comprehension still requires a separate human study.

The integration owner records commands actually run, browser observations, failures and unverified cases in [VERIFICATION.md](./VERIFICATION.md). This documentation task records no executed tests, browser acceptance or participant-study result.
