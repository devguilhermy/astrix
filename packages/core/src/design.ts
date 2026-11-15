import type { ActorRole, Budgets, Command, Design, OrbitChoice, Quote, Refusal, RefusalCode, RoleId } from './contracts';
import { BUSES, MODEL, PART_BY_ID, RIDES, listOrbitPresets, rideCost, scenarioById } from './catalog';
import { CONSTANTS, DAY, captureDeltaV, cylinderEclipse, elementsForOrbit, inStationContact, linkRateKbps, marsLineOfSight, orbitPosition, orbitalPeriod, propellantNeeded, rocketDeltaV, solarFactor, stationPosition, sunDirection, hohmann, orbitAltitudes, planetPosition } from './physics';
import { crewReturnFuel } from './return';
import { ENGINEERING, LEVELS, MISSION_REQUIREMENTS, RULES_VERSION, THERMAL_MODELS, isTechnical, stationAllocated, thermalEquilibriumK } from './models';
import { antennaGain } from './attitude';

export const ROLES: readonly RoleId[] = ['SCIENCE', 'SPACECRAFT', 'LAUNCH_ORBIT', 'GROUND_COMMS'];
export const refusal = (code: RefusalCode, values: Record<string, number | string> = {}): Refusal => ({ ok: false, code, values });
export const ownsRole = (actor: ActorRole, owner: RoleId): boolean => actor === 'ALL' || actor === owner;
export function commandRole(cmd: Command): RoleId { return cmd.kind === 'CAPTURE_CONFIRM' || cmd.kind === 'CREW_DEORBIT' ? 'LAUNCH_ORBIT' : cmd.kind === 'INSTRUMENT' || cmd.kind === 'DUTY_CYCLE' || cmd.kind === 'POINT' && cmd.mode === 'TARGET' ? 'SCIENCE' : cmd.kind === 'DOWNLINK' || cmd.kind === 'LINK_MODE' ? 'GROUND_COMMS' : 'SPACECRAFT'; }
export function sameOrbit(a: OrbitChoice, b: OrbitChoice): boolean { return a.body === b.body && Math.abs(a.smaKm-b.smaKm) < 1e-6 && Math.abs(a.ecc-b.ecc) < 1e-9 && Math.abs(a.inclinationDeg-b.inclinationDeg) < 1e-6; }
export function orbitOffered(design: Design, orbit: OrbitChoice, rideId = design.rideId): boolean {
 const ride = RIDES.find(r => r.id === rideId);
 if (!ride || ride.body !== orbit.body || orbit.body !== scenarioById(design.scenarioId).body || !ride.busIds.includes(design.busId)) return false;
 if (orbit.frame !== 'MJ2000Eq' || !Number.isFinite(Date.parse(orbit.epochUTC)) || ![orbit.smaKm, orbit.ecc, orbit.inclinationDeg, orbit.raanDeg, orbit.argPeriapsisDeg, orbit.trueAnomalyDeg].every(Number.isFinite) || orbit.ecc < 0 || orbit.ecc >= 1) return false;
 const alt = orbitAltitudes(orbit);
 if (ride.fixedOrbits) return ride.fixedOrbits.some(o => sameOrbit(o, orbit));
 return orbit.body === 'EARTH' && alt.altitudeKm >= 350 && alt.altitudeKm <= 800 && Math.abs(alt.apoapsisAltitudeKm-alt.altitudeKm) < 1e-6 && orbit.inclinationDeg >= 0 && orbit.inclinationDeg <= 98;
}
interface Forecast { periodMin: number; eclipseFrac: number; maxEclipseSec: number; contactMinPerDay: number; targetSolar: number; earthSolar: number }
const forecasts = new Map<string, Forecast>();
function estimate(design: Design): Forecast | null {
 if (!design.orbit) return null;
 const o = design.orbit;
 const key = `${design.levelId}|${design.rulesVersion}|${design.scenarioId}|${design.stationId}|${JSON.stringify(o)}`;
 const cached = forecasts.get(key);
 if (cached) return cached;
 const epoch = o.body === 'MARS' ? hohmann().transferSec : 0, dt = MODEL.forecastStepSec.v;
 let eclipseSec = 0, contactSec = 0, run = 0, longest = 0, initialRun = 0, stillInitial = true, targetSolar = 0, earthSolar = 0;
 for (let t = 0; t < DAY; t += dt) {
  const p = orbitPosition(o, t), sun = sunDirection(o.body, epoch + t, undefined, o.epochUTC);
  const radius = Math.hypot(...p), targetCos = -(p[0]*sun[0]+p[1]*sun[1]+p[2]*sun[2])/radius;
  const station = o.body === 'EARTH' ? stationPosition(t,'EARTH',MODEL.stationLat.v,MODEL.stationLon.v,undefined,o.epochUTC) : null;
  const earthPlanet = o.body === 'MARS' ? planetPosition('EARTH',epoch+t,o.epochUTC) : null, marsPlanet = o.body === 'MARS' ? planetPosition('MARS',epoch+t,o.epochUTC) : null;
  const earth = o.body === 'MARS' ? [earthPlanet![0]-marsPlanet![0]-p[0],earthPlanet![1]-marsPlanet![1]-p[1],earthPlanet![2]-marsPlanet![2]-p[2]] : design.scenarioId !== 'CREW_PATHFINDER' ? [station![0]-p[0],station![1]-p[1],station![2]-p[2]] : [-p[0],-p[1],-p[2]];
  const earthCos = (earth[0]*sun[0]+earth[1]*sun[1]+earth[2]*sun[2])/Math.hypot(...earth);
  if (!cylinderEclipse(p,sun,CONSTANTS[o.body].radius.v)) { targetSolar += Math.sqrt(Math.max(0,1-targetCos**2))*dt; earthSolar += Math.sqrt(Math.max(0,1-earthCos**2))*dt; }
  const shadow = cylinderEclipse(p, sun, CONSTANTS[o.body].radius.v);
  if (shadow) { eclipseSec += dt; run += dt; if (stillInitial) initialRun += dt; longest = Math.max(longest, run); }
  else { run = 0; stillInitial = false; }
  const contact = design.scenarioId === 'CREW_PATHFINDER' ? true : o.body === 'EARTH' ? inStationContact(p, stationPosition(t, 'EARTH', MODEL.stationLat.v, MODEL.stationLon.v, undefined, o.epochUTC), MODEL.minElevation.v) : marsLineOfSight(p, epoch + t, o.epochUTC);
  if (contact && (design.scenarioId === 'CREW_PATHFINDER' || !isTechnical(design.levelId) && o.body !== 'MARS' || stationAllocated(epoch + t, scenarioById(design.scenarioId).stationAllocationStartSec.v))) contactSec += dt;
 }
 longest = Math.max(longest, stillInitial ? run : run + initialRun);
 const value = { periodMin: orbitalPeriod(elementsForOrbit(o).a, CONSTANTS[o.body].mu.v) / 60, eclipseFrac: eclipseSec / DAY, maxEclipseSec: longest, contactMinPerDay: contactSec / 60, targetSolar: targetSolar/DAY, earthSolar: earthSolar/DAY };
 if (forecasts.size >= 64) forecasts.delete(forecasts.keys().next().value!);
 forecasts.set(key, value);
 return value;
}
export function computeBudgets(design: Design): Budgets {
 const bus = BUSES[design.busId], scenario = scenarioById(design.scenarioId);
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
 const avgGen = solar * solarFactor(scenario.body) * (sunlight * MODEL.sunDuty.v + MODEL.targetDuty.v * (forecast?.targetSolar ?? 0) + MODEL.earthDuty.v * (forecast?.earthSolar ?? 0)) * Math.max(0,Math.cos(accuracy*Math.PI/180));
 const technical = isTechnical(design.levelId), m = THERMAL_MODELS[design.busId], requirements = MISSION_REQUIREMENTS[design.scenarioId];
 const eolGen = avgGen * (technical ? ENGINEERING.arrayEol.v : 1), eolBattery = battery * (technical ? ENGINEERING.batteryEol.v : 1);
 // The declared forecast duty includes 30% automatic-heater use. Eclipse reserve
 // conservatively carries the entire installed heater rating throughout shadow.
 const plannedLoad = load + (technical ? heater * MODEL.targetDuty.v : 0);
 const eclipseWh = (load + (technical ? heater : 0)) * (forecast?.maxEclipseSec ?? 0) / 3600;
 const nominalCapture = scenario.body === 'MARS' && design.orbit ? captureDeltaV(design.orbit) : 0;
 return {
  massKg: { used: mass, limit: bus.massKg.v }, volume: { used: volume, limit: bus.volume.v, unit: design.busId === 'CUBESAT_3U' ? 'U' : 'BAY' }, cost: { used: cost, limit: scenario.budget.v * (LEVELS[design.levelId]?.budgetFactor.v ?? 1) },
  orbit: forecast ? { periodMin: forecast.periodMin, eclipseFrac: forecast.eclipseFrac, contactMinPerDay: forecast.contactMinPerDay } : null,
  power: forecast ? { avgGenW: eolGen, avgLoadW: plannedLoad, marginPct: plannedLoad ? (eolGen - plannedLoad) / plannedLoad * 100 : eolGen ? 100 : 0, eclipseWh, usableBatteryWh: eolBattery * MODEL.usableDepth.v } : null,
  data: forecast ? { genMBPerDay: generationRate * DAY / 8000, downMBPerDay: linkRateKbps(radioRate, scenario.body, scenario.body === 'MARS' ? hohmann().transferSec : 0, design.orbit?.epochUTC) * forecast.contactMinPerDay * 60 / 8000, storageMB: storage } : null,
  deltaV: scenario.body === 'MARS' && design.orbit ? { requiredKms: captureDeltaV(design.orbit), availableKms: rocketDeltaV(mass - propellant, propellant, isp), propellantKg: propellant } : null,
  technical: technical && forecast ? { bolGenerationW: avgGen, eolGenerationW: eolGen, eolCapacityWh: eolBattery, eolUsableBatteryWh: eolBattery * MODEL.usableDepth.v, eclipseRequiredWh: eclipseWh, nominalCaptureKms: nominalCapture, planningCaptureKms: nominalCapture * (1 + ENGINEERING.captureHigh.v), thermalColdEquilibriumK: thermalEquilibriumK(design.busId, baseLoad + m.bodyHeatW.v + heater + (design.busId === 'CREW_CAPSULE' ? 4 * 12.426e6 / DAY : 0)), thermalHotEquilibriumK: thermalEquilibriumK(design.busId, peakLoad + m.bodyHeatW.v + (design.busId === 'CREW_CAPSULE' ? 4 * 12.426e6 / DAY : 0) + ENGINEERING.solarFlux.v * solarFactor(scenario.body) * m.absorbingM2.v), recordingRequiredMB: requirements.recordingMB, minimumLinkKbps: linkRateKbps(fullRadioRate, scenario.body, scenario.body === 'MARS' ? hohmann().transferSec : 0, design.orbit?.epochUTC) } : null,
 };
}
function limits(design: Design): Refusal | null {
 const b = computeBudgets(design);
 if (b.volume.used > b.volume.limit + 1e-9) return refusal('NO_SLOT', { used: b.volume.used, part: 0, limit: b.volume.limit });
 if (b.massKg.used >= b.massKg.limit - 1e-9) return refusal('MASS_OVER_LIMIT', { after: b.massKg.used, limit: b.massKg.limit });
 if (b.cost.used > b.cost.limit + 1e-9) return refusal('OVER_BUDGET', { after: b.cost.used, limit: b.cost.limit });
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
 const ride = RIDES.find(r => r.id === rideId);
 if (!ride || !ride.busIds.includes(design.busId) || ride.body !== scenarioById(design.scenarioId).body) return refusal('RIDE_MISMATCH', { ride: rideId, bus: design.busId });
 const next = { ...design, rideId, orbit: design.orbit && orbitOffered(design, design.orbit, rideId) ? design.orbit : null, revision: design.revision + 1 };
 const blocked = limits(next);
 return blocked ?? { ok: true, value: { next } };
}
export function quoteSetOrbit(design: Design, orbit: OrbitChoice, role: ActorRole): Quote<{ next: Design }> {
 if (!ownsRole(role, 'LAUNCH_ORBIT')) return refusal('ROLE_LOCKED', { role: 'LAUNCH_ORBIT' });
 if (!orbitOffered(design, orbit)) return refusal('ORBIT_NOT_OFFERED', { ride: design.rideId ?? '', altitude: orbitAltitudes(orbit).altitudeKm });
 return { ok: true, value: { next: { ...design, orbit: { ...orbit }, revision: design.revision + 1 } } };
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
 const scenario = scenarioById(design.scenarioId);
 if (design.rulesVersion !== RULES_VERSION || !(design.levelId in LEVELS)) result.push(refusal('UNSUPPORTED_RULES', { rulesVersion: design.rulesVersion, levelId: design.levelId }));
 if (design.busId !== scenario.busId) result.push(refusal('RIDE_MISMATCH', { bus: design.busId }));
 if (!design.rideId) result.push(refusal('NOT_READY', { missing: 'ride' }));
 else {
  const ride = RIDES.find(r => r.id === design.rideId);
  if (!ride || !ride.busIds.includes(design.busId) || ride.body !== scenario.body) result.push(refusal('RIDE_MISMATCH', { ride: design.rideId, bus: design.busId }));
 }
 if (design.stationId !== (scenario.id === 'CREW_PATHFINDER' ? 'CREW_RELAY' : scenario.body === 'EARTH' ? 'GS_MIDLAT' : 'DSN')) result.push(refusal('NOT_READY', { missing: 'station' }));
 if (!design.parts.some(p => p.partId === MISSION_REQUIREMENTS[design.scenarioId].payload)) result.push(refusal('REQUIRES_PART', { needs: MISSION_REQUIREMENTS[design.scenarioId].payload }));
 if (scenario.id === 'CREW_PATHFINDER') {
  for (const id of ['CREW_SUPPORT', 'CREW_PROPULSION', 'CREW_OBSERVER']) if (!design.parts.some(p => p.partId === id)) result.push(refusal('REQUIRES_PART', { needs: id }));
  const engine = design.parts.find(p => p.partId === 'CREW_PROPULSION'), fuel = engine?.propellantKg ?? 0;
  const needed = design.orbit ? crewReturnFuel(design.orbit, computeBudgets(design).massKg.used, engine ? PART_BY_ID[engine.partId].ispSec?.v ?? 0 : 0) : Infinity;
  if (fuel < needed) result.push(refusal('RETURN_FUEL_SHORT', { availableKg: fuel, requiredKg: Number.isFinite(needed) ? needed : 'unknown' }));
 }
 if (!design.orbit) result.push(refusal('NOT_READY', { missing: 'orbit' }));
 else if (!orbitOffered(design, design.orbit)) result.push(refusal('ORBIT_NOT_OFFERED', { ride: design.rideId ?? '' }));
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
  const b = computeBudgets(design), t = b.technical, requirement = MISSION_REQUIREMENTS[design.scenarioId], m = THERMAL_MODELS[design.busId];
  if (!design.parts.some(i => PART_BY_ID[i.partId]?.heaterW)) result.push(refusal('REQUIRES_PART', { needs: design.busId === 'SMALLSAT' ? 'SS_HEATER_60' : 'HEATER_6' }));
  if (t && b.power) {
   if (t.eolGenerationW + 1e-9 < b.power.avgLoadW) result.push(refusal('POWER_EOL_SHORT', { generationW: t.eolGenerationW, requiredW: b.power.avgLoadW, shortfallW: b.power.avgLoadW - t.eolGenerationW, source: 'engineering.arrayEol' }));
   if (t.eolUsableBatteryWh + 1e-9 < t.eclipseRequiredWh) result.push(refusal('ECLIPSE_RESERVE_SHORT', { availableWh: t.eolUsableBatteryWh, requiredWh: t.eclipseRequiredWh, source: 'engineering.batteryEol' }));
   if (t.thermalColdEquilibriumK < m.operatingMinK.v || t.thermalHotEquilibriumK > m.operatingMaxK.v) result.push(refusal('THERMAL_MARGIN_SHORT', { coldK: t.thermalColdEquilibriumK, hotK: t.thermalHotEquilibriumK, minK: m.operatingMinK.v, maxK: m.operatingMaxK.v, source: 'thermal' }));
   if ((b.data?.storageMB ?? 0) < requirement.recordingMB) result.push(refusal('DATA_CAPACITY_SHORT', { availableMB: b.data?.storageMB ?? 0, requiredMB: requirement.recordingMB }));
   if (t.minimumLinkKbps < requirement.minimumLinkKbps) result.push(refusal('LINK_UNAVAILABLE', { availableKbps: t.minimumLinkKbps, requiredKbps: requirement.minimumLinkKbps }));
   if (b.deltaV && b.deltaV.availableKms + 1e-9 < t.planningCaptureKms) result.push(refusal('CAPTURE_RESERVE_SHORT', { availableKms: b.deltaV.availableKms, requiredKms: t.planningCaptureKms, nominalKms: t.nominalCaptureKms, source: 'engineering.captureHigh' }));
  }
 }
 for (const role of ROLES) if (!signoffs[role]) result.push(refusal('SIGNOFF_BLOCKED', { role }));
 return result;
}
export function rolesAffectedBy(prev: Design, next: Design): readonly RoleId[] {
 if (prev === next || prev.revision === next.revision && JSON.stringify(prev) === JSON.stringify(next)) return [];
 const changed = new Set<RoleId>();
 if (prev.rideId !== next.rideId || JSON.stringify(prev.orbit) !== JSON.stringify(next.orbit) || prev.busId !== next.busId || prev.scenarioId !== next.scenarioId) for (const r of ROLES) changed.add(r);
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
 const requiredKg = propellantNeeded(dry, captureDeltaV(design.orbit) * (isTechnical(design.levelId) ? 1 + ENGINEERING.captureHigh.v : MODEL.captureMargin.v), PART_BY_ID[engine.partId].ispSec!.v);
 const quote = quoteSetPropellant(design, requiredKg, role);
 return quote.ok ? { ok: true, value: { next: quote.value.next, requiredKg, after: computeBudgets(quote.value.next) } } : quote;
}
