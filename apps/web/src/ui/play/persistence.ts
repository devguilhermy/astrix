import { restoreTurnGame, telemetry, turnDebrief, validateQuickDesignConfig, type QuickDesignConfig, type TurnGameState } from '@astrix/core';
import { missionScore } from './turnMoments';

export interface AttemptRecord {
  id:string; config:QuickDesignConfig; rulesVersion:number; modelVersion:number; outcome:string; assisted:boolean;
  elapsedSec:number; fuelKg:number; energyWh:number; deliveredMB:number; discoveries:readonly string[];
  evidence:readonly {id:string;state:string;actual:number|null;target:number|null;unit:string}[];
  /** Optional so records saved before scoring was shown still load: core score total, stars and committed turns. */
  score?:number; stars?:number; turns?:number;
}
export interface SaveDocument { format:'astrix-turn-save'; version:1; game:TurnGameState; journal:readonly AttemptRecord[] }
export interface StorageLike { getItem(key:string):string|null; removeItem(key:string):void }
/** Keys of the retired decision-boundary auto-save; purged so no stale attempt is ever offered. */
const RETIRED_SAVE_KEYS=['astrix.play.save.v1.head','astrix.play.save.v1.a','astrix.play.save.v1.b'];
const MAX_BYTES=4*1024*1024;
const legacyKeys=['astrix.setup.draft.v1','astrix.setup.last.v1','astrix.missions.v1'];
export function attemptRecord(game:TurnGameState):AttemptRecord {
  const result=turnDebrief(game), t=telemetry(game.sim), last=game.commits.at(-1), score=missionScore(game);
  return {id:`${game.identity}:${last?.key??'initial'}:${game.assisted}`,config:game.config,rulesVersion:game.rulesVersion,modelVersion:game.modelVersion,outcome:result.outcome,assisted:game.assisted,elapsedSec:result.elapsedSec,fuelKg:typeof game.sim.propellantKg==='number'?game.sim.propellantKg:0,energyWh:t.socWh,deliveredMB:t.downlinkedMB,discoveries:result.discoveries,evidence:result.evidence.map(({id,state,actual,target,unit})=>({id,state,actual,target,unit})),score:score.total,stars:score.stars,turns:game.receipts.length};
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
  return typeof value.id==='string'&&value.id.length<=512&&validateQuickDesignConfig(value.config)&&['PROVISIONAL','SUCCESS','FAILURE','INCOMPLETE'].includes(value.outcome)&&typeof value.assisted==='boolean'&&[value.rulesVersion,value.modelVersion,value.elapsedSec,value.fuelKg,value.energyWh,value.deliveredMB].every(Number.isFinite)&&Array.isArray(value.discoveries)&&value.discoveries.length<=64&&value.discoveries.every(item=>typeof item==='string'&&item.length<=512)&&Array.isArray(value.evidence)&&value.evidence.length<=64&&value.evidence.every(item=>item&&typeof item.id==='string'&&typeof item.state==='string'&&typeof item.unit==='string'&&(item.actual===null||Number.isFinite(item.actual))&&(item.target===null||Number.isFinite(item.target)))&&[value.score,value.stars,value.turns].every(item=>item===undefined||Number.isFinite(item));
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
/** Attempts are never written to storage: the journal lives for this page visit only (Export keeps a file copy). */
let visitJournal:readonly AttemptRecord[]=[];
export const readVisitJournal=():readonly AttemptRecord[]=>visitJournal;
export function rememberJournal(journal:readonly AttemptRecord[]):void { visitJournal=journal; }
export function clearStoredSaves(storage?:StorageLike):void {
  try{const store=storage??localStorage;for(const key of RETIRED_SAVE_KEYS)store.removeItem(key);}catch{/* Unavailable storage holds nothing to purge. */}
}
/** Pre-turn-rules drafts and missions are never converted; they stay exportable. */
export function readLegacy(storage?:StorageLike):Readonly<Record<string,string>> {
  const legacy:Record<string,string>={};
  try{const store=storage??localStorage;for(const key of legacyKeys){const previous=store.getItem(key);if(previous)legacy[key]=previous;}}catch{/* Unavailable storage holds no legacy work. */}
  return legacy;
}
export function exportText(name:string,content:string):void {
  const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function exportGame(game:TurnGameState,journal:readonly AttemptRecord[]):void {
  exportText('astrix-turn-save.json',JSON.stringify({format:'astrix-turn-save',version:1,game,journal},null,2));
}
