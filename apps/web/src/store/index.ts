import { create } from 'zustand';
import * as core from '@astrix/core';
import { advanceSession, createSession, quoteDesign, reduceSession, tickSession, ROLES, STAGES, SUBSTEPS, WARPS } from '@astrix/session';
import type { DesignEdit, IntentResult, PauseReason, PracticeCheckpoint, SessionActor, SessionIntent, SessionRefusal, SessionSnapshot, SessionState } from '@astrix/session';
import type { ActorRole, Budgets, Command, Design, JourneyStage, LevelId, MissionArtifacts, Phase, Quote, Refusal, RoleId, ScenarioId, ScoreBreakdown, SimState, Telemetry } from '@astrix/core';
import type { ScienceTopicId } from '@astrix/data';
import { emitGameEvent } from './events';
import { resetAudioGate, playCue } from '../audio/cues';
export { ROLES, STAGES, SUBSTEPS, WARPS };
export type { PauseReason, DesignNote, RosterChange, AcceptedTrade, PracticeCheckpoint } from '@astrix/session';
export type Stage = JourneyStage;
export type Presentation = 'GUIDED'|'DETAILED';
export interface Explanation {topicId:ScienceTopicId;contextId:string;snapshot:{design:Design|null;budgets:Budgets|null;telemetry:Telemetry|null};opener:HTMLElement|null}
export interface Settings {presentation:Presentation;presentationExplicit:boolean;reducedMotion:boolean;sound:boolean;uiVolume:number;alertVolume:number}
export interface LiveMission {readonly state:SimState|null;readonly telemetry:Telemetry|null;readonly generation:number}
interface CheckpointView {id:number;name:PracticeCheckpoint['name'];time:number}
type MissionProjection = Omit<SessionState,'results'|'quotes'|'replay'|'practiceCheckpoints'|'nextCheckpointId'|'advanceTarget'|'advanceWork'>;
export interface MissionStore extends MissionProjection {
 practiceCheckpoints:readonly CheckpointView[];remoteMode:boolean;activeRole:RoleId;previewMissionId:ScenarioId|null;previewLevelId:LevelId|null;lastRefusal:Refusal|null;explanation:Explanation|null;learningPause:boolean;settings:Settings;handoff:RoleId|null;previewImage:string|null;
 review:ScoreBreakdown|null;
 setStage(stage:Stage):void;completeStage():boolean;setView(view:Phase):void;setSubstep(step:string):void;
 recordTrade(description:string,revision:number,before:Budgets,after:Budgets,actor:ActorRole):void;freezeBaseline():boolean;verifyBaseline():boolean;updateArtifacts(patch:Partial<MissionArtifacts>):void;
 recordTradeQuote(description:string,quote:Quote<{next:Design}>):void;
 addDesignNote(kind:'CONCERN'|'SIDEBAR',target:'mass'|'power'|'budget'|'data',text:string):void;resolveDesignNote(index:number):void;rotateFacilitator():void;
 actor():ActorRole;setTeam(count:number):void;assignRole(role:RoleId,player:number):void;startScenario(id:ScenarioId,levelId?:LevelId,retainHardware?:boolean):void;
 previewScenario(id:ScenarioId,levelId:LevelId):void;cancelPreview():void;setActiveRole(role:RoleId):void;signOff():void;applyDesign(quote:Quote<{next:Design}>):boolean;
 addPart(id:string):void;removePart(id:string):void;setRide(id:string):void;setOrbit(orbit:NonNullable<Design['orbit']>):void;setPropellant(kg:number):void;launch(revision?:number):boolean;endMission():void;command(command:Command,gestureId?:string):boolean;commands(commands:readonly Command[]):boolean;
 pause(reason?:PauseReason):void;clearPauseReason(reason:PauseReason):void;resume():void;setWarp(warp:number):void;advance(dt:number,publish:boolean):void;advanceToEvent(targetSec?:number):void;cancelAdvance():void;publish():void;decide(commands:readonly Command[]):boolean;acknowledgeDecision():void;skipCruise():void;resetMission(keepDesign?:boolean):void;
 saveCheckpoint(name:PracticeCheckpoint['name']):void;retryCheckpoint(id:number):void;openExplanation(topicId:ScienceTopicId,contextId:string,opener?:HTMLElement|null):void;closeExplanation(restoreFocus?:boolean):void;setSettings(patch:Partial<Settings>):void;setPreviewImage(src:string):void;clearRefusal():void;dismissHandoff():void;
}
function readSettings():Settings {
 const defaults:Settings={presentation:'GUIDED',presentationExplicit:false,reducedMotion:typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches,sound:false,uiVolume:.3,alertVolume:.4};
 if(typeof localStorage==='undefined')return defaults;
 try{const raw=JSON.parse(localStorage.getItem('astrix.settings')??'{}'),{tourDone:_legacyTourDone,...saved}=raw;return {...defaults,...saved,presentationExplicit:raw.presentationExplicit??Object.hasOwn(raw,'presentation'),presentation:raw.presentation==='TECHNICAL'||raw.presentation==='DETAILED'?'DETAILED':'GUIDED'};}catch{return defaults;}
}
function persistSettings(settings:Settings):void {if(typeof localStorage==='undefined')return;try{localStorage.setItem('astrix.settings',JSON.stringify(settings));}catch{/* Optional preferences. */}}
export function readBest(id:ScenarioId,levelId:LevelId,rulesVersion:number):number {if(typeof localStorage==='undefined')return 0;try{return Number(localStorage.getItem(`astrix.best.${id}.${levelId}.${rulesVersion}`))||0;}catch{return 0;}}
function saveBest(state:SessionState):void {
 if(typeof localStorage==='undefined'||!state.sim||!state.design||state.assisted||state.telemetry?.endedByTeam)return;
 const score=core.scoreMission(state.sim,state.design,state.team),d=state.design;
 try{localStorage.setItem(`astrix.best.${d.scenarioId}.${d.levelId}.${d.rulesVersion}`,String(Math.max(readBest(d.scenarioId,d.levelId,d.rulesVersion),score.total)));}catch{/* Optional local best. */}
}
let authority=createSession(),generation=0,advanceOperation=0;
export type IntentSink=(intent:SessionIntent,actor:SessionActor)=>void;
let intentSink:IntentSink|null=null,remoteIdentity:{playerId:string;isHost:boolean}|null=null;
export const liveMission:LiveMission={get state(){return useMission.getState().remoteMode?useMission.getState().sim:authority.sim;},get telemetry(){return useMission.getState().remoteMode?useMission.getState().telemetry:authority.telemetry;},get generation(){return generation;}};
/** Immutable local authority access for replay/history consumers; never a mutation API. */
export function getSessionState():SessionState {return authority;}
function projection(state:SessionState):MissionProjection&{practiceCheckpoints:readonly CheckpointView[];review:ScoreBreakdown|null} {
 const {results:_results,quotes:_quotes,replay:_replay,nextCheckpointId:_next,advanceTarget:_target,advanceWork:_work,...shared}=state;
 return {...shared,review:state.sim&&state.design&&state.telemetry?.ended?core.scoreMission(state.sim,state.design,state.team):null};
}
function actorContext():SessionActor {
 const s=useMission.getState();
 if(s.remoteMode){const player=s.roster.find(p=>p.id===remoteIdentity?.playerId);return {role:s.participantMode==='SOLO'&&player?.roles.length===4?'ALL':s.activeRole,playerId:remoteIdentity?.playerId??'',isHost:remoteIdentity?.isHost??false};}
 const role=s.participantMode==='SOLO'?'ALL':s.activeRole,player=authority.roster.find(p=>role==='ALL'||p.roles.includes(role));
 return {role,playerId:player?.id??authority.roster[0].id,isHost:true};
}
function project(next:SessionState,localPatch:Partial<MissionStore>={}):void {
 const previous=authority;
 if(next.attemptId!==previous.attemptId){generation++;advanceOperation++;resetAudioGate();}
 authority=next;
 useMission.setState({...projection(next),...localPatch});
 const priorKeys=new Set(previous.events.map(e=>`${e.kind}:${e.t}`));next.events.filter(e=>!priorKeys.has(`${e.kind}:${e.t}`)).forEach(emitGameEvent);
 if(next.telemetry?.ended&&!previous.telemetry?.ended)saveBest(next);
}
const quietKinds:Partial<Record<SessionIntent['kind'],true>>={SET_STAGE:true,SET_SUBSTEP:true,SET_VIEW:true,COMPLETE_STAGE:true,FREEZE_BASELINE:true,VERIFY_BASELINE:true,RESUME:true,ADVANCE_NEXT:true};
function dispatch(intent:SessionIntent,patch:Partial<MissionStore>={}):boolean {
 const s=useMission.getState(),actor=actorContext();
 if(s.remoteMode){if(intent.kind==='LOCAL_RESTORE'||intent.kind==='LOCAL_TRADE')return false;intentSink?.(intent,actor);if(Object.keys(patch).length)useMission.setState(patch);return false;}
 const transition=reduceSession(authority,intent,actor);
 const lastRefusal=transition.result.ok?null:transition.result.refusal;
 const error:Refusal|null=lastRefusal?(lastRefusal.code==='STALE_DESIGN'||lastRefusal.code==='STALE_ROSTER'?{ok:false,code:'NOT_READY',values:{missing:lastRefusal.code==='STALE_DESIGN'?'designRevision':'rosterRevision'}}:isCoreRefusal(lastRefusal)?lastRefusal:{ok:false,code:'NOT_READY',values:{transport:lastRefusal.code}}):null;
 const resultPatch={...patch,...(transition.result.ok||!quietKinds[intent.kind]?{lastRefusal:error}:{})};
 if(transition.state!==authority||Object.keys(resultPatch).length)project(transition.state,resultPatch);
 if(!transition.result.ok&&!quietKinds[intent.kind])playCue('refusal');
 else if(transition.result.ok&&intent.kind==='SIGN_OFF')playCue('signoff');
 else if(transition.result.ok&&(intent.kind==='COMMIT_DESIGN'||intent.kind==='COMMANDS'))playCue('part');
 return transition.result.ok;
}
function isCoreRefusal(value:SessionRefusal):value is Refusal {
 return ['MASS_OVER_LIMIT','NO_SLOT','OVER_BUDGET','ROLE_LOCKED','DUPLICATE_UNIQUE','RIDE_MISMATCH','ORBIT_NOT_OFFERED','REQUIRES_PART','SIGNOFF_BLOCKED','NOT_READY','NO_CONTACT','MODE_FORBIDS','STORAGE_EMPTY','PROPELLANT_OVER_TANK','UNSUPPORTED_RULES','POWER_EOL_SHORT','ECLIPSE_RESERVE_SHORT','THERMAL_MARGIN_SHORT','RETURN_FUEL_SHORT','CAPTURE_RESERVE_SHORT','DATA_CAPACITY_SHORT','LINK_UNAVAILABLE','POINTING_ACQUIRING','POINTING_DEGRADED','COMPUTER_REBOOTING','RECOVERY_COOLDOWN','INSUFFICIENT_ENERGY','COMMAND_EXPIRED','COMMAND_INVALIDATED','LEVEL_FORBIDS','INVALID_PARAMETER'].includes(value.code);
}
function quoteEdit(before:Design,next:Design):DesignEdit|null {
 if(before.scenarioId!==next.scenarioId||before.revision+1!==next.revision)return null;
 if(before.rideId!==next.rideId&&next.rideId)return {kind:'SET_RIDE',rideId:next.rideId};
 for(const part of [...before.parts,...next.parts]){
  const a=before.parts.find(p=>p.partId===part.partId),b=next.parts.find(p=>p.partId===part.partId);
  if((a?.qty??0)<(b?.qty??0))return {kind:'ADD_PART',partId:part.partId};
  if((a?.qty??0)>(b?.qty??0))return {kind:'REMOVE_PART',partId:part.partId};
  if(a?.propellantKg!==b?.propellantKg&&b?.propellantKg!==undefined)return {kind:'SET_PROPELLANT',kg:b.propellantKg};
 }
 if(next.orbit&&JSON.stringify(before.orbit)!==JSON.stringify(next.orbit))return {kind:'SET_ORBIT',orbit:next.orbit};
 return null;
}
function commit(edit:DesignEdit):void {const s=useMission.getState();if(s.design)dispatch({kind:'COMMIT_DESIGN',edit,baseRevision:s.design.revision});}
export const useMission=create<MissionStore>((set,get)=>({
 ...projection(authority),remoteMode:false,activeRole:'SCIENCE',previewMissionId:null,previewLevelId:null,lastRefusal:null,explanation:null,learningPause:false,settings:readSettings(),handoff:null,previewImage:null,
 actor:()=>actorContext().role,
 setStage(stage){dispatch({kind:'SET_STAGE',stage});},setView(view){dispatch({kind:'SET_VIEW',view});},setSubstep(step){dispatch({kind:'SET_SUBSTEP',step});},
 completeStage(){return dispatch({kind:'COMPLETE_STAGE',designRevision:get().design?.revision??0});},
 updateArtifacts(patch){if(patch.objectiveConfirmed!==undefined)dispatch({kind:'CONFIRM_OBJECTIVE',confirmed:patch.objectiveConfirmed});if(patch.segments)for(const segment of ['launch','space','ground','user'] as const)if(patch.segments[segment]!==get().artifacts?.segments[segment])dispatch({kind:'SET_SEGMENT',segment,selected:patch.segments[segment]});if(patch.baselineRevision===null)dispatch({kind:'INVALIDATE_BASELINE'});},
 recordTrade(description,revision,before,after,actor){if(get().remoteMode){set({lastRefusal:{ok:false,code:'MODE_FORBIDS',values:{missing:'typedTradeQuote'}}});return;}dispatch({kind:'LOCAL_TRADE',description,revision,before,after,actor});},
 recordTradeQuote(description,quote){
  const s=get();if(!quote.ok){set({lastRefusal:quote});return;}if(!s.design||s.sim)return;
  const edit=quoteEdit(s.design,quote.value.next),checked=edit?quoteDesign(s.design,edit,s.actor()):null;
  if(!edit||!checked?.ok||JSON.stringify(checked.value.next)!==JSON.stringify(quote.value.next)){set({lastRefusal:{ok:false,code:'NOT_READY',values:{missing:'designRevision'}}});return;}
  dispatch({kind:'RECORD_TRADE',edit,description,baseRevision:s.design.revision});
 },
 freezeBaseline(){return dispatch({kind:'FREEZE_BASELINE',designRevision:get().design?.revision??0});},verifyBaseline(){return dispatch({kind:'VERIFY_BASELINE',designRevision:get().design?.revision??0});},
 addDesignNote(category,target,text){dispatch({kind:'NOTE',category,target,text,designRevision:get().design?.revision??0});},resolveDesignNote(index){const note=get().designNotes[index];if(note)dispatch({kind:'RESOLVE_NOTE',noteId:note.id});},rotateFacilitator(){dispatch({kind:'ROTATE_FACILITATOR',rosterRevision:get().rosterRevision});},
 setTeam(count){dispatch({kind:'SET_TEAM',count});},assignRole(role,player){const target=get().roster[player];if(target)dispatch({kind:'ASSIGN_ROLE',role,playerId:target.id,rosterRevision:get().rosterRevision});},
 startScenario(scenarioId,levelId=get().levelId,retainHardware=false){const s=get();dispatch({kind:'START_SCENARIO',scenarioId,levelId,retainHardware},{previewMissionId:null,previewLevelId:null,explanation:null,learningPause:false,handoff:null,previewImage:null,...(!s.settings.presentationExplicit?{settings:{...s.settings,presentation:levelId==='EXPERT'?'DETAILED':'GUIDED'}}:{})});},
 previewScenario(previewMissionId,previewLevelId){get().pause('chooser');set({previewMissionId,previewLevelId});},cancelPreview(){set({previewMissionId:null,previewLevelId:null});get().clearPauseReason('chooser');},
 setActiveRole(activeRole){const s=get();if(s.activeRole===activeRole)return;if(!s.remoteMode&&s.players.length>1){s.pause('handoff');set({activeRole,handoff:activeRole});}else set({activeRole});},
 signOff(){const s=get();dispatch({kind:'SIGN_OFF',role:s.activeRole,designRevision:s.design?.revision??0,rosterRevision:s.rosterRevision});},
 applyDesign(quote){const s=get();if(!quote.ok){set({lastRefusal:quote});return false;}if(!s.design||s.sim){set({lastRefusal:{ok:false,code:'NOT_READY',values:{missing:'frozenDesign'}}});return false;}
  const edit=quoteEdit(s.design,quote.value.next),checked=edit?quoteDesign(s.design,edit,s.actor()):null;
  if(!edit||!checked?.ok||JSON.stringify(checked.value.next)!==JSON.stringify(quote.value.next)){set({lastRefusal:{ok:false,code:'NOT_READY',values:{missing:'designRevision'}}});return false;}
  return dispatch({kind:'COMMIT_DESIGN',edit,baseRevision:s.design.revision});
 },
 addPart(partId){commit({kind:'ADD_PART',partId});},removePart(partId){commit({kind:'REMOVE_PART',partId});},setRide(rideId){commit({kind:'SET_RIDE',rideId});},setOrbit(orbit){commit({kind:'SET_ORBIT',orbit});},setPropellant(kg){commit({kind:'SET_PROPELLANT',kg});},
 launch(revision){const s=get();if(s.previewMissionId)return false;return dispatch({kind:'LAUNCH',designRevision:revision??s.design?.revision??0,rosterRevision:s.rosterRevision},{handoff:null});},endMission(){dispatch({kind:'END_MISSION',confirmationId:`${get().attemptId}:end`});},
 command(command,gestureId){return get().commands([command.kind==='ATTITUDE_TARGET'&&gestureId?{...command,gestureId}:command]);},commands(commands){if(get().previewMissionId)return false;return dispatch({kind:'COMMANDS',commands});},
 pause(reason='manual'){advanceOperation++;dispatch({kind:'PAUSE',reason});},clearPauseReason(reason){dispatch({kind:'CLEAR_PAUSE',reason});},resume(){dispatch({kind:'RESUME'},{learningPause:false});},setWarp(warp){dispatch({kind:'SET_WARP',warp});},
 advance(dt,_publish){if(get().remoteMode)return;const next=advanceSession(authority,dt);if(next!==authority)project(next);},
 advanceToEvent(targetSec){if(!dispatch({kind:'ADVANCE_NEXT',...(targetSec!==undefined?{targetSec}:{})})||get().remoteMode)return;const operation=++advanceOperation,initialGeneration=generation;const batch=()=>{if(operation!==advanceOperation||generation!==initialGeneration||get().remoteMode||!authority.advancing)return;project(tickSession(authority,0));if(authority.advancing)requestAnimationFrame(batch);};requestAnimationFrame(batch);},
 cancelAdvance(){advanceOperation++;dispatch({kind:'CANCEL_ADVANCE'});},publish(){if(!get().remoteMode)project(authority);},
 decide(commands){if(commands.length&&!get().commands(commands))return false;get().acknowledgeDecision();return true;},acknowledgeDecision(){const decision=get().decisions[0];if(decision)dispatch({kind:'ACK_DECISION',decisionId:decision.id});},skipCruise(){if(!get().previewMissionId)dispatch({kind:'SKIP_CRUISE'});},
 resetMission(keepDesign=false){dispatch({kind:'RESET_MISSION',keepDesign},{previewMissionId:null,previewLevelId:null,explanation:null,learningPause:false,handoff:null,previewImage:null,lastRefusal:null});},
 saveCheckpoint(name){dispatch({kind:'SAVE_CHECKPOINT',name});},retryCheckpoint(checkpointId){dispatch({kind:'RETRY_CHECKPOINT',checkpointId},{explanation:null,handoff:null,previewMissionId:null,previewLevelId:null});},
 openExplanation(topicId,contextId,opener=null){const s=get();s.pause('explanation');set({learningPause:!!s.sim||s.learningPause,explanation:{topicId,contextId,opener,snapshot:{design:s.design,budgets:s.budgets,telemetry:liveMission.telemetry}}});},
 closeExplanation(restoreFocus=true){const opener=get().explanation?.opener;set({explanation:null});get().clearPauseReason('explanation');if(restoreFocus&&typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{if(opener?.isConnected&&!opener.closest('[inert]'))opener.focus();else document.getElementById('mission-primary')?.focus();});},
 setSettings(patch){const settings={...get().settings,...patch,...(patch.presentation!==undefined&&patch.presentationExplicit===undefined?{presentationExplicit:true}:{})};persistSettings(settings);set({settings});},setPreviewImage(previewImage){set({previewImage});},clearRefusal(){set({lastRefusal:null});},dismissHandoff(){set({activeRole:get().handoff??get().activeRole,handoff:null});get().clearPauseReason('handoff');}
}));
/** Browser wall clock only; LAN browsers are snapshot renderers even if disconnected. */
export function tickLocalSession(dtSec:number,publish=true):void {
 if(useMission.getState().remoteMode||authority.advancing)return;
 const next=tickSession(authority,dtSec);
 if(next===authority)return;
 if(publish||next.running!==authority.running||next.events.at(-1)!==authority.events.at(-1))project(next);else authority=next;
}
export function setIntentSink(sink:IntentSink|null,context?:{playerId:string;isHost:boolean}):void {
 advanceOperation++;
 if(sink){
  const entering=!useMission.getState().remoteMode;
  if(entering)authority=reduceSession(authority,{kind:'PAUSE',reason:'manual'},actorContext()).state;
  intentSink=sink;remoteIdentity=context??null;
  useMission.setState({remoteMode:true,running:false,...(entering?{explanation:null,handoff:null,lastRefusal:null,previewMissionId:null,previewLevelId:null}:{})});
 }
 else{intentSink=null;remoteIdentity=null;generation++;useMission.setState({...projection(authority),remoteMode:false,explanation:null,handoff:null});}
}
export function applyRemoteSnapshot(snapshot:SessionSnapshot):void {
 const s=useMission.getState();if(!s.remoteMode)return;if(s.epoch===snapshot.epoch&&s.seq>snapshot.seq)return;
 if(s.attemptId!==snapshot.attemptId||s.epoch!==snapshot.epoch)generation++;
 const owned=snapshot.roster.find(p=>p.id===remoteIdentity?.playerId)?.roles??[],activeRole=owned.includes(s.activeRole)?s.activeRole:owned[0]??s.activeRole;
 useMission.setState({...snapshot,activeRole,remoteMode:true});
}
/** Result UI is local feedback; a result never predicts or mutates the room mission. */
export function applyRemoteResult(result:IntentResult):void {
 if(!useMission.getState().remoteMode)return;
 const lastRefusal=!result.ok&&isCoreRefusal(result.refusal)?result.refusal:null;
 useMission.setState({lastRefusal});
 if(lastRefusal)playCue('refusal');
}
/** Renderer preparation may roll back a local candidate, never a LAN room. */
export function captureMissionPreparation():()=>void {
 const saved=authority,local=useMission.getState();return ()=>{if(useMission.getState().remoteMode)return;dispatch({kind:'LOCAL_RESTORE',state:saved},{activeRole:local.activeRole,explanation:local.explanation,previewMissionId:local.previewMissionId,previewLevelId:local.previewLevelId,settings:local.settings,handoff:local.handoff});};
}
