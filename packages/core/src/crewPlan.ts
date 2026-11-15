import type { Design } from './contracts';
import { DAY } from './physics';
import { CREW_DEORBIT_BURN_SEC } from './return';
import { CREW_MODEL, crewTelemetry, initialCrew } from './sim/crew';

/** Preflight inventory forecast, conditional on installed, powered working hardware. */
export interface CrewSupportPlan {
 readonly crewCount: number;
 readonly plannedOrbitSec: number;
 readonly burnSec: number;
 readonly recoverySec: number;
 readonly totalSec: number;
 readonly supportInstalled: boolean;
 readonly workingHardwareAssumed: boolean;
 readonly runwayDays: number | null;
 readonly limiting: string | null;
 readonly oxygenKg: number | null;
 readonly nitrogenKg: number | null;
 readonly waterKg: number | null;
 readonly foodKg: number | null;
 readonly scrubberKg: number | null;
}
export function planCrewSupport(design: Design): CrewSupportPlan | null {
 if (!design.definition.support.crew) return null;
 const plannedOrbitSec = design.definition.environment.durationSec;
 const burnSec = CREW_DEORBIT_BURN_SEC, recoverySec = CREW_MODEL.recoverySec;
 const supportInstalled = design.busId === 'CREW_CAPSULE' && design.parts.some(p => p.partId === 'CREW_SUPPORT' && p.qty === 1);
 const inventory = supportInstalled ? crewTelemetry(initialCrew()) : null;
 return {
  crewCount: CREW_MODEL.count, plannedOrbitSec, burnSec, recoverySec, totalSec: plannedOrbitSec + burnSec + recoverySec,
  supportInstalled, workingHardwareAssumed: supportInstalled,
  runwayDays: inventory?.daysRemaining ?? null, limiting: inventory?.limiting ?? null,
  oxygenKg: inventory?.oxygenKg ?? null, nitrogenKg: inventory?.nitrogenKg ?? null,
  waterKg: inventory?.waterKg ?? null, foodKg: inventory?.foodKg ?? null, scrubberKg: inventory?.scrubberKg ?? null,
 };
}
