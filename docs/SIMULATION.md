# Simulation and mission execution

Core is authoritative for model state, resources, commands and outcomes. This is a reduced educational simulation, not flight-qualified operations or a medical model. [Missions](./MISSIONS.md), [Resources](./RESOURCES.md) and [Technical models](./TECHNICAL_MODELS.md) describe objectives, evidence and parameters. This page does not claim a new verification run.

The turn-based cutover retains the scientific contracts below. Build-specific verification, including independent GMAT comparisons, is recorded separately in [Verification](./VERIFICATION.md).

## Identity and transactions

A design embeds its resolved immutable mission definition and digest, level, paid hardware, revision, burns and either a provided orbit or surface-launch configuration. `createSim(design, seed)` validates readiness and freezes the flown configuration. Both levels retain quaternion attitude and resource conservation; Expert additionally enables the applicable engineering mechanisms. Saves and certificates carry rules/model versions; old snapshots are rejected rather than relabelled.

`issueCommand(state, command, role, actor?)` produces an immutable state or refusal. A receipt records issuing actor, owning discipline, transport, timestamps and status; acceptance is not execution. Ground requests wait for contact and Mars transmission adds one-way light time. Onboard crew/deployment procedures wait their authored execution time independently of radio, and metabolism continues during that time. A confirmed `endMission` is an immediate session action, not a radio command or a successful completion. Faults win ties with command arrivals; arriving commands are revalidated.

Resource integration retains the absolute ten-second grid and event/command deadlines. Surface ascent uses a separate bounded 0.5-second RK4 grid; orbital coast uses conic propagation. Requested elapsed time, integration remainder and event stops remain authority-owned. Decision pauses discard unplayed post-decision time. Scheduled faults are seeded, not sampled per display frame. `nextBoundary` reports known opportunities and deadlines, not a guarantee against earlier threshold events.

## Decision-based execution

`turnDecision` derives up to four plans from the current committed state. A player selects a high-level operational plan, previews its elapsed mission time, resource changes and stopping boundary, then commits explicitly. Plans automate routine pointing, instrument, deployment and contact operations using the same resource and trajectory engine; automation is declared onboard plan execution, not a fictional instantaneous ground uplink.

`previewTurn` and `commitTurn` share resolution code. Selection and preview never mutate the real state. Resolution stops on plan completion, a required opportunity, terminal outcome or material hazard. Each receipt records actual elapsed time, boundary, interruption, physical deltas and objective evidence. Internal numerical/work-limit errors retain the previous committed state rather than inventing a physical failure.

The pure session authority binds a commitment to decision ID, turn revision, attempt and device-correlated intent ID. A duplicate cannot execute twice. Same-seed retries create a new attempt; Aspiring decision-checkpoint retries are explicitly assisted.

Static and LAN play have no advancing wall-clock loop. `tickSession` and `advanceSession` leave an active turn game unchanged. Bun serializes explicit commitments and only schedules network maintenance; browsers receive snapshots and cannot take over a disconnected room. Reading, Help, sleep, reconnect and playback do not consume mission time. See [Multiplayer](./MULTIPLAYER.md).

## Orbit and environment

Initial provided orbits specify body, UTC epoch, MJ2000Eq frame and Keplerian elements. Live trajectory state uses body-relative position in km and velocity in km/s; derived elements may describe bound, parabolic or escaping motion. Earth/Moon flight uses patched two-body conics; the Moon follows an explicitly reduced circular ephemeris. Within each patch only its central body's gravity acts. Earth–Moon station visibility uses finite segment/sphere occultation; Earth shadow remains a cylindrical approximation. Station allocation is definition-authored, not a real network booking. Mars retains its separate analytical transfer model.

Mars cruise is analytically skipped to capture rather than pretending to integrate cruise power or science. Capture confirmation consumes calculated fuel; a failure remains a failure even if later science would have been possible. Earth CubeSat deployables begin stowed where applicable, and deployed state affects the corresponding generation or antenna capability. An authored deployment anomaly can be retried; paid mitigation does not guarantee success. Disposal screening is separate from live propagation and is not regulatory approval.

