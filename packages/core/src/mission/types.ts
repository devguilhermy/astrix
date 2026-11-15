// Declarative mission definition types. No executable content: closed registries only.
import type { BodyId, BusId, DesignPart, OrbitChoice, RoleId } from '../contracts';

export const DEFINITION_SCHEMA_VERSION = 1 as const;
export const FLIGHT_MODEL_VERSION = 2 as const;
export const MAX_DEFINITION_BYTES = 32768;
export const MAX_DEFINITION_FRAME_BYTES = 40960;

export type Digest = `sha256:${string}`;
export type MissionOrigin = 'BUILTIN' | 'LEARNING' | 'CUSTOM';
export type MissionId = string;
export type BuiltinMissionId = 'FIRST_LIGHT' | 'STORM_WATCH' | 'RED_RELAY' | 'CREW_PATHFINDER' | 'SUN_SENTINEL' | 'FIRST_SIGNAL' | 'UP_AND_BACK' | 'STAY_IN_ORBIT' | 'RAISE_YOUR_ORBIT' | 'LEAVE_ORBIT_SAFELY' | 'PAST_EARTH' | 'MEET_THE_MOON' | 'EARTH_TO_MOON';
export interface Label { readonly key?: string; readonly text?: string }
export interface Range { readonly min: number; readonly max: number }
export type FailureCause = 'BATTERY_DEPLETED' | 'CAPTURE_FAILED' | 'OBJECTIVE_MISSED' | 'THERMAL_SURVIVAL' | 'CREW_SUPPORT_LOST' | 'SURFACE_IMPACT' | 'ASCENT_FAILED' | 'DEADLINE_MISSED';
export type ProductMetric = 'IMAGES' | 'MAPS' | 'ANY_SCIENCE';
export type ObjectiveKind = 'DELIVERED_PRODUCT' | 'INSTRUMENT_HOURS' | 'APOGEE_BAND' | 'RETURN_BOUNDARY' | 'BOUND_ORBIT' | 'ESCAPE' | 'ENTRY_INTERFACE' | 'ENCOUNTER_DISTANCE' | 'PROPELLANT_RESERVE' | 'CREW_SUPPORT_THROUGH_RECOVERY' | 'CREW_ORBIT_HOURS';
export type ObjectiveSpec =
 | { readonly kind: 'DELIVERED_PRODUCT'; readonly metric: ProductMetric; readonly targetMB: number }
 | { readonly kind: 'INSTRUMENT_HOURS'; readonly metric: 'RADIATION_HOURS'; readonly targetHours: number; readonly windowStartSec: number; readonly windowEndSec: number }
 | { readonly kind: 'APOGEE_BAND'; readonly minAltKm: number; readonly maxAltKm: number }
 | { readonly kind: 'RETURN_BOUNDARY'; readonly altitudeKm: number; readonly afterObjectiveId: string }
 | { readonly kind: 'BOUND_ORBIT'; readonly body: BodyId; readonly periapsisAltKm: Range; readonly apoapsisAltKm: Range; readonly minSafePeriapsisAltKm: number; readonly inclinationDeg?: Range }
 | { readonly kind: 'ESCAPE'; readonly body: 'EARTH'; readonly minPeriapsisAltKm: number; readonly minExcessSpeedKms: number }
 | { readonly kind: 'ENTRY_INTERFACE'; readonly body: 'EARTH'; readonly altitudeKm: number }
 | { readonly kind: 'ENCOUNTER_DISTANCE'; readonly body: 'MOON'; readonly minDistanceKm: number; readonly maxDistanceKm: number }
 | { readonly kind: 'PROPELLANT_RESERVE'; readonly inventory: 'SPACECRAFT'; readonly minKg: number }
 | { readonly kind: 'CREW_SUPPORT_THROUGH_RECOVERY' }
 | { readonly kind: 'CREW_ORBIT_HOURS'; readonly hours: number };
export interface ObjectiveDef { readonly id: string; readonly label: Label; readonly required: boolean; readonly owner: RoleId; readonly deadlineSec: number | null; readonly dwellSec: number; readonly spec: ObjectiveSpec }
/** OPERATIONS means the supplied orbit is the actual state at the mission epoch,
 * not the target orbit of an earlier analytical delivery/capture segment. A Sun start is a heliocentric orbit already reached by an Earth-escape launch. */
