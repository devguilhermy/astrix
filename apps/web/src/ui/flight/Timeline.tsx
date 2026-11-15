import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CONSTANTS, forecastTimeline, orbitalPeriod, type TimelineWindow, type TimelineForecast } from '@astrix/core';
import { liveMission, useMission } from '../../store';

const LANES: readonly TimelineWindow['kind'][] = ['SUNLIGHT', 'ECLIPSE', 'CONTACT', 'TARGET', 'STORM', 'EVENT', 'MISSION_END'];
export function useTimelineForecast() {
 const sim = useMission(state => state.sim);
 const design = useMission(state => state.design);
 const telemetry = useMission(state => state.telemetry);
 const attempt = useMission(state => state.attemptId);
 const activeStage = useMission(state => state.activeStage);
 const bucket = Math.floor((telemetry?.t ?? 0) / 30);
 // Forecast sampling is bounded in core and refreshed each 30 simulated seconds,
 // not each 100ms DOM publication. The playhead still follows every publication.
 return useMemo(() => {
  if (!sim || !design?.orbit || activeStage !== 'IMPLEMENT' || telemetry?.ended) return null;
  const horizon = design.orbit.body === 'MARS' ? 88775.244 : orbitalPeriod(design.orbit.smaKm, CONSTANTS[design.orbit.body].mu.v);
  return forecastTimeline(sim, horizon);
 }, [attempt, liveMission.generation, design?.definitionDigest, design?.revision, bucket, telemetry?.ended, activeStage]);
}
export function Timeline({forecast}:{forecast:TimelineForecast|null}) {
 const { t, i18n } = useTranslation();
 const design = useMission(state => state.design), telemetry = useMission(state => state.telemetry);
 const advancing = useMission(state => state.advancing), pending = useMission(state => state.pendingDecisions.length);
 if (!forecast || !telemetry || !design) return null;
 const duration = Math.max(1, forecast.endSec - forecast.startSec);
 const percent = (time: number) => Math.max(0, Math.min(100, (time - forecast.startSec) / duration * 100));
 const format = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 });
 const labelTime = (time: number) => t('flight.timelineTime', { seconds: format.format(time) });
 return <section className="flight-timeline" data-cue-target="timeline" aria-label={t(design.orbit?.body === 'MARS' ? 'flight.horizonMars' : 'flight.timeline')}>
  <header><strong>{t(design.orbit?.body === 'MARS' ? 'flight.horizonMars' : 'flight.timeline')}</strong><span>{labelTime(forecast.startSec)} — {labelTime(forecast.endSec)}</span></header>
  <div className="timeline-lanes">{LANES.map(kind => <div key={kind} className="timeline-row"><span className="timeline-label">{t(`flight.lane${kind}`)}</span><div className="timeline-track">
   {forecast.windows.filter(window => window.kind === kind).map((window, index) => {
    const left = percent(window.startSec), width = Math.max(.7, percent(window.endSec) - left);
    const label = `${t(`flight.lane${kind}`)} · ${labelTime(window.startSec)} — ${labelTime(window.endSec)}`;
    return kind === 'CONTACT' ? <button type="button" key={index} className={`timeline-window is-${kind.toLowerCase()}`} style={{ left: `${left}%`, width: `${width}%` }} title={label} aria-label={`${label}. ${t('flight.advanceHere', { time: labelTime(window.startSec) })}`} disabled={advancing || !!pending || !!telemetry.ended || window.endSec <= telemetry.t} onClick={() => useMission.getState().advanceToEvent(Math.max(telemetry.t, window.startSec))}/>
     : <span key={index} className={`timeline-window is-${kind.toLowerCase()}`} style={{ left: `${left}%`, width: `${width}%` }} title={label} role="img" aria-label={label}/>;
   })}
   <span className="timeline-playhead" style={{ left: `${percent(telemetry.t)}%` }} aria-label={`${t('flight.now')} · ${labelTime(telemetry.t)}`} role="img"/>
  </div></div>)}</div>
  <p className="timeline-disclosure">{t('flight.forecast')}</p>
 </section>;
}
