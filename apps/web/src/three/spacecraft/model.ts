import { listParts, type Design, type PartDef } from '@astrix/core';
import { BUS_GEOMETRY, instancePosition, slotForPart, type Metres3, type PartSlot } from './slots';

export interface PartInstance {
  readonly key: string;
  readonly part: PartDef;
  readonly slot: PartSlot;
  readonly index: number;
  readonly position: Metres3;
}

export function installedInstances(design: Design): readonly PartInstance[] {
  const catalogue = listParts(design.busId);
  const quantities = new Map<string, number>();
  for (const item of design.parts) {
    if (Number.isFinite(item.qty) && item.qty > 0) {
      quantities.set(item.partId, (quantities.get(item.partId) ?? 0) + Math.floor(item.qty));
    }
  }
  return catalogue.flatMap(part => {
    const slot = slotForPart(design.busId, part.id);
    if (!slot) throw new Error(`Missing spacecraft slot: ${design.busId}/${part.id}`);
    return Array.from({ length: quantities.get(part.id) ?? 0 }, (_, index) => ({
      key: `${part.id}:${index}`, part, slot, index, position: instancePosition(slot, index),
    }));
  });
}

/** No scenario-based inferred equipment: the ghost is exactly one real proposal id. */
export function previewInstance(design: Design, partId: string | null): PartInstance | null {
  if (!partId) return null;
  const part = listParts(design.busId).find(candidate => candidate.id === partId);
  const slot = slotForPart(design.busId, partId);
  if (!part || !slot) return null;
  const index = installedInstances(design).filter(item => item.part.id === partId).length;
  return { key: `preview:${partId}`, part, slot, index, position: instancePosition(slot, index) };
}

export interface RoomFill {
  readonly partId: string;
  readonly category: PartDef['category'];
  readonly start: number;
  readonly amount: number;
  readonly preview: boolean;
}
export interface RoomCell {
  readonly capacity: number;
  readonly used: number;
  readonly fills: readonly RoomFill[];
}
export interface RoomProjection {
  readonly capacity: number;
  readonly used: number;
  readonly proposed: number;
  readonly overflow: number;
  readonly previewOverflow: number;
  readonly cells: readonly RoomCell[];
}

/** Abstract U/BAY packing, not a claim that the procedural meshes are CAD volumes. */
export function roomProjection(design: Design, previewPartId: string | null = null): RoomProjection {
  const bus = BUS_GEOMETRY[design.busId];
  const cellCapacity = bus.roomCapacity / bus.roomCells;
  const cells = Array.from({ length: bus.roomCells }, () => ({ capacity: cellCapacity, used: 0, fills: [] as RoomFill[] }));
  let used = 0;
  const pack = (part: PartDef, amount: number, preview: boolean) => {
    let remaining = amount;
    for (const cell of cells) {
      if (remaining <= 1e-10) break;
      const filled = cell.fills.reduce((sum, fill) => sum + fill.amount, 0);
      const take = Math.min(remaining, Math.max(0, cell.capacity - filled));
      if (take > 0) {
        cell.fills.push({ partId: part.id, category: part.category, start: filled, amount: take, preview });
        if (!preview) cell.used += take;
        remaining -= take;
      }
    }
  };
  for (const instance of installedInstances(design)) {
    used += instance.part.volume.v;
    pack(instance.part, instance.part.volume.v, false);
  }
  const proposal = previewInstance(design, previewPartId);
  const proposed = proposal?.part.volume.v ?? 0;
  if (proposal) pack(proposal.part, proposed, true);
  const overflow = Math.max(0, used - bus.roomCapacity);
  return { capacity: bus.roomCapacity, used, proposed, overflow, previewOverflow: Math.max(0, used + proposed - bus.roomCapacity) - overflow, cells };
}

export function isSlotClick(start: readonly [number, number], end: readonly [number, number]): boolean {
  return Math.hypot(end[0] - start[0], end[1] - start[1]) < 5;
}

/** A wall-clock transition, bounded at both ends and independent of simulation warp. */
export function snapProgress(elapsedSec: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  const t = Math.min(1, Math.max(0, elapsedSec / .28));
  return 1 - (1 - t) ** 3;
}
