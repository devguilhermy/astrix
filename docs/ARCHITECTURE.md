# System architecture

ASTRIX is a turn-based space exploration and learning game. Static play needs no server; optional trusted-LAN play uses one Bun authority. Core owns physical outcomes. This is a reduced teaching model, not flight-qualified software. See [Missions](./MISSIONS.md), [Simulation](./SIMULATION.md), [Resources](./RESOURCES.md), [Technical models](./TECHNICAL_MODELS.md), [Science UX](./SCIENCE_UX.md), [Multiplayer](./MULTIPLAYER.md) and [Verification](./VERIFICATION.md).

## Packages and authority

| Layer | Responsibility | Must not do |
|---|---|---|
| `packages/core` | Bounded quick design, certification, turn decisions/resolution, physical resources, objectives and debrief | Trust a renderer, title or compatibility check as evidence of success |
| `packages/session` | Authenticated actors, attempts, turn commits/proposals, stale checks, idempotency, replay and projections | Advance a turn from elapsed wall time |
| `apps/web` | Landing, rendered docs, mission board, preparation, preview, choices, receipts, per-visit journal, attempt export/import and optional scientific tools | Change the real flight when selecting or previewing a choice; store attempts in the browser |
| `apps/host` | Production HTTP/WebSocket serving, device admission, serialized authoritative transactions and reconnect | Start a second browser simulation or catch up mission time after sleep |
| `packages/data` | Committed scientific snapshots, citations, assumptions and imagery provenance | Present historical inputs as live NASA telemetry |

The core turn API is declared in `gameplayTypes.ts`: `QuickDesignConfig`, `QuickDesignBrief`, `ReadinessCertificate`, `TurnGameState`, `TurnDecision`, `TurnPlan`, `TurnReceipt`, `TurnCommitRequest` and `TurnDebrief`. Definitions and catalogue parts remain internal content structures; the player does not need an unrestricted engineering editor.

`mission/` owns closed definition validation/digests and built-in content. `flight/` owns staged finite-thrust ascent, conic propagation, the reduced lunar model and maneuver planning. `sim/` integrates commands, environment, inventories, objective evidence and terminal events. `interop/` parses inert initial states and sampled trajectories; it does not execute uploaded GMAT scripts.

## Design and readiness

A quick configuration identifies the mission, level, ambition, kit, approach and reproducible seed. `quickDesignBrief` resolves actual hardware, objective targets, budget/fit and deadline. `certifyQuickDesign` runs a bounded reference policy through the same turn engine used in play. Static compatibility is not solvability. A successful witness establishes a nominal feasible path, not guaranteed player success or a probability estimate.

Configuration identity and the certificate's rules, flight-model and policy versions qualify the result. Changing a target, loadout, approach or seed invalidates the old proof. The UI must discard stale worker responses rather than attaching them to a newer draft. Failed or exhausted search is reported as no viable plan found, not mathematical impossibility.

## One decision, one commit

`turnDecision` derives allowed plans from the committed state. `previewTurn` resolves against an immutable candidate. `commitTurn` takes decision ID, base revision, plan ID and an idempotency key. A result is either a complete state plus receipt or a refusal retaining the previous state; partial flight state is never published.

The session transports:

- `START_GAME {config}`: prepare an independently checked attempt.
- `COMMIT_TURN {decisionId, turnRevision, planId}`: host commitment to one current plan.
- `PROPOSE_TURN` with the same fields: an assigned controller's suggestion, without advancing physics.
- `RETRY_GAME {checkpointRevision?}`: a new attempt with the same conditions; Aspiring checkpoint replay is explicitly assisted.

A LAN envelope also carries device-correlated intent ID, epoch, attempt and roster revision. Identical retries return the saved result; changed payloads cannot reuse an ID. Stale decisions cannot advance again. A resolved commit clears old proposals. Committed core state is mirrored into the scientific-tool projections, not independently simulated there.

