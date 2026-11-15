// Kinematic forecast of the flight engine: the same ascent integrator, conic propagation, frame changes and burn executor the session steps,
// without the power/thermal/data subsystems. It assumes an operating, unsafed computer (a planning forecast, not a flown result).
import type { Design, SimState } from '../contracts';
import type { BurnSpec } from '../mission/types';
import { add, len, radiusOf } from '../flight/conic';
import { moonState } from '../flight/moon';
import type { BurnPreview, FlightStateView, StateVector, TrajectoryEvent, TrajectoryForecast, TrajectorySampleView } from '../flight/types';
import { cloneFlight, createSim, flight, type FlightState } from './state';
import { addBurn, burnCapacityRefusal, burnSpecValid, advanceAscentTo, applyTrajectory, ascentActive, fullView, handoffAscent, nextTrajectoryBoundary, orbitTelemetry } from './trajectory';
import type { SimEvent } from '../contracts';

const viewOf = (v: StateVector): FlightStateView => {
 if (v.body === 'MARS') throw new RangeError('Burn forecasts require an Earth/Moon trajectory');
 const lunar = v.body === 'MOON' ? moonState(0, v.epochUTC) : null;
 const earth: StateVector = lunar ? { ...v, body: 'EARTH', frame: 'EARTH_J2000EQ', rKm: add(v.rKm, lunar.r), vKms: add(v.vKms, lunar.v) } : v;
 return { central: v, earth, moon: lunar ? v : null, moonEphemeris: lunar ? { ...earth, rKm: lunar.r, vKms: lunar.v } : null, altitudeKm: len(v.rKm) - radiusOf(v.body), speedKms: len(v.vKms) };
};
export const MAX_FORECAST_HORIZON_SEC = 30 * 86400;
export const MAX_FORECAST_SAMPLES = 720;
const isDesign = (from: SimState | Design): from is Design => 'parts' in from && 'definition' in from;
export function startState(from: SimState | Design): FlightState { return cloneFlight(isDesign(from) ? flight(createSim(from, from.definition.environment.seed)) : flight(from)); }

export interface TrajectoryRun { final: FlightState; samples: TrajectorySampleView[]; events: TrajectoryEvent[]; sim: SimEvent[] }
/** Advance a private copy of the flight state to `horizonSec` after its current time, honouring scheduled burns and predicted frame changes exactly. */
export function runTrajectory(from: SimState | Design, horizonSec: number, extraBurn?: BurnSpec, stopWhen?: (s: FlightState) => boolean): TrajectoryRun {
 if (!Number.isFinite(horizonSec)||horizonSec<0) throw new RangeError('Trajectory horizon must be finite and non-negative');
 const s = startState(from), end = s.t + Math.min(Math.max(0, horizonSec), MAX_FORECAST_HORIZON_SEC), events: SimEvent[] = [], samples: TrajectorySampleView[] = [];
 const dt = Math.max(30, (end - s.t) / MAX_FORECAST_SAMPLES);
 const sample = (): void => { const v = fullView(s, s.t); samples.push({ t: s.t, earth: [...v.earth!.rKm], moon: v.moon ? [...v.moon.rKm] : null, body: v.central.body }); };
 if (extraBurn) addBurn(s, extraBurn);
 sample();
 let nextSample = s.t + dt;
 for (let guard = 0; s.t < end - 1e-9 && !s.ended && guard < 400000; guard++) {
  applyTrajectory(s, events, { impact: () => { s.ended = true; } });
  if (s.ended || stopWhen?.(s)) break;
  if (ascentActive(s)) {
   const a = s.traj.ascent!;
   advanceAscentTo(s, Math.min(end, s.t + 5), events);
   s.elapsed = s.t - s.arrivalT;
   if (a.phase === 'HANDOFF') handoffAscent(s);
   else if (a.phase === 'FAILED') s.ended = true;
  } else {
   let t = Math.min(end, nextTrajectoryBoundary(s), nextSample);
   if (!(t > s.t)) t = s.t + 1e-3;
   s.t = t; s.elapsed = s.t - s.arrivalT;
  }
  if (s.t + 1e-9 >= nextSample) { sample(); nextSample = s.t + dt; }
 }
 if (samples[samples.length - 1].t < s.t) sample();
 return { final: s, samples, events: s.traj.events.slice(), sim: events };
}
const EMPTY_FORECAST: TrajectoryForecast = { samples: [], events: [], encounter: null, burns: [] };
/** An incomplete design (no launch plan, rejected by the engine at creation) has no trajectory; that is an empty forecast, not an exception. */
export function forecastTrajectory(from: SimState | Design, horizonSec: number): TrajectoryForecast {
 let run: TrajectoryRun;
 try { run = runTrajectory(from, horizonSec); } catch { return EMPTY_FORECAST; }
 const enc = run.final.traj.encounter;
 return { samples: run.samples, events: run.events, encounter: enc ? { closestKm: enc.closestKm, atSec: enc.atSec, body: 'MOON' } : null, burns: run.final.traj.receipts.map(r => ({ burnId: r.id, feasible: r.status === 'EXECUTED' || r.status === 'PARTIAL', achievedDvKms: r.achievedDvKms, propellantKg: r.propellantUsedKg, before: viewOf(r.before), after: r.after ? viewOf(r.after) : null, orbitAfter: null, events: [] })) };
}
/** Execute one burn in a private copy and report exactly what the engine would do with it, including partial and refused outcomes. */
export function previewBurn(from: SimState | Design, burn: BurnSpec): BurnPreview {
 let base: FlightState;
 try { base = startState(from); } catch { return { burnId: String(burn?.id), feasible: false, achievedDvKms: 0, propellantKg: 0, before: null, after: null, orbitAfter: null, events: [], refusal: 'ASCENT_FORECAST_FAILS' }; }
 const emptyView = fullView(base, base.t);
 if (!burnSpecValid(burn)) return { burnId: String(burn?.id), feasible: false, achievedDvKms: 0, propellantKg: 0, before: emptyView, after: null, orbitAfter: null, events: [], refusal: 'INVALID_PARAMETER' };
 const capacity = burnCapacityRefusal(base, burn);
 if (capacity) return { burnId: burn.id, feasible: false, achievedDvKms: 0, propellantKg: 0, before: emptyView, after: null, orbitAfter: null, events: [], refusal: capacity };
 const horizon = burn.trigger.kind === 'AT_TIME' ? Math.max(1, burn.trigger.tSec - base.t + 1) : MAX_FORECAST_HORIZON_SEC;
 const run = runTrajectory(from, horizon, burn, st => st.traj.receipts.some(r => r.id === burn.id)), receipt = run.final.traj.receipts.find(r => r.id === burn.id);
 const before = receipt ? viewOf(receipt.before) : emptyView;
 if (!receipt) return { burnId: burn.id, feasible: false, achievedDvKms: 0, propellantKg: 0, before, after: null, orbitAfter: null, events: run.events, refusal: 'BURN_TRIGGER_PAST' };
 const executed = receipt.status === 'EXECUTED' || receipt.status === 'PARTIAL';
 return { burnId: burn.id, feasible: receipt.status === 'EXECUTED', achievedDvKms: receipt.achievedDvKms, propellantKg: receipt.propellantUsedKg, before, after: executed && receipt.after ? viewOf(receipt.after) : null, orbitAfter: executed ? orbitTelemetry(run.final) : null, events: run.events, ...(receipt.status === 'REFUSED' ? { refusal: 'PROPELLANT_SHORT' as const } : receipt.status === 'MISSED' ? { refusal: 'BURN_TRIGGER_PAST' as const } : {}) };
}
