import type { BusId, PartCategory } from '@astrix/core';

export type Metres3 = readonly [number, number, number];
export type PartShape = 'battery' | 'body-solar' | 'wings' | 'computer' | 'storage' | 'magnetic-adcs' | 'wheel-adcs' | 'whip' | 'patch' | 'dish' | 'optical' | 'radiation' | 'magnetometer' | 'propulsion' | 'radiator' | 'heater' | 'support' | 'disposal';

export interface BusGeometry {
  readonly dimensions: Metres3;
  readonly roomCapacity: number;
  readonly roomCells: number;
  readonly approximate: boolean;
  readonly dimensionNote: string;
}

/**
 * Body coordinates, metres: +X panel normal, +Z optical/radio boresight.
 * No model-to-world rotation is baked into this registry.
 * 3U envelope follows the approved 100 × 340 × 100 mm workbench requirement.
 * SmallSat (0.8 m cube) and capsule (4 m diameter, 6 m total height including
 * service module) are authored illustrative envelopes, NOT manufacturer data.
 * BAY is the core's abstract room unit, not cubic metres or a CAD clearance.
 */
export const BUS_GEOMETRY: Readonly<Record<BusId, BusGeometry>> = {
  CUBESAT_3U: { dimensions: [.10, .34, .10], roomCapacity: 3, roomCells: 3, approximate: false, dimensionNote: '3U envelope; equipment clearances are illustrative.' },
  SMALLSAT: { dimensions: [.8, .8, .8], roomCapacity: 8, roomCells: 8, approximate: true, dimensionNote: 'Authored approximate 0.8 m bus; deployables excluded.' },
  CREW_CAPSULE: { dimensions: [4, 6, 4], roomCapacity: 100, roomCells: 10, approximate: true, dimensionNote: 'Authored approximate 4 m capsule diameter × 6 m capsule/service stack; deployables excluded.' },
};

export interface PartSlot {
  readonly partId: string;
  readonly busId: BusId;
  readonly category: PartCategory;
  readonly shape: PartShape;
  readonly position: Metres3;
  readonly size: Metres3;
  readonly outward: Metres3;
}

