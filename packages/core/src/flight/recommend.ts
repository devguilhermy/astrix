// Burn recommendations for the learning ladder and for custom missions. Pieces are closed-form (vis-viva / Hohmann / escape energy); the lunar
// transfer is aimed against the real engine (patched conics, moving Moon) with a bounded, deterministic search. Nothing here is a lookup table.
import type { Design } from '../contracts';
import type { BurnSpec } from '../mission/types';
import { CONSTANTS } from '../physics';
import { add, conicAtDt, conicFromState, cross, len, orbitInfo, scale, sub, timeToApsis, unit } from './conic';
import { moonState } from './moon';
import { ascentActive, centralStateAt, type CentralState } from '../sim/trajectory';
import { runTrajectory, startState, type TrajectoryRun } from '../sim/trajectoryForecast';
import type { FlightState } from '../sim/state';
import { lambertVelocity } from './lambert';
import type { ObjectiveSpec } from '../mission/types';
import type { QuickApproach } from '../gameplayTypes';

const MU_E = CONSTANTS.EARTH.mu.v, R_E = CONSTANTS.EARTH.radius.v, R_M = CONSTANTS.MOON.radius.v, MU_M = CONSTANTS.MOON.mu.v, D_M = CONSTANTS.MOON.distanceKm.v;
export const MAX_LUNAR_SEARCH_RUNS = 160;
const burn = (id: string, source: BurnSpec['source'], trigger: BurnSpec['trigger'], dvKms: number): BurnSpec => ({ id, source, trigger, frame: 'VNR', dv: [dvKms, 0, 0], model: 'IMPULSIVE' });
const usable = (b: BurnSpec): boolean => b.dv.every(Number.isFinite) && Math.hypot(...b.dv) > 1e-6 && Math.hypot(...b.dv) <= 12;
const visViva = (mu: number, r: number, a: number): number => Math.sqrt(Math.max(0, mu * (2 / r - 1 / a)));
const mid = (r: { min: number; max: number }): number => (r.min + r.max) / 2;

/** The craft as it will be once it is in a coasting trajectory: ascent complete, or the provided orbit at the epoch. */
function coastingState(design: Design): FlightState | null {
 try {
  const s = startState(design);
  if (!ascentActive(s)) return s;
  const run = runTrajectory(design, 7200, undefined, st => !ascentActive(st));
  return ascentActive(run.final) || run.final.ended ? null : run.final;
 } catch { return null; }
}
const sourceOf = (s: FlightState): BurnSpec['source'] => s.traj.stage?.attached && s.traj.stage.restartsLeft > 0 ? 'UPPER_STAGE' : 'SPACECRAFT';
const objectiveOf = <K extends string>(design: Design, kind: K) => design.definition.objectives.find(o => o.spec.kind === kind)?.spec as (Extract<Design['definition']['objectives'][number]['spec'], { kind: K }> | undefined);

export function recommendBurns(design: Design, approach: QuickApproach = 'BALANCED'): readonly BurnSpec[] {
 const m = design.definition.trajectory;
 if (m.model !== 'PATCHED_CONICS' || !m.maneuvers.allowed) return [];
 const s = coastingState(design);
 if (!s) return [];
 const plan = objectiveOf(design, 'ENCOUNTER_DISTANCE') || objectiveOf(design, 'BOUND_ORBIT')?.body === 'MOON' ? lunarPlan(design, s,approach)
  : objectiveOf(design, 'ESCAPE') ? escapePlan(design, s,approach)
  : objectiveOf(design, 'ENTRY_INTERFACE') ? entryPlan(design, s,approach)
  : objectiveOf(design, 'BOUND_ORBIT') ? raisePlan(design, s,approach) : [];
 return plan.filter(usable).slice(0, Math.min(m.maneuvers.maxBurns, 16));
}

