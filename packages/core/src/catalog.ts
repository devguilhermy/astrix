import type { BodyId, BusId, Design, OrbitChoice, OrbitPreset, PartDef, Q, RideDef, SourceRef } from './contracts';
import { EXTRA_SOURCES, RADLAB_PROFILE } from '@astrix/data';
import { assumed, DAY, sourced, makeOrbit, orbitAltitudes } from './physics';
import { ENGINEERING, LEVELS, THERMAL_MODELS } from './models';
import { BUILTIN_DEFINITIONS } from './mission/builtins';
import { LAUNCHERS } from './flight/launchers';
import { SOLAR_ORBIT_PRESETS } from './mission/solarOrbits';

const a = (v: number): Q => assumed(v, 'Authored gameplay hardware abstraction, not a flight-qualified manufacturer specification; units follow the catalogue.');
export const BUSES = {
 CUBESAT_3U: { massKg: sourced(4, 'cubesat101', 'Strictly below 4 kg for this 3U class'), volume: a(3), structureMassKg: a(0.35), cost: a(10) },
 CREW_CAPSULE: { massKg: a(15000), volume: a(100), structureMassKg: a(10000), cost: a(500) },
 SMALLSAT: { massKg: sourced(180, 'nasa-smallsat', 'Strictly below 180 kg classification used as game class limit'), volume: a(8), structureMassKg: a(30), cost: a(60) },
} as const;
export const MODEL = {
 usableDepth: assumed(0.4, 'Battery usable planning depth; simulation tracks the full physical capacity.'),
 propellantCostPerKg: assumed(0.2, 'Budget-unit cost per kg of propellant, charged in addition to dry engine hardware.'),
 captureMargin: assumed(1.1, 'Fuel planning includes 10% capture delta-v margin; the arrival burn uses its exact computed requirement.'),
 sunDuty: assumed(0.6, 'Forecast plan: 60% SUN, 30% TARGET, 10% EARTH. Actual commands, not this forecast, fly the mission.'),
 targetDuty: assumed(0.3, 'Forecast observing duty fraction.'), earthDuty: assumed(0.1, 'Forecast directional downlink duty fraction.'),
 stationLat: assumed(38, 'Single mid-latitude station latitude in degrees north.'), stationLon: assumed(-75, 'Single station longitude in degrees east.'), minElevation: assumed(10, 'Station contact minimum elevation in degrees.'),
 dsnHours: assumed(8, 'Mars antenna allocation per Earth day; geometry also tests planetary occultation.'),
 upsetThreshold: assumed(50, 'Teaching alert threshold in µGy/h; no instrument-loss probability is inferred from dose.'),
 marsStormDose: assumed(120, 'Assumed orbital µGy/h during the Mars storm; the NASA Curiosity surface total is not used as an orbital rate.'),
 marsBackground: assumed(10, 'Assumed Mars-orbit background µGy/h; no calibrated orbital dataset is claimed.'),
 sunBackground: assumed(20, 'Assumed interplanetary background µGy/h for a Sun-centred craft, the order of cruise-phase dosimeter readings; held constant with distance from the Sun, and no calibrated dataset is claimed.'),
 marsStormDay: assumed(10, 'Mars storm begins ten operational days after capture; historical CME is narrative context only.'), marsStormHours: assumed(24, 'Assumed Mars storm duration.'),
 batteryAgingFraction: assumed(0.1, 'Scheduled capacity loss is 10%, an engineering-game event, not a fitted aging law.'), agingDayFraction: assumed(0.6, 'Aging event at 60% of mission duration, with seeded ±10 percentage points.'), outageHours: assumed(6, 'One scripted six-hour ground outage for Earth missions.'),
 brownoutFatalHours: assumed(12, 'A continuous depleted-battery interval of twelve hours is fatal.'), batteryLowPct: assumed(20, 'Auto-pause on downward crossing of 20% remaining charge.'), storageWarningPct: assumed(90, 'Auto-pause on upward crossing of 90% storage occupancy.'),
 fixedStepSec: assumed(10, 'Maximum physics substep in seconds.'), maxFrameSteps: assumed(400, 'Per-call fixed-step work cap; oversized requests emit WARP_LIMITED.'), forecastStepSec: assumed(30, 'One-day forecast sampling interval in seconds.'), historyEverySec: assumed(600, 'Telemetry history sampling interval in simulated seconds.'), historyCap: assumed(4096, 'Bounded telemetry history samples.'),
 healthThreshold: assumed(0.2, 'Healthy time requires battery at least 20% charged and no current fatal condition.'),
 scoreObjective: assumed(0.45, 'Mission objective score weight.'), scoreEfficiency: assumed(0.15, 'Unspent game budget score weight.'), scoreHealth: assumed(0.2, 'Healthy operational time score weight.'), scoreMargins: assumed(0.1, 'Time without modeled operational margin warnings score weight.'), scoreTeam: assumed(0.1, 'Role sign-off and design-review collaboration score weight.'), starStep: assumed(20, 'Star boundaries: 20, 40, 60, 80, 95 points.'), fiveStars: assumed(95, 'Five-star threshold.'),
 cueCooldownSec: assumed(30, 'Minimum time between separate raises of a coaching cue.'), cueClearSec: assumed(5, 'Coaching cue clearing hysteresis.'),
} as const;

