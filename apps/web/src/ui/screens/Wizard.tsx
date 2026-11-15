import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { listMissions, type LevelId, type ResolvedMissionDefinition, type RoleId } from '@astrix/core';
import { ROLES, useMission } from '../../store';
import { Check, Gauge, Play, Rocket, ArrowUpRight, roleIcons } from '../icons';
import { HomeIllustration } from './HomeIllustration';
import { labelText } from '../missions/definitionView';
import { LibraryErrorNotice, LibraryPanel } from '../create/LibraryPanel';
import { blankDraft } from '../create/blank';
import type { DraftDefinition, LibraryError } from '../create/library';
import { editableCopy } from '../create/studioStore';

export type SetupTrack = 'LEARN' | 'CHALLENGE' | 'CREATE';
/** `mission` is a built-in id for LEARN/CHALLENGE, or a library id when `source` is LIBRARY (Create). */
export interface SetupDraft {version:2;level:LevelId|null;track:SetupTrack;mission:string|null;players:number;assignments:Record<RoleId,number>}
export const emptyDraft:SetupDraft={version:2,level:'ASPIRING',track:'LEARN',mission:null,players:1,assignments:{SCIENCE:0,SPACECRAFT:0,LAUNCH_ORBIT:0,GROUND_COMMS:0}};
const TRACKS:readonly SetupTrack[]=['LEARN','CHALLENGE','CREATE'];
const isTrack=(value:unknown):value is SetupTrack=>TRACKS.some(track=>track===value);
const builtinIds=()=>new Set(listMissions().map(definition=>definition.id));
/** Reads v2 drafts and migrates v1 (preset id only) so an earlier choice is not lost. */
export function readDraft(key:string):SetupDraft|null {
 try {
  const value=JSON.parse(localStorage.getItem(key)??'null');if(value?.version!==1&&value?.version!==2)return null;
  const players=Number.isInteger(value.players)&&value.players>=1&&value.players<=4?value.players:1;
  const assignments=Object.fromEntries(ROLES.map((role,index)=>{const player=value.assignments?.[role];return [role,Number.isInteger(player)&&player>=0&&player<players?player:index%players];})) as Record<RoleId,number>;
  const level:LevelId=value.level==='EXPERT'?'EXPERT':'ASPIRING';
  if(value.version===1)return {version:2,level,track:'CHALLENGE',mission:typeof value.mission==='string'&&builtinIds().has(value.mission)?value.mission:null,players,assignments};
  const track=isTrack(value.track)?value.track:'LEARN',mission=typeof value.mission==='string'&&(track==='CREATE'||builtinIds().has(value.mission))?value.mission:null;
  return {version:2,level,track,mission,players,assignments};
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
/** Learning ladder order, with the optional escape branch last among orbit lessons. */
const LEARN_ORDER=['FIRST_SIGNAL','UP_AND_BACK','STAY_IN_ORBIT','RAISE_YOUR_ORBIT','LEAVE_ORBIT_SAFELY','PAST_EARTH','MEET_THE_MOON','EARTH_TO_MOON'];
export function learningMissions():readonly ResolvedMissionDefinition[] {
 const learning=listMissions({origin:'LEARNING'});
 return [...learning].sort((a,b)=>(LEARN_ORDER.indexOf(a.id)+100)%100-(LEARN_ORDER.indexOf(b.id)+100)%100);
}
function MissionCard({definition,selected,name,onSelect,onEdit,children}:{definition:ResolvedMissionDefinition;selected:boolean;name:string;onSelect:()=>void;onEdit?:()=>void;children?:ReactNode}) {
 const {t}=useTranslation();
 return <div className={`mission-card${selected?' selected':''}`}>
  <div className="setup-mission-art"><HomeIllustration mission={definition.id}/></div>
  <label><input type="radio" name="mission" checked={selected} onChange={onSelect}/><strong>{labelText(t,definition.name)}</strong></label>
  <p>{labelText(t,definition.objectiveSummary)}</p>
  {children}
  <details><summary>{t('hud.details')}</summary><p>{labelText(t,definition.description)}</p></details>
  {onEdit&&<button type="button" className="button" onClick={onEdit} aria-label={t('setup.editCopyFor',{name})}>{t('setup.editCopy')}</button>}
  <span className="sr-only">{name}</span>
 </div>;
}
export function Wizard({draft,onChange,onStart,onHome,onOpenStudio,problem=null}:{draft:SetupDraft;onChange:(value:SetupDraft)=>void;onStart:()=>void;onHome:()=>void;onOpenStudio:(draft:DraftDefinition)=>void;problem?:LibraryError|null}) {
 const {t}=useTranslation(),settings=useMission(s=>s.settings),[error,setError]=useState(false),heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{history.replaceState(null,'','#setup/mission');document.title=`${t('hud.setupTitle')} — ASTRIX`;heading.current?.focus();},[t]);
 const start=()=>{if(!draft.mission){setError(true);document.getElementById('mission-options')?.querySelector<HTMLInputElement>('input')?.focus();return;}onStart();};
 const chooseLevel=(level:LevelId)=>{
  // Create is the Expert authoring path; an Expert starts there unless they already chose another track.
  onChange({...draft,level,track:level==='EXPERT'&&draft.mission===null&&draft.track==='LEARN'?'CREATE':draft.track});
  if(!settings.presentationExplicit)useMission.getState().setSettings({presentation:level==='EXPERT'?'DETAILED':'GUIDED',presentationExplicit:false});
 };
 const chooseTrack=(track:SetupTrack)=>{
  if(track===draft.track)return;
  setError(false);
  onChange({...draft,track,mission:null,level:track==='CREATE'?'EXPERT':draft.level});
  if(track==='CREATE'&&draft.level!=='EXPERT'&&!settings.presentationExplicit)useMission.getState().setSettings({presentation:'DETAILED',presentationExplicit:false});
 };
 const order=draft.level==='EXPERT'?(['CREATE','CHALLENGE','LEARN'] as const):TRACKS;
 const missions=draft.track==='LEARN'?learningMissions():draft.track==='CHALLENGE'?listMissions({origin:'BUILTIN'}):[];
 const editCopy=(definition:ResolvedMissionDefinition)=>onOpenStudio(editableCopy(definition,t));
 return <main className="home-screen wizard"><button className="brand" onClick={onHome}>ASTRIX</button><h1 tabIndex={-1} ref={heading}>{t('hud.setupTitle')}</h1>
  <fieldset className="setup-level"><legend>{t('flow.level')}</legend><div className="setup-level-cards">{(['ASPIRING','EXPERT'] as const).map(level=>{const Icon=level==='ASPIRING'?Rocket:Gauge,selected=draft.level===level;return <button type="button" className="setup-level-card" key={level} aria-pressed={selected} onClick={()=>chooseLevel(level)}><Icon size={28} aria-hidden="true"/><strong>{t(level==='ASPIRING'?'flow.aspiring':'flow.expert')}</strong><span>{t(level==='ASPIRING'?'flow.aspiringNote':'flow.expertNote')}</span>{selected&&<small><Check size={16} aria-hidden="true"/>{t('setup.selected')}</small>}</button>;})}</div></fieldset>
  <fieldset className="setup-track"><legend>{t('setup.track')}</legend><div className="setup-track-cards">{order.map(track=><button type="button" key={track} className={`setup-track-card${track==='CREATE'?' create':''}`} aria-pressed={draft.track===track} onClick={()=>chooseTrack(track)}><strong>{t(`setup.track.${track}`)}</strong><span>{t(`setup.track.${track}.note`)}</span></button>)}</div></fieldset>
  {problem&&<LibraryErrorNotice error={problem}/>}
  {error&&<p role="alert">{t(draft.track==='CREATE'?'setup.chooseSaved':'flow.chooseMission')}</p>}
  <fieldset id="mission-options"><legend>{t(`setup.track.${draft.track}`)}</legend>
   {draft.track==='CREATE'&&<section className="setup-create" aria-labelledby="setup-create-heading"><h2 id="setup-create-heading">{t('setup.createHeading')}</h2><p>{t('setup.createIntro')}</p>
    <div className="button-wrap"><button type="button" className="button primary" onClick={()=>onOpenStudio(blankDraft())}>{t('setup.startBlank')}</button>
     <label className="setup-duplicate">{t('setup.duplicateFrom')}<select defaultValue="" onChange={event=>{const picked=listMissions().find(item=>item.id===event.target.value);event.target.value='';if(picked)editCopy(picked);}}><option value="">{t('setup.chooseMissionOption')}</option>{listMissions().map(item=><option key={item.id} value={item.id}>{labelText(t,item.name)}</option>)}</select></label></div>
    <LibraryPanel selected={draft.mission} onSelect={id=>{setError(false);onChange({...draft,level:'EXPERT',mission:id});}} onOpen={onOpenStudio}/>
   </section>}
   {draft.track!=='CREATE'&&<div className="mission-grid">{missions.map(definition=>{
    const name=labelText(t,definition.name),learning=definition.learning;
    return <MissionCard key={definition.id} definition={definition} name={name} selected={draft.mission===definition.id} onSelect={()=>{onChange({...draft,mission:definition.id});setError(false);}} onEdit={draft.level==='EXPERT'?()=>editCopy(definition):undefined}>
     {definition.id==='PAST_EARTH'&&<span className="chip">{t('setup.optionalBranch')}</span>}
     {learning&&<p className="small muted">{t(`learning.decision.${definition.id}`,{defaultValue:t('learning.decision.default')})}</p>}
     {learning&&definition.start.kind==='PROVIDED_ORBIT'&&<p className="small muted">{t(learning.startLabelKey)}</p>}
    </MissionCard>;
   })}</div>}
  </fieldset>
  <details className="setup-team" open><summary>{t('hud.teamOption')}</summary><p>{t('setup.teamIntro')}</p><label className="setup-player-count">{t('flow.players')}<select value={draft.players} onChange={event=>{const players=Number(event.target.value);onChange({...draft,players,assignments:Object.fromEntries(ROLES.map((role,i)=>[role,i%players])) as Record<RoleId,number>});}}>{[1,2,3,4].map(n=><option value={n} key={n}>{n===1?t('flow.solo'):t('ui.hotseat',{count:n})}</option>)}</select></label>
   {draft.players>1&&<section className="setup-roles" aria-labelledby="setup-roles-heading"><h2 id="setup-roles-heading">{t('setup.roles')}</h2><p id="setup-role-hint">{t('setup.roleHint')}</p><div className="setup-player-list">{Array.from({length:draft.players},(_,player)=>{const owned=ROLES.filter(role=>draft.assignments[role]===player);return <section className="setup-player-column" key={player} aria-labelledby={`setup-player-${player}`}><h3 id={`setup-player-${player}`} tabIndex={-1}>{t('flow.player',{number:player+1})}</h3>{!owned.length&&<p>{t('setup.noRoles')}</p>}{owned.map((role,slot)=>{const Icon=roleIcons[role];return <label className="setup-role-choice" key={slot}><Icon size={20} aria-hidden="true"/><span className="sr-only">{t('setup.roleFor',{slot:slot+1,player:player+1})}</span><select value={role} aria-describedby="setup-role-hint" onChange={event=>onChange(swapDraftRole(draft,player,role,event.target.value as RoleId))}>{ROLES.filter(option=>option===role||draft.assignments[option]!==player).map(option=><option value={option} key={option}>{t('setup.roleOwner',{role:t(`role.${option}`),player:draft.assignments[option]+1})}</option>)}</select></label>;})}<label className="setup-add-role"><span>{t('setup.addRole')}</span><select value="" disabled={owned.length===ROLES.length} aria-describedby="setup-role-hint" onChange={event=>{if(!event.target.value)return;onChange(moveDraftRole(draft,event.target.value as RoleId,player));if(owned.length===ROLES.length-1)requestAnimationFrame(()=>document.getElementById(`setup-player-${player}`)?.focus());}}><option value="">{t(owned.length===ROLES.length?'setup.allRoles':'setup.chooseRole')}</option>{ROLES.filter(role=>!owned.includes(role)).map(role=><option value={role} key={role}>{t('setup.roleOwner',{role:t(`role.${role}`),player:draft.assignments[role]+1})}</option>)}</select></label></section>;})}</div></section>}
   <div className="setup-lan-option"><a className="button" href="/host">{t('lan.lanOption')}<ArrowUpRight size={18} aria-hidden="true"/></a><p>{t('setup.lanHint')}</p></div>
  </details>
  <div className="setup-start"><button type="button" className="setup-local-card" onClick={start}><Play size={30} aria-hidden="true"/><span><strong>{t('setup.localTitle')}</strong><span>{t(draft.players===1?'setup.localSolo':'setup.localTeam',{count:draft.players})}</span></span><span className="setup-local-action">{t('hud.setupStart')}<ArrowUpRight size={20} aria-hidden="true"/></span></button><button className="button" onClick={onHome}>{t('flow.cancel')}</button></div>
 </main>;
}
/** The chosen built-in definition; library selections are resolved by the caller from the current draft or latest published revision. */
export function builtinDefinition(draft:SetupDraft):ResolvedMissionDefinition|null {
 return draft.track==='CREATE'||!draft.mission?null:listMissions().find(definition=>definition.id===draft.mission)??null;
}
