import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RADLAB_PROFILE, SCIENCE_TOPICS, type ScienceTopicId } from '@astrix/data';
import { listSources, listAssumptions } from '@astrix/core';
import { STAGES, useMission } from '../../store';
import { Modal, NumberValue } from '../primitives';
import { ScienceDiagram } from './ScienceDiagram';
import { isScienceTopicId, scienceTopic } from './registry';
import { BookOpen, Search, ChevronLeft, ArrowUpRight } from '../icons';
import { showWindow } from '../layout/windows';

function revealTopic(target:string|undefined):{window:'mission'|'readiness'|'log';selector:string;stage?:'NEED_GOALS'|'DESIGN'|'IMPLEMENT'|'REVIEW';substep?:string}|null {
 const state=useMission.getState();
 if(!target||!state.design||typeof document==='undefined'||!document.querySelector('.simulator-persistent:not([hidden])'))return null;
 if(document.querySelector('[role="dialog"]:not(.science-drawer)'))return null;
 if(['budgets','fit-budget','cost-budget','energy-budget','data-budget'].includes(target))return {window:'readiness',selector:`#${target}`};
 if(target.startsWith('technical-'))return state.sim?{window:'mission',selector:`#${target}`,stage:'IMPLEMENT',substep:'operations'}:state.budgets?.technical?{window:'readiness',selector:'#technical-forecast'}:null;
 if(target==='mission-goal'&&!state.sim)return {window:'mission',selector:'#mission-goal',stage:'NEED_GOALS',substep:'brief'};
 if(['design','parts'].includes(target)&&!state.sim)return {window:'mission',selector:`#${target}`,stage:'DESIGN',substep:'equipment'};
 if(['rides','orbit','fuel-planner'].includes(target)&&!state.sim)return {window:'mission',selector:`#${target}`,stage:'DESIGN',substep:'orbit'};
 if(['report','dose-chart'].includes(target)&&state.telemetry?.ended)return {window:'mission',selector:`#${target}`,stage:'REVIEW',substep:'results'};
 if(target==='command-queue'&&state.sim)return {window:'log',selector:'#command-queue',stage:'IMPLEMENT',substep:'operations'};
 if(['commands','cruise'].includes(target)&&state.sim)return {window:'mission',selector:target==='commands'?'#science-return':'#cruise',stage:'IMPLEMENT',substep:'operations'};
 return null;
}