type PartExtras = Pick<PartDef, 'txPowerW' | 'generationW' | 'capacityWh' | 'storageMB' | 'rateKbps' | 'ispSec' | 'tankKg' | 'finePointing' | 'directional' | 'requiresTarget' | 'requiresLight' | 'metric' | 'heaterW' | 'slewRateDegSec' | 'accuracyDeg' | 'coneHalfAngleDeg' | 'beamHalfAngleDeg' | 'radiatorM2'>;
function part(id: string, busId: BusId, category: PartDef['category'], volume: number, mass: number, power: number, cost: number, extras: Partial<PartExtras> = {}): PartDef {
 const role = category === 'INSTRUMENT' || category === 'STORAGE' ? 'SCIENCE' : category === 'RADIO' ? 'GROUND_COMMS' : 'SPACECRAFT';
 return { id, busId, category, role, nameKey: `part.${id}.name`, descKey: `part.${id}.desc`, unique: ['COMPUTER', 'ADCS', 'PROPULSION'].includes(category), volume: a(volume), massKg: a(mass), powerW: a(power), cost: a(cost), ...extras };
}
export const PARTS: readonly PartDef[] = [
 part('EPS_BATT_20', 'CUBESAT_3U', 'BATTERY', .2, .15, .2, 6, { capacityWh: a(20) }),
 part('BATT_40', 'CUBESAT_3U', 'BATTERY', .3, .3, 0, 6, { capacityWh: a(40) }),
 part('SOLAR_BODY', 'CUBESAT_3U', 'SOLAR', 0, .15, 0, 5, { generationW: a(7) }),
 part('SOLAR_WINGS', 'CUBESAT_3U', 'SOLAR', 0, .3, 0, 14, { generationW: a(20) }),
 part('OBC', 'CUBESAT_3U', 'COMPUTER', .2, .1, .5, 5, { storageMB: a(2000) }),
 part('STORAGE_32G', 'CUBESAT_3U', 'STORAGE', .1, .05, .2, 4, { storageMB: a(32000) }),
 part('ADCS_MAG', 'CUBESAT_3U', 'ADCS', .3, .2, .6, 6, { slewRateDegSec: a(.5), accuracyDeg: a(8) }),
 part('ADCS_WHEELS', 'CUBESAT_3U', 'ADCS', .5, .6, 2, 18, { finePointing: true, slewRateDegSec: a(3), accuracyDeg: a(.5) }),
 part('RADIO_UHF', 'CUBESAT_3U', 'RADIO', .1, .1, 1, 4, { txPowerW: a(4), rateKbps: a(9.6) }),
 part('RADIO_SBAND', 'CUBESAT_3U', 'RADIO', .2, .2, 1, 15, { txPowerW: a(8), rateKbps: a(1000), directional: true, beamHalfAngleDeg: a(25) }),
 part('CAM_EO', 'CUBESAT_3U', 'INSTRUMENT', .5, .4, 3, 20, { rateKbps: a(2000), requiresTarget: true, requiresLight: true, metric: 'IMAGES', coneHalfAngleDeg: a(15) }),
 part('RAD_MON', 'CUBESAT_3U', 'INSTRUMENT', .2, .2, .5, 8, { rateKbps: a(1), metric: 'RADIATION_HOURS' }),
 part('MAG', 'CUBESAT_3U', 'INSTRUMENT', .1, .1, .3, 4, { rateKbps: a(.5) }),
 part('SS_BATT_300', 'SMALLSAT', 'BATTERY', 1, 3, .5, 15, { capacityWh: a(300) }),
 part('SS_SOLAR_400', 'SMALLSAT', 'SOLAR', 0, 8, 0, 40, { generationW: a(400) }),
 part('SS_SOLAR_800', 'SMALLSAT', 'SOLAR', 0, 15, 0, 75, { generationW: a(800) }),
 part('SS_OBC', 'SMALLSAT', 'COMPUTER', 1, 2, 8, 20, { storageMB: a(64000) }),
 part('SS_ADCS', 'SMALLSAT', 'ADCS', 1, 10, 20, 50, { finePointing: true, slewRateDegSec: a(1), accuracyDeg: a(.5) }),
 part('SS_PROP_MONO', 'SMALLSAT', 'PROPULSION', 1, 6, 5, 40, { ispSec: a(220), tankKg: a(120) }),
 part('SS_PROP_BI', 'SMALLSAT', 'PROPULSION', 2, 12, 10, 90, { ispSec: a(320), tankKg: a(150) }),
 part('SS_XBAND', 'SMALLSAT', 'RADIO', 1, 5, 10, 70, { txPowerW: a(60), rateKbps: a(2000), directional: true, beamHalfAngleDeg: a(12) }),
 part('SS_UHF_RELAY', 'SMALLSAT', 'RADIO', 1, 3, 10, 25, { txPowerW: a(10), rateKbps: a(256) }),
 part('SS_MAPPER', 'SMALLSAT', 'INSTRUMENT', 1, 6, 15, 80, { rateKbps: a(8000), requiresTarget: true, requiresLight: true, metric: 'MAPS', coneHalfAngleDeg: a(10) }),
 part('SS_RAD', 'SMALLSAT', 'INSTRUMENT', 1, 2, 3, 15, { rateKbps: a(2), metric: 'RADIATION_HOURS' }),
 part('CREW_BATTERY', 'CREW_CAPSULE', 'BATTERY', 3, 150, 0, 100, { capacityWh: a(8000) }),
 part('CREW_SOLAR', 'CREW_CAPSULE', 'SOLAR', 2, 300, 0, 150, { generationW: a(5000) }),
 part('CREW_COMPUTER', 'CREW_CAPSULE', 'COMPUTER', 1, 50, 250, 100, { storageMB: a(32000) }),
 part('CREW_ADCS', 'CREW_CAPSULE', 'ADCS', 1, 100, 200, 100, { finePointing: true, slewRateDegSec: a(.75), accuracyDeg: a(1) }),
 part('CREW_RADIO', 'CREW_CAPSULE', 'RADIO', 1, 50, 100, 100, { txPowerW: a(200), rateKbps: a(1000) }),
 part('CREW_OBSERVER', 'CREW_CAPSULE', 'INSTRUMENT', 1, 30, 100, 100, { rateKbps: a(1000), metric: 'IMAGES', requiresTarget: true, requiresLight: true, coneHalfAngleDeg: a(20) }),
 part('CREW_SUPPORT', 'CREW_CAPSULE', 'THERMAL', 5, 400, 500, 200),
 part('CREW_HEATER', 'CREW_CAPSULE', 'THERMAL', 1, 50, 0, 50, { heaterW: a(1500) }),
 part('CREW_PROPULSION', 'CREW_CAPSULE', 'PROPULSION', 5, 300, 0, 200, { ispSec: a(320), tankKg: a(1000) }),
 part('DEPLOY_MITIGATION', 'CUBESAT_3U', 'THERMAL', .1, .08, 0, 8),
 part('HEATER_6', 'CUBESAT_3U', 'THERMAL', .1, .08, 0, 7, { heaterW: a(6) }),
 part('SS_HEATER_60', 'SMALLSAT', 'THERMAL', .25, 1, 0, 18, { heaterW: a(60) }),
 part('SS_RADIATOR', 'SMALLSAT', 'THERMAL', 0, 2, 0, 25, { radiatorM2: a(.05) }),
];
export const PART_BY_ID: Readonly<Record<string, PartDef>> = Object.fromEntries(PARTS.map(p => [p.id, p]));
const EARTH_EPOCH = '2026-11-14T00:00:00Z';
export const LEO_ORBITS: readonly OrbitChoice[] = [makeOrbit('EARTH', 420, 420, 51.6, EARTH_EPOCH), makeOrbit('EARTH', 500, 500, 45, EARTH_EPOCH), makeOrbit('EARTH', 550, 550, 97, EARTH_EPOCH)];
export const CAPTURE_ORBITS: readonly OrbitChoice[] = [400, 5000, 10000, 33000].map(ha => makeOrbit('MARS', 400, ha, 0, EARTH_EPOCH));
export const RIDES: readonly RideDef[] = [
 { id: 'RIDE_CREW', nameKey: 'ride.RIDE_CREW.name', descKey: 'ride.RIDE_CREW.desc', busIds: ['CREW_CAPSULE'], body: 'EARTH', cost: a(300), fixedOrbits: [LEO_ORBITS[0]] },
 { id: 'RIDE_CUBESAT_DISPENSER', nameKey: 'ride.RIDE_CUBESAT_DISPENSER.name', descKey: 'ride.RIDE_CUBESAT_DISPENSER.desc', busIds: ['CUBESAT_3U'], body: 'EARTH', cost: a(20), fixedOrbits: LEO_ORBITS },
 { id: 'RIDE_SMALL_LAUNCHER', nameKey: 'ride.RIDE_SMALL_LAUNCHER.name', descKey: 'ride.RIDE_SMALL_LAUNCHER.desc', busIds: ['CUBESAT_3U', 'SMALLSAT'], body: 'EARTH', cost: a(60) },
 { id: 'RIDE_LEO_STAGE', nameKey: 'ride.RIDE_LEO_STAGE.name', descKey: 'ride.RIDE_LEO_STAGE.desc', busIds: ['CUBESAT_3U', 'SMALLSAT'], body: 'EARTH', cost: a(50), fixedOrbits: [makeOrbit('EARTH', 200, 200, 28.5, EARTH_EPOCH)] },
 { id: 'RIDE_MARS_TRANSFER', nameKey: 'ride.RIDE_MARS_TRANSFER.name', descKey: 'ride.RIDE_MARS_TRANSFER.desc', busIds: ['SMALLSAT'], body: 'MARS', cost: a(300), fixedOrbits: CAPTURE_ORBITS },
 { id: 'RIDE_SOLAR_ORBIT', nameKey: 'ride.RIDE_SOLAR_ORBIT.name', descKey: 'ride.RIDE_SOLAR_ORBIT.desc', busIds: ['SMALLSAT'], body: 'SUN', cost: a(300), fixedOrbits: SOLAR_ORBIT_PRESETS.map(p => p.orbit) },
];
export const STATIONS = [{ id: 'GS_MIDLAT', latitudeDeg: MODEL.stationLat, longitudeDeg: MODEL.stationLon, minElevationDeg: MODEL.minElevation }, { id: 'DSN', hoursPerDay: MODEL.dsnHours }] as const;
export function rideCost(ride: RideDef, bus: BusId): number { return ride.id === 'RIDE_SMALL_LAUNCHER' && bus === 'SMALLSAT' ? 250 : ride.cost.v; }
export const listParts = (bus: BusId): readonly PartDef[] => PARTS.filter(p => p.busId === bus);
export const listRides = (bus: BusId, body: BodyId): readonly RideDef[] => RIDES.filter(r => r.busIds.includes(bus) && r.body === body).map(r => r.id === 'RIDE_SMALL_LAUNCHER' && bus === 'SMALLSAT' ? { ...r, cost: a(250) } : r);
export const captureOrbits = (): readonly OrbitChoice[] => CAPTURE_ORBITS;

