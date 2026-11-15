import { useTranslation } from 'react-i18next';
import type { Refusal } from '@astrix/core';
import { useMission, ROLES } from '../../store';
import { Panel } from '../primitives';
import { ExplainButton } from '../science/ExplainButton';
import { topicForContext } from '../science/registry';
import { AlertIcon, Check, roleIcons, X } from '../icons';
import { cueToneOf } from '../../audio/cueTone';

export function RefusalNote({refusal}:{refusal:Refusal}) {
  const {t,i18n}=useTranslation();
  const values:Record<string,string|number>={...refusal.values};
  for(const [key,value] of Object.entries(values)) {
    if(key==='role')values[key]=t(`role.${value}`);
    else if(key==='needs')values[key]=t(i18n.exists(`ui.part.${value}`)?`ui.part.${value}`:`part.${value}.name`);
    else if(key==='missing')values[key]=t(`ui.requirement.${value}`);
    else if(key==='state')values[key]=t(`technical.computer.${value}`);
    else if(key==='levelId')values[key]=t(value==='ASPIRING'?'flow.aspiring':'flow.expert');
    else if(typeof value==='number')values[key]=new Intl.NumberFormat(i18n.language,{maximumFractionDigits:3}).format(value);
  }
  return <div className="refusal" role="status"><AlertIcon size={17}/><div>
    <p>{t(`refusal.${refusal.code}`,values)}</p>
    <ExplainButton topic={topicForContext(`refusal.${refusal.code}`)} context={`refusal.${refusal.code}`}/>
  </div></div>;
}
export function GlobalRefusal() {
  const refusal=useMission(s=>s.lastRefusal),clear=useMission(s=>s.clearRefusal),{t}=useTranslation();
  return refusal?<div className="global-refusal"><RefusalNote refusal={refusal}/><button className="icon-button" aria-label={t('ui.close')} onClick={clear}><X size={16}/></button></div>:null;
}
export function ReviewCoach() {
  const cues=useMission(s=>s.cues.active),flying=useMission(s=>!!s.sim),{t}=useTranslation();
  return <Panel title={<><AlertIcon size={16}/>{t('ui.coach')}</>} className="coach"><div className="cue-list">
    {!cues.length&&<p className="muted">{t(flying?'ui.noCuesFlight':'ui.noCues')}</p>}
    {cues.map(cue=><article className={`cue severity-${cue.severity}`} data-tone={cueToneOf(cue)} key={cue.id}>
      <h4>{t(`cue.${cue.ruleId}.title`,cue.params)}</h4><p>{t(`cue.${cue.ruleId}.body`,cue.params)}</p>
      <div className="spread"><span className="chip">{t(`role.${cue.role}`)}</span><ExplainButton topic={topicForContext(`cue.${cue.ruleId}`)} context={`cue.${cue.ruleId}`}/></div>
    </article>)}
  </div></Panel>;
}
export function Signoffs() {
  const {t}=useTranslation(),players=useMission(s=>s.players),signoffs=useMission(s=>s.signoffs),active=useMission(s=>s.activeRole),signOff=useMission(s=>s.signOff);
  return <section className="signoffs"><div className="spread"><h3>{t('ui.signoff')}</h3><ExplainButton topic="systems-tradeoffs"/></div>
    <div className="role-signoffs">{ROLES.map(role=>{const Icon=roleIcons[role];return <div key={role} className={signoffs[role]?'signed':''}><Icon size={15}/><span>{t(`role.${role}`)}</span>{signoffs[role]&&<Check size={15}/>}</div>;})}</div>
    <button className="button" onClick={signOff}>{t('ui.signoff')} · {t(`role.${players.length===1?'ALL':active}`)}</button>
  </section>;
}
