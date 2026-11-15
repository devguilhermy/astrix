# LAN multiplayer plan

**Status (2026-11-15):** W1–W4 session/host/pairing groundwork implemented. W5/W6 dedicated phone design and flight consoles remain unimplemented. W7 has a [deployment runbook](../MULTIPLAYER.md); physical-device/network acceptance remains pending. This roadmap is not a claim that its complete multiplayer gameplay has shipped. The [player count and late invitation plan](./PLAYER_COUNT_AND_LATE_INVITE_PLAN.md) supersedes §6 items 6–7 below: the host picks 1–4 players (protocol 4 `seats`), solo-with-phones is gone (1 = host-only solo), and admission stays open during the mission, bounded by host approval, automatic closing when full, 15-minute invitations, rotation and the 12-request pending cap.
**Date:** 2026-11-14.  
**Recommendation:** Add `bun run host`: one local Bun process serves the production web app and owns one in-memory mission room over same-origin WebSockets. The main computer displays the 3D mission; up to three phones join its LAN URL by QR code. The host browser is a privileged client, **not** the simulation process. Keep static solo and shared-screen play available.

Original research below records source inspection and platform documentation on 2026-11-14. Subsequent implementation evidence belongs in [VERIFICATION.md](../VERIFICATION.md), not in the original proposed acceptance cases. Unverified empirical/deployment expectations remain **[INFERENCE]**. Links are relative to this document; VP references always describe the pinned commit.

## 1. Problem, goals and boundaries

Current multiplayer means passing one keyboard between roles. Players should instead operate complementary consoles on their own phones while watching one shared spacecraft and its consequences. The design must support **both mission design and execution**, without introducing another physics implementation or four miniature desktop HUDs.

Goals:

- At most **four connected device sessions total: one host display plus zero to three phones**. Reconnection replaces a connection; it does not consume a fifth slot. No extra spectator slot.
- One canonical mission, roster, design revision, sign-off ledger, simulation clock and audit trail.
- LAN-only operation after dependencies and production assets have been prepared; no account, cloud room, external signaling, STUN/TURN, runtime data API or internet connection required.
- Independent role consoles, clear attribution, truthful queued/executed command feedback, stale-proposal refusal and recoverable phone suspension.
- Preserve solo `ALL`, local hot-seat, existing core rules, assistance/scoring identity, explicit launch/resume and en/pt-BR parity.
- Align with [Guided immersive redesign plan](GUIDED_IMMERSIVE_REDESIGN_PLAN.md), which **takes precedence**: where the plans disagree, the redesign wins and this plan adapts. Host keeps the scene-first HUD, collapse-in-place panels, shared visual resource grid, CAPCOM next-step card and Show-me targets; phones get role consoles built from the same view-model components. See §11.0 for the concrete seams and adaptations.

Non-goals: internet matchmaking, public hosting, accounts, chat moderation infrastructure, host migration, multi-room administration, database persistence, phone 3D scenes, competitive anti-cheat against the host computer, media streaming or voice chat. Losing the Bun process ends this room; durable save/restore is a separate product decision, not an implicit guarantee.

## 2. Current-state findings and migration implications

| Finding with evidence | Consequence |
|---|---|
| [`README.md:20,34`](../../README.md) says the production output is `apps/web/dist`, needs no backend, and is not online multiplayer. Root `package.json:7–18` has dev/build/test scripts; `apps/web/package.json:6–9` runs Vite with `--host 0.0.0.0`. | Vite exposing files to a phone is not multiplayer. Add a separate supported local server entrypoint; retain the static solo artifact. |
| [`contracts.ts:5–6,30,40–42,55–56`](../../packages/core/src/contracts.ts) defines four roles, `ALL`, `Design.revision`, typed `Refusal`/`Quote`, command union and `ActorContext {role, playerId?}`. [`design.ts:104–116`](../../packages/core/src/design.ts) authorizes part edits and computes a revision-incrementing quote. | Shared deterministic rules already express most authorization and transactions. A claimed actor is still untrusted input: the room must authenticate the device and resolve its authorized role before calling core. |
| [`store/index.ts:46–53,69–74`](../../apps/web/src/store/index.ts) stores players as arrays of roles and derives `actor()` from one global active role, or `ALL` whenever there is one player. Names/device identities are absent. Role reassignment clears that role's sign-off and records roster snapshots. Facilitator is an index, rotated locally. | Replace array-index identity with stable player/device IDs in the session layer. Several devices may belong to one solo participant; device count must not silently change solo scoring into four teammates. Local active-role selection cannot authorize remote callers. |
| [`store/index.ts:84–91`](../../apps/web/src/store/index.ts) adds `handoff` on every multi-player role switch; sign-off checks role severity-3 cues and signs all roles for `ALL`, otherwise the active role. | LAN removes the pass-keyboard ceremony, not authorization or role approval. Extract sign-off policy from the browser into a shared session reducer; preserve hot-seat behavior in its own mode. |
| [`store/index.ts:93–103`](../../apps/web/src/store/index.ts) checks `quote.value.next.revision === current.revision + 1`, invalidates `rolesAffectedBy`, computes budgets/cues and records accepted trades. [`design.ts:197–210`](../../packages/core/src/design.ts) computes affected roles. | Good atomic transaction shape, but the browser's quote object must never become network authority. A next-revision check alone does not authenticate a proposed design; server reconstructs the quote from a typed intent and exact current base revision. |
| [`journey.ts:8–17,35–51`](../../packages/core/src/journey.ts) has journey artifacts, requirement ownership, baseline/verification revision gates and terminal-only Review. [`store/index.ts:66–68,104–113`](../../apps/web/src/store/index.ts) freezes/verifies baseline and explicitly checks launch role, revision, readiness and journey blockers before `createSim`. | Carry artifacts and stage transactions into the authority, not only the design and sim. All-Go never launches. Repeated launch requests must not create another attempt. |
| [`contracts.ts:46,55`](../../packages/core/src/contracts.ts), [`sim/commands.ts:107–136,147–166`](../../packages/core/src/sim/commands.ts) preserve actor, owner, issue/transmission/application times, GROUND/ONBOARD and delivered/refused/expired status. Ownership, parameters, technical level and current state are checked. | Reuse `issueCommand` unchanged where possible. A LAN delivery ACK is not a modeled uplink or an executed spacecraft action. Network connection and modeled radio contact must remain visibly distinct. |
| [`store/index.ts:117–124`](../../apps/web/src/store/index.ts) applies a command batch to a local candidate and publishes only if all commands succeed; it manufactures player attribution from role ownership. | Preserve all-or-nothing batches; pass the authenticated acting player's stable ID instead. Do not mutate global `activeRole` temporarily around remote calls. |
| [`store/index.ts:12,19–20,25–40,126–156,164–166`](../../apps/web/src/store/index.ts) combines shared mission state, a module-level `liveMission`, simulation orchestration, browser settings/storage, audio, DOM explanation focus and pause state. Pause removal never resumes implicitly. | This is the main extraction cost. Running the zustand module in Bun would carry browser/UI responsibilities and risk a second `liveMission`. Separate a pure session authority from per-client view state; migrate every mission mutation. |
| [`loop/useSimLoop.ts:4–15`](../../apps/web/src/loop/useSimLoop.ts) advances on rAF, publishes about every 100 ms and pauses when its document is hidden. [`store/index.ts:131–153`](../../apps/web/src/store/index.ts) bounds integration and self-paced advance work. | LAN browser loops must only render snapshots. Server owns progression, event boundaries and bounded advance jobs; a phone going hidden must not execute `pause('hidden')` against the entire room. |
| [`sim/state.ts:60–68`](../../packages/core/src/sim/state.ts) stores seeded RNG state; [`sim/step.ts:175–204`](../../packages/core/src/sim/step.ts) uses remainder and physical boundaries, including event audit ordering and auto-pause. Existing [`sim/sim.test.ts:24–37`](../../packages/core/src/sim/sim.test.ts) specifies immutability, repeatability and JSON round-trip behavior. | Deterministic replay and snapshot serialization are strong foundations. These are inspected test definitions, not newly observed passes. Replay also needs accepted intent order and host time advances, not just a common seed. |
| [`ARCHITECTURE.md:17–29`](../ARCHITECTURE.md), [`MISSIONS.md:14`](../MISSIONS.md), [`MISSION_FLOW_REFINEMENT_SPEC.md:137,178–205,541`](../MISSION_FLOW_REFINEMENT_SPEC.md) require revision-bound evidence, four disciplines, affected-role concerns, facilitator coordination, actor history and independent pause reasons. | Preserve domain decisions; change the single-screen transport/presentation assumption. The spec's `:34` no-online-sessions row and `:205` hot-seat operational model need mode-specific wording. |

