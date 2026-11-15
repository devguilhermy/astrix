// Built-in missions expressed through the common MissionDefinition. The four original presets keep their rules-4 numbers.
import type { DesignPart, OrbitChoice, RoleId } from '../contracts';
import { makeOrbit } from '../physics';
import { deepFreeze, digestOf } from './digest';
import { SUN_AHEAD } from './solarOrbits';
import type { AscentProgram, BuiltinMissionId, Label, LearningProfile, MissionDefinition, ObjectiveDef, ObjectiveSpec, ResolvedMissionDefinition } from './types';

const EARTH_EPOCH = '2026-11-14T00:00:00Z';
const LEO_420 = makeOrbit('EARTH', 420, 420, 51.6, EARTH_EPOCH);
const MARS_WIDE = makeOrbit('MARS', 400, 33000, 0, EARTH_EPOCH);
const key = (id: string, part: 'name' | 'desc' | 'objective'): Label => ({ key: `scenario.${id}.${part}` });
const objective = (id: string, owner: RoleId, spec: ObjectiveSpec, extra: Partial<Pick<ObjectiveDef, 'required' | 'deadlineSec' | 'dwellSec'>> = {}): ObjectiveDef => ({ id, label: { key: `objective.${id}` }, required: extra.required ?? true, owner, deadlineSec: extra.deadlineSec ?? null, dwellSec: extra.dwellSec ?? 0, spec });
const orbitAt = (orbit: OrbitChoice, epochUTC: string): OrbitChoice => ({ ...orbit, epochUTC });
const SITE_CANAVERAL = { name: { key: 'site.CAPE' } as Label, latDeg: 28.5, lonDeg: -80.6 };
const NO_BURNS: readonly never[] = [];

type Base = Pick<MissionDefinition, 'id' | 'origin' | 'vehicle' | 'environment' | 'start' | 'trajectory' | 'support' | 'objectives' | 'termination'> & { learning?: LearningProfile };
const resolve = (base: Base): ResolvedMissionDefinition => {
 const definition: MissionDefinition = { schema: 1, revision: 1, derivedFrom: null, name: key(base.id, 'name'), description: key(base.id, 'desc'), objectiveSummary: key(base.id, 'objective'), ...base };
 return deepFreeze({ ...definition, digest: digestOf(definition) });
};
const preset = (id: BuiltinMissionId, body: 'EARTH' | 'MARS' | 'SUN', busId: MissionDefinition['vehicle']['busId'], budget: number, durationDays: number, spec: ObjectiveSpec, epoch: string, orbit: OrbitChoice, seed: number, requirement: { requiredPartIds: readonly string[]; minRecordingMB: number; minLinkKbps: number }, rides: readonly string[], opts: { allocationStartHours?: number; storm?: MissionDefinition['environment']['storm']; crew?: boolean; mars?: boolean; stationId: MissionDefinition['environment']['stationId']; extra?: readonly ObjectiveDef[] }): ResolvedMissionDefinition => resolve({
 id, origin: 'BUILTIN', vehicle: { busId, budget, ...requirement, allowedRideIds: rides },
 environment: { epochUTC: epoch, seed, durationSec: durationDays * 86400, stationId: opts.stationId, stationAllocationStartSec: (opts.allocationStartHours ?? 0) * 3600, storm: opts.storm ?? null, scheduledFaults: true, commLightTime: false },
 start: { kind: 'PROVIDED_ORBIT', body, orbit: orbitAt(orbit, epoch), orbitOptions: 'RIDE' },
 trajectory: opts.mars ? { model: 'MARS_ANALYTIC_CRUISE' } : body === 'SUN' ? { model: 'HELIOCENTRIC_CONIC' } : { model: 'PATCHED_CONICS', bodies: ['EARTH'], maneuvers: { allowed: false, maxBurns: 0 } },
 support: { crew: !!opts.crew }, objectives: [objective(`${id}.primary`, 'SCIENCE', spec), ...(opts.extra ?? [])],
 termination: { endOnSuccess: false, failOn: ['BATTERY_DEPLETED', 'THERMAL_SURVIVAL', ...(opts.mars ? ['CAPTURE_FAILED' as const] : []), ...(opts.crew ? ['CREW_SUPPORT_LOST' as const] : []), 'OBJECTIVE_MISSED'] },
});
const STORM_WINDOW = { startSec: 9 * 86400, endSec: 11 * 86400 };

