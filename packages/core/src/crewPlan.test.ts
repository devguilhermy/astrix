import { describe, expect, it } from 'bun:test';
import { createStarterDesign, missionById } from './mission/library';
import { planCrewSupport } from './crewPlan';
import { launchReadiness, quoteRemovePart } from './design';
import { DAY } from './physics';
import { createSim } from './sim/state';
import { telemetry } from './sim/selectors';
import { advanceTo } from './sim/testSupport';

const signed = { SCIENCE: true, SPACECRAFT: true, LAUNCH_ORBIT: true, GROUND_COMMS: true } as const;
describe('crew support planning', () => {
 it('compares the actual paid stores with the complete flight and matches elapsed consumption', () => {
  const design = createStarterDesign(missionById('CREW_PATHFINDER'), 'ASPIRING');
  const plan = planCrewSupport(design)!;
  expect(plan.supportInstalled).toBe(true);
  expect(plan.workingHardwareAssumed).toBe(true);
  expect(plan.totalSec).toBeGreaterThan(plan.plannedOrbitSec + plan.recoverySec);
  expect(plan.runwayDays! * DAY).toBeGreaterThan(plan.totalSec);
  const flown = advanceTo(createSim(design, 73), plan.recoverySec);
  const actual = telemetry(flown).crew!;
  expect(actual.limiting).toBe(plan.limiting!);
  expect(plan.runwayDays! - actual.daysRemaining).toBeCloseTo(plan.recoverySec / DAY, 8);
  expect(actual.waterKg).toBeLessThan(plan.waterKg!);
 });
 it('does not present uninstalled support as usable stores', () => {
  const design = createStarterDesign(missionById('CREW_PATHFINDER'), 'ASPIRING');
  const removed = quoteRemovePart(design, 'CREW_SUPPORT', 'ALL');
  if (!removed.ok) throw new Error(removed.code);
  expect(planCrewSupport(removed.value.next)).toMatchObject({ supportInstalled: false, workingHardwareAssumed: false, runwayDays: null, limiting: null, oxygenKg: null, waterKg: null });
  expect(launchReadiness(removed.value.next, signed)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'REQUIRES_PART', values: { needs: 'CREW_SUPPORT' } })]));
  expect(planCrewSupport(createStarterDesign(missionById('FIRST_LIGHT'), 'ASPIRING'))).toBeNull();
 });
});
