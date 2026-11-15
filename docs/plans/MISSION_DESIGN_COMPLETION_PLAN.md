# Mission-design expansion — final completion plan

## Status and completion rule

Both implementation workstreams have handed off source. The combined rules-v5 application has **not yet been typechecked, tested, built or walked through in a browser**. This plan is the remaining execution sequence, not a completion report. Canonical documentation now describes the new contracts with integration-pending labels; earlier verification records remain build-specific.

Scope remains the approved mission-design expansion: genuine Expert authoring, short learning missions, physical Earth-to-Moon flight, 15 total automatic concept-tour cards, and a working reviewed LAN setup. Dedicated role-specific phone gameplay consoles are not part of this expansion; pairing/session functionality must not be described as complete phone gameplay.

## 0. Fix the newly observed blockers first

The multiplayer reviewer reported these after the source handoff:

1. **Startup parse blocker:** `packages/data/src/science.ts:75` lacks a comma. The reviewer observed `bun run host` and session imports failing to parse. Fix the syntax before integration checks; do not rerun merely to reconfirm it.
2. **Authority crash risk:** definition payloads containing non-finite numbers (JSON `1e999`) or extreme nesting reach `digestOf`/`canonicalJson` before authorization and validation in `reduceSession`. The reviewer observed those calls throwing and independently confirmed Bun exits on an uncaught timer exception; the full network-to-crash chain has not yet been exercised because startup is blocked. Validate bounded depth and finite values before recursive canonicalization/fingerprinting, enforce authoring authority, and return a typed refusal without mutation. Do not hide the defect with a broad catch that pretends an intent succeeded.

Add regression coverage through the actual parser/reducer and room path: malformed definitions must not crash the host, consume a valid mission, discard credentials or prevent a subsequent legitimate request. Then include these cases in the final manifest-backed LAN rehearsal.

## 1. Close known integration gaps

- Merge `MISSION_COPY_EN` / `MISSION_COPY_PT_BR` from core's `i18nMission.ts` and `TRAJECTORY_SCIENCE_EN` / `TRAJECTORY_SCIENCE_PT_BR` from data's `scienceTrajectory.ts` into the web translation sources using the existing convention. Include new objective, refusal, event, model-limit and science-topic copy. The data science tests read web locale JSON, so registering maps only at runtime is insufficient.
- Connect the new science topics' `ascent`, `burns` and `trajectory` targets to actual visible controls. Show me must reveal and focus the owning surface without changing mission state or manufacturing a proposal.
- Reconcile core, session, host and web API shapes, including definition submission, authoring permission, full snapshot identity, flight telemetry, objective evidence and planned/flown records.
- Finish migrating existing contract tests without changing their original numerical expectations merely to make them pass. Preset compatibility remains a requirement; changed rules identity is intentional.
- Integrate the host's new `NOT_FOUND` response into bilingual client feedback.
- Keep the already-added Vite build manifest and client frame-size/credential changes aligned with the final host exports. Verify `{schema:1, protocol:2, rules:5, flightModel:1}` comes from exported constants, not duplicate literals in production code.

**Exit:** every known handoff gap has a concrete implementation; no stale scenario-only callers, missing translations or unresolved target routes.

## 2. Compile and reconcile the integrated contracts

Run `bun run typecheck` after step 1. Fix actual diagnostics in the owning layer rather than adding casts, compatibility aliases or optional fallbacks that conceal a missing contract. Recheck only after correcting the reported failures.

Pay particular attention to:

- Embedded immutable definitions versus IDs; provided-orbit versus surface-start designs.
- Nullable/absent orbital elements during ascent or unbound flight.
- Forecast result unions, partial/failed burns, incomplete outcomes and objective evidence.
- Protocol-2 DTOs, session authoring permissions, host manifest parsing and client recovery.
- All existing web/core/session/host fixtures migrated to the new public APIs.

**Exit:** typecheck passes without weakening authority or validation types.

## 3. Prove core behavior and numerical compatibility

Run the consolidated automated suite once the source is integrated; use affected-file reruns for fixes:

```sh
bun test
```

The engine handoff supplied new definition, conic, flight, session-definition and host-manifest tests. Existing preset, crew, scoring, replay, UI and transport tests must remain meaningful.

### Definition and authority gates

- Validate/import/export round trips; reject unknown fields, unsupported versions, oversized/deep input and invalid numeric values.
- A built-in origin requires the exact built-in content. Editing creates custom identity; changing content cannot inherit preset comparability.
- Draft save/reload, publication revision ordering, immutable history, import ID collisions and storage failures preserve user work.
- Session submission checks author, base digest and revision; stale definitions cannot replace the current mission.
- Launch readiness, role permissions, quote atomicity, replay and reconnect preserve the full definition/digest.
- The implemented limit of one delivered-product and one instrument-hours objective must be explicit in the editor/validation feedback. Reconcile any conflict with the approved authoring scope rather than silently narrowing it.

### Physics and outcome gates

