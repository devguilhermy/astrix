import { createHash } from 'node:crypto';
import { createSession, reduceSession, toPublicSnapshot, selectHistoryPage, parseClientMessage, messageByteLimit, PROTOCOL_VERSION, ROLES, type ParseResult, type SessionState, type SessionIntent, type SessionActor, type ServerMessage, type ClientMessage, type TransportCode } from '@astrix/session';
import { secret, WsTickets } from './auth/wsTicket';
import { RoomQueue } from './clock';
import { RateLimit, MAX_WS_FRAME_BYTES, MAX_BUFFER_BYTES } from './security/rateLimit';
/** Control-ledger fingerprints are hashed: a 40 KB definition frame times thousands of ledger entries must not live in memory verbatim. */
const fingerprintOf = (text: string): string => createHash('sha256').update(text).digest('hex');
export interface Peer { send(data: string): number; close(code: number, reason: string): void; getBufferedAmount(): number }
interface Device { id:string; playerId:string; credential:string; host:boolean; peer:Peer|null; hello:boolean; lastSeen:number; disconnectedAt:number|null; offline:boolean; pendingSnapshot:string|null }
interface Pending { id:string; name:string; credential:string; created:number }
export class Room {
  readonly id = secret(); readonly epoch = secret(); readonly hostCapability = secret();
  readonly tickets: WsTickets; readonly queue:RoomQueue;
  state:SessionState;
  private invitation = secret(); private invitationExpiry:number; private locked = false;
  private readonly devices = new Map<string, Device>(); private readonly pending = new Map<string, Pending>();
  private readonly intents:RateLimit; private readonly frames:RateLimit; private readonly notes:RateLimit;
  private readonly controls=new Map<string,{fingerprint:string;message:ServerMessage|null}>();
  private readonly quoteExpiry=new Map<string,number>();
  constructor(readonly buildId:string, private readonly now = Date.now, schedule?: (job:()=>void)=>void) {
    this.queue=new RoomQueue(256,schedule);
    this.tickets = new WsTickets(now); this.intents = new RateLimit(20,1000,now); this.frames = new RateLimit(80,1000,now); this.notes = new RateLimit(5,10000,now);
    this.invitationExpiry = now()+900000;
    this.state = createSession({epoch:this.epoch, mode:'LAN', participantMode:'TEAM', hostPlayerId:'host', hostName:'Host'});
    this.devices.set('host', {id:'host',playerId:'host',credential:secret(),host:true,peer:null,hello:false,lastSeen:now(),disconnectedAt:now(),offline:false,pendingSnapshot:null});
  }
  private fail(code:TransportCode):never { throw new Error(code); }
  authenticate(credential:string):Device { const d=[...this.devices.values()].find(d=>d.credential===credential); if(!d)this.fail('UNAUTHORIZED'); return d; }
  hostCredential(capability:string):string { if(capability!==this.hostCapability)this.fail('UNAUTHORIZED'); return this.devices.get('host')!.credential; }
  join(token:string, roomId:string, name:string):{credential:string;pendingDeviceId:string} {
    this.maintenance();
    if(this.locked || token!==this.invitation || roomId!==this.id || this.now()>=this.invitationExpiry)this.fail('JOIN_LOCKED');
    if(this.devices.size>=4)this.fail('ROOM_FULL'); if(this.pending.size>=12)this.fail('RATE_LIMITED');
    const clean=name.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu,'').replace(/\s+/g,' ').trim();
    if(!clean || [...clean].length>24 || new TextEncoder().encode(clean).length>96)this.fail('BAD_MESSAGE');
    const p={id:secret(),name:clean,credential:secret(),created:this.now()}; this.pending.set(p.id,p);
    return {credential:p.credential,pendingDeviceId:p.id};
  }
  pairing(credential:string):{status:'pending'|'admitted';deviceId?:string;playerId?:string} {
    if([...this.pending.values()].some(p=>p.credential===credential))return {status:'pending'};
    const d=this.authenticate(credential); return {status:'admitted',deviceId:d.id,playerId:d.playerId};
  }
  lobby(credential:string) { const d=this.authenticate(credential); if(!d.host)this.fail('HOST_ONLY'); return {roomId:this.id,token:this.invitation,expires:this.invitationExpiry,locked:this.locked,devices:[...this.devices.values()].map(d=>({id:d.id,playerId:d.playerId,host:d.host,connected:!!d.peer&&this.now()-d.lastSeen<=15000,reconnecting:!d.peer||this.now()-d.lastSeen>15000})),pending:[...this.pending.values()].map(p=>({id:p.id,name:p.name})),participantMode:this.state.participantMode}; }
  mintTicket(credential:string, buildId:string):string { const d=this.authenticate(credential); if(buildId!==this.buildId)this.fail('VERSION_MISMATCH'); return this.tickets.mint({roomId:this.id,deviceId:d.id,buildId}); }
  consumeTicket(ticket:string, buildId:string):string|null { if(buildId!==this.buildId)return null; const scope=this.tickets.consume(ticket,{roomId:this.id,buildId}); return scope&&this.devices.has(scope.deviceId)?scope.deviceId:null; }
  private actor(d:Device):SessionActor { return {playerId:d.playerId,deviceId:d.id,isHost:d.host,role:this.state.participantMode==='SOLO'?'ALL':this.state.roster.find(p=>p.id===d.playerId)?.roles[0]??'SCIENCE'}; }
  private hostActor():SessionActor { return this.actor(this.devices.get('host')!); }
  private apply(intent:SessionIntent, actor=this.hostActor()):boolean { const next=reduceSession(this.state,intent,actor); this.state=next.state; return next.result.ok; }
  attach(deviceId:string, peer:Peer):void { const d=this.devices.get(deviceId); if(!d){peer.close(4403,'KICKED');return;} const old=d.peer; d.peer=peer; d.hello=false; d.lastSeen=this.now(); d.disconnectedAt=null; d.offline=false; d.pendingSnapshot=null; old?.close(4409,'REPLACED'); }
  detach(deviceId:string, peer:Peer):void { const d=this.devices.get(deviceId); if(!d || d.peer!==peer)return; d.peer=null;d.hello=false;d.disconnectedAt=this.now();if(d.host)this.queue.enqueue(()=>{this.apply({kind:'PAUSE',reason:'host-display-disconnected'});this.apply({kind:'SET_PRESENCE',playerId:d.playerId,connected:false});this.broadcast();}); }
  receive(deviceId:string, peer:Peer, raw:string|Uint8Array):void {
    const d=this.devices.get(deviceId);if(!d||d.peer!==peer)return;
    if(typeof raw!=='string'){peer.close(1003,'BAD_MESSAGE');return;}
    const bytes=new TextEncoder().encode(raw).length;
    if(bytes>MAX_WS_FRAME_BYTES){peer.close(1009,'BAD_MESSAGE');return;}
    if(!this.frames.consume(deviceId)){peer.close(1008,'RATE_LIMITED');return;}
    let input:unknown;try{input=JSON.parse(raw);}catch{peer.close(1008,'BAD_MESSAGE');return;}
    if(input&&typeof input==='object'&&'type'in input&&input.type==='HELLO'&&'protocol'in input&&input.protocol!==PROTOCOL_VERSION){peer.close(4406,'VERSION_MISMATCH');return;}
    // A malformed or oversized frame that still names itself is answered, not punished: closing would look like a terminal credential failure to the client.
    const id=input&&typeof input==='object'&&'id'in input&&typeof input.id==='string'&&input.id.length>0&&input.id.length<=128?input.id:null;
    const bad=():void=>{if(id)this.reject(d,id,'BAD_MESSAGE');else peer.close(1008,'BAD_MESSAGE');};
    if(bytes>messageByteLimit(input)){bad();return;}
    const parsed:ParseResult=parseClientMessage(input);
    if(!parsed.ok){bad();return;}const message=parsed.value;
    if(!this.queue.enqueue(()=>{
      if(d.peer!==peer||!this.devices.has(d.id))return;
      try{this.dispatch(d,message);}catch(error){console.error('ASTRIX: message handler failed; refusing it.',error);if('id'in message)this.reject(d,message.id,'BAD_MESSAGE');}
    })){peer.close(1008,'RATE_LIMITED');}
  }
  private send(d:Device,message:ServerMessage):void {
    if(message.type==='RESULT'){const entry=this.controls.get(`${d.id}:${message.id}`);if(entry&&!entry.message)entry.message=message;}
    if(!d.peer)return;if(d.peer.getBufferedAmount()>MAX_BUFFER_BYTES){d.peer.close(1013,'SLOW_CLIENT');return;}if(d.peer.send(JSON.stringify(message))===0)d.peer.close(1013,'SLOW_CLIENT');
  }
  private reject(d:Device,id:string,code:TransportCode):void { this.send(d,{type:'RESULT',id,ok:false,refusal:{ok:false,code,values:{}}}); }
  private dispatch(d:Device,m:ClientMessage):void {
    d.lastSeen=this.now();
    if(m.type==='HELLO'){
      if(m.protocol!==PROTOCOL_VERSION||m.buildId!==this.buildId){d.peer?.close(4406,'VERSION_MISMATCH');return;}
      d.hello=true;this.apply({kind:'SET_PRESENCE',playerId:d.playerId,connected:true});
      const reason=d.host?'host-display-disconnected':`controller-disconnected:${d.id}` as const;
      if(this.state.pauseReasons.includes(reason))this.apply({kind:'CLEAR_PAUSE',reason});
      this.send(d,{type:'WELCOME',protocol:PROTOCOL_VERSION,buildId:this.buildId,deviceId:d.id,playerId:d.playerId,epoch:this.epoch,snapshot:toPublicSnapshot(this.state,{playerId:d.playerId,isHost:d.host})});this.broadcast();return;
    }
    if(!d.hello){d.peer?.close(4401,'HELLO_REQUIRED');return;}
    if(m.type==='PING'){this.send(d,{type:'PONG',nonce:m.nonce,seq:this.state.seq});return;}
    if(m.type==='GET_RESULTS'){for(const id of m.ids){const result=this.state.results[`${d.id}:${id}`]?.result,control=this.controls.get(`${d.id}:${id}`)?.message;if(result)this.send(d,{type:'RESULT',id,...result});else if(control)this.send(d,control);else this.reject(d,id,'OUTCOME_UNKNOWN');}return;}
    if(m.type==='GET_HISTORY'){this.send(d,{type:'HISTORY',id:m.id,page:selectHistoryPage(this.state,m.cursor)});return;}
    if('id'in m){
    const key=`${d.id}:${m.id}`,fingerprint=fingerprintOf(JSON.stringify(m)),saved=this.controls.get(key);
    if(saved){if(saved.fingerprint!==fingerprint)this.reject(d,m.id,'DUPLICATE_ID');else if(saved.message)this.send(d,saved.message);return;}
    if(this.controls.size>=10000){this.reject(d,m.id,'RATE_LIMITED');return;}
    this.controls.set(key,{fingerprint,message:null});
    }
    if(m.type==='INTENT'){
      if(!this.intents.consume(d.id)){this.reject(d,m.id,'RATE_LIMITED');return;}
      if(m.intent.kind==='NOTE'&&!this.notes.consume(d.playerId)){this.reject(d,m.id,'RATE_LIMITED');return;}
      if(m.actor.playerId!==d.playerId || (m.actor.role==='ALL'&&this.state.participantMode!=='SOLO')){this.reject(d,m.id,'UNAUTHORIZED');return;}
      let quotes:Record<string,SessionState['quotes'][string]>|undefined;
      for(const [id,expiry]of this.quoteExpiry){
        if(!this.state.quotes[id])this.quoteExpiry.delete(id);
        else if(expiry<=this.now()){quotes??={...this.state.quotes};delete quotes[id];this.quoteExpiry.delete(id);}
      }
      if(quotes)this.state={...this.state,quotes};
      if(!this.state.results[`${d.id}:${m.id}`]&&m.intent.kind==='COMMIT_DESIGN'&&(!m.intent.quoteId||(this.quoteExpiry.get(m.intent.quoteId)??0)<=this.now())){this.reject(d,m.id,'INTENT_EXPIRED');return;}
      const actor={...this.actor(d),role:m.actor.role};
      const next=reduceSession(this.state,m,actor);this.state=next.state;
      if(next.result.ok&&next.result.quote)this.quoteExpiry.set(next.result.quote.quoteId,this.now()+30000);
      if(next.result.ok&&(m.intent.kind==='START_GAME'||m.intent.kind==='START_MISSION'||m.intent.kind==='START_DEFINITION'))this.locked=true;
      this.send(d,{type:'RESULT',id:m.id,...next.result});this.broadcast();return;
    }
    if(m.type==='READY'){const next=reduceSession(this.state,{kind:'SET_READY',ready:m.ready,rosterRevision:m.rosterRevision},this.actor(d));this.state=next.state;if(!next.result.ok)this.send(d,{type:'RESULT',id:'ready',...next.result});this.broadcast();return;}
    if(!d.host){this.reject(d,'id'in m?m.id:'admin','HOST_ONLY');return;}
    if(m.type==='ADMIT'){
      const p=this.pending.get(m.pendingDeviceId);if(!p){this.reject(d,m.id,'UNAUTHORIZED');return;}
      if(this.devices.size>=4){this.reject(d,m.id,'ROOM_FULL');return;}
      const playerId=this.state.participantMode==='SOLO'?'host':p.id;
      if(this.state.participantMode==='TEAM'&&!this.apply({kind:'ADD_PLAYER',playerId,name:p.name})){this.reject(d,m.id,'UNAUTHORIZED');return;}
      this.pending.delete(p.id);this.devices.set(p.id,{id:p.id,playerId,credential:p.credential,host:false,peer:null,hello:false,lastSeen:this.now(),disconnectedAt:this.now(),offline:false,pendingSnapshot:null});
    }else if(m.type==='KICK'){
      if(m.deviceId==='host'){this.reject(d,m.id,'HOST_ONLY');return;}
      // A pending join request is denied; an admitted device is revoked; anything else is an explicit miss, never a silent success.
      const denied=this.pending.delete(m.deviceId);
      if(!denied){if(!this.devices.has(m.deviceId)){this.reject(d,m.id,'NOT_FOUND');return;}this.revoke(m.deviceId);}
    }else if(m.type==='ROTATE_JOIN_TOKEN'){this.invitation=secret();this.invitationExpiry=this.now()+900000;this.state={...this.state,seq:this.state.seq+1};
    }else if(m.type==='ASSIGN_ROLE'){const result=reduceSession(this.state,{kind:'ASSIGN_ROLE',role:m.role,playerId:m.playerId,rosterRevision:m.rosterRevision},this.actor(d));this.state=result.state;this.send(d,{type:'RESULT',id:m.id,...result.result});this.broadcast();return;
    }else if(m.type==='ROTATE_FACILITATOR'){const result=reduceSession(this.state,{kind:'ROTATE_FACILITATOR',rosterRevision:m.rosterRevision},this.actor(d));this.state=result.state;this.send(d,{type:'RESULT',id:m.id,...result.result});this.broadcast();return;}
    this.send(d,{type:'RESULT',id:m.id,ok:true,seq:this.state.seq,receiptIds:[]});this.broadcast();
  }
  private revoke(deviceId:string):void {const d=this.devices.get(deviceId);if(!d||d.host)return;this.tickets.revoke(d.id);this.devices.delete(d.id);d.peer?.close(4403,'KICKED');if(d.playerId!=='host'){this.apply({kind:'SET_PRESENCE',playerId:d.playerId,connected:false});if(this.state.roster.some(p=>p.id===d.playerId&&p.roles.length))this.apply({kind:'PAUSE',reason:`controller-disconnected:${d.id}`});}}
  admin(credential:string,action:'lock'|'unlock'|'host-only'|'solo'|'team'):void {const d=this.authenticate(credential);if(!d.host)this.fail('HOST_ONLY');
    // Mode changes are only meaningful for a lone host before any mission exists; anything else is refused, not acknowledged and ignored.
    if((action==='solo'||action==='team')&&(this.devices.size!==1||this.state.design||this.state.sim))this.fail('JOIN_LOCKED');
    if(!this.queue.enqueue(()=>{
    if(action==='lock'||action==='unlock'){this.locked=action==='lock';this.state={...this.state,seq:this.state.seq+1};}
    if(action==='solo'||action==='team'){
      if(this.devices.size!==1||this.state.design||this.state.sim)return;
      this.state={...createSession({epoch:this.epoch,mode:'LAN',participantMode:action==='solo'?'SOLO':'TEAM',hostPlayerId:'host',hostName:'Host'}),seq:this.state.seq+1,rosterRevision:this.state.rosterRevision+1,results:this.state.results};
    }
    if(action==='host-only'){this.apply({kind:'PAUSE',reason:'manual'});for(const device of [...this.devices.values()])if(!device.host)this.revoke(device.id);for(const role of ROLES)if(!this.state.roster.find(p=>p.id==='host')?.roles.includes(role))this.apply({kind:'ASSIGN_ROLE',role,playerId:'host',rosterRevision:this.state.rosterRevision});for(const reason of this.state.pauseReasons)if(reason.startsWith('controller-disconnected:'))this.apply({kind:'CLEAR_PAUSE',reason});this.locked=true;}
    this.broadcast();
  }))this.fail('RATE_LIMITED'); }
  broadcast():void {for(const d of this.devices.values()){if(!d.peer||!d.hello)continue;const encoded=JSON.stringify({type:'SNAPSHOT',snapshot:toPublicSnapshot(this.state,{playerId:d.playerId,isHost:d.host})} satisfies ServerMessage);if(d.peer.getBufferedAmount()>MAX_BUFFER_BYTES){d.peer.close(1013,'SLOW_CLIENT');continue;}if(d.peer.getBufferedAmount()>0)d.pendingSnapshot=encoded;else{d.pendingSnapshot=null;if(d.peer.send(encoded)===0)d.peer.close(1013,'SLOW_CLIENT');}}}
  drain(deviceId:string,peer:Peer):void {const d=this.devices.get(deviceId);if(d?.peer===peer&&d.pendingSnapshot){const data=d.pendingSnapshot;d.pendingSnapshot=null;if(peer.send(data)===0)peer.close(1013,'SLOW_CLIENT');}}
  maintenance():void {
    for(const [id,p]of this.pending)if(this.now()-p.created>120000)this.pending.delete(id);
    for(const d of [...this.devices.values()]){
      const age=this.now()-d.lastSeen;
      if(d.peer&&age>30000){d.peer.close(1001,'HEARTBEAT_TIMEOUT');this.detach(d.id,d.peer);}
      if(!d.peer&&d.disconnectedAt!==null&&(age>30000||this.now()-d.disconnectedAt>30000)&&!d.offline){d.offline=true;this.queue.enqueue(()=>{if(this.devices.get(d.id)!==d||d.peer)return;const otherConnection=[...this.devices.values()].some(other=>other.id!==d.id&&other.playerId===d.playerId&&other.peer&&other.hello&&this.now()-other.lastSeen<=30000);if(d.host||!otherConnection)this.apply({kind:'SET_PRESENCE',playerId:d.playerId,connected:false});if(!d.host&&this.state.participantMode==='TEAM'&&this.state.roster.some(p=>p.id===d.playerId&&p.roles.length))this.apply({kind:'PAUSE',reason:`controller-disconnected:${d.id}`});this.broadcast();});}
      if(!d.host&&d.disconnectedAt!==null&&this.now()-d.disconnectedAt>120000)this.queue.enqueue(()=>{this.revoke(d.id);this.broadcast();});
    }
  }
  close():void {
    for(const d of this.devices.values()){this.send(d,{type:'ROOM_CLOSED',reason:'HOST_STOPPED'});this.tickets.revoke(d.id);d.peer?.close(1000,'HOST_STOPPED');}
    this.devices.clear();this.pending.clear();this.controls.clear();this.quoteExpiry.clear();
  }
}

