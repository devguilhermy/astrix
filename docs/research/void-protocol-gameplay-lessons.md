# Void Protocol gameplay lessons for ASTRIX

**Research only; implementation remains paused for review.** This supplements the [earlier code/asset reuse report](./void-protocol-reuse.md) and informs the [turn-based revision](../plans/TURN_BASED_EXPLORATION_REVISION.md).

## Evidence boundary

Inspected the current `/home/guix/dev/void_protocol` working tree, its canonical gameplay docs, and selected implementation bodies. Queried its existing 11,427-node graph for mission setup, progression, balancing and scanning, then verified relevant leads in source. Graph results were truncated and are navigation aids, not exhaustive evidence. The old reuse report's `218625d` pin is **not** the identity of this working-tree research. No VP files were changed or copied. Any future copying must establish a source revision and attribution separately.

The user's report that VP is fun is the experience evidence. This pass did not run a VP browser session, playtest, benchmark or test suite. Explanations of why a mechanic may be fun, and its suitability for ASTRIX, are design hypotheses—not measured causal results.

## 1. What the earlier reuse missed

The previous reuse pass mainly selected rendering quality, panels, cues, RNG, audio helpers and transaction patterns. Those can make a game work and look better without making its decisions engaging.

VP's stronger design reference is the relationship between **a place worth visiting, an attainable goal, an equipment/resource commitment, an action with a visible effect, and a reason to keep exploring**. ASTRIX needs that relationship, not more of VP's dashboard.

VP is real-time and includes piloting, combat, industry and physical exploration. Turn-based ASTRIX cannot inherit the pleasure of those controls merely by copying the UI. It needs its own payoff: deliberate mission bets, visible flight consequences, discoveries and quick rematches.

## 2. Findings grounded in the current implementation

Paths in this section are relative to `/home/guix/dev/void_protocol`.

| Mechanic | Evidence | ASTRIX adaptation |
|---|---|---|
| Small, varied mission offers | `packages/shared/src/constants/contracts.ts:296–355` builds three seeded offers with distinct template kinds | Offer three coherent mission briefs, plus first-class **Design & Play**. Refresh only on explicit generation, not a wall-clock timer while thinking. |
| Context affects mission challenge | `contracts.ts:92–96,325–334` combines base tier, distance bands and anchor risk | Classify by actual route, required operations, reserves and hazards. Do not equate distance alone with difficulty. |
| A goal is executable rules, not prose | `systems/missionCore.ts:387–513` updates count/reach/survive objectives from typed events and probes | Designer choices compile into the same authoritative objective definitions used by curated missions. Clicking a button or receiving an ACK is not accomplishment. |
| Progress has different meanings | `missionCore.ts:429–469` accumulates counts, latches best reach, and resets interrupted survival | Distinguish discovery milestones, delivered data, sustained operation and reserves that must still exist at completion. Do not latch every requirement forever. |
| Rewards are rules-owned | `missionCore.ts:612–673` calculates rewards from tables and context | Authors choose goals, not their own reward or success badge. Earn journal entries/mission distinctions from actual evidence. |
| Feasibility precedes compilation | `ai/blueprintCheck.ts:17–37` checks schema, content and feasibility; `systems/missionBlueprintCore.ts:41–106` checks targets, deployment and resource types | Use deterministic templates and a bounded compatibility/feasibility pipeline. No LLM or account needed to design missions. |
| Offers explain the goal before commitment | `components/ui/ChallengeCard.tsx:126–176` shows objective, time limit, local best and start actions | One compact brief: goal, expected play length, restrictions, challenge level, then Play. No publishing ceremony. |
| Same challenge, different attempt | `constants/challenges.ts:25–65` defines seed, difficulty, time limit and scoring | Keep immutable mission identity and seed for fair retries; compare alternative designs without silently regenerating conditions. |
| Objective feedback is concrete | `components/ui/MissionObjectives.tsx:42–65` uses localized rule-derived text and numerical progress | Show “observed / transmitted” evidence after each turn, not a generic mission percentage. |
| Learning happens through tasks | `docs/gameplay/MISSIONS.md:46–68` describes one active Academy step, skip support and rewards | First mission teaches through actual decisions and their payoffs, not a tour of every control. Do not import the whole nine-chapter trail. |
| Exploration reveals information | `docs/gameplay/MECHANICS_AND_ECONOMY.md:47–58` distinguishes public information from scan-gated observations | Reveal mission-specific observation results. Keep known Earth/Moon facts and required safety information available; do not pretend known planetary size is a new discovery. |
| Several routes consume different resources | `MECHANICS_AND_ECONOMY.md:212–233` describes cruise/warp/highway alternatives and their costs | Compare feasible mission routes by time, fuel, observing opportunity and risk—not fantasy warp mechanics. |
| A longer horizon gives local choices purpose | `docs/gameplay/MISSIONS.md:111–129` describes persistent milestone pillars and continuation after victory | A lightweight expedition journal connects short missions into Earth → Moon → Mars learning goals. No five-pillar empire economy required. |

