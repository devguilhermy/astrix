import { describe, expect, test } from 'bun:test';
import { computeBudgets, createStarterDesign, listParts, type BusId, type Design, type ScenarioId } from '@astrix/core';
import { BUS_GEOMETRY, SPACECRAFT_SLOTS, instancePosition, slotForPart } from './slots';
import { installedInstances, isSlotClick, previewInstance, roomProjection, snapProgress } from './model';

const scenarios: Readonly<Record<BusId, ScenarioId>> = {
  CUBESAT_3U: 'FIRST_LIGHT', SMALLSAT: 'RED_RELAY', CREW_CAPSULE: 'CREW_PATHFINDER',
};
function designFor(busId: BusId, parts: Design['parts'] = []): Design {
  return { ...createStarterDesign(scenarios[busId], 'ASPIRING'), parts };
}

describe('spacecraft catalogue/geometry invariants', () => {
  for (const busId of Object.keys(scenarios) as BusId[]) {
    test(`${busId}: every catalogue id has exactly one compatible procedural slot`, () => {
      const catalogue = listParts(busId);
      const slots = SPACECRAFT_SLOTS[busId];
      expect(slots.map(slot => slot.partId).sort()).toEqual(catalogue.map(part => part.id).sort());
      expect(new Set(slots.map(slot => slot.partId)).size).toBe(slots.length);
      for (const part of catalogue) {
        const slot = slotForPart(busId, part.id)!;
        expect(slot.busId).toBe(part.busId);
        expect(slot.category).toBe(part.category);
        expect(slot.shape.length).toBeGreaterThan(0);
        expect(slot.position.every(Number.isFinite)).toBe(true);
        expect(slot.size.every(value => Number.isFinite(value) && value > 0)).toBe(true);
        expect(Math.hypot(...slot.outward)).toBe(1);
        if (part.category === 'SOLAR') expect(slot.outward).toEqual([1, 0, 0]);
        if (part.category === 'RADIO' || part.category === 'INSTRUMENT') expect(slot.outward).toEqual([0, 0, 1]);
      }
    });

    test(`${busId}: installed geometry has one mesh instance per positive unit and no inferred equipment`, () => {
      const catalogue = listParts(busId);
      const design = designFor(busId, catalogue.map((part, index) => ({ partId: part.id, qty: index % 3 })));
      const installed = installedInstances(design);
      for (let i = 0; i < catalogue.length; i++) {
        expect(installed.filter(instance => instance.part.id === catalogue[i].id).length).toBe(i % 3);
      }
      expect(new Set(installed.map(instance => instance.key)).size).toBe(installed.length);
      expect(installedInstances(designFor(busId))).toEqual([]);
    });

    test(`${busId}: room volume conserves core catalogue amounts, including overflow`, () => {
      const design = designFor(busId, listParts(busId).map(part => ({ partId: part.id, qty: 3 })));
      const before = JSON.stringify(design);
      const room = roomProjection(design);
      const budget = computeBudgets(design).volume;
      expect(room.used).toBeCloseTo(budget.used, 10);
      expect(room.capacity).toBe(budget.limit);
      expect(room.cells.reduce((sum, cell) => sum + cell.used, 0) + room.overflow).toBeCloseTo(room.used, 10);
      for (const cell of room.cells) {
        expect(cell.used).toBeLessThanOrEqual(cell.capacity + 1e-10);
        let cursor = 0;
        for (const fill of cell.fills) {
          expect(fill.start).toBeCloseTo(cursor, 10);
          expect(fill.amount).toBeGreaterThan(0);
          expect(fill.preview).toBe(false);
          cursor += fill.amount;
        }
        expect(cursor).toBeCloseTo(cell.used, 10);
      }
      expect(JSON.stringify(design)).toBe(before);
    });
  }

  test('bus dimensions use metres and distinguish authored envelopes from the 3U requirement', () => {
    expect(BUS_GEOMETRY.CUBESAT_3U.dimensions).toEqual([.10, .34, .10]);
    expect(BUS_GEOMETRY.CUBESAT_3U.roomCells).toBe(3);
    expect(BUS_GEOMETRY.CUBESAT_3U.approximate).toBe(false);
    expect(BUS_GEOMETRY.SMALLSAT.approximate).toBe(true);
    expect(BUS_GEOMETRY.CREW_CAPSULE.approximate).toBe(true);
  });

  test('zero/negative quantities and foreign-bus ids cannot install visible equipment', () => {
    const design = designFor('CUBESAT_3U', [
      { partId: 'CAM_EO', qty: 0 }, { partId: 'RAD_MON', qty: -1 }, { partId: 'SS_MAPPER', qty: 1 },
      { partId: 'MAG', qty: 1 }, { partId: 'MAG', qty: 2 },
    ]);
    expect(installedInstances(design).map(instance => instance.part.id)).toEqual(['MAG', 'MAG', 'MAG']);
    const slot = slotForPart('CUBESAT_3U', 'MAG')!;
    expect(instancePosition(slot, 0)).toEqual(slot.position);
    expect(instancePosition(slot, 1)).not.toEqual(instancePosition(slot, 0));
    expect(instancePosition(slot, 3)).not.toEqual(instancePosition(slot, 0));
  });

  test('ghost equipment exists only for the actual same-bus proposal id', () => {
    const design = designFor('CUBESAT_3U', [{ partId: 'CAM_EO', qty: 2 }]);
    expect(previewInstance(design, null)).toBeNull();
    expect(previewInstance(design, 'NOT_A_PART')).toBeNull();
    expect(previewInstance(design, 'SS_MAPPER')).toBeNull();
    const proposal = previewInstance(design, 'CAM_EO')!;
    expect(proposal.part.id).toBe('CAM_EO');
    expect(proposal.index).toBe(2);
    expect(installedInstances(design).length).toBe(2);
    expect(roomProjection(design, null).proposed).toBe(0);
  });

  test('preview room fills only the proposed volume and separates new overflow from installed overflow', () => {
    const design = designFor('CUBESAT_3U', [{ partId: 'CAM_EO', qty: 5 }]);
    const room = roomProjection(design, 'BATT_40');
    expect(room.used).toBe(2.5);
    expect(room.proposed).toBe(.3);
    expect(room.overflow).toBe(0);
    expect(room.previewOverflow).toBe(0);
    expect(room.cells.flatMap(cell => cell.fills).filter(fill => fill.preview).reduce((sum, fill) => sum + fill.amount, 0)).toBeCloseTo(.3, 10);
    const over = roomProjection(designFor('CUBESAT_3U', [{ partId: 'CAM_EO', qty: 7 }]), 'BATT_40');
    expect(over.overflow).toBe(.5);
    expect(over.previewOverflow).toBeCloseTo(.3, 10);
    expect(over.cells.flatMap(cell => cell.fills).some(fill => fill.preview)).toBe(false);
    expect(over.used + over.proposed).toBeCloseTo(over.capacity + over.overflow + over.previewOverflow, 10);
  });
});

describe('workbench motion and picking', () => {
  test('a slot click requires strictly less than five CSS pixels of travel', () => {
    expect(isSlotClick([10, 10], [12.9, 13.9])).toBe(true);
    expect(isSlotClick([10, 10], [13, 14])).toBe(false);
    expect(isSlotClick([10, 10], [16, 10])).toBe(false);
  });
  test('snap motion has bounded endpoints and reduced motion is instantaneous', () => {
    expect(snapProgress(-1, false)).toBe(0);
    expect(snapProgress(0, false)).toBe(0);
    expect(snapProgress(.14, false)).toBeCloseTo(.875, 10);
    expect(snapProgress(.28, false)).toBe(1);
    expect(snapProgress(100, false)).toBe(1);
    expect(snapProgress(0, true)).toBe(1);
    let previous = 0;
    for (let i = 0; i <= 28; i++) {
      const progress = snapProgress(i / 100, false);
      expect(progress).toBeGreaterThanOrEqual(previous);
      expect(progress).toBeLessThanOrEqual(1);
      previous = progress;
    }
  });
});
