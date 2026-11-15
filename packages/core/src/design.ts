import type { ActorRole, BodyId, Budgets, Command, Design, OrbitChoice, Quote, Refusal, RefusalCode, RoleId } from './contracts';
import { BUSES, MODEL, PART_BY_ID, RIDES, listOrbitPresets, rideCost, rideOffersOrbit } from './catalog';
import { CONSTANTS, DAY, captureDeltaV, cylinderEclipse, earthFromSunCraft, elementsForOrbit, inStationContact, linkRateKbps, marsLineOfSight, orbitPosition, orbitalPeriod, propellantNeeded, rocketDeltaV, solarFactor, solarInput, stationPosition, sunDirectionAt, sunLineOfSight, hohmann, orbitAltitudes, planetPosition, makeOrbit } from './physics';
import { crewReturnFuel } from './return';
import { ENGINEERING, LEVELS, RULES_VERSION, THERMAL_MODELS, isTechnical, stationAllocated, thermalEquilibriumK } from './models';
import { antennaGain } from './attitude';
import { LAUNCHER_BY_ID } from './flight/launchers';
import { runAscent } from './flight/ascentRun';
import { orbitChoiceFromState, add } from './flight/conic';
import { moonState, segmentHitsSphere } from './flight/moon';
import { burnSpecValid } from './sim/trajectory';
import type { AscentProgram, BurnSpec } from './mission/types';
import { ascentProgramIssue } from './flight/program';

