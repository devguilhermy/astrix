# Layouts and workspace interaction

The **persistent 3D space scene is the main surface**. Mission selection, preparation, turns and debrief are panels over it, not a scrolling page that pushes the scene out of view. This is the user's explicit immersive-game requirement. `ui/play/PlayApp.tsx` owns the current contextual panels while the scene remains mounted. Functional and visual evidence belongs in [Verification](./VERIFICATION.md).

## Landing and brand

The public landing (`ui/landing/Home.tsx`) precedes the simulator and retains the display-led introduction, mission overview and challenge explanations. ASTRIX11 uses the supplied `public/assets/logo.png`, deep blue surfaces and orange primary actions. Storage keys, package names and saved mission IDs do not change with the displayed brand.

**One header.** The simulator and every public page (landing, mission-design lesson, `/science`, `/quiz`) use the same bar from `ui/header/header.css`: 56 px, logo at left (returns to the landing), tabs in the middle, tools and the language toggle at right. Below 900 px the tabs wrap to a full-width second row. Public pages render it through `ui/landing/SiteHeader.tsx`, whose tabs are Explore (`#solar`), Discovery journal (`#journal`), GMAT tools (`/gmat`), Science & sources (`/science`) and Quiz (`/quiz`); the active public page carries `aria-current="page"`. The lesson adds *Skip lesson* as a header tool. All tabs are real links: plain clicks route in-app, modified clicks keep the URL.

**Science & sources** (`/science`, `ui/docs/DocsPage.tsx`) renders the shipped `docs/*.md` as pages: `/science` is `INDEX.md`, `/science/<path>.md` is `docs/<path>.md`. Links between docs stay in the route, `#section` anchors use GitHub-style heading IDs, and each page links to its raw Markdown. Paths with `..`, hidden segments or non-`.md` files show "Document not found". Mermaid blocks are shown as source. The Markdown renderer is a lazy chunk.

**Link previews.** `index.html` carries a description, OpenGraph and Twitter card tags. The 1200×630 banner `public/assets/og-banner.png` is the logo on white. Set `ASTRIX_SITE_URL` when building to make the image URL absolute and add `og:url`; crawlers ignore relative image URLs.

Entering opens `#solar`: free exploration of the Sun, eight planets and Moon, with accessible body selection as well as 3D picking. Choosing missions is a separate action. Earth, Moon and Mars open the supported mission board; the other bodies are exploration-only. Spacing, radii and positions are explicitly schematic, not a live ephemeris. Returning to the landing **closes** the simulator: it unmounts, and the local mission, view, destination and Design & Play settings start fresh on the next entry. Display preferences and the visit's discovery journal are kept.

## Explore → Design & Play

The mission board groups destinations and offers a small initial selection with more missions available on demand. Both levels have the same first-class **Design & Play** entry. The goal is chosen on the board, before equipment; mission cards explain the discovery rather than requiring the player to understand spacecraft architecture first. Design & Play has no goal picker: it shows the selected goal, and its only navigation is a back button to the mission board.

Mission cards and the landing mission overview use decorative spacecraft/orbit/launch diagrams (`ui/missions/MissionIllustration.tsx`), not fabricated flight samples or previews of installed hardware.

Preparation is one workspace, not a sequence of approval screens:

- The goal chosen on the board and its explicit success condition (no goal picker here).
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

Attempts are **not saved in the browser**. Nothing is written at decision boundaries; reloading or closing the simulator starts fresh. The header's *Attempt file* chip offers *Export current attempt* and *Import saved attempt* (a JSON file). Import validates the format, versions, identity and deterministic history before presenting a runnable game. On load, the slots of the retired auto-save (`astrix.play.save.v1.*`) are deleted; older pre-turn-rules drafts and missions are kept and stay exportable, never relabelled as new-rules attempts. The discovery journal lives for the page visit only.

Navigation never executes a plan. Returning to the mission restores its current committed decision. Loading, resolution and network errors remain visible; retries must not double-commit. A live LAN room is the only state that outlives a browser refresh.

Starting another mission or importing a file while an attempt is in progress uses the shared styled modal, not browser-native confirmation; it says the current attempt is not saved. Cancel, Escape and backdrop dismissal do not change the attempt. Focus is contained while open and returned on close; only explicit confirmation can run the guarded replacement.

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

## 2026-11-15: denser shell, board, turn card and mission report

Details and measurements: [major improvements recap](./recaps/MAJOR_IMPROVEMENTS.md) §4.4, §4.9 and §7.2.

- **Shell (desktop):** header 56 px; resource grid at top 64 px, 60 px tall, one row per cell; mission panels start at 64 px, or 132 px when the resource grid shows. There is no toolbar row and no footer row: "Hide panels", "Quick tour" and the save chip (Export, Import, GMAT tools) are in the header.
- **Board:** `min(1040px, 62vw)`; destination tabs (Sun, Earth, Moon, Mars) and the level toggle in one row; three offer cards; "More missions" as compact cards.
- **Level toggle:** a labelled group of two `aria-pressed` buttons, Aspiring and Expert.
- **Preparation:** ambition, kit and approach as three-column option cards.
- **Turn workspace:** the right panel leads with the "Last turn" card in a polite live region; it collapses to one line while a plan is selected.
- **Mission report:** left result panel (score, objectives, actions), right detail panel (Turn, Science, Compare), bottom timeline dock of 176 px. At 901-1279 px the two panels sit side by side with the timeline below; at 900 px and below a Result / Turns / Science switch shows one sheet.
- **Explore:** the fact panel occupies the right panel slot (a bottom sheet on phones); the ship HUD is top left while aboard.
- **Class prefixes:** `scene-fb-`, `fb-`, `report-`, `jr-`, `dossier-`, `solar-scale-`, `explore-` each belong to one style sheet.

## 2026-11-15: preparation lists, turn action cards and the quiz page

- **Preparation:** ambition is three icon toggles with a one-line note for the selected value. Mission kit and approach are vertical lists, one option per row: a 36 px icon tile, the name, a one-line description and a tick on the selected row. Rows keep a fixed order (Lightweight, Endurance, Science payload) whatever the engine lists first. The radios stay in the tab order; arrow keys move the selection and the row shows the focus ring. At 1920×940 the choices panel fits without scrolling for First Signal (862 / 862 px).
- **Turn actions:** two-column cards, at least 60 px tall, with an icon tile, the action name and a short description linked to the radio by `aria-describedby`. Below 520 px the description is hidden visually and stays available to assistive technology and as the tooltip.
- **Quiz (`/quiz`):** a public page with the shared site header, at most 880 px wide. Topic and mode are pressed-state toggle groups. One question at a time with lettered options, a polite live region for the answer and its reason, and Previous / Next; focus moves to each new question. The result shows the score and every answer, missed ones marked. At 320 px there is no horizontal overflow and targets are at least 44 px.
