import { attemptAudit, history, historyInfo, scoreMission } from '@astrix/core';
import type { SimState } from '@astrix/core';
import type { HistoryPage, SessionSnapshot, SessionState, SnapshotViewer } from './contracts';
// Explicit core projection: never spread authority/session objects onto the wire.
const FLIGHT_FIELDS = ['version','attitude','t','design','assisted','remainderSec','elapsed','arrivalT','cruise','capturePending','captured','ended','epochUTC','mars','flightHistory','objectives','centralBody','earthPosKm','velocityKms','finePointing','capacityWh','nominalCapacityWh','arrayFactor','batteryFactor','capacityLostWh','capacityClampNotified','socWh','genW','loadW','ratedSolarW','baseLoadW','mode','safe','downlinkRequested','downlinkActive','storedMB','missionStoredMB','storageMB','downlinkedMB','missionDownlinkedMB','dataLostMB','radiationHours','positionKm','sunDir','stationPosKm','sunlit','inContact','lineOfSight','stationAvailable','doseUGyH','instruments','propellantKg','dryMassKg','ispSec','captureRequiredKms','captureNominalKms','capturePlanningKms','captureUncertainty','captureAvailableKms','stormActive','stormStarted','stormEnded','agingAt','aged','outageAt','outageStarted','outageActive','firstPassSeen','lowLatched','emptyLatched','storageLatched','depletedSec','healthySec','marginBadSec','temperatureK','heaterMode','heaterOn','ratedHeaterW','heaterW','externalHeatW','internalHeatW','radiatedW','thermalTrend','thermalBadSec','thermalSurvivalSec','thermalInhibited','pointing','pointingReadyAt','pointingFaultAt','pointingFaultSeen','linkMode','linkQuality','linkDegradeAt','linkRestoreAt','linkDegradeSeen','linkRestoreSeen','computerState','resetAt','resetSeen','commandEpochStartedAt','cooldownUntil','bootReadyAt','resets','recoveries','interventionEnergyWh','firstFailure','nextPassSec','nextPassAt','nextPassCheckedAt','launchMassKg','sessionEnded'] as const;
function publicSim(state:SessionState):SimState|null {
 if(!state.sim)return null;
 const sim:SimState={t:state.sim.t},fields:Record<string,unknown>={};
 for(const key of FLIGHT_FIELDS)fields[key]=state.sim[key];
 const info=historyInfo(state.sim),samples=history(state.sim),stride=Math.max(1,Math.ceil(samples.length/128));
 const bounded=samples.filter((_,i)=>i%stride===0).slice(0,127);if(samples.length&&bounded.at(-1)!==samples.at(-1))bounded.push(samples.at(-1)!);
 const audit=attemptAudit(state.sim);
 const crew=state.sim.crew;
 const publicCrew=typeof crew==='object'&&crew!==null&&!Array.isArray(crew)?Object.fromEntries(Object.entries(crew).map(([key,value])=>[key,key==='pressureSamples'&&Array.isArray(value)?value.slice(-64):value])):null;
 // The prediction cache is derivable and unbounded in principle; events and receipts are bounded rings on the wire.
 const traj=state.sim.traj as {pred:unknown;events:unknown[];receipts:unknown[]}|undefined;
 const publicTraj=traj?{...traj,pred:null,events:traj.events.slice(-64),receipts:traj.receipts.slice(-64)}:null;
 return structuredClone({...sim,...fields,traj:publicTraj,seed:state.sim.seed,crew:publicCrew,queue:state.telemetry?.commandQueue.slice(-192)??[],samples:bounded,sampleHead:0,historyDecimated:info.decimated||samples.length>128,historyIntervalSec:info.intervalSec,audit:audit.entries.slice(-64),auditDecimated:audit.decimated||audit.entries.length>64,pendingEvents:Array.isArray(state.sim.pendingEvents)?state.sim.pendingEvents.slice(-32):[]});
}
export function toPublicSnapshot(s:SessionState,_viewer:SnapshotViewer={}):SessionSnapshot {
 return structuredClone({protocol:4 as const,game:s.game,turnProposals:s.turnProposals,epoch:s.epoch,seq:s.seq,rosterRevision:s.rosterRevision,mode:s.mode,participantMode:s.participantMode,seats:s.seats,roster:s.roster,approvals:s.approvals,missionId:s.missionId,definition:s.definition,authorPlayerId:s.authorPlayerId,levelId:s.levelId,attemptId:s.attemptId,artifacts:s.artifacts,activeStage:s.activeStage,furthestStage:s.furthestStage,activeSubstep:s.activeSubstep,activeView:s.activeView,players:s.players,facilitator:s.facilitator,signoffs:s.signoffs,team:s.team,design:s.design,budgets:s.budgets,cues:s.cues,designNotes:s.designNotes.slice(-100),rosterHistory:s.rosterHistory.slice(-100),acceptedTrades:s.acceptedTrades.slice(-100),sim:publicSim(s),telemetry:s.telemetry?{...s.telemetry,commandQueue:s.telemetry.commandQueue.slice(-192)}:null,running:s.running,warp:s.warp,historyVersion:s.historyVersion,events:s.events.slice(-100),pendingDecisions:s.pendingDecisions.slice(-32),decisions:s.decisions.slice(-32),pauseReasons:s.pauseReasons,pauseOwners:s.pauseOwners,pauseRoles:s.pauseRoles,advancing:s.advancing,advanceMessage:s.advanceMessage,practiceCheckpoints:s.practiceCheckpoints.map(({id,name,time})=>({id,name,time})),assisted:s.assisted,review:s.sim&&s.design?scoreMission(s.sim,s.design,s.team):null});
}
/** Cursor includes attempt identity: a rewind can never page into the abandoned branch. */
export function selectHistoryPage(state:SessionState,cursor:string|null=null):HistoryPage {
 let offset=0;if(cursor!==null){const match=/^(\d+):(\d+)$/.exec(cursor);if(!match||Number(match[1])!==state.attemptId)return {entries:[],cursor:null,attemptId:state.attemptId,epoch:state.epoch};offset=Number(match[2]);if(!Number.isSafeInteger(offset))offset=0;}
 const samples=state.sim?history(state.sim):[],entries=samples.slice(offset,offset+128),next=offset+entries.length;
 return {entries:structuredClone(entries),cursor:next<samples.length?`${state.attemptId}:${next}`:null,attemptId:state.attemptId,epoch:state.epoch};
}
