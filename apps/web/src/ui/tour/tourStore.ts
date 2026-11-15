import { create } from 'zustand';
import type { TourId } from './tours';
import { CURRICULUM_TOURS, conceptIdsFor } from './tours';

/** v2 stored per-surface status only; it remains readable so an earlier opt-out is never forgotten. */
export const TOUR_STORAGE_KEY='astrix.tours.v2';
/** v3 adds concept-level completion and a curriculum-wide opt-out. */
export const TOUR_CONCEPTS_KEY='astrix.tours.v3';
export type TourStatus='offered'|'finished'|'skipped';
export type TourHistory=Partial<Record<TourId,TourStatus>>;
export type ConceptStatus='seen'|'dismissed';
export type ConceptHistory=Record<string,ConceptStatus>;
export type TourOrigin='auto'|'help';
export interface TourPersistence {history:TourHistory;concepts:ConceptHistory;curriculumSkipped:boolean}
type TourStorage=Pick<Storage,'getItem'>;
type TourWriteStorage=Pick<Storage,'setItem'>;
const TOUR_IDS:readonly TourId[]=['welcome','build','launch','flight','debrief','choice'];
const defaultStorage=()=>{try{return typeof localStorage==='undefined'?undefined:localStorage;}catch{return undefined;}};

function parseHistory(value:unknown):TourHistory {
 const result:TourHistory={};
 if(!value||typeof value!=='object')return result;
 for(const id of TOUR_IDS){const status=(value as Record<string,unknown>)[id];if(status==='offered'||status==='finished'||status==='skipped')result[id]=status;}
 return result;
}
export function readTourHistory(storage:TourStorage|undefined=defaultStorage()):TourHistory {
 try{return parseHistory(JSON.parse(storage?.getItem(TOUR_STORAGE_KEY)??'{}'));}catch{return {};}
}
export function saveTourHistory(history:TourHistory,storage:TourWriteStorage|undefined=defaultStorage()):void {
 try{storage?.setItem(TOUR_STORAGE_KEY,JSON.stringify(history));}catch{/* Device-local tours remain available without storage. */}
}
/** Reads v3, falling back to v2 so opt-out and completed chapters survive the shorter curriculum. */
export function readTourPersistence(storage:TourStorage|undefined=defaultStorage()):TourPersistence {
 const history=readTourHistory(storage);
 let concepts:ConceptHistory={},curriculumSkipped=false,found=false;
 try{
  const raw=JSON.parse(storage?.getItem(TOUR_CONCEPTS_KEY)??'null');
  if(raw&&typeof raw==='object'&&raw.version===3){
   found=true;curriculumSkipped=raw.curriculumSkipped===true;
   for(const [id,status] of Object.entries(raw.concepts??{}))if(status==='seen'||status==='dismissed')concepts[id]=status;
  }
 }catch{/* Corrupt v3 data is ignored; v2 status still applies. */}
 if(!found){
  curriculumSkipped=CURRICULUM_TOURS.some(id=>history[id]==='skipped');
  concepts=Object.fromEntries(CURRICULUM_TOURS.flatMap<[string,ConceptStatus]>(id=>history[id]==='finished'?conceptIdsFor(id).map(concept=>[concept,'seen']):history[id]==='skipped'?conceptIdsFor(id).map(concept=>[concept,'dismissed']):[]));
 }
 return {history,concepts,curriculumSkipped};
}
export function saveTourPersistence(value:TourPersistence,storage:TourWriteStorage|undefined=defaultStorage()):void {
 saveTourHistory(value.history,storage);
 try{storage?.setItem(TOUR_CONCEPTS_KEY,JSON.stringify({version:3,curriculumSkipped:value.curriculumSkipped,concepts:value.concepts}));}catch{/* Device-local tours remain available without storage. */}
}
interface TourState extends TourPersistence {
 active:TourId|null;index:number;origin:TourOrigin;opener:HTMLElement|null;
 start:(id:TourId,origin?:TourOrigin)=>void;move:(index:number,conceptIds?:readonly string[])=>void;offer:(id:TourId)=>void;
 /** `finished` completes the chapter; otherwise a close is a skip. Skipping an automatic curriculum chapter retires the remainder. */
 end:(finished:boolean,conceptIds?:readonly string[])=>void;
 declineOffers:()=>void;
}
export const useTourStore=create<TourState>((set,get)=>({
 active:null,index:0,origin:'auto',opener:null,...readTourPersistence(),
 start(id,origin='auto'){set({active:id,index:0,origin,opener:typeof document==='undefined'?null:document.activeElement as HTMLElement|null});},
 move(index,conceptIds=[]){
  const concepts={...get().concepts};
  for(const id of conceptIds)concepts[id]??='seen';
  const next={history:get().history,concepts,curriculumSkipped:get().curriculumSkipped};saveTourPersistence(next);set({index,concepts});
 },
 offer(id){const history={...get().history,[id]:'offered' as const};saveTourPersistence({history,concepts:get().concepts,curriculumSkipped:get().curriculumSkipped});set({history});},
 declineOffers(){const history={...get().history};for(const id of CURRICULUM_TOURS)history[id]??='offered';const next={history,concepts:get().concepts,curriculumSkipped:true};saveTourPersistence(next);set({history,curriculumSkipped:true});},
 end(finished,conceptIds=[]){
  const s=get();if(!s.active)return;
  const concepts={...s.concepts},curriculum=(CURRICULUM_TOURS as readonly string[]).includes(s.active);
  for(const id of conceptIds)concepts[id]??=finished?'seen':'dismissed';
  const history={...s.history};let curriculumSkipped=s.curriculumSkipped;
  if(s.origin==='auto'||!history[s.active]){
   history[s.active]=finished?'finished':'skipped';
   if(!finished&&curriculum&&s.origin==='auto'){
    curriculumSkipped=true;
    for(const id of CURRICULUM_TOURS)history[id]??='skipped';
    for(const id of CURRICULUM_TOURS.flatMap(conceptIdsFor))concepts[id]??='dismissed';
   }
  }
  const next={history,concepts,curriculumSkipped};saveTourPersistence(next);set({active:null,index:0,...next});
 },
}));
