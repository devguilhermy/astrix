# Implementation verification — 2026-11-14 / 2026-11-15

This records observed checks, not inferred product claims. Challenge alignment is tracked in [CHALLENGE_ACCEPTANCE.md](./CHALLENGE_ACCEPTANCE.md). The application is served as a production static build for browser verification; no app state was injected to manufacture mission outcomes.

## Guided immersive redesign — rules v4 (2026-11-15)

This section records the Line B redesign ([plan](./plans/GUIDED_IMMERSIVE_REDESIGN_PLAN.md)) and supersedes the layout, scene and pointing observations in the older sections below. Browser checks used the production static build (`vite preview`) in headless Chromium with real clicks, keys and touch emulation; no mission state was injected.

### Automated checks

- `bun run typecheck` passed. `bun test` passed **234 tests, 0 failures, 35 files**. New coverage includes the rules-v4 attitude/forecast/solar-ephemeris core, real-store pilot input (including a quick tap released before the next animation frame), timeline advance stopping exactly at its requested time, terminal CAPCOM guidance, retained-brief redesign, collapse-in-place panel geometry, component details, and route recognition.
- `bun run build` passed; Vite still warns that the `three` and main chunks exceed 500 kB.

### Performance and texture residency (1440×900, device scale 1.25, same stage)

| Build | Tier | Draw calls | Textures | Decoded surface estimate | Median frame |
|---|---|---:|---:|---:|---:|
| Rules v3 baseline, Need & goals | LOW | 21 | 1 | 0 (maps not loaded) | 16.7 ms |
| Rules v3 baseline, Need & goals | HIGH | 19 | 2 | 2,796,203 B | 16.7 ms |
| Redesign, Need & goals | HIGH | 77 | 2 | 67,108,864 B (64 MiB) | 16.7 ms |
| Redesign, Build after installing the camera | LOW | 139 | 3 | 4,194,304 B (4 MiB) | — |

Frame intervals are 120 wall-clock `requestAnimationFrame` samples on a headless machine. They show the redesign holds the display rate there, not a GPU-time measurement or a Chromebook guarantee.

### Browser walkthrough (First Light, Aspiring, solo)

- Setup is one screen; the welcome tour (4 steps) and the per-surface tours ran and could be skipped. CAPCOM named "Add the Earth camera" during Build; **Show me** focused the camera card and highlighted its model slot. Installing the camera through the before → after quote, freezing, the worker-backed dry run, sign-off and launch all used visible controls. The dry run reported its outcome without creating a flight.
- Flight: chase camera by default; the timeline listed sunlight, shadow, contact and target windows; contact-gated commands queued and executed at the next pass with receipts. Decisions (storage nearly full, battery at 20 %, battery depleted, ground outage, battery life) appeared as centred overlays operable by keyboard and pointer.
- The full 14-day flight completed through the UI: 0.85 MB delivered of 1,500 MB, *Mission failed*, unassisted score 19/100. The debrief tour ran; **Redesign and fly again** reopened Build with the accepted brief and hardware retained and fresh freeze/verify evidence required.
- 390×844 (touch emulation): the seven resource badges fit within the viewport width (root scroll width 390); CAPCOM collapses to one 46 px line; the camera widget and flight deck stay reachable.
- **Component details:** clicking the spacecraft in Build opened the Component panel for the clicked slot (Deployable solar panels, *Not installed*, specifications with teaching-assumption markers). **Find in Workshop** focused that part's card, and **Close details** returned focus to the opener. The keyboard path through **Spacecraft slots → Components** opened the same panel. In flight, clicking an installed part opened its live readings from core telemetry (battery 100 %, 20 Wh, spacecraft load 2.3 W). At 390 px the panel reflows in document order without horizontal overflow. Picking needs a press and release on an equipment mesh; clicks on bare bus structure do nothing.

### Defects found in the browser and fixed

- Custom sky/planet/atmosphere vertex shaders failed to compile with `logarithmicDepthBuffer` because `<common>` was not included (production showed an empty scene).
- `new URL('../', import.meta.url)` was rewritten by Vite into an `/@fs/` path, so the app base and setup route failed validation.
- A quick keyboard or touch tap on the pilot pad was released before the next animation frame and sent no attitude target.
- Decision overlays inherited `pointer-events: none`; collapsed panel pills and the camera widget could sit under the flight deck; the pilot pad was covered by resource badges.
- The transfer map drew a second, misplaced Sun.
- After a terminal flight, CAPCOM still pointed at operating cues, and **Redesign** returned to Need & goals.

