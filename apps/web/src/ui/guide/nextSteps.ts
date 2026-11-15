import { computeBudgets, evaluateJourneyStage, missionRequirements, listParts, type ActiveCue, type Design, type JourneyStage, type MissionArtifacts, type RoleId, type SimEvent, type SimState, type Telemetry } from '@astrix/core';
import type { PanelId } from '../layout/panelLayout';
import { startsOnSurface } from '../missions/definitionView';

export interface GuideContext {
 design: Design; artifacts: MissionArtifacts; stage: JourneyStage;
 signoffs: Readonly<Record<RoleId, boolean>>; cues: readonly ActiveCue[];
 sim: SimState | null; telemetry: Telemetry | null; decisions: readonly SimEvent[];
}
export interface NextStep {
 id: string; owner: RoleId | 'ALL'; titleKey: string; hintKey: string;
 target: string; panel?: PanelId; section?: string; sceneTarget?: string;
 values?: Readonly<Record<string, string | number>>;
 done(context: GuideContext): boolean;
}
const requirementTargets: Record<string, [string, string]> = {
 'SCI-PAYLOAD-01': ['parts', 'INSTRUMENT'], 'LAUNCH-MASS-01': ['parts', 'COMPUTER'],
 'POWER-ECLIPSE-01': ['parts', 'BATTERY'], 'GROUND-RADIO-01': ['parts', 'RADIO'],
};
const cueSection:Record<string,string>={POWER_NEGATIVE:'SOLAR',POWER_MARGIN_LOW:'SOLAR',BATTERY_ECLIPSE_SHORT:'BATTERY',NO_RADIO:'RADIO',DATA_BACKLOG:'RADIO',POINTING_NEEDS_ADCS:'ADCS',MASS_MARGIN_LOW:'COMPUTER'};
const blockerOwner: Record<string, RoleId | 'ALL'> = { OBJECTIVE: 'SCIENCE', SEGMENTS: 'ALL', REQUIREMENTS: 'SCIENCE', TRADE: 'ALL', BASELINE: 'SPACECRAFT', VERIFY: 'ALL', ROLE_LOCKED: 'LAUNCH_ORBIT' };
export function journeySteps(context: GuideContext): NextStep[] {
 const { design, artifacts, stage, sim, telemetry, cues } = context;
 const designStage = stage==='DESIGN'||stage==='BUILD_VERIFY'||stage==='IMPLEMENT';
 const steps: NextStep[] = [];
 const add = (step: Omit<NextStep, 'hintKey'> & {hintKey?: string}) => steps.push({ hintKey: 'hud.guide.hint', ...step });
 if (telemetry?.ended) {
  if(stage!=='REVIEW')add({id:'open-debrief',owner:'ALL',titleKey:'hud.guide.debrief',target:'primary',done:c=>c.stage==='REVIEW'});
  else {
   add({id:'replay-flight',owner:'ALL',titleKey:'flow.replayHistory',target:'replay',panel:'mission',done:c=>c.stage!=='REVIEW'});
   add({id:'redesign-flight',owner:'ALL',titleKey:'flow.redesign',target:'redesign',panel:'mission',done:c=>!c.sim});
  }
  return steps;
 }
 if (sim && telemetry) {
  if (context.decisions[0]) add({id:'decision',owner:'ALL',titleKey:`event.${context.decisions[0].kind}.title`,target:'decision',values:context.decisions[0].values,done:c=>!c.decisions.length});
  for (const cue of cues.filter(c=>c.severity>=2||['PASS_SOON_DOWNLINK_OFF','STORM_EXPOSED'].includes(c.ruleId))) add({id:cue.id,owner:cue.role,titleKey:`cue.${cue.ruleId}.title`,hintKey:`cue.${cue.ruleId}.body`,values:cue.params,target:cue.ruleId==='STORM_EXPOSED'?'science-return':'hotbar',panel:cue.ruleId==='STORM_EXPOSED'?'mission':undefined,done:c=>!c.cues.some(item=>item.id===cue.id)});
  for (const system of ['wings','antenna'] as const) if (telemetry.deployment[system] !== 'NOT_APPLICABLE') add({id:`deploy-${system}`,owner:'SPACECRAFT',titleKey:'hud.guide.deploy',target:'hotbar',values:{system},done:c=>c.telemetry?.deployment[system]==='DEPLOYED'});
  if (!telemetry.cruise) {
   add({id:'observe',owner:'SCIENCE',titleKey:'hud.guide.observe',target:'science-return',panel:'mission',done:c=>!!c.telemetry?.instruments.some(i=>i.on&&!i.lost)});
   add({id:'downlink',owner:'GROUND_COMMS',titleKey:'hud.guide.downlink',hintKey:'hud.guide.downlinkHint',target:'hotbar',done:c=>(c.telemetry?.downlinkedMB??0)>0});
  }
  add({id:'objective-progress',owner:'ALL',titleKey:'hud.guide.objective',target:'timeline',done:c=>(c.telemetry?.objective.value??0)>=(c.telemetry?.objective.target??Infinity)});
  return steps;
 }
 if(stage==='NEED_GOALS')add({id:'OBJECTIVE',owner:'SCIENCE',titleKey:'hud.guide.blocker.OBJECTIVE',target:'objective',panel:'mission',done:c=>c.artifacts.objectiveConfirmed});
 if(stage==='CONCEPT')add({id:'SEGMENTS',owner:'ALL',titleKey:'hud.guide.blocker.SEGMENTS',target:'segments',panel:'mission',done:c=>Object.values(c.artifacts.segments).every(Boolean)&&!!c.design.rideId&&!!c.design.stationId});
 if (designStage) {
  const requirements=missionRequirements(design);
  // Payload comes first: a starter without its mission instrument is never silently passed on.
  for (const id of ['SCI-PAYLOAD-01','LAUNCH-MASS-01','POWER-ECLIPSE-01','GROUND-RADIO-01']) {
   const r=requirements.find(item=>item.id===id)!;
   const [target,section]=requirementTargets[id];
   const part=id==='SCI-PAYLOAD-01'?listParts(design.busId).find(p=>p.id===r.target):undefined;
   add({id,owner:r.owner,titleKey:id==='SCI-PAYLOAD-01'&&part?.metric==='IMAGES'?'hud.guide.camera':`hud.guide.${id}`,target:part?`part-${part.id}`:target,panel:'mission',section,sceneTarget:id==='SCI-PAYLOAD-01'?'INSTRUMENT':section,done:c=>missionRequirements(c.design).find(item=>item.id===id)?.result==='PASS'});
  }
  for (const cue of cues.filter(c=>c.severity===3)) add({id:cue.id,owner:cue.role,titleKey:`cue.${cue.ruleId}.title`,hintKey:`cue.${cue.ruleId}.body`,values:cue.params,target:cue.ruleId==='DV_SHORT'?'fuel-planner':'parts',panel:'mission',section:cue.ruleId==='DV_SHORT'?'orbit':cueSection[cue.ruleId],sceneTarget:cueSection[cue.ruleId],done:c=>!c.cues.some(item=>item.id===cue.id)});
 }
 for (const blocker of evaluateJourneyStage(design,artifacts,stage,context.signoffs,sim).filter((item,index,all)=>all.findIndex(other=>other.id===item.id&&JSON.stringify(other.values)===JSON.stringify(item.values))===index)) {
  if(steps.some(step=>step.id===blocker.id))continue;
  const target=blocker.id==='TRADE'?'parts':blocker.id==='VERIFY'||blocker.target==='readiness'?'verification':blocker.target;
  add({id:blocker.values.role?`${blocker.id}:${blocker.values.role}`:blocker.id,owner:typeof blocker.values.role==='string'&&['SCIENCE','SPACECRAFT','LAUNCH_ORBIT','GROUND_COMMS'].includes(blocker.values.role)?blocker.values.role as RoleId:blockerOwner[blocker.id]??'ALL',titleKey:`hud.guide.blocker.${blocker.id}`,hintKey:blocker.messageKey,target,panel:'mission',values:blocker.values,done:c=>!evaluateJourneyStage(c.design,c.artifacts,c.stage,c.signoffs,c.sim).some(b=>b.id===blocker.id&&JSON.stringify(b.values)===JSON.stringify(blocker.values))});
 }
 if (stage==='DESIGN') add(startsOnSurface(design.definition)?{id:'launch-plan',owner:'LAUNCH_ORBIT',titleKey:'hud.guide.launchPlan',target:'orbit',panel:'mission',section:'orbit',done:c=>c.design.launch!==null}:{id:'orbit-choice',owner:'LAUNCH_ORBIT',titleKey:'hud.guide.orbit',target:'orbit',panel:'mission',section:'orbit',done:c=>c.design.orbit!==null});
 if (designStage) {
  let objectiveSection='INSTRUMENT';
  if(cues.some(cue=>cue.ruleId==='OBJECTIVE_UNREACHABLE')) {
   const budgets=computeBudgets(design);
   const payloadInstalled=missionRequirements(design).some(requirement=>requirement.id==='SCI-PAYLOAD-01'&&requirement.result==='PASS');
   if(payloadInstalled&&budgets.data&&budgets.data.downMBPerDay<budgets.data.genMBPerDay)objectiveSection='RADIO';
  }
  for (const cue of cues.filter(c=>c.severity===2)) {
   const section=cue.ruleId==='OBJECTIVE_UNREACHABLE'?objectiveSection:cueSection[cue.ruleId];
   add({id:cue.id,owner:cue.role,titleKey:`cue.${cue.ruleId}.title`,hintKey:`cue.${cue.ruleId}.body`,values:cue.params,target:cue.ruleId==='DV_SHORT'?'fuel-planner':'parts',panel:'mission',section:cue.ruleId==='DV_SHORT'?'orbit':section,sceneTarget:section,done:c=>!c.cues.some(item=>item.id===cue.id)});
  }
 }
 return steps;
}
export function nextSteps(context: GuideContext): NextStep[] { return journeySteps(context).filter(step=>!step.done(context)); }
