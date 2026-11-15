import { useSyncExternalStore } from 'react';
import { applyRemoteSnapshot, setIntentSink } from '../store';
import type { SessionSnapshot, IntentResult, SessionIntent, SessionActor } from '@astrix/session';
export interface DeviceCredential { credential:string; host:boolean; deviceId?:string; playerId?:string }
export type ConnectionStatus='local'|'connecting'|'connected'|'reconnecting'|'repair'|'ended'|'version'|'replaced';
export interface RoomSession { status:ConnectionStatus; snapshot:SessionSnapshot|null; identity:DeviceCredential|null; buildId:string; storageAvailable:boolean; error:string|null; outcomes:Readonly<Record<string,IntentResult|'pending'|'unknown'>> }
let state:RoomSession={status:'local',snapshot:null,identity:null,buildId:'',storageAvailable:true,error:null,outcomes:{}};
const listeners=new Set<()=>void>();
export function updateRoom(patch:Partial<RoomSession>):void {state={...state,...patch};for(const listener of listeners)listener();}
export function roomSession():RoomSession{return state;}
export function useRoomSession():RoomSession{return useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},roomSession,roomSession);}
const key='astrix.lan.device.v1';
export function readCredential():DeviceCredential|null {
  try {const raw=JSON.parse(sessionStorage.getItem(key)??'null');return raw&&typeof raw.credential==='string'&&typeof raw.host==='boolean'?{credential:raw.credential,host:raw.host}:null;}catch{updateRoom({storageAvailable:false});return null;}
}
export function saveCredential(identity:DeviceCredential|null):void {try{if(identity)sessionStorage.setItem(key,JSON.stringify(identity));else sessionStorage.removeItem(key);}catch{updateRoom({storageAvailable:false});}updateRoom({identity});}
export function projectSnapshot(snapshot:SessionSnapshot):boolean {
  if(state.snapshot?.epoch===snapshot.epoch&&state.snapshot.seq>=snapshot.seq)return false;
  if(state.snapshot&&state.snapshot.epoch!==snapshot.epoch){updateRoom({status:'ended',outcomes:{},error:'ROOM_CLOSED'});return false;}
  applyRemoteSnapshot(snapshot);updateRoom({snapshot});return true;
}
export function bindRoomSink(sink:(intent:SessionIntent,actor:SessionActor)=>void, identity:DeviceCredential):void {setIntentSink(sink,{playerId:identity.playerId??'host',isHost:identity.host});}
export function clearRoom():void {setIntentSink(null);saveCredential(null);updateRoom({status:'local',snapshot:null,outcomes:{},error:null});}
