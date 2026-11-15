import { create } from 'zustand';
import * as core from '@astrix/core';
import type { ActorRole, Budgets, Command, CueEngineState, Design, LevelId, MissionArtifacts, JourneyStage, Phase, Quote, Refusal, RoleId, ScenarioId, SimEvent, SimState, TeamStats, Telemetry } from '@astrix/core';
import type { ScienceTopicId } from '@astrix/data';
import { emitGameEvent } from './events';
import { resetAudioGate, playCue } from '../audio/cues';
export const ROLES: readonly RoleId[] = ['SCIENCE','SPACECRAFT','LAUNCH_ORBIT','GROUND_COMMS'];
export const WARPS = [1,10,100,1000,10000] as const;
export const STAGES: readonly JourneyStage[] = ['NEED_GOALS','CONCEPT','REQUIREMENTS','DESIGN','BUILD_VERIFY','IMPLEMENT','REVIEW'];
export type Stage = JourneyStage;
export const SUBSTEPS:Record<Stage,readonly string[]> = {NEED_GOALS:['brief'],CONCEPT:['bus'],REQUIREMENTS:['requirements'],DESIGN:['equipment','orbit','trajectory'],BUILD_VERIFY:['readiness','signoffs'],IMPLEMENT:['operations'],REVIEW:['results']};
export type PauseReason = 'manual'|'decision'|'explanation'|'handoff'|'settings'|'hidden'|'chooser'|'graphics'|'home'|'self-paced'|'viewer'|'tour'|'error'|'route';
export type Presentation = 'GUIDED'|'DETAILED';
export interface Explanation { topicId:ScienceTopicId; contextId:string; snapshot:{design:Design|null;budgets:Budgets|null;telemetry:Telemetry|null}; opener:HTMLElement|null }
export interface Settings { presentation:Presentation; presentationExplicit:boolean; reducedMotion:boolean; sound:boolean; uiVolume:number; alertVolume:number }
const blankSignoffs = (): Record<RoleId,boolean> => ({ SCIENCE:false, SPACECRAFT:false, LAUNCH_ORBIT:false, GROUND_COMMS:false });
const emptyCues = (): CueEngineState => ({lastRaised:{},clearPending:{},active:[]});
const emptyTeam = (): TeamStats => ({roles:1,signoffs:0,blockedSignoffAttempts:0,sev3Raised:0,sev3ResolvedBeforeLaunch:0});
export interface LiveMission {state:SimState|null;telemetry:Telemetry|null;generation:number}
export const liveMission:LiveMission={state:null,telemetry:null,generation:0};
export interface DesignNote { readonly revision:number; readonly actor:ActorRole; readonly player:number|null; readonly kind:'CONCERN'|'SIDEBAR'; readonly target:'mass'|'power'|'budget'|'data'; readonly text:string; readonly resolved:boolean }
export interface RosterChange { readonly before:readonly (readonly RoleId[])[]; readonly after:readonly (readonly RoleId[])[]; readonly time:number }
export interface AcceptedTrade { readonly revision:number; readonly actor:ActorRole; readonly player:number|null; readonly description:string; readonly before:Budgets; readonly after:Budgets }
export interface PracticeCheckpoint { id:number; name:'launch'|'arrival'|'decision'; time:number; snapshot:{design:Design;sim:SimState;events:readonly SimEvent[];pendingDecisions:readonly SimEvent[];team:TeamStats;signoffs:Record<RoleId,boolean>;cues:CueEngineState} }
function readSettings(): Settings {
 const defaults:Settings={presentation:'GUIDED',presentationExplicit:false,reducedMotion:typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches,sound:false,uiVolume:.3,alertVolume:.4};
 if(typeof localStorage==='undefined')return defaults;
 try {const raw=JSON.parse(localStorage.getItem('astrix.settings')??'{}'),{tourDone:_legacyTourDone,...saved}=raw;return {...defaults,...saved,presentationExplicit:raw.presentationExplicit??Object.hasOwn(raw,'presentation'),presentation:raw.presentation==='TECHNICAL'||raw.presentation==='DETAILED'?'DETAILED':'GUIDED'};}catch{return defaults;}
}
function persistSettings(settings:Settings) {if(typeof localStorage==='undefined')return;try{localStorage.setItem('astrix.settings',JSON.stringify(settings));}catch{/* Preferences are optional in private browsing. */}}
export function readBest(id:ScenarioId,levelId:LevelId,rulesVersion:number):number {if(typeof localStorage==='undefined')return 0;try{return Number(localStorage.getItem(`astrix.best.${id}.${levelId}.${rulesVersion}`))||0;}catch{return 0;}}
function saveMissionBest(state:SimState,design:Design,team:TeamStats,assisted:boolean):void {
 if(typeof localStorage==='undefined'||assisted||core.telemetry(state).endedByTeam)return;
 const score=core.scoreMission(state,design,team);
 try{localStorage.setItem(`astrix.best.${design.scenarioId}.${design.levelId}.${design.rulesVersion}`,String(Math.max(readBest(design.scenarioId,design.levelId,design.rulesVersion),score.total)));}catch{/* A local best is optional. */}
}
function cuesFor(design:Design,previous:CueEngineState,sim:SimState|null):CueEngineState {return core.evaluateCues(previous,sim?core.operateSnapshot(sim,design):{...core.designSnapshot(design),phase:'LAUNCH_ORBIT'},sim?.t??design.revision);}
const viewFor=(stage:Stage,step:string):Phase=>stage==='NEED_GOALS'?'GOAL':stage==='CONCEPT'||stage==='REQUIREMENTS'?'CONCEPT':stage==='DESIGN'?(step==='orbit'||step==='trajectory'?'LAUNCH_ORBIT':'DESIGN'):stage==='BUILD_VERIFY'?'LAUNCH_ORBIT':stage==='REVIEW'?'REPORT':'OPERATE';
const withReason=(reasons:readonly PauseReason[],reason:PauseReason)=>reasons.includes(reason)?reasons:[...reasons,reason];
const blockingReasons:readonly PauseReason[]=['decision','explanation','handoff','settings','hidden','chooser','graphics','home','viewer','tour','error','route'];
let nextCheckpointId=0;
let advanceOperation=0;
export interface MissionStore {
 activeStage:Stage;furthestStage:number;activeView:Phase;activeSubstep:string;setStage(stage:Stage):void;completeStage():boolean;setView(view:Phase):void;setSubstep(step:string):void;
 scenarioId:ScenarioId;levelId:LevelId;previewMissionId:ScenarioId|null;previewLevelId:LevelId|null;attemptId:number;artifacts:MissionArtifacts|null;recordTrade(description:string,revision:number,before:Budgets,after:Budgets,actor:ActorRole):void;freezeBaseline():boolean;verifyBaseline():boolean;updateArtifacts(patch:Partial<MissionArtifacts>):void;
 players:readonly (readonly RoleId[])[];activeRole:RoleId;signoffs:Record<RoleId,boolean>;team:TeamStats;design:Design|null;budgets:Budgets|null;cues:CueEngineState;lastRefusal:Refusal|null;
 designNotes:readonly DesignNote[];rosterHistory:readonly RosterChange[];facilitator:number;addDesignNote(kind:DesignNote['kind'],target:DesignNote['target'],text:string):void;resolveDesignNote(index:number):void;rotateFacilitator():void;
 acceptedTrades:readonly AcceptedTrade[];
 sim:SimState|null;telemetry:Telemetry|null;running:boolean;warp:number;historyVersion:number;events:readonly SimEvent[];pendingDecisions:readonly SimEvent[];explanation:Explanation|null;learningPause:boolean;settings:Settings;handoff:RoleId|null;previewImage:string|null;
 pauseReasons:readonly PauseReason[];advancing:boolean;advanceMessage:'event'|'limit'|null;practiceCheckpoints:readonly PracticeCheckpoint[];assisted:boolean;
 actor():ActorRole;setTeam(count:number):void;assignRole(role:RoleId,player:number):void;startScenario(id:ScenarioId,levelId?:LevelId,retainHardware?:boolean):void;
 previewScenario(id:ScenarioId,levelId:LevelId):void;cancelPreview():void;setActiveRole(role:RoleId):void;signOff():void;applyDesign(quote:Quote<{next:Design}>):boolean;
 addPart(id:string):void;removePart(id:string):void;setRide(id:string):void;setOrbit(orbit:NonNullable<Design['orbit']>):void;setPropellant(kg:number):void;launch(revision?:number):boolean;endMission():void;command(command:Command,gestureId?:string):boolean;commands(commands:readonly Command[]):boolean;
 pause(reason?:PauseReason):void;clearPauseReason(reason:PauseReason):void;resume():void;setWarp(warp:number):void;advance(dt:number,publish:boolean):void;advanceToEvent(targetSec?:number):void;cancelAdvance():void;publish():void;decide(commands:readonly Command[]):boolean;acknowledgeDecision():void;skipCruise():void;resetMission(keepDesign?:boolean):void;
 saveCheckpoint(name:PracticeCheckpoint['name']):void;retryCheckpoint(id:number):void;openExplanation(topicId:ScienceTopicId,contextId:string,opener?:HTMLElement|null):void;closeExplanation(restoreFocus?:boolean):void;setSettings(patch:Partial<Settings>):void;setPreviewImage(src:string):void;clearRefusal():void;dismissHandoff():void;
}
const initialSettings=readSettings();
export const useMission=create<MissionStore>((set,get)=>({
 activeStage:'NEED_GOALS',furthestStage:0,activeView:'GOAL',activeSubstep:'brief',scenarioId:'FIRST_LIGHT',levelId:'ASPIRING',previewMissionId:null,previewLevelId:null,attemptId:0,artifacts:null,
 players:[ROLES],activeRole:'SCIENCE',signoffs:blankSignoffs(),team:emptyTeam(),design:null,budgets:null,cues:emptyCues(),lastRefusal:null,sim:null,telemetry:null,running:false,warp:100,historyVersion:0,events:[],pendingDecisions:[],explanation:null,learningPause:false,settings:initialSettings,handoff:null,previewImage:null,pauseReasons:[],advancing:false,advanceMessage:null,practiceCheckpoints:[],assisted:false,designNotes:[],rosterHistory:[],facilitator:0,acceptedTrades:[],
 setStage(activeStage){const s=get(),current=STAGES.indexOf(s.activeStage),target=STAGES.indexOf(activeStage);if(target<0||s.sim&&activeStage!=='IMPLEMENT'&&!(activeStage==='REVIEW'&&s.telemetry?.ended)||!s.sim&&(target>s.furthestStage||target>current&&(!s.design||!s.artifacts||STAGES.slice(current,target).some(stage=>core.evaluateJourneyStage(s.design!,s.artifacts!,stage,s.signoffs).length))))return;const activeSubstep=SUBSTEPS[activeStage][0];set({activeStage,activeSubstep,activeView:viewFor(activeStage,activeSubstep)});},
 completeStage(){const s=get();if(!s.design||!s.artifacts)return false;const index=STAGES.indexOf(s.activeStage);if(index<0||index>=STAGES.length-1||s.activeStage==='IMPLEMENT'&&!s.telemetry?.ended||core.evaluateJourneyStage(s.design,s.artifacts,s.activeStage,s.signoffs,s.sim??undefined).length)return false;const activeStage=STAGES[index+1],activeSubstep=SUBSTEPS[activeStage][0];set({activeStage,furthestStage:Math.max(s.furthestStage,index+1),activeSubstep,activeView:viewFor(activeStage,activeSubstep)});return true;},
 setView(activeView){const s=get();if(activeView==='OPERATE'&&s.sim){set({activeStage:'IMPLEMENT',activeSubstep:'operations',activeView});}else if(activeView==='REPORT'&&s.telemetry?.ended){set({activeStage:'REVIEW',activeSubstep:'results',activeView});}},
 setSubstep(activeSubstep){const {activeStage}=get();if(SUBSTEPS[activeStage].includes(activeSubstep))set({activeSubstep,activeView:viewFor(activeStage,activeSubstep)});},
 updateArtifacts(patch){const s=get();if(!s.sim&&s.artifacts)set({artifacts:{...s.artifacts,...patch}});},
 recordTrade(description,revision,before,after,actor){const s=get();if(!s.sim&&s.design?.revision===revision&&s.artifacts)set({artifacts:{...s.artifacts,trade:{revision,description,before,after,actor}}});},
 freezeBaseline(){const s=get();if(!s.design||!s.artifacts||s.sim||!s.artifacts.trade)return false;set({artifacts:{...s.artifacts,baselineRevision:s.design.revision,verifiedRevision:null}});return true;},
 verifyBaseline(){const s=get();if(!s.design||!s.artifacts||s.sim||s.artifacts.baselineRevision!==s.design.revision||core.evaluateJourneyStage(s.design,s.artifacts,'BUILD_VERIFY',s.signoffs).some(issue=>issue.id!=='VERIFY'))return false;set({artifacts:{...s.artifacts,verifiedRevision:s.design.revision}});return true;},
 addDesignNote(kind,target,text){const s=get(),clean=text.trim().slice(0,500);if(!clean||!s.design||s.sim)return;set({designNotes:[...s.designNotes,{revision:s.design.revision,actor:s.actor(),player:s.players.length===1?null:s.players.findIndex(roles=>roles.includes(s.activeRole)),kind,target,text:clean,resolved:false}].slice(-100)});},
 resolveDesignNote(index){const s=get();if(s.sim)return;set({designNotes:s.designNotes.map((note,i)=>i===index?{...note,resolved:true}:note)});},
 rotateFacilitator(){const s=get();set({facilitator:(s.facilitator+1)%s.players.length});},
 actor:()=>get().players.length===1?'ALL':get().activeRole,
 setTeam(count){const s=get();if(s.sim&&!s.pauseReasons.includes('settings'))return;const n=Math.max(1,Math.min(4,count));if(n===s.players.length)return;const players=Array.from({length:n},()=>[] as RoleId[]);ROLES.forEach((r,i)=>players[i%n].push(r));const signoffs={...s.signoffs};ROLES.forEach(role=>{if(s.players.findIndex(p=>p.includes(role))!==players.findIndex(p=>p.includes(role)))signoffs[role]=false;});set({players,facilitator:Math.min(s.facilitator,n-1),signoffs,team:{...s.team,roles:n===1?1:4},rosterHistory:[...s.rosterHistory,{before:s.players.map(r=>[...r]),after:players.map(r=>[...r]),time:s.telemetry?.t??0}].slice(-100)});},
 assignRole(role,player){const s=get();if(s.sim&&!s.pauseReasons.includes('settings')||player<0||player>=s.players.length||s.players[player].includes(role))return;const players=s.players.map((roles,i)=>i===player?[...roles.filter(r=>r!==role),role]:roles.filter(r=>r!==role));set({players,signoffs:{...s.signoffs,[role]:false},rosterHistory:[...s.rosterHistory,{before:s.players.map(r=>[...r]),after:players.map(r=>[...r]),time:s.telemetry?.t??0}].slice(-100)});},
 previewScenario(previewMissionId,previewLevelId){get().pause('chooser');set({previewMissionId,previewLevelId});},
 cancelPreview(){set({previewMissionId:null,previewLevelId:null});get().clearPauseReason('chooser');},
 startScenario(scenarioId,levelId=get().levelId,retainHardware=false){
  const s=get(),starter=core.createStarterDesign(scenarioId,levelId);
  const design=retainHardware&&s.design&&s.design.scenarioId===scenarioId?{...s.design,levelId:starter.levelId,rulesVersion:starter.rulesVersion,revision:s.design.revision+1}:starter;
  const budgets=core.computeBudgets(design),cues=cuesFor(design,emptyCues(),null);
  const revisitBuild=retainHardware&&s.design?.scenarioId===scenarioId&&s.furthestStage>=3&&!!s.artifacts?.objectiveConfirmed&&Object.values(s.artifacts.segments).every(Boolean);
  const artifacts=core.createMissionArtifacts(design);
  const acceptedBrief=revisitBuild?{...artifacts,objectiveConfirmed:true,segments:{...s.artifacts!.segments}}:artifacts;
  liveMission.state=null;liveMission.telemetry=null;liveMission.generation++;resetAudioGate();
  set({scenarioId,levelId,attemptId:s.attemptId+1,settings:s.settings.presentationExplicit?s.settings:{...s.settings,presentation:levelId==='EXPERT'?'DETAILED':'GUIDED'},artifacts:acceptedBrief,designNotes:[],rosterHistory:[],facilitator:0,acceptedTrades:[],design,budgets,cues,activeStage:revisitBuild?'DESIGN':'NEED_GOALS',furthestStage:revisitBuild?3:0,activeSubstep:revisitBuild?'equipment':'brief',activeView:revisitBuild?'DESIGN':'GOAL',previewMissionId:null,previewLevelId:null,sim:null,telemetry:null,running:false,pendingDecisions:[],events:[],historyVersion:0,signoffs:blankSignoffs(),team:{...emptyTeam(),roles:s.players.length===1?1:4},lastRefusal:null,explanation:null,learningPause:false,handoff:null,previewImage:null,pauseReasons:[],advancing:false,advanceMessage:null,practiceCheckpoints:[],assisted:false});
 },
 setActiveRole(activeRole){const s=get();if(s.activeRole===activeRole)return;if(s.players.length>1){s.pause('handoff');set({activeRole,handoff:activeRole});}else set({activeRole});},
 signOff(){
  const s=get();if(!s.design||s.sim)return;
  const cues=cuesFor(s.design,s.cues,null),roles=s.actor()==='ALL'?ROLES:[s.activeRole];
  const blocked=roles.find(role=>cues.active.some(c=>c.severity===3&&(c.role===role||c.role==='ALL')));
  if(blocked){set({cues,lastRefusal:{ok:false,code:'SIGNOFF_BLOCKED',values:{role:blocked}},team:{...s.team,blockedSignoffAttempts:s.team.blockedSignoffAttempts+1}});playCue('refusal');return;}
  const signoffs={...s.signoffs};let added=0;roles.forEach(role=>{if(!signoffs[role])added++;signoffs[role]=true;});
  set({cues,signoffs,team:{...s.team,signoffs:s.team.signoffs+added},lastRefusal:null});playCue('signoff');
 },
 applyDesign(quote){
  const s=get();if(s.sim||!s.design){set({lastRefusal:{ok:false,code:'NOT_READY',values:{missing:'frozenDesign'}}});return false;}
  if(!quote.ok){set({lastRefusal:quote});playCue('refusal');return false;}
  if(quote.value.next.revision!==s.design.revision+1){set({lastRefusal:{ok:false,code:'NOT_READY',values:{missing:'designRevision'}}});return false;}
  const next=quote.value.next,signoffs={...s.signoffs};core.rolesAffectedBy(s.design,next).forEach(role=>signoffs[role]=false);
  const cues=cuesFor(next,s.cues,null),before=s.cues.active.filter(c=>c.severity===3),after=cues.active.filter(c=>c.severity===3),beforeBudget=s.budgets??core.computeBudgets(s.design),afterBudget=core.computeBudgets(next);
  const changedPart=[...s.design.parts,...next.parts].find(part=>{const a=s.design!.parts.find(p=>p.partId===part.partId),b=next.parts.find(p=>p.partId===part.partId);return a?.qty!==b?.qty||a?.propellantKg!==b?.propellantKg;});
  const description=changedPart?.partId??(s.design.rideId!==next.rideId?'ride':'orbit'),actor=s.actor(),entry:AcceptedTrade={revision:s.design.revision,actor,player:actor==='ALL'?null:s.players.findIndex(roles=>roles.includes(s.activeRole)),description,before:beforeBudget,after:afterBudget};
  set({design:next,budgets:afterBudget,acceptedTrades:[...s.acceptedTrades,entry].slice(-100),signoffs,cues,lastRefusal:null,team:{...s.team,sev3Raised:s.team.sev3Raised+after.filter(c=>!before.some(p=>p.id===c.id)).length,sev3ResolvedBeforeLaunch:s.team.sev3ResolvedBeforeLaunch+before.filter(c=>!after.some(p=>p.id===c.id)).length}});playCue('part');return true;
 },
 addPart(id){const s=get();if(s.design)s.applyDesign(core.quoteAddPart(s.design,id,s.actor()));},removePart(id){const s=get();if(s.design)s.applyDesign(core.quoteRemovePart(s.design,id,s.actor()));},setRide(id){const s=get();if(s.design)s.applyDesign(core.quoteSetRide(s.design,id,s.actor()));},setOrbit(orbit){const s=get();if(s.design)s.applyDesign(core.quoteSetOrbit(s.design,orbit,s.actor()));},setPropellant(kg){const s=get();if(s.design)s.applyDesign(core.quoteSetPropellant(s.design,kg,s.actor()));},
 launch(revision){
  const s=get();if(!s.design||!s.artifacts||s.sim||s.previewMissionId||s.activeStage!=='IMPLEMENT')return false;
  if(revision!==undefined&&revision!==s.design.revision){set({lastRefusal:{ok:false,code:'NOT_READY',values:{missing:'designRevision'}}});return false;}
  if(s.actor()!=='ALL'&&s.actor()!=='LAUNCH_ORBIT'){set({lastRefusal:{ok:false,code:'ROLE_LOCKED',values:{role:'LAUNCH_ORBIT'}}});return false;}
  const signs=s.signoffs,refused=core.launchReadiness(s.design,signs);
  if(refused.length){set({lastRefusal:refused[0]});return false;}
  if(core.evaluateJourneyStage(s.design,s.artifacts,'IMPLEMENT',signs).length)return false;
  const scenario=core.listScenarios().find(x=>x.id===s.scenarioId)!,sim=core.createSim(s.design,scenario.seed),telemetry=core.telemetry(sim);
  liveMission.state=sim;liveMission.telemetry=telemetry;
  set({sim,telemetry,running:false,cues:cuesFor(s.design,emptyCues(),sim),lastRefusal:null,signoffs:signs,pauseReasons:['manual'],handoff:null,activeStage:'IMPLEMENT',activeSubstep:'operations',activeView:'OPERATE'});get().saveCheckpoint('launch');return true;
 },
 endMission(){const s=get();if(!liveMission.state||s.telemetry?.ended)return;const sim=core.endMission(liveMission.state),telemetry=core.telemetry(sim);advanceOperation++;liveMission.state=sim;liveMission.telemetry=telemetry;set({sim,telemetry,running:false,advancing:false,pendingDecisions:[],pauseReasons:['manual']});},
 command(command,gestureId){return get().commands([command.kind==='ATTITUDE_TARGET'&&gestureId?{...command,gestureId}:command]);},
 commands(commands){
  const s=get();let sim=liveMission.state;if(!sim||s.telemetry?.ended||s.explanation||s.advancing||s.previewMissionId)return false;
  if(s.warp>10&&commands.some(command=>command.kind==='ATTITUDE_TARGET')){set({lastRefusal:{ok:false,code:'INVALID_PARAMETER',values:{parameter:'warp',max:10}}});return false;}
  for(const command of commands){const actor=s.actor(),quote=core.issueCommand(sim,command,actor,{role:actor,playerId:actor==='ALL'?undefined:String(s.players.findIndex(roles=>roles.includes(s.activeRole))+1)});if(!quote.ok){set({lastRefusal:quote});playCue('refusal');return false;}sim=quote.value;}
  const result=core.stepSim(sim,0),telemetry=core.telemetry(result.state),ended=!!telemetry.ended,pending=ended?[]:[...s.pendingDecisions,...result.events.filter(e=>e.autoPause)];
  liveMission.state=result.state;liveMission.telemetry=telemetry;
  let pauseReasons=s.pauseReasons;if(pending.length)pauseReasons=withReason(pauseReasons,'decision');
  set({sim:result.state,telemetry,lastRefusal:null,historyVersion:s.historyVersion+1,running:ended||pending.length?false:s.running,events:[...s.events,...result.events].slice(-500),pendingDecisions:pending,pauseReasons});
  result.events.forEach(emitGameEvent);if(ended&&s.design)saveMissionBest(result.state,s.design,s.team,s.assisted);playCue('part');return true;
 },
 pause(reason='manual'){advanceOperation++;set({running:false,advancing:false,pauseReasons:withReason(get().pauseReasons,reason)});},
 clearPauseReason(reason){const s=get(),pauseReasons=s.pauseReasons.filter(r=>r!==reason);set({pauseReasons:s.sim&&!pauseReasons.length?['manual']:pauseReasons,running:false});},
 resume(){const s=get();if(s.sim&&!s.telemetry?.ended&&!s.telemetry?.cruise&&!s.telemetry?.capturePending&&!s.pendingDecisions.length&&!s.pauseReasons.some(r=>blockingReasons.includes(r))){set({running:true,advancing:false,learningPause:false,pauseReasons:[]});}},
 setWarp(warp){const s=get();if(s.sim&&!s.pauseReasons.includes('settings')&&!s.pauseReasons.includes('home')&&s.actor()!=='ALL'&&s.actor()!=='LAUNCH_ORBIT'){set({lastRefusal:{ok:false,code:'ROLE_LOCKED',values:{role:'LAUNCH_ORBIT'}}});return;}if(WARPS.some(w=>w===warp))set({warp});},
 advance(dt,publish){
  const s=get();if(!s.running||!liveMission.state||s.pauseReasons.some(r=>blockingReasons.includes(r)))return;
  let remaining=dt,state=liveMission.state;const events:SimEvent[]=[];let count=0;
  while(remaining>1e-8&&count++<400){const chunk=Math.min(10,remaining),result=core.stepSim(state,chunk);state=result.state;events.push(...result.events);remaining-=chunk;if(result.events.some(e=>e.autoPause)||core.telemetry(state).ended)break;}
  liveMission.state=state;liveMission.telemetry=core.telemetry(state);
  if(events.length||publish){const ended=!!liveMission.telemetry.ended,pending=events.filter(e=>e.autoPause&&!ended);let pauseReasons=s.pauseReasons;if(pending.length)pauseReasons=withReason(pauseReasons,'decision');
   set({sim:state,telemetry:liveMission.telemetry,historyVersion:s.historyVersion+1,events:[...s.events,...events].slice(-500),pendingDecisions:ended?[]:[...s.pendingDecisions,...pending],running:!ended&&!pending.length&&remaining<=1e-8?s.running:false,pauseReasons,cues:s.design?cuesFor(s.design,s.cues,state):s.cues});
   events.forEach(emitGameEvent);if(pending.length)get().saveCheckpoint('decision');if(ended&&s.design)saveMissionBest(state,s.design,s.team,s.assisted);
  }
 },
 advanceToEvent(targetSec){
  const s=get();if(!s.sim||s.telemetry?.ended||s.pendingDecisions.length||s.pauseReasons.some(r=>blockingReasons.includes(r)))return;
  if(targetSec!==undefined&&(!Number.isFinite(targetSec)||targetSec<=s.sim.t+(s.telemetry?.remainderSec??0)))return;
  const generation=liveMission.generation,operation=++advanceOperation,boundary=core.nextBoundary(s.sim),target=targetSec??(boundary?s.sim.t+boundary.inSec:null);set({advancing:true,running:false,advanceMessage:null,pauseReasons:[]});let work=0;
  const batch=()=>{const current=get();if(!current.advancing||operation!==advanceOperation||generation!==liveMission.generation||!liveMission.state)return;
   let state=liveMission.state,telemetry=core.telemetry(state);const events:SimEvent[]=[];let found=false;
   // Sub-tick requests are already carried by core: never request that time twice.
   for(let n=0;n<120;n++){
    const dt=target===null?10:Math.max(0,Math.min(10,target-state.t-telemetry.remainderSec));
    if(dt<=1e-8){found=true;break;}
    const result=core.stepSim(state,dt);state=result.state;telemetry=core.telemetry(state);events.push(...result.events);work++;
    if(result.events.some(event=>event.autoPause)||telemetry.ended||telemetry.capturePending||target!==null&&state.t+telemetry.remainderSec>=target-1e-8){found=true;break;}
   }
   liveMission.state=state;liveMission.telemetry=telemetry;const pending=telemetry.ended?[]:events.filter(e=>e.autoPause);let pauseReasons=current.pauseReasons;if(pending.length)pauseReasons=withReason(pauseReasons,'decision');
   if(found||work>=8640)pauseReasons=withReason(pauseReasons,'self-paced');
   set({sim:state,telemetry,historyVersion:current.historyVersion+1,events:[...current.events,...events].slice(-500),pendingDecisions:[...current.pendingDecisions,...pending],pauseReasons,advancing:!found&&work<8640,advanceMessage:found?'event':work>=8640?'limit':null,cues:current.design?cuesFor(current.design,current.cues,state):current.cues});events.forEach(emitGameEvent);
   if(found)get().saveCheckpoint(telemetry.capturePending?'arrival':'decision');if(telemetry.ended&&current.design)saveMissionBest(state,current.design,current.team,current.assisted);
   if(!found&&work<8640)requestAnimationFrame(batch);
  };requestAnimationFrame(batch);
 },
 cancelAdvance(){advanceOperation++;set({advancing:false,running:false,pauseReasons:withReason(get().pauseReasons,'manual')});},
 publish(){if(liveMission.state)set({sim:liveMission.state,telemetry:liveMission.telemetry,historyVersion:get().historyVersion+1});},
 decide(commands){if(commands.length&&!get().commands(commands))return false;get().acknowledgeDecision();return true;},
 acknowledgeDecision(){const pendingDecisions=get().pendingDecisions.slice(1);set({pendingDecisions,running:false,pauseReasons:pendingDecisions.length?withReason(get().pauseReasons,'decision'):withReason(get().pauseReasons.filter(r=>r!=='decision'),'manual')});},
 skipCruise(){const s=get();if(!liveMission.state||!s.telemetry?.cruise||s.previewMissionId)return;if(s.actor()!=='ALL'&&s.actor()!=='LAUNCH_ORBIT'){set({lastRefusal:{ok:false,code:'ROLE_LOCKED',values:{role:'LAUNCH_ORBIT'}}});return;}const result=core.skipCruise(liveMission.state);liveMission.state=result.state;liveMission.telemetry=core.telemetry(result.state);const pendingDecisions=result.events.filter(e=>e.autoPause);set({sim:result.state,telemetry:liveMission.telemetry,running:false,events:[...s.events,...result.events],pendingDecisions,historyVersion:s.historyVersion+1,pauseReasons:pendingDecisions.length?withReason(s.pauseReasons,'decision'):withReason(s.pauseReasons,'manual')});result.events.forEach(emitGameEvent);get().saveCheckpoint('arrival');},
 resetMission(keepDesign=false){
  const s=get();if(keepDesign&&s.design){s.startScenario(s.scenarioId,s.levelId,true);return;}liveMission.state=null;liveMission.telemetry=null;liveMission.generation++;resetAudioGate();
  set({attemptId:s.attemptId+1,artifacts:null,designNotes:[],rosterHistory:[],facilitator:0,acceptedTrades:[],design:null,budgets:null,cues:emptyCues(),activeStage:'NEED_GOALS',furthestStage:0,activeSubstep:'brief',activeView:'GOAL',previewMissionId:null,previewLevelId:null,sim:null,telemetry:null,running:false,warp:100,historyVersion:0,events:[],pendingDecisions:[],signoffs:blankSignoffs(),team:{...emptyTeam(),roles:s.players.length===1?1:4},lastRefusal:null,explanation:null,learningPause:false,handoff:null,previewImage:null,pauseReasons:[],advancing:false,advanceMessage:null,practiceCheckpoints:[],assisted:false});
 },
 saveCheckpoint(name){const s=get();if(s.levelId!=='ASPIRING'||!s.design||!liveMission.state||s.telemetry?.ended)return;const snapshot=structuredClone({design:s.design,sim:liveMission.state,events:s.events,pendingDecisions:s.pendingDecisions,team:s.team,signoffs:s.signoffs,cues:s.cues});const checkpoint:PracticeCheckpoint={id:++nextCheckpointId,name,time:liveMission.state.t,snapshot};set({practiceCheckpoints:[...s.practiceCheckpoints.filter(c=>c.name!==name),checkpoint].slice(-3)});},
 retryCheckpoint(id){const s=get(),checkpoint=s.practiceCheckpoints.find(c=>c.id===id);if(s.levelId!=='ASPIRING'||!checkpoint)return;const snapshot=structuredClone(checkpoint.snapshot),sim=core.markPracticeRetry(snapshot.sim),telemetry=core.telemetry(sim);liveMission.generation++;liveMission.state=sim;liveMission.telemetry=telemetry;set({...snapshot,sim,telemetry,budgets:core.computeBudgets(snapshot.design),assisted:true,historyVersion:s.historyVersion+1,running:false,advancing:false,explanation:null,handoff:null,previewMissionId:null,previewLevelId:null,pauseReasons:snapshot.pendingDecisions.length?['manual','decision']:['manual'],lastRefusal:null,practiceCheckpoints:s.practiceCheckpoints.filter(c=>c.id<=checkpoint.id)});},
 openExplanation(topicId,contextId,opener=null){const s=get();s.pause('explanation');set({learningPause:!!s.sim||s.learningPause,explanation:{topicId,contextId,opener,snapshot:{design:s.design,budgets:s.budgets,telemetry:liveMission.telemetry??s.telemetry}}});},
 closeExplanation(restoreFocus=true){const opener=get().explanation?.opener;set({explanation:null});get().clearPauseReason('explanation');if(restoreFocus&&typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{if(opener?.isConnected&&!opener.closest('[inert]'))opener.focus();else document.getElementById('mission-primary')?.focus();});},
 setSettings(patch){const settings={...get().settings,...patch,...(patch.presentation!==undefined&&patch.presentationExplicit===undefined?{presentationExplicit:true}:{})};persistSettings(settings);set({settings});},setPreviewImage(previewImage){set({previewImage});},clearRefusal(){set({lastRefusal:null});},dismissHandoff(){set({activeRole:get().handoff??get().activeRole,handoff:null});get().clearPauseReason('handoff');}
}));
