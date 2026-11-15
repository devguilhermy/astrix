import { beforeEach, expect, test } from 'bun:test';
import { createSim, telemetry, quoteAddPart, type JourneyStage } from '@astrix/core';
import { STAGES, useMission, type MissionStore } from '../../store';
import { canVisitStage, primaryAction } from './missionControlModel';

beforeEach(()=>{useMission.getState().resetMission();useMission.getState().setTeam(1);useMission.getState().startMission('FIRST_LIGHT','ASPIRING');});
test('one primary reveals the actual blocker, then becomes Continue without changing state',()=>{
 const s=useMission.getState(),before=JSON.stringify(s.artifacts);
 expect(primaryAction(s).kind).toBe('guide');expect(primaryAction(s).step?.target).toBe('objective');expect(JSON.stringify(s.artifacts)).toBe(before);
 s.updateArtifacts({objectiveConfirmed:true});expect(primaryAction(useMission.getState()).kind).toBe('continue');
});
test('chapter and stage affordances never bypass existing mission gates',()=>{
 const s=useMission.getState();
 for(const stage of STAGES)expect(canVisitStage(s,stage,STAGES)).toBe(stage==='NEED_GOALS');
 s.updateArtifacts({objectiveConfirmed:true});s.completeStage();
 expect(canVisitStage(useMission.getState(),'NEED_GOALS',STAGES)).toBe(true);
 expect(canVisitStage(useMission.getState(),'DESIGN',STAGES)).toBe(false);
});
test('missing First Light camera remains the primary guided task during Build',()=>{
 const s=useMission.getState();s.updateArtifacts({objectiveConfirmed:true});for(let i=0;i<3;i++)s.completeStage();
 const action=primaryAction(useMission.getState());expect(action.kind).toBe('guide');expect(action.step?.id).toBe('SCI-PAYLOAD-01');
});
function flightState():MissionStore {
 const state=useMission.getState(),quote=quoteAddPart(state.design!,'CAM_EO','ALL');if(!quote.ok)throw new Error(quote.code);
 const sim=createSim(quote.value.next,42);
 return {...state,design:quote.value.next,sim,telemetry:telemetry(sim),activeStage:'IMPLEMENT',pauseReasons:[],pendingDecisions:[],running:false,advancing:false};
}
test('flight primary preserves pause, event advance, capture, cruise and cancel meanings',()=>{
 const s=flightState();expect(primaryAction(s).kind).toBe('advance');
 expect(primaryAction({...s,running:true}).kind).toBe('pause');expect(primaryAction({...s,advancing:true}).kind).toBe('cancel');
 expect(primaryAction({...s,levelId:'EXPERT'}).kind).toBe('resume');
 expect(primaryAction({...s,telemetry:{...s.telemetry!,capturePending:true}}).kind).toBe('capture');
 expect(primaryAction({...s,telemetry:{...s.telemetry!,cruise:true}}).kind).toBe('arrival');
 expect(primaryAction({...s,pauseReasons:['explanation']}).blocked).toBe(true);
 expect(primaryAction({...s,pauseReasons:['self-paced']}).blocked).toBe(false);
});
test('flight navigation is read-only except Implement and terminal Review',()=>{
 const s=flightState();
 for(const stage of STAGES)expect(canVisitStage(s,stage,STAGES)).toBe(stage==='IMPLEMENT');
 const ended={...s,telemetry:{...s.telemetry!,ended:true}};
 expect(canVisitStage(ended,'REVIEW',STAGES)).toBe(true);expect(primaryAction(ended).kind).toBe('review');
 expect(canVisitStage(ended,'DESIGN' as JourneyStage,STAGES)).toBe(false);
});
