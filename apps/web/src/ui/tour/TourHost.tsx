// Modal tour infrastructure adapted from Void Protocol at pin 218625d.
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMission } from '../../store';
import { showWindow, useWindows } from '../layout/windows';
import { PANEL_IDS } from '../layout/panelLayout';
import { Modal } from '../primitives';
import { useMissionControl, revealControl } from '../guide/missionControlState';
import { resolveCueTarget } from '../guide/cueTargets';
import { TourCard } from './TourCard';
import { TourSpotlight } from './TourSpotlight';
import { CURRICULUM_TOURS, stepsForTour, surfaceTour, targetsForStep } from './tours';
import { useTourStore } from './tourStore';
import { tourNavigation } from './tourNavigation';

/**
 * Presentation-only walkthrough. It never dispatches navigation or design intents: it opens device-local
 * trays/windows/disclosures for the current card and restores them on exit. A LAN room's clock is shared, so
 * the tour does not pause it; static play pauses only under the local `tour` reason and never auto-resumes.
 */
export function TourHost({ready}:{ready:boolean}) {
 const s=useMission(),tour=useTourStore(),{t}=useTranslation(),surface=surfaceTour(s.activeStage,!!s.sim),layout=useWindows(state=>state.layout);
 const shared=s.mode==='LAN'||s.remoteMode,compact=layout!=='desktop';
 const steps=useMemo(()=>tour.active?stepsForTour(tour.active,useMission.getState()):[],[tour.active,s.activeStage,s.design?.busId,!!s.sim,s.levelId]);
 const step=steps[tour.index],targets=useMemo(()=>step?targetsForStep(step,compact):[],[step,compact]);
 const conceptsThrough=useCallback((through:number)=>steps.slice(0,through).map(item=>item.id),[steps]);
 const end=useCallback((finished:boolean)=>useTourStore.getState().end(finished,conceptsThrough(finished?steps.length:useTourStore.getState().index)),[conceptsThrough,steps.length]);
 const close=useCallback(()=>end(false),[end]);
 const eligible=ready&&!tour.active&&!tour.history[surface]&&!tour.curriculumSkipped&&(CURRICULUM_TOURS as readonly string[]).includes(surface);
 useEffect(()=>{
  if(!eligible||s.levelId!=='ASPIRING')return;
  const timer=setTimeout(()=>{const current=useMission.getState();if(current.explanation||current.handoff||useTourStore.getState().active)return;if(stepsForTour(surface,current).length)useTourStore.getState().start(surface,'auto');},600);
  return()=>clearTimeout(timer);
 },[eligible,surface,s.levelId,s.explanation,s.handoff]);
 useEffect(()=>{
  if(!tour.active)return;
  const previousTray=useMissionControl.getState().tray,previousWindows=useWindows.getState(),disclosures=[...document.querySelectorAll('details')].map(element=>({element,open:element.open}));
  const pauses=!(useMission.getState().mode==='LAN'||useMission.getState().remoteMode);
  if(pauses)useMission.getState().pause('tour');
  return()=>{
   useMissionControl.getState().setTray(previousTray);
   useWindows.setState(current=>{const windows={...current.windows};for(const id of PANEL_IDS)windows[id]={...windows[id],visibility:previousWindows.windows[id].visibility};return {windows,compactWindow:previousWindows.compactWindow};});
   for(const {element,open} of disclosures)if(element.isConnected)element.open=open;
   if(pauses)useMission.getState().clearPauseReason('tour');
  };
 },[tour.active]);
 useEffect(()=>{
  if(!step)return;
  useMissionControl.getState().setTray(step.tray??null);
  if(step.panel)showWindow(step.panel,targets.map(target=>`[data-cue-target="${target}"],[id="${target}"]`).join(','));
  const frame=requestAnimationFrame(()=>{
   const anchor=targets.find(target=>resolveCueTarget(target));
   if(anchor)revealControl(anchor);
   document.getElementById('tour-step-heading')?.focus();
  });
  return()=>cancelAnimationFrame(frame);
 },[step,targets]);
 const move=(direction:'back'|'next')=>{if(!tour.active)return;const result=tourNavigation(tour.index,steps.length,direction);if(result.finish)end(true);else tour.move(result.index,direction==='next'?conceptsThrough(result.index):[]);};
 if(!ready)return null;
 if(!tour.active||!step){
  const offer=s.levelId==='EXPERT'&&eligible;
  return offer?<aside className="tour-offer" aria-label={t('tour.offerLabel')}><span>{t('hud.tourOffer')}</span><button type="button" className="button" onClick={()=>tour.start(surface,'auto')}>{t('ui.tour')}</button><button type="button" className="button" onClick={()=>tour.declineOffers()}>{t('hud.notNow')}</button></aside>:null;
 }
 return <div className="tour-layer" onKeyDown={event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.target instanceof HTMLInputElement)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();move(event.key==='ArrowLeft'?'back':'next');}if(event.key==='Enter'&&event.target instanceof HTMLElement&&!event.target.closest('button')){event.preventDefault();move('next');}}}>
  <TourSpotlight targets={targets}/><Modal title={t(`hud.tour.${tour.active}`)} className="tour-dialog" onClose={close}><TourCard step={step} index={tour.index} total={steps.length} next={()=>move('next')} back={()=>move('back')} skip={close} auto={tour.origin==='auto'&&tour.active!=='choice'} sharedClock={shared} teamPaused={!s.running} onTeamPause={()=>useMission.getState().pause('manual')}/></Modal>
 </div>;
}
