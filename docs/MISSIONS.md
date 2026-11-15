# Missions

ASTRIX offers short lessons and four longer challenges through the same **Design & Play** path. Both Aspiring and Expert choose a goal on the mission board, then an ambition, hardware kit and approach in Design & Play; they do not need a mission-definition editor. Immutable definitions remain the engine's content format. Goals, costs and hardware ratings are teaching assumptions, not flight qualification.

| Stable ID | Player-facing name | Objective / nominal horizon |
|---|---|---|
| `FIRST_LIGHT` | Earth Observation: Build an Imaging Satellite and Return Data | Deliver 1,500 MB of Earth images in 14 days |
| `STORM_WATCH` | Radiation Survey: Record the Historical ISS Storm Replay | Record 24 monitor hours during the historical 48-hour window; 21-day mission |
| `RED_RELAY` | Mars Mapping: Operate an Orbiter and Return Data | Deliver 5,000 MB of map data within 60 operational days |
| `CREW_PATHFINDER` | Crewed Earth Orbit: Support, Observe and Recover | Maintain crew support, deliver 100 MB, complete recovery; nominal 72 hours in orbit |

A run carries the resolved definition/digest, rules/model versions, level, seed, assistance and configuration identity. Both levels use paid hardware, finite inventories and physical slew; neither repairs failures automatically. Expert adds tighter tradeoffs, not mandatory orbital-element entry or real-time reactions.

The mission board leads directly to one preparation workspace. A live brief shows the actual target, deadline, cost and fit. Static compatibility and within-limits checks are separate from a successful reference-policy readiness certificate. **Play mission** freezes the checked configuration; selecting an operational plan previews it and the named commit executes one decision. Discovery/debrief and same-condition retry close the loop.

## Learning catalogue and quick design

| Stable ID | Player-facing name |
|---|---|
| `FIRST_SIGNAL` | Earth Orbit: Take a Picture and Send It Home |
| `UP_AND_BACK` | Suborbital Rocket: Reach a Target Altitude and Return |
| `STAY_IN_ORBIT` | Earth Launch: Reach and Hold a Safe Orbit |
| `RAISE_YOUR_ORBIT` | Orbital Maneuvers: Raise and Circularize an Earth Orbit |
| `LEAVE_ORBIT_SAFELY` | Earth Deorbit: Reach the Atmospheric Entry Boundary |
| `PAST_EARTH` | Earth Escape: Depart Using a Fueled Upper Stage |
| `MEET_THE_MOON` | Lunar Flyby: Time a Close Approach to the Moon |
| `EARTH_TO_MOON` | Lunar Orbiter: Launch, Capture and Return Map Data |

The same physics and evidence serve curated and player-configured missions. Reaching space, orbiting and escaping are different objectives. A failed ascent, missed encounter or insufficient-fuel burn remains an observable outcome.

Quick design uses bounded ambition, kit and approach choices rather than arbitrary schema editing. Packages resolve to actual paid catalogue hardware. Higher ambition does not silently raise the allowance; each changed configuration needs a fresh feasibility check. Ready means a reference policy succeeded under the nominal model, not that every player choice succeeds. Previous custom-definition files remain distinct user work and can be exported; they are not silently converted into certified quick missions.

Display names describe the destination, operation and purpose in English and Brazilian Portuguese. Stable IDs and saved identities do not change when wording improves. Exact ambition-dependent targets come from the current definition, not a number embedded in a nominal title.

Supported objective kinds are delivered product, instrument hours, apogee band, return boundary, bound orbit, escape, entry interface, lunar encounter distance, propellant reserve, crew support through recovery and crew orbit hours. Required flags, owners, deadlines and dwell requirements are explicit. Review reports per-objective evidence and full definition/run identity; a title alone cannot redefine success.

## Operations

First Light's camera needs target pointing and sunlight, onboard storage and a working downlink; only delivered qualifying image data counts. Storm Watch's retained monitor hours count only inside the ISS dose replay; SAFE sheds load and does not shield radiation. Red Relay skips analytical cruise, then requires explicit capture using the selected engine and fuel; mapping and sending remain separate, and Mars ground commands wait for transport and light time. A queued command is not an executed command.

