# ASTRIX Mission Studio

NASA Space Apps 2026 Space Mission Design Game: design a spacecraft, balance linked resource budgets, fly it, and understand the outcome.

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

For trusted-LAN room groundwork, prepare dependencies and the production build online, then disconnect internet while keeping LAN active:

```sh
bun run host
# Multiple private interfaces: choose one printed by the CLI.
bun run host --bind 192.168.1.20 --port 3000
```

Open the loopback control URL printed by Bun on the host computer. Its lobby supplies locally encoded QR/manual joining, host approval, role assignment and reconnect for three phones plus the host display. HTTP is plaintext: use an isolated trusted LAN and no sensitive names/data. The Bun process owns the in-memory mission; closing it loses the room. Dedicated phone design/flight consoles are not included in this groundwork. See [LAN runbook and rehearsal steps](docs/MULTIPLAYER.md); real-device behavior is not claimed verified.

## Play

Four missions: First Light (Earth imaging), Storm Watch (radiation measurements), Red Relay (Mars mapping), and Crew Pathfinder (four virtual crew in Earth orbit).

Choose a mission and level using the setup cards; the expanded team section optionally divides responsibilities in player columns. Start with the local-play card or open the separate LAN lobby. The journey appears as **Briefing → Build → Test & launch → Fly → Debrief**, backed by seven core stages and their gates. Bottom **Mission control** combines the next action/Continue, Requirements, Spacecraft slots, Checklist, Flight options, chapter/substep navigation and panel buttons. **Show me** reveals the real control. Starting design does not launch, and time advances only when explicitly requested.

**Aspiring** offers spotlight tours, short primary copy, self-paced advances and assisted practice checkpoints. **Expert** uses the same HUD with detailed engineering and on-demand explanations. Guided / Detailed remains independently changeable in Settings. Preview changes on the spacecraft and seven-resource grid before installing them; freeze, verify and approve the actual revision before launch. **Dry run** forecasts the design in a background worker without changing or scoring the flight.

Closed tools consume no scene area; the bottom controller's panel buttons reopen them. Expanded desktop tools retain draggable/resizable headers. Compact screens use one adjustable bottom sheet; short/high-zoom views use a reading layout. Help replays the control-by-control tours and exposes model limits.

Click any component on the spacecraft (or a bottom Spacecraft slot) to open its **Component** panel, anchored beside that part and following it as you turn the view: catalogue specifications, the simulator's constraints and, in flight, live readings from the simulation. Keyboard users reach the same panel from **Spacecraft slots → Components** while building and from **As flown** in flight. Inspecting never changes the design or the flight.

Explain/Entenda buttons open short science explanations, optional deeper material and evidence/assumptions. Static reading pauses operation; optional LAN explanations retain a frozen snapshot without stopping the shared room. Closing an explanation never automatically resumes a paused mission.

Flight options embed the timeline, command hotbar and warp controls; next sunlight/shadow/contact edge, T+ time, advance and next contact remain visible with the tray closed. Decision overlays remain independent. `1/2/3` select Sun/Target/Earth hold, `D` requests downlink, `S` safe mode, `G` deployment and `P` pilot mode. In pilot mode use drag or `WASD/QE` to request attitude targets (touch pad available); manual steering is limited to 10× warp. Uncrewed steering waits for radio contact and Mars light time; crew steering is onboard. Camera controls remain independent of commands.

Solo covers all roles. Shared-screen play divides responsibilities among up to four local players, with role ownership and design sign-offs. A separately launched local Bun host adds trusted-LAN admission and synchronization groundwork, not internet matchmaking.

### Startup and recovery

The pre-JavaScript startup screen uses the HUD theme and bilingual status text. A failed module download offers reload and documentation instead of an indefinite loading message. Root and layout error boundaries show styled diagnostics; layout retry retains the attempt and never resumes the clock automatically.

Unknown app addresses show a keyboard-focused, localized 404. On the dev server use `http://localhost:5173/#setup/mission` (or the port printed by Vite), not a `/@fs/...` filesystem URL. Production includes a self-contained `404.html`; configure the static host to serve it with HTTP 404 for missing paths. Its Home link targets the site root (`/#home`).

## Scientific scope

Two-body orbital propagation, cylindrical eclipse, ground-station geometry, idealized Earth–Mars transfer/capture and the rocket equation. Technical systems use bounded reduced models with disclosed coefficients: see [model parameters and reference cases](docs/TECHNICAL_MODELS.md). No atmospheric drag, full radiation transport, three-body dynamics, calibrated fault probabilities or flight qualification. Launch immersion is a skippable schematic storyboard, not ascent physics. Safe mode is not radiation shielding. Replayed ISS measurements are not a calibrated radiation map of all possible player orbits.

Start with the [canonical documentation index](docs/INDEX.md) or [system architecture](docs/ARCHITECTURE.md). Component references cover [missions](docs/MISSIONS.md), [resources and evidence](docs/RESOURCES.md), [simulation](docs/SIMULATION.md), [rendering](docs/RENDERIZATION.md), [layouts](docs/LAYOUTS.md) and [science UX](docs/SCIENCE_UX.md). The [implementation plan](docs/GAME_IMPLEMENTATION_PLAN.md) preserves design history; [verification](docs/VERIFICATION.md) records observed checks and the [changelog](docs/CHANGELOG.md) summarizes shipped changes.

## Data and reuse

NASA sources, USGS Astrogeology products and the earlier Void Protocol components are attributed in `CREDITS.md`. The existing `nasa.json` and `nasa-visualizer.html` are retained. Data snapshots record source URLs and retrieval dates; nothing is represented as live NASA telemetry.

## AI disclosure

AI coding assistance was used to research references, prepare the game design, implement software, author and translate explanatory content, and run verification. Human review of scientific wording, Portuguese translations and submission eligibility remains necessary. Procedural spacecraft geometry and diagrams are generated by application code; no AI-generated image/video assets are bundled.

## Licence

Apache-2.0. See `LICENSE` and `CREDITS.md` for component attribution and third-party licences. Void Protocol reuse was explicitly authorized by its owner; that does not relicense the entire Void Protocol repository.
