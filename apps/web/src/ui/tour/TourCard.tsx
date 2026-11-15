// Adapted from Void Protocol TourSpotlight.tsx card, pin 218625d (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence).
import { useTranslation } from 'react-i18next';
import type { TourStep } from './tours';
export function TourCard({step,index,total,next,back,skip}:{step:TourStep;index:number;total:number;next:()=>void;back:()=>void;skip:()=>void}){
 const {t}=useTranslation();
 return <><span className="tour-count">{index+1} / {total}</span><h3 tabIndex={-1} id="tour-step-heading">{t(step.titleKey??`${step.key}.title`,step.values)}</h3><p>{t(step.titleKey?step.key:`${step.key}.body`,step.values)}</p><div className="button-wrap"><button className="button" onClick={skip}>{t('ui.skipTour')}</button><button className="button" disabled={index===0} onClick={back}>{t('flow.back')}</button><button className="button primary" onClick={next}>{t(index===total-1?'hud.finish':'ui.tourNext')}</button></div></>;
}