Sun, Target and Earth are tracking holds, not instantaneous resource multipliers. Manual `ATTITUDE_TARGET` is a serializable, Spacecraft-owned target: it changes panel/instrument/antenna geometry only as the spacecraft slews. First Light and Storm Watch targets wait for a real uplink; Red Relay additionally incurs one-way light time after transmission. Crew Pathfinder targets and holds are onboard, usable outside contact. The camera is independent. Sun-facing panels generate electricity; image/map boresights must enter their nadir cone; directional radios lose rate with Earth-line error.

The timeline predicts bounded geometric opportunities and known event deadlines. The pre-launch DEFAULT dry run is a labelled command-driven forecast, not a score or promise of success. Its operational horizon starts after Red Relay's analytical cruise, and ordinary capture confirmation consumes actual fuel. A full Crew Pathfinder horizon includes the finite return/recovery tail.


CubeSat wings and antenna have stowed/deployed/anomalous states; deployment and retry are operational actions, and their output depends on state. The selected dispenser is a game contract, not a universal CubeSat limit. `disposalScreen` is a wide authored uncertainty screen, not a legal compliance finding or a hidden orbital drag force. Deployment mitigation has mass, volume and cost and does not guarantee success.

Crew Pathfinder is a fictional four-person exercise, not a vehicle replica or health simulator. It tracks finite oxygen, nitrogen, water, dry food and scrubber capacity, cabin gases, powered fan, retained waste and modeled leakage. Crew procedures are onboard actions independent of radio; deorbit burns finite propellant and recovery advances elapsed time and consumption. Recovery is abstracted rather than an entry dynamics solution. `CREW_SUPPORT_LOST` means an authored support requirement was lost, not an injury or diagnosis. A successful score requires objective data, support and completed recovery; an early return can succeed while the separate 72-hour duration requirement remains unmet; a confirmed team end is not success.

Ground requests, declared onboard plans and crew procedures retain distinct transport semantics. Low-level manual-command tools preserve issuer receipts; the normal player commits high-level plans. History and audit are bounded and may be decimated. Earlier rules and scores remain historical, not comparable results under the turn cutover.

## Collaboration and session authority

Local and LAN play use the same pure turn transactions. Roles remain Science, Spacecraft, Launch/Orbit and Ground/Comms; authenticated device identity is separate from the displayed discipline.

The [LAN host](./MULTIPLAYER.md) admits the main display plus up to three phones. Controllers propose a plan without executing it; the host commits once. A turn does not require unanimous Ready or signoffs. Only Bun resolves the LAN commitment; no browser advances an independent mission clock.

Reading and visibility changes are device-local. Reconnect restores the committed decision and never auto-commits. Host-only continuation revokes phone credentials and transfers ownership without discarding physical state. Plain HTTP is supported only on a trusted isolated LAN; process loss ends the room.

## Expansion research — not implemented

The following twelve entries preserve original mission concepts and research links; they are not the learning catalogue above. Their proposed events, topics and engine features remain future-work requirements. `BodyId` now includes Earth, Mars and Moon, but that does not implement every lunar concept or other planetary environment below. Historical `nasa.json` counts are search/facet context, not verified mission attribution or automatically shipped result panels.

Research provenance rules:

- Every number is sourced or labelled a **game assumption**; proposed X/N targets are deliberately unresolved research, not playable objectives.
- Orbital numbers below are **computed**, not measured flight trajectories, from NASA fact-sheet constants (historical plan §4.1 plus Moon, Venus, Mercury and Jupiter sheets read 2026-11-14). The simplifying model uses two-body motion, circular coplanar planetary orbits, patched conics and Hohmann transfers; capture periapsis is 400 km unless stated.
- No source count, quoted spacecraft-class limit or fuel ratio alone proves that a full future loadout fits. Feasibility needs an actual authored design, operational model and validation.
- **Global Awards need meaningful use of a NASA data source listed in this challenge's Resources** ([#1947](https://github.com/nasa/spaceapps/discussions/1947)). Listed-resource engagement below records proposed precedents (CubeSat 101, Design & Develop, CML, MDL, GMAT, Webb or CSA), not a guarantee of organizer eligibility.
---

