import type { BuiltinMissionId, Command, Design, LevelId, Quote, SimState } from '../contracts';
import { createStarterDesign, missionById } from '../mission/library';
import { planPropellant, previewOrbit, quoteAddPart, quoteRemovePart } from '../design';
import { issueCommand } from './commands';
import { telemetry } from './selectors';
import { stepSim } from './step';

export function accepted<T>(q: Quote<T>): T { if (!q.ok) throw new Error(`${q.code}: ${JSON.stringify(q.values)}`); return q.value; }
/** Test-only reference hardware; production UI never installs this loadout automatically. */
export function referenceDesign(scenario: BuiltinMissionId, levelId: LevelId = 'ASPIRING'): Design {
 let d = createStarterDesign(missionById(scenario), levelId);
 if (scenario === 'FIRST_LIGHT') {
  for (const id of ['RADIO_UHF', 'SOLAR_BODY']) d = accepted(quoteRemovePart(d, id, 'ALL')).next;
  for (const id of ['RADIO_SBAND', 'SOLAR_WINGS', 'BATT_40', 'CAM_EO']) d = accepted(quoteAddPart(d, id, 'ALL')).next;
 } else if (scenario === 'STORM_WATCH') d = accepted(quoteAddPart(d, 'RAD_MON', 'ALL')).next;
 else if (scenario === 'RED_RELAY') {
  d = accepted(quoteRemovePart(d, 'SS_SOLAR_400', 'ALL')).next;
  for (const id of ['SS_SOLAR_800', 'SS_BATT_300', 'SS_PROP_MONO', 'SS_MAPPER']) d = accepted(quoteAddPart(d, id, 'ALL')).next;
  d = accepted(planPropellant(d, 'ALL')).next;
 }
 if (levelId === 'EXPERT') {
  // Allocated passes plus permanently coarse fallback need four paid radio
  // channels; their standby/transmit load, mass and volume remain physical.
  if (scenario === 'FIRST_LIGHT') {
   d = accepted(quoteRemovePart(d, 'EPS_BATT_20', 'ALL')).next;
   for (let radio = 1; radio < 4; radio++) d = accepted(quoteAddPart(d, 'RADIO_SBAND', 'ALL')).next;
  }
  if (scenario === 'STORM_WATCH') {
   d = accepted(quoteRemovePart(d, 'SOLAR_BODY', 'ALL')).next;
   for (const id of ['SOLAR_WINGS', 'BATT_40']) d = accepted(quoteAddPart(d, id, 'ALL')).next;
  }
  if (scenario !== 'CREW_PATHFINDER') d = accepted(quoteAddPart(d, scenario === 'RED_RELAY' ? 'SS_HEATER_60' : 'HEATER_6', 'ALL')).next;
  if (scenario === 'RED_RELAY') {
   // A wide 24-hour orbit's long eclipse exceeds this battery reserve. Pay the
   // balanced orbit's higher capture demand instead of bypassing that check.
   d = accepted(previewOrbit(d, 'MARS_BALANCED', 'ALL')).next;
   d = accepted(planPropellant(d, 'ALL')).next;
  }
 }
 return d;
}
export function command(state: SimState, cmd: Command): SimState { return accepted(issueCommand(state, cmd, 'ALL')); }
/** Explicitly resumes every decision while preserving the exact requested simulation target. */
export function advanceTo(state: SimState, target: number): SimState {
 let s = state, iterations = 0;
 while (s.t + telemetry(s).remainderSec < target - 1e-7 && !telemetry(s).ended) {
  const result = stepSim(s, Math.min(3600, target - s.t - telemetry(s).remainderSec));
  if (result.state.t === s.t && result.events.length === 0 && telemetry(result.state).remainderSec === telemetry(s).remainderSec) throw new Error('No time progress: resolve cruise/capture before advancing');
  s = result.state;
  if (++iterations > 100000) throw new Error('Advance exceeded deterministic work guard');
 }
 return s;
}

/** Advance a real receipt to resolution; contact and intervening events remain modeled. */
export function resolveCommand(state: SimState, cmd: Command) {
 let s = command(state, cmd); const id = telemetry(s).commandQueue.at(-1)!.id;
 for (let n = 0; n < 20000; n++) {
  const receipt = telemetry(s).commandQueue.find(q => q.id === id);
  if (receipt && (receipt.status === 'DELIVERED' || receipt.status === 'REFUSED' || receipt.status === 'EXPIRED')) return { state: s, receipt };
  if (telemetry(s).ended) throw new Error(`${id}: mission ended before delivery`);
  s = stepSim(s, 60).state;
 }
 throw new Error(`${id}: receipt did not resolve`);
}
export function commandAndWait(state: SimState, cmd: Command): SimState {
 const result = resolveCommand(state, cmd);
 if (result.receipt.status !== 'DELIVERED') throw new Error(`${result.receipt.id}: ${result.receipt.refusal?.code}`);
 return result.state;
}
export function commission(state: SimState): SimState {
 let s = state;
 for (const system of ['WINGS', 'ANTENNA'] as const) {
  const key = system === 'WINGS' ? 'wings' : 'antenna';
  if (telemetry(s).deployment[key] !== 'STOWED') continue;
  s = commandAndWait(s, { kind: 'DEPLOY', system });
  if (telemetry(s).deployment[key] === 'ANOMALOUS') s = commandAndWait(s, { kind: 'DEPLOY_RETRY', system });
 }
 return s;
}
