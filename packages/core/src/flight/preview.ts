// Ascent preview and the bounded, deterministic program search. Both run the same integrator the session flies.
import type { Design, Refusal } from '../contracts';
import type { AscentProgram } from '../mission/types';
import { designMassKg, refusal } from '../design';
import { CONSTANTS } from '../physics';
import { runAscent, type AscentRun } from './ascentRun';
import { LAUNCHER_BY_ID } from './launchers';
import { ascentProgramIssue } from './program';
import { len, radiusOf } from './conic';
import type { AscentPreview, FlightStateView, StateVector } from './types';
import type { QuickApproach } from '../gameplayTypes';

export const MODEL_LIMITS = ['model.limit.pointMassGravity', 'model.limit.ascentAtmosphere', 'model.limit.impulsiveBurns', 'model.limit.patchedConics', 'model.limit.moonOnRails', 'model.limit.noReentry'] as const;
export const MAX_RECOMMENDATION_PREVIEWS = 64;
const MAX_COAST_SEC = 1800;
const viewAt = (design: Design, run: AscentRun): FlightStateView => {
 const sv: StateVector = { body: 'EARTH', frame: 'EARTH_J2000EQ', epochSec: run.tEnd, epochUTC: new Date(Date.parse(design.definition.environment.epochUTC) + run.tEnd * 1000).toISOString(), rKm: [...run.r], vKms: [...run.v] };
 return { central: sv, earth: sv, moon: null, moonEphemeris: null, altitudeKm: len(run.r) - radiusOf('EARTH'), speedKms: len(run.v) };
};
const toPreview = (design: Design, run: AscentRun): AscentPreview => ({
 outcome: run.outcome, samples: run.samples, events: run.events, final: viewAt(design, run), apogeeAltKm: run.apogeeAltKm, perigeeAltKm: run.perigeeAltKm,
 deltaVLossKms: run.loss, propellantRemainingKg: run.propellantKg, limits: MODEL_LIMITS,
});
const NO_LAUNCH: AscentPreview = { outcome: 'NO_LIFTOFF', samples: [], events: [], final: null, apogeeAltKm: 0, perigeeAltKm: null, deltaVLossKms: { gravity: 0, drag: 0, steering: 0 }, propellantRemainingKg: { stage1: 0, stage2: 0 }, limits: MODEL_LIMITS };
/** Preview the authored ascent exactly as it would be flown. Provided-orbit missions and incomplete plans yield a NO_LIFTOFF preview. */
export function previewAscent(design: Design): AscentPreview {
 const launcher = design.launch ? LAUNCHER_BY_ID[design.launch.launcherId] : undefined;
 if (design.definition.start.kind !== 'SURFACE_LAUNCH' || !design.launch || !launcher || ascentProgramIssue(design.launch.program, launcher)) return NO_LAUNCH;
 return toPreview(design, runAscent(design.definition, design.launch, designMassKg(design), 5));
}
const apogeeBand = (design: Design) => design.definition.objectives.find(o => o.required && o.spec.kind === 'APOGEE_BAND')?.spec;
/**
 * Deterministic search: a bounded grid over pitch-kick, vertical rise and coast (plus a local refinement), or a bisection of the stage-1
 * load for apogee-band missions. At most MAX_RECOMMENDATION_PREVIEWS integrations; same inputs, same answer.
 */