const FIRST_LIGHT = preset('FIRST_LIGHT', 'EARTH', 'CUBESAT_3U', 120, 14, { kind: 'DELIVERED_PRODUCT', metric: 'IMAGES', targetMB: 1500 }, EARTH_EPOCH, LEO_420, 42, { requiredPartIds: ['CAM_EO'], minRecordingMB: 1000, minLinkKbps: 100 }, ['RIDE_CUBESAT_DISPENSER', 'RIDE_SMALL_LAUNCHER'], { stationId: 'GS_MIDLAT' });
const STORM_WATCH = preset('STORM_WATCH', 'EARTH', 'CUBESAT_3U', 100, 21, { kind: 'INSTRUMENT_HOURS', metric: 'RADIATION_HOURS', targetHours: 24, windowStartSec: STORM_WINDOW.startSec, windowEndSec: STORM_WINDOW.endSec }, '2024-05-01T00:00:00Z', LEO_420, 20240510, { requiredPartIds: ['RAD_MON'], minRecordingMB: 32, minLinkKbps: 1 }, ['RIDE_CUBESAT_DISPENSER', 'RIDE_SMALL_LAUNCHER'], { stationId: 'GS_MIDLAT', allocationStartHours: 12, storm: { ...STORM_WINDOW, dose: 'RADLAB_HOURLY' } });
const CREW_PATHFINDER = preset('CREW_PATHFINDER', 'EARTH', 'CREW_CAPSULE', 3000, 3, { kind: 'DELIVERED_PRODUCT', metric: 'IMAGES', targetMB: 100 }, EARTH_EPOCH, LEO_420, 73, { requiredPartIds: ['CREW_OBSERVER', 'CREW_SUPPORT', 'CREW_PROPULSION'], minRecordingMB: 100, minLinkKbps: 100 }, ['RIDE_CREW'], {
 stationId: 'CREW_RELAY', crew: true,
 extra: [objective('CREW_PATHFINDER.crew-orbit', 'LAUNCH_ORBIT', { kind: 'CREW_ORBIT_HOURS', hours: 72 }, { required: false }), objective('CREW_PATHFINDER.crew-support', 'SPACECRAFT', { kind: 'CREW_SUPPORT_THROUGH_RECOVERY' }, { required: false })],
});
const RED_RELAY = preset('RED_RELAY', 'MARS', 'SMALLSAT', 900, 60, { kind: 'DELIVERED_PRODUCT', metric: 'MAPS', targetMB: 5000 }, EARTH_EPOCH, MARS_WIDE, 20240520, { requiredPartIds: ['SS_MAPPER'], minRecordingMB: 6500, minLinkKbps: 100 }, ['RIDE_MARS_TRANSFER'], { stationId: 'DSN', mars: true, storm: { startSec: 10 * 86400, endSec: 11 * 86400, dose: 'MARS_ASSUMED' } });
/** STEREO-A-like solar sentinel: a provided heliocentric orbit 120° ahead of Earth (no cruise, no capture), solar maps returned through the Deep Space Network. */
const SUN_SENTINEL = preset('SUN_SENTINEL', 'SUN', 'SMALLSAT', 700, 30, { kind: 'DELIVERED_PRODUCT', metric: 'MAPS', targetMB: 6000 }, EARTH_EPOCH, SUN_AHEAD, 20061026, { requiredPartIds: ['SS_MAPPER'], minRecordingMB: 8000, minLinkKbps: 100 }, ['RIDE_SOLAR_ORBIT'], { stationId: 'DSN' });