export function ScienceDrawer() {
  const explanation=useMission(s=>s.explanation);
  const close=useMission(s=>s.closeExplanation);
  const {t}=useTranslation();
  const [query,setQuery]=useState('');
  const [back,setBack]=useState<ScienceTopicId[]>([]);
  const onClose=useCallback(()=>{setBack([]);setQuery('');close();},[close]);
  if(!explanation)return null;
  const topic=SCIENCE_TOPICS[explanation.topicId];
  const snapshot=explanation.snapshot;
  const sources=listSources();
  const filtered=Object.values(SCIENCE_TOPICS).filter(item=>`${t(item.titleKey)} ${t(item.summaryKey)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const navigate=(id:string)=>{
    if(!isScienceTopicId(id))throw new Error(`Missing science topic: ${id}`);
    setBack([...back,explanation.topicId]);
    useMission.setState({explanation:{...explanation,topicId:id}});
    setQuery('');
  };
  const candidate=revealTopic(topic.target),reveal=candidate?.stage&&!useMission.getState().sim&&STAGES.indexOf(candidate.stage)>STAGES.indexOf(useMission.getState().activeStage)?null:candidate;
  const showMe=()=>{
    setBack([]);setQuery('');close(false);
    if(!reveal)return;
    const state=useMission.getState();
    if(reveal.stage)state.setStage(reveal.stage);
    if(reveal.substep)useMission.getState().setSubstep(reveal.substep);
    // Resolve after the new view commits, not while its panel is hidden.
    requestAnimationFrame(()=>requestAnimationFrame(()=>showWindow(reveal.window,reveal.selector)));
  };
  return <Modal className="science-drawer" title={t(topic.titleKey)} onClose={onClose}>
    <div className="search-field"><Search size={18}/><input aria-label={t('ui.search')} placeholder={t('ui.search')} value={query} onChange={e=>setQuery(e.target.value)}/></div>
    {query?<nav className="topic-list">{filtered.length?filtered.map(item=><button key={item.id} onClick={()=>navigate(item.id)}><BookOpen size={16}/>{t(item.titleKey)}</button>):<p>{t('ui.noTopics')}</p>}</nav>:<>
      {back.length>0&&<button className="text-button" onClick={()=>{
        const previous=back.at(-1)!;setBack(back.slice(0,-1));
        useMission.setState({explanation:{...explanation,topicId:previous}});
      }}><ChevronLeft size={16}/>{t('ui.back')}</button>}
      <section><h3>{t('ui.summary')}</h3><p className="science-summary">{t(topic.summaryKey)}</p></section>
      <section><h3>{t('ui.context')}</h3><p>{t(topic.contextKey)}</p>
        {snapshot.budgets&&<div className="snapshot"><strong>{t('ui.snapshot')}</strong><dl>
          <dt>{t('ui.weight')}</dt><dd><NumberValue value={snapshot.budgets.massKg.used} unit="kg"/></dd>
          <dt>{t('ui.generation')}</dt><dd>{snapshot.budgets.power?<><NumberValue value={snapshot.budgets.power.avgGenW} unit="W"/> / <NumberValue value={snapshot.budgets.power.avgLoadW} unit="W"/></>:t('ui.notEstimated')}</dd>
          {snapshot.budgets.power&&<><dt>{t('ui.shadowBattery')}</dt><dd><NumberValue value={snapshot.budgets.power.usableBatteryWh} unit="Wh"/> / <NumberValue value={snapshot.budgets.power.eclipseWh} unit="Wh"/></dd></>}
          {snapshot.budgets.orbit&&<><dt>{t('ui.eclipse')}</dt><dd><NumberValue value={snapshot.budgets.orbit.eclipseFrac*100} unit="%"/></dd><dt>{t('ui.period')}</dt><dd><NumberValue value={snapshot.budgets.orbit.periodMin} unit="min"/></dd></>}
          {snapshot.budgets.deltaV&&<><dt>{t('ui.deltaV')}</dt><dd><NumberValue value={snapshot.budgets.deltaV.availableKms} unit="km/s"/> / <NumberValue value={snapshot.budgets.deltaV.requiredKms} unit="km/s"/></dd></>}
          {snapshot.telemetry&&<><dt>{t('ui.time')}</dt><dd><NumberValue value={snapshot.telemetry.t} unit="s"/></dd><dt>{t('ui.shadowBattery')}</dt><dd><NumberValue value={snapshot.telemetry.socWh} unit="Wh"/> / <NumberValue value={snapshot.telemetry.capacityWh} unit="Wh"/></dd><dt>{t('ui.commandDelay')}</dt><dd>{snapshot.telemetry.lightTimeSec===null?t('ui.notEstimated'):<NumberValue value={snapshot.telemetry.lightTimeSec} unit="s"/>}</dd><dt>{t('ui.commands')}</dt><dd><NumberValue value={snapshot.telemetry.queued} digits={0}/></dd></>}
        </dl></div>}
      </section>
      <ScienceDiagram topic={topic}/>
      <section><h3>{t('ui.consequence')}</h3><p>{t(topic.consequenceKey)}</p>{reveal&&<button className="button" onClick={showMe}>{t('ui.showMe')}<ArrowUpRight size={16}/></button>}</section>
      <details><summary>{t('ui.deeper')}</summary><p>{t(topic.deeperKey)}</p><h4>{t('hud.modelLimits')}</h4><p>{t(topic.limitationsKey)}</p></details>
      <section><h3>{t('ui.evidence')}</h3><p>{t('ui.calculated')}</p>
        {topic.sourceIds.map(id=>{
          const source=sources.find(s=>s.id===id);
          if(!source)throw new Error(`Missing scientific source: ${id}`);
          return <div key={id}><span className="chip">{t(id==='model-assumptions'?'ui.assumed':'ui.reference')}</span><a className="source-link" href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={14}/><small>{source.publisher} · {t('ui.retrieved',{date:source.retrieved})}</small></a></div>;
        })}
        {(explanation.topicId==='radiation'||explanation.topicId==='source-evidence')&&<div className="snapshot"><p>{t('ui.snapshotInterval',{start:RADLAB_PROFILE.hourly[0].hour,end:RADLAB_PROFILE.hourly.at(-1)!.hour})}</p><p>{t('ui.retrieved',{date:RADLAB_PROFILE.retrieved})}</p></div>}
        {(explanation.topicId==='source-evidence'||explanation.topicId==='model-assumptions')&&<>
          <h4>{t('ui.sources')}</h4>
          {sources.map(source=><a className="source-link" key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.title}<small>{source.listedByChallenge?t('ui.listed'):source.publisher} · {t('ui.retrieved',{date:source.retrieved})}</small></a>)}
          <h4>{t('ui.assumed')}</h4>{listAssumptions().map(a=><p key={a.key}>{t(`assumption.${a.key}`)} {typeof a.value==='number'?<NumberValue value={a.value} digits={5}/>:a.key.startsWith('scenario.')?<span className="number">{a.value}</span>:t(`assumptionValue.${a.key}`)}</p>)}
        </>}
      </section>
      <section><h3>{t('ui.related')}</h3><div className="button-wrap">{topic.related.map(id=><button className="chip" key={id} onClick={()=>navigate(id)}>{t(scienceTopic(id).titleKey)}</button>)}</div></section>
      <details><summary>{t('ui.glossary')}</summary><nav className="topic-list">{Object.values(SCIENCE_TOPICS).map(item=><button key={item.id} onClick={()=>navigate(item.id)}>{t(item.titleKey)}</button>)}</nav></details>
    </>}
    {useMission.getState().learningPause&&<p className="learning-note">{t('ui.learningPaused')}</p>}
  </Modal>;
}
