# Space Mission Design Game: design brief

Status: **implemented 2026-11-14**. See [VERIFICATION.md](../VERIFICATION.md) for observed checks and limitations. The [Guided science decision](#10-latest-decision-guided-science-ux-2026-11-14) and [persistent floating-space layout](#11-latest-layout-decision-persistent-space-and-floating-panels) supersede earlier raw-telemetry, slider and fixed-layout defaults. Otherwise §9 takes precedence over §2–8. Official challenge descriptions remain unchanged.

Related detail:
- [challenge text and resources](./space-mission-design-game.md)
- [ASCII mockup](./space-mission-design-mockup.md)
- [resource map](./space-mission-design-resources-map.md)
- [comparison with the junior trainer](./COMPARISON.md)
- [Void Protocol reuse plan](../research/void-protocol-reuse.md)
- [verified facts](../research/verified-facts.md)
- [Science UX: canonical accessibility and explanation contract](../SCIENCE_UX.md)
- [all 15 missions: player cards and optional technical references](../MISSIONS.md)

## 1. The problem

Students learn space missions **one topic at a time**: orbital mechanics here, spacecraft design there, rocket launches somewhere else. The challenge page names three gaps:

1. **Topics are taught in isolation.** Existing tools cover single topics and do not show how the elements "interact as a complete system".
2. **Trade-offs stay abstract.** A better instrument raises science value but also "mass, power consumption, data volume, and cost". Students rarely watch that chain play out.
3. **There is no place to practise.** Students "rarely have access to an environment" to experiment with a whole mission from concept to operation. Real tools (GMAT, Goddard's Mission Design Lab) are professional systems.

**What the game must achieve:** a safe sandbox for integrated decisions and cheap failure. Players see how one change ripples through the mission, fly again, and learn there is rarely one right answer. Team play shows how mission teams negotiate over shared resources.

**Success test:** a player who finishes can explain **why** a choice had a cost. A game that only looks like a space game fails the brief.

## 2. Core loop

```
 🎯 goal card → 💡 pick size + orbit type → 🛠️ fit parts within budgets → 🚀 launch → 🛰️ operate (events) → 📊 report
        ▲                                                                                                  │
        └──────────────────────────────────── 🔁 redesign and fly again ◀──────────────────────────────────┘
```

| Phase | What the player does | Taught concept | Where the structure comes from |
|---|---|---|---|
| Need & goal | Picks a plain-language goal card showing the outcome to achieve | Missions start from a need | Design & Develop Science Missions: "Identify need & goals"; CML 1 |
| Concept | Compares spacecraft classes and named orbit cards, with at most three meaningful alternatives per category | Size and orbit constrain everything after | CMLs 2–3; CubeSat 101 sizes |
| Design | Starts with an editable basic spacecraft, chooses the science instrument and compares upgrades; watches four outcome summaries | Every part costs mass, power, data and money | CML 4 "point design"; Mission Design Lab disciplines |
| Launch & orbit | Picks a ride and checks "Fits on rocket", with mass and volume checked separately | The vehicle and dispenser limit what flies | CubeSat 101 dispensers; computed orbit values |
| Operate | A sped-up timeline with events, a few decisions and visible Explain / Entenda buttons | Margins exist for the unexpected | Game simulation; real storm records with explicit model assumptions |
| Report | Plain-language outcome, first failure cause, optional score/telemetry detail and "real missions like yours"; Explain remains available | Why it worked or failed | Webb game precedent; `nasa.json` facets |

## 3. Resources, budgets and rules

**Default Guided overview** (same underlying model as Technical details):

| Summary | What the player can see without knowing scientific notation |
|---|---|
| Fits on rocket | Separate mass and volume checks; explain what does not fit and which choice can change it |
| Energy for the trip | Generation and consumption, plus a separate stored-battery margin; a bigger battery does not make more energy |
| Mission progress / data return | What has been observed, what is stored and what has actually reached Earth |
| Budget | What the current spacecraft costs and what remains |

**Optional Technical details / developer reference:** the following raw-unit table preserves engineering limits and provenance. Exact values remain inspectable, but reading it is not a prerequisite and it is not the default set of dashboard meters.

| Budget | Shown as | Hard limit? | Real source |
|---|---|---|---|
| ⚖️ Mass | kg used / limit | **Yes**: 1U < 1.33, 1.5U < 2.00, 2U < 2.66, 3U < 4.00 kg | CubeSat 101 acceptance checklists |
| 📦 Volume | slots by unit (U) | Yes | CubeSat 101 sizes |
| ⚡ Power | generation vs draw, in sunlight and eclipse | Soft: a deficit drains the battery | 🧪 part specs needed |
| 💾 Data | generated vs downlinked | Soft: storage fills and data is lost | 🧪 radio and pass time needed |
| 💰 Cost | spent / budget | Yes per scenario | 🧪 game assumption unless sourced |
| ⏳ Lifetime | days of operation | Scenario target | 🧪 orbit table |

**Rule:** every number is either **sourced** (with a link in the explanation's sources section) or labelled **🧪 game assumption**. Computed teaching approximations are labelled as computed, not as measurements; scientific uncertainty and model assumptions stay visible in both presentations.

**Refusals** are typed and explained. Default copy first states what failed and a useful change in familiar language, with a visible Explain / Entenda button; codes and raw numbers remain available in optional Technical details. These are developer copy examples, not required scientific vocabulary:

```
 🚫 MASS_OVER_LIMIT  "4.31 kg; a 3U CubeSat must stay under 4.00 kg"   → remove a part · go 6U · lighter version
 🚫 NO_SLOT          "No free unit left in this 3U"                     → go bigger · remove a part
 🚫 POWER_NEGATIVE   "Draws more than the wings make in sunlight"       → add wings · cut duty cycle
 🚫 OVER_BUDGET      "Costs more than the mission budget"               → cheaper part · drop an instrument
 🚫 RIDE_MISMATCH    "This ride can't reach that orbit"                 → change ride or orbit
```

## 4. Team play

| Role | Owns | Typical pull |
|---|---|---|
| 🔬 Science lead | goal, instruments | more instruments |
| 🛠️ Spacecraft engineer | mass, power, structure | margin |
| 🚀 Launch & orbit | ride, orbit | a cheap ride, a good orbit |
| 📡 Ground & comms | radio, ground passes, data | the data has to fit the downlink |

- Solo play: one player holds all four roles.
- Team play: each role edits only its own parts; the score includes team decisions.
- The roles map to the four mission segments (launch, space, ground, user) in Design & Develop Science Missions.

## 5. Real data: what we have and what we lack

| ✅ Have, verified | 🧪 Still needed |
|---|---|
| CubeSat size and mass limits | Instrument, battery, solar, radio and computer specs |
| Mission segments, design flow, CML stages | Launch ride capacity and price |
| DONKI May 2024 storm event, as an optional event | An orbit table (passes per day, eclipse share, lifetime) generated with GMAT |
| RadLab ISS dose sample, as an optional LEO radiation fact | A ground-station assumption |
| `nasa.json` mission facets for the reveal | |

## 6. Architecture

This follows the [Void Protocol reuse plan](../research/void-protocol-reuse.md).

```
 packages/core   pure TS: quotePart · computeBusCapacities · stepSpacecraft · objectives · scoreMission
 apps/web        React + Zustand + SVG; at most one 3D view; en/pt-BR; static deploy
 apps/room       (stretch) tiny Bun WebSocket room; re-quotes every intent with packages/core
```

- **Testing:** unit tests on `packages/core` cover budgets, refusals, the simulation step and scoring. The browser test is a full mission played end to end.
- **Accessibility:** keyboard play, a reason on every disabled control, reduced-motion support, no account needed, and the [Science UX](../SCIENCE_UX.md) explanation/focus contract. Equations and acronyms are never prerequisites.

## 7. Scope tiers (proposed)

The table below is the earlier tier proposal, **not the current weekend acceptance scope**. The latest decision in §10 preserves **all three** weekend missions: First Light, Storm Watch and Red Relay.

| Tier | Contents |
|---|---|
| **MVP** | 1 scenario · solo play · 3U only · about 8 parts · 3 orbits · design → launch → operate (2–3 events) → report · sources panel |
| **Target** | 3 scenarios · 1U/3U/6U · team roles on one shared screen (hot-seat) · design review warnings · glossary · guided tour · local best scores |
| **Stretch** | Online 4-player room · mission of the week · leaderboard · 3D orbit view · `nasa.json` reveal with thumbnails · DONKI storm event |

## 8. Risks

| Risk | Mitigation |
|---|---|
| Part numbers look invented | Source a small catalogue from NASA mission pages; label everything else 🧪 |
| Multiplayer eats the weekend | Hot-seat first; network room only after the MVP is done |
| Too many systems for young players | Default Guided presentation uses familiar decisions, outcome summaries and explicit Explain / Entenda buttons; optional Technical details exposes the same physics, not a different difficulty profile |
| A single "best build" is found fast | Scenario cards with different goals and weights; random events during operation |
| Rules on reusing prior code | Confirm the Space Apps rules; credit Void Protocol |

## 9. Decisions (answered 2026-11-14)

| # | Question | Answer |
|---|---|---|
| 1 | Challenge | **Space Mission Design Game** |
| 2 | Audience | **Ages 13–18 with zero science prerequisite**; no audience-age switch |
| 3 | Goal | **Win judging**: polish plus a clear teaching message |
| 4 | Setting | **Anywhere**: Earth orbit, Moon, Mars, deep space |
| 5 | Tone | **Serious mission-control look** |
| 6 | Spacecraft scale | **Classes**: CubeSat → small sat → flagship, each with its own limits |
| 7 | Team play | **Hot-seat**: shared screen, roles take turns, no server |
| 8 | Physics | **Simple physics in the browser**: Kepler orbits, delta-v from the rocket equation |
| 9 | Data rigour | **Strict**: every number sourced or labelled "game assumption" |
| 10 | Operate phase | **Real-time control**: point the spacecraft, schedule downlinks |
| 11 | Team & time | **Solo, one weekend (~48 h)** |
| 12 | Visuals | **3D-first with Three.js; SVG for assets** |
| 13 | Stack | **Bun workspaces + Vite + React + Zustand + TypeScript** |
| 14 | Void Protocol reuse | ~~Patterns only~~ → **reuse approved 2026-11-14** for the files listed in [the reuse report](../research/void-protocol-reuse.md) |
| 15 | Languages | **English (`en`) + Brazilian Portuguese (`pt-BR`)**, including every science explanation and text equivalent |

### Consequences

- Emoji move out of the product UI (mission-control tone). Emoji stay in the planning docs only.
- **Icons: Lucide everywhere** (`lucide-react` in the UI, `lucide-static` SVGs where a raw file is needed, e.g. Three.js sprites or textures). No emoji and no mixed icon sets. Custom SVG is allowed only for spacecraft part art that Lucide lacks, drawn in Lucide's style: 24×24 grid, 2 px stroke, round caps and joins, `currentColor`. See [Icon map](#icon-map-lucide-1730).
- Physics in the core: `packages/core` gets `kepler.ts` (two-body propagation, period, eclipse fraction) and `deltaV.ts` (Tsiolkovsky, Hohmann transfer). Constants such as μ and planet radii need a NASA source (e.g. the NASA planetary fact sheets). These are developer/optional Technical details; the default player chooses outcomes and the engine computes the quantities.
- The 🧪 orbit table is replaced by computed values. The GMAT dependency drops to an optional cross-check.
- The CubeSat 101 limits cover only the CubeSat class. The small-sat and flagship classes need sourced mass and volume envelopes, or a 🧪 label.
- i18n locales: `en`, `pt-BR` (Void Protocol already uses `pt-BR`).

### Icon map (Lucide 1.73.0)

Every name below was checked against the `lucide-static@1.73.0` icon list.

| Use | Lucide icon |
|---|---|
| Spacecraft · launch · orbit | `satellite`, `rocket`, `orbit` |
| Destinations | `earth`, `globe`, `moon`, `sun`, `sun-medium` |
| Budgets: mass · power · data · cost · time | `weight`, `zap`, `hard-drive` / `database`, `coins` / `wallet`, `timer` / `clock` |
| Power parts | `solar-panel`, `battery`, `battery-charging`, `battery-low` |
| Comms | `radio`, `antenna`, `satellite-dish`, `radio-tower`, `signal`, `wifi-off`, `download`, `upload`, `send` |
| Instruments and science | `telescope`, `microscope`, `flask-conical`, `radiation`, `thermometer` |
| Avionics and structure | `cpu`, `box`, `package`, `ruler`, `wrench` |
| Pointing and navigation | `target`, `crosshair`, `compass`, `navigation`, `gauge` |
| Operate controls | `play`, `pause`, `fast-forward`, `rotate-ccw` (fly again) |
| Safe mode · warnings · refusals | `shield`, `shield-check`, `shield-exclamation-point`, `circle-exclamation-point`, `octagon-x`, `ban`, `circle-check` |
| Roles | `microscope` (science), `wrench` (spacecraft), `rocket` (launch & orbit), `satellite-dish` (ground & comms), `users` (team) |
| Report · glossary · leaderboard · explicit Explain / Entenda button | `chart-line`, `chart-column`, `file-text`, `book-open`, `trophy` |
| Settings · language · lock | `settings`, `languages`, `lock` |

Lucide 1.x renamed the old `alert-*` icons. Use `circle-exclamation-point` and `shield-exclamation-point`; `alert-triangle` and `shield-alert` do not exist in this version.

### ⚠️ Scope tension

Solo plus 48 hours, combined with 3D-first, real-time operation, in-browser physics, solar-system-wide destinations, three spacecraft classes and hot-seat roles, is **more than one weekend**. The proposed cut keeps every answer but limits each one's depth:

| Answer | Weekend version | Later |
|---|---|---|
| Anywhere | 2 destinations: **LEO** and **Mars orbit** (Hohmann transfer) | Moon, outer planets |
| Classes | **CubeSat 3U** and **small sat**; 6U only once its limits are sourced | Additional CubeSat sizes; flagship |
| Real-time operate | Time-warp timeline (1× to 10,000×) with 3 live controls: **pointing mode** (sun / target / Earth), **downlink on/off**, **safe mode**; Red Relay includes command light-time delay. Explain pauses the simulation but never commands the spacecraft | Manual attitude; richer command planning |
| 3D-first | One R3F scene, reused: the spacecraft on the bench → the orbit view in operation. SVG for part icons and the HUD | Assembly in 3D, multiple cameras |
| Hot-seat | A role switcher with role-locked parts. One "pass the device" handoff per phase | Online rooms |
| Physics | Circular and elliptical two-body orbits, Hohmann transfers, eclipse by cylinder shadow, delta-v budget; Guided orbit cards, optional exact elements and sliders | Plane changes and other new engine features |

## 10. Latest decision: Guided science UX (2026-11-14)

**User decision:** keep the scientific mission-design core, but make the default understandable to a young person who has never studied science, with an explicit button explaining **all** science. This is a documentation/design decision, not a game implementation. It supersedes older defaults that put raw-unit tables, full telemetry, unexplained acronyms or orbital sliders in front of a beginner. The canonical contract is [SCIENCE_UX.md](../SCIENCE_UX.md); the per-mission goal/choice/consequence cards and topic IDs are in [MISSIONS.md](../MISSIONS.md).

### One model, two presentations

- **Guided** is the default. Familiar labels describe what a choice does and what it costs. **Technical details** retains exact values, units, equations, scientist/engineer inputs and orbit sliders. Changing presentation does **not** change difficulty, physics, random seed, scoring or commands.
- No age switch, equation knowledge, acronym knowledge, mandatory reading or quiz is needed to play. Explanations never gate a choice or affect the score.
- Begin with a filled, editable basic spacecraft: computer (OBC), power system (EPS), coarse pointing control (ADCS), body-mounted solar panels and a simple radio. Show every included part's costs and resource use. This is neither a hidden free loadout nor an optimal finished mission.
- The player selects a payload and compares up to three meaningful alternatives per category. The overview is **Fits on rocket**, **Energy for the trip**, **Mission progress / data return**, and **Budget**, with separate mass/volume checks and separate generation/battery margins.
- Orbit choices are named cards with visible consequences. Full numerical tables remain developer/optional Technical reference, not a reason to require mental arithmetic.

### Explicit science explanations everywhere

Every science-bearing goal, part, comparison, orbit card, budget meter, event, warning, refusal, control and report needs a visible Lucide `book-open` **Explain** / **Entenda** button. Hover tooltips and a detached glossary are not substitutes. The button opens one contextual science drawer, with:

1. One plain-language sentence.
2. Why this concept matters to the current mission and the choice's trade-off.
3. A small diagram and equivalent text.
4. Optional real-science detail, including any equation and its units.
5. Sources, uncertainty and explicit simulation assumptions; calculated values must not masquerade as measurements.

Opening the drawer pauses the simulation and records the originating control. Closing returns focus there and **does not auto-resume**; resuming is a deliberate player action. Opening, reading and closing never silently issue commands. All text and accessible alternatives support `en` and `pt-BR`, with Lucide-only icons.

### Three weekend missions retained

| Mission | Default goal and decision | Consequence to make visible | Explicit Explain / Entenda topic IDs |
|---|---|---|---|
| **First Light** | Photograph Earth and get the photos home; compare radio, pointing and energy choices | Stored photos are not returned photos. Faster transmission can need more energy and better pointing during a ground contact | `data-return`, `ground-contact`, `pointing`, `energy-budget`, `eclipse` |
| **Storm Watch** | Collect storm measurements without losing the instrument; choose continued science, monitor-only operation or safe mode | Powered operation changes risk in the labelled game model. Safe mode sacrifices science and can reduce some operational risks; it is **not radiation shielding and does not guarantee survival** | `radiation`, `safe-mode`, `energy-budget`, `data-return` |
| **Red Relay** | Send maps home from Mars; compare **Close circular**, **Balanced oval** and **Wide oval**, plus propulsion and power options | Entering a close circular orbit costs more fuel; an oval can save capture fuel but offers less time close to the surface. The engine computes fuel, sunlight, radio performance and command delay | `orbit-shape`, `propulsion`, `solar-distance`, `energy-budget`, `light-time`, `data-return`, `ground-contact`, `radiation` |

The remaining 12 missions keep their scientific goals and technical reference facts in [the mission catalogue](../MISSIONS.md), with the same explicit explanation contract. Additional topics there are `constellations`, `thermal-control`, `deorbit`, `inclination`, `rendezvous`, `gravity-assist`, `small-body-gravity`, `sample-return`, `telescope-wavelength` and `lagrange-points`. These lowercase kebab-case IDs identify contextual explanations, not a list the player must study before launch.

## 11. Latest layout decision: persistent space and floating panels

The 3D space render remains visibly exposed behind the UI in **every phase**, including mission selection and results. One full-viewport canvas stays mounted; scenes change inside it. Planning, controls, budgets and explanations use **opaque, draggable panels** inspired by Void Protocol rather than fixed columns or full-page forms.

Use explicit drag handles, viewport clamping after move/resize, focus/front ordering, keyboard movement and a Reset layout action. Panel movement is only UI state: it cannot advance the simulation, issue commands or affect score. Interactive children and scrolling never drag a panel or rotate the scene. The default arrangement and narrow-screen adaptation retain visible space.

This supersedes earlier fixed-layout and translucent-surface references. Guided/Technical presentation and the Explain pause/focus contract remain unchanged.