export function listOrbitPresets(design: Design): readonly OrbitPreset[] {
 const start = design.definition.start, epoch = design.orbit?.epochUTC ?? design.definition.environment.epochUTC;
 if (start.kind !== 'PROVIDED_ORBIT') return [];
 if (start.body === 'MARS') return CAPTURE_ORBITS.map((orbit, i) => ({ id: ['MARS_CLOSE', 'MARS_INTERMEDIATE', 'MARS_BALANCED', 'MARS_WIDE'][i], titleKey: `orbit.${['MARS_CLOSE', 'MARS_INTERMEDIATE', 'MARS_BALANCED', 'MARS_WIDE'][i]}`, orbit: { ...orbit, epochUTC: epoch } }));
 // A mission's own heliocentric phase replaces the preset of the same shape, like the parking orbits below.
 if (start.body === 'SUN') return SOLAR_ORBIT_PRESETS.map(({ id, orbit }) => ({ id, titleKey: `orbit.${id}`, orbit: { ...(sameOrbit(orbit, start.orbit) ? start.orbit : orbit), epochUTC: epoch } }));
 const ride = RIDES.find(r => r.id === design.rideId), options = ride?.fixedOrbits ?? LEO_ORBITS;
 // A mission-specific parking orbit (plane, phase) replaces the ride's generic orbit of the same shape.
 const shaped = options.map(orbit => Math.abs(orbit.smaKm - start.orbit.smaKm) < 1e-6 && Math.abs(orbit.ecc - start.orbit.ecc) < 1e-9 && Math.abs(orbit.inclinationDeg - start.orbit.inclinationDeg) < 1e-6 ? start.orbit : orbit);
 const ids = ride?.fixedOrbits === LEO_ORBITS || !ride?.fixedOrbits ? ['LEO_420', 'LEO_500', 'LEO_550'] : shaped.map((_, i) => i === 0 ? 'PARKING' : `PARKING_${i + 1}`);
 return shaped.map((orbit, i) => ({ id: ids[i], titleKey: `orbit.${ids[i]}`, orbit: { ...orbit, epochUTC: epoch } }));
}

