import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listScenarios, type LevelId, type RoleId, type ScenarioId } from '@astrix/core';
import { ROLES, useMission } from '../../store';
import { HomeIllustration } from './HomeIllustration';

export interface SetupDraft {version:1;level:LevelId|null;mission:ScenarioId|null;players:number;assignments:Record<RoleId,number>}
export const emptyDraft:SetupDraft={version:1,level:'ASPIRING',mission:null,players:1,assignments:{SCIENCE:0,SPACECRAFT:0,LAUNCH_ORBIT:0,GROUND_COMMS:0}};
export function readDraft(key:string):SetupDraft|null {
 try {
  const value=JSON.parse(localStorage.getItem(key)??'null');if(value?.version!==1)return null;
  const players=Number.isInteger(value.players)&&value.players>=1&&value.players<=4?value.players:1;
  const assignments=Object.fromEntries(ROLES.map((role,index)=>{const player=value.assignments?.[role];return [role,Number.isInteger(player)&&player>=0&&player<players?player:index%players];})) as Record<RoleId,number>;
  return {version:1,level:value.level==='EXPERT'?'EXPERT':'ASPIRING',mission:listScenarios().some(s=>s.id===value.mission)?value.mission:null,players,assignments};
 }catch{return null;}
}
export function saveDraft(key:string,draft:SetupDraft):void {try{localStorage.setItem(key,JSON.stringify(draft));}catch{/* Optional device-local setup memory. */}}
export function Wizard({draft,onChange,onStart,onHome}:{draft:SetupDraft;onChange:(value:SetupDraft)=>void;onStart:()=>void;onHome:()=>void}){
 const {t}=useTranslation(),settings=useMission(s=>s.settings),[error,setError]=useState(false),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{history.replaceState(null,'','#setup/mission');document.title=`${t('hud.setupTitle')} — ASTRIX`;heading.current?.focus();},[t]);
 return <main className="home-screen wizard"><button className="brand" onClick={onHome}>ASTRIX</button><h1 tabIndex={-1} ref={heading}>{t('hud.setupTitle')}</h1>
  <fieldset className="setup-level"><legend>{t('flow.level')}</legend><div className="segmented">{(['ASPIRING','EXPERT'] as const).map(level=><button key={level} aria-pressed={draft.level===level} onClick={()=>{onChange({...draft,level});if(!settings.presentationExplicit)useMission.getState().setSettings({presentation:level==='EXPERT'?'DETAILED':'GUIDED',presentationExplicit:false});}}>{t(level==='ASPIRING'?'flow.aspiring':'flow.expert')}</button>)}</div></fieldset>
  {error&&<p role="alert">{t('flow.chooseMission')}</p>}
  <fieldset id="mission-options"><legend>{t('flow.mission')}</legend><div className="mission-grid">{listScenarios().map(scenario=><label className={`mission-card${draft.mission===scenario.id?' selected':''}`} key={scenario.id}><div className="setup-mission-art"><HomeIllustration mission={scenario.id}/></div><input type="radio" name="mission" aria-invalid={error||undefined} checked={draft.mission===scenario.id} onChange={()=>{onChange({...draft,mission:scenario.id});setError(false);}}/><strong>{t(scenario.nameKey)}</strong><p>{t(scenario.objectiveKey)}</p><details><summary>{t('hud.details')}</summary><p>{t(scenario.descKey)}</p></details></label>)}</div></fieldset>
  <details className="setup-team"><summary>{t('hud.teamOption')}</summary><label>{t('flow.players')}<select value={draft.players} onChange={event=>{const players=Number(event.target.value);onChange({...draft,players,assignments:Object.fromEntries(ROLES.map((role,i)=>[role,i%players])) as Record<RoleId,number>});}}>{[1,2,3,4].map(n=><option value={n} key={n}>{n===1?t('flow.solo'):t('ui.hotseat',{count:n})}</option>)}</select></label>{draft.players>1&&ROLES.map(role=><label key={role}>{t(`role.${role}`)}<select value={draft.assignments[role]} onChange={event=>onChange({...draft,assignments:{...draft.assignments,[role]:Number(event.target.value)}})}>{Array.from({length:draft.players},(_,i)=><option value={i} key={i}>{t('flow.player',{number:i+1})}</option>)}</select></label>)}</details>
  <div className="button-wrap"><button className="button primary" onClick={()=>{if(!draft.mission){setError(true);document.getElementById('mission-options')?.querySelector<HTMLInputElement>('input')?.focus();return;}onStart();}}>{t('hud.setupStart')}</button><button className="button" onClick={onHome}>{t('flow.cancel')}</button></div>
 </main>;
}
