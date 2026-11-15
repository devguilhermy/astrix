// Modal tour infrastructure adapted from Void Protocol at pin 218625d.
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMission } from '../../store';
import { showWindow, useWindows } from '../layout/windows';
import { PANEL_IDS } from '../layout/panelLayout';
import { Modal } from '../primitives';
import { useMissionControl, revealControl } from '../guide/missionControlState';
import { useWorkbench } from '../../three/spacecraft/workbenchState';
import { usePilot } from '../flight/pilotState';
import { openPartDetails } from '../inspector/openPart';
import { TourCard } from './TourCard';
import { TourSpotlight } from './TourSpotlight';
import { stepsForTour, surfaceTour } from './tours';
import { useTourStore } from './tourStore';
import { tourNavigation } from './tourNavigation';
export function TourHost({ready}:{ready:boolean}) {
 const s=useMission(),tour=useTourStore(),{t}=useTranslation(),surface=surfaceTour(s.activeStage,!!s.sim),layout=useWindows(state=>state.layout);
 const steps=useMemo(()=>tour.active?stepsForTour(tour.active,s):[],[tour.active,s.activeStage,s.design?.busId,!!s.sim,s.settings.presentation]);
 const step=steps[tour.index],target=layout!=='desktop'&&step?.compactTarget?step.compactTarget:step?.target;
 const close=useCallback(()=>useTourStore.getState().end(false),[]);
 useEffect(()=>{
  if(!ready||tour.active||tour.history[surface])return;
  const timer=setTimeout(()=>{const current=useMission.getState();if(current.explanation||current.handoff)return;if(current.levelId==='ASPIRING')useTourStore.getState().start(surface);},600);
  return()=>clearTimeout(timer);
 },[ready,surface,tour.active,tour.history,s.levelId,s.explanation,s.handoff]);
 useEffect(()=>{
  if(!tour.active)return;
  const previousTray=useMissionControl.getState().tray,previousWindows=useWindows.getState(),previousPart=useWorkbench.getState().inspectedPartId,previousPilot=usePilot.getState().enabled,previousSubstep=useMission.getState().activeSubstep,disclosures=[...document.querySelectorAll('details')].map(element=>({element,open:element.open}));
  useMission.getState().pause('tour');
  if(tour.active==='build')useMission.getState().setSubstep('equipment');
  return()=>{
   useMissionControl.getState().setTray(previousTray);
   useWindows.setState(current=>{const windows={...current.windows};for(const id of PANEL_IDS)windows[id]={...windows[id],visibility:previousWindows.windows[id].visibility};return {windows,compactWindow:previousWindows.compactWindow};});
   useWorkbench.getState().inspect(previousPart);usePilot.getState().setEnabled(previousPilot);
   for(const {element,open} of disclosures)if(element.isConnected)element.open=open;
   if(tour.active==='build')useMission.getState().setSubstep(previousSubstep);
   useMission.getState().clearPauseReason('tour');
  };
 },[tour.active]);
 useEffect(()=>{
  if(!step||!target)return;
  if(step.tray)useMissionControl.getState().setTray(step.tray);else useMissionControl.getState().setTray(null);
  if(step.pilot)usePilot.getState().setEnabled(true);
  if(step.inspect)openPartDetails(step.inspect);
  if(step.panel)showWindow(step.panel,`[data-cue-target="${target}"],[id="${target}"]`);
  revealControl(target);
  const frame=requestAnimationFrame(()=>{
   const element=document.querySelector<HTMLElement>(`[data-cue-target="${step.disclosure??target}"]`);
   if(element instanceof HTMLDetailsElement)element.open=true;
   document.getElementById('tour-step-heading')?.focus();
  });
  return()=>cancelAnimationFrame(frame);
 },[step,target]);
 const move=(direction:'back'|'next')=>{if(!tour.active)return;const result=tourNavigation(tour.index,steps.length,direction);if(result.finish)tour.end(true);else tour.move(result.index);};
 if(!ready)return null;
 if(!tour.active||!step||!target)return s.levelId==='EXPERT'&&!tour.history[surface]?<aside className="tour-offer"><span>{t('hud.tourOffer')}</span><button className="button" onClick={()=>tour.start(surface)}>{t('ui.tour')}</button><button className="button" onClick={()=>tour.offer(surface)}>{t('hud.notNow')}</button></aside>:null;
 return <div className="tour-layer" onKeyDown={event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.target instanceof HTMLInputElement)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();move(event.key==='ArrowLeft'?'back':'next');}if(event.key==='Enter'&&event.target instanceof HTMLElement&&!event.target.closest('button')){event.preventDefault();move('next');}}}>
  <TourSpotlight target={target}/><Modal title={t(`hud.tour.${tour.active}`)} className="tour-dialog" onClose={close}><TourCard step={step} index={tour.index} total={steps.length} next={()=>move('next')} back={()=>move('back')} skip={close}/></Modal>
 </div>;
}