**Easy:** pure core, explicit actor metadata, quoted edits, revision gates, bounded immutable sim transitions, existing command receipts and four-role discipline model. **Hard:** most non-physical session authority currently lives in a browser singleton; role ownership is not a device identity; UI pause reasons are mixed with mission stops; client history/checkpoint readers currently expect a local full sim. Extraction, not WebSocket syntax, is the critical path.

## 3. Architecture options

| Option | LAN/offline behavior | Authority/lifecycle | Operational cost and verdict |
|---|---|---|---|
| **A. Bun local HTTP + WebSocket server serving built app** | One LAN URL, ordinary HTTP/WS on one port; all assets/data served locally. Direct host-to-phone TCP traffic. | Bun room owns state/clock independent of browser rAF. Host browser can reload without losing the process state. | Requires installing/preparing Bun and firewall access on the host. No browser certificate setup or signaling system. **Recommend.** [INFERENCE] Four small consoles should be well within this topology's capacity; measure payload and latency. |
| **B. Host browser authority + WebRTC data channels** | Needs signaling via local server, or repeated two-way SDP/ICE QR exchange. Same-LAN host candidates may suffice, but candidate/privacy policy and UDP reachability require device testing; internet TURN would violate the offline goal. | Closing/suspending the host tab stops authority unless redesigned. DTLS protects data channels, but HTTP-delivered code and signaling are not authenticated by that alone. | A server is usually still needed, while adding ICE, reconnect and host lifecycle complexity. Data-only WebRTC is **not universally secure-context-only by specification**; media capture is. Browser support/policy still must be tested. **Leave for this feature.** |
| **C. Static HTTPS site + hosted relay/signaling** | Public deployment can provide trusted HTTPS, but external room service requires internet; browser private-network rules complicate reaching a LAN companion. | Cloud authority could be reliable but is no longer a LAN/offline product. | Accounts may be avoidable but deployment/operations are not. Fails the no-internet demo requirement. **Reject for this scope.** |
| **D. Browser host + local WebSocket relay** | Same URL/port practicality as A. | Still loses mission progression when browser authority freezes; server is merely forwarding. | Pays the local server setup cost without gaining robust clock/authority. **Prefer A.** |

A native packaged companion could eventually hide the Bun install, but it is packaging of A, not a separate synchronization architecture. Do not add Electron, a database or an internet service to solve a four-device room.

### 3.1 Plain HTTP platform facts and browser limitations

The exact default is `http://<selected-private-ip>:3000` and `ws://<same-host>:3000/ws`; port 3000 is a proposal and can be overridden. `localhost` on a phone means **the phone**, not the main computer. The localhost secure-context exception does not apply to `http://192.168.x.x` ([MDN secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)).