### Important limits: do not import the weaknesses

1. **Compatibility is not solvability.** `validateBlueprint` checks referenced bodies, deployment types and resource presence, but the inspected body does not simulate a route or prove adequate quantities, time or survivability. ASTRIX must not call an arbitrary valid definition “balanced.”
2. **Pricing is not objective-sensitive in the inspected implementation.** `priceMission` accepts `_objectives` but does not use it; credits are determined by tier and difficulty. The docs' “tier and objectives” description is broader than that code. Borrow rule-owned valuation, not a claim of automatically balanced rewards.
3. **Survey scope is weaker than its comment.** `contracts.ts:129–140` caps the target from nearby bodies, but the objective filter only requires `deep: true`, not a radius or unique-body set. ASTRIX must encode the actual target/region and uniqueness where the mission requires them.
4. **Raw event counts need domain semantics.** Repeated measurement or transmission may be legitimate; repeated presentation of the same accomplishment must not produce extra discoveries. Deduplication belongs to the objective/receipt contract, not arbitrary UI throttling.
5. **VP's larger resource economy would increase ASTRIX's burden.** Do not import commodities, factories, colonies, combat, billing, providers or global multiplayer rankings just to justify rewards.
6. **Feedback must retain its cause.** ASTRIX should say “Extra observations filled storage before the next downlink,” not only “Mission failed.” Its next-run comparison should show the relevant changed choice.

## 3. Recommended game ingredients

### Bring over as patterns

- **Mission board with distinct offers:** a short data-return job, a maneuver challenge and an exploration objective, drawn from supported content for the selected destination.
- **First-class quick creator:** the player chooses a goal and meaningful constraints, then immediately flies the resulting mission.
- **Loadout identity:** a small set of tangible spacecraft packages/upgrades with real strengths and weaknesses; choosing one changes the model and the visual spacecraft.
- **Opportunity versus reserve:** collect more now or protect enough energy/fuel/time to finish. Optional objectives add ambition without rewriting the main goal.
- **Discoveries as payoff:** observations reveal an attributed science story/image and recorded game evidence; returning data completes the delivery goal.
- **Visible milestones:** launch, stable orbit, encounter, successful capture and returned evidence earn distinct progress, not one opaque score.
- **Retry with intention:** same conditions, changed loadout/decision, side-by-side consequences; distinguish assisted retries.
- **A short campaign thread:** an expedition journal with small themed goals, not a mandatory grind or research tree.

### Do not bring over

Real-time reflex demands, combat/survival cruelty, resource farming, a large fabrication catalogue, opaque tier rewards, AI-generated rule authority, mandatory tour chains, account requirements or unlicensed assets. The previous permission to reuse selected code does not make every VP asset transferable.

## 4. Quick design must be real design

The last proposal made creation too secondary by calling it an optional remix. The user wants to **quickly design a mission under real constraints, then play it**. Promote this to a primary path alongside ready-made missions, available to both Aspiring and Expert.

A player must be able to change the **destination-compatible objective**, **ambition**, **spacecraft capability** and **route/operating approach**. Renaming a preset or choosing a skin is insufficient. Conversely, editing arbitrary environment coefficients and raw schema fields is not necessary.

Keep a single preparation workspace. The live mission brief updates beside the choices, rather than spreading coupled choices across a long wizard. Start with a complete viable configuration so the player is never faced with a blank engineering form.

Recommended controls:

1. **Where / what:** destination and objective family, such as Earth observations, radiation study, orbital maneuver or lunar survey. Only supported combinations are offered, with plain-language reasons for disabled ones.
2. **Ambition:** short / standard / ambitious target bands appropriate to that family. Show the actual goal, not a vague slider. Expert can compare tighter supported bands without raw physics entry.
3. **Mission kit:** two or three viable spacecraft/launcher packages and a small set of mutually meaningful upgrades. Prices, mass, energy and data consequences remain real.
4. **Approach:** compatible route/operations presets; select a reserve-versus-output tradeoff. No redundant selection when only one approach makes sense.
5. **Play:** freezes the validated mission and starts its actual turn-based attempt. Saving/naming/sharing remain optional and never precede first play as mandatory forms.

The budget allowance belongs to the selected mission/difficulty contract and is visible. More ambitious targets do not silently buy the player a larger budget. If an authored contract changes its allowance, that is a visible new contract choice. No hidden “auto-balance” that changes the user's goals, ship or restrictions behind their back.

## 5. Balance is a pipeline, not a green checkmark

Distinguish these states:

| State | Meaning | Player-facing behavior |
|---|---|---|
| Incompatible | Unsupported objective/body/start or contradictory requirements | Name the conflict and offer an explicit correction |
| Over limits | Actual cost, mass, slots, energy or capability constraint fails | Show the limiting quantity and meaningful alternative |
| Checking | Current configuration is being evaluated | Preserve selections; ignore stale results; do not imply readiness |
| No viable plan found | Bounded supported-plan search found no successful candidate | Offer lower ambition or a different kit/route; do not claim mathematical impossibility |
| Ready | A reference policy completes required goals under the selected nominal model, within all limits | Enable Play; show expected margins and a model/uncertainty qualifier |
| Stretched | Ready, but one or more measured margins lie in an authored tight band | Allow informed play with the specific tradeoff visible |

**Ready is not guaranteed victory:** a feasible mission can still fail through the player's decisions. A validated reference policy must not auto-play the player's run.

Implementation approach:

- Build bounded template families with compatible kits, routes, objective bands and decision vocabulary; do not implement an unrestricted mission solver.
- Validate static constraints immediately. Run the candidate's reference policy through the same engine used for turns, against immutable state and the selected seed/model.
- Cache certification by complete definition/loadout/policy/rules/model identity; invalidate it on any relevant change. Slow/cancelled checks must not certify a newer draft.
- Precompute shipped combinations where practical. Runtime checks cover supported user combinations. A worker deadline yields an honest unfinished check, not “impossible” or a fabricated pass.
- Keep physical feasibility separate from challenge rating. Rate challenge from observed reserves, deadline slack, decision demands and authored hazard bands; expose the dominant reasons. Do not invent a success probability.
- Tune threshold bands from automated sweeps and human playtests; do not present them as NASA-derived constants.
- Require several meaningfully different viable builds per core mission family. Check whether one choice dominates every alternative; adjust authored prices/targets or remove redundant options.
- Evaluate representative cautious, aggressive and inefficient policies. The intended result is a learnable spread of outcomes—not one hidden exact solution or automatic success for every choice.
- Do not force the budget to be fully spent. Efficiency/reserve strategies should be legitimate.

GMAT remains an optional cross-check/interchange path, not the balancing oracle. Its retained initial-state/trajectory tools neither certify full game missions nor need to run during quick setup.

## 6. Example design-to-play session

**Illustrative flow, not measured timing or a certified scenario:**

- Choose **Moon → orbital survey**.
- Select a standard survey target and a cost-limited contract.
- Compare a lightweight camera package with a larger data package. The latter consumes more power/mass and may leave too little propulsion margin on the selected route.
- The creator explains the bottleneck. The player can choose the lighter payload, reduce ambition or deliberately choose another compatible contract/route. Nothing changes automatically.
- A supported plan passes the feasibility check. **Play mission** begins launch and subsequent decision turns.
- At the Moon, choose between another observation opportunity and conserving enough resources to transmit the required result. Encounter, capture, observation and delivery remain separate evidence.
- Debrief records the discovery and explains the tradeoff. **Try another design** reopens those few choices with previous conditions retained.

The lightweight configuration must not always be the correct answer. Another supported target/constraint combination should make the larger package worthwhile. That is a balance acceptance condition, not a claim about current packages.

## 7. Changes to the delivery sequence

1. Review the revised **Design & Play** brief and VP-derived mechanics.
2. Prototype mission choice → quick design → preview → play → payoff → redesign together. A mission-board mockup alone cannot establish the loop.
3. Repair retained engine failures before using its predictions as certification. The existing 24-failure suite result remains the last integrated baseline.
4. Implement one complete Earth family, including quick creation, two viable approaches, feasible/refused configurations, turn resolution, saves and debrief.
5. Sweep the supported combinations; record success witnesses and resource slack. Playtest clarity, enjoyment and replay intent with both levels.
6. Extend the same contracts to the remaining lessons/challenges and lunar mission. Retain GMAT import/export/viewing verification and real host/client tests.
7. Cut over from the full studio and old real-time ceremony, update canonical docs, and report automated/browser/human evidence separately.

Proposed additions to acceptance:

- A first-time player can create and start a mission in roughly two minutes without reading the manual; measure the check latency and the user's time separately.
- Changing a goal or loadout materially changes requirements or viable play, not just copy.
- Every shipped Ready configuration has a reproducible reference success, and changing constraints invalidates that proof.
- At least two materially different viable strategies exist for each core mission family; test for dominant choices and repetitive empty turns.
- Players can explain their design tradeoff and name a different design they want to try.
- A custom mission runs through the same gameplay/evidence path as a ready-made one. It never ends at publication/export.
- Duplicate events, reconnects and replays cannot award the same discovery twice. Optional stretch success never masks a failed required goal.

**Review boundary:** this is a proposal update, not implementation approval. No VP code or assets were copied, and no new ASTRIX gameplay code was changed during this research pass.
