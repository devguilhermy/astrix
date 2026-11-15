import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listScenarios, listRides, listParts, listOrbitPresets, previewOrbit, quoteSetRide, quoteSetOrbit, quoteSetPropellant, planPropellant, computeBudgets, orbitAltitudes, withOrbitAltitudes, type ActorRole, type Design, type Quote } from '@astrix/core';
import { useMission } from '../../store';
import { useWorkbench } from '../../three/spacecraft/workbenchState';
import { useCameraMode } from '../../three/camera/modes';
import { useProposal } from '../workshop/proposalStore';
import { BudgetComparison } from '../panels/Budgets';
import { RefusalNote } from '../panels/Review';
import { NumberValue, Panel } from '../primitives';
import { ExplainButton } from '../science/ExplainButton';
import { useTourStore } from '../tour/tourStore';
export function LaunchScreen(){
 const {t}=useTranslation(),s=useMission(),d=s.design!,b=s.budgets!,scenario=listScenarios().find(x=>x.id===d.scenarioId)!,workbench=useWorkbench();
 const [proposal,setProposal]=useState<{revision:number;actor:ActorRole;quote:Quote<{next:Design}>;description:string}|null>(null),orbit=d.orbit??scenario.defaultOrbit,alt=orbitAltitudes(orbit);
 useEffect(()=>()=>{useProposal.getState().clear();useWorkbench.getState().setPreviewOrbit(null);},[]);
 useEffect(()=>{if(proposal?.quote.ok&&s.levelId==='ASPIRING'&&!useTourStore.getState().history.choice&&!useTourStore.getState().active)useTourStore.getState().start('choice');},[proposal,s.levelId]);
 const cancel=()=>{setProposal(null);useProposal.getState().clear();workbench.setPreviewOrbit(null);};
 const propose=(quote:Quote<{next:Design}>,description:string)=>{
  const actor=s.actor();setProposal({revision:d.revision,actor,quote,description});
  if(quote.ok){const after=computeBudgets(quote.value.next);useProposal.getState().set(b,after,d.revision);if(!s.artifacts?.trade)s.recordTradeQuote(description,quote);workbench.setPreviewOrbit(quote.value.next.orbit);useCameraMode.getState().setMode('MAP');}else{useProposal.getState().clear();workbench.setPreviewOrbit(null);}
 };
 return <div className="phase-content"><header className="phase-title"><h1>{t('hud.chooseOrbit')}</h1><ExplainButton topic="orbit-height"/></header>
  <section id="orbit" data-cue-target="orbit"><div className="orbit-options">{listOrbitPresets(d).map(preset=>{
   const heights=orbitAltitudes(preset.orbit),quote=previewOrbit(d,preset.id,s.actor()),forecast=quote.ok?computeBudgets(quote.value.next):null;
   return <article key={preset.id}><h3>{t(preset.titleKey)}</h3><p><NumberValue value={heights.altitudeKm} unit="km"/> × <NumberValue value={heights.apoapsisAltitudeKm} unit="km"/></p>{forecast?.orbit&&<><p>{t('ui.contact')}: <NumberValue value={forecast.orbit.contactMinPerDay} unit="min/d"/></p><p>{t('ui.eclipse')}: <NumberValue value={forecast.orbit.eclipseFrac*100} unit="%"/></p></>}<button className="button" onClick={()=>propose(quote,preset.id)}>{t('ui.preview')}</button></article>;
  })}</div><details><summary>{t('hud.customOrbit')}</summary><label>{t('ui.altitude')} <NumberValue value={alt.altitudeKm} unit="km"/><input type="range" min={350} max={800} step={10} value={alt.altitudeKm} onChange={event=>{const h=Number(event.target.value);propose(quoteSetOrbit(d,withOrbitAltitudes(orbit,h,h,orbit.inclinationDeg),s.actor()),'orbit');}}/></label></details></section>
  <details id="rides"><summary>{t('ui.ride')}</summary>{listRides(d.busId,scenario.body).map(ride=><article key={ride.id}><h3>{t(ride.nameKey)}</h3><p>{t(ride.descKey)}</p><button className="button" onClick={()=>propose(quoteSetRide(d,ride.id,s.actor()),ride.id)}>{t('ui.preview')}</button></article>)}</details>
  {scenario.body==='MARS'&&<section id="fuel-planner"><h2>{t('ui.fuel')}</h2><ExplainButton topic="rocket-equation"/><button className="button" onClick={()=>propose(planPropellant(d,s.actor()),'propellant')}>{t('ui.planFuel')}</button>{listParts(d.busId).filter(part=>part.category==='PROPULSION'&&d.parts.some(item=>item.partId===part.id)).map(part=><label key={part.id}>{t('ui.propellant')}<input type="range" min={0} max={part.tankKg?.v??0} step={.1} value={d.parts.find(item=>item.partId===part.id)?.propellantKg??0} onChange={event=>propose(quoteSetPropellant(d,Number(event.target.value),s.actor()),'propellant')}/></label>)}</section>}
  {proposal&&<Panel id="choice-preview" title={t('ui.preview')}>{proposal.quote.ok?<><BudgetComparison before={b} after={computeBudgets(proposal.quote.value.next)}/>{(proposal.revision!==d.revision||proposal.actor!==s.actor())&&<p role="status">{t('flow.stale')}</p>}<button className="button primary" data-cue-target="confirm" disabled={proposal.revision!==d.revision||proposal.actor!==s.actor()} onClick={()=>{const current=useMission.getState();if(current.design?.revision===proposal.revision&&current.actor()===proposal.actor&&current.applyDesign(proposal.quote))cancel();}}>{t('hud.confirmOrbit')}</button><button className="button" data-cue-target="choice-tour" onClick={()=>useTourStore.getState().start('choice')}>{t('control.tourQuote')}</button></>:<RefusalNote refusal={proposal.quote}/>}<button className="button" data-cue-target="choice-cancel" onClick={cancel}>{t('ui.cancel')}</button></Panel>}
 </div>;
}