/** Prograde burn at periapsis that leaves the planet with a requested excess speed. */
function escapePlan(design: Design, s: FlightState, approach: QuickApproach): BurnSpec[] {
 const goal = objectiveOf(design, 'ESCAPE')!, t = s.t + 60, c = centralStateAt(s, t), r = len(c.r);
 if (c.body !== 'EARTH' || r - R_E < goal.minPeriapsisAltKm) return [];
 const vinf = goal.minExcessSpeedKms + (approach==='CAUTIOUS'?.05:approach==='FAST'?.5:.2);
 return [burn('ESCAPE', sourceOf(s), { kind: 'AT_TIME', tSec: Math.ceil(t) }, Math.sqrt(vinf * vinf + 2 * MU_E / r) - len(c.v))];
}
/** Retrograde burn at apoapsis that lowers periapsis to the entry-interface altitude minus a margin. */
function entryPlan(design: Design, s: FlightState, approach: QuickApproach): BurnSpec[] {
 const goal = objectiveOf(design, 'ENTRY_INTERFACE')!, t = s.t, c = centralStateAt(s, t), info = orbitInfo(c.r, c.v, MU_E);
 if (c.body !== 'EARTH' || info.kind !== 'ELLIPSE' || info.raKm === null) return [];
 const ra = info.raKm, rpTarget = R_E + goal.altitudeKm - (approach==='CAUTIOUS'?10:approach==='FAST'?60:30), a = info.aKm;
 if (rpTarget >= info.rpKm) return [];
 const dv = visViva(MU_E, ra, (ra + rpTarget) / 2) - visViva(MU_E, ra, a);
 return [burn('DEORBIT', sourceOf(s), { kind: 'AT_APSIS', apsis: 'APOAPSIS', notBeforeSec: Math.ceil(t) }, dv)];
}
/** Hohmann pair to a circular orbit at the middle of the periapsis band: raise apoapsis, then circularise there. */
function raisePlan(design: Design, s: FlightState, approach: QuickApproach): BurnSpec[] {
 const goal = objectiveOf(design, 'BOUND_ORBIT')!;
 if (goal.body !== 'EARTH') return [];
 const aim=goal.periapsisAltKm.min+(goal.periapsisAltKm.max-goal.periapsisAltKm.min)*(approach==='CAUTIOUS'?.25:approach==='FAST'?.75:.5);
 const t = s.t + 60, c = centralStateAt(s, t), r1 = len(c.r), r2 = R_E + aim, at = (r1 + r2) / 2;
 if (c.body !== 'EARTH' || Math.abs(r2 - r1) < 1) return [];
 const dv1 = visViva(MU_E, r1, at) - len(c.v), dv2 = Math.sqrt(MU_E / r2) - visViva(MU_E, r2, at);
 const first = burn('RAISE_1', sourceOf(s), { kind: 'AT_TIME', tSec: Math.ceil(t) }, dv1);
 return [first, burn('RAISE_2', sourceOf(s), { kind: 'AT_APSIS', apsis: r2 > r1 ? 'APOAPSIS' : 'PERIAPSIS', notBeforeSec: Math.ceil(t) + 1 }, dv2)];
}

// ---- lunar transfer ------------------------------------------------------------------------------------------------------------------
interface Aim { tBurn: number; dv: number; missKm: number }
/** Prograde speed after the burn so that the transfer apoapsis radius equals raKm, by bisection on the closed-form energy/momentum relation. */
function dvForApoapsis(r: CentralState, raKm: number): number | null {
 const v0 = len(r.v);
 const apo = (speed: number): number => { const info = orbitInfo(r.r, scale(unit(r.v), speed), MU_E); return info.kind !== 'ELLIPSE' || info.raKm === null ? Infinity : info.raKm; };
 let lo = v0, hi = v0 * 1.6;
 if (apo(lo) >= raKm || apo(hi) < raKm) return null;
 for (let i = 0; i < 60; i++) { const midV = (lo + hi) / 2; if (apo(midV) < raKm) lo = midV; else hi = midV; }
 return (lo + hi) / 2 - v0;
}
/** Two-body apoapsis arrival of a candidate burn against the Moon's rail position at that instant. */
function analyticAim(s: FlightState, tBurn: number, raKm: number): Aim | null {
 const c = centralStateAt(s, tBurn), dv = dvForApoapsis(c, raKm);
 if (c.body !== 'EARTH' || dv === null) return null;
 const post = scale(unit(c.v), len(c.v) + dv), conic = conicFromState('EARTH', tBurn, c.r, post), dt = timeToApsis(conic, tBurn, 'APOAPSIS');
 if (dt === null) return null;
 const at = conicAtDt(conic, dt).r, moon = moonState(tBurn + dt, s.epochUTC).r;
 return { tBurn, dv, missKm: len(add(at, scale(moon, -1))) };
}
const closestToMoonKm = (run: TrajectoryRun): number => run.final.traj.encounter?.closestKm ?? run.samples.reduce((n, p) => p.moon ? Math.min(n, len(p.moon)) : n, Infinity);
const encounterDone = (st: FlightState): boolean => st.traj.events.some(e => e.kind === 'ENCOUNTER_CLOSEST') || st.traj.events.some(e => e.kind === 'SOI_EXIT' && st.traj.soiEntryAt !== null);

