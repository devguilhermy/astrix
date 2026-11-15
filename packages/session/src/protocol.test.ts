import { describe, expect, test } from 'bun:test';
import { createStarterDesign, missionById } from '@astrix/core';
import type { Command } from '@astrix/core';
import { parseClientMessage, PROTOCOL_VERSION } from './protocol';
import type { SessionIntent } from './contracts';
const request=(intent:unknown)=>({type:'INTENT',id:'tap-1',epoch:'room-1',attemptId:1,rosterRevision:2,actor:{role:'SCIENCE',playerId:'player-1'},intent});
describe('runtime-validated wire protocol',()=>{
 test('rebuilds known variants and survives JSON round trips',()=>{
  const intents:SessionIntent[]=[
   { kind: 'START_MISSION', missionId: 'FIRST_LIGHT', levelId: 'ASPIRING' }, {kind:'RESET_MISSION',keepDesign:true},
   {kind:'SET_STAGE',stage:'DESIGN'},{kind:'SET_SUBSTEP',step:'equipment'},{kind:'SET_VIEW',view:'OPERATE'},
   {kind:'CONFIRM_OBJECTIVE'},{kind:'SET_SEGMENT',segment:'ground',selected:true},{kind:'INVALIDATE_BASELINE'},
   {kind:'QUOTE_DESIGN',edit:{kind:'ADD_PART',partId:'CAM_EO'},baseRevision:1},
   {kind:'COMMIT_DESIGN',edit:{kind:'REMOVE_PART',partId:'CAM_EO'},baseRevision:1,quoteId:'q-1'},
   {kind:'RECORD_TRADE',edit:{kind:'SET_RIDE',rideId:'RIDE_SMALL_LAUNCHER'},description:'ride comparison',baseRevision:1},
   {kind:'COMMIT_DESIGN',edit:{kind:'SET_ORBIT',orbit:createStarterDesign(missionById('FIRST_LIGHT'), 'ASPIRING').orbit!},baseRevision:1},
   {kind:'COMMIT_DESIGN',edit:{kind:'SET_PROPELLANT',kg:1},baseRevision:1},
   {kind:'FREEZE_BASELINE',designRevision:1},{kind:'VERIFY_BASELINE',designRevision:1},{kind:'COMPLETE_STAGE',designRevision:1},
   {kind:'SIGN_OFF',role:'SCIENCE',designRevision:1,rosterRevision:2},
   {kind:'NOTE',category:'CONCERN',target:'mass',text:'Massa — revisão',designRevision:1},{kind:'RESOLVE_NOTE',noteId:'note-1'},
   {kind:'LAUNCH',designRevision:1,rosterRevision:2},{kind:'COMMANDS',commands:[{kind:'POINT',mode:'TARGET'},{kind:'ATTITUDE_TARGET',q:[0,0,0,1],gestureId:'drag-1'}]},
   {kind:'PAUSE',reason:'host-stall'},{kind:'CLEAR_PAUSE',reason:'controller-disconnected:phone-1'},{kind:'RESUME'},
   {kind:'SET_WARP',warp:10},{kind:'ADVANCE_NEXT',targetSec:100},{kind:'CANCEL_ADVANCE'},{kind:'SKIP_CRUISE'},
   {kind:'ACK_DECISION',decisionId:'1:1:0'},{kind:'ACK_LEARNING',stopId:'lesson-1'},
   {kind:'SAVE_CHECKPOINT',name:'arrival'},{kind:'RETRY_CHECKPOINT',checkpointId:1},{kind:'END_MISSION',confirmationId:'confirmed'},
   {kind:'SET_TEAM',count:4},{kind:'ADD_PLAYER',playerId:'player-2',name:'João'},
   {kind:'ASSIGN_ROLE',role:'SPACECRAFT',playerId:'player-2',rosterRevision:2},
   {kind:'SET_READY',ready:true,rosterRevision:2},{kind:'SET_PRESENCE',playerId:'player-2',connected:false},{kind:'ROTATE_FACILITATOR',rosterRevision:2},
  ];
  for(const intent of intents){const message=request(intent),parsed:unknown=parseClientMessage(JSON.stringify(message));expect(parsed).toEqual({ok:true,value:message});}
  expect(parseClientMessage({type:'HELLO',protocol:PROTOCOL_VERSION,buildId:'test',lastSeq:0}).ok).toBe(true);
 });
 test('checks every core command variant without granting physical legality',()=>{
  const commands:Command[]=[{kind:'ATTITUDE_TARGET',q:[0,0,0,1]},{kind:'POINT',mode:'SUN'},{kind:'INSTRUMENT',partId:'CAM_EO',on:true},{kind:'DOWNLINK',on:false},{kind:'SAFE',on:true},{kind:'CAPTURE_CONFIRM'},{kind:'HEATER',mode:'AUTO'},{kind:'LINK_MODE',mode:'ROBUST'},{kind:'DUTY_CYCLE',partId:'CAM_EO',fraction:.5},{kind:'REACQUIRE_POINTING'},{kind:'RECOVER_COMPUTER'},{kind:'DEPLOY',system:'WINGS'},{kind:'DEPLOY_RETRY',system:'ANTENNA'},{kind:'CREW_FAN',on:true},{kind:'CREW_CARTRIDGE'},{kind:'CREW_ISOLATE',isolated:true},{kind:'CREW_REPRESSURIZE'},{kind:'CREW_PRIORITIZE_POWER',on:true},{kind:'CREW_DEORBIT'}];
  for(const command of commands){expect(parseClientMessage(request({kind:'COMMANDS',commands:[command]})).ok).toBe(true);expect(parseClientMessage(request({kind:'COMMANDS',commands:[{...command,extra:0}]})).ok).toBe(false);}
 });
 test('administrative, history and heartbeat variants have strict bounded fields',()=>{
  const messages=[{type:'READY',ready:true,rosterRevision:0},{type:'ASSIGN_ROLE',id:'a',role:'SCIENCE',playerId:'p',rosterRevision:0},{type:'ADMIT',id:'a',pendingDeviceId:'d',playerId:'p'},{type:'KICK',id:'a',deviceId:'d'},{type:'ROTATE_JOIN_TOKEN',id:'a'},{type:'ROTATE_FACILITATOR',id:'a',rosterRevision:0},{type:'GET_HISTORY',id:'a',cursor:null},{type:'GET_RESULTS',ids:['a','b']},{type:'PING',nonce:'n'}];
  for(const message of messages){expect(parseClientMessage(message).ok).toBe(true);expect(parseClientMessage({...message,unexpected:true}).ok).toBe(false);}
 });
 test('rejects arbitrary state writes, unknown fields, prototypes and trusted-only local actions',()=>{
  for(const intent of [{kind:'SET_DESIGN',design:createStarterDesign(missionById('FIRST_LIGHT'), 'ASPIRING')},{kind:'COMMIT_DESIGN',edit:{kind:'ADD_PART',partId:'CAM_EO',next:{}},baseRevision:1},{kind:'LOCAL_RESTORE',state:{}},{kind:'LOCAL_TRADE',revision:1,before:{},after:{},actor:'ALL',description:'fake'},{kind:'COMMANDS',commands:[{kind:'SAFE',on:true,playerId:'forged'}]}])expect(parseClientMessage(request(intent)).ok).toBe(false);
  expect(parseClientMessage({...request({kind:'PAUSE'}),secret:'ignored?'}).ok).toBe(false);
  expect(parseClientMessage(Object.assign(Object.create({type:'PING'}),{nonce:'inherited'})).ok).toBe(false);
  expect(parseClientMessage(null).ok).toBe(false);expect(parseClientMessage([]).ok).toBe(false);expect(parseClientMessage('{').ok).toBe(false);
 });
 test('rejects non-finite numbers, unknown catalogs, wrong enums and malformed nested commands',()=>{
  const bad=[{kind:'SET_WARP',warp:NaN},{kind:'SET_WARP',warp:Infinity},{kind:'ADVANCE_NEXT',targetSec:-1},{kind:'COMMIT_DESIGN',baseRevision:1,edit:{kind:'ADD_PART',partId:'NOT_A_PART'}},{kind:'COMMIT_DESIGN',baseRevision:1,edit:{kind:'SET_RIDE',rideId:'NOT_A_RIDE'}},{kind:'COMMANDS',commands:[]},{kind:'COMMANDS',commands:[{kind:'ATTITUDE_TARGET',q:[0,0,0,0]}]},{kind:'COMMANDS',commands:[{kind:'ATTITUDE_TARGET',q:[0,0,NaN,1]}]},{kind:'COMMANDS',commands:[{kind:'POINT',mode:'TELEPORT'}]},{kind:'COMMANDS',commands:[{kind:'DUTY_CYCLE',partId:'CAM_EO',fraction:2}]},{kind:'SIGN_OFF',role:'FACILITATOR',designRevision:1,rosterRevision:1},{kind:'PAUSE',reason:'controller-disconnected:'}];
  for(const intent of bad)expect(parseClientMessage(request(intent)).ok).toBe(false);
  expect(parseClientMessage({...request({kind:'PAUSE'}),attemptId:.5}).ok).toBe(false);
  expect(parseClientMessage({...request({kind:'PAUSE'}),actor:{role:'SCIENCE',isHost:true}}).ok).toBe(false);
 });
 test('rejects oversized messages, arrays, notes and gesture identifiers before core work',()=>{
  expect(parseClientMessage(' '.repeat(8193)).ok).toBe(false);
  expect(parseClientMessage({type:'GET_RESULTS',ids:Array(65).fill('id')}).ok).toBe(false);
  expect(parseClientMessage(request({kind:'NOTE',category:'CONCERN',target:'power',text:'a'.repeat(501),designRevision:1})).ok).toBe(false);
  expect(parseClientMessage(request({kind:'COMMANDS',commands:Array(33).fill({kind:'SAFE',on:true})})).ok).toBe(false);
  expect(parseClientMessage(request({kind:'COMMANDS',commands:[{kind:'ATTITUDE_TARGET',q:[0,0,0,1],gestureId:'a'.repeat(97)}]})).ok).toBe(false);
 });
});
