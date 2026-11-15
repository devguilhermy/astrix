import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMission } from '../../store';
import { DecisionCard } from '../phases/Operate';
import './flight.css';

/** A decision is deliberately outside every collapsible window. It is not a
 * modal: Explain and keyboard camera alternatives remain reachable while paused.
 */
export function DecisionOverlay() {
 const { t } = useTranslation();
 const event = useMission(state => state.pendingDecisions[0]);
 const root = useRef<HTMLDivElement>(null);
 const opener = useRef<HTMLElement | null>(null);
 const identity = event ? `${event.kind}:${event.t}` : null;
 useLayoutEffect(() => {
  if (!identity) return;
  opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  root.current?.querySelector<HTMLElement>('#decision-heading')?.focus({ preventScroll: true });
  return () => { if ((!document.activeElement || document.activeElement === document.body || root.current?.contains(document.activeElement)) && opener.current?.isConnected) opener.current.focus({ preventScroll: true }); };
 }, [identity]);
 if (!event) return null;
 return <div className="decision-overlay" ref={root} role="region" aria-label={t('flight.decision')} data-cue-target="decision">
  <p className="decision-clock" role="status">{t('flight.decision')}</p>
  <DecisionCard event={event}/>
 </div>;
}
