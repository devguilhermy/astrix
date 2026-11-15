import { useTranslation } from 'react-i18next';
import { SCIENCE_TOPICS } from '@astrix/data';
import { BookOpen } from '../icons';
import { useMission } from '../../store';
export type ScienceTopicId=keyof typeof SCIENCE_TOPICS;
export function ExplainButton({topic,context=`ui.${topic}`}:{topic:ScienceTopicId;context?:string}){const{t}=useTranslation();const title=t(SCIENCE_TOPICS[topic].titleKey);return <button className="explain" aria-label={t('ui.explainTopic',{topic:title})} onClick={e=>useMission.getState().openExplanation(topic,context,e.currentTarget)}><BookOpen size={15}/><span>{t('ui.explain')}</span></button>;}
