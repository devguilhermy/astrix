import type { Design, MissionSummary, Budgets, ScoreBreakdown, SimState, TeamStats } from './contracts';
import { MODEL } from './catalog';
import { FLIGHT_MODEL_VERSION } from './mission/types';
import { computeBudgets } from './design';
import { clamp } from './physics';
import { flight, type FlightState } from './sim/state';
import { allRequiredMet, evidenceOf, metricKeyOf, primaryObjective } from './sim/objectives';

export function scoreStars(total: number): ScoreBreakdown['stars'] {
 return total >= MODEL.fiveStars.v ? 5 : total >= 80 ? 4 : total >= 60 ? 3 : total >= 40 ? 2 : total >= 20 ? 1 : 0;
}
/** Mean progress of the required objectives; a run that met half of them is not scored as a run that met none. */
function objectiveProgress(s: FlightState): number {
 const required = evidenceOf(s).filter(e => e.required);
 return required.length ? clamp(required.reduce((n, e) => n + e.progress, 0) / required.length, 0, 1) : 1;
}
/** Everything that makes two runs comparable. A custom definition that drops the default hazard terminations is not a standard run. */
function runIdentity(s: FlightState): ScoreBreakdown['identity'] {
 const d = s.design.definition, failOn = d.termination.failOn;
 return { levelId: s.design.levelId, rulesVersion: s.design.rulesVersion, modelVersion: FLIGHT_MODEL_VERSION, definitionId: d.id, definitionRevision: d.revision, definitionDigest: d.digest, origin: d.origin, seed: s.seed, assisted: s.assisted, policy: d.origin === 'CUSTOM' && !(failOn.includes('BATTERY_DEPLETED') && failOn.includes('THERMAL_SURVIVAL')) ? 'EXPERIMENTAL' : 'STANDARD' };
}
export function scoreMission(state: SimState, _design: Design, team: TeamStats): ScoreBreakdown {
 const s = flight(state), budget = computeBudgets(s.design);
 const time = Math.max(1, s.elapsed);
 const teamDenominator = team.roles <= 1 ? team.sev3Raised : team.roles + team.sev3Raised;
 const teamNumerator = team.roles <= 1 ? team.sev3ResolvedBeforeLaunch : Math.max(0, team.signoffs - team.blockedSignoffAttempts) + team.sev3ResolvedBeforeLaunch;
 const components = [
  { key: 'score.objective', weight: MODEL.scoreObjective.v, value: objectiveProgress(s) },
  { key: 'score.efficiency', weight: MODEL.scoreEfficiency.v, value: clamp((budget.cost.limit - budget.cost.used) / budget.cost.limit, 0, 1) },
  { key: 'score.health', weight: MODEL.scoreHealth.v, value: clamp(s.healthySec / time, 0, 1) },
  { key: 'score.margins', weight: MODEL.scoreMargins.v, value: clamp(1 - s.marginBadSec / time, 0, 1) },
  { key: 'score.team', weight: MODEL.scoreTeam.v, value: teamDenominator > 0 ? clamp(teamNumerator / teamDenominator, 0, 1) : 1 },
 ];
 const rawTotal = Math.max(0, Math.round(components.reduce((sum, c) => sum + c.weight * c.value, 0) * 100));
 const achieved = allRequiredMet(s);
 const outcome: ScoreBreakdown['outcome'] = !s.ended ? 'PROVISIONAL' : s.firstFailure ? 'FAILURE' : s.sessionEnded ? 'INCOMPLETE' : achieved ? 'SUCCESS' : 'FAILURE';
 const total = outcome === 'FAILURE' || outcome === 'INCOMPLETE' ? Math.min(19, rawTotal) : rawTotal;
 return { total, stars: scoreStars(total), components, identity: runIdentity(s), outcome, evidence: evidenceOf(s), interventionEnergyWh: s.interventionEnergyWh, firstFailure: s.firstFailure };
}
export function summarizeMission(design: Design, budgets: Budgets, sim: SimState | null): MissionSummary {
 const p = budgets.power;
 const generation: MissionSummary['energy']['generation'] = !p ? 'UNKNOWN' : p.avgGenW < p.avgLoadW ? 'SHORT' : p.marginPct < 10 ? 'LOW' : 'ENOUGH';
 const eclipseBattery: MissionSummary['energy']['eclipseBattery'] = !p ? 'UNKNOWN' : p.usableBatteryWh < p.eclipseWh ? 'SHORT' : p.usableBatteryWh < p.eclipseWh * 1.1 ? 'LOW' : 'ENOUGH';
 return {
  fit: { mass: budgets.massKg.used >= budgets.massKg.limit - 1e-9 ? 'OVER' : budgets.massKg.used / budgets.massKg.limit >= .95 ? 'TIGHT' : 'FITS', room: budgets.volume.used > budgets.volume.limit + 1e-9 ? 'OVER' : budgets.volume.used / budgets.volume.limit >= .95 ? 'TIGHT' : 'FITS' },
  energy: { generation, eclipseBattery }, progress: progressOf(design, sim), budget: { used: budgets.cost.used, limit: budgets.cost.limit }, sourceRevision: design.revision,
 };
}
function progressOf(design: Design, sim: SimState | null): MissionSummary['progress'] {
 if (sim) { const p = primaryObjective(flight(sim)); return { metricKey: p.metricKey, value: p.value, target: p.target }; }
 const o = design.definition.objectives.find(x => x.required) ?? design.definition.objectives[0];
 const target=o.spec.kind==='DELIVERED_PRODUCT'?o.spec.targetMB:o.spec.kind==='INSTRUMENT_HOURS'?o.spec.targetHours:o.spec.kind==='CREW_ORBIT_HOURS'?o.spec.hours:o.spec.kind==='APOGEE_BAND'?(o.spec.minAltKm+o.spec.maxAltKm)/2:o.spec.kind==='BOUND_ORBIT'?(o.spec.periapsisAltKm.min+o.spec.periapsisAltKm.max)/2:o.spec.kind==='ESCAPE'?o.spec.minExcessSpeedKms:o.spec.kind==='ENTRY_INTERFACE'||o.spec.kind==='RETURN_BOUNDARY'?o.spec.altitudeKm:o.spec.kind==='ENCOUNTER_DISTANCE'?(o.spec.minDistanceKm+o.spec.maxDistanceKm)/2:o.spec.kind==='PROPELLANT_RESERVE'?o.spec.minKg:1;
 return { metricKey: metricKeyOf(o.spec.kind), value: 0, target };
}
