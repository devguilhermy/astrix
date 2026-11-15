// Adapted from Void Protocol TourSpotlight card, pin 218625d owner-authorized reuse under project Apache-2.0; upstream pin declares no licence.
import { useTranslation } from 'react-i18next';
import { CURRICULUM_LIMIT, type TourStep } from './tours';

export interface TourCardProps {step:TourStep;index:number;total:number;next:()=>void;back:()=>void;skip:()=>void;auto:boolean;
 /** LAN rooms keep their shared clock running during a tour; the card says so and offers the explicit team pause. */
 sharedClock:boolean;teamPaused:boolean;onTeamPause:()=>void}
export function TourCard({step,index,total,next,back,skip,auto,sharedClock,teamPaused,onTeamPause}:TourCardProps) {
 const {t}=useTranslation();
 return <>
  <h3 tabIndex={-1} id="tour-step-heading">{t(`tour.card.${step.id}.title`)}</h3>
  <p>{t(`tour.card.${step.id}.body`)}</p>
  {sharedClock&&<div className="tour-shared-clock" role="note"><p>{t('tour.sharedClock')}</p><button type="button" className="button" disabled={teamPaused} onClick={onTeamPause}>{t(teamPaused?'tour.teamPaused':'tour.pauseTeam')}</button></div>}
  <p className="tour-progress" aria-live="polite"><span className="tour-count">{t('tour.progress',{index:index+1,total})}</span>{step.concept&&<span>{t('tour.concept',{number:step.concept,limit:CURRICULUM_LIMIT})}</span>}</p>
  <div className="button-wrap"><button type="button" className="button" onClick={skip}>{t(auto?'tour.skipIntro':'tour.close')}</button><button type="button" className="button" disabled={index===0} onClick={back}>{t('flow.back')}</button><button type="button" className="button primary" onClick={next}>{t(index===total-1?'hud.finish':'ui.tourNext')}</button></div>
 </>;
}
