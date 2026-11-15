import type { ActorRole, ActorContext, Command, Quote, Refusal, SimEvent, SimState } from '../contracts';
import { PART_BY_ID } from '../catalog';
import { commandRole, ownsRole, refusal } from '../design';
import { ENGINEERING, isTechnical } from '../models';
import { CONSTANTS, lightTime } from '../physics';
import { addBurn, ascentActive, burnCapacityRefusal, burnSpecValid, cancelBurn, separateStage } from './trajectory';
import { cloneFlight, enterSafe, flight, recordAudit, stationRangeKm, type FlightState, transmittingRate, updateEnvironment, uplinkAvailable } from './state';
import { fail } from './failure';
import { crewReturnFuel, crewReturnWindow, CREW_DEORBIT_BURN_SEC } from '../return';
import { normalizeAttitude } from '../attitude';
import { refreshAttitude, requestHold } from './attitude';

const technicalCommand = (cmd: Command): boolean => ['HEATER', 'LINK_MODE', 'DUTY_CYCLE', 'REACQUIRE_POINTING', 'RECOVER_COMPUTER'].includes(cmd.kind);
export const bootPowerW = (s: FlightState): number => ENGINEERING.bootPower.v * (s.design.busId === 'SMALLSAT' ? 10 : 1);
export const bootEnergyWh = (s: FlightState): number => bootPowerW(s) * ENGINEERING.bootSec.v / 3600;
function validateCommand(s: FlightState, cmd: Command): Refusal | null {
 if (s.ended) return refusal('NOT_READY', { missing: 'active mission' });
 if (ascentActive(s)) return refusal('NOT_READY', { missing: 'orbit insertion' });
 if (technicalCommand(cmd) && !isTechnical(s.design.levelId)) return refusal('LEVEL_FORBIDS', { levelId: s.design.levelId });
 if (cmd.kind === 'ATTITUDE_TARGET') {
  if (s.safe) return refusal('MODE_FORBIDS', { mode: 'SAFE' });
  if (!s.design.parts.some(i => PART_BY_ID[i.partId].category === 'ADCS')) return refusal('REQUIRES_PART', { needs: 'ADCS' });
  if (s.pointing.faulted && !s.pointing.reacquisitions) return refusal('POINTING_DEGRADED');
  if (s.pointing.state === 'REACQUIRING') return refusal('POINTING_ACQUIRING');
 }
 if (cmd.kind === 'CAPTURE_CONFIRM') return s.capturePending ? null : refusal('NOT_READY', { missing: 'capture burn decision' });
 if (cmd.kind === 'DEPLOY' || cmd.kind === 'DEPLOY_RETRY') { const current = s.deployment[cmd.system === 'WINGS' ? 'wings' : 'antenna']; return current === (cmd.kind === 'DEPLOY' ? 'STOWED' : 'ANOMALOUS') ? null : refusal('NOT_READY', { missing: 'deployable in expected state' }); }
 if (cmd.kind.startsWith('CREW_')) { if (!s.crew) return refusal('NOT_READY', { missing: 'crew' }); if (cmd.kind === 'CREW_DEORBIT') { const window = crewReturnWindow(s.elapsed), fuel = crewReturnFuel(s.design.orbit!, s.dryMassKg + s.propellantKg - s.crew.ventedKg, s.ispSec); if (!['ON_ORBIT', 'DEORBIT'].includes(s.crew.phase) || !window.open) return refusal('NOT_READY', { missing: 'return window', nextSec: window.nextSec }); if (fuel > s.propellantKg) return refusal('RETURN_FUEL_SHORT', { requiredKg: fuel, availableKg: s.propellantKg }); } return null; }
 if (s.cruise || s.capturePending) return refusal('NOT_READY', { missing: 'capture' });
 if (cmd.kind === 'RECOVER_COMPUTER') {
  if (s.computerState === 'RUNNING') return refusal('NOT_READY', { missing: 'computer reset' });
  if (s.computerState === 'RECOVERING') return refusal('NOT_READY', { missing: 'recovery completion' });
  if (s.t < s.cooldownUntil) return refusal('RECOVERY_COOLDOWN', { remainingSec: s.cooldownUntil - s.t });
  const requiredWh = bootEnergyWh(s) + (s.baseLoadW + s.ratedHeaterW) * ENGINEERING.bootSec.v / 3600;
  if (s.socWh + 1e-9 < requiredWh) return refusal('INSUFFICIENT_ENERGY', { availableWh: s.socWh, requiredWh });
  return null;
 }
 if (s.computerState !== 'RUNNING') return refusal('COMPUTER_REBOOTING', { state: s.computerState });
 if (cmd.kind === 'ATTITUDE_TARGET') return null;
 if (cmd.kind === 'BURN_SCHEDULE') { const code = burnCapacityRefusal(s, cmd.burn); return code ? refusal(code) : null; }
 if (cmd.kind === 'BURN_CANCEL') return s.traj.burns.some(b => b.spec.id === cmd.id) ? null : refusal('BURN_UNKNOWN', { id: cmd.id });
 if (cmd.kind === 'SEPARATE_STAGE') return s.traj.stage?.attached ? null : refusal('NO_STAGE');
 if (cmd.kind === 'SAFE') return null;
 if (cmd.kind === 'HEATER') return s.ratedHeaterW > 0 ? null : refusal('REQUIRES_PART', { needs: 'THERMAL' });
 if (cmd.kind === 'LINK_MODE') return null;
 if (cmd.kind === 'REACQUIRE_POINTING') {
  if (!s.pointing.faulted) return refusal('NOT_READY', { missing: 'degraded pointing fault' });
  if (s.pointing.state === 'REACQUIRING' || s.pointing.reacquisitions > 0) return refusal('NOT_READY', { missing: 'unrecovered pointing fault' });
  if (s.safe) return refusal('MODE_FORBIDS', { mode: 'SAFE' });
  const powerW = ENGINEERING.reacquirePower.v * (s.design.busId === 'SMALLSAT' ? 10 : 1), requiredWh = (s.baseLoadW + powerW) * ENGINEERING.reacquireSec.v / 3600;
  return s.socWh < requiredWh ? refusal('INSUFFICIENT_ENERGY', { availableWh: s.socWh, requiredWh }) : null;
 }
 if (cmd.kind === 'POINT') {
  if (s.safe && cmd.mode !== 'SAFE') return refusal('MODE_FORBIDS', { mode: 'SAFE' });
  if ((cmd.mode === 'TARGET' || cmd.mode === 'EARTH') && !s.design.parts.some(i => PART_BY_ID[i.partId].category === 'ADCS')) return refusal('REQUIRES_PART', { needs: 'ADCS' });
  if ((cmd.mode === 'TARGET' || cmd.mode === 'EARTH') && s.pointing.faulted && s.pointing.reacquisitions === 0) return refusal('POINTING_DEGRADED');
  if (s.pointing.state === 'REACQUIRING' && cmd.mode !== 'SAFE') return refusal('POINTING_ACQUIRING', { remainingSec: Math.max(0, (s.pointingReadyAt ?? s.t) - s.t) });
  return null;
 }
 if (cmd.kind === 'INSTRUMENT' || cmd.kind === 'DUTY_CYCLE') {
  const instrument = s.instruments.find(i => i.partId === cmd.partId);
  if (!instrument) return refusal('REQUIRES_PART', { needs: cmd.partId });
  if (cmd.kind === 'DUTY_CYCLE') return Number.isFinite(cmd.fraction) && cmd.fraction >= 0 && cmd.fraction <= 1 ? null : refusal('INVALID_PARAMETER', { parameter: 'fraction', min: 0, max: 1 });
  if (cmd.on && (s.safe || instrument.lost || s.socWh <= 0)) return refusal('MODE_FORBIDS', { mode: instrument.lost ? 'LOST' : s.mode });
  return null;
 }
 if (cmd.kind !== 'DOWNLINK') return refusal('INVALID_PARAMETER');
 if (!cmd.on) return null;
 if (!s.design.parts.some(i => PART_BY_ID[i.partId].category === 'RADIO' && i.partId !== 'SS_UHF_RELAY')) return refusal('REQUIRES_PART', { needs: 'RADIO' });
 if (s.safe) return refusal('MODE_FORBIDS', { mode: 'SAFE' });
 // Arming a transmitter is not a pointing claim: actual directional throughput uses antenna error.
 // Technical commands arm a persistent send request; the independent receiver can
 // receive it outside a high-rate downlink opportunity. Geometry still gates data.
 if (!isTechnical(s.design.levelId) && !s.crew && !s.inContact) return refusal('NO_CONTACT');
 if (s.storedMB <= 0) return refusal('STORAGE_EMPTY');
 return null;
}
export function applyCommand(s: FlightState, cmd: Command, events: SimEvent[]): Refusal | null {
 const blocked = validateCommand(s, cmd);
 if (blocked) return blocked;
 switch (cmd.kind) {
  case 'DEPLOY': case 'DEPLOY_RETRY': { const key = cmd.system === 'WINGS' ? 'wings' : 'antenna'; const anomaly = cmd.kind === 'DEPLOY' && ((s.seed + (key === 'wings' ? 1 : 2)) % (s.design.parts.some(p => p.partId === 'DEPLOY_MITIGATION') ? 17 : 7) === 0); s.deployment[key] = anomaly ? 'ANOMALOUS' : 'DEPLOYED'; events.push({ kind: anomaly ? 'DEPLOYMENT_ANOMALY' : 'DEPLOYMENT_DONE', t: s.t, autoPause: anomaly, values: { system: cmd.system } }); break; }
  case 'CREW_FAN': s.crew!.fanOn = cmd.on; break;
  case 'CREW_CARTRIDGE': { const c = s.crew!; const old = c.scrubberKg; c.scrubberKg = c.spareScrubberKg; c.spareScrubberKg = old; break; }
  case 'CREW_ISOLATE': s.crew!.isolated = cmd.isolated; break;
  case 'CREW_REPRESSURIZE': { const c = s.crew!, n = Math.min(c.nitrogenKg, Math.max(0, 7.2-c.cabinNitrogenKg)), o = Math.min(c.oxygenKg, Math.max(0, 2.2-c.cabinOxygenKg)); c.nitrogenKg -= n; c.cabinNitrogenKg += n; c.oxygenKg -= o; c.cabinOxygenKg += o; break; }
  case 'CREW_PRIORITIZE_POWER': s.crew!.prioritizePower = cmd.on; if (cmd.on) enterSafe(s); break;
  case 'CREW_DEORBIT': { const fuel = crewReturnFuel(s.design.orbit!, s.dryMassKg + s.propellantKg - s.crew!.ventedKg, s.ispSec); s.propellantKg -= fuel; s.crew!.phase = 'RECOVERY'; events.push({ kind: 'CREW_DEORBIT', t: s.t, autoPause: true, values: { fuelKg: fuel, burnSec: CREW_DEORBIT_BURN_SEC } }, { kind: 'CREW_RECOVERY', t: s.t, autoPause: true, values: { remainingSec: s.crew!.recoveryRemainingSec } }); break; }
  case 'SAFE':
   if (cmd.on) enterSafe(s);
   else { s.safe = false; requestHold(s,'SUN'); s.pointing.quality = s.pointing.faulted && !s.pointing.reacquisitions ? 0 : 1; }
   break;
  case 'ATTITUDE_TARGET':
   s.attitude.target = normalizeAttitude(cmd.q); s.attitude.hold = 'MANUAL'; s.pointing.state = 'ACQUIRING'; s.pointingReadyAt = null;
   refreshAttitude(s);
   break;
  case 'POINT':
   if (cmd.mode === 'SAFE') enterSafe(s);
   else requestHold(s,cmd.mode);
   break;
  case 'BURN_SCHEDULE': addBurn(s, cmd.burn); break;
  case 'BURN_CANCEL': cancelBurn(s, cmd.id); break;
  case 'SEPARATE_STAGE': separateStage(s, events); break;
  case 'HEATER': s.heaterMode = cmd.mode; break;
  case 'LINK_MODE': s.linkMode = cmd.mode; break;
  case 'DUTY_CYCLE': s.instruments.find(i => i.partId === cmd.partId)!.dutyFraction = cmd.fraction; break;
  case 'REACQUIRE_POINTING': s.pointing.state = 'REACQUIRING'; s.pointing.quality = 0; s.pointingReadyAt = s.t + ENGINEERING.reacquireSec.v; break;
  case 'RECOVER_COMPUTER': s.computerState = 'RECOVERING'; s.bootReadyAt = s.t + ENGINEERING.bootSec.v; break;
  case 'INSTRUMENT': s.instruments.find(i => i.partId === cmd.partId)!.on = cmd.on; break;
  case 'DOWNLINK': s.downlinkRequested = cmd.on; break;
  case 'CAPTURE_CONFIRM': {
   if (s.captureAvailableKms + 1e-9 < s.captureRequiredKms || !s.ispSec) { fail(s, 'CAPTURE_FAILED', events); break; }
   const fuel = (s.dryMassKg + s.propellantKg) * -Math.expm1(-s.captureRequiredKms * 1000 / (s.ispSec * CONSTANTS.g0.v));
   s.propellantKg = Math.max(0, s.propellantKg - fuel);
   s.capturePending = false; s.captured = true; s.elapsed = 0;
   updateEnvironment(s);
   events.push({ kind: 'CAPTURE_DONE', t: s.t, autoPause: true, values: { fuelConsumedKg: fuel, fuelRemainingKg: s.propellantKg, requiredKms: s.captureRequiredKms, nominalKms: s.captureNominalKms, planningKms: s.capturePlanningKms, uncertaintyFraction: s.captureUncertainty } });
   break;
  }
 }
 s.downlinkActive = transmittingRate(s) > 0 && s.storedMB > 0;
 return null;
}
const pending = (status: string): boolean => status === 'WAITING_CONTACT' || status === 'IN_TRANSIT';
/** Explicit operations plans execute onboard; ground commands retain their contact/light-time transport. */
export function issuePlanCommand(state: SimState, cmd: Command): Quote<SimState> { return enqueueCommand(state,cmd,'ALL',undefined,true); }
export function issueCommand(state: SimState, cmd: Command, role: ActorRole, actor?: ActorContext): Quote<SimState> { return enqueueCommand(state,cmd,role,actor,false); }
function enqueueCommand(state: SimState, cmd: Command, role: ActorRole, actor: ActorContext | undefined, plan: boolean): Quote<SimState> {
 const old = flight(state), owner = commandRole(cmd);
 if (actor && actor.role !== role) return refusal('ROLE_LOCKED', { role });
 if (!ownsRole(role, owner) && !(cmd.kind === 'POINT' && role === 'SPACECRAFT')) return refusal('ROLE_LOCKED', { role: owner });
 if (old.ended) return refusal('NOT_READY', { missing: 'active mission' });
 if (ascentActive(old)) return refusal('NOT_READY', { missing: 'orbit insertion' });
 if (cmd.kind === 'BURN_SCHEDULE' && !burnSpecValid(cmd.burn)) return refusal('INVALID_PARAMETER', { parameter: 'burn' });
 if (cmd.kind === 'BURN_CANCEL' && (typeof cmd.id !== 'string' || cmd.id.length === 0 || cmd.id.length > 24)) return refusal('INVALID_PARAMETER', { parameter: 'id' });
 if (technicalCommand(cmd) && !isTechnical(old.design.levelId)) return refusal('LEVEL_FORBIDS', { levelId: old.design.levelId });
 if (cmd.kind === 'ATTITUDE_TARGET') {
  try { cmd = { ...cmd, q: normalizeAttitude(cmd.q) }; }
  catch { return refusal('INVALID_PARAMETER', { parameter: 'q' }); }
  if (cmd.gestureId !== undefined && (typeof cmd.gestureId !== 'string' || cmd.gestureId.length > 128)) return refusal('INVALID_PARAMETER', { parameter: 'gestureId' });
 }
 if ((cmd.kind === 'INSTRUMENT' || cmd.kind === 'DUTY_CYCLE') && !old.instruments.some(i => i.partId === cmd.partId)) return refusal('REQUIRES_PART', { needs: cmd.partId });
 if (cmd.kind === 'DUTY_CYCLE' && (!Number.isFinite(cmd.fraction) || cmd.fraction < 0 || cmd.fraction > 1)) return refusal('INVALID_PARAMETER', { parameter: 'fraction', min: 0, max: 1 });
 if (old.cruise || old.capturePending || cmd.kind === 'CAPTURE_CONFIRM') {
  const blocked = validateCommand(old, cmd);
  if (blocked) return blocked;
 }
 const s = cloneFlight(old);
 const actorContext = { role: actor?.role ?? role, ...(actor?.playerId ? { playerId: actor.playerId } : {}) };
 if (cmd.kind === 'ATTITUDE_TARGET' && cmd.gestureId) {
  const index = s.queue.findIndex(q => q.status === 'WAITING_CONTACT' && q.command.kind === 'ATTITUDE_TARGET' && q.command.gestureId === cmd.gestureId && q.actor.role === actorContext.role && q.actor.playerId === actorContext.playerId);
  if (index >= 0) {
   s.queue[index] = { ...s.queue[index], command: { ...cmd } };
   recordAudit(s, { t: s.t, kind: 'COMMAND_UPDATED', actor: actorContext, owner, transport: 'GROUND', revision: s.design.revision, detail: `${s.queue[index].id}:ATTITUDE_TARGET` });
   applyDueCommands(s,s.pendingEvents);
   return { ok: true, value: s };
  }
 }
 const id = `command-${s.nextCommandId++}`;
 const crewSteering = !!s.crew && (cmd.kind === 'POINT' || cmd.kind === 'ATTITUDE_TARGET');
 const onboard = cmd.kind !== 'CAPTURE_CONFIRM' && (plan || crewSteering || cmd.kind.startsWith('CREW_') || cmd.kind === 'DEPLOY' || cmd.kind === 'DEPLOY_RETRY');
 const receipt = { id, command: cmd.kind === 'ATTITUDE_TARGET' ? { ...cmd, q: [...cmd.q] as const } : { ...cmd }, issuedAt: s.t, expiresAt: s.t + ENGINEERING.commandLifetimeSec.v, actor: actorContext, transport: onboard ? 'ONBOARD' as const : 'GROUND' as const };
 recordAudit(s, { t: s.t, kind: 'COMMAND_REQUEST', actor: receipt.actor, owner, transport: receipt.transport, revision: s.design.revision, detail: `${id}:${cmd.kind}` });
 if (onboard) {
  const blocked = validateCommand(s, cmd); if (blocked) return blocked;
  if (cmd.kind === 'CREW_DEORBIT' && (s.crew!.phase !== 'ON_ORBIT' || !crewReturnWindow(s.elapsed + CREW_DEORBIT_BURN_SEC).open)) return refusal('NOT_READY', { missing: 'return window', nextSec: crewReturnWindow(s.elapsed + CREW_DEORBIT_BURN_SEC).nextSec });
  const duration = crewSteering ? 0 : cmd.kind === 'CREW_DEORBIT' ? CREW_DEORBIT_BURN_SEC : cmd.kind === 'DEPLOY' || cmd.kind === 'DEPLOY_RETRY' ? 30 : 60;
  s.queue.push({ ...receipt, transmittedAt: s.t, applyAt: s.t + duration, resolvedAt: null, status: 'IN_TRANSIT' });
  if (cmd.kind === 'CREW_DEORBIT') { s.crew!.phase = 'DEORBIT'; s.crew!.orbitEndSec = s.elapsed; }
  if (crewSteering) applyDueCommands(s,s.pendingEvents);
 } else if (cmd.kind !== 'CAPTURE_CONFIRM') {
  s.queue.push({ ...receipt, transmittedAt: null, applyAt: null, resolvedAt: null, status: 'WAITING_CONTACT' });
  applyDueCommands(s, s.pendingEvents);
 } else {
  const blocked = applyCommand(s, cmd, s.pendingEvents);
  if (blocked) return blocked;
  s.queue.push({ ...receipt, transmittedAt: s.t, applyAt: s.t, resolvedAt: s.t, status: 'DELIVERED' });
  recordAudit(s, { t: s.t, kind: 'COMMAND_EXECUTED', actor: receipt.actor, owner, transport: receipt.transport, revision: s.design.revision, detail: `${id}:${cmd.kind}` });
 }
 let complete = 0;
 for (const entry of s.queue) if (!pending(entry.status)) complete++;
 if (complete > 128) {
  let remove = complete - 128;
  s.queue = s.queue.filter(entry => pending(entry.status) || remove-- <= 0);
 }
 return { ok: true, value: s };
}
export function applyDueCommands(s: FlightState, events: SimEvent[]): void {
 for (let i = 0; i < s.queue.length; i++) {
  let entry = s.queue[i];
  if (!pending(entry.status)) continue;
  if (entry.expiresAt <= s.t + 1e-8) {
   s.queue[i] = { ...entry, status: 'EXPIRED', resolvedAt: s.t, refusal: refusal('COMMAND_EXPIRED', { expiresAt: entry.expiresAt }) };
   events.push({ kind: 'COMMAND_EXPIRED', t: s.t, autoPause: true, values: { commandId: entry.id, issuedAt: entry.issuedAt, expiresAt: entry.expiresAt } });
   continue;
  }
  if (entry.status === 'WAITING_CONTACT') {
   if (!uplinkAvailable(s)) continue;
   entry = { ...entry, transmittedAt: s.t, applyAt: s.t + (s.mars ? lightTime(s.t, s.epochUTC) : s.design.definition.environment.commLightTime ? stationRangeKm(s) / CONSTANTS.c.v : 0), status: 'IN_TRANSIT' };
   s.queue[i] = entry;
  }
  if (entry.applyAt === null || entry.applyAt > s.t + 1e-8) continue;
  const invalidated = entry.transport === 'GROUND' && isTechnical(s.design.levelId) && s.computerState === 'RUNNING' && entry.issuedAt < s.commandEpochStartedAt && entry.command.kind !== 'RECOVER_COMPUTER' && !(entry.command.kind === 'SAFE' && entry.command.on);
  const blocked = invalidated ? refusal('COMMAND_INVALIDATED', { resetAt: s.commandEpochStartedAt, issuedAt: entry.issuedAt }) : applyCommand(s, entry.command, events);
  if (blocked && entry.command.kind === 'CREW_DEORBIT' && s.crew) { s.crew.phase = 'ON_ORBIT'; s.crew.orbitEndSec = null; }
  s.queue[i] = { ...entry, status: blocked ? 'REFUSED' : 'DELIVERED', resolvedAt: s.t, ...(blocked ? { refusal: blocked } : {}) };
  recordAudit(s, { t: s.t, kind: blocked ? 'COMMAND_REFUSED' : 'COMMAND_EXECUTED', actor: entry.actor, owner: commandRole(entry.command), transport: entry.transport, revision: s.design.revision, detail: `${entry.id}:${entry.command.kind}` });
  if (blocked) events.push({ kind: 'COMMAND_REFUSED', t: s.t, autoPause: true, values: { commandId: entry.id, code: blocked.code } });
 }
}
