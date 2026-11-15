import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { launchReadiness, type JourneyStage } from '@astrix/core';
import { STAGES, SUBSTEPS, useMission } from '../../store';
import { ExplainButton } from '../science/ExplainButton';
import { RefusalNote } from '../panels/Review';
import { Modal } from '../primitives';
import { Requirements } from '../phases/Requirements';
import { goForLaunch } from '../phases/Journey';
import { WorkbenchControls } from '../scene/WorkbenchControls';
import { useWindows, expandWindow } from '../layout/windows';
import { MISSION_PANEL_IDS } from '../layout/panelLayout';
import { useWindowCopy } from '../layout/windowCopy';
import { FlightBar } from '../flight/FlightBar';
import { FlightSummary } from '../flight/FlightSummary';
import { useTimelineForecast } from '../flight/Timeline';
import { Presence } from '../multiplayer/Presence';
import { journeySteps } from './nextSteps';
import { showStep } from './showStep';
import { chapters, canVisitStage, guideContext, primaryAction, stageKeys } from './missionControlModel';
import { useMissionControl, type ControlTray } from './missionControlState';
import './missionControl.css';

const primaryKeys = { go:'hud.goForLaunch',continue:'flow.next',launch:'flow.launch',review:'flow.finalReview',capture:'ui.command.CAPTURE_CONFIRM',decision:'ui.decision',arrival:'flow.boundary.ARRIVAL',cancel:'ui.cancel',pause:'ui.pause',resume:'ui.resume',advance:'flow.advance' } as const;
export function MissionControl() {
 const s=useMission(),{t,i18n}=useTranslation(),windows=useWindows(),copy=useWindowCopy(),control=useMissionControl();
 const surface=`${s.attemptId}:${s.activeStage}:${!!s.sim}`;
 const [refused,setRefused]=useState(false),previousSurface=useRef(surface),forecast=useTimelineForecast();
 useEffect(()=>{if(previousSurface.current!==surface){previousSurface.current=surface;control.setTray(s.activeStage==='REQUIREMENTS'?'requirements':null);if(s.activeStage==='REQUIREMENTS'||s.activeStage==='IMPLEMENT'&&s.sim)useWindows.getState().collapse('mission');else if(useWindows.getState().layout==='desktop')expandWindow('mission',{focus:false});}},[surface,s.activeStage,!!s.sim,control.setTray]);
 useEffect(()=>{if(control.tray&&useWindows.getState().layout==='compact')useWindows.setState({compactWindow:null});},[control.tray]);
 const ctx=guideContext(s);
 if(!ctx||!s.design)return null;
 const d=s.design,action=primaryAction(s),step=action.step,all=journeySteps(ctx),done=all.filter(item=>item.done(ctx)).length;
 const title=step?t(i18n.exists(step.titleKey)?step.titleKey:step.hintKey,step.values):t('control.complete');
 const label=action.kind==='guide'?t('control.show'):action.kind==='advance'&&action.boundary?t(`flow.boundary.${action.boundary.kind}`):t(primaryKeys[action.kind as keyof typeof primaryKeys]);
 const primary=()=>{
  switch(action.kind){
   case 'guide':if(step)showStep(step);break;
   case 'go':goForLaunch();break;
   case 'continue':s.completeStage();break;
   case 'launch':if(launchReadiness(d,s.signoffs).length)setRefused(true);else s.launch(d.revision);break;
   case 'review':s.setStage('REVIEW');expandWindow('mission');break;
   case 'capture':s.decide([{kind:'CAPTURE_CONFIRM'}]);break;
   case 'decision':document.getElementById('decision-heading')?.focus();break;
   case 'arrival':s.skipCruise();break;
   case 'cancel':s.cancelAdvance();break;
   case 'pause':s.pause();break;
   case 'resume':s.resume();break;
   case 'advance':s.advanceToEvent();break;
  }
 };
 const close=()=>{const tray=control.tray;control.setTray(null);if(tray)requestAnimationFrame(()=>document.getElementById(`control-${tray}`)?.focus());};
 const toggle=(tray:ControlTray)=>control.tray===tray?close():control.setTray(tray);
 const chapter=chapters.find(item=>(item.stages as readonly string[]).includes(s.activeStage))!;
 const navigate=(value:string)=>{
  const [stage,substep]=value.split(':');
  if(!STAGES.includes(stage as JourneyStage)||!canVisitStage(s,stage as JourneyStage,STAGES))return;
  if(stage!==s.activeStage)s.setStage(stage as JourneyStage);
  if(useMission.getState().activeStage===stage)useMission.getState().setSubstep(substep);
  if(stage==='REQUIREMENTS')control.setTray('requirements');else expandWindow('mission');
 };
 return <section className="mission-control" data-hud-zone="bottom" data-cue-target="mission-control" aria-label={t('control.title')} onKeyDown={event=>{if(event.key==='Escape'&&control.tray&&!event.defaultPrevented&&event.target instanceof Element&&!event.target.closest('[role="dialog"]')){event.stopPropagation();close();}}}>
  <div id="mission-control-tray" className="mission-control-tray" hidden={!control.tray} data-tray={control.tray??undefined}><header><h2>{control.tray?t(`control.${control.tray}`):''}</h2><button type="button" className="button" data-cue-target="control-close" onClick={close}>{t('control.close')}</button></header>
   <div hidden={control.tray!=='requirements'}><Requirements/></div>
   <div hidden={control.tray!=='slots'}><WorkbenchControls design={d} reducedMotion={s.settings.reducedMotion}/></div>
   <ol hidden={control.tray!=='checklist'} data-cue-target="checklist-items" className="mission-checklist">{all.map(item=><li key={item.id}><span>{item.done(ctx)?t('hud.done'):t('hud.pending')}</span><button type="button" className="text-button" data-cue-target={`checklist-${item.id}`} onClick={()=>showStep(item)}>{t(i18n.exists(item.titleKey)?item.titleKey:item.hintKey,item.values)}</button><small>{t(`role.${item.owner}`)}</small></li>)}</ol>
   <div hidden={control.tray!=='flight'}>{s.sim&&<FlightBar forecast={forecast}/>}</div>
  </div>
  <div className="mission-control-base">
   <div className="mission-control-context" data-cue-target="control-context"><div><strong>{t('control.title')}</strong><p>{title}</p>{step&&<small>{t('control.owner',{owner:t(`role.${step.owner}`)})}</small>}</div><div className="mission-control-action"><span data-cue-target="control-explain"><ExplainButton topic={step?.sceneTarget==='INSTRUMENT'?'science-return':'mission-design'} context={`capcom.${step?.id??s.activeStage}`}/></span><button id="mission-primary" type="button" className="button primary" data-cue-target="primary" disabled={action.blocked} onClick={primary}>{label}</button></div></div>
   {s.sim&&!s.telemetry?.ended&&<FlightSummary forecast={forecast}/>}
   <div className="mission-control-navigation">
    <div className="mission-control-options">{(['requirements','slots','checklist',...(s.sim&&!s.telemetry?.ended?['flight']:[])] as ControlTray[]).map(tray=><button key={tray} id={`control-${tray}`} type="button" className="control-option" data-cue-target={`control-${tray}`} aria-expanded={control.tray===tray} aria-controls="mission-control-tray" onClick={()=>toggle(tray)}>{t(`control.${tray}`)}{tray==='checklist'&&<small>{done}/{all.length}</small>}</button>)}</div>
    <nav className="mission-chapters" aria-label={t('hud.journey')}>{chapters.map(item=>{const target=item.stages.find(stage=>canVisitStage(s,stage,STAGES));return <button key={item.id} type="button" data-cue-target={`chapter-${item.id}`} aria-current={chapter.id===item.id?'step':undefined} disabled={!target} title={!target?t('control.locked'):undefined} onClick={()=>target&&navigate(`${target}:${SUBSTEPS[target][0]}`)}>{t(`hud.chapter.${item.id}`)}</button>;})}</nav>
    <label className="mission-view-select" data-cue-target="control-stage"><span className="sr-only">{t('control.stage')}</span><select aria-label={t('control.stage')} value={`${s.activeStage}:${s.activeSubstep}`} onChange={event=>navigate(event.target.value)}>{STAGES.map(stage=><optgroup key={stage} label={t(`flow.${stageKeys[stage]}`)}>{SUBSTEPS[stage].map(substep=><option key={substep} value={`${stage}:${substep}`} disabled={!canVisitStage(s,stage,STAGES)}>{t(`flow.${stageKeys[stage]}`)} · {t(`control.${substep==='requirements'?'requirementsView':substep}`)}{!canVisitStage(s,stage,STAGES)?` — ${t('control.locked')}`:''}</option>)}</optgroup>)}</select></label>
    <nav className="mission-panel-nav" aria-label={t('control.panels')}>{MISSION_PANEL_IDS.map(id=>{const expanded=windows.windows[id].visibility==='EXPANDED'&&(windows.layout==='desktop'||windows.compactWindow===id);const badge=id==='mission'?s.pendingDecisions.length:id==='review'?s.cues.active.filter(cue=>cue.severity===3).length:id==='log'?s.events.length:0;return <button type="button" key={id} id={`control-panel-${id}`} data-cue-target={`control-panel-${id}`} aria-expanded={expanded} aria-controls={`floating-${id}`} onClick={()=>{control.setTray(null);if(expanded)windows.collapse(id);else expandWindow(id);}}>{copy[id]}{badge>0&&<small>{badge}</small>}</button>;})}</nav>
   </div><Presence/>
   {action.blocked&&<p className="pause-explanation" role="status">{s.pauseReasons.filter(reason=>!['manual','self-paced'].includes(reason)).map(reason=>t(`control.pause.${reason.split(':')[0]}`)).join(' · ')}</p>}
  </div>
  {refused&&<Modal title={t('flow.launch')} onClose={()=>setRefused(false)}>{launchReadiness(d,s.signoffs).map((issue,index)=><RefusalNote key={index} refusal={issue}/>)}</Modal>}
 </section>;
}
