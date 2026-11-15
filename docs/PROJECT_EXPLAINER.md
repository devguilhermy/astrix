# ASTRIX11: project explainer for the team

[Versão em português](./PROJECT_EXPLAINER.pt-BR.md)

This is the document to read before you pitch, demo or answer questions about ASTRIX11. It says what the project is, how to show it, how it works, what comes from NASA, and what we must not claim. Everything here is taken from the code and the docs in this repository; links to the detailed sources are at the end.

## 1. The pitch

**One sentence.** ASTRIX11 is a turn-based game in which you design a small space mission, fly it one decision at a time, and see exactly why it succeeded or failed.

**Thirty seconds.** Real missions fail on trade-offs: mass against power, data against contact time, ambition against budget. ASTRIX11 lets anyone feel those trade-offs. You pick a goal at the Sun, Earth, the Moon or Mars, choose a spacecraft kit and an approach, and then play turns such as Observe, Transmit and Recharge. A physics and resource engine resolves each turn, and the 3D scene shows what happened: the picture you took, the signal reaching the ground station, the battery you drained. At the end you get a score with its reasons, and you can retry the same conditions with a different decision.

**The challenge we answer.** NASA Space Apps 2026, [Space Mission Design Game](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/): build a game that teaches how a mission goes from an objective to a spacecraft, a launch and orbit, operations and an evaluation, for players with different levels of knowledge, solo or in a team of up to four.

## 2. What the player does

1. **Explore.** A solar system with planet sizes to scale. Click a body to read NASA facts about it, or board a ship and fly around.
2. **Choose a mission.** Thirteen missions on a board, grouped by destination.
3. **Prepare.** Three choices: ambition (how much to attempt), mission kit (which hardware) and approach (cautious, balanced or fast). The panel shows the target, cost, mass and deadline that result.
4. **Check.** The game flies the design with a reference strategy before you start. "Ready" means a successful path exists. It does not mean every choice will work.
5. **Play turns.** Select a plan and read its preview: time, energy, data and what happens next. Nothing happens until you commit. Thinking costs no mission time.
6. **See the consequence.** The scene replays the turn. An observation shows a frame of what the instrument looked at; a transmission shows waves travelling to the station; a launch rises from the pad.
7. **Read the report.** A score from 0 to 100 with stars, the five parts it is made of, the objectives, and a timeline of every turn. Retry with the same conditions to compare.

There are two levels, Aspiring and Expert. Both use the same loop; Expert has tighter margins and fewer hints. The game is in English and Brazilian Portuguese.

## 3. What to say makes it different

- **Every outcome is computed.** One engine (`packages/core`) decides physics, resources, objectives and score. The interface and the 3D scene only display what the engine returned. Nothing on screen can make a mission succeed.
- **Consequences are visible in space.** The 3D scene never leaves the screen. Panels sit over it.
- **Preview, then commit.** Players see the expected cost of a plan before they spend it, then compare it with the measured result.
- **Honest about what is simulated.** A picture after an observation is built from a NASA archive map at the spacecraft's ground track and is always captioned as a simulated frame, not a new observation.
- **Real NASA measurements where we have them.** The radiation mission replays dose rates measured on the International Space Station during the May 2024 solar storm. The crew mission uses NASA's life-support baseline values.
- **Works offline.** Solo play is a static website: no login, no server, no request to NASA at run time.
- **Team play on one network.** One host screen and up to three phones. Phones propose a plan; the host commits it.

## 4. Demo script

About three minutes. Use a desktop browser at 1920×1080. Run `bun run dev` beforehand and keep the page open.

| Step | Do | Say |
|---|---|---|
| 1 | Landing page, "Enter the simulator" | "This is ASTRIX11. You start by exploring." |
| 2 | Explore: click Saturn, then the Sun | "Sizes are to scale with the Sun; distances are compressed so you can see everything. The facts come from NASA's planetary fact sheets, bundled with the game." |
| 3 | "Board the ship", drag to steer, hold W to thrust, then "Leave ship" | "You can fly through it. This part is for curiosity and does not affect a mission." |
| 4 | Mission board: point at the Sun, Earth, Moon and Mars tabs and the level toggle | "Thirteen missions, four destinations, two levels." |
| 5 | Open "Earth Orbit: Take a Picture and Send It Home" | "The simplest mission: take a picture and get it home." |
| 6 | Preparation: change the kit once, watch the brief change, wait for "Ready" | "Each choice changes cost, mass and margins. Before we fly, the game proves that a successful path exists." |
| 7 | Select Observe, read the preview, commit | "I choose a plan, I see what it will cost, and only then I commit." |
| 8 | Let the replay run; point at the frame and its caption | "The engine resolved the turn. This is what the camera looked at, simulated from NASA's Blue Marble map." |
| 9 | Select Transmit, commit | "Data on board is worth nothing until it reaches the ground. Watch the signal." |
| 10 | Finish; show the report: score, parts, timeline | "The score is explained. I can click any turn to see what it changed, and retry to do better." |

