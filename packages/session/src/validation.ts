import { BUILTIN_DEFINITIONS, ascentProgramIssue, burnSpecValid, listLaunchers, listParts, listRides, validateQuickDesignConfig } from '@astrix/core';
import type { ActorContext, AscentProgram, BuiltinMissionId, BurnSpec, BurnTrigger, Command, Digest, OrbitChoice } from '@astrix/core';
import { MAX_CLIENT_FRAME_BYTES, MAX_DEFINITION_FRAME_BYTES, ROLES, STAGES, WARPS } from './contracts';
import type { DesignEdit, PauseReason, SessionIntent } from './contracts';
import type { ClientMessage, ParseResult } from './protocol';
const buses=['CUBESAT_3U','SMALLSAT','CREW_CAPSULE'] as const;
const parts=new Set(buses.flatMap(bus=>listParts(bus).map(p=>p.id)));
const builtinIds=new Set<string>(BUILTIN_DEFINITIONS.map(d=>d.id));
const launchers=new Set(listLaunchers().map(l=>l.id));
const rides=new Set(buses.flatMap(bus=>(['EARTH','MARS','SUN'] as const).flatMap(body=>listRides(bus,body).map(r=>r.id))));
function record(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function shape(value:unknown,required:readonly string[],optional:readonly string[]=[]):value is Record<string,unknown>{return record(value)&&required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>required.includes(key)||optional.includes(key));}
function text(value:unknown,max=128):value is string{return typeof value==='string'&&value.length>0&&value.length<=max;}
function integer(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
function finite(value:unknown,min=-1e12,max=1e12):value is number{return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;}
function member<T extends string>(value:unknown,values:readonly T[]):value is T{return typeof value==='string'&&values.some(item=>item===value);}
function orbit(value:unknown):OrbitChoice|null {
 if(!shape(value,['body','epochUTC','frame','smaKm','ecc','inclinationDeg','raanDeg','argPeriapsisDeg','trueAnomalyDeg'])||!member(value.body,['EARTH','MARS','MOON','SUN'])||!text(value.epochUTC,40)||!Number.isFinite(Date.parse(value.epochUTC))||value.frame!=='MJ2000Eq'||!finite(value.smaKm,1,1e9)||!finite(value.ecc,0,.999999999)||!finite(value.inclinationDeg,0,180)||!finite(value.raanDeg,0,360)||!finite(value.argPeriapsisDeg,0,360)||!finite(value.trueAnomalyDeg,0,360))return null;
 return {body:value.body,epochUTC:value.epochUTC,frame:'MJ2000Eq',smaKm:value.smaKm,ecc:value.ecc,inclinationDeg:value.inclinationDeg,raanDeg:value.raanDeg,argPeriapsisDeg:value.argPeriapsisDeg,trueAnomalyDeg:value.trueAnomalyDeg};
}
function trigger(value:unknown):BurnTrigger|null {
 if(!record(value))return null;
 switch(value.kind){
 case 'AT_TIME':return shape(value,['kind','tSec'])&&finite(value.tSec,0,1e9)?{kind:'AT_TIME',tSec:value.tSec}:null;
 case 'AT_APSIS':return shape(value,['kind','apsis','notBeforeSec'],['body'])&&member(value.apsis,['PERIAPSIS','APOAPSIS'])&&finite(value.notBeforeSec,0,1e9)&&(value.body===undefined||member(value.body,['EARTH','MARS','MOON','SUN']))?{kind:'AT_APSIS',apsis:value.apsis,notBeforeSec:value.notBeforeSec,...(typeof value.body==='string'?{body:value.body}:{})}:null;
 case 'AT_SOI_ENTRY':return shape(value,['kind','body','delaySec'])&&value.body==='MOON'&&finite(value.delaySec,0,1e9)?{kind:'AT_SOI_ENTRY',body:'MOON',delaySec:value.delaySec}:null;
 default:return null;
 }
}
/** Rebuilt field by field, then checked by the same predicate the flight engine uses. */
function burn(value:unknown):BurnSpec|null {
 if(!shape(value,['id','source','trigger','frame','dv','model'])||!text(value.id,24)||!member(value.source,['SPACECRAFT','UPPER_STAGE'])||!member(value.frame,['VNR','INERTIAL'])||value.model!=='IMPULSIVE')return null;
 const dv=value.dv,t=trigger(value.trigger);
 if(!t||!Array.isArray(dv)||dv.length!==3||!finite(dv[0],-12,12)||!finite(dv[1],-12,12)||!finite(dv[2],-12,12))return null;
 const spec:BurnSpec={id:value.id,source:value.source,trigger:t,frame:value.frame,dv:[dv[0],dv[1],dv[2]],model:'IMPULSIVE'};
 return burnSpecValid(spec)?spec:null;
}
function program(value:unknown):AscentProgram|null {
 if(!shape(value,['azimuthDeg','verticalSec','kickDeg','kickSec','stage1LoadFraction','stage2CoastSec','insertionAltKm','holdUpperStage'])||ascentProgramIssue(value)!==null)return null;
 const v=value as unknown as AscentProgram;
 return {azimuthDeg:v.azimuthDeg,verticalSec:v.verticalSec,kickDeg:v.kickDeg,kickSec:v.kickSec,stage1LoadFraction:v.stage1LoadFraction,stage2CoastSec:v.stage2CoastSec,insertionAltKm:v.insertionAltKm,holdUpperStage:v.holdUpperStage};
}
/** Iterative (never recursive) shape bound for an untrusted JSON payload: finite numbers only, limited depth, fan-out and node count. Core validates meaning later. */
function boundedJson(root:unknown,maxDepth=12,maxItems=256,maxNodes=5000):boolean{
 const stack:[unknown,number][]=[[root,0]];let nodes=0;
 while(stack.length){
  const [value,depth]=stack.pop()!;
  if(++nodes>maxNodes||depth>maxDepth)return false;
  if(typeof value==='number'){if(!Number.isFinite(value))return false;continue;}
  if(typeof value==='string'||typeof value==='boolean'||value===null)continue;
  if(Array.isArray(value)){if(value.length>maxItems)return false;for(const item of value)stack.push([item,depth+1]);continue;}
  if(record(value)){const keys=Object.keys(value);if(keys.length>maxItems)return false;for(const key of keys){if(key.length>64)return false;stack.push([value[key],depth+1]);}continue;}
  return false;
 }
 return true;
}
function edit(value:unknown):DesignEdit|null {
 if(!record(value))return null;
 switch(value.kind){
 case 'ADD_PART':case 'REMOVE_PART':return shape(value,['kind','partId'])&&text(value.partId)&&parts.has(value.partId)?{kind:value.kind,partId:value.partId}:null;
 case 'SET_RIDE':return shape(value,['kind','rideId'])&&text(value.rideId)&&rides.has(value.rideId)?{kind:'SET_RIDE',rideId:value.rideId}:null;
 case 'SET_ORBIT':{const candidate=orbit(value.orbit);return shape(value,['kind','orbit'])&&candidate?{kind:'SET_ORBIT',orbit:candidate}:null;}
 case 'SET_PROPELLANT':return shape(value,['kind','kg'])&&finite(value.kg,0,1e6)?{kind:'SET_PROPELLANT',kg:value.kg}:null;
 case 'SET_LAUNCHER':return shape(value,['kind','launcherId'])&&text(value.launcherId,48)&&launchers.has(value.launcherId)?{kind:'SET_LAUNCHER',launcherId:value.launcherId}:null;
 case 'SET_ASCENT':{const p=program(value.program);return shape(value,['kind','program'])&&p?{kind:'SET_ASCENT',program:p}:null;}
 case 'SET_BURNS':{
  if(!shape(value,['kind','burns'])||!Array.isArray(value.burns)||value.burns.length>16)return null;
  const burns:BurnSpec[]=[];for(const item of value.burns){const b=burn(item);if(!b)return null;burns.push(b);}return {kind:'SET_BURNS',burns};
 }
 default:return null;
 }
}
function command(value:unknown):Command|null {
 if(!record(value))return null;
 switch(value.kind){
 case 'ATTITUDE_TARGET':{
  const q=value.q;if(!shape(value,['kind','q'],['gestureId'])||!Array.isArray(q)||q.length!==4||!finite(q[0],-1,1)||!finite(q[1],-1,1)||!finite(q[2],-1,1)||!finite(q[3],-1,1)||Math.hypot(q[0],q[1],q[2],q[3])<1e-8||value.gestureId!==undefined&&!text(value.gestureId,96))return null;
  return {kind:'ATTITUDE_TARGET',q:[q[0],q[1],q[2],q[3]],...(typeof value.gestureId==='string'?{gestureId:value.gestureId}:{})};
 }
 case 'POINT':return shape(value,['kind','mode'])&&member(value.mode,['SUN','TARGET','EARTH','SAFE'])?{kind:'POINT',mode:value.mode}:null;
 case 'INSTRUMENT':return shape(value,['kind','partId','on'])&&text(value.partId)&&parts.has(value.partId)&&typeof value.on==='boolean'?{kind:'INSTRUMENT',partId:value.partId,on:value.on}:null;
 case 'DOWNLINK':case 'SAFE':case 'CREW_FAN':case 'CREW_PRIORITIZE_POWER':return shape(value,['kind','on'])&&typeof value.on==='boolean'?{kind:value.kind,on:value.on}:null;
 case 'HEATER':return shape(value,['kind','mode'])&&member(value.mode,['OFF','ON','AUTO'])?{kind:'HEATER',mode:value.mode}:null;
 case 'LINK_MODE':return shape(value,['kind','mode'])&&member(value.mode,['NORMAL','ROBUST'])?{kind:'LINK_MODE',mode:value.mode}:null;
 case 'DUTY_CYCLE':return shape(value,['kind','partId','fraction'])&&text(value.partId)&&parts.has(value.partId)&&finite(value.fraction,0,1)?{kind:'DUTY_CYCLE',partId:value.partId,fraction:value.fraction}:null;
 case 'DEPLOY':case 'DEPLOY_RETRY':return shape(value,['kind','system'])&&member(value.system,['WINGS','ANTENNA'])?{kind:value.kind,system:value.system}:null;
 case 'CREW_ISOLATE':return shape(value,['kind','isolated'])&&typeof value.isolated==='boolean'?{kind:'CREW_ISOLATE',isolated:value.isolated}:null;
 case 'BURN_SCHEDULE':{const b=burn(value.burn);return shape(value,['kind','burn'])&&b?{kind:'BURN_SCHEDULE',burn:b}:null;}
 case 'BURN_CANCEL':return shape(value,['kind','id'])&&text(value.id,24)?{kind:'BURN_CANCEL',id:value.id}:null;
 case 'SEPARATE_STAGE':case 'CAPTURE_CONFIRM':case 'REACQUIRE_POINTING':case 'RECOVER_COMPUTER':case 'CREW_CARTRIDGE':case 'CREW_REPRESSURIZE':case 'CREW_DEORBIT':return shape(value,['kind'])?{kind:value.kind}:null;
 default:return null;
 }
}
function pauseReason(value:unknown):value is PauseReason{return member(value,['manual','decision','explanation','handoff','settings','hidden','chooser','graphics','home','self-paced','viewer','tour','error','route','host-stall','host-display-disconnected'])||typeof value==='string'&&value.length<=160&&(/^(controller-disconnected|learning):[A-Za-z0-9_.:-]{1,96}$/.test(value));}
function parseIntent(value:unknown):SessionIntent|null {
 if(!record(value))return null;
 switch(value.kind){
 case 'START_GAME':return shape(value,['kind','config'])&&validateQuickDesignConfig(value.config)?{kind:'START_GAME',config:{...value.config}}:null;
 case 'COMMIT_TURN':case 'PROPOSE_TURN':return shape(value,['kind','decisionId','turnRevision','planId'])&&text(value.decisionId)&&integer(value.turnRevision)&&text(value.planId,96)?{kind:value.kind,decisionId:value.decisionId,turnRevision:value.turnRevision,planId:value.planId}:null;
 case 'RETRY_GAME':return shape(value,['kind'],['checkpointRevision'])&&(value.checkpointRevision===undefined||integer(value.checkpointRevision))?{kind:'RETRY_GAME',...(typeof value.checkpointRevision==='number'?{checkpointRevision:value.checkpointRevision}:{})}:null;
 case 'START_MISSION':return shape(value,['kind','missionId','levelId'],['retainHardware'])&&text(value.missionId,48)&&builtinIds.has(value.missionId)&&member(value.levelId,['ASPIRING','EXPERT'])&&(value.retainHardware===undefined||typeof value.retainHardware==='boolean')?{kind:'START_MISSION',missionId:value.missionId as BuiltinMissionId,levelId:value.levelId,...(typeof value.retainHardware==='boolean'?{retainHardware:value.retainHardware}:{})}:null;
 // The definition body is only checked to be a plain object here; core validation (bounds, depth, size, identity) runs again in the reducer.
 case 'START_DEFINITION':return shape(value,['kind','definition','levelId'],['retainHardware'])&&record(value.definition)&&boundedJson(value.definition)&&member(value.levelId,['ASPIRING','EXPERT'])&&(value.retainHardware===undefined||typeof value.retainHardware==='boolean')?{kind:'START_DEFINITION',definition:value.definition,levelId:value.levelId,...(typeof value.retainHardware==='boolean'?{retainHardware:value.retainHardware}:{})}:null;
 case 'SUBMIT_DEFINITION':return shape(value,['kind','definition','baseDigest'])&&record(value.definition)&&boundedJson(value.definition)&&typeof value.baseDigest==='string'&&/^sha256:[0-9a-f]{64}$/.test(value.baseDigest)?{kind:'SUBMIT_DEFINITION',definition:value.definition,baseDigest:value.baseDigest as Digest}:null;
 case 'GRANT_AUTHORING':return shape(value,['kind','playerId'])&&(value.playerId===null||text(value.playerId))?{kind:'GRANT_AUTHORING',playerId:value.playerId}:null;
 case 'RESET_MISSION':return shape(value,['kind'],['keepDesign'])&&(value.keepDesign===undefined||typeof value.keepDesign==='boolean')?{kind:'RESET_MISSION',...(typeof value.keepDesign==='boolean'?{keepDesign:value.keepDesign}:{})}:null;
 case 'SET_STAGE':return shape(value,['kind','stage'])&&member(value.stage,STAGES)?{kind:'SET_STAGE',stage:value.stage}:null;
 case 'SET_SUBSTEP':return shape(value,['kind','step'])&&text(value.step,32)?{kind:'SET_SUBSTEP',step:value.step}:null;
 case 'SET_VIEW':return shape(value,['kind','view'])&&member(value.view,['GOAL','CONCEPT','DESIGN','LAUNCH_ORBIT','OPERATE','REPORT'])?{kind:'SET_VIEW',view:value.view}:null;
 case 'CONFIRM_OBJECTIVE':return shape(value,['kind'],['confirmed'])&&(value.confirmed===undefined||typeof value.confirmed==='boolean')?{kind:'CONFIRM_OBJECTIVE',...(typeof value.confirmed==='boolean'?{confirmed:value.confirmed}:{})}:null;
 case 'SET_SEGMENT':return shape(value,['kind','segment','selected'])&&member(value.segment,['launch','space','ground','user'])&&typeof value.selected==='boolean'?{kind:'SET_SEGMENT',segment:value.segment,selected:value.selected}:null;
 case 'QUOTE_DESIGN':case 'COMMIT_DESIGN':{const e=edit(value.edit);return shape(value,['kind','edit','baseRevision'],['quoteId'])&&e&&integer(value.baseRevision)&&(value.quoteId===undefined||text(value.quoteId))?{kind:value.kind,edit:e,baseRevision:value.baseRevision,...(typeof value.quoteId==='string'?{quoteId:value.quoteId}:{})}:null;}
 case 'RECORD_TRADE':{const e=edit(value.edit);return shape(value,['kind','edit','baseRevision','description'])&&e&&integer(value.baseRevision)&&text(value.description,500)?{kind:'RECORD_TRADE',edit:e,baseRevision:value.baseRevision,description:value.description}:null;}
 case 'FREEZE_BASELINE':case 'VERIFY_BASELINE':case 'COMPLETE_STAGE':return shape(value,['kind','designRevision'])&&integer(value.designRevision)?{kind:value.kind,designRevision:value.designRevision}:null;
 case 'SIGN_OFF':return shape(value,['kind','role','designRevision','rosterRevision'])&&member(value.role,ROLES)&&integer(value.designRevision)&&integer(value.rosterRevision)?{kind:'SIGN_OFF',role:value.role,designRevision:value.designRevision,rosterRevision:value.rosterRevision}:null;
 case 'NOTE':return shape(value,['kind','category','target','text','designRevision'])&&member(value.category,['CONCERN','SIDEBAR'])&&member(value.target,['mass','power','budget','data'])&&text(value.text,500)&&integer(value.designRevision)?{kind:'NOTE',category:value.category,target:value.target,text:value.text,designRevision:value.designRevision}:null;
 case 'RESOLVE_NOTE':return shape(value,['kind','noteId'])&&text(value.noteId)?{kind:'RESOLVE_NOTE',noteId:value.noteId}:null;
 case 'LAUNCH':return shape(value,['kind','designRevision','rosterRevision'])&&integer(value.designRevision)&&integer(value.rosterRevision)?{kind:'LAUNCH',designRevision:value.designRevision,rosterRevision:value.rosterRevision}:null;
 case 'COMMANDS':{
  if(!shape(value,['kind','commands'])||!Array.isArray(value.commands)||value.commands.length<1||value.commands.length>32)return null;
  const commands:Command[]=[];for(const item of value.commands){const parsed=command(item);if(!parsed)return null;commands.push(parsed);}return {kind:'COMMANDS',commands};
 }
 case 'PAUSE':return shape(value,['kind'],['reason'])&&(value.reason===undefined||pauseReason(value.reason))?{kind:'PAUSE',...(pauseReason(value.reason)?{reason:value.reason}:{})}:null;
 case 'CLEAR_PAUSE':return shape(value,['kind','reason'])&&pauseReason(value.reason)?{kind:'CLEAR_PAUSE',reason:value.reason}:null;
 case 'INVALIDATE_BASELINE':return shape(value,['kind'])?{kind:'INVALIDATE_BASELINE'}:null;
 case 'RESUME':case 'CANCEL_ADVANCE':case 'SKIP_CRUISE':return shape(value,['kind'])?{kind:value.kind}:null;
 case 'SET_WARP':return shape(value,['kind','warp'])&&typeof value.warp==='number'&&WARPS.some(w=>w===value.warp)?{kind:'SET_WARP',warp:value.warp}:null;
 case 'ADVANCE_NEXT':return shape(value,['kind'],['targetSec'])&&(value.targetSec===undefined||finite(value.targetSec,0,1e10))?{kind:'ADVANCE_NEXT',...(typeof value.targetSec==='number'?{targetSec:value.targetSec}:{})}:null;
 case 'ACK_DECISION':return shape(value,['kind','decisionId'])&&text(value.decisionId)?{kind:'ACK_DECISION',decisionId:value.decisionId}:null;
 case 'ACK_LEARNING':return shape(value,['kind','stopId'])&&text(value.stopId,96)?{kind:'ACK_LEARNING',stopId:value.stopId}:null;
 case 'SAVE_CHECKPOINT':return shape(value,['kind','name'])&&member(value.name,['launch','arrival','decision'])?{kind:'SAVE_CHECKPOINT',name:value.name}:null;
 case 'RETRY_CHECKPOINT':return shape(value,['kind','checkpointId'])&&integer(value.checkpointId)?{kind:'RETRY_CHECKPOINT',checkpointId:value.checkpointId}:null;
 case 'END_MISSION':return shape(value,['kind','confirmationId'])&&text(value.confirmationId)?{kind:'END_MISSION',confirmationId:value.confirmationId}:null;
 case 'SET_TEAM':return shape(value,['kind','count'])&&integer(value.count)&&value.count>=1&&value.count<=4?{kind:'SET_TEAM',count:value.count}:null;
 case 'ADD_PLAYER':return shape(value,['kind','playerId','name'])&&text(value.playerId)&&text(value.name,40)?{kind:'ADD_PLAYER',playerId:value.playerId,name:value.name}:null;
 case 'ASSIGN_ROLE':return shape(value,['kind','role','playerId','rosterRevision'])&&member(value.role,ROLES)&&text(value.playerId)&&integer(value.rosterRevision)?{kind:'ASSIGN_ROLE',role:value.role,playerId:value.playerId,rosterRevision:value.rosterRevision}:null;
 case 'SET_READY':return shape(value,['kind','ready','rosterRevision'])&&typeof value.ready==='boolean'&&integer(value.rosterRevision)?{kind:'SET_READY',ready:value.ready,rosterRevision:value.rosterRevision}:null;
 case 'SET_PRESENCE':return shape(value,['kind','playerId','connected'])&&text(value.playerId)&&typeof value.connected==='boolean'?{kind:'SET_PRESENCE',playerId:value.playerId,connected:value.connected}:null;
 case 'ROTATE_FACILITATOR':return shape(value,['kind','rosterRevision'])&&integer(value.rosterRevision)?{kind:'ROTATE_FACILITATOR',rosterRevision:value.rosterRevision}:null;
 default:return null;
 }
}
function parseActor(value:unknown):ActorContext|null {
 if(!shape(value,['role'],['playerId'])||!member(value.role,['SCIENCE','SPACECRAFT','LAUNCH_ORBIT','GROUND_COMMS','ALL'])||value.playerId!==undefined&&!text(value.playerId))return null;
 return {role:value.role,...(typeof value.playerId==='string'?{playerId:value.playerId}:{})};
}
function parse(raw:unknown):ClientMessage|null {
 if(!record(raw))return null;
 switch(raw.type){
 case 'HELLO':return shape(raw,['type','protocol','buildId','lastSeq'])&&raw.protocol===4&&text(raw.buildId)&&integer(raw.lastSeq)?{type:'HELLO',protocol:4,buildId:raw.buildId,lastSeq:raw.lastSeq}:null;
 case 'INTENT':{
  if(!shape(raw,['type','id','epoch','attemptId','rosterRevision','actor','intent'])||!text(raw.id)||!text(raw.epoch)||!integer(raw.attemptId)||!integer(raw.rosterRevision))return null;
  const actor=parseActor(raw.actor),intent=parseIntent(raw.intent);return actor&&intent?{type:'INTENT',id:raw.id,epoch:raw.epoch,attemptId:raw.attemptId,rosterRevision:raw.rosterRevision,actor,intent}:null;
 }
 case 'READY':return shape(raw,['type','ready','rosterRevision'])&&typeof raw.ready==='boolean'&&integer(raw.rosterRevision)?{type:'READY',ready:raw.ready,rosterRevision:raw.rosterRevision}:null;
 case 'ASSIGN_ROLE':return shape(raw,['type','id','role','playerId','rosterRevision'])&&text(raw.id)&&member(raw.role,ROLES)&&text(raw.playerId)&&integer(raw.rosterRevision)?{type:'ASSIGN_ROLE',id:raw.id,role:raw.role,playerId:raw.playerId,rosterRevision:raw.rosterRevision}:null;
 case 'ADMIT':return shape(raw,['type','id','pendingDeviceId','playerId'])&&text(raw.id)&&text(raw.pendingDeviceId)&&text(raw.playerId)?{type:'ADMIT',id:raw.id,pendingDeviceId:raw.pendingDeviceId,playerId:raw.playerId}:null;
 case 'KICK':return shape(raw,['type','id','deviceId'])&&text(raw.id)&&text(raw.deviceId)?{type:'KICK',id:raw.id,deviceId:raw.deviceId}:null;
 case 'ROTATE_JOIN_TOKEN':return shape(raw,['type','id'])&&text(raw.id)?{type:'ROTATE_JOIN_TOKEN',id:raw.id}:null;
 case 'ROTATE_FACILITATOR':return shape(raw,['type','id','rosterRevision'])&&text(raw.id)&&integer(raw.rosterRevision)?{type:'ROTATE_FACILITATOR',id:raw.id,rosterRevision:raw.rosterRevision}:null;
 case 'GET_HISTORY':return shape(raw,['type','id','cursor'])&&text(raw.id)&&(raw.cursor===null||text(raw.cursor,64))?{type:'GET_HISTORY',id:raw.id,cursor:raw.cursor}:null;
 case 'GET_RESULTS':{if(!shape(raw,['type','ids'])||!Array.isArray(raw.ids)||raw.ids.length>64)return null;const ids:string[]=[];for(const id of raw.ids){if(!text(id))return null;ids.push(id);}return {type:'GET_RESULTS',ids};}
 case 'PING':return shape(raw,['type','nonce'])&&text(raw.nonce)?{type:'PING',nonce:raw.nonce}:null;
 default:return null;
 }
}
const DEFINITION_INTENTS=new Set(['START_DEFINITION','SUBMIT_DEFINITION']);
/** UTF-8 length, counted without allocating and abandoned once `limit` is exceeded. */
function utf8Bytes(text:string,limit:number):number{let bytes=0;for(const character of text){const point=character.codePointAt(0)!;bytes+=point<=0x7f?1:point<=0x7ff?2:point<=0xffff?3:4;if(bytes>limit)return bytes;}return bytes;}
/** Per-type frame bound: only the two definition intents may exceed the ordinary limit. */
export function messageByteLimit(message:unknown):number{
 if(record(message)&&message.type==='INTENT'&&record(message.intent)&&typeof message.intent.kind==='string'&&DEFINITION_INTENTS.has(message.intent.kind))return MAX_DEFINITION_FRAME_BYTES;
 return MAX_CLIENT_FRAME_BYTES;
}
/** JSON is decoded to unknown, then rebuilt only from checked scalar fields. */
export function parseClientMessage(raw:unknown):ParseResult {
 try{
  let bytes=0;
  if(typeof raw==='string'){
   bytes=utf8Bytes(raw,MAX_DEFINITION_FRAME_BYTES);if(bytes>MAX_DEFINITION_FRAME_BYTES)return {ok:false,error:'BAD_MESSAGE'};
   const decoded:unknown=JSON.parse(raw);raw=decoded;
   if(bytes>MAX_CLIENT_FRAME_BYTES&&messageByteLimit(raw)<bytes)return {ok:false,error:'BAD_MESSAGE'};
  }
  const value=parse(raw);return value?{ok:true,value}:{ok:false,error:'BAD_MESSAGE'};
 }catch{return {ok:false,error:'BAD_MESSAGE'};}
}
