// Adapted from Void Protocol (© Guilhermy), apps/web/src/stores/gameEvents.ts @ 218625d.
// Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
import type { SimEvent } from '@astrix/core';
export type GameEventListener=(event:SimEvent)=>void;
const listeners=new Set<GameEventListener>();
export function emitGameEvent(event:SimEvent):void{for(const listener of listeners)listener(event);}
export function subscribeGameEvents(listener:GameEventListener):()=>void{listeners.add(listener);return()=>{listeners.delete(listener);};}