## N4. `MOON_MAPPER`: Moon Mapper

| Guided mission card | Player-facing content |
|---|---|
| Goal | Make a map of the Moon and send it home. |
| Choice | Compare mapping opportunities and battery reserves; schedule pictures when the ground is lit and downlinks when Earth is reachable. |
| Consequence | A nearby destination means short command delays, not unlimited energy: time in shadow can drain the battery and dark ground limits ordinary photographs. |
| Explain / Entenda topics | `orbit-shape`, `propulsion`, `eclipse`, `energy-budget`, `pointing`, `ground-contact`, `data-return`, `light-time` |

**Optional Technical details / developer reference**

| Field | Value |
|---|---|
| Story | Map the Moon from low orbit; commands arrive almost instantly. |
| Class | SmallSat |
| Trajectory (approx., patched conic) | From 400 km LEO: TLI **3.082 km/s** (supplied by the ride); transfer **4.98 days**; arrival v∞ 0.829 km/s; capture into 100 km circular orbit **0.821 km/s** (propellant / dry: 0.463 at 220 s, 0.299 at 320 s); lunar orbit period **117.9 min**; light delay **1.28 s** |
| Constants | Moon GM 0.00490 × 10⁶ km³/s² (4,900), radius 1,738.1 km, distance 0.3844 × 10⁶ km, sidereal rotation 655.720 h (NASA Moon fact sheet) |
| Objective | Map ≥ X % of the surface at a given resolution (assumption) |
| The trade-off | Capture is cheap, but low lunar orbits are perturbed and lunar eclipses are long; the camera needs lit ground, so mapping waits on the Sun angle |
| Events | Long eclipse (battery sizing), storage full, aging |
| Teaching | Not every destination is hard to reach; near-zero delay allows hands-on control |
| Listed-resource engagement | CML; MDL; GMAT (lunar transfer cross-check); **Mission Viz** has an Earth–Moon transfer demo to reference visually |
| Real missions like yours | Lunar Reconnaissance Orbiter **168** · Apollo **55** · Kaguya **21** · Clementine **11** · Lunar Orbiter **4** · Chandrayaan **1** |
| Engine features | Moon body; coverage map (surface grid marked as imaged) |
| Sources still needed | A source for "low lunar orbits are unstable" (or drop the claim); camera specs |

## N5. `CLOUD_PIERCER`: Cloud Piercer (Venus)

| Guided mission card | Player-facing content |
|---|---|
| Goal | Map the surface hidden under Venus's clouds. |
| Choice | Compare an ordinary camera with a radar mapper, then compare close and wider orbit cards with their fuel and heat consequences. |
| Consequence | Radar can reveal a cloud-covered surface where visible-light photographs cannot. Strong sunlight helps generation but increases the cooling challenge; the mapper still needs energy and a way to return its data. |
| Explain / Entenda topics | `telescope-wavelength`, `orbit-shape`, `propulsion`, `solar-distance`, `thermal-control`, `energy-budget`, `data-return`, `light-time` |

**Optional Technical details / developer reference.** Source the cloud/radar explanation and payload performance before shipping it; it is not a measured instrument result.

| Field | Value |
|---|---|
| Story | Map Venus's surface from orbit. |
| Class | SmallSat |
| Trajectory | Hohmann: v∞ depart 2.495, arrive 2.706 km/s; **146.1 days**; departure from 400 km LEO 3.460 km/s |
| Capture options | 400 km circular **3.298 km/s** (propellant / dry **1.86** even at 320 s; feasibility within 180 kg depends on actual dry mass, tank and hardware, not this ratio alone) · 400 × 10,000 km **1.918**, 3.65 h · 400 × 66,000 km **0.780**, 23.8 h |
| Power and heat | Venus irradiance **2,601.3 W/m² = 1.91×** Earth's: smaller arrays suffice, but heat becomes the problem (needs a thermal model) |
| Comms | Light delay 2.30–14.33 min |
| Objective | Map ≥ X % with the radar mapper (assumption) |
| The trade-off | Capture-orbit choice again, plus optical vs radar instrument (if sourced: clouds hide the surface) |
| Teaching | More sunlight is not free; instrument choice depends on the target |
| Listed-resource engagement | CML; MDL (thermal discipline); GMAT |
| Real missions like yours | Magellan **76** products (10 Venus/Magellan title matches) |
| Engine features | Venus body; radar instrument; thermal budget (new) |
| Sources still needed | Source for Venus cloud opacity and radar mapping; thermal limits |

