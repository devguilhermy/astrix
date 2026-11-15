// Tour infrastructure adapted from Void Protocol at pin 218625d; mission controls/content are original.
import { listParts, missionRequirements, type JourneyStage } from '@astrix/core';
import { STAGES, SUBSTEPS, WARPS, type MissionStore } from '../../store';
import type { PanelId } from '../layout/panelLayout';
import { stageKeys } from '../guide/missionControlModel';
import type { ControlTray } from '../guide/missionControlState';
import { journeySteps } from '../guide/nextSteps';
import { guideContext } from '../guide/missionControlModel';
import { CAMERA_MODES } from '../../three/camera/modes';
export type TourId='welcome'|'build'|'launch'|'flight'|'debrief'|'choice';
export interface TourStep { id:string; target:string; compactTarget?:string; key:string; titleKey?:string; values?:Record<string,string|number>; panel?:PanelId; tray?:ControlTray; disclosure?:string; inspect?:string; pilot?:boolean; applicable?:(state:MissionStore)=>boolean }
const step=(id:string,target:string,titleKey:string,key:string,extra:Partial<TourStep>={}):TourStep=>({id,target,titleKey,key,...extra});
const navigation:TourStep[]=[
 ...['briefing','build','test','fly','debrief'].map(id=>step(`chapter-${id}`,`chapter-${id}`,`hud.chapter.${id}`,'control.tour.chapter',{compactTarget:'control-stage'})),
 ...STAGES.flatMap(stage=>SUBSTEPS[stage].map(substep=>step(`view-${stage}-${substep}`,'control-stage',`control.${substep==='requirements'?'requirementsView':substep}`,'control.tour.stage',{values:{stage:stageKeys[stage]}}))),
 ...(['mission','readiness','review','log'] as const).map(id=>step(`panel-${id}`,`control-panel-${id}`,id==='mission'?'hud.workshop':id==='readiness'?'hud.details':id==='review'?'ui.panelReview':'ui.events','control.tour.panel')),
];
const controller:TourStep[]=[
 step('context','control-context','control.title','control.tour.context'),
 step('primary','primary','flow.next','control.tour.primary'),
 step('explain','control-explain','ui.explain','control.tour.explain'),
 step('requirements','control-requirements','control.requirements','control.tour.requirements',{tray:'requirements'}),
 ...['SCI-DATA-01','LAUNCH-MASS-01','SCI-PAYLOAD-01','POWER-ECLIPSE-01'].map(id=>step(id,`requirement-${id}`,`hud.requirement.${id}`,'control.tour.requirement',{tray:'requirements'})),
 step('evidence','requirements-evidence','hud.details','control.tour.evidence',{tray:'requirements',disclosure:'requirements-evidence',applicable:s=>s.settings.presentation!=='DETAILED'}),
 step('requirements-explain','requirements-explain','ui.explain','control.tour.explain',{tray:'requirements'}),
 step('checklist','control-checklist','control.checklist','control.tour.checklist',{tray:'checklist'}),
 step('checklist-items','checklist-items','hud.nextStep','control.tour.checklistItems',{tray:'checklist'}),
 step('close','control-close','control.close','control.tour.close',{tray:'checklist'}),
 ...navigation,
 ...['mass','power','budget','data','comms','time','crew'].map(id=>step(`resource-${id}`,`resource-${id}`,`flow.${id}`,'control.tour.resources')),
 step('resources-compact','resources-compact','hud.compactResources','control.tour.resources'),
 ...CAMERA_MODES.map(mode=>step(`camera-mode-${mode}`,'camera-mode',`flight.${mode}`,'control.tour.camera')),
 ...['zoomOut','zoomIn','fit'].map(action=>step(`camera-${action}`,`camera-${action}`,`scene.${action}`,'control.tour.camera')),
 step('camera-options','camera-options','scene.controls','control.tour.camera',{disclosure:'camera-options'}),
 ...['left','right','up','down','panLeft','panRight','panUp','panDown','focus','body','plane','station','reset'].map(action=>step(`camera-${action}`,`camera-${action}`,['body','plane','station'].includes(action)?`flight.${action}`:`scene.${action}`,'control.tour.camera',{disclosure:'camera-options'})),
 step('camera-explore','camera-explore','scene.explore','control.tour.camera',{applicable:()=>typeof matchMedia==='function'&&matchMedia('(any-pointer: coarse)').matches}),
 step('help','topbar','hud.help','control.tour.help'),
];
const slots:TourStep[]=[
 step('slots','control-slots','control.slots','control.tour.slots',{tray:'slots'}),
 ...['exploded','dimensions','turntable'].map(id=>step(`slot-${id}`,`slot-${id}`,`flight.${id}`,'control.tour.presentation',{tray:'slots',applicable:s=>!s.sim})),
 ...['BATTERY','SOLAR','COMPUTER','STORAGE','ADCS','RADIO','INSTRUMENT','PROPULSION','THERMAL'].map(category=>step(`slot-${category}`,`slot-${category}`,`flight.cat${category}`,'control.tour.category',{tray:'slots',applicable:s=>!s.sim&&!!s.design&&listParts(s.design.busId).some(part=>part.category===category)})),
];
export const tours:Record<TourId,readonly TourStep[]>={
 welcome:[...controller,...slots],
 build:[...slots,
  step('guided','parts-guided','ui.allParts','control.tour.allParts',{panel:'mission'}),
  step('parts','parts','hud.workshop','control.tour.parts',{panel:'mission'}),
  step('preview','preview','ui.preview','control.tour.preview',{panel:'mission'}),
  step('orbit','control-stage','hud.chooseOrbit','control.tour.orbit'),
  step('freeze','freeze','flow.freeze','control.tour.freeze',{panel:'mission'}),
  ...controller,
 ],
 launch:[
  step('return-build','return-build','hud.returnBuild','control.tour.returnBuild',{panel:'mission'}),
  step('dry-run','dry-run','forecast.title','control.tour.forecast',{panel:'mission',applicable:s=>s.activeStage==='BUILD_VERIFY'}),
  step('checks','verification','hud.checklist','control.tour.checks',{panel:'mission',applicable:s=>s.activeStage==='BUILD_VERIFY'}),
  step('launch','primary','hud.goForLaunch','control.tour.launch'),...controller,
 ],
 flight:[
  step('flight','control-flight','control.flight','control.tour.flight',{tray:'flight'}),
  step('edge','timeline-edge','control.next','control.tour.edge'),
  step('contact','timeline-contact','ui.contact','control.tour.contact'),
  step('advance','timeline-advance','flight.next','control.tour.advance'),
  step('timeline-toggle','timeline-toggle','flight.timelineToggle','control.tour.timeline',{tray:'flight',disclosure:'timeline-toggle'}),
  ...['sun','target','earth','downlink','safe','deploy'].map(id=>step(`command-${id}`,`hotbar-${id}`,`flight.${id}`,'control.tour.command',{tray:'flight',applicable:s=>id!=='deploy'||!!s.telemetry&&['STOWED','ANOMALOUS'].some(status=>s.telemetry!.deployment.wings===status||s.telemetry!.deployment.antenna===status)})),
  step('pilot','pilot','flight.pilot','control.tour.pilot',{tray:'flight'}),
  ...['rollLeft','pitchUp','rollRight','yawLeft','pitchDown','yawRight'].map(axis=>step(`pilot-${axis}`,`pilot-${axis}`,`flight.${axis}`,'control.tour.pilot',{tray:'flight',pilot:true})),
  ...WARPS.map(speed=>step(`warp-${speed}`,'time-warp','flight.warp','control.tour.warp',{tray:'flight',values:{speed}})),
  step('event','time-event','flight.next','control.tour.event',{tray:'flight',applicable:s=>!s.telemetry?.cruise&&!s.telemetry?.capturePending}),
  step('receipts','receipts','flight.receipt','control.tour.receipts',{tray:'flight'}),...controller,...slots,
 ],
 debrief:[step('score','score','ui.report','control.tour.score',{panel:'mission'}),step('replay','replay','flow.replayHistory','control.tour.replay',{panel:'mission'}),step('redesign','redesign','flow.redesign','control.tour.redesign',{panel:'mission'}),...controller,...slots],
 choice:[step('choice-tour','choice-tour','control.tourQuote','control.tour.choiceOffer',{panel:'mission'}),step('comparison','choice-preview','ui.preview','control.tour.comparison',{panel:'mission'}),step('install','confirm','control.confirm','control.tour.install',{panel:'mission'}),step('cancel','choice-cancel','ui.cancel','control.tour.cancel',{panel:'mission'})],
};
export function stepsForTour(id:TourId,state:MissionStore):readonly TourStep[] {
 const steps=tours[id].filter(item=>!item.applicable||item.applicable(state));
 if(!state.design||!['welcome','build','flight','debrief'].includes(id))return steps;
 const parts=listParts(state.design.busId),installed=state.design.parts.map(item=>parts.find(part=>part.id===item.partId)).filter(part=>!!part);
 const ctx=guideContext(state),checklist=ctx?journeySteps(ctx):[],first=installed[0];
 return [...steps,
  ...missionRequirements(state.design,state.sim??undefined).filter(requirement=>state.settings.presentation==='DETAILED'&&!['SCI-DATA-01','LAUNCH-MASS-01','SCI-PAYLOAD-01','POWER-ECLIPSE-01'].includes(requirement.id)).map(requirement=>step(requirement.id,`requirement-${requirement.id}`,`hud.requirement.${requirement.id}`,'control.tour.requirement',{tray:'requirements'})),
  ...checklist.map(item=>step(`checklist-${item.id}`,`checklist-${item.id}`,item.titleKey,'control.tour.checklistItems',{tray:'checklist',values:{...item.values}})),
  ...installed.map(part=>step(`component-${part.id}`,`component-${part.id}`,part.nameKey,'control.tour.component',{tray:'slots'})),
  ...(first?[step('component-close','component-close','inspector.close','control.tour.component',{inspect:first.id,panel:'part'}),...(!state.sim&&state.activeStage==='DESIGN'?[step('component-find','component-find','inspector.findInWorkshop','control.tour.component',{inspect:first.id,panel:'part'})]:[])]:[]),
 ];
}
export function surfaceTour(stage:JourneyStage,hasFlight:boolean):TourId {
 return stage==='REVIEW'?'debrief':hasFlight?'flight':stage==='BUILD_VERIFY'||stage==='IMPLEMENT'?'launch':stage==='DESIGN'?'build':'welcome';
}
