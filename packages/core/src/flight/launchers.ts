// Authored launch vehicle abstractions (not real manufacturer data). Thrust/Isp/mass choices are tuned for teaching and checked by the ascent reference tests.
import { assumed } from '../physics';
import type { LauncherDef } from './types';

const note = 'Authored fictional launcher abstraction sized for ASTRIX teaching missions; not a manufacturer specification.';
export const LAUNCHERS: readonly LauncherDef[] = [
 { id: 'LV_SOUNDING', nameKey: 'launcher.LV_SOUNDING.name', descKey: 'launcher.LV_SOUNDING.desc', payloadLimitKg: 60, fairingKg: 0, cdAreaM2: 0.15, cost: assumed(40, note),
  stages: [{ id: 'S1', dryKg: 150, propellantKg: 500, thrustKN: 22, ispVacSec: 250, ispSeaSec: 230, restarts: 0 }] },
 { id: 'LV_SMALL_ORBITAL', nameKey: 'launcher.LV_SMALL_ORBITAL.name', descKey: 'launcher.LV_SMALL_ORBITAL.desc', payloadLimitKg: 220, fairingKg: 0, cdAreaM2: 2, cost: assumed(250, note),
  stages: [{ id: 'S1', dryKg: 1500, propellantKg: 16000, thrustKN: 420, ispVacSec: 310, ispSeaSec: 285, restarts: 0 }, { id: 'S2', dryKg: 450, propellantKg: 4200, thrustKN: 45, ispVacSec: 345, ispSeaSec: 345, restarts: 0 }] },
 { id: 'LV_LUNAR', nameKey: 'launcher.LV_LUNAR.name', descKey: 'launcher.LV_LUNAR.desc', payloadLimitKg: 400, fairingKg: 0, cdAreaM2: 5, cost: assumed(900, note),
  stages: [{ id: 'S1', dryKg: 12000, propellantKg: 200000, thrustKN: 4400, ispVacSec: 310, ispSeaSec: 285, restarts: 0 }, { id: 'S2', dryKg: 2300, propellantKg: 30000, thrustKN: 330, ispVacSec: 350, ispSeaSec: 350, restarts: 2 }] },
];
export const LAUNCHER_BY_ID: Readonly<Record<string, LauncherDef>> = Object.fromEntries(LAUNCHERS.map(l => [l.id, l]));
export const listLaunchers = (): readonly LauncherDef[] => LAUNCHERS;
