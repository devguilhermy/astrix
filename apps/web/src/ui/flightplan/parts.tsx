import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AscentPreview, OrbitTelemetry, TrajectoryEvent } from '@astrix/core';

export function useNumbers(maximumFractionDigits = 2) {
  const { i18n } = useTranslation();
  return useMemo(() => new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits }), [i18n.resolvedLanguage, maximumFractionDigits]);
}
export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="kv-row"><dt>{label}</dt><dd>{children}</dd></div>;
}
const timeText = (seconds: number) => {
  const sign = seconds < 0 ? '-' : '', value = Math.abs(seconds), d = Math.floor(value / 86400), h = Math.floor(value % 86400 / 3600), m = Math.floor(value % 3600 / 60), s = Math.floor(value % 60);
  return `${sign}${d ? `${d}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
export const formatClock = timeText;

/** Chronological trajectory events (liftoff, staging, burns, sphere-of-influence changes, closest approach). */
export function TrajectoryEvents({ events, limit = 14, label }: { events: readonly TrajectoryEvent[]; limit?: number; label: string }) {
  const { t } = useTranslation(), number = useNumbers(), shown = events.slice(-limit);
  if (!shown.length) return <p className="muted">{t('flight.noEvents')}</p>;
  return <ol className="trajectory-events" aria-label={label}>{shown.map((event, index) => <li key={`${event.kind}:${event.t}:${index}`}><span className="number">T+ {timeText(event.t)}</span> <strong>{t(`flight.traj.${event.kind}`, { defaultValue: event.kind })}</strong> <small>{t(`flight.body.${event.body}`)}{Object.entries(event.values).slice(0, 3).map(([key, value]) => ` · ${t(`flight.value.${key}`, { defaultValue: key })} ${typeof value === 'number' ? number.format(value) : value}`).join('')}</small></li>)}</ol>;
}

/** Osculating orbit of the actual (or predicted) state, from the engine's own elements. */
export function OrbitSummary({ orbit }: { orbit: OrbitTelemetry }) {
  const { t } = useTranslation(), number = useNumbers();
  const km = (value: number | null) => value === null ? t('flight.unbound') : <>{number.format(value)} km</>;
  return <dl className="kv-grid">
    <Row label={t('flight.orbit.kind')}>{t(`flight.orbit.${orbit.kind}`)} · {t(`flight.body.${orbit.body}`)}</Row>
    <Row label={t('flight.orbit.periapsis')}>{km(orbit.periapsisAltKm)}</Row>
    <Row label={t('flight.orbit.apoapsis')}>{km(orbit.apoapsisAltKm)}</Row>
    <Row label={t('flight.orbit.inclination')}>{number.format(orbit.inclinationDeg)}°</Row>
    <Row label={t('flight.orbit.period')}>{orbit.periodSec === null ? t('flight.unbound') : timeText(orbit.periodSec)}</Row>
    {orbit.vInfKms !== null && <Row label={t('flight.orbit.vInf')}>{number.format(orbit.vInfKms)} km/s</Row>}
    <Row label={t('flight.orbit.energy')}>{number.format(orbit.specificEnergyKm2s2)} km²/s²</Row>
    {orbit.timeToPeriapsisSec !== null && <Row label={t('flight.orbit.toPeriapsis')}>{timeText(orbit.timeToPeriapsisSec)}</Row>}
    {orbit.timeToApoapsisSec !== null && <Row label={t('flight.orbit.toApoapsis')}>{timeText(orbit.timeToApoapsisSec)}</Row>}
    {orbit.impacts && <Row label={t('flight.orbit.impact')}><strong className="field-issue">{orbit.impactInSec === null ? t('flight.orbit.impactsNow') : t('flight.orbit.impactIn', { time: timeText(orbit.impactInSec) })}</strong></Row>}
  </dl>;
}

/** Altitude and speed along the integrated ascent. Drawn only from the engine's samples. */
export function AscentChart({ preview, title }: { preview: AscentPreview; title: string }) {
  const { t } = useTranslation(), number = useNumbers(1), samples = preview.samples;
  if (samples.length < 2) return null;
  const stride = Math.max(1, Math.ceil(samples.length / 240)), points = samples.filter((_, index) => index % stride === 0 || index === samples.length - 1);
  const end = points.at(-1)!.t, maxAlt = Math.max(1, ...points.map(sample => sample.altKm)), maxSpeed = Math.max(1, ...points.map(sample => sample.speedKms));
  const x = (time: number) => 36 + time / Math.max(1, end) * 404, line = (pick: (sample: typeof points[number]) => number, max: number) => points.map((sample, i) => `${i ? 'L' : 'M'}${x(sample.t).toFixed(1)},${(146 - pick(sample) / max * 120).toFixed(1)}`).join(' ');
  return <figure className="chart ascent-chart">
    <figcaption>{title}</figcaption>
    <svg viewBox="0 0 470 184" role="img" aria-label={`${title}: ${t('flight.chart.summary', { alt: number.format(preview.apogeeAltKm), speed: number.format(points.at(-1)!.speedKms) })}`}>
      <path d="M36 20V146H440" stroke="#24364a" fill="none"/><path d={line(sample => sample.altKm, maxAlt)} stroke="#6de0e8" strokeWidth="2" fill="none"/><path d={line(sample => sample.speedKms, maxSpeed)} stroke="#ffc16c" strokeWidth="2" strokeDasharray="5 3" fill="none"/>
      {preview.events.filter(event => event.kind === 'STAGE_SEPARATION' || event.kind === 'SECO' || event.kind === 'MAX_Q' || event.kind === 'ORBIT_INSERTION').map((event, index) => <g key={index}><path d={`M${x(event.t)} 20V146`} stroke="#64809a" strokeDasharray="2 3"/><text x={x(event.t) + 3} y={32 + index % 3 * 11} fontSize="9" fill="#a9bdc9">{t(`flight.traj.${event.kind}`, { defaultValue: event.kind })}</text></g>)}
      <text x="2" y="26" fontSize="10" fill="#6de0e8">{number.format(maxAlt)} km</text><text x="2" y="40" fontSize="10" fill="#ffc16c">{number.format(maxSpeed)} km/s</text>
      <text x="36" y="168" fontSize="10" fill="#a9bdc9">0</text><text x="400" y="168" fontSize="10" fill="#a9bdc9">{timeText(end)}</text>
    </svg>
    <p className="small muted"><span className="swatch cyan" aria-hidden="true"/> {t('flight.chart.altitude')} · <span className="swatch amber dashed" aria-hidden="true"/> {t('flight.chart.speed')}</p>
  </figure>;
}
