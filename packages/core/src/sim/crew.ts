import type { CrewTelemetry } from '../contracts';
import type { FlightState } from './state';
import { fail } from './failure';
import { crewReturnWindow, CREW_DEORBIT_BURN_SEC } from '../return';
import type { SimEvent } from '../contracts';

// BVAD Rev. 2 table 3-31; cabin, packaging and scrubber are authored assumptions.
export const CREW_MODEL = Object.freeze({ count: 4, oxygenKgPerPersonDay: .895, co2KgPerPersonDay: 1.085, waterKgPerPersonDay: 3.217, dryFoodKgPerPersonDay: .8, heatMJPerPersonDay: 12.426, freeGasM3: 8, cabinTemperatureK: 297, scrubberKgCO2PerKgSorbent: .65, activeCapacityKgCO2: 12, spareCapacityKgCO2: 12, recoverySec: 21600 });
export interface CrewState { phase: CrewTelemetry['phase']; orbitEndSec: number | null; oxygenKg: number; nitrogenKg: number; waterKg: number; foodKg: number; scrubberKg: number; spareScrubberKg: number; cabinOxygenKg: number; cabinNitrogenKg: number; cabinCO2Kg: number; retainedWasteKg: number; fanOn: boolean; isolated: boolean; prioritizePower: boolean; recoveryRemainingSec: number; co2Average: number; oxygenAverage: number; warnings: { runwayReserve: boolean; runwayCritical: boolean; fan: boolean; pressure: boolean; co2: boolean; oxygen: boolean; cartridge: boolean }; leakActive: boolean; leakTriggered: boolean; ventedKg: number; pressureSamples: { dt: number; co2: number; oxygen: number }[]; pressureDuration: number; co2Integral: number; oxygenIntegral: number }
export function initialCrew(): CrewState { return { phase: 'ON_ORBIT', orbitEndSec: null, oxygenKg: 20, nitrogenKg: 8, waterKg: 65, foodKg: 17, scrubberKg: CREW_MODEL.activeCapacityKgCO2, spareScrubberKg: CREW_MODEL.spareCapacityKgCO2, cabinOxygenKg: 2.2, cabinNitrogenKg: 7.2, cabinCO2Kg: .01, retainedWasteKg: 0, fanOn: true, isolated: false, prioritizePower: false, recoveryRemainingSec: CREW_MODEL.recoverySec, co2Average: 0, oxygenAverage: 150, warnings: { runwayReserve: false, runwayCritical: false, fan: false, pressure: false, co2: false, oxygen: false, cartridge: false }, leakActive: false, leakTriggered: false, ventedKg: 0, pressureSamples: [], pressureDuration: 0, co2Integral: 0, oxygenIntegral: 0 }; }
function pressures(c: CrewState) {
 const f = 8.314462618 * CREW_MODEL.cabinTemperatureK / CREW_MODEL.freeGasM3 / 133.322;
 const o = c.cabinOxygenKg / .032 * f, n = c.cabinNitrogenKg / .028 * f, co2 = c.cabinCO2Kg / .044 * f, total = o + n + co2;
 return { total, co2, inspired: total > 0 ? Math.max(0, total - 47) * o / total : 0 };
}
export function crewTelemetry(c: CrewState, powered = true, elapsedSec = 0): CrewTelemetry {
 const p = pressures(c), stores = { OXYGEN: c.oxygenKg / (CREW_MODEL.count * CREW_MODEL.oxygenKgPerPersonDay), WATER: c.waterKg / (CREW_MODEL.count * CREW_MODEL.waterKgPerPersonDay), FOOD: c.foodKg / (CREW_MODEL.count * CREW_MODEL.dryFoodKgPerPersonDay), SCRUBBER: (c.scrubberKg + c.spareScrubberKg) / (CREW_MODEL.count * CREW_MODEL.co2KgPerPersonDay) };
 const limiting = (Object.keys(stores) as (keyof typeof stores)[]).reduce((a, b) => stores[a] < stores[b] ? a : b);
 return { phase: c.phase, orbitSec: c.orbitEndSec ?? elapsedSec, earlyReturn: c.orbitEndSec !== null && c.orbitEndSec < 72 * 3600, daysRemaining: stores[limiting], limiting, oxygenKg: c.oxygenKg, nitrogenKg: c.nitrogenKg, activeScrubberKg: c.scrubberKg, spareScrubberKg: c.spareScrubberKg, retainedWasteKg: c.retainedWasteKg, ventedKg: c.ventedKg, waterKg: c.waterKg, foodKg: c.foodKg, scrubberKg: c.scrubberKg + c.spareScrubberKg, cabinOxygenKg: c.cabinOxygenKg, cabinNitrogenKg: c.cabinNitrogenKg, cabinCO2Kg: c.cabinCO2Kg, pressureMmHg: p.total, inspiredOxygenMmHg: p.inspired, co2MmHg: p.co2, co2AverageMmHg: c.co2Average, inspiredOxygenAverageMmHg: c.oxygenAverage, returnWindowOpen: c.phase === 'ON_ORBIT' && crewReturnWindow(elapsedSec).open, returnWindowRemainingSec: c.phase === 'ON_ORBIT' ? crewReturnWindow(elapsedSec).remainingSec : 0, nextReturnWindowSec: c.phase === 'ON_ORBIT' ? crewReturnWindow(elapsedSec).nextSec : null, fanOn: c.fanOn, fanWorking: c.fanOn && powered, leakActive: c.leakActive, isolated: c.isolated, recoveryRemainingSec: c.recoveryRemainingSec };
}
export function advanceCrew(s: FlightState, dt: number, events: SimEvent[]): void {
 const c = s.crew; if (!c || c.phase === 'COMPLETE') return;
 if (s.design.levelId === 'EXPERT' && !c.leakTriggered && s.elapsed >= 36 * 3600) { c.leakTriggered = true; c.leakActive = true; events.push({ kind: 'CREW_LEAK', t: s.t, autoPause: true, values: { oxygenKgPerHour: .04, cabinFractionPerHour: .001 } }); }
 if (c.leakActive) { const tank = c.isolated ? 0 : Math.min(c.oxygenKg, .04 * dt / 3600); c.oxygenKg -= tank; const fraction = .001 * dt / 3600, o = c.cabinOxygenKg * fraction, n = c.cabinNitrogenKg * fraction, co2 = c.cabinCO2Kg * fraction; c.cabinOxygenKg -= o; c.cabinNitrogenKg -= n; c.cabinCO2Kg -= co2; c.ventedKg += tank + o + n + co2; }
 const day = dt / 86400, oxygen = Math.min(c.cabinOxygenKg, CREW_MODEL.count * CREW_MODEL.oxygenKgPerPersonDay * day), water = Math.min(c.waterKg, CREW_MODEL.count * CREW_MODEL.waterKgPerPersonDay * day), food = Math.min(c.foodKg, CREW_MODEL.count * CREW_MODEL.dryFoodKgPerPersonDay * day), produced = CREW_MODEL.count * CREW_MODEL.co2KgPerPersonDay * day;
 c.cabinOxygenKg -= oxygen; c.waterKg -= water; c.foodKg -= food; c.cabinCO2Kg += produced;
 // Metabolic carbon comes from retained food/water; all consumption stays onboard.
 c.retainedWasteKg += oxygen + water + food - produced;
 const makeup = c.isolated ? 0 : Math.min(c.oxygenKg, Math.max(0, 2.2 - c.cabinOxygenKg)); c.oxygenKg -= makeup; c.cabinOxygenKg += makeup;
 const scrub = c.fanOn && s.socWh > 0 ? Math.min(c.cabinCO2Kg, c.scrubberKg, produced + c.cabinCO2Kg * dt / 600) : 0;
 c.cabinCO2Kg -= scrub; c.scrubberKg -= scrub; c.retainedWasteKg += scrub;
 const p = pressures(c);
 c.pressureSamples.push({ dt, co2: p.co2, oxygen: p.inspired });
 c.pressureDuration += dt; c.co2Integral += p.co2 * dt; c.oxygenIntegral += p.inspired * dt;
 while (c.pressureDuration > 3600 && c.pressureSamples.length) {
  const first = c.pressureSamples[0], removed = Math.min(first.dt, c.pressureDuration - 3600);
  c.pressureDuration -= removed; c.co2Integral -= first.co2 * removed; c.oxygenIntegral -= first.oxygen * removed;
  if (removed >= first.dt - 1e-9) c.pressureSamples.shift(); else c.pressureSamples[0] = { ...first, dt: first.dt - removed };
 }
 // These integrals sum nonnegative pressure samples. Subtracting an expired
 // window can leave a tiny negative residual from floating-point cancellation;
 // normalize the accumulator, without changing cabin gases or retained mass.
 c.co2Integral = Math.max(0, c.co2Integral);
 c.oxygenIntegral = Math.max(0, c.oxygenIntegral);
 c.co2Average = c.co2Integral / c.pressureDuration; c.oxygenAverage = c.oxygenIntegral / c.pressureDuration;
 const telem = crewTelemetry(c, s.socWh > 0, s.elapsed), remaining = (c.phase === 'ON_ORBIT' ? Math.max(0, 72 * 3600 - s.elapsed) : 0) + c.recoveryRemainingSec + (c.phase === 'DEORBIT' ? CREW_DEORBIT_BURN_SEC : 0);
 const conditions = { runwayReserve: telem.daysRemaining * 86400 < remaining * 1.25, runwayCritical: telem.daysRemaining * 86400 < remaining, fan: !c.fanOn || s.socWh <= 0, pressure: p.total < 650 || p.total > 800, co2: c.co2Average >= 3, oxygen: p.inspired < 145 || p.inspired > 155, cartridge: c.scrubberKg <= 1e-9 };
 for (const key of Object.keys(conditions) as (keyof typeof conditions)[]) {
  if (conditions[key] && !c.warnings[key]) { c.warnings[key] = true; events.push({ kind: key === 'cartridge' ? 'CREW_CARTRIDGE_SATURATED' : 'CREW_WARNING', t: s.t + dt, autoPause: true, values: { context: key, limiting: telem.limiting, daysRemaining: telem.daysRemaining, co2MmHg: p.co2 } }); }
  else if (!conditions[key]) c.warnings[key] = false;
 }
 if (c.waterKg <= 0 || c.foodKg <= 0 || (c.oxygenKg <= 0 && c.cabinOxygenKg <= 0) || p.co2 >= 6 || c.oxygenAverage < 127) {
  const first = !s.firstFailure;
  fail(s, 'CREW_SUPPORT_LOST', events, s.t + dt);
  if (first && s.firstFailure) s.firstFailure = { ...s.firstFailure, facts: [{ key: 'fact.CREW_SUPPORT', values: { phase: c.phase, oxygenKg: c.oxygenKg, cabinOxygenKg: c.cabinOxygenKg, waterKg: c.waterKg, foodKg: c.foodKg, activeScrubberKg: c.scrubberKg, spareScrubberKg: c.spareScrubberKg, co2MmHg: p.co2, inspiredOxygenMmHg: p.inspired, inspiredOxygenAverageMmHg: c.oxygenAverage, fanOn: c.fanOn ? 1 : 0, isolated: c.isolated ? 1 : 0, socWh: s.socWh } }, ...s.firstFailure.facts] };
 }
 if (c.phase === 'RECOVERY') { c.recoveryRemainingSec = Math.max(0, c.recoveryRemainingSec - dt); if (!c.recoveryRemainingSec) { c.phase = 'COMPLETE'; s.ended = true; } }
}
