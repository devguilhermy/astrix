import type { TFunction } from 'i18next';
import type { BodyId, Label, MissionDefinition, ObjectiveDef, ResolvedMissionDefinition } from '@astrix/core';

/**
 * The one place the web app reads mission meaning from a definition. UI never branches on a preset id;
 * it asks what the definition declares (start kind, objectives, trajectory model).
 */
export type DefinitionLike = Readonly<MissionDefinition>;
export const DAY_SEC = 86400;

export function labelText(t: TFunction, label: Label): string {
  return label.key ? t(label.key) : label.text ?? '';
}
export function missionBody(definition: DefinitionLike): BodyId {
  return definition.start.kind === 'PROVIDED_ORBIT' ? definition.start.body : 'EARTH';
}
export function missionDurationDays(definition: DefinitionLike): number {
  return definition.environment.durationSec / DAY_SEC;
}
export function startsOnSurface(definition: DefinitionLike): boolean {
  return definition.start.kind === 'SURFACE_LAUNCH';
}
export function allowsManeuvers(definition: DefinitionLike): boolean {
  return definition.trajectory.model === 'PATCHED_CONICS' && definition.trajectory.maneuvers.allowed;
}
export function usesMoon(definition: DefinitionLike): boolean {
  return definition.trajectory.model === 'PATCHED_CONICS' && definition.trajectory.bodies.includes('MOON');
}
export function isLegacyCruise(definition: DefinitionLike): boolean {
  return definition.trajectory.model === 'MARS_ANALYTIC_CRUISE';
}
export function hasCrew(definition: DefinitionLike): boolean {
  return definition.support.crew;
}
/** The first required objective is the headline; optional objectives are stretch goals. */
export function primaryObjective(definition: DefinitionLike): ObjectiveDef {
  return definition.objectives.find(objective => objective.required) ?? definition.objectives[0]!;
}
/** Data-return objectives keep the familiar delivered-MB / monitor-hours progress readouts. */
export function progressMetric(definition: DefinitionLike): 'DOWNLINK_MB' | 'RADIATION_HOURS' | null {
  for (const objective of definition.objectives) {
    if (objective.spec.kind === 'DELIVERED_PRODUCT') return 'DOWNLINK_MB';
    if (objective.spec.kind === 'INSTRUMENT_HOURS') return 'RADIATION_HOURS';
  }
  return null;
}
export function sceneFamily(definition: DefinitionLike): 'imager' | 'radiation' | 'relay' {
  const metric = progressMetric(definition);
  if (metric === 'RADIATION_HOURS') return 'radiation';
  return missionBody(definition) === 'MARS' ? 'relay' : 'imager';
}
export function isCustom(definition: DefinitionLike): boolean {
  return definition.origin === 'CUSTOM';
}
export function isResolved(definition: DefinitionLike): definition is ResolvedMissionDefinition {
  return 'digest' in definition && typeof definition.digest === 'string';
}
/** Short unit-bearing target used in lists, e.g. "5 MB delivered" or "Bound orbit around Moon". */
export function objectiveTarget(objective: ObjectiveDef): { key: string; values: Record<string, string | number> } {
  const spec = objective.spec;
  switch (spec.kind) {
    case 'DELIVERED_PRODUCT': return { key: 'objective.summary.DELIVERED_PRODUCT', values: { value: spec.targetMB, metric: spec.metric } };
    case 'INSTRUMENT_HOURS': return { key: 'objective.summary.INSTRUMENT_HOURS', values: { value: spec.targetHours } };
    case 'APOGEE_BAND': return { key: 'objective.summary.APOGEE_BAND', values: { min: spec.minAltKm, max: spec.maxAltKm } };
    case 'RETURN_BOUNDARY': return { key: 'objective.summary.RETURN_BOUNDARY', values: { altitude: spec.altitudeKm } };
    case 'BOUND_ORBIT': return { key: 'objective.summary.BOUND_ORBIT', values: { body: spec.body, periMin: spec.periapsisAltKm.min, periMax: spec.periapsisAltKm.max, apoMin: spec.apoapsisAltKm.min, apoMax: spec.apoapsisAltKm.max } };
    case 'ESCAPE': return { key: 'objective.summary.ESCAPE', values: { periapsis: spec.minPeriapsisAltKm, excess: spec.minExcessSpeedKms } };
    case 'ENTRY_INTERFACE': return { key: 'objective.summary.ENTRY_INTERFACE', values: { altitude: spec.altitudeKm } };
    case 'ENCOUNTER_DISTANCE': return { key: 'objective.summary.ENCOUNTER_DISTANCE', values: { min: spec.minDistanceKm, max: spec.maxDistanceKm } };
    case 'PROPELLANT_RESERVE': return { key: 'objective.summary.PROPELLANT_RESERVE', values: { value: spec.minKg } };
    case 'CREW_SUPPORT_THROUGH_RECOVERY': return { key: 'objective.summary.CREW_SUPPORT_THROUGH_RECOVERY', values: {} };
    case 'CREW_ORBIT_HOURS': return { key: 'objective.summary.CREW_ORBIT_HOURS', values: { value: spec.hours } };
  }
}
