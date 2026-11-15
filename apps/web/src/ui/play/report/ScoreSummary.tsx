import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TurnGameState } from '@astrix/core';
import { missionScore } from '../turnMoments';
import { useFeedbackCopy } from '../feedback/copy';
import { useReducedMotion } from '../feedback/motion';
import { Stars } from '../feedback/Stars';

const RADIUS = 40, CIRCUMFERENCE = 2 * Math.PI * RADIUS, COUNT_MS = 900;

/** Total out of 100 in a ring, 0-5 stars and the five weighted components of the unchanged core score. */
export function ScoreSummary({ game }: { game: TurnGameState }) {
  const fc = useFeedbackCopy(), { t, i18n } = useTranslation(), id = useId(), reduced = useReducedMotion();
  const points = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 });
  const score = useMemo(() => missionScore(game), [game]), total = score.total;
  const [shown, setShown] = useState(() => reduced || typeof requestAnimationFrame !== 'function' ? total : 0);
  useEffect(() => {
    if (reduced || typeof requestAnimationFrame !== 'function') { setShown(total); return; }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_MS);
      setShown(Math.round(total * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [total, reduced]);
  const capped = (score.outcome === 'FAILURE' || score.outcome === 'INCOMPLETE') && score.rawTotal > 19;
  return <section className="report-score" aria-labelledby={`${id}-score`}>
    <div className="report-score-head">
      <svg className="report-score-ring" viewBox="0 0 96 96" role="img" aria-label={fc('scoreValue', { value: total })}>
        <circle className="report-score-track" cx="48" cy="48" r={RADIUS}/>
        <circle className="report-score-fill" cx="48" cy="48" r={RADIUS} strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - Math.min(100, Math.max(0, shown)) / 100)} transform="rotate(-90 48 48)"/>
        <text className="report-score-total" x="48" y="50" textAnchor="middle" dominantBaseline="middle" aria-hidden="true">{shown}</text>
        <text className="report-score-max" x="48" y="70" textAnchor="middle" aria-hidden="true">/ 100</text>
      </svg>
      <div className="report-score-text">
        <h2 id={`${id}-score`}>{fc('scoreTitle')}</h2>
        <Stars count={score.stars} size={20}/>
        {capped && <p className="report-score-cap">{fc('scoreCap')} <span>{fc('scoreUncapped', { value: score.rawTotal })}</span></p>}
      </div>
    </div>
    <ul className="report-components" aria-label={fc('components')}>
      {score.components.map(component => <li key={component.key}>
        <span className="report-component-label">{t(component.key)}</span>
        <span className="report-component-bar" aria-hidden="true"><span style={{ width: `${Math.min(1, Math.max(0, component.value)) * 100}%` }}/></span>
        <output>{fc('points', { value: points.format(component.weight * component.value * 100), max: points.format(component.weight * 100) })}</output>
      </li>)}
    </ul>
    <p className="report-score-note">{fc('soloTeam')}</p>
  </section>;
}
