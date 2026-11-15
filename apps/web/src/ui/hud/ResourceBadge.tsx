// Card shell, threshold bar and preview adapted from Void Protocol ResourceBadge/StatusBar, pin 218625d (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Zap, Gauge, Send, Radio, Orbit, ShieldCheck } from '../icons';
import { ExplainButton } from '../science/ExplainButton';
import { Modal } from '../primitives';
import { useMission } from '../../store';
import { useWorkbench } from '../../three/spacecraft/workbenchState';
import { showWindow } from '../layout/windows';
import { requestCue } from '../guide/cueStore';
import type { ResourceModel } from './resourceModel';
const icons={mass:Box,power:Zap,budget:Gauge,data:Send,comms:Radio,time:Orbit,crew:ShieldCheck};
export function ResourceBadge({model:m}:{model:ResourceModel}){
 const {t,i18n}=useTranslation(),mission=useMission(),[open,setOpen]=useState(false),Icon=icons[m.id],format=new Intl.NumberFormat(i18n.language,{maximumFractionDigits:1});
 const nextContact=m.detail.find(item=>item.key==='flow.nextContact')?.value;
 const battery=m.id==='power'&&m.mode==='live';
 const value=m.value===null?t(m.status==='na'?'hud.na':'flow.unknown'):format.format(m.value);
 return <><button className="resource-badge" data-cue-target={`resource-${m.id}`} data-status={m.status} onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-label={`${t(`flow.${m.id}`)}: ${value} ${m.unit}, ${t(`hud.status.${m.status}`)}`}>
  <span className="resource-label"><Icon size={14}/><span className="resource-label-text">{t(`flow.${m.id}`)}</span></span>
  <span className="resource-value">{m.direction&&<span aria-hidden="true">{m.direction==='up'?'↑':m.direction==='down'?'↓':'→'} </span>}{m.id==='comms'&&m.mode==='live'?m.value===1?t('ui.connected'):nextContact==null?t('ui.noContact'):`${Math.ceil(nextContact)} s`:battery?`${format.format((m.limit??0)>0?(m.value??0)/m.limit!*100:0)}%`:value}{!battery&&m.limit!==null&&m.id!=='comms'&&<small> / {format.format(m.limit)}</small>} <small>{battery?'':m.unit}</small></span>
  <span className="resource-bar" aria-hidden="true"><span style={{width:`${m.fill*100}%`}}/>{m.previewFill!==null&&<i style={{left:`${Math.min(m.fill,m.previewFill)*100}%`,width:`${Math.abs(m.previewFill-m.fill)*100}%`}}/>}</span>
  <span className="resource-status">{t(`hud.status.${m.status}`)}{m.deltas?.length?m.deltas.map((delta,index)=><b key={index} title={t(delta.key)}> {delta.value!>0?'+':''}{format.format(delta.value!)} {delta.unit}</b>):m.delta!==null&&Math.abs(m.delta)>.001&&<b> {m.delta>0?'+':''}{format.format(m.delta)} {m.unit}</b>}</span>
  {battery&&<span className="resource-flow">{format.format(m.detail[0].value??0)} / {format.format(m.detail[1].value??0)} W</span>}
  {m.id==='time'&&<span className="data-return-ring" aria-hidden="true" style={{background:`conic-gradient(#72dce5 ${m.fill*100}%,#274251 0)`}}/>}
  {m.id==='comms'&&m.mode==='live'&&<span className="resource-flow">{t('hud.queue')}: {m.detail.find(item=>item.key==='hud.queue')?.value??0}</span>}
  {m.id==='data'&&m.mode==='live'&&<span className="data-return-ring" role="img" aria-label={`${t('hud.delivered')}: ${format.format(m.secondary?.value??0)} / ${format.format(m.detail.find(item=>item.key==='hud.target')?.value??0)}`} style={{background:`conic-gradient(#8af3c1 ${Math.min(100,(m.secondary?.value??0)/Math.max(1,m.detail.find(item=>item.key==='hud.target')?.value??1)*100)}%,#274251 0)`}}/>}
  {m.secondary&&<span className="resource-secondary">{t(m.secondary.key)}: {format.format(m.secondary.value??0)} {m.secondary.unit}</span>}
 </button>{open&&<Modal title={t(`flow.${m.id}`)} onClose={()=>setOpen(false)}><span className="chip">{t(`hud.${m.mode}`)}</span><dl>{m.detail.map((item,index)=><div key={`${item.key}-${index}`}><dt>{t(item.key)}</dt><dd>{item.value===null?t('flow.unknown'):format.format(item.value)} {item.unit}</dd></div>)}</dl>{m.id==='crew'&&m.status!=='na'&&<p>{t('hud.crewConditional')}</p>}<h3>{t('hud.changes')}</h3><div className="button-wrap">{m.changes.map(category=><button className="button" key={category} disabled={!mission.sim&&mission.furthestStage<3} title={!mission.sim&&mission.furthestStage<3?t('hud.unlockBuild'):undefined} onClick={()=>{setOpen(false);const s=useMission.getState();if(s.sim){showWindow('mission');return;}s.setStage('DESIGN');s.setSubstep(category==='orbit'?'orbit':'equipment');if(category!=='orbit')useWorkbench.getState().selectCategory(category==='crew'?'THERMAL':category);showWindow('mission',category==='orbit'?'#orbit':'#parts');requestCue(category==='orbit'?'orbit':'parts');}}>{t(category==='orbit'?'ui.orbit':category==='crew'?'flow.crew':`ui.part.${category}`)}</button>)}</div><ExplainButton topic={m.topic}/></Modal>}</>;
}
