import { describe, expect, test } from 'bun:test';
import { createSim, createStarterDesign, listParts, quoteAddPart, telemetry } from '@astrix/core';
import { liveReadings, partSpecs } from './partDetails';

function flyingFirstLight() {
  const quote = quoteAddPart(createStarterDesign('FIRST_LIGHT', 'ASPIRING'), 'CAM_EO', 'ALL');
  if (!quote.ok) throw new Error(`Expected the Earth camera to install: ${quote.code}`);
  const design = quote.value.next;
  return { design, x: telemetry(createSim(design, 42)) };
}

describe('component details', () => {
  test('specifications are the catalogue values with their provenance, never inferred', () => {
    for (const busId of ['CUBESAT_3U', 'SMALLSAT', 'CREW_CAPSULE'] as const) for (const part of listParts(busId)) {
      const specs = new Map(partSpecs(part, { busId }).map(row => [row.key, row]));
      expect(specs.get('mass')?.value).toBe(part.massKg.v);
      expect(specs.get('mass')?.assumed).toBe(part.massKg.p.kind === 'assumption');
      expect(specs.get('power')?.value).toBe(part.powerW.v);
      expect(specs.has('generation')).toBe(!!part.generationW);
      expect(specs.has('capacity')).toBe(!!part.capacityWh);
      expect(specs.get('volume')?.unit).toBe(busId === 'CUBESAT_3U' ? 'U' : 'bay');
    }
  });
  test('live readings exist only for an installed component in flight', () => {
    const { design, x } = flyingFirstLight();
    const camera = listParts(design.busId).find(part => part.id === 'CAM_EO')!;
    expect(liveReadings(camera, null, true)).toEqual([]);
    expect(liveReadings(camera, x, false)).toEqual([]);
    const state = liveReadings(camera, x, true).find(row => row.key === 'power');
    const actual = x.instruments.find(item => item.partId === 'CAM_EO')!;
    expect(state?.textKey).toBe(actual.lost ? 'lost' : actual.on ? 'on' : 'off');
  });
  test('power and storage readings mirror core telemetry', () => {
    const { design, x } = flyingFirstLight();
    const parts = listParts(design.busId), installed = new Set(design.parts.map(item => item.partId));
    const solar = parts.find(part => part.category === 'SOLAR' && installed.has(part.id))!;
    const battery = parts.find(part => part.category === 'BATTERY' && installed.has(part.id))!;
    expect(liveReadings(solar, x, true).find(row => row.key === 'generationNow')?.value).toBe(x.genW);
    expect(liveReadings(solar, x, true).find(row => row.key === 'light')?.textKey).toBe(x.sunlit ? 'sunlit' : 'shadow');
    expect(liveReadings(battery, x, true).find(row => row.key === 'energy')?.value).toBe(x.socWh);
  });
});