const source = (id: string, title: string, url: string, publisher: string, listedByChallenge = false): SourceRef => ({ id, title, url, publisher, retrieved: '2026-11-14', listedByChallenge });
export const SOURCES: readonly SourceRef[] = [
 ...(['earth', 'moon', 'mars', 'sun'] as const).map(p => source(`nssdc-${p}`, `NASA ${p[0].toUpperCase() + p.slice(1)} Fact Sheet`, `https://nssdc.gsfc.nasa.gov/planetary/factsheet/${p}fact.html`, 'NASA NSSDCA')),
 source('cubesat101', 'CubeSat 101: Basic Concepts and Processes for First-Time CubeSat Developers', 'https://www.nasa.gov/wp-content/uploads/2017/03/nasa_csli_cubesat_101_508.pdf', 'NASA CSLI', true),
 source('nasa-smallsat', 'What are SmallSats and CubeSats?', 'https://www.nasa.gov/smallsat-institute/what-are-smallsats-and-cubesats/', 'NASA'),
 source('design-develop', 'Design and Develop Science Missions', 'https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf', 'NASA', true),
 source('cml', 'Concept Maturity Levels', 'https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299', 'NASA JPL', true),
 source('mdl', 'Mission Design Lab', 'https://etd.gsfc.nasa.gov/capabilities/mission-design-lab/', 'NASA Goddard', true),
 source('gmat', 'General Mission Analysis Tool (independent validation resource, not a runtime dependency)', 'https://software.nasa.gov/software/GSC-19468-1', 'NASA', true),
 source('mission-viz', 'NASA Mission Viz', 'https://nasa.github.io/mission-viz/', 'NASA', true),
 source('webb-game', 'A Learning Game About Telescopes', 'https://science.nasa.gov/mission/webb/game-build-it-yourself/', 'NASA', true),
 source('csa-games', 'Digital Games and Activities', 'https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp', 'Canadian Space Agency', true),
 { ...source('radlab-iss-2024-05-10', 'ISS DosTel1 absorbed-dose-rate snapshot, 10–11 May 2024', RADLAB_PROFILE.url, 'NASA OSDR'), retrieved: RADLAB_PROFILE.retrieved },
 source('donki-cme-2024-05-20', 'DONKI CME 2024-05-20T05:36:00-CME-001', 'https://ccmc.gsfc.nasa.gov/DONKI/view/CME/31034/-1', 'NASA CCMC'),
 source('donki-gst-2024-05', 'DONKI geomagnetic storms, May 2024', 'https://ccmc.gsfc.nasa.gov/DONKI/WS/get/GST?startDate=2024-05-08&endDate=2024-05-14', 'NASA CCMC'),
 source('smallsat-thermal', 'State of the Art of Small Spacecraft Technology: Thermal Control', 'https://www.nasa.gov/smallsat-institute/sst-soa/thermal-control/', 'NASA'),
 source('smallsat-power', 'State of the Art of Small Spacecraft Technology: Power', 'https://www.nasa.gov/smallsat-institute/sst-soa/power-subsystems/', 'NASA'),
 source('smallsat-gnc', 'State of the Art of Small Spacecraft Technology: Guidance, Navigation and Control', 'https://www.nasa.gov/smallsat-institute/sst-soa/guidance-navigation-and-control/', 'NASA'),
 source('smallsat-comms', 'State of the Art of Small Spacecraft Technology: Communications', 'https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/', 'NASA'),
 source('smallsat-avionics', 'State of the Art of Small Spacecraft Technology: Avionics (archived chapter)', 'https://www.nasa.gov/smallsat-institute/sst-soa/small-spacecraft-avionics/', 'NASA'),
 ...EXTRA_SOURCES,
];
export const listSources = (): readonly SourceRef[] => SOURCES;
export function listAssumptions(): readonly { key: string; note: string; value: number | string }[] {
 const result: { key: string; note: string; value: number | string }[] = [];
 const walk = (value: unknown, key: string): void => {
  if (!value || typeof value !== 'object') return;
  if ('v' in value && 'p' in value) {
   const q = value as Q;
   if (q.p.kind === 'assumption') result.push({ key, note: q.p.note, value: q.v });
  } else for (const [k, v] of Object.entries(value)) walk(v, `${key}.${k}`);
 };
 walk(MODEL, 'model'); walk(BUSES, 'bus');  walk(ENGINEERING, 'engineering'); walk(THERMAL_MODELS, 'thermal'); walk(LEVELS, 'level');
 for (const p of PARTS) walk(p, `part.${p.id}`);
 for (const r of RIDES) walk(r, `ride.${r.id}`);
 for (const l of LAUNCHERS) walk(l.cost, `launcher.${l.id}.cost`);
 for (const d of BUILTIN_DEFINITIONS) {
  const k = `mission.${d.id}`;
  result.push({ key: `${k}.budget`, value: d.vehicle.budget, note: 'Authored game-budget units, adjusted to permit complete science loadouts at every difficulty; not dollars.' }, { key: `${k}.durationSec`, value: d.environment.durationSec, note: 'Authored mission duration; learning missions end earlier when every required objective is met.' }, { key: `${k}.epoch`, value: d.environment.epochUTC, note: 'Mission epoch is an authored time reference; STORM_WATCH aligns its replay with historical May 2024 timestamps; lunar missions use a launch window chosen so the reduced Moon lies in the transfer plane.' }, { key: `${k}.seed`, value: d.environment.seed, note: 'Authored deterministic mission seed.' });
  for (const o of d.objectives) result.push({ key: `${k}.objective.${o.id}`, value: JSON.stringify(o.spec), note: 'Authored objective threshold evaluated from physical state/delivered data; not a published mission requirement.' });
 }
 result.push({ key: 'model.twoBody', value: 'two-body', note: 'No J2, drag, third-body perturbations or penumbra. Thermal is a single-bus model in Expert only. Planet paths use reference radii in a common ecliptic plane, rotated into equatorial axes; Mars phase is an authored ideal transfer window.' }, { key: 'model.radiationReplay', value: 'ISS DosTel1 replay', note: 'The ISS hourly record is replayed at the chosen Earth orbit as an environment approximation. Co-occurrence with a DONKI storm does not attribute each reading to that storm. SAFE changes powered electronics, not dose or shielding; no irreversible random dose-derived loss is modeled.' }, { key: 'model.rides', value: 'authored delivery choices', note: 'Fixed rides offer 420 km/51.6°, 500 km/45°, 550 km/97°. A custom launcher offers circular Earth 350–800 km, inclination 0–98°. Mars capture offers 400 km periapsis, apoapsis 400/5000/10000/33000 km, zero inclination. The ride supplies departure delta-v. These are game choices, not actual launch offers.' }, { key: 'model.smallLauncherCost', value: 250, note: 'SmallSat custom launcher price in abstract budget units (CubeSat price is 60).' }, { key: 'model.daySec', value: DAY, note: 'Operational durations use Earth days of 86,400 seconds; Mars operational objective time begins after capture, separate from cruise.' });
 result.push(
  { key: 'model.solarEphemeris', value: 'low-precision equatorial Sun', note: 'Mean longitude/anomaly with first two equation-of-center harmonics and fixed 23.439° J2000 obliquity. Precession, nutation, aberration and Earth distance variation omitted; Mars is a circular ideal-transfer approximation, not a real-date ephemeris.' },
  { key: 'model.attitude', value: 'rate-limited quaternion', note: 'Body-to-MJ2000Eq quaternion: +X panel, +Z instrument/antenna. ADCS has paid part-specific rate and retained angular bias; holds track vectors with solar-optimal roll. No torque, inertia, wheel saturation, gimbal or propellant dynamics. Solar power uses positive panel-Sun cosine; instrument cone and directional cosine-power beam gate actual returns.' },
  { key: 'model.forecasts', value: 'bounded DEFAULT policy', note: 'Timeline: at most seven days and 4096 sample intervals per lane, transitions within 0.25 s when detected; narrower windows may be missed. Dry run: at most 90 operational days after analytical cruise, <=512 chart samples, ordinary transported commands and real failures. DEFAULT reviews every 60 s and after pauses, observes in sunlight, sends in contact, Sun otherwise, explicitly deploys and handles authored recovery; no uploaded autonomous plan is implied.' },
 );
 return result;
}

