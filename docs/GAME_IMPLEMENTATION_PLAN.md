# ASTRIX Mission Studio: game implementation plan

Entry for NASA Space Apps 2026, challenge **Space Mission Design Game**. This document preserves the original build specification and execution history. The [canonical system documentation](./INDEX.md#canonical-system-documentation) describes current implementation; code and those component pages take precedence over outdated planned behavior below. Original inputs:

- [design brief](./challenges/space-mission-design-brief.md) (decisions in §9)
- [challenge text](./challenges/space-mission-design-game.md)
- [resource map](./challenges/space-mission-design-resources-map.md)
- [verified facts](./research/verified-facts.md)
- [Void Protocol reuse plan](./research/void-protocol-reuse.md)
- [scientific accessibility specification](./SCIENCE_UX.md): Guided choices, optional Technical details and Explain buttons for every scientific context; this supersedes earlier raw-telemetry defaults.

Void Protocol (VP) reference material was read from `~/dev/void_protocol/docs/{engine,fullstack,meta,gameplay}` and located with `graphify query` against `~/dev/void_protocol/graphify-out/graph.json`; see §13.

Status: **implemented, 2026-11-14**. CoreEngine, DataContent and WebUI deliveries are integrated. Typecheck, 102 tests and production builds passed; all three missions completed browser playthroughs, including a genuine Mars capture failure and a successful two-player redesign. See [VERIFICATION.md](./VERIFICATION.md) for observed results and limits, [challenge acceptance](./CHALLENGE_ACCEPTANCE.md), and the independent [GMAT reference run](./research/gmat-validation.md). Final packaging checks are recorded in the verification report rather than inferred from this design spec.

---

## 0. Summary

A browser game for ages 13–18 with **no science prerequisite**. Players design through understandable trade-offs, launch, operate the spacecraft and read an explained mission report. Accurate simplified physics still runs underneath, but equations, abbreviations and manual orbit configuration are **optional Technical details**, not prerequisites. Default Guided play uses named choices, consequence previews and explicit **Explain / Entenda** buttons beside every science context. Both presentations share the same limits, seed, commands, scoring and role rules. Every number remains sourced or labelled as a game assumption.

| Decision | Value |
|---|---|
| Audience / tone | Ages 13–18 · serious mission-control look · no emoji in the product |
| Presentation depth | Guided by default; reversible Technical details, independent of difficulty; see [SCIENCE_UX.md](./SCIENCE_UX.md) |
| Destinations (weekend) | Low Earth orbit · Mars orbit (Hohmann transfer and capture) |
| Spacecraft classes (weekend) | CubeSat 3U (< 4.00 kg, CubeSat 101) · SmallSat (< 180 kg, NASA) |
| Team play | Hot-seat: 1–4 players, roles own parts and controls, sign-off gate |
| Physics | Two-body Kepler propagation, cylinder eclipse, elevation contact, patched-conic Hohmann, Tsiolkovsky |
| Operate | Real time with warp 1×–10,000×; live pointing, downlink, instrument, safe mode; Mars command delay |
| Data rule | Every number has `Provenance`: a sourced reference or a labelled assumption; a test enforces it |
| Stack | Bun workspaces · Vite · React 19 · Zustand · TypeScript · Tailwind v4 · three + @react-three/fiber · lucide-react · i18next |
| Languages | `en`, `pt-BR` |
| Hosting | Static, offline-capable, no account, no API keys, no analytics |
| VP reuse | **Approved 2026-11-14**: the files in [void-protocol-reuse.md](./research/void-protocol-reuse.md) §3–§7 are copied or adapted from commit `218625d` with attribution; everything else is new |

---

## 1. Goals, non-goals, success criteria

### Goals
1. A player who finishes a mission can **explain why a choice had a cost**: mass ↔ power ↔ data ↔ budget ↔ orbit ↔ propellant.
2. The judging points from the challenge page are covered: a functional UI, mission configuration, resource management, collaboration for up to 4, simulation, and evaluation with post-mission analysis.
3. The data is credible: a sources panel lists every sourced value, and game assumptions are visibly labelled.
4. A first mission takes 10–15 minutes and can be replayed with different outcomes.
5. A newcomer can complete FIRST_LIGHT without opening Technical details, knowing an acronym or solving an equation. Help is optional, free and available at the point of every scientific decision.

### Non-goals (weekend)
- Online multiplayer, accounts, leaderboards on a server.
- The Moon, outer planets, the flagship class, 6U CubeSats (no verified mass limit yet).
- J2 precession, sun-synchronous orbits, atmospheric drag and orbit decay, thermal model, aerobraking.
- Launch windows (the game assumes the window is met).
- Real-dollar costs (cost is in **budget units**, a labelled abstraction).

### Done means
- [x] All three complete scenarios are implemented with shared `en`/`pt-BR` and solo/hot-seat logic. Automated playability covers every mission/difficulty; observed browser matrix is recorded in VERIFICATION.md rather than claiming every manual language/player combination.
- [x] Physics tests reproduce §4.4 and compare against the independent GMAT run.
- [x] Catalogue/scenario provenance validation passes; game assumptions remain explicitly identified.
- [x] The retained golden simulation fixture matches normal subsequent runs.
- [x] Locale keys, interpolation and science-topic coverage pass.
- [x] Blocked commands/configuration have explained, focusable refusal controls.
- [x] Scientific contexts bind localized Explain content; representative mission, battery, radiation, command-delay and report paths were exercised in-browser.
- [x] Explain preserves simulation/decision/queue state, pauses without penalty, never auto-resumes and restores focus.
- [x] Guided presets and manual configurations share the same physics/quotes; presentation switching preserved the observed paused Mars state.
- [x] Measured JS budget passed. A LOW-tier active Mars sample measured approximately 43.77 fps; this is an observed sample, not a universal hardware guarantee.

---

## 2. Hard constraints

| # | Constraint | Enforced by |
|---|---|---|
| C1 | **Every gameplay number carries `Provenance`** (`{ src: SourceId }` or `{ assumption: true, note }`) | `catalog.provenance.test.ts` walks every catalogue and scenario value |
| C2 | **Core is pure**: `packages/core` has no DOM, React, `Date.now()` or `Math.random()` | Lint rule `no-restricted-globals` in core; seeded RNG lives in state |
| C3 | **One persistent WebGL context**: a full-viewport `<Canvas>` stays mounted and visibly exposed behind floating UI in every phase, including Goal and Report | Browser phase walkthrough; exactly one Canvas in AppCanvas.tsx |
| C4 | **Explainable refusals**: every blocked action returns a typed reason and the UI shows it (`aria-disabled` + text) | `Refusal` type; UI rule in §7.6 |
| C5 | **Determinism**: the same scenario, seed, design and command log give the same result | Golden trace test |
| C6 | **No live API calls at runtime**; data snapshots are committed with URL and retrieval time and never presented as live | `packages/data` only; there is no `fetch` in `apps/web` (grep check) |
| C7 | **Lucide-only icons**, named imports from one module; no `import *`, no other icon set, no emoji in UI strings | `apps/web/src/ui/icons.ts` is the only `lucide-react` importer |
| C8 | **i18n-first**: no user-visible literal strings in components; core emits keys and values only | Parity test plus a grep for JSX text literals |
| C9 | **Bundle budget**: initial JS ≤ 600 KB gzip | `vite build` report checked in Wave 2 |
| C10 | **Low-end friendly**: no `backdrop-filter`, no infinite CSS animation; DPR clamped to [1, 1.5]; `frameloop="demand"` outside Operate; honours `prefers-reduced-motion` | UI review checklist |
| C11 | **VP reuse only as listed** in the [reuse report](./research/void-protocol-reuse.md) (§3–§7), following its §8 procedure: pinned commit, attribution header, `CREDITS.md` row; no VP assets | `rg "Void Protocol" apps packages` matches the `CREDITS.md` VP rows |
| C12 | **Static deploy**: `bun run build` → `apps/web/dist`, which works from any static host | Wave 2 smoke test |
| C13 | **Listed NASA resource engagement**: Global Awards need meaningful use of a NASA data source listed in *this* challenge's Resources ([#1947](https://github.com/nasa/spaceapps/discussions/1947)). CubeSat 101 limits are hard rules in the game, and the orbit and transfer numbers are **validated against GMAT**; both are shown in the sources panel and the submission | Wave 2 GMAT validation report `docs/research/gmat-validation.md` |
| C14 | **AI disclosure**: the README and the submission describe how AI tools were used; no AI-generated images, video or audio ship without a visible disclosure | Wave 2 checklist |
| C15 | **Licensing and credits**: one OSI licence for the repo; `CREDITS.md` lists every resource (code, data, text, images, libraries, tools, own earlier work) per [#1924](https://github.com/nasa/spaceapps/discussions/1924) | Wave 2 checklist |
| C16 | **No science prerequisite**: Guided is default; named choices, editable starter spacecraft, consequence previews and readable status groups; Technical is optional and uses the identical model | FIRST_LIGHT browser walkthrough without Technical; equivalent-preset tests |
| C17 | **Explain every scientific context**: explicit Lucide `book-open` + Explain/Entenda, including advanced values, units, charts, events and refusal reasons | Authored context/topic registry coverage and localized content checks; browser button walkthrough |
| C18 | **Learning pauses have no side effects**: Explain pauses sim, preserves queued commands and decisions, restores focus, never auto-resumes, never affects score | Interaction checks from running, paused and decision states; see SCIENCE_UX.md |

---

## 3. Game design

### 3.1 Core loop

```
 GOAL ─► CONCEPT ─► DESIGN ─► LAUNCH & ORBIT ─► OPERATE ─► REPORT
  │        │          │            │               │          │
 card    class +    parts vs    ride + orbit   real time +  score, first failure,
 pick    target     budgets,    (Mars: capture warp,         charts, real missions,
         body       review,     orbit)         decisions     "fly again"
                    sign-off
                                                                 │
          ◄───────────────────── redesign (keeps design) ◄──────┘
```

Phases map to the NASA design flow (Need & goals → concept → requirements → design → build & verify → implement). The default bar says Goal → Choose spacecraft → Build → Choose path → Fly → Results. CML badges and professional terminology are in the optional design notes with Explain (`concept-maturity`); nobody needs to learn CML to proceed.

### 3.2 Scenarios (weekend: 3)

| Id | Title (en) | Body | Class | Duration | Objective | Real data used |
|---|---|---|---|---|---|---|
| `FIRST_LIGHT` | First Light | Earth LEO | CubeSat 3U | 14 days | Downlink ≥ 1.5 GB of images | Earth constants; CubeSat 101 limits |
| `STORM_WATCH` | Storm Watch | Earth LEO | CubeSat 3U | 21 days from 2024-05-01 | Log ≥ 24 h of radiation data during the storm **and** keep the spacecraft healthy | RadLab ISS DosTel1 hourly dose 10–11 May 2024 drives the environment; DONKI storm record (GST, fetched in Wave 1) |
| `RED_RELAY` | Red Relay | Mars orbit | SmallSat | Cruise + 60 days at Mars | Downlink ≥ 5 GB of mapping data | Mars and Sun constants; Hohmann transfer; DONKI 2024-05-20 CME; NASA RAD quote; USGS mission facets for the reveal |

`FIRST_LIGHT` is the tutorial (guided tour enabled by default). The scenario numbers above (1.5 GB, 24 h, 5 GB, durations) are **game assumptions** with `Provenance.assumption`.

### 3.3 Phases in detail

**Goal.** Pick a scenario described by a familiar objective: “Take pictures of Earth and send them home”, “Measure a solar storm and protect your spacecraft”, or “Send maps home from Mars”. Show objective progress as a percentage of the actual data/time target, without inventing photo-count conversions. The body, difficulty, game budget and source chips have plain labels and scientific Explain controls.

**Concept.** A basic, editable spacecraft is supplied for the selected class, with computer, basic pointing control, power equipment and a radio. Each included part counts against mass, volume and game budget; it is not a free or guaranteed-winning loadout. The player chooses the instrument and upgrades. The default panel shows “Fits on the rocket” with separate weight/room bars; exact limits and CubeSat/SmallSat terminology open via Explain or Technical details:
- CubeSat 3U: 3 U of volume, strictly under 4.00 kg (CubeSat 101).
- SmallSat: strictly under 180 kg (the cited NASA classification), 8 game bays (assumption).

Starter-fit validation and the included-parts list are mandatory. Design notes explain that choosing a class sets the box to design inside; the CML label is optional.

**Design.** Guide one comparison at a time: What will you measure? → How will you power it? → How will you send it home? All groups stay revisitable. Show up to three alternatives per comparison with a gain, cost and before→after preview; expand for all compatible parts. Display Fits on the rocket (weight + room separately), Energy for the trip (generation + eclipse battery separately), Mission progress/data return, and Game budget. Mars adds contextual “Fuel for slowing down”. Every preview uses the core quote and forecast; missing inputs say “Not estimated yet”. All scientific concepts have Explain. Full metrics remain in Technical. Hot-seat sign-offs still apply; unfamiliar terms are not permission gates.

**Launch & Orbit.**
- LEO Guided: named cards for ride-compatible paths, each with a computed observing/contact/power trade-off and Explain. Technical: altitude 350–800 km and inclination 0–98° sliders for rides that allow custom paths, plus period, shadow fraction and contact minutes. No preset is called universally better or sun-synchronous without modelling that behaviour.
- Mars Guided: Close circular path / Balanced oval path / Wide oval path; preview the actual design's fuel and observing trade-off. “Plan fuel for this path” computes the amount for the current engine and dry mass, shows mass/cost/tank checks and requires confirmation. Technical retains all four capture choices (400 km circular; 400 × {5,000 | 10,000 | 33,000} km), exact delta-v, fuel and period. Returning to Guided preserves a custom path rather than changing it.

**Operate.** Real-time flight with time warp. See §3.6.

**Report.** Lead with mission progress and a causal story: Your choice → What happened → What to try next. Initially show battery percentage and results-sent-home charts. Exact scoring weights, dose plots and detailed telemetry are expandable. Each scientific result, recommendation and chart has Explain with the relevant recorded facts. Keep the first-failure report, sources and RED_RELAY's real-mission examples. Buttons: Redesign (keeps design) and New mission.

### 3.4 Teaching moments (each tied to a mechanic)

| Mechanic | What the player discovers |
|---|---|
| Adding a camera fills the storage faster than UHF can downlink | Data rate ↔ radio choice ↔ pointing ↔ power |
| Higher orbit → less eclipse, longer passes | Orbit choice changes power and comms |
| At Mars, solar power is 43 % of Earth's (586.2 vs 1361.0 W/m²) | Distance from the Sun matters |
| Low circular Mars capture needs more slowing-down fuel than a wide oval orbit; feasibility is computed for the actual dry mass and engine | Fuel adds mass too; compare engine and arrival path rather than claiming SmallSats universally cannot do it |
| Commands at Mars arrive minutes late | Light-time delay → plan ahead, autonomy |
| Real ISS dose readings vary greatly; the scenario replays a measured profile with a separate assumed electronics-risk model | Data is evidence, not proof that each peak came from a storm; safe mode does not shield radiation |
| Every change clears teammates' sign-offs | Systems engineering is negotiation |

### 3.5 Roles and hot-seat

| Role | Icon | Design ownership | Operate controls |
|---|---|---|---|
| Science lead | `microscope` | instruments, storage | instrument on/off, observing target |
| Spacecraft engineer | `wrench` | structure, power (solar, battery), ADCS, computer, propulsion | pointing mode, safe mode |
| Launch & orbit | `rocket` | launch ride, orbit or capture orbit | time warp; capture-burn confirm (Mars) |
| Ground & comms | `satellite-dish` | radios, ground-station choice | downlink on/off |

Rules:
- **Solo**: one player owns every role and there are no locks.
- **Hot-seat** (2–4 players): the role switcher in the top bar selects the active role. Editing a part or control the active role doesn't own is refused with `ROLE_LOCKED` ("Switch to Spacecraft engineer to change power parts").
- **Sign-off gate**: Launch is enabled only when every role has signed off. A role can't sign off while a severity-3 cue in its domain is active (`SIGNOFF_BLOCKED`). **Any design change clears the sign-off of every role whose budget the change affects** (power, mass, data, cost, Δv). This is the negotiation mechanic.
- **Handoff overlay**: between phases in hot-seat, a full-screen "Pass to: \<role\>" card. It is skipped in solo.
- Team score (§3.9) counts sign-offs, cues resolved before launch and decisions made by the owning role.

### 3.6 Operate: real-time controls

Default labels are Charge / Observe / Send home / Protect spacecraft, each with Explain and an effect preview; exact controls below live in Technical details. Charge/Observe request pointing only, not silent instrument or radio changes. Send home explicitly previews EARTH pointing plus DOWNLINK and respects both role permissions and Mars delay. Show pending versus received versus actively sending. Protect spacecraft is safe mode, not shielding or guaranteed survival. See SCIENCE_UX.md §6.

```
 TIME     [pause] [1x] [10x] [100x] [1000x] [10000x]     T+ 3d 04:12:30   (play/pause/fast-forward)
 POINTING ( SUN )( TARGET )( EARTH )                     Spacecraft
 SCIENCE  [instrument A: ON] [instrument B: OFF]         Science
 COMMS    [downlink: ON]   next pass in 00:41:10         Ground & comms
 SAFE     [ENTER SAFE MODE]                              Spacecraft
 MARS     command delay 13.3 min · queued: 2             (RED_RELAY only)
```

- **Pointing mode** sets the solar factor and what can be done: SUN maximises power, TARGET enables observing instruments, EARTH enables directional radios. SAFE forces SUN, all instruments off and the radio receive-only.
- **Auto-pause**: the clock pauses on a scheduled event, the first contact pass, storage ≥ 90 %, battery ≤ 20 % and capture burn. A decision card offers 2–3 actions. Each action is just a normal control change, so there is no hidden logic.
- **Mars command latency**: in `RED_RELAY`, every command is queued with `applyAt = now + oneWayLightTime(t)`. The queue is visible. The burn confirm is pre-arranged (applies at arrival).
- **Cruise**: `RED_RELAY` jumps over the 258.9-day transfer analytically, showing a cruise summary card with the transfer arc in 3D, then pauses at capture.
- **Learning pause**: Explain is available beside every control, event and scientific readout. Opening the contextual drawer pauses at the current sim timestamp; close/Escape/Show me never resume automatically. Help changes no spacecraft state or pending decision and carries no score penalty.

### 3.7 Events

Events are scheduled by scenario plus a seeded RNG. Every event has a provenance.

| Event | Scenarios | Trigger | Effect | Provenance |
|---|---|---|---|---|
| `SOLAR_STORM` | STORM_WATCH | Scripted at the RadLab sample start (2024-05-10T00:00Z sim time) | The dose-rate profile follows the RadLab hourly means for 48 h; upset hazard (§4.6) | RadLab ISS DosTel1 sample; DONKI GST record |
| `SOLAR_STORM` | RED_RELAY | At Mars day 10 (assumption) | Elevated dose for 24 h; narrative cites the 2024-05-20 CME and NASA's RAD quote | DONKI CME `2024-05-20T05:36:00-CME-001`; NASA article |
| `BATTERY_AGING` | all | Day ≥ 60 % of duration, seeded ±10 % | Battery capacity −10 % | assumption |
| `GROUND_OUTAGE` | LEO | Seeded, 1 per mission, 6 h | No contact | assumption |
| `STORAGE_NEAR_FULL` | all | Storage ≥ 90 % | Auto-pause card | derived |
| `BROWNOUT` | all | Battery reaches 0 | Forced safe mode; starts the failure clock | derived |
| `CAPTURE_BURN` | RED_RELAY | Arrival | Applies Δv if propellant suffices, else failure | derived (physics) |

### 3.8 Design-review coach (cue engine)

This is a rules engine over a snapshot, re-implemented from VP's pattern (§13). Cue fields: `id`, `category` (`alert` | `tip` | `teach`), `severity` 1–3, `role`, `cooldownSec`, `clearAfterSec` (hysteresis), `glossaryId`, `target` (a UI element id for "Show me"), `fix` (an optional action id).

Evaluation:
1. Skip rules not applicable to the phase or scenario.
2. Call `detect(snapshot)` → `null` or `{ params }`.
3. Keep a cue active while its condition holds. Clear it only after the condition has been false for `clearAfterSec`.
4. A newly active cue respects `cooldownSec` since it was last raised.
5. Sort by severity, then age.
6. Show all alerts, but at most 2 tips or teach cues.

| Rule id | Phase | Role | Sev | Condition |
|---|---|---|---|---|
| `POWER_NEGATIVE` | Design/Orbit | Spacecraft | 3 | orbit-average generation < average load |
| `POWER_MARGIN_LOW` | Design/Orbit | Spacecraft | 2 | margin < 10 % |
| `BATTERY_ECLIPSE_SHORT` | Design/Orbit | Spacecraft | 3 | eclipse energy > usable battery |
| `MASS_MARGIN_LOW` | Design | Spacecraft | 2 | mass margin < 5 % |
| `DATA_BACKLOG` | Design/Orbit | Comms | 2 | data generated per day > downlink per day |
| `NO_RADIO` | Design | Comms | 3 | no radio part |
| `POINTING_NEEDS_ADCS` | Design | Spacecraft | 3 | a TARGET-only instrument or directional radio with no ADCS |
| `DV_SHORT` | Orbit (Mars) | Launch & orbit | 3 | available Δv < required × 1.10 |
| `BUDGET_MARGIN_LOW` | Design | all | 1 | budget left < 5 % |
| `OBJECTIVE_UNREACHABLE` | Orbit | Science | 2 | the projected downlink over the mission < objective |
| `STORM_EXPOSED` | Operate | Spacecraft | 3 | storm active and an instrument powered |
| `PASS_SOON_DOWNLINK_OFF` | Operate | Comms | 1 (tip) | contact within 10 min sim time and downlink off |
| `STORAGE_FILLING` | Operate | Science | 2 | storage ≥ 80 % |

Severity-3 design cues block sign-off for their role (§3.5).

### 3.9 Scoring

```
score = round(100 × Σ_k w_k × c_k)        Σ w_k = 1 per scenario
stars: ≥ 20 → 1, ≥ 40 → 2, ≥ 60 → 3, ≥ 80 → 4, ≥ 95 → 5        (assumption)
```

| Component c_k ∈ [0, 1] | Definition |
|---|---|
| `objective` | progress toward the objective metric / target, capped at 1 |
| `efficiency` | budget left / budget (0 if over) |
| `health` | fraction of mission time with battery SOC ≥ 20 % and no failure |
| `margins` | 1 − (time with any severity ≥ 2 operate cue active) / duration |
| `team` | (sign-offs achieved without blocked attempts + severity-3 design cues resolved before launch) / (roles + those cues); solo = design cues resolved / total |

Default weights: objective 0.45, efficiency 0.15, health 0.2, margins 0.1, team 0.1. They are per scenario and all assumptions.

### 3.10 Difficulty (VP pattern: difficulty owns failure behaviour)

| Profile | Budget | Event rate | Failure behaviour |
|---|---|---|---|
| Cadet | × 1.3 | × 0.5 | The first failure becomes "Anomaly recovered": the spacecraft is restored to safe mode, −15 score points, the cause is still reported |
| Engineer (default) | × 1.0 | × 1.0 | A failure ends the mission → report |
| Flight Director | × 0.85 | × 1.5 | Same as Engineer, with a tighter cue threshold (margins ×1.5) |

All multipliers are labelled assumptions.

Presentation depth (Guided / Technical) is not a difficulty profile: it changes neither these rules nor scoring. Reading explanations and time spent at a learning pause are never scored.

### 3.11 Failure capture (VP pattern: death details)

When the first fatal condition occurs, the sim writes an **immutable** `FailureSnapshot`: `cause`, `t`, and the state values at that moment. A pure `describeFailure(snapshot)` returns `{ causeKey, facts: [{ key, values }], advice: [key] }`; the report localises the keys. Later failures don't overwrite it.

| Cause | Fatal condition |
|---|---|
| `BATTERY_DEPLETED` | SOC at 0 for ≥ 12 h sim time (assumption) |
| `INSTRUMENT_LOST_RADIATION` | the last instrument the objective depends on was lost to an upset |
| `CAPTURE_FAILED` | not enough propellant for the capture Δv at arrival |
| `OBJECTIVE_MISSED` | duration ended below the objective (not a crash; the report still explains it) |

---

## 4. Physics and simulation model

### 4.1 Constants (sourced)

| Constant | Value | Source id |
|---|---|---|
| μ Earth | 398,600 km³/s² (0.39860 × 10⁶) | `nssdc-earth` |
| Earth equatorial radius | 6,378.137 km | `nssdc-earth` |
| Earth sidereal rotation | 23.9345 h | `nssdc-mars` (Earth comparison column) |
| Earth semimajor axis | 149.598 × 10⁶ km | `nssdc-earth` |
| Earth sidereal orbit | 365.256 d | `nssdc-earth` |
| Solar irradiance at Earth | 1,361.0 W/m² | `nssdc-earth` |
| μ Mars | 42,828 km³/s² (0.042828 × 10⁶) | `nssdc-mars` |
| Mars equatorial radius | 3,396.2 km | `nssdc-mars` |
| Mars sidereal rotation | 24.6229 h | `nssdc-mars` |
| Mars semimajor axis | 227.956 × 10⁶ km | `nssdc-mars` |
| Mars sidereal orbit | 686.980 d | `nssdc-mars` |
| Solar irradiance at Mars | 586.2 W/m² | `nssdc-mars` |
| μ Sun | 132,712 × 10⁶ km³/s² | `nssdc-sun` |
| Speed of light c | 299,792.458 km/s (exact) | `si-c` |
| Standard gravity g₀ | 9.80665 m/s² (exact) | `si-gn` |

`nssdc-*` = <https://nssdc.gsfc.nasa.gov/planetary/factsheet/{earth,mars,sun}fact.html>, read 2026-11-14. The `si-*` links are confirmed by the data agent (§11).

### 4.2 Simplifications (shown in the glossary as "model assumptions")

- Two-body motion only; no J2, drag or third-body perturbation.
- Earth and Mars move on **circular, coplanar** heliocentric orbits. Light delay therefore ranges 4.4–21.0 min in-game, versus about 4–24 min in reality (eccentric orbits). The glossary says so.
- Sun direction from the planet's heliocentric angle; no axial tilt in the weekend build. This affects eclipse geometry, and the limitation is stated.
- Hohmann transfer always at the optimal window; patched conics for departure and capture.
- Eclipse uses a cylindrical shadow (no penumbra).
- Spacecraft attitude is a mode, not a simulated rigid body.

### 4.3 Formulas (`packages/core/src/physics`)

```
Kepler elements: a, e, i, Ω (RAAN), ω, M0 at epoch t0      (circular: e = 0, ω = 0)
mean motion        n = sqrt(μ / a³)
period             T = 2π / n
mean anomaly       M = M0 + n (t − t0)
eccentric anomaly  solve M = E − e sin E   (Newton, ≤ 10 iterations, |ΔE| < 1e-12)
true anomaly       ν = 2 atan2( sqrt(1+e) sin(E/2), sqrt(1−e) cos(E/2) )
radius             r = a (1 − e cos E)
perifocal          [r cos ν, r sin ν, 0] → inertial via Rz(Ω) · Rx(i) · Rz(ω)
circular speed     v = sqrt(μ / r)

planet rotation    θ(t) = θ0 + 2π t / T_sidereal_rotation
ground station     ECEF from (lat, lon, R) → inertial by Rz(θ(t))
elevation          ε = asin( (r_sat − r_gs) · r̂_gs / |r_sat − r_gs| );  contact ⇔ ε ≥ ε_min

heliocentric       planet angle λ_p(t) = λ_p0 + 2π t / T_orbit;  r_p = a_p [cos λ, sin λ, 0]
sun direction      ŝ = −r̂_p   (from planet to Sun)
eclipse            in shadow ⇔ (r_sat · ŝ < 0) ∧ |r_sat − (r_sat · ŝ) ŝ| < R_body
irradiance scale   S(d) = S_body (body constant, §4.1)   [solar factor relative to 1 AU = S_body / 1361.0]

Hohmann (Sun)      a_t = (r1 + r2)/2
                   v∞1 = sqrt(μS/r1) (sqrt(2 r2/(r1+r2)) − 1)
                   v∞2 = sqrt(μS/r2) (1 − sqrt(2 r1/(r1+r2)))
                   TOF = π sqrt(a_t³ / μS)
                   Mars lead angle at departure φ = π − n_Mars · TOF
departure Δv       Δv_dep = sqrt(v∞1² + 2μE/r0) − sqrt(μE/r0)
capture Δv         Δv_cap = sqrt(v∞2² + 2μM/rp) − sqrt(μM (2/rp − 1/a_capture))
rocket equation    Δv_avail = Isp g0 ln(m_wet / m_dry);  m_prop_needed = m_dry (e^{Δv/(Isp g0)} − 1)
light time         τ = |r_Earth(t) − r_Mars(t)| / c
link scaling       rate(d) = rate_ref × (d_ref / d)²   (inverse-square; capped at rate_max)
```

### 4.4 Reference values (become unit tests; computed from §4.1 on 2026-11-14)

| Quantity | Expected | Tolerance |
|---|---|---|
| Period, circular 420 km Earth | 92.97 min | ±0.05 |
| Speed, circular 420 km | 7.657 km/s | ±0.002 |
| Eclipse fraction, 420 km, β = 0 | 0.3875 | ±0.002 (analytic `acos(sqrt(h²+2Rh)/(R+h))/π` and sim sampling agree within 0.005) |
| Period / eclipse at 400, 500, 600 km | 92.56 / 94.62 / 96.69 min · 0.3901 / 0.3779 / 0.3670 | ±0.05 min · ±0.002 |
| Hohmann Earth→Mars v∞1, v∞2 | 2.945, 2.649 km/s | ±0.002 |
| Transfer time | 258.9 d | ±0.1 |
| Mars lead angle | 44.34° | ±0.05 |
| Departure Δv from 400 km LEO | 3.569 km/s | ±0.003 |
| Capture Δv to 400 km circular Mars | 2.080 km/s | ±0.003 |
| Capture Δv to 400 × 5,000 / 10,000 / 33,000 km | 1.497 / 1.246 / 0.919 km/s | ±0.003 |
| Mars capture orbit period 400 × 33,000 km | 24.03 h | ±0.05 |
| Propellant / dry, 2.08 km/s at Isp 220 s / 320 s | 1.623 / 0.940 | ±0.003 |
| Light time min / max (circular model) | 4.36 / 20.99 min | ±0.02 |
| Light time at Hohmann arrival | 13.26 min | ±0.05 |
| Solar factor Mars / Earth | 0.4307 | ±0.0005 |

The ISS orbit is not a source here, but these values are a sanity cross-check.

### 4.5 Simulation step (`stepSim`)

This is a fixed sub-step; `dtSec` (default 10 s sim) is split if larger. Order inside one sub-step:

```
1  apply due commands       queue items with applyAt ≤ t (Mars latency; LEO applyAt = t)
2  advance time             t += dt
3  propagate                spacecraft inertial position; planet rotation; heliocentric positions
4  environment              ŝ, sunlit, dose rate (scenario profile), contact (elevation / Mars occultation + DSN window)
5  power                    gen = Σ solar W × solarFactor(body) × pointingFactor(mode) × sunlit
                            load = Σ powered parts (radio tx only while downlinking)
                            SOC = clamp(SOC + (gen − load) · dt / 3600, 0, capacity)
                            SOC = 0 → BROWNOUT (forced SAFE) and failure clock
6  comms                    if downlink ∧ contact ∧ radio usable in mode: sent = min(stored, rate(d) · dt)
7  science                  for each powered instrument meeting its conditions: stored += rate · dt;
                            overflow → dataLost, STORAGE event (once per fill)
8  hazards                  if dose rate > upsetThreshold ∧ instrument powered:
                            p = 1 − exp(−k · (dose − threshold) · dt/3600) from seeded RNG → instrument lost
9  objectives               update progress metrics
10 failure                  first fatal condition → FailureSnapshot (immutable)
11 history                  every sampleEverySec: push sample into a fixed-size ring (cap 4,096)
12 events                   fire scheduled events; emit SimEvent[] (auto-pause flags)
```

Performance: at 10,000× and 60 fps a frame advances 167 s, i.e. 17 sub-steps. Cap at 400 sub-steps per frame and drop the warp if exceeded (the warp change emits an event).

### 4.6 Radiation environment

- **LEO background**: the RadLab DosTel1 median, 4.59 µGy/h (`radlab-iss-2024-05-10`).
- **STORM_WATCH profile**: the RadLab DosTel1 **hourly means** for 2024-05-10T00 → 2024-05-12T00, replayed as a step function in sim time. The data agent produces the 48-value array with provenance. The maximum single reading, 527.29 µGy/h, is shown as a fact.
- **RED_RELAY storm**: the NASA article gives a surface figure (8,100 µGy total at Curiosity) and says orbit is "significantly more". No orbital rate is sourced, so the Mars storm dose rate is an **assumption** labelled as such, with the quote shown as context.
- **Upset model** (k, threshold): assumptions. Explain “radiation can disrupt electronics; we approximate the risk for gameplay”. Safe mode reduces risk only under this assumed operating model; it does not block radiation. Replaying an ISS sample at another orbit is an explicit approximation; a correlated DONKI event does not establish the cause of every peak.

---

## 5. Data, provenance and catalogue

### 5.1 Provenance types

```ts
export type SourceId = string;                      // key into SOURCES
export type Provenance =
  | { readonly kind: 'source'; readonly src: SourceId; readonly note?: string }
  | { readonly kind: 'assumption'; readonly note: string };
export interface Q<T = number> { readonly v: T; readonly p: Provenance }   // a qualified value

export interface SourceRef {
  readonly id: SourceId;
  readonly title: string;          // in English; the UI shows it verbatim, with a localised label
  readonly url: string;
  readonly publisher: string;      // "NASA NSSDCA", "NASA CSLI", …
  readonly retrieved: string;      // ISO date
  readonly listedByChallenge: boolean;
}
```

### 5.2 Source registry (weekend)

| id | Title | URL | Challenge-listed |
|---|---|---|---|
| `nssdc-earth` / `nssdc-mars` / `nssdc-sun` | NASA Planetary Fact Sheets | nssdc.gsfc.nasa.gov/planetary/factsheet/… | no (extra) |
| `cubesat101` | CubeSat 101 | www3.nasa.gov/…/nasa_csli_cubesat_101_508.pdf | **yes** |
| `nasa-smallsat` | What are SmallSats and CubeSats? | nasa.gov/smallsat-institute/what-are-smallsats-and-cubesats/ | no |
| `design-develop` | Design and Develop Science Missions | nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf | **yes** |
| `cml` | Concept Maturity Levels | dataverse.jpl.nasa.gov/…hdl:2014/44299 | **yes** |
| `mdl` | Goddard Mission Design Lab | etd.gsfc.nasa.gov/…/mission-design-lab/ | **yes** |
| `gmat` | GMAT | software.nasa.gov/software/GSC-19468-1 | **yes** (cross-check only) |
| `mission-viz` | NASA Mission Viz | nasa.github.io/mission-viz/ | **yes** (visual reference) |
| `webb-game` | A Learning Game About Telescopes | science.nasa.gov/mission/webb/game-build-it-yourself/ | **yes** (precedent) |
| `csa-games` | CSA Digital Games and Activities | asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp | **yes** (educator link) |
| `radlab-iss-2024-05-10` | RadLab ISS DosTel1 sample | visualization.osdr.nasa.gov/radlab/api/… | no (extra) |
| `donki-cme-2024-05-20` | DONKI CME 2024-05-20T05:36:00-CME-001 | ccmc.gsfc.nasa.gov/DONKI/view/CME/31034/-1 | no (extra) |
| `donki-gst-2024-05` | DONKI geomagnetic storm, May 2024 | fetched in Wave 1 | no (extra) |
| `nasa-mars-storm-2024` | NASA Watches Mars Light Up During Epic Solar Storm | nasa.gov/solar-system/planets/mars/nasa-watches-mars-light-up-during-epic-solar-storm/ | no (extra) |
| `usgs-catalog` | USGS Astrogeology catalogue export (`nasa.json`) | astrogeology.usgs.gov | no (extra) |
| `si-c`, `si-gn` | SI defining constants | confirmed in Wave 1 | no |

### 5.3 Catalogue (starter values, all `assumption` unless marked)

Units: mass kg · volume U (CubeSat) or bays (SmallSat) · power W · data rate kbps · storage MB · cost budget units (BU). Every row carries a note in code, e.g. "typical order of magnitude for a 3U CubeSat camera; replace with a sourced spec".

**CubeSat 3U bus** (`CUBESAT_3U`): volume 3 U, max mass strictly under 4.00 kg (`cubesat101`), structure 0.35 kg / 0 U / 10 BU. Implementation budgets are qualified game assumptions: FIRST_LIGHT **120 BU**, STORM_WATCH **100 BU**, before difficulty multipliers. FIRST_LIGHT was increased from 100 so an instrument-equipped design can fit Flight Director's 0.85 multiplier.

| Part id | Role | U | kg | W (on) | Data | Cost BU | Notes |
|---|---|---|---|---|---|---|---|
| `EPS_BATT_20` | Spacecraft | 0.2 | 0.15 | 0.2 | — | 6 | 20 Wh battery + EPS; usable depth 40 % |
| `BATT_40` | Spacecraft | 0.3 | 0.30 | 0 | — | 6 | +40 Wh |
| `SOLAR_BODY` | Spacecraft | 0 | 0.15 | gen 7 @1 AU, sun-pointed | — | 5 | body-mounted |
| `SOLAR_WINGS` | Spacecraft | 0 | 0.30 | gen 20 @1 AU, sun-pointed | — | 14 | deployable |
| `OBC` | Spacecraft | 0.2 | 0.10 | 0.5 | storage 2,000 MB | 5 | required |
| `STORAGE_32G` | Science | 0.1 | 0.05 | 0.2 | +32,000 MB | 4 | |
| `ADCS_MAG` | Spacecraft | 0.3 | 0.20 | 0.6 | — | 6 | coarse: TARGET science × 0.5 |
| `ADCS_WHEELS` | Spacecraft | 0.5 | 0.60 | 2.0 | — | 18 | fine pointing |
| `RADIO_UHF` | Comms | 0.1 | 0.10 | 1 rx / 4 tx | 9.6 kbps, omni | 4 | any mode except SAFE tx |
| `RADIO_SBAND` | Comms | 0.2 | 0.20 | 1 rx / 8 tx | 1,000 kbps, EARTH mode | 15 | directional |
| `CAM_EO` | Science | 0.5 | 0.40 | 3.0 | 2,000 kbps, TARGET + lit ground | 20 | Earth imager |
| `RAD_MON` | Science | 0.2 | 0.20 | 0.5 | 1 kbps, any mode except SAFE | 8 | storm objective metric |
| `MAG` | Science | 0.1 | 0.10 | 0.3 | 0.5 kbps | 4 | |

**SmallSat bus** (`SMALLSAT`): 8 bays (assumption), max mass strictly under 180 kg (`nasa-smallsat`), structure 30 kg / 0 bays / 60 BU. RED_RELAY budget is **900 BU** (qualified game assumption, increased from 600 so the fully costed starter and science payload can fit all difficulty profiles).

| Part id | Role | Bays | kg | W | Data / Isp | Cost BU | Notes |
|---|---|---|---|---|---|---|---|
| `SS_BATT_300` | Spacecraft | 1 | 3 | 0.5 | — | 15 | 300 Wh, usable 40 % |
| `SS_SOLAR_400` | Spacecraft | 0 | 8 | gen 400 @1 AU | — | 40 | → 172 W at Mars |
| `SS_SOLAR_800` | Spacecraft | 0 | 15 | gen 800 @1 AU | — | 75 | |
| `SS_OBC` | Spacecraft | 1 | 2 | 8 | storage 64,000 MB | 20 | required |
| `SS_ADCS` | Spacecraft | 1 | 10 | 20 | — | 50 | fine pointing |
| `SS_PROP_MONO` | Spacecraft | 1 | dry 6 + tank ≤ 120 prop | 5 | Isp 220 s | 40 | propellant is a slider in kg |
| `SS_PROP_BI` | Spacecraft | 2 | dry 12 + tank ≤ 150 prop | 10 | Isp 320 s | 90 | |
| `SS_XBAND` | Comms | 1 | 5 | 10 rx / 60 tx | 2,000 kbps @ 1 AU (inverse-square, cap 6,000) | 70 | EARTH mode |
| `SS_UHF_RELAY` | Comms | 1 | 3 | 10 | 256 kbps orbiter↔surface (flavour) | 25 | stretch objective |
| `SS_MAPPER` | Science | 1 | 6 | 15 | 8,000 kbps, TARGET + lit ground | 80 | |
| `SS_RAD` | Science | 1 | 2 | 3 | 2 kbps | 15 | |

**Launch rides** (all costs are assumptions; constraints are partly sourced):

| Ride id | Accepts | Orbits | Cost BU | Notes |
|---|---|---|---|---|
| `RIDE_CUBESAT_DISPENSER` | CubeSat 3U | 3 fixed: 420 km / 51.6°, 500 km / 45°, 550 km / 97° | 20 | dispenser slot (`cubesat101` describes dispensers) |
| `RIDE_SMALL_LAUNCHER` | CubeSat 3U, SmallSat | any LEO 350–800 km, 0–98° | 60 (CubeSat), 250 (SmallSat) | dedicated |
| `RIDE_MARS_TRANSFER` | SmallSat | Mars transfer (Hohmann) | 300 | the ride supplies Δv_dep |

**Ground stations** (assumptions): `GS_MIDLAT` at 38° N, 75° W, ε_min 10°; Mars: deep-space antenna availability 8 h per Earth day (assumption), with Earth–Mars occultation from geometry.

### 5.4 Data snapshots (`packages/data`)

| File | Contents | Produced by |
|---|---|---|
| `radlab-dostel1-2024-05-10.json` | `{ source, retrieved, hourly: [{ hour, meanUGyH }] ×48, stats: { min, median, max, n } }` | `scripts/snapshot-data.ts` (RadLab API) |
| `donki-2024-05.json` | GST records 2024-05-08..2024-05-14 (`gstID`, `startTime`, `allKpIndex`), CME `2024-05-20T05:36:00-CME-001` (analyses, both speeds) | same (DONKI `ccmc.gsfc.nasa.gov/DONKI/WS/get/{GST,CME}`) |
| `usgs-missions.json` | From `../nasa.json`: mission facet counts + up to 3 sample products per Mars mission (title, link, thumb) | same (local file) |

The script writes `retrieved` timestamps and is run by hand. Its output is committed. The app never fetches.

---

## 6. Architecture

### 6.1 Repository layout

```
astrix/
├─ package.json                 bun workspaces: packages/*, apps/*
├─ tsconfig.base.json           strict, noUncheckedIndexedAccess, verbatimModuleSyntax
├─ scripts/snapshot-data.ts     data snapshots (§5.4)
├─ packages/
│  ├─ core/                     @astrix/core: pure TS, no DOM
│  │  └─ src/
│  │     ├─ contracts.ts        ← Wave 0: every exported type + function signature (§6.2)
│  │     ├─ index.ts            re-exports
│  │     ├─ rng.ts              mulberry32-style seeded PRNG, state in a number
│  │     ├─ physics/            constants.ts kepler.ts frames.ts eclipse.ts contact.ts transfer.ts rocket.ts lightTime.ts
│  │     ├─ catalog/            sources.ts parts.ts buses.ts rides.ts stations.ts scenarios.ts difficulty.ts starters.ts presets.ts
│  │     ├─ design/             budgets.ts quote.ts readiness.ts estimate.ts signoff.ts preview.ts fuelPlan.ts summary.ts
│  │     ├─ sim/                state.ts step.ts commands.ts events.ts environment.ts failure.ts history.ts objectives.ts
│  │     ├─ review/             engine.ts rules.ts snapshot.ts
│  │     ├─ score/              score.ts
│  │     └─ i18nKeys.ts         every key core can emit (for the parity test)
│  └─ data/                     @astrix/data: snapshots, loaders, science.ts / scienceBindings.ts (no React/core runtime imports)
└─ apps/
   └─ web/                      @astrix/web: Vite + React
      └─ src/
         ├─ main.tsx  App.tsx  index.css (Tailwind v4 @theme)
         ├─ i18n/               config.ts  locales/en.json  locales/pt-BR.json  parity.test.ts
         ├─ store/              session.ts design.ts sim.ts ui.ts  index.ts (one Zustand store, slices)
         ├─ loop/               useSimLoop.ts (rAF → stepSim, warp, ≤10 Hz React publish)
         ├─ three/              AppCanvas.tsx SpacecraftModel.tsx OrbitScene.tsx TransferScene.tsx Planet.tsx materials.ts
         ├─ ui/                 icons.ts primitives/ layout/ phases/ panels/ report/ glossary/ tour/ science/
         └─ a11y/               focus + live-region helpers
```

### 6.2 Core API (frozen in Wave 0, `contracts.ts`)

```ts
// ── ids
export type ScenarioId = 'FIRST_LIGHT' | 'STORM_WATCH' | 'RED_RELAY';
export type BodyId = 'EARTH' | 'MARS';
export type BusId = 'CUBESAT_3U' | 'SMALLSAT';
export type RoleId = 'SCIENCE' | 'SPACECRAFT' | 'LAUNCH_ORBIT' | 'GROUND_COMMS';
export type PointingMode = 'SUN' | 'TARGET' | 'EARTH' | 'SAFE';
export type DifficultyId = 'CADET' | 'ENGINEER' | 'FLIGHT_DIRECTOR';
export type Phase = 'GOAL' | 'CONCEPT' | 'DESIGN' | 'LAUNCH_ORBIT' | 'OPERATE' | 'REPORT';

// ── design
export interface DesignPart { readonly partId: string; readonly qty: number; readonly propellantKg?: number }
export interface OrbitChoice {
  readonly body: BodyId;
  readonly altitudeKm: number;            // periapsis altitude
  readonly apoapsisAltitudeKm: number;    // = altitudeKm for circular
  readonly inclinationDeg: number;
}
export interface Design {
  readonly scenarioId: ScenarioId; readonly busId: BusId; readonly parts: readonly DesignPart[];
  readonly rideId: string | null; readonly orbit: OrbitChoice | null; readonly stationId: string;
  readonly revision: number;
}
export interface Budgets {
  readonly massKg: { used: number; limit: number };
  readonly volume: { used: number; limit: number; unit: 'U' | 'BAY' };
  readonly cost: { used: number; limit: number };
  readonly power: { avgGenW: number; avgLoadW: number; marginPct: number; eclipseWh: number; usableBatteryWh: number } | null;
  readonly data: { genMBPerDay: number; downMBPerDay: number; storageMB: number } | null;
  readonly deltaV: { requiredKms: number; availableKms: number; propellantKg: number } | null;
  readonly orbit: { periodMin: number; eclipseFrac: number; contactMinPerDay: number } | null;
}
export type RefusalCode =
  | 'MASS_OVER_LIMIT' | 'NO_SLOT' | 'OVER_BUDGET' | 'ROLE_LOCKED' | 'DUPLICATE_UNIQUE' | 'RIDE_MISMATCH'
  | 'ORBIT_NOT_OFFERED' | 'REQUIRES_PART' | 'SIGNOFF_BLOCKED' | 'NOT_READY' | 'NO_CONTACT' | 'MODE_FORBIDS'
  | 'STORAGE_EMPTY' | 'PROPELLANT_OVER_TANK';
export interface Refusal { readonly ok: false; readonly code: RefusalCode; readonly values: Readonly<Record<string, number | string>> }
export type Quote<T> = { readonly ok: true; readonly value: T } | Refusal;

export function computeBudgets(design: Design): Budgets;
export function quoteAddPart(design: Design, partId: string, role: RoleId | 'ALL'): Quote<{ next: Design; delta: Partial<Budgets> }>;
export function quoteRemovePart(design: Design, partId: string, role: RoleId | 'ALL'): Quote<{ next: Design }>;
export function quoteSetRide(design: Design, rideId: string, role: RoleId | 'ALL'): Quote<{ next: Design }>;
export function quoteSetOrbit(design: Design, orbit: OrbitChoice, role: RoleId | 'ALL'): Quote<{ next: Design }>;
export function quoteSetPropellant(design: Design, kg: number, role: RoleId | 'ALL'): Quote<{ next: Design }>;
export function launchReadiness(design: Design, signoffs: Readonly<Record<RoleId, boolean>>): readonly Refusal[]; // empty = ready
export function rolesAffectedBy(prev: Design, next: Design): readonly RoleId[];   // sign-off invalidation

// ── sim
export type Command =
  | { kind: 'POINT'; mode: PointingMode } | { kind: 'INSTRUMENT'; partId: string; on: boolean }
  | { kind: 'DOWNLINK'; on: boolean } | { kind: 'SAFE'; on: boolean } | { kind: 'CAPTURE_CONFIRM' };
export interface SimState { /* opaque to UI except via selectors below; plain JSON, structured-clone safe */ readonly t: number; readonly [k: string]: unknown }
export type SimEventKind =
  | 'SOLAR_STORM_START' | 'SOLAR_STORM_END' | 'BATTERY_AGING' | 'GROUND_OUTAGE' | 'STORAGE_NEAR_FULL' | 'BROWNOUT'
  | 'CAPTURE_DONE' | 'FAILURE' | 'OBJECTIVE_MET' | 'PASS_START' | 'PASS_END' | 'MISSION_END' | 'WARP_LIMITED';
export interface SimEvent { readonly kind: SimEventKind; readonly t: number; readonly autoPause: boolean; readonly values: Readonly<Record<string, number | string>> }
export function createSim(design: Design, difficulty: DifficultyId, seed: number): SimState;
export function issueCommand(state: SimState, cmd: Command, role: RoleId | 'ALL'): Quote<SimState>;   // enqueues with latency
export function stepSim(state: SimState, dtSec: number): { state: SimState; events: readonly SimEvent[] };
export function skipCruise(state: SimState): { state: SimState; events: readonly SimEvent[] };     // RED_RELAY only
export interface Telemetry {
  t: number; socWh: number; capacityWh: number; genW: number; loadW: number; sunlit: boolean; inContact: boolean;
  storedMB: number; storageMB: number; downlinkedMB: number; doseUGyH: number; mode: PointingMode; safe: boolean;
  lightTimeSec: number | null; queued: number; objective: { metricKey: string; value: number; target: number };
  positionKm: [number, number, number]; sunDir: [number, number, number]; stationPosKm: [number, number, number] | null;
  instruments: readonly { partId: string; on: boolean; lost: boolean }[];
}
export function telemetry(state: SimState): Telemetry;
export function history(state: SimState): readonly HistorySample[];
export interface HistorySample { t: number; socPct: number; storedPct: number; downlinkedMB: number; doseUGyH: number; inContact: 0 | 1 }

// ── failure / score / review
export interface FailureReport { causeKey: string; t: number; facts: readonly { key: string; values: Record<string, number | string> }[]; advice: readonly string[] }
export function failureReport(state: SimState): FailureReport | null;
export interface ScoreBreakdown { total: number; stars: 0 | 1 | 2 | 3 | 4 | 5; components: readonly { key: string; weight: number; value: number }[] }
export function scoreMission(state: SimState, design: Design, team: TeamStats): ScoreBreakdown;
export interface TeamStats { roles: number; signoffs: number; blockedSignoffAttempts: number; sev3Raised: number; sev3ResolvedBeforeLaunch: number }
export interface ActiveCue { id: string; ruleId: string; category: 'alert' | 'tip' | 'teach'; severity: 1 | 2 | 3; role: RoleId | 'ALL';
  params: Record<string, number | string>; target?: string; glossaryId?: string; fix?: string; firstRaisedSec: number }
export interface CueEngineState { readonly lastRaised: Readonly<Record<string, number>>; readonly clearPending: Readonly<Record<string, number>>; readonly active: readonly ActiveCue[] }
export function evaluateCues(prev: CueEngineState, snap: ReviewSnapshot, nowSec: number): CueEngineState;
export function designSnapshot(design: Design): ReviewSnapshot;
export function operateSnapshot(state: SimState, design: Design): ReviewSnapshot;
export type ReviewSnapshot = { readonly phase: Phase; readonly [k: string]: unknown };

// ── catalog accessors (UI reads only through these)
export function listScenarios(): readonly ScenarioDef[];
export function listParts(busId: BusId): readonly PartDef[];
export function listRides(busId: BusId, body: BodyId): readonly RideDef[];
export function captureOrbits(): readonly OrbitChoice[];
export function listSources(): readonly SourceRef[];
export function listAssumptions(): readonly { key: string; note: string; value: number | string }[];
// ScenarioDef, PartDef, RideDef are defined in contracts.ts; every numeric field is Q<number>.

// ── Guided presentation adapters (same physics and validators)
export interface OrbitPreset { readonly id: string; readonly titleKey: string; readonly orbit: OrbitChoice }
export interface MissionSummary {
  readonly fit: { readonly mass: 'FITS' | 'TIGHT' | 'OVER'; readonly room: 'FITS' | 'TIGHT' | 'OVER' };
  readonly energy: { readonly generation: 'ENOUGH' | 'LOW' | 'SHORT' | 'UNKNOWN'; readonly eclipseBattery: 'ENOUGH' | 'LOW' | 'SHORT' | 'UNKNOWN' };
  readonly progress: { readonly metricKey: string; readonly value: number; readonly target: number };
  readonly budget: { readonly used: number; readonly limit: number };
  readonly sourceRevision: number; // prevent an old preview from describing a new design
}
export function createStarterDesign(scenario: ScenarioId, difficulty: DifficultyId): Design;
export function listOrbitPresets(design: Design): readonly OrbitPreset[];
export function previewOrbit(design: Design, presetId: string, role: RoleId | 'ALL'): Quote<{ next: Design; before: Budgets; after: Budgets }>;
export function planPropellant(design: Design, role: RoleId | 'ALL'): Quote<{ next: Design; requiredKg: number; after: Budgets }>;
export function summarizeMission(design: Design, budgets: Budgets, sim: SimState | null): MissionSummary;
// No prose, source filtering or second set of physics in these adapters.
```

Wave 0 ships `contracts.ts` plus `index.ts` stubs that `throw new Error('not implemented: <fn>')`, so the web agent can compile against the API immediately.

### 6.3 Web state (one Zustand store, slices)

| Slice | State | Actions (each = one `set`) |
|---|---|---|
| `session` | `phase`, `scenarioId`, `difficulty`, `seed`, `mode: 'solo' \| 'hotseat'`, `players: RoleId[][]`, `activeRole`, `signoffs`, `teamStats`, `tourStep` | `startScenario`, `setPhase` (guarded), `setActiveRole`, `signOff`, `resetMission` |
| `design` | `design`, `budgets`, `lastRefusal`, `cues: CueEngineState` | `addPart`, `removePart`, `setRide`, `setOrbit`, `setPropellant` (call `quote*` → on ok: replace the design, recompute budgets, clear affected sign-offs; on refusal: set `lastRefusal`) |
| `sim` | `sim: SimState`, `running`, `warp`, `telemetry` (published ≤ 10 Hz), `historyVersion`, `pendingDecision`, `events` log | `launch` (`createSim`), `command`, `setWarp`, `pause`, `resume`, `decide`, `skipCruise` |
| `ui` | `glossaryOpen`, `sourcesOpen`, `highlightTarget`, `locale`, `reducedMotion`, `presentation: 'GUIDED' \| 'TECHNICAL'`, `scienceContext: { topicId, contextId, snapshot, opener } \| null` | `showMe(target)`, `openGlossary(id)`, `setPresentation`, `openExplanation(topicId, contextId)`, `closeExplanation` |

Rules:
- **Atomic reset (VP pattern):** `resetMission()` restores every slice to its initial state in one `set`, stops the loop and clears refs. "New mission" and "Redesign" both go through it (Redesign keeps `design`).
- **Transient 3D reads:** the 3D scene reads the latest `SimState` through a ref updated by the loop (`useSimRef`), not through React state, so 60 fps never re-renders React panels.
- **Persistence:** `localStorage` holds settings (locale, reduced motion, tour completed) and best score per scenario × difficulty only. There is no mid-mission save in the weekend build.
- Guided projection is a read-only view of the same core results. Persist presentation with settings, not as a mission difficulty. Explain captures the context snapshot and pauses immediately; it leaves the queue and pending decision untouched. Closing restores focus and keeps the clock stopped until explicit Resume.

### 6.4 Loop (`useSimLoop`)

```
rAF(now):
  realDt = min(now − last, 100 ms)
  if running: simDt = realDt × warp;  { state, events } = stepSim(ref.state, simDt)
  ref.state = state
  for e in events: log; if e.autoPause → running = false; pendingDecision = deriveDecision(e)
  if now − lastPublish ≥ 100 ms or events.length: set({ telemetry: telemetry(state), historyVersion++ })
  invalidate() the R3F frame when frameloop = 'demand'
```

---

## 7. UI

### 7.1 Visual language (fresh code, informed by VP `UI_STYLE.md`)

| Token | Value | Use |
|---|---|---|
| Panel | Solid opaque dark navy surface, visible border, rounded corners; no alpha background or blur | Floating planning panels, science and decision surfaces |
| Inner tile | Solid opaque inset surface, subtle border | Budget and part rows |
| Label / body | Labels ≥12 px, body ≥14 px, readable sans-serif, `text-gray-300/400`; uppercase only for short headings | Do not inherit VP's tiny 9–11 px labels for teaching content |
| Number | JetBrains Mono, `text-white`, tabular | all values and units |
| Primary / telemetry | cyan-400 on cyan-900/50, border cyan-700/50 | selection, nav, telemetry |
| Secondary / build | indigo | design actions |
| Success | emerald | OK, sign-off, objective met |
| Warning | orange | margins low, auto-pause |
| Danger | red | refusal, failure |
| Caution | yellow | radiation, storm |
| Orbit | purple | orbit lines and orbit controls |
| Fonts | `@fontsource/rajdhani`, `@fontsource/jetbrains-mono` (OFL, self-hosted) | no network fonts |

Each colour pairs with an icon and text, never colour alone.

### 7.2 Layout

**Latest user decision:** space stays visible at all times; planning UI floats above it in **draggable opaque panels**, like Void Protocol. This replaces the former fixed-column layout. Guided/Technical changes panel contents, not the rendering architecture.

- The full-viewport canvas is mounted once below the HUD. A preview space scene appears before mission selection; Design, Orbit, Transfer and Report reuse the same context.
- Mission setup, configuration, controls, budgets, report and explanations appear as solid dark panels, not full-page opaque routes. Default placement leaves a useful central region of space exposed.
- Drag only from a labelled handle; use pointer capture and clamp to the usable viewport, including after resize. Clicking, typing or scrolling inside panels must not initiate dragging or rotate the camera.
- Bring the focused panel forward within a simple panel layer; decision/science surfaces remain above normal panels. Their pause/focus contracts still apply.
- Handles support keyboard movement; Settings includes **Reset layout**. Positions are session UI state and never alter mission state or score.
- On narrow screens use compact panels/tabs while retaining visible space behind them; never replace the 3D backdrop with a full-page form.
- Use Lucide icons and readable solid surfaces. No transparency or blur substitutes for the requested opacity.

### 7.3 Screens

**Goal**: three mission cards with plain objectives, body, difficulty and game-budget labels. Adjacent Explain covers the mission's science; source chips link to evidence. Solo/hot-seat assignment remains unchanged.

**Concept**: the editable starter, included-part costs, separate weight and room limits, and Explain for class/packaging/launch. CML labels and exact dimensional details are optional deeper content.

**Design**: comparison cards use descriptive names (“Fast radio”, not “RADIO_SBAND”), gain/cost/mission previews and Explain. Keep expand-all parts, role ownership and sign-offs. Technical reveals raw part values and full budgets; every scientific field or labelled field group there still has Explain.

**Launch & Orbit**: Guided path cards and the fuel planner from §3.3; each card and scientific prediction has Explain. Technical reveals elements, sliders, delta-v and propellant. Preserve the selected orbit when switching presentation. Readiness uses the same core checks.

**Operate**: plain action names and battery/progress/contact statuses first; advanced controls, dose plots and unit-heavy telemetry are optional. Every control group, scientific status and chart has Explain. Auto-pause cards show explicit trade-offs with Explain; reading cannot submit a decision.

**Report**: “Your choice → What happened → What to try next”, tied to actual logs, plus simple battery/results charts. Explanations, detailed scoring, further telemetry, data sources and real missions are available without prerequisite reading.

**Science drawer and glossary** (`book-open`): one shared contextual surface per SCIENCE_UX.md §4–§5. Plain meaning → mission-specific effect → small diagram/text equivalent → optional deeper science/equations/units → evidence and assumptions. Related-term buttons and Back stay in the same drawer. Every scientific context has an adjacent visible Explain / Entenda button; the global glossary alone is insufficient.

**Sources panel** (`file-text`): retain listed/extra sources and game assumptions in Guided too. Displays distinguish measured, calculated and assumed values; explanations link to the same references.

**Guided tour** (FIRST_LIGHT, first run): choose goal → compare camera → read electricity warning → compare panels and their cost → choose a named path → observe and send at first contact. No arithmetic or forced glossary visit. Technical is accessible throughout.

### 7.4 3D scenes (one canvas)

| Scene | Contents | frameloop |
|---|---|---|
| `SpacecraftModel` | Bus box sized by class (3U = 1 × 1 × 3.4 aspect; SmallSat = cube); parts as simple meshes: wings (thin panels), dish (cone), lens (cylinder), tanks (spheres); emissive edges in role colour on hover | demand |
| `OrbitScene` | Planet as a graticule sphere (lat/lon lines, tinted Earth blue or Mars ochre); orbit line from Kepler sampling (purple); spacecraft marker (sprite with the Lucide `satellite` SVG); ground station marker; contact line when in contact (cyan); directional sun light from `sunDir`; optional shadow cylinder | demand in Launch; always while Operate is running |
| `TransferScene` | Sun, Earth and Mars orbit circles, Hohmann half-ellipse, the spacecraft along the arc during cruise skip | demand |

Rules: DPR `[1, 1.5]`; no post-processing; `prefers-reduced-motion` disables the camera auto-rotate and the warp-driven planet spin is shown at reduced visual speed. Lucide SVGs for sprites are imported from `lucide-static` as raw strings and turned into `CanvasTexture`s once, then cached.
The canvas never unmounts during phase transitions or while help/settings are open. Opaque panels may cover their own regions, but the default layout must leave space visible. A WebGL failure shows its honest recovery panel rather than pretending a rendered scene exists.

Optional real imagery (stretch): a Mars Trek Viking mosaic texture at low zoom with source credit.

### 7.5 Icons (C7)

`apps/web/src/ui/icons.ts` is the only `lucide-react` import site. Re-export typed role/budget/part/phase/event/state maps per the brief's icon list. Science help consistently uses `book-open` plus the visible Explain / Entenda label, not an icon-only or hover-only affordance.

### 7.6 Refusal and disabled-control rule (C4)

- Controls that can be unavailable use `aria-disabled="true"` (not `disabled`), so they stay focusable. Their click shows the refusal reason inline and in an `aria-live="polite"` region.
- Refusal text is `t('refusal.<CODE>', values)` and always says **what limit** and **what to try**.
- Scientific reasons also bind a topic and Explain. Immediate text gives plain consequences (“Too heavy for this ride; try a lighter part”); exact limits and terms remain available without becoming the only way to understand a refusal.

### 7.7 i18n

- i18next + react-i18next, `fallbackLng: 'en'`. Locales `en` and `pt-BR`; a browser-language detector with a manual switch (`languages` icon).
- Namespaces in each locale: `app.*`, `phase.*`, `role.*`, `scenario.<ID>.*`, `part.<id>.{name,desc}`, `ride.<id>.*`, `refusal.<CODE>`, `cue.<ruleId>.{title,body,fix}`, `event.<KIND>.*`, `decision.*`, `failure.<cause>.*`, `fact.<key>`, `advice.<key>`, `score.<component>`, `glossary.<id>.{term,def}`, `assumption.<key>`, `science.<topicId>.*`, `scienceContext.<contextId>.*`, `presentation.*`, `ui.*`. Science covers short meaning, context, consequence, deeper term/model, limitations and diagram text; both locales must be authored.
- Numbers and units go through `Intl.NumberFormat(locale)`. Units are never translated (SI).
- The parity test checks identical key sets and identical interpolation variables in `en` and `pt-BR`, and that every key in `core/src/i18nKeys.ts` exists.

### 7.8 Accessibility

Full keyboard play (tab order follows the layout; sliders support arrow keys; time warp has `,` and `.` shortcuts; space = pause). Visible focus rings. An `aria-live` region announces events and refusals. The 3D canvas has `aria-hidden` with a text twin (telemetry readouts carry all the information). Contrast ≥ 4.5:1 for text.

### 7.9 Scientific accessibility (C16–C18)

[SCIENCE_UX.md](./SCIENCE_UX.md) defines the required interaction/content contract. Every scientific context, including Technical units, chart axes, failures and data facts, registers topic bindings. Its adjacent Explain button opens the shared drawer at that topic and state snapshot. Reading pauses time, never issues commands or changes score; close restores focus and requires explicit Resume.

Registry: `packages/data/src/science.ts` (closed `ScienceTopicId` derived from authored keys) and `scienceBindings.ts` (context → topic IDs). Core remains independent of prose. Use core-derived values for examples, not scientific calculations duplicated in translations. Missing topic bodies or evidence/assumption references are build failures, not generic fallback help cards. Guided percentages/statuses derive from the same budgets as Technical.

---

## 8. Logic specs

### 8.1 Quote order (`quoteAddPart`)

Checks run in order; the first failure returns the refusal:

1. Role owns the part category, else `ROLE_LOCKED { role }`.
2. Part allowed for the bus, else `RIDE_MISMATCH` (n/a) / not listed.
3. Unique parts (OBC, ADCS, propulsion) not already present, else `DUPLICATE_UNIQUE`.
4. Volume: used + part ≤ limit, else `NO_SLOT { used, part, limit }`.
5. Mass: used + part ≤ limit (strict `<` for the CubeSat 101 limits), else `MASS_OVER_LIMIT { after, limit }`.
6. Cost: used + part ≤ budget × difficulty, else `OVER_BUDGET { after, limit }`.
7. Dependencies: e.g. `RADIO_SBAND` requires an ADCS, else `REQUIRES_PART { needs }`. *(This is a hard rule only where physically required; softer issues are cues.)*

`apply` = re-quote, then replace (VP pattern: apply always re-validates). Power, data and Δv problems are **cues, not refusals**: players may build an unbalanced spacecraft and learn in Operate.

### 8.2 Budgets estimate (`computeBudgets`)

- Mass, volume, cost: sums over parts plus the bus structure.
- Orbit-dependent values use `estimate.ts`, which runs the **same physics** over one day at a 30 s step (2,880 samples). It gives eclipse fraction, contact minutes per day, and orbit-average generation for the default pointing plan (assumption: 60 % SUN, 30 % TARGET, 10 % EARTH). Results are memoised by `(design.revision, orbit)`.
- `usableBatteryWh = capacity × usableDepth`; `eclipseWh = avgLoadW × maxEclipseDurationH`.
- Data: `genMBPerDay = Σ rate × dutyFromPlan × litFraction`; `downMBPerDay = rate × contactMinPerDay × 60 / 8 / 1000` (rate in kbps → MB; documented).
- Δv (Mars): required = capture Δv for the chosen orbit; available from the rocket equation with dry mass = everything except propellant.

### 8.3 Launch readiness

The design is ready when `launchReadiness` returns `[]`. Possible reasons: `NOT_READY { missing: 'ride' | 'orbit' | 'radio' | 'obc' }`, `RIDE_MISMATCH`, `SIGNOFF_BLOCKED { role }` (hot-seat), and `PROPELLANT_OVER_TANK`. Power and data imbalance **do not** block launch.

### 8.4 Decision cards (auto-pause)

| Event | Options (each is a normal command set) |
|---|---|
| `SOLAR_STORM_START` | "Enter safe mode" (SAFE on) · "Keep observing" (no change) · "Radiation monitor only" (other instruments off) |
| `STORAGE_NEAR_FULL` | "Pause instruments" · "Point to Earth and downlink" (EARTH + DOWNLINK on) · "Continue" |
| `BROWNOUT` | "Sun-point and recover" (SUN, instruments off) · "Continue" |
| `PASS_START` (first only) | "Downlink now" · "Not now" |
| `CAPTURE_DONE` / failure | Continue / Go to report |

---

## 9. Testing and verification

| Layer | Tests | Owner |
|---|---|---|
| Physics | §4.4 table as `bun test` cases; Kepler round-trip (E solver at e ∈ {0, 0.1, 0.6, 0.9}); eclipse analytic vs sampled | Agent A |
| Catalogue | **Provenance test** (C1): every `Q` has a provenance and every `src` exists in `SOURCES`; part ids unique; i18n key list complete | Agent A |
| Design | Refusal order; strict CubeSat mass `<`; sign-off invalidation (`rolesAffectedBy`); readiness reasons | Agent A |
| Sim | Brownout → SAFE; storage overflow; downlink only in contact; Mars command latency; capture success and fail; cruise skip duration 258.9 d; **golden trace**: FIRST_LIGHT reference design, seed 42, fixed command log, 3 sim days at dt 10 s, every 360th step recorded → JSON fixture < 200 KB, `toEqual` | Agent A |
| Review | Cooldown, hysteresis, cap (all alerts + ≤ 2 tips), applicability by phase | Agent A |
| Score | Weights sum to 1; stars thresholds; Cadet recovery penalty | Agent A |
| Data | Snapshot schema validation; RadLab stats reproduce min 1.21 / median 4.59 / max 527.29 µGy/h / n 1,886 | Agent B |
| i18n | Parity (keys + variables), core key coverage | Agent B |
| Web | Store actions (quote → set, sign-off clearing, reset) with `bun test` + happy-dom where needed | Agent C |
| End to end | Wave 2: real browser playthrough of FIRST_LIGHT (solo) and RED_RELAY (hot-seat, 2 players), both locales; screenshots; console clean | Orchestrator |
| Build | `bun run typecheck`, `bun test`, `bun run build`, bundle size check, `grep` gates for C6, C7, C8 | Orchestrator |
| Guided equivalence | Starter fits each difficulty; presets equal manual designs; fuel-plan refusal is atomic; switching depth preserves full command-log outcome | Agent A |
| Science coverage | Scientific contexts resolve topics, both locale bodies, diagram text and evidence/assumption references; include Technical | Agent B |
| Explain interaction | Live/paused/decision-modal entry, correct topic/context, preserved queues/seed/score, focus return, no auto-resume; FIRST_LIGHT without formulas | Agent C + orchestrator browser proof |

---

## 10. Scope tiers

| Tier | Contents |
|---|---|
| **Weekend (this plan)** | Three scenarios, two classes, hot-seat, accurate simplified physics, real-time warp, Mars latency, coach, report, sources, optional tour, en/pt-BR; **Guided default + Technical details + universal contextual Explain** are required, not stretch |
| **Next** | 6U (with a sourced limit), the Moon, sun-synchronous orbits (J2 from a sourced value), drag lifetime, thermal budget, mission of the week (seeded by ISO week), local leaderboard export |
| **Later** | Online rooms (4 devices; server re-quotes with `@astrix/core`), the flagship class, outer planets, Mars Trek and Earth imagery textures, a spacecraft assembly drag-and-drop in 3D |

---

## 11. Execution plan: 3 mechanical subagents

### 11.1 Waves

```
WAVE 0  (orchestrator, sequential)                         ~1–2 h
  scaffold workspace, tsconfig, Vite + Tailwind v4 + i18n init, Zustand store skeleton,
  packages/core/src/contracts.ts (§6.2 verbatim), index.ts stubs that throw,
  packages/data skeleton, empty locale files, scripts in package.json.
  Freeze the SCIENCE_UX.md starter/preset/preview and topic/binding contracts before delegation.
  → commit "scaffold + contracts"

WAVE 1  (3 subagents in parallel, disjoint files)          ~6–10 h agent time
  A  CoreEngine     packages/core/**            (except contracts.ts: read-only)
  B  DataContent    packages/data/**, scripts/snapshot-data.ts, apps/web/src/i18n/locales/**, apps/web/src/i18n/parity.test.ts
  C  WebUI          apps/web/src/** (except i18n/locales/** and i18n/parity.test.ts)

WAVE 2  (orchestrator)                                      ~2–4 h
  integrate: replace stubs, run typecheck + tests + build once, fix seams,
  browser playthrough (both locales, solo + hot-seat), bundle check, README credits, docs update
```

Shared rules for all three agents:
- Use **only** this plan and `contracts.ts` as the spec.
- **Void Protocol**: only the files assigned to your agent in the [reuse report](./research/void-protocol-reuse.md) §3–§7, copied from commit `218625d` with the §8 procedure. Follow no other VP imports; no VP assets.
- **Do not change `contracts.ts`.** If the contract is insufficient, write the needed change to `docs/CONTRACT_REQUESTS.md` and continue with a local adapter.
- No builds, lint, formatters or full test runs mid-flight; the orchestrator runs them once in Wave 2.
- Every number added must carry a `Provenance`.
- No emoji in product strings or code comments.

### 11.2 Agent A: `CoreEngine`

- **Target**: `packages/core/src/**` (all files listed in §6.1 except `contracts.ts`), tests `*.test.ts` beside each module, golden fixture `packages/core/src/sim/__traces__/first-light-seed42.json`, `packages/core/src/i18nKeys.ts`.
- **Change**:
  1. `rng.ts`: seeded 32-bit PRNG with pure `next(state) → [value, nextState]`.
  2. `physics/*`: §4.1 constants as `Q` values with source ids; §4.3 formulas as pure functions.
  3. `catalog/*`: §5.2 source registry, §5.3 tables verbatim as `Q` values with the notes given, the 3 scenarios (§3.2), difficulty (§3.10), rides, stations, capture orbits. The storm profile is imported from `@astrix/data` (`radlab-dostel1-2024-05-10.json`) through a typed loader; until it lands, read a local fallback built from the stats in §4.6, marked `assumption`.
  4. `design/*`: §8.1 quote order, §8.2 budgets (with the one-day estimate), §8.3 readiness, sign-off invalidation (`rolesAffectedBy`).
  5. `sim/*`: §4.5 step order, commands with latency, events §3.7, failure §3.11, history ring, objectives, `skipCruise`, `telemetry()`.
  6. `review/*`: engine (§3.8 algorithm) and the 13 rules.
  6a. **Accessible projections**: `catalog/starters.ts`, `catalog/presets.ts`, `design/preview.ts`, `design/fuelPlan.ts`, `design/summary.ts` per SCIENCE_UX.md. Same limits/quotes/permissions; preserve unknown forecast states. Verify starter fit, preset/manual equivalence and atomic fuel-plan refusal.
  7. `score/score.ts`: §3.9.
  8. `i18nKeys.ts`: the exhaustive list of keys core emits (refusals, cues, events, failures, facts, advice, score components, assumptions, scenario, part and ride names).
  9. Tests per §9 (Agent A rows), including the golden trace writer behind `UPDATE_GOLDEN=1`.
  10. **VP reuse** (reuse report §7): adapt `advisor/engine.ts` + `engine.test.ts` into `review/engine.ts` + test; take `mulberry32` from `terrainNoise.ts` into `rng.ts`. `failure.ts`, `quote.ts` and difficulty follow the VP patterns but are new code.
- **Acceptance**: every function in `contracts.ts` is implemented with no `throw 'not implemented'` left; all §4.4 values are asserted; the provenance test exists; no DOM, `Date.now` or `Math.random` in core.
- **Non-goals**: UI, locale strings, data fetching.

### 11.3 Agent B: `DataContent`

- **Target**: `scripts/snapshot-data.ts`, `packages/data/**` (JSON snapshots, `src/index.ts` typed loaders, schema tests), `apps/web/src/i18n/locales/en.json`, `apps/web/src/i18n/locales/pt-BR.json`, `apps/web/src/i18n/parity.test.ts`.
- **Change**:
  1. The snapshot script fetches:
     - RadLab ISS DosTel1 2024-05-10T00:00 → 2024-05-12T00:00 (`absorbed_dose_rate`, `instrument`, `module`; URL-encode `>=`, `<`, `:`), reduced to 48 hourly means plus stats;
     - DONKI GST 2024-05-08..2024-05-14 and CME 2024-05-20 from `https://ccmc.gsfc.nasa.gov/DONKI/WS/get/{GST,CME}`;
     - mission facets + up to 3 Mars sample products per mission from `../nasa.json`.

     Each output file records `source`, `url`, `retrieved`. Run it once and commit the outputs.
  2. Confirm the SI source URLs for `c` and `g₀` load, and append the confirmed URLs to `packages/data/sources-extra.json`, which Agent A's registry reads.
  3. Locales: write **every key** from §7.7 namespaces for all ids in §3–§8 (scenarios, parts, rides, refusals with the values listed in §8.1, cues from §3.8, events, decisions §8.4, failures, facts, advice, score components, glossary entries §7.3, assumptions, UI chrome). Tone: mission-control, plain language for ages 13–18, no emoji. `pt-BR` is a full translation, not a copy.
  3a. **Science content**: own `packages/data/src/science.ts`, `scienceBindings.ts`, `science.test.ts` and localized `science.*`, `scienceContext.*`, `presentation.*`. Author plain meaning, mission consequence, diagram text, optional deeper model and evidence/assumptions for every shipped science context in SCIENCE_UX.md, including Technical fields, report facts and chart axes.
  4. Parity test per §7.7. Core key coverage imports `@astrix/core/i18nKeys`; until Agent A lands it, test against `docs/I18N_KEYS.md` written by this agent from §3–§8.
- **Acceptance**: three snapshot files exist with provenance; the RadLab stats match §9; the locale files have identical key sets; no key is missing for any id in this plan.
- **Non-goals**: core logic, components.

### 11.4 Agent C: `WebUI`

- **Target**: `apps/web/src/**` except `i18n/locales/**` and `i18n/parity.test.ts`; `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/package.json`.
- **Change**:
  1. `ui/icons.ts` (C7) using the icon map.
  2. Primitives: Panel, Tile, Label, Value, BudgetBar (SVG), Chip, RefusalNote, ActionButton (`aria-disabled` pattern), Slider, Modal, Drawer.
  3. Layout (§7.2) and the phase screens (§7.3) wired to the store (§6.3), using only the core API from `contracts.ts`.
  4. Store slices and actions (§6.3), including `resetMission`, sign-off clearing via `rolesAffectedBy`, team stats.
  5. `useSimLoop` (§6.4) with warp, auto-pause decisions (§8.4) and the 10 Hz publish.
  6. 3D (§7.4): `AppCanvas` (the single canvas), `SpacecraftModel`, `OrbitScene`, `TransferScene`, Lucide sprite textures.
  7. Report (§7.3) with SVG charts from `history()`.
  8. Glossary drawer, sources panel (from `listSources` and `listAssumptions`), guided tour (6 steps), hot-seat handoff overlay.
  9. a11y (§7.8) and reduced motion; style tokens (§7.1) in `index.css` `@theme`.
  10. Store tests (§9 Web row).
  11. **VP reuse** (reuse report §3, §5, §7): adapt `quality.ts`, `pixelBudget.ts`, `AdaptivePixelBudget.tsx`, `WebGLFailureNotice.tsx` + `ApplicationErrorPanel.tsx`, `previewSnapshots.tsx` (report and scenario-card spacecraft PNGs), `hudLabel.ts` tokens (no blur), `gameEvents.ts`, `cueTone.ts`, and the `playTone` excerpt of `soundManager.ts` → `audio/tones.ts` + gated `audio/cues.ts` (cue table in the report §5) with a settings switch.
  12. Settings panel: quality (Auto / Low / Medium / High), sound on/off + volume, reduced motion, language.
  13. **Accessible science UI**: Guided/Technical on the same model, comparison previews, named presets and editable starters; `ExplainButton`, `ScienceDrawer`, `ScienceDiagram`, `TechnicalDetails` per SCIENCE_UX.md. Opening snapshots context and pauses; close/Escape/Show me restores focus and never resumes. Add learning-interaction checks without changing difficulty or outcomes.
- **Acceptance**: every screen renders against the stubs without crashing (stubs throw, so the screens show a graceful "engine not ready" tile); there are no literal UI strings in JSX (all `t()`); there is one `<Canvas>`; there is no `fetch`; only `icons.ts` imports `lucide-react`.
- **Non-goals**: physics, catalogue numbers, locale text.

### 11.5 Integration seams (Wave 2 checklist)

- [x] Every frozen CoreAPI function implemented; `bun run typecheck` clean.
- [x] Integrated `bun test`: 102 passed, 0 failed; later targeted checks for observed changes passed.
- [x] Golden fixture retained in the source tree and stable on subsequent normal runs.
- [x] Production build passed; 446,728 JS gzip bytes across three chunks, under 600,000 bytes; licence/evidence files included. Production browser playthroughs are recorded in VERIFICATION.md.
- [x] Runtime `fetch(` gate empty; Lucide imports centralized; exactly one Canvas declaration.
- [x] FIRST_LIGHT solo EN success; STORM_WATCH Cadet PT-BR success; RED_RELAY solo capture failure and two-player EN redesign/full-horizon success.
- [x] Sources and model assumptions are available in the shared science drawer; measured, calculated and assumed values are distinguished.
- [x] FIRST_LIGHT completed without Technical/formulas; explanation interactions preserve pending decisions and require explicit Resume.
- [x] No novice-usability study or independent human translation/science review is claimed.
- [x] README, credits, licence notices, AI disclosure, GMAT evidence and verification documentation are present and linked.

### 11.6 Risks during execution

| Risk | Mitigation |
|---|---|
| The contract is missing something | `CONTRACT_REQUESTS.md` + local adapters; the orchestrator resolves it in Wave 2 |
| The web agent can't see real behaviour (stubs) | The stubs return fixture-shaped data for `listScenarios`, `listParts`, `computeBudgets` (Wave 0 writes minimal fixtures); everything else throws |
| Locale keys drift from core | `i18nKeys.ts` + the parity test; Agent B also writes `docs/I18N_KEYS.md` from this plan |
| RadLab API slow or 500 | Retry with a longer timeout; the documented fallback is the stats-only profile marked `assumption` |
| Scope creep | Anything outside §10 Weekend goes to `docs/BACKLOG.md` |

---

## 12. Open items

1. **Team size**: Global Judging needs **2–6 registered participants** ([#1947](https://github.com/nasa/spaceapps/discussions/1947)). The brief says "solo"; register at least one more teammate on the same event, or accept local judging only.
2. **Listed-resource engagement (C13)**: confirm that CubeSat 101 + GMAT validation counts as "a NASA data source listed in the Resources". This challenge lists no data API; consider asking the organizers in the GitHub discussions.
3. **Real part specs** to replace the `assumption` rows in §5.3 (NASA mission pages, CubeSat 101 examples).
4. **6U mass limit**: needs a primary source before 6U ships.
5. **DONKI GST for 10–11 May 2024**: fetched in Wave 1; the narrative text waits for those values.
6. **GMAT run completed independently**: R2025a console successfully interpreted and ran `scripts/validate-orbits.script`. Observed Earth-orbit periods, Mars capture period and numerically propagated transfer time are in [gmat-validation.md](./research/gmat-validation.md). Core tests must still verify the application against them.
7. **Demo deliverable**: a ≤ 30 s video or ≤ 7 slides (#1947).
8. Name and branding: working title "ASTRIX Mission Studio". The UI shows no NASA logos or insignia.
9. More missions beyond the weekend three: see [MISSIONS.md](./MISSIONS.md).

---

## 13. Void Protocol references used (see the reuse report for what is copied)

Located with `graphify query` in `~/dev/void_protocol` (graph: 11,427 nodes) and by reading the docs.

| Pattern | VP source | Used in |
|---|---|---|
| Quote → apply re-validates; typed refusal union; epsilon-safe maxima | `packages/shared/src/systems/resourceConversion.ts` (`maxConversionBatches`, `quoteConversion`, `applyConversion`) | §8.1 |
| Cue engine: applicability, guidance filter, cooldown, hysteresis `clearAfterSec`, priority sort, cap (all alerts + ≤ 2 tips) | `apps/web/src/advisor/engine.ts` (`evaluateCues`), `stores/cueStore.ts` (`showCueTarget`) | §3.8 |
| Death details: immutable lethal snapshot → pure facts and advice as i18n keys; localisation in the panel | `apps/web/src/utils/deathReport.ts` (`describeDeath`), `components/ui/GameOverPanel.tsx` | §3.11 |
| Difficulty owns death behaviour (respawn vs game over; creative) | `docs/fullstack/GAME_MODES.md` §2.6 | §3.10 |
| HUD card, label, number and colour tokens; `aria-disabled` explained refusals; no blur on low tier | `docs/fullstack/UI_STYLE.md` §1–§5, §8, §13 | §7.1, §7.6 |
| One WebGL context; demand frame loop; DPR and LOW-tier rules | `docs/engine/3D_ASSETS.md`, `docs/engine/PERFORMANCE_GUIDELINES.md` §1.26 | C3, C10, §7.4 |
| Golden traces: seeded RNG + fixed clock, `toEqual` per tick, `UPDATE_GOLDEN=1`, size cap | `docs/meta/TESTING.md` §7.1 | §9 |
| Locale key parity across locale files | `docs/meta/TESTING.md` §5d, `docs/fullstack/GAME_MODES.md` §13 | §7.7 |
| i18next init with detector + `fallbackLng: 'en'`, `pt-BR` | `apps/web/src/i18n/config.ts` | §7.7 |
| Atomic reset of every module-level state | `docs/engine/CORE_ARCHITECTURE.md` §5.5 | §6.3 |
| Action buffer: one `set()` per action | `docs/engine/CORE_ARCHITECTURE.md` §4.4 | §6.3 |
