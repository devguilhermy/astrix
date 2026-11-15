# ASTRIX11

A space exploration and mission turn-based learning game for NASA Space Apps 2026. A persistent 3D space scene stays visible while mission design, decisions and consequences appear in panels. Quickly build a constrained mission, play its turns, and discover why the outcome changed.

## Run

Requires Bun and a current WebGL-capable browser.

```sh
bun install
bun run dev
```

```sh
bun run typecheck
bun test
bun run build
```

The production static site is built into `apps/web/dist`; static solo/shared-screen play needs no backend, login, API key or runtime data API. Repository research tools can contact NASA endpoints; the game imports committed data snapshots.

For trusted-LAN multiplayer, prepare dependencies and the production build online, then disconnect internet while keeping LAN active:

```sh
bun run host
# Multiple private interfaces: choose one printed by the CLI.
bun run host --bind 192.168.1.20 --port 3000
```

Open the loopback control URL printed by Bun on the host computer. Its lobby supplies QR/manual joining, host approval, role assignment and reconnect for three controllers plus the host display. Controllers propose current plans; only the host commits. HTTP is plaintext: use a trusted isolated LAN and no sensitive data. Closing Bun loses its in-memory room. See [LAN runbook and rehearsal steps](docs/MULTIPLAYER.md); desktop automation does not establish physical-phone qualification.

## Play

1. Enter from the landing page. A skippable lesson introduces general mission design before free solar-system exploration. Choose a mission when ready; playable destinations are Earth, Moon and Mars.
2. Set ambition, spacecraft kit and approach in one workspace. Check the real target, allowance, fit and deadline.
3. Wait for the reference-policy feasibility result. A Ready design has a demonstrated nominal path; it does not guarantee every choice succeeds.
4. Play: select a plan, inspect the preview, then commit. A receipt explains elapsed mission time, resources, objective progress and interruptions.
5. Debrief, record simulated discoveries and retry the same conditions with a different decision or design.

**Aspiring** and **Expert** share the same clear loop. Expert adds tighter tradeoffs rather than a full engineering studio. There are no required raw orbital elements, burn vectors, speed controls, signoffs or publishing steps. Reading and thinking never consume a turn.

The mission resource grid stays visible above the panels. Short, dismissible **Quick tour** spotlights explain only the immediate controls; the mission-design lesson can be replayed from the menu. Camera angle and zoom are preserved between decisions. Wider desktop panels retain responsive compact layouts.

Local saves preserve committed decision boundaries. Corrupt/incompatible saves are explained rather than silently reset; old definition files remain exportable user work, not automatically certified missions. Same-condition retries are separate attempts, and Aspiring checkpoint retries are marked assisted.

The original First Light, Storm Watch, Red Relay and Crew Pathfinder challenges remain alongside the short data-return, ascent, orbit, maneuver and lunar lessons. Quick designs use the same physical evidence and constraints as curated offers.

**GMAT tools** remain optional, at `/gmat` and linked from Home and the menu. Import CCSDS OEM, GMAT ReportFiles or one spacecraft's Keplerian initial state from a GMAT script, export initial states, and view them in the 3D scene with playback; NASA GMAT samples are included as examples. Uploaded scripts are inert data, never executed. See [GMAT support](./docs/GMAT_SUPPORT.md). Lunar interchange remains unsupported; imported samples cannot manufacture resources or scored success.

### Startup and recovery

The pre-JavaScript startup screen provides bilingual status and a reload path for module failures. Local save errors and disconnected LAN state must remain visible; neither error recovery nor reconnect commits a turn.

Use the URL printed by Vite, not a `/@fs/...` filesystem URL. Production includes `404.html`; configure a static host to serve it with HTTP 404 for missing paths.

## Scientific scope

Powered staged ascent uses a reduced finite-thrust/drag model; Earth/Moon coast uses patched two-body conics, with a reduced circular lunar ephemeris. Mars retains an analytical cruise/capture model. Resources, eclipse/contact geometry, finite inventories, slew and rocket-equation burns remain physical constraints underneath high-level plans. See [model parameters and reference cases](docs/TECHNICAL_MODELS.md). No full radiation transport, continuous three-body dynamics, real mission ephemeris, calibrated fault probabilities or flight qualification is implied. Safe mode is not shielding; historical ISS measurements are not a radiation map of arbitrary orbits.

Start with the [canonical documentation index](docs/INDEX.md) or [system architecture](docs/ARCHITECTURE.md). Component references cover [missions](docs/MISSIONS.md), [resources and evidence](docs/RESOURCES.md), [simulation](docs/SIMULATION.md), [rendering](docs/RENDERIZATION.md), [layouts](docs/LAYOUTS.md) and [science UX](docs/SCIENCE_UX.md). The [implementation plan](docs/GAME_IMPLEMENTATION_PLAN.md) preserves design history; [verification](docs/VERIFICATION.md) records observed checks and the [changelog](docs/CHANGELOG.md) summarizes shipped changes.

## Data and reuse

NASA sources, USGS Astrogeology products and the earlier Void Protocol components are attributed in `CREDITS.md`. The existing `nasa.json` and `nasa-visualizer.html` are retained. Data snapshots record source URLs and retrieval dates; nothing is represented as live NASA telemetry.

## AI disclosure

AI coding assistance was used to research references, prepare the game design, implement software, author and translate explanatory content, and run verification. Human review of scientific wording, Portuguese translations and submission eligibility remains necessary. Procedural spacecraft geometry and diagrams are generated by application code. The ASTRIX11 logo is user-supplied; no claim about its production method is made.

## Licence

Apache-2.0. See `LICENSE` and `CREDITS.md` for component attribution and third-party licences. Void Protocol reuse was explicitly authorized by its owner; that does not relicense the entire Void Protocol repository.
