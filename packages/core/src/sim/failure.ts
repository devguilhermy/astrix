import type { FailureReport, SimEvent } from '../contracts';
import type { FailureCause } from '../mission/types';
import type { FlightState } from './state';
import { primaryObjective } from './objectives';
import { centralStateAt } from './trajectory';
import { len, radiusOf } from '../flight/conic';

export type { FailureCause };
export function fail(s: FlightState, cause: FailureCause, events: SimEvent[], at = s.t): void {
 // A definition decides which causes end the mission; an unmet required objective always does.
 if (cause !== 'OBJECTIVE_MISSED' && !s.design.definition.termination.failOn.includes(cause)) return;
 if (!s.firstFailure) {
  const primary = primaryObjective(s);
  const facts: FailureReport['facts'][number][] = [
   { key: 'fact.OBJECTIVE', values: { value: primary.value, target: primary.target } },
   { key: 'fact.DATA', values: { downlinkedMB: s.downlinkedMB, storedMB: s.storedMB, lostMB: s.dataLostMB } },
   { key: 'fact.RUN', values: { levelId: s.design.levelId, rulesVersion: s.design.rulesVersion, seed: s.seed, assisted: s.assisted ? 1 : 0 } },
   { key: 'fact.INTERVENTIONS', values: { resets: s.resets, recoveries: s.recoveries, reacquisitions: s.pointing.reacquisitions, energyWh: s.interventionEnergyWh } },
  ];
  if (cause === 'SURFACE_IMPACT' || cause === 'ASCENT_FAILED' || cause === 'DEADLINE_MISSED') { const c = centralStateAt(s, s.t); facts.unshift({ key: 'fact.TRAJECTORY', values: { body: c.body, altitudeKm: len(c.r) - radiusOf(c.body), speedKms: len(c.v), maxAltitudeKm: s.traj.maxAltKm, propellantKg: s.propellantKg } }); }
  if (cause === 'BATTERY_DEPLETED') facts.unshift({ key: 'fact.BATTERY', values: { socWh: s.socWh, capacityWh: s.capacityWh, depletedHours: s.depletedSec / 3600, arrayFactor: s.arrayFactor } });
  if (cause === 'CAPTURE_FAILED') facts.unshift({ key: 'fact.CAPTURE', values: { requiredKms: s.captureRequiredKms, nominalKms: s.captureNominalKms, planningKms: s.capturePlanningKms, uncertaintyFraction: s.captureUncertainty, availableKms: s.captureAvailableKms, propellantKg: s.propellantKg } });
  if (cause === 'THERMAL_SURVIVAL') facts.unshift({ key: 'fact.THERMAL', values: { temperatureK: s.temperatureK, dwellSec: s.thermalSurvivalSec, heaterW: s.heaterW, socWh: s.socWh } });
  s.firstFailure = { causeKey: `failure.${cause}.title`, t: at, facts, advice: cause === 'BATTERY_DEPLETED' ? ['advice.CHARGE'] : cause === 'CAPTURE_FAILED' ? ['advice.FUEL'] : cause === 'THERMAL_SURVIVAL' ? ['advice.THERMAL'] : cause === 'CREW_SUPPORT_LOST' ? ['advice.CREW_SUPPORT'] : cause === 'SURFACE_IMPACT' || cause === 'ASCENT_FAILED' ? ['advice.TRAJECTORY'] : cause === 'DEADLINE_MISSED' ? ['advice.DEADLINE'] : ['advice.OBSERVE', 'advice.DOWNLINK'] };
 }
 // Practice retries are explicit checkpoint restores, never invisible free energy,
 // instrument repair or automatic forgiveness on a Technical scored attempt.
 s.ended = true; s.downlinkActive = false;
 events.push({ kind: 'FAILURE', t: at, autoPause: true, values: { cause, recovered: 0 } });
}
