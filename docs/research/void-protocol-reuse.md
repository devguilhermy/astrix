# Void Protocol reuse report

**Decision (2026-11-14):** the owner approved reusing Void Protocol (VP) code and assets in ASTRIX Mission Studio. This replaces the earlier "patterns only" answer (brief §9, question 14).

- **Source repository:** `~/dev/void_protocol`, pinned at commit **`218625d`**. Every copied file records this commit.
- **How this was researched:** the VP docs (`docs/engine/*`, `docs/fullstack/UI_STYLE.md`, `GAME_MODES.md`, `docs/meta/TESTING.md`), `graphify query` on `graphify-out/graph.json` (11,427 nodes), and direct reads of the files named below. Import lists and line counts were measured on the pinned commit.

Verdicts:

| Verdict | Meaning |
|---|---|
| **COPY** | Bring the file over unchanged, apart from the attribution header and import paths |
| **ADAPT** | Bring the file over and make the listed edits (decoupling, renames, our types) |
| **PATTERN** | Rewrite from the idea; the VP file is too coupled to VP's types or world |
| **LEAVE** | Not used |

---

## 1. Space Apps rules that apply to reuse

| Rule | Source | Consequence for us |
|---|---|---|
| Reusing your own earlier work and open-source libraries is permitted if it is **properly credited** and was **not built specifically for Space Apps**. "All challenge-specific development must take place during the official hackathon." | [nasa/spaceapps discussion #1924](https://github.com/nasa/spaceapps/discussions/1924), Space Apps navigator answer, 11 Nov 2026 | VP predates the event and is unrelated → allowed. Everything specific to the mission game is written during 14–15 Nov. |
| Reused components must meet the competition's **open-source requirements**; the whole earlier project need not become open source | same | Every copied VP file is released under the ASTRIX licence (see §8). VP itself stays private. |
| **All resources** (code, data, text, images, libraries, tools) must be listed in the submission, **even your own previous work** | same | `CREDITS.md` lists each VP file and asset with its path and commit. |
| AI use must be **disclosed**; AI-generated images and video need a **visible watermark** | [discussion #1947](https://github.com/nasa/spaceapps/discussions/1947), navigator answer, 12 Nov 2026 | The README and submission describe how AI tools were used. No AI-generated imagery or audio ships unless it is watermarked or disclosed. |

Two rules from the same answer in #1947 affect more than reuse; both are recorded in the [implementation plan](../GAME_IMPLEMENTATION_PLAN.md) §12:

- **Team size.** Global Judging needs teams of 2–6 participants: "an individual working alone would not meet the minimum team-size requirement for Global Judging". The brief recorded "solo".
- **Listed NASA data source.** Global Awards need "at least one NASA data source listed in the Resources section of the specific 2026 challenge", used meaningfully. RadLab, DONKI and the fact sheets are **not** on this challenge's list.

---

## 2. Summary by area

| Area | Verdict | What we take |
|---|---|---|
| **Three.js rendering** | COPY / ADAPT 6 files | Quality tiers + frame probe, adaptive pixel budget, WebGL failure fallback, preview snapshots |
| **3D assets** | LEAVE (models), keep pipeline for later | The sci-fi ship GLBs don't fit real spacecraft; the meshopt/KTX2 pipeline is kept in reserve |
| **Audio** | ADAPT the procedural tone helper; **no** mp3 files | Coded UI tones with an alert gate; the mp3s have no recorded licence or origin |
| **Engine** | PATTERN | Fixed sub-steps, atomic reset, action buffer, golden traces; not the ECS or scheduler |
| **Logic** | COPY / ADAPT 3 files, PATTERN 3 | Cue engine (+ its tests), event bus, seeded RNG; quote/refusal, death report, difficulty as patterns |
| **UI style** | ADAPT 1 file | `hudLabel.ts` class tokens, minus blur |
| **i18n** | ADAPT 1 file | `i18n/config.ts`, without `es` |
| **Icons** | LEAVE | Lucide replaces VP's owned icon set (user decision) |

---

## 3. Three.js and rendering

VP is a real-time 3D universe: 25+ rendering modules for planets, atmosphere, terrain level-of-detail, nebulae, a black hole, asteroids, highways and station districts. ASTRIX needs one spacecraft, one planet and one orbit. The scene code is not transferable; the **rendering infrastructure** is.

| VP file (`apps/web/src/…`) | Lines | Imports | Verdict | Edits | ASTRIX destination | Agent |
|---|---|---|---|---|---|---|
| `rendering/quality.ts` | 251 | `react`, `../dev/bench/benchGate` | **ADAPT** | Remove `benchGate` (treat as `false`); storage key `void.quality` → `astrix.quality`; reduce `QualityProfile` to `{ dprMax, msaa, orbitSamples, labelBudget, gridDensity }`; keep `classifyStaticTier`, `applyFrameProbe` (downgrade one step if median frame > 33 ms), `medianOf`, `readGpuFacts`, `measureFrameProbe`, the subscribe/hooks and the `<html data-quality>` attribute | `apps/web/src/three/quality.ts` | C |
| `rendering/pixelBudget.ts` | 18 | none | **COPY** | none | `apps/web/src/three/pixelBudget.ts` | C |
| `rendering/AdaptivePixelBudget.tsx` | 45 | `@react-three/fiber`, `react`, `./pixelBudget`, `benchGate` | **ADAPT** | Remove `benchGate` | `apps/web/src/three/AdaptivePixelBudget.tsx` | C |
| `rendering/WebGLFailureNotice.tsx` | 50 | fiber, drei, `react-dom/client`, `react-i18next`, `ApplicationErrorPanel` | **ADAPT** | Map i18n keys to `ui.webgl_failure.*`; ASTRIX tokens | `apps/web/src/three/WebGLFailureNotice.tsx` | C |
| `components/ui/ApplicationErrorPanel.tsx` | 45 | (UI only) | **ADAPT** | Restyle with ASTRIX tokens; Lucide `circle-exclamation-point`; keys `ui.app_error.*` | `apps/web/src/ui/primitives/ApplicationErrorPanel.tsx` | C |
| `rendering/previewSnapshots.tsx` | 96 | fiber, `react`, `@void/shared`, `../components/UnitVisuals` | **ADAPT** | Replace `UnitVisuals` + shared types with `SpacecraftModel` + `Design`; cache key = `design.revision`. Used for the "your spacecraft" PNG on the report and the scenario cards, so **no second WebGL context** | `apps/web/src/three/previewSnapshots.tsx` | C |
| `components/ui/DraggablePanel.tsx` (graph loc L80), plus narrow layout/title helpers if needed | — | VP HUD store | **ADAPT / PATTERN (new user authorization)** | Opaque floating surfaces, local panel-position state, pointer capture, viewport clamping, keyboard handles and reset; remove VP store coupling | `apps/web/src/ui/primitives/DraggablePanel.tsx` | C |
| `rendering/celestial/**`, `nebula/**`, `asteroids/**`, `lod/**`, highway/gun shaders | many | VP world | **LEAVE** | Guided-redesign sky/RCS exceptions are recorded in §11; no VP physics imported | — | — |
| `rendering/celestial/AtmosphereShell.tsx` | — | VP planet data | **LEAVE** | ASTRIX's atmosphere is independently implemented | — | — |

Rules kept from `docs/engine/3D_ASSETS.md` and `PERFORMANCE_GUIDELINES.md`:

- One WebGL context. Browsers drop the oldest context after about 16, and in VP that took the game canvas down. Previews are PNG snapshots rendered once.
- The quality tier selects DPR cap and MSAA. The frame probe runs once and **only downgrades**.
- On LOW, `index.css` drops `backdrop-filter`, `filter`, shadows and infinite animations through `[data-quality='LOW']`. ASTRIX bans blur entirely, so this only covers shadows and animations.
- After context loss, stop the renderer and show the failure panel; don't recreate canvases automatically.

---

## 4. Assets

| VP asset | Size | Verdict | Reason |
|---|---|---|---|
| `public/assets/{explorer,fighter,carrier,mothership}.glb` (+ `hd/`) | about 0.29 MB each (LOW), about 0.7 MB (HIGH) | **LEAVE** | Sci-fi warships; the game shows believable CubeSats and SmallSats built from the chosen parts |
| `apps/web/scripts/compress-ship-glb.sh`, `public/decoders/{basis,meshopt}` | — | **LEAVE for now, reuse later** | If real spacecraft models are added (e.g. NASA 3D resources, with licence check), use the same meshopt + KTX2 pipeline and self-hosted decoders |
| `public/assets/*.mp3` (35 files: `scanning`, `communications`, `ship_alert_fast/slow`, `auto_docking`, `space_ambience`, …) | 25 KB – 1.8 MB | **LEAVE** | There is no licence or origin record. If they were AI-generated or third-party, they need disclosure or licence proof (#1947). Coded tones avoid the problem. |
| `public/assets/terrain/**` | — | **LEAVE** | Not needed |
| `public/logo-mark.svg`, `banner.png` | — | **LEAVE** | VP branding |
| Fonts (Rajdhani, Orbitron) | — | **Same choice, fresh install** | `@fontsource/rajdhani` + `@fontsource/jetbrains-mono` (OFL), self-hosted |
| VP owned icon system `components/ui/icons/` | — | **LEAVE** | Lucide everywhere (user decision) |

---

## 5. Audio

The plan had no audio; this adds it.

| VP source | Verdict | Edits | ASTRIX destination | Agent |
|---|---|---|---|---|
| `utils/soundManager.ts` (870 lines): the `playTone(freqStart, freqEnd, duration, type, volume)` helper (around lines 146–175) and its lazy `AudioContext` + master-gain setup | **ADAPT (extract)** | Take only the context setup, master gain and `playTone`. Drop buffer loading, mp3 playback, ambience and ship sounds. | `apps/web/src/audio/tones.ts` | C |
| Alert gating described in `docs/engine/SOUND_EFFECTS.md` (minimum gap per alert, per-channel volume) | **PATTERN** | `audio/cues.ts`: a minimum gap per cue id (e.g. 4 s), a global mute, separate volumes for UI and alerts; respects reduced motion (no ambient) | `apps/web/src/audio/cues.ts` | C |

| Game cue | Tone (all coded, no files) |
|---|---|
| Part added / quote ok | short rising sine, 0.08 s |
| Refusal | two short square blips, low |
| Sign-off | soft two-note chime |
| Pass start / pass end | rising / falling triangle sweep |
| Auto-pause decision | three-pulse alert, gated |
| Storm start | low slow sweep, gated |
| Failure | descending sawtooth, once |
| Mission success | major arpeggio |

Settings get a sound on/off switch and a volume control. Audio starts only after the first user gesture (browser autoplay policy).

---

## 6. Engine

| VP | Verdict | ASTRIX |
|---|---|---|
| Miniplex entity system, `ecs/world.ts`, systems | **LEAVE** | The sim is one pure `stepSim(state, dt)` in `@astrix/core` |
| `ecs/scheduler.ts` (133 lines, no imports; fixed-step system registry) | **LEAVE** | The loop is a single rAF hook; the only idea kept is fixed sub-steps with a per-frame cap |
| Atomic reset of module-level state (`CORE_ARCHITECTURE` §5.5) | **PATTERN** | `resetMission()` in one `set`, plus loop, ref, cue and audio reset |
| Action buffer, one `set()` per action (§4.4) | **PATTERN** | Store actions call `quote*` and apply once |
| Golden flight traces (`TESTING.md` §7.1: seeded RNG, fixed clock, `toEqual`, `UPDATE_GOLDEN=1`, size cap) | **PATTERN** | FIRST_LIGHT golden trace (plan §9) |
| Server authority re-validating with shared rules | **PATTERN (later)** | Online rooms would re-quote with `@astrix/core` |

---

## 7. Logic, UI and i18n

| VP file | Lines | Imports | Verdict | Edits | ASTRIX destination | Agent |
|---|---|---|---|---|---|---|
| `advisor/engine.ts` | 191 | `./rules`, `./snapshot`, `@void/shared/manual` | **ADAPT** | Replace `CueAction`, `CueTarget`, `ManualBlockRef`, `manualCueBlock` with ASTRIX `fix`, `target`, `glossaryId` strings. Replace `AdvisorSnapshot` with `ReviewSnapshot`. Add `role` to cues. Keep the algorithm: applicability, guidance filter, cooldown, `clearAfterSec` hysteresis, priority/age sort, cap (all alerts + ≤ 2 tips/teach). | `packages/core/src/review/engine.ts` | A |
| `advisor/engine.test.ts` | — | — | **ADAPT** | Same type swaps; keep every behavioural case | `packages/core/src/review/engine.test.ts` | A |
| `advisor/cueTone.ts` | 13 | `./engine` | **ADAPT** | Maps cue → tone family; point at `audio/cues.ts` | `apps/web/src/audio/cueTone.ts` | C |
| `stores/gameEvents.ts` | 24 | `@void/shared` | **ADAPT** | The event union becomes `SimEvent` from `@astrix/core` | `apps/web/src/store/events.ts` | C |
| `packages/shared/src/world/terrain/terrainNoise.ts` → `mulberry32` only | about 10 | none | **COPY (function only)** | Wrap as pure `next(state) → [value, nextState]` so the RNG state lives in `SimState` | `packages/core/src/rng.ts` | A |
| `utils/deathReport.ts` | 259 | `@void/shared` | **PATTERN** | Same shape (`DeathFact { key, values }`, `describe…` switch, advice keys), ASTRIX causes (plan §3.11) | `packages/core/src/sim/failure.ts` | A |
| `systems/resourceConversion.ts` (`maxConversionBatches`, `quoteConversion`, `applyConversion`) | 199 | VP economy | **PATTERN** | Quote → apply re-quotes; typed refusal union; epsilon-safe comparisons | `packages/core/src/design/quote.ts` | A |
| Difficulty-owned failure (`GAME_MODES.md` §2.6) | — | — | **PATTERN** | Cadet "anomaly recovered" | `packages/core/src/catalog/difficulty.ts` | A |
| `components/ui/hudLabel.ts` | — | none | **ADAPT** | Keep `HUD_LABEL_ROW_CLASS`, `HUD_LABEL_CLASS`, `HUD_LABEL_ICON_SIZE`, `HUD_CARD_SURFACE_CLASS`, `HUD_CARD_CLASS`, `HUD_STRIP_CLASS`; **remove `backdrop-blur-*`**; rename the prefix `HUD_` → `UI_` | `apps/web/src/ui/primitives/classes.ts` | C |
| `i18n/config.ts` | about 25 | i18next, react-i18next, detector | **ADAPT** | Resources `en`, `pt-BR` only | `apps/web/src/i18n/config.ts` | C (Wave 0) |
| `advisor/rules.ts`, `snapshot.ts`, `missionContext.ts`, A.U.R.A. LLM routes | — | VP game state | **LEAVE** | ASTRIX rules are new (plan §3.8) | — | — |

---

## 8. Procedure for every copied or adapted file

1. Copy from the pinned commit only:
   ```
   git -C ~/dev/void_protocol show 218625d:<path> > <astrix destination>
   ```
2. Add the attribution header:
   ```ts
   // Adapted from Void Protocol (© Guilhermy), apps/web/src/rendering/quality.ts @ 218625d.
   // Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
   ```
   Use "Copied from" for COPY files.
3. Make only the edits listed in this report. Record anything else in `CREDITS.md` under "Adaptation notes".
4. Keep the VP tests that cover the file (adapted alongside it).
5. Add a row to `CREDITS.md`: VP path, commit, verdict, ASTRIX path, licence.
6. **Licence:** ASTRIX ships under one OSI licence (Apache-2.0, matching NASA's default when none is stated, per the Space Apps legal page summary; confirm on <https://www.spaceappschallenge.org/legal/>). The owner releases the copied VP files under that licence; VP as a whole is unaffected.
7. **Gate:** `rg -l "Adapted from Void Protocol|Copied from Void Protocol" apps packages` must equal the `CREDITS.md` VP rows (Wave 2 check).

---

## 9. Changes to the implementation plan

The [implementation plan](../GAME_IMPLEMENTATION_PLAN.md) is updated to match:

- **C11** now allows reuse limited to the files in §3–§7 above, following §8.
- New features:
  - quality tier + frame probe;
  - adaptive pixel budget;
  - WebGL failure fallback;
  - preview snapshots (report and scenario cards);
  - coded audio cues with a settings toggle.
- Original implementation-agent limits above are historical. The owner-approved guided redesign extends narrow generic UI/rendering reuse as recorded in §11, still pinned at `218625d`; multiplayer remains future work.

## 10. Risks

| Risk | Mitigation |
|---|---|
| An adapted file drags in more VP code than expected | Only the imports listed above may be followed. Anything else gets an ASTRIX replacement or stays out. |
| Licence of copied code | The owner relicenses the copied files (§8.6); third-party code inside them (none found in the listed files) would need its own check |
| Unknown-origin assets slip in | Assets are LEAVE by default; the gate in §8.7 also scans `apps/web/public` for VP filenames |
| Judges see reuse as "working ahead" | Only generic infrastructure is reused; all challenge-specific code is new and dated within 14–15 Nov; disclosed in `CREDITS.md` and the submission |

## 11. Guided immersive redesign additions

The approved [Line B plan](../plans/GUIDED_IMMERSIVE_REDESIGN_PLAN.md) adds the following selected infrastructure. Source files were read from `218625d`, not the VP working tree. No upstream licence declaration was found in the pinned root/package metadata; selected same-owner reuse is distributed under ASTRIX Apache-2.0 under the authorization in §8.6, not an assumed MIT licence. See [CREDITS.md](../../CREDITS.md) for per-file destinations and NASA asset links.

| VP source (`apps/web/src/`) | LOC at pin | Verdict | ASTRIX destination / boundary |
|---|---:|---|---|
| `components/ui/AuraStrip.tsx` | 111 | PATTERN | `ui/layout/DraggablePanel.tsx`: collapse within existing header; original geometry |
| `components/ui/ResourceGrid.tsx` | 70 | ADAPT | `ui/hud/ResourceGrid.tsx`: responsive seven-resource shell |
| `components/ui/ResourceBadge.tsx`, `StatusBar.tsx` | 139 / 231 | ADAPT narrowly | `ui/hud/ResourceBadge.tsx`: semantic cards, fill/delta and thresholds; no VP stores/robot cards |
| `components/ui/CueHighlight.tsx` | 167 | ADAPT | `ui/guide/CueHighlight.tsx`: tracked DOM outline, no world overlay |
| `stores/cueStore.ts` | 206 | ADAPT narrowly | `ui/guide/cueStore.ts`: request/expiry/subscription |
| `advisor/cueTargets.ts` | 16 | ADAPT | `ui/guide/cueTargets.ts`: visible target and collapsed-pill fallback |
| `components/ui/TourSpotlight.tsx` | 216 | ADAPT | `ui/tour/{TourSpotlight,TourCard}.tsx`: cut-out/card, new viewport clamp/focus/compact tracking |
| `components/ui/GuidedTour.tsx` | 205 | ADAPT | `ui/tour/TourHost.tsx`: device-local surface tours, no ECS/world |
| `components/ui/tourSteps.ts` | 239 | ADAPT shape only | `ui/tour/tours.ts`: original ASTRIX mission steps |
| `components/ui/tourNavigation.ts` | 5 | COPY | `ui/tour/tourNavigation.ts`: navigation helper |
| `components/StarfieldSkybox.tsx` | 321 | PATTERN | `three/space/Skybox.tsx`: independent camera-centred vacuum sphere |
| `rendering/starfieldShader.ts` | 304 | PATTERN | `three/space/starfieldShader.ts`: independent angular-cell shader/integer hash; no Dave Hoskins function/constants copied |
| `utils/flightInput.ts` | 224 | ADAPT formula / PATTERN input routing | `three/camera/approach.ts`, `ui/flight/pilotState.ts`; no arcade physics |
| `constants/flightTuning.ts` | 68 | ADAPT selected constants | `three/camera/modes.ts`, `ui/flight/pilotState.ts`; camera rates/sensitivity only |
| `components/CameraController.tsx` | 1102 | PATTERN | `three/camera/CameraRig.tsx`: chase/quick-look/recenter with original ASTRIX pose/clearance |
| `rendering/renderOrigin.ts` | 78 | PATTERN | `three/space/FloatingOrigin.ts`: km CPU origin subtraction |
| `components/RcsThrusters.tsx`, `rendering/rcsBurstMath.ts` | 265 / 280 | PATTERN | `three/spacecraft/RcsPuffs.tsx`: independent paired-vent slew illustration, no particle/ECS/input emissions |
| `stores/uiTracking.ts` | 105 | ADAPT | `ui/layout/trackedTargets.ts`: per-id tracked target and listeners outside Zustand; ASTRIX stores viewport-pixel rectangles, no point mode |
| `utils/panelPlacement.ts` | 242 | ADAPT narrowly | `ui/layout/panelPlacement.ts`: `placeBesideBounds`, `containmentShift`, `followsTrackedTarget` over ASTRIX workspace rectangles; no deployment frame or rotated-portrait mapping |
| `rendering/celestial/projectBodyBounds.ts` | 125 | PATTERN | `three/spacecraft/projectBounds.ts`: conservative projected silhouette, whole canvas when crossing the camera plane; independent `Box3` corner projection |
| `components/ui/DraggablePanel.tsx` (tracked placement) | — | PATTERN | `ui/layout/DraggablePanel.tsx` `track`: follow the component until a manual drag; a new inspection or **Follow component** resumes |

`rendering/rcsShader.ts` (33 LOC) was inspected but not copied; declarative cone feedback made the planned COPY unnecessary. No VP flight dynamics or unknown-licence hash is included.

New mission guidance, resource mapping, spacecraft parts, quaternion simulation, solar ephemeris and forecast policies are original ASTRIX domain work. NASA sky/day/night derivatives are local assets, not VP imagery. The packed lossless Earth texture stores Blue Marble day RGB and Black Marble night luminance in alpha; source URLs, credits and derivative commands are committed in `apps/web/public/textures/asset-sources.json`. No unknown-origin audio or external spacecraft model was introduced.

