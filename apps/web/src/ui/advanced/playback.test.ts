import { describe, expect, it } from 'bun:test';
import { trajectoryViewer } from './trajectoryStore';
import type { Trajectory } from '@astrix/core/interop/gmat';

describe('independent scene playback', () => {
 it('clamps external seeking and refuses nonfinite times', () => {
  const trajectory: Trajectory = {version:1,source:'GMAT ReportFile',object:'Probe',body:'EARTH',frame:'EME2000',timeSystem:'UTC',units:'km, km/s',segments:[{start:10,stop:20,samples:[{time:10,positionKm:[1,2,3]},{time:20,positionKm:[2,3,4]}]}]};
  trajectoryViewer.getState().open(trajectory);
  trajectoryViewer.getState().seek(100); expect(trajectoryViewer.getState().time).toBe(20);
  trajectoryViewer.getState().seek(NaN); expect(trajectoryViewer.getState().time).toBe(20);
  trajectoryViewer.getState().seek(-5); expect(trajectoryViewer.getState().time).toBe(10);
  trajectoryViewer.getState().exit();
 });
});
