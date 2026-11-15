import { useTranslation } from 'react-i18next';
import './missions.css';
import type { DefinitionLike } from './definitionView';
import { labelText, objectiveTarget } from './definitionView';
import { useMission } from '../../store';

/** Typed objectives with target, owner, interval and whether each decides success. Read-only; the studio edits the same rows. */
export function ObjectiveList({ definition }: { definition?: DefinitionLike }) {
  const { t, i18n } = useTranslation();
  const stored = useMission(state => state.definition);
  const source = definition ?? stored;
  const number = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2 });
  return <section className="objective-list" aria-labelledby="objective-list-heading">
    <h3 id="objective-list-heading">{t('objective.listTitle')}</h3>
    <ul>{source.objectives.map(objective => {
      const target = objectiveTarget(objective);
      const values = Object.fromEntries(Object.entries(target.values).map(([key, value]) => [key, typeof value === 'number' ? number.format(value) : t(`body.${String(value)}`, { defaultValue: String(value) })]));
      return <li key={objective.id}>
        <strong>{labelText(t, objective.label)}</strong>
        <span className={`chip ${objective.required ? 'required' : 'optional'}`}>{t(objective.required ? 'objective.required' : 'objective.optional')}</span>
        <p>{t(target.key, values)}</p>
        <small>{t('objective.owner', { role: t(`role.${objective.owner}`) })}
          {objective.deadlineSec !== null && <> · {t('objective.deadline', { time: number.format(objective.deadlineSec / 3600) })}</>}
          {objective.dwellSec > 0 && <> · {t('objective.dwell', { time: number.format(objective.dwellSec / 60) })}</>}
        </small>
      </li>;
    })}</ul>
    <p className="muted">{t('objective.noAveraging')}</p>
  </section>;
}