export interface ProvidedOrbitStart { readonly kind: 'PROVIDED_ORBIT'; readonly body: 'EARTH' | 'MARS' | 'SUN'; readonly orbit: OrbitChoice; readonly orbitOptions: 'RIDE'; readonly initialPhase?: 'OPERATIONS'; readonly stage?: { readonly launcherId: string; readonly propellantKg: number } }
export interface SurfaceLaunchStart { readonly kind: 'SURFACE_LAUNCH'; readonly site: { readonly name: Label; readonly latDeg: number; readonly lonDeg: number }; readonly launcherIds: readonly string[] }
/** HELIOCENTRIC_CONIC: two-body conic about the Sun with no manoeuvres; the craft never leaves the Sun's frame. */
export type TrajectorySpec = { readonly model: 'PATCHED_CONICS'; readonly bodies: readonly ('EARTH' | 'MOON')[]; readonly maneuvers: { readonly allowed: boolean; readonly maxBurns: number } } | { readonly model: 'MARS_ANALYTIC_CRUISE' } | { readonly model: 'HELIOCENTRIC_CONIC' };
export interface AscentProgram { readonly azimuthDeg: number; readonly verticalSec: number; readonly kickDeg: number; readonly kickSec: number; readonly stage1LoadFraction: number; readonly stage2CoastSec: number; readonly insertionAltKm: number; readonly holdUpperStage: boolean }
export type BurnTrigger = { readonly kind: 'AT_TIME'; readonly tSec: number } | { readonly kind: 'AT_APSIS'; readonly apsis: 'PERIAPSIS' | 'APOAPSIS'; readonly notBeforeSec: number; readonly body?: BodyId } | { readonly kind: 'AT_SOI_ENTRY'; readonly body: 'MOON'; readonly delaySec: number };
export interface BurnSpec { readonly id: string; readonly source: 'SPACECRAFT' | 'UPPER_STAGE'; readonly trigger: BurnTrigger; readonly frame: 'VNR' | 'INERTIAL'; readonly dv: readonly [number, number, number]; readonly model: 'IMPULSIVE' }
export type LearningEditable = 'PARTS' | 'PROPELLANT' | 'RIDE' | 'ORBIT' | 'LAUNCHER' | 'ASCENT' | 'BURNS';
export interface LearningProfile {
 readonly level: 'FIRST_SIGNAL' | 'ASCENT' | 'ORBIT' | 'LUNAR';
 readonly starter: { readonly parts: readonly DesignPart[]; readonly rideId: string | null; readonly orbit: OrbitChoice | null; readonly launcherId: string | null; readonly program: AscentProgram | null; readonly burns: readonly BurnSpec[] };
 readonly precompleted: { readonly objectiveConfirmed: boolean; readonly segments: { readonly launch: boolean; readonly space: boolean; readonly ground: boolean; readonly user: boolean }; readonly trade: boolean; readonly baseline: boolean; readonly verification: boolean };
 readonly editable: readonly LearningEditable[]; readonly startLabelKey: string;
 readonly assistance: { readonly recommendAscent: boolean; readonly recommendBurns: boolean }; readonly teachingKeys: readonly string[];
}
export interface MissionDefinition {
 readonly schema: typeof DEFINITION_SCHEMA_VERSION; readonly id: MissionId; readonly revision: number; readonly origin: MissionOrigin;
 readonly derivedFrom: { readonly id: MissionId; readonly digest: Digest } | null; readonly author?: string;
 readonly name: Label; readonly description: Label; readonly objectiveSummary: Label; readonly notes?: string;
 readonly vehicle: { readonly busId: BusId; readonly budget: number; readonly requiredPartIds: readonly string[]; readonly minRecordingMB: number; readonly minLinkKbps: number; readonly allowedRideIds: readonly string[] };
 readonly environment: {
  readonly epochUTC: string; readonly seed: number; readonly durationSec: number; readonly stationId: 'GS_MIDLAT' | 'DSN' | 'CREW_RELAY'; readonly stationAllocationStartSec: number;
  readonly storm: null | { readonly startSec: number; readonly endSec: number; readonly dose: 'RADLAB_HOURLY' | 'MARS_ASSUMED' };
  readonly scheduledFaults: boolean; readonly commLightTime: boolean;
 };
 readonly start: ProvidedOrbitStart | SurfaceLaunchStart;
 readonly trajectory: TrajectorySpec;
 readonly support: { readonly crew: boolean };
 readonly objectives: readonly ObjectiveDef[];
 readonly termination: { readonly endOnSuccess: boolean; readonly failOn: readonly FailureCause[] };
 readonly learning?: LearningProfile;
}
export type ResolvedMissionDefinition = MissionDefinition & { readonly digest: Digest };

export type DefinitionIssueCode = 'SIZE' | 'DEPTH' | 'TYPE' | 'RANGE' | 'UNIT' | 'UNKNOWN_FIELD' | 'UNKNOWN_REF' | 'UNSUPPORTED' | 'CONTRADICTION' | 'SCHEMA_VERSION' | 'EMPTY_REQUIRED' | 'PHASE_INCOMPATIBLE';
export interface DefinitionIssue { readonly path: string; readonly code: DefinitionIssueCode; readonly message: string }
export type DefinitionResult = { readonly ok: true; readonly definition: ResolvedMissionDefinition } | { readonly ok: false; readonly issues: readonly DefinitionIssue[] };
