import { beforeEach, describe, expect, test } from 'bun:test';
import { attemptAudit, computeBudgets, history, listScenarios, makeOrbit, planPropellant, quoteAddPart, rolesAffectedBy, telemetry } from '@astrix/core';
import { applyRemoteResult, applyRemoteSnapshot, getSessionState, liveMission, ROLES, STAGES, SUBSTEPS, readBest, setIntentSink, tickLocalSession, useMission } from './index';
import { toPublicSnapshot } from '@astrix/session';
import type { SessionIntent } from '@astrix/session';

function reachLaunch(){
 const s=useMission.getState();s.updateArtifacts({objectiveConfirmed:true});expect(s.completeStage()).toBe(true);expect(s.completeStage()).toBe(true);expect(s.completeStage()).toBe(true);
 const d=useMission.getState().design!,candidate=d.busId==='SMALLSAT'?'SS_RAD':'MAG',quote=quoteAddPart(d,candidate,'ALL');expect(quote.ok).toBe(true);if(!quote.ok)throw new Error('Expected design comparison');
 s.recordTrade(candidate,d.revision,computeBudgets(d),computeBudgets(quote.value.next),'ALL');expect(s.freezeBaseline()).toBe(true);expect(s.completeStage()).toBe(true);s.signOff();expect(s.verifyBaseline()).toBe(true);expect(s.completeStage()).toBe(true);
}
function launchEarth() {
 const store=useMission.getState();store.startScenario('FIRST_LIGHT','ASPIRING');store.addPart('CAM_EO');reachLaunch();store.launch();
 expect(useMission.getState().sim).not.toBeNull();expect(useMission.getState().activeView).toBe('OPERATE');expect(useMission.getState().activeStage).toBe('IMPLEMENT');
}
beforeEach(()=>{
 useMission.getState().resetMission();
 useMission.getState().setTeam(1);
 useMission.getState().setSettings({presentation:'GUIDED'});
});

describe('design authority and signoffs',()=>{
 test('quotes refuse another role without changing design or budgets',()=>{
  const store=useMission.getState();store.setTeam(2);store.startScenario('FIRST_LIGHT');store.dismissHandoff();store.setActiveRole('SCIENCE');
  const before=useMission.getState().design,budgets=useMission.getState().budgets;
  store.addPart('SOLAR_WINGS');
  expect(useMission.getState().lastRefusal?.code).toBe('ROLE_LOCKED');
  expect(useMission.getState().design).toBe(before);
  expect(useMission.getState().budgets).toBe(budgets);
 });
 test('successful real edits clear every affected signoff',()=>{
  const store=useMission.getState();store.startScenario('FIRST_LIGHT');store.addPart('CAM_EO');store.signOff();
  expect(Object.values(useMission.getState().signoffs).every(Boolean)).toBe(true);
  const before=useMission.getState().design!;
  store.addPart('STORAGE_32G');
  const after=useMission.getState().design!;
  expect(after).not.toBe(before);
  for(const role of rolesAffectedBy(before,after))expect(useMission.getState().signoffs[role]).toBe(false);
 });
 test('critical current-domain cue blocks signing and increments the attempt count',()=>{
  const store=useMission.getState();store.setTeam(2);store.startScenario('FIRST_LIGHT');store.dismissHandoff();store.setActiveRole('GROUND_COMMS');store.removePart('RADIO_UHF');
  store.signOff();
  expect(useMission.getState().lastRefusal?.code).toBe('SIGNOFF_BLOCKED');
  expect(useMission.getState().signoffs.GROUND_COMMS).toBe(false);
  expect(useMission.getState().team.blockedSignoffAttempts).toBe(1);
 });
 test('future stages and review cannot be opened before their gates',()=>{
  const store=useMission.getState();store.startScenario('FIRST_LIGHT');
  const design=useMission.getState().design,budgets=useMission.getState().budgets;
  for(const stage of STAGES){store.setStage(stage);for(const step of SUBSTEPS[stage])store.setSubstep(step);}
  store.setView('OPERATE');store.setView('REPORT');
  expect(useMission.getState().activeView).toBe('GOAL');
  expect(useMission.getState().sim).toBeNull();
  expect(useMission.getState().design).toBe(design);
  expect(useMission.getState().budgets).toBe(budgets);
  expect(useMission.getState().lastRefusal).toBeNull();
 });
 test('roles map exactly once across two, three and four hot-seat players',()=>{
  for(const count of [2,3,4]){
   useMission.getState().setTeam(count);
   expect(useMission.getState().players.flat().slice().sort()).toEqual([...ROLES].sort());
   useMission.getState().assignRole('SCIENCE',count-1);
   expect(useMission.getState().players.flat().filter(r=>r==='SCIENCE')).toHaveLength(1);
  }
 });
});

