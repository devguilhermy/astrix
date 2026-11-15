# Bounded engineering and flight models

The turn-based game retains immutable mission definitions, finite-thrust launch, Earth/Moon patched conics and the engineering systems below. High-level plans automate operations; they do not replace physical resource accounting. Both levels retain quaternion attitude and inventories; Expert enables applicable additional fault mechanisms. Rules/model versions qualify saved results and readiness witnesses. These are teaching models, not certified spacecraft or flight dynamics. Observed verification belongs in [Verification](./VERIFICATION.md).

## Launch and lunar approximation boundary

The ascent model uses staged finite thrust, point-mass gravity, rotating Earth and exponential atmosphere with constant drag coefficient. It omits lift, winds, structural loads and Mach-dependent drag. Coast is two-body conic propagation; maneuvers are labelled impulses with rocket-equation mass loss. Lunar motion is circular and on rails, with a fixed inclined plane and node; the sphere-of-influence patch changes the central body, not the physical absolute state. No real lunar ephemeris, continuous third-body force, landing or crew lunar return is modeled.

Parameters and bounded inputs live in `core/src/flight/{ascent,launchers,moon,conic}.ts`; definition-level objective and capability constraints live in `core/src/mission/`. Independent conic reference runs are recorded in [GMAT research](./research/gmat-validation.md). Those outputs do not validate ascent, atmosphere, lunar targeting or resource integration; application comparisons belong in [Verification](./VERIFICATION.md).

## Sources versus authored coefficients

The following checked-in source IDs explain the phenomena, **not the numerical calibration** of the fictional bus:

- `smallsat-thermal`: [NASA Thermal Control](https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/).
- `smallsat-power`: [NASA Power Subsystems](https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/).
- `smallsat-gnc`: [NASA Guidance, Navigation and Control](https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/).
- `smallsat-comms`: [NASA Communications](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/).
- `smallsat-avionics`: [NASA Small Spacecraft Avionics](https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics/) (archived chapter; not a live operational feed).

The saved ISS DosTel radiation level and its original provenance remain separate. A reset is an authored fault-management exercise, not a probability fitted to ISS dose. Existing two-body/GMAT comparisons do not validate these thermal/link/fault coefficients.

Every coefficient in `ENGINEERING`, `THERMAL_MODELS` and level allowance has `v`, units, allowed authoring range and explicit assumption provenance. Ranges are sensitivity/authoring bounds, not random distributions or UI-adjustable parameters. `listAssumptions()` exposes them alongside hardware assumptions. The Stefan–Boltzmann value is a rounded constant derived from SI defining constants; its finite decimal is not an exact SI definition.

## T1 — lumped equipment-bus thermal balance

`C dT/dt = Qbody + solarFlux × solarFactor × effectiveAbsorbingArea + suppliedElectricalW − εσAradiatingT⁴`.

Solar heat is absent in eclipse. Flux is multiplied by an effective absorption/view area before adding watts. Available electrical energy bounds supplied heat; a depleted battery cannot deliver a free heater. All supplied electrical draw is assumed to dissipate in the lumped bus, including radio draw: this deliberately neglects escaping RF/optical power and spatial gradients. Deep-space sink temperature is approximated as 0 K. There is no atmosphere, convective cooling, albedo, penumbra, thermal network or time-varying infrared view-factor solver. The constant body term approximates absorbed infrared.

| Parameter | CubeSat | SmallSat | Units / allowed authoring range |
|---|---:|---:|---|
| Thermal capacity | 6,000 | 120,000 | J/K; half to twice nominal |
| Effective radiation area | 0.025 | 0.28 | m²; half to twice nominal |
| Effective solar absorption area | 0.003 | 0.08 | m²; half to twice nominal |
| Absorbed body heat | 1 | 10 | W; zero to twice nominal |
| Emissivity | 0.8 | 0.8 | dimensionless; 0.5–1 |
| Initial temperature | 290 | 290 | K; 275–305 |
| Operating range | 260–330 | 260–330 | K; lower bound authoring 250–275, upper 315–345 |
| Survival range | 230–360 | 230–360 | K; lower bound authoring 210–250, upper 345–380 |
| Solar reference flux | 1,361 | 1,361 | W/m² at 1 AU; 1,300–1,400, shared inverse-square sunlight factor |
| Stefan–Boltzmann coefficient | 5.670374419 × 10⁻⁸ | same | W m⁻² K⁻⁴; fixed rounded reference |

