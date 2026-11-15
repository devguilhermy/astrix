import { useTranslation } from 'react-i18next';
import type { TurnMoment } from '../turnMoments';
import { useFeedbackCopy } from './copy';
import { seriesPoints, seriesRange } from './series';
import './feedback.css';

const WIDTH = 400, HEIGHT = 96;

/** Strip chart of the recorded dose-rate samples inside one turn, for missions that measure instead of imaging. */
export function ReadingChart({ moment }: { moment: TurnMoment }) {
  const fc = useFeedbackCopy(), { i18n } = useTranslation(), number = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2 });
  const values = moment.doseUGyH.map(sample => sample.value), range = seriesRange(values);
  return <figure className="fb-reading">
    <figcaption className="fb-reading-head"><strong>{fc('readingTitle')}</strong><span>µGy/h</span></figcaption>
    {range ? <>
      <svg className="fb-reading-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={fc('readingLabel', { min: number.format(range.min), max: number.format(range.max), count: values.length })}>
        <line x1="0" x2={WIDTH} y1="8" y2="8" className="fb-reading-grid"/>
        <line x1="0" x2={WIDTH} y1={HEIGHT - 8} y2={HEIGHT - 8} className="fb-reading-grid"/>
        <polyline points={seriesPoints(values.length === 1 ? [values[0]!, values[0]!] : values, WIDTH, HEIGHT, { range, pad: 8 })} className="fb-reading-line" vectorEffect="non-scaling-stroke"/>
      </svg>
      <dl className="fb-reading-range"><div><dt>{fc('readingMax')}</dt><dd>{number.format(range.max)} µGy/h</dd></div><div><dt>{fc('readingMin')}</dt><dd>{number.format(range.min)} µGy/h</dd></div></dl>
    </> : <p className="fb-muted">{fc('noReadings')}</p>}
    <p className="fb-reading-caption">{fc('readingCaption')}</p>
  </figure>;
}