export function sameOrbit(a: OrbitChoice, b: OrbitChoice): boolean { return a.body === b.body && Math.abs(a.smaKm - b.smaKm) < 1e-6 && Math.abs(a.ecc - b.ecc) < 1e-9 && Math.abs(a.inclinationDeg - b.inclinationDeg) < 1e-6; }
/** Pure ride/orbit compatibility shared by design quotes and definition validation. */
export function rideOffersOrbit(rideId: string | null, bus: BusId, body: BodyId, orbit: OrbitChoice): boolean {
 const ride = RIDES.find(r => r.id === rideId);
 if (!ride || ride.body !== orbit.body || orbit.body !== body || !ride.busIds.includes(bus)) return false;
 if (orbit.frame !== 'MJ2000Eq' || !Number.isFinite(Date.parse(orbit.epochUTC)) || ![orbit.smaKm, orbit.ecc, orbit.inclinationDeg, orbit.raanDeg, orbit.argPeriapsisDeg, orbit.trueAnomalyDeg].every(Number.isFinite) || orbit.ecc < 0 || orbit.ecc >= 1) return false;
 if (ride.fixedOrbits) return ride.fixedOrbits.some(o => sameOrbit(o, orbit));
 const radius = orbitAltitudes(orbit);
 return orbit.body === 'EARTH' && radius.altitudeKm >= 350 && radius.altitudeKm <= 800 && Math.abs(radius.apoapsisAltitudeKm - radius.altitudeKm) < 1e-6 && orbit.inclinationDeg >= 0 && orbit.inclinationDeg <= 98;
}
