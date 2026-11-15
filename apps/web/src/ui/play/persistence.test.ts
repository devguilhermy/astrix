import { describe, expect, test } from 'bun:test';
import { certifyQuickDesign, defaultQuickDesign, turnDebrief, turnDecision, type TurnGameState } from '@astrix/core';
import { createSession, reduceSession, type SessionState } from '@astrix/session';
import { attemptRecord, clearStoredSaves, comparable, parseSave, readLegacy, recordAttempt, type StorageLike } from './persistence';
import { missionScore } from './turnMoments';

class MemoryStorage implements StorageLike {
  values=new Map<string,string>();
  getItem(key:string){return this.values.get(key)??null;}
  removeItem(key:string){this.values.delete(key);}
}
const actor={playerId:'player-1',role:'ALL' as const,isHost:true};
const exported=(game:TurnGameState,journal:readonly unknown[]=[])=>JSON.stringify({format:'astrix-turn-save',version:1,game,journal});
function start():SessionState {
  const result=reduceSession(createSession(),{kind:'START_GAME',config:defaultQuickDesign()},actor);
  if(!result.result.ok)throw new Error(result.result.refusal.code);
  return result.state;
}
function commit(state:SessionState,planId:string):SessionState {
  const decision=turnDecision(state.game!);
  const result=reduceSession(state,{kind:'COMMIT_TURN',decisionId:decision.id,turnRevision:decision.revision,planId},actor);
  if(!result.result.ok)throw new Error(result.result.refusal.code);
  return result.state;
}

describe('exported attempt files',()=>{
  test('First Signal completes through session authority and every exported boundary restores identical evidence',()=>{
    const config=defaultQuickDesign(),proof=certifyQuickDesign(config);
    let session=start();
    expect(['READY','STRETCHED']).toContain(proof.status);
    for(const plan of proof.witness) {
      session=commit(session,plan);
      const document=parseSave(exported(session.game!));
      expect(document.game).toEqual(session.game!);
      const restored=reduceSession(createSession(),{kind:'LOCAL_RESTORE_GAME',game:document.game},actor);
      expect(restored.result.ok).toBe(true);session=restored.state;
    }
    expect(turnDebrief(session.game!).outcome).toBe('SUCCESS');
    const journal=recordAttempt([],session.game!);
    expect(recordAttempt(journal,session.game!)).toBe(journal);
    expect(parseSave(exported(session.game!,journal)).journal).toEqual(journal);
    const original=attemptRecord(session.game!);
    const retry=reduceSession(session,{kind:'RETRY_GAME'},actor);
    expect(retry.result.ok).toBe(true);expect(retry.state.game!.config.seed).toBe(config.seed);
    expect(comparable(original,attemptRecord(retry.state.game!))).toBe(true);
    expect(retry.state.game!.revision).toBe(0);
  },180000);
  test('assisted checkpoint retry remains assisted after export, import and a new commitment',()=>{
    const initial=start(),later=commit(initial,'observe');
    const retry=reduceSession(later,{kind:'RETRY_GAME',checkpointRevision:0},actor);
    expect(retry.result.ok).toBe(true);
    const branched=commit(retry.state,'observe'),document=parseSave(exported(branched.game!));
    expect(document.game).toEqual(branched.game!);expect(document.game.assisted).toBe(true);
    const restored=reduceSession(createSession(),{kind:'LOCAL_RESTORE_GAME',game:document.game},actor);
    expect(restored.result.ok).toBe(true);expect(restored.state.game!.assisted).toBe(true);
  });
  test('incompatible or tampered files are refused',()=>{
    const initial=start().game!,later=commit(start(),'observe').game!;
    expect(()=>parseSave('{broken-json')).toThrow();
    expect(()=>parseSave(JSON.stringify({format:'astrix-turn-save',version:90,game:initial,journal:[]}))).toThrow('version');
    const tampered=JSON.parse(exported(later));tampered.game.sim.socWh+=1;
    expect(()=>parseSave(JSON.stringify(tampered))).toThrow('deterministic');
  });
  test('attempt records carry score, stars and turns; records exported without them still load',()=>{
    const game=commit(start(),'observe').game!,record=attemptRecord(game),score=missionScore(game);
    expect(record).toMatchObject({score:score.total,stars:score.stars,turns:game.receipts.length});
    const old:Record<string,unknown>={...record};delete old.score;delete old.stars;delete old.turns;
    expect(parseSave(exported(game,[old])).journal as readonly unknown[]).toEqual([old]);
    expect(parseSave(exported(game,[record])).journal).toEqual([record]);
    for(const bad of [{...record,score:null},{...record,stars:'5'},{...record,turns:Number.NaN},{...record,score:Number.POSITIVE_INFINITY}])expect(()=>parseSave(exported(game,[bad]))).toThrow('journal');
  });
});

describe('browser storage',()=>{
  test('retired auto-save slots are purged; settings and older mission work are kept',()=>{
    const storage=new MemoryStorage(),legacy='{"format":"astrix.mission-library","version":1}';
    for(const key of ['astrix.play.save.v1.head','astrix.play.save.v1.a','astrix.play.save.v1.b'])storage.values.set(key,'x');
    storage.values.set('astrix.settings','{}');storage.values.set('astrix.missions.v1',legacy);
    clearStoredSaves(storage);
    expect([...storage.values.keys()].sort()).toEqual(['astrix.missions.v1','astrix.settings']);
    expect(readLegacy(storage)).toEqual({'astrix.missions.v1':legacy});
  });
});
