import type { ObjectiveDef, RoleId } from '@astrix/core';

/**
 * Editing metadata for the closed evaluator registry. Each kind lists exactly the fields its evaluator reads, with
 * units; the engine remains the authority on bounds. Adding a kind here without an engine evaluator is impossible
 * because `validateMissionDefinition` rejects unknown kinds.
 */
export type ObjectiveKind = ObjectiveDef['spec']['kind'];
export type FieldDescriptor =
  | { type: 'number'; path: string; unit: string; step?: number; min?: number }
  | { type: 'range'; path: string; unit: string; step?: number }
  | { type: 'select'; path: string; options: readonly string[] };
export interface KindDescriptor { kind: ObjectiveKind; fields: readonly FieldDescriptor[]; spec: () => ObjectiveDef['spec']; defaultOwner: RoleId; source: 'data' | 'orbit' | 'ascent' | 'encounter' | 'propellant' | 'crew' }

export const OBJECTIVE_KINDS: readonly KindDescriptor[] = [
  { kind: 'DELIVERED_PRODUCT', defaultOwner: 'SCIENCE', source: 'data', spec: () => ({ kind: 'DELIVERED_PRODUCT', metric: 'ANY_SCIENCE', targetMB: 5 }), fields: [{ type: 'select', path: 'metric', options: ['IMAGES', 'MAPS', 'ANY_SCIENCE'] }, { type: 'number', path: 'targetMB', unit: 'MB', step: 0.5, min: 0 }] },
  { kind: 'INSTRUMENT_HOURS', defaultOwner: 'SCIENCE', source: 'data', spec: () => ({ kind: 'INSTRUMENT_HOURS', metric: 'RADIATION_HOURS', targetHours: 6, windowStartSec: 0, windowEndSec: 86400 }), fields: [{ type: 'number', path: 'targetHours', unit: 'h', step: 0.5, min: 0 }, { type: 'number', path: 'windowStartSec', unit: 's', step: 60, min: 0 }, { type: 'number', path: 'windowEndSec', unit: 's', step: 60, min: 0 }] },
  { kind: 'APOGEE_BAND', defaultOwner: 'LAUNCH_ORBIT', source: 'ascent', spec: () => ({ kind: 'APOGEE_BAND', minAltKm: 80, maxAltKm: 120 }), fields: [{ type: 'number', path: 'minAltKm', unit: 'km', step: 5, min: 0 }, { type: 'number', path: 'maxAltKm', unit: 'km', step: 5, min: 0 }] },
  { kind: 'RETURN_BOUNDARY', defaultOwner: 'LAUNCH_ORBIT', source: 'ascent', spec: () => ({ kind: 'RETURN_BOUNDARY', altitudeKm: 20, afterObjectiveId: '' }), fields: [{ type: 'number', path: 'altitudeKm', unit: 'km', step: 5, min: 0 }, { type: 'select', path: 'afterObjectiveId', options: [] }] },
  { kind: 'BOUND_ORBIT', defaultOwner: 'LAUNCH_ORBIT', source: 'orbit', spec: () => ({ kind: 'BOUND_ORBIT', body: 'EARTH', periapsisAltKm: { min: 160, max: 600 }, apoapsisAltKm: { min: 160, max: 800 }, minSafePeriapsisAltKm: 160 }), fields: [{ type: 'select', path: 'body', options: ['EARTH', 'MOON', 'MARS'] }, { type: 'range', path: 'periapsisAltKm', unit: 'km', step: 10 }, { type: 'range', path: 'apoapsisAltKm', unit: 'km', step: 10 }, { type: 'number', path: 'minSafePeriapsisAltKm', unit: 'km', step: 10, min: 0 }] },
  { kind: 'ESCAPE', defaultOwner: 'LAUNCH_ORBIT', source: 'orbit', spec: () => ({ kind: 'ESCAPE', body: 'EARTH', minPeriapsisAltKm: 160, minExcessSpeedKms: 0.1 }), fields: [{ type: 'number', path: 'minPeriapsisAltKm', unit: 'km', step: 10, min: 0 }, { type: 'number', path: 'minExcessSpeedKms', unit: 'km/s', step: 0.05, min: 0 }] },
  { kind: 'ENTRY_INTERFACE', defaultOwner: 'LAUNCH_ORBIT', source: 'orbit', spec: () => ({ kind: 'ENTRY_INTERFACE', body: 'EARTH', altitudeKm: 100 }), fields: [{ type: 'number', path: 'altitudeKm', unit: 'km', step: 5, min: 0 }] },
  { kind: 'ENCOUNTER_DISTANCE', defaultOwner: 'LAUNCH_ORBIT', source: 'encounter', spec: () => ({ kind: 'ENCOUNTER_DISTANCE', body: 'MOON', minDistanceKm: 2500, maxDistanceKm: 12000 }), fields: [{ type: 'number', path: 'minDistanceKm', unit: 'km', step: 100, min: 0 }, { type: 'number', path: 'maxDistanceKm', unit: 'km', step: 100, min: 0 }] },
  { kind: 'PROPELLANT_RESERVE', defaultOwner: 'SPACECRAFT', source: 'propellant', spec: () => ({ kind: 'PROPELLANT_RESERVE', inventory: 'SPACECRAFT', minKg: 1 }), fields: [{ type: 'number', path: 'minKg', unit: 'kg', step: 0.1, min: 0 }] },
  { kind: 'CREW_SUPPORT_THROUGH_RECOVERY', defaultOwner: 'SPACECRAFT', source: 'crew', spec: () => ({ kind: 'CREW_SUPPORT_THROUGH_RECOVERY' }), fields: [] },
  { kind: 'CREW_ORBIT_HOURS', defaultOwner: 'SPACECRAFT', source: 'crew', spec: () => ({ kind: 'CREW_ORBIT_HOURS', hours: 24 }), fields: [{ type: 'number', path: 'hours', unit: 'h', step: 1, min: 0 }] },
];
export const kindDescriptor = (kind: ObjectiveKind): KindDescriptor => OBJECTIVE_KINDS.find(item => item.kind === kind)!;
export function newObjective(kind: ObjectiveKind, existingIds: readonly string[]): ObjectiveDef {
  const descriptor = kindDescriptor(kind);
  let n = existingIds.length + 1, id = `obj-${n}`;
  while (existingIds.includes(id)) id = `obj-${++n}`;
  return { id, label: { text: '' }, required: true, owner: descriptor.defaultOwner, deadlineSec: null, dwellSec: 0, spec: descriptor.spec() };
}
export const FAILURE_CAUSES = ['BATTERY_DEPLETED', 'CAPTURE_FAILED', 'OBJECTIVE_MISSED', 'THERMAL_SURVIVAL', 'CREW_SUPPORT_LOST', 'SURFACE_IMPACT', 'ASCENT_FAILED', 'DEADLINE_MISSED'] as const;
export const BUS_IDS = ['CUBESAT_3U', 'SMALLSAT', 'CREW_CAPSULE'] as const;
export const STATION_IDS = ['GS_MIDLAT', 'DSN', 'CREW_RELAY'] as const;
export const ROLE_IDS = ['SCIENCE', 'SPACECRAFT', 'LAUNCH_ORBIT', 'GROUND_COMMS'] as const;
