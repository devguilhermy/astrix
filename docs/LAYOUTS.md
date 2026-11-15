# Layouts and workspace interaction

The **persistent 3D space scene is the main surface**. Mission selection, preparation, turns and debrief are panels over it, not a scrolling page that pushes the scene out of view. This is the user's explicit immersive-game requirement. `ui/play/PlayApp.tsx` owns the current contextual panels while the scene remains mounted. Functional and visual evidence belongs in [Verification](./VERIFICATION.md).

## Landing and brand

The public landing (`ui/landing/Home.tsx`) precedes the simulator and retains the display-led introduction, mission overview and challenge explanations. ASTRIX11 uses the supplied `public/assets/logo.png`, deep blue surfaces and orange primary actions. Storage keys, package names and saved mission IDs do not change with the displayed brand.

Entering opens `#solar`: free exploration of the Sun, eight planets and Moon, with accessible body selection as well as 3D picking. Choosing missions is a separate action. Earth, Moon and Mars open the supported mission board; the other bodies are exploration-only. Spacing, radii and positions are explicitly schematic, not a live ephemeris. Returning to the landing hides rather than destroys the mounted simulator.

## Explore → Design & Play

The mission board groups destinations and offers a small initial selection with more missions available on demand. Both levels have the same first-class **Design & Play** entry. The goal comes before equipment; mission cards explain the discovery rather than requiring the player to understand spacecraft architecture first.

Mission cards and the landing mission overview use decorative spacecraft/orbit/launch diagrams (`ui/missions/MissionIllustration.tsx`), not fabricated flight samples or previews of installed hardware.

Preparation is one workspace, not a sequence of approval screens:

- Destination-compatible goal and explicit success condition.
- Ambition with actual target, allowance and deadline.
- A few paid hardware kits.
- A compatible operating approach with reserve/output tradeoffs.
- One **Play mission** action after the current configuration is certified.

Cost, fit and constraints update together. Selecting a new configuration cancels or invalidates stale worker results. A compatibility badge is not a feasibility certificate. Checking, no proof, blocked, Ready and Stretched states must be legible; there is no fabricated progress percentage. A failed check never silently substitutes an easier goal or more capable kit.

## Turn workspace

The stable workspace shows the mission objective, elapsed mission time and current decision. It presents no more than four relevant plans, one selected preview and one named commit action. The preview explains time, resource deltas and boundary. Commit publishes a complete receipt; a selection alone does not move the spacecraft.

Compact plan-action toggles and the single guarded commit stay visible below or beside the turn panels, even while panel content scrolls or is collapsed. Choosing a toggle selects a preview; only commit advances the mission. Camera controls occupy a separate scene-safe area.

During a mission the persistent seven-resource grid shows mass, power, budget, data, communications, time and crew from core budgets and committed telemetry. Icon labels, values, units and status text accompany the bars; unknown and not-applicable values remain explicit. It stays outside scrolling/collapsed panels, and compact layouts reserve scene space below it. Fuel remains available in mission details and turn receipts. Imminent warnings and consequence previews remain visible rather than being replaced by the resource grid.

Routine pointing, instrument switching and contact handling belong to a disclosed operational plan. The player does not manage warp, pause/resume, manual burn vectors, stages, signoffs or subsystem paperwork. The scene remains visible beside the turn panels and renders the installed spacecraft and model-derived context; its camera cannot change the physical outcome.

## Consequence, debrief and discovery

A receipt names what changed, what interrupted the plan and what the next choice can affect. Terminal debrief shows actual objective evidence, result, assistance and an explanation/next experiment. Same-condition retry preserves configuration and seed; a changed design is a different experiment. Aspiring checkpoint retry is marked assisted.

The discovery journal records simulated achievements and qualified comparisons. It is not an economy, unlock grind or claim that the player acquired real NASA data. Historical images, sources and mission parallels remain labelled contextual material.

## Persistence and recovery

Local save controls expose the saved committed boundary, export/import and explicit continuation. Two-slot writes commit the pointer last so a failed write preserves the prior selected save. Restore validates the format, versions, identity and deterministic history before presenting a runnable game. Corrupt/incompatible content is explained and remains exportable; an old user definition is not silently relabelled as a quick mission.

Navigation never executes a plan. Returning to the mission restores its current committed decision. Loading, resolution and network errors remain visible; retries must not double-commit. Local browser persistence and a live LAN room are separate recovery mechanisms.

Replacing a saved attempt or importing over it uses the shared styled modal, not browser-native confirmation. Cancel, Escape and backdrop dismissal do not change the attempt. Focus is contained while open and returned on close; only explicit confirmation can run the guarded replacement.

## Optional tools

The menu and debrief retain GMAT tools outside the normal play path. Supported initial-state import explicitly opens a compatible preparation candidate, then ordinary constraints and certification run again. Export is an initial-state export, not a complete maneuver script. The GMAT tools page (`/gmat`, also linked from Home) keeps import/export in the left document panel and draws the subject in the 3D view, with a caption (body, UTC, altitude, orbit details) and a playback transport in the scene's open area. External ReportFile/OEM samples keep labelled frames/units and explicit gaps; they do not become scored flight history.

Help offers scientific explanations and model limits without a mandatory tour. Hints can be disabled. Source evidence and exact numerical details remain available without turning Expert into the removed studio workflow.

## Responsive and accessible behavior

Semantic DOM panels are the gameplay control surface over the persistent 3D scene. Desktop panels have bounded internal scrolling and leave the central scene visible. Compact layouts keep a visible scene region above bounded turn sheets; scrolling panel content does not scroll the scene away. Text wraps and controls remain reachable at 320 px. No drag or 3D click is required to choose a mission plan.

Native buttons, radio/select controls, labels, visible focus, skip navigation and live error/status text provide the keyboard path. Optional dialogs return focus to a connected opener; expanded details keep their native keyboard semantics. Both English and Brazilian Portuguese are maintained. Reduced motion disables decorative movement without changing outcomes; playback and context never consume a turn.

## Multiplayer surfaces

`/host` handles authenticated bootstrap, invitations, admission and role assignment, then enters the shared mission board/workspace. `/join` handles pairing and the controller's current decision. A controller proposes; the host commits. There is no unanimous Ready/signoff ceremony at each turn.

Disconnected/stale clients cannot submit actions or start an independent local game. Reconnect restores the latest state and known intent result, never automatically repeats a tap. Device-local Help, language and presentation preferences do not become shared mission commands. See [Multiplayer](./MULTIPLAYER.md).

## Verification boundary

Typecheck, engine/session tests and production-browser workflows establish software behavior. Screenshots at desktop and compact sizes establish observed layout, not screen-reader certification. Formative human sessions are still needed to evaluate the proposed time-to-first-choice, comprehension, enjoyment and replay-intent targets in the [revision plan](./plans/TURN_BASED_EXPLORATION_REVISION.md).
