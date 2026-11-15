import type { ActorRole, Budgets, Design, RoleId, SimState } from './contracts';
import { computeBudgets, designMassKg, launchReadiness } from './design';
import { LAUNCHER_BY_ID } from './flight/launchers';
import { runAscent } from './flight/ascentRun';
import { ascentProgramIssue } from './flight/program';
import type { ObjectiveDef, ObjectiveSpec } from './mission/types';
import { failureReport, telemetry } from './sim/selectors';
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
export function createMissionArtifacts(design: Design): MissionArtifacts {
 const pre = design.definition.learning?.precompleted;
 if (!pre) return { objectiveConfirmed: false, segments: { launch: true, space: true, ground: true, user: true }, trade: null, baselineRevision: null, verifiedRevision: null };
 // Learning missions start with the systems-engineering ceremony done; the facts it summarises are still computed and shown.
 const b = computeBudgets(design);
 return { objectiveConfirmed: pre.objectiveConfirmed, segments: { ...pre.segments }, trade: pre.trade ? { revision: design.revision, description: 'learning.guidedTrade', before: b, after: b, actor: 'LAUNCH_ORBIT' } : null, baselineRevision: pre.baseline ? design.revision : null, verifiedRevision: pre.verification ? design.revision : null };
}
const labelOf = (l: { key?: string; text?: string }): string => l.key ?? l.text ?? '';
function specTarget(spec: ObjectiveSpec): { target: number | string; unit: string } {
 switch (spec.kind) {
  case 'DELIVERED_PRODUCT': return { target: spec.targetMB, unit: 'MB' };
  case 'INSTRUMENT_HOURS': return { target: spec.targetHours, unit: 'h' };
  case 'APOGEE_BAND': return { target: `${spec.minAltKm}-${spec.maxAltKm}`, unit: 'km' };
  case 'RETURN_BOUNDARY': return { target: spec.altitudeKm, unit: 'km' };
  case 'BOUND_ORBIT': return { target: `${spec.periapsisAltKm.min}-${spec.periapsisAltKm.max} x ${spec.apoapsisAltKm.min}-${spec.apoapsisAltKm.max}`, unit: 'km' };
  case 'ESCAPE': return { target: spec.minExcessSpeedKms, unit: 'km/s' };
  case 'ENTRY_INTERFACE': return { target: spec.altitudeKm, unit: 'km' };
  case 'ENCOUNTER_DISTANCE': return { target: `${spec.minDistanceKm}-${spec.maxDistanceKm}`, unit: 'km' };
  case 'PROPELLANT_RESERVE': return { target: spec.minKg, unit: 'kg' };
  case 'CREW_SUPPORT_THROUGH_RECOVERY': return { target: 'support-through-recovery', unit: 'h' };
  case 'CREW_ORBIT_HOURS': return { target: spec.hours, unit: 'h' };
 }
}
const objectiveRequirementId = (o: ObjectiveDef): string => o.spec.kind === 'DELIVERED_PRODUCT' || o.spec.kind === 'INSTRUMENT_HOURS' ? 'SCI-DATA-01' : o.spec.kind === 'CREW_SUPPORT_THROUGH_RECOVERY' ? 'CREW-SUPPORT-01' : o.spec.kind === 'CREW_ORBIT_HOURS' ? 'CREW-DURATION-01' : `OBJ-${o.id}`;
export function missionRequirements(design: Design, sim?: SimState | null): readonly RequirementEvidence[] {
 const def = design.definition, summary = labelOf(def.objectiveSummary), b = computeBudgets(design), t = sim ? telemetry(sim) : null;
 const out: RequirementEvidence[] = [];
 // One requirement per authored objective; its verdict is the flown evidence, never a visual or a planned value.
 for (const o of def.objectives) {
  const ev = t?.evidence.find(e => e.id === o.id), { target, unit } = specTarget(o.spec);
  out.push({ id: objectiveRequirementId(o), objective: labelOf(o.label) || summary, target, unit, method: 'simulation', owner: o.owner, revision: design.revision, result: ev?.state === 'MET' ? 'PASS' : !t || !t.ended && ev?.state !== 'FAILED' ? 'NOT_EVALUATED' : 'FAIL', actual: ev?.actual ?? null });
 }
 out.push({ id: 'LAUNCH-MASS-01', objective: summary, target: b.massKg.limit, unit: 'kg', method: 'computed', owner: 'LAUNCH_ORBIT', revision: design.revision, result: b.massKg.used < b.massKg.limit ? 'PASS' : 'FAIL', actual: b.massKg.used });
 const launcher = design.launch ? LAUNCHER_BY_ID[design.launch.launcherId] : undefined;
 if (def.start.kind === 'SURFACE_LAUNCH') out.push({ id: 'LAUNCH-ASCENT-01', objective: summary, target: launcher?.payloadLimitKg ?? 'launcher', unit: 'kg', method: 'computed', owner: 'LAUNCH_ORBIT', revision: design.revision, result: launcher && b.massKg.used <= launcher.payloadLimitKg && design.launch && !ascentProgramIssue(design.launch.program, launcher) && runAscent(def, design.launch, designMassKg(design), 10).outcome !== 'NO_LIFTOFF' ? 'PASS' : 'FAIL', actual: b.massKg.used });
 if (def.vehicle.requiredPartIds.length) out.push({ id: 'SCI-PAYLOAD-01', objective: summary, target: def.vehicle.requiredPartIds[0], unit: 'part', method: 'configuration', owner: 'SCIENCE', revision: design.revision, result: def.vehicle.requiredPartIds.every(id => design.parts.some(p => p.partId === id)) ? 'PASS' : 'FAIL', actual: null });
 out.push({ id: 'POWER-ECLIPSE-01', objective: summary, target: b.power?.eclipseWh ?? 'unknown', unit: 'Wh', method: 'computed', owner: 'SPACECRAFT', revision: design.revision, result: !b.power ? 'NOT_EVALUATED' : b.power.usableBatteryWh >= b.power.eclipseWh ? 'PASS' : 'FAIL', actual: b.power?.usableBatteryWh ?? null });
 out.push({ id: 'GROUND-RADIO-01', objective: summary, target: 'radio and service', unit: '', method: 'configuration', owner: 'GROUND_COMMS', revision: design.revision, result: design.stationId && design.parts.some(p => PART_BY_ID[p.partId]?.category === 'RADIO') ? 'PASS' : 'FAIL', actual: null });
 out.push({ id: 'SCI-QUALITY-01', objective: summary, target: 'unmodeled', unit: '', method: 'not modeled', owner: 'SCIENCE', revision: design.revision, result: 'NOT_EVALUATED', actual: null });
 return out;
}
export function evaluateJourneyStage(design: Design, artifacts: MissionArtifacts, stage: JourneyStage, signoffs: Readonly<Record<RoleId, boolean>>, sim?: SimState | null): readonly JourneyBlocker[] {
 const problems: JourneyBlocker[] = [];
 const add = (id: string, target: string, values: Record<string, string | number> = {}) => problems.push({ id, target, messageKey: `journey.blocker.${id}`, values });
 const cumulative = stage === 'BUILD_VERIFY' || stage === 'IMPLEMENT';
 if ((stage === 'NEED_GOALS' || cumulative) && !artifacts.objectiveConfirmed) add('OBJECTIVE', 'objective');
 if ((stage === 'CONCEPT' || cumulative) && (Object.values(artifacts.segments).some(v => !v) || (!design.rideId && design.definition.start.kind === 'PROVIDED_ORBIT') || !design.stationId || !(design.definition.objectiveSummary.key ?? design.definition.objectiveSummary.text))) add('SEGMENTS', 'segments');
 if (stage === 'REQUIREMENTS' || cumulative) { const required = missionRequirements(design).filter(r => r.id !== 'SCI-QUALITY-01'); if (required.some(r => !r.id || !r.objective || !r.method || !r.owner || r.target === '' || r.result === 'NOT_EVALUATED' && r.method !== 'simulation')) add('REQUIREMENTS', 'requirements'); }
 const pre = design.definition.learning?.precompleted;
 if (stage === 'DESIGN' || cumulative) {
  if (!pre?.trade && (!artifacts.trade || artifacts.trade.revision > design.revision || !artifacts.trade.before || !artifacts.trade.after || JSON.stringify(artifacts.trade.before) === JSON.stringify(artifacts.trade.after))) add('TRADE', 'trade');
  if (!pre?.baseline && artifacts.baselineRevision !== design.revision) add('BASELINE', 'baseline');
 }
 if (stage === 'BUILD_VERIFY' || stage === 'IMPLEMENT') {
  if (!pre?.baseline && artifacts.baselineRevision !== design.revision) add('BASELINE', 'baseline');
  if (!pre?.verification && artifacts.verifiedRevision !== design.revision) add('VERIFY', 'verification');
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
 const connected = Object.values(artifacts.segments).every(Boolean) && (!!design.rideId || design.definition.start.kind === 'SURFACE_LAUNCH') && !!design.stationId;
 const level = !artifacts.objectiveConfirmed ? 0 : !feasible ? 1 : !artifacts.trade && !design.definition.learning?.precompleted.trade || !connected ? 2 : artifacts.baselineRevision !== design.revision && !design.definition.learning?.precompleted.baseline || readiness.length ? 3 : 4;
 return { level, targetLevel: design.levelId === 'EXPERT' ? 4 : 3, evidence, requirements, blockers }; 
}
