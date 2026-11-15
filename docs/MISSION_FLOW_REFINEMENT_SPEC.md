# Mission Studio refinement — scoped implementation plan

**Status: implemented; verification evidence and remaining validation limits are recorded in [VERIFICATION.md](./VERIFICATION.md#mission-studio-delivery--rules-v3).** The seven core stages, gating and teaching contracts here still hold; the [guided immersive redesign](./plans/GUIDED_IMMERSIVE_REDESIGN_PLAN.md) (rules v4) presents them as five chapters with CAPCOM guidance, and its verification is in [VERIFICATION.md](./VERIFICATION.md#guided-immersive-redesign--rules-v4-2026-11-15). Research date: 2026-11-14. This governing scope builds on [SIMULATOR_REFINEMENT_SPEC.md](./SIMULATOR_REFINEMENT_SPEC.md), supersedes its free stage navigation and profile × difficulty selectors, and supersedes this document's earlier four-step draft. The delivered lane is one educational mission-design game, with automatic contextual teaching for Aspiring and on-demand teaching for Expert. Implementation is not flight certification, novice-study evidence or unrestricted custom mission authoring.

**Line B presentation supersession (2026-11-14):** [Guided immersive redesign](./plans/GUIDED_IMMERSIVE_REDESIGN_PLAN.md) replaces the five-screen wizard, header rail, window dock, automatic teaching paragraphs and mode-only pointing with one setup screen, scene-first HUD, collapse-in-place tools, CAPCOM, per-surface tours, attitude commands and forecast dry runs. The seven stages, deterministic core, actor permissions and explicit launch remain authoritative. Current implementation contracts are in [LAYOUTS.md](./LAYOUTS.md) and [SCIENCE_UX.md](./SCIENCE_UX.md); only [VERIFICATION.md](./VERIFICATION.md) records executed checks.


## Navigation

- [1. Scope decisions](#1-scope-decisions)
- [2. NASA and MDL design principles](#2-nasa-and-mdl-design-principles)
- [3. Home, setup wizard and settings](#3-home-setup-wizard-and-settings)
- [4. Six development stages and final review](#4-six-development-stages-and-final-review)
- [5. Collaborative design sessions](#5-collaborative-design-sessions)
- [6. Mission maturity and launch questions](#6-mission-maturity-and-launch-questions)
- [7. Levels and persistent resources](#7-levels-and-persistent-resources)
- [7.3 Teaching contract and concept coverage](#73-teaching-contract-and-concept-coverage)
- [8. CubeSat mission improvements](#8-cubesat-mission-improvements)
- [9. GMAT interoperability](#9-gmat-interoperability)
- [10. Mission visualization](#10-mission-visualization)
- [11. Crewed Earth-orbit mission](#11-crewed-earth-orbit-mission)
- [12. Contracts and migration](#12-contracts-and-migration)
- [13. Implementation sequence](#13-implementation-sequence)
- [14. Acceptance and verification](#14-acceptance-and-verification)
- [15. References and evidence](#15-references-and-evidence)

## 1. Scope decisions

These decisions record the final scope form, not recommendations awaiting another answer.

| Topic | Decision |
|---|---|
| Mission journey | **Six NASA-inspired stages plus final Review**, replacing the four-stage draft: Need & goals → Concept → Requirements → Design → Build & verify → Implement → Review |
| Levels | **Aspiring / Expert**, replacing both profile and difficulty. Aspiring inherits Educative + Cadet; Expert inherits Technical + Flight Director. Guided/Detailed stays presentation only |
| Entry | Informational Home, then a five-step setup wizard. Submitting creates the configured attempt at Need & goals; it does not launch |
| Maturity | Evidence-based, CML-inspired assessment, not a knowledge quiz. Players resolve design-linked questions before launch |
| Collaboration | **One shared screen, 1–4 players, MDL-style design rounds**, concerns, sidebars and a rotating facilitator. No online sessions |
| GMAT | Include **all three**: sampled ephemeris visualization; ASTRIX initial-orbit export; restricted, convertible GMAT initial-orbit import |
| Development schedule | **Deferred.** No simulated months, task durations, rework-time budget or licensing countdown. Build & verify is still a real logical gate |
| Crewed mission | **Included in this delivery**, alongside the other slices, with four virtual crew and reduced life support. Not replaced with astrophysics and not deferred |
| CubeSats | Keep **3U and SmallSat** buses; add dispenser fit, deployment consequences and a qualified disposal estimate. No 6U/12U expansion. The new crew capsule is a separate class, not a CubeSat expansion |
| Scene visuals | Include NASA Earth/Mars textures, model-derived orbit/status overlays, timeline and camera presets |
| Later settings | Physics-neutral preferences and players/roles may change during an attempt. Mission and level changes require an explicit confirmed new attempt |
| Visual language | Void Protocol-inspired compact neutral HUD, hairline borders, restrained accents, readable numeric telemetry and original static Home illustration |
| Wizard controls | Button toggle groups replace selects for preferences, players and roles; sound and reduced motion use switches. Level and mission remain native radio cards. Labels/options align and controls reflow at 320 CSS px |

The Space Apps theme remains integrated mission design: scientific objective → engineering and operational trade-offs → limited resources → mission outcome → learning and redesign. [CHALLENGE_ACCEPTANCE.md](./CHALLENGE_ACCEPTANCE.md) remains the existing evidence checklist. The challenge's suggestions are not all mandatory: accounts, networking, competitive play, sandbox mode, public leaderboards and design-sharing infrastructure are out of scope. GMAT interchange is a scoped exception to the earlier exclusion of design export/import.

### 1.1 One clear product lane

**ASTRIX is a mission-design learning game: choose a measurable goal, make spacecraft and plan trade-offs, launch explicitly, operate the mission, explain the outcome, and redesign.** It is not an unrestricted mission authoring system, a general GMAT replacement, a legal approval tool or a human-flight safety simulator.

The NASA stages organize that one loop; they are not six independent applications. First Light is the suggested first attempt because its camera → power → storage → contact → returned data chain exposes the loop concretely. Expert users may choose any mission immediately. The other existing missions and Crew Pathfinder use the same journey with mission-specific content, not additional mandatory workflows.

Keep all previously selected features in the delivery, but separate their **exposure**:

| Surface | Visible by default | Open only when relevant or requested |
|---|---|---|
| Core mission game | Current stage, next action, short goal, resources, scene and one main task | Detailed models, source evidence and advanced numeric controls |
| MDL collaboration | Shared design and the relevant role's decisions | Concern threads/sidebars and facilitator tools; solo never impersonates four teammates |
| Mission maturity | A small “ready / needs attention” checklist with actual blockers | CML-inspired level, traceability detail and evidence provenance |
| GMAT tools | An optional Advanced tools entry outside the recommended first-attempt path | Viewer, supported orbit import and export; never prerequisites for play or launch |
| Crew support | Only in Crew Pathfinder | Atmosphere detail, assumptions and underlying inventory calculations |
| CubeSat responsibility | Fit/deployment checks where applicable | Licensing context and qualified disposal estimates; no legal paperwork exercise |

**Scope firewall:** no new destination physics, generalized scripting, arbitrary mission/science authoring, task calendars, regulatory simulation, collaborative document editor, complex operations economy, online collaboration, individual physiology or medical outcomes. An unmodeled phenomenon gets a clear limitation, not a newly invented subsystem. This refinement cannot add features merely because a reference mentions them.

Implementation proves the complete First Light lane first, then applies the same contracts to the other selected missions and optional tools. This is integration order, not permission to omit the previously approved crewed mission, GMAT paths or textures.

### 1.2 Adversarial findings resolved by this revision

| Risk in the earlier plan | Required refinement |
|---|---|
| A collection of labs, imports and engineering artifacts obscured the actual game | One goal → trade → operate → learn lane, with secondary tools outside the default path |
| Six stages could become six sets of homework | Each stage asks one practical question, produces one reused artifact and has one primary next action (§4) |
| Existing Explain links and Guided defaults did not guarantee teaching | Explicit automatic/on-demand contract, concept coverage and behavioral acceptance (§7.3) |
| Requiring two full designs and multiple approvals could stall a first attempt | One baseline-versus-proposal comparison is sufficient; no mandatory duplicate build or all-player vote per edit |
| Formal declarations could block launch without modeling anything | Only actionable game constraints and relevant decisions block; legal/environmental declarations remain non-certifying reference material |
| New economy or broader engineering models might be added “for realism” | Existing transparent budget first; paid service cost only if that selected service is actually modeled, with no general operations economy |

The source audits establish design risks, not measured usability failures. Independent adversarial findings are incorporated before implementation; novice comprehension still requires actual user observation.


## 2. NASA and MDL design principles

### 2.1 Begin with the end product

Julie Levri's *Design and Develop Science Missions* [N1, pp. 8–23] is the UI/UX process reference, not a visual skin. Its process is Identify need & goals → Define concept → Define requirements → Design → Build & verify → Implement. ASTRIX adds Review as the game learning loop.

Start with the **User segment**: who needs which scientific product, and what quantity or quality would answer the question? Work backward through Ground, Space and Launch. The BioNutrients example links the research result to measurable sample requirements and a verification method; ASTRIX uses the same traceability shape, not its biological thresholds.

Every modeled requirement has: ID, objective, measurable condition and units, verification method, evidence, design revision, owner, and eventual Pass/Fail/Not evaluated result. Example: `SCI-DATA-01 → return 1,500 MB by day 14 → simulation measurement`. This quantity is a fictional mission requirement, not a NASA performance claim. Unmodeled scientific quality remains Not evaluated rather than inferred from MB returned.

### 2.2 Four segments are not four stages

Launch, Space, Ground and User are **concurrent mission segments**, not sequential screens. Show them in the concept board and traceability view throughout the journey. A space segment without a ground delivery plan does not complete a science mission; a successful launch alone does not establish scientific success.

### 2.3 MDL-inspired work, not NASA-grade certification

The [GSFC Mission Design Lab](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/) [N3] supports CML 1–4 through tailored studies. Its disciplines contribute requirements, alternatives, interfaces, resource estimates, risks and recommendations. The six-day point-design study is a real MDL option, **not an in-game timer**. CATTENS and MDL process papers [N4, N5] support shared equipment lists, mass/power/data rollups, ConOps and iterative tag-ups.

ASTRIX adopts those shared artifacts and feedback loops. It does not claim to reproduce NASA cost estimating, formal independent assessment, environmental qualification or agency approval.

## 3. Home, setup wizard and settings

### 3.1 Informational Home

Home works without WebGL. Its first screen answers **What is this? What will I do? Where do I start?** with one primary Set up a mission action and a recommended First Light/Aspiring path. Supporting content explains:

1. The six-stage journey and Review through one connected camera/power/storage/downlink example.
2. Four mission cards with goal, environment, trade-off and crew applicability.
3. Aspiring versus Expert, local solo/shared-screen play, controls and accessibility.
4. Model boundaries, sources, credits and no endorsement, below the starting task rather than ahead of it.

Conditional Continue setup, Use last setup and Return to paused attempt must name a real underlying draft/configuration/in-memory attempt. A remembered setup is never called a saved flight. Language, reduced motion and sound remain reachable before setup. No compulsory tutorial, quiz, reading time or age gate.

### 3.2 Wizard

| Setup choice | Current single-screen presentation |
|---|---|
| Mission | Four static illustrated cards; no renderer before entry |
| Level | Aspiring default; Expert switch, preserving explicit display-depth preference |
| Team | Optional shared-screen disclosure, 1–4 players and role assignment; no multiplayer transport |
| Preferences | Language/sound/reduced motion on Home; display depth/playback in Settings |
| Start | One explicit Start creates the configured design attempt, never launches |

Native radio mission cards, labelled level buttons, fieldsets/legends and visible error correction remain keyboard/touch accessible. No preference or review ritual blocks the first mission action.

Preserve draft answers across Back, language changes, validation errors and return from Home. Version the draft and last-started configuration separately; do not persist player names by default. Use route/history state that works on the static host (hash routing or existing equivalent, no new server rewrite dependency). Unknown or incomplete deep links open the first required unanswered step, never create an attempt.

**Begin mission design** uses the existing real preparation/committed-draw handshake, cancellation token and rollback. Home/wizard create no renderer; preparation mounts the single simulator Canvas and keeps it mounted thereafter. A failed or canceled entry retains the draft and prior attempt. Progress means actual preparation stages, not fake percent loaded. Reserve **Launch** for creating the flight and **Advance/Resume** for time progression; do not label entry as if flight simulation had already begun.

### 3.3 Settings during an attempt

Persistent Settings separates:

- **Change during this attempt:** language, display depth, pacing, audio, reduced motion, rendering quality and player/role arrangement.
- **Requires a new attempt:** mission and level, shown with a Set up a new attempt action and explicit replacement confirmation.

Opening Settings pauses using its own reason; closing removes only that reason and never resumes. Role/team edits also affect authorization and scoring, although not physical constants: apply while paused, reassign all removed-player responsibilities, invalidate affected sign-offs, and audit immutable old/new roster snapshots. Already accepted command receipts keep their original actor; pending approvals cannot be inherited without review. Solo keeps actor ALL. Existing store/UI guards that forbid all in-flight team edits must migrate, not simply expose the controls.

## 4. Six development stages and final review

Six NASA-inspired stages remain, but the player sees **one question, one main task, one reused output and one primary next action** at a time. Every stage also shows “Why this matters” according to the teaching policy (§7.3). Use plain-language subtitles before acronyms.

| Stage | Player's question | Main task and reused output | Primary action and gate |
|---|---|---|---|
| **1 Need & goals — What are we trying to achieve?** | Who needs which result, by when? | Confirm the selected mission's measurable brief and intended product; do not author a science program from scratch | **Continue to concept** once the measurable goal is set |
| **2 Concept — How will the mission work?** | How do launch, spacecraft, ground and users connect? | A prefilled, editable four-segment mission storyboard, not four empty documents | **Continue to requirements** when applicable modeled segments connect to the goal |
| **3 Requirements — What must be true?** | Which limits and results define success? | Mission-derived requirement cards show target, unit and how the game checks it; no manual requirements matrix required | **Continue to design** when essential requirements are explicit and evaluable |
| **4 Design — What should we choose?** | Which hardware, orbit and communication plan fit? | Select parts and plan in one workspace; see before/after mass, power, cost and data consequences; save one baseline | **Check this design** runs the applicable core checks; a baseline-versus-candidate preview counts as the trade comparison |
| **5 Build & verify — Is this design ready?** | What still prevents launch? | One concise revision-bound checklist generated from the baseline, with Fix/Show me actions and role approval where needed | **Continue to launch** after actionable essential checks and decisions pass |
| **6 Implement — Fly and operate** | What should we do next? | Clearly marked substeps **Launch → Deploy/commission → Operate → Finish**; shared resource rail, current decision and role console | **Launch** is explicit; then **Start operations / Advance / Resume / Resolve decision** as appropriate; finish only on a terminal core outcome |
| **7 Review — What happened and why?** | Which choices helped or limited the mission? | Objective and requirement results, a short causal recap, timeline/resources and one useful next experiment | **Redesign and fly again**, **Repeat setup** or **Home** |

The stage indicator is an ordered progress list, not the old tablist. Future stages expose their unmet gate without pretending they are available. Before launch, Back permits iteration; changing a prior artifact makes only dependent evidence/approvals stale. Keep the chosen hardware and unaffected inputs. During a side trip, make the return action explicit so users know how to continue.

**No document treadmill:** brief, storyboard, requirement cards, equipment list and readiness are different views of the same mission data, not independent forms requiring repeated entry. Requirements are limited to quantities the game actually models. “Not evaluated” scientific quality or institutional paperwork cannot become a puzzle with no computable solution.

**Build & verify without a development schedule:** validate modeled fit, dependencies, operating sequence and resource checks. TVAC/licensing/reference material is labelled as unmodeled context, not a required declaration that grants simulated qualification. Do not introduce task timers or months of testing. Deployment verification is a check of the supported configuration/sequence; an actual seeded deployment anomaly remains an operational event.

**One launch authority:** stage gates call shared core checks, not parallel React validators. All-Go enables Launch but never triggers it. Explicit Launch rechecks baseline revision, actor and current approvals and cannot double-launch. The optional skippable storyboard is separate from physical ascent; it neither burns modeled ascent fuel nor advances mission time. Start operations/resume is explicit and state-derived, without stacking redundant “Continue” prompts.

After launch, earlier artifacts are available read-only through As flown, not editable stage navigation. Show me never skips a gate or writes a command. Opening/closing explanations, changing a view or dismissing a handoff never launches or resumes. End mission is a confirmed, immediate session action independent of contact. An early in-progress dashboard is never labelled a final review.
### 4.1 The operational loop must also be stepped

Implement is not a single long mixed control panel. Its milestone strip is **Launch → Deploy/commission → Operate and deliver → Close out/recover**; show the current milestone and next actionable task. Mission-specific milestones are skipped explicitly as Not applicable, never fabricated. Observation and delivery can repeat and overlap; they are not mandatory fixed-order burns.

| Context | Next-task loop | Completion or next boundary |
|---|---|---|
| First Light | Orient/observe → collect into storage → use a valid contact to send → inspect returned science | Contact, shadow/energy, storage, objective or mission end |
| Storm Watch | Configure monitor and pointing → record radiation observations → manage power/safe mode → inspect recorded hours | Storm boundary, energy/fault, objective or mission end |
| Red Relay | Inspect transfer assumptions → explicitly advance to arrival → confirm capture → collect maps/send commands and wait for actual delivery | Arrival/capture, contact, command receipt, science or mission end; no fake continuous cruise |
| Crew Pathfinder | Check support/runway → science and resource priorities → support decisions → deorbit/recover | Crew warning/fault, data/contact, return window or completed recovery; metabolism continues through all elapsed time |

Every cycle is **inspect current state/forecast → choose an authorized action → advance to a named boundary → inspect the observed consequence**. One primary action names that boundary when known (for example Advance to contact); unknown timing stays unknown. Advances integrate all intervening resources, hazards and queued commands instead of assigning a later timestamp.

Aspiring automatically explains newly relevant concepts before choices and consequences afterward (§7.3). Expert may run continuously between the same decision boundaries and request explanations. Both stop at actual actionable critical boundaries; on-demand teaching never means hidden warnings or missed safety stops.


## 5. Collaborative design sessions

### 5.1 Shared model and four role stations

| Role | Design responsibilities | Operational console |
|---|---|---|
| Science | User product, science traceability, instrument requirements and payload trades | Instrument, duty cycle, observation targeting, science progress |
| Spacecraft | Equipment list; structure, power, thermal, avionics, attitude; crew support if applicable | Power, thermal, computer, pointing and life support |
| Launch & Orbit | Launch accommodations, orbit/trajectory, propulsion, end-of-mission plan | Orbit, capture, warp, crew deorbit and recovery |
| Ground & Comms | Ground/relay services, contacts, link/data throughput, delivery to users | Contact/link modes, downlink and command queue |

Systems engineering is shared integration work, with a rotating facilitator; no fifth player. These are educational discipline groupings, not a claim that real MDL specialists are interchangeable.

### 5.2 Design round

Use the existing part/plan quote and resource-delta model as the collaboration surface, not a new general-purpose proposal/document system.

1. The active role proposes a concrete selection against the current baseline revision; everyone can inspect its before/after consequences.
2. An affected role can raise a concern linked to a resource or requirement. A sidebar records the alternative and chosen trade; it is available, not mandatory on every edit.
3. The authorized owner commits atomically if the baseline still matches; stale proposals must be requoted. Comments never bypass part/budget/authority checks.
4. A tag-up summarizes the shared equipment list, plan and actual unresolved issues. Only a blocking modeled conflict or required approval holds the next gate.
5. A rotating facilitator is a lightweight team presentation/coordination role, not another approval layer. Solo directly applies choices as ALL without role-switch ceremonies.

One meaningful comparison (current baseline versus a proposed component, orbit or plan) can demonstrate the trade; never force the player to rebuild two complete spacecraft merely to advance. No essays, imaginary teammates, per-click votes, duplicate signatures or compulsory “everyone speaks” rounds. Relevant role sign-offs happen once against a baseline; only dependent changes invalidate them. Teaching is automatic for Aspiring and requested for Expert, not a separate mandatory team tutorial.

### 5.3 Operational room

Shared scene and always-visible resources; a persistent event feed with owner/acting-role labels; role-owned consoles and alert badges. Hot-seat expands the current console; other consoles remain read-only. Handoff names the player/role and adds its own pause reason; acknowledgement never resumes implicitly. Mobile uses an overview and one role sheet, not four squeezed desktops.

Events offer explicit Show in scene; the camera never steals orientation automatically. Radio line of sight, service availability and actual transmission are distinct statuses. Multi-command decisions remain atomic and core-authorized. Sound is opt-in, with equivalent text and non-color-only cues.

## 6. Mission maturity and launch questions

### 6.1 CML-inspired, not official CML certification

Wessen et al. [N2] describe CML 1–4 as concept formulation: idea, initial feasibility, trades, point design. CML 5 is a baseline concept, **not ready-to-launch hardware**. Do not present higher CML as a substitute for flight verification, and do not confuse CML with TRL.

| Game maturity | Evidence already produced by the journey |
|---|---|
| **1 Need** | Confirmed user, product and measurable goal |
| **2 Feasibility** | Mission-derived requirements, supported verification and initial resource checks |
| **3 Trades** | A meaningful baseline/proposal comparison and a coherent mission storyboard |
| **4 Point design** | Selected baseline, generated equipment list and relevant modeled margins/plan |

The CML-inspired detail is an optional inspection view, not a second progress bar competing with the mission stages. Aspiring gets guided level-3-inspired evidence; Expert gets level-4-inspired evidence. Neither needs a formal CML dossier. Both must satisfy all critical modeled physical/compatibility constraints; no maturity percentage can override missing crew stores or an incompatible launcher.

### 6.2 Evidence states and revision invalidation

Use the user-facing states **Needs attention**, **Ready**, **Changed — check again** and **Not applicable**. Preserve explicit computed/player-decision/external-declaration provenance in detail. Unmodeled declarations remain visibly unverified and cannot become hidden mandatory launch blockers. A check becomes Ready only from current evidence or a concrete supported decision, not a self-assigned green checkbox.

Paper caveats: the approximately 80% green guideline measures completeness, not quality, has no attribute weighting, and needs engineering judgment/independent review. ASTRIX shows per-area progress and essential blockers, not a universal 80% launch rule. The AO-specific example margins (35%, 3/6 dB) are not universal values and must not become fabricated validated game thresholds.

Evidence depends on artifact revision/fingerprint, not a global "all tests passed" checkbox. A component, orbit, roster or requirement change invalidates only dependent evidence and approvals, without simulated rework time. Final readiness always recomputes the baseline.

### 6.3 Questions are design decisions, not trivia

| Question | Evidence used to resolve it |
|---|---|
| Who needs this mission's output, and how much by when? | Selected user/product and measurable objective |
| Which observation and instrument satisfy this requirement? | Traceability edge to an installed, compatible instrument |
| Can this design operate through the chosen eclipse? | Computed generation, load and battery forecast for this orbit |
| How does collected data reach its users? | Storage, contact/relay, link and delivery plan |
| Why choose this proposal instead of the baseline? | A real before/after preview and the selected resource trade; no second full build required |
| What changed after verification? | Baseline diff and affected stale checks |
| What ends the mission responsibly? | Applicable disposal or crew recovery plan, with modeled/unknown boundaries |

Wrong or inconsistent choices explain the conflict and point to a corrective action, with unlimited revision. Neither level requires memorizing NASA acronyms, legal details or quiz answers to play. Questions derive from mission configuration; a generic canned answer is not evidence.

## 7. Levels and persistent resources

### 7.1 Clean level cutover

| Rule | Aspiring | Expert |
|---|---|---|
| Models | Existing Educative reduced models | Six existing Technical mechanisms |
| Budget multiplier | 1.30 | 1.275 = 0.85 × 1.5; pays for required engineering hardware |
| Review cue margin | 1.0 | 1.5 |
| Pacing | Self-paced event advances; optional real time | Accelerated continuous operation with event-boundary pauses |
| Retry | Three named checkpoints maximum, explicitly assisted | No checkpoint rewind |
| Teaching cadence | State-driven CAPCOM and first-entry per-surface tours; short primary copy, full explanation on demand | One-line CAPCOM, all choices, optional tours and the same Explain content |
| Default display depth | Guided, independently adjustable | Detailed, independently adjustable |
| Concept maturity | Guided trade evidence, generated from decisions | Relevant point-design evidence and explicit margins |

No automatic repair. Both keep honest crew consumption and essential-support checks. Do not hide shared basic components arbitrarily; richer controllers appear only where their model applies.

Introduce required `LevelId`, replace public profile/difficulty combinations throughout callers and caches, and bump `RULES_VERSION` to 3. New bests use scenario/level/rules identity. Preserve old score data without relabelling incomparable Engineer/profile results; previous results may be displayed separately. Preserve explicit display preferences rather than overwriting them whenever level changes.

### 7.2 Resource grid — all stages, independent of collapsed tools

| Item | Setup/design | During implementation |
|---|---|---|
| Mass | Design used/ride limit | Actual retained total including propellant and all crew inventories; label launch mass separately |
| Power | Average generation/load and eclipse forecast | Instantaneous generation/load in W; battery energy/capacity in Wh |
| Budget | Hardware and mission development allowance in game units, plus planned operations reserve | Fixed development spent and remaining operating reserve; disclose fictional costing |
| Data/science | Expected generation, storage and return capacity | Stored/returned data and mission objective; Storm Watch additionally shows radiation measurement hours |
| Communications | Planned station/relay and feasible rate | Visibility, allocation/service, active link/rate, queue, next opportunity and light time |
| Time left | Planned operational duration, explicitly not development calendar time | Phase-aware time: Mars cruise versus operational horizon; crew orbit/deorbit/recovery |
| Crew support | Crewed stores/runway versus mission need | Limiting store days plus atmosphere status. Existing uncrewed missions: **not applicable**, never zero health |

Core selectors own all physics. Current code already has many power/data/link/budget values, but lacks explicit live total mass, phase-aware remaining time and crew telemetry. Add them rather than deriving alternate physics in React.

Use a fixed, predictable item order. On narrow screens, wrap labels/values into a grid or reading layout with all seven summaries still visible/reachable; disclosure adds detail, not hidden resource categories. Do not reorder on every threshold or require horizontal scrolling at 320 CSS px. Routine values are not live-announced; meaningful warnings are.

**Cost decision:** do not add an unrequested complex operations economy merely because the challenge suggests one. Retain transparent development cost, and add a simple disclosed reserve for planned paid ground/relay service where used. State exactly which operation incurs a charge; zero reserve removes that paid service, not oxygen regulation or free onboard actions. Full recurring staffing/accounting economics are out of scope.
### 7.3 Teaching contract and concept coverage

**“All concepts” means every concept actually exposed in a choice, resource, status, diagram, refusal, event or result—not an unlimited aerospace curriculum.** Explain meaning, relevance to the current goal, units, trade-off/consequence and model/source limitation. Expand acronyms at first contextual use. Do not expose unsupported controls and then pretend generic prose teaches their nonexistent behavior.

#### Independent teaching and display axes

| Behavior | Aspiring | Expert |
|---|---|---|
| First relevant encounter | State-driven next action plus skippable surface tour | One tour offer; adjacent Explain |
| Before a decision | Benefit, actual quote, visual deltas and explicit Preview → Install | Same quotes, deltas, units and all categories visible |
| After a choice | Factual accepted change or refusal; completion derived from state | Same result/receipt; scientific detail on demand |
| Operational event | Centred paused decision, event toast and operational guidance | Same essential warning and explicit controls |
| Review | Actual objective return, one experiment, expandable evidence and replay | Same causal evidence plus detailed metrics |
| Guided/Detailed | Independent depth; full lessons/limits under Details/Explain | Independent depth; no legacy alternate shell |

Warnings, readable labels, units, provenance, real receipts and essential corrective information are never hidden behind Expert's on-demand help. Viewing teaching neither marks an attempt assisted nor changes scores. Guidance never chooses parts, repairs failures, signs reviews or issues commands automatically.

#### Definition → decision → consequence

Before commitment, show the relevant definition and actual core quote/forecast; unknown is not zero. Afterward distinguish **predicted**, **accepted/queued**, **executed** and **observed**. A refused or stale quote cannot produce feedback claiming an improvement happened. A Mars command in a queue does not mean an instrument is operating. Review ties recorded choices/executed actions to supported causes; state when history or the model cannot establish causation.

#### Delivery without a tutorial subsystem

Reuse the existing science-topic registry, Explain drawer, frozen snapshots, quote values and pause authority. Extend content/bindings, not a second glossary, tutorial engine or physics calculator.

- Automatic teaching is a short inline card in the current task, not an automatically opened modal. It never steals focus, moves the camera, starts audio, acknowledges a decision or advances time.
- Keep the main action readable and reachable on a phone. Several new resource concepts get compact meanings and the lesson relevant to the current decision, not a stack of popups.
- Track **introduced**, never “understood/mastered,” by stable concept/model context within the attempt. Full introduction once; later encounters get short current consequences and Replay/Explain. Language/depth changes and ordinary revisits do not reset it. A genuinely new fault or model boundary gets its own relevant explanation.
- Lessons remain replayable after a checkpoint rewind; no fictitious learning state is inferred. A new attempt may replay guidance.
- Actionable operational events pause through existing event-boundary logic. Inline teaching adds no physical pause behavior. Opening deeper Explain adds only its explanation pause reason; closing removes only that reason, restores focus and never resumes.
- No quiz, reading timer, mandatory acknowledgement, help score or comprehension claim. Cards can be dismissed/replayed. Opening optional advanced material triggers relevant automatic explanations for Aspiring; collapsed tools are not required reading.

#### Coverage matrix

This inventory covers exposed concepts, not all rows in every mission. Technical-only and optional-tool concepts are introduced only when applicable.

| Group | Meanings and consequences to teach | First relevant encounter |
|---|---|---|
| Goal and science | User, science question, measurement/product, threshold, collected versus delivered science, unmodeled quality | Mission brief |
| Mission process | Six stages versus four concurrent segments, ConOps, requirements, traceability, verification | Storyboard and requirement cards |
| Trade and collaboration | Equipment list, role authority, proposals, revisions, freeze/stale evidence, alternatives, margins/reserves | First design comparison |
| Maturity | Evidence versus quality; CML-inspired completeness versus TRL/flight qualification; declared versus unknown | Readiness/maturity |
| Mass and fit | Mass versus volume, dry/wet/retained/launch mass, provider envelope and bus/ride compatibility | Parts and ride comparison |
| Power and energy | Generation/load in W, battery storage in Wh, usable capacity, eclipse, panel/battery trade, solar distance | First panel/battery choice |
| Budget and time | Fictional cost units, actual paid services/reserves if applicable, operational horizon versus deferred development calendar | Constraints and resource rail |
| Instrument and data | Prerequisites, duty cycle, generation/storage/overflow, returned objective, radiation hours versus MB | Payload and first operation |
| Pointing and camera | Attitude changes power/science/link; camera manipulation changes visualization only | First pointing/camera action |
| Orbit and launch | Altitude, shape, inclination, period, coverage/contact/eclipse effects, ride capacity and offered orbits | Orbit/launcher choice |
| Communications | Visibility/allocation/transmission, throughput, pointing/power, telemetry versus science, bits/s versus data units | Ground plan and first send |
| Command transport | Requested/queued/transmitted/arrived/executed/refused/expired; light time versus contact waiting; onboard/ground/session action | First receipt and new delay mode |
| Transfer and return | Delta-v, specific impulse, fuel/mass, transfer/capture margin, crew return window and abstracted recovery | Mars/crew plan |
| Expert mechanisms | Thermal operating/survival bounds, heater cost, EOL/aging assumptions, slew/settling/reacquisition, robust link, reset/cooldown, capture uncertainty | First applicable forecast/control/fault; on demand |
| Hazards and recovery | Radiation/source scope, safe mode is not shielding, seeded versus measured anomaly, mitigation and observable recovery | Relevant brief/event |
| CubeSat lifecycle | Stowed/deployed hardware, inhibits/DITL, deployment-dependent output, disposal uncertainty, applicability not legal approval | Fit/deployment/disposal |
| Crew support | Virtual crew versus players, finite O₂/water/food/scrubber, runway versus working fan, gas regulation, partial pressure and rolling CO₂, retained waste/mass, recovery reserve, nonmedical limits | Crew loadout/support; fault-specific detail when needed |
| External orbits | Viewer versus game, initial state versus dynamics, body/frame/epoch/orientation/phase, units/samples/gaps/interpolation, exact versus shape reduction | Explicitly opened GMAT tool |
| Visual/model evidence | Forecast/observation; reference/measured/calculated/authored values; enlarged craft, schematic ascent/recovery, historical textures and frame assumptions | Corresponding legend/source |
| Outcome and replay | Pass/Fail/Not evaluated, causation limits, actors, assistance/rewind, rules/score comparability, redesign versus resume | Result/retry and Review |

Each exposed entry has a stable concept ID, localized instructional destination, applicable mission/model contexts, numeric snapshot/quote bindings and a trigger/target in the existing science content. A registry entry or translation-key parity alone does not prove delivery.

#### Example: the battery decision

First Light's initial battery comparison automatically tells Aspiring: panels supply W in sunlight; the battery stores Wh for shadow. Show this design's usable energy, eclipse need and margin. The actual larger-battery quote shows energy gained and mass/room/cost spent. On acceptance, explain the changed margin and cost without guaranteeing survival. Operation/review compares real discharge and recorded loads with that forecast.

Expert sees the same real values, quote and failed margins without the introduction; Explain opens the same contextual chain. Guided/Detailed changes neither teaching cadence nor simulation state.


## 8. CubeSat mission improvements

### 8.1 Correct use of CubeSat 101

The supplied summary is useful for topics but contains overgeneralizations. Verify against CubeSat 101 [Q1] and CDS Rev. 14.1 [Q2]:

- 2017's 3U <4 kg is a historical/provider constraint. CDS 14.1 gives a **typical 3U 6 kg**, with provider exceptions. Keep ASTRIX's <4 kg as the **selected dispenser contract**, not a universal CubeSat law.
- Nominal 3U envelope is about 10 × 10 × 34 cm, not exactly a 1:3 aspect-ratio cube. Use the selected provider dimensions; distinguish rail envelope and usable internal volume.
- The 6.5 mm protrusion provision concerns specified rail-plane surfaces, not every face.
- TVAC, DITL and environmental qualification differ. A change invalidates **affected** evidence; it does not universally require repeating every test.
- Licensing depends on jurisdiction/operator/use. Not every camera automatically needs NOAA approval. No clicked checkbox grants FCC/NOAA authorization.
- FCC's applicable five-year post-mission disposal rule is not a universal law for every spacecraft; ODAR is an assessment report, not the rule itself.

### 8.2 Included work

1. **Dispenser contract:** allowed bus, mass, stowed envelope class and deployable compatibility; show dimensions/limits and assumptions. Categorical fit screening is not CAD clearance certification.
2. **Deployment state:** existing deployable wings are not missing hardware. Add stowed/deployed/anomalous state; available generation and antenna operation reflect actual deployment. Commissioning/DITL verifies inhibits and the specified post-deployment sequence.
3. **Anomaly and mitigation trade:** disclosed seeded deployment anomaly, actionable diagnosis/retry or reduced operation, and a cost/mass-bearing mitigation option. Never claim calibrated failure probability or a redundant restraint guarantees success.
4. **Disposal screening:** area/mass, orbit, solar/drag assumptions and disposal strategy drive an authored screening estimate or uncertainty band. If inputs/model scope cannot support an answer, show **unknown/review required**, not compliance. Operational orbital propagation remains two-body unless explicitly changed; a disposal forecast is not a hidden drag force acting on live orbit.
5. **Maturity evidence:** RF path, remote-sensing applicability, debris plan, fit, DITL and declared environmental review. No legal approvals, development scheduling or testing countdowns simulated.

No new 1U/6U/12U part families in this scope. All current part quantities and added mitigation hardware remain paid and accounted in mass/room/power.

## 9. GMAT interoperability

### 9.1 Two distinct products, one renderer

**A game mission is not an external trajectory file.** A GMAT ephemeris carries positions/velocities, not ASTRIX's parts, costs, science model, team decisions or life-support state.

- **Game attempt:** ASTRIX propagates a supported orbit and owns resources/readiness/scoring.
- **Imported trajectory viewer:** visualizes sampled external motion and metadata only; game score, crew/resource forecasts and launch eligibility are **not available** unless supplied by a separate valid game design. Never silently make the external positions drive game success.

Viewer and game modes share the persistent Canvas, not independent renderers. Opening viewer pauses/preserves the active attempt; closing it restores its scene/camera without resuming or modifying the flight.

### 9.2 Sampled trajectory import — included

Support a documented subset, not all GMAT outputs:

| Format | Initial supported profile |
|---|---|
| CCSDS OEM | Text KVN version 1.0 or 2.0 (optional USEABLE_START/STOP_TIME inside segment bounds), Earth/Mars center, EME2000 axes, UTC, km and km/s, explicit segment bounds, position/velocity samples |
| GMAT ReportFile | One selected spacecraft, explicitly identified UTCGregorian and inertial X/Y/Z headers, with optional VX/VY/VZ; documented delimiter/fixed-width profile and import preview. No guessed columns |

Normalize to a versioned ASTRIX trajectory with source/provenance, body, frame, time system, units, object, segments and timestamps. Reject unsupported frames/time scales, empty/header-only data, malformed or nonfinite values, ambiguous object selection and inconsistent metadata. Preserve segment breaks, gaps and discontinuities; do not interpolate through burns or between disconnected segments. Reject backward-time segments in the initial supported profile with a specific error, rather than silently sorting them. No extrapolation beyond available data.

Play by timestamp, not sample index. Show elapsed time, epoch, interpolation method, sample interval and source. Linear interpolation within a sufficiently sampled continuous segment is visibly a display approximation, not GMAT propagation. State gaps show no interpolated craft. Samples do not prove that a spacecraft has power, contact or crew support.

### 9.3 Initial orbit import — included only when convertible

Current `OrbitChoice` loses RAAN, argument of periapsis, anomaly and absolute epoch (`physics.ts:40-44`). To support the selected exact-conversion path, **extend the canonical orbit state first**, across propagation, contacts, sunlight, scene paths, camera identity and export:

`body + epochUTC + frame(MJ2000Eq) + SMAkm + ECC + INCdeg + RAANdeg + AOPdeg + TAdeg`.

Retain convenient periapsis/apoapsis-altitude editing as conversions into that same representation, not a second independent orbit model. Define the game clock as relative seconds from the explicit epoch. Imported epoch affects astronomical directions consistently; built-in scenarios use their authored epoch. Validate singular circular/equatorial orbits through reconstructed Cartesian state, not ambiguous angle equality.

Parse a narrow inert-text `.script` initial-state profile: `Create Spacecraft`, supported coordinate-system definitions, literal DateFormat/Epoch/CoordinateSystem/DisplayStateType assignments and Keplerian state. Epochs in UTCGregorian, UTCModJulian, TAIGregorian or TAIModJulian (TAI converted with the fixed IERS TAI−UTC table; ModJulian rounded to the millisecond); Earth/Mars/Sun MJ2000Eq frames only. Select one spacecraft explicitly. Require unique, complete assignments and validate positive SMA, bound eccentricity, inclination range and periapsis above the body. Document finite precision and state/plane reconstruction tolerances.

Expressions, includes, functions, object copies, missing/unknown metadata, body-fixed frames, unresolved references, hyperbolic/parabolic states and later state mutation are not supported. A full script with Propagate/Maneuver/force-model resources is read for the **selected spacecraft's literal initial state only**: every other statement is counted and shown as ignored, never executed or converted, and the preview says so. Refuse when the selected spacecraft sets no state (GMAT default or ephemeris), uses another state representation, or the mission sequence reassigns its state. Never describe the result as a converted mission.

Even an exact initial-state conversion **does not preserve future GMAT dynamics**, force models or maneuver programs. Publish ASTRIX constants and model differences. If conversion or scenario policy fails, leave the attempt untouched and offer external visualization or an explicitly labelled **shape/inclination-only candidate**, requiring separate acceptance. That fallback is never described as an exact import and still must pass normal design rules.

### 9.4 Initial-condition export — included

Generate an inert GMAT script containing an explicit spacecraft, UTCGregorian epoch, supported coordinate frame and Keplerian state. Mars defines Origin=Mars, Axes=MJ2000Eq. For altitude editing: `rp=R+hp`, `ra=R+ha`, `SMA=(rp+ra)/2`, `ECC=(ra-rp)/(ra+rp)`. Export all actual orientation/phase fields, not fabricated zeros.

Label **initial-condition export**, not complete mission simulation export. Do not invent a force model, burn plan or operational resource model. Validate the selected GMAT release's syntax and independently compare reconstructed state and body constants with the existing GMAT reference harness.

### 9.5 Parser and data boundary

Text only: no execution, eval, path resolution, external URL fetching, plugins or GMAT process launched from uploads. Proposed authored limits: 10 MiB input, 100,000 samples, 256 segments, 16 KiB per line, one selected spacecraft. Reject over-limit input before expensive work; bound trajectory GPU geometry independently from retained data. Decode/parse off the UI thread and support cancellation. Show precise unsupported-format messages, never a successful empty import.

GMAT's MJD convention differs from conventional MJD; initial support avoids that ambiguity by requiring UTC. Leap-second timestamps require explicit supported handling or a clear refusal, not JavaScript date guessing.

## 10. Mission visualization

### 10.1 Findings and required fixes

Read-only source audits identified these issues; they have not been fixed by this planning task.

| Finding | Planned correction |
|---|---|
| Fixed fill/directional lighting can contradict telemetry Sun and eclipse (`AppCanvas`, `OrbitScene`) | Operational sunlight follows core Sun direction, with low legibility ambient and an explicit `sunlit`-consistent eclipse cue |
| Storm Watch's decorative Sun/rays are fixed while simulated Sun changes | Drive direction from core, label particle cues illustrative, never invent a calibrated 3D radiation field |
| Mars diagram puts planets at inconsistent simultaneous epochs, spacecraft off plane and Mars larger than Earth (`TransferScene`) | Label departure and arrival epochs; derive geometry from core transfer; correct relative body sizes. Current cruise skips analytically to arrival: no fake live propagated progress |
| Ground station rotates over fixed stylized land | Shared inertial/body-fixed transform for registered texture, station and ground track |
| Contact and actual transmission conflated; decorative Mars dish suggests a nonexistent local relay | Separate visibility, allocated service and active transmission; show Earth/DSN direction rather than invented Mars ground network |
| Hardware collapses quantities to booleans | Installed-count/category visuals; selected 3U envelope; distinguish stowed/deployed wings. Disclose geometry/area approximations |
| Generic rocket and discontinuous storyboard endpoint | Ride-specific silhouettes, capsule escape-system identity, continuous completed pose; schematic ascent label |
| Scale/fidelity labels replace one another | Show body/orbit scale, enlarged craft, illustrative geometry and data provenance together where applicable |

### 10.2 Overlays and operational readability

- Periapsis/apoapsis and altitude labels; orbital plane/reference-frame indication. Node markers only when supported by the selected orbit/frame.
- Shadow arc from the same cylindrical-eclipse model and Sun as core; modeled contact arcs use the same station/elevation model. Availability is not a guaranteed real pass schedule.
- Labeled phase/context segments, with patterns/icons as well as colors; upcoming/completed/current status has a text equivalent.
- Camera presets for body, spacecraft, orbit plane and station; retain user-directed movement, saved pose, Fit/Reset and touch Explore/Done.
- Event timeline with selectable timestamps. Live view never rewinds through a review scrubber; review playback is isolated and uses recorded positions/resources or deterministic reconstruction.
- A real geographic ground track needs a body-fixed coordinate transform and a registered surface; texture alone does not establish geographic correctness.

### 10.3 NASA textures — included

Use official, appropriately licensed Earth Blue Marble and Mars map sources, with per-asset URL, author/credit, dataset epoch, projection, longitude convention and usage notes. Blue Marble is a historical composite, not current weather. Blue Marble is Earth imagery; Mars needs its own documented global map. Select exact downloadable equirectangular assets during implementation, not screenshots of rotating globes.

Check each asset's third-party restrictions and NASA media-use conditions [V2–V4]; no blanket assumption that a NASA-hosted repository grants all texture/code rights. Store optimized local textures (proposed 1K low / 2K high), load only for the selected body, and keep texture download/decoded-GPU memory budgets separate from JavaScript gzip. Verify prime meridian, handedness, latitude orientation and spin against fixed reference points. The reduced core rotation convention remains disclosed; do not claim high-precision IAU geolocation.

### 10.4 What to borrow from mission-viz

`resources/nasa-mission-viz.md` is a Repomix archive of the older [NASA mission-viz repository](https://github.com/nasa/mission-viz), not a modern reusable mission-control engine. Useful ideas: timestamped trajectories, selectable labels, explicit viewpoints, epoch readouts and GMAT output conversion.

Do **not** transplant its obsolete Three.js/X3DOM stacks, propagator or fixed-index timer playback. The archive's JSON loses frame/unit metadata, irregular timestamps were advanced at uniform timer intervals, and the propagator includes suspect JavaScript exponentiation using `^`. Reimplement the ideas with the current renderer/core. X3DOM's license does not establish repository-wide rights to all demos and assets.

### 10.5 Optimization proof

One Canvas/context, target-based preview renders, demand rendering outside active flight, bounded path samples and no per-frame React state churn. Measure draw calls, texture memory and frame times before/after on the same quality tier/hardware. Share or instance repeated decorative geometry where the measurement justifies it. Do not label a scene optimal based on aesthetics alone. Textures remain optional to scientific state: a missing texture reports a surface-asset problem, not a fabricated renderer failure, and never changes a result.

## 11. Crewed Earth-orbit mission

### 11.1 Authored mission envelope

**Crew Pathfinder** is a fictional four-person LEO mission in this delivery, not a Dragon/Orion recreation. Proposed design envelope: 420 km circular orbit, 51.6°; capsule/service module 10–15 t, 8–10 m³ habitable scale, independently specified 8 m³ free gas volume, 297 K cabin, 3–5 kW generation and 1–2 kW essential electrical load. These are **game assumptions**, not source-qualified vehicle parameters.

Goal: 72 h on orbit with crew-support requirements maintained and a measurable crew observation/engineering data product returned, followed by deorbit and **6 h abstracted recovery**. The recovery duration is an authored assumption and includes unmodeled descent/recovery rather than an entry dynamics solver. Flight success requires recovery completed, support intact and the authored data objective achieved. A supported early-return window reduces science opportunity and is recorded; it is not automatically a crew loss.

Lifecycle `ON_ORBIT → DEORBIT → RECOVERY → COMPLETE`; fuel and selected return window come from the two-body deorbit calculation to an authored entry perigee. The recovery-inclusive clock includes any explicitly modeled burn interval. Never end successfully merely at 72 h before recovery. Reference hardware/data target must be calibrated transparently against these requirements at both levels without lowering tests to fit a failed pilot.

Inspiration4 provides a real four-crew/three-day LEO precedent [C5], not the spacecraft specification. Use an authored Near Space Network/TDRS-like relay service, low-rate telemetry separated from high-rate data allocation; no DSN requirement or automatic eclipse-radio blackout.

### 11.2 Source-backed reduced metabolism

Use one coherent baseline from **BVAD Rev. 2, Table 3-31, printed pp. 58–59** [C1]. Its 82 kg reference astronaut and exercise schedule are a disclosed conservative longer-mission baseline for the short game scenario, not an individual medical model.

| Per crew member per day | Baseline |
|---|---:|
| Oxygen consumption | 0.895 kg |
| Carbon dioxide production | 1.085 kg |
| Potable water | 3.217 kg |
| Dry food solids | 0.800 kg |
| Metabolic heat | 12.426 MJ, about 144 W |

Food water, packaging, residuals and waste must be accounted separately; dry food is not packaged launch mass. Metabolic heat enters thermal accounting, **not electrical consumption**. No water/oxygen recovery hardware is assumed; ISS water-recovery percentages cannot be applied to a capsule without the corresponding system.

### 11.3 Atmosphere, scrubbers and finite stores

Track O₂/N₂ tanks and cabin gases, potable water, food, waste, active/spare CO₂ cartridge capacities, fan power/mode, leak rates, free gas volume, cabin temperature and rolling one-hour ppCO₂. Using hours for rate notation does not permit one-hour simulation steps:

```text
dO_tank/dh    = -uO - tankLeakO             dN_tank/dh = -uN - tankLeakN
dO_cabin/dh   = uO - N*rO/24 - lambda*O_cabin
dN_cabin/dh   = uN - lambda*N_cabin
dCO2/dh       = N*rC/24 - scrubRate - lambda*CO2
dK_scrub/dh   = -scrubRate
dWater/dh     = -N*rWater/24               dFood/dh = -N*rFood/24
partialPressure_i = (mass_i / molarMass_i) * R * T / freeGasVolume
```

Gas regulation cannot draw an empty tank. Scrubbing is limited by existing CO₂, available capacity and powered airflow; it stops on loss of the fan. Consumed stores transfer to modeled retained inventories; spent cartridges and reaction water remain onboard (reaction water is not potable). Close the mass balance rather than decrementing ship mass merely when a person eats or breathes. Only exhaust, venting, leaks and jettison reduce total mass.

LiOH theoretical stoichiometric ceiling is approximately 0.919 kg CO₂/kg LiOH; operational and packaged ratings differ [C3, C4]. Use a disclosed effective game coefficient of 0.65 kg CO₂/kg sorbent, with explicit hardware housing, volume, electrical draw and capacity; no NASA-certified canister claim.

### 11.4 Crew support, not health percentage

`daysRemaining = min(O2usable/(N*rO), water/(N*rWater), food/(N*rFood), usableScrubber/(N*rCO2))`.

Show the limiting resource, working-hardware assumption, atmosphere status and trend. Store runway cannot mask a failed fan. Four crew producing 1.085 kg CO₂/day each in 8 m³ at 297 K without scrubbing raise ppCO₂ approximately 9.5 mmHg/hour: threshold and exhaustion boundaries require deterministic small steps/analytic splitting, not skipping hours at high warp.

NASA-STD-3001 [C2] provides a normoxic inspired-O₂ target of 145–155 mmHg and nominal one-hour ppCO₂ ≤3 mmHg. Inspired O₂ is `(totalPressure_mmHg - 47) * oxygenFraction`, not dry cabin ppO₂. The standard's nominal limit is **not a universal death threshold**.

Game warnings: runway below remaining flight plus reserve; then below remaining mission; ppCO₂ trend/one-hour nominal exceedance; abnormal inspired O₂, pressure or essential power. Warnings pause high warp. Conservative authored game stops (essential store exhausted, inspired O₂ below 127 mmHg one-hour average, or ppCO₂ ≥6 mmHg) end the attempt as **crew-support requirements lost**, never a diagnosis of injury/death. Explicitly define each instantaneous versus rolling-average comparison in the model parameters.

At 4 crew × 3 days × 1.25 reserve, illustrative stores are 13.425 kg O₂, 48.255 kg potable water, 12 kg dry food and 16.275 kg removal capacity. This is a calculation, not a ready loadout: add recovery consumption, tankage, food packaging, gas filling, leaks and mitigation reserves. Test actual recovery-inclusive sufficiency.

### 11.5 Actions and faults

Spacecraft owns life support; Launch & Orbit owns return. Add cartridge saturation/changeover, O₂ supply-line isolation, Expert cabin leak/repressurization, essential-power prioritization and relay outage decisions. All faults have authored rates/timings and observable evidence, not hidden arbitrary death probabilities.

**Onboard procedures** (cartridge change, tank isolation, fan mode, load shedding, repressurization) work during radio loss; apply with authored crew-time cost and actor receipts, not an uplink wait. **Ground commands** retain link transport and delivery delays; a deorbit upload may be sent ahead, then executed onboard at its window. Confirmed End mission is an immediate session action. Separate all three transports in the contract.

Both levels retain metabolism and basic atmospheric accounting. No detailed human physiology, local CO₂ pocket prediction, radiation-health model, fire certification, lunar free-return or atmospheric reentry physics.

## 12. Contracts and migration

| Area | Planned contract |
|---|---|
| Attempt identity | Required scenario, `LevelId`, rules v3, seed and assistance; remove independently selectable profile/difficulty |
| Journey | `NEED_GOALS`, `CONCEPT`, `REQUIREMENTS`, `DESIGN`, `BUILD_VERIFY`, `IMPLEMENT`, `REVIEW`; guarded transitions and artifact dependencies replace free stage setters |
| Mission artifacts | Objective/product, four-segment ConOps, requirements and verification methods, candidates/trades, equipment list, risks, maturity evidence, frozen baseline |
| Collaboration | Revision-bound proposals/concerns, responsible/affected roles, sidebar decisions, facilitator and roster snapshots |
| Orbit | Explicit body/frame/UTC epoch and full supported Keplerian state; altitude conveniences convert to the same state |
| Interchange | Versioned trajectory object with source/units/frame/time/segments; separate script-subset parse result and initial-condition export |
| Core values | Live retained mass; phase-aware clock; applicable/not-applicable crew group; deployment state; cost/service reserve where modeled |
| Crewed scenario | `CREW_PATHFINDER`, crew count 4, separate capsule/ride/parts, relay mode, deorbit/recovery lifecycle, support failure and onboard procedures |
| Audit | Attempt-scoped decisions/events/receipts/handoffs/actions with owner, acting role/player and revision. Role ownership is not acting-player attribution |
| History | Bounded, documented whole-attempt samples of resources and positions plus event boundaries; retain salient decisions/first failure and disclose any decimation. Current live event/receipt buffers cannot reconstruct a complete debrief |
| Learning delivery | Level-owned AUTOMATIC/ON_DEMAND cadence independent of display; UI-only concept/context introduction state, reusing science content and snapshot/quote bindings |

A practice rewind restores coherent physical/random/queue state, truncates later branch history and appends an explicit assisted-rewind audit marker. Ended-by-team attempts do not save a best score; successful early return is evaluated against actual product/support requirements, not silently equated to abort failure. Repeat uses the same seed by default for comparison. Redesign retains hardware/plan as a draft and clears flight state/evidence dependencies; changing mission always revalidates compatibility.

Known implementation touchpoints from the source audits:

- `packages/core/src/{contracts,catalog,models,design,physics,score}.ts`, `review/rules.ts`, `sim/{state,step,commands,selectors,failure}.ts` and scenario-specific test recipes.
- `apps/web/src/App.tsx`, `store/index.ts`, Home and chooser, header stage tabs/status, panels/settings, science reveal links and the scene registry. Replace old free navigation and profile/difficulty paths without compatibility shims.
- New wizard/journey/artifact/maturity surfaces and role consoles reuse current windows, Modal/inert authority, camera and single-renderer lifecycle.
- `packages/data/src/{science,scienceBindings}.ts`, source registry and EN/pt-BR resources cover new concepts, resources, errors, interop metadata, failures and explanations.
- Update current architecture/layout/rendering/model/mission/science docs, README and index only when implementation lands; the prior verification record stays historical.

## 13. Implementation sequence

These are dependency phases, not separately shippable scope reductions. Crewed mission, all selected GMAT paths and textures remain in this delivery.

| Phase | Work and integration contract |
|---|---|
| A — Shared contracts | Level/rules identity, orbit/time/frame conventions, artifacts/evidence dependencies, seven stages, audit/roster and command transports. Freeze interfaces before parallel edits |
| B — Parallel core work | Stage validators/maturity, CubeSat fit/deployment/disposal, crew life support/return, clock/mass/service telemetry; add honest loadouts and conservation/boundary cases |
| C — Parallel UI/data work | Wizard/Home, NASA-process tasks, generated evidence and bounded MDL rounds, resources/settings, operational milestones and review; contextual teaching and concept coverage in both languages |
| D — Orbit/interchange and scenes | Full-orbit integration before exact script import; OEM/report viewer and export; NASA textures and reference transforms; scene fixes and phase/status overlays; capsule/crew visual identity |
| E — Cutover | Migrate every caller/score/cache/reveal path, remove obsolete chooser/free tabs/profile × difficulty UI; preserve canceled-attempt rollback and single Canvas |
| F — Proof and documentation | Narrow checks during integration; one integrated typecheck/test/build, fixture-based GMAT comparison, real-control browser journeys, recorded mobile/keyboard and scene measurements |

First prove the complete First Light lane with genuine controls, including definition → choice → quote → observed consequence → review. Then apply the same journey/teaching contracts to all 4 missions × 2 canonical levels, with actual Expert recovery/failure and crew-support failure. GMAT tools are verified through separate optional entrypoints, never built-in mission prerequisites. Source/key existence is not learning or interaction proof; tests do not establish human comprehension. Do not blindly regenerate traces to hide a regression.

## 14. Acceptance and verification

| ID | Observable acceptance |
|---|---|
| A01 | Home communicates purpose/process/trade-offs; wizard retains answers, has native accessible controls, error summary, Review Change links and no WebGL creation |
| A02 | Submit creates exactly the configured attempt at Need & goals; canceled/failed preparation preserves prior attempt and draft; neither entry nor navigation launches |
| A03 | All six stages plus Review have guarded completion, revision invalidation and prelaunch iteration. After launch all artifacts remain read-only; Review is terminal-only |
| A04 | Requirement traceability connects objective/product/measurement/design and verification; debrief shows Pass/Fail/Not evaluated, not fabricated scientific quality |
| A05 | Maturity 3/4 depends on actual evidence and essential blockers; arbitrary 80% or checked boxes cannot override constraints; no trivia-only quiz |
| A06 | Solo and 2–4-player shared-screen rounds record proposals, resource impacts, conflicts and selected trades. Stale proposals cannot overwrite a newer baseline |
| A07 | Baseline freeze and all-Go only enable Launch; explicit launch reruns readiness/revision/actor checks and cannot duplicate a run |
| A08 | Role-owned commands and alerts, handoff pauses, explicit scene focus and decision acknowledgement work; roster edits preserve actor history and physical state |
| A09 | All seven resource badges remain visible across every mission stage and collapsed panel state at 320 CSS px; forecast/live, W/Wh, delivery/storage and crew N/A remain explicit |
| A10 | CubeSat fit follows provider contract; deployment changes actual output; disposal estimate states assumptions/uncertainty or unknown; no simulated legal/environmental certification |
| A11 | No development months, licensing countdowns or rework-time simulation introduced; Build & verify invalidates affected evidence logically |
| A12 | OEM/report fixtures preserve object/frame/time/units/segments; irregular samples play by time; gaps/burns are not bridged; unsupported input is refused without altering an attempt |
| A13 | Orbit script import/export preserves supported initial Cartesian state within declared tolerances, including nonzero RAAN/AOP/phase/epoch; full GMAT dynamics and unsupported scripts are never claimed compatible |
| A14 | Imported viewer has no invented game resources/scores, uses the same Canvas, and restores the paused attempt/camera on exit. Oversized/unsafe input never executes or fetches anything |
| A15 | Sun/eclipses and station/texture transforms agree with core fixtures; planet sizes, apsis labels, contact/transmission and phase legends are scientifically qualified |
| A16 | Local Earth/Mars textures have asset-specific credits/projection and correct orientation; no live-imagery claim; decode/GPU/render measurements and JS gzip budget recorded separately |
| A17 | Crew metabolism, scrubbing, fan power, finite gas supply and retained-inventory mass balance hold; high-warp threshold times are partition-independent |
| A18 | Crew warning/failure language is nonmedical; onboard procedures work through relay loss; success requires completed recovery and observation/support requirements; recovery stores are paid and sufficient |
| A19 | Settings alter no physical snapshot except explicit authorized commands; mission/level replacement confirms loss; pace or dialog close never implicitly resumes |
| A20 | Review links decisions/actors to resource/position history and modeled outcomes; assisted rewinds and history retention are disclosed; Redesign and repeat create clean attempts |
| A21 | Rules v3 score separation, deterministic tests, bilingual content/source bindings, typecheck and build pass; all 8 mission/level variants exercised with genuine controls and public APIs |
| A22 | Desktop/mobile-emulated keyboard, pointer, touch, focus and reflow proof; actual-device/assistive-technology gaps named. No novice usability or performance universality claims from automated tests |
| A23 | Aspiring in Guided and Detailed sees teaching before its first battery choice without activating Explain; Expert in both depths opens the same lesson only on request. Units/warnings/receipts remain visible |
| A24 | Every applicable coverage group is exercised at a real UI encounter, proving definition/relevance, current consequence and limitation are delivered or available as specified; topic/key existence alone fails |
| A25 | Accepted/refused/stale quotes and delayed commands get truthful feedback; queued is not executed. Actual quote/command/observation/review chains produce only supported causal explanations |
| A26 | Revisits, language/depth changes and rewind do not spam full lessons or claim mastery; Replay remains accessible and new fault contexts are taught. Lessons never issue commands, approve gates, mark assisted or alter physics |
| A27 | Inline teaching steals no focus/audio/camera and leaves main controls reachable on mobile. Deep Explain preserves physical/random/queue state and other pause reasons, restores focus and never resumes |
| A28 | First-attempt walkthrough has one practical task/primary action per stage, with no GMAT, legal declarations, duplicate spacecraft construction, solo role impersonation or mandatory sidebar ceremony |
| A29 | Implement exposes applicable launch/commission/operate-deliver/closeout milestones and inspect → act → advance-to-boundary → inspect cycles; no fake cruise or recovery completion |

Implementation and observed automated/browser evidence are recorded in [VERIFICATION.md](./VERIFICATION.md#mission-studio-delivery--rules-v3), including which full flights used browser controls versus public core APIs. The acceptance table defines behavior, not a claim of exhaustive device or lesson-coverage validation. NASA/Space Apps eligibility, registration and organizer interpretation are separate from software acceptance.

## 15. References and evidence

### NASA process, MDL and maturity

- **N1:** [Design and Develop Science Missions, Julie Levri, 2025](../resources/250323-design-and-develop-science-mission.pdf), especially pp. 8, 10, 13–23. Supplied source and process/ConOps/requirements/verification reference.
- **N2:** [Space Mission Concept Development Using Concept Maturity Levels, Wessen et al., 2013](../resources/space%20mission%20design%20maturity%20level.pdf), pp. 2–3 (levels/iteration), 4–10 (matrix), 11–14 (checklists/caveats). Current MDL links the [JPL CML dataset](https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299).
- **N3:** [GSFC Mission Design Lab](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/): study options, CML 1–4, disciplines and products.
- **N4:** [Goddard IDC concurrent design process, 2016](https://ntrs.nasa.gov/api/citations/20160010586/downloads/20160010586.pdf), pp. 1–4: preparation, ConOps, tag-ups, iterations and presentation.
- **N5:** [CATTENS/IDC, 2024](https://ntrs.nasa.gov/api/citations/20240012380/downloads/IDC%20CATTENS%20IEEE%202024%20final%20submission.pdf), pp. 3–7: shared MEL, budgets and timeline.

### UI/accessibility

- **U1:** [WAI multi-page forms](https://www.w3.org/WAI/tutorials/forms/multi-page/).
- **U2:** [GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/), [check answers](https://design-system.service.gov.uk/patterns/check-answers/), [error summary](https://design-system.service.gov.uk/components/error-summary/).
- **U3:** [USWDS step indicator](https://designsystem.digital.gov/components/step-indicator/), [W3C aria-current](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA26).
- **U4:** [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), [redundant entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html), [APG modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

### CubeSats

- **Q1:** [NASA CubeSat 101, 2017](https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf), PDF pp. 5–6, 12–17, 46, 62–70, 90. Supplied summary `local://paste-1.md` is an interpretation, not the authority for current requirements.
- **Q2:** [CubeSat Design Specification Rev. 14.1](https://www.nasa.gov/wp-content/uploads/2018/01/cubesatdesignspecificationrev14_12022-02-09.pdf), pp. 8–12; [Cal Poly listing](https://www.cubesat.org/cubesatinfo).
- **Q3:** [FCC space stations](https://www.fcc.gov/space/space-stations), [Part 5 checklist](https://www.fcc.gov/space/part-5-experimental-and-special-temporary-authority-sta-space-station-application-checklist), [FCC 22-74 disposal order](https://docs.fcc.gov/public/attachments/FCC-22-74A1.pdf).
- **Q4:** [NOAA remote-sensing regulations](https://www.nesdis.noaa.gov/s3/2021-08/15%20CFR%20Part%20960%20Regs%202020.pdf), [mission-assurance applicability](https://www.nesdis.noaa.gov/s3/2022-04/Guidance_%20Mission%20Assurance%20%20040122.pdf).
- **Q5:** NASA SmallSat state of the art: [power](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/), [communications](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/), [GNC](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/). Supports subsystem concepts, not fictional part ratings.

### GMAT and visualization

- **G1:** GMAT manuals (mirrored): [orbit state](https://documentation.help/GMAT/SpacecraftOrbitState.html), [epoch](https://documentation.help/GMAT/SpacecraftEpoch.html), [ReportFile](https://documentation.help/GMAT/ReportFile.html), [EphemerisFile](https://documentation.help/GMAT/EphemerisFile.html). Check installed release behavior at implementation.
- **G2:** [CCSDS Orbit Data Messages](https://ccsds.org/Pubs/502x0b3e1.pdf). Supporting reference, not a claim to implement every ODM version/feature.
- **G3:** Existing [GMAT validation](./research/gmat-validation.md) and [reference script](../scripts/validate-orbits.script). These validate selected quantities, not general upload compatibility or real mission trajectories.
- **V1:** [NASA mission-viz](https://github.com/nasa/mission-viz), supplied [Repomix archive](../resources/nasa-mission-viz.md). Directory inventory, GMAT converter and playback were inspected selectively; binaries listed in the archive are not embedded PDF/image evidence.
- **V2:** [NASA Blue Marble Next Generation](https://svs.gsfc.nasa.gov/12564/): source/credit and historical-composite context, not automatically a downloadable UV texture selection.
- **V3:** [NASA Earth/Mars true-color comparison](https://svs.gsfc.nasa.gov/2878/): relative-size reference. Exact Mars map asset/projection must be selected and documented, not extracted from a globe screenshot.
- **V4:** [NASA image/media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/): attribution, third-party restrictions and no endorsement; no blanket license inferred from hosting.

### Life support

- **C1:** [NASA BVAD Rev. 2, 2022](https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf), Tables 3-23, 3-31, 4-47. Do not silently mix its rates with [Jones 2016](https://ntrs.nasa.gov/api/citations/20160005782/downloads/20160005782.pdf) Table 1 or the 2015 edition.
- **C2:** [NASA-STD-3001 Vol. 2](https://www.nasa.gov/wp-content/uploads/2025/05/nasa-std-3001-vol-2.pdf), Rev. F as inspected by the research: atmosphere requirements/limitations. Record revision and verify relevant table values when parameterizing.
- **C3:** [NASA ECLS presentation](https://ntrs.nasa.gov/api/citations/20180002051/downloads/20180002051.pdf), PDF p. 46 (LiOH chemistry).
- **C4:** [James & Macatangay, 2009](https://ntrs.nasa.gov/api/citations/20090029352/downloads/20090029352.pdf), p. 4, operational LiOH; Jones 2016 uses different packaged accounting.
- **C5:** [NASA Inspiration4 datasets](https://www.nasa.gov/osdr-latest-news-i4-mission-datasets/), [Orion crew module](https://www.nasa.gov/reference/crew-module/), [Near Space Network support](https://www.nasa.gov/humans-in-space/nasa-enables-commercial-crew-private-astronaut-missions/), [TDRS coverage](https://www.nasa.gov/missions/tdrs/tdrs-an-era-of-continuous-space-communications/). These are context, not a combined vehicle specification or guaranteed communications service.

Research findings distinguish external source facts, implementation contracts and authored game assumptions. Component documentation describes the implemented system; verification records observed checks and limitations separately.
