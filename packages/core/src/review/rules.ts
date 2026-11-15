import type { ActorRole, Budgets, Design, Phase, ReviewSnapshot, RoleId, SimState, Telemetry } from '../contracts';
import { MODEL, PART_BY_ID } from '../catalog';
import { computeBudgets } from '../design';
import { telemetry } from '../sim/selectors';
import { flight } from '../sim/state';

export interface CueRule {
 id: string; category: 'alert' | 'tip' | 'teach'; severity: 1 | 2 | 3; role: ActorRole;
 cooldownSec: number; clearAfterSec: number; target?: string; glossaryId?: string; fix?: string; mandatory?: boolean;
 applies?: (snapshot: ReviewSnapshot) => boolean;
 detect: (snapshot: ReviewSnapshot) => null | { params: Record<string, number | string>; target?: string; fix?: string; glossaryId?: string };
}
interface DesignReview extends ReviewSnapshot { design: Design; budgets: Budgets; hasRadio: boolean; hasADCS: boolean; needsPointing: boolean; marginMultiplier: number }
interface OperateReview extends DesignReview { telemetry: Telemetry; stormActive: boolean }
export function designSnapshot(design: Design): ReviewSnapshot {
 return { phase: 'DESIGN', design, budgets: computeBudgets(design), hasRadio: design.parts.some(i => PART_BY_ID[i.partId]?.category === 'RADIO' && i.partId !== 'SS_UHF_RELAY'), hasADCS: design.parts.some(i => PART_BY_ID[i.partId]?.category === 'ADCS'), needsPointing: design.parts.some(i => PART_BY_ID[i.partId]?.requiresTarget || PART_BY_ID[i.partId]?.directional), marginMultiplier: design.levelId === 'EXPERT' ? 1.5 : 1 };
}
export function operateSnapshot(state: SimState, _design: Design): ReviewSnapshot {
 return { ...designSnapshot(flight(state).design), phase: 'OPERATE', telemetry: telemetry(state), stormActive: flight(state).stormActive };
}
function designRule(id: string, severity: 1 | 2 | 3, role: RoleId | 'ALL', glossaryId: string, detect: (snap: DesignReview) => Record<string, number | string> | null, phases: readonly Phase[] = ['CONCEPT', 'DESIGN', 'LAUNCH_ORBIT']): CueRule {
 return { id, category: severity === 1 ? 'tip' : 'alert', severity, role, cooldownSec: 0, clearAfterSec: 0, target: id === 'DV_SHORT' ? 'fuel-planner' : role === 'GROUND_COMMS' ? 'radio-parts' : 'design-budgets', glossaryId, fix: `review-${id.toLowerCase()}`, mandatory: severity === 3,
  applies: snap => phases.includes(snap.phase), detect: snap => { const params = detect(snap as DesignReview); return params === null ? null : { params }; } };
}
export const CUE_RULES: readonly CueRule[] = [
 designRule('POWER_NEGATIVE', 3, 'SPACECRAFT', 'energy-budget', s => s.budgets.power && s.budgets.power.avgGenW < s.budgets.power.avgLoadW ? { generation: s.budgets.power.avgGenW, load: s.budgets.power.avgLoadW } : null),
 designRule('POWER_MARGIN_LOW', 2, 'SPACECRAFT', 'safety-margins', s => s.budgets.power && s.budgets.power.marginPct >= 0 && s.budgets.power.marginPct < 10 * s.marginMultiplier ? { margin: s.budgets.power.marginPct } : null),
 designRule('BATTERY_ECLIPSE_SHORT', 3, 'SPACECRAFT', 'battery-storage', s => s.budgets.power && s.budgets.power.eclipseWh > s.budgets.power.usableBatteryWh ? { neededWh: s.budgets.power.eclipseWh, usableWh: s.budgets.power.usableBatteryWh } : null),
 designRule('MASS_MARGIN_LOW', 2, 'SPACECRAFT', 'mass-volume', s => (s.budgets.massKg.limit - s.budgets.massKg.used) / s.budgets.massKg.limit < .05 * s.marginMultiplier ? { marginKg: s.budgets.massKg.limit - s.budgets.massKg.used } : null),
 designRule('DATA_BACKLOG', 2, 'GROUND_COMMS', 'data-return', s => s.budgets.data && s.budgets.data.genMBPerDay > s.budgets.data.downMBPerDay ? { generated: s.budgets.data.genMBPerDay, returned: s.budgets.data.downMBPerDay } : null),
 designRule('NO_RADIO', 3, 'GROUND_COMMS', 'radio-links', s => s.hasRadio ? null : {}),
 designRule('POINTING_NEEDS_ADCS', 3, 'SPACECRAFT', 'pointing', s => s.needsPointing && !s.hasADCS ? {} : null),
 designRule('DV_SHORT', 3, 'LAUNCH_ORBIT', 'capture-burn', s => { const required = s.budgets.technical?.planningCaptureKms ?? (s.budgets.deltaV?.requiredKms ?? 0) * MODEL.captureMargin.v; return s.budgets.deltaV && s.budgets.deltaV.availableKms + 1e-9 < required ? { required, available: s.budgets.deltaV.availableKms } : null; }),
 designRule('BUDGET_MARGIN_LOW', 1, 'ALL', 'game-budget', s => (s.budgets.cost.limit - s.budgets.cost.used) / s.budgets.cost.limit < .05 * s.marginMultiplier ? { remaining: s.budgets.cost.limit - s.budgets.cost.used } : null),
 designRule('OBJECTIVE_UNREACHABLE', 2, 'SCIENCE', 'science-return', s => { const o = s.design.definition.objectives.find(x => x.required && x.spec.kind === 'DELIVERED_PRODUCT'); if (!o || o.spec.kind !== 'DELIVERED_PRODUCT' || !s.budgets.data) return null; const projected = Math.min(s.budgets.data.genMBPerDay, s.budgets.data.downMBPerDay) * s.design.definition.environment.durationSec / 86400; return projected < o.spec.targetMB ? { projected, target: o.spec.targetMB } : null; }, ['LAUNCH_ORBIT']),
 { id: 'STORM_EXPOSED', category: 'teach', severity: 1, role: 'SCIENCE', cooldownSec: 30, clearAfterSec: 5, glossaryId: 'radiation', target: 'instrument-controls', applies: s => s.phase === 'OPERATE', detect: snap => { const s = snap as OperateReview; return s.stormActive && s.telemetry.instruments.some(i => i.on && !i.lost) ? { params: { doseUGyH: s.telemetry.doseUGyH } } : null; } },
 { id: 'PASS_SOON_DOWNLINK_OFF', category: 'tip', severity: 1, role: 'GROUND_COMMS', cooldownSec: 30, clearAfterSec: 5, glossaryId: 'ground-contact', target: 'downlink-controls', applies: s => s.phase === 'OPERATE', detect: snap => { const s = snap as OperateReview; return !s.telemetry.downlinkRequested && s.telemetry.nextPassSec !== null && s.telemetry.nextPassSec !== undefined && s.telemetry.nextPassSec <= 600 ? { params: { seconds: s.telemetry.nextPassSec } } : null; } },
 { id: 'STORAGE_FILLING', category: 'alert', severity: 2, role: 'SCIENCE', cooldownSec: 30, clearAfterSec: 5, glossaryId: 'data-storage', target: 'downlink-controls', applies: s => s.phase === 'OPERATE', detect: snap => { const s = snap as OperateReview; return s.telemetry.storageMB > 0 && s.telemetry.storedMB / s.telemetry.storageMB >= .8 ? { params: { storedMB: s.telemetry.storedMB, storageMB: s.telemetry.storageMB } } : null; } },
];
