import { expect, test } from 'bun:test';
import { createStarterDesign,createMissionArtifacts,quoteAddPart,computeBudgets,missionRequirements,designSnapshot,evaluateCues,createSim,endMission,telemetry as readTelemetry,type RoleId } from '@astrix/core';
import { nextSteps,type GuideContext } from './nextSteps';
const signoffs:Record<RoleId,boolean>={SCIENCE:false,SPACECRAFT:false,LAUNCH_ORBIT:false,GROUND_COMMS:false};
function context():GuideContext {const design=createStarterDesign('FIRST_LIGHT','ASPIRING');return {design,artifacts:createMissionArtifacts(design),stage:'DESIGN',signoffs,cues:[],sim:null,telemetry:null,decisions:[]};}
test('First Light missing camera outranks severity three and ritual blockers',()=>{
 const c=context();c.cues=[{id:'urgent',ruleId:'POWER_NEGATIVE',severity:3,category:'alert',role:'SPACECRAFT',params:{},firstRaisedSec:0}];
 const steps=nextSteps(c);expect(steps[0].id).toBe('SCI-PAYLOAD-01');expect(steps[0].owner).toBe('SCIENCE');expect(steps[0].sceneTarget).toBe('INSTRUMENT');expect(steps.findIndex(step=>step.id==='urgent')).toBeLessThan(steps.findIndex(step=>step.id==='TRADE'));
});
test('completion follows core state changes, never a cue request or resolver call',()=>{
 const c=context(),before=JSON.stringify(c),first=nextSteps(c)[0];expect(nextSteps(c)[0].id).toBe(first.id);expect(JSON.stringify(c)).toBe(before);
 const quote=quoteAddPart(c.design,'CAM_EO','ALL');if(!quote.ok)throw new Error(quote.code);
 const changed={...c,design:quote.value.next};expect(first.done(changed)).toBe(true);expect(nextSteps(changed).some(step=>step.id==='SCI-PAYLOAD-01')).toBe(false);
});
test('briefing guides only its authoritative stage blocker',()=>{
 const c={...context(),stage:'NEED_GOALS' as const};expect(nextSteps(c).map(step=>step.id)).toEqual(['OBJECTIVE']);expect(nextSteps({...c,artifacts:{...c.artifacts,objectiveConfirmed:true}})).toEqual([]);
});
test('role ownership survives stage sign-off blockers and ordering is deterministic',()=>{
 const c=context();c.stage='BUILD_VERIFY';expect(nextSteps(c).map(({done,...step})=>step)).toEqual(nextSteps(c).map(({done,...step})=>step));const sign=nextSteps(c).find(step=>step.id.startsWith('SIGNOFF_BLOCKED'));expect(sign?.owner).not.toBe('ALL');
});

test('completed briefing defers real design-improvement cues until Build is actionable',()=>{
 const c=context();
 const cues=evaluateCues({lastRaised:{},clearPending:{},active:[]},{...designSnapshot(c.design),phase:'LAUNCH_ORBIT'},0).active;
 expect(cues.some(cue=>cue.ruleId==='OBJECTIVE_UNREACHABLE')).toBe(true);
 const confirmed={...c,artifacts:{...c.artifacts,objectiveConfirmed:true},cues};
 for(const stage of ['NEED_GOALS','CONCEPT','REQUIREMENTS'] as const) {
  expect(nextSteps({...confirmed,stage})).toEqual([]);
 }
 const build=nextSteps({...confirmed,stage:'DESIGN'});
 expect(build[0].id).toBe('SCI-PAYLOAD-01');
 expect(build.some(step=>cues.some(cue=>cue.id===step.id&&cue.ruleId==='OBJECTIVE_UNREACHABLE'))).toBe(true);
});

test('First Light camera-only return shortfall guides the radio bottleneck, not more instruments',()=>{
 const c=context(),before=computeBudgets(c.design),camera=quoteAddPart(c.design,'CAM_EO','ALL');
 if(!camera.ok)throw new Error(camera.code);
 const design=camera.value.next,budgets=computeBudgets(design);
 expect(missionRequirements(design).find(requirement=>requirement.id==='SCI-PAYLOAD-01')?.result).toBe('PASS');
 if(!budgets.data)throw new Error('Expected core data forecast for an installed camera');
 expect(budgets.data.downMBPerDay).toBeLessThan(budgets.data.genMBPerDay);
 const cues=evaluateCues({lastRaised:{},clearPending:{},active:[]},{...designSnapshot(design),phase:'LAUNCH_ORBIT'},design.revision).active;
 const unreachable=cues.find(cue=>cue.ruleId==='OBJECTIVE_UNREACHABLE');
 expect(unreachable).toBeDefined();
 const artifacts={...c.artifacts,objectiveConfirmed:true,trade:{revision:c.design.revision,description:'CAM_EO',before,after:budgets,actor:'ALL' as const},baselineRevision:design.revision};
 const step=nextSteps({...c,design,artifacts,cues}).find(step=>step.id===unreachable?.id);
 expect(step?.section).toBe('RADIO');
 expect(step?.sceneTarget).toBe('RADIO');
});

test('terminal flights replace stale operational cues with debrief, replay and redesign actions',()=>{
 const c=context(),camera=quoteAddPart(c.design,'CAM_EO','ALL');
 if(!camera.ok)throw new Error(camera.code);
 const design=camera.value.next,sim=endMission(createSim(design,1)),telemetry=readTelemetry(sim);
 expect(telemetry.ended).toBe(true);
 const cues:GuideContext['cues']=[{id:'old-storage-warning',ruleId:'STORAGE_FILLING',severity:2,category:'alert',role:'SCIENCE',params:{storedMB:telemetry.storageMB,storageMB:telemetry.storageMB},firstRaisedSec:0}];
 const terminal={...c,design,sim,telemetry,cues},before=JSON.stringify(sim);
 expect(nextSteps({...terminal,stage:'IMPLEMENT'}).map(step=>step.target)).toEqual(['primary']);
 const debrief=nextSteps({...terminal,stage:'REVIEW'});
 expect(debrief.map(step=>step.target)).toEqual(['replay','redesign']);
 expect(debrief.some(step=>step.id==='old-storage-warning')).toBe(false);
 expect(JSON.stringify(sim)).toBe(before);
});
