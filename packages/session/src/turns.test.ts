import { describe, expect, test } from 'bun:test';
import { defaultQuickDesign, turnDecision, previewTurn } from '@astrix/core';
import { createSession, reduceSession, tickSession, advanceSession, replaySession } from './reducer';
import { toPublicSnapshot } from './snapshot';
import { parseClientMessage } from './protocol';
import type { SessionActor, SessionState, IntentEnvelope } from './contracts';

const host:SessionActor={playerId:'host',deviceId:'display',isHost:true,role:'ALL'};
function start(mode:'LOCAL'|'LAN'='LOCAL'){
 const initial=createSession({hostPlayerId:'host',mode});
 const result=reduceSession(initial,{kind:'START_GAME',config:defaultQuickDesign('FIRST_SIGNAL','ASPIRING')},host);
 if(!result.result.ok)throw new Error(JSON.stringify(result.result));
 return {initial,state:result.state};
}
function commit(s:SessionState,id='turn-1'):IntentEnvelope {
 const decision=turnDecision(s.game!);
 const plan=decision.plans.find(p=>p.recommended)??decision.plans[0];
 if(!plan)throw new Error('No meaningful opening plan');
 return {id,epoch:s.epoch,attemptId:s.attemptId,rosterRevision:s.rosterRevision,intent:{kind:'COMMIT_TURN',decisionId:decision.id,turnRevision:decision.revision,planId:plan.id}};
}
describe('turn authority',()=>{
 test('preview and clocks cannot advance a mission; commit publishes the same physical outcome',()=>{
  const {state}=start(),before=JSON.stringify(state.game),request=commit(state);
  if(request.intent.kind!=='COMMIT_TURN')throw new Error();
  const preview=previewTurn(state.game!,request.intent.planId);
  expect(preview.ok).toBe(true);expect(JSON.stringify(state.game)).toBe(before);
  expect(tickSession(state,86400)).toBe(state);expect(advanceSession(state,86400)).toBe(state);
  const resolved=reduceSession(state,request,host);
  expect(resolved.result.ok).toBe(true);expect(resolved.state.game!.revision).toBe(state.game!.revision+1);
  if(preview.ok)expect(resolved.state.game!.sim).toEqual(preview.value.state.sim);
  expect(resolved.state.sim).toBe(resolved.state.game!.sim);
  expect(resolved.state.running).toBe(false);
  expect(JSON.parse(JSON.stringify(toPublicSnapshot(resolved.state)))).toEqual(toPublicSnapshot(resolved.state));
 });
 test('duplicate envelopes are idempotent and stale decisions never execute again',()=>{
  const {state}=start(),request=commit(state),first=reduceSession(state,request,host);
  const repeat=reduceSession(first.state,request,host);
  expect(repeat.state.game).toBe(first.state.game);expect(repeat.result).toEqual(first.result);
  const stale=reduceSession(first.state,{...request,id:'different-tap'},host);
  expect(stale.result.ok).toBe(false);expect(stale.state.game).toBe(first.state.game);
  const mismatch=reduceSession(first.state,{...request,intent:{kind:'RETRY_GAME'}},host);
  expect(mismatch.result.ok).toBe(false);expect(mismatch.state.game).toBe(first.state.game);
 });
 test('a controller proposes without advancing; only the host commits',()=>{
  const {state}=start('LAN');
  const added=reduceSession(state,{kind:'ADD_PLAYER',playerId:'phone',name:'Explorer'},host).state;
  const assigned=reduceSession(added,{kind:'ASSIGN_ROLE',role:'SCIENCE',playerId:'phone',rosterRevision:added.rosterRevision},host).state;
  const phone:SessionActor={playerId:'phone',deviceId:'phone',role:'SCIENCE'};
  const request=commit(assigned);
  if(request.intent.kind!=='COMMIT_TURN')throw new Error();
  const refused=reduceSession(assigned,request,phone);
  expect(refused.result.ok).toBe(false);expect(refused.state.game).toBe(assigned.game);
  const proposed=reduceSession(assigned,{...request.intent,kind:'PROPOSE_TURN'},phone);
  expect(proposed.result.ok).toBe(true);expect(proposed.state.game).toBe(assigned.game);
  expect(proposed.state.turnProposals[0]?.planId).toBe(request.intent.planId);
  const committed=reduceSession(proposed.state,request,host);
  expect(committed.result.ok).toBe(true);expect(committed.state.turnProposals).toEqual([]);
 });
 test('legacy commands cannot bypass a decision and failed preparation preserves the attempt',()=>{
  const {state}=start();
  for(const intent of [{kind:'RESUME'},{kind:'ADVANCE_NEXT'},{kind:'COMMANDS',commands:[{kind:'SAFE',on:true}]}] as const){
   const result=reduceSession(state,intent,host);expect(result.result.ok).toBe(false);expect(result.state.game).toBe(state.game);
  }
  const invalid={...defaultQuickDesign(),seed:Infinity};
  const result=reduceSession(state,{kind:'START_GAME',config:invalid},host);
  expect(result.result.ok).toBe(false);expect(result.state.game).toBe(state.game);
 });
 test('replay and same-condition retry retain deterministic identity',()=>{
  const {initial,state}=start(),resolved=reduceSession(state,commit(state),host).state;
  expect(replaySession(initial,resolved.replay).game).toEqual(resolved.game);
  const retried=reduceSession(resolved,{kind:'RETRY_GAME'},host);
  expect(retried.result.ok).toBe(true);expect(retried.state.game!.identity).toBe(state.game!.identity);
  expect(retried.state.game!.sim).toEqual(state.game!.sim);expect(retried.state.attemptId).toBe(resolved.attemptId+1);
  const assisted=reduceSession(resolved,{kind:'RETRY_GAME',checkpointRevision:0},host);
  expect(assisted.result.ok).toBe(true);expect(assisted.state.game!.assisted).toBe(true);
 });
 test('wire refuses malformed config, stale-shaped requests and trusted restores',()=>{
  const frame=(intent:unknown)=>({type:'INTENT',id:'a',epoch:'local',attemptId:0,rosterRevision:0,actor:{role:'ALL'},intent});
  expect(parseClientMessage(frame({kind:'START_GAME',config:defaultQuickDesign()})).ok).toBe(true);
  for(const intent of [{kind:'START_GAME',config:{...defaultQuickDesign(),seed:NaN}},{kind:'COMMIT_TURN',decisionId:'a',turnRevision:-1,planId:'observe'},{kind:'LOCAL_RESTORE_GAME',game:{}},{kind:'RETRY_GAME',checkpointRevision:0,extra:true}])expect(parseClientMessage(frame(intent)).ok).toBe(false);
 });
});
