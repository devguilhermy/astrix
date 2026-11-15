import { create } from 'zustand';
import type { TourId } from './tours';
export const TOUR_STORAGE_KEY='astrix.tours.v1';
export type TourHistory=Partial<Record<TourId,'offered'|'finished'|'skipped'>>;
export function readTourHistory(storage:Pick<Storage,'getItem'>|undefined=typeof localStorage==='undefined'?undefined:localStorage):TourHistory {
 try {const value=JSON.parse(storage?.getItem(TOUR_STORAGE_KEY)??'{}');const result:TourHistory={};for(const id of ['welcome','build','launch','flight','debrief'] as const)if(['offered','finished','skipped'].includes(value?.[id]))result[id]=value[id];return result;}catch{return {};}
}
export function saveTourHistory(history:TourHistory,storage:Pick<Storage,'setItem'>|undefined=typeof localStorage==='undefined'?undefined:localStorage):void {try{storage?.setItem(TOUR_STORAGE_KEY,JSON.stringify(history));}catch{/* Device-local tours remain available without storage. */}}
export const useTourStore=create<{active:TourId|null;index:number;history:TourHistory;opener:HTMLElement|null;start:(id:TourId)=>void;move:(index:number)=>void;offer:(id:TourId)=>void;end:(finished:boolean)=>void}>((set,get)=>({
 active:null,index:0,history:readTourHistory(),opener:null,
 start(id){set({active:id,index:0,opener:typeof document==='undefined'?null:document.activeElement as HTMLElement|null});},
 move(index){set({index});},
 offer(id){const history={...get().history,[id]:'offered' as const};saveTourHistory(history);set({history});},
 end(finished){const s=get();if(!s.active)return;const history={...s.history,[s.active]:finished?'finished' as const:'skipped' as const};saveTourHistory(history);set({active:null,index:0,history});},
}));
