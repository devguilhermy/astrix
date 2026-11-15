import { useTranslation } from 'react-i18next';
import './missions.css';
import { useMission } from '../../store';

type Provided = 'objectiveConfirmed' | 'segments' | 'trade' | 'baseline' | 'verification';
/**
 * Learning missions declare which work is provided in advance. This states exactly that, never completes it for the
 * player, and never claims safety or physics checks were waived.
 */
export function LearningProvided({ only }: { only?: Provided }) {
  const { t } = useTranslation();
  const definition = useMission(state => state.definition);
  const profile = definition.learning;
  if (!profile) return null;
  const done = profile.precompleted;
  const items: Provided[] = (['objectiveConfirmed', 'segments', 'trade', 'baseline', 'verification'] as const).filter(key => only ? key === only : true);
  const provided = items.filter(key => key === 'segments' ? Object.values(done.segments).every(Boolean) : done[key]);
  const start = definition.start.kind === 'PROVIDED_ORBIT' ? t(profile.startLabelKey) : null;
  if (!provided.length && !(start && !only)) return null;
  return <aside className="learning-provided" aria-label={t('learning.providedLabel')}>
    {start && !only && <p><strong>{start}</strong> {t('learning.startNote')}</p>}
    {provided.length > 0 && <p>{t('learning.providedItems', { items: provided.map(key => t(`learning.provided.${key}`)).join(', ') })}</p>}
    {only === 'verification' && <p className="muted">{t('learning.safetyNotWaived')}</p>}
  </aside>;
}
