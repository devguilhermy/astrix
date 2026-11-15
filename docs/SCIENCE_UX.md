# Scientific design without a science prerequisite

ASTRIX serves learners, educators and technically experienced players. Simplify the choices and explanations, not their consequences. The product is a fun space-exploration game, not a mission-design studio or flight-qualified tool. [Verification](./VERIFICATION.md) records functional evidence; automation is not a novice-comprehension or enjoyment study.

## One loop for both levels

Both Aspiring and Expert use **discovery → quick design → preview → commit → receipt → debrief/retry**. Expert adds tighter competing constraints and applicable fault mechanisms, not a required form for every subsystem. No formula quiz, acronym test, mandatory documentation or reward for opening Help is required.

Preparation keeps the coupled choices together: destination-compatible goal, ambition, kit and approach. The live brief displays the actual success target, budget allowance, deadline and dominant constraints. A suggested configuration remains editable. A change must not silently alter the player's goal, buy hardware, raise a budget or repair a failure.

Readiness has distinct meanings: compatible; within limits; checking; no viable plan found; Ready; Stretched. Ready requires a successful reference-policy witness through the actual engine. It is not an arbitrary score, probability, NASA endorsement or guaranteed victory. Unsupported or unfinished checks remain explicit.

## Meaningful equipment tradeoffs

Packages resolve to paid catalogue parts. Every included part contributes actual cost, mass, volume and applicable operating load. Higher ambition cannot receive an undisclosed larger allowance.

| Choice | Legible tradeoff | Scientific detail |
|---|---|---|
| Payload | More observations versus electricity, storage and mass | Rate, useful product, illumination and pointing prerequisites |
| Battery | More shadow reserve versus weight and price | Stored Wh, capacity and actual energy use |
| Solar hardware | More generation versus weight and price | Watts, illumination and panel orientation |
| Radio | More returned data versus power and directional requirements | Rate, contact, antenna alignment and link mode |
| Route/operations | Faster output versus reserve and time slack | Actual fuel, elapsed time, geometric opportunities and hazards |
| Crew support | Observation time versus finite support and return margin | Oxygen, water, food, scrubber, powered fan and recovery consumption |

Exact values come from core budgets and telemetry, never a second beginner calculator. Source-derived constants, calculated forecasts, historical measurements and authored hardware ratings have different provenance.

## Decisions and receipts

At a decision the player must be able to identify the goal, relevant choices, expected consequence and next stopping point. Offer at most four primary plans with one commit action. Selecting a plan changes only the preview. Commit labels name the action; the UI does not ask the player to operate a speed control or routine sequence of pointing/instrument/contact commands.

Plans are declared operational automation. Observation, transmit, recharge, maneuver, recovery and return resolve actual commands, slew, geometry, inventories and deadlines. An Observe plan is not a magic data grant; recharge is not an instantaneous refill; a lunar encounter is not capture. An unsupported repair must not appear as a universal recovery button.

The receipt communicates **choice → measured change → consequence → next experiment**. Show elapsed mission time and objective progress independently of resource indicators. Use up to three relevant normal resource indicators; imminent thermal, crew or other failure conditions must still surface. W and Wh, stored and returned data, and planning reserve versus flown reserve remain distinct.

Internal resolution errors preserve the committed boundary and explain that resolution failed. They must not masquerade as physical mission losses. Thinking, reading, settings, animation and browser backgrounding do not advance the game. LAN readers may see newer host commits after opening an explanation, so frozen contextual values must be labelled as snapshots.

## Scientific help

The topic/source registry remains authoritative: [science.ts](../packages/data/src/science.ts), [scienceBindings.ts](../packages/data/src/scienceBindings.ts), core catalogue sources and [sources-extra.json](../packages/data/sources-extra.json). Scientific help should provide:

1. Plain-language meaning.
2. Why it matters to this goal or decision.
3. A diagram with a text equivalent where useful.
4. Costs, benefits and what a changed decision could achieve.
5. Optional units, model assumptions and limitations.
6. Attributed reference links and historical-data time basis.

