import { describe, expect, test } from 'bun:test';
import { attemptAudit, computeBudgets, forecastTimeline, history, quoteAddPart, rolesAffectedBy } from '@astrix/core';
import { createSession, reduceSession, tickSession, advanceSession, replaySession, quoteDesign } from './reducer';
import { canAct } from './permissions';
import { toPublicSnapshot, selectHistoryPage } from './snapshot';
import { ROLES } from './contracts';
import type { IntentEnvelope, SessionActor, SessionIntent, SessionState } from './contracts';
const solo:SessionActor={role:'ALL',playerId:'player-1',deviceId:'display',isHost:true};
function flight(launch=true):SessionState {
 let s=createSession({epoch:'test'});
 const apply=(intent:SessionIntent)=>{const tx=reduceSession(s,intent,solo);expect(tx.result.ok).toBe(true);s=tx.state;};
 apply({ kind: 'START_MISSION', missionId: 'FIRST_LIGHT', levelId: 'ASPIRING' });
 apply({kind:'COMMIT_DESIGN',baseRevision:s.design!.revision,edit:{kind:'ADD_PART',partId:'CAM_EO'}});
 apply({kind:'CONFIRM_OBJECTIVE'});
 for(let n=0;n<3;n++)apply({kind:'COMPLETE_STAGE',designRevision:s.design!.revision});
 apply({kind:'RECORD_TRADE',baseRevision:s.design!.revision,description:'magnetic payload comparison',edit:{kind:'ADD_PART',partId:'MAG'}});
 apply({kind:'FREEZE_BASELINE',designRevision:s.design!.revision});
 apply({kind:'COMPLETE_STAGE',designRevision:s.design!.revision});
 apply({kind:'SIGN_OFF',role:'SCIENCE',designRevision:s.design!.revision,rosterRevision:s.rosterRevision});
 apply({kind:'VERIFY_BASELINE',designRevision:s.design!.revision});
 apply({kind:'COMPLETE_STAGE',designRevision:s.design!.revision});
 if(launch)apply({kind:'LAUNCH',designRevision:s.design!.revision,rosterRevision:s.rosterRevision});
 return s;
}
describe('one immutable session authority',()=>{
 test('journey, quote evidence, explicit launch and Aspiring checkpoint match static behavior',()=>{
  const s=flight();expect(s.activeStage).toBe('IMPLEMENT');expect(s.activeView).toBe('OPERATE');expect(s.running).toBe(false);expect(s.pauseReasons).toEqual(['manual']);expect(s.practiceCheckpoints[0].name).toBe('launch');expect(Object.values(s.signoffs).every(Boolean)).toBe(true);
  const duplicate=reduceSession(s,{kind:'LAUNCH',designRevision:s.design!.revision,rosterRevision:s.rosterRevision},solo);expect(duplicate.result.ok).toBe(false);expect(duplicate.state).toBe(s);
 });
 test('a refused multi-command batch changes no mission state, events, receipts or sequence',()=>{
  let s=flight();s=reduceSession(s,{kind:'PAUSE',reason:'settings'},solo).state;s=reduceSession(s,{kind:'SET_TEAM',count:2},solo).state;
  const actor:SessionActor={role:'SCIENCE',playerId:s.roster.find(p=>p.roles.includes('SCIENCE'))!.id};
  const tx=reduceSession(s,{kind:'COMMANDS',commands:[{kind:'POINT',mode:'TARGET'},{kind:'SAFE',on:true}]},actor);
  expect(tx.result.ok).toBe(false);expect(tx.state).toBe(s);expect(tx.state.sim).toBe(s.sim);expect(tx.state.telemetry?.commandQueue).toBe(s.telemetry?.commandQueue);expect(tx.state.seq).toBe(s.seq);
 });
 test('gesture coalescing is delegated unchanged to core and steering above 10x refuses',()=>{
  let s=flight();const before=s.sim;
  const rejected=reduceSession(s,{kind:'COMMANDS',commands:[{kind:'ATTITUDE_TARGET',q:[0,0,0,1],gestureId:'drag'}]},solo);expect(rejected.result.ok).toBe(false);expect(rejected.state.sim).toBe(before);
  s=reduceSession(s,{kind:'SET_WARP',warp:10},solo).state;
  const direct=quoteDesign(s.design!,{kind:'ADD_PART',partId:'MAG'},'ALL');expect(direct.ok).toBe(true);
  s=reduceSession(s,{kind:'COMMANDS',commands:[{kind:'ATTITUDE_TARGET',q:[0,0,0,1],gestureId:'drag'}]},solo).state;
  const first=s.telemetry!.commandQueue.at(-1)!;
  const next=reduceSession(s,{kind:'COMMANDS',commands:[{kind:'ATTITUDE_TARGET',q:[0,.1,0,.995],gestureId:'drag'}]},solo);expect(next.result.ok).toBe(true);
  if(first.status==='WAITING_CONTACT'){expect(next.state.telemetry!.commandQueue).toHaveLength(s.telemetry!.commandQueue.length);expect(next.state.telemetry!.commandQueue.at(-1)?.id).toBe(first.id);}
  expect(next.state.telemetry!.commandQueue.at(-1)?.actor.playerId).toBe(solo.playerId);
 });
 test('stable actor IDs survive role reassignment and unrelated approvals remain',()=>{
  let s=flight();s=reduceSession(s,{kind:'PAUSE',reason:'settings'},solo).state;s=reduceSession(s,{kind:'SET_TEAM',count:2},solo).state;
  const owner=s.roster.find(p=>p.roles.includes('SPACECRAFT'))!,actor:SessionActor={role:'SPACECRAFT',playerId:owner.id,isHost:true};
  s=reduceSession(s,{kind:'COMMANDS',commands:[{kind:'SAFE',on:true}]},actor).state;const receipt=s.telemetry!.commandQueue.at(-1)!;
  const target=s.roster.find(p=>p.id!==owner.id)!;
  s=reduceSession(s,{kind:'ASSIGN_ROLE',role:'SPACECRAFT',playerId:target.id,rosterRevision:s.rosterRevision},actor).state;
  expect(s.telemetry!.commandQueue.at(-1)).toEqual(receipt);expect(receipt.actor.playerId).toBe(owner.id);expect(s.signoffs.SPACECRAFT).toBe(false);
 });
 test('team permissions require the selected owned discipline, never host ALL',()=>{
  const s=createSession({mode:'LAN',participantMode:'TEAM',hostPlayerId:'host'});
  for(const chosen of ROLES)for(const required of ROLES)expect(canAct(s,{playerId:'host',role:chosen,isHost:true},required)).toBe(chosen===required);
  expect(canAct(s,{playerId:'host',role:'ALL',isHost:true})).toBe(false);expect(canAct(s,{playerId:'unknown',role:'SCIENCE'})).toBe(false);
 });
 test('practice rewind restores immutable coherent evidence, changes attempt, records assistance',()=>{
  let s=flight();const checkpoint=s.practiceCheckpoints[0],saved=structuredClone(checkpoint.snapshot),id=s.attemptId;
  s=reduceSession(s,{kind:'COMMANDS',commands:[{kind:'SAFE',on:true}]},solo).state;s=reduceSession(s,{kind:'RESUME'},solo).state;s=advanceSession(s,100);
  s=reduceSession(s,{kind:'RETRY_CHECKPOINT',checkpointId:checkpoint.id},solo).state;
  expect(s.attemptId).toBe(id+1);expect(s.assisted).toBe(true);expect(s.telemetry?.assisted).toBe(true);expect(history(s.sim!)).toEqual(history(saved.sim));expect(s.events).toEqual(saved.events);expect(checkpoint.snapshot).toEqual(saved);expect(attemptAudit(s.sim!).entries.at(-1)?.kind).toBe('REWIND');expect(s.running).toBe(false);
 });
});
describe('revision, deduplication and scoped stops',()=>{
 test('duplicate accepted IDs return the saved result even after attempt context changes',()=>{
  const initial=createSession({epoch:'one'}),request:IntentEnvelope={id:'start',epoch:'one',attemptId:0,rosterRevision:0,intent:{ kind: 'START_MISSION', missionId: 'FIRST_LIGHT', levelId: 'ASPIRING' }};
  const first=reduceSession(initial,request,solo),duplicate=reduceSession(first.state,request,solo);
  expect(duplicate.state).toBe(first.state);expect(duplicate.result).toEqual(first.result);expect(duplicate.state.attemptId).toBe(1);
  const different=reduceSession(first.state,{...request,intent:{ kind: 'START_MISSION', missionId: 'RED_RELAY', levelId: 'EXPERT' }},solo);expect(different.result).toMatchObject({ok:false,refusal:{code:'DUPLICATE_ID'}});expect(different.state).toBe(first.state);
 });
 test('stale epoch, attempt, roster and design cannot mutate the mission',()=>{
  const s=flight(),envelope:IntentEnvelope={id:'bad',epoch:'wrong',attemptId:s.attemptId,rosterRevision:s.rosterRevision,intent:{kind:'PAUSE'}};
  expect(reduceSession(s,envelope,solo).result).toMatchObject({ok:false,refusal:{code:'STALE_EPOCH'}});
  expect(reduceSession(s,{...envelope,epoch:s.epoch,attemptId:0},solo).result).toMatchObject({ok:false,refusal:{code:'STALE_ATTEMPT'}});
  expect(reduceSession(s,{...envelope,epoch:s.epoch,rosterRevision:99},solo).result).toMatchObject({ok:false,refusal:{code:'STALE_ROSTER'}});
  expect(reduceSession(s,{kind:'LAUNCH',designRevision:99,rosterRevision:s.rosterRevision},solo).result).toMatchObject({ok:false,refusal:{code:'STALE_DESIGN'}});
 });
 test('local ticks preserve deterministic remainders and monotonic commit sequences',()=>{
  const initial=reduceSession(flight(),{kind:'RESUME'},solo).state;
  let a=initial,b=structuredClone(initial);for(const dt of [.03,.07,.1]){a=tickSession(a,dt);b=tickSession(b,dt);}
  expect(a.sim).toEqual(b.sim);expect(a.seq).toBeGreaterThan(initial.seq);expect(a.replay.at(-1)?.kind).toBe('TICK');
 });
 test('phone tours/explanations/visibility are local, shared stops need explicit host resume',()=>{
  let s:SessionState={...flight(),mode:'LAN'};const phone:SessionActor={...solo,deviceId:'phone',isHost:false};s=reduceSession(s,{kind:'RESUME'},solo).state;
  for(const reason of ['tour','explanation','hidden','settings'] as const){const tx=reduceSession(s,{kind:'PAUSE',reason},phone);expect(tx.state).toBe(s);expect(tx.state.running).toBe(true);}
  s=reduceSession(s,{kind:'PAUSE'},phone).state;expect(s.pauseOwners.manual).toBe(solo.playerId);expect(s.running).toBe(false);
  expect(reduceSession(s,{kind:'RESUME'},phone).result).toMatchObject({ok:false,refusal:{code:'HOST_ONLY'}});
  s=reduceSession(s,{kind:'PAUSE',reason:'settings'},solo).state;s=reduceSession(s,{kind:'CLEAR_PAUSE',reason:'settings'},solo).state;expect(s.running).toBe(false);s=reduceSession(s,{kind:'RESUME'},solo).state;expect(s.running).toBe(true);
  s=reduceSession(s,{kind:'PAUSE',reason:'learning:lesson'},phone).state;expect(reduceSession(s,{kind:'RESUME'},solo).state.running).toBe(false);s=reduceSession(s,{kind:'ACK_LEARNING',stopId:'lesson'},phone).state;expect(s.running).toBe(false);expect(s.pauseReasons).toContain('manual');
 });
 test('LAN quotes bind exact actor, revision and edit; commits rerun core',()=>{
  let s=createSession({epoch:'room',mode:'LAN'});s=reduceSession(s,{ kind: 'START_MISSION', missionId: 'FIRST_LIGHT', levelId: 'ASPIRING' },solo).state;
  const edit={kind:'ADD_PART' as const,partId:'CAM_EO'},baseRevision=s.design!.revision;
  const quoted=reduceSession(s,{kind:'QUOTE_DESIGN',edit,baseRevision},solo);expect(quoted.result.ok).toBe(true);if(!quoted.result.ok||!quoted.result.quote)throw new Error('quote missing');
  const committed=reduceSession(quoted.state,{kind:'COMMIT_DESIGN',edit,baseRevision,quoteId:quoted.result.quote.quoteId},solo);expect(committed.result.ok).toBe(true);expect(committed.state.design!.revision).toBe(baseRevision+1);
  const stale=reduceSession(committed.state,{kind:'COMMIT_DESIGN',edit,baseRevision,quoteId:quoted.result.quote.quoteId},solo);expect(stale.result).toMatchObject({ok:false,refusal:{code:'STALE_DESIGN'}});
 });
 test('affected-only edits invalidate approval dependencies while comparison never edits hardware',()=>{
  const s=flight(false);
  const before=s.design!,quote=quoteAddPart(before,'STORAGE_32G','ALL');expect(quote.ok).toBe(true);if(!quote.ok)return;
  const tx=reduceSession(s,{kind:'RECORD_TRADE',baseRevision:before.revision,description:'storage',edit:{kind:'ADD_PART',partId:'STORAGE_32G'}},solo);expect(tx.state.design).toBe(before);expect(tx.state.artifacts?.trade?.before).toEqual(computeBudgets(before));expect(tx.state.artifacts?.trade?.after).toEqual(computeBudgets(quote.value.next));
  const commit=reduceSession(s,{kind:'COMMIT_DESIGN',baseRevision:before.revision,edit:{kind:'ADD_PART',partId:'STORAGE_32G'}},solo);expect(commit.result.ok).toBe(true);
  const affected=rolesAffectedBy(before,commit.state.design!);
  for(const role of ROLES){expect(commit.state.signoffs[role]).toBe(!affected.includes(role));if(!affected.includes(role))expect(commit.state.approvals.find(a=>a.role===role)).toEqual(s.approvals.find(a=>a.role===role));}
 });
});
describe('deterministic replay contracts',()=>{
 test('accepted intents and both wall/simulation clock inputs reproduce canonical evidence',()=>{
  let s=reduceSession(flight(),{kind:'RESUME'},solo).state;
  s=tickSession(s,.03);s=tickSession(s,.07);s=advanceSession(s,100);
  const replayed=replaySession(createSession({epoch:'test'}),s.replay);
  expect(replayed.design).toEqual(s.design);expect(replayed.sim).toEqual(s.sim);expect(replayed.events).toEqual(s.events);expect(replayed.seq).toBe(s.seq);
 });
 test('a bounded rolling replay includes its exact baseline rather than freezing the clock',()=>{
  let s=reduceSession(flight(),{kind:'RESUME'},solo).state;
  s={...s,replay:Array.from({length:20000},()=>({kind:'TICK' as const,seq:s.seq,dtSec:.01}))};
  const next=tickSession(s,.1);expect(next.replay).toHaveLength(2);expect(next.replay[0].kind).toBe('CHECKPOINT');expect(next.seq).toBe(s.seq+1);
  const replayed=replaySession(createSession(),next.replay);expect(replayed.sim).toEqual(next.sim);expect(replayed.seq).toBe(next.seq);
 });
});
describe('bounded public DTOs',()=>{
 test('snapshots omit secret/private ledgers and full checkpoint snapshots; history is separately paged',()=>{
  const s=flight(),sample=history(s.sim!)[0],sim={...s.sim!,samples:Array.from({length:300},(_,t)=>({...sample,t})),sampleHead:0,credential:'private-sim'};
  const privateState={...s,sim,credential:'private-session',quotes:{private:{playerId:'secret',role:'ALL' as const,baseRevision:0,edit:{kind:'ADD_PART' as const,partId:'MAG'},attemptId:0,expiresSeq:999}}};
  const snapshot=toPublicSnapshot(privateState),json=JSON.stringify(snapshot);expect(json).not.toContain('private-session');expect(json).not.toContain('private-sim');expect(json).not.toContain('secret');expect('results'in snapshot).toBe(false);expect('replay'in snapshot).toBe(false);expect('snapshot'in snapshot.practiceCheckpoints[0]).toBe(false);
  expect(history(snapshot.sim!).length).toBeLessThanOrEqual(128);expect(selectHistoryPage(privateState).entries).toHaveLength(128);expect(selectHistoryPage(privateState,selectHistoryPage(privateState).cursor).entries).toHaveLength(128);expect(selectHistoryPage(privateState,'0:128').entries).toHaveLength(0);
  expect(JSON.parse(json)).toEqual(snapshot);
 });
});

