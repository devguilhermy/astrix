# Space Mission Design Game

- **Page:** <https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/> (Details, [Resources](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources), Teams)
- **Captured:** 2026-11-14, from the rendered page
- **Difficulty:** Intermediate; Beginner/Youth
- **Subjects:** Games

## The ask

Build an interactive game in which participants **design, manage and simulate a complete space mission**, from concept to operation. Players:

- define a mission objective and requirements,
- design a spacecraft and pick science instruments,
- choose a launch vehicle and orbit,
- manage **budget, mass, power, communications, data and mission lifetime**.

They should see how each decision affects the rest of the mission. Play can be **individual or in teams of up to four**, with each person contributing to the strategy.

Background, in the page's words: a better instrument can raise science value while also raising "mass, power consumption, data volume, and cost". Existing tools teach orbital mechanics, spacecraft design or launches *separately*. Few show how they interact as one system.

A strong solution, per the page, includes:

- a functional game with a clear UI,
- a mission configuration system,
- resource management,
- collaboration or multiplayer for up to 4 players,
- a mission simulation and evaluation system that rewards good engineering, efficient resource use, collaboration and achieved objectives.

## Considerations (optional, per the page)

| Theme | What the page says |
|---|---|
| Game design | Accessible to different knowledge levels; single player and teams of up to 4 with roles (planning, spacecraft design, science, comms, resources). Clear objectives and feedback on *why* a mission succeeded or failed. Let players modify and re-simulate. Scoring for success, science value, efficient resource use and decisions. Difficulty levels, mission types, scenarios. |
| Mission design | Start from an objective. Every major decision has a consequence (more instruments → more mass, power, cost and data). Often no single correct answer. Realistic limits on budget, mass, power, communications and lifetime. |
| Spacecraft & payload | Structure, power, batteries, comms, onboard computer, attitude control, instruments. Instruments differ in mass, power, cost, data and science value. Simple vs advanced parts by difficulty. |
| Orbit & launch | Orbit options with their basic characteristics (coverage, observation opportunities, communications, lifetime). Launch vehicles differ in payload capacity, cost and reachable orbits; check that mass and orbit fit the chosen vehicle. |
| Resources to display | Mass, power, budget, data, communications, time. |
| Collaboration | Up to 4 players, different roles, negotiation between competing priorities; the result depends on coordination. |
| Education | Explain simply; teach through the game (tutorials, indicators); say *why* a decision affects performance, not just right or wrong. |
| Suggested features | Multiple scenarios, random events, difficulty levels, realistic or simplified models, interactive spacecraft visualisation, live resource dashboards, leaderboards, end-of-run mission reports, co-op for 4, competitive teams, sandbox mode, post-mission analysis. |

## Resources tab (8 entries; all reachable on 2026-11-14)

| # | Resource | Type | What it gives the game |
|---|---|---|---|
| 1 | [Design and Develop Science Missions](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf?emrc=a454cf) | NASA systems-engineering webinar PDF (26 Mar 2025, "Access to Space for All" series) | The four mission segments (**launch, space, ground, user**) and the flow *Identify need & goals → define concept → requirements → design → build & verify → implement*. Worked example: the BioNutrients missions. Good backbone for the game's phases. |
| 2 | [GMAT](https://software.nasa.gov/software/GSC-19468-1) | NASA open-source desktop software | High-fidelity orbit and trajectory analysis. Too heavy to embed; useful for producing a small table of real orbit numbers ahead of time. |
| 3 | [Concept Maturity Levels (CMLs)](https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299) | JPL paper | CML 1 (idea) → feasibility → trade studies → point design. Maps directly onto game levels. |
| 4 | [Mission Design Lab (MDL)](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/) | NASA Goddard facility | Study levels: office hours → concept development → trade studies → point design. Covers the disciplines power, propulsion, thermal, structures, avionics, comms, attitude control, software, reliability, cost and risk, which give the **4 player roles**. |
| 5 | [NASA Mission Viz](https://nasa.github.io/mission-viz/) | Web demos (X3DOM) + tutorials | Orrery, Earth–Moon transfer demo, "how to design a 3D elliptical orbit" with a propagator. Reference for an orbit view. |
| 6 | [A Learning Game About Telescopes](https://science.nasa.gov/mission/webb/game-build-it-yourself/) | NASA Webb game | A closely related precedent: pick science goals → instruments and wavelengths (choices constrained) → launch → results → "real NASA missions like yours". |
| 7 | [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf) | NASA CSLI guide | **Real size and mass limits:** 1U = 10×10×11 cm, < 1.33 kg; 1.5U < 2.00 kg; 2U < 2.66 kg; 3U = 10×10×34 cm, < 4.00 kg; larger 6U and 12U formats exist. Also dispensers, launch manifesting and deorbit rules. |
| 8 | [CSA Digital Games and Activities](https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp) | Canadian Space Agency | Precedents: *Mission: Astronaut*, *RADARSAT Constellation*, and the *OSIRIS-REx* sample-site game on Bennu. The page timed out for `curl` but rendered in a browser. |

**What these resources lack:** unlike the junior trainer, none of them is a live data API. Real numbers have to come from these documents (CubeSat mass classes, mission segments, CML stages) or from extra sourced material such as launch-vehicle capacities. Every gameplay number must be either cited or labelled as a game assumption.

## Game sketch

A **CubeSat mission studio**: 1–4 players, each with a role (Science, Spacecraft, Launch & Orbit, Ground & Comms).

1. **Need & goal** (CML 1). Draw a science goal card, e.g. "map Mars's surface heat" or "watch the Sun's storms".
2. **Concept** (CML 2–3). Pick a CubeSat size. The real mass limit from CubeSat 101 is a hard cap, and the size sets volume slots for parts.
3. **Design** (CML 4). Add instruments, battery, solar panels, radio and computer. Live budgets show mass, power, cost and data. A part that doesn't fit is refused with a reason.
4. **Launch & orbit.** The chosen orbit changes coverage, contact time, radiation and lifetime.
5. **Operate.** A sped-up timeline with random events: solar storm, contact loss, battery wear.
6. **Post-mission report.** A score breakdown, why the mission succeeded or failed, and "real missions like yours". These are drawn from `nasa.json` mission facets, e.g. a thermal-imaging Mars orbiter → *Mars Odyssey* products.
