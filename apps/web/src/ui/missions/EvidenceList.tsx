import { useTranslation } from 'react-i18next';
import './missions.css';
import type { ObjectiveEvidence } from '@astrix/core';
import { labelText } from './definitionView';
import { useMission } from '../../store';

/** Requirement evidence: what was measured, from which physical source, and whether it decides the outcome. */
export function EvidenceList({ evidence, label, predicted = false }: { evidence: readonly ObjectiveEvidence[] | undefined; label: string; predicted?: boolean }) {
  const { t, i18n } = useTranslation();
  const definition = useMission(state => state.definition);
  if (!evidence?.length) return null;
  const number = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2 });
  return <section className="evidence-list" aria-label={label} data-predicted={predicted || undefined}>
    <h3>{label}</h3>
    <ul>{evidence.map(item => {
      const objective = definition.objectives.find(candidate => candidate.id === item.id);
      return <li key={item.id} data-state={item.state}>
        <div className="spread"><strong>{objective ? labelText(t, objective.label) : item.id}</strong><span className={`chip state-${item.state}`}>{t(`evidence.state.${item.state}`)}</span></div>
        <p>
          {item.actual === null ? t('evidence.noMeasurement') : <><span className="number">{number.format(item.actual)}</span> {item.unit}</>}
          {item.target !== null && <> {t('evidence.of')} <span className="number">{number.format(item.target)}</span> {item.unit}</>}
        </p>
        {item.dwellRequiredSec > 0 && <progress aria-label={t('evidence.dwell')} max={item.dwellRequiredSec} value={Math.min(item.dwellRequiredSec, item.dwellHeldSec)}/>}
        <small>{t(item.required ? 'objective.required' : 'objective.optional')} · {t('objective.owner', { role: t(`role.${item.owner}`) })} · {t(`evidence.source.${item.source}`)}{item.metAtSec !== null && <> · {t('evidence.metAt', { time: number.format(item.metAtSec) })}</>}</small>
      </li>;
    })}</ul>
    <p className="muted">{t(predicted ? 'evidence.predictedNote' : 'evidence.actualNote')}</p>
  </section>;
}