### Surface ascent, burns and lunar flight

Surface launch begins at the declared rotating-Earth site with paid staged launcher mass and finite propellant. The reduced ascent model includes thrust, gravity and exponential-atmosphere drag; staging, cutoff, coast, impact and orbital handoff are physical events, not cinematic milestones. It omits lift, winds, structural loads and Mach-dependent aerodynamics.

Burns specify a source (`SPACECRAFT` or `UPPER_STAGE`), an inertial or velocity-normal-radial vector, and a time, apsis or lunar-entry trigger. They are explicitly impulsive, consume rocket-equation propellant and can be refused; no infinite-fuel preview becomes authority state. Launch/Orbit owns trajectory actions. Attitude steering remains a distinct Spacecraft command.

The lunar progression is ascent → parking orbit → injection → encounter → capture → observation/data return. Entering the Moon's sphere of influence is not capture; capture requires a bound lunar orbit and the declared objective evidence. Changing reference frame must preserve absolute position and velocity. No landing, real ephemeris, continuous three-body dynamics or crew lunar return is implied. Worker recommendations and forecasts do not install or execute a plan automatically.

### Attitude, Sun and transport

`attitude.q` is a unit quaternion `(x,y,z,w)` mapping body axes into MJ2000Eq. Body **+X** is the single effective solar-panel normal; **+Z** is the instrument and directional-antenna boresight. `POINT` selects a tracking hold: Sun/SAFE aligns the panel to Sun, Target is nadir, Earth tracks the station line (Earth), the Earth-planet vector (Mars), or nadir for crew. Roll maximizes panel illumination subject to the boresight constraint. `ATTITUDE_TARGET` selects an inertial manual quaternion; it never rotates the orbit or camera.

Actual orientation slews by the shortest quaternion arc at the installed ADCS rate. Rates and deterministic calibration biases are paid catalogue assumptions, not rigid-body torque dynamics. There is no instantaneous Aspiring teleport. Array generation is rated watts × illumination × positive panel–Sun cosine × lifetime factor. Target instruments require actual boresight error within their catalogue cone; directional throughput follows a cosine-power beam with the stated half-power angle. Mode names grant no science, power or link. Quaternion, target, actual angular rate and three angle gauges are live telemetry and retained history.

Manual targets are Spacecraft-owned ground requests: LEO waits for contact, Mars adds light time only after transmission. Crew targets and holds are onboard and immediately accepted for finite physical slewing, independent of radio. Other procedures retain their execution duration. A bounded optional `gestureId` coalesces only unsent targets from the same actor and gesture into one receipt, preserving issue/expiry times. Transmitted targets cannot be recalled or rewritten; a later target is another intent.

Earth's low-precision Sun uses mean longitude/anomaly, first two equation-of-center harmonics and fixed 23.439° obliquity. Precession, nutation and aberration are omitted. Mars remains a circular, ideal-transfer-phased approximation in the same ecliptic/equatorial axes, not a real-date Mars ephemeris. `transferPosition(t, epochUTC)` solves Kepler on the ideal Hohmann ellipse in heliocentric km, matching departure Earth and arrival Mars in this reduced model; no cruise engineering samples are invented.

### Forecasts are not flight results

`forecastTimeline(state, horizonSec)` samples the same eclipse/contact geometry used in integration, including allocation and the known outage. It returns absolute sunlight, shadow, contact, nadir-target opportunity, storm, known-event and planned-end windows without mutation. Horizon is capped at seven days, with at most 4,096 sample intervals per lane; detected edges are refined to 0.25 s. Windows narrower than the sample spacing may be missed. Target opportunities mean lit-orbit nadir access, not coverage of an invented geographic site. Future capture success and threshold failures are not predicted as scheduled facts.

