// Tour infrastructure adapted from Void Protocol at pin 218625d; mission controls/content are original.
import type { JourneyStage } from '@astrix/core';
import type { MissionStore } from '../../store';
import type { PanelId } from '../layout/panelLayout';
import type { ControlTray } from '../guide/missionControlState';

export type TourId='welcome'|'build'|'launch'|'flight'|'debrief'|'choice';
/** Whole-product cap on the automatic first-mission curriculum, and the cap for any single rendered tour. */
export const CURRICULUM_LIMIT=15;
export const MAX_TOUR_CARDS=15;
export const CURRICULUM_TOURS=['welcome','build','launch','flight','debrief'] as const satisfies readonly TourId[];
/**
 * One concept card. `id` is the stable concept identity used for completion/dismissal and copy
 * (`tour.card.<id>.title|body`). Targets are a *group* anchor: the first visible candidate is spotlighted.
 */
export interface TourStep {
 readonly id:string;
 /** Position in the 15-concept curriculum; `null` for optional contextual cards. */
 readonly concept:number|null;
 readonly target:string;
 readonly fallbacks?:readonly string[];
 readonly compactTarget?:string;
 readonly panel?:PanelId;
 readonly tray?:ControlTray;
 /** Concepts that do not apply to a learning profile are omitted, never replaced by control inventories. */
 readonly applicable?:(state:MissionStore)=>boolean;
}
const card=(id:string,concept:number|null,target:string,extra:Partial<TourStep>={}):TourStep=>({id,concept,target,...extra});
export const tours:Record<TourId,readonly TourStep[]>={
 welcome:[
  card('mission',1,'control-requirements',{tray:'requirements',fallbacks:['control-context']}),
  card('control',2,'primary',{fallbacks:['control-context']}),
  card('workspace',3,'control-stage',{fallbacks:['control-panel-mission']}),
 ],
 build:[
  card('hardware',4,'control-slots',{tray:'slots',fallbacks:['parts','control-panel-mission']}),
  card('compare',5,'parts',{panel:'mission',fallbacks:['preview','control-panel-mission']}),
  card('path',6,'control-stage',{fallbacks:['orbit','control-panel-mission']}),
  card('requirements',7,'control-requirements',{tray:'requirements',fallbacks:['control-context']}),
  card('freeze',8,'freeze',{panel:'mission',fallbacks:['trade','control-panel-mission']}),
 ],
 launch:[
  card('verify',9,'verification',{panel:'mission',fallbacks:['readiness','control-checklist','control-panel-mission']}),
  card('commit',10,'primary',{fallbacks:['control-context']}),
 ],
 flight:[
  card('observe',11,'camera-mode',{fallbacks:['control-flight']}),
  card('advance',12,'timeline-advance',{tray:'flight',fallbacks:['timeline-edge','primary']}),
  card('systems',13,'resource-power',{fallbacks:['resources-compact','resources']}),
 ],
 debrief:[
  card('result',14,'score',{panel:'mission',fallbacks:['control-panel-mission']}),
  card('iterate',15,'redesign',{panel:'mission',fallbacks:['control-panel-mission']}),
 ],
 // Optional, explicitly requested; never chained onto the curriculum.
 choice:[card('choice',null,'choice-preview',{panel:'mission',fallbacks:['choice-tour','parts','orbit','control-panel-mission']})],
};
/** Stable ids of every concept in a tour regardless of state-dependent applicability. */
export function conceptIdsFor(id:TourId):readonly string[] {return tours[id].map(step=>step.id);}
export function stepsForTour(id:TourId,state:MissionStore):readonly TourStep[] {
 return tours[id].filter(step=>!step.applicable||step.applicable(state));
}
export function surfaceTour(stage:JourneyStage,hasFlight:boolean):TourId {
 return stage==='REVIEW'?'debrief':hasFlight?'flight':stage==='BUILD_VERIFY'||stage==='IMPLEMENT'?'launch':stage==='DESIGN'?'build':'welcome';
}
/** Candidate anchors in preference order for the current layout. */
export function targetsForStep(step:TourStep,compact:boolean):readonly string[] {
 return [...(compact&&step.compactTarget?[step.compactTarget]:[]),step.target,...(step.fallbacks??[])];
}
