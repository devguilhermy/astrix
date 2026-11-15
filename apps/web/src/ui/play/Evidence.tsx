import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CONSTANTS, history, listAssumptions, listSources, telemetry, type ObjectiveEvidence, type ResolvedMissionDefinition, type TurnGameState } from '@astrix/core';
import { SCIENCE_TOPICS } from '@astrix/data';
import { objectiveTarget } from '../missions/definitionView';
import { usePlayCopy } from './copy';

export function Duration({seconds}:{seconds:number}) {
  const {i18n}=useTranslation(),pt=i18n.resolvedLanguage?.startsWith('pt'),value=seconds>=86400?seconds/86400:seconds>=3600?seconds/3600:seconds>=60?seconds/60:seconds;
  const singular=new Intl.PluralRules(i18n.resolvedLanguage).select(Math.round(value*10)/10)==='one';
  const unit=seconds>=86400?(pt?singular?'dia':'dias':singular?'day':'days'):seconds>=3600?'h':seconds>=60?'min':'s';
  return <span className="number">{new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:1}).format(value)} {unit}</span>;
}
export function Evidence({items,definition}:{items:readonly ObjectiveEvidence[];definition:ResolvedMissionDefinition}) {
  const c=usePlayCopy(),{t,i18n}=useTranslation(),number=new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:2});
  return <ul className="play-evidence">{items.map(item=>{
    const objective=definition.objectives.find(candidate=>candidate.id===item.id),target=item.target,actual=item.actual;
    const summary=objective?objectiveTarget(objective):null;
    return <li key={item.id} className={item.state==='MET'?'met':item.state==='FAILED'?'failed':''}><div><strong>{summary?t(summary.key,{...summary.values,body:typeof summary.values.body==='string'?c(summary.values.body):undefined}):item.kind}</strong><span>{c(item.state)}{!item.required&&` · ${c('optional')}`}</span></div><output>{actual===null?'—':number.format(actual)}{target!==null&&!['APOGEE_BAND','BOUND_ORBIT','ENCOUNTER_DISTANCE'].includes(item.kind)&&` / ${number.format(target)}`} {item.unit}</output>{item.dwellRequiredSec>0&&<small>{number.format(item.dwellHeldSec)} / {number.format(item.dwellRequiredSec)} s</small>}</li>;
  })}</ul>;
}

/** Optional Cartesian context is drawn from resolved telemetry, never used to judge an objective. */
export function FlightContext({game}:{game:TurnGameState}) {
  const c=usePlayCopy(),current=telemetry(game.sim);
  // Lunar flight history changes central bodies. Use explicit Earth-frame vectors throughout.
  const body=current.flight?'EARTH':game.design.orbit?.body??'EARTH';
  const position=current.flight?.view.earth.rKm??current.positionKm;
  const plot=useMemo(()=>{
    const samples=history(game.sim),stride=Math.max(1,Math.ceil(samples.length/180));
    const points=samples.filter((sample,index)=>index%stride===0&&(!current.flight||!!sample.flight)).map(sample=>sample.flight?.earthRKm??sample.positionKm);
    points.push(position);
    const radius=CONSTANTS[body].radius.v,extent=Math.max(radius*1.3,...points.map(point=>Math.max(Math.abs(point[0]),Math.abs(point[1]))));
    return {scale:145/extent,radius:145*radius/extent,path:points.map(point=>`${180+point[0]*145/extent},${160-point[1]*145/extent}`).join(' ')};
  },[game,current.flight,position,body]);
  return <figure className="flight-context"><svg viewBox="0 0 360 320" role="img" aria-label={c('position')}><circle cx="180" cy="160" r={plot.radius} fill="#284857"/><polyline points={plot.path} fill="none" stroke="#72dce5" strokeWidth="1.5"/><circle cx={180+position[0]*plot.scale} cy={160-position[1]*plot.scale} r="4" fill="#f1b777"/></svg><figcaption>{c(body)} · XY · km<p>{c('contextNote')}</p></figcaption></figure>;
}

export function ScienceLibrary({discoveryIds=[]}:{discoveryIds?:readonly string[]}) {
  const c=usePlayCopy(),{t,i18n}=useTranslation(),[...topics]=Object.values(SCIENCE_TOPICS);
  const requested=discoveryIds.map(id=>topics.find(topic=>topic.id===id)).filter(topic=>!!topic);
  const shown=requested.length?requested:topics.filter(topic=>['kepler-orbits','energy-budget','data-return','radiation','source-evidence'].includes(topic.id));
  const sources=listSources();
  return <section className="science-library"><h2>{c('science')}</h2><p>{c('sourceNote')}</p>{shown.map(topic=><details key={topic.id}><summary>{t(topic.titleKey)}</summary><p>{t(topic.summaryKey)}</p><p>{t(topic.contextKey)}</p><p>{t(topic.consequenceKey)}</p><p>{t(topic.limitationsKey)}</p>{topic.sourceIds.map(id=>{const source=sources.find(item=>item.id===id);return source?<a key={id} href={source.url} target="_blank" rel="noreferrer">{source.title} · {source.publisher}</a>:null;})}</details>)}
    <details><summary>{c('sources')}</summary><p>{i18n.resolvedLanguage?.startsWith('pt')?'Os resultados do jogo são simulados; medições arquivadas não são novas observações do jogador.':'Game outcomes are simulated; archived measurements are not new observations collected by the player.'}</p><ul>{sources.map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> · {source.publisher} · {source.retrieved}</li>)}</ul></details>
    <details><summary>{c('details')}</summary>{listAssumptions().map(item=><p key={item.key}>{t(`assumption.${item.key}`)} {typeof item.value==='number'?item.value:t(`assumptionValue.${item.key}`,{defaultValue:String(item.value)})}</p>)}</details>
  </section>;
}
