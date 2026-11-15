import { describe, expect, it } from 'bun:test';
import { makeOrbit } from '@astrix/core';
import { trajectoryViewer, PLAYBACK_SPEEDS } from './trajectoryStore';
import type { Trajectory } from '@astrix/core/interop/gmat';
import { apsides, orbitPath, orbitPeriodSec, orbitStateAt, subjectRange, trajectoryRuns } from '../../three/gmat/geometry';

describe('GMAT 3D view state', () => {
 it('clamps external seeking and refuses nonfinite times', () => {
  const trajectory: Trajectory = {version:1,source:'GMAT ReportFile',object:'Probe',body:'EARTH',frame:'EME2000',timeSystem:'UTC',units:'km, km/s',segments:[{start:10,stop:20,samples:[{time:10,positionKm:[1,2,3]},{time:20,positionKm:[2,3,4]}]}]};
  trajectoryViewer.getState().show({kind:'trajectory',trajectory,origin:'import'});
  trajectoryViewer.getState().seek(100); expect(trajectoryViewer.getState().time).toBe(20);
  trajectoryViewer.getState().seek(NaN); expect(trajectoryViewer.getState().time).toBe(20);
  trajectoryViewer.getState().seek(-5); expect(trajectoryViewer.getState().time).toBe(10);
  trajectoryViewer.getState().exit();
  expect(trajectoryViewer.getState().subject).toBeNull();
 });
 it('frames one period of an orbit and picks a speed that plays it in about half a minute', () => {
  const orbit = makeOrbit('EARTH', 400, 400, 51.6, '2024-05-01T00:00:00.000Z');
  trajectoryViewer.getState().show({kind:'orbit',orbit,label:'Astrix',origin:'export'});
  const [start, end] = subjectRange(trajectoryViewer.getState().subject!);
  expect(start).toBe(Date.parse(orbit.epochUTC));
  expect((end - start) / 1000).toBeCloseTo(orbitPeriodSec(orbit), 6);
  const playThrough = (end - start) / 1000 / trajectoryViewer.getState().speed;
  expect(PLAYBACK_SPEEDS as readonly number[]).toContain(trajectoryViewer.getState().speed);
  expect(playThrough).toBeGreaterThan(5); expect(playThrough).toBeLessThan(180);
  trajectoryViewer.getState().exit();
 });
});

describe('GMAT scene geometry', () => {
 const orbit = {...makeOrbit('EARTH', 400, 30000, 28, '2024-05-01T00:00:00.000Z'), raanDeg: 40, argPeriapsisDeg: 70, trueAnomalyDeg: 0};
 it('puts the conic, apsides and propagated state on the same orbit', () => {
  const { periapsis, apoapsis } = apsides(orbit), norm = (v: readonly number[]) => Math.hypot(...v);
  expect(norm(periapsis)).toBeCloseTo(orbit.smaKm * (1 - orbit.ecc), 6);
  expect(norm(apoapsis)).toBeCloseTo(orbit.smaKm * (1 + orbit.ecc), 6);
  expect(orbitPath(orbit)[0]).toEqual(periapsis);
  // TA = 0 at the epoch: the craft starts at periapsis and is back after one period.
  const epoch = Date.parse(orbit.epochUTC), period = orbitPeriodSec(orbit) * 1000;
  for (const time of [epoch, epoch + period]) orbitStateAt(orbit, time).position.forEach((value, axis) => expect(value).toBeCloseTo(periapsis[axis]!, 3));
 });
 it('never joins trajectory samples across gaps and bounds the vertex count', () => {
  const samples = Array.from({length: 20000}, (_, index) => ({time: index * 60_000 + (index >= 10000 ? 3_600_000 : 0), positionKm: [7000, index, 0] as [number, number, number]}));
  const runs = trajectoryRuns({version:1,source:'CCSDS OEM 2.0',object:'X',body:'EARTH',frame:'EME2000',timeSystem:'UTC',units:'km, km/s',segments:[{start:0,stop:samples.at(-1)!.time,samples}]});
  expect(runs).toHaveLength(2);
  expect(runs[0]!.at(-1)!.time).toBe(9999 * 60_000);
  expect(runs[1]![0]!.time).toBe(10000 * 60_000 + 3_600_000);
  expect(runs.reduce((n, run) => n + run.length, 0)).toBeLessThanOrEqual(7168 + 2);
 });
});