export const ROLES: readonly RoleId[] = ['SCIENCE', 'SPACECRAFT', 'LAUNCH_ORBIT', 'GROUND_COMMS'];
export const refusal = (code: RefusalCode, values: Record<string, number | string> = {}): Refusal => ({ ok: false, code, values });
export const ownsRole = (actor: ActorRole, owner: RoleId): boolean => actor === 'ALL' || actor === owner;
export function commandRole(cmd: Command): RoleId { return cmd.kind === 'CAPTURE_CONFIRM' || cmd.kind === 'CREW_DEORBIT' || cmd.kind === 'BURN_SCHEDULE' || cmd.kind === 'BURN_CANCEL' || cmd.kind === 'SEPARATE_STAGE' ? 'LAUNCH_ORBIT' : cmd.kind === 'INSTRUMENT' || cmd.kind === 'DUTY_CYCLE' || cmd.kind === 'POINT' && cmd.mode === 'TARGET' ? 'SCIENCE' : cmd.kind === 'DOWNLINK' || cmd.kind === 'LINK_MODE' ? 'GROUND_COMMS' : 'SPACECRAFT'; }
export function orbitOffered(design: Design, orbit: OrbitChoice, rideId = design.rideId): boolean {
 const start = design.definition.start;
 return start.kind === 'PROVIDED_ORBIT' && design.definition.vehicle.allowedRideIds.includes(rideId ?? '') && rideOffersOrbit(rideId, design.busId, start.body, orbit);
}
/** solarScale and earthRangeKm are day means used only for Sun-centred orbits (solar input and link range vary with heliocentric position). */
interface Forecast { periodMin: number; eclipseFrac: number; maxEclipseSec: number; contactMinPerDay: number; targetSolar: number; earthSolar: number; solarScale: number; earthRangeKm: number }
const forecasts = new Map<string, Forecast>();
/** Mass of the spacecraft as designed (structure, parts, propellant); the launcher payload. */
export function designMassKg(design: Design): number {
 let mass = BUSES[design.busId].structureMassKg.v;
 for (const item of design.parts) { const p = PART_BY_ID[item.partId]; if (p) mass += p.massKg.v * item.qty + (item.propellantKg ?? 0) * item.qty; }
 return mass;
}
const ascentOrbits = new Map<string, OrbitChoice | null>();
/** The orbit used for power/contact planning: the provided one, the ascent's predicted insertion orbit, or a nominal circular lunar orbit. */
function planningOrbit(design: Design): OrbitChoice | null {
 if (design.orbit) return design.orbit;
 const def = design.definition, epoch = def.environment.epochUTC;
 const lunar = def.objectives.find(o => o.spec.kind === 'BOUND_ORBIT' && o.spec.body === 'MOON')?.spec;
 if (lunar && lunar.kind === 'BOUND_ORBIT') { const alt = (lunar.periapsisAltKm.min + lunar.periapsisAltKm.max) / 2; return makeOrbit('MOON', alt, alt, 90, epoch); }
 if (def.start.kind !== 'SURFACE_LAUNCH' || !design.launch || !LAUNCHER_BY_ID[design.launch.launcherId]) return null;
 // The ascent is a pure function of (definition, launch plan, payload mass); budgets are recomputed constantly, the flight is not.
 const mass = designMassKg(design), key = `${def.digest}|${JSON.stringify(design.launch)}|${mass}`;
 if (ascentOrbits.has(key)) return ascentOrbits.get(key)!;
 const run = runAscent(def, design.launch, mass, 10);
 const orbit = run.outcome === 'ORBIT' ? orbitChoiceFromState('EARTH', run.r, run.v, new Date(Date.parse(epoch) + run.tEnd * 1000).toISOString()) : null;
 if (ascentOrbits.size >= 32) ascentOrbits.delete(ascentOrbits.keys().next().value!);
 ascentOrbits.set(key, orbit);
 return orbit;
}
function estimate(design: Design): Forecast | null {
 const o = planningOrbit(design);
 if (!o) return null;
 const def = design.definition;
 const key = `${def.digest}|${design.levelId}|${design.rulesVersion}|${design.stationId}|${JSON.stringify(o)}`;
 const cached = forecasts.get(key);
 if (cached) return cached;
 const epoch = o.body === 'MARS' && !(def.start.kind==='PROVIDED_ORBIT'&&def.start.initialPhase==='OPERATIONS') ? hohmann().transferSec : 0, dt = MODEL.forecastStepSec.v, crew = def.support.crew, allocation = def.environment.stationAllocationStartSec, sunCentred = o.body === 'SUN';
 let eclipseSec = 0, contactSec = 0, run = 0, longest = 0, initialRun = 0, stillInitial = true, targetSolar = 0, earthSolar = 0, solarSum = 0, rangeSum = 0;
 for (let t = 0; t < DAY; t += dt) {
  const p = orbitPosition(o, t), sun = sunDirectionAt(o.body, p, epoch + t, o.epochUTC);
  const radius = Math.hypot(...p), targetCos = -(p[0]*sun[0]+p[1]*sun[1]+p[2]*sun[2])/radius;
  const station = o.body !== 'MARS' && !sunCentred ? stationPosition(t,'EARTH',MODEL.stationLat.v,MODEL.stationLon.v,undefined,o.epochUTC) : null;
  const moon = o.body === 'MOON' ? moonState(t, o.epochUTC) : null, earthPos = moon ? add(p, moon.r) : p;
  const earthPlanet = o.body === 'MARS' ? planetPosition('EARTH',epoch+t,o.epochUTC) : null, marsPlanet = o.body === 'MARS' ? planetPosition('MARS',epoch+t,o.epochUTC) : null;
  const earth = o.body === 'MARS' ? [earthPlanet![0]-marsPlanet![0]-p[0],earthPlanet![1]-marsPlanet![1]-p[1],earthPlanet![2]-marsPlanet![2]-p[2]] : sunCentred ? earthFromSunCraft(p, epoch + t, o.epochUTC) : !crew ? [station![0]-earthPos[0],station![1]-earthPos[1],station![2]-earthPos[2]] : [-earthPos[0],-earthPos[1],-earthPos[2]];
  const earthCos = (earth[0]*sun[0]+earth[1]*sun[1]+earth[2]*sun[2])/Math.hypot(...earth);
  // Nothing eclipses a Sun-centred craft.
  const shadow = !sunCentred && cylinderEclipse(p, sun, CONSTANTS[o.body].radius.v);
  if (!shadow) { targetSolar += Math.sqrt(Math.max(0,1-targetCos**2))*dt; earthSolar += Math.sqrt(Math.max(0,1-earthCos**2))*dt; }
  if (shadow) { eclipseSec += dt; run += dt; if (stillInitial) initialRun += dt; longest = Math.max(longest, run); }
  else { run = 0; stillInitial = false; }
  if (sunCentred) { solarSum += solarInput('SUN', p) * dt; rangeSum += Math.hypot(...earth) * dt; }
  const contact = crew ? true : o.body === 'MARS' ? marsLineOfSight(p, epoch + t, o.epochUTC) : sunCentred ? sunLineOfSight(p, epoch + t, o.epochUTC) : inStationContact(earthPos, station!, MODEL.minElevation.v) && !(moon && segmentHitsSphere(station!, earthPos, moon.r, CONSTANTS.MOON.radius.v));
  if (contact && (crew || !isTechnical(design.levelId) && o.body !== 'MARS' && !sunCentred || stationAllocated(epoch + t, allocation))) contactSec += dt;
 }
 longest = Math.max(longest, stillInitial ? run : run + initialRun);
 const value = { periodMin: orbitalPeriod(elementsForOrbit(o).a, CONSTANTS[o.body].mu.v) / 60, eclipseFrac: eclipseSec / DAY, maxEclipseSec: longest, contactMinPerDay: contactSec / 60, targetSolar: targetSolar/DAY, earthSolar: earthSolar/DAY, solarScale: sunCentred ? solarSum / DAY : solarFactor(o.body), earthRangeKm: rangeSum / DAY };
 if (forecasts.size >= 64) forecasts.delete(forecasts.keys().next().value!);
 forecasts.set(key, value);
 return value;
}
export function computeBudgets(design: Design): Budgets {
 const bus = BUSES[design.busId], def = design.definition;
 const body: BodyId = design.orbit?.body ?? (def.start.kind === 'PROVIDED_ORBIT' ? def.start.body : def.objectives.some(o => o.spec.kind === 'BOUND_ORBIT' && o.spec.body === 'MOON') ? 'MOON' : 'EARTH');
 const plannedDv = design.burns.reduce((n, b) => b.source === 'SPACECRAFT' ? n + Math.hypot(b.dv[0], b.dv[1], b.dv[2]) : n, 0);
 let mass = bus.structureMassKg.v, volume = 0, cost = bus.cost.v, load = 0, solar = 0, battery = 0, storage = 0, generationRate = 0, radioRate = 0, propellant = 0, isp = 0, heater = 0, baseLoad = 0, peakLoad = 0, fullRadioRate = 0;
 const forecast = estimate(design);
 const sunlight = forecast ? 1 - forecast.eclipseFrac : 0;
 const accuracy = design.parts.map(item => PART_BY_ID[item.partId]).find(p => p?.category === 'ADCS')?.accuracyDeg?.v ?? 15;
 for (const item of design.parts) {
  const p = PART_BY_ID[item.partId];
  if (!p) continue;
  const fuel = (item.propellantKg ?? 0) * item.qty;
  mass += p.massKg.v * item.qty + fuel;
  volume += p.volume.v * item.qty;
  cost += p.cost.v * item.qty + fuel * MODEL.propellantCostPerKg.v;
  solar += (p.generationW?.v ?? 0) * item.qty;
  battery += (p.capacityWh?.v ?? 0) * item.qty;
  storage += (p.storageMB?.v ?? 0) * item.qty;
  propellant += fuel;
  heater += (p.heaterW?.v ?? 0) * item.qty;
  if (p.category !== 'INSTRUMENT' && p.category !== 'PROPULSION') baseLoad += p.powerW.v * item.qty;
  if (p.category !== 'PROPULSION') peakLoad += p.powerW.v * item.qty;
  if (p.category === 'RADIO' && p.id !== 'SS_UHF_RELAY') fullRadioRate += (p.rateKbps?.v ?? 0) * item.qty;
  if (p.ispSec) isp = p.ispSec.v;
  if (p.category === 'INSTRUMENT') {
   const duty = p.requiresTarget ? MODEL.targetDuty.v : 1;
   const pointing = p.requiresTarget && accuracy > p.coneHalfAngleDeg!.v ? 0 : 1;
   generationRate += (p.rateKbps?.v ?? 0) * duty * pointing * (p.requiresLight ? sunlight : 1) * item.qty;
   load += p.powerW.v * duty * item.qty;
  } else if (p.category === 'RADIO') {
   // A surface relay does not carry mapping data to Earth in this mission.
   if (p.id !== 'SS_UHF_RELAY') radioRate += (p.rateKbps?.v ?? 0) * (p.directional ? MODEL.earthDuty.v * antennaGain(accuracy,p.beamHalfAngleDeg!.v) : 1) * item.qty;
   const txDuty = forecast ? forecast.contactMinPerDay / 1440 * (p.directional ? MODEL.earthDuty.v : 1) : 0;
   load += (p.powerW.v + ((p.txPowerW?.v ?? p.powerW.v) - p.powerW.v) * txDuty) * item.qty;
  } else if (p.category !== 'PROPULSION') load += p.powerW.v * item.qty;
 }
 const ride = RIDES.find(r => r.id === design.rideId);
 if (ride) cost += rideCost(ride, design.busId);
 const launcher = design.launch ? LAUNCHER_BY_ID[design.launch.launcherId] : undefined;
 if (launcher) cost += launcher.cost.v;
 // Sun-centred orbits: day-mean (1 AU / r)² for generation, perihelion (1 AU / rp)² for the hot case, no planetary infrared, and the forecast craft-Earth range for the link.
 const sunCentred = body === 'SUN', genSolar = sunCentred ? forecast?.solarScale ?? 0 : solarFactor(body);
 const hotSolar = sunCentred && design.orbit ? (CONSTANTS.EARTH.distanceKm.v / (design.orbit.smaKm * (1 - design.orbit.ecc))) ** 2 : solarFactor(body), linkRangeKm = sunCentred ? forecast?.earthRangeKm : undefined;
 const avgGen = solar * genSolar * (sunlight * MODEL.sunDuty.v + MODEL.targetDuty.v * (forecast?.targetSolar ?? 0) + MODEL.earthDuty.v * (forecast?.earthSolar ?? 0)) * Math.max(0,Math.cos(accuracy*Math.PI/180));
 const technical = isTechnical(design.levelId), m = THERMAL_MODELS[design.busId], bodyHeatW = sunCentred ? 0 : m.bodyHeatW.v;
 const eolGen = avgGen * (technical ? ENGINEERING.arrayEol.v : 1), eolBattery = battery * (technical ? ENGINEERING.batteryEol.v : 1);
 // The declared forecast duty includes 30% automatic-heater use. Eclipse reserve
 // conservatively carries the entire installed heater rating throughout shadow.
 const plannedLoad = load + (technical ? heater * MODEL.targetDuty.v : 0);
 const eclipseWh = (load + (technical ? heater : 0)) * (forecast?.maxEclipseSec ?? 0) / 3600;
 const delivery=body==='MARS'&&design.orbit&&!(def.start.kind==='PROVIDED_ORBIT'&&def.start.initialPhase==='OPERATIONS');
 const nominalCapture = delivery ? captureDeltaV(design.orbit!) : plannedDv;
 const planningTimeSec=delivery?hohmann().transferSec:0;
 const extraRadiatorM2=design.parts.reduce((n,i)=>n+(PART_BY_ID[i.partId]?.radiatorM2?.v??0)*i.qty,0);
 return {
  massKg: { used: mass, limit: bus.massKg.v }, volume: { used: volume, limit: bus.volume.v, unit: design.busId === 'CUBESAT_3U' ? 'U' : 'BAY' }, cost: { used: cost, limit: def.vehicle.budget * (LEVELS[design.levelId]?.budgetFactor.v ?? 1) },
  orbit: forecast ? { periodMin: forecast.periodMin, eclipseFrac: forecast.eclipseFrac, contactMinPerDay: forecast.contactMinPerDay } : null,
  power: forecast ? { avgGenW: eolGen, avgLoadW: plannedLoad, marginPct: plannedLoad ? (eolGen - plannedLoad) / plannedLoad * 100 : eolGen ? 100 : 0, eclipseWh, usableBatteryWh: eolBattery * MODEL.usableDepth.v } : null,
  data: forecast ? { genMBPerDay: generationRate * DAY / 8000, downMBPerDay: linkRateKbps(radioRate, body,planningTimeSec, design.orbit?.epochUTC, linkRangeKm) * forecast.contactMinPerDay * 60 / 8000, storageMB: storage } : null,
  deltaV: body === 'MARS' && design.orbit ? { requiredKms:nominalCapture, availableKms: rocketDeltaV(mass - propellant, propellant, isp), propellantKg: propellant } : def.trajectory.model === 'PATCHED_CONICS' && def.trajectory.maneuvers.allowed ? { requiredKms: plannedDv, availableKms: rocketDeltaV(mass - propellant, propellant, isp), propellantKg: propellant } : null,
  technical: technical && forecast ? { bolGenerationW: avgGen, eolGenerationW: eolGen, eolCapacityWh: eolBattery, eolUsableBatteryWh: eolBattery * MODEL.usableDepth.v, eclipseRequiredWh: eclipseWh, nominalCaptureKms: nominalCapture, planningCaptureKms: nominalCapture * (1 + ENGINEERING.captureHigh.v), thermalColdEquilibriumK: thermalEquilibriumK(design.busId, baseLoad + bodyHeatW + heater + (design.busId === 'CREW_CAPSULE' ? 4 * 12.426e6 / DAY : 0),extraRadiatorM2), thermalHotEquilibriumK: thermalEquilibriumK(design.busId, peakLoad + bodyHeatW + (design.busId === 'CREW_CAPSULE' ? 4 * 12.426e6 / DAY : 0) + ENGINEERING.solarFlux.v * hotSolar * m.absorbingM2.v,extraRadiatorM2), recordingRequiredMB: def.vehicle.minRecordingMB, minimumLinkKbps: linkRateKbps(fullRadioRate, body,planningTimeSec, design.orbit?.epochUTC, linkRangeKm) } : null,
 };
}
function limits(design: Design): Refusal | null {
 const b = computeBudgets(design);
 if (b.volume.used > b.volume.limit + 1e-9) return refusal('NO_SLOT', { used: b.volume.used, part: 0, limit: b.volume.limit });
 if (b.massKg.used >= b.massKg.limit - 1e-9) return refusal('MASS_OVER_LIMIT', { after: b.massKg.used, limit: b.massKg.limit });
 if (b.cost.used > b.cost.limit + 1e-9) return refusal('OVER_BUDGET', { after: b.cost.used, limit: b.cost.limit });
 const launcher = design.launch ? LAUNCHER_BY_ID[design.launch.launcherId] : undefined;
 if (launcher && b.massKg.used > launcher.payloadLimitKg + 1e-9) return refusal('PAYLOAD_OVER_LIMIT', { after: b.massKg.used, limit: launcher.payloadLimitKg, launcher: launcher.id });
 return null;
}
export function quoteAddPart(design: Design, partId: string, role: ActorRole): Quote<{ next: Design; delta: Partial<Budgets> }> {
 const p = PART_BY_ID[partId];
 if (!p) return refusal('REQUIRES_PART', { needs: partId });
 if (!ownsRole(role, p.role)) return refusal('ROLE_LOCKED', { role: p.role });
 if (p.busId !== design.busId) return refusal('RIDE_MISMATCH', { part: partId, bus: design.busId });
 if ((p.unique && design.parts.some(item => PART_BY_ID[item.partId]?.category === p.category)) || (partId === 'CREW_SUPPORT' && design.parts.some(item => item.partId === partId))) return refusal('DUPLICATE_UNIQUE', { part: partId });
 const old = design.parts.find(item => item.partId === partId);
 const parts = old ? design.parts.map(item => item.partId === partId ? { ...item, qty: item.qty + 1 } : item) : [...design.parts, { partId, qty: 1 }];
 const next = { ...design, parts, revision: design.revision + 1 };
 const blocked = limits(next);
 if (blocked) return blocked;
 if (p.directional && !design.parts.some(item => PART_BY_ID[item.partId]?.category === 'ADCS')) return refusal('REQUIRES_PART', { needs: 'ADCS' });
 return { ok: true, value: { next, delta: computeBudgets(next) } };
}
export function quoteRemovePart(design: Design, partId: string, role: ActorRole): Quote<{ next: Design }> {
 const p = PART_BY_ID[partId], old = design.parts.find(item => item.partId === partId);
 if (!p || !old) return refusal('REQUIRES_PART', { needs: partId });
 if (!ownsRole(role, p.role)) return refusal('ROLE_LOCKED', { role: p.role });
 return { ok: true, value: { next: { ...design, parts: old.qty > 1 ? design.parts.map(item => item.partId === partId ? { ...item, qty: item.qty - 1 } : item) : design.parts.filter(item => item.partId !== partId), revision: design.revision + 1 } } };
}
export function quoteSetRide(design: Design, rideId: string, role: ActorRole): Quote<{ next: Design }> {
 if (!ownsRole(role, 'LAUNCH_ORBIT')) return refusal('ROLE_LOCKED', { role: 'LAUNCH_ORBIT' });
 const ride = RIDES.find(r => r.id === rideId), start = design.definition.start;
 if (start.kind !== 'PROVIDED_ORBIT' || !design.definition.vehicle.allowedRideIds.includes(rideId) || !ride || !ride.busIds.includes(design.busId) || ride.body !== start.body) return refusal('RIDE_MISMATCH', { ride: rideId, bus: design.busId });
 const next = { ...design, rideId, orbit: design.orbit && orbitOffered(design, design.orbit, rideId) ? design.orbit : null, revision: design.revision + 1 };
 const blocked = limits(next);
 return blocked ?? { ok: true, value: { next } };
}
export function quoteSetOrbit(design: Design, orbit: OrbitChoice, role: ActorRole): Quote<{ next: Design }> {
 if (!ownsRole(role, 'LAUNCH_ORBIT')) return refusal('ROLE_LOCKED', { role: 'LAUNCH_ORBIT' });
 if (!orbitOffered(design, orbit)) return refusal('ORBIT_NOT_OFFERED', { ride: design.rideId ?? '', altitude: orbitAltitudes(orbit).altitudeKm });
 return { ok: true, value: { next: { ...design, orbit: { ...orbit }, revision: design.revision + 1 } } };
}
/** Choosing a launcher resets nothing the player authored except an ascent program that the new vehicle cannot fly. */
export function quoteSetLauncher(design: Design, launcherId: string, role: ActorRole): Quote<{ next: Design }> {
 if (!ownsRole(role, 'LAUNCH_ORBIT')) return refusal('ROLE_LOCKED', { role: 'LAUNCH_ORBIT' });
 const start = design.definition.start, launcher = LAUNCHER_BY_ID[launcherId];
 if (start.kind !== 'SURFACE_LAUNCH' || !launcher || !start.launcherIds.includes(launcherId)) return refusal('LAUNCHER_MISMATCH', { launcher: launcherId });
 const program = design.launch && !ascentProgramIssue(design.launch.program, launcher) ? design.launch.program : defaultProgramFor(launcher);
 const next = { ...design, launch: { launcherId, program }, revision: design.revision + 1 };
 return limits(next) ?? { ok: true, value: { next } };
}
export function quoteSetAscent(design: Design, program: AscentProgram, role: ActorRole): Quote<{ next: Design }> {
 if (!ownsRole(role, 'LAUNCH_ORBIT')) return refusal('ROLE_LOCKED', { role: 'LAUNCH_ORBIT' });
 if (design.definition.start.kind !== 'SURFACE_LAUNCH' || !design.launch) return refusal('NO_STAGE', { missing: 'launcher' });
 const issue = ascentProgramIssue(program, LAUNCHER_BY_ID[design.launch.launcherId]);
 if (issue) return refusal('ASCENT_PROGRAM_INVALID', { field: issue });
 return { ok: true, value: { next: { ...design, launch: { launcherId: design.launch.launcherId, program: { ...program } }, revision: design.revision + 1 } } };
}
export function quoteSetBurns(design: Design, burns: readonly BurnSpec[], role: ActorRole): Quote<{ next: Design }> {
 if (!ownsRole(role, 'LAUNCH_ORBIT')) return refusal('ROLE_LOCKED', { role: 'LAUNCH_ORBIT' });
 const refused = burnPlanIssue(design.definition, burns);
 return refused ?? { ok: true, value: { next: { ...design, burns: burns.map(b => ({ ...b, dv: [...b.dv] as [number, number, number] })), revision: design.revision + 1 } } };
}
/** A mid-range, flyable starting program for a launcher, aimed at the mission's inclination when the site allows it. */
export function defaultProgramFor(launcher: { stages: readonly unknown[] }): AscentProgram {
 return { azimuthDeg: 90, verticalSec: 8, kickDeg: launcher.stages.length > 1 ? 8 : 0, kickSec: 20, stage1LoadFraction: 1, stage2CoastSec: 0, insertionAltKm: 200, holdUpperStage: false };
}
/** Whole-plan check shared by quoting and readiness: allowed, bounded, unique ids, valid specs. */
export function burnPlanIssue(definition: Design['definition'], burns: readonly BurnSpec[]): Refusal | null {
 const m = definition.trajectory.model === 'PATCHED_CONICS' ? definition.trajectory.maneuvers : { allowed: false, maxBurns: 0 };
 if (burns.length && !m.allowed) return refusal('BURN_NOT_ALLOWED', { count: burns.length });
 if (burns.length > Math.min(m.maxBurns, 16)) return refusal('BURN_LIMIT', { count: burns.length, limit: Math.min(m.maxBurns, 16) });
 const ids = new Set<string>();
 for (const b of burns) { if (!burnSpecValid(b)) return refusal('INVALID_PARAMETER', { burn: typeof b?.id === 'string' ? b.id : 'invalid' }); if (ids.has(b.id)) return refusal('BURN_DUPLICATE_ID', { burn: b.id }); ids.add(b.id); }
 return null;
}
export function quoteSetPropellant(design: Design, kg: number, role: ActorRole): Quote<{ next: Design }> {
 if (!ownsRole(role, 'SPACECRAFT')) return refusal('ROLE_LOCKED', { role: 'SPACECRAFT' });
 const engine = design.parts.find(item => PART_BY_ID[item.partId]?.category === 'PROPULSION');
 if (!engine) return refusal('REQUIRES_PART', { needs: 'PROPULSION' });
 const tank = PART_BY_ID[engine.partId].tankKg!.v;
 if (!Number.isFinite(kg) || kg < 0 || kg > tank) return refusal('PROPELLANT_OVER_TANK', { after: Number.isFinite(kg) ? kg : 'invalid', limit: tank });
 const next = { ...design, parts: design.parts.map(item => item === engine ? { ...item, propellantKg: kg } : item), revision: design.revision + 1 };
 const blocked = limits(next);
 return blocked ?? { ok: true, value: { next } };
}
export function launchReadiness(design: Design, signoffs: Readonly<Record<RoleId, boolean>>): readonly Refusal[] {
 const result: Refusal[] = [];
 const def = design.definition, start = def.start;
 if (design.rulesVersion !== RULES_VERSION || !(design.levelId in LEVELS)) result.push(refusal('UNSUPPORTED_RULES', { rulesVersion: design.rulesVersion, levelId: design.levelId }));
 if (design.definitionDigest !== def.digest || design.missionId !== def.id) result.push(refusal('DEFINITION_STALE', { mission: design.missionId }));
 if (design.busId !== def.vehicle.busId) result.push(refusal('RIDE_MISMATCH', { bus: design.busId }));
 if (start.kind === 'PROVIDED_ORBIT') {
  if (!design.rideId) result.push(refusal('NOT_READY', { missing: 'ride' }));
  else {
   const ride = RIDES.find(r => r.id === design.rideId);
   if (!ride || !def.vehicle.allowedRideIds.includes(ride.id) || !ride.busIds.includes(design.busId) || ride.body !== start.body) result.push(refusal('RIDE_MISMATCH', { ride: design.rideId, bus: design.busId }));
  }
  if (!design.orbit) result.push(refusal('NOT_READY', { missing: 'orbit' }));
  else if (!orbitOffered(design, design.orbit)) result.push(refusal('ORBIT_NOT_OFFERED', { ride: design.rideId ?? '' }));
 } else {
  // Surface launch: the flight is the ascent. A launcher, a bounded program, a payload within the vehicle limit and a physically possible liftoff replace "orbit chosen".
  const launcher = design.launch ? LAUNCHER_BY_ID[design.launch.launcherId] : undefined;
  if (design.rideId || design.orbit) result.push(refusal('RIDE_MISMATCH', { ride: design.rideId ?? 'orbit' }));
  if (!design.launch || !launcher) result.push(refusal('NOT_READY', { missing: 'launcher' }));
  else if (!start.launcherIds.includes(launcher.id)) result.push(refusal('LAUNCHER_MISMATCH', { launcher: launcher.id }));
  else {
   const issue = ascentProgramIssue(design.launch.program, launcher);
   if (issue) result.push(refusal('ASCENT_PROGRAM_INVALID', { field: issue }));
   else if (runAscent(def, design.launch, designMassKg(design), 10).outcome === 'NO_LIFTOFF') result.push(refusal('ASCENT_FORECAST_FAILS', { launcher: launcher.id }));
  }
 }
 const planIssue = burnPlanIssue(def, design.burns);
 if (planIssue) result.push(planIssue);
 if (design.stationId !== def.environment.stationId) result.push(refusal('NOT_READY', { missing: 'station' }));
 for (const id of def.vehicle.requiredPartIds) if (!design.parts.some(p => p.partId === id)) result.push(refusal('REQUIRES_PART', { needs: id }));
 if (def.support.crew) {
  const engine = design.parts.find(p => p.partId === 'CREW_PROPULSION'), fuel = engine?.propellantKg ?? 0;
  const needed = design.orbit ? crewReturnFuel(design.orbit, computeBudgets(design).massKg.used, engine ? PART_BY_ID[engine.partId].ispSec?.v ?? 0 : 0) : Infinity;
  if (fuel < needed) result.push(refusal('RETURN_FUEL_SHORT', { availableKg: fuel, requiredKg: Number.isFinite(needed) ? needed : 'unknown' }));
 }
 for (const [category, missing] of [['RADIO', 'radio'], ['COMPUTER', 'obc']] as const) if (!design.parts.some(item => PART_BY_ID[item.partId]?.category === category && item.partId !== 'SS_UHF_RELAY')) result.push(refusal('NOT_READY', { missing }));
 const unique = new Set<string>();
 for (const item of design.parts) {
  const p = PART_BY_ID[item.partId];
  if (!p || p.busId !== design.busId) { result.push(refusal('RIDE_MISMATCH', { part: item.partId })); continue; }
  if (!Number.isInteger(item.qty) || item.qty < 1) result.push(refusal('NOT_READY', { missing: 'valid quantity' }));
  if ((p.unique && (unique.has(p.category) || item.qty !== 1)) || (p.id === 'CREW_SUPPORT' && (item.qty !== 1 || unique.has(p.id)))) result.push(refusal('DUPLICATE_UNIQUE', { part: item.partId }));
  if (p.unique) unique.add(p.category);
  if (p.id === 'CREW_SUPPORT') unique.add(p.id);
  const fuel = item.propellantKg ?? 0;
  if (!Number.isFinite(fuel) || fuel < 0 || fuel > (p.tankKg?.v ?? 0)) result.push(refusal('PROPELLANT_OVER_TANK', { after: Number.isFinite(fuel) ? fuel : 'invalid', limit: p.tankKg?.v ?? 0 }));
  if (p.directional && !design.parts.some(i => PART_BY_ID[i.partId]?.category === 'ADCS')) result.push(refusal('REQUIRES_PART', { needs: 'ADCS' }));
 }
 const blocked = limits(design);
 if (blocked) result.push(blocked);
 if (isTechnical(design.levelId)) {
  const b = computeBudgets(design), t = b.technical, requirement = def.vehicle, m = THERMAL_MODELS[design.busId];
  if (!design.parts.some(i => PART_BY_ID[i.partId]?.heaterW)) result.push(refusal('REQUIRES_PART', { needs: design.busId === 'SMALLSAT' ? 'SS_HEATER_60' : 'HEATER_6' }));
  if (t && b.power) {
   if (t.eolGenerationW + 1e-9 < b.power.avgLoadW) result.push(refusal('POWER_EOL_SHORT', { generationW: t.eolGenerationW, requiredW: b.power.avgLoadW, shortfallW: b.power.avgLoadW - t.eolGenerationW, source: 'engineering.arrayEol' }));
   if (t.eolUsableBatteryWh + 1e-9 < t.eclipseRequiredWh) result.push(refusal('ECLIPSE_RESERVE_SHORT', { availableWh: t.eolUsableBatteryWh, requiredWh: t.eclipseRequiredWh, source: 'engineering.batteryEol' }));
   if (t.thermalColdEquilibriumK < m.operatingMinK.v || t.thermalHotEquilibriumK > m.operatingMaxK.v) result.push(refusal('THERMAL_MARGIN_SHORT', { coldK: t.thermalColdEquilibriumK, hotK: t.thermalHotEquilibriumK, minK: m.operatingMinK.v, maxK: m.operatingMaxK.v, source: 'thermal' }));
   if ((b.data?.storageMB ?? 0) < requirement.minRecordingMB) result.push(refusal('DATA_CAPACITY_SHORT', { availableMB: b.data?.storageMB ?? 0, requiredMB: requirement.minRecordingMB }));
   if (t.minimumLinkKbps < requirement.minLinkKbps) result.push(refusal('LINK_UNAVAILABLE', { availableKbps: t.minimumLinkKbps, requiredKbps: requirement.minLinkKbps }));
   if (b.deltaV && b.deltaV.availableKms + 1e-9 < t.planningCaptureKms) result.push(refusal('CAPTURE_RESERVE_SHORT', { availableKms: b.deltaV.availableKms, requiredKms: t.planningCaptureKms, nominalKms: t.nominalCaptureKms, source: 'engineering.captureHigh' }));
  }
 }
 for (const role of ROLES) if (!signoffs[role]) result.push(refusal('SIGNOFF_BLOCKED', { role }));
 return result;
}
export function rolesAffectedBy(prev: Design, next: Design): readonly RoleId[] {
 if (prev === next || prev.revision === next.revision && JSON.stringify(prev) === JSON.stringify(next)) return [];
 const changed = new Set<RoleId>();
 if (prev.rideId !== next.rideId || JSON.stringify(prev.orbit) !== JSON.stringify(next.orbit) || prev.busId !== next.busId || prev.definitionDigest !== next.definitionDigest) for (const r of ROLES) changed.add(r);
if (JSON.stringify(prev.launch) !== JSON.stringify(next.launch) || JSON.stringify(prev.burns) !== JSON.stringify(next.burns)) { changed.add('LAUNCH_ORBIT'); changed.add('SPACECRAFT'); }
 if (prev.stationId !== next.stationId) changed.add('GROUND_COMMS');
 const ids = new Set([...prev.parts.map(p => p.partId), ...next.parts.map(p => p.partId)]);
 for (const id of ids) {
  if (JSON.stringify(prev.parts.find(p => p.partId === id)) === JSON.stringify(next.parts.find(p => p.partId === id))) continue;
  const part = PART_BY_ID[id]; if (!part) { for (const r of ROLES) changed.add(r); continue; }
  changed.add(part.role); changed.add('SPACECRAFT');
  if (part.category === 'INSTRUMENT' || part.category === 'STORAGE') changed.add('SCIENCE');
  if (part.category === 'RADIO') changed.add('GROUND_COMMS');
 }
 return ROLES.filter(role => changed.has(role));
}
export function previewOrbit(design: Design, presetId: string, role: ActorRole): Quote<{ next: Design; before: Budgets; after: Budgets }> {
 const preset = listOrbitPresets(design).find(p => p.id === presetId);
 if (!preset) return refusal('ORBIT_NOT_OFFERED', { ride: design.rideId ?? '', preset: presetId });
 const quote = quoteSetOrbit(design, preset.orbit, role);
 return quote.ok ? { ok: true, value: { next: quote.value.next, before: computeBudgets(design), after: computeBudgets(quote.value.next) } } : quote;
}
export function planPropellant(design: Design, role: ActorRole): Quote<{ next: Design; requiredKg: number; after: Budgets }> {
 if (!ownsRole(role, 'SPACECRAFT')) return refusal('ROLE_LOCKED', { role: 'SPACECRAFT' });
 if (!design.orbit || design.orbit.body !== 'MARS') return refusal('NOT_READY', { missing: 'orbit' });
 const engine = design.parts.find(item => PART_BY_ID[item.partId]?.ispSec);
 if (!engine) return refusal('REQUIRES_PART', { needs: 'PROPULSION' });
 const budget = computeBudgets(design), dry = budget.massKg.used - (budget.deltaV?.propellantKg ?? 0);
 const requiredKg = propellantNeeded(dry, (budget.deltaV?.requiredKms??0) * (isTechnical(design.levelId) ? 1 + ENGINEERING.captureHigh.v : MODEL.captureMargin.v), PART_BY_ID[engine.partId].ispSec!.v);
 const quote = quoteSetPropellant(design, requiredKg, role);
 return quote.ok ? { ok: true, value: { next: quote.value.next, requiredKg, after: computeBudgets(quote.value.next) } } : quote;
}