## N6. `SWARM`: Revisit Swarm

| Guided mission card | Player-facing content |
|---|---|
| Goal | Check the same place on Earth often enough to catch changes. |
| Choice | Compare one more capable satellite with three cheaper ones; choose how the satellites are spaced along or across their paths. |
| Consequence | More satellites and better spacing can reduce waiting between visits, but cost more and still need enough power and ground-contact time to get observations home. |
| Explain / Entenda topics | `constellations`, `inclination`, `orbit-shape`, `ground-contact`, `data-return`, `energy-budget` |

**Optional Technical details / developer reference**

| Field | Value |
|---|---|
| Story | One satellite sees a place once in a while. Three see it more often. |
| Class | 3 × CubeSat 3U (each < 4.00 kg) |
| Orbit | Same altitude, phased along the orbit or in different planes (RAAN) |
| Objective | Revisit a ground target at least every N hours (assumption) within the budget |
| The trade-off | Three cheaper satellites vs one capable one; phasing vs plane spacing |
| Teaching | Constellations and revisit time |
| Listed-resource engagement | CubeSat 101 (dispensers hold several CubeSats); Mission Viz (orbit visual) |
| Real missions like yours | none in `nasa.json` |
| Engine features | Multiple spacecraft in one sim; revisit metric |
| Sources still needed | Dispenser capacity from CubeSat 101 (check exact figures) |

## N7. `SPACE_GARDEN`: Space Garden

| Guided mission card | Player-facing content |
|---|---|
| Goal | Keep a small biology experiment healthy and send its readings home. |
| Choice | Balance heater time, battery capacity and measurement/downlink schedules within the payload's stated care limits. |
| Consequence | Heating in shadow uses stored energy. Saving energy by switching equipment off can interrupt the experiment or its measurements; enough electricity alone does not guarantee a safe temperature. |
| Explain / Entenda topics | `thermal-control`, `energy-budget`, `eclipse`, `data-return`, `ground-contact` |

**Optional Technical details / developer reference**

| Field | Value |
|---|---|
| Story | Fly a small biology experiment and keep it alive. Inspired by the worked example in the challenge's *Design and Develop Science Missions* resource (the BioNutrients missions). |
| Class | CubeSat (6U once a mass limit is sourced; 3U until then) |
| Objective | Keep the payload within its temperature and power window for N days and return the readings |
| The trade-off | Heater power in eclipse vs battery; data vs power |
| Teaching | Biology payloads need life support; "requirements" in practice |
| Listed-resource engagement | **Design & Develop Science Missions** (worked example and flow) |
| Engine features | Thermal model (new) |
| Sources still needed | Payload temperature ranges; 6U limit; specifics of the worked example, quoted from the PDF |

## N8. `LONG_GOODBYE`: The Long Goodbye

| Guided mission card | Player-facing content |
|---|---|
| Goal | Finish the science, then leave orbit responsibly. |
| Choice | Compare lower and higher orbit cards and the cost of a deorbit device. |
| Consequence | A higher orbit may last longer but usually takes longer to decay naturally. Reserving mass and volume for disposal can reduce what else the spacecraft carries; predicted lifetime remains model-dependent. |
| Explain / Entenda topics | `deorbit`, `orbit-shape`, `propulsion`, `data-return` |

**Optional Technical details / developer reference**

| Field | Value |
|---|---|
| Story | Every satellite must leave orbit responsibly when its mission ends. |
| Class | CubeSat 3U |
| Objective | Finish the science and leave the orbit within the allowed time |
| The trade-off | Higher orbit = longer life and less drag, but a slower natural decay; a deorbit device costs mass and volume |
| Teaching | Space debris and responsible design |
| Listed-resource engagement | **CubeSat 101** (deorbit guidance) |
| Engine features | Atmospheric drag and lifetime model (new) |
| Sources still needed | Atmospheric density model or table; the exact deorbit rule wording from CubeSat 101 |

