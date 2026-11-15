import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BurnPreview, BurnSpec, BurnTrigger, Design, TrajectoryForecast } from '@astrix/core';
import { useMission } from '../../store';
import { CommandButton } from '../phases/FlightControls';
import { RefusalNote } from '../panels/Review';
import { ExplainButton } from '../science/ExplainButton';
import { useFlightPreview } from '../../three/flight/previewStore';
import { OrbitSummary, Row, TrajectoryEvents, formatClock, useNumbers } from './parts';
import { useFlightJob } from './useFlightJob';
import './flightplan.css';

type TriggerKind = BurnTrigger['kind'];
const TRIGGERS: readonly TriggerKind[] = ['AT_TIME', 'AT_APSIS', 'AT_SOI_ENTRY'];
const HORIZONS = [{ id: 'h6', sec: 6 * 3600 }, { id: 'd1', sec: 86400 }, { id: 'd5', sec: 5 * 86400 }, { id: 'd7', sec: 7 * 86400 }] as const;
const blankBurn = (id: string): BurnSpec => ({ id, source: 'SPACECRAFT', trigger: { kind: 'AT_TIME', tSec: 600 }, frame: 'VNR', dv: [0, 0, 0], model: 'IMPULSIVE' });
const magnitude = (dv: readonly number[]) => Math.hypot(dv[0] ?? 0, dv[1] ?? 0, dv[2] ?? 0);