export function recommendAscentProgram(design: Design, approach: QuickApproach = 'BALANCED'): { program: AscentProgram; preview: AscentPreview } | Refusal {
 const start = design.definition.start, launcher = design.launch ? LAUNCHER_BY_ID[design.launch.launcherId] : undefined;
 if (start.kind !== 'SURFACE_LAUNCH' || !design.launch || !launcher) return refusal('NO_STAGE', { missing: 'launcher' });
 const payload = designMassKg(design), base = design.launch.program;
 if (payload > launcher.payloadLimitKg + 1e-9) return refusal('PAYLOAD_OVER_LIMIT', { after: payload, limit: launcher.payloadLimitKg, launcher: launcher.id });
 let used = 0;
 const fly = (program: AscentProgram): AscentRun | null => { if (used >= MAX_RECOMMENDATION_PREVIEWS || ascentProgramIssue(program, launcher)) return null; used++; return runAscent(design.definition, { launcherId: launcher.id, program }, payload, 5); };
 const band = apogeeBand(design);
 if (band && band.kind === 'APOGEE_BAND') {
  const mid = band.minAltKm + (band.maxAltKm-band.minAltKm)*(approach==='CAUTIOUS'?.25:approach==='FAST'?.75:.5);
  let lo = 0.05, hi = 1, best: { program: AscentProgram; run: AscentRun } | null = null;
  for (let i = 0; i < 24; i++) {
   const f = (lo + hi) / 2, program = { ...base, verticalSec: Math.min(60,Math.max(2,base.verticalSec)), insertionAltKm: Math.max(150,base.insertionAltKm), kickDeg: 0, holdUpperStage: false, stage1LoadFraction: f }, run = fly(program);
   if (!run) break;
   if (!best || Math.abs(run.apogeeAltKm - mid) < Math.abs(best.run.apogeeAltKm - mid)) best = { program, run };
   if (run.apogeeAltKm < mid) lo = f; else hi = f;
  }
  if (!best || best.run.apogeeAltKm < band.minAltKm || best.run.apogeeAltKm > band.maxAltKm) return refusal('ASCENT_FORECAST_FAILS', { reason: 'no searched program reaches the apogee band' });
  return { program: best.program, preview: toPreview(design, best.run) };
 }
 let best: { program: AscentProgram; run: AscentRun; score: number } | null = null;
 const consider = (kickDeg: number, verticalSec: number, stage2CoastSec: number): void => {
  const program: AscentProgram = { ...base, kickDeg, verticalSec, stage2CoastSec, stage1LoadFraction: 1 }, run = fly(program);
  if (!run || run.outcome !== 'ORBIT' || run.perigeeAltKm === null || run.perigeeAltKm < base.insertionAltKm - 10) return;
  const orbitGoal = design.definition.objectives.find(o => o.required && o.spec.kind === 'BOUND_ORBIT' && o.spec.body === 'EARTH')?.spec;
  if (orbitGoal?.kind === 'BOUND_ORBIT' && (run.perigeeAltKm < orbitGoal.periapsisAltKm.min || run.perigeeAltKm > orbitGoal.periapsisAltKm.max || run.apogeeAltKm < orbitGoal.apoapsisAltKm.min || run.apogeeAltKm > orbitGoal.apoapsisAltKm.max)) return;
  // Efficiency: leave the most propellant in the stage; among equals prefer the lower apogee (less to circularise).
  const score = approach==='CAUTIOUS' ? -run.apogeeAltKm : approach==='FAST' ? -run.tEnd : run.propellantKg.stage2 - 0.001 * run.apogeeAltKm;
  if (!best || score > best.score) best = { program, run, score };
 };
 const kicks = launcher.stages.length > 1 ? [4, 6, 8, 10, 12, 14, 16, 18, 20, 24] : [0];
 for (const kick of kicks) for (const vertical of [6, 10]) for (const coast of launcher.stages.length > 1 ? [0, 30] : [0]) consider(kick, vertical, Math.min(coast, MAX_COAST_SEC));
 const seed = best as { program: AscentProgram } | null;
 if (seed) for (const dk of [-1, -0.5, 0.5, 1]) consider(Math.max(0, seed.program.kickDeg + dk), seed.program.verticalSec, seed.program.stage2CoastSec);
 const found = best as { program: AscentProgram; run: AscentRun } | null;
 if (!found) return refusal('ASCENT_FORECAST_FAILS', { reason: 'no searched program reaches the target orbit', insertionAltKm: base.insertionAltKm, rEarthKm: CONSTANTS.EARTH.radius.v });
 return { program: found.program, preview: toPreview(design, found.run) };
}
