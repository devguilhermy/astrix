import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BatteryMedium, Fuel, HardDrive, SatelliteDish, TriangleExclamationPoint, type LucideIcon } from 'lucide-react';
import { Duration } from '../Evidence';
import { usePlayCopy } from '../copy';
import { planIcons } from '../planIcons';
import type { TurnMoment } from '../turnMoments';
import { useFeedbackCopy } from '../feedback/copy';
import { formatSigned } from '../feedback/format';
import { seriesPoints } from '../feedback/series';
import { chipBadges, rovingIndex, type ChipBadgeKind } from './timeline';

const badgeIcons: Record<ChipBadgeKind, LucideIcon> = { data: SatelliteDish, stored: HardDrive, fuel: Fuel, energy: BatteryMedium };
const BAND = 48;

/**
 * One chip per committed turn under a band of objective progress and battery charge
 * aligned to the chips. Roving tabindex: arrows move, Enter or click selects.
 */
export function TurnTimeline({ moments, selected, onSelect }: { moments: readonly TurnMoment[]; selected: number | null; onSelect: (index: number) => void }) {
  const fc = useFeedbackCopy(), c = usePlayCopy(), { i18n } = useTranslation(), locale = i18n.resolvedLanguage, id = useId();
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const position = Math.max(0, moments.findIndex(moment => moment.index === selected)), count = moments.length;
  const [focus, setFocus] = useState(position), buttons = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => { setFocus(position); buttons.current[position]?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [position]);
  if (!count) return <div className="report-timeline-body"><h2 className="fb-visually-hidden">{fc('timeline.title')}</h2><p className="report-timeline-empty">{fc('report.noTurns')}</p></div>;
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = rovingIndex(index, event.key, count);
    if (next === null) return;
    event.preventDefault();
    setFocus(next);
    buttons.current[next]?.focus();
  };
  const twice = (values: number[]) => count === 1 ? [values[0]!, values[0]!] : values;
  const progress = moments.map(moment => moment.progress * 100), battery = moments.map(moment => moment.socPct ?? Number.NaN);
  const width = count === 1 ? 2 : count, range = { min: 0, max: 100 };
  return <div className="report-timeline-body">
    <h2 className="fb-visually-hidden" id={`${id}-title`}>{fc('timeline.title')}</h2>
    <p className="fb-visually-hidden" id={`${id}-hint`}>{fc('timeline.hint')}</p>
    <div className="report-timeline-track">
      <div className="report-timeline-lane" style={{ '--report-turns': count } as CSSProperties}>
        <div className="report-band">
          <svg viewBox={`0 0 ${width} ${BAND}`} preserveAspectRatio="none" role="img" aria-label={fc('timeline.band', { progress: progress.map(value => percent.format(value / 100)).join(', '), battery: battery.map(value => Number.isFinite(value) ? percent.format(value / 100) : '—').join(', ') })}>
            <rect className="report-band-selected" x={count === 1 ? 0 : position} y="0" width={count === 1 ? 2 : 1} height={BAND}/>
            <line className="report-band-grid" x1="0" x2={width} y1="6" y2="6" vectorEffect="non-scaling-stroke"/>
            <line className="report-band-grid" x1="0" x2={width} y1={BAND - 6} y2={BAND - 6} vectorEffect="non-scaling-stroke"/>
            <polyline className="report-band-battery" points={seriesPoints(twice(battery), width, BAND, { range, pad: 6, centred: true })} vectorEffect="non-scaling-stroke"/>
            <polyline className="report-band-progress" points={seriesPoints(twice(progress), width, BAND, { range, pad: 6, centred: true })} vectorEffect="non-scaling-stroke"/>
          </svg>
          <p className="report-band-legend" aria-hidden="true"><span className="report-legend-progress">{fc('timeline.progress')}</span><span className="report-legend-battery">{fc('timeline.battery')}</span></p>
        </div>
        <ol className="report-chips" aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`}>
          {moments.map((moment, index) => {
            const Icon = planIcons[moment.kind];
            return <li key={moment.receiptId} style={{ '--report-chip-index': index } as CSSProperties}>
              <button ref={element => { buttons.current[index] = element; }} type="button" className="report-chip" tabIndex={index === focus ? 0 : -1} aria-pressed={index === position} onClick={() => onSelect(moment.index)} onKeyDown={event => move(event, index)} onFocus={() => setFocus(index)}>
                <span className="report-chip-top"><span className="report-chip-number">{moment.index}</span><Icon size={16} aria-hidden="true"/><span className="report-chip-name">{c(`action.${moment.kind}`)}</span>{moment.interrupted && <span className="report-chip-alert"><TriangleExclamationPoint size={15} aria-hidden="true"/><span className="fb-visually-hidden">{fc('timeline.interrupted')}</span></span>}</span>
                <span className="report-chip-duration"><Duration seconds={moment.endSec - moment.startSec}/></span>
                <span className="report-chip-badges">{chipBadges(moment).map(badge => {
                  const BadgeIcon = badgeIcons[badge.kind];
                  return <span key={badge.kind} className={`report-chip-badge report-chip-badge-${badge.kind}`}><BadgeIcon size={13} aria-hidden="true"/><span className="fb-visually-hidden">{c(badge.kind)} </span>{formatSigned(badge.value, locale, badge.unit === 'MB' ? 2 : 1)} {badge.unit}</span>;
                })}</span>
              </button>
            </li>;
          })}
        </ol>
      </div>
    </div>
  </div>;
}
