import { CONSTANTS, orbitAltitudes, type Design, type ScenarioId } from '@astrix/core';
import { BUS_GEOMETRY } from './spacecraft/slots';

export type SceneStage = 'NEED_GOALS' | 'CONCEPT' | 'REQUIREMENTS' | 'DESIGN' | 'BUILD_VERIFY' | 'IMPLEMENT' | 'REVIEW';
export type SceneKind = 'assembly' | 'orbit' | 'transfer' | 'launch';
export type SceneVector = [number, number, number];
export interface MissionSceneDefinition {
 readonly id: ScenarioId;
 readonly body: 'EARTH' | 'MARS';
 readonly radiusKm: number;
 readonly color: string;
 readonly accent: string;
 readonly equipment: readonly string[];
 readonly family: 'imager' | 'radiation' | 'relay';
 readonly context: 'earth-imaging' | 'sun-earth' | 'mars-transfer';
 readonly camera: { readonly direction: SceneVector };
}

/** Procedural, shared assets: selecting a mission never creates a renderer or grants equipment. */
export const MISSION_SCENES: Readonly<Record<ScenarioId, MissionSceneDefinition>> = {
 FIRST_LIGHT: { id: 'FIRST_LIGHT', body: 'EARTH', radiusKm: 6378.137, color: '#16466c', accent: '#63e2d3', equipment: ['CAM_EO'], family: 'imager', context: 'earth-imaging', camera: { direction: [0.65, 0.4, 0.9] } },
 STORM_WATCH: { id: 'STORM_WATCH', body: 'EARTH', radiusKm: 6378.137, color: '#223d69', accent: '#efb775', equipment: ['RAD_MON'], family: 'radiation', context: 'sun-earth', camera: { direction: [0.6, 0.5, 0.9] } },
 RED_RELAY: { id: 'RED_RELAY', body: 'MARS', radiusKm: 3396.2, color: '#a65d43', accent: '#eea38c', equipment: ['SS_MAPPER', 'SS_XBAND', 'SS_PROP_MONO'], family: 'relay', context: 'mars-transfer', camera: { direction: [0.6, 0.5, 0.9] } },
 CREW_PATHFINDER: { id: 'CREW_PATHFINDER', body: 'EARTH', radiusKm: 6378.137, color: '#16466c', accent: '#d5e7ef', equipment: ['CREW_CAPSULE'], family: 'imager', context: 'earth-imaging', camera: { direction: [0.65, 0.4, 0.9] } },
};

export function sceneKind(stage: SceneStage, mission: ScenarioId, cruise: boolean): SceneKind {
 if (stage === 'NEED_GOALS' || stage === 'CONCEPT' || stage === 'REQUIREMENTS' || stage === 'DESIGN' || stage === 'BUILD_VERIFY') return mission === 'RED_RELAY' && stage === 'CONCEPT' ? 'transfer' : 'assembly';
 if (mission === 'RED_RELAY' && cruise) return 'transfer';
 return 'orbit';
}

export function sceneRadius(kit: MissionSceneDefinition, kind: SceneKind, design: Design): number {
 if (kind === 'assembly') return Math.max(...BUS_GEOMETRY[design.busId].dimensions) * .001 * 1.25;
 if (kind === 'launch') return .11;
 if (kind === 'transfer') return CONSTANTS.MARS.distanceKm.v * 1.16;
 return (kit.radiusKm + (design.orbit ? orbitAltitudes(design.orbit).apoapsisAltitudeKm : 420)) * 1.25;
}

export function prepareMissionScene(id: ScenarioId): MissionSceneDefinition {
 const kit = MISSION_SCENES[id];
 if (!kit || kit.id !== id || !kit.equipment.length || !(kit.radiusKm > 0)) throw new Error(`Invalid mission scene: ${id}`);
 return kit;
}
