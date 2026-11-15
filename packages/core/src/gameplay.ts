import type { Command, SimEvent, SimState } from './contracts';
import type { BurnSpec } from './mission/types';
import { FLIGHT_MODEL_VERSION } from './mission/types';
import { RULES_VERSION } from './models';
import { canonicalJson, deepFreeze } from './mission/digest';
import { cloneFlight, createSim, flight, markPracticeRetry, type FlightState } from './sim/state';
import { issuePlanCommand } from './sim/commands';
import { stepSim, skipCruise } from './sim/step';
import { endMission, telemetry } from './sim/selectors';
import { allRequiredMet } from './sim/objectives';
import { addBurn, ascentActive, centralStateAt, nextTrajectoryBoundary } from './sim/trajectory';
import { crewReturnWindow } from './return';
import { muOf, orbitInfo } from './flight/conic';
import { DAY } from './physics';
import { quickDesignBrief, TURN_POLICY_VERSION, validateQuickDesignConfig } from './quickDesign';
import type { QuickDesignConfig, ReadinessCertificate, TurnCommitRequest, TurnDebrief, TurnDecision, TurnGameState, TurnPlan, TurnPlanKind, TurnReceipt, TurnResolution, TurnResult } from './gameplayTypes';

export const MAX_GAME_TURNS = 512;
export const MAX_TURN_POLICY_STEPS = 150000;
const HAZARDS: Readonly<Record<string,true>> = { FAILURE:true,BROWNOUT:true,BATTERY_LOW:true,STORAGE_NEAR_FULL:true,COMPUTER_RESET:true,POINTING_DEGRADED:true,LINK_DEGRADED:true,DEPLOYMENT_ANOMALY:true,CREW_LEAK:true,CREW_WARNING:true,CREW_CARTRIDGE_SATURATED:true,CREW_SUPPORT_LOST:true,THERMAL_INHIBIT:true };
const BOUNDARIES: Record<TurnPlanKind,string> = { LAUNCH:'LAUNCH_COMPLETE',MANEUVER:'MANEUVER_COMPLETE',COAST:'OPPORTUNITY',OBSERVE:'OBSERVATION_COMPLETE',TRANSMIT:'CONTACT_COMPLETE',RECHARGE:'ENERGY_RECOVERED',RECOVER:'RECOVERY_COMPLETE',CAPTURE:'CAPTURE_COMPLETE',RETURN:'RETURN_COMPLETE',FINISH:'TERMINAL',ABORT:'TERMINAL' };
const TITLES: Record<TurnPlanKind,string> = { LAUNCH:'Launch to the next flight boundary',MANEUVER:'Execute the next maneuver',COAST:'Coast to the next opportunity',OBSERVE:'Observe this opportunity',TRANSMIT:'Return the recorded data',RECHARGE:'Conserve energy in Sun pointing',RECOVER:'Run the supported recovery procedure',CAPTURE:'Attempt the capture burn',RETURN:'Begin crew return',FINISH:'Finish with the achieved evidence',ABORT:'End this attempt' };
function assertGame(game: TurnGameState): void {
 if (!game || game.schema!==1 || game.rulesVersion!==RULES_VERSION || game.modelVersion!==FLIGHT_MODEL_VERSION || !validateQuickDesignConfig(game.config) || !Number.isInteger(game.revision) || game.revision<0 || game.revision>MAX_GAME_TURNS+1) throw new RangeError('Unsupported turn save/rules/model');
 flight(game.sim);
}
function remainingBurn(game: TurnGameState): BurnSpec | undefined {
 const s=flight(game.sim);
 return game.design.burns.find(b=>!s.traj.receipts.some(r=>r.id===b.id) && !s.traj.burns.some(p=>p.spec.id===b.id));
}
function needsRecovery(s: FlightState): boolean {
 return s.computerState!=='RUNNING' || s.pointing.faulted && s.pointing.reacquisitions===0 || s.deployment.wings==='ANOMALOUS' || s.deployment.antenna==='ANOMALOUS' || !!s.crew && (s.crew.leakActive&&!s.crew.isolated || s.crew.scrubberKg<.1&&s.crew.spareScrubberKg>s.crew.scrubberKg);
}
/** Include both powered-launch stages until handoff, then only the retained stage. */
function fuelInventory(s:FlightState):number {
 return s.propellantKg+(s.traj.ascent?s.traj.ascent.prop1+s.traj.ascent.prop2:s.traj.stage?.attached?s.traj.stage.propKg:0);
}
function planSeconds(game: TurnGameState,kind: TurnPlanKind): number {
 const s=flight(game.sim), left=Math.max(10,s.design.definition.environment.durationSec-s.elapsed), route=game.config.approach;
 if(kind==='ABORT'||kind==='FINISH')return 0;
 if(kind==='LAUNCH')return Math.min(left,1800);
 if(kind==='CAPTURE')return 60;
 if(kind==='RETURN')return Math.min(left+21610,21610+(s.crew?.phase==='ON_ORBIT'?Math.max(0,crewReturnWindow(s.elapsed).nextSec):0));
 if(kind==='RECOVER')return Math.min(left,Math.max(300,s.cooldownUntil-s.t+180));
 if(s.cruise)return s.arrivalT-s.t;
 if(kind==='RECHARGE')return Math.min(left,Math.max(600,(s.capacityWh-s.socWh)/Math.max(1,s.ratedSolarW-s.baseLoadW)*3600));
 const burn=remainingBurn(game);
 if(kind==='MANEUVER'&&burn) {
  if(burn.trigger.kind==='AT_TIME')return Math.min(left,Math.max(60,burn.trigger.tSec+s.arrivalT-s.t+10));
  return Math.min(left,8*DAY);
 }
 if(kind==='COAST') {
  const hours=s.design.definition.objectives.find(o=>o.spec.kind==='INSTRUMENT_HOURS')?.spec;
  if(hours?.kind==='INSTRUMENT_HOURS'&&s.elapsed<hours.windowStartSec)return Math.min(left,hours.windowStartSec-s.elapsed);
  if(s.crew) {
   const cartridge=s.crew.scrubberKg/(4*1.085)*DAY;
   return Math.min(left,Math.max(60,cartridge-180),Math.max(60,s.design.definition.environment.durationSec-s.elapsed));
  }
  const tr=nextTrajectoryBoundary(cloneFlight(s));
  const next=Number.isFinite(tr)?tr-s.t:s.nextPassSec??5400;
  return Math.min(left,Math.max(60,next));
 }
 return Math.min(left,kind==='TRANSMIT'?DAY:route==='CAUTIOUS'?5400:route==='FAST'?21600:10800);
}
export function turnDecision(game: TurnGameState): TurnDecision {
 assertGame(game);
 const s=flight(game.sim), t=telemetry(s), plans:TurnPlan[]=[];
 const add=(kind:TurnPlanKind,recommended=false,warnings:string[]=[])=>plans.push({id:kind.toLowerCase(),kind,title:TITLES[kind],description:`${kind}_PLAN`,expectedElapsedSec:planSeconds(game,kind),nextBoundary:BOUNDARIES[kind],recommended,warnings});
 if(!s.ended) {
  if(ascentActive(s))add('LAUNCH',true);
  else if(s.cruise)add('COAST',true);
  else if(s.capturePending)add('CAPTURE',true);
  else if(s.crew?.phase==='RECOVERY'||s.crew?.phase==='DEORBIT')add('RETURN',true);
  else if(allRequiredMet(s)&&!s.crew)add('FINISH',true);
  else {
   const recovery=needsRecovery(s), burn=remainingBurn(game), low=s.socWh<s.capacityWh*.3;
   const hours=s.design.definition.objectives.find(o=>o.spec.kind==='INSTRUMENT_HOURS')?.spec;
   const beforeWindow=hours?.kind==='INSTRUMENT_HOURS'&&s.elapsed<hours.windowStartSec;
   const science=s.design.definition.objectives.some(o=>o.spec.kind==='DELIVERED_PRODUCT'||o.spec.kind==='INSTRUMENT_HOURS');
   const product=s.design.definition.objectives.find(o=>o.spec.kind==='DELIVERED_PRODUCT')?.spec;
   const enough=product?.kind==='DELIVERED_PRODUCT'&&s.missionStoredMB+s.missionDownlinkedMB>=product.targetMB;
   const orbitGoal=s.design.definition.objectives.find(o=>o.required&&o.spec.kind==='BOUND_ORBIT'&&o.spec.body==='MOON');
   const atScienceBody=!orbitGoal||centralStateAt(s,s.t).body==='MOON'&&orbitInfo(centralStateAt(s,s.t).r,centralStateAt(s,s.t).v,muOf('MOON')).kind==='ELLIPSE';
   if(recovery)add('RECOVER',true);
   if(burn&&!recovery) {
    const missed=burn.trigger.kind==='AT_TIME'&&burn.trigger.tSec+s.arrivalT<=s.t+1e-8;
    if(!missed)add('MANEUVER',!low,low?['ENERGY_TIGHT']:[]);
   }
   if(s.crew&&s.elapsed>=s.design.definition.environment.durationSec&&s.crew.phase==='ON_ORBIT')add('RETURN',true);
   else if(science&&atScienceBody&&!recovery&&!beforeWindow&&plans.length<2) {
    if(s.storedMB>0)add('TRANSMIT',!!enough||s.storedMB>=s.storageMB*.7);
    if(!enough&&plans.length<2)add('OBSERVE',!low&&s.storedMB<s.storageMB*.7);
   }
   if(plans.length<3&&(!science||!atScienceBody||low||plans.length===0))add(low?'RECHARGE':'COAST',plans.length===0);
   if(plans.length<3&&science&&atScienceBody&&!low&&!recovery)add('RECHARGE');
  }
  if(plans.length>=4)plans.length=3;
  if(game.revision>=MAX_GAME_TURNS)plans.length=0;
  add('ABORT');
 }
 const phase=ascentActive(s)?'ASCENT':s.cruise?'CRUISE':s.capturePending?'CAPTURE':s.ended?'COMPLETE':centralStateAt(s,s.t).body==='MOON'?'LUNAR':'OPERATE';
 return {id:`${game.identity.slice(7,23)}:${game.revision}`,revision:game.revision,phase,objective:t.evidence,plans,terminal:s.ended};
}
function initialGame(config: QuickDesignConfig): TurnGameState {
 const b=quickDesignBrief(config);
 if(b.blockers.length)throw new RangeError(`Quick design is not within limits: ${b.blockers.map(r=>r.code).join(',')}`);
 // Maneuvers are retained in the frozen design, but only armed by a player's explicit maneuver commitment.
 const sim=createSim({...b.design,burns:[]},config.seed);
 return {schema:1,rulesVersion:RULES_VERSION,modelVersion:FLIGHT_MODEL_VERSION,identity:b.identity,config:structuredClone(config),design:b.design,sim,revision:0,receipts:[],commits:[],assisted:false,rewinds:[]};
}
function resolve(game: TurnGameState,plan: TurnPlan): TurnResolution {
 const before=flight(game.sim), events:SimEvent[]=[];
 let state:SimState=cloneFlight(before), interrupted=false,boundary=plan.nextBoundary;
 const request=(cmd:Command)=> {
  const s=flight(state);
  if(s.queue.some(q=>(q.status==='WAITING_CONTACT'||q.status==='IN_TRANSIT')&&q.command.kind===cmd.kind&&(cmd.kind!=='INSTRUMENT'||q.command.kind==='INSTRUMENT'&&q.command.partId===cmd.partId)))return;
  const q=issuePlanCommand(state,cmd); if(q.ok)state=q.value;
 };
 const active=(on:boolean,hold:'SUN'|'EARTH'|'TARGET')=> {
  const s=flight(state);
  if(s.safe)request({kind:'SAFE',on:false});
  if(s.attitude.hold!==hold)request({kind:'POINT',mode:hold});
  for(const i of s.instruments)if(i.on!==on)request({kind:'INSTRUMENT',partId:i.partId,on});
  if(s.downlinkRequested&&plan.kind!=='TRANSMIT')request({kind:'DOWNLINK',on:false});
 };
 if(plan.kind==='ABORT')state=endMission(state);
 else if(plan.kind==='FINISH') {
  const s=flight(state); if(!allRequiredMet(s))throw new RangeError('Cannot finish without the required evidence'); s.ended=true;
 } else if(before.cruise) {const r=skipCruise(state);state=r.state;events.push(...r.events);}
 else {
  const startingReceipts=before.traj.receipts.length, startStored=before.missionStoredMB, startHours=before.radiationHours, startDelivered=before.missionDownlinkedMB;
  if(plan.kind==='MANEUVER') {
   const b=remainingBurn(game); if(!b)throw new RangeError('No remaining maneuver');
   // This is a preloaded flight-plan instruction; ignition still uses the ordinary finite inventory executor.
   addBurn(flight(state),b);
  }
  if(plan.kind==='CAPTURE')request({kind:'CAPTURE_CONFIRM'});
  const start=state.t, end=start+plan.expectedElapsedSec;
  const product=before.design.definition.objectives.find(o=>o.spec.kind==='DELIVERED_PRODUCT')?.spec;
  const hours=before.design.definition.objectives.find(o=>o.spec.kind==='INSTRUMENT_HOURS')?.spec;
  const required=product?.kind==='DELIVERED_PRODUCT'?Math.max(0,product.targetMB-before.missionStoredMB-before.missionDownlinkedMB):0;
  const batch=game.config.approach==='CAUTIOUS'?.45:game.config.approach==='FAST'?1:.7;
  let progressed=false;
  for(let guard=0;guard<MAX_TURN_POLICY_STEPS;guard++) {
   let s=flight(state); if(s.ended)break;
   if(!ascentActive(s)&&!s.capturePending) {
    for(const system of ['WINGS','ANTENNA'] as const)if(s.deployment[system==='WINGS'?'wings':'antenna']==='STOWED')request({kind:'DEPLOY',system});
    if(plan.kind==='RECOVER') {
     if(s.computerState==='REBOOTING'&&s.t>=s.cooldownUntil)request({kind:'RECOVER_COMPUTER'});
     if(s.safe)request({kind:'SAFE',on:false});
     if(s.pointing.faulted&&!s.pointing.reacquisitions&&s.pointing.state!=='REACQUIRING')request({kind:'REACQUIRE_POINTING'});
     for(const system of ['WINGS','ANTENNA'] as const)if(s.deployment[system==='WINGS'?'wings':'antenna']==='ANOMALOUS')request({kind:'DEPLOY_RETRY',system});
     if(s.crew?.leakActive&&!s.crew.isolated)request({kind:'CREW_ISOLATE',isolated:true});
     else if(s.crew?.isolated&&(s.crew.cabinNitrogenKg<6||s.crew.cabinOxygenKg<2.16))request({kind:'CREW_REPRESSURIZE'});
     if(s.crew&&s.crew.scrubberKg<.1&&s.crew.spareScrubberKg>s.crew.scrubberKg)request({kind:'CREW_CARTRIDGE'});
    }
    // Once the player isolates the leak, routine atmosphere maintenance is part
    // of the declared operating plan. Every top-up still debits finite tank gas.
    if(s.crew?.isolated&&(s.crew.cabinOxygenKg<2.16||s.crew.cabinNitrogenKg<6))request({kind:'CREW_REPRESSURIZE'});
    if(plan.kind==='RETURN'&&s.crew?.phase==='ON_ORBIT'&&crewReturnWindow(s.elapsed).open)request({kind:'CREW_DEORBIT'});
    if(plan.kind==='OBSERVE') {
     const rad=hours?.kind==='INSTRUMENT_HOURS', reserveDuty=!rad||game.config.approach!=='CAUTIOUS'||Math.floor(s.elapsed/600)%4!==3;
     const observing=reserveDuty&&(!rad||s.elapsed>=hours.windowStartSec)&&s.storedMB<s.storageMB*.85&&s.socWh>s.capacityWh*(game.config.approach==='CAUTIOUS'?.6:game.config.approach==='FAST'?.2:.4);
     active(observing,observing&&!rad&&s.sunlit?'TARGET':'SUN');
    } else if(plan.kind==='TRANSMIT') {
     active(false,'EARTH');
     if(s.inContact&&s.storedMB>0&&!s.downlinkRequested)request({kind:'DOWNLINK',on:true});
     if(s.design.levelId==='EXPERT'&&s.linkMode!==(s.linkQuality<1?'ROBUST':'NORMAL'))request({kind:'LINK_MODE',mode:s.linkQuality<1?'ROBUST':'NORMAL'});
    } else if(plan.kind!=='RECOVER')active(false,'SUN');
   }
   s=flight(state);
   const remaining=Math.max(0,end-s.t-s.remainderSec);
   if(remaining<=1e-7&&s.pendingEvents.length===0)break;
   const result=stepSim(state,Math.min(60,remaining));
   const oldT=state.t;state=result.state;events.push(...result.events);s=flight(state);
   progressed ||= s.t>start;
   const hazard=result.events.find(e=>HAZARDS[e.kind]);
   if(hazard) {interrupted=true;boundary='HAZARD';break;}
   if(s.ended) {boundary='TERMINAL';break;}
   if(plan.kind==='LAUNCH'&&!ascentActive(s))break;
   if(plan.kind==='MANEUVER'&&s.traj.receipts.length>startingReceipts)break;
   if(plan.kind==='MANEUVER'&&result.events.some(e=>e.kind==='SOI_ENTRY'||e.kind==='SOI_EXIT')) {boundary='OPPORTUNITY';break;}
   if(plan.kind==='CAPTURE'&&!s.capturePending)break;
   if(plan.kind==='RECOVER'&&progressed&&!needsRecovery(s))break;
   if(plan.kind==='RECHARGE'&&s.socWh>=s.capacityWh*.9&&s.t-start>=600)break;
   if(plan.kind==='OBSERVE') {
    if(product?.kind==='DELIVERED_PRODUCT'&&s.missionStoredMB-startStored>=Math.max(1,Math.min(required*batch,s.storageMB*.65)))break;
    if(hours?.kind==='INSTRUMENT_HOURS'&&s.radiationHours-startHours>=Math.min(6,Math.max(.5,hours.targetHours-startHours)))break;
   }
   if(plan.kind==='TRANSMIT'&&(s.missionDownlinkedMB>startDelivered&&s.storedMB<=1e-6||allRequiredMet(s)))break;
   if(plan.kind==='COAST'&&result.events.some(e=>['SOI_ENTRY','SOI_EXIT','ENCOUNTER_CLOSEST','OBJECTIVE_MET'].includes(e.kind)))break;
   if(s.t===oldT&&result.events.length===0&&remaining>0&&s.remainderSec===0)throw new RangeError('Turn has no physical continuation');
   if(guard===MAX_TURN_POLICY_STEPS-1)throw new RangeError('Turn resolution exceeded bounded work');
  }
 }
 const after=flight(state); after.remainderSec=0;
 // A plan boundary disarms any unexecuted ignition. Continuing a hazardous
 // maneuver requires a fresh commitment; recharge/coast cannot silently fire it.
 if(after.traj.burns.length){after.traj.burnCount-=after.traj.burns.length;after.traj.burns=[];}
 if(after.t===before.t&&!after.ended&&events.length===0)throw new RangeError('Turn did not reach a new decision');
 const t=telemetry(state), revision=game.revision+1;
 const receipt:TurnReceipt={id:`${game.identity.slice(7,23)}:${revision}`,decisionId:turnDecision(game).id,planId:plan.id,revision,elapsedSec:after.t-before.t,boundary,interrupted,summary:interrupted?'PLAN_INTERRUPTED':after.ended?t.outcome==='SUCCESS'?'MISSION_SUCCEEDED':'MISSION_FAILED':`${plan.kind}_RESOLVED`,events,delta:{fuelKg:fuelInventory(after)-fuelInventory(before),energyWh:after.socWh-before.socWh,storedMB:after.storedMB-before.storedMB,deliveredMB:after.missionDownlinkedMB-before.missionDownlinkedMB},evidence:t.evidence,outcome:t.outcome};
 return {state:{...game,sim:state,revision,receipts:[...game.receipts,receipt]},receipt,telemetry:t};
}
export function previewTurn(game: TurnGameState,planId:string):TurnResult {
 try {
  const d=turnDecision(game),plan=d.plans.find(p=>p.id===planId);
  if(!plan)return {ok:false,code:'INVALID_PLAN',message:'Plan is not allowed at this decision'};
  if(game.revision>=MAX_GAME_TURNS&&plan.kind!=='ABORT')return {ok:false,code:'RESOLUTION_ERROR',message:'Attempt reached the bounded turn limit; end or export this attempt'};
  return {ok:true,value:resolve(game,plan)};
 }catch(error){return {ok:false,code:'RESOLUTION_ERROR',message:error instanceof Error?error.message:String(error)};}
}
export function commitTurn(game:TurnGameState,request:TurnCommitRequest):TurnResult {
 if(!request||typeof request.idempotencyKey!=='string'||request.idempotencyKey.length<1||request.idempotencyKey.length>128||!Number.isInteger(request.baseRevision))return {ok:false,code:'INVALID_REQUEST',message:'Malformed turn commitment'};
 const previous=game.commits.find(c=>c.key===request.idempotencyKey);
 if(previous) {
  if(previous.decisionId!==request.decisionId||previous.planId!==request.planId||previous.revision!==request.baseRevision+1)return {ok:false,code:'DUPLICATE_KEY',message:'Idempotency key belongs to another commitment'};
  const receipt=game.receipts.find(r=>r.revision===previous.revision)!;
  return {ok:true,value:{state:game,receipt,telemetry:telemetry(game.sim)}};
 }
 let d:TurnDecision;try{d=turnDecision(game);}catch(error){return {ok:false,code:'INVALID_REQUEST',message:String(error)};}
 if(request.baseRevision!==game.revision||request.decisionId!==d.id)return {ok:false,code:'STALE_DECISION',message:'The decision has changed; review the current plans'};
 const result=previewTurn(game,request.planId); if(!result.ok)return result;
 return {ok:true,value:{...result.value,state:{...result.value.state,commits:[...game.commits,{key:request.idempotencyKey,decisionId:request.decisionId,planId:request.planId,revision:result.value.state.revision}]}}};
}
const certificates=new Map<string,ReadinessCertificate>();
export function certifyQuickDesign(config:QuickDesignConfig):ReadinessCertificate {
 const b=quickDesignBrief(config),cached=certificates.get(b.identity);if(cached)return cached;
 let state:TurnGameState|undefined,reason='REFERENCE_FAILED';const witness:string[]=[];
 if(!b.blockers.length) {
  try {
   state=initialGame(config);
   for(let n=0;n<MAX_GAME_TURNS&&!flight(state.sim).ended;n++) {
    const d=turnDecision(state),s=flight(state.sim), product=s.design.definition.objectives.find(o=>o.spec.kind==='DELIVERED_PRODUCT')?.spec;
    const target=product?.kind==='DELIVERED_PRODUCT'?product.targetMB:0;
    const choice=d.plans.find(p=>p.kind==='FINISH')??d.plans.find(p=>p.kind==='RECOVER')??d.plans.find(p=>p.kind==='LAUNCH'||p.kind==='CAPTURE'||p.kind==='RETURN')??d.plans.find(p=>p.kind==='MANEUVER')??d.plans.find(p=>p.kind==='TRANSMIT'&&(s.missionStoredMB+s.missionDownlinkedMB>=target&&target>0||s.storedMB>s.storageMB*.65))??d.plans.find(p=>p.kind==='RECHARGE'&&s.socWh<s.capacityWh*.4)??d.plans.find(p=>p.kind==='OBSERVE')??d.plans.find(p=>p.kind==='COAST')??d.plans.find(p=>p.kind==='ABORT');
    if(!choice)break;
    const r=previewTurn(state,choice.id);if(!r.ok){reason='WORK_LIMIT';break;}
    witness.push(choice.id);state=r.value.state;
   }
  }catch{reason='REFERENCE_FAILED';}
 }
 if(state&&!flight(state.sim).ended&&witness.length===MAX_GAME_TURNS)reason='WORK_LIMIT';
 const s=state?flight(state.sim):null,t=s?telemetry(s):null,success=t?.outcome==='SUCCESS';
 const margins={fuelKg:s?fuelInventory(s):0,energyWh:s?s.socWh:0,deadlineSec:s?Math.max(0,s.design.definition.environment.durationSec-s.elapsed):0};
 const reasons:string[]=[...b.reasons];
 if(success){reasons.push('NOMINAL_REFERENCE_SUCCESS');if(s&&s.socWh<s.capacityWh*.3)reasons.push('ENERGY_TIGHT');if(b.budgets.deltaV&&margins.fuelKg<1)reasons.push('FUEL_TIGHT');if(margins.deadlineSec<b.deadlineSec*.1)reasons.push('DEADLINE_TIGHT');}else reasons.push(reason,...b.blockers.map(r=>r.code));
 const result:ReadinessCertificate=deepFreeze({identity:b.identity,rulesVersion:RULES_VERSION,modelVersion:FLIGHT_MODEL_VERSION,policyVersion:TURN_POLICY_VERSION,status:b.blockers.length?b.compatible?'OVER_LIMITS':'INCOMPATIBLE':success?reasons.some(r=>r.endsWith('_TIGHT'))?'STRETCHED':'READY':'NO_VIABLE_PLAN',reasons,witness,outcome:t?.outcome??'INCOMPLETE',margins,turns:witness.length});
 if(certificates.size>=128)certificates.delete(certificates.keys().next().value!);certificates.set(b.identity,result);return result;
}
export function createTurnGame(config:QuickDesignConfig,certificate?:ReadinessCertificate):TurnGameState {
 const b=quickDesignBrief(config);
 if(certificate&&certificate.identity!==b.identity)throw new RangeError('Readiness proof belongs to a different design');
 // Never trust a caller-supplied green badge: only the actual reference policy certifies play.
 const proof=certifyQuickDesign(config);
 if(proof.status!=='READY'&&proof.status!=='STRETCHED')throw new RangeError(`No certified reference success: ${proof.reasons.join(',')}`);
 return initialGame(config);
}
export function retryTurnGame(game:TurnGameState,checkpoint?:TurnGameState):TurnGameState {
 assertGame(game);
 if(!checkpoint)return initialGame(game.config);
 assertGame(checkpoint);
 if(game.config.levelId!=='ASPIRING'||checkpoint.identity!==game.identity||checkpoint.revision>game.revision)throw new RangeError('Checkpoint retry requires an earlier matching Aspiring decision');
 return {...checkpoint,sim:markPracticeRetry(checkpoint.sim),assisted:true,rewinds:[...checkpoint.rewinds,checkpoint.revision]};
}
export function turnDebrief(game:TurnGameState):TurnDebrief {
 assertGame(game);const s=flight(game.sim),t=telemetry(s);
 return {outcome:t.outcome,evidence:t.evidence,receipts:game.receipts,discoveries:t.evidence.filter(e=>e.state==='MET').map(e=>`${game.identity}:${e.id}`),cause:s.firstFailure?.causeKey??(s.sessionEnded?'SESSION_ENDED':null),advice:s.firstFailure?.advice??[],assisted:game.assisted,identity:game.identity,elapsedSec:s.t};
}
export function restoreTurnGame(value:unknown):TurnGameState {
 if(!value||typeof value!=='object')throw new RangeError('Not a turn save');
 const saved=value as TurnGameState;assertGame(saved);
 if(!Array.isArray(saved.commits)||!Array.isArray(saved.receipts)||!Array.isArray(saved.rewinds)||saved.rewinds.length>MAX_GAME_TURNS||saved.rewinds.some((r,i)=>!Number.isInteger(r)||r<0||r>saved.revision||i>0&&r<saved.rewinds[i-1])||saved.commits.length!==saved.revision||saved.receipts.length!==saved.revision)throw new RangeError('Save has incomplete committed history');
 let replay=initialGame(saved.config);
 if(replay.identity!==saved.identity)throw new RangeError('Saved definition/configuration identity differs from these rules');
 let rewindIndex=0;
 const applyRewinds=()=>{
  while(saved.rewinds[rewindIndex]===replay.revision){
   if(saved.config.levelId!=='ASPIRING')throw new RangeError('Expert checkpoint saves cannot be assisted');
   replay={...replay,sim:markPracticeRetry(replay.sim),assisted:true,rewinds:[...replay.rewinds,replay.revision]};rewindIndex++;
  }
 };
 applyRewinds();
 for(const c of saved.commits) {
  if(!c||typeof c.key!=='string')throw new RangeError('Invalid saved commitment');
  const r=commitTurn(replay,{decisionId:c.decisionId,baseRevision:c.revision-1,planId:c.planId,idempotencyKey:c.key});
  if(!r.ok)throw new RangeError(`Saved commitment cannot replay: ${r.code}`);replay=r.value.state;
  applyRewinds();
 }
 if(canonicalJson(replay)!==canonicalJson(saved))throw new RangeError('Saved state does not match its deterministic committed history');
 return replay;
}
