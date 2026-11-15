import { describe, expect, test } from 'bun:test';
import { certifyQuickDesign, defaultQuickDesign, turnDebrief, turnDecision } from '@astrix/core';
import { createSession, reduceSession, type SessionState } from '@astrix/session';
import { attemptRecord, comparable, parseSave, readSave, recordAttempt, writeSave, type StorageLike } from './persistence';

class MemoryStorage implements StorageLike {
  values=new Map<string,string>();
  failKey:string|null=null;
  getItem(key:string){return this.values.get(key)??null;}
  setItem(key:string,value:string){if(key===this.failKey)throw new Error('Storage quota exceeded');this.values.set(key,value);}
}
const actor={playerId:'player-1',role:'ALL' as const,isHost:true};
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

describe('versioned decision-boundary persistence',()=>{
  test('First Signal completes through session authority, saves each boundary and restores identical evidence',()=>{
    const storage=new MemoryStorage(),config=defaultQuickDesign(),proof=certifyQuickDesign(config);
    let session=start();
    expect(['READY','STRETCHED']).toContain(proof.status);
    for(const plan of proof.witness) {
      session=commit(session,plan);
      expect(writeSave(session.game!,[],storage)).toBeNull();
      const loaded=readSave(storage);
      expect(loaded.issue).toBeNull();expect(loaded.document!.game).toEqual(session.game!);
      const restored=reduceSession(createSession(),{kind:'LOCAL_RESTORE_GAME',game:loaded.document!.game},actor);
      expect(restored.result.ok).toBe(true);session=restored.state;
    }
    expect(turnDebrief(session.game!).outcome).toBe('SUCCESS');
    const journal=recordAttempt([],session.game!);
    expect(recordAttempt(journal,session.game!)).toBe(journal);
    expect(writeSave(session.game!,journal,storage)).toBeNull();
    expect(readSave(storage).document!.journal).toEqual(journal);
    const original=attemptRecord(session.game!);
    const retry=reduceSession(session,{kind:'RETRY_GAME'},actor);
    expect(retry.result.ok).toBe(true);expect(retry.state.game!.config.seed).toBe(config.seed);
    expect(comparable(original,attemptRecord(retry.state.game!))).toBe(true);
    expect(retry.state.game!.revision).toBe(0);
  },180000);
  test('assisted checkpoint retry remains assisted after export, reload and a new commitment',()=>{
    const initial=start(),later=commit(initial,'observe');
    const retry=reduceSession(later,{kind:'RETRY_GAME',checkpointRevision:0},actor);
    expect(retry.result.ok).toBe(true);
    const branched=commit(retry.state,'observe'),raw=JSON.stringify({format:'astrix-turn-save',version:1,game:branched.game,journal:[]});
    const document=parseSave(raw);
    expect(document.game).toEqual(branched.game!);expect(document.game.assisted).toBe(true);
    const restored=reduceSession(createSession(),{kind:'LOCAL_RESTORE_GAME',game:document.game},actor);
    expect(restored.result.ok).toBe(true);expect(restored.state.game!.assisted).toBe(true);
  });
  test('failed payload or pointer writes preserve the previous valid save',()=>{
    const storage=new MemoryStorage(),initial=start().game!,later=commit(start(),'observe').game!;
    expect(writeSave(initial,[],storage)).toBeNull();
    const pointer=storage.getItem('astrix.play.save.v1.head');
    storage.failKey='astrix.play.save.v1.b';expect(writeSave(later,[],storage)?.code).toBe('STORAGE');
    expect(storage.getItem('astrix.play.save.v1.head')).toBe(pointer);expect(readSave(storage).document!.game).toEqual(initial);
    storage.failKey='astrix.play.save.v1.head';expect(writeSave(later,[],storage)?.code).toBe('STORAGE');
    expect(storage.getItem('astrix.play.save.v1.head')).toBe(pointer);expect(readSave(storage).document!.game).toEqual(initial);
  });
  test('corrupt and incompatible saves are preserved for export and offer only explicitly valid backup',()=>{
    const storage=new MemoryStorage(),initial=start().game!,later=commit(start(),'observe').game!;
    writeSave(initial,[],storage);writeSave(later,[],storage);
    const head=storage.getItem('astrix.play.save.v1.head')!,raw='{broken-json';storage.values.set(`astrix.play.save.v1.${head}`,raw);
    const loaded=readSave(storage);
    expect(loaded.document).toBeNull();expect(loaded.issue?.raw).toBe(raw);expect(loaded.backup!.game).toEqual(initial);
    expect(storage.getItem(`astrix.play.save.v1.${head}`)).toBe(raw);
    expect(()=>parseSave(JSON.stringify({format:'astrix-turn-save',version:90,game:initial,journal:[]}))).toThrow('version');
    const tampered=JSON.parse(JSON.stringify({format:'astrix-turn-save',version:1,game:later,journal:[]}));tampered.game.sim.socWh+=1;
    expect(()=>parseSave(JSON.stringify(tampered))).toThrow('deterministic');
  });
  test('older saved mission library is discoverable for export, never relabelled as a new-rules flight',()=>{
    const storage=new MemoryStorage(),legacy='{"format":"astrix.mission-library","version":1}';storage.setItem('astrix.missions.v1',legacy);
    const loaded=readSave(storage);
    expect(loaded.document).toBeNull();expect(loaded.legacy['astrix.missions.v1']).toBe(legacy);expect(storage.getItem('astrix.missions.v1')).toBe(legacy);
  });
});
