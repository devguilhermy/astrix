import { describe, expect, test } from 'bun:test';
import { createStarterDesign, missionById, type Design } from '@astrix/core';
import { BUS_GEOMETRY } from './slots';
import { hardwareRadiusM } from './extent';

const halfDiagonal = (design: Design) => Math.hypot(...BUS_GEOMETRY[design.busId].dimensions) / 2;
const cubeSat = (parts: Design['parts']): Design => ({ ...createStarterDesign(missionById('FIRST_LIGHT'), 'ASPIRING'), parts });

describe('hardware extent', () => {
  test('the starter SmallSat reaches beyond its bus half-diagonal', () => {
    const design = createStarterDesign(missionById('RED_RELAY'), 'ASPIRING');
    expect(design.busId).toBe('SMALLSAT');
    expect(hardwareRadiusM(design)).toBeGreaterThan(halfDiagonal(design));
  });

  test('a CubeSat without wings or antennas equals its bus half-diagonal', () => {
    const design = cubeSat([{ partId: 'EPS_BATT_20', qty: 1 }, { partId: 'OBC', qty: 1 }, { partId: 'CAM_EO', qty: 1 }]);
    expect(design.busId).toBe('CUBESAT_3U');
    expect(hardwareRadiusM(design)).toBeCloseTo(halfDiagonal(design), 9);
  });

  test('deployed wings add their slot distance and 1.22 wing lengths', () => {
    const design = cubeSat([{ partId: 'SOLAR_WINGS', qty: 1 }]);
    const [x, y, z] = BUS_GEOMETRY.CUBESAT_3U.dimensions;
    expect(hardwareRadiusM(design)).toBeCloseTo(.54 * x + Math.hypot(.025 * x / 2, .7 * y / 2, 1.22 * 2.5 * z), 9);
  });
});