---

## L9. `HIGH_GROUND`: High Ground (GEO)

| Guided mission card | Player-facing content |
|---|---|
| Goal | Keep watching a broad region of Earth from high orbit. |
| Choice | Compare rides and orbit cards, including how much fuel is needed to change the height and tilt of the path. |
| Consequence | A suitable equatorial circular orbit can stay above the same region, but reaching it and correcting a tilted path costs fuel. Seeing a large region is not the same as seeing all of Earth or resolving every detail. |
| Explain / Entenda topics | `orbit-shape`, `inclination`, `propulsion`, `pointing`, `ground-contact`, `data-return` |

**Optional Technical details / developer reference**

| Field | Value |
|---|---|
| Trajectory | GEO radius **42,164 km** (derived: circular period = Earth sidereal rotation 23.9345 h); coplanar Hohmann from 400 km LEO **2.397 + 1.456 = 3.854 km/s** (more with a plane change) |
| Lesson | Altitude and plane changes are expensive; one GEO satellite sees a third of Earth |
| Engine features | Plane-change Δv, coverage cone |
| Listed-resource engagement | GMAT; Mission Viz (elliptical orbit tutorial) |
| Sources still needed | Launch provider GTO options (assumption otherwise) |

## L10. `POLAR_SCOUT`: Polar Scout (lunar south pole)

| Guided mission card | Player-facing content |
|---|---|
| Goal | Survey the Moon's south-pole region. |
| Choice | Choose a path that reaches the pole, then schedule images around the predicted lighting and available energy. |
| Consequence | Tilting the orbit changes which places it can pass over. Near the pole, long shadows can hide features; flying over a place does not guarantee a useful photograph. |
| Explain / Entenda topics | `inclination`, `orbit-shape`, `pointing`, `eclipse`, `energy-budget`, `data-return` |

**Optional Technical details / developer reference**

| Field | Value |
|---|---|
| Story | Survey the lunar south pole region. |
| Lesson | Only polar orbits pass over the poles; low Sun angles mean long shadows and lighting constraints |
| Real data hook | `nasa.json` holds 11 records matching Artemis / Shackleton / south-pole titles (e.g. Artemis III landing-site products) |
| Real missions like yours | Lunar Reconnaissance Orbiter **168**; Artemis **2** |
| Engine features | Moon body, inclination coverage, surface lighting |
| Sources still needed | Polar illumination facts |

## L11. `FEAR_AND_PANIC`: Fear & Panic (Phobos)

| Guided mission card | Player-facing content |
|---|---|
| Goal | Reach Phobos and move alongside it rather than rush past. |
| Choice | Compare arrival and matching-orbit plans with their fuel reserves before committing to the approach. |
| Consequence | Arriving near the moon is not enough: the spacecraft must also match its motion. Saving too little fuel after Mars capture can prevent rendezvous, and Earth commands arrive late. |
| Explain / Entenda topics | `rendezvous`, `orbit-shape`, `propulsion`, `light-time`, `pointing` |

**Optional Technical details / developer reference**

| Field | Value |
|---|---|
| Trajectory | Mars transfer as RED_RELAY, then match Phobos's orbit: semimajor axis **9,378 km**, period **0.31891 d** (NASA Mars fact sheet, satellite table) |
| Lesson | Rendezvous: matching a moon's orbit needs extra Δv after capture |
| Real data hook | `nasa.json` has 2 Phobos products |
| Engine features | Moon-of-planet target, rendezvous Δv |
| Sources still needed | Phobos mass / GM if proximity operations are modelled |

## L12. `IRON_WORLD`: Iron World (Mercury)

| Guided mission card | Player-facing content |
|---|---|
| Goal | Reach Mercury and keep the spacecraft cool enough to work. |
| Choice | Compare a direct route with a sequence of planetary flybys, including travel time, fuel and heat consequences. |
| Consequence | A short direct trip can need more slowing-down fuel than the spacecraft can carry. Flybys can reshape the route but require timing and longer travel; strong sunlight still demands thermal protection. No failed attempt is required to unlock the explanation or alternative route. |
| Explain / Entenda topics | `gravity-assist`, `propulsion`, `orbit-shape`, `solar-distance`, `thermal-control`, `light-time` |