describe('learning pauses preserve authoritative state',()=>{
 test('Explain pauses before capture, never advances and never auto-resumes',()=>{
  launchEarth();const store=useMission.getState();store.resume();store.advance(1,true);
  const sim=liveMission.state!,before=telemetry(sim),design=useMission.getState().design,team=useMission.getState().team;
  store.openExplanation('battery-storage','ui.battery-storage');
  expect(useMission.getState().running).toBe(false);
  expect(useMission.getState().explanation?.snapshot.telemetry).toEqual(before);
  store.advance(100,true);
  expect(liveMission.state).toBe(sim);
  expect(useMission.getState().design).toBe(design);
  expect(useMission.getState().team).toBe(team);
  store.closeExplanation();
  expect(useMission.getState().running).toBe(false);
  expect(useMission.getState().learningPause).toBe(true);
  expect(telemetry(liveMission.state!)).toEqual(before);
  store.resume();expect(useMission.getState().running).toBe(true);
 });
 test('Explain leaves the unresolved decision and command receipts unchanged',()=>{
  launchEarth();
  const actions=useMission.getState();actions.resume();
  for(let n=0;n<22&&!useMission.getState().pendingDecisions.length;n++)actions.advance(4000,true);
  const pending=useMission.getState().pendingDecisions;expect(pending.length).toBeGreaterThan(0);
  const store=useMission.getState(),sim=liveMission.state!,queue=store.telemetry!.commandQueue;
  store.openExplanation('ground-contact','event.PASS_START');
  store.closeExplanation();store.resume();
  expect(useMission.getState().running).toBe(false);
  expect(useMission.getState().pendingDecisions).toEqual(pending);
  expect(liveMission.state).toBe(sim);
  expect(useMission.getState().telemetry!.commandQueue).toBe(queue);
 });
 test('presentation switching does not replace state, issue a command or change level',()=>{
  launchEarth();const store=useMission.getState(),sim=liveMission.state,design=store.design;
  store.setSettings({presentation:'DETAILED'});store.setSettings({presentation:'GUIDED'});
  expect(liveMission.state).toBe(sim);expect(useMission.getState().design).toBe(design);
  expect(useMission.getState().levelId).toBe('ASPIRING');
 });
 test('flight commands respect current role and a refusal is atomic',()=>{
  launchEarth();
  const actions=useMission.getState();actions.pause('settings');actions.setTeam(2);actions.assignRole('GROUND_COMMS',0);actions.setActiveRole('SCIENCE');actions.dismissHandoff();actions.clearPauseReason('settings');
  const before=liveMission.state;
  expect(useMission.getState().command({kind:'SAFE',on:true})).toBe(false);
  expect(useMission.getState().lastRefusal?.code).toBe('ROLE_LOCKED');
  expect(liveMission.state).toBe(before);
 });
 test('a flight tour blocks time and closing it never resumes the clock',()=>{
  launchEarth();const store=useMission.getState();store.resume();store.pause('tour');
  const before=liveMission.state,queue=store.telemetry!.commandQueue;
  store.resume();store.advance(100,true);
  expect(liveMission.state).toBe(before);expect(useMission.getState().running).toBe(false);
  store.clearPauseReason('tour');expect(useMission.getState().running).toBe(false);
  expect(useMission.getState().telemetry!.commandQueue).toBe(queue);
  store.resume();expect(useMission.getState().running).toBe(true);
 });
 test('manual steering above 10x refuses without changing the spacecraft or receipts',()=>{
  launchEarth();const store=useMission.getState();store.setWarp(100);
  const before=liveMission.state,receipts=store.telemetry!.commandQueue;
  expect(store.command({kind:'ATTITUDE_TARGET',q:[0,0,0,1]},'gesture-a')).toBe(false);
  expect(liveMission.state).toBe(before);expect(useMission.getState().telemetry!.commandQueue).toBe(receipts);
  expect(useMission.getState().lastRefusal?.code).toBe('INVALID_PARAMETER');
  store.setWarp(10);
  expect(store.command({kind:'ATTITUDE_TARGET',q:[0,0,0,1]},'gesture-a')).toBe(true);
  expect(useMission.getState().telemetry!.commandQueue.at(-1)?.command.kind).toBe('ATTITUDE_TARGET');
 });
});