### Not verified in this pass

Storm Watch, Red Relay and Crew Pathfinder were covered by core reference flights and unit tests, not by end-to-end browser flights. Portuguese, the 320 px reflow and reduced motion were covered by parity and unit tests and earlier passes, not re-walked in the browser after the final fixes. Sky orientation against the NASA star map was checked in source and documentation, not against an independent sky chart.

## Mission Studio delivery — rules v3

This section supersedes the older profile/difficulty and free-navigation observations below. Checks used production static builds and real controls; no mission outcome was injected.

### Integrated checks and reconciliation

- Integrated run: `bun run typecheck` passed; `bun test` passed **162 tests, 0 failures, 25 files, 22,287 assertions**. Public-command reference flights exercise all four missions at both levels, including nominal crew return/recovery. After the final browser-discovered copy, independent-support-evidence and material fixes, typecheck and the affected crew/journey/locale checks passed again: **18 tests, 0 failures, 4 files, 16,268 assertions**.
- The initial integration exposed stale commissioning/command expectations, display-batch-dependent audit ordering and a Storm Watch Expert schedule with no actual station opportunity under the new absolute epoch. Tests now use real commissioning and transport; audits follow physical boundaries; the scenario authors an eight-hour allocation with actual contact. No contact geometry is waived.
- Nominal crew pilots continue support procedures through recovery. Regression coverage includes finite stores, retained-inventory conservation, airflow/atmosphere, high-warp boundaries, early return and support planning from the same core state.
- The parser's line limit counts UTF-8 bytes, not JavaScript code units; exact-limit and multibyte over-limit cases are covered.
- Browser findings led to separate fixes for the crew preflight support forecast, negative rolling-pressure roundoff, return/recovery reference-only graphics, support-requirement semantics, crew-specific goal guidance and return-window refusal text.
- Final production build passed: **571,006 JavaScript gzip bytes across five files**, including the parser worker, below the 600,000-byte limit. The Simulator remains lazy-loaded. Vite still reports large-chunk warnings; these are not build failures.
- Documentation check: 12 current pages, 200 local links/anchors resolved, balanced code fences. Final Markdown/notices were republished to the static output after authoring; this did not rebuild application code.

### Observed wizard, journey and teaching

- Home and the five-step wizard create no Canvas before submission. Empty Level progression focuses the error summary; Back and Review Change retain answers. Submission enters Need & goals, with the mission-specific title/hash and focused heading, without launching.
- Future stages are guarded. A real comparison, frozen baseline, current readiness check and approvals precede Implement; explicit confirmation starts flight. Terminal Review is unavailable during an active attempt.
- Wizard language, depth, player/role and pace choices use pressed-state toggle buttons; audio/motion use keyboard-operable switches. Level/mission remain radio cards. No wizard selects or plain checkboxes remain.
- Portuguese wizard at 320 × 740 CSS px: no horizontal overflow; toggle targets were at least 44 px high; wrapped options and role assignments remained usable.
- Aspiring received the battery introduction without Explain in Detailed presentation and contextual teaching in Guided. Expert showed only Explain in both depths; opening it exposed the same definition, current design values and limitation.
- Actual encounters covered goal/process/requirements/maturity, design quotes, power, data, pointing, communication, queued-versus-delivered commands, CubeSat deployment, crew support/return, model legends, imported orbits and review. Expert fuel help showed the current dry mass/capture gap and source assumptions.
- Two-player Red Relay: recorded a Power concern with role/revision, accepted a mapper quote with factual mass feedback, rotated facilitator, and handed controls explicitly to Player 2. Science could not plan fuel; Spacecraft then received the actual missing-engine refusal. No unauthorized change was applied.
- Explain during a queued flight left resources, receipts and Canvas identity unchanged, restored focus on Escape and did not resume. Aspiring's separate Resume continuous playback started time explicitly; Pause stopped it.

### Actual browser flights and review

| Attempt | Observed result |
|---|---|
| First Light, Aspiring | Real purchases, launch, onboard deployments and delivered commands; 1,500 MB returned, full 14 days, SUCCESS, 89/100, unassisted |
| Crew Pathfinder, Aspiring | Real observations/downlink, deorbit at 15 h, 10-second burn and six-hour recovery; 100 MB, SUCCESS, 92/100, unassisted; nominal 72-hour duration separately failed as an early return |
| Crew Pathfinder, Aspiring, no observations | Deorbit at 12 h, burn and recovery completed at 64,810 s; 0/100 MB, mission failed, 19/100. Healthy recovery must not imply science success |

