import { useTranslation } from 'react-i18next';
import { listScenarios } from '@astrix/core';
import { ROLES, useMission } from '../../store';
import { Panel } from '../primitives';
import { TeachingCard } from '../science/TeachingCard';

export function TeamSetup(){
 const {t}=useTranslation(),players=useMission(s=>s.players);
 return <Panel title={t('ui.players')}><div className="segmented">{[1,2,3,4].map(count=><button key={count} aria-pressed={players.length===count} className={players.length===count?'selected':''} onClick={()=>useMission.getState().setTeam(count)}>{count===1?t('ui.solo'):t('ui.hotseat',{count})}</button>)}</div>
 {players.length>1&&<div className="role-assignment">{ROLES.map(role=><label key={role}>{t(`role.${role}`)}<select value={players.findIndex(p=>p.includes(role))} onChange={event=>useMission.getState().assignRole(role,Number(event.target.value))}>{players.map((_,index)=><option key={index} value={index}>{t('ui.player',{number:index+1})}</option>)}</select></label>)}</div>}</Panel>;
}
export function Goal(){
 const {t}=useTranslation(),id=useMission(s=>s.scenarioId),scenario=listScenarios().find(item=>item.id===id)!;
 return <div className="phase-content" id="mission-goal"><header className="phase-title"><span className="eyebrow">{t('flow.need')}</span><h1>{t(scenario.nameKey)}</h1></header><h2>{t(scenario.objectiveKey)}</h2><TeachingCard topic="mission-goal" context={`mission.${id}`}/><details><summary>{t('hud.details')}</summary><p>{t(scenario.descKey)}</p></details></div>;
}
