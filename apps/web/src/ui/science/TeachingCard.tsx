import { useTranslation } from 'react-i18next';
import { SCIENCE_BINDINGS, SCIENCE_TOPICS, type ScienceTopicId } from '@astrix/data';
import { ExplainButton } from './ExplainButton';
/** Introductions are optional reading; guidance is handled by state-driven CAPCOM steps. */
export function TeachingCard({topic,context,values,consequence,compact=false}:{topic:ScienceTopicId;context:string;values?:Readonly<Record<string,number|string>>;consequence?:string;compact?:boolean}){
 const {t}=useTranslation(),lesson=SCIENCE_TOPICS[topic];
 return <aside className="teaching-card"><ExplainButton topic={topic} context={context}/><details><summary>{t(lesson.titleKey)}</summary><p>{t(lesson.summaryKey)}</p>{!compact&&<p>{t(lesson.contextKey)}</p>}{values&&<dl>{Object.entries(values).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}{consequence&&<p>{consequence}</p>}<h4>{t('hud.modelLimits')}</h4><p>{t(lesson.limitationsKey)}</p></details></aside>;
}
export function TeachingContexts({contexts,values}:{contexts:readonly string[];values?:Readonly<Record<string,number|string>>}){
 const context=contexts.find(item=>(SCIENCE_BINDINGS[item]?.length??0)>0),topic=context?SCIENCE_BINDINGS[context]?.[0]:undefined;return context&&topic?<TeachingCard topic={topic} context={context} values={values}/>:null;
}