Repeating the no-observation early return in the final rebuilt browser confirmed **CREW-SUPPORT-01 Pass**, **SCI-DATA-01 Fail**, **CREW-DURATION-01 Fail** and overall **Mission failed, 19/100**. Support evidence is independent of the science objective.

Review exposed actor receipts, actual execution times, retained sample ranges, independent requirements and explicit limits on causal inference. The history slider selected recorded scene time without changing final resources or replacing the Canvas; Return to final view restored the terminal presentation. Crew return/recovery hides the vehicle position and labels the remaining orbit as reference-only; the support clock and stores continue.

These are not eight full browser flights. All eight mission/level reference variants were exercised through public core APIs; the table identifies the completed UI flights in this delivery.

### GMAT and external trajectories

- Actual OEM upload: Earth EME2000/UTC, two segments/five samples. Native time control selected 66 s in a gap: no vehicle state was invented. Closing restored the unchanged paused attempt and the same single Canvas.
- Actual ReportFile upload: `Probe`, Mars, four irregular samples at 10–250 s intervals. A time inside the 250-second gap correctly showed no state. The viewer had no game resource rail or score.
- Actual prelaunch exact script import, on Custom Earth launch: epoch `2024-05-01T00:00:00.000Z`, SMA 6798.137 km, e 0, inclination 51.6°, RAAN 73°, AOP 116°, TA 205°. Downloading initial conditions preserved all of those fields.
- Actual unsupported ITRF OEM, full propagation script and input over 10 MiB were refused without changing resources or adding a Canvas.
- NASA GMAT R2025a executed exported Earth/Mars scripts. Selected initial positions agreed within 1e-6 km. Raw velocities differ because body constants differ; no 1e-8 km/s raw-velocity pass or full-dynamics equivalence is claimed. Exact results: [GMAT validation](./research/gmat-validation.md#initial-condition-export-comparison-2026-11-14).

### Graphics, resource presentation and limits

- Rebuilt crew entry created one valid WebGL2 Canvas, with no Clock warning or recorded page error. Seven resource summaries distinguish forecast/live values, W/Wh, returned/stored data, service/visibility/transmission and crew store runway/working atmosphere.
- Crew preflight showed the actual paid stores: water-limited 5.05 days versus a 78.003-hour plan including burn/recovery. Live recovery consumed supplies rather than completing instantly. Rolling gas readouts no longer displayed a negative numerical residue.
- At 320 CSS px the rebuilt live crew page had root/body scroll width 320, with the primary action 44 px high and all resource categories reachable.
- Earth and Mars local textures decoded at 1024 × 512. Each RGBA image is 2 MiB; the mipmapped estimate is 2,796,203 bytes per body, not a measured GPU allocation. Asset-specific credits and historical/projection qualifications are in [CREDITS.md](../CREDITS.md) and [RENDERIZATION.md](./RENDERIZATION.md).
- A geometric texture/station probe covered 16 Earth/Mars epoch/rotation cases; maximum UV discrepancy was 0.000195 on the faceted display sphere. This is not high-precision IAU geolocation.
- Continuous crew playback at 1×, 1440 × 1000 drawing buffer: 120 frame intervals, median 16.7 ms, mean 17.37 ms. The earlier First Light baseline was a different scene and its tier was not recorded; these samples cannot establish a controlled speedup or universal device performance.
- A downloaded texture alone did not prove textured rendering: actual Mars viewer inspection found a gray sphere. The asynchronous map transition now marks the shared material for shader recompilation and requests a demand redraw. Final rebuilt screenshots showed visible Viking surface detail in the Mars viewer and Blue Marble geography in the crew reference-orbit scene, with a valid WebGL2 context.

### Validation boundaries

No novice participant study, independent Portuguese science review, screen-reader session or physical mobile-device test was performed. Reflow checks use Chromium viewport emulation; current touch/coarse-pointer behavior was not re-established (the emulation controls did not activate a coarse pointer). The checks above do not establish exhaustive delivery of every optional lesson in every fault state. Local shared-screen collaboration is not networking. The product remains a bounded educational game: no arbitrary custom mission authoring, general GMAT execution, atmospheric-entry trajectory, hardware qualification or medical outcome model.

## Refinement verification — workflow, profiles and immersion

This section records the refinement in [SIMULATOR_REFINEMENT_SPEC.md](./SIMULATOR_REFINEMENT_SPEC.md). The historical sections below describe the earlier build and were not rerun one by one.

### Automated checks (integrated run after the final core and UI fixes)

- `bun run typecheck`: passed.
- `bun test`: **141 passed, 0 failed, 16 files**. This includes 18 playable reference cases (3 missions × Educative/Technical × 3 difficulties) flown through public commands only.
- The first integrated run failed 8 cases. Those failures were diagnosed, not relaxed:
  - **First Light Technical** reached day 14 healthy but returned 835.8 MB. The 420 km station allocation gives about 110.5 contact minutes in 14 days, which caps a two-radio design near 995 MB. The reference recipe now buys four radios. That needed the Technical budget allowance raised from ×1.3 to ×1.5; the change is disclosed in [TECHNICAL_MODELS.md](./TECHNICAL_MODELS.md).
  - **Red Relay Technical**: the wide capture orbit needs 426.8 Wh of eclipse reserve, more than the 204 Wh available. The reference recipe now uses the existing 10,000 km apoapsis orbit (171.3 Wh demand). A regression test keeps the wide-orbit refusal in place.
- Local documentation check: 12 pages, 384 links and anchors resolved, code fences balanced.
- After the final UI copy change, typecheck and the i18n parity tests passed again.

### Build

`bun run build` passed. JavaScript is **502,611 gzip bytes across 4 chunks**, below the 600,000-byte limit. The Simulator chunk is lazy-loaded. Vite still warns about chunk size; this is not a build failure.

### Defects found in the real browser and fixed

- **False WebGL failure on entry.** Every entry showed "WebGL renderer could not be created". Inspection showed a valid context: WebGL2, not lost, 1440×1000 drawing buffer. The cause was the canvas fallback content, which ran a failure effect even while WebGL was working. That fallback no longer has side effects. Real creation failures are now reported from the renderer factory.
- **`THREE.Clock` deprecation warning.** The warning comes from React Three Fiber 9.8.2, the latest stable release, which still constructs `THREE.Clock`; three r183 deprecates it. three and `@types/three` are pinned to `~0.182.0` until Fiber stops using it. The production three chunk reports revision 182 and contains no deprecation string. After entering the dev server with fresh dependencies, its console showed no Clock warning.
- **Window numeric geometry crash.** Typing a width crashed `WindowOptions` with "Cannot read properties of null (reading 'valueAsNumber')", because the event was read inside a deferred state updater. After the fix, width 520 / height 440 applied.
- **Launch left the player in Engineering.** A successful launch confirmation now switches to Control → Operations and the live scene. Tab selection alone still never launches. The store tests were updated to this intended behavior.
- After launch, the review panel's empty-state text no longer says "before launch".

### Production browser evidence (static build, real controls, no injected state)

- **Home → Enter simulator → workspace:** one canvas, no failure modal. The header shows the mission, the profile/difficulty/rules identity, and "Setup — not launched" with a single primary action.
- **First Light, Educative, Engineer, starter design:**
  - Review launch → Confirm launch moved to Control/Operations. The header showed "Paused · manual pause" with "Advance to next event"; the scene changed from the assembly workbench to the operational orbit.
  - Advancing reached a real "Station in view" decision with the clock paused.
  - "Send home" was refused with "There are no stored measurements to send yet", which is correct for a starter design with nothing stored.
  - "Keep current commands" resolved the decision.
  - Self-paced advances reached day 3.06. A full 14-day run was not completed in this session.
- **Mission and profile during flight:** opened a preview labelled "active flight paused". Selected Red Relay + Technical, and starting created a new setup attempt.
- **Red Relay, Technical, Engineer, starter design:** Review launch kept Confirm disabled and listed quantified refusals with Explain links:
  - mapper and heater required;
  - EOL usable battery 102 Wh below eclipse demand 162.469 Wh;
  - cold/hot equilibria 248.582/294.386 K outside 260–330 K;
  - capture capability 0 km/s below the 0.992 km/s upper requirement (nominal 0.919);
  - four outstanding role sign-offs.
- No page errors were recorded in these production sessions.

### Interaction evidence (dev and production browser, real pointer/keyboard input)

- **Home:** no canvas. Explain opens a modal with the background inert, and Escape returns focus to the trigger.
- **Loading → workspace:** one canvas node is kept across all four stages. Before launch, Control/Results say honestly that no flight exists. Switching stages kept the run at "Setup — not launched".
- **Camera:** native drag works, as do the rotate/zoom/fit/reset buttons. Settled scene pixels below y=400 were identical before and after a cancelled mission preview, and after a Planning → Engineering revisit, so the user's camera orientation is kept.
- **Windows:**
  - All three windows minimize to the top dock and restore with their geometry kept. Body scroll (136 px) and focus also return.
  - Numeric apply works (520×440), as do arrow-key moves (x 10→20) and pointer resizes (520×440 → 580×470).
  - Escape cancels a drag or resize exactly.
  - "Show me" restored the minimized readiness window and focused `#data-budget`.
- **Flight:** Confirm launch switched to Control/Operations. Opening Explain while running paused the flight; Escape kept it paused and returned focus to Explain. Camera and window gestures left the paused flight header and body unchanged (elapsed 0.019 d, same resources).
- **Viewports:** at seven sizes down to 320×256, the root and body width matched the viewport. Focused lower controls and the sticky Review launch action stayed reachable.
- **Touch (production, 390×844 Chromium emulation):** Explore 3D turns on `touch-action:none` on the canvas, and Done restores `pan-y pinch-zoom`. The equivalent camera buttons work.
- **Limits:**
  - Rapid mission selection and cancellation was observed, but the chooser modal covers the scene, so the screenshots do not separately establish all three scene geometries.
  - Touch and viewport checks used Chromium emulation, not a real iOS device or assistive technology.
  - No full mission was completed in the refinement browser sessions. Full-length outcomes are covered by the 18 core reference flights.

## Automated checks

- `bun run typecheck`: passed.
- `bun test`: **102 passed, 0 failed**, 14 files, 90,767 assertions in the integrated run.
- The core playability tests execute all three missions at all three difficulties through public commands.
- The deterministic flight trace was generated once with `UPDATE_GOLDEN=1`, then matched in the normal core suite.
- Snapshot tests reproduce the raw RadLab statistics and 48-hour profile; source bytes are SHA-256-bound to acquisition metadata. No fabricated acquisition fallback was used.
- Locale and science checks cover matching English/Portuguese keys/interpolation, 39 shipped topic entries, scientific context bindings and source/assumption resolution.
- After a browser-discovered false Mars product match, the title-matching regression was expanded to include **Venus's Themis Regio**; the extractor now excludes explicit other-world targets before instrument matching. The targeted 8 snapshot tests and typecheck passed after that fix. Matching remains explicitly heuristic, never verified per-record mission attribution.

## Build

`bun run build` produces `apps/web/dist`. The root commands were corrected to Bun's `bun run --cwd apps/web <script>` argument order.

Final observed application build after the guided-path display adjustment: **446,728 JavaScript gzip bytes across three chunks**, below the 600,000-byte limit. The build also checked that licence, credits, third-party notices and verification/implementation documents were present in the static output. Vite warns that individual uncompressed chunks exceed 500 kB; this is not a build failure. Fonts and runtime scientific snapshots are local files/imports; no data API is called at game runtime. Canonical documentation was authored afterward without application-source changes; preparing/copying those Markdown files does not revalidate browser behavior.

## Independent scientific reference

NASA GMAT R2025a successfully executed [scripts/validate-orbits.script](../scripts/validate-orbits.script). See [gmat-validation.md](./research/gmat-validation.md) for exact observed periods, speeds and numerically propagated Earth–Mars transfer time. Core physics tests compare against this independent reference with tolerance for rounded fact-sheet constants. This is not certification of a flight trajectory or actual spacecraft hardware.

## Browser evidence

### First Light — English, Engineer, solo

Built through visible comparison controls: remove basic radio/body panels; add fast radio, larger panels, extra battery and Earth camera. Hardware cost 102/120 game budget units. Launched and operated with explicit pointing, camera toggle and downlink during a real computed contact.

Observed completed report: **1,706.25 MB returned toward a 1,500 MB target, 87/100 score, 14 days**. No runtime console errors were recorded in that session.

### Storm Watch — Portuguese, Cadet, solo, production build

Started from the charged-for editable bus, added the radiation monitor and operated with Sun pointing. Handled the first contact, storm start, objective achievement, ground outage, storm end and battery aging through the actual contextual decision controls.

Observed completed report: **48 of 24 required measurement hours, 92/100 score, 21 days**, hardware cost 64/130 difficulty-adjusted budget units. Scientific help during the storm was fully Portuguese, distinguished real ISS readings from assumptions, and explicitly said safe mode is not shielding.

### Red Relay — English

- **Actual failure path:** launched a design with an engine but no capture propellant; analytically advanced cruise and explicitly confirmed capture. The report correctly recorded **CAPTURE_FAILED**, required about 0.919 km/s versus 0 available, and no invented successful orbit. Score 24/100.
- **Two-player redesign:** assigned roles, upgraded arrays and battery, added mapper and propulsion, used the fuel planner and collected all four sign-offs. The Launch role was refused when attempting the Spacecraft role's fuel edit; switching roles made the preview available.
- **Actual arrival:** confirmed the funded burn; “Mars orbit reached” acknowledged consumed fuel and the start of the operational mission.
- **Delay proof:** pointing and instrument requests showed **two pending commands**, a **13.3-minute one-way delay**, and the instrument still Off before delivery. Both later showed Delivered before science collection.
- **Actual data return:** after collecting maps, the Science role requested instrument Off, Spacecraft requested Earth pointing, and Ground requested downlink. All three remained queued before their delivery timestamps. The mission later showed more than the 5,000 MB target returned, and storm start/end were handled without falsely shielding radiation.
- **Full operational horizon completed in the production browser:** 60 days at Mars after the 258.883-day transfer. Final report: **13,776.59 MB returned toward 5,000 MB; 88/100 score; hardware cost 734.56/900 game budget units**. All four role sign-offs, capture, delayed commands, storm boundaries and battery aging were exercised. The result was produced by the running simulation, not an injected success.

## Persistent space, panels and help

- Exactly one attached rendering canvas; the same DOM canvas persisted through Goal, Concept, Design, Launch, Operate, report and help in a navigation session without developer reloads.
- Space stayed visibly exposed behind opaque floating panels in screenshots of setup, flight, transfer, science help and reports.
- Actual computed panel surface: `rgb(13, 23, 39)` (opaque).
- Keyboard movement changed the mission panel from x=16 to x=26. Actual pointer capture/drag of the readiness panel outside the viewport clamped it to x=10, y≈186.7 with its full bounds inside the 1440×1000 viewport. Reset layout restored the default arrangement.
- Panel scrolling resets on phase changes. New decision events bring the mission panel forward and return its body to the top so a pause is not hidden below old scroll position.
- Explain from a decision preserved the mission timestamp, battery, data and pending decision. Escape closed the drawer without resuming. Explicit Resume was required. The same canvas remained present.
- Progress bars now distinguish goal achievement from capacity exhaustion: exceeding a science goal is not displayed as a red over-capacity error; full battery reserve is not an error. Accessibility values remain within their declared ranges while the text retains actual result totals.
- The Red Relay report retains a bounded sampled history. Its displayed x-axis window is the retained portion, not a promise that every sample from the full 60-day operation is kept.

## Rendering regression fixed

The user reported `Cannot read properties of undefined (reading 'copy')` at `previewSnapshots.tsx`. The adaptation called `WebGLRenderer.getClearColor()` without its required `Color` output argument (observed then on Three.js 0.183; three is now pinned to 0.182). It now supplies `new Color()` and restores that saved state after the render-target thumbnail. Initial cards and spacecraft previews rendered without the reported failure in subsequent browser checks. Typecheck enforces the required method argument.

The error fallback wording was also corrected: a render exception must not be described as definite context loss. It does not suppress the original exception or fabricate a 3D fallback.

## Performance sample and limitations

An active production Mars flight on the browser's Intel UHD Graphics 620 / ANGLE WebGL2 environment measured **89 frame intervals**, median **16.7 ms**, mean **22.85 ms**, approximately **43.77 fps** with the automatic LOW tier. This is a short observed sample, not a universal Chromebook performance guarantee or long-duration benchmark.

No novice participant study has been performed. Brazilian Portuguese content is authored and parity-checked but has not received independent human language/science review. There is no online multiplayer, real hardware qualification, atmospheric drag, J2/three-body model or real radiation-transport simulation. Registration, organizer interpretation of data-source eligibility and final submission assets remain separate from this software verification.
