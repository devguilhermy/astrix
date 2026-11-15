import { restoreTurnGame, telemetry, turnDebrief, validateQuickDesignConfig, type QuickDesignConfig, type TurnGameState } from '@astrix/core';

export interface AttemptRecord {
  id:string; config:QuickDesignConfig; rulesVersion:number; modelVersion:number; outcome:string; assisted:boolean;
  elapsedSec:number; fuelKg:number; energyWh:number; deliveredMB:number; discoveries:readonly string[];
  evidence:readonly {id:string;state:string;actual:number|null;target:number|null;unit:string}[];
}
export interface SaveDocument { format:'astrix-turn-save'; version:1; game:TurnGameState; journal:readonly AttemptRecord[] }
export interface SaveIssue { code:'STORAGE'|'CORRUPT'|'INCOMPATIBLE'; detail:string; raw:string|null }
export interface SavedGame { document:SaveDocument|null; issue:SaveIssue|null; backup:SaveDocument|null; legacy:Readonly<Record<string,string>> }
export interface StorageLike { getItem(key:string):string|null; setItem(key:string,value:string):void }
const HEAD='astrix.play.save.v1.head', SLOT='astrix.play.save.v1.';
const MAX_BYTES=4*1024*1024;
const legacyKeys=['astrix.setup.draft.v1','astrix.setup.last.v1','astrix.missions.v1'];
export function attemptRecord(game:TurnGameState):AttemptRecord {
  const result=turnDebrief(game), t=telemetry(game.sim), last=game.commits.at(-1);
  return {id:`${game.identity}:${last?.key??'initial'}:${game.assisted}`,config:game.config,rulesVersion:game.rulesVersion,modelVersion:game.modelVersion,outcome:result.outcome,assisted:game.assisted,elapsedSec:result.elapsedSec,fuelKg:typeof game.sim.propellantKg==='number'?game.sim.propellantKg:0,energyWh:t.socWh,deliveredMB:t.downlinkedMB,discoveries:result.discoveries,evidence:result.evidence.map(({id,state,actual,target,unit})=>({id,state,actual,target,unit}))};
}
export function recordAttempt(journal:readonly AttemptRecord[], game:TurnGameState):readonly AttemptRecord[] {
  const record=attemptRecord(game);
  return journal.some(item=>item.id===record.id)?journal:[...journal,record].slice(-64);
}
export function comparable(a:AttemptRecord,b:AttemptRecord):boolean {
  return a.config.missionId===b.config.missionId&&a.config.levelId===b.config.levelId&&a.config.seed===b.config.seed&&a.rulesVersion===b.rulesVersion&&a.modelVersion===b.modelVersion;
}
function validRecord(raw:unknown):raw is AttemptRecord {
  if(!raw||typeof raw!=='object')return false;
  const value=raw as AttemptRecord;
  return typeof value.id==='string'&&value.id.length<=512&&validateQuickDesignConfig(value.config)&&['PROVISIONAL','SUCCESS','FAILURE','INCOMPLETE'].includes(value.outcome)&&typeof value.assisted==='boolean'&&[value.rulesVersion,value.modelVersion,value.elapsedSec,value.fuelKg,value.energyWh,value.deliveredMB].every(Number.isFinite)&&Array.isArray(value.discoveries)&&value.discoveries.length<=64&&value.discoveries.every(item=>typeof item==='string'&&item.length<=512)&&Array.isArray(value.evidence)&&value.evidence.length<=64&&value.evidence.every(item=>item&&typeof item.id==='string'&&typeof item.state==='string'&&typeof item.unit==='string'&&(item.actual===null||Number.isFinite(item.actual))&&(item.target===null||Number.isFinite(item.target)));
}
export function parseSave(raw:string):SaveDocument {
  if(raw.length>MAX_BYTES)throw new RangeError('Save exceeds the 4 MiB limit.');
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object')throw new RangeError('Save is not a document.');
  const saved=value as Partial<SaveDocument>;
  if(saved.format!=='astrix-turn-save'||saved.version!==1)throw new RangeError('Unsupported save format or version.');
  if(!Array.isArray(saved.journal)||saved.journal.length>64||!saved.journal.every(validRecord))throw new RangeError('Invalid discovery journal.');
  return {format:'astrix-turn-save',version:1,game:restoreTurnGame(saved.game),journal:saved.journal};
}
export function readSave(storage?:StorageLike):SavedGame {
  let raw:string|null=null;
  try {
    const store=storage??localStorage, head=store.getItem(HEAD), legacy:Record<string,string>={};
    for(const key of legacyKeys){const previous=store.getItem(key);if(previous)legacy[key]=previous;}
    if(head===null)return {document:null,issue:null,backup:null,legacy};
    if(head!=='a'&&head!=='b')return {document:null,issue:{code:'CORRUPT',detail:'Invalid save pointer.',raw:head},backup:null,legacy};
    raw=store.getItem(SLOT+head);
    let backup:SaveDocument|null=null;
    const older=store.getItem(SLOT+(head==='a'?'b':'a'));
    if(older){try{backup=parseSave(older);}catch{/* An invalid backup is never offered as recovery. */}}
    try {
      if(!raw)throw new RangeError('The selected save slot is missing.');
      return {document:parseSave(raw),issue:null,backup,legacy};
    }catch(error){return {document:null,issue:{code:'INCOMPATIBLE',detail:error instanceof Error?error.message:String(error),raw},backup,legacy};}
  }catch(error){return {document:null,issue:{code:'STORAGE',detail:error instanceof Error?error.message:String(error),raw},backup:null,legacy:{}};}
}
/** Commit the pointer last: a failed write can never replace the previous valid boundary. */
export function writeSave(game:TurnGameState,journal:readonly AttemptRecord[],storage?:StorageLike):SaveIssue|null {
  try {
    const store=storage??localStorage,head=store.getItem(HEAD),slot=head==='a'?'b':'a';
    const document:SaveDocument={format:'astrix-turn-save',version:1,game,journal};
    const raw=JSON.stringify(document);
    if(raw.length>MAX_BYTES)throw new RangeError('Save exceeds the 4 MiB limit; export this attempt.');
    store.setItem(SLOT+slot,raw);
    store.setItem(HEAD,slot);
    return null;
  }catch(error){return {code:'STORAGE',detail:error instanceof Error?error.message:String(error),raw:null};}
}
export function exportText(name:string,content:string):void {
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function exportGame(game:TurnGameState,journal:readonly AttemptRecord[]):void {
  exportText('astrix-turn-save.json',JSON.stringify({format:'astrix-turn-save',version:1,game,journal},null,2));
}