Paid equipment is `HEATER_6` (6 W, 0.08 kg, 0.1 U, 7 game-budget units) or `SS_HEATER_60` (60 W, 1 kg, 0.25 bay, 18 units). Idle heater power is 0 W; active power is charged only when demanded. No invisible extra controller is installed. Spacecraft owns `HEATER` Off/On/Auto. Auto turns on at/below 278 K (authoring range 270–285) and stays on until at/above 286 K (range 280–295). SAFE does not override the thermostat.

After 30 s continuously outside the operating range (authoring range 10–120 s), payload electrical draw and science are inhibited. Returning inside restores the existing request; it does not silently issue a new command. Threshold edges emit one paused inhibit/recovery event per crossing. A continuous survival-range violation lasting 600 s (range 60–1,800 s) records a terminal failure and causal temperature/energy/heater facts. Short excursions reset the corresponding dwell.

**Reference bounds:** at fixed input `Q`, equilibrium is `(Q/(εσA))^(1/4)`. At 280 K radiation is about 6.97 W for CubeSat and 78.1 W for SmallSat. At 8 W the CubeSat equilibrium is about 290 K; at 100 W the SmallSat equilibrium is about 298 K. A 6 W CubeSat heater changes the initial temperature slope by 0.001 K/s at unchanged input/radiation and consumes 0.0167 Wh in 10 s. A 60 W SmallSat heater changes slope by 0.0005 K/s. Radiating-area doubling lowers equilibrium by `2^(-1/4)`; thermal-capacity doubling halves transient slope without changing equilibrium. Near the hottest authored survival limit, the nominal linearized thermal time constants `C/(4εσAT³)` exceed 10,000 s. Explicit midpoint 10 s integration is therefore far inside its local stability interval; regression reference compares 5 s and 10 s fixed-input solutions to 0.001 K over one day, independently of the browser loop.

Preflight uses the same equilibrium coefficients: cold case = base electrical draw + body term + full installed heater; hot case = full payload/base draw + solar/body term with heater off. The conservative feasibility screen does not claim that every arbitrary heater/pointing/duty command is safe.

## T2 — bounded exercise-duration power life

Expert factors decrease linearly with operational elapsed fraction, clamped to `[0,1]`: array BOL/EOL = 1/0.86 and battery BOL/EOL = 1/0.85. Both EOL authoring ranges are 0.7–1. These deliberately accelerated losses over 14/21/60 operational days are teaching assumptions, not real short-term spacecraft degradation predictions. Nominal battery capacity stays separately observable. Capacity loss clamps excess charge, accumulates the removed Wh and emits a single visible capacity-clamp explanation; it never creates energy. The aging-review event does **not** apply another Expert loss. Aspiring retains the separately disclosed single 10% capacity-change teaching event.

Static budget generation samples the declared 60% Sun / 30% target / 10% Earth recipe using orbit geometry and projected panel incidence, not fixed mode power fractions. Target/antenna calibration error uses installed ADCS accuracy, instrument cone and beam half-power angle. This recipe is a planning screen, distinct from the command-driven DEFAULT dry run. Expert adds 30% heater duty; eclipse reserve conservatively carries full heater rating for the longest sampled eclipse. Usable planning energy is 40% of EOL physical capacity. Launch refuses negative EOL generation margin or insufficient reserve; continuous instrument duty scales actual power/data without free observing time.

**Reference:** a 60 Wh battery ends at 51 Wh; its planning reserve is 20.4 Wh. A 20 W array's EOL sunlight output before pointing is 17.2 W. Replacing the EOL factor by a lower value can only decrease available generation/capacity; no recovery control increases either factor. The regression includes hardware that passes BOL but fails EOL rather than merely testing the life-factor formula.

## T3 — finite pointing and retained coarse fallback

Both levels integrate body-to-inertial unit quaternions at the paid ADCS angular-rate limit. Body +X is the panel and +Z is the instrument/directional antenna; tracking holds and inertial manual targets are documented in [Simulation](./SIMULATION.md). The shortest-arc slew is kinematic: no inertia, torques, wheel saturation/desaturation, propulsion cost or rigid-body dynamics is claimed.

