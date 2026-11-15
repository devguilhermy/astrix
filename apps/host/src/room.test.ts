import { expect, test } from 'bun:test';
import type { ClientMessage, ServerMessage, SessionIntent } from '@astrix/session';
import { Room, type Peer } from './room';
import { MAX_BUFFER_BYTES } from './security/rateLimit';
class TestPeer implements Peer {
 messages:ServerMessage[]=[];closes:{code:number;reason:string}[]=[];buffered=0;
 send(raw:string){this.messages.push(JSON.parse(raw));return raw.length;}
 close(code:number,reason:string){this.closes.push({code,reason});}
 getBufferedAmount(){return this.buffered;}
}
const schedules=new WeakMap<Room,(()=>void)[]>();
function settle(room:Room){const jobs=schedules.get(room)!;while(jobs.length)jobs.shift()!();}
async function fixture(now=()=>0){const jobs:(()=>void)[]=[],room=new Room('build',now,job=>jobs.push(job)),credential=room.hostCredential(room.hostCapability),host=new TestPeer();schedules.set(room,jobs);room.attach('host',host);room.receive('host',host,JSON.stringify({type:'HELLO',protocol:1,buildId:'build',lastSeq:0}));room.receive('host',host,JSON.stringify({type:'READY',ready:true,rosterRevision:room.state.rosterRevision}));settle(room);return{room,credential,host};}
async function send(room:Room,peer:TestPeer,message:ClientMessage,device='host'){room.receive(device,peer,JSON.stringify(message));settle(room);}
async function admit(room:Room,credential:string,host:TestPeer,name:string){const lobby=room.lobby(credential),pair=room.join(lobby.token,lobby.roomId,name);await send(room,host,{type:'ADMIT',id:`admit-${pair.pendingDeviceId}`,pendingDeviceId:pair.pendingDeviceId,playerId:pair.pendingDeviceId});return pair;}
function intent(room:Room,id:string,value:SessionIntent):ClientMessage{return{type:'INTENT',id,epoch:room.epoch,attemptId:room.state.attemptId,rosterRevision:room.state.rosterRevision,actor:{role:'SCIENCE',playerId:'host'},intent:value};}
test('host approval owns a seat; four devices includes host, pending races cannot over-admit',async()=>{
 const{room,credential,host}=await fixture();const lobby=room.lobby(credential),pending=Array.from({length:4},(_,i)=>room.join(lobby.token,lobby.roomId,`Phone ${i}`));
 expect(room.lobby(credential).devices.length).toBe(1);expect(room.pairing(pending[0].credential).status).toBe('pending');
 for(const pair of pending)room.receive('host',host,JSON.stringify({type:'ADMIT',id:pair.pendingDeviceId,pendingDeviceId:pair.pendingDeviceId,playerId:pair.pendingDeviceId}));settle(room);
 expect(room.lobby(credential).devices.length).toBe(4);expect(room.pairing(pending[0].credential).status).toBe('admitted');expect(()=>room.join(lobby.token,lobby.roomId,'Fifth')).toThrow('ROOM_FULL');expect(host.messages.some(m=>m.type==='RESULT'&&!m.ok&&m.refusal.code==='ROOM_FULL')).toBe(true);
});
test('bounded pending requests, Unicode names and rotating invitations',async()=>{
 const{room,credential,host}=await fixture();const lobby=room.lobby(credential);for(let i=0;i<12;i++)room.join(lobby.token,lobby.roomId,i===0?'  Jo\u202eão  ':'Guest');expect(room.lobby(credential).pending[0].name).toBe('João');expect(()=>room.join(lobby.token,lobby.roomId,'overflow')).toThrow('RATE_LIMITED');await send(room,host,{type:'ROTATE_JOIN_TOKEN',id:'rotate'});expect(()=>room.join(lobby.token,lobby.roomId,'old invitation')).toThrow('JOIN_LOCKED');
});
test('kick revokes credential, tickets and socket; duplicate admin IDs do not repeat admission',async()=>{
 const{room,credential,host}=await fixture(),pair=await admit(room,credential,host,'Phone');const ticket=room.mintTicket(pair.credential,'build');const phone=new TestPeer();room.attach(pair.pendingDeviceId,phone);
 await send(room,host,{type:'ADMIT',id:`admit-${pair.pendingDeviceId}`,pendingDeviceId:pair.pendingDeviceId,playerId:pair.pendingDeviceId});expect(room.lobby(credential).devices.length).toBe(2);
 await send(room,host,{type:'KICK',id:'kick',deviceId:pair.pendingDeviceId});expect(phone.closes.at(-1)?.code).toBe(4403);expect(room.consumeTicket(ticket,'build')).toBeNull();expect(()=>room.mintTicket(pair.credential,'build')).toThrow('UNAUTHORIZED');expect(room.lobby(credential).devices.length).toBe(1);
});
test('one socket per credential and grace reserves seats until revoked',async()=>{
 let now=0;const{room,credential,host}=await fixture(()=>now),pair=await admit(room,credential,host,'Phone');const first=new TestPeer(),second=new TestPeer();room.attach(pair.pendingDeviceId,first);room.attach(pair.pendingDeviceId,second);expect(first.closes.at(-1)?.code).toBe(4409);room.detach(pair.pendingDeviceId,first);expect(room.lobby(credential).devices.find(d=>d.id===pair.pendingDeviceId)?.connected).toBe(true);room.detach(pair.pendingDeviceId,second);now=119999;room.maintenance();settle(room);expect(room.lobby(credential).devices.length).toBe(2);now=120001;room.maintenance();settle(room);expect(room.lobby(credential).devices.length).toBe(1);
});
test('intent IDs survive lost ACK and reconnect without a second mission start',async()=>{
 const{room,host}=await fixture();const start=intent(room,'start',{kind:'START_SCENARIO',scenarioId:'FIRST_LIGHT',levelId:'ASPIRING'});await send(room,host,start);const attempt=room.state.attemptId;await send(room,host,start);expect(room.state.attemptId).toBe(attempt);await send(room,host,{type:'GET_RESULTS',ids:['start']});const results=host.messages.filter(m=>m.type==='RESULT'&&m.id==='start');expect(results.length).toBe(3);expect(results[0]).toEqual(results[2]);
 room.detach('host',host);settle(room);expect(room.state.pauseReasons).toContain('host-display-disconnected');const replacement=new TestPeer();room.attach('host',replacement);await send(room,replacement,{type:'HELLO',protocol:1,buildId:'build',lastSeq:0});expect(room.state.attemptId).toBe(attempt);expect(room.state.running).toBe(false);
});
test('frame, rate, queue and slow-socket caps refuse work before unbounded growth',async()=>{
 const{room,host}=await fixture();room.receive('host',host,'x'.repeat(8193));expect(host.closes.at(-1)?.code).toBe(1009);
 for(let i=0;i<81;i++)room.receive('host',host,JSON.stringify({type:'PING',nonce:String(i)}));expect(host.closes.some(close=>close.reason==='RATE_LIMITED')).toBe(true);settle(room);
 const{room:slowRoom}=await fixture(),slow=new TestPeer();slowRoom.attach('host',slow);slow.buffered=MAX_BUFFER_BYTES+1;await send(slowRoom,slow,{type:'HELLO',protocol:1,buildId:'build',lastSeq:0});expect(slow.closes.some(close=>close.reason==='SLOW_CLIENT')).toBe(true);
 let accepted=0;for(let i=0;i<300;i++)if(room.queue.enqueue(()=>{}))accepted++;expect(accepted).toBeLessThanOrEqual(255);settle(room);
});
test('host scheduling stall is a shared pause and never advances missed wall time',async()=>{const{room}=await fixture();room.stall();settle(room);expect(room.state.pauseReasons).toContain('host-stall');expect(room.state.running).toBe(false);});
test('roles and Ready belong to authenticated players; forged actors and guest admin are refused',async()=>{
 const{room,credential,host}=await fixture(),pair=await admit(room,credential,host,'Ana'),phone=new TestPeer();
 room.attach(pair.pendingDeviceId,phone);await send(room,phone,{type:'HELLO',protocol:1,buildId:'build',lastSeq:0},pair.pendingDeviceId);
 await send(room,host,{type:'ASSIGN_ROLE',id:'assign',role:'SCIENCE',playerId:pair.pendingDeviceId,rosterRevision:room.state.rosterRevision});
 await send(room,phone,{type:'READY',ready:true,rosterRevision:room.state.rosterRevision},pair.pendingDeviceId);
 expect(room.state.roster.find(p=>p.id===pair.pendingDeviceId)?.ready).toBe(true);
 await send(room,phone,{type:'KICK',id:'guest-kick',deviceId:'host'},pair.pendingDeviceId);
 expect(phone.messages.some(m=>m.type==='RESULT'&&!m.ok&&m.refusal.code==='HOST_ONLY')).toBe(true);
 await send(room,phone,intent(room,'forge',{kind:'PAUSE'}),pair.pendingDeviceId);
 expect(phone.messages.some(m=>m.type==='RESULT'&&m.id==='forge'&&!m.ok&&m.refusal.code==='UNAUTHORIZED')).toBe(true);
 await send(room,host,{type:'ASSIGN_ROLE',id:'takeover',role:'SCIENCE',playerId:'host',rosterRevision:room.state.rosterRevision});
 expect(room.state.roster.find(p=>p.id===pair.pendingDeviceId)?.ready).toBe(false);
 expect(JSON.stringify(host.messages)).not.toContain(pair.credential);expect(JSON.stringify(phone.messages)).not.toContain(room.hostCapability);
});
test('pending telemetry is coalesced while correlated control results remain bounded',async()=>{
 const{room,host}=await fixture();host.messages=[];host.buffered=1;
 await send(room,host,intent(room,'pause-1',{kind:'PAUSE'}));await send(room,host,intent(room,'pause-2',{kind:'PAUSE'}));
 expect(host.messages.filter(m=>m.type==='SNAPSHOT')).toHaveLength(0);host.buffered=0;room.drain('host',host);
 const snapshots=host.messages.filter(m=>m.type==='SNAPSHOT');expect(snapshots).toHaveLength(1);expect(snapshots[0].type==='SNAPSHOT'&&snapshots[0].snapshot.seq).toBe(room.state.seq);
});
test('gameplay device rate and per-player note rate are enforced independently',async()=>{
 const{room,host}=await fixture();
 for(let i=0;i<21;i++)await send(room,host,intent(room,`rate-${i}`,{kind:'PAUSE'}));
 expect(host.messages.some(m=>m.type==='RESULT'&&m.id==='rate-20'&&!m.ok&&m.refusal.code==='RATE_LIMITED')).toBe(true);
 let now=0;const notes=await fixture(()=>now);await send(notes.room,notes.host,intent(notes.room,'start-notes',{kind:'START_SCENARIO',scenarioId:'FIRST_LIGHT',levelId:'ASPIRING'}));
 for(let i=0;i<6;i++){now+=100;await send(notes.room,notes.host,intent(notes.room,`note-${i}`,{kind:'NOTE',category:'SIDEBAR',target:'power',text:'Review this power budget.',designRevision:notes.room.state.design!.revision}));}
 expect(notes.host.messages.some(m=>m.type==='RESULT'&&m.id==='note-5'&&!m.ok&&m.refusal.code==='RATE_LIMITED')).toBe(true);
});
test('host-only continuation revokes phones, transfers ownership and preserves the attempt',async()=>{
 const{room,credential,host}=await fixture();await send(room,host,intent(room,'start-host-only',{kind:'START_SCENARIO',scenarioId:'FIRST_LIGHT',levelId:'ASPIRING'}));
 room.admin(credential,'unlock');settle(room);const pair=await admit(room,credential,host,'Controller');await send(room,host,{type:'ASSIGN_ROLE',id:'phone-science',role:'SCIENCE',playerId:pair.pendingDeviceId,rosterRevision:room.state.rosterRevision});
 const design=room.state.design,attempt=room.state.attemptId;room.admin(credential,'host-only');settle(room);
 expect(room.state.design).toBe(design);expect(room.state.attemptId).toBe(attempt);expect(room.state.running).toBe(false);expect(room.state.roster.find(p=>p.id==='host')?.roles).toHaveLength(4);expect(room.lobby(credential).devices).toHaveLength(1);expect(()=>room.mintTicket(pair.credential,'build')).toThrow('UNAUTHORIZED');expect(room.lobby(credential).locked).toBe(true);
});