describe('atomic reset',()=>{
 test('new mission clears all transient slices and live refs in one publication',()=>{
  launchEarth();const store=useMission.getState();store.openExplanation('energy-budget','ui.energy-budget');
  let publications=0;const unsubscribe=useMission.subscribe(()=>publications++);
  store.resetMission();unsubscribe();const reset=useMission.getState();
  expect(publications).toBe(1);expect(reset.activeView).toBe('GOAL');expect(reset.activeStage).toBe('NEED_GOALS');
  expect(reset.sim).toBeNull();expect(reset.design).toBeNull();expect(reset.budgets).toBeNull();
  expect(reset.telemetry).toBeNull();expect(reset.explanation).toBeNull();expect(reset.running).toBe(false);
  expect(reset.pendingDecisions).toHaveLength(0);expect(reset.events).toHaveLength(0);
  expect(reset.cues.active).toHaveLength(0);expect(liveMission.state).toBeNull();expect(liveMission.telemetry).toBeNull();
  expect(Object.values(reset.signoffs).every(s=>!s)).toBe(true);
 });
 test('redesign keeps paid hardware and orbit, but never a running simulation',()=>{
  launchEarth();const before=useMission.getState().design,brief=useMission.getState().artifacts;
  let publications=0;const unsubscribe=useMission.subscribe(()=>publications++);
  useMission.getState().resetMission(true);unsubscribe();const reset=useMission.getState();
  expect(publications).toBe(1);expect(reset.activeView).toBe('DESIGN');expect(reset.activeStage).toBe('DESIGN');
  expect(reset.design?.parts).toEqual(before?.parts);expect(reset.design?.orbit).toEqual(before?.orbit);
  expect(reset.artifacts?.objectiveConfirmed).toBe(true);expect(reset.artifacts?.segments).toEqual(brief?.segments);
  expect(reset.artifacts?.trade).toBeNull();expect(reset.artifacts?.baselineRevision).toBeNull();expect(reset.artifacts?.verifiedRevision).toBeNull();
  expect(Object.values(reset.signoffs).every(value=>!value)).toBe(true);
  expect(reset.sim).toBeNull();expect(reset.running).toBe(false);expect(liveMission.state).toBeNull();
 });
 test('retaining hardware cannot skip a briefing the player never accepted',()=>{
  const store=useMission.getState();store.startScenario('FIRST_LIGHT','ASPIRING');
  store.resetMission(true);
  const reset=useMission.getState();
  expect(reset.activeStage).toBe('NEED_GOALS');expect(reset.artifacts?.objectiveConfirmed).toBe(false);
  expect(reset.completeStage()).toBe(false);expect(reset.sim).toBeNull();
 });
});

describe('Mars arrival and delayed authority',()=>{
 test('a Mars design without a viable capture plan cannot pass verification',()=>{
  const store=useMission.getState();store.startScenario('RED_RELAY');store.addPart('SS_MAPPER');
  store.updateArtifacts({objectiveConfirmed:true});expect(store.completeStage()).toBe(true);expect(store.completeStage()).toBe(true);expect(store.completeStage()).toBe(true);
  const design=useMission.getState().design!,quote=quoteAddPart(design,'SS_RAD','ALL');expect(quote.ok).toBe(true);if(!quote.ok)throw new Error('Expected comparison');
  store.recordTrade('SS_RAD',design.revision,computeBudgets(design),computeBudgets(quote.value.next),'ALL');expect(store.freezeBaseline()).toBe(true);expect(store.completeStage()).toBe(true);store.signOff();
  expect(store.verifyBaseline()).toBe(false);expect(useMission.getState().sim).toBeNull();
 });
 test('queued Mars pointing remains unapplied during a learning pause',()=>{
  const store=useMission.getState();store.startScenario('RED_RELAY','ASPIRING');
  store.setRide('RIDE_MARS_TRANSFER');store.addPart('SS_PROP_MONO');store.addPart('SS_MAPPER');
  store.setOrbit(makeOrbit('MARS',400,33000,0,listScenarios().find(s=>s.id==='RED_RELAY')!.epoch));
  const fuel=planPropellant(useMission.getState().design!,'ALL');expect(fuel.ok).toBe(true);
  store.applyDesign(fuel);reachLaunch();store.launch();
  store.skipCruise();store.decide([{kind:'CAPTURE_CONFIRM'}]);
  while(useMission.getState().pendingDecisions.length)store.decide([]);
  const before=useMission.getState().telemetry!.mode;
  expect(store.command({kind:'POINT',mode:'TARGET'})).toBe(true);
  const queued=useMission.getState().telemetry!;
  expect(queued.mode).toBe(before);expect(queued.queued).toBe(1);
  const receipt=queued.commandQueue.at(-1)!;expect(['WAITING_CONTACT','IN_TRANSIT']).toContain(receipt.status);if(receipt.status==='WAITING_CONTACT')expect(receipt.applyAt).toBeNull();else expect(receipt.applyAt).toBeGreaterThan(queued.t);
  const state=liveMission.state;store.resume();store.openExplanation('command-delay','ui.command-delay');
  store.advance(1000,true);store.closeExplanation();
  expect(liveMission.state).toBe(state);expect(useMission.getState().telemetry).toBe(queued);
  expect(useMission.getState().running).toBe(false);
 });
});

