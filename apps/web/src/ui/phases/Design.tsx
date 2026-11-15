import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { computeBudgets, listParts, missionRequirements, quoteAddPart, quoteRemovePart, type ActorRole, type Budgets, type Design, type Quote, type PartCategory, type PartDef } from '@astrix/core';
import type { ScienceTopicId } from '@astrix/data';
import { useMission } from '../../store';
import { useWorkbench } from '../../three/spacecraft/workbenchState';
import { useProposal } from '../workshop/proposalStore';
import { ExplainButton } from '../science/ExplainButton';
import { BudgetComparison } from '../panels/Budgets';
import { RefusalNote } from '../panels/Review';
import { Panel, NumberValue } from '../primitives';
import { partIcons } from '../icons';
import { ReadOnlyDesign } from '../screens/ReadOnlyDesign';
export const categoryTopic:Record<PartCategory,ScienceTopicId>={BATTERY:'battery-storage',SOLAR:'solar-distance',COMPUTER:'mission-design',STORAGE:'data-storage',ADCS:'pointing',RADIO:'radio-links',INSTRUMENT:'science-return',PROPULSION:'propulsion',THERMAL:'thermal-control'};
import { useTourStore } from '../tour/tourStore';
function HardwareCard({part,onPreview}:{part:PartDef;onPreview:(id:string,remove:boolean)=>void}) {
 const {t}=useTranslation(),s=useMission(),workbench=useWorkbench(),qty=s.design!.parts.filter(item=>item.partId===part.id).reduce((sum,item)=>sum+item.qty,0),Icon=partIcons[part.category];
 return <article className="hardware-card" id={`part-${part.id}`} data-cue-target={`part-${part.id}`} onPointerEnter={()=>workbench.setHoveredCategory(part.category)} onPointerLeave={()=>workbench.setHoveredCategory(null)} onFocus={()=>workbench.setHoveredCategory(part.category)} onBlur={()=>workbench.setHoveredCategory(null)}>
  <div className="spread"><Icon size={20}/><span className="chip">{qty?`×${qty}`:t('flow.notInstalled')}</span></div><h3>{t(part.nameKey)}</h3><p>{t(`hud.benefit.${part.category}`)}</p>
  <p className="hardware-cost"><NumberValue value={part.cost.v} digits={0}/> {t('ui.budgetUnits')} · <NumberValue value={part.massKg.v} unit="kg"/></p>
  <details><summary>{t('hud.details')}</summary><p>{t(part.descKey)}</p><p>{t('ui.massCostPower',{mass:part.massKg.v,volume:part.volume.v,cost:part.cost.v,power:part.powerW.v})}</p>{part.generationW&&<p><NumberValue value={part.generationW.v} unit="W"/></p>}{part.capacityWh&&<p><NumberValue value={part.capacityWh.v} unit="Wh"/></p>}{part.rateKbps&&<p><NumberValue value={part.rateKbps.v} unit="kb/s"/></p>}<ExplainButton topic={categoryTopic[part.category]}/></details>
  <div className="button-wrap"><button className="button" data-cue-target="preview" disabled={!!s.sim} onClick={()=>onPreview(part.id,false)}>{t('ui.preview')}</button>{qty>0&&<button className="button" disabled={!!s.sim} onClick={()=>onPreview(part.id,true)}>{t('hud.remove')}</button>}</div>
 </article>;
}
export function DesignScreen({concept=false}:{concept?:boolean}) {
 const {t}=useTranslation(),s=useMission(),design=s.design!,budgets=s.budgets!,workbench=useWorkbench(),proposal=useProposal(),actor=s.actor();
 const [all,setAll]=useState(s.levelId==='EXPERT'),[preview,setPreview]=useState<{id:string;remove:boolean;revision:number;actor:ActorRole;before:Budgets;quote:Quote<{next:Design}>}|null>(null),[accepted,setAccepted]=useState<string|null>(null);
 const missing=missionRequirements(design).find(r=>r.id==='SCI-PAYLOAD-01'&&r.result!=='PASS')?'INSTRUMENT':missionRequirements(design).some(r=>r.id==='POWER-ECLIPSE-01'&&r.result!=='PASS')?'BATTERY':'SOLAR';
 const category=(workbench.selectedCategory??missing) as PartCategory;
 const parts=listParts(design.busId),visible=concept?parts.filter(part=>design.parts.some(item=>item.partId===part.id)):parts.filter(part=>all||part.category===category);
 useEffect(()=>{if(workbench.selectedCategory)setAll(false);},[workbench.selectedCategory]);
 useEffect(()=>()=>{useProposal.getState().clear();useWorkbench.getState().setPreviewPartId(null);},[]);
 useEffect(()=>{if(preview&&(preview.revision!==design.revision||preview.actor!==actor)){proposal.clear();workbench.setPreviewPartId(null);}},[design.revision,actor,preview,proposal.clear,workbench.setPreviewPartId]);
 const cancel=()=>{setPreview(null);proposal.clear();workbench.setPreviewPartId(null);};
 const propose=(id:string,remove:boolean)=>{
  const quote=remove?quoteRemovePart(design,id,actor):quoteAddPart(design,id,actor);setPreview({id,remove,revision:design.revision,actor,before:budgets,quote});
  if(quote.ok){const after=computeBudgets(quote.value.next);proposal.set(budgets,after,design.revision);if(!s.artifacts?.trade)s.recordTradeQuote(id,quote);workbench.setPreviewPartId(remove?null:id);}else{proposal.clear();workbench.setPreviewPartId(null);}
 };
 return <div className="phase-content" id={concept?'concept':'design'}>
  {accepted&&<p role="status">{t('hud.installed',{part:accepted})}</p>}
  <header className="phase-title"><h1>{t(concept?'ui.starter':'hud.workshop')}</h1><ExplainButton topic="systems-tradeoffs"/></header>
  {!!s.sim&&<ReadOnlyDesign/>}
  {!concept&&<><button className="button" data-cue-target="parts-guided" aria-expanded={all} onClick={()=>setAll(!all)}>{t(all?'hud.guidedParts':'ui.allParts')}</button><div className="category-picker" role="group" aria-label={t('ui.parts')}>{Object.keys(categoryTopic).map(item=><button className="button" key={item} data-cue-target={`parts-${item}`} aria-pressed={category===item&&!all} onClick={()=>{workbench.selectCategory(item);setAll(false);cancel();}}>{t(`ui.part.${item}`)}</button>)}</div></>}
  <div className="hardware-grid" id="parts" data-cue-target="parts">{visible.map(part=><HardwareCard key={part.id} part={part} onPreview={propose}/>)}</div>
  {preview&&<Panel className="quote-preview" id="choice-preview" title={t('ui.preview')}><h3>{t(parts.find(p=>p.id===preview.id)!.nameKey)}</h3>{preview.quote.ok?<><BudgetComparison before={preview.before} after={computeBudgets(preview.quote.value.next)}/><div className="button-wrap">{(preview.revision!==design.revision||preview.actor!==actor)&&<p role="status">{t('flow.stale')}</p>}<button className="button primary" data-cue-target="confirm" disabled={!!s.sim||preview.revision!==design.revision||preview.actor!==actor} onClick={()=>{const current=useMission.getState();if(current.sim||current.design?.revision!==preview.revision||current.actor()!==preview.actor)return;if(current.applyDesign(preview.quote)){setAccepted(t(parts.find(p=>p.id===preview.id)!.nameKey));cancel();}}}>{t(preview.remove?'hud.remove':'hud.install')}</button><button className="button" data-cue-target="choice-cancel" onClick={cancel}>{t('ui.cancel')}</button><button className="button" data-cue-target="choice-tour" onClick={()=>useTourStore.getState().start('choice','help')}>{t('control.tourQuote')}</button></div></>:<><RefusalNote refusal={preview.quote}/><button className="button" onClick={cancel}>{t('ui.cancel')}</button></>}</Panel>}
  <details><summary>{t('hud.modelLimits')}</summary><ExplainButton topic="concept-maturity"/><ExplainButton topic="model-assumptions"/></details>
 </div>;
}