`forecastMission(design, 'DEFAULT', horizonSec)` clones an eligible design and flies a deterministic public-command policy: deploy/retry, observe in sunlight (radiation monitoring continuously), point Earth and send in contact, Sun otherwise; handle authored recovery using real commands. The ground policy reviews every 60 s and at pauses; it is not an uploaded autonomous plan and cannot bypass uplink, slew, power, crew, storage or fuel constraints. It runs up to 90 operational days after analytical cruise. A full crew orbital horizon includes finite deorbit/recovery. It returns at most 512 sampled battery/storage/delivery points and SUCCESS only for a genuinely successful terminal state, FAILURE for retained failure, otherwise INCOMPLETE. No dry run is scored or substituted for a flight.


## Crew support and recovery

Crew Pathfinder uses four virtual crew with the BVAD Rev. 2 per-person daily baseline: 0.895 kg oxygen, 1.085 kg CO₂, 3.217 kg potable water and 0.800 kg dry food. The cabin gas volume, temperature, supply, scrubber and recovery parameters are authored game assumptions. Cabin partial pressures use ideal-gas quantities; fan-powered scrubbing is limited by available gas and cartridge capacity. Empty tanks cannot supply gas. Consumed food, water and oxygen transfer into retained inventory rather than disappearing from total mass; modeled exhaust/leakage and propellant burn reduce retained mass.

The authored sorbent rating is 0.65 kg CO₂ per kg sorbent; two 12 kg CO₂-capacity cartridges imply approximately 36.9 kg of sorbent within the paid support-system mass, with housing and packaging included in that hardware abstraction. No certified canister performance is claimed.

The runway is the minimum of oxygen, water, food and scrubber capacities and must be interpreted with working airflow. Warnings and terminal `CREW_SUPPORT_LOST` describe modeled support requirements, never a diagnosis. An Expert gas-leak exercise has a visible event and onboard isolation/repressurization decisions. The lifecycle is ON_ORBIT → DEORBIT → RECOVERY → COMPLETE. The deorbit calculation uses an authored entry perigee and finite fuel; recovery is an abstracted six-hour phase, not atmospheric entry dynamics. Consumables continue through recovery. A recovered early return can succeed when the returned data goal and support through recovery are achieved; its separate nominal 72-hour duration requirement remains unmet.

## Evidence and history

Power and science integrate from the prior interval state; data must be generated, retained and actually returned to satisfy a delivery objective. `OBJECTIVE_MET` is not by itself mission completion. Review is terminal-only; a first failure and observed results remain separate from a score. Assisted rewinds restore a prior physical/random/queue snapshot, truncate the later branch and append an assistance marker.

Telemetry exposes actual power, data, position, retained/launch mass, phase-aware clock, applicable crew and deployment state. `history` stores bounded whole-attempt samples and `historyInfo` reports decimation; `attemptAudit` reports a bounded decision/event trail and its own decimation flag. The active receipt buffer is not an unlimited debrief archive. Analytical cruise is not fabricated as continuous engineering history; sampling, decimation and unmodeled causes limit replay and causal claims.

Objective evidence identifies each declared objective, owner, required flag, state (`NOT_EVALUATED`, `IN_PROGRESS`, `MET`, `FAILED`), actual/target/unit, source and dwell history. Delivery, orbit, ascent, encounter, reserve and crew objectives are evaluated from physical state, not mission names. Terminal outcome and objective achievement are distinct; ending an attempt early does not manufacture completion. Run identity includes definition ID/revision/digest/origin, rules/model versions, level, seed, assistance and policy. Earlier scores remain separate. Actual checks are recorded in [Verification](./VERIFICATION.md).

Crew return opportunities are authored ten-minute windows repeating every 90 minutes from 12 hours elapsed. A 10-second onboard deorbit action uses a two-body burn to an 80 km entry perigee; recovery is a separate six-hour abstraction. An early window can support a successful return when actual product and support requirements are met, but cannot satisfy the separate 72-hour orbital-duration requirement.