// ---- learning ladder -------------------------------------------------------------------------------------------------
const CUBESAT_STARTER: readonly DesignPart[] = [{ partId: 'EPS_BATT_20', qty: 1 }, { partId: 'SOLAR_BODY', qty: 1 }, { partId: 'OBC', qty: 1 }, { partId: 'ADCS_MAG', qty: 1 }, { partId: 'RADIO_UHF', qty: 1 }];
const SMALLSAT_STARTER: readonly DesignPart[] = [{ partId: 'SS_BATT_300', qty: 1 }, { partId: 'SS_SOLAR_400', qty: 1 }, { partId: 'SS_OBC', qty: 1 }, { partId: 'SS_ADCS', qty: 1 }, { partId: 'SS_XBAND', qty: 1 }];
const withParts = (base: readonly DesignPart[], ...extra: readonly DesignPart[]): readonly DesignPart[] => [...base, ...extra];
const learningBase = { precompleted: { objectiveConfirmed: true, segments: { launch: true, space: true, ground: true, user: true }, trade: true, baseline: true, verification: true } } as const;
const ASCENT_SMALL: AscentProgram = { azimuthDeg: 90, verticalSec: 8, kickDeg: 16, kickSec: 10, stage1LoadFraction: 1, stage2CoastSec: 5, insertionAltKm: 200, holdUpperStage: false };
const ASCENT_LUNAR: AscentProgram = { azimuthDeg: 90, verticalSec: 6, kickDeg: 14, kickSec: 10, stage1LoadFraction: 1, stage2CoastSec: 0, insertionAltKm: 200, holdUpperStage: true };
const learning = (id: BuiltinMissionId, level: LearningProfile['level'], starter: LearningProfile['starter'], editable: LearningProfile['editable'], assistance: LearningProfile['assistance'], start: string): LearningProfile => ({ level, starter, ...learningBase, editable, startLabelKey: start, assistance, teachingKeys: [] });
const common = (id: BuiltinMissionId, busId: MissionDefinition['vehicle']['busId'], budget: number, durationSec: number, epoch: string, seed: number, requirement: { requiredPartIds: readonly string[]; minRecordingMB: number; minLinkKbps: number }, rides: readonly string[], commLightTime = false) => ({
 id, origin: 'LEARNING' as const, vehicle: { busId, budget, ...requirement, allowedRideIds: rides },
 environment: { epochUTC: epoch, seed, durationSec, stationId: 'GS_MIDLAT' as const, stationAllocationStartSec: 0, storm: null, scheduledFaults: false, commLightTime },
 support: { crew: false }, termination: { endOnSuccess: true, failOn: ['BATTERY_DEPLETED', 'THERMAL_SURVIVAL', 'SURFACE_IMPACT', 'ASCENT_FAILED', 'OBJECTIVE_MISSED'] as const },
});
const PARKING_STAGE_RIDE = 'RIDE_LEO_STAGE';
const providedLeo = (orbit: OrbitChoice, epoch: string, stage?: { launcherId: string; propellantKg: number }): MissionDefinition['start'] => ({ kind: 'PROVIDED_ORBIT', body: 'EARTH', orbit: orbitAt(orbit, epoch), orbitOptions: 'RIDE', ...(stage ? { stage } : {}) });
const patched = (bodies: readonly ('EARTH' | 'MOON')[], allowed: boolean, maxBurns: number): MissionDefinition['trajectory'] => ({ model: 'PATCHED_CONICS', bodies, maneuvers: { allowed, maxBurns } });
const earthOrbit = (id: string, spec: ObjectiveSpec, dwellSec = 0): ObjectiveDef => objective(id, 'LAUNCH_ORBIT', spec, { dwellSec });
const surface = (launcherIds: readonly string[]): MissionDefinition['start'] => ({ kind: 'SURFACE_LAUNCH', site: SITE_CANAVERAL, launcherIds });

