import { useTranslation } from 'react-i18next';
import { missionRequirements } from '@astrix/core';
import { useMission } from '../../store';
import { ExplainButton } from '../science/ExplainButton';
import { RequirementTarget } from './RequirementTarget';

export function Requirements() {
 const {t}=useTranslation(),s=useMission(),d=s.design;
 if(!d)return null;
 const requirements=missionRequirements(d,s.sim??undefined),detailed=s.settings.presentation==='DETAILED';
 return <section id="requirements" data-cue-target="requirements" aria-labelledby="requirements-heading">
  <h2 id="requirements-heading">{t('hud.missionGoals')}</h2>
  <div className="mission-requirements">{requirements.filter(r=>detailed||['SCI-DATA-01','LAUNCH-MASS-01','SCI-PAYLOAD-01','POWER-ECLIPSE-01'].includes(r.id)).map(r=><article key={r.id} data-cue-target={`requirement-${r.id}`}><h3>{t(`hud.requirement.${r.id}`,{defaultValue:t('flow.requirements')})}</h3><p><RequirementTarget requirement={r} busId={d.busId}/></p><span className="requirement-result">{t(r.result==='NOT_EVALUATED'?'hud.forecastCheck':`flow.result.${r.result}`)}</span>{detailed&&<p>{r.id} · {t(`role.${r.owner}`)} · {t(`flow.method.${r.method}`)} · r{r.revision}</p>}</article>)}</div>
  <div data-cue-target="requirements-explain"><ExplainButton topic="requirements-verification"/></div>
  {!detailed&&<details data-cue-target="requirements-evidence"><summary>{t('hud.details')}</summary>{requirements.map(r=><p key={r.id}>{r.id} · <RequirementTarget requirement={r} busId={d.busId}/> · {t(`role.${r.owner}`)} · {t(`flow.method.${r.method}`)} · r{r.revision} · {t(`flow.result.${r.result}`)}</p>)}</details>}
 </section>;
}