type SlotSpec = readonly [string, PartCategory, PartShape, Metres3, Metres3];
// Positions and equipment envelopes below are fractions of the bus envelope.
// Explicit ids intentionally make catalogue additions fail the coverage invariant.
const CUBE: readonly SlotSpec[] = [
  ['EPS_BATT_20', 'BATTERY', 'battery', [.16, -.31, 0], [.54, .11, .60]],
  ['BATT_40', 'BATTERY', 'battery', [.16, -.16, 0], [.54, .13, .60]],
  ['SOLAR_BODY', 'SOLAR', 'body-solar', [.515, 0, 0], [.025, .87, .78]],
  ['SOLAR_WINGS', 'SOLAR', 'wings', [.54, 0, 0], [.025, .70, 2.5]],
  ['OBC', 'COMPUTER', 'computer', [.14, .01, 0], [.64, .06, .68]],
  ['STORAGE_32G', 'STORAGE', 'storage', [.14, .09, 0], [.50, .045, .62]],
  ['ADCS_MAG', 'ADCS', 'magnetic-adcs', [.14, .20, 0], [.60, .07, .62]],
  ['ADCS_WHEELS', 'ADCS', 'wheel-adcs', [.14, .32, 0], [.65, .12, .66]],
  ['RADIO_UHF', 'RADIO', 'whip', [-.28, .41, .52], [.24, .08, .24]],
  ['RADIO_SBAND', 'RADIO', 'patch', [.30, .39, .53], [.34, .10, .12]],
  ['CAM_EO', 'INSTRUMENT', 'optical', [0, -.28, .58], [.45, .13, .40]],
  ['RAD_MON', 'INSTRUMENT', 'radiation', [-.25, .02, .56], [.35, .13, .30]],
  ['MAG', 'INSTRUMENT', 'magnetometer', [-.45, -.28, .55], [.16, .06, .20]],
  ['DEPLOY_MITIGATION', 'THERMAL', 'disposal', [-.25, -.43, -.52], [.50, .07, .12]],
  ['HEATER_6', 'THERMAL', 'heater', [-.42, .03, -.15], [.06, .17, .42]],
];
const SMALL: readonly SlotSpec[] = [
  ['SS_BATT_300', 'BATTERY', 'battery', [.16, -.27, 0], [.48, .20, .48]],
  ['SS_SOLAR_400', 'SOLAR', 'wings', [.53, -.16, 0], [.025, .60, 1.15]],
  ['SS_SOLAR_800', 'SOLAR', 'wings', [.53, .22, 0], [.025, .60, 1.65]],
  ['SS_OBC', 'COMPUTER', 'computer', [.16, .03, 0], [.52, .09, .48]],
  ['SS_ADCS', 'ADCS', 'wheel-adcs', [.16, .28, 0], [.48, .24, .48]],
  ['SS_PROP_MONO', 'PROPULSION', 'propulsion', [0, -.53, 0], [.52, .42, .48]],
  ['SS_PROP_BI', 'PROPULSION', 'propulsion', [0, -.53, -.15], [.75, .52, .48]],
  ['SS_XBAND', 'RADIO', 'dish', [0, .30, .60], [.65, .65, .35]],
  ['SS_UHF_RELAY', 'RADIO', 'whip', [-.30, .35, .52], [.22, .15, .22]],
  ['SS_MAPPER', 'INSTRUMENT', 'optical', [0, -.25, .57], [.40, .40, .38]],
  ['SS_RAD', 'INSTRUMENT', 'radiation', [-.30, 0, .56], [.24, .26, .22]],
  ['SS_HEATER_60', 'THERMAL', 'heater', [-.45, 0, -.20], [.05, .32, .38]],
  ['SS_RADIATOR', 'THERMAL', 'radiator', [-.51, .04, -.20], [.025, .32, .38]],
];
const CREW: readonly SlotSpec[] = [
  ['CREW_BATTERY', 'BATTERY', 'battery', [.24, -.23, 0], [.24, .12, .32]],
  ['CREW_SOLAR', 'SOLAR', 'wings', [.51, -.27, 0], [.025, .32, 1.1]],
  ['CREW_COMPUTER', 'COMPUTER', 'computer', [.24, -.08, 0], [.24, .06, .26]],
  ['CREW_ADCS', 'ADCS', 'wheel-adcs', [.24, .02, 0], [.24, .08, .26]],
  ['CREW_RADIO', 'RADIO', 'patch', [0, .03, .49], [.24, .12, .08]],
  ['CREW_OBSERVER', 'INSTRUMENT', 'optical', [0, .22, .32], [.18, .12, .20]],
  ['CREW_SUPPORT', 'THERMAL', 'support', [-.23, -.22, .15], [.26, .17, .30]],
  ['CREW_HEATER', 'THERMAL', 'radiator', [-.49, -.22, -.10], [.025, .25, .32]],
  ['CREW_PROPULSION', 'PROPULSION', 'propulsion', [0, -.50, 0], [.65, .32, .65]],
];

function busSlots(busId: BusId, specs: readonly SlotSpec[]): readonly PartSlot[] {
  const dimensions = BUS_GEOMETRY[busId].dimensions;
  return specs.map<PartSlot>(([partId, category, shape, position, size]) => ({
    partId, busId, category, shape,
    position: [position[0] * dimensions[0], position[1] * dimensions[1], position[2] * dimensions[2]],
    size: [size[0] * dimensions[0], size[1] * dimensions[1], size[2] * dimensions[2]],
    outward: category === 'SOLAR' ? [1, 0, 0] : category === 'PROPULSION' ? [0, -1, 0] : category === 'INSTRUMENT' || category === 'RADIO' ? [0, 0, 1] : [1, 0, 0],
  }));
}

export const SPACECRAFT_SLOTS: Readonly<Record<BusId, readonly PartSlot[]>> = {
  CUBESAT_3U: busSlots('CUBESAT_3U', CUBE),
  SMALLSAT: busSlots('SMALLSAT', SMALL),
  CREW_CAPSULE: busSlots('CREW_CAPSULE', CREW),
};
export function slotForPart(busId: BusId, partId: string): PartSlot | null {
  return SPACECRAFT_SLOTS[busId].find(slot => slot.partId === partId) ?? null;
}

/** Duplicate hardware remains countable rather than collapsing to one category mesh. */
export function instancePosition(slot: PartSlot, index: number): Metres3 {
  const gap = slot.size[0] * 1.15;
  const row = Math.floor(index / 3);
  return [slot.position[0] + (index % 3) * gap, slot.position[1] + row * slot.size[1] * 1.2, slot.position[2] + row * slot.size[2] * .3];
}