describe('independent lifecycle and practice orchestration',()=>{
 test('in-flight inspection neither pauses nor edits frozen hardware',()=>{
  launchEarth();const store=useMission.getState();store.resume();
  const sim=liveMission.state,design=store.design;
  for(const stage of STAGES){store.setStage(stage);for(const step of SUBSTEPS[stage])store.setSubstep(step);}
  expect(useMission.getState().running).toBe(true);
  expect(liveMission.state).toBe(sim);
  store.addPart('STORAGE_32G');
  expect(useMission.getState().design).toBe(design);
  expect(liveMission.state).toBe(sim);
  expect(useMission.getState().lastRefusal?.code).toBe('NOT_READY');
 });
 test('pause reasons coexist and closing one does not clear another',()=>{
  launchEarth();const store=useMission.getState();store.resume();store.pause('settings');
  store.openExplanation('energy-budget','ui.energy-budget');store.clearPauseReason('settings');store.resume();
  expect(useMission.getState().running).toBe(false);
  expect(useMission.getState().pauseReasons).toContain('explanation');
  store.pause('hidden');store.closeExplanation();store.resume();
  expect(useMission.getState().pauseReasons).toContain('hidden');
  expect(useMission.getState().running).toBe(false);
  store.clearPauseReason('hidden');
  expect(useMission.getState().running).toBe(false);
  store.resume();expect(useMission.getState().running).toBe(true);
 });
 test('chooser preview and cancel retain flight, telemetry, view and generation',()=>{
  launchEarth();const store=useMission.getState();store.setView('DESIGN');store.resume();
  const sim=liveMission.state,design=store.design,generation=liveMission.generation;
  store.previewScenario('RED_RELAY','EXPERT');
  expect(useMission.getState().previewMissionId).toBe('RED_RELAY');
  expect(useMission.getState().running).toBe(false);
  expect(liveMission.state).toBe(sim);expect(useMission.getState().design).toBe(design);
  store.cancelPreview();
  expect(useMission.getState().previewMissionId).toBeNull();
  expect(useMission.getState().activeView).toBe('OPERATE');
  expect(liveMission.generation).toBe(generation);
  expect(liveMission.state).toBe(sim);expect(useMission.getState().running).toBe(false);
 });
 test('launch confirmation rejects a changed revision',()=>{
  const store=useMission.getState();store.startScenario('FIRST_LIGHT');store.addPart('CAM_EO');reachLaunch();const revision=useMission.getState().design!.revision;
  store.addPart('STORAGE_32G');
  expect(store.launch(revision)).toBe(false);expect(useMission.getState().sim).toBeNull();
  expect(useMission.getState().lastRefusal?.code).toBe('NOT_READY');
 });
 test('practice retry restores a coherent immutable checkpoint and marks core assistance',()=>{
  launchEarth();const store=useMission.getState(),checkpoint=getSessionState().practiceCheckpoints[0];
  const original=structuredClone(checkpoint.snapshot);
  store.command({kind:'SAFE',on:true});store.resume();store.advance(100,true);
  store.saveCheckpoint('decision');store.saveCheckpoint('arrival');store.saveCheckpoint('decision');
  expect(useMission.getState().practiceCheckpoints.length).toBeLessThanOrEqual(3);
  store.retryCheckpoint(checkpoint.id);const restored=useMission.getState();
  expect(restored.assisted).toBe(true);expect(restored.telemetry!.assisted).toBe(true);
  const beforeTelemetry=telemetry(original.sim);expect(restored.telemetry!.t).toBe(beforeTelemetry.t);expect(restored.telemetry!.socWh).toBe(beforeTelemetry.socWh);expect(restored.telemetry!.storedMB).toBe(beforeTelemetry.storedMB);expect(attemptAudit(restored.sim!).entries.at(-1)?.kind).toBe('REWIND');
  expect(history(restored.sim!)).toEqual(history(original.sim));
  expect(restored.events).toEqual(original.events);expect(restored.pendingDecisions).toEqual(original.pendingDecisions);
  expect(restored.telemetry!.commandQueue).toEqual(telemetry(original.sim).commandQueue);
  expect(restored.design).toEqual(original.design);expect(restored.team).toEqual(original.team);
  expect(restored.running).toBe(false);expect(checkpoint.snapshot).toEqual(original);
  expect(restored.practiceCheckpoints.every(item=>item.id<=checkpoint.id)).toBe(true);
 });
 test('self-paced advance uses bounded real steps and cancellation rejects stale callbacks',()=>{
  launchEarth();const original=globalThis.requestAnimationFrame,queue:FrameRequestCallback[]=[];
  globalThis.requestAnimationFrame=callback=>{queue.push(callback);return queue.length;};
  try{
   const store=useMission.getState(),start=liveMission.state;
   store.advanceToEvent();expect(liveMission.state).toBe(start);
   store.cancelAdvance();store.advanceToEvent();
   queue.shift()!(0);expect(liveMission.state).toBe(start);
   let frames=0;while(queue.length&&frames++<80)queue.shift()!(0);
   const end=useMission.getState();
   expect(end.running).toBe(false);expect(end.advancing).toBe(false);
   expect(end.telemetry!.t).toBeGreaterThan(0);expect(end.telemetry!.t).toBeLessThanOrEqual(86400);
   expect(end.pendingDecisions.length>0||end.telemetry!.ended||end.advanceMessage==='limit'||end.advanceMessage==='event').toBeTruthy();
  }finally{globalThis.requestAnimationFrame=original;}
 });
 test('timeline advance carries sub-tick time once instead of overshooting its target',()=>{
  launchEarth();const original=globalThis.requestAnimationFrame,queue:FrameRequestCallback[]=[];
  globalThis.requestAnimationFrame=callback=>{queue.push(callback);return queue.length;};
  try{
   const store=useMission.getState();
   for(const target of [1,2,10]){
    store.advanceToEvent(target);
    let frames=0;while(queue.length&&frames++<80)queue.shift()!(0);
    const clock=useMission.getState().telemetry!;
    expect(clock.t).toBeLessThanOrEqual(target);
    expect(clock.t+clock.remainderSec).toBe(target);
    expect(useMission.getState().running).toBe(false);expect(useMission.getState().advancing).toBe(false);
   }
   expect(useMission.getState().telemetry!.t).toBe(10);
  }finally{globalThis.requestAnimationFrame=original;}
 });
 test('best scores are namespaced by mission, level and rules',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null}});
  try{
   values.set('astrix.best.FIRST_LIGHT.EDUCATIVE.ENGINEER.2','99');
   values.set('astrix.best.FIRST_LIGHT.ASPIRING.3','7');
   values.set('astrix.best.FIRST_LIGHT.EXPERT.3','11');
   expect(readBest('FIRST_LIGHT','ASPIRING',3)).toBe(7);
   expect(readBest('FIRST_LIGHT','EXPERT',3)).toBe(11);
   expect(readBest('FIRST_LIGHT','ASPIRING',2)).toBe(0);
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
 });
});

