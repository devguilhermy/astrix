import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMission } from '../../store';
import { requestCue } from '../guide/cueStore';
import './flight.css';

export function EventToasts() {
 const { t } = useTranslation();
 const events = useMission(state => state.events);
 const attempt = useMission(state => state.attemptId);
 const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
 const recent = events.slice(-3).filter(event => !event.autoPause && !dismissed.has(`${event.kind}:${event.t}`));
 const latest = events.at(-1);
 useEffect(() => { setDismissed(new Set()); }, [attempt]);
 useEffect(() => {
  const ids = events.slice(-3).filter(event => !event.autoPause).map(event => `${event.kind}:${event.t}`);
  if (!ids.length) return;
  const timer = window.setTimeout(() => setDismissed(previous => new Set([...previous, ...ids])), 12000);
  return () => { window.clearTimeout(timer); };
 }, [latest]);
 if (!recent.length) return null;
 return <aside className="event-toasts" aria-label={t('flight.happened')} aria-live="polite" aria-atomic="false">{recent.map(event => {
  const id = `${event.kind}:${event.t}`;
  const target = event.kind.includes('POINTING') ? 'pilot' : event.kind.includes('COMMAND') || event.kind.includes('LINK') || event.kind.includes('PASS') ? 'hotbar' : 'resources';
  return <section className="event-toast" key={id}><strong>{t(`event.${event.kind}.title`, event.values)}</strong><p>{t(`event.${event.kind}.body`, event.values)}</p><div><button className="button" type="button" onClick={() => requestCue(target)}>{t('flight.show')}</button><button type="button" className="text-button" aria-label={`${t('flight.dismiss')} · ${t(`event.${event.kind}.title`, event.values)}`} onClick={() => setDismissed(previous => new Set([...previous, id]))}>×</button></div></section>;
 })}</aside>;
}