describe('safety, role decisions and attribution',()=>{
 test('only the current decision owner can acknowledge, and host capability cannot bypass it',()=>{
  let s=reduceSession(flight(),{kind:'RESUME'},solo).state;
  for(let n=0;n<22&&!s.decisions.length;n++)s=advanceSession(s,4000);
  expect(s.decisions.length).toBeGreaterThan(0);const decision=s.decisions[0];
  s=reduceSession(s,{kind:'PAUSE',reason:'settings'},solo).state;s=reduceSession(s,{kind:'SET_TEAM',count:4},solo).state;
  const wrong=ROLES.find(r=>r!==decision.owner)!,wrongPlayer=s.roster.find(p=>p.roles.includes(wrong))!,owner=s.roster.find(p=>p.roles.includes(decision.owner))!;
  const rejected=reduceSession(s,{kind:'ACK_DECISION',decisionId:decision.id},{role:wrong,playerId:wrongPlayer.id,isHost:true});expect(rejected.result).toMatchObject({ok:false,refusal:{code:'ROLE_LOCKED'}});expect(rejected.state).toBe(s);
  const accepted=reduceSession(s,{kind:'ACK_DECISION',decisionId:decision.id},{role:decision.owner,playerId:owner.id});expect(accepted.result.ok).toBe(true);expect(accepted.state.decisions.some(d=>d.id===decision.id)).toBe(false);expect(accepted.state.running).toBe(false);expect(accepted.state.pauseReasons).toContain('settings');
 });
 test('notes normalize plain text while preserving Portuguese and stable resolution attribution',()=>{
  const text=`  Revisão${String.fromCodePoint(0x202e)}  de${String.fromCodePoint(10)}massa${String.fromCodePoint(0x200b)}  `;
  const s=flight(false),tx=reduceSession(s,{kind:'NOTE',category:'CONCERN',target:'mass',text,designRevision:s.design!.revision},solo);
  expect(tx.state.designNotes[0].text).toBe('Revisão de massa');expect(tx.state.designNotes[0].playerId).toBe(solo.playerId);
  const resolved=reduceSession(tx.state,{kind:'RESOLVE_NOTE',noteId:tx.state.designNotes[0].id},solo);expect(resolved.state.designNotes[0].resolvedBy).toBe(solo.playerId);expect(tx.state.designNotes[0].resolved).toBe(false);
 });
 test('LAN readiness and unresolved safety stops cannot be erased by launch or rewind',()=>{
  let lobby=createSession({mode:'LAN'});lobby=reduceSession(lobby,{kind:'ADD_PLAYER',playerId:'new',name:'João'},solo).state;
  expect(reduceSession(lobby,{ kind: 'START_MISSION', missionId: 'FIRST_LIGHT', levelId: 'ASPIRING' },solo).result).toMatchObject({ok:false,refusal:{code:'NOT_READY'}});
  for(const reason of ['host-display-disconnected','host-stall'] as const){
   let s:SessionState={...flight(false),mode:'LAN'};s=reduceSession(s,{kind:'PAUSE',reason},solo).state;
   const refused=reduceSession(s,{kind:'LAUNCH',designRevision:s.design!.revision,rosterRevision:s.rosterRevision},solo);expect(refused.result.ok).toBe(false);expect(refused.state).toBe(s);
   s={...flight(),mode:'LAN'};s=reduceSession(s,{kind:'PAUSE',reason},solo).state;s=reduceSession(s,{kind:'RETRY_CHECKPOINT',checkpointId:s.practiceCheckpoints[0].id},solo).state;expect(s.pauseReasons).toContain(reason);expect(reduceSession(s,{kind:'RESUME'},solo).state.running).toBe(false);
  }
 });
 test('public flight projection preserves exact read-only timeline geometry without private RNG',()=>{
  const s=flight(),snapshot=toPublicSnapshot(s);expect('rng'in snapshot.sim!).toBe(false);expect(forecastTimeline(snapshot.sim!,86400)).toEqual(forecastTimeline(s.sim!,86400));
 });
});
