import { expect, it } from 'bun:test';
import { createStarterDesign, missionById } from '../mission/library';
import type { CrewTelemetry } from '../contracts';
import { issueCommand } from './commands';
import { telemetry } from './selectors';
import { createSim } from './state';
import { stepSim } from './step';
import { advanceTo } from './testSupport';

function retainedCrewInventory(c: CrewTelemetry): number {
 return c.oxygenKg + c.nitrogenKg + c.waterKg + c.foodKg + c.cabinOxygenKg + c.cabinNitrogenKg + c.cabinCO2Kg + c.retainedWasteKg;
}

it('keeps rolling gas pressures nonnegative through a scrubbed early recovery without losing retained inventory', () => {
 let state = advanceTo(createSim(createStarterDesign(missionById('CREW_PATHFINDER'), 'ASPIRING'), 73), 15 * 3600);
 const before = telemetry(state).crew!;
 const inventory = retainedCrewInventory(before);
 const assertAtmosphere = (crew: CrewTelemetry): void => {
  for (const value of [crew.cabinOxygenKg, crew.cabinNitrogenKg, crew.cabinCO2Kg, crew.pressureMmHg, crew.co2MmHg, crew.co2AverageMmHg, crew.inspiredOxygenMmHg, crew.inspiredOxygenAverageMmHg]) {
   expect(value).toBeGreaterThanOrEqual(0);
   expect(Object.is(value, -0)).toBe(false);
  }
  expect(retainedCrewInventory(crew)).toBeCloseTo(inventory, 8);
 };
 assertAtmosphere(before);
 const request = issueCommand(state, { kind: 'CREW_DEORBIT' }, 'ALL');
 if (!request.ok) throw new Error(request.code);
 state = request.value;
 let guard = 0;
 while (!telemetry(state).ended) {
  state = stepSim(state, 300).state;
  assertAtmosphere(telemetry(state).crew!);
  if (++guard > 10000) throw new Error('Recovery did not terminate');
 }
 expect(telemetry(state).crew!.phase).toBe('COMPLETE');
});