function lunarPlan(design: Design, s: FlightState, approach: QuickApproach): BurnSpec[] {
 const flyby = objectiveOf(design, 'ENCOUNTER_DISTANCE'), orbit = objectiveOf(design, 'BOUND_ORBIT'), capture = orbit && orbit.body === 'MOON' ? orbit : undefined;
 if (!flyby && !capture) return [];
 if (capture) return lunarCapturePlan(design,s,capture,approach);
 const targetClosestKm = flyby!.minDistanceKm + (approach==='CAUTIOUS'?.65:approach==='FAST'?.2:.35) * (flyby!.maxDistanceKm - flyby!.minDistanceKm);
 const source = sourceOf(s);
 let runs = 0;
 // 1. Coarse in-plane choice: when to burn so the transfer apoapsis meets the Moon (closed-form, no engine runs).
 let best: Aim | null = null;
 const period = 2 * Math.PI * Math.sqrt(Math.pow(len(centralStateAt(s, s.t).r), 3) / MU_E);
 for (let t = s.t + 30; t <= s.t + 2 * period; t += 30) { const aim = analyticAim(s, t, D_M); if (aim && (!best || aim.missKm < best.missKm)) best = aim; }
 if (!best) return [];
 // 2. Engine refinement: the real trajectory, scaling the burn until the closest lunar approach hits the target.
 const trial = (tBurn: number, dv: number): TrajectoryRun => {
  runs++;
  const spec = burn('TLI', source, { kind: 'AT_TIME', tSec: tBurn }, dv);
  return runTrajectory({ ...design, burns: [spec] }, 8 * 86400, undefined, encounterDone);
 };
 const tBurn = Math.round(best.tBurn), f = (x: number): number => closestToMoonKm(trial(tBurn, best!.dv * x));
 let lo = 0.996, hi = 1.004;
 const phi = (Math.sqrt(5) - 1) / 2;
 let x1 = hi - phi * (hi - lo), x2 = lo + phi * (hi - lo), f1 = f(x1), f2 = f(x2);
 for (let i = 0; i < 24 && runs < MAX_LUNAR_SEARCH_RUNS / 2; i++) {
  if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - phi * (hi - lo); f1 = f(x1); } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + phi * (hi - lo); f2 = f(x2); }
 }
 let xMin = (lo + hi) / 2;
 const fMin = f(xMin);
 // 3. Walk to the requested closest approach on the side of the minimum with the larger scale (monotone there), then bisect.
 let xa = xMin, xb = xMin;
 if (fMin < targetClosestKm) {
  for (let step = 2e-6; step < 4e-3 && runs < MAX_LUNAR_SEARCH_RUNS; step *= 2) { xb = xMin + step; if (f(xb) >= targetClosestKm) break; xa = xb; }
  for (let i = 0; i < 28 && runs < MAX_LUNAR_SEARCH_RUNS; i++) { const xm = (xa + xb) / 2; if (f(xm) < targetClosestKm) xa = xm; else xb = xm; }
  xMin = (xa + xb) / 2;
 }
 const dvTli = best.dv * xMin, final = trial(tBurn, dvTli);
 const tli = burn('TLI', source, { kind: 'AT_TIME', tSec: tBurn }, dvTli);
 return closestToMoonKm(final) <= flyby!.maxDistanceKm ? [tli] : [];
}

/** Lambert supplies a three-dimensional departure, then the actual patched-conic
 * engine solves its B-plane offset. Capture is sized from the measured lunar
 * periapsis, not from a sphere-of-influence encounter or a scripted outcome. */