describe('remote projection boundary',()=>{
 test('remote browsers never advance or write a second mission and role tabs do not hand off',()=>{
  launchEarth();const local=getSessionState(),intents:SessionIntent[]=[];
  setIntentSink(intent=>{intents.push(intent);},{playerId:local.roster[0].id,isHost:false});
  try{
   const snapshot=toPublicSnapshot({...local,epoch:'remote-room',mode:'LAN',running:true,seq:1});applyRemoteSnapshot(snapshot);
   const projected=useMission.getState().sim,authority=getSessionState();useMission.getState().advance(1000,true);tickLocalSession(1);useMission.getState().publish();
   expect(useMission.getState().sim).toBe(projected);expect(getSessionState()).toBe(authority);
   useMission.getState().setActiveRole('SPACECRAFT');expect(useMission.getState().handoff).toBeNull();expect(intents).toHaveLength(0);
   useMission.getState().command({kind:'SAFE',on:true});expect(intents.at(-1)?.kind).toBe('COMMANDS');expect(useMission.getState().sim).toBe(projected);expect(getSessionState().sim).toBe(local.sim);
   applyRemoteResult({ok:false,refusal:{ok:false,code:'ROLE_LOCKED',values:{role:'SPACECRAFT'}}});expect(useMission.getState().lastRefusal?.code).toBe('ROLE_LOCKED');
   applyRemoteResult({ok:true,seq:2,receiptIds:[]});expect(useMission.getState().lastRefusal).toBeNull();
  }finally{setIntentSink(null);}
  expect(useMission.getState().remoteMode).toBe(false);expect(useMission.getState().running).toBe(false);
 });
});
