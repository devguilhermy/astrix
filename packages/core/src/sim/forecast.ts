import type { Command, Design, MissionForecast, SimState, TimelineForecast, TimelineWindow } from '../contracts';
import { PART_BY_ID } from '../catalog';
import { DAY } from '../physics';
import { isTechnical } from '../models';
import { issueCommand } from './commands';
import { environmentAt } from './environment';
import { cloneFlight, createSim, deepSpace, flight, stormBounds } from './state';
import { allRequiredMet, evidenceOf, objectiveValue, primaryObjective } from './objectives';
import { ascentActive, nextTrajectoryBoundary } from './trajectory';
import { skipCruise, stepSim } from './step';
import { crewReturnWindow } from '../return';

/** Seven-day, <=4096-cell geometry forecast; transition times resolved to 0.25 s. */
export function forecastTimeline(state: SimState, horizonSec: number): TimelineForecast {
 if (!Number.isFinite(horizonSec) || horizonSec < 0) throw new RangeError('Timeline horizon must be finite and non-negative');
 const s = cloneFlight(flight(state)), startSec = s.t, requestedEnd = startSec + Math.min(horizonSec,7*DAY);
 const missionEnd = s.crew?.phase === 'RECOVERY' ? s.t+s.crew.recoveryRemainingSec : s.arrivalT + s.design.definition.environment.durationSec + (s.crew ? 21610 : 0);
 // A state-vector coast is only valid until its next frame change, impact or burn; later geometry belongs to another segment.
 const endSec = s.ended || ascentActive(s) ? startSec : Math.max(startSec,Math.min(requestedEnd,missionEnd,s.cruise ? s.arrivalT : Infinity,nextTrajectoryBoundary(s)));
 const windows: TimelineWindow[] = [];
 const point = (at: number, labelKey?: string, kind: TimelineWindow['kind'] = 'EVENT') => {
  if (Number.isFinite(at) && at >= startSec && at <= endSec) windows.push({ kind, startSec: at, endSec: at, labelKey });
 };
 if (!s.ended && !s.cruise && !s.capturePending && endSec > startSec) {
  const active = (kind: TimelineWindow['kind'], at: number): boolean => {
   const e = environmentAt(s,at);
   if (kind === 'SUNLIGHT') return e.sunlit;
   if (kind === 'ECLIPSE') return !e.sunlit;
   if (kind === 'CONTACT') return e.inContact;
   // Targets are the nadir surface, not an invented fixed geographic science site.
   return e.sunlit && s.instruments.some(i => PART_BY_ID[i.partId].requiresTarget);
  };
  const step = Math.max(10,(endSec-startSec)/4096);
  for (const kind of ['SUNLIGHT','ECLIPSE','CONTACT','TARGET'] as const) {
   let previous = active(kind,startSec), opened = startSec;
   for (let left = startSec; left < endSec;) {
    const right = Math.min(endSec,left+step), current = active(kind,right);
    if (current !== previous) {
     let lo = left, hi = right;
     while (hi-lo > .25) { const mid = (lo+hi)/2; if (active(kind,mid) === previous) lo = mid; else hi = mid; }
     const edge = (lo+hi)/2;
     if (previous) windows.push({ kind,startSec: opened,endSec: edge }); else opened = edge;
     previous = current;
    }
    left = right;
   }
   if (previous && endSec > opened) windows.push({ kind,startSec: opened,endSec });
  }
  const [stormStart,stormEnd] = stormBounds(s), a = Math.max(startSec,s.arrivalT+stormStart), b = Math.min(endSec,s.arrivalT+stormEnd);
  if (b > a) windows.push({ kind: 'STORM',startSec: a,endSec: b,labelKey: 'event.SOLAR_STORM_START.title' });
  if (!s.aged) point(s.arrivalT+s.agingAt,'event.BATTERY_AGING.title');
  if (!s.outageStarted && !deepSpace(s)) point(s.arrivalT+s.outageAt,'event.GROUND_OUTAGE.title');
  if (isTechnical(s.design.levelId)) {
   if (!s.pointingFaultSeen) point(s.arrivalT+s.pointingFaultAt,'event.POINTING_DEGRADED.title');
   if (!s.resetSeen) point(s.arrivalT+s.resetAt,'event.COMPUTER_RESET.title');
   if (!s.linkDegradeSeen) point(s.arrivalT+s.linkDegradeAt,'event.LINK_DEGRADED.title');
   if (!s.linkRestoreSeen) point(s.arrivalT+s.linkRestoreAt,'event.LINK_RECOVERED.title');
  }
 }
 for (const e of s.pendingEvents) point(e.t,`event.${e.kind}.title`);
 for (const q of s.queue) if (q.status === 'IN_TRANSIT' && q.applyAt !== null) point(q.applyAt);
 if (s.cruise) point(s.arrivalT,'event.CAPTURE_BURN.title');
 else if (!s.ended) point(missionEnd,'event.MISSION_END.title','MISSION_END');
 windows.sort((a,b) => a.startSec-b.startSec || a.endSec-b.endSec || a.kind.localeCompare(b.kind));
 return { startSec,endSec,windows };
}

/**
 * Ordinary public-command policy. Radio transport, finite slew, failures and all
 * pause boundaries remain authoritative. Horizon means operational time after
 * analytical cruise; a full crew orbit includes its finite return/recovery tail.
 */
