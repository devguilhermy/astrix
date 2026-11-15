import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listScenarios, type LevelId, type RoleId, type ScenarioId } from '@astrix/core';
import { ROLES, useMission } from '../../store';
import { Check, Gauge, Play, Rocket, ArrowUpRight, roleIcons } from '../icons';
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

/** Role dropdowns exchange ownership; every responsibility remains assigned exactly once. */
export function swapDraftRole(draft:SetupDraft,player:number,previous:RoleId,next:RoleId):SetupDraft {
 if(previous===next||draft.assignments[next]===player)return draft;
 return {...draft,assignments:{...draft.assignments,[previous]:draft.assignments[next],[next]:player}};
}
/** Transfers an additional responsibility without restricting a player to a single role. */
export function moveDraftRole(draft:SetupDraft,role:RoleId,player:number):SetupDraft {
 if(draft.assignments[role]===player)return draft;
 return {...draft,assignments:{...draft.assignments,[role]:player}};
}
export function Wizard({draft,onChange,onStart,onHome}:{draft:SetupDraft;onChange:(value:SetupDraft)=>void;onStart:()=>void;onHome:()=>void}) {
 const {t}=useTranslation(),settings=useMission(s=>s.settings),[error,setError]=useState(false),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{history.replaceState(null,'','#setup/mission');document.title=`${t('hud.setupTitle')} — ASTRIX`;heading.current?.focus();},[t]);
 const start=()=>{if(!draft.mission){setError(true);document.getElementById('mission-options')?.querySelector<HTMLInputElement>('input')?.focus();return;}onStart();};
 return <main className="home-screen wizard"><button className="brand" onClick={onHome}>ASTRIX</button><h1 tabIndex={-1} ref={heading}>{t('hud.setupTitle')}</h1>
  <fieldset className="setup-level"><legend>{t('flow.level')}</legend><div className="setup-level-cards">{(['ASPIRING','EXPERT'] as const).map(level=>{const Icon=level==='ASPIRING'?Rocket:Gauge,selected=draft.level===level;return <button type="button" className="setup-level-card" key={level} aria-pressed={selected} onClick={()=>{onChange({...draft,level});if(!settings.presentationExplicit)useMission.getState().setSettings({presentation:level==='EXPERT'?'DETAILED':'GUIDED',presentationExplicit:false});}}><Icon size={28} aria-hidden="true"/><strong>{t(level==='ASPIRING'?'flow.aspiring':'flow.expert')}</strong><span>{t(level==='ASPIRING'?'flow.aspiringNote':'flow.expertNote')}</span>{selected&&<small><Check size={16} aria-hidden="true"/>{t('setup.selected')}</small>}</button>;})}</div></fieldset>
  {error&&<p role="alert">{t('flow.chooseMission')}</p>}
  <fieldset id="mission-options"><legend>{t('flow.mission')}</legend><div className="mission-grid">{listScenarios().map(scenario=><label className={`mission-card${draft.mission===scenario.id?' selected':''}`} key={scenario.id}><div className="setup-mission-art"><HomeIllustration mission={scenario.id}/></div><input type="radio" name="mission" aria-invalid={error||undefined} checked={draft.mission===scenario.id} onChange={()=>{onChange({...draft,mission:scenario.id});setError(false);}}/><strong>{t(scenario.nameKey)}</strong><p>{t(scenario.objectiveKey)}</p><details><summary>{t('hud.details')}</summary><p>{t(scenario.descKey)}</p></details></label>)}</div></fieldset>
  <details className="setup-team" open><summary>{t('hud.teamOption')}</summary><p>{t('setup.teamIntro')}</p><label className="setup-player-count">{t('flow.players')}<select value={draft.players} onChange={event=>{const players=Number(event.target.value);onChange({...draft,players,assignments:Object.fromEntries(ROLES.map((role,i)=>[role,i%players])) as Record<RoleId,number>});}}>{[1,2,3,4].map(n=><option value={n} key={n}>{n===1?t('flow.solo'):t('ui.hotseat',{count:n})}</option>)}</select></label>
   {draft.players>1&&<section className="setup-roles" aria-labelledby="setup-roles-heading"><h2 id="setup-roles-heading">{t('setup.roles')}</h2><p id="setup-role-hint">{t('setup.roleHint')}</p><div className="setup-player-list">{Array.from({length:draft.players},(_,player)=>{const owned=ROLES.filter(role=>draft.assignments[role]===player);return <section className="setup-player-column" key={player} aria-labelledby={`setup-player-${player}`}><h3 id={`setup-player-${player}`} tabIndex={-1}>{t('flow.player',{number:player+1})}</h3>{!owned.length&&<p>{t('setup.noRoles')}</p>}{owned.map((role,slot)=>{const Icon=roleIcons[role];return <label className="setup-role-choice" key={slot}><Icon size={20} aria-hidden="true"/><span className="sr-only">{t('setup.roleFor',{slot:slot+1,player:player+1})}</span><select value={role} aria-describedby="setup-role-hint" onChange={event=>onChange(swapDraftRole(draft,player,role,event.target.value as RoleId))}>{ROLES.filter(option=>option===role||draft.assignments[option]!==player).map(option=><option value={option} key={option}>{t('setup.roleOwner',{role:t(`role.${option}`),player:draft.assignments[option]+1})}</option>)}</select></label>;})}<label className="setup-add-role"><span>{t('setup.addRole')}</span><select value="" disabled={owned.length===ROLES.length} aria-describedby="setup-role-hint" onChange={event=>{if(!event.target.value)return;onChange(moveDraftRole(draft,event.target.value as RoleId,player));if(owned.length===ROLES.length-1)requestAnimationFrame(()=>document.getElementById(`setup-player-${player}`)?.focus());}}><option value="">{t(owned.length===ROLES.length?'setup.allRoles':'setup.chooseRole')}</option>{ROLES.filter(role=>!owned.includes(role)).map(role=><option value={role} key={role}>{t('setup.roleOwner',{role:t(`role.${role}`),player:draft.assignments[role]+1})}</option>)}</select></label></section>;})}</div></section>}
   <div className="setup-lan-option"><a className="button" href="/host">{t('lan.lanOption')}<ArrowUpRight size={18} aria-hidden="true"/></a><p>{t('setup.lanHint')}</p></div>
  </details>
  <div className="setup-start"><button type="button" className="setup-local-card" onClick={start}><Play size={30} aria-hidden="true"/><span><strong>{t('setup.localTitle')}</strong><span>{t(draft.players===1?'setup.localSolo':'setup.localTeam',{count:draft.players})}</span></span><span className="setup-local-action">{t('hud.setupStart')}<ArrowUpRight size={20} aria-hidden="true"/></span></button><button className="button" onClick={onHome}>{t('flow.cancel')}</button></div>
 </main>;
}
