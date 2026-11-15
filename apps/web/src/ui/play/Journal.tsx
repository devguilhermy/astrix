import { useTranslation } from 'react-i18next';
import { missionById } from '@astrix/core';
import { labelText, missionBody, usesMoon } from '../missions/definitionView';
import { Duration, ScienceLibrary } from './Evidence';
import { usePlayCopy } from './copy';
import { useFeedbackCopy } from './feedback/copy';
import { Stars } from './feedback/Stars';
import type { AttemptRecord } from './persistence';
import { ScienceConnection } from './ScienceConnection';
import './journal.css';

export function Journal({attempts}:{attempts:readonly AttemptRecord[]}) {
  const c=usePlayCopy(),fc=useFeedbackCopy(),{t,i18n}=useTranslation(),number=new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:2});
  const discoveries=new Map<string,{record:AttemptRecord;id:string}>();
  for(const record of attempts)for(const evidence of record.evidence)if(evidence.state==='MET')discoveries.set(`${record.config.missionId}:${record.config.ambition}:${evidence.id}`,{record,id:evidence.id});
  const references=new Map(attempts.map(record=>{const definition=missionById(record.config.missionId);return [usesMoon(definition)?'MOON':missionBody(definition),definition] as const;}));
  return <section><header className="play-page-heading"><h1>{c('journal')}</h1><p>{c('journalNote')}</p></header>
    {attempts.length===0?<p className="empty-state">{c('emptyJournal')}</p>:<>
      <ul className="journal-discoveries">{[...discoveries].map(([id,{record,id:objectiveId}])=>{
        const definition=missionById(record.config.missionId),objective=definition.objectives.find(item=>item.id===objectiveId),evidence=record.evidence.find(item=>item.id===objectiveId)!;
        return <li key={id}><strong>{objective&&record.config.ambition==='STANDARD'?labelText(t,objective.label):labelText(t,definition.name)}</strong> · {c(record.config.ambition)}<p>{evidence.actual===null?'—':number.format(evidence.actual)}{evidence.target!==null&&objective&&!['APOGEE_BAND','BOUND_ORBIT','ENCOUNTER_DISTANCE'].includes(objective.spec.kind)&&` / ${number.format(evidence.target)}`} {evidence.unit}</p></li>;
      })}</ul>
      <h2>{c('attempts')}</h2><ol className="jr-attempts">{[...attempts].reverse().map(record=><li key={record.id} className="jr-attempt">
        <div className="jr-mission"><strong>{labelText(t,missionById(record.config.missionId).name)}</strong><span>{c(record.config.kit)} · {c(record.config.ambition)} · {c(record.config.approach)} · {c(record.config.levelId)}</span></div>
        <div className="jr-outcome"><span className={record.outcome==='SUCCESS'?'jr-met':'jr-missed'}>{c(record.outcome==='SUCCESS'?'success':'failure')}</span><span><Duration seconds={record.elapsedSec}/>{record.assisted&&` · ${c('assisted')}`}{record.turns!==undefined&&` · ${fc('journal.turns',{count:record.turns})}`}</span><small>{c('seed')}: {record.config.seed} · {c('rules')}: {record.rulesVersion} / {record.modelVersion}</small></div>
        <div className="jr-score">{record.score!==undefined?<>{record.stars!==undefined&&<Stars count={record.stars}/>}<span>{fc('scoreOf',{value:record.score})}</span></>:<span className="jr-unscored">{fc('journal.noScore')}</span>}</div>
      </li>)}</ol>
    </>}
    <details className="jr-science"><summary>{c('science')}</summary>
      {[...references].map(([body,definition])=><ScienceConnection key={body} definition={definition}/>)}
      <ScienceLibrary/>
    </details>
  </section>;
}
