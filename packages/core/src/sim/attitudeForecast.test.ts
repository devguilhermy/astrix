import { describe, expect, it } from 'bun:test';
import type { AttitudeQuaternion, SimState } from '../contracts';
import { PARTS, scenarioById } from '../catalog';
import { attitudeDistance, attitudeTargetForDirection, normalizeAttitude, rotateAttitudeVector, slewAttitude, antennaGain } from '../attitude';
import { CONSTANTS, DAY, cylinderEclipse, norm, radians, sunDirection } from '../physics';
import { RULES_VERSION } from '../models';
import { applyCommand, issueCommand } from './commands';
import { forecastMission, forecastTimeline } from './forecast';
import { environmentAt } from './environment';
import { attitudeHardware, refreshAttitude } from './attitude';
import { createSim, flight, generatedPowerW, transmittingRate } from './state';
import { telemetry } from './selectors';
import { skipCruise, stepSim } from './step';
import { accepted, advanceTo, referenceDesign } from './testSupport';

describe('rules-v4 physical attitude contracts', () => {
 it('has finite paid ADCS rates, errors, instrument cones and directional beam widths', () => {
  expect(RULES_VERSION).toBe(4);
  for (const p of PARTS) {
   if (p.category === 'ADCS') { expect(p.slewRateDegSec!.v).toBeGreaterThan(0); expect(p.accuracyDeg!.v).toBeGreaterThan(0); }
   if (p.requiresTarget) expect(p.coneHalfAngleDeg!.v).toBeGreaterThan(0);
   if (p.directional) expect(p.beamHalfAngleDeg!.v).toBeGreaterThan(0);
  }
  expect(() => createSim({ ...referenceDesign('FIRST_LIGHT'),rulesVersion: 3 },42)).toThrow();
 });
 it('normalizes serializable double-cover rotations and slews by the shortest bounded arc', () => {
  const target = normalizeAttitude([0,0,2,0]), start: AttitudeQuaternion = [0,0,0,1];
  expect(JSON.stringify(normalizeAttitude([0,0,-2,0]))).toBe(JSON.stringify(target));
  const next = slewAttitude(start,target,.2);
  expect(Math.hypot(...next)).toBeCloseTo(1,12);
  expect(attitudeDistance(start,next)).toBeCloseTo(.2,12);
  expect(attitudeDistance(next,target)).toBeCloseTo(Math.PI-.2,12);
  expect(() => normalizeAttitude([0,0,0,0])).toThrow();
  expect(() => normalizeAttitude([0,0,NaN,1])).toThrow();
 });
 it('maps body +Z to the requested line and +X to its solar-optimal perpendicular', () => {
  const q = attitudeTargetForDirection([0,1,0],[1,1,0]);
  const z = rotateAttitudeVector(q,[0,0,1]), x = rotateAttitudeVector(q,[1,0,0]);
  expect(z[1]).toBeCloseTo(1,12); expect(x[0]).toBeCloseTo(1,12);
  expect(antennaGain(0,25)).toBe(1); expect(antennaGain(25,25)).toBeCloseTo(.5,12); expect(antennaGain(100,25)).toBe(0);
 });
 it('projects actual panel power and actual antenna errors instead of mode fractions', () => {
  const s = flight(createSim(referenceDesign('FIRST_LIGHT'),42)); s.deployment.wings = 'DEPLOYED'; s.deployment.antenna = 'DEPLOYED';
  s.sunlit = true; s.sunDir = [1,0,0]; s.attitude.q = [0,0,0,1]; refreshAttitude(s);
  expect(generatedPowerW(s)).toBeCloseTo(s.ratedSolarW,12);
  s.attitude.q = normalizeAttitude([0,0,1,0]); refreshAttitude(s);
  expect(generatedPowerW(s)).toBe(0);
  s.sunlit = false; expect(generatedPowerW(s)).toBe(0);
  s.inContact = true; s.downlinkRequested = true; s.storedMB = 1;
  s.attitude.antennaEarthDeg = 0; const aligned = transmittingRate(s);
  s.attitude.antennaEarthDeg = 25; expect(transmittingRate(s)).toBeCloseTo(aligned/2,10);
  s.attitude.antennaEarthDeg = 100; expect(transmittingRate(s)).toBe(0);
 });
 it('collects target science only inside the actual instrument cone, including manual attitudes', () => {
  const s = flight(createSim(referenceDesign('FIRST_LIGHT'),42));
  s.deployment.wings = 'DEPLOYED'; s.sunlit = true;
  applyCommand(s,{ kind: 'INSTRUMENT',partId: 'CAM_EO',on: true },[]);
  s.attitude.q = attitudeTargetForDirection([-s.positionKm[0],-s.positionKm[1],-s.positionKm[2]],s.sunDir);
  s.attitude.target = s.attitude.q; s.attitude.hold = 'MANUAL'; refreshAttitude(s);
  const aligned = stepSim(s,10).state;
  expect(telemetry(aligned).storedMB).toBeGreaterThan(0);
  const off = structuredClone(s); off.attitude.q = attitudeTargetForDirection([...s.positionKm],s.sunDir); refreshAttitude(off);
  expect(telemetry(stepSim(off,10).state).storedMB).toBe(0);
 });
 it('keeps ground gestures contact-gated, coalesces only unsent actor-owned targets and copies telemetry', () => {
  const initial = flight(createSim(referenceDesign('FIRST_LIGHT'),42)); initial.inContact = false;
  expect(issueCommand(initial,{ kind: 'ATTITUDE_TARGET',q: [0,0,0,1] },'SCIENCE').ok).toBe(false);
  const first = accepted(issueCommand(initial,{ kind: 'ATTITUDE_TARGET',q: [0,0,0,1],gestureId: 'drag' },'SPACECRAFT',{ role: 'SPACECRAFT',playerId: 'one' }));
  const second = accepted(issueCommand(first,{ kind: 'ATTITUDE_TARGET',q: [0,1,0,1],gestureId: 'drag' },'SPACECRAFT',{ role: 'SPACECRAFT',playerId: 'one' }));
  expect(telemetry(second).queued).toBe(1);
  expect(telemetry(first).commandQueue[0].command).not.toEqual(telemetry(second).commandQueue[0].command);
  expect(telemetry(second).commandQueue[0].id).toBe(telemetry(first).commandQueue[0].id);
  const t = telemetry(second), q = t.commandQueue[0].command;
  if (q.kind === 'ATTITUDE_TARGET') (q.q as unknown as number[])[0] = 99;
  expect(telemetry(second).commandQueue[0].command).not.toEqual(q);
  expect(telemetry(second).attitude.q).toEqual(telemetry(initial).attitude.q);
  const other = accepted(issueCommand(second,{ kind: 'ATTITUDE_TARGET',q: [1,0,0,1],gestureId: 'drag' },'SPACECRAFT',{ role: 'SPACECRAFT',playerId: 'two' }));
  expect(telemetry(other).queued).toBe(2);
 });
 it('never rewrites a transmitted Mars target and includes propagation before slewing', () => {
  let state = skipCruise(createSim(referenceDesign('RED_RELAY'),42)).state;
  state = accepted(issueCommand(state,{ kind: 'CAPTURE_CONFIRM' },'ALL'));
  state = stepSim(state,0).state;
  const s = flight(state); s.inContact = true;
  const first = accepted(issueCommand(s,{ kind: 'ATTITUDE_TARGET',q: [0,0,0,1],gestureId: 'drag' },'ALL'));
  const before = telemetry(first).commandQueue.at(-1)!;
  expect(before.status).toBe('IN_TRANSIT'); expect(before.applyAt!).toBeGreaterThan(before.transmittedAt!);
  const second = accepted(issueCommand(first,{ kind: 'ATTITUDE_TARGET',q: [1,0,0,1],gestureId: 'drag' },'ALL'));
  expect(telemetry(second).commandQueue.find(q => q.id === before.id)).toEqual(before);
  expect(telemetry(second).attitude.q).toEqual(telemetry(s).attitude.q);
 });
 it('delivers crew manual targets and holds onboard outside ground contact, with finite actual slew', () => {
  const initial = flight(createSim(referenceDesign('CREW_PATHFINDER'),73)); initial.inContact = false;
  const state = accepted(issueCommand(initial,{ kind: 'ATTITUDE_TARGET',q: [1,0,0,1] },'SPACECRAFT'));
  expect(telemetry(state).commandQueue.at(-1)).toMatchObject({ transport: 'ONBOARD',status: 'DELIVERED',issuedAt: 0,applyAt: 0 });
  expect(telemetry(state).attitude.q).toEqual(initial.attitude.q);
  const next = advanceTo(state,10), actual = attitudeDistance(initial.attitude.q,telemetry(next).attitude.q);
  expect(actual).toBeGreaterThan(0); expect(actual).toBeLessThanOrEqual(attitudeHardware(initial).rate*10+1e-8);
  const hold = accepted(issueCommand(next,{ kind: 'POINT',mode: 'TARGET' },'SPACECRAFT'));
  expect(telemetry(hold).attitude.hold).toBe('TARGET'); expect(telemetry(hold).commandQueue.at(-1)?.transport).toBe('ONBOARD');
 });
 it('replays JSON-roundtripped manual commands identically across frame partitions', () => {
  const cmd = { kind: 'ATTITUDE_TARGET' as const,q: [1,1,0,1] as const,gestureId: 'key' };
  const initial = createSim(referenceDesign('CREW_PATHFINDER'),73);
  const a = accepted(issueCommand(initial,cmd,'ALL')), b = accepted(issueCommand(structuredClone(initial),JSON.parse(JSON.stringify(cmd)),'ALL'));
  let small: SimState = a;
  for (let n = 0; n < 120; n++) small = stepSim(small,1).state;
  expect(small).toEqual(advanceTo(b,120));
 });
});

