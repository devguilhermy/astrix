import type { ActorRole, Budgets, Design, RoleId, SimState } from './contracts';
import { scenarioById } from './catalog';
import { computeBudgets, launchReadiness } from './design';
import { failureReport, telemetry } from './sim/selectors';
import { MISSION_REQUIREMENTS } from './models';
import { PART_BY_ID } from './catalog';

export type JourneyStage = 'NEED_GOALS' | 'CONCEPT' | 'REQUIREMENTS' | 'DESIGN' | 'BUILD_VERIFY' | 'IMPLEMENT' | 'REVIEW';
export interface MissionArtifacts {
 readonly objectiveConfirmed: boolean;
 readonly segments: { readonly launch: boolean; readonly space: boolean; readonly ground: boolean; readonly user: boolean };
 readonly trade: { readonly revision: number; readonly description: string; readonly before: Budgets; readonly after: Budgets; readonly actor: ActorRole } | null;
 readonly baselineRevision: number | null;
 readonly verifiedRevision: number | null;
}
export interface JourneyBlocker { readonly id: string; readonly target: string; readonly messageKey: string; readonly values: Readonly<Record<string, string | number>> }
export interface RequirementEvidence { readonly id: string; readonly objective: string; readonly target: number | string; readonly unit: string; readonly method: string; readonly owner: RoleId; readonly revision: number; readonly result: 'PASS' | 'FAIL' | 'NOT_EVALUATED'; readonly actual: number | null }
export function createMissionArtifacts(_design: Design): MissionArtifacts {
 return { objectiveConfirmed: false, segments: { launch: true, space: true, ground: true, user: true }, trade: null, baselineRevision: null, verifiedRevision: null };
}
export function missionRequirements(design: Design, sim?: SimState | null): readonly RequirementEvidence[] {
 const scenario = scenarioById(design.scenarioId), b = computeBudgets(design), t = sim ? telemetry(sim) : null;
 const failure = sim ? failureReport(sim) : null;
 return [
  { id: 'SCI-DATA-01', objective: scenario.objectiveKey, target: scenario.target.v, unit: scenario.metric === 'DOWNLINK_MB' ? 'MB' : 'h', method: 'simulation', owner: 'SCIENCE', revision: design.revision, result: !t || !t.ended ? 'NOT_EVALUATED' : t.objective.value >= scenario.target.v ? 'PASS' : 'FAIL', actual: t?.objective.value ?? null },
  { id: 'LAUNCH-MASS-01', objective: scenario.objectiveKey, target: b.massKg.limit, unit: 'kg', method: 'computed', owner: 'LAUNCH_ORBIT', revision: design.revision, result: b.massKg.used < b.massKg.limit ? 'PASS' : 'FAIL', actual: b.massKg.used },
  { id: 'SCI-PAYLOAD-01', objective: scenario.objectiveKey, target: MISSION_REQUIREMENTS[design.scenarioId].payload, unit: 'part', method: 'configuration', owner: 'SCIENCE', revision: design.revision, result: design.parts.some(p => p.partId === MISSION_REQUIREMENTS[design.scenarioId].payload) ? 'PASS' : 'FAIL', actual: null },
  { id: 'POWER-ECLIPSE-01', objective: scenario.objectiveKey, target: b.power?.eclipseWh ?? 'unknown', unit: 'Wh', method: 'computed', owner: 'SPACECRAFT', revision: design.revision, result: !b.power ? 'NOT_EVALUATED' : b.power.usableBatteryWh >= b.power.eclipseWh ? 'PASS' : 'FAIL', actual: b.power?.usableBatteryWh ?? null },
  { id: 'GROUND-RADIO-01', objective: scenario.objectiveKey, target: 'radio and service', unit: '', method: 'configuration', owner: 'GROUND_COMMS', revision: design.revision, result: design.stationId && design.parts.some(p => PART_BY_ID[p.partId]?.category === 'RADIO') ? 'PASS' : 'FAIL', actual: null },
  ...(design.scenarioId === 'CREW_PATHFINDER' ? [{ id: 'CREW-SUPPORT-01', objective: scenario.objectiveKey, target: 'support-through-recovery', unit: 'h', method: 'simulation', owner: 'SPACECRAFT' as const, revision: design.revision, result: !t?.ended ? 'NOT_EVALUATED' as const : t.crew?.phase === 'COMPLETE' && (!failure || failure.causeKey === 'failure.OBJECTIVE_MISSED.title') ? 'PASS' as const : 'FAIL' as const, actual: t ? t.t / 3600 : null }] : []),
  ...(design.scenarioId === 'CREW_PATHFINDER' ? [{ id: 'CREW-DURATION-01', objective: scenario.objectiveKey, target: 72, unit: 'h', method: 'simulation', owner: 'LAUNCH_ORBIT' as const, revision: design.revision, result: !t?.ended ? 'NOT_EVALUATED' as const : (t.crew?.orbitSec ?? 0) >= 72 * 3600 ? 'PASS' as const : 'FAIL' as const, actual: t?.crew ? t.crew.orbitSec / 3600 : null }] : []),
  { id: 'SCI-QUALITY-01', objective: scenario.objectiveKey, target: 'unmodeled', unit: '', method: 'not modeled', owner: 'SCIENCE', revision: design.revision, result: 'NOT_EVALUATED', actual: null },
 ];
}
export function evaluateJourneyStage(design: Design, artifacts: MissionArtifacts, stage: JourneyStage, signoffs: Readonly<Record<RoleId, boolean>>, sim?: SimState | null): readonly JourneyBlocker[] {
 const problems: JourneyBlocker[] = [];
 const add = (id: string, target: string, values: Record<string, string | number> = {}) => problems.push({ id, target, messageKey: `journey.blocker.${id}`, values });
 const cumulative = stage === 'BUILD_VERIFY' || stage === 'IMPLEMENT';
 if ((stage === 'NEED_GOALS' || cumulative) && !artifacts.objectiveConfirmed) add('OBJECTIVE', 'objective');
 if ((stage === 'CONCEPT' || cumulative) && (Object.values(artifacts.segments).some(v => !v) || !design.rideId || !design.stationId || !scenarioById(design.scenarioId).objectiveKey)) add('SEGMENTS', 'segments');
 if (stage === 'REQUIREMENTS' || cumulative) { const required = missionRequirements(design).filter(r => r.id !== 'SCI-QUALITY-01'); if (required.some(r => !r.id || !r.objective || !r.method || !r.owner || r.target === '' || r.result === 'NOT_EVALUATED' && r.method !== 'simulation')) add('REQUIREMENTS', 'requirements'); }
 if (stage === 'DESIGN' || cumulative) {
  if (!artifacts.trade || artifacts.trade.revision > design.revision || !artifacts.trade.before || !artifacts.trade.after || JSON.stringify(artifacts.trade.before) === JSON.stringify(artifacts.trade.after)) add('TRADE', 'trade');
  if (artifacts.baselineRevision !== design.revision) add('BASELINE', 'baseline');
 }
 if (stage === 'BUILD_VERIFY' || stage === 'IMPLEMENT') {
  if (artifacts.baselineRevision !== design.revision) add('BASELINE', 'baseline');
  if (artifacts.verifiedRevision !== design.revision) add('VERIFY', 'verification');
  for (const issue of launchReadiness(design, signoffs)) add(issue.code, 'readiness', { ...issue.values });
 }
 if (stage === 'REVIEW' && (!sim || !telemetry(sim).ended)) add('TERMINAL', 'operations');
 return problems;
}
export function missionMaturity(design: Design, artifacts: MissionArtifacts, signoffs: Readonly<Record<RoleId, boolean>>) {
 const evidence = [
  { id: 'NEED', state: artifacts.objectiveConfirmed ? 'READY' : 'NEEDS_ATTENTION', provenance: 'PLAYER_DECISION' },
  { id: 'FEASIBILITY', state: missionRequirements(design).some(r => r.result === 'FAIL') ? 'NEEDS_ATTENTION' : 'READY', provenance: 'COMPUTED' },
  { id: 'TRADE', state: artifacts.trade ? 'READY' : 'NEEDS_ATTENTION', provenance: 'PLAYER_DECISION' },
  { id: 'BASELINE', state: artifacts.baselineRevision === design.revision ? 'READY' : artifacts.baselineRevision === null ? 'NEEDS_ATTENTION' : 'CHANGED', provenance: 'COMPUTED' },
 ] as const;
 const blockers = evaluateJourneyStage(design, artifacts, 'IMPLEMENT', signoffs);
 const readiness = launchReadiness(design, signoffs);
 const requirements = missionRequirements(design);
 const feasible = requirements.filter(r => r.id !== 'SCI-QUALITY-01').every(r => r.result !== 'FAIL' && (r.result !== 'NOT_EVALUATED' || r.method === 'simulation'));
 const connected = Object.values(artifacts.segments).every(Boolean) && !!design.rideId && !!design.stationId;
 const level = !artifacts.objectiveConfirmed ? 0 : !feasible ? 1 : !artifacts.trade || !connected ? 2 : artifacts.baselineRevision !== design.revision || readiness.length ? 3 : 4;
 return { level, targetLevel: design.levelId === 'EXPERT' ? 4 : 3, evidence, requirements, blockers }; 
}