| ADCS | Maximum slew | Calibration error |
|---|---:|---:|
| Magnetic CubeSat | 0.5°/s | 8° |
| Wheel CubeSat | 3°/s | 0.5° |
| SmallSat | 1°/s | 0.5° |
| Crew capsule | 0.75°/s | 1° |

Accuracy is a deterministic positive body-Y calibration rotation, not frame-random jitter. Camera/mapping/crew-observer cone half-angles are 15°/10°/20°. S/X-band beams have 25°/12° half-power angles: rate multiplier `max(0,cos(error))^(ln(0.5)/ln(cos(halfPower)))`. Instrument generation requires its actual cone and sunlight; actual antenna error, rather than a hold-name switch, sets link throughput. A no-ADCS Sun fallback is 0.1°/s with 15° calibration error; target/manual control still requires paid ADCS. Omnidirectional radiation monitoring has no optical cone or daylight requirement.

Expert's once-seeded sensor/actuator fallback occurs at `duration × (0.16 + 0.04 × U)`. Tracking stops without teleporting the spacecraft. Spacecraft-owned `REACQUIRE_POINTING` needs non-SAFE running hardware and enough stored energy. It takes 180 s (authoring range 60–600 s), adds 2 W CubeSat / 20 W SmallSat (coefficient range 1–5 W, ×10 SmallSat), and retains the fault after recovery. Accuracy error is then multiplied by 1.5 (authoring range 1–3); no arbitrary 60% science/link multiplier remains. Repeated recovery is refused. Actual error, slew and boresight geometry remain observable.

**Reference:** uninterrupted reacquisition uses 0.1 Wh CubeSat or 1 Wh SmallSat in extra power over 180 s, plus baseline/heater loads. A recovered magnetic system has 12° nominal calibration error, still inside the 15° camera cone when tracking. A 1,000 kbps S-band radio at 25° error provides 500 kbps before distance/coding effects. No Mars magnetic-torquer claim is made.

## T4 — contact allocation, link mode and expiring uplinks

Geometric visibility and station assignment are separate observables. Expert stations are allocated during the first 8 h of each Earth day (authoring range 4–12 h). Earth also has the existing one seeded 6 h outage; Mars occultation is independently calculated. Next opportunity is an assumed sampled prediction, not a reservation from a real network. Local telemetry is idealized onboard state, not a light-time-delayed Earth acknowledgment.

Normal mode needs dimensionless link-envelope quality ≥0.65 (range 0.5–0.9). Robust mode needs ≥0.30 (0.1–0.5), reduces throughput to 0.45 of normal (0.2–0.7) and multiplies transmit power by 1.2 (1–1.5). At `0.55 × duration` an authored one-day degraded interval sets quality to 0.45 (0.3–0.6); both start and end pause once. Ground/Comms owns `LINK_MODE`. Neither robust coding nor the independent command receiver defeats geometry, missing station assignment, zero charge or reset computer state.

Every request has issue, transmission, arrival, resolution and expiry timestamps. Expert requests first wait for actual contact; only transmission starts Mars light time. The omnidirectional low-rate command receiver does not require high-rate Earth pointing. Ground requests can transmit toward a rebooting spacecraft, but ordinary commands are refused on reception with `COMPUTER_REBOOTING`; recovery uses the independent command path. A Expert downlink request can arm future sending at reception outside a high-rate contact, but actual bytes always remain gated by contact, pointing, quality and power. Both levels queue ground commands for contact before Mars light time begins.

Requests expire after 172,800 s, including waiting and propagation (allowed authoring 3,600–259,200 s). Expiry wins an equal-time arrival tie. Reset/brownout establishes a new command epoch: an old request arriving while rebooting is refused as rebooting; an old operational request arriving after recovery is refused as `COMMAND_INVALIDATED`. Recovery requests and SAFE-On remain permissible on the independent path. Waiting/transit requests are not silently cleared or replayed; every final result remains a receipt. Receipt refusal/expiry pauses for review.

**Reference:** quality 0.45 blocks normal but allows robust; a 1,000 kbps reference radio produces at most 450 kbps in robust mode before pointing/distance factors. At quality 0 or absent geometry/allocation the rate is 0 regardless of mode. For Mars, arrival = actual transmission timestamp + one-way light time at transmission, never issue timestamp + delay when contact was unavailable.

