import { telemetry, type TurnGameState, type TurnReceipt } from '@astrix/core';

/** Inventory at the latest committed boundary, with the capacities used to scale bars. */
export interface Inventory { energyWh: number; capacityWh: number; storedMB: number; storageMB: number; fuelKg: number }
export interface Level { before: number; after: number; max: number }
export interface TurnLevels { energyWh: Level; storedMB: Level; fuelKg: Level | null }

/** Fuel follows the play workspace: spacecraft propellant plus an attached stage. */
export function inventoryOf(game: TurnGameState): Inventory {
  const current = telemetry(game.sim);
  const fuelKg = current.flight ? current.flight.mass.spacecraftPropellantKg + (current.flight.mass.stage?.attached ? current.flight.mass.stage.propellantKg : 0) : typeof game.sim.propellantKg === 'number' ? game.sim.propellantKg : 0;
  return { energyWh: current.socWh, capacityWh: current.capacityWh, storedMB: current.storedMB, storageMB: current.storageMB, fuelKg };
}

/**
 * Levels before and after the turn with `revision`, rebuilt backwards from the latest
 * inventory through the committed receipt deltas. Values are clamped at zero.
 */
export function turnLevels(receipts: readonly Pick<TurnReceipt, 'revision' | 'delta'>[], revision: number, inventory: Inventory): TurnLevels | null {
  const position = receipts.findIndex(receipt => receipt.revision === revision);
  if (position < 0) return null;
  let energy = inventory.energyWh, stored = inventory.storedMB, fuel = inventory.fuelKg, initialFuel = inventory.fuelKg;
  for (let index = receipts.length - 1; index > position; index--) { const delta = receipts[index]!.delta; energy -= delta.energyWh; stored -= delta.storedMB; fuel -= delta.fuelKg; }
  for (const receipt of receipts) initialFuel -= receipt.delta.fuelKg;
  const delta = receipts[position]!.delta;
  const level = (after: number, change: number, max: number): Level => {
    const a = Math.max(0, after), b = Math.max(0, after - change);
    return { before: b, after: a, max: Math.max(max, a, b) };
  };
  const fuelLevel = level(fuel, delta.fuelKg, Math.max(0, initialFuel));
  return {
    energyWh: level(energy, delta.energyWh, inventory.capacityWh),
    storedMB: level(stored, delta.storedMB, inventory.storageMB),
    fuelKg: fuelLevel.max > 0 ? fuelLevel : null,
  };
}