const FIRST_SIGNAL = resolve({
 ...common('FIRST_SIGNAL', 'CUBESAT_3U', 90, 4 * 86400, EARTH_EPOCH, 7, { requiredPartIds: ['CAM_EO'], minRecordingMB: 5, minLinkKbps: 1 }, ['RIDE_CUBESAT_DISPENSER']),
 start: providedLeo(LEO_420, EARTH_EPOCH), trajectory: patched(['EARTH'], false, 0),
 objectives: [objective('FIRST_SIGNAL.product', 'SCIENCE', { kind: 'DELIVERED_PRODUCT', metric: 'IMAGES', targetMB: 5 })],
 learning: learning('FIRST_SIGNAL', 'FIRST_SIGNAL', { parts: withParts(CUBESAT_STARTER, { partId: 'CAM_EO', qty: 1 }), rideId: 'RIDE_CUBESAT_DISPENSER', orbit: orbitAt(LEO_420, EARTH_EPOCH), launcherId: null, program: null, burns: NO_BURNS }, ['PARTS', 'ORBIT'], { recommendAscent: false, recommendBurns: false }, 'learning.providedParkingOrbit'),
});
const UP_AND_BACK = resolve({
 ...common('UP_AND_BACK', 'CUBESAT_3U', 160, 1800, EARTH_EPOCH, 11, { requiredPartIds: [], minRecordingMB: 0, minLinkKbps: 0 }, []),
 start: surface(['LV_SOUNDING']), trajectory: patched(['EARTH'], false, 0),
 objectives: [objective('UP_AND_BACK.apogee', 'LAUNCH_ORBIT', { kind: 'APOGEE_BAND', minAltKm: 80, maxAltKm: 120 }), objective('UP_AND_BACK.return', 'LAUNCH_ORBIT', { kind: 'RETURN_BOUNDARY', altitudeKm: 20, afterObjectiveId: 'UP_AND_BACK.apogee' })],
 learning: learning('UP_AND_BACK', 'ASCENT', { parts: CUBESAT_STARTER, rideId: null, orbit: null, launcherId: 'LV_SOUNDING', program: { azimuthDeg: 90, verticalSec: 60, kickDeg: 0, kickSec: 5, stage1LoadFraction: 1, stage2CoastSec: 0, insertionAltKm: 150, holdUpperStage: false }, burns: NO_BURNS }, ['ASCENT'], { recommendAscent: true, recommendBurns: false }, 'learning.surfaceLaunch'),
});
const STAY_IN_ORBIT = resolve({
 ...common('STAY_IN_ORBIT', 'CUBESAT_3U', 400, 2 * 86400, EARTH_EPOCH, 13, { requiredPartIds: [], minRecordingMB: 0, minLinkKbps: 0 }, []),
 start: surface(['LV_SMALL_ORBITAL']), trajectory: patched(['EARTH'], false, 0),
 objectives: [earthOrbit('STAY_IN_ORBIT.orbit', { kind: 'BOUND_ORBIT', body: 'EARTH', periapsisAltKm: { min: 170, max: 600 }, apoapsisAltKm: { min: 170, max: 1500 }, minSafePeriapsisAltKm: 150 }, 5400)],
 learning: learning('STAY_IN_ORBIT', 'ASCENT', { parts: CUBESAT_STARTER, rideId: null, orbit: null, launcherId: 'LV_SMALL_ORBITAL', program: ASCENT_SMALL, burns: NO_BURNS }, ['ASCENT', 'LAUNCHER'], { recommendAscent: true, recommendBurns: false }, 'learning.surfaceLaunch'),
});
const SMALL_ORBIT_TARGET = (id: string, lo: number, hi: number): ObjectiveDef => earthOrbit(id, { kind: 'BOUND_ORBIT', body: 'EARTH', periapsisAltKm: { min: lo, max: hi }, apoapsisAltKm: { min: lo, max: hi }, minSafePeriapsisAltKm: 200 }, 600);
const SMALLSAT_WITH_PROP = withParts(SMALLSAT_STARTER, { partId: 'SS_PROP_BI', qty: 1, propellantKg: 20 });
const LEO_SMALL = makeOrbit('EARTH', 420, 420, 51.6, EARTH_EPOCH);
const RAISE_YOUR_ORBIT = resolve({
 ...common('RAISE_YOUR_ORBIT', 'SMALLSAT', 1400, 2 * 86400, EARTH_EPOCH, 17, { requiredPartIds: ['SS_PROP_BI'], minRecordingMB: 0, minLinkKbps: 0 }, ['RIDE_SMALL_LAUNCHER']),
 start: providedLeo(LEO_SMALL, EARTH_EPOCH), trajectory: patched(['EARTH'], true, 4),
 objectives: [SMALL_ORBIT_TARGET('RAISE_YOUR_ORBIT.orbit', 760, 840), objective('RAISE_YOUR_ORBIT.propellant', 'SPACECRAFT', { kind: 'PROPELLANT_RESERVE', inventory: 'SPACECRAFT', minKg: 0.5 }, { required: false })],
 learning: learning('RAISE_YOUR_ORBIT', 'ORBIT', { parts: SMALLSAT_WITH_PROP, rideId: 'RIDE_SMALL_LAUNCHER', orbit: orbitAt(LEO_SMALL, EARTH_EPOCH), launcherId: null, program: null, burns: NO_BURNS }, ['BURNS', 'PROPELLANT'], { recommendAscent: false, recommendBurns: true }, 'learning.providedParkingOrbit'),
});
const LEAVE_ORBIT_SAFELY = resolve({
 ...common('LEAVE_ORBIT_SAFELY', 'SMALLSAT', 1400, 2 * 86400, EARTH_EPOCH, 19, { requiredPartIds: ['SS_PROP_BI'], minRecordingMB: 0, minLinkKbps: 0 }, ['RIDE_SMALL_LAUNCHER']),
 start: providedLeo(LEO_SMALL, EARTH_EPOCH), trajectory: patched(['EARTH'], true, 4),
 objectives: [objective('LEAVE_ORBIT_SAFELY.entry', 'LAUNCH_ORBIT', { kind: 'ENTRY_INTERFACE', body: 'EARTH', altitudeKm: 100 })],
 learning: learning('LEAVE_ORBIT_SAFELY', 'ORBIT', { parts: SMALLSAT_WITH_PROP, rideId: 'RIDE_SMALL_LAUNCHER', orbit: orbitAt(LEO_SMALL, EARTH_EPOCH), launcherId: null, program: null, burns: NO_BURNS }, ['BURNS', 'PROPELLANT'], { recommendAscent: false, recommendBurns: true }, 'learning.providedParkingOrbit'),
});
/**
 * Parking orbit with its upper stage attached. Offline two-body search (Moon: moon.ts, transfer apogee at 384400 km, burn 1200 s after epoch):
 * RAAN 6.0745 deg puts the Moon in the 28.5 deg plane at arrival (declination -7.1 deg), true anomaly 83.573 deg puts the craft opposite it at burn time.
 * EARTH_TO_MOON launches due east from 28.5 deg N, so its plane has RAAN = pad right ascension - 90 deg; launch 03:16:00Z makes that plane contain the Moon
 * ~5 d later (residual 0.02 deg, declination -6.5 deg). The recommendation search, not these numbers, finalises the aim.
 */