## T5 — authored onboard reset and powered recovery

One reset per Expert attempt is scheduled at `duration × (0.35 + 0.03 × U)`, separately seeded from pointing. This precedes Storm Watch's day 9–11 measured replay, permitting deliberate recovery before recording. It enters SAFE, stops instruments/send and retains stored science, charge and all prior failure facts. It never repairs battery chemistry or pointing hardware. Reset wins an equal-time command-arrival tie.

The cooldown is 300 s (60–1,800 s). Spacecraft's `RECOVER_COMPUTER` needs that cooldown and stored energy covering base + full heater + boot demand for the declared boot interval. Boot lasts 120 s (60–600 s), adds 3 W CubeSat / 30 W SmallSat (CubeSat authoring 1–10 W; ×10 scaling), and debits actual integrated electricity. There is no upfront duplicate debit. A recovery brownout cancels boot and returns to cooldown rather than completing for free. Recovery completion pauses in SAFE with payload/send Off; deliberate operational restart is required. Repeated recovery while already running/recovering is refused. Waiting/propagating requests retain timestamps and get revalidated at reception.

**Reference:** nominal extra boot energy is 0.1 Wh CubeSat / 1 Wh SmallSat, plus baseline/heater electricity during 120 s. Doubling boot power doubles that extra energy; zero stored reserve refuses startup. No dose-based SEU frequency is claimed.

## T6 — bounded seeded Mars capture demand

Expert Red Relay plans against `nominal Δv × 1.08` (upper-envelope fraction 0.08, allowed 0–0.2). The once-seeded realization is uniform within `[−0.04,+0.08]` of nominal (lower-fraction authoring −0.1–0). This bounded authored exercise distribution is not an estimated probability distribution of real navigation error. Fuel planning, cost, tank and strict mass limits use the same upper requirement as launch validation. The burn consumes rocket-equation propellant for the retained realization, not the planning upper bound. Insufficient realized capability records nominal, planned, realized, loaded capability and remaining fuel and fails; no negative fuel or fabricated off-nominal orbit is produced.

`capture.availableKms` and `reserveKms` preserve **loaded pre-burn** capability and loaded-minus-upper-planning reserve for reporting; `propellantKg` is current remaining fuel. `realizedKms` is retained in run state and can be revealed at confirmation. On success the displayed orbit remains the nominal selected teaching orbit, explicitly not an actual dispersed solution.

**Reference:** every realized requirement lies between 0.96 and 1.08 times nominal. A design loaded exactly to the upper bound can satisfy every realization in this envelope, subject to the same dry-mass/engine model. Increasing upper fraction increases rocket-equation fuel monotonically; there is no free burn reserve.

## Crew, deployment and lifecycle additions

Crew Pathfinder uses the BVAD Rev. 2 Table 3-31 per-person daily oxygen, CO₂, water and dry-food values disclosed in [Simulation](./SIMULATION.md). Finite gas, powered scrubbing, retained waste, authored leak and six-hour recovery are reduced models, not individual physiology or clinical thresholds. Deorbit consumes finite fuel and recovery consumption continues. A support-loss outcome is not a diagnosis.

CubeSat deployables have state-dependent capability and a seeded authored anomaly. Paid mitigation changes the exercise model, without certifying reliability. Disposal uses an uncertain authored area/mass/orbit screen; it neither propagates orbital drag in the live model nor asserts legal compliance.

Provided orbits retain UTC/MJ2000Eq initial elements; live trajectory state is frame-qualified position and velocity with derived elements. GMAT initial conditions import neither force models nor subsystems; unsupported lunar interchange is explicitly refused. Historical rules-v4 engineering outputs are regression references, not comparable rules-v5 score identities. Sun, transfer and forecast limits are in [Simulation](./SIMULATION.md); executed checks are in [Verification](./VERIFICATION.md).

Crew return opportunities are authored ten-minute windows repeating every 90 minutes from 12 hours elapsed. A 10-second onboard deorbit action uses a two-body burn to an 80 km entry perigee; recovery is a separate six-hour abstraction. An early window can support a successful return when actual product and support requirements are met, but cannot satisfy the separate 72-hour orbital-duration requirement.
