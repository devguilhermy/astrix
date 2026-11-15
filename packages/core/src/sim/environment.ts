import { MODEL } from '../catalog';
import { add } from '../flight/conic';
import { moonState, segmentHitsSphere } from '../flight/moon';
import { isTechnical, stationAllocated } from '../models';
import { CONSTANTS, cylinderEclipse, earthFromSunCraft, inStationContact, marsLineOfSight, stationPosition, sunDirectionAt, sunLineOfSight, type Vec3 } from '../physics';
import type { FlightState } from './state';
import { ascentActive, centralStateAt, moonModelled } from './trajectory';

/** Shared physical geometry only; forecast does not assume a future capture succeeds.
 * Mars and Sun-centred craft are deep-space cases: no single ground station, Deep Space Network allocation and line of sight to Earth.
 * For a Sun-centred craft `earthPosKm` is the craft relative to Earth's centre, so the Earth direction is `-earthPosKm`. */
export function environmentAt(s: FlightState, t: number) {
 const epoch = s.epochUTC, c = centralStateAt(s, t), body = c.body, sun = body === 'SUN', deep = s.mars || sun;
 const positionKm: Vec3 = [c.r[0], c.r[1], c.r[2]], velocityKms: Vec3 = [c.v[0], c.v[1], c.v[2]];
 const moon = body === 'MOON' || moonModelled(s) ? moonState(t, epoch) : null;
 const toEarth = sun ? earthFromSunCraft(positionKm, t, epoch) : null;
 const earthPosKm: Vec3 = body === 'MOON' && moon ? add(positionKm, moon.r) : toEarth ? [-toEarth[0], -toEarth[1], -toEarth[2]] : positionKm;
 const sunDir = sunDirectionAt(body, positionKm, t, epoch);
 // Nothing eclipses the Sun for a Sun-centred craft.
 const sunlit = sun || !cylinderEclipse(positionKm, sunDir, CONSTANTS[body].radius.v);
 const stationPosKm = deep ? null : stationPosition(t, 'EARTH', MODEL.stationLat.v, MODEL.stationLon.v, undefined, epoch);
 let geometric: boolean;
 if (s.mars) geometric = marsLineOfSight(positionKm, t, epoch);
 else if (sun) geometric = sunLineOfSight(positionKm, t, epoch);
 else {
  geometric = inStationContact(earthPosKm, stationPosKm!, MODEL.minElevation.v);
  // Finite segment/sphere occultation: the Moon only blocks when it lies between the station and the craft.
  if (geometric && moon) geometric = !segmentHitsSphere(stationPosKm!, earthPosKm, moon.r, CONSTANTS.MOON.radius.v);
 }
 const lineOfSight = !s.cruise && !s.capturePending && !ascentActive(s) && (!!s.crew || geometric);
 const outageActive = !deep && t - s.arrivalT >= s.outageAt && t - s.arrivalT < s.outageAt + MODEL.outageHours.v * 3600;
 const stationAvailable = !outageActive && (!!s.crew || !(isTechnical(s.design.levelId) || deep) || stationAllocated(t, s.design.definition.environment.stationAllocationStartSec));
 return { positionKm, velocityKms, earthPosKm, centralBody: body, sunDir, sunlit, stationPosKm, lineOfSight, outageActive, stationAvailable, inContact: lineOfSight && stationAvailable };
}
