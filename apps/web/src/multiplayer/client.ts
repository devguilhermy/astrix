import { PROTOCOL_VERSION, MAX_CLIENT_FRAME_BYTES, MAX_DEFINITION_FRAME_BYTES, type ClientMessage, type ServerMessage, type SessionIntent, type SessionActor } from '@astrix/session';
import { backoffDelayMs, terminalClose, terminalHttp, RECONNECT_MAX_ATTEMPTS } from './reconnect';
import { bindRoomSink, projectSnapshot, readCredential, roomSession, saveCredential, updateRoom, clearRoom, type DeviceCredential } from './session';
import { applyRemoteResult } from '../store';
let counter=0;
const pageId=Math.random().toString(36).slice(2);
export const requestId=():string=>`${pageId}-${Date.now().toString(36)}-${(++counter).toString(36)}`;
/** The document keeps its original hashed entry even if the host is rebuilt/restarted. */
export function appBuildId():string|null {const script=document.querySelector<HTMLScriptElement>('script[type="module"][src]');return script?new URL(script.src,location.href).pathname:null;}
export class ApiError extends Error {constructor(readonly status:number,readonly code:string){super(code);}}
export async function roomApi<T>(path:string,body:unknown={},credential=roomSession().identity?.credential):Promise<T>{
  const response=await fetch(`/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(credential?{Authorization:`Bearer ${credential}`}:{})},body:JSON.stringify(body),cache:'no-store'});
  const value=await response.json();if(!response.ok)throw new ApiError(response.status,typeof value.code==='string'?value.code:'BAD_MESSAGE');return value;
}
export interface LobbyInfo {roomId:string;token:string;expires:number;locked:boolean;participantMode:'SOLO'|'TEAM';devices:{id:string;playerId:string;host:boolean;connected:boolean;reconnecting:boolean}[];pending:{id:string;name:string}[]}
export class RoomClient {
  private socket:WebSocket|null=null;private reconnectTimer:number|undefined;private heartbeat:number|undefined;private attempts=0;private stopped=false;private generation=0;private lastPong=0;
  private readonly pending=new Set<string>();
  private journalEpoch:string|null=null;
  private readonly commits=new Map<string,{intent:Extract<SessionIntent,{kind:'QUOTE_DESIGN'|'COMMIT_DESIGN'}>;actor:SessionActor}>();
  private readonly visible=()=>{if(document.visibilityState==='visible')this.resync();};
  private readonly pageshow=()=>this.resync();
  constructor(){window.addEventListener('pageshow',this.pageshow);document.addEventListener('visibilitychange',this.visible);}
  private journal():void {try{sessionStorage.setItem('astrix.lan.pending.v1',JSON.stringify({epoch:this.journalEpoch,ids:[...this.pending]}));}catch{updateRoom({storageAvailable:false});}}
  async start(identity:DeviceCredential):Promise<void>{
    const previous=roomSession().identity??readCredential();
    if(previous?.credential!==identity.credential){
      this.pending.clear();this.commits.clear();this.journalEpoch=null;updateRoom({snapshot:null,outcomes:{}});
      try{sessionStorage.removeItem('astrix.lan.pending.v1');}catch{updateRoom({storageAvailable:false});}
    }
    clearTimeout(this.reconnectTimer);clearInterval(this.heartbeat);const old=this.socket;this.socket=null;old?.close();this.attempts=0;
    this.stopped=false;saveCredential(identity);bindRoomSink((intent,actor)=>this.intent(intent,actor),identity);updateRoom({status:'connecting',error:null});await this.connect();
  }
  private async connect():Promise<void>{
    if(this.stopped)return;const generation=++this.generation;
    try{
      const health=await fetch('/health',{cache:'no-store'});if(!health.ok)throw new Error('NETWORK');const info=await health.json();
      if(info.protocol!==PROTOCOL_VERSION||typeof info.buildId!=='string'||info.buildId!==appBuildId()){this.stop('version','VERSION_MISMATCH');return;}
      updateRoom({buildId:info.buildId});const ticket=await roomApi<{ticket:string}>('ticket',{buildId:info.buildId});if(this.stopped||generation!==this.generation)return;
      const url=new URL('/ws',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('ticket',ticket.ticket);url.searchParams.set('buildId',info.buildId);
      const socket=new WebSocket(url);this.socket=socket;
      socket.onopen=()=>{if(socket!==this.socket)return;this.lastPong=Date.now();this.send({type:'HELLO',protocol:PROTOCOL_VERSION,buildId:info.buildId,lastSeq:roomSession().snapshot?.seq??0});};
      socket.onmessage=event=>{if(socket!==this.socket)return;try{this.receive(JSON.parse(event.data));}catch{this.stop('ended','BAD_MESSAGE');}};
      socket.onclose=event=>{if(socket!==this.socket||this.stopped)return;this.socket=null;clearInterval(this.heartbeat);if(terminalClose(event.code)){this.stop(event.code===4409?'replaced':event.code===4406?'version':'repair',event.reason||'BAD_MESSAGE',event.code===4401||event.code===4403);return;}this.retry();};
    }catch(error){if(this.stopped||generation!==this.generation)return;if(error instanceof ApiError&&terminalHttp(error.status)){this.stop(error.status===426?'version':'repair',error.code,error.status===401||error.status===403);return;}this.retry();}
  }
  private receive(raw:unknown):void {
    if(!raw||typeof raw!=='object'||!('type'in raw))throw new Error('BAD_MESSAGE');
    // The server is the authority; validate transport discriminator/context before projection.
    const message=raw as ServerMessage;
    if(message.type==='WELCOME'){
      if(message.protocol!==PROTOCOL_VERSION||message.buildId!==roomSession().buildId||!message.snapshot||message.epoch!==message.snapshot.epoch){this.stop('version','VERSION_MISMATCH');return;}
      const identity={...roomSession().identity!,deviceId:message.deviceId,playerId:message.playerId};saveCredential(identity);bindRoomSink((intent,actor)=>this.intent(intent,actor),identity);
      if(this.journalEpoch===null){
        try{const saved=JSON.parse(sessionStorage.getItem('astrix.lan.pending.v1')??'null');if(saved?.epoch===message.epoch&&Array.isArray(saved.ids))for(const id of saved.ids.slice(0,64))if(typeof id==='string'&&id.length<=128)this.pending.add(id);}catch{updateRoom({storageAvailable:false});}
      }
      this.journalEpoch=message.epoch;
      projectSnapshot(message.snapshot);if(roomSession().status==='ended')return;this.attempts=0;updateRoom({status:'connected',error:null});
      this.send({type:'READY',ready:false,rosterRevision:message.snapshot.rosterRevision});if(this.pending.size)this.send({type:'GET_RESULTS',ids:[...this.pending]});
      clearInterval(this.heartbeat);this.heartbeat=window.setInterval(()=>{if(Date.now()-this.lastPong>15000){this.resync();return;}this.send({type:'PING',nonce:requestId()});},5000);return;
    }
    if(message.type==='SNAPSHOT'){if(message.snapshot?.protocol!==PROTOCOL_VERSION||!Number.isInteger(message.snapshot.seq))throw new Error('BAD_MESSAGE');projectSnapshot(message.snapshot);return;}
    if(message.type==='RESULT'){
      applyRemoteResult(message);
      this.pending.delete(message.id);
      this.journal();
      updateRoom({outcomes:{...roomSession().outcomes,[message.id]:!message.ok&&message.refusal.code==='OUTCOME_UNKNOWN'?'unknown':message},error:message.ok?null:message.refusal.code});
      const commit=this.commits.get(message.id);
      if(commit){
        this.commits.delete(message.id);
        if(message.ok&&message.quote&&roomSession().status==='connected'&&roomSession().snapshot?.design?.revision===commit.intent.baseRevision){
          this.intent({...commit.intent,kind:'COMMIT_DESIGN',quoteId:message.quote.quoteId},commit.actor);
        }else if(message.ok)updateRoom({error:'STALE_DESIGN'});
      }
      return;
    }
    if(message.type==='PONG'){this.lastPong=Date.now();return;}
    if(message.type==='ROOM_CLOSED'){this.stop('ended','ROOM_CLOSED');return;}
  }
  send(message:ClientMessage):boolean {
    if(this.socket?.readyState!==WebSocket.OPEN){updateRoom({error:'OFFLINE'});return false;}
    const definition=message.type==='INTENT'&&(message.intent.kind==='START_DEFINITION'||message.intent.kind==='SUBMIT_DEFINITION');
    const encoded=JSON.stringify(message),limit=definition?MAX_DEFINITION_FRAME_BYTES:MAX_CLIENT_FRAME_BYTES;
    if(new TextEncoder().encode(encoded).length>limit){updateRoom({error:'MESSAGE_TOO_LARGE'});return false;}
    try{this.socket.send(encoded);return true;}catch{updateRoom({error:'OFFLINE'});return false;}
  }
  intent(intent:SessionIntent,actor:SessionActor):string|null {
    const state=roomSession();if(state.status!=='connected'||!state.snapshot||!state.identity){updateRoom({error:'OFFLINE'});return null;}
    if(this.pending.size>=64){updateRoom({error:'RATE_LIMITED'});return null;}
    const id=requestId(),commit=intent.kind==='COMMIT_DESIGN'&&!intent.quoteId?intent:null;
    const transmitted=commit?{...commit,kind:'QUOTE_DESIGN' as const}:intent;
    if(!this.send({type:'INTENT',id,epoch:state.snapshot.epoch,attemptId:state.snapshot.attemptId,rosterRevision:state.snapshot.rosterRevision,actor:{role:actor.role,playerId:state.identity.playerId},intent:transmitted}))return null;
    this.pending.add(id);
    if(commit)this.commits.set(id,{intent:commit,actor});
    this.journal();
    updateRoom({outcomes:{...Object.fromEntries(Object.entries(state.outcomes).slice(-127)),[id]:'pending'}});
    return id;
  }
  private retry():void {if(this.stopped)return;this.commits.clear();updateRoom({status:'reconnecting',error:'OFFLINE'});if(this.attempts>=RECONNECT_MAX_ATTEMPTS){this.stop('reconnecting','RETRY_EXHAUSTED');return;}clearTimeout(this.reconnectTimer);this.reconnectTimer=window.setTimeout(()=>void this.connect(),backoffDelayMs(this.attempts++));}
  resync():void {if(this.stopped)return;this.commits.clear();this.attempts=0;clearTimeout(this.reconnectTimer);clearInterval(this.heartbeat);const old=this.socket;this.socket=null;old?.close();updateRoom({status:'reconnecting'});void this.connect();}
  private stop(status:'reconnecting'|'repair'|'ended'|'version'|'replaced',error:string,forgetCredential=false):void {this.stopped=true;++this.generation;clearTimeout(this.reconnectTimer);clearInterval(this.heartbeat);const old=this.socket;this.socket=null;old?.close();updateRoom({status,error});if(forgetCredential)saveCredential(null);}
  exit():void {this.stopped=true;++this.generation;clearTimeout(this.reconnectTimer);clearInterval(this.heartbeat);this.socket?.close(1000,'LEFT');this.socket=null;this.commits.clear();this.pending.clear();this.journal();window.removeEventListener('pageshow',this.pageshow);document.removeEventListener('visibilitychange',this.visible);clearRoom();client=null;}
  retryNow():void {const identity=roomSession().identity??readCredential();if(identity){this.stopped=false;this.resync();}}
}
let client:RoomClient|null=null;
export function roomClient():RoomClient {return client??=new RoomClient();}
export async function connectSavedRoom():Promise<boolean> {const identity=readCredential();if(!identity)return false;await roomClient().start(identity);return true;}
