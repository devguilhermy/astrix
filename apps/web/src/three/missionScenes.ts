import { CONSTANTS, orbitAltitudes, type Design } from '@astrix/core';
import { BUS_GEOMETRY } from './spacecraft/slots';
import { allowsManeuvers, missionBody, sceneFamily, startsOnSurface, usesMoon, type DefinitionLike } from '../ui/missions/definitionView';

export type SceneStage = 'NEED_GOALS' | 'CONCEPT' | 'REQUIREMENTS' | 'DESIGN' | 'BUILD_VERIFY' | 'IMPLEMENT' | 'REVIEW';
/** `launch` is the legacy illustrative storyboard for provided-orbit presets; `flight` renders authoritative simulated state. */
export type SceneKind = 'assembly' | 'orbit' | 'transfer' | 'launch' | 'flight';
export type SceneVector = [number, number, number];
export interface MissionSceneDefinition {
 readonly id: string;
 readonly body: 'EARTH' | 'MARS';
 readonly radiusKm: number;
 readonly color: string;
 readonly accent: string;
 readonly family: 'imager' | 'radiation' | 'relay';
 readonly camera: { readonly direction: SceneVector };
}

const KIT = {
 EARTH: { radiusKm: CONSTANTS.EARTH.radius.v, color: '#16466c', accent: '#63e2d3', direction: [0.65, 0.4, 0.9] },
 MARS: { radiusKm: CONSTANTS.MARS.radius.v, color: '#a65d43', accent: '#eea38c', direction: [0.6, 0.5, 0.9] },
} as const;
const STORM_ACCENT = '#efb775', CREW_ACCENT = '#d5e7ef';

/** Procedural, shared assets derived from what the definition declares; selecting a mission never creates a renderer or grants equipment. */
export function sceneKitFor(definition: DefinitionLike): MissionSceneDefinition {
 const body = missionBody(definition) === 'MARS' ? 'MARS' : 'EARTH', base = KIT[body], family = sceneFamily(definition);
 const kit: MissionSceneDefinition = { id: definition.id, body, radiusKm: base.radiusKm, color: base.color, family, accent: family === 'radiation' ? STORM_ACCENT : definition.support.crew ? CREW_ACCENT : base.accent, camera: { direction: [...base.direction] } };
 if (!(kit.radiusKm > 0)) throw new Error(`Invalid mission scene: ${definition.id}`);
 return kit;
}

/** Neutral planet kit for the independent trajectory viewer, which has no mission definition. */
export function planetKit(body: 'EARTH' | 'MARS'): MissionSceneDefinition {
 const base = KIT[body];
 return { id: body, body, radiusKm: base.radiusKm, color: base.color, accent: base.accent, family: 'imager', camera: { direction: [...base.direction] } };
}

/** Missions whose trajectory is not one fixed analytic ellipse must draw the simulated state instead of the authored orbit. */
export function usesFlightScene(definition: DefinitionLike): boolean {
 return definition.trajectory.model === 'PATCHED_CONICS' && (startsOnSurface(definition) || allowsManeuvers(definition) || usesMoon(definition));
}

export function sceneKind(stage: SceneStage, definition: DefinitionLike, cruise: boolean, hasFlight = false): SceneKind {
 const legacyMars = definition.trajectory.model === 'MARS_ANALYTIC_CRUISE';
 if (stage === 'NEED_GOALS' || stage === 'CONCEPT' || stage === 'REQUIREMENTS' || stage === 'DESIGN' || stage === 'BUILD_VERIFY') return legacyMars && stage === 'CONCEPT' ? 'transfer' : 'assembly';
 if (legacyMars && cruise) return 'transfer';
 if (usesFlightScene(definition) && (hasFlight || startsOnSurface(definition))) return 'flight';
 return 'orbit';
}

export function sceneRadius(kit: MissionSceneDefinition, kind: SceneKind, design: Design): number {
 if (kind === 'assembly') return Math.max(...BUS_GEOMETRY[design.busId].dimensions) * .001 * 1.25;
 if (kind === 'launch') return .11;
 if (kind === 'transfer') return CONSTANTS.MARS.distanceKm.v * 1.16;
 return (kit.radiusKm + (design.orbit ? orbitAltitudes(design.orbit).apoapsisAltitudeKm : 420)) * 1.25;
}
