// Shared contracts for the core, content and web implementation owners.
import type { BurnSpec, AscentProgram, Digest, MissionId, MissionOrigin, ResolvedMissionDefinition } from './mission/types';
import type { AscentPreview, BurnPreview, TrajectoryForecast, FlightSample, FlightTelemetry, MissionOutcome, ObjectiveEvidence, TrajectoryEvent } from './flight/types';
export type * from './mission/types';
export type * from './flight/types';
export type BodyId = 'EARTH' | 'MARS' | 'MOON';
export type BusId = 'CUBESAT_3U' | 'SMALLSAT' | 'CREW_CAPSULE';
export type RoleId = 'SCIENCE' | 'SPACECRAFT' | 'LAUNCH_ORBIT' | 'GROUND_COMMS';
export type ActorRole = RoleId | 'ALL';
export type PointingMode = 'SUN' | 'TARGET' | 'EARTH' | 'SAFE';
/** Unit quaternion (x,y,z,w), body axes to MJ2000Eq inertial axes. */
export type AttitudeQuaternion = readonly [number, number, number, number];
export interface AttitudeTelemetry { q: AttitudeQuaternion; target: AttitudeQuaternion; rateRadSec: number; hold: PointingMode | 'MANUAL'; panelSunDeg: number; instrumentTargetDeg: number; antennaEarthDeg: number }
export interface TimelineWindow { kind: 'SUNLIGHT' | 'ECLIPSE' | 'CONTACT' | 'TARGET' | 'STORM' | 'EVENT' | 'MISSION_END'; startSec: number; endSec: number; labelKey?: string }
export interface TimelineForecast { startSec: number; endSec: number; windows: readonly TimelineWindow[] }
export interface MissionForecast { policy: 'DEFAULT'; samples: readonly { t: number; socWh: number; storedMB: number; downlinkedMB: number }[]; outcome: 'SUCCESS' | 'FAILURE' | 'INCOMPLETE'; objectiveValue: number; objectiveTarget: number; endedAtSec: number; evidence: readonly ObjectiveEvidence[]; events: readonly TrajectoryEvent[] }
export type LevelId = 'ASPIRING' | 'EXPERT';
export type HeaterMode = 'OFF' | 'ON' | 'AUTO';
export type LinkMode = 'NORMAL' | 'ROBUST';
export type Phase = 'GOAL' | 'CONCEPT' | 'DESIGN' | 'LAUNCH_ORBIT' | 'OPERATE' | 'REPORT';
export type Provenance = { readonly kind: 'source'; readonly src: string; readonly note?: string } | { readonly kind: 'assumption'; readonly note: string };
export interface Q<T = number> { readonly v: T; readonly p: Provenance }
export interface SourceRef { readonly id: string; readonly title: string; readonly url: string; readonly publisher: string; readonly retrieved: string; readonly listedByChallenge: boolean }
export type PartCategory = 'BATTERY' | 'SOLAR' | 'COMPUTER' | 'STORAGE' | 'ADCS' | 'RADIO' | 'INSTRUMENT' | 'PROPULSION' | 'THERMAL';
export interface PartDef {
 readonly id: string; readonly busId: BusId; readonly role: RoleId; readonly category: PartCategory;
 readonly nameKey: string; readonly descKey: string; readonly unique: boolean;
 readonly massKg: Q; readonly volume: Q; readonly cost: Q; readonly powerW: Q;
 readonly txPowerW?: Q; readonly generationW?: Q; readonly capacityWh?: Q; readonly storageMB?: Q;
 readonly rateKbps?: Q; readonly ispSec?: Q; readonly tankKg?: Q; readonly finePointing?: boolean;
 readonly directional?: boolean; readonly requiresTarget?: boolean; readonly requiresLight?: boolean;
 readonly metric?: 'IMAGES' | 'RADIATION_HOURS' | 'MAPS';
 readonly heaterW?: Q;
 readonly slewRateDegSec?: Q; readonly accuracyDeg?: Q; readonly coneHalfAngleDeg?: Q; readonly beamHalfAngleDeg?: Q;
}
export interface RideDef { readonly id: string; readonly nameKey: string; readonly descKey: string; readonly busIds: readonly BusId[]; readonly body: BodyId; readonly cost: Q; readonly fixedOrbits?: readonly OrbitChoice[] }
export interface DesignPart { readonly partId: string; readonly qty: number; readonly propellantKg?: number }
export interface OrbitChoice { readonly body: BodyId; readonly epochUTC: string; readonly frame: 'MJ2000Eq'; readonly smaKm: number; readonly ecc: number; readonly inclinationDeg: number; readonly raanDeg: number; readonly argPeriapsisDeg: number; readonly trueAnomalyDeg: number }
export interface LaunchPlan { readonly launcherId: string; readonly program: AscentProgram }
export interface Design { readonly missionId: MissionId; readonly definitionDigest: Digest; readonly definition: ResolvedMissionDefinition; readonly levelId: LevelId; readonly rulesVersion: number; readonly busId: BusId; readonly parts: readonly DesignPart[]; readonly rideId: string | null; readonly orbit: OrbitChoice | null; readonly launch: LaunchPlan | null; readonly burns: readonly BurnSpec[]; readonly stationId: string; readonly revision: number }
export interface Budgets {
 readonly massKg: { used: number; limit: number }; readonly volume: { used: number; limit: number; unit: 'U' | 'BAY' }; readonly cost: { used: number; limit: number };
 readonly power: { avgGenW: number; avgLoadW: number; marginPct: number; eclipseWh: number; usableBatteryWh: number } | null;
 readonly data: { genMBPerDay: number; downMBPerDay: number; storageMB: number } | null;
 readonly deltaV: { requiredKms: number; availableKms: number; propellantKg: number } | null;
 readonly orbit: { periodMin: number; eclipseFrac: number; contactMinPerDay: number } | null;
 readonly technical: { bolGenerationW: number; eolGenerationW: number; eolCapacityWh: number; eolUsableBatteryWh: number; eclipseRequiredWh: number; nominalCaptureKms: number; planningCaptureKms: number; thermalColdEquilibriumK: number; thermalHotEquilibriumK: number; recordingRequiredMB: number; minimumLinkKbps: number } | null;
}
export type RefusalCode = 'MASS_OVER_LIMIT' | 'NO_SLOT' | 'OVER_BUDGET' | 'ROLE_LOCKED' | 'DUPLICATE_UNIQUE' | 'RIDE_MISMATCH' | 'ORBIT_NOT_OFFERED' | 'REQUIRES_PART' | 'SIGNOFF_BLOCKED' | 'NOT_READY' | 'NO_CONTACT' | 'MODE_FORBIDS' | 'STORAGE_EMPTY' | 'PROPELLANT_OVER_TANK' | 'UNSUPPORTED_RULES' | 'POWER_EOL_SHORT' | 'ECLIPSE_RESERVE_SHORT' | 'THERMAL_MARGIN_SHORT' | 'RETURN_FUEL_SHORT' | 'CAPTURE_RESERVE_SHORT' | 'DATA_CAPACITY_SHORT' | 'LINK_UNAVAILABLE' | 'POINTING_ACQUIRING' | 'POINTING_DEGRADED' | 'COMPUTER_REBOOTING' | 'RECOVERY_COOLDOWN' | 'INSUFFICIENT_ENERGY' | 'COMMAND_EXPIRED' | 'COMMAND_INVALIDATED' | 'LEVEL_FORBIDS' | 'INVALID_PARAMETER' | 'PROPELLANT_SHORT' | 'BURN_NOT_ALLOWED' | 'BURN_LIMIT' | 'BURN_DUPLICATE_ID' | 'BURN_TRIGGER_PAST' | 'BURN_UNKNOWN' | 'NO_STAGE' | 'LAUNCHER_MISMATCH' | 'PAYLOAD_OVER_LIMIT' | 'ASCENT_PROGRAM_INVALID' | 'DEFINITION_STALE' | 'DEFINITION_INVALID' | 'UNSUPPORTED_MODEL' | 'MOON_UNSUPPORTED_FOR_IMPORT' | 'ASCENT_FORECAST_FAILS' | 'NO_PROPULSION';
export interface Refusal { readonly ok: false; readonly code: RefusalCode; readonly values: Readonly<Record<string, number | string>> }
export type Quote<T> = { readonly ok: true; readonly value: T } | Refusal;
export type Command = { kind: 'ATTITUDE_TARGET'; q: AttitudeQuaternion; gestureId?: string } | { kind: 'POINT'; mode: PointingMode } | { kind: 'INSTRUMENT'; partId: string; on: boolean } | { kind: 'DOWNLINK'; on: boolean } | { kind: 'SAFE'; on: boolean } | { kind: 'CAPTURE_CONFIRM' } | { kind: 'HEATER'; mode: HeaterMode } | { kind: 'LINK_MODE'; mode: LinkMode } | { kind: 'DUTY_CYCLE'; partId: string; fraction: number } | { kind: 'REACQUIRE_POINTING' } | { kind: 'RECOVER_COMPUTER' } | { kind: 'DEPLOY' | 'DEPLOY_RETRY'; system: 'WINGS' | 'ANTENNA' } | { kind: 'CREW_FAN'; on: boolean } | { kind: 'CREW_CARTRIDGE' } | { kind: 'CREW_ISOLATE'; isolated: boolean } | { kind: 'CREW_REPRESSURIZE' } | { kind: 'CREW_PRIORITIZE_POWER'; on: boolean } | { kind: 'CREW_DEORBIT' } | { kind: 'BURN_SCHEDULE'; burn: BurnSpec } | { kind: 'BURN_CANCEL'; id: string } | { kind: 'SEPARATE_STAGE' };
export interface SimState { readonly t: number; readonly [k: string]: unknown }
export type SimEventKind = 'SOLAR_STORM_START' | 'SOLAR_STORM_END' | 'BATTERY_AGING' | 'GROUND_OUTAGE' | 'STORAGE_NEAR_FULL' | 'BATTERY_LOW' | 'BROWNOUT' | 'CAPTURE_DONE' | 'CAPTURE_BURN' | 'FAILURE' | 'OBJECTIVE_MET' | 'PASS_START' | 'PASS_END' | 'MISSION_END' | 'WARP_LIMITED' | 'THERMAL_INHIBIT' | 'THERMAL_RECOVERED' | 'POINTING_DEGRADED' | 'POINTING_SETTLED' | 'COMPUTER_RESET' | 'COMPUTER_RECOVERED' | 'LINK_DEGRADED' | 'LINK_RECOVERED' | 'COMMAND_EXPIRED' | 'COMMAND_REFUSED' | 'CAPACITY_CLAMPED' | 'CREW_CARTRIDGE_SATURATED' | 'CREW_LEAK' | 'CREW_WARNING' | 'CREW_SUPPORT_LOST' | 'CREW_DEORBIT' | 'CREW_RECOVERY' | 'DEPLOYMENT_ANOMALY' | 'DEPLOYMENT_DONE' | 'SESSION_ENDED' | 'LIFTOFF' | 'STAGE_SEPARATION' | 'ORBIT_INSERTION' | 'BURN_EXECUTED' | 'SOI_ENTRY' | 'SOI_EXIT' | 'ENCOUNTER_CLOSEST' | 'SURFACE_IMPACT' | 'ENTRY_INTERFACE' | 'ASCENT_FAILED';
export interface SimEvent { readonly kind: SimEventKind; readonly t: number; readonly autoPause: boolean; readonly values: Readonly<Record<string, number | string>> }
export interface CommandQueueEntry { readonly id: string; readonly command: Command; readonly actor: ActorContext; readonly transport: 'GROUND' | 'ONBOARD'; readonly issuedAt: number; readonly transmittedAt: number | null; readonly applyAt: number | null; readonly expiresAt: number; readonly resolvedAt: number | null; readonly status: 'WAITING_CONTACT' | 'IN_TRANSIT' | 'DELIVERED' | 'REFUSED' | 'EXPIRED'; readonly refusal?: Refusal }
export interface ThermalTelemetry { temperatureK: number; operatingMinK: number; operatingMaxK: number; survivalMinK: number; survivalMaxK: number; heaterMode: HeaterMode; heaterW: number; externalW: number; internalW: number; radiatedW: number; trendKPerHour: number; inhibited: boolean; survivalDwellSec: number }
export interface PowerLifeTelemetry { arrayFactor: number; batteryFactor: number; nominalCapacityWh: number; eolArrayFactor: number; eolBatteryFactor: number; capacityLostWh: number }
export interface PointingTelemetry { requested: PointingMode; state: 'SETTLED' | 'ACQUIRING' | 'DEGRADED' | 'REACQUIRING'; remainingSec: number; quality: number; faulted: boolean; reacquisitions: number }
export interface LinkTelemetry { lineOfSight: boolean; stationAllocated: boolean; uplinkAvailable: boolean; effective: boolean; mode: LinkMode; quality: number; normalRateKbps: number; robustRateKbps: number; activeRateKbps: number; unavailableReason: 'NONE' | 'DEPLOYMENT' | 'GEOMETRY' | 'STATION' | 'COMPUTER' | 'SAFE' | 'POINTING' | 'QUALITY' | 'NO_REQUEST' | 'EMPTY' | 'POWER'; nextOpportunitySec: number | null; scheduling: 'CONTACT_GATED' | 'LIGHT_TIME_ONLY' }
export interface ComputerTelemetry { state: 'RUNNING' | 'REBOOTING' | 'RECOVERING'; cooldownRemainingSec: number; recoveryRemainingSec: number; bootEnergyWh: number; bootPowerW: number; resets: number; recoveries: number }
export interface CaptureTelemetry { nominalKms: number; planningKms: number; realizedKms: number; availableKms: number; reserveKms: number; propellantKg: number; uncertaintyFraction: number }
export type DeploymentStatus = 'NOT_APPLICABLE' | 'STOWED' | 'DEPLOYED' | 'ANOMALOUS';
export interface CrewTelemetry { phase: 'ON_ORBIT' | 'DEORBIT' | 'RECOVERY' | 'COMPLETE'; orbitSec: number; earlyReturn: boolean; daysRemaining: number; limiting: string; oxygenKg: number; nitrogenKg: number; waterKg: number; foodKg: number; scrubberKg: number; activeScrubberKg: number; spareScrubberKg: number; retainedWasteKg: number; ventedKg: number; cabinOxygenKg: number; cabinNitrogenKg: number; cabinCO2Kg: number; pressureMmHg: number; inspiredOxygenMmHg: number; co2MmHg: number; co2AverageMmHg: number; inspiredOxygenAverageMmHg: number; returnWindowOpen: boolean; returnWindowRemainingSec: number; nextReturnWindowSec: number | null; fanOn: boolean; fanWorking: boolean; leakActive: boolean; isolated: boolean; recoveryRemainingSec: number }
export interface AuditEntry { readonly t: number; readonly kind: string; readonly actor: ActorContext | null; readonly owner: ActorRole; readonly transport: 'GROUND' | 'ONBOARD' | 'SESSION' | 'SYSTEM'; readonly revision: number; readonly detail: string }
export interface ActorContext { readonly role: ActorRole; readonly playerId?: string }
export interface Telemetry {
 mass: { retainedKg: number; launchKg: number }; clock: { phase: string; remainingSec: number; plannedSec: number }; crew: CrewTelemetry | null; deployment: { wings: DeploymentStatus; antenna: DeploymentStatus };
 levelId: LevelId; rulesVersion: number; assisted: boolean; remainderSec: number;
 thermal: ThermalTelemetry | null; powerLife: PowerLifeTelemetry; pointing: PointingTelemetry; link: LinkTelemetry; computer: ComputerTelemetry; capture: CaptureTelemetry | null;
 attitude: AttitudeTelemetry;
 t: number; socWh: number; capacityWh: number; genW: number; loadW: number; sunlit: boolean; inContact: boolean;
 storedMB: number; storageMB: number; downlinkedMB: number; doseUGyH: number; mode: PointingMode; safe: boolean;
 lightTimeSec: number | null; queued: number; objective: { metricKey: string; value: number; target: number };
 flight: FlightTelemetry | null; evidence: readonly ObjectiveEvidence[]; outcome: MissionOutcome; definition: { id: MissionId; digest: Digest; revision: number; origin: MissionOrigin };
 positionKm: [number, number, number]; sunDir: [number, number, number]; stationPosKm: [number, number, number] | null;
 instruments: readonly { partId: string; on: boolean; lost: boolean; dutyFraction: number }[];
 commandQueue: readonly CommandQueueEntry[];
 downlinkRequested: boolean; downlinkActive: boolean;
 ended?: boolean; endedByTeam: boolean; cruise?: boolean; capturePending?: boolean; nextPassSec?: number | null;
}
export interface HistorySample { attitude: AttitudeTelemetry; t: number; eventBoundary: boolean; phase: string; positionKm: [number, number, number]; sunDir: [number, number, number]; stationPosKm: [number, number, number] | null; retainedKg: number; socPct: number; storedPct: number; downlinkedMB: number; doseUGyH: number; inContact: 0 | 1; temperatureK: number | null; arrayFactor: number; capacityWh: number; pointingQuality: number; linkQuality: number; computerState: ComputerTelemetry['state']; flight?: FlightSample }
export interface FailureReport { causeKey: string; t: number; facts: readonly { key: string; values: Record<string, number | string> }[]; advice: readonly string[] }
export interface RunIdentity { levelId: LevelId; rulesVersion: number; modelVersion: number; definitionId: MissionId; definitionRevision: number; definitionDigest: Digest; origin: MissionOrigin; seed: number; assisted: boolean; policy: 'STANDARD' | 'EXPERIMENTAL' }
export interface ScoreBreakdown { total: number; stars: 0 | 1 | 2 | 3 | 4 | 5; components: readonly { key: string; weight: number; value: number }[]; identity: RunIdentity; outcome: MissionOutcome; evidence: readonly ObjectiveEvidence[]; interventionEnergyWh: number; firstFailure: FailureReport | null }
export interface TeamStats { roles: number; signoffs: number; blockedSignoffAttempts: number; sev3Raised: number; sev3ResolvedBeforeLaunch: number }
export interface ActiveCue { id: string; ruleId: string; category: 'alert' | 'tip' | 'teach'; severity: 1 | 2 | 3; role: RoleId | 'ALL'; params: Record<string, number | string>; target?: string; glossaryId?: string; fix?: string; firstRaisedSec: number }
export interface CueEngineState { readonly lastRaised: Readonly<Record<string, number>>; readonly clearPending: Readonly<Record<string, number>>; readonly active: readonly ActiveCue[] }
export type ReviewSnapshot = { readonly phase: Phase; readonly [k: string]: unknown };
export interface OrbitPreset { readonly id: string; readonly titleKey: string; readonly orbit: OrbitChoice }
export interface MissionSummary {
 readonly fit: { readonly mass: 'FITS' | 'TIGHT' | 'OVER'; readonly room: 'FITS' | 'TIGHT' | 'OVER' };
 readonly energy: { readonly generation: 'ENOUGH' | 'LOW' | 'SHORT' | 'UNKNOWN'; readonly eclipseBattery: 'ENOUGH' | 'LOW' | 'SHORT' | 'UNKNOWN' };
 readonly progress: { readonly metricKey: string; readonly value: number; readonly target: number };
 readonly budget: { readonly used: number; readonly limit: number }; readonly sourceRevision: number;
}
// The implementation package exports these signatures. Keep signatures stable; additions go through the integration owner.
export interface CoreAPI {
 computeBudgets(design: Design): Budgets;
 quoteAddPart(design: Design, partId: string, role: ActorRole): Quote<{ next: Design; delta: Partial<Budgets> }>;
 quoteRemovePart(design: Design, partId: string, role: ActorRole): Quote<{ next: Design }>;
 quoteSetRide(design: Design, rideId: string, role: ActorRole): Quote<{ next: Design }>;
 quoteSetOrbit(design: Design, orbit: OrbitChoice, role: ActorRole): Quote<{ next: Design }>;
 quoteSetPropellant(design: Design, kg: number, role: ActorRole): Quote<{ next: Design }>;
 launchReadiness(design: Design, signoffs: Readonly<Record<RoleId, boolean>>): readonly Refusal[];
 rolesAffectedBy(prev: Design, next: Design): readonly RoleId[];
 createSim(design: Design, seed: number): SimState;
 markPracticeRetry(checkpoint: SimState): SimState;
 issueCommand(state: SimState, cmd: Command, role: ActorRole, actor?: ActorContext): Quote<SimState>;
 stepSim(state: SimState, dtSec: number): { state: SimState; events: readonly SimEvent[] };
 skipCruise(state: SimState): { state: SimState; events: readonly SimEvent[] };
 telemetry(state: SimState): Telemetry;
 forecastTimeline(state: SimState, horizonSec: number): TimelineForecast;
 forecastMission(design: Design, policy: 'DEFAULT', horizonSec: number): MissionForecast;
 transferPosition(t: number, epochUTC: string): readonly [number, number, number];
 history(state: SimState): readonly HistorySample[];
 failureReport(state: SimState): FailureReport | null;
 scoreMission(state: SimState, design: Design, team: TeamStats): ScoreBreakdown;
 evaluateCues(prev: CueEngineState, snap: ReviewSnapshot, nowSec: number): CueEngineState;
 designSnapshot(design: Design): ReviewSnapshot;
 operateSnapshot(state: SimState, design: Design): ReviewSnapshot;
 listMissions(filter?: { origin?: MissionOrigin }): readonly ResolvedMissionDefinition[];
 previewAscent(design: Design): AscentPreview;
 recommendAscentProgram(design: Design): { program: AscentProgram; preview: AscentPreview } | Refusal;
 previewBurn(from: SimState | Design, burn: BurnSpec): BurnPreview;
 forecastTrajectory(from: SimState | Design, horizonSec: number): TrajectoryForecast;
 recommendBurns(design: Design): readonly BurnSpec[];
 listParts(busId: BusId): readonly PartDef[];
 listRides(busId: BusId, body: BodyId): readonly RideDef[];
 captureOrbits(): readonly OrbitChoice[];
 listSources(): readonly SourceRef[];
 listAssumptions(): readonly { key: string; note: string; value: number | string }[];
 createStarterDesign(definition: ResolvedMissionDefinition, levelId: LevelId): Design;
 listOrbitPresets(design: Design): readonly OrbitPreset[];
 previewOrbit(design: Design, presetId: string, role: ActorRole): Quote<{ next: Design; before: Budgets; after: Budgets }>;
 planPropellant(design: Design, role: ActorRole): Quote<{ next: Design; requiredKg: number; after: Budgets }>;
 summarizeMission(design: Design, budgets: Budgets, sim: SimState | null): MissionSummary;
}