function NumericInput({ id, label, unit, value, onChange, step = 0.01 }: { id: string; label: string; unit: string; value: number; onChange: (value: number) => void; step?: number }) {
  const [text, setText] = useState(String(value)), [bad, setBad] = useState(false);
  useEffect(() => { if (Number(text) !== value) setText(String(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const { t } = useTranslation();
  return <div className="field"><label htmlFor={id}>{label} <span className="field-unit">({unit})</span></label>
    <input id={id} type="text" inputMode="decimal" value={text} step={step} aria-invalid={bad || undefined} onChange={event => { const next = event.target.value; setText(next); const parsed = Number(next); if (next.trim() !== '' && Number.isFinite(parsed)) { setBad(false); onChange(parsed); } else setBad(true); }}/>
    {bad && <small role="alert" className="field-issue">{t('studio.notANumber')}</small>}</div>;
}
function BurnPreviewView({ preview }: { preview: BurnPreview }) {
  const { t } = useTranslation(), number = useNumbers(3);
  return <div className="burn-preview" aria-live="polite">
    <p><span className={`chip ${preview.feasible ? 'state-MET' : 'state-FAILED'}`}>{t(preview.feasible ? 'flight.burn.feasible' : 'flight.burn.infeasible')}</span> <small className="muted">{t('flight.burn.idealNote')}</small></p>
    {preview.refusal && <RefusalNote refusal={{ ok: false, code: preview.refusal, values: {} }}/>}
    <dl className="kv-grid">
      <Row label={t('flight.burn.achievedDv')}>{number.format(preview.achievedDvKms)} km/s</Row>
      <Row label={t('flight.burn.propellant')}>{number.format(preview.propellantKg)} kg</Row>
      {preview.before && <Row label={t('flight.burn.before')}>{number.format(preview.before.altitudeKm)} km · {number.format(preview.before.speedKms)} km/s</Row>}
      {preview.after && <Row label={t('flight.burn.after')}>{number.format(preview.after.altitudeKm)} km · {number.format(preview.after.speedKms)} km/s</Row>}
    </dl>
    {preview.orbitAfter && <><h4>{t('flight.burn.orbitAfter')}</h4><OrbitSummary orbit={preview.orbitAfter}/></>}
    {preview.events.length > 0 && <TrajectoryEvents events={preview.events} limit={8} label={t('flight.burn.events')}/>}
  </div>;
}

/**
 * Burns are plans before launch (a design edit) and commands in flight (role-checked, uplink-gated, receipted).
 * Previews use the same force model as flight; they never change authority.
 */
export function BurnPlanner() {
  const { t } = useTranslation(), s = useMission(), d = s.design!, definition = s.definition, inFlight = !!s.sim && !s.telemetry?.ended, number = useNumbers(3);
  const maneuvers = definition.trajectory.model === 'PATCHED_CONICS' ? definition.trajectory.maneuvers : null;
  const planned: readonly BurnSpec[] = d.burns, scheduled = s.telemetry?.flight?.scheduled ?? [];
  const nextId = () => { let n = planned.length + scheduled.length + 1; const taken = new Set([...planned.map(b => b.id), ...scheduled.map(b => b.burn.id)]); while (taken.has(`burn-${n}`)) n++; return `burn-${n}`; };
  const [burn, setBurn] = useState<BurnSpec>(() => blankBurn(nextId()));
  const preview = useFlightJob<BurnPreview>(), forecast = useFlightJob<TrajectoryForecast>(), estimates = useFlightJob<readonly BurnSpec[]>();
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]['id']>('d5'), setPreviewStore = useFlightPreview.getState();
  const revision = d.revision;
  useEffect(() => { preview.reset(); forecast.reset(); estimates.reset(); useFlightPreview.getState().clear(); return () => useFlightPreview.getState().clear(); }, [revision, inFlight]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (preview.result) setPreviewStore.setBurn(preview.result); }, [preview.result]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (forecast.result) setPreviewStore.setForecast(revision, forecast.result); }, [forecast.result, revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const candidatePlan: Design = useMemo(() => ({ ...d, burns: [...d.burns.filter(item => item.id !== burn.id), burn] }), [d, burn]);
  const subject = inFlight && s.sim ? s.sim : candidatePlan;
  const setTrigger = (kind: TriggerKind) => setBurn({ ...burn, trigger: kind === 'AT_TIME' ? { kind, tSec: 600 } : kind === 'AT_APSIS' ? { kind, apsis: 'PERIAPSIS', notBeforeSec: 0 } : { kind, body: 'MOON', delaySec: 0 } });
  const trigger = burn.trigger, dvLabels = burn.frame === 'VNR' ? (['prograde', 'normal', 'radial'] as const) : (['x', 'y', 'z'] as const);
  const setDv = (index: 0 | 1 | 2, value: number) => { const dv: [number, number, number] = [burn.dv[0], burn.dv[1], burn.dv[2]]; dv[index] = value; setBurn({ ...burn, dv }); };
  const limitReached = maneuvers ? planned.length >= maneuvers.maxBurns && !planned.some(item => item.id === burn.id) : true;
  if (!maneuvers?.allowed) return null;
  const commit = (list: readonly BurnSpec[]) => s.setBurns(list);
  return <section className="burn-planner" id="burn-planner" aria-labelledby="burn-heading">
    <header className="spread"><h2 id="burn-heading">{t(inFlight ? 'flight.burn.titleFlight' : 'flight.burn.titlePlan')}</h2><ExplainButton topic="rocket-equation" context="flight.burn"/></header>
    <p className="muted">{t(inFlight ? 'flight.burn.introFlight' : 'flight.burn.introPlan', { max: maneuvers.maxBurns })}</p>
    {inFlight ? (scheduled.length === 0 ? <p className="muted">{t('flight.burn.noneScheduled')}</p> : <ul className="burn-list">{scheduled.map(item => <li key={item.burn.id}><strong>{item.burn.id}</strong> <span className="chip">{t(`flight.burn.status.${item.status}`)}</span> <small>{t(`flight.burn.source.${item.burn.source}`)} · {number.format(magnitude(item.burn.dv))} km/s · {item.fireAtSec === null ? t('flight.burn.fireUnknown') : t('flight.burn.fireAt', { time: formatClock(item.fireAtSec) })}</small>
      <CommandButton command={{ kind: 'BURN_CANCEL', id: item.burn.id }} label={t('flight.burn.cancel')}/></li>)}</ul>)
      : planned.length === 0 ? <p className="muted">{t('flight.burn.nonePlanned')}</p> : <ul className="burn-list">{planned.map(item => <li key={item.id}><strong>{item.id}</strong> <small>{t(`flight.burn.source.${item.source}`)} · {t(`flight.burn.trigger.${item.trigger.kind}`)} · {number.format(magnitude(item.dv))} km/s</small>
      <div className="button-wrap"><button type="button" className="button" onClick={() => setBurn(item)}>{t('flight.burn.edit')}</button><button type="button" className="button" onClick={() => commit(planned.filter(entry => entry.id !== item.id))}>{t('flight.burn.remove')}</button></div></li>)}</ul>}
    <fieldset className="burn-form"><legend>{t('flight.burn.form')}</legend>
      <div className="field-grid">
        <div className="field"><label htmlFor="burn-id">{t('flight.burn.id')}</label><input id="burn-id" type="text" maxLength={24} value={burn.id} onChange={event => setBurn({ ...burn, id: event.target.value })}/></div>
        <div className="field"><label htmlFor="burn-source">{t('flight.burn.sourceLabel')}</label><select id="burn-source" value={burn.source} onChange={event => setBurn({ ...burn, source: event.target.value === 'UPPER_STAGE' ? 'UPPER_STAGE' : 'SPACECRAFT' })}><option value="SPACECRAFT">{t('flight.burn.source.SPACECRAFT')}</option><option value="UPPER_STAGE">{t('flight.burn.source.UPPER_STAGE')}</option></select><small>{t('flight.burn.sourceHint')}</small></div>
        <div className="field"><label htmlFor="burn-trigger">{t('flight.burn.triggerLabel')}</label><select id="burn-trigger" value={trigger.kind} onChange={event => { const next = TRIGGERS.find(kind => kind === event.target.value); if (next) setTrigger(next); }}>{TRIGGERS.map(kind => <option key={kind} value={kind}>{t(`flight.burn.trigger.${kind}`)}</option>)}</select></div>
        {trigger.kind === 'AT_TIME' && <NumericInput id="burn-time" label={t('flight.burn.atTime')} unit="s" step={10} value={trigger.tSec} onChange={value => setBurn({ ...burn, trigger: { kind: 'AT_TIME', tSec: value } })}/>}
        {trigger.kind === 'AT_APSIS' && <>
          <div className="field"><label htmlFor="burn-apsis">{t('flight.burn.apsis')}</label><select id="burn-apsis" value={trigger.apsis} onChange={event => setBurn({ ...burn, trigger: { ...trigger, apsis: event.target.value === 'APOAPSIS' ? 'APOAPSIS' : 'PERIAPSIS' } })}><option value="PERIAPSIS">{t('flight.burn.periapsis')}</option><option value="APOAPSIS">{t('flight.burn.apoapsis')}</option></select></div>
          <NumericInput id="burn-notbefore" label={t('flight.burn.notBefore')} unit="s" step={10} value={trigger.notBeforeSec} onChange={value => setBurn({ ...burn, trigger: { ...trigger, notBeforeSec: value } })}/>
          <div className="field"><label htmlFor="burn-apsis-body">{t('flight.burn.apsisBody')}</label><select id="burn-apsis-body" value={trigger.body ?? ''} onChange={event => { const { body: _body, ...rest } = trigger; setBurn({ ...burn, trigger: event.target.value === 'MOON' ? { ...rest, body: 'MOON' } : event.target.value === 'EARTH' ? { ...rest, body: 'EARTH' } : rest }); }}><option value="">{t('flight.burn.currentBody')}</option><option value="EARTH">{t('flight.body.EARTH')}</option><option value="MOON">{t('flight.body.MOON')}</option></select></div></>}
        {trigger.kind === 'AT_SOI_ENTRY' && <NumericInput id="burn-delay" label={t('flight.burn.delay')} unit="s" step={10} value={trigger.delaySec} onChange={value => setBurn({ ...burn, trigger: { ...trigger, delaySec: value } })}/>}
        <div className="field"><label htmlFor="burn-frame">{t('flight.burn.frame')}</label><select id="burn-frame" value={burn.frame} onChange={event => setBurn({ ...burn, frame: event.target.value === 'INERTIAL' ? 'INERTIAL' : 'VNR' })}><option value="VNR">{t('flight.burn.frame.VNR')}</option><option value="INERTIAL">{t('flight.burn.frame.INERTIAL')}</option></select><small>{t(`flight.burn.frame.${burn.frame}.hint`)}</small></div>
        {([0, 1, 2] as const).map(index => <NumericInput key={`${burn.frame}:${index}`} id={`burn-dv-${index}`} label={t(`flight.burn.dv.${dvLabels[index]}`)} unit="km/s" value={burn.dv[index]} onChange={value => setDv(index, value)}/>)}
      </div>
      <p className="muted" role="status">{t('flight.burn.magnitude', { dv: number.format(magnitude(burn.dv)), ms: number.format(magnitude(burn.dv) * 1000) })} · {t('flight.burn.model')}</p>
      <div className="button-wrap">
        <button type="button" className="button" disabled={preview.status === 'running'} onClick={() => preview.run({ op: 'burn', subject, burn })}>{t('flight.burn.preview')}</button>
        {inFlight
          ? <CommandButton command={{ kind: 'BURN_SCHEDULE', burn }} label={t('flight.burn.schedule')}/>
          : <button type="button" className="button primary" disabled={limitReached} onClick={() => commit([...planned.filter(item => item.id !== burn.id), burn])}>{t('flight.burn.addToPlan')}</button>}
        <button type="button" className="button" disabled={estimates.status === 'running'} onClick={() => estimates.run({ op: 'recommendBurns', design: d })}>{t(definition.learning?.assistance.recommendBurns ? 'flight.burn.estimateAssisted' : 'flight.burn.estimate')}</button>
      </div>
      {limitReached && !inFlight && <p className="muted" role="status">{t('flight.burn.limit', { max: maneuvers.maxBurns })}</p>}
      {s.lastRefusal && <RefusalNote refusal={s.lastRefusal}/>}
      <div role="status" aria-live="polite">{preview.status === 'running' && <p>{t('flight.previewing')}</p>}{preview.status === 'error' && <p className="field-issue"><span lang="en">{preview.error}</span></p>}</div>
      {preview.result && <BurnPreviewView preview={preview.result}/>}
      {estimates.result && <section aria-label={t('flight.burn.estimates')}><h4>{t('flight.burn.estimates')}</h4><p className="muted">{t('flight.burn.estimatesNote')}</p>{estimates.result.length === 0 ? <p>{t('flight.burn.noEstimates')}</p> : <ul className="burn-list">{estimates.result.map(item => <li key={item.id}><strong>{item.id}</strong> <small>{t(`flight.burn.trigger.${item.trigger.kind}`)} · {number.format(magnitude(item.dv))} km/s</small><button type="button" className="button" onClick={() => setBurn(item)}>{t('flight.burn.load')}</button></li>)}</ul>}</section>}
    </fieldset>
    <section className="forecast-controls" aria-labelledby="trajectory-forecast-heading"><h3 id="trajectory-forecast-heading">{t('flight.forecast.title')}</h3><p className="muted">{t('flight.forecast.note')}</p>
      <div className="button-wrap"><label>{t('flight.forecast.horizon')}<select value={horizon} onChange={event => { const next = HORIZONS.find(item => item.id === event.target.value); if (next) setHorizon(next.id); }}>{HORIZONS.map(item => <option key={item.id} value={item.id}>{t(`flight.forecast.${item.id}`)}</option>)}</select></label>
        <button type="button" className="button" disabled={forecast.status === 'running'} onClick={() => forecast.run({ op: 'trajectory', subject: inFlight && s.sim ? s.sim : candidatePlan, horizonSec: HORIZONS.find(item => item.id === horizon)!.sec })}>{t('flight.forecast.run')}</button>
        {forecast.status === 'running' && <button type="button" className="button" onClick={forecast.cancel}>{t('forecast.cancel')}</button>}
        {forecast.result && <button type="button" className="button" onClick={() => { forecast.reset(); useFlightPreview.getState().setForecast(revision, null); }}>{t('flight.forecast.clear')}</button>}</div>
      <div role="status" aria-live="polite">{forecast.status === 'running' && <p>{t('flight.previewing')}</p>}{forecast.status === 'error' && <p className="field-issue"><span lang="en">{forecast.error}</span></p>}</div>
      {forecast.result && <ForecastSummary forecast={forecast.result}/>}
    </section>
  </section>;
}
function ForecastSummary({ forecast }: { forecast: TrajectoryForecast }) {
  const { t } = useTranslation(), number = useNumbers(0);
  return <div className="forecast-summary"><p>{forecast.encounter ? t('flight.forecast.encounter', { distance: number.format(forecast.encounter.closestKm), body: t(`flight.body.${forecast.encounter.body}`), time: formatClock(forecast.encounter.atSec) }) : t('flight.forecast.noEncounter')}</p>
    <p className="muted">{t('flight.forecast.predicted')}</p><TrajectoryEvents events={forecast.events} limit={12} label={t('flight.forecast.events')}/></div>;
}
