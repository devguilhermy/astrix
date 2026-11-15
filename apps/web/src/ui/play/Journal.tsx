import { useTranslation } from 'react-i18next';
import { missionById } from '@astrix/core';
import { labelText, missionBody, usesMoon } from '../missions/definitionView';
import { Duration, ScienceLibrary } from './Evidence';
import { usePlayCopy } from './copy';
import type { AttemptRecord } from './persistence';
import { ScienceConnection } from './ScienceConnection';

export function Journal({attempts}:{attempts:readonly AttemptRecord[]}) {
  const c=usePlayCopy(),{t,i18n}=useTranslation(),number=new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:2});
  const discoveries=new Map<string,{record:AttemptRecord;id:string}>();
  for(const record of attempts)for(const evidence of record.evidence)if(evidence.state==='MET')discoveries.set(`${record.config.missionId}:${record.config.ambition}:${evidence.id}`,{record,id:evidence.id});
  const references=new Map(attempts.map(record=>{const definition=missionById(record.config.missionId);return [usesMoon(definition)?'MOON':missionBody(definition),definition] as const;}));
  return <section><header className="play-page-heading"><h1>{c('journal')}</h1><p>{c('journalNote')}</p></header>
    {attempts.length===0?<p className="empty-state">{c('emptyJournal')}</p>:<>
      <ul className="journal-discoveries">{[...discoveries].map(([id,{record,id:objectiveId}])=>{
        const definition=missionById(record.config.missionId),objective=definition.objectives.find(item=>item.id===objectiveId),evidence=record.evidence.find(item=>item.id===objectiveId)!;
        return <li key={id}><strong>{objective&&record.config.ambition==='STANDARD'?labelText(t,objective.label):labelText(t,definition.name)}</strong> · {c(record.config.ambition)}<p>{evidence.actual===null?'—':number.format(evidence.actual)}{evidence.target!==null&&objective&&!['APOGEE_BAND','BOUND_ORBIT','ENCOUNTER_DISTANCE'].includes(objective.spec.kind)&&` / ${number.format(evidence.target)}`} {evidence.unit}</p></li>;
      })}</ul>
      <h2>{c('attempts')}</h2><ol className="journal-attempts">{[...attempts].reverse().map(record=><li key={record.id}><strong>{labelText(t,missionById(record.config.missionId).name)}</strong><p>{c(record.config.kit)} · {c(record.config.ambition)} · {c(record.config.approach)} · {c(record.config.levelId)}</p><p>{c(record.outcome==='SUCCESS'?'success':'failure')} · <Duration seconds={record.elapsedSec}/>{record.assisted&&` · ${c('assisted')}`}</p><small>{c('seed')}: {record.config.seed} · {c('rules')}: {record.rulesVersion} / {record.modelVersion}</small></li>)}</ol>
    </>}
    {[...references].map(([body,definition])=><ScienceConnection key={body} definition={definition}/>)}
    <ScienceLibrary/>
  </section>;
}
