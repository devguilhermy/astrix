# System architecture

ASTRIX is a static, local shared-screen mission-design game. Core owns mission rules and simulation; it is an educational reduced model, not flight-qualified software. [Missions](./MISSIONS.md), [Simulation](./SIMULATION.md), [Resources](./RESOURCES.md), [Technical models](./TECHNICAL_MODELS.md) and [Science UX](./SCIENCE_UX.md) explain the respective boundaries. [Verification](./VERIFICATION.md) records observed checks; this document does not assert a new test or browser run.

## Packages and authority

- `packages/core/src/contracts.ts`, `catalog.ts`, `models.ts`, `design.ts`: typed identity, paid hardware, quotes, planning and launch checks. `physics.ts` supplies the shared two-body geometry. `journey.ts` provides journey evidence and gates.
- `packages/core/src/sim/`: versioned flight snapshots, command transport, environment, stepping, crew support, telemetry, history and terminal evidence. `score.ts` scores the frozen flown design.
- `packages/core/src/interop/`: inert GMAT initial-state import/export and sampled-trajectory parsing; viewer data is separate from a game flight and cannot establish resource or score state.
- `packages/data/`: local snapshots, source records, science topics and explicit context bindings. Core depends on data, not vice versa.
- `apps/web/`: local setup, shared-screen roles, pause/decision authority, seven-stage journey and presentation. One persistent R3F Canvas renders model-derived scene data; visualization is not a second physics authority.

## Identity, workflow and transactions

Rules version 4 requires `Design.levelId` and `Telemetry.levelId`: `ASPIRING` or `EXPERT`. Attitude is a rate-limited body-to-MJ2000Eq quaternion (+X solar-panel normal, +Z instrument/antenna boresight), not a rigid-body torque model. Presentation depth (`GUIDED`/`DETAILED`) stays independent; its initial value follows level unless explicitly chosen. Aspiring offers spotlight tours, state-driven guidance and assisted checkpoints; Expert exposes detailed engineering and on-demand teaching. Neither level repairs hardware automatically. Score identity contains scenario, level, rules, seed and assistance; older incomparable bests remain separate.

The journey is `NEED_GOALS → CONCEPT → REQUIREMENTS → DESIGN → BUILD_VERIFY → IMPLEMENT → REVIEW`. Earlier stages are editable before launch; final Review requires a terminal flight. A brief and segment choices are player decisions, while modeled requirement checks and readiness are computed evidence. A real quote supplies before/after budgets for a trade. Freeze and verification are bound to a design revision; launch explicitly rechecks current readiness and signoffs. A stale proposal cannot overwrite a newer design. Viewing, explaining, acknowledging, or completing readiness does not launch or resume a flight.

The HUD presents five chapters over these seven gates. CAPCOM resolves requirements, cues and journey blockers into a next action; Show me expands and highlights its existing control but never completes work. Quotes, approvals, freeze and launch remain explicit core/store transactions.

The four concurrent disciplines are Science, Spacecraft, Launch/Orbit and Ground/Comms. Solo uses actor `ALL`; shared-screen players are local, not authenticated remote identities. Commands retain issuing actor separately from role ownership. Roster changes must preserve already-issued actor snapshots and invalidate affected approvals. Design and flight state are immutable across public transactions.

## Flight and rendering

`createSim(design, seed)` freezes an eligible design. `stepSim` integrates on a fixed grid and scheduled deadlines; `issueCommand` distinguishes acceptance, queued transport and execution. Ground requests need contact and may experience light time. Onboard procedures operate without radio but consume modeled time; confirmed `endMission` is an immediate session action. `telemetry`, `nextBoundary`, `history`, `historyInfo` and `attemptAudit` expose core quantities and qualified forecasts. A practice rewind restores a coherent prior snapshot and records assistance; it does not repair the current state.

The canonical orbit stores body, UTC epoch, MJ2000Eq frame, semi-major axis, eccentricity, inclination, RAAN, argument of periapsis and true anomaly. Altitude controls convert into that representation. Game time is relative to the explicit epoch. A sampled external trajectory is a separate visual product; imported initial conditions do not import a GMAT force model or operational plan.

The setup flow prepares the renderer before committing an attempt and retains rollback on cancellation. Once mounted, the simulator and Canvas remain available while Home, windows, explanations or optional tools are shown. A pause reason can be removed without implicitly resuming; camera movement, explanations and display changes never command the spacecraft. Resources and physics originate in core selectors, not React.

`forecastTimeline` samples shared environment geometry without mutating flight state. The read-only dry run calls `forecastMission` in a cancellable Web Worker, with ordinary transported commands and a disclosed deterministic policy. Results are local presentation, never a flown score. Timeline and dry-run horizons are bounded; forecasts are not guarantees.

Manual attitude targets are serializable `ATTITUDE_TARGET` commands: ground transport for uncrewed missions, onboard for crew. The UI throttles gestures; the store rejects manual inputs above 10× warp. Only unsent targets from the same actor/gesture coalesce; transmitted targets cannot be recalled. Renderers consume pose through `useMissionPose()`; camera/pilot mode, panel geometry, quotes, tours and highlights remain device-local.

The static bootstrap has its own styled loading/failure surface before React. Root and workspace error boundaries preserve diagnostics; workspace failure pauses flight without destroying the Canvas, and retry never resumes time. Unknown addresses show a localized 404 and add a blocking route pause. Returning Home retains the mounted attempt. A standalone `404.html` is also built for static-host error routing.

## Persistence and limitations

The active attempt, commands, history, checkpoints and role assignments are session state; browser reload is not a flight restore. Settings, per-tour completion (`astrix.tours.v1`) and rules-versioned best scores are separate from flight snapshots. Historical scientific snapshots are local; external source links require connectivity. No account, online room, real agency approval, development calendar, medical model, live data feed, or full GMAT dynamics are implied. Sources, authored assumptions and numerical limits are described in the linked pages. Multiplayer is a separate future plan, not a redesign dependency.