export function forecastMission(design: Design, policy: 'DEFAULT', horizonSec: number): MissionForecast {
 if (policy !== 'DEFAULT' || !Number.isFinite(horizonSec) || horizonSec < 0) throw new RangeError('Unsupported forecast policy/horizon');
 const def = design.definition, horizon = Math.min(horizonSec,90*DAY);
 // structuredClone drops nothing a design needs; the embedded definition is plain data.
 let state = createSim(structuredClone(design),def.environment.seed);
 if (flight(state).cruise) {
  state = skipCruise(state).state;
  const capture = issueCommand(state,{ kind: 'CAPTURE_CONFIRM' },'ALL');
  if (capture.ok) state = capture.value;
 }
 const arrival = flight(state).arrivalT, fullCrew = def.support.crew && horizon >= def.environment.durationSec;
 const end = arrival+horizon+(fullCrew ? 21610 : 0), interval = Math.max(60,(end-arrival)/510);
 const samples: { t: number; socWh: number; storedMB: number; downlinkedMB: number }[] = [];
 let nextSample = arrival, guard = 0;
 const record = () => { const s = flight(state); const sample = { t: s.t,socWh: s.socWh,storedMB: s.storedMB,downlinkedMB: s.downlinkedMB }; if (samples.at(-1)?.t === s.t) samples[samples.length-1] = sample; else samples.push(sample); };
 const request = (command: Command) => {
  const s = flight(state);
  if (s.queue.some(q => (q.status === 'WAITING_CONTACT' || q.status === 'IN_TRANSIT') && q.command.kind === command.kind && (command.kind !== 'INSTRUMENT' || q.command.kind === 'INSTRUMENT' && q.command.partId === command.partId))) return;
  const quote = issueCommand(state,command,'ALL');
  if (quote.ok) state = quote.value;
 };
 record(); nextSample += interval;
 while (!flight(state).ended && state.t < end-1e-7) {
  let s = flight(state);
  if (s.capturePending || s.cruise) break;
  for (const system of ['WINGS','ANTENNA'] as const) {
   const status = s.deployment[system === 'WINGS' ? 'wings' : 'antenna'];
   if (status === 'STOWED' || status === 'ANOMALOUS') request({ kind: status === 'STOWED' ? 'DEPLOY' : 'DEPLOY_RETRY',system });
  }
  if (s.crew) {
   if (s.crew.scrubberKg < .1 && s.crew.spareScrubberKg > s.crew.scrubberKg) request({ kind: 'CREW_CARTRIDGE' });
   if (s.crew.leakActive && !s.crew.isolated) request({ kind: 'CREW_ISOLATE',isolated: true });
   else if (s.crew.isolated && (s.crew.cabinNitrogenKg < 6 || s.crew.cabinOxygenKg < 2.16)) request({ kind: 'CREW_REPRESSURIZE' });
   if (s.elapsed >= def.environment.durationSec && s.crew.phase === 'ON_ORBIT' && crewReturnWindow(s.elapsed).open) request({ kind: 'CREW_DEORBIT' });
  }
  if (s.computerState === 'REBOOTING') { if (s.t >= s.cooldownUntil) request({ kind: 'RECOVER_COMPUTER' }); }
  else if (s.computerState === 'RUNNING') {
   if (s.safe) request({ kind: 'SAFE',on: false });
   else if (s.pointing.faulted && !s.pointing.reacquisitions) { if (s.pointing.state !== 'REACQUIRING') request({ kind: 'REACQUIRE_POINTING' }); }
   else {
    if (isTechnical(design.levelId)) {
     const mode = s.linkQuality < 1 ? 'ROBUST' : 'NORMAL';
     if (s.linkMode !== mode) request({ kind: 'LINK_MODE',mode });
    }
    const done = objectiveValue(s) >= primaryObjective(s).target;
    const send = s.inContact && s.storedMB > 0;
    const hoursMode = def.objectives.some(o => o.spec.kind === 'INSTRUMENT_HOURS'), observe = !done && (hoursMode || s.sunlit && s.storedMB < s.storageMB*.8);
    const hold = send ? 'EARTH' : observe && !hoursMode ? 'TARGET' : 'SUN';
    if (s.attitude.hold !== hold) request({ kind: 'POINT',mode: hold });
    for (const i of s.instruments) if (i.on !== observe) request({ kind: 'INSTRUMENT',partId: i.partId,on: observe });
    if (send && !s.downlinkRequested) request({ kind: 'DOWNLINK',on: true });
   }
  }
  s = flight(state);
  // Smaller than one fixed tick is retained as a remainder by stepSim. Never add
  // it twice when an event has stopped progress at the same simulation instant.
  // Land exactly at the nominal onboard return decision. Event-aligned ticks
  // can offset a 60 s review cadence; overshooting would cut real recovery short.
  const policyBoundary = fullCrew && s.crew?.phase === 'ON_ORBIT' && s.elapsed < def.environment.durationSec ? Math.min(end,arrival+def.environment.durationSec) : end;
  const remaining = policyBoundary-s.t-s.remainderSec;
  const dt = Math.max(0,Math.min(60,remaining));
  const result = stepSim(state,dt);
  if (result.state.t === state.t && result.events.length === 0 && flight(result.state).remainderSec === s.remainderSec) break;
  state = result.state;
  if (state.t >= nextSample) { record(); nextSample += interval; }
  if (++guard > 150000) throw new RangeError('Forecast exceeded bounded operations work');
 }
 record();
 const s = flight(state), primary = primaryObjective(s);
 return { policy,samples,outcome: s.firstFailure ? 'FAILURE' : s.ended && !s.sessionEnded && allRequiredMet(s) ? 'SUCCESS' : 'INCOMPLETE',objectiveValue: primary.value,objectiveTarget: primary.target,endedAtSec: s.t,evidence: evidenceOf(s),events: s.traj.events.slice() };
}
