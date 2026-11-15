import { MODEL, scenarioById } from '../catalog';
import { isTechnical, stationAllocated } from '../models';
import { CONSTANTS, cylinderEclipse, inStationContact, marsLineOfSight, propagatePosition, stationPosition, sunDirection } from '../physics';
import type { FlightState } from './state';

/** Shared physical geometry only; forecast does not assume a future capture succeeds. */
export function environmentAt(s: FlightState, t: number) {
 const body = s.design.orbit!.body, epoch = s.design.orbit!.epochUTC;
 const positionKm = propagatePosition(s.elements,CONSTANTS[body].mu.v,s.captured ? Math.max(0,t-s.arrivalT) : 0);
 const sunDir = sunDirection(body,t,undefined,epoch);
 const sunlit = !cylinderEclipse(positionKm,sunDir,CONSTANTS[body].radius.v);
 const stationPosKm = body === 'EARTH' ? stationPosition(t,'EARTH',MODEL.stationLat.v,MODEL.stationLon.v,undefined,epoch) : null;
 const lineOfSight = !s.cruise && !s.capturePending && (!!s.crew || (body === 'EARTH' ? inStationContact(positionKm,stationPosKm!,MODEL.minElevation.v) : marsLineOfSight(positionKm,t,epoch)));
 const outageActive = body === 'EARTH' && t-s.arrivalT >= s.outageAt && t-s.arrivalT < s.outageAt+MODEL.outageHours.v*3600;
 const stationAvailable = !outageActive && (!!s.crew || !(isTechnical(s.design.levelId) || body === 'MARS') || stationAllocated(t,scenarioById(s.design.scenarioId).stationAllocationStartSec.v));
 return { positionKm, sunDir, sunlit, stationPosKm, lineOfSight, outageActive, stationAvailable, inContact: lineOfSight && stationAvailable };
}