If you have one more minute, open **Sun Sentinel** on the Sun tab (a spacecraft that watches the side of the Sun Earth cannot see, as NASA's STEREO-A does) or **Radiation Survey** (the mission that replays ISS measurements).

If something goes wrong: reload the page and choose "Resume saved mission" on the board. The game saves after every committed turn.

## 5. The missions

| Destination | Missions |
|---|---|
| Earth (9) | Take a Picture and Send It Home; Suborbital Rocket; Reach and Hold a Safe Orbit; Imaging Satellite (First Light); Radiation Survey (Storm Watch); Crewed Earth Orbit (Crew Pathfinder); Raise and Circularize an Orbit; Deorbit; Earth Escape |
| Moon (2) | Lunar Flyby; Lunar Orbiter: launch, capture and return map data |
| Mars (1) | Mars Mapping (Red Relay): operate an orbiter and return data |
| Sun (1) | Sun Sentinel: watch the far side of the Sun |

The short ones (one to six turns) teach one idea each: reaching orbit, changing an orbit, returning data. The long ones (eight to twenty-four turns) combine them.

## 6. How it works

The repository has five parts.

| Part | What it does |
|---|---|
| `packages/core` | The engine. Validates a design, computes mass, power, cost and data budgets, flies the trajectory, tracks energy, storage, contact with ground stations and eclipses, records objective evidence and computes the score. |
| `packages/data` | NASA data and constants saved in the repository, each with its source. |
| `packages/session` | Turns as transactions: who may propose, who may commit, and protection against a turn being applied twice. Used the same way solo and on a network. |
| `apps/web` | The game in the browser: React for the panels, three.js for the scene. It sends decisions to the session and draws the result. |
| `apps/host` | An optional small server for team play on a local network. |

A turn goes like this. The player selects a plan. The engine runs it in a background worker and returns a preview. On commit, the session passes the plan to the engine, which advances the simulation until the next point where a decision is needed and returns a receipt: time passed, resources used, progress made, anything that interrupted the plan. The interface shows the receipt, and the scene replays the recorded positions between the two decision points.

The score has five parts with fixed weights: objectives 45 %, health 20 %, budget efficiency 15 %, margins 10 % and teamwork 10 %. A failed or unfinished mission cannot score above 19.

Built with TypeScript, Bun, React, three.js (through react-three-fiber) and Vite.

## 7. What comes from NASA

| Resource | How we use it |
|---|---|
| NSSDCA planetary and Sun fact sheets | Body sizes, gravity and orbit values in the engine; the fact panel in Explore |
| OSDR RadLab | ISS dose-rate measurements for 10–11 May 2024, reduced to 48 hourly values that the radiation mission replays |
| CCMC DONKI | Records of the May 2024 geomagnetic storm, shown as context for that mission |
| Life Support Baseline Values and Assumptions | Oxygen, water, food and CO₂ per person per day in the crew mission |
| Blue Marble, the LRO Moon map, the STEREO + SDO Sun map and other mission maps | Planet textures and the simulated observation frames |
| CubeSat 101, Design and Develop Science Missions, Concept Maturity Levels, Goddard Mission Design Lab | The mission-design method the game follows and the vocabulary it teaches |
| GMAT (General Mission Analysis Tool) | Used separately to check our orbit results; the game can also import and display GMAT trajectories at `/gmat` |
| Small Spacecraft Technology report | Background for explaining thermal, power, pointing and radio trade-offs |

All of it is stored in the repository. The game never contacts NASA while you play. Sources and licences are in `CREDITS.md` and in the [documentation index](./INDEX.md#nasa-resources-what-we-use-and-how).

## 8. What we must not claim

Say these plainly if asked. They make the project more credible, not less.

- **It is a teaching simulation, not flight software.** Ascent uses a reduced thrust and drag model. Earth and Moon flight uses two-body orbits joined together. Mars uses an analytical transfer. There are no detailed perturbations and no real mission ephemerides.
- **Parts are fictional.** They sit in realistic ranges but are not real products.
- **Pictures are simulated frames** from archive maps. They are not new observations and the game says so on each one.
- **The radiation data is real, the damage model is not calibrated.** The ISS measurements drive the exercise; they are not a forecast or a medical dose model.
- **The Sun mission's radiation dose is an assumed value**, labelled as such.
- **NASA has not reviewed or endorsed the game.** Using GMAT as a reference is not a GMAT validation.
- **Team play has been tested with automated clients on a desktop**, not yet rehearsed with real phones.
- **We have not run a study with players**, so do not claim measured learning gains.

## 9. Numbers you can quote

| | |
|---|---|
| Missions | 13, at both levels |
| Destinations | 4: Sun, Earth, Moon, Mars |
| Bodies in Explore | 10, sizes to scale |
| Levels | 2: Aspiring and Expert |
| Languages | 2: English and Brazilian Portuguese |
| Players | 1 to 4 (host screen plus three phones) |
| Resources tracked | 7: mass, energy, budget, data, radio, time, crew |
| Automated tests | About 580; check [VERIFICATION.md](./VERIFICATION.md) for the latest run before quoting a pass count |
| Servers needed for solo play | None |

## 10. Questions you may get

**Is the physics real?** The laws are real and simplified: the rocket equation for burns, Kepler orbits, eclipse and line-of-sight geometry for power and contact, energy and data bookkeeping. The simplifications are listed in section 8 and in [TECHNICAL_MODELS.md](./TECHNICAL_MODELS.md).

**How do you know the orbits are right?** We compared reference cases with NASA's GMAT, run separately. The comparison and its limits are in [research/gmat-validation.md](./research/gmat-validation.md).

**Why turns instead of real time?** Mission operations are decisions separated by long waits. Turns let a player think without a clock, and let us show the cost of each decision on its own.

**What does a player learn?** That a mission is a chain: the objective sets the instrument, the instrument sets power and data, those set the spacecraft and the orbit, and operations spend what the design provided. The report shows which link broke.

**How is this for different knowledge levels?** Aspiring gives hints and a recommended plan; Expert removes them and tightens margins. Neither requires typing orbital elements.

**How does team play work?** One computer runs the host and shows the scene. Up to three phones join with a QR code. Each phone can propose a plan; only the host commits, so a turn can never be applied twice.

**Can I cheat, or get a lucky result?** No. The same design and the same decisions always give the same result, and the interface cannot change an outcome.

**What would you do next?** More destinations (the design notes cover Venus, asteroids and a space telescope), a mission through a close solar pass (it needs a heat-shield part), and a rehearsal of team play on real phones.

## 11. Where to read more

- [README](../README.md): how to run it.
- [Documentation index](./INDEX.md): the full system overview and the NASA resource tables.
- [Challenge acceptance](./CHALLENGE_ACCEPTANCE.md): each objective of the challenge and how the game meets it.
- [Missions](./MISSIONS.md) and [resources](./RESOURCES.md): what each mission asks and what is tracked.
- [Major improvements recap](./recaps/MAJOR_IMPROVEMENTS.md): the latest round of work, with what was and was not checked.
- [Verification](./VERIFICATION.md): test and browser evidence.

## 12. Words the game uses

| Word | Meaning |
|---|---|
| Turn | One committed decision and everything the engine resolves until the next decision |
| Plan | An action offered for a turn: Launch, Maneuver, Coast, Observe, Transmit, Recharge, Recover, Capture, Return, Finish or Abort |
| Preview | The engine's forecast for a plan, shown before committing |
| Receipt | The measured result of a committed turn |
| Kit | The set of hardware installed for a mission |
| Ready | The game found a successful path for this design using a reference strategy |
| Contact | A period when the spacecraft can see a ground station and send data |
| Margin | How much of a resource is left over what the plan needs |
| Simulated frame | A picture built from a NASA archive map at the spacecraft's position; not a new observation |