**Optional Technical details / developer reference**

| Field | Value |
|---|---|
| Trajectory | Hohmann v∞ depart **7.533**, arrive **9.611 km/s**; 105.5 days; departure from LEO 5.536 km/s; even a 400 × 15,000 km capture needs **6.734 km/s** |
| Lesson | Direct Hohmann capture can exceed the selected spacecraft's fuel capability; gravity assists offer a different trade-off. Show the computed infeasibility and flyby alternative before launch, without requiring failure or reading to unlock them. |
| Power and heat | Irradiance **9,082.7 W/m² = 6.67×** Earth's |
| Comms | 5.10–11.54 min |
| Real missions like yours | MESSENGER **26** products |
| Engine features | Gravity-assist sequence (new), thermal model |
| Sources still needed | A sourced description of the real flyby sequence |

## L13. `ICE_MOON`: Ice Moon Scout (Jupiter / Europa)

| Guided mission card | Player-facing content |
|---|---|
| Goal | Send observations of Europa home from the Jupiter system. |
| Choice | Compare spacecraft size, power equipment and an observation plan that can operate while Earth is too far away for quick help. |
| Consequence | Dim sunlight makes the same solar panels generate much less power. Long delays need advance planning, while Jupiter's radiation environment adds risk; a larger spacecraft is not automatically a safe one. |
| Explain / Entenda topics | `solar-distance`, `energy-budget`, `light-time`, `radiation`, `safe-mode`, `orbit-shape`, `propulsion`, `data-return` |

**Optional Technical details / developer reference.** The capture example below is a Jupiter orbit, not a computed Europa rendezvous or Europa orbit.

| Field | Value |
|---|---|
| Trajectory | Hohmann v∞ depart **8.793**, arrive **5.643 km/s**; **997.7 days**; departure from LEO 6.293 km/s; capture into 1.1 × 100 Jupiter radii **0.589 km/s** (period about 1,065 h ≈ 44 days) |
| Power | Irradiance **50.26 W/m² = 3.7 %** of Earth's: a 400 W (1 AU) array gives about 15 W |
| Comms | Light delay **34.96–51.60 min** |
| Lesson | At 5 AU, power, distance and delay dominate the design; probably beyond the SmallSat class (unlock flagship) |
| Real missions like yours | Voyager **107** · Galileo **36** · Cassini-Huygens **26**; 12 Europa products |
| Engine features | Flagship class, radiation belt environment, autonomy (delay > 30 min) |
| Sources still needed | Jupiter radiation environment; flagship-class mass envelope |

## L14. `ROCK_SAMPLER`: Rock Sampler (asteroid)

| Guided mission card | Player-facing content |
|---|---|
| Goal | Collect an asteroid sample and bring it safely back to Earth. |
| Choice | Compare sample sites and approach plans, keeping enough fuel and equipment for the return journey. |
| Consequence | Weak gravity makes staying near the surface and touching it gently difficult, not effortless. A successful collection is only part of the mission; the sample must also make the trip home. |
| Explain / Entenda topics | `small-body-gravity`, `rendezvous`, `sample-return`, `propulsion`, `pointing`, `light-time` |

**Optional Technical details / developer reference**

| Field | Value |
|---|---|
| Story | Touch an asteroid and bring a sample home. Precedent: the challenge's **CSA OSIRIS-REx** sample-site game. |
| Lesson | Tiny gravity, choosing a safe sample site, the return trip |
| Real missions like yours | OSIRIS-REx **3** products (1 Bennu product) · NEAR **2** · Dawn **9** (Vesta 4, Ceres 1) |
| Engine features | Small-body proximity model, return trajectory |
| Sources still needed | Bennu orbit and mass; sample-site criteria |

## L15. `SKY_EYE`: Sky Eye (space telescope)

