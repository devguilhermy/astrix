import type { Design, MissionSummary, Budgets, ScoreBreakdown, SimState, TeamStats } from './contracts';
import { MODEL, scenarioById } from './catalog';
import { computeBudgets } from './design';
import { clamp } from './physics';
import { flight, objectiveValue } from './sim/state';

export function scoreStars(total: number): ScoreBreakdown['stars'] {
 return total >= MODEL.fiveStars.v ? 5 : total >= 80 ? 4 : total >= 60 ? 3 : total >= 40 ? 2 : total >= 20 ? 1 : 0;
}
export function scoreMission(state: SimState, _design: Design, team: TeamStats): ScoreBreakdown {
 const s = flight(state), budget = computeBudgets(s.design), scenario = scenarioById(s.design.scenarioId);
 const time = Math.max(1, s.elapsed);
 const teamDenominator = team.roles <= 1 ? team.sev3Raised : team.roles + team.sev3Raised;
 const teamNumerator = team.roles <= 1 ? team.sev3ResolvedBeforeLaunch : Math.max(0, team.signoffs - team.blockedSignoffAttempts) + team.sev3ResolvedBeforeLaunch;
 const components = [
  { key: 'score.objective', weight: MODEL.scoreObjective.v, value: clamp(objectiveValue(s) / scenario.target.v, 0, 1) },
  { key: 'score.efficiency', weight: MODEL.scoreEfficiency.v, value: clamp((budget.cost.limit - budget.cost.used) / budget.cost.limit, 0, 1) },
  { key: 'score.health', weight: MODEL.scoreHealth.v, value: clamp(s.healthySec / time, 0, 1) },
  { key: 'score.margins', weight: MODEL.scoreMargins.v, value: clamp(1 - s.marginBadSec / time, 0, 1) },
  { key: 'score.team', weight: MODEL.scoreTeam.v, value: teamDenominator > 0 ? clamp(teamNumerator / teamDenominator, 0, 1) : 1 },
 ];
 const rawTotal = Math.max(0, Math.round(components.reduce((sum, c) => sum + c.weight * c.value, 0) * 100));
 const scienceAchieved = objectiveValue(s) + 1e-9 >= scenario.target.v;
 const outcome: ScoreBreakdown['outcome'] = !s.ended ? 'PROVISIONAL' : s.firstFailure || s.sessionEnded || !scienceAchieved ? 'FAILURE' : 'SUCCESS';
 const total = outcome === 'FAILURE' ? Math.min(19, rawTotal) : rawTotal;
 return { total, stars: scoreStars(total), components, identity: { levelId: s.design.levelId, rulesVersion: s.design.rulesVersion, scenarioId: s.design.scenarioId, seed: s.seed, assisted: s.assisted }, outcome, scienceAchieved, interventionEnergyWh: s.interventionEnergyWh, firstFailure: s.firstFailure };
}
export function summarizeMission(design: Design, budgets: Budgets, sim: SimState | null): MissionSummary {
 const p = budgets.power, s = scenarioById(design.scenarioId);
 const generation: MissionSummary['energy']['generation'] = !p ? 'UNKNOWN' : p.avgGenW < p.avgLoadW ? 'SHORT' : p.marginPct < 10 ? 'LOW' : 'ENOUGH';
 const eclipseBattery: MissionSummary['energy']['eclipseBattery'] = !p ? 'UNKNOWN' : p.usableBatteryWh < p.eclipseWh ? 'SHORT' : p.usableBatteryWh < p.eclipseWh * 1.1 ? 'LOW' : 'ENOUGH';
 return {
  fit: { mass: budgets.massKg.used >= budgets.massKg.limit - 1e-9 ? 'OVER' : budgets.massKg.used / budgets.massKg.limit >= .95 ? 'TIGHT' : 'FITS', room: budgets.volume.used > budgets.volume.limit + 1e-9 ? 'OVER' : budgets.volume.used / budgets.volume.limit >= .95 ? 'TIGHT' : 'FITS' },
  energy: { generation, eclipseBattery }, progress: { metricKey: `metric.${s.metric}`, value: sim ? objectiveValue(flight(sim)) : 0, target: s.target.v }, budget: { used: budgets.cost.used, limit: budgets.cost.limit }, sourceRevision: design.revision,
 };
}
