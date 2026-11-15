import type { BodyId, Q, RefusalCode, RoleId } from '../contracts';
import type { BurnSpec, ObjectiveKind } from '../mission/types';
import type { Vec3 } from '../physics';

export type Frame = 'EARTH_J2000EQ' | 'MOON_J2000EQ' | 'MARS_J2000EQ';
export interface StateVector { body: BodyId; frame: Frame; epochSec: number; epochUTC: string; rKm: Vec3; vKms: Vec3 }
export interface FlightStateView { central: StateVector; earth: StateVector; moon: StateVector | null; moonEphemeris: StateVector | null; altitudeKm: number; speedKms: number }
export interface OrbitTelemetry {
 kind: 'ELLIPSE' | 'PARABOLA' | 'HYPERBOLA'; body: BodyId; smaKm: number; ecc: number; inclinationDeg: number; periapsisAltKm: number; apoapsisAltKm: number | null; periodSec: number | null;
 specificEnergyKm2s2: number; vInfKms: number | null; timeToPeriapsisSec: number | null; timeToApoapsisSec: number | null; impacts: boolean; impactInSec: number | null;
}
export type MissionPhase = 'PRELAUNCH' | 'ASCENT' | 'COAST' | 'CRUISE' | 'ENCOUNTER' | 'CAPTURED' | 'OPERATE' | 'COMPLETE';
export type TrajectoryEventKind = 'LIFTOFF' | 'MAX_Q' | 'STAGE_SEPARATION' | 'SECO' | 'ORBIT_INSERTION' | 'PAYLOAD_SEPARATION' | 'BURN' | 'SOI_ENTRY' | 'SOI_EXIT' | 'PERIAPSIS' | 'APOAPSIS' | 'ENTRY_INTERFACE' | 'SURFACE_IMPACT' | 'ESCAPE_ENERGY' | 'CAPTURE' | 'ENCOUNTER_CLOSEST' | 'ASCENT_FAILED';
export interface TrajectoryEvent { kind: TrajectoryEventKind; t: number; body: BodyId; values: Readonly<Record<string, number | string>> }
export interface BurnReceipt { id: string; status: 'EXECUTED' | 'PARTIAL' | 'REFUSED' | 'CANCELLED' | 'MISSED'; atSec: number; source: BurnSpec['source']; requestedDvKms: number; achievedDvKms: number; propellantUsedKg: number; before: StateVector; after: StateVector | null; reason?: string }
export interface ScheduledBurnView { burn: BurnSpec; fireAtSec: number | null; status: 'PLANNED' | 'ARMED' }
export interface FlightTelemetry {
 phase: MissionPhase; view: FlightStateView; orbit: OrbitTelemetry;
 mass: { totalKg: number; spacecraftDryKg: number; spacecraftPropellantKg: number; stage: null | { attached: boolean; dryKg: number; propellantKg: number; restartsLeft: number } };
 ascent: null | { stageIndex: number; thrustKN: number; throttle: number; dynamicPressurePa: number; downrangeKm: number; flightPathDeg: number; cutoff: 'NONE' | 'SECO' | 'FUEL_OUT'; separatedAtSec: number | null };
 burns: readonly BurnReceipt[]; scheduled: readonly ScheduledBurnView[]; trajectoryEvents: readonly TrajectoryEvent[]; limits: readonly string[];
}
export type ObjectiveState = 'NOT_EVALUATED' | 'IN_PROGRESS' | 'MET' | 'FAILED';
export interface ObjectiveEvidence {
 id: string; kind: ObjectiveKind; required: boolean; owner: RoleId; state: ObjectiveState; progress: number;
 actual: number | null; target: number | null; unit: string; source: 'DELIVERED_DATA' | 'ORBIT_STATE' | 'ASCENT_STATE' | 'ENCOUNTER' | 'PROPELLANT' | 'CREW' | 'CLOCK';
 dwellHeldSec: number; dwellRequiredSec: number; metAtSec: number | null; detail: Readonly<Record<string, number | string>>;
}
export type MissionOutcome = 'PROVISIONAL' | 'SUCCESS' | 'FAILURE' | 'INCOMPLETE';
export interface FlightSample { phase: MissionPhase; earthRKm: Vec3; moonRKm: Vec3 | null; centralBody: BodyId; altitudeKm: number; speedKms: number; massKg: number }

export interface StageDef { id: string; dryKg: number; propellantKg: number; thrustKN: number; ispVacSec: number; ispSeaSec: number; restarts: number }
export interface LauncherDef { id: string; nameKey: string; descKey: string; stages: readonly StageDef[]; payloadLimitKg: number; fairingKg: number; cdAreaM2: number; cost: Q }

export interface AscentSample { t: number; altKm: number; speedKms: number; downrangeKm: number; massKg: number; stage: number; thrustKN: number; qPa: number }
export interface AscentPreview {
 outcome: 'ORBIT' | 'SUBORBITAL_RETURN' | 'IMPACT_DURING_BURN' | 'ESCAPE' | 'NO_LIFTOFF'; samples: readonly AscentSample[]; events: readonly TrajectoryEvent[]; final: FlightStateView | null;
 apogeeAltKm: number; perigeeAltKm: number | null; deltaVLossKms: { gravity: number; drag: number; steering: number };
 propellantRemainingKg: { stage1: number; stage2: number }; limits: readonly string[];
}
export interface BurnPreview {
 burnId: string; feasible: boolean; achievedDvKms: number; propellantKg: number; before: FlightStateView | null; after: FlightStateView | null; orbitAfter: OrbitTelemetry | null;
 events: readonly TrajectoryEvent[]; refusal?: RefusalCode;
}
export interface TrajectorySampleView { t: number; earth: Vec3; moon: Vec3 | null; body: BodyId }
export interface TrajectoryForecast { samples: readonly TrajectorySampleView[]; events: readonly TrajectoryEvent[]; encounter: { closestKm: number; atSec: number; body: BodyId } | null; burns: readonly BurnPreview[] }