| API/behavior | Plain HTTP LAN design requirement |
|---|---|
| DOM, WebGL scene, same-origin HTTP and WebSocket | Use ordinary browser rendering and same-origin transport. [INFERENCE] Target Safari/Chrome combinations must be verified on the selected LAN; no claim of a measured working room is made here. |
| Async Clipboard (`navigator.clipboard`) | Secure-context-only. Always show a selectable URL/manual-copy field; Copy is a feature-detected enhancement, not a required join step. |
| Screen Wake Lock | Secure-context-only. Never depend on it to preserve participation; instruct users to keep the page visible and reconnect after screen lock. |
| Service worker, background sync, push | Secure-context-only. Offline means the reachable **local server** supplies assets, not a phone PWA magically operating after the host disappears. No service-worker prerequisite. |
| Camera/microphone `getUserMedia`, browser Barcode Detection | Secure-context restrictions apply. The user scans with the phone's native camera QR reader; the game does not need in-page camera access. Provide manual URL/token entry. |
| WebRTC data-only `RTCPeerConnection`/`RTCDataChannel` | The [W3C WebRTC IDL](https://w3c.github.io/webrtc-pc/#rtcpeerconnection-interface) exposes `RTCPeerConnection` without a `[SecureContext]` annotation, unlike `getUserMedia`. Do **not** assert “WebRTC always needs HTTPS.” [INFERENCE] Actual insecure-origin data-channel availability and local candidate policy on target browsers remains a device-test question; option B is rejected for complexity, not an invented blanket API prohibition. |
| Web Share, orientation/sensor inputs, WebGPU, `crypto.subtle` | Restricted APIs must not be necessary for joining or commanding. Generate credentials with server cryptographic randomness, not a client secure-context-only crypto dependency. Use touch/keyboard and WebGL. |

Restricted-API facts: [MDN current restricted feature list](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts/features_restricted_to_secure_contexts). Feature-detect rather than sniff the browser. A self-signed certificate is not a zero-setup route to trusted HTTPS on guests' phones; a trusted local certificate deployment would be a separate operator burden.

**Local-network permissions:** [Chrome's current LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access) describes checks when crossing into a more-private address space, including WebSockets. Keep the app and socket on the *same selected LAN origin*, not a public static app opening a private socket or a LAN page calling a loopback API. [INFERENCE] Same-origin local-to-local requests should avoid that cross-address-space gate; rollout differences, OS local-network prompts and permission-denied handling still belong in the real-device matrix. Do not tell judges to disable browser security flags. If a supported device blocks the intended path, show network/permissions guidance and use host-only play, not a silent cloud tunnel.

**Backgrounding:** [MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) documents rAF/timer throttling; [Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) documents frozen/discarded pages and unreliable unload events on mobile. Do not infer that an OPEN socket is healthy or depend on unload to release a seat. [INFERENCE] Safari/Chrome lock-screen timing and network survival vary by device/OS; no fixed suspension interval is promised. Reprobe/resynchronize on `pageshow` and visible transitions, with optional freeze/resume handling where exposed.

## 4. Recommended architecture and state ownership

Add a small `apps/host` Bun entrypoint and a pure `packages/session` domain layer. The domain layer depends on core/data only; both static local mode and the Bun authority call it. The web store becomes a projection plus local UI preferences. This is one session rule implementation with two transports, not two rule engines.

```mermaid
sequenceDiagram
    participant CLI as Host CLI / Bun
    participant H as Main-screen browser
    participant P as Phone role console
    participant R as In-memory room authority
    participant C as Deterministic core
    CLI->>R: Create epoch, room and host capability
    H->>CLI: Load built app; authenticate host session
    H->>P: Display LAN URL + QR join token
    P->>CLI: POST join (token, name, protocol/build)
    CLI->>H: Pending player for approval
    H->>R: Admit and assign roles
    CLI-->>P: Device session + single-use WS ticket
    P->>R: WebSocket ticket handshake
    R-->>P: WELCOME + complete public snapshot
    P->>R: INTENT (id, epoch, actor, base revision, edit)
    R->>R: Validate session, role, epoch, revision, deduplicate
    R->>C: Re-quote against current design; apply atomically
    C-->>R: Quote or typed refusal
    R-->>P: RESULT (accepted/refused, commit sequence)
    R-->>H: SNAPSHOT (same authoritative commit)
    R-->>P: SNAPSHOT (same authoritative commit)
    loop While explicitly running
        R->>C: stepSim using host-owned bounded time
        C-->>R: State, events, auto-pause boundary
        R-->>H: Public snapshot / events / command receipts
        R-->>P: Public snapshot / role alerts / command receipts
    end
    P->>R: Reconnect with device credential; fresh ticket
    R-->>P: Full snapshot + outcomes for pending intent IDs
```

### 4.1 Ownership map

| Owner | State/responsibility |
|---|---|
| Core | Physics/resources, deterministic seed/RNG, command legality and modeled transport, design quotes, affected-role rules, launch/journey readiness and scoring. |
| Pure session reducer | Mission artifacts/stages, design commit, approval dependency ledger, stable actor attribution, audit/roster/trade/note history, pending decision IDs, pause policy, attempt/checkpoint transitions. No DOM/storage/audio/network. |
| Bun room | Authentication, host capability, roster membership/device seats, ordered dispatch, request deduplication, room epoch/sequence, protocol/build checks, presence, clock scheduling, broadcasting and limits. Holds the sole live `SimState` in LAN mode. |
| Host browser | Shared 3D scene, resources, next step, timeline and presence; host admission/assignment controls. Mission intents use the same authority path as phones. Host capability grants room administration, **not** a hidden bypass of physical-role checks. |
| Phone browser | Authorized-role tabs, frozen quote preview, contextual commands/alerts and connection state. Cannot step, write balances, clear someone else's pause or impersonate another device. |
| Every client locally | Language, sound, reduced motion, panel expansion, scrolling, role-tab selection, explanatory snapshot, tour progress, camera and visual-only timeline inspection. “Show me” focuses a local target; a phone may explicitly request host focus, which the host can accept, rather than hijack its camera. |

Keep the full core snapshot server-side. Define a versioned `SessionSnapshot` DTO containing shared design/budgets/artifacts/stage, roster/role ownership, approval records, notes/trades, cues, telemetry/command receipts, recent events, decisions, pause/running/warp/assistance and review/score data. Do not stringify the zustand store, expose credentials, or send all integration history every frame. Provide bounded, on-demand history/audit pages and core-derived scene ephemeris/trajectory samples when existing render/timeline consumers need them. A visual interpolator may smooth two snapshots; it may not compute authoritative resource changes, decide mission outcomes or issue predictive approvals.

Start with complete **bounded public DTO snapshots**, about 10 Hz while flight runs, and immediately after design, command, pause, roster or decision transactions. Heartbeats/presence may have their own lower cadence. All mutation transactions and published snapshots have monotonic sequence numbers; coalescing telemetry snapshots can skip sequence values, so the client replaces state on any newer snapshot rather than treating every numerical gap as missing data. Results/events contain stable IDs for deduplication. A slow socket retains only the newest pending telemetry snapshot; preserve bounded control results or disconnect/resync if it cannot drain. Add deltas only if measured payload/latency shows a need; no binary/AoI protocol by default.

### 4.2 Clock and authority rules

- Only Bun advances LAN flight. Use a monotonic host clock; warp scales server elapsed time, never client timestamps. Serialize ticks and intents through one bounded room dispatch queue. No await inside a partially applied session transaction.
- Preserve core fixed-grid remainder and event-boundary auto-pause. Bound work and yield between chunks so high warp/self-paced advances cannot starve heartbeats. If scheduling stalls beyond the bounded catch-up window, pause with `host-stall`; do not silently simulate minutes of missed wall time after laptop sleep.
- Local static mode retains browser scheduling through the same pure session transitions. Disable `useSimLoop` mission stepping and local `liveMission` writes for **all** LAN clients, including the host display.
- Any participant can request a shared manual pause, with requester attribution. Host controls explicit Resume; LAUNCH_ORBIT controls warp/advance/skip-cruise within existing role checks. Host Resume cannot dismiss a pending physical decision or unresolved learning stop. Clearing a reason always leaves stopped/manual state until explicit Resume.
- Map pause reasons to scopes: `decision` and automatic Aspiring teaching are shared authoritative stops; host administrative Settings/Home/viewer/graphics operations keep their shared safety stop where they change session behavior. A phone's view change, visibility, local settings or reading an optional frozen explanation is local and does not freeze everyone. Phones expose “Pause team to discuss”; automatic teaching pauses identify the learner/role and require explicit acknowledgement. Shared explanation acknowledgement never resumes. This deliberately replaces the current single-browser “all reading pauses flight” assumption with a visible, mode-specific policy.
- No LAN `handoff` when a phone switches between roles it owns. Keep it for local hot-seat. A new role assignment is audited, invalidates affected approvals and requires the recipient to acknowledge its responsibilities; no simulation resume is implicit.
- Pending decisions have stable attempt-scoped IDs and required owner roles, determined by shared policy, not by whoever first taps Dismiss. Owner acknowledges and issues the actual core command when needed; host may coordinate resume only after required acknowledgement. If acknowledgement and modeled command are distinct, the UI labels both. Advisory preferences/concerns are non-binding, not a majority-vote bypass. Do not require votes for routine actions.

## 5. Protocol sketch and transaction semantics

The following is a typed wire-design sketch, not committed API code. All variants require strict runtime schemas and bounded strings/arrays/finite numbers. Domain types such as `Command`, `RoleId`, `OrbitChoice`, `Refusal` and `Budgets` come from core; shared DTO definitions live in the proposed protocol package.

```ts
type DesignEdit =
  | { kind: 'ADD_PART' | 'REMOVE_PART'; partId: string }
  | { kind: 'SET_RIDE'; rideId: string }
  | { kind: 'SET_ORBIT'; orbit: OrbitChoice }
  | { kind: 'SET_PROPELLANT'; kg: number };

type MissionIntent =
  | { kind: 'QUOTE_DESIGN'; edit: DesignEdit; baseRevision: number }
  | { kind: 'COMMIT_DESIGN'; edit: DesignEdit; baseRevision: number; quoteId: string }
  | { kind: 'SIGN_OFF'; role: RoleId; designRevision: number; rosterRevision: number }
  | { kind: 'COMMANDS'; commands: readonly Command[] }
  | { kind: 'NOTE'; category: 'CONCERN' | 'SIDEBAR'; target: 'mass' | 'power' | 'budget' | 'data'; text: string; designRevision: number }
  | { kind: 'RESOLVE_NOTE'; noteId: string }
  | { kind: 'CONFIRM_OBJECTIVE' }
  | { kind: 'SET_SEGMENT'; segment: 'launch' | 'space' | 'ground' | 'user'; selected: boolean }
  | { kind: 'FREEZE_BASELINE' | 'VERIFY_BASELINE' | 'COMPLETE_STAGE'; designRevision: number }
  | { kind: 'LAUNCH'; designRevision: number; rosterRevision: number }
  | { kind: 'PAUSE' }
  | { kind: 'RESUME' }
  | { kind: 'SET_WARP'; warp: number }
  | { kind: 'ADVANCE_NEXT' | 'CANCEL_ADVANCE' | 'SKIP_CRUISE' }
  | { kind: 'ACK_DECISION'; decisionId: string }
  | { kind: 'ACK_LEARNING'; stopId: string }
  | { kind: 'RETRY_CHECKPOINT'; checkpointId: number }
  | { kind: 'END_MISSION'; confirmationId: string };

type ClientMessage =
  | { type: 'HELLO'; protocol: 1; buildId: string; lastSeq: number }
  | { type: 'INTENT'; id: string; epoch: string; attemptId: number;
      rosterRevision: number; actor: ActorContext; intent: MissionIntent }
  | { type: 'READY'; ready: boolean; rosterRevision: number }
  | { type: 'ASSIGN_ROLE'; id: string; role: RoleId; playerId: string; rosterRevision: number }
  | { type: 'ADMIT'; id: string; pendingDeviceId: string; playerId: string }
  | { type: 'KICK'; id: string; deviceId: string }
  | { type: 'ROTATE_JOIN_TOKEN'; id: string }
  | { type: 'ROTATE_FACILITATOR'; id: string; rosterRevision: number }
  | { type: 'GET_HISTORY'; id: string; cursor: string | null }
  | { type: 'GET_RESULTS'; ids: readonly string[] }
  | { type: 'PING'; nonce: string };

type TransportCode = 'BAD_MESSAGE' | 'VERSION_MISMATCH' | 'ROOM_FULL'
  | 'JOIN_LOCKED' | 'KICKED' | 'UNAUTHORIZED' | 'ROLE_NOT_ASSIGNED'
  | 'STALE_DESIGN' | 'STALE_ROSTER' | 'STALE_ATTEMPT' | 'INTENT_EXPIRED'
  | 'RATE_LIMITED' | 'HOST_ONLY' | 'OUTCOME_UNKNOWN';

type ServerMessage =
  | { type: 'WELCOME'; protocol: 1; buildId: string; deviceId: string;
      playerId: string; epoch: string; snapshot: SessionSnapshot }
  | { type: 'SNAPSHOT'; snapshot: SessionSnapshot }
  | { type: 'QUOTE'; id: string; quoteId: string; baseRevision: number;
      before: Budgets; after: Budgets; affectedRoles: readonly RoleId[] }
  | { type: 'RESULT'; id: string; ok: true; seq: number; receiptIds: readonly string[] }
  | { type: 'RESULT'; id: string; ok: false;
      refusal: Refusal | { code: TransportCode; values: Record<string, string | number> } }
  | { type: 'HISTORY'; id: string; page: HistoryPage }
  | { type: 'PONG'; nonce: string; seq: number }
  | { type: 'ROOM_CLOSED'; reason: 'HOST_STOPPED' | 'RESTARTED' };
```

Admission, device credentials and single-use socket tickets are exchanged over same-origin HTTP. `HELLO` adds application protocol/build checks; credentials never appear in a broadcast. Administrative messages are host-capability-only and receive correlated `RESULT`s just like intents. Starting/resetting a scenario or changing participant mode is a host-only session transaction with confirmation, a new attempt ID, and fresh snapshots; it cannot be encoded as a forged phone design edit. History/review DTOs contain structured core evidence, not user-generated HTML.

**Ingress order:** enforce frame/queue limits → parse strict schema → authenticate connection/room epoch/build → deduplicate ID → verify device-to-player mapping and owned role → verify attempt/roster/design prerequisites → execute session/core transaction → append audit/result → publish. `ActorContext.playerId` must equal the authenticated player; reject mismatches. No team phone may send `ALL`. The authority constructs the actor passed to core; a client's claimed role is only a requested acting discipline.

**Quotes/conflicts:** QUOTE returns a short-lived quote ID bound to player, role, intent, design revision and room epoch. COMMIT must present that exact edit/quote at the same base revision; the server reruns the core quote before committing. Never accept serialized `next: Design` or client-calculated budgets. If Science and Spacecraft quote revision 7, the first commit creates 8; the second gets `STALE_DESIGN` and a fresh view, not last-writer-wins or silent rebase. Requote requires the user to review changed deltas. Read-only views do not hold a design lock. Freeze, verification, sign-off and launch similarly recheck current dependencies.

**Approvals:** store `{role, playerId, designRevisionReviewed, dependencyFingerprint, rosterRevision, acceptedSeq}` server-side and project core's boolean sign-offs from valid ledger entries. An unrelated design revision does not erase approval if `rolesAffectedBy` says its evidence is unchanged; affected edits and role transfers do. New requests must name the current design/roster revision. Launch checks projected approvals, baseline, verified revision, owner and current readiness atomically. A connected/ready badge is not a design approval.

**Command batches:** authenticate one acting role for the bounded batch; run `issueCommand` on a candidate state for every command, then commit once, including `stepSim(candidate, 0)` event handling. Reject the whole batch on any core refusal. A transport success means **accepted by the room**; command queue receipts show `WAITING_CONTACT`, `IN_TRANSIT`, `DELIVERED`, `REFUSED` or `EXPIRED` according to core, not WebSocket RTT. Network `ROOM_FULL`/`STALE_DESIGN` errors are not physical `RefusalCode`s; do not add networking to the deterministic core union.

**Retries:** intent IDs are unique per authenticated device and room epoch; retain bounded result records for the room lifetime (cap accepted intents and refuse further mutations clearly if exhausted). A repeated ID with the same payload returns its saved result; a different payload under the same ID is rejected. Reconnect uses `GET_RESULTS` for unresolved IDs; never auto-resubmit a command as a new ID. An expired or unknown outcome is shown for human review after snapshot reconciliation, not claimed to have failed. No disconnected outgoing gameplay queue. Reconnect credentials/HELLO never replay old taps. Audit accepted ticks/intent order/actors/assistance against the exact rules/data build for deterministic replay.

## 6. Lobby, QR and role assignment

1. Operator prepares the production app and launches `bun run host`. CLI enumerates non-loopback interfaces, excludes obvious virtual/VPN candidates by default and displays private IPv4 candidates with interface names. With one candidate it can suggest it; with several, require selecting an address rather than guessing the internet-facing route. Support `--bind <private-ip>` and `--port`. Prefer IPv4 initially; explain IPv6-only networks as unsupported until explicitly tested, not “no network.”
2. Bind the LAN listener to the selected private interface, **not** `0.0.0.0` by default. Provide a loopback-only host control bootstrap listener/capability on a separate loopback port; it only grants/redirects the main browser into its host session, and is not a phone API. Open/print the host control URL locally. Host capability never enters the public QR. Only approved LAN-origin requests reach the room API.
3. Main browser shows a lobby with `1/4 devices`, QR, readable URL, room short label, same-Wi-Fi instructions, interface selection and “refresh QR.” Example QR: `http://192.168.1.23:3000/join#room=<id>&token=<random-secret>`. Fragment keeps the reusable invitation secret out of routine HTTP URL logs; the page extracts it, sends it in a POST body and removes it from the address bar. It does **not** encrypt traffic or protect screenshots/browser history before removal.
4. Native phone camera opens the URL; manual path is typing the displayed `/join` URL and invitation token. The token is a high-entropy bearer secret, not a guessable four-digit code. Name entry is short plain text; choose an accessible color/icon badge. Host approval is required before acquiring a seat or role. Bound pending admissions separately so they cannot exhaust memory.
5. Default teammate mode maps each admitted device to one player; host can assign several of the four roles to one player/device. Exactly one owner per role. Host may be display/facilitator-only with all roles on phones, but still consumes one device slot. Unclaimed roles remain on the host player until explicitly reassigned. Facilitator coordinates presentation and rotates among players; it is not a fifth discipline or extra approval.
6. Explicit **solo-with-phones** mode pairs personal controllers to the same solo player via host approval. All use `ALL` under that player's identity, share one approval action and preserve solo team statistics; no four imaginary teammates. Teammate mode and solo mode are visible and selected before the attempt. One player owning all roles in teammate mode acts through its selected owned discipline rather than gaining `ALL` automatically. *Superseded: a Players count 1–4 replaces the mode choice; 1 is host-only solo with no phones, 2–4 are teams whose admitted phones take the `SET_TEAM` role share for their seat.*
7. All participating players acknowledge role assignments and Ready after initial snapshot. Host starts the design session; this does not launch. Joining later is allowed only while the host unlocks admissions; role transfer is a separate paused audited action. Role change clears Ready and the affected sign-offs. Before launch, every role must have a connected acknowledged owner, or the host explicitly takes that role over while paused. *Superseded: starting no longer locks admission; joining later is allowed while seats remain open and the host has not closed admission.*
8. Host can close admission, hide QR, rotate the invitation, kick a device, or continue host-only. A fifth connection gets a localized room-full screen; pending/reconnecting connections never silently evict another participant. New device replacement requires host approval; the replaced connection is revoked atomically.

**Devices versus people:** the cap counts admitted active device sessions, including the main display. Use one active socket per device credential; a second tab replaces the old connection rather than adding another command source. This is an application-session cap, not proof of unique physical hardware. Do not fingerprint guests. Disconnected seats are reserved for 120 seconds, count against admission during that interval, and can be released earlier by the host; releasing a seat revokes its reconnect credential. Role ownership is retained until an explicit transfer.

## 7. Per-device mission UX

### 7.1 Design phone console

Every phone shows mission/stage, its player badge, assigned role tabs, connection freshness, a compact resource summary with units and unknown states, and the current shared next step. Its own actions are primary; other disciplines are readable, with “Owned by …”, not deceptively disabled without explanation.

| Role | Phone design content | Phone flight content |
|---|---|---|
| SCIENCE | Objective and requirement traceability, compatible instrument/payload choices, storage/science trade consequences; data badges. | Instrument on/off, permitted duty-cycle/targeting requests, objective progress, storage/quality alerts; preserve core role checks for each POINT mode. |
| SPACECRAFT | Equipment power/battery/thermal/avionics/attitude, compatible propulsion/fuel and crew support where modeled; mass/power/thermal badges. | Permitted pointing/SAFE/power/heater/computer/deployment/crew-support controls, battery/thermal/crew alerts. |
| LAUNCH_ORBIT | Ride, orbit/trajectory and end-of-mission planning, mass/accommodation/delta-v consequences; launch checklist. | Explicit Launch, warp/advance/skip-cruise/capture/deorbit where core permits; event boundaries, orbit/capture/fuel alerts. Host retains session resume coordination. |
| GROUND_COMMS | Ground/relay service evidence, radio choices/contact/link/data-delivery consequences. Existing fixed station choices stay fixed; do not invent editable service rules. | Downlink/link modes as authorized, pass/contact status and complete command queue with actual transport delay/expiry; distinguish LAN connectivity from space radio. |

Use catalog/core role metadata rather than a second UI-only permission matrix. Core remains final authority, including cross-role POINT exceptions. A proposal card shows current revision, real before/after deltas and affected roles; Commit uses the server quote. Concerns/sidebars link to resources and revisions, can be resolved with attribution, and are optional unless a modeled conflict blocks progress. “Sign off this reviewed baseline” lists what was reviewed and why it is blocked; a stale view cannot sign accidentally. Several owned roles use clearly named tabs and individually visible approval status, not a global active-role broadcast.

### 7.2 Execution phone console

- Top strip: paused/running, mission time, freshness, owned role(s), current decision/learning-stop owner. Connection-lost state disables mutation controls immediately when known; last telemetry is visibly stale, not live.
- Role-owned command cards explain actual parameters and consequences; explicit toggles show requested versus observed status. Show pending request, room accepted, modeled queued/in-transit, executed or refused/expired separately.
- Alerts prioritize that role while allowing a compact shared incident overview. Decision owner sees acknowledgement and action; others can raise a concern/request a pause. No compulsory per-command voting.
- A shared “Pause team” is always reachable. Resume appears only to the host coordinator; owner-only commands remain owner-only. End mission is host-confirmed session control, with core's immediate end semantics, not an out-of-contact spacecraft command.
- Phone explanations/tours use existing science content and local frozen snapshots. Automatic Aspiring learning stops are shared and attributed; optional reading is local with an explicit discussion-pause affordance. Expert remains on-demand. All controls preserve the presentation-depth/learning-level distinction.

### 7.3 Main big screen

Retain the scene-first redesign: one 3D canvas, always-visible shared visual resource grid, CAPCOM next-step card, flight timeline, pending decision owner, concise events and presence chips with player/role/ready/reconnecting state. Selecting an alert can focus the scene and expand its existing host panel. Role detail panels collapse in place; do not cover the scene with three phone consoles. Show the design proposal under discussion and affected-role approval status. QR is prominent in the lobby and retrievable in a paused room panel, not permanently covering flight. Phone camera requests are explicit suggestions; camera/chase/timeline visualization remains presentation-local unless the host deliberately shares focus.

**Accessibility and localization:** en and pt-BR keys/interpolation/error codes must ship together. Translate protocol refusal codes locally, not by broadcasting English prose. User names/notes are plain text and not machine-translated. At 320 CSS px use one scrollable role sheet, no horizontal resource table, wrapping long Portuguese labels, visible units and safe-area padding. Target at least 44×44 CSS px controls with spacing, keyboard/focus operation, non-drag alternatives, clear disabled reasons, adequate contrast and icon/text labels beyond color. Announce connection changes and new decisions with restrained live regions; do not announce telemetry ten times per second. Support reduced motion, zoom and landscape; no mandatory sound, vibration, motion sensors or wake lock.

## 8. Failure, reconnect and fallback policy

| Failure | Required behavior |
|---|---|
| Phone locks, backgrounds or loses Wi-Fi | Presence becomes suspect after heartbeat deadline, then reconnecting/offline. Proposed heartbeat 5 s, suspect after 15 s and offline after 30 s; these are product defaults, not claims about browser suspension timing. Reconnect on visible/pageshow with jittered bounded backoff and a fresh socket ticket; reset retry cadence on explicit Retry. No simulation stepping or command replay on the phone. |
| Disconnected during sign-off | If committed before loss, approval remains valid for its dependencies; lost ACK is resolved by saved result + snapshot. An uncommitted tap grants nothing. Accepted approval is not invalidated merely because the phone left; role reassignment or affected design change invalidates it. Launch still needs connected ownership or explicit takeover. |
| Disconnected mid-flight | Pause once when an assigned active controller is confirmed offline, using a distinct `controller-disconnected:<device>` reason. Host can wait, or explicitly take over/reassign while paused and clear that reason. Remove only the relevant disconnect reason after resync; never auto-resume. Brief suspicion alone does not toggle mission speed. Solo auxiliary-phone loss does not pause if the host still owns the same solo responsibilities. |
| Owner of pending decision disappears | Decision and its physical pause remain. Host explicitly reassigns role and acknowledges takeover; original command actor history is unchanged. No timeout vote, synthetic acknowledgement or implicit execution. |
| Reconnect/late join | Authenticate device, verify epoch/build, replace old socket, send full snapshot, resolve unresolved request IDs; controls remain disabled until snapshot/roster acknowledgement. New joins see current design/flight read-only until admitted/assigned. Never run `startScenario` on join. |
| Lost ACK or duplicate delivery | Same ID retrieves same result; never spend/apply twice. Unknown result is shown as unknown until reconciled. New attempt, checkpoint rewind and restart invalidate old intent context and cached quotes. |
| Main browser refreshes/disconnects | Bun state remains. Add `host-display-disconnected`, pause and show waiting on phones; main browser authenticates through the local host capability and resyncs. Hiding the display also requests a shared safety pause, independent of phone visibility. No guest can seize host rights by being first to reconnect. |
| Host laptop sleeps/Bun stalls | Detect host scheduling gap and pause without wall-clock catch-up. Require explicit Resume. Disable OS sleep during the demonstration through normal operator settings, not browser tricks. |
| Bun exits/crashes or room epoch changes | Phones show room ended/restarted and discard quotes/outgoing intents. No leader election. Reopen a new lobby/attempt; do not claim flight recovery. Static solo/hot-seat is always available, but continuing the existing flight requires the still-running authority. |
| Host chooses host-only fallback while Bun lives | Pause, revoke/release phone sessions, transfer roles to host with audited roster snapshots and invalidated affected approvals, preserve issued actors/physical state, then explicitly resume. Keep teammate statistics/history; do not retroactively claim solo achievement. |
| Slow client/big queue | Coalesce telemetry; bound queue and result/history sizes. Warn and close/resync the slow connection rather than grow memory or stall authority. Refuse overload before mutation. |
| Wrong LAN address / DHCP change / VPN | Show interface/address selection and regenerate QR. Existing address change needs reconnection via new URL; credentials are not promised portable across origins. New pairing can be approved without pretending an unauthenticated client is an old device. |
| Firewall / AP client isolation | Same SSID is necessary but insufficient. Allow the selected TCP port on the host's private network profile; use an operator-controlled router/hotspot with peer access enabled if venue guest Wi-Fi isolates clients. Do not disable the firewall globally, forward router ports, use UPnP or add a public tunnel. [INFERENCE] Actual venue and hotspot routing needs on-site rehearsal. |

## 9. Security model

This is a local cooperative game, not a trusted network appliance. A LAN is not automatically safe. Threats include unauthorized guests, leaked QR secrets, arbitrary actor claims, malicious pages connecting to local sockets, accidental duplicate input and unbounded input/queues.

- **Bind narrowly:** private selected interface only, with peer-address allowlist for its intended subnet and explicit loopback bootstrap. Private IP alone is not proof of same Wi-Fi; routed/VPN clients may reach it. Do not advertise public interfaces or trust `X-Forwarded-For`. Enforce a firewall/private network deployment boundary; no WAN exposure.
- **Authenticate admission:** server-generated invitation secret with at least 128 bits of entropy, expiring after 15 minutes by proposed default; rotation disables new uses without disconnecting admitted devices. Host approval plus locked-admission state prevents anyone photographed near the QR from automatically controlling a role.
- **Separate capabilities:** invitation is join-only; admitted device gets its own random credential; host capability is issued only through local bootstrap. A same-origin bearer-authenticated HTTP exchange mints a single-use 30-second WS ticket bound to room/device/build. Persistent bearer credentials never enter WS URLs or public snapshots. Tickets in URLs are short-lived and redacted from logs.
- **Request-origin boundary:** validate `Host` against exact selected address/port and approved loopback bootstrap host; reject DNS-rebinding/unexpected hosts. For browser API/WS requests validate exact allowed `Origin`, require JSON content type/auth on mutations, no permissive CORS and no cookie-only unauthenticated control endpoint. No-Origin browser upgrades are rejected; test clients explicitly supply the expected origin. Origin checks supplement bearer authentication; they are not authentication themselves.
- **Bound and validate:** strict message variants, finite numerical ranges, catalog IDs, array lengths, note/name length, maximum raw frame bytes and per-device/per-IP connection/intent rates. Proposed initial limits: 8 KiB inbound frame, 20 gameplay intents/s/device, 5 notes/10 s/player, 256 queued room mutations; tune from legitimate use measurements. IP-only limits must allow several phones behind one network path. Cap pending joins and close malformed/oversized/flooding peers before costly core work.
- **Plain text:** trim/collapse whitespace, remove control/zero-width/bidi override characters from names/notes, enforce character and byte limits; render as React text, never HTML/Markdown. Sanitization does not replace escaping or schema validation. Avoid user-supplied links in the room UI.
- **Kick/rejoin:** kicking revokes device credentials, outstanding tickets and active sockets, retains immutable historical attribution, and requires a new host-approved pairing to return. A leaked room invitation cannot override a revoked device into its old role; rotate the invitation when appropriate. Device-level kick is not a ban on a physical person inventing another identity.
- **Storage/logging:** guest credentials in sessionStorage/memory with a storage-failure path that falls back to re-pairing; not exported with reports. Keep host bootstrap secrets out of QR, source maps/logs and shared URLs. No credentials/notes sent to telemetry services. Cap note/history memory; clear room credentials on explicit exit or process stop.
- **Transport honesty:** HTTP/WS LAN traffic is plaintext and can be observed/modified by a hostile on-path network actor. Tokens do not fix that. Use an isolated trusted demo router and no personal/sensitive data. If hostile shared-network use is required, approve a trusted HTTPS/WSS certificate strategy as a separate delivery requirement before claiming protection. Do not promise public-network security.
- Serve only built public assets with path traversal protection, no repository/source filesystem browsing, no runtime shell/remote URL fetch endpoints, conservative CSP (`connect-src 'self'` plus exact required local socket origin if necessary), no framing, and no-referrer policy. Expose a health/build endpoint with no secrets.

## 10. Void Protocol reuse at the pinned commit

Source: owner-approved private repository `~/dev/void_protocol`, **`218625d7be96e3f6a840e324d9e8c836eaf21488`** (`218625d`). Read its graph for navigation, then inspected pinned files directly; the current graph is not itself evidence of what existed at the pin. LOC below are **physical source lines measured with `git show 218625d:<path> | wc -l`**, including comments/blanks, not estimates of ASTRIX implementation size. Excerpt ranges are inclusive.

The pinned [`docs/meta/MULTIPLAYER.md`](../../../void_protocol/docs/meta/MULTIPLAYER.md) explicitly warns that schema/server authority does not establish a completed, verified client reconciliation loop. That filesystem-relative link is informational for a sibling checkout; reproducible evidence is `git -C ~/dev/void_protocol show 218625d:docs/meta/MULTIPLAYER.md` and `:docs/fullstack/API_AND_SERVER.md`. Do not inherit “production-proven” claims from API/schema presence.

| Verdict | VP path @218625d; measured LOC | Reuse decision and ASTRIX destination |
|---|---|---|
| **COPY, function only** | `apps/web/src/net/transportPolicy.ts`, 79 total; `backoffDelayMs` at 15–18 = **4 LOC** | Copy the pure equal-jitter exponential-delay function and its test cases, retaining attribution; put it in `apps/web/src/multiplayer/reconnect.ts`. Constants and terminal-close classifications are adapted separately, not represented as an unchanged full-file copy. Non-deterministic jitter is transport behavior, not sim RNG. |
| **ADAPT** | Same transport policy, 79 LOC; close/ticket decisions 20–60. | Replace JWT/universe/member semantics with LAN device/epoch/room codes; keep terminal kick/version/room-closed behavior and bounded retries. Leave `tokenExpiryMs` at 63–79: no JWT system. |
| **ADAPT** | `apps/server/src/auth/wsTicket.ts`, **85 LOC**, especially 15–18,36–79. | Reuse random, expiring, single-use, scope-bound in-memory tickets and injected-time tests; replace universe/user with room/device/build, lower live cap for a four-device app, clear tickets on revoke. `apps/host/src/auth/wsTicket.ts`. No VP bearer/JWT/database stack. |
| **ADAPT, extraction** | `apps/server/src/middleware/rateLimiter.ts`, **110 LOC**; fixed-window types/map/consume logic 18–63 = **46 LOC**. | Reuse bounded in-memory windows and time injection; remove Hono and VP client-IP/auth imports/wrappers. `apps/host/src/security/rateLimit.ts`. Enforce WS device rates as well as join/IP rates; acknowledge fixed-window boundary bursts. |
| **ADAPT, extraction** | `packages/shared/src/net/chat.ts`, **46 LOC**; sanitizer 39–46 = **8 LOC**. | Reuse Unicode/control/whitespace normalization with configurable name/note caps, plain-text rendering and adapted tests; no Zod/chat history import unless independently justified. `packages/session/src/text.ts`. Review allowed punctuation/Portuguese diacritics. |
| **PATTERN** | `apps/server/src/rooms/registry.ts`, **978 LOC**; intake 230–248, mutation mailbox 400–420, backpressure 763–782. | New tiny single-room dispatcher with ingress limits, serialized mutation/ticks, snapshot-on-join and bounded backpressure. Do not copy room leases, bank transactions, DB hydration, spatial frame codec or all 978 lines. `apps/host/src/room.ts`. |
| **PATTERN** | `apps/server/src/ws/universeSocket.ts`, **103 LOC**; protocol gate 20–27 and upgrade recheck 29–60. | Version gate before ticket consumption; recheck revoked membership at upgrade; ticket not sufficient after kick. Native Bun HTTP/WS handlers, not Hono routes, DB flags or account auth. |
| **PATTERN** | `apps/web/src/services/universeSocket.ts`, **639 LOC**; transport rules 40–48, retry/stop 291–327, resync/lifecycle 342–355, heartbeat 626–637. | Reconnect + fresh snapshot, terminal close classes, pending-request uncertainty, lifecycle resync and heartbeat. New ASTRIX client, no VP store/API, binary poses, combat or mission reward imports. |
| **PATTERN** | `packages/shared/src/net/authority.ts`, **743 LOC**; strict variants illustrated at 310–322. | New explicit versioned intent/result/snapshot schemas and finite-value validation. Do not reuse VP protocol version, entity enums or giant union. Pick one small runtime validation convention for this new boundary; core domain types remain dependency-free. |
| **LEAVE** | `apps/server/src/rooms/RoomActor.ts`, **7,376 LOC**. | Reuse the concept of authoritative shared rules, not this implementation. Actor has VP economy/combat/world/ship/terrain dependencies; ASTRIX already has deterministic core. Chat attribution/rate behavior at 3166 onward is useful evidence, not a reason to import the actor. |
| **LEAVE** | `apps/server/src/index.ts`, **254 LOC**, Bun serve entry around 171–185. | Native Bun serving is a small fresh entrypoint; leave VP fullstack boot/DB/features/admin/recovery/payment/API routing. No benefit copying the server wholesale. |

**Reuse gate:** Implementation must first extend [existing reuse report](../research/void-protocol-reuse.md) with these precise extracted paths/verdicts and add each actual COPY/ADAPT destination, original range, pin and Apache-2.0/owner attribution to `CREDITS.md`, with source headers and adapted tests. Current report §8 defines the procedure; its older §6 “server authority later” and limited file allowlist need updating before multiplayer code is copied. Pattern inspirations should also be disclosed without claiming literal copied LOC. No source code was copied by this planning change.

Space Apps timing follows the recorded rule/evidence in that report §1: generic VP work predates the challenge; challenge-specific session logic/UX must be authored during **14–15 November 2026**. Keep dated contribution/reuse records and disclose AI/tool help in the submission. Do not treat owner permission to reuse private code as permission to publish the rest of VP.

## 11. Ordered workstreams and acceptance criteria

**Delivery order:** implement and ship the immersion redesign first; multiplayer comes later and must never block, cut or weaken that redesign. Keep solo and hot-seat working throughout. The workstream order below applies only when multiplayer implementation begins.

### 11.0 Alignment with the immersion redesign (reviewed against `GUIDED_IMMERSIVE_REDESIGN_PLAN.md`)

| Redesign element | Multiplayer consequence |
|---|---|
| §9 seams: all mutations via store actions → core `Command`/quotes with `ActorContext` | W1 extracts these actions into the session reducer; no new UI mutation path is introduced by multiplayer |
| §8.2 steering (S1 pointing drag, S2 manual attitude targets, S3 burns) and §8.5 ops plan | new core `Command` kinds travel inside the existing `COMMANDS` intent; owner role SPACECRAFT (attitude) / LAUNCH_ORBIT (burns, warp). Manual targets are already throttled to 1 per 250 ms and coalesced per gesture, inside the 20 intents/s/device cap. Pilot mode on a phone uses the same drag/pad input; the host scene shows the result |
| §8.2 "Slow to 10× and steer" | on LAN this becomes a warp request routed to the LAUNCH_ORBIT owner (or host when unassigned); no implicit warp change |
| §7.8 `useMissionPose()` | LAN clients interpolate between ~10 Hz snapshots inside this selector; camera modes, chase rig and effects stay device-local |
| §7.3 CAPCOM steps carry `owner` | phones show their role's steps first; host shows the team's current step and who owns it; Show me is device-local |
| §7.4 tours | device-local, never pause the room; a phone gets its own short role-console tour |
| Component panel (added during implementation) | device-local inspection; a phone opens it from its own part list as a sheet; the host's anchored panel and tracked screen bounds are never synced |
| §7.9 decision overlay, timeline, hotbar | host shows overlay to everyone; only the decision owner's console gets the action buttons; hotbar buttons render per role on phones |
| §8.4 dry run | read-only and local: any device may run it from the snapshot design; never an intent |
| §7.5 setup "Play as a team" | the LAN lobby is a second option in that disclosure; no other setup change |
| §7.1 compact layout (single device) | unchanged; phone role consoles are a separate route, not the compact host layout |

Complete these multiplayer workstreams in order; do not start mobile mission actions against an unfinished authority boundary. New paths below are proposed, not assertions they exist. No hour estimates.

### W1 — Extract one shared session authority

**Add:** `packages/session/{package.json,src/index.ts,src/contracts.ts,src/reducer.ts,src/permissions.ts,src/pause.ts,src/snapshot.ts}` and focused tests. **Change:** `apps/web/src/store/index.ts`, `apps/web/src/loop/useSimLoop.ts`, mission-action callers in `apps/web/src/ui/`, existing `apps/web/src/store/mission.test.ts` and affected core exports only where extracting reusable existing policy requires it.

Move stage/artifact edits, sign-off/cue checks, accepted trades/notes, launch, command batching, pause/decision orchestration, roster attribution and practice checkpoints into pure session transactions. Keep core physics/quotes where they are. Replace every browser mutation caller with the session dispatch boundary, including shortcuts, new attempt/reset, return/crew actions, end/retry, warp and stage navigation. Read-only UI cannot write a remote mission. Preserve local hot-seat/ALL and browser-only settings/audio/focus behavior; remove obsolete parallel mutation methods after cutover.

**Accept:** existing local behavior is represented by one reducer; no DOM, zustand, localStorage, audio or network imports in the session package; stable player IDs are distinct from roles/devices; batch refusal leaves state unchanged; actor history survives roster edits; local mode still works without any host server.

### W2 — Define wire DTOs, validation and replay/result contracts

**Add:** `packages/session/src/protocol.ts`, `protocol.test.ts`, bounded history/snapshot selectors and serialization fixtures. Choose a single runtime schema approach with no unsafe casts at ingress. **Change:** core/session exports and scene/history consumers to use explicit selectors/projections.

**Accept:** all mission-changing actions in W1 have a wire form or an explicit host-only/local-only classification; every untrusted variant is runtime-validated; no arbitrary Design/SimState writes; revision/epoch/attempt/roster and duplicate-ID semantics are tested; public snapshots omit secrets and avoid unbounded sim history. The main scene/timeline can render LAN DTOs without stepping core.

### W3 — Implement the local host and generic security/reuse primitives

**Add:** `apps/host/{package.json,src/index.ts,src/room.ts,src/clock.ts,src/interfaces.ts,src/auth/wsTicket.ts,src/security/rateLimit.ts}` plus focused room/clock/admission tests. **Change:** root `package.json` (`host` script), credits/reuse inventory before copying any VP excerpts. Serve only `apps/web/dist` with SPA join routing, explicit build checks and safe static paths.

**Accept:** selected private-interface binding, loopback host bootstrap, no wildcard/WAN default, one room and four-seat admission including host, approval/revocation, exact Origin/Host checks, strict rate/frame/queue caps, serialized ticks/commands, no process-local browser singleton import, honest process-loss behavior. `bun run host` produces an actionable error if production assets are absent; it must not quietly start a dev server or fetch dependencies.

### W4 — Connect web projection, lobby and reconnect

**Add:** `apps/web/src/multiplayer/{client.ts,reconnect.ts,session.ts}`, `apps/web/src/ui/multiplayer/{HostLobby.tsx,JoinRoom.tsx,Presence.tsx}` and focused tests. **Change:** `apps/web/src/App.tsx`, store entry/projection, startup routing and settings/auth storage boundaries. Use a self-hosted QR encoder dependency with recorded license; no remote QR image service.

**Accept:** native QR and manual join; host capability never in QR; up to three admitted phones, fourth phone refused; ready/role ownership and name/color/icon labels; role switch is local; no LAN rAF stepping; reconnect does not duplicate a tap; pageshow/visibility resync and stale state are visible; host refresh retains Bun mission; phone refresh has re-pairing recovery if storage is unavailable.

### W5 — Deliver design consoles and revision-bound collaboration

**Add/change:** role sheets under `apps/web/src/ui/multiplayer/`, built from the redesign's Workshop sections (`ui/workshop/*`), resource badges (`ui/hud/*`) and CAPCOM card (`ui/guide/*`); protocol note/proposal/sign-off consumers. **Change:** `apps/web/src/i18n/locales/en.json`, `pt-BR.json`, i18n key registry/parity tests as required by the existing convention.

**Accept:** every role can perform its actual modeled design work from a 320 px phone; before/after deltas and role resources visible; simultaneous quotes conflict safely; affected-only approval invalidation; concerns optional and attributed; baseline freeze/verify/launch remain explicit and core-gated; no duplicate mandatory reviews or a second general-purpose proposal system.

### W6 — Deliver flight consoles and shared-screen integration

**Change:** the redesign's flight deck (`ui/flight/{Hotbar,Timeline,DecisionOverlay,EventToasts}.tsx`), Workshop flight sections, `useMissionPose()` (snapshot interpolation), multiplayer role sheets and localized connection/refusal text. Follow [guided immersive redesign](GUIDED_IMMERSIVE_REDESIGN_PLAN.md) components and intent contracts; do not redesign its surfaces independently.

**Accept:** both Earth and Mars command paths report accepted/queued/executed truthfully; role-owner commands, host resume and shared decision pauses work; no pause on phone tab switching alone; disconnected controller takeover is explicit and audited; Aspiring learning and Expert on-demand explanations retain their distinct cadence; big screen preserves scene/resources/next step and does not mirror phone clutter; host-only continuation preserves physical/audit state.

### W7 — Document and demonstrate the supported deployment

**Change:** `README.md` static/no-backend and “not online multiplayer” wording to distinguish **static solo/hot-seat** from **local-server LAN co-op**, not imply internet play; `docs/ARCHITECTURE.md` authority/persistence/deployment; `docs/MISSIONS.md` collaboration; `docs/MISSION_FLOW_REFINEMENT_SPEC.md` no-online row, roles/handoff/reading-pause and roster rules; `docs/LAYOUTS.md` host vs phone; `docs/SIMULATION.md` clock/transport distinction; `docs/VERIFICATION.md` observed evidence only; `docs/INDEX.md`, `docs/research/void-protocol-reuse.md`, `CREDITS.md` and any root run instructions. Update project changelog only if an existing applicable changelog is present; do not create a redundant log.

**Accept:** a judge can prepare dependencies/assets while online, disconnect internet, launch one command, choose the reachable interface, scan and complete a design + flight transaction on phones. Runbook explains firewall/private Wi-Fi/hotspot, manual join, room cap, HTTP threat boundary, suspension, disconnect/takeover and static fallback. “Verified” entries name actual browsers/devices/network/build; documentation never presents this plan as completed testing.

## 12. Verification plan (to execute during implementation)

No checks below were executed for this plan.

1. **Pure session/protocol unit tests:** malformed/unknown fields, oversized strings/arrays, non-finite numbers, invalid catalog IDs, forged actor/player/ALL, wrong role, stale revision/quote/roster/attempt/epoch, all-or-nothing batches, role-specific sign-offs, affected-only invalidation, freeze/verify/launch atomicity, duplicate launch and duplicate intent IDs with same/different payloads. Note normalization preserves Portuguese accents and safely removes control/bidi layout spoofing.
2. **Host deterministic replay tests:** recorded seed + accepted ordered intents + step durations reproduce canonical design/sim/events/audit; identical commands delivered through different network/frame scheduling produce the same accepted-order result. Exercise dt remainder, high warp, auto-pause boundaries, command expiry, Mars contact/light time and crew ONBOARD procedures. Replay is not a claim that different competing-command orders must converge.
3. **Clock/authority tests:** no client can supply dt/resource state; server stall/laptop-sleep simulation pauses without unbounded catch-up; cancel/reset/rewind invalidates old jobs; pause-reason removal never resumes; host browser and phones never step a second live sim.
4. **In-process transport integration with emulated clients:** one host + three phones; fifth device refused, concurrent join race, pending-admission cap, one socket per credential, ticket replay/expiry/wrong-room/revocation, origin/host rejection, kick/new admission, slot grace/release, stale protocol/build, raw frame/rate/queue bounds and slow-socket backpressure. Use dummy credentials, an isolated local fixture and no production endpoints.
5. **Lost-ACK/reconnect scenarios:** apply sign-off/command then drop before ACK; reconnect returns saved result once. Drop before receipt: no phantom approval. Lock/unlock, airplane mode, reload, tab replacement, bfcache/pageshow, server epoch change, late join during design/flight, reconnect after role transfer and mid-decision loss. Verify immutable original actor attribution and no automatic resume or replay.
6. **UI/browser automation:** host+three isolated browser contexts, 320 px portrait/landscape, en/pt-BR, keyboard/focus, zoom, reduced motion, static mode with server unavailable, explicit manual joining, storage denied, unknown API feature detection. Emulation does not establish phone OS background/network behavior.
7. **Mandatory physical LAN rehearsal:** main laptop + at least one actual iOS Safari phone and one Android Chrome phone, total four devices with a third phone where available. Record OS/browser versions, selected interface/private subnet, firewall and AP/hotspot topology. Disable WAN while keeping LAN active; load a fresh phone page, complete a revision-conflict design trade/sign-off and exercise First Light flight plus Mars delayed command receipt. Test lock/background/reconnect, host refresh, phone disconnect/takeover, full room and QR/manual path. Separately demonstrate host-only and static solo fallback. Do not substitute “same computer tabs worked” for this gate.
8. **Latency/payload observation:** measure phone tap → room result and host display update; record median/p95 on the demo LAN, snapshot byte size and slow-client memory behavior. Proposed interaction goal is p95 <250 ms for room receipt feedback under normal LAN conditions, excluding modeled spacecraft delay; **[INFERENCE]**, not a measured result. Avoid latency compensation/optimistic resource prediction unless observations establish a need.
9. **Main-agent implementation verification:** run the repository's typecheck/tests/build and new focused suites once the complete implementation lands, following the repo's verification policy. Record actual results in `docs/VERIFICATION.md`; do not broaden or repeatedly rerun checks merely because this plan lists possibilities.

### Judge/demo operating sequence

Before arriving: install dependencies, prepare/build local assets, confirm Bun availability and rehearse on an operator-controlled Wi-Fi router with internet disconnected. At the table: connect main computer and phones to the same peer-access network, run `bun run host`, select the private interface and allow its chosen TCP port on the private firewall profile. Open the locally bootstrapped main display, show QR, admit/name/assign three phones, Ready, then design a spacecraft together and explicitly launch. Demonstrate one affected-role sign-off invalidation and one actual queued/executed command. Keep a readable URL and manual token route visible. If venue isolation blocks clients, use the rehearsed local router/hotspot; if that also fails, show host-only/hot-seat honestly rather than describe unavailable multiplayer as working.

## 13. Risks and decisions needed

| Risk | Mitigation / evidence still required |
|---|---|
| Session extraction changes existing solo or physics behavior | Keep core deterministic and one session reducer, migrate every mutation, compare existing behavior through regression tests and recorded replay. |
| Phone suspension or Wi-Fi causes surprise mission loss | Presence deadlines, no phone clock, pause on confirmed controller loss, explicit takeover and fresh snapshot/results. Physical iOS/Android verification required. |
| Guest network isolates clients or firewall blocks listening | Rehearsed independent LAN, exact-port/private-profile instructions and static/host-only fallback. Venue topology remains **[INFERENCE]** until tested. |
| LAN HTTP is mistaken for secure public multiplayer | Explicit trusted-LAN threat boundary, no sensitive data, narrow binding and admission; approve trusted TLS separately for hostile networks. |
| New browser LNA/OS policy affects onboarding | Serve app/socket from same LAN origin, handle denial, pin and record supported browsers, rehearse without security flags. Actual fleet behavior remains **[INFERENCE]**. |
| Snapshot/history payload grows during long missions | Explicit bounded DTOs, paged core evidence, latest-snapshot coalescing, queue/rate caps; measure before introducing deltas. |
| UI redesign and multiplayer invent competing state/control contracts | Reuse the redesign's resource badges, CAPCOM card and quote components (redesign wins on conflict) and local visual state; network all mission intents through the same session authority. |
| VP reuse expands into an unrelated game server or incomplete loop | Only pinned narrow extracts/patterns above, with tests, headers, credits and current integration proof. |

### Decisions needed from the user

Implementation groundwork proceeded with these recommended defaults on 2026-11-15 after the owner's request to break ground on LAN multiplayer. The original decisions remain recorded below; actual iOS/Android and network qualification in decision 6 is still pending:

1. **Approve A and local installation:** local Bun authoritative server on the main computer, static solo kept, no internet rooms or host migration. Default **yes**.
2. **Confirm the four-device interpretation:** main display counts toward the maximum, leaving three phones; no fifth read-only display. Default **yes**, as specified by this plan.
3. **Confirm trusted-LAN HTTP scope:** use an isolated demonstration network and accept plaintext/no wake-lock/clipboard/service-worker dependency, or require trusted HTTPS/WSS provisioning before release. Default **trusted LAN HTTP**, clearly disclosed.
4. **Approve disconnect/pause policy:** confirmed teammate-controller loss pauses; host explicitly waits/takes over and resumes; auxiliary solo-phone loss does not pause; optional personal reading is local, with explicit team pause and shared automatic Aspiring learning stops. Default **as written**.
5. **Approve ownership/admission model:** host-approved devices, one owner per role, multiple roles per device, explicit solo-with-phones mode, advisory concerns rather than binding votes, host session coordination but no hidden role bypass. Default **as written**.
6. **Confirm supported demo environment:** operator-controlled peer-access router/hotspot and actual iOS Safari + Android Chrome minimum test matrix; identify any required Windows/macOS host packaging beyond the Bun CLI. Default **CLI on the prepared host, no native installer**.

The owner's subsequent implementation request authorized the groundwork; these recommendations and verification gates still define the complete implementation. W5/W6 and unexecuted device/network acceptance must not be reported as completed.
