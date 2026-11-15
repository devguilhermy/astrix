import * as core from '@astrix/core';
import type { CueEngineState, Design, Quote, RoleId, SimEvent, SimState } from '@astrix/core';
import { ROLES, STAGES, SUBSTEPS, WARPS } from './contracts';
import type { DesignEdit, IntentEnvelope, IntentResult, PauseReason, ReplayEntry, SessionActor, SessionIntent, SessionOptions, SessionRefusal, SessionState } from './contracts';
import { canAct, decisionOwner } from './permissions';
import { addReason, blocksResume, isSharedPause } from './pause';
const blankSigns=():Record<RoleId,boolean>=>({SCIENCE:false,SPACECRAFT:false,LAUNCH_ORBIT:false,GROUND_COMMS:false});
const emptyCues=():CueEngineState=>({lastRaised:{},clearPending:{},active:[]});
const emptyTeam=()=>({roles:1,signoffs:0,blockedSignoffAttempts:0,sev3Raised:0,sev3ResolvedBeforeLaunch:0});
const viewFor=(stage:SessionState['activeStage'],step:string):SessionState['activeView']=>stage==='NEED_GOALS'?'GOAL':stage==='CONCEPT'||stage==='REQUIREMENTS'?'CONCEPT':stage==='DESIGN'?(step==='orbit'||step==='trajectory'?'LAUNCH_ORBIT':'DESIGN'):stage==='BUILD_VERIFY'?'LAUNCH_ORBIT':stage==='REVIEW'?'REPORT':'OPERATE';
const cuesFor=(design:Design,previous:CueEngineState,sim:SimState|null)=>core.evaluateCues(previous,sim?core.operateSnapshot(sim,design):{...core.designSnapshot(design),phase:'LAUNCH_ORBIT'},sim?.t??design.revision);
const refusal=(code:SessionRefusal['code'],values:Readonly<Record<string,string|number>>={}):SessionRefusal=>({ok:false,code,values});
const success=(state:SessionState):IntentResult=>({ok:true,seq:state.seq,receiptIds:[]});
export function createSession(options:SessionOptions={}):SessionState {
 const id=options.hostPlayerId??'player-1';
 return {epoch:options.epoch??'local',seq:0,rosterRevision:0,mode:options.mode??'LOCAL',participantMode:options.participantMode??'SOLO',roster:[{id,name:options.hostName??'Host',roles:ROLES,ready:true,acknowledged:true,connected:true}],approvals:[],scenarioId:'FIRST_LIGHT',levelId:'ASPIRING',attemptId:0,artifacts:null,activeStage:'NEED_GOALS',furthestStage:0,activeSubstep:'brief',activeView:'GOAL',players:[ROLES],facilitator:0,signoffs:blankSigns(),team:emptyTeam(),design:null,budgets:null,cues:emptyCues(),designNotes:[],rosterHistory:[],acceptedTrades:[],sim:null,telemetry:null,running:false,warp:100,historyVersion:0,events:[],pendingDecisions:[],decisions:[],pauseReasons:[],pauseOwners:{},pauseRoles:{},advancing:false,advanceMessage:null,advanceTarget:null,advanceWork:0,practiceCheckpoints:[],nextCheckpointId:0,assisted:false,results:{},quotes:{},replay:[]};
}
export function quoteDesign(design:Design,edit:DesignEdit,actor:SessionActor['role']):Quote<{next:Design}> {
 switch(edit.kind){case 'ADD_PART':return core.quoteAddPart(design,edit.partId,actor);case 'REMOVE_PART':return core.quoteRemovePart(design,edit.partId,actor);case 'SET_RIDE':return core.quoteSetRide(design,edit.rideId,actor);case 'SET_ORBIT':return core.quoteSetOrbit(design,edit.orbit,actor);case 'SET_PROPELLANT':return core.quoteSetPropellant(design,edit.kg,actor);}
}
function checkpoint(state:SessionState,name:'launch'|'arrival'|'decision'):SessionState {
 if(state.levelId!=='ASPIRING'||!state.design||!state.sim||state.telemetry?.ended)return state;
 const id=state.nextCheckpointId+1,snapshot=structuredClone({design:state.design,sim:state.sim,events:state.events,pendingDecisions:state.pendingDecisions,decisions:state.decisions,team:state.team,signoffs:state.signoffs,approvals:state.approvals,cues:state.cues});
 return {...state,nextCheckpointId:id,practiceCheckpoints:[...state.practiceCheckpoints.filter(c=>c.name!==name),{id,name,time:state.sim.t,snapshot}].slice(-3)};
}
function flightResult(state:SessionState,sim:SimState,events:readonly SimEvent[]):SessionState {
 const telemetry=core.telemetry(sim),pending=telemetry.ended?[]:events.filter(e=>e.autoPause);
 const decisions=telemetry.ended?[]:[...state.decisions,...pending.map((event,index)=>({id:`${state.attemptId}:${state.seq+1}:${state.historyVersion+1}:${index}`,event,owner:decisionOwner(event,telemetry.commandQueue.find(q=>q.id===event.values.commandId)?.command)}))];
 const next={...state,sim,telemetry,historyVersion:state.historyVersion+1,events:[...state.events,...events].slice(-500),pendingDecisions:telemetry.ended?[]:[...state.pendingDecisions,...pending],decisions,running:!telemetry.ended&&!pending.length&&state.running,pauseReasons:pending.length?addReason(state.pauseReasons,'decision'):state.pauseReasons,cues:state.design?cuesFor(state.design,state.cues,sim):state.cues};
 return pending.length?checkpoint(next,'decision'):next;
}
function rosterCommit(state:SessionState,roster:SessionState['roster'],actor:SessionActor):SessionState {
 const players=roster.map(p=>p.roles),signoffs={...state.signoffs};
 for(const role of ROLES)if(state.roster.find(p=>p.roles.includes(role))?.id!==roster.find(p=>p.roles.includes(role))?.id)signoffs[role]=false;
 const approvals=state.approvals.filter(a=>signoffs[a.role]);
 return {...state,roster,players,signoffs,approvals,rosterRevision:state.rosterRevision+1,quotes:{},facilitator:Math.min(state.facilitator,players.length-1),team:{...state.team,roles:state.participantMode==='SOLO'?1:4},rosterHistory:[...state.rosterHistory,{before:state.players.map(r=>[...r]),after:players.map(r=>[...r]),beforePlayers:state.roster.map(({id,name,roles})=>({id,name,roles:[...roles]})),afterPlayers:roster.map(({id,name,roles})=>({id,name,roles:[...roles]})),time:state.sim?.t??0,actorId:actor.playerId}].slice(-100)};
}
interface Transition {state:SessionState;result:IntentResult}
function transact(s:SessionState,intent:SessionIntent,actor:SessionActor):Transition {
 const fail=(code:SessionRefusal['code']='NOT_READY',values:Readonly<Record<string,string|number>>={}):Transition=>({state:s,result:{ok:false,refusal:refusal(code,values)}});
 const done=(state:SessionState):Transition=>({state,result:success(state)});
 const host=()=>s.mode==='LOCAL'||!!actor.isHost;
 const role=(required:RoleId)=>canAct(s,actor,required);
 const d=s.design;
 if(!s.roster.some(p=>p.id===actor.playerId))return fail('UNAUTHORIZED');
 // Host capability permits administration, never a physical-role bypass.
 const admin=['START_SCENARIO','RESET_MISSION','SET_TEAM','ADD_PLAYER','ASSIGN_ROLE','SET_PRESENCE','ROTATE_FACILITATOR','END_MISSION','RETRY_CHECKPOINT'];
 if(admin.includes(intent.kind)&&!host())return fail('HOST_ONLY');
 if(!admin.includes(intent.kind)&&!['PAUSE','CLEAR_PAUSE','RESUME','SET_READY','ACK_LEARNING','SET_STAGE','SET_SUBSTEP','SET_VIEW'].includes(intent.kind)&&!canAct(s,actor))return fail('ROLE_NOT_ASSIGNED');
 if('designRevision'in intent&&intent.designRevision!==d?.revision)return fail('STALE_DESIGN');
 if('baseRevision'in intent&&intent.baseRevision!==d?.revision)return fail('STALE_DESIGN');
 if('rosterRevision'in intent&&intent.rosterRevision!==s.rosterRevision)return fail('STALE_ROSTER');
 switch(intent.kind){
 case 'LOCAL_RESTORE':return s.mode==='LOCAL'&&actor.isHost?done({...intent.state,seq:s.seq,results:s.results,replay:s.replay,running:false,advancing:false}):fail('HOST_ONLY');
 case 'LOCAL_TRADE':return s.mode==='LOCAL'&&!s.sim&&d?.revision===intent.revision&&s.artifacts?done({...s,artifacts:{...s.artifacts,trade:{revision:intent.revision,description:intent.description,before:intent.before,after:intent.after,actor:intent.actor}}}):fail('HOST_ONLY');
 case 'INVALIDATE_BASELINE':return !s.sim&&s.artifacts?done({...s,artifacts:{...s.artifacts,baselineRevision:null,verifiedRevision:null}}):fail();
 case 'START_SCENARIO':case 'RESET_MISSION':{
  if(intent.kind==='START_SCENARIO'&&!d&&s.mode==='LAN'&&s.roster.some(p=>!p.connected||!p.ready||!p.acknowledged))return fail('NOT_READY',{missing:'rosterReady'});
  const reset=intent.kind==='RESET_MISSION',keep=reset?!!intent.keepDesign:!!intent.retainHardware;
  const scenarioId=reset?s.scenarioId:intent.scenarioId,levelId=reset?s.levelId:intent.levelId;
  const fresh=createSession({epoch:s.epoch,mode:s.mode,participantMode:s.participantMode,hostPlayerId:s.roster[0].id});
  const common={...fresh,seq:s.seq,rosterRevision:s.rosterRevision,roster:s.roster,players:s.players,participantMode:s.participantMode,scenarioId,levelId,attemptId:s.attemptId+1,nextCheckpointId:s.nextCheckpointId,warp:reset&&!keep?100:s.warp,results:s.results,replay:s.replay};
  if(reset&&!keep)return done(common);
  const starter=core.createStarterDesign(scenarioId,levelId),design=keep&&d?.scenarioId===scenarioId?{...d,levelId:starter.levelId,rulesVersion:starter.rulesVersion,revision:d.revision+1}:starter;
  const revisit=keep&&d?.scenarioId===scenarioId&&s.furthestStage>=3&&!!s.artifacts?.objectiveConfirmed&&Object.values(s.artifacts.segments).every(Boolean);
  const artifacts=core.createMissionArtifacts(design);
  return done({...common,design,budgets:core.computeBudgets(design),cues:cuesFor(design,emptyCues(),null),artifacts:revisit?{...artifacts,objectiveConfirmed:true,segments:{...s.artifacts!.segments}}:artifacts,activeStage:revisit?'DESIGN':'NEED_GOALS',furthestStage:revisit?3:0,activeSubstep:revisit?'equipment':'brief',activeView:revisit?'DESIGN':'GOAL',team:{...emptyTeam(),roles:s.participantMode==='SOLO'?1:4}});
 }
 case 'SET_STAGE':{
  const current=STAGES.indexOf(s.activeStage),target=STAGES.indexOf(intent.stage);
  if(target<0||s.sim&&intent.stage!=='IMPLEMENT'&&!(intent.stage==='REVIEW'&&s.telemetry?.ended)||!s.sim&&(target>s.furthestStage||target>current&&(!d||!s.artifacts||STAGES.slice(current,target).some(stage=>core.evaluateJourneyStage(d,s.artifacts!,stage,s.signoffs).length))))return fail();
  const step=SUBSTEPS[intent.stage][0];return done({...s,activeStage:intent.stage,activeSubstep:step,activeView:viewFor(intent.stage,step)});
 }
 case 'SET_SUBSTEP':return SUBSTEPS[s.activeStage].includes(intent.step)?done({...s,activeSubstep:intent.step,activeView:viewFor(s.activeStage,intent.step)}):fail();
 case 'SET_VIEW':return intent.view==='OPERATE'&&s.sim?done({...s,activeStage:'IMPLEMENT',activeSubstep:'operations',activeView:'OPERATE'}):intent.view==='REPORT'&&s.telemetry?.ended?done({...s,activeStage:'REVIEW',activeSubstep:'results',activeView:'REPORT'}):fail();
 case 'COMPLETE_STAGE':{
  if(!d||!s.artifacts)return fail();const index=STAGES.indexOf(s.activeStage);
  if(index<0||index>=STAGES.length-1||s.activeStage==='IMPLEMENT'&&!s.telemetry?.ended||core.evaluateJourneyStage(d,s.artifacts,s.activeStage,s.signoffs,s.sim??undefined).length)return fail();
  const stage=STAGES[index+1],step=SUBSTEPS[stage][0];return done({...s,activeStage:stage,furthestStage:Math.max(s.furthestStage,index+1),activeSubstep:step,activeView:viewFor(stage,step)});
 }
 case 'CONFIRM_OBJECTIVE':if(!role('SCIENCE'))return fail('ROLE_LOCKED',{role:'SCIENCE'});return !s.sim&&s.artifacts?done({...s,artifacts:{...s.artifacts,objectiveConfirmed:intent.confirmed??true}}):fail();
 case 'SET_SEGMENT':return !s.sim&&s.artifacts?done({...s,artifacts:{...s.artifacts,segments:{...s.artifacts.segments,[intent.segment]:intent.selected}}}):fail();
 case 'RECORD_TRADE':case 'QUOTE_DESIGN':case 'COMMIT_DESIGN':{
  if(!d||s.sim)return fail('NOT_READY',{missing:'frozenDesign'});
  const quote=quoteDesign(d,intent.edit,actor.role);if(!quote.ok)return {state:s,result:{ok:false,refusal:quote}};
  const next=quote.value.next,before=s.budgets??core.computeBudgets(d),after=core.computeBudgets(next),affected=core.rolesAffectedBy(d,next);
  if(intent.kind==='RECORD_TRADE')return s.artifacts?done({...s,artifacts:{...s.artifacts,trade:{revision:d.revision,description:intent.description,before,after,actor:actor.role}}}):fail();
  if(intent.kind==='QUOTE_DESIGN'){
   const quotes=Object.fromEntries(Object.entries(s.quotes).filter(([,q])=>q.expiresSeq>=s.seq));
   if(Object.keys(quotes).length>=256)return fail('RATE_LIMITED');
   const quoteId=`${s.epoch}:${s.attemptId}:${s.seq+1}:${actor.playerId}`;
   return {state:{...s,quotes:{...quotes,[quoteId]:{playerId:actor.playerId,role:actor.role,baseRevision:d.revision,edit:intent.edit,attemptId:s.attemptId,expiresSeq:s.seq+120}}},result:{ok:true,seq:s.seq,receiptIds:[],quote:{quoteId,baseRevision:d.revision,before,after,affectedRoles:affected}}};
  }
  if(s.mode==='LAN'){
   const cached=intent.quoteId?s.quotes[intent.quoteId]:undefined;
   if(!cached||cached.expiresSeq<s.seq||cached.playerId!==actor.playerId||cached.role!==actor.role||cached.attemptId!==s.attemptId||cached.baseRevision!==d.revision||canonical(cached.edit)!==canonical(intent.edit))return fail('INTENT_EXPIRED');
  }
  const signoffs={...s.signoffs};affected.forEach(r=>signoffs[r]=false);
  const cues=cuesFor(next,s.cues,null),oldCritical=s.cues.active.filter(c=>c.severity===3),critical=cues.active.filter(c=>c.severity===3);
  const description='partId'in intent.edit?intent.edit.partId:intent.edit.kind==='SET_RIDE'?'ride':intent.edit.kind==='SET_PROPELLANT'?'propellant':'orbit';
  return done({...s,design:next,budgets:after,quotes:{},signoffs,approvals:s.approvals.filter(a=>!affected.includes(a.role)),cues,acceptedTrades:[...s.acceptedTrades,{revision:d.revision,actor:actor.role,player:actor.role==='ALL'?null:s.roster.findIndex(p=>p.id===actor.playerId),playerId:actor.playerId,description,before,after}].slice(-100),team:{...s.team,sev3Raised:s.team.sev3Raised+critical.filter(c=>!oldCritical.some(p=>p.id===c.id)).length,sev3ResolvedBeforeLaunch:s.team.sev3ResolvedBeforeLaunch+oldCritical.filter(c=>!critical.some(p=>p.id===c.id)).length}});
 }
 case 'FREEZE_BASELINE':return d&&s.artifacts&&!s.sim&&s.artifacts.trade?done({...s,artifacts:{...s.artifacts,baselineRevision:d.revision,verifiedRevision:null}}):fail();
 case 'VERIFY_BASELINE':return d&&s.artifacts&&!s.sim&&s.artifacts.baselineRevision===d.revision&&!core.evaluateJourneyStage(d,s.artifacts,'BUILD_VERIFY',s.signoffs).some(i=>i.id!=='VERIFY')?done({...s,artifacts:{...s.artifacts,verifiedRevision:d.revision}}):fail();
 case 'SIGN_OFF':{
  if(!d||s.sim)return fail();if(!role(intent.role))return fail('ROLE_LOCKED',{role:intent.role});
  const cues=cuesFor(d,s.cues,null),roles=actor.role==='ALL'?ROLES:[intent.role],blocked=roles.find(r=>cues.active.some(c=>c.severity===3&&(c.role===r||c.role==='ALL')));
  if(blocked)return {state:{...s,cues,team:{...s.team,blockedSignoffAttempts:s.team.blockedSignoffAttempts+1}},result:{ok:false,refusal:refusal('SIGNOFF_BLOCKED',{role:blocked})}};
  const signoffs={...s.signoffs};let added=0;for(const r of roles){if(!signoffs[r])added++;signoffs[r]=true;}
  return done({...s,cues,signoffs,team:{...s.team,signoffs:s.team.signoffs+added},approvals:[...s.approvals.filter(a=>!roles.includes(a.role)),...roles.map(r=>({role:r,playerId:actor.playerId,designRevisionReviewed:d.revision,dependencyFingerprint:JSON.stringify({role:r,design:d}),rosterRevision:s.rosterRevision,acceptedSeq:s.seq+1}))]});
 }
 case 'NOTE':{
  if(!d||s.sim)return fail();const text=normalizeText(intent.text,500);if(!text)return fail('INVALID_PARAMETER',{parameter:'text'});
  return done({...s,designNotes:[...s.designNotes,{id:`${s.attemptId}:note:${s.seq+1}`,revision:d.revision,actor:actor.role,player:actor.role==='ALL'?null:s.roster.findIndex(p=>p.id===actor.playerId),playerId:actor.playerId,kind:intent.category,target:intent.target,text,resolved:false}].slice(-100)});
 }
 case 'RESOLVE_NOTE':return !s.sim?done({...s,designNotes:s.designNotes.map(n=>n.id===intent.noteId?{...n,resolved:true,resolvedBy:actor.playerId}:n)}):fail();
 case 'LAUNCH':{
  if(!d||!s.artifacts||s.sim||s.activeStage!=='IMPLEMENT')return fail();if(!role('LAUNCH_ORBIT'))return fail('ROLE_LOCKED',{role:'LAUNCH_ORBIT'});
  if(s.mode==='LAN'&&s.pauseReasons.some(blocksResume))return fail('NOT_READY',{missing:'sharedPause'});
  if(s.mode==='LAN'&&ROLES.some(r=>!s.roster.some(p=>p.roles.includes(r)&&p.connected&&p.acknowledged&&p.ready)))return fail('NOT_READY',{missing:'roster'});
  const errors=core.launchReadiness(d,s.signoffs);if(errors.length)return {state:s,result:{ok:false,refusal:errors[0]}};
  if(core.evaluateJourneyStage(d,s.artifacts,'IMPLEMENT',s.signoffs).length)return fail();
  const sim=core.createSim(d,core.listScenarios().find(x=>x.id===s.scenarioId)!.seed);
  return done(checkpoint({...s,sim,telemetry:core.telemetry(sim),running:false,cues:cuesFor(d,emptyCues(),sim),pauseReasons:['manual'],activeStage:'IMPLEMENT',activeSubstep:'operations',activeView:'OPERATE'},'launch'));
 }
 case 'COMMANDS':{
  if(!s.sim||s.telemetry?.ended||s.advancing||s.mode==='LOCAL'&&s.pauseReasons.includes('explanation'))return fail();
  if(!intent.commands.length||intent.commands.length>32)return fail('INVALID_PARAMETER',{parameter:'commands'});
  if(s.warp>10&&intent.commands.some(c=>c.kind==='ATTITUDE_TARGET'))return fail('INVALID_PARAMETER',{parameter:'warp',max:10});
  let candidate=s.sim;for(const command of intent.commands){const q=core.issueCommand(candidate,command,actor.role,{role:actor.role,playerId:actor.playerId});if(!q.ok)return {state:s,result:{ok:false,refusal:q}};candidate=q.value;}
  const stepped=core.stepSim(candidate,0),state=flightResult(s,stepped.state,stepped.events);
  if(state.decisions.length>32||s.mode==='LAN'&&state.telemetry!.queued>64)return fail('RATE_LIMITED');
  const previousIds=new Set(s.telemetry?.commandQueue.map(q=>q.id));
  const receiptIds=state.telemetry!.commandQueue.filter(q=>!previousIds.has(q.id)||q.actor.playerId===actor.playerId&&q.actor.role===actor.role&&s.telemetry?.commandQueue.find(previous=>previous.id===q.id)?.status==='WAITING_CONTACT'&&intent.commands.some(c=>c.kind==='ATTITUDE_TARGET'&&q.command.kind==='ATTITUDE_TARGET'&&c.gestureId&&c.gestureId===q.command.gestureId)).map(q=>q.id);
  return {state,result:{ok:true,seq:s.seq,receiptIds}};
 }
 case 'PAUSE':{
  const reason=intent.reason??'manual';if(!isSharedPause(s,reason,actor))return done(s);
  if(reason==='decision')return fail('INVALID_PARAMETER',{parameter:'reason'});
  if(s.mode==='LAN'&&(reason==='host-stall'||reason==='host-display-disconnected'||reason.startsWith('controller-disconnected:'))&&!host())return fail('HOST_ONLY');
  if(!s.pauseReasons.includes(reason)&&s.pauseReasons.length>=32)return fail('RATE_LIMITED');
  return done({...s,running:false,advancing:false,pauseReasons:addReason(s.pauseReasons,reason),pauseOwners:{...s.pauseOwners,[reason]:actor.playerId},pauseRoles:{...s.pauseRoles,[reason]:actor.role}});
 }
 case 'CLEAR_PAUSE':{
  if(!isSharedPause(s,intent.reason,actor))return done(s);
  if(intent.reason==='decision'||intent.reason.startsWith('learning:'))return fail('NOT_READY');
  if(s.mode==='LAN'&&!host()&&s.pauseOwners[intent.reason]!==actor.playerId)return fail('HOST_ONLY');
  const reasons=s.pauseReasons.filter(r=>r!==intent.reason),owners={...s.pauseOwners},roles={...s.pauseRoles};delete owners[intent.reason];delete roles[intent.reason];
  return done({...s,pauseReasons:s.sim&&!reasons.length?['manual']:reasons,pauseOwners:owners,pauseRoles:roles,running:false});
 }
 case 'RESUME':if(!host())return fail('HOST_ONLY');return s.sim&&!s.telemetry?.ended&&!s.telemetry?.cruise&&!s.telemetry?.capturePending&&!s.pendingDecisions.length&&!s.pauseReasons.some(blocksResume)?done({...s,running:true,advancing:false,pauseReasons:[],pauseOwners:{},pauseRoles:{}}):fail();
 case 'SET_WARP':if(s.sim&&!role('LAUNCH_ORBIT')&&!(s.mode==='LOCAL'&&(s.pauseReasons.includes('settings')||s.pauseReasons.includes('home'))))return fail('ROLE_LOCKED',{role:'LAUNCH_ORBIT'});return WARPS.some(w=>w===intent.warp)?done({...s,warp:intent.warp}):fail('INVALID_PARAMETER',{parameter:'warp'});
 case 'ADVANCE_NEXT':{
  if(!role('LAUNCH_ORBIT'))return fail('ROLE_LOCKED',{role:'LAUNCH_ORBIT'});
  if(!s.sim||s.telemetry?.ended||s.pendingDecisions.length||s.pauseReasons.some(blocksResume))return fail();
  if(intent.targetSec!==undefined&&(!Number.isFinite(intent.targetSec)||intent.targetSec<=s.sim.t+(s.telemetry?.remainderSec??0)))return fail();
  const boundary=core.nextBoundary(s.sim);return done({...s,advancing:true,running:false,advanceMessage:null,pauseReasons:[],advanceTarget:intent.targetSec??(boundary?s.sim.t+boundary.inSec:null),advanceWork:0});
 }
 case 'CANCEL_ADVANCE':return host()||role('LAUNCH_ORBIT')?done({...s,advancing:false,running:false,pauseReasons:addReason(s.pauseReasons,'manual')}):fail('ROLE_LOCKED',{role:'LAUNCH_ORBIT'});
 case 'ACK_DECISION':{
  const decision=s.decisions.find(x=>x.id===intent.decisionId);if(!decision)return fail('INTENT_EXPIRED');if(!role(decision.owner))return fail('ROLE_LOCKED',{role:decision.owner});
  const decisions=s.decisions.filter(x=>x!==decision),pendingDecisions=s.pendingDecisions.filter(e=>e!==decision.event),reasons=decisions.length?addReason(s.pauseReasons,'decision'):addReason(s.pauseReasons.filter(r=>r!=='decision'),'manual');
  return done({...s,decisions,pendingDecisions,pauseReasons:reasons,running:false});
 }
 case 'ACK_LEARNING':{
  const reason:PauseReason=`learning:${intent.stopId}`;if(!s.pauseReasons.includes(reason))return fail('INTENT_EXPIRED');if(!host()&&s.pauseOwners[reason]!==actor.playerId)return fail('UNAUTHORIZED');
  const owners={...s.pauseOwners},roles={...s.pauseRoles};delete owners[reason];delete roles[reason];
  return done({...s,running:false,pauseReasons:addReason(s.pauseReasons.filter(r=>r!==reason),'manual'),pauseOwners:owners,pauseRoles:roles});
 }
 case 'SKIP_CRUISE':if(!role('LAUNCH_ORBIT'))return fail('ROLE_LOCKED',{role:'LAUNCH_ORBIT'});if(!s.sim||!s.telemetry?.cruise||s.mode==='LAN'&&s.pauseReasons.some(blocksResume))return fail();{const r=core.skipCruise(s.sim);return done(checkpoint(flightResult({...s,running:false,pauseReasons:addReason(s.pauseReasons,'manual')},r.state,r.events),'arrival'));}
 case 'SAVE_CHECKPOINT':return done(checkpoint(s,intent.name));
 case 'RETRY_CHECKPOINT':{
  const saved=s.practiceCheckpoints.find(c=>c.id===intent.checkpointId);if(s.levelId!=='ASPIRING'||!saved)return fail();
  const snapshot=structuredClone(saved.snapshot),sim=core.markPracticeRetry(snapshot.sim),attemptId=s.attemptId+1;
  const decisions=snapshot.decisions.map((item,index)=>({...item,id:`${attemptId}:rewind:${index}`}));
  const safetyReasons=s.mode==='LAN'?s.pauseReasons.filter(reason=>blocksResume(reason)&&reason!=='decision'&&!reason.startsWith('learning:')):[];
  const pauseOwners=Object.fromEntries(Object.entries(s.pauseOwners).filter(([reason])=>safetyReasons.some(r=>r===reason))),pauseRoles=Object.fromEntries(Object.entries(s.pauseRoles).filter(([reason])=>safetyReasons.some(r=>r===reason)));
  return done({...s,...snapshot,decisions,sim,telemetry:core.telemetry(sim),attemptId,quotes:{},budgets:core.computeBudgets(snapshot.design),assisted:true,historyVersion:s.historyVersion+1,running:false,advancing:false,pauseReasons:snapshot.pendingDecisions.length?['manual','decision',...safetyReasons]:['manual',...safetyReasons],pauseOwners,pauseRoles,practiceCheckpoints:s.practiceCheckpoints.filter(c=>c.id<=saved.id)});
 }
 case 'END_MISSION':if(!intent.confirmationId||!s.sim||s.telemetry?.ended)return fail();{const sim=core.endMission(s.sim);return done({...s,sim,telemetry:core.telemetry(sim),running:false,advancing:false,pendingDecisions:[],decisions:[],pauseReasons:['manual']});}
 case 'SET_TEAM':{
  if(s.mode==='LAN'&&s.attemptId>0)return fail('NOT_READY');if(s.sim&&!s.pauseReasons.includes('settings'))return fail();
  const count=Math.max(1,Math.min(4,Math.trunc(intent.count)));if(count===s.roster.length)return done(s);
  const roster=Array.from({length:count},(_,i)=>({...s.roster[i],id:s.roster[i]?.id??`player-${s.rosterRevision+1}-${i+1}`,name:s.roster[i]?.name??`Player ${i+1}`,roles:ROLES.filter((_,index)=>index%count===i),ready:true,acknowledged:true,connected:true}));
  return done(rosterCommit({...s,participantMode:count===1?'SOLO':'TEAM'},roster,actor));
 }
 case 'ADD_PLAYER':{
  const retained=s.roster.filter(p=>p.connected||p.roles.length>0);
  if(retained.length>=4||s.roster.some(p=>p.id===intent.playerId))return fail('ROOM_FULL');
  const name=normalizeText(intent.name,40);if(!name)return fail('INVALID_PARAMETER',{parameter:'name'});
  return done(rosterCommit(s,[...retained,{id:intent.playerId,name,roles:[],ready:false,acknowledged:false,connected:true}],actor));
 }
 case 'ASSIGN_ROLE':{
  if(s.running||s.advancing||!s.roster.some(p=>p.id===intent.playerId))return fail();
  const previous=s.roster.find(p=>p.roles.includes(intent.role));if(previous?.id===intent.playerId)return done(s);
  const roster=s.roster.map(p=>({...p,roles:p.id===intent.playerId?[...p.roles.filter(r=>r!==intent.role),intent.role]:p.roles.filter(r=>r!==intent.role),...(p.id===intent.playerId||p.id===previous?.id?{ready:false,acknowledged:false}:{})}));
  return done(rosterCommit(s,roster,actor));
 }
 case 'SET_READY':return done({...s,roster:s.roster.map(p=>p.id===actor.playerId?{...p,ready:intent.ready,acknowledged:true}:p)});
 case 'SET_PRESENCE':return done({...s,roster:s.roster.map(p=>p.id===intent.playerId?{...p,connected:intent.connected}:p)});
 case 'ROTATE_FACILITATOR':return done({...s,facilitator:(s.facilitator+1)%s.roster.length});
 }
}
export function normalizeText(text:string,max:number):string {
 return text.replace(/\p{White_Space}+/gu,' ').replace(/[\p{Cc}\p{Cf}]/gu,'').replace(/ +/g,' ').trim().slice(0,max);
}
function canonical(value:unknown):string {
 if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
 if(typeof value==='object'&&value!==null)return `{${Object.entries(value).filter(([,item])=>item!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
 return JSON.stringify(value)??'null';
}
/** Keep a bounded replay suffix with its exact authority baseline, never silently lose its origin. */
function appendReplay(state:SessionState,entry:ReplayEntry):readonly ReplayEntry[] {
 if(state.replay.length<20000)return [...state.replay,entry];
 const {replay:_replay,results:_results,...snapshot}=state;
 return [{kind:'CHECKPOINT',seq:state.seq,snapshot:structuredClone(snapshot)},entry];
}
/** Synchronous transaction boundary; callers serialize dispatch and authenticate actors. */
export function reduceSession(state:SessionState,input:SessionIntent|IntentEnvelope,actor:SessionActor):Transition {
 const envelope='intent'in input?input:null,intent=envelope?envelope.intent:input;
 // Narrow the public union without trusting caller-supplied state objects.
 if('intent'in intent)return {state,result:{ok:false,refusal:refusal('BAD_MESSAGE')}};
 if(envelope&&envelope.epoch!==state.epoch)return {state,result:{ok:false,refusal:refusal('STALE_EPOCH')}};
 const key=envelope?`${actor.deviceId??actor.playerId}:${envelope.id}`:null,fingerprint=envelope?canonical({actor,intent,epoch:envelope.epoch,attemptId:envelope.attemptId,rosterRevision:envelope.rosterRevision}):'';
 if(key){const previous=state.results[key];if(previous)return previous.fingerprint===fingerprint?{state,result:previous.result}:{state,result:{ok:false,refusal:refusal('DUPLICATE_ID')}};}
 if(Object.keys(state.results).length>=10000)return {state,result:{ok:false,refusal:refusal('RATE_LIMITED')}};
 const reject=(code:SessionRefusal['code']):Transition=>{
  const result:IntentResult={ok:false,refusal:refusal(code)};
  return {state:key?{...state,results:{...state.results,[key]:{fingerprint,result}}}:state,result};
 };
 if(envelope&&envelope.attemptId!==state.attemptId)return reject('STALE_ATTEMPT');
 if(envelope&&envelope.rosterRevision!==state.rosterRevision)return reject('STALE_ROSTER');
 const transition=transact(state,intent,actor),changed=transition.state!==state;
 const seq=state.seq+(changed?1:0),result=transition.result.ok?{...transition.result,seq}:transition.result;
 let next=changed?{...transition.state,seq,replay:appendReplay(state,{kind:'INTENT',seq,actor:{...actor},intent})}:state;
 // Results are retained for the epoch; exhausted ledgers refuse before mutation.
 if(key)next={...next,results:{...next.results,[key]:{fingerprint,result}}};
 return {state:next,result};
}
/** Internal simulation-seconds integration; wrappers record the authoritative clock input. */
function integrate(state:SessionState,dtSec:number):SessionState {
 if(!state.running||!state.sim||state.pauseReasons.some(blocksResume)||!Number.isFinite(dtSec)||dtSec<=0)return state;
 let remaining=dtSec,sim=state.sim;const events:SimEvent[]=[];let work=0;
 while(remaining>1e-8&&work++<400){const chunk=Math.min(10,remaining),result=core.stepSim(sim,chunk);sim=result.state;events.push(...result.events);remaining-=chunk;if(result.events.some(e=>e.autoPause)||core.telemetry(sim).ended)break;}
 return flightResult({...state,running:remaining<=1e-8?state.running:false},sim,events);
}
/** Simulation-seconds entry point retained for static callers, never a wire intent. */
export function advanceSession(state:SessionState,dtSec:number):SessionState {
 const next=integrate(state,dtSec);if(next===state)return state;
 const seq=state.seq+1;return {...next,seq,replay:appendReplay(state,{kind:'TICK',seq,dtSec,simulated:true})};
}
function advanceBatch(state:SessionState):SessionState {
 if(!state.advancing||!state.sim)return state;
 let sim=state.sim,t=state.telemetry!,found=false,work=state.advanceWork;const events:SimEvent[]=[];
 for(let n=0;n<120;n++){
  const dt=state.advanceTarget===null?10:Math.max(0,Math.min(10,state.advanceTarget-sim.t-t.remainderSec));
  if(dt<=1e-8){found=true;break;}
  const result=core.stepSim(sim,dt);sim=result.state;t=core.telemetry(sim);events.push(...result.events);work++;
  if(result.events.some(e=>e.autoPause)||t.ended||t.capturePending||state.advanceTarget!==null&&sim.t+t.remainderSec>=state.advanceTarget-1e-8){found=true;break;}
 }
 let next=flightResult(state,sim,events);const stop=found||work>=8640;
 next={...next,running:false,advancing:!stop,advanceWork:work,advanceMessage:found?'event':work>=8640?'limit':null,pauseReasons:stop?addReason(next.pauseReasons,'self-paced'):next.pauseReasons};
 return found?checkpoint(next,t.capturePending?'arrival':'decision'):next;
}
/** Host/local wall-clock entry point. Warp belongs to authority, not client timestamps. */
export function tickSession(state:SessionState,dtSec:number):SessionState {
 if(!Number.isFinite(dtSec)||dtSec<0)return state;
 const next=state.advancing?advanceBatch(state):integrate(state,Math.min(dtSec,.1)*state.warp);
 if(next===state)return state;
 const seq=state.seq+1;return {...next,seq,replay:appendReplay(state,{kind:'TICK',seq,dtSec})};
}
/** Replays a private authority log against the same rules/data build, including rolling baselines. */
export function replaySession(initial:SessionState,entries:readonly ReplayEntry[]):SessionState {
 let state=initial;
 for(const entry of entries){
  if(entry.kind==='CHECKPOINT')state={...structuredClone(entry.snapshot),replay:[],results:{}};
  else if(entry.kind==='INTENT')state=reduceSession(state,entry.intent,entry.actor).state;
  else state=entry.simulated?advanceSession(state,entry.dtSec):tickSession(state,entry.dtSec);
 }
 return state;
}