function lunarCapturePlan(design: Design,s: FlightState,goal: Extract<ObjectiveSpec,{kind:'BOUND_ORBIT'}>,approach: QuickApproach): BurnSpec[] {
 const origin=centralStateAt(s,s.t),normal=cross(origin.r,origin.v),period=2*Math.PI*Math.sqrt(Math.pow(len(origin.r),3)/MU_E);
 let best:{t:number;duration:number;dv:number}|null=null;
 for (const duration of (approach==='FAST'?[3]:approach==='CAUTIOUS'?[5]:[3,4,5]).map(days=>days*86400)) for(let t=Math.ceil(s.t+120);t<s.t+2*period;t+=60) {
  const c=centralStateAt(s,t),moon=moonState(t+duration,s.epochUTC),v=lambertVelocity(c.r,moon.r,duration,MU_E,normal);
  if(!v)continue;
  const dv=len(sub(v,c.v));
  if(!best||dv<best.dv)best={t,duration,dv};
 }
 if(!best)return [];
 const departure=centralStateAt(s,best.t),moon=moonState(best.t+best.duration,s.epochUTC);
 const ideal=lambertVelocity(departure.r,moon.r,best.duration,MU_E,normal)!;
 const arrival=conicAtDt(conicFromState('EARTH',best.t,departure.r,ideal),best.duration);
 const bDirection=unit(cross(sub(arrival.v,moon.v),moon.r));
 const target=R_M+Math.min(Math.max(100,goal.periapsisAltKm.min+25),goal.periapsisAltKm.max);
 const make=(offset:number):BurnSpec|null=>{
  const v=lambertVelocity(departure.r,add(moon.r,scale(bDirection,offset)),best!.duration,MU_E,normal);
  return v?{id:'TLI',source:sourceOf(s),trigger:{kind:'AT_TIME',tSec:best!.t},frame:'INERTIAL',dv:sub(v,departure.v),model:'IMPULSIVE'}:null;
 };
 let runs=0;
 const trial=(offset:number):{spec:BurnSpec;run:TrajectoryRun;closest:number}|null=>{
  const spec=make(offset);if(!spec||runs++>=MAX_LUNAR_SEARCH_RUNS)return null;
  try {const run=runTrajectory({...design,burns:[spec]},8*86400,undefined,encounterDone);return {spec,run,closest:closestToMoonKm(run)};}catch{return null;}
 };
 let centre=0,minimum=Number.MAX_VALUE;
 for(let offset=-18000;offset<=18000;offset+=3000){const r=trial(offset);if(r&&r.closest<minimum){minimum=r.closest;centre=offset;}}
 let lo=centre-3000,hi=centre+3000;
 // Golden search locates the centre of the actual encounter corridor, including Earth/Moon frame patches.
 const phi=(Math.sqrt(5)-1)/2;
 let x1=hi-phi*(hi-lo),x2=lo+phi*(hi-lo),r1=trial(x1),r2=trial(x2);
 for(let i=0;i<20;i++){
  if((r1?.closest??Number.MAX_VALUE)<(r2?.closest??Number.MAX_VALUE)){hi=x2;x2=x1;r2=r1;x1=hi-phi*(hi-lo);r1=trial(x1);}
  else{lo=x1;x1=x2;r1=r2;x2=lo+phi*(hi-lo);r2=trial(x2);}
 }
 let lower=(lo+hi)/2,upper=lower+2000;
 const closest=trial(lower);if(!closest||closest.closest>target)return [];
 for(let i=0;i<8;i++){const r=trial(upper);if(r&&r.closest>=target)break;upper+=2000;}
 for(let i=0;i<28;i++){const midOffset=(lower+upper)/2,r=trial(midOffset);if(!r)return [];if(r.closest<target)lower=midOffset;else upper=midOffset;}
 const selected=trial((lower+upper)/2);if(!selected)return [];
 const at=selected.run.final,c=centralStateAt(at,at.t);
 if(c.body!=='MOON'||selected.closest< R_M+goal.periapsisAltKm.min||selected.closest>R_M+goal.periapsisAltKm.max)return [];
 const rp=len(c.r),ra=R_M+Math.max(rp-R_M+10,Math.min(1500,mid(goal.apoapsisAltKm))),dv=len(c.v)-visViva(MU_M,rp,(rp+ra)/2);
 const stage=at.traj.stage,source=stage?.attached&&stage.restartsLeft>0?'UPPER_STAGE':'SPACECRAFT';
 return [selected.spec,burn('LOI',source,{kind:'AT_APSIS',apsis:'PERIAPSIS',notBeforeSec:best.t+86400,body:'MOON'},-dv)];
}
