// Adapted narrowly from Void Protocol stores/cueStore.ts, pin 218625d (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence).
import { create } from 'zustand';
export const useCueStore = create<{target:string|null;expires:number;request:(target:string,duration?:number)=>void;clear:()=>void}>((set)=>({
 target:null,expires:0,
 request(target,duration=5000){set({target,expires:Date.now()+duration});},
 clear(){set({target:null,expires:0});},
}));
export function requestCue(target:string,duration=5000):void {useCueStore.getState().request(target,duration);}
