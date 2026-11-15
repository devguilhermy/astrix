import { describe, expect, it } from 'bun:test';
import { CONSTANTS, elementsForOrbit, makeOrbit, propagate, stationPosition, sunDirection } from '../physics';
import { exportInitialOrbit, parseInitialOrbit, parseOem, parseReport, sampleTrajectory, utcMillis } from './gmat';

const oem = `CCSDS_OEM_VERS = 2.0
CREATION_DATE = 2024-01-01T00:00:00
ORIGINATOR = TEST
META_START
OBJECT_NAME = Example
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = EME2000
TIME_SYSTEM = UTC
START_TIME = 2024-01-01T00:00:00
STOP_TIME = 2024-01-01T00:00:10
META_STOP
2024-01-01T00:00:00 7000 0 0 0 7 0
2024-01-01T00:00:10 7010 0 0 0 7 0
META_START
OBJECT_NAME = Example
OBJECT_ID = 2024-001A
CENTER_NAME = EARTH
REF_FRAME = EME2000
TIME_SYSTEM = UTC
START_TIME = 2024-01-01T00:01:00
STOP_TIME = 2024-01-01T00:01:10
META_STOP
2024-01-01T00:01:00 8000 0 0 0 7 0
2024-01-01T00:01:10 8010 0 0 0 7 0`;
describe('external inert text', () => {
 it('preserves explicit gaps and interpolates by time only within segments', () => {
  const t = parseOem(oem), start = utcMillis('2024-01-01T00:00:00Z');
  expect(t.segments).toHaveLength(2); expect(sampleTrajectory(t,start+3000)).toEqual([7003,0,0]);
  expect(sampleTrajectory(t,start+30000)).toBeNull(); expect(sampleTrajectory(t,start-1)).toBeNull();
 });
 it('rejects unsafe, backwards and ambiguous input', () => {
  expect(() => parseOem(oem.replace('2024-01-01T00:00:10 7010','2023-12-31T23:59:59 7010'))).toThrow();
  expect(() => utcMillis('2016-12-31T23:59:60Z')).toThrow();
  expect(() => parseInitialOrbit('Create Spacecraft A;\nBeginMissionSequence;\nPropagate P(A);','A')).toThrow();
  expect(() => parseReport('A.UTCGregorian A.X A.Y A.Z\n01 Jan 2024 00:00:00.000 1 2 3','A')).toThrow();
 });
 it('enforces the per-line limit in UTF-8 bytes, including multibyte text', () => {
  const withOriginator = (name: string) => oem.replace('ORIGINATOR = TEST', `ORIGINATOR = ${name}`);
  expect(parseOem(withOriginator(`${'é'.repeat(8185)}a`).replace(/\n/g, '\r\n')).segments).toHaveLength(2);
  expect(() => parseOem(withOriginator('é'.repeat(9000)))).toThrow('Line exceeds 16 KiB');
 });
 it('refuses submillisecond UTC rather than silently changing an imported epoch', () => {
  const source = exportInitialOrbit(makeOrbit('EARTH',420,420,51.6,'2024-05-01T00:00:00.000Z'));
  expect(() => parseInitialOrbit(source.replace('00:00:00.000', '00:00:00.0001'),'Astrix')).toThrow(/milliseconds/);
  expect(parseInitialOrbit(source.replace('00:00:00.000', '00:00:00.0000'),'Astrix').epochUTC).toBe('2024-05-01T00:00:00.000Z');
  expect(() => parseOem(oem.replace('2024-01-01T00:00:00 7000','2024-01-01T00:00:00.0001 7000'))).toThrow(/milliseconds/);
 });
 it('requires selected report columns and parses irregular UTC sample times', () => {
  const t = parseReport('A.UTCGregorian A.EarthMJ2000Eq.X A.EarthMJ2000Eq.Y A.EarthMJ2000Eq.Z\n01 Jan 2024 00:00:00.000 7000 0 0\n01 Jan 2024 00:00:10.000 7010 0 0', 'A');
  expect(sampleTrajectory(t,t.segments[0].start+2000)).toEqual([7002,0,0]);
 });
 it('does not bridge sparse report samples but preserves exact endpoints', () => {
  const t = parseReport('A.UTCGregorian A.MarsMJ2000Eq.X A.MarsMJ2000Eq.Y A.MarsMJ2000Eq.Z\n01 Jan 2024 00:00:00.000 7000 0 0\n01 Jan 2024 02:00:00.000 8000 0 0', 'A');
  const start = t.segments[0].start, out: [number,number,number] = [0,0,0];
  expect(sampleTrajectory(t,start+3600000)).toBeNull();
  expect(sampleTrajectory(t,start,out)).toBe(out); expect(out).toEqual([7000,0,0]);
  expect(sampleTrajectory(t,start+7200000)).toEqual([8000,0,0]);
  const near = parseReport('A.UTCGregorian A.EarthMJ2000Eq.X A.EarthMJ2000Eq.Y A.EarthMJ2000Eq.Z\n01 Jan 2024 00:00:00.000 7000 0 0\n01 Jan 2024 00:02:01.000 7121 0 0', 'A');
  expect(sampleTrajectory(near, near.segments[0].start + 60000)).toBeNull();
 });
 it('roundtrips complete nonzero initial state for both bodies', () => {
  for (const body of ['EARTH','MARS'] as const) {
   const original = {...makeOrbit(body,400,1200,62,'2024-05-01T00:00:00.000Z'),raanDeg:73,argPeriapsisDeg:116,trueAnomalyDeg:205};
   const restored = parseInitialOrbit(exportInitialOrbit(original),'Astrix');
   const a = propagate(elementsForOrbit(original),CONSTANTS[body].mu.v,0), b = propagate(elementsForOrbit(restored),CONSTANTS[body].mu.v,0);
   for (let i=0;i<3;i++) { expect(Math.abs(a.position[i]-b.position[i])).toBeLessThan(1e-8); expect(Math.abs(a.velocity[i]-b.velocity[i])).toBeLessThan(1e-10); }
  }
 });
 it('uses the same absolute epoch for station and sun', () => {
  const later = '2000-01-02T12:00:00.000Z';
  expect(stationPosition(0,'EARTH',38,-75,undefined,later)).toEqual(stationPosition(86400));
  expect(sunDirection('EARTH',0,undefined,later)).toEqual(sunDirection('EARTH',86400));
 });
});
