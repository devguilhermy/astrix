// Runs the ascent integrator to completion without a session. Preview, readiness, budgets and recommendations all use this one code path,
// which is also what the flight engine steps, so a forecast cannot disagree with the flown result except through later commands.
import type { LaunchPlan } from '../contracts';
import type { ResolvedMissionDefinition } from '../mission/types';
import { CONSTANTS, type Vec3 } from '../physics';
import { ASCENT_MAX_SEC, ATMOSPHERE_TOP_KM, advanceAscent, altitudeKm, ascentSample, massOf, startAscent, type AscentState } from './ascent';
import { len, orbitInfo, type OrbitInfo } from './conic';
import type { AscentSample, TrajectoryEvent } from './types';

const RE = CONSTANTS.EARTH.radius.v, MU = CONSTANTS.EARTH.mu.v;
export interface AscentRun {
 outcome: 'ORBIT' | 'SUBORBITAL_RETURN' | 'IMPACT_DURING_BURN' | 'ESCAPE' | 'NO_LIFTOFF'; samples: AscentSample[]; events: TrajectoryEvent[];
 tEnd: number; r: Vec3; v: Vec3; info: OrbitInfo | null; apogeeAltKm: number; perigeeAltKm: number | null;
 loss: { gravity: number; drag: number; steering: number }; propellantKg: { stage1: number; stage2: number }; massKg: number; state: AscentState | null;
}
export function runAscent(definition: ResolvedMissionDefinition, plan: LaunchPlan, payloadKg: number, sampleEverySec = 5): AscentRun {
 const start = definition.start;
 if (start.kind !== 'SURFACE_LAUNCH') throw new RangeError('Ascent needs a surface-launch definition');
 const initial = startAscent(plan.launcherId, plan.program, payloadKg, start.site, definition.environment.epochUTC);
 const empty = { samples: [], events: [], tEnd: 0, r: [0, 0, 0] as Vec3, v: [0, 0, 0] as Vec3, info: null, apogeeAltKm: 0, perigeeAltKm: null, loss: { gravity: 0, drag: 0, steering: 0 }, propellantKg: { stage1: 0, stage2: 0 }, massKg: payloadKg, state: null };
 if (!initial || initial.phase === 'FAILED') return { outcome: 'NO_LIFTOFF', ...empty };
 const a: AscentState = initial;
 const events: TrajectoryEvent[] = [], samples: AscentSample[] = [ascentSample(a)];
 let nextSample = sampleEverySec;
 while (a.phase !== 'HANDOFF' && a.phase !== 'FAILED' && a.t < ASCENT_MAX_SEC) {
  advanceAscent(a, a.t + sampleEverySec, e => events.push(e));
  if (a.t + 1e-9 >= nextSample) { samples.push(ascentSample(a)); nextSample = a.t + sampleEverySec; }
 }
 samples.push(ascentSample(a));
 const info = orbitInfo(a.r, a.v, MU);
 const base = { samples, events, tEnd: a.t, r: a.r, v: a.v, loss: { gravity: a.lossGravity, drag: a.lossDrag, steering: a.lossSteering }, propellantKg: { stage1: a.prop1, stage2: a.prop2 }, massKg: massOf(a), state: a };
 if (a.phase === 'FAILED') return { outcome: a.cutoff === 'NONE' ? 'IMPACT_DURING_BURN' : 'SUBORBITAL_RETURN', ...base, info: null, apogeeAltKm: a.maxAltKm, perigeeAltKm: null };
 if (a.phase !== 'HANDOFF') return { outcome: 'SUBORBITAL_RETURN', ...base, info: null, apogeeAltKm: a.maxAltKm, perigeeAltKm: null };
 const rp = info.rpKm - RE, ra = info.raKm === null ? Math.max(a.maxAltKm, altitudeKm(a.r)) : info.raKm - RE;
 return { outcome: info.kind !== 'ELLIPSE' ? 'ESCAPE' : rp >= ATMOSPHERE_TOP_KM ? 'ORBIT' : 'SUBORBITAL_RETURN', ...base, info, apogeeAltKm: Math.max(a.maxAltKm, ra), perigeeAltKm: rp };
}
export const speedKms = (r: AscentRun): number => len(r.v);