- Preserve original four-preset physical expectations and command behavior at both levels. A regression is not resolved by updating a golden to the new result without explaining the model change.
- Compare conic outputs against the independently observed GMAT orbit-raise, Earth-escape and lunar circular-coast references at the exact recorded timestamps and frames. Keep this claim separate from ascent or lunar-mission validation.
- Exercise ascent mass/fuel accounting, staging, cutoff, impact and orbital handoff; test integration convergence and event-time precision.
- Check Earth/Moon frame-switch position/velocity continuity, correct central-body gravity and finite-segment occultation.
- Check burn direction/frame, source inventory, rocket-equation mass loss, partial/refused/missed burns, and time/apsis/SOI triggers.
- Exercise missed lunar encounter, insufficient fuel, failed ascent and successful capture. SOI entry alone must not satisfy capture.
- Check objective deadlines/dwell, required versus optional objectives, early ending and retained first-failure evidence. Success requires the declared required objectives, not a mission name or visual milestone.
- Measure partition behavior. The engine handoff explicitly does **not** claim bit-identical arbitrary-step results; define and prove justified numerical tolerances without relaxing the public deterministic authority contract silently.

**Exit:** automated checks pass, numerical comparisons are recorded, and failures cannot be converted into synthetic success.

## 4. Build a stable browser verification target

Run `bun run build` after automated integration. Confirm the production manifest is emitted and accepted by the matching host. Use one stable production build for browser verification; do not rebuild underneath an active proof session.

Check static startup, lazy entry, route recovery, worker loading and one retained Canvas. Record real build warnings, including bundle size, without treating successful bundling as UI proof.

**Exit:** a reproducible production build opens and runs without missing modules, worker failures, shader failures or incompatible manifest metadata.

## 5. Walk the actual player workflows

Use real controls; do not inject successful state or bypass gates.

### Expert authoring

Create a mission with materially changed objective/constraints, save a draft, reload it, publish, duplicate, export and import it. Show invalid fields and unsupported combinations; confirm invalid drafts cannot fly. Start the validated mission, demonstrate its own requirements, reach a truthful terminal report, then edit as a new experiment. Verify definition identity and planned-versus-flown evidence in the report.

### Learning and physical flight

Walk First Signal and the ascent/orbit/maneuver progression. For the lunar orbiter, exercise launcher/program selection, forecast/recommendation, explicit application, ascent, parking orbit, injection, encounter, capture and data return. Use the full engine: no cinematic launch substitution, teleporting Moon arrival or fake capture toggle. Demonstrate at least one real unsuccessful flight and its causal report.

### Guidance and accessibility

- Confirm automatic curriculum totals 15 cards: 3 Welcome, 5 Build, 2 Launch, 3 Flight, 2 Debrief. Optional Choice remains Help-only.
- Skip/decline suppresses later automatic interruptions; reload preserves opt-out; Help replay does not undo it.
- Tour navigation changes presentation only. Static tour closure does not resume flight; LAN tour opening does not pause the room.
- Verify visible targets, focus return, keyboard-only editor/burn actions, touch alternatives and reduced motion.
- Exercise desktop 1440×900 and compact 390/320px, both locales and a zoom/reading layout. Check actual overflow, reachable controls and resource visibility, not only CSS or unit tests.
- Inspect rendered physical ascent, lunar frames, camera behavior and trajectory overlays; previews must remain distinguishable from flown history.

**Exit:** observed workflow evidence for custom authoring, short lessons, lunar flight and the shortened curriculum, with defects fixed and the affected scenario replayed.

## 6. Rehearse the final LAN setup

Start the final build with `bun run host` and real HTTP/WebSocket clients. The multiplayer reviewer should use this build, not its earlier HEAD archive.

- CLI: private-interface selection, actionable port/bind errors, loopback bootstrap via accepted hostnames, missing/stale manifest refusal and normal startup.
- Admission: QR contents/manual join, host approval, roles, Ready, three-phone capacity, fourth-phone refusal and pending-request denial.
- Mission: start a built-in and a custom definition; verify identical digest/revision on projected snapshots and reconnect. Phones must not step a local simulation.
- Bounds: valid definition frames above 8 KiB, rejection above the definition limit, ordinary-message cap and malformed-ID result handling. Unsupported/oversized messages must not erase the host credential or silently discard an accepted mutation.
- Recovery: refresh, temporary disconnect, duplicate IDs, replacement tab, version mismatch, revoked credentials, explicit host-only continuation and no implicit resume.
- Privacy/security: do not change firewall policy or unrelated services. Current shared Wi-Fi is not an isolated trusted-LAN security test; document plaintext and topology honestly.

Real iOS/Android camera scanning, suspension and radio loss need actual devices. If unavailable, report that qualification limit explicitly; desktop clients can prove the reachable protocol/browser behavior, not substitute for physical-device evidence.

**Exit:** final-build LAN setup works end to end; reviewer findings have observed fixes and clearly separated physical-device limits.

## 7. Final evidence, documentation and delivery

- Update `VERIFICATION.md` with exact commands, results, reference comparisons, browser workflows, LAN topology and remaining unverified cases.
- Replace integration-pending canonical wording only for behavior actually verified. Reconcile `INDEX`, architecture, missions, simulation, resources, technical models, rendering, layouts, science UX, multiplayer and challenge acceptance.
- Finalize the unreleased changelog entry and write the requested delivery report, distinguishing implementation, automated proof, browser proof and qualification limits.
- Preserve source/asset attribution and NASA-versus-authored-assumption distinctions. Do not call the whole model GMAT-validated because a few conic cases agree.
- Validate documentation links and regenerate public copies with `bun run prepare:public`.
- Remove assistant-created temporary proof artifacts/services. Commit only if the current user authorization covers this implementation; never treat an earlier completed task's commit request as blanket permission.

**Done means:** all requested behaviors work end to end, the combined checks pass, browser and LAN evidence are recorded, and remaining external qualification limits are disclosed—not hidden behind a claim of completion.