export const MOON_WINDOW = { epochUTC: '2026-11-14T00:00:00Z', parkingRaanDeg: 6.0745, parkingArgPeriapsisDeg: 0, parkingTrueAnomalyDeg: 83.573, launchEpochUTC: '2026-11-14T03:16:00Z' } as const;
const STAGE_PARKING = makeOrbit('EARTH', 200, 200, 28.5, MOON_WINDOW.epochUTC);
const PARKING = { ...STAGE_PARKING, raanDeg: MOON_WINDOW.parkingRaanDeg, argPeriapsisDeg: MOON_WINDOW.parkingArgPeriapsisDeg, trueAnomalyDeg: MOON_WINDOW.parkingTrueAnomalyDeg };
const STAGE_LOAD = { launcherId: 'LV_LUNAR', propellantKg: 7000 };
const PAST_EARTH = resolve({
 ...common('PAST_EARTH', 'SMALLSAT', 1400, 3 * 86400, MOON_WINDOW.epochUTC, 23, { requiredPartIds: [], minRecordingMB: 0, minLinkKbps: 0 }, [PARKING_STAGE_RIDE]),
 start: providedLeo(PARKING, MOON_WINDOW.epochUTC, STAGE_LOAD), trajectory: patched(['EARTH'], true, 4),
 objectives: [earthOrbit('PAST_EARTH.escape', { kind: 'ESCAPE', body: 'EARTH', minPeriapsisAltKm: 160, minExcessSpeedKms: 0.3 })],
 learning: learning('PAST_EARTH', 'ORBIT', { parts: SMALLSAT_STARTER, rideId: PARKING_STAGE_RIDE, orbit: orbitAt(PARKING, MOON_WINDOW.epochUTC), launcherId: null, program: null, burns: NO_BURNS }, ['BURNS'], { recommendAscent: false, recommendBurns: true }, 'learning.providedParkingOrbitStage'),
});
const MEET_THE_MOON = resolve({
 ...common('MEET_THE_MOON', 'SMALLSAT', 1400, 8 * 86400, MOON_WINDOW.epochUTC, 29, { requiredPartIds: [], minRecordingMB: 0, minLinkKbps: 0 }, [PARKING_STAGE_RIDE], true),
 start: providedLeo(PARKING, MOON_WINDOW.epochUTC, STAGE_LOAD), trajectory: patched(['EARTH', 'MOON'], true, 6),
 objectives: [objective('MEET_THE_MOON.encounter', 'LAUNCH_ORBIT', { kind: 'ENCOUNTER_DISTANCE', body: 'MOON', minDistanceKm: 3000, maxDistanceKm: 30000 })],
 learning: learning('MEET_THE_MOON', 'LUNAR', { parts: SMALLSAT_STARTER, rideId: PARKING_STAGE_RIDE, orbit: orbitAt(PARKING, MOON_WINDOW.epochUTC), launcherId: null, program: null, burns: NO_BURNS }, ['BURNS'], { recommendAscent: false, recommendBurns: true }, 'learning.providedParkingOrbitStage'),
});
const E2M_PARTS = withParts(SMALLSAT_STARTER, { partId: 'SS_PROP_BI', qty: 1, propellantKg: 40 }, { partId: 'SS_MAPPER', qty: 1 });
const EARTH_TO_MOON = resolve({
 ...common('EARTH_TO_MOON', 'SMALLSAT', 2600, 14 * 86400, MOON_WINDOW.launchEpochUTC, 31, { requiredPartIds: ['SS_MAPPER', 'SS_PROP_BI'], minRecordingMB: 200, minLinkKbps: 100 }, [], true),
 start: surface(['LV_LUNAR']), trajectory: patched(['EARTH', 'MOON'], true, 8),
 objectives: [
  objective('EARTH_TO_MOON.orbit', 'LAUNCH_ORBIT', { kind: 'BOUND_ORBIT', body: 'MOON', periapsisAltKm: { min: 30, max: 500 }, apoapsisAltKm: { min: 30, max: 4000 }, minSafePeriapsisAltKm: 15 }, { dwellSec: 14400 }),
  objective('EARTH_TO_MOON.product', 'SCIENCE', { kind: 'DELIVERED_PRODUCT', metric: 'MAPS', targetMB: 200 }),
 ],
 learning: learning('EARTH_TO_MOON', 'LUNAR', { parts: E2M_PARTS, rideId: null, orbit: null, launcherId: 'LV_LUNAR', program: ASCENT_LUNAR, burns: NO_BURNS }, ['PARTS', 'PROPELLANT', 'ASCENT', 'BURNS'], { recommendAscent: true, recommendBurns: true }, 'learning.surfaceLaunch'),
});

/** Stable display order: authored presets first, then the learning ladder in teaching order. */
export const BUILTIN_DEFINITIONS: readonly ResolvedMissionDefinition[] = [FIRST_LIGHT, STORM_WATCH, RED_RELAY, CREW_PATHFINDER, SUN_SENTINEL, FIRST_SIGNAL, UP_AND_BACK, STAY_IN_ORBIT, RAISE_YOUR_ORBIT, LEAVE_ORBIT_SAFELY, PAST_EARTH, MEET_THE_MOON, EARTH_TO_MOON];
export const BUILTIN_BY_ID: Readonly<Record<BuiltinMissionId, ResolvedMissionDefinition>> = Object.fromEntries(BUILTIN_DEFINITIONS.map(d => [d.id, d])) as Record<BuiltinMissionId, ResolvedMissionDefinition>;
