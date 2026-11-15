// Surface/step shape adapted from Void Protocol components/ui/tourSteps.ts, pin 218625d (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence). Mission content is original.
import type { JourneyStage } from '@astrix/core';
import type { PanelId } from '../layout/panelLayout';
export type TourId='welcome'|'build'|'launch'|'flight'|'debrief';
export interface TourStep {id:string;target:string;fallbackTarget?:string;panel?:PanelId;key:string}
export const tours:Record<TourId,readonly TourStep[]>={
 welcome:['spacecraft','resources','capcom','workshop','topbar'].map(target=>({id:target,target,key:`hud.tour.welcome.${target}`})),
 build:[{id:'slots',target:'spacecraft',key:'hud.tour.build.slots'},{id:'parts',target:'parts',panel:'mission',key:'hud.tour.build.parts'},{id:'preview',target:'preview',panel:'mission',key:'hud.tour.build.preview'},{id:'confirm',target:'confirm',fallbackTarget:'parts',panel:'mission',key:'hud.tour.build.confirm'},{id:'freeze',target:'freeze',panel:'mission',key:'hud.tour.build.freeze'}],
 launch:[{id:'dry-run',target:'dry-run',panel:'mission',key:'hud.tour.launch.dry-run'},{id:'checks',target:'verification',panel:'mission',key:'hud.tour.launch.checks'},{id:'go',target:'launch',key:'hud.tour.launch.go'}],
 flight:['timeline','hotbar','pilot','camera','time'].map(target=>({id:target,target,key:`hud.tour.flight.${target}`})),
 debrief:[{id:'score',target:'score',panel:'mission',key:'hud.tour.debrief.score'},{id:'replay',target:'replay',panel:'mission',key:'hud.tour.debrief.replay'},{id:'redesign',target:'redesign',panel:'mission',key:'hud.tour.debrief.redesign'}],
};
export function surfaceTour(stage:JourneyStage,hasFlight:boolean):TourId {
 return stage==='REVIEW'?'debrief':hasFlight?'flight':stage==='BUILD_VERIFY'||stage==='IMPLEMENT'?'launch':stage==='DESIGN'?'build':'welcome';
}