| Guided mission card | Player-facing content |
|---|---|
| Goal | Observe a chosen kind of object with a space telescope and send the observations home. |
| Choice | Compare what kinds of light the instruments detect, then choose a nearby orbit or a Sun–Earth L2-region orbit with its cooling, access and communications costs. |
| Consequence | Different wavelengths reveal different features. Infrared instruments need appropriate cooling; L2 does not make a telescope cold by itself, and a distant observatory still needs stationkeeping and a data link. |
| Explain / Entenda topics | `telescope-wavelength`, `thermal-control`, `lagrange-points`, `orbit-shape`, `propulsion`, `ground-contact`, `data-return`, `light-time` |

**Optional Technical details / developer reference**

| Field | Value |
|---|---|
| Story | Choose a science question, a wavelength and an orbit for a telescope. Precedent: the challenge's **Webb "Build It Yourself"** game. |
| Lesson | Infrared instruments need cooling; Earth orbit can offer lower-cost access but Earth blocks some views and adds thermal constraints. A Sun–Earth L2-region orbit supports stable Sun/Earth shielding geometry, not automatic cold or passive orbital stability; thermal design and stationkeeping remain necessary. |
| Engine features | L2 (three-body) as a precomputed option, thermal model |
| Listed-resource engagement | **Webb learning game** as a design precedent |
| Sources still needed | L2 distance and conditions (NASA Webb pages) |

---

## Engine features by tier

W marks implemented features used by the three playable missions. N/L marks proposed additions only; the table does not imply those engines or destination bodies exist today.

| Feature | W | N | L |
|---|---|---|---|
| Circular + elliptical Kepler, eclipse, ground contact | ● | | |
| Hohmann, rocket equation, cruise skip, command latency | ● | | |
| Dose profile + upset hazard | ● | | |
| Moon and Venus bodies | | ● | |
| Coverage / revisit metrics, multiple spacecraft | | ● | |
| Thermal budget | | ● | |
| Drag and lifetime | | ● | |
| Plane changes | | | ● |
| Gravity assists | | | ● |
| Small-body proximity | | | ● |
| Three-body (L2), flagship class | | | ● |

## New constants read for this list (optional technical reference; NASA fact sheets, 2026-11-14)

| Body | GM (× 10⁶ km³/s²) | Equatorial radius (km) | Semimajor axis (× 10⁶ km) | Irradiance (W/m²) | Other |
|---|---|---|---|---|---|
| Moon | 0.00490 | 1,738.1 | 0.3844 (from Earth) | 1,361.0 | sidereal rotation 655.720 h |
| Venus | 0.32486 | 6,051.8 | 108.210 | 2,601.3 | sidereal orbit 224.701 d, inclination 3.395° |
| Mercury | 0.022032 | 2,440.5 | 57.909 | 9,082.7 | sidereal orbit 87.969 d, inclination 7.004° |
| Jupiter | 126.687 | 71,492 (1 bar) | 778.479 | 50.26 | sidereal orbit 4,332.589 d |

Sources: <https://nssdc.gsfc.nasa.gov/planetary/factsheet/{moon,venus,mercury,jupiter}fact.html>.

Crew return opportunities are authored ten-minute windows repeating every 90 minutes from 12 hours elapsed. A 10-second onboard deorbit action uses a two-body burn to an 80 km entry perigee; recovery is a separate six-hour abstraction. An early window can support a successful return when actual product and support requirements are met, but cannot satisfy the separate 72-hour orbital-duration requirement.

## 2026-11-15: Sun Sentinel

`SUN_SENTINEL`, "Sun Sentinel: Watch the Side of the Sun That Earth Cannot See", is the first mission at the Sun, offered at Aspiring and Expert.

- SmallSat in a near-circular solar orbit at 0.96 AU, 120° ahead of Earth, as NASA's STEREO-A (orbit preset `SUN_AHEAD`, ride `RIDE_SOLAR_ORBIT`).
- Return 6,000 MB of solar maps through the Deep Space Network within 30 days.
- The craft is never in shadow, solar input follows 1/r², contact is a line of sight to Earth, and commands take light time. The radiation dose is an assumed value and is labelled as such.
- A second mission through a 0.3 AU perihelion was designed but not shipped: no existing part can reject the heat, so it cannot be certified honestly.

Engine details: [major improvements recap](./recaps/MAJOR_IMPROVEMENTS.md) §4.6.
