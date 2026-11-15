import { useTranslation } from 'react-i18next';
import { Satellite, SatelliteDish } from 'lucide-react';
import { useFeedbackCopy } from './copy';
import './feedback.css';

/** Spacecraft → moving dashes → ground dish, with the data returned and what is still on board. Static under reduced motion. */
export function SignalStrip({ returnedMB, remainingMB }: { returnedMB: number; remainingMB: number }) {
  const fc = useFeedbackCopy(), { i18n } = useTranslation(), number = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2 });
  const value = number.format(returnedMB), remaining = number.format(Math.max(0, remainingMB));
  return <figure className="fb-signal" role="group" aria-label={fc('signalLabel', { value, remaining })}>
    <figcaption className="fb-signal-title">{fc('signalTitle')}</figcaption>
    <div className="fb-signal-path" aria-hidden="true">
      <span className="fb-signal-end"><Satellite size={22}/><small>{fc('spacecraft')}</small></span>
      <svg className="fb-signal-link" viewBox="0 0 200 12" preserveAspectRatio="none"><line x1="2" x2="198" y1="6" y2="6"/></svg>
      <span className="fb-signal-end"><SatelliteDish size={22}/><small>{fc('station')}</small></span>
    </div>
    <p className="fb-signal-values" aria-hidden="true"><strong>{fc('returned', { value })}</strong><span>{fc('remaining', { value: remaining })}</span></p>
  </figure>;
}