Legacy low-level simulation/definition APIs remain available to scientific/content tests and tools. They cannot issue manual commands, resume, skip, warp or advance an active turn game. `tickSession` and `advanceSession` return an active turn game unchanged. The production host schedules networking maintenance only. Thinking, Help, browser backgrounding and disconnects consume no mission time.

## LAN boundary

Protocol **4** (adds the party size, `seats`, to snapshots and the `players` admin action) is incompatible with earlier clients. The production manifest binds protocol, rules and flight-model versions. Authenticated devices submit bounded typed messages; the parser rejects unknown fields, malformed numbers, arbitrary simulation writes and trusted-only local restore requests. The room queue serializes accepted requests.

The host commits; phones can discuss and propose. No unanimous Ready or discipline signoff is required for each decision. Role assignments still identify who proposes and who owns a device. Host capability is established through a loopback-only bootstrap, not by visiting `/host`.

Public snapshots exclude credentials, private result ledgers, quotes and replay logs. They include the committed game needed for local read-only preview and the current proposals. Other telemetry history projections are bounded; full history uses attempt-qualified cursors. Result ledgers have finite room-lifetime caps and refuse further work when exhausted rather than silently forgetting idempotency.

HTTP/WSS boundaries, admission, expiry and reconnect details are in [Multiplayer](./MULTIPLAYER.md). The supported transport is plaintext HTTP/WebSocket on a trusted isolated LAN, not a public internet service. The Bun room is in memory: a browser refresh can reconnect, but a stopped process cannot be recovered, and browsers do not store attempts. Admission stays open during the mission up to the host's player count.

## Saves, replay and identity

The browser does not store attempts. `ui/play/persistence.ts` keeps the discovery journal in memory for the page visit, exports and imports a versioned attempt file, and purges the retired auto-save slots (`astrix.play.save.v1.*`) on load. An imported file is version-qualified and validated (format, versions, identity, deterministic history) before play. Older saved definitions are distinct from active flights, stay exportable and must not be silently relabelled under new rules. Returning to the landing unmounts the simulator and replaces the local session (`resetLocalSession`), so mission settings and status start fresh.

Session replay records accepted intents and explicit authority checkpoints. A turn's simulation time is an outcome of its plan, not an input from the client's clock. Definition digest, rules/model versions, configuration/seed and assistance qualify comparisons. A retry is a separate attempt; journal discoveries are simulated achievements, not newly acquired NASA observations.

## Scientific tools and limits

GMAT tools are optional and do not gate ordinary play; they live at `<base>gmat` ([GMAT support](./GMAT_SUPPORT.md)). Supported initial-state import/export and sampled-trajectory viewing preserve explicit body, frame, epoch and unit restrictions. On that page the shared Canvas draws the imported or exported subject (`three/gmat/`) in place of the mission world. Earth/Mars interchange is separate from the lunar game's reduced model; unsupported lunar interchange is refused. Imported trajectory samples contain no resource or objective history and cannot become scored success.

The quiz at `<base>quiz` (`ui/quiz/`) is a standalone page like the landing and the rendered docs. Its question bank is static bilingual data; it reads no mission state and writes nothing.

The rendered docs at `<base>science` (`ui/docs/DocsPage.tsx`, lazy-loaded) fetch the shipped `docs/*.md` and render them with `react-markdown` and GFM; no raw HTML from Markdown is executed. Route parsing is `readScienceDoc` in `ui/recovery/routes.ts`; the Bun host serves `/science` and `/science/*` as the app. Public pages share `ui/landing/SiteHeader.tsx` and the simulator's header styles (`ui/header/header.css`).

Three-dimensional scenes and playback illustrate core-derived geometry. A camera cannot change orbit, consume fuel, acquire science or establish lunar capture. The interface must remain playable without scene interaction. Numerical agreement with independent GMAT conic cases does not validate atmospheric ascent, full lunar targeting, resources, human usability or a real mission.
