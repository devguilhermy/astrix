// Adapted from Void Protocol components/ui/GuidedTour.tsx, pin 218625d (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence).
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMission } from '../../store';
import { showWindow } from '../layout/windows';
import { Modal } from '../primitives';
import { TourCard } from './TourCard';
import { TourSpotlight } from './TourSpotlight';
import { tours,surfaceTour } from './tours';
import { useTourStore } from './tourStore';
import { tourNavigation } from './tourNavigation';
export function TourHost({ready}:{ready:boolean}){
 const s=useMission(),tour=useTourStore(),{t}=useTranslation(),surface=surfaceTour(s.activeStage,!!s.sim),step=tour.active?tours[tour.active][tour.index]:null;
 const close=useCallback(()=>useTourStore.getState().end(false),[]);
 useEffect(()=>{
  if(!ready||tour.active||tour.history[surface])return;
  const timer=setTimeout(()=>{const current=useMission.getState();if(current.explanation||current.handoff)return;if(current.levelId==='ASPIRING')useTourStore.getState().start(surface);},600);
  return()=>clearTimeout(timer);
 },[ready,surface,tour.active,tour.history,s.levelId,s.explanation,s.handoff]);
 useEffect(()=>{
  if(!tour.active)return;
  useMission.getState().pause('tour');
  return()=>{useMission.getState().clearPauseReason('tour');};
 },[tour.active]);
 useEffect(()=>{
  if(!step)return;
  if(step.panel)showWindow(step.panel,`[data-cue-target="${step.target}"]`);
  const frame=requestAnimationFrame(()=>document.getElementById('tour-step-heading')?.focus());
  return()=>cancelAnimationFrame(frame);
 },[step]);
 const move=(direction:'back'|'next')=>{if(!tour.active)return;const result=tourNavigation(tour.index,tours[tour.active].length,direction);if(result.finish)tour.end(true);else tour.move(result.index);};
 if(!ready)return null;
 if(!tour.active||!step)return s.levelId==='EXPERT'&&!tour.history[surface]?<aside className="tour-offer"><span>{t('hud.tourOffer')}</span><button className="button" onClick={()=>tour.start(surface)}>{t('ui.tour')}</button><button className="button" onClick={()=>tour.offer(surface)}>{t('hud.notNow')}</button></aside>:null;
 return <div className="tour-layer" onKeyDown={event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.target instanceof HTMLInputElement)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();move(event.key==='ArrowLeft'?'back':'next');}if(event.key==='Enter'&&event.target instanceof HTMLElement&&!event.target.closest('button')){event.preventDefault();move('next');}}}>
  <TourSpotlight target={step.target} fallbackTarget={step.fallbackTarget}/><Modal title={t(`hud.tour.${tour.active}`)} className="tour-dialog" onClose={close}><TourCard step={step} index={tour.index} total={tours[tour.active].length} next={()=>move('next')} back={()=>move('back')} skip={close}/></Modal>
 </div>;
}