describe('solar ephemeris and physical bounded forecasts', () => {
 it('places the J2000 Sun near RA 281.3°, declination −23.0° and seasonal declinations', () => {
  const sun = sunDirection('EARTH',0,undefined,'2000-01-01T12:00:00Z');
  expect(norm(sun)).toBeCloseTo(1,12);
  expect(Math.atan2(sun[1],sun[0])*180/Math.PI+360).toBeCloseTo(281.3,0);
  expect(Math.asin(sun[2])*180/Math.PI).toBeCloseTo(-23.0,0);
  const summer = sunDirection('EARTH',0,undefined,'2026-06-21T12:00:00Z');
  const winter = sunDirection('EARTH',0,undefined,'2026-12-21T12:00:00Z');
  expect(summer[2]).toBeGreaterThan(Math.sin(radians(23))); expect(winter[2]).toBeLessThan(-Math.sin(radians(23)));
 });
 it('matches simulation eclipse/contact geometry at every interior sample without mutation', () => {
  const state = createSim(referenceDesign('FIRST_LIGHT'),42), before = structuredClone(state), s = flight(state);
  const result = forecastTimeline(state,DAY);
  for (let t = 20; t < DAY; t += 40) {
   const e = environmentAt(s,t), has = (kind: string) => result.windows.some(w => w.kind === kind && t > w.startSec+.3 && t < w.endSec-.3);
   const near = result.windows.some(w => Math.abs(t-w.startSec)<.3 || Math.abs(t-w.endSec)<.3);
   if (near) continue;
   expect(has('ECLIPSE')).toBe(cylinderEclipse(e.positionKm,e.sunDir,CONSTANTS.EARTH.radius.v));
   expect(has('CONTACT')).toBe(e.inContact); expect(has('SUNLIGHT')).toBe(e.sunlit);
  }
  expect(state).toEqual(before);
  expect(forecastTimeline(state,100*DAY).endSec).toBe(7*DAY);
  expect(() => forecastTimeline(state,Infinity)).toThrow();
 });
 it('never invents data or terminal success for a zero-duration dry run', () => {
  const design = referenceDesign('FIRST_LIGHT'), before = structuredClone(design);
  const result = forecastMission(design,'DEFAULT',0);
  expect(result).toMatchObject({ outcome: 'INCOMPLETE',objectiveValue: 0,endedAtSec: 0 });
  expect(result.samples).toHaveLength(1); expect(result.samples[0].storedMB).toBe(0); expect(result.samples[0].downlinkedMB).toBe(0);
  expect(design).toEqual(before);
 });
 it('forecasts identical finite physical samples and returns explicit incomplete at a partial horizon', () => {
  const d = referenceDesign('FIRST_LIGHT');
  const a = forecastMission(d,'DEFAULT',3600), b = forecastMission(structuredClone(d),'DEFAULT',3600);
  expect(a).toEqual(b); expect(a.outcome).toBe('INCOMPLETE'); expect(a.samples.length).toBeLessThanOrEqual(512);
  for (const s of a.samples) { expect(s.socWh).toBeGreaterThanOrEqual(0); expect(s.storedMB).toBeGreaterThanOrEqual(0); expect(Number.isFinite(s.downlinkedMB)).toBe(true); }
 });
 for (const level of ['ASPIRING','EXPERT'] as const) for (const scenario of ['FIRST_LIGHT','STORM_WATCH','RED_RELAY','CREW_PATHFINDER'] as const) {
  it(`${scenario} ${level} dry run reaches a real whole-mission outcome within physical bounds`, () => {
   const d = referenceDesign(scenario,level), target = scenarioById(scenario);
   const result = forecastMission(d,'DEFAULT',target.durationDays.v*DAY);
   expect(result.outcome).not.toBe('INCOMPLETE');
   expect(result.samples.length).toBeLessThanOrEqual(512);
   expect(result.objectiveTarget).toBe(target.target.v);
   for (const s of result.samples) {
    expect(Number.isFinite(s.t+s.socWh+s.storedMB+s.downlinkedMB)).toBe(true);
    expect(s.socWh).toBeGreaterThanOrEqual(0); expect(s.storedMB).toBeGreaterThanOrEqual(0); expect(s.downlinkedMB).toBeGreaterThanOrEqual(0);
   }
   if (result.outcome === 'SUCCESS') expect(result.objectiveValue).toBeGreaterThanOrEqual(result.objectiveTarget);
   if (scenario === 'CREW_PATHFINDER' && level === 'ASPIRING') {
    expect(result.outcome).toBe('SUCCESS');
    expect(result.endedAtSec).toBe(target.durationDays.v*DAY+10+21600);
   }
  },180000);
 }
});
