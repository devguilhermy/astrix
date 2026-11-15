import type { AttitudeTelemetry, PointingMode } from '../contracts';
import { PART_BY_ID } from '../catalog';
import { angleToDirectionDeg, attitudeDistance, attitudeTargetForDirection, biasedAttitude, slewAttitude } from '../attitude';
import { ENGINEERING } from '../models';
import { degrees, planetPosition, radians, type Vec3 } from '../physics';
import type { FlightState } from './state';

/** Craft-to-Earth-station direction in Earth-centred axes. For a lunar craft this is NOT the lunar nadir. */
export function earthDirection(s: FlightState): Vec3 {
 if (s.mars) {
  const e = planetPosition('EARTH',s.t,s.epochUTC), m = planetPosition('MARS',s.t,s.epochUTC);
  return [e[0]-m[0]-s.positionKm[0],e[1]-m[1]-s.positionKm[1],e[2]-m[2]-s.positionKm[2]];
 }
 return s.crew || !s.stationPosKm ? [-s.earthPosKm[0],-s.earthPosKm[1],-s.earthPosKm[2]] : [s.stationPosKm[0]-s.earthPosKm[0],s.stationPosKm[1]-s.earthPosKm[1],s.stationPosKm[2]-s.earthPosKm[2]];
}
export function holdTarget(s: FlightState, mode: PointingMode) {
 if (mode === 'TARGET') return attitudeTargetForDirection([-s.positionKm[0],-s.positionKm[1],-s.positionKm[2]],s.sunDir);
 if (mode === 'EARTH') return attitudeTargetForDirection(earthDirection(s),s.sunDir);
 // Construct a perpendicular boresight: the projected panel then points exactly at Sun.
 const z: Vec3 = Math.abs(s.sunDir[2]) < .9 ? [-s.sunDir[1],s.sunDir[0],0] : [0,-s.sunDir[2],s.sunDir[1]];
 return attitudeTargetForDirection(z,s.sunDir);
}
export function attitudeHardware(s: FlightState): { rate: number; accuracy: number } {
 const fallbackScale = s.pointing.faulted && s.pointing.reacquisitions > 0 ? ENGINEERING.fallbackAccuracyScale.v : 1;
 for (const item of s.design.parts) {
  const part = PART_BY_ID[item.partId];
  if (part.category === 'ADCS') return { rate: radians(part.slewRateDegSec!.v), accuracy: radians(part.accuracyDeg!.v * fallbackScale) };
 }
 return { rate: radians(.1), accuracy: radians(15 * fallbackScale) };
}
export function refreshAttitude(s: FlightState): void {
 if (s.attitude.hold !== 'MANUAL') s.attitude.target = holdTarget(s,s.attitude.hold);
 s.attitude.panelSunDeg = angleToDirectionDeg(s.attitude.q,[1,0,0],s.sunDir);
 s.attitude.instrumentTargetDeg = angleToDirectionDeg(s.attitude.q,[0,0,1],[-s.positionKm[0],-s.positionKm[1],-s.positionKm[2]]);
 s.attitude.antennaEarthDeg = angleToDirectionDeg(s.attitude.q,[0,0,1],earthDirection(s));
}
export function advanceAttitude(s: FlightState, dt: number): void {
 const hardware = attitudeHardware(s), before = s.attitude.q;
 const disabled = s.computerState !== 'RUNNING' || s.socWh <= 0 || s.pointing.state === 'REACQUIRING' || s.pointing.faulted && s.pointing.reacquisitions === 0;
 if (!disabled) s.attitude.q = slewAttitude(before,biasedAttitude(s.attitude.target,hardware.accuracy),hardware.rate*dt);
 s.attitude.rateRadSec = attitudeDistance(before,s.attitude.q)/dt;
 if (!disabled) {
  const remaining = Math.max(0,attitudeDistance(s.attitude.q,biasedAttitude(s.attitude.target,hardware.accuracy))-.001);
  s.pointing.state = remaining <= .001 ? 'SETTLED' : 'ACQUIRING';
  s.pointing.remainingSec = remaining/hardware.rate;
  s.pointing.quality = Math.max(0,Math.cos(hardware.accuracy));
 }
 refreshAttitude(s);
}
export function requestHold(s: FlightState, hold: PointingMode): void {
 s.mode = hold; s.pointing.requested = hold; s.attitude.hold = hold;
 refreshAttitude(s);
 s.pointing.state = 'ACQUIRING';
 s.pointing.remainingSec = degrees(attitudeDistance(s.attitude.q,s.attitude.target))/degrees(attitudeHardware(s).rate);
}
export function copyAttitude(a: AttitudeTelemetry): AttitudeTelemetry {
 return { ...a, q: [...a.q], target: [...a.target] };
}