English and Brazilian Portuguese are maintained together. Key parity does not establish translation quality or scientific accuracy. Unknown values remain unknown; explanatory examples cannot be presented as measurements. Topic navigation, opening details and source links do not acquire science or mark a requirement complete. A reveal action is offered only when it targets a real reachable control, never an obsolete studio panel.

Technical topics retain their boundaries:

| Topic | Explanation | Limit |
|---|---|---|
| Thermal control | Equipment temperature and operating/survival constraints | One lumped bus, not a spatial thermal solver |
| Power aging | Changing array/battery performance | Accelerated authored exercise, not calibrated mission-life prediction |
| Pointing recovery | Slew, pointing quality and supported recovery | Not torque dynamics or momentum unloading |
| Link resilience | Geometry, allocation and rate/power tradeoff | Reduced quality envelope, not calibrated dB/SNR or live DSN |
| Onboard recovery | Supported computer procedures and their time/energy | Authored fault timing, not dose-calibrated reliability |
| Capture reserve | Available fuel versus nominal/realized burn demand | Not navigation covariance or a guarantee of capture |

The corresponding NASA chapters explain phenomena, not the calibration of fictional coefficients. Exact numeric assumptions belong to [Technical models](./TECHNICAL_MODELS.md).

## Discovery and replay

A journal entry is a simulated achievement with its objective evidence and qualified run identity. NASA/USGS images and mission comparisons are archival context, not observations acquired by the player's spacecraft. There is no spendable science currency, agency economy or forced grind to unlock the Moon.

Debrief distinguishes success, failure, incomplete objectives and assistance. Definition/configuration identity, rules/model/policy versions, level and seed qualify same-condition comparisons. A new design is a new experiment, not a rewrite of an old score. Aspiring checkpoint retries are assisted; Expert restarts are separate attempts. Local saves preserve committed boundaries without promising durable recovery of a stopped LAN host.

## Scientific honesty guardrails

- Watts are a rate; watt-hours are energy. Do not collapse them into a readiness number.
- Storage, observation hours and delivered product are distinct. Show each objective's actual target and units.
- Safe mode changes operation; it is not shielding. Historical ISS dose does not establish spacecraft loss probabilities or a radiation map of arbitrary orbits. DONKI co-occurrence does not attribute every peak to a storm.
- Surface measurements remain surface facts. Authored orbital hazards are separate assumptions.
- Reaching altitude, entering a bound orbit, escaping and encountering the Moon are different achievements. Entering the lunar sphere of influence does not establish capture.
- Earth/Moon coast is patched two-body; the Moon follows a reduced circular ephemeris. Ascent uses finite thrust and exponential drag. Mars cruise is analytical. No J2, continuous three-body dynamics, wind/lift or flight qualification is implied.
- Capture depends on actual dry mass, engine, tank and fuel; a nominal upper bound is not guaranteed realized success.
- Camera and playback do not issue spacecraft commands or create evidence. Scene-only controls cannot gate play.
- Initial-state GMAT interchange and sampled-trajectory inspection remain optional. Uploaded text is never executed, and imported samples cannot invent inventories or scored results.
- Do not label a check green before the engine establishes it, round away a strict constraint, or promise a repair through reload.

## Accessibility and evaluation

Use native labelled controls, visible focus, keyboard alternatives, bounded scrolling panels, textual result/error states and reduced-motion support. The immersive 3D scene remains visible behind or beside the panels, including on compact screens; it is not an opt-in illustration below the workflow. Optional dialogs retain focus/inert behavior and return to a connected opener. Teach the first decisions inline rather than through a mandatory full-screen tour chain.

Functional verification covers design constraints, stale checks, preview purity, commit/retry/save behavior, both languages, compact layouts and multiplayer. Human sessions must separately measure assistance, comprehension, enjoyment and replay intent. The proposed first-choice/first-outcome/mission-duration targets in the [revision plan](./plans/TURN_BASED_EXPLORATION_REVISION.md) remain hypotheses until measured with participants.
