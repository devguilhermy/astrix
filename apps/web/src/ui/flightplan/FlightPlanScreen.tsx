import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listLaunchers, type AscentPreview, type AscentProgram, type Design, type LauncherDef } from '@astrix/core';
import { useMission } from '../../store';
import { ExplainButton } from '../science/ExplainButton';
import { Panel } from '../primitives';
import { RefusalNote } from '../panels/Review';
import { allowsManeuvers, labelText } from '../missions/definitionView';
import { LearningProvided } from '../missions/LearningProvided';
import { BurnPlanner } from './BurnPlanner';
import { AscentChart, Row, TrajectoryEvents, useNumbers } from './parts';
import { useFlightJob, type JobStatus } from './useFlightJob';
import type { RecommendedAscent } from './flight.worker';
import './flightplan.css';

const sameProgram = (a: AscentProgram, b: AscentProgram) => JSON.stringify(a) === JSON.stringify(b);
interface ProgramField { key: Exclude<keyof AscentProgram, 'holdUpperStage'>; unit: string; step: number; min: number; max: number; scale?: number }
const FIELDS: readonly ProgramField[] = [
  { key: 'azimuthDeg', unit: '°', step: 1, min: 0, max: 360 },
  { key: 'verticalSec', unit: 's', step: 1, min: 0, max: 60 },
  { key: 'kickDeg', unit: '°', step: .5, min: 0, max: 30 },
  { key: 'kickSec', unit: 's', step: 1, min: 1, max: 30 },
  { key: 'stage1LoadFraction', unit: '%', step: 1, min: 20, max: 100, scale: 100 },
  { key: 'stage2CoastSec', unit: 's', step: 5, min: 0, max: 600 },
  { key: 'insertionAltKm', unit: 'km', step: 5, min: 80, max: 2000 },
];

function AscentSummary({ preview, definitionTitle }: { preview: AscentPreview; definitionTitle: string }) {
  const { t } = useTranslation(), number = useNumbers(1);
  return <div className="ascent-summary" aria-label={definitionTitle}>
    <p><span className={`chip ${preview.outcome === 'ORBIT' || preview.outcome === 'ESCAPE' ? 'state-MET' : 'state-FAILED'}`}>{t(`flight.ascentOutcome.${preview.outcome}`)}</span> <small className="muted">{t('flight.ascentPredicted')}</small></p>
    <AscentChart preview={preview} title={t('flight.ascentProfile')}/>
    <dl className="kv-grid">
      <Row label={t('flight.apogee')}>{number.format(preview.apogeeAltKm)} km</Row>
      <Row label={t('flight.perigee')}>{preview.perigeeAltKm === null ? t('flight.notBound') : `${number.format(preview.perigeeAltKm)} km`}</Row>
      {preview.final && <Row label={t('flight.finalSpeed')}>{number.format(preview.final.speedKms)} km/s</Row>}
      <Row label={t('flight.losses.gravity')}>{number.format(preview.deltaVLossKms.gravity)} km/s</Row>
      <Row label={t('flight.losses.drag')}>{number.format(preview.deltaVLossKms.drag)} km/s</Row>
      <Row label={t('flight.losses.steering')}>{number.format(preview.deltaVLossKms.steering)} km/s</Row>
      <Row label={t('flight.stage1Left')}>{number.format(preview.propellantRemainingKg.stage1)} kg</Row>
      <Row label={t('flight.stage2Left')}>{number.format(preview.propellantRemainingKg.stage2)} kg</Row>
    </dl>
    <details><summary>{t('flight.ascentEvents')}</summary><TrajectoryEvents events={preview.events} limit={30} label={t('flight.ascentEvents')}/></details>
    <details><summary>{t('hud.modelLimits')}</summary><ul>{preview.limits.map(key => <li key={key}>{t(key, { defaultValue: t('flight.modelLimitUnnamed', { key }) })}</li>)}</ul></details>
  </div>;
}
function JobStatusLine({ status, error, busy }: { status: JobStatus; error: string; busy: string }) {
  const { t } = useTranslation();
  return <div role="status" aria-live="polite">{status === 'running' && <p>{busy}</p>}{status === 'cancelled' && <p>{t('forecast.cancelled')}</p>}{status === 'error' && <p className="field-issue">{t('forecast.failed')} <span lang="en">{error}</span></p>}</div>;
}

/** Launch planning for a mission that starts on the ground: choose a launcher and ascent program, then check what the integrated flight would actually do. */
export function FlightPlanScreen() {
  const { t } = useTranslation(), s = useMission(), d = s.design!, definition = s.definition, start = definition.start;
  const launchers = useMemo<readonly LauncherDef[]>(() => start.kind === 'SURFACE_LAUNCH' ? listLaunchers().filter(item => start.launcherIds.includes(item.id)) : [], [start]);
  const applied = d.launch, [launcherId, setLauncherId] = useState(applied?.launcherId ?? launchers[0]?.id ?? ''), [program, setProgram] = useState<AscentProgram | null>(applied?.program ?? null);
  const ascent = useFlightJob<AscentPreview>(), recommend = useFlightJob<RecommendedAscent>();
  useEffect(() => { setLauncherId(d.launch?.launcherId ?? launchers[0]?.id ?? ''); setProgram(d.launch?.program ?? null); ascent.reset(); recommend.reset(); }, [d.revision, d.launch]); // eslint-disable-line react-hooks/exhaustive-deps
  const number = useNumbers(2), launcher = launchers.find(item => item.id === launcherId), payload = s.budgets?.massKg;
  if (!program || start.kind !== 'SURFACE_LAUNCH') return <div className="phase-content"><p>{t('flight.noLaunchPlan')}</p></div>;
  const dirty = launcherId !== applied?.launcherId || !sameProgram(program, applied.program), candidate: Design = { ...d, launch: { launcherId, program } };
  const edit = (key: ProgramField['key'], value: number) => setProgram({ ...program, [key]: value });
  const apply = () => { if (launcherId !== applied?.launcherId) s.setLauncher(launcherId); if (!sameProgram(program, applied!.program)) s.setAscent(program); };
  const recommended = recommend.result && recommend.result.ok ? recommend.result : null, assisted = definition.learning?.assistance.recommendAscent ?? false;
  const preview = ascent.result ?? recommended?.preview ?? null;
  return <div className="phase-content flight-plan" id="flight-plan">
    <header className="phase-title"><h1>{t('flight.planTitle')}</h1><ExplainButton topic="rocket-equation"/></header>
    <p>{t('flight.planIntro', { site: labelText(t, start.site.name) })}</p>
    <LearningProvided/>
    <section id="launcher" data-cue-target="orbit" aria-labelledby="launcher-heading"><h2 id="launcher-heading">{t('flight.launcher')}</h2>
      <div className="launcher-options">{launchers.map(item => <label key={item.id} className={`launcher-card${item.id === launcherId ? ' selected' : ''}`}><input type="radio" name="launcher" checked={item.id === launcherId} onChange={() => setLauncherId(item.id)}/><strong>{t(item.nameKey)}</strong>
        <small>{t('flight.launcherSpec', { stages: item.stages.length, payload: number.format(item.payloadLimitKg), thrust: number.format(item.stages[0]?.thrustKN ?? 0) })}</small></label>)}</div>
      {launcher && payload && <p className={payload.used > launcher.payloadLimitKg ? 'field-issue' : 'muted'} role="status">{t('flight.payloadFit', { used: number.format(payload.used), limit: number.format(launcher.payloadLimitKg) })}</p>}
    </section>
    <section aria-labelledby="program-heading"><h2 id="program-heading">{t('flight.ascentProgram')}</h2><p className="muted">{t('flight.ascentProgramNote')}</p>
      <div className="field-grid program-grid">{FIELDS.map(field => {
        const raw = program[field.key], shown = field.scale ? raw * field.scale : raw, id = `ascent-${field.key}`;
        return <div className="field" key={field.key}><label htmlFor={id}>{t(`flight.program.${field.key}`)} <span className="field-unit">({field.unit})</span></label>
          <input id={id} type="number" inputMode="decimal" min={field.min} max={field.max} step={field.step} value={Number(shown.toFixed(3))} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) edit(field.key, field.scale ? value / field.scale : value); }}/><small>{t(`flight.program.${field.key}.hint`)}</small></div>;
      })}
        <div className="field check"><label><input type="checkbox" checked={program.holdUpperStage} onChange={event => setProgram({ ...program, holdUpperStage: event.target.checked })}/> {t('flight.program.holdUpperStage')}</label><small>{t('flight.program.holdUpperStage.hint')}</small></div>
      </div>
      <div className="button-wrap">
        <button type="button" className="button" disabled={ascent.status === 'running'} onClick={() => ascent.run({ op: 'ascent', design: candidate })}>{t('flight.previewAscent')}</button>
        <button type="button" className="button" disabled={recommend.status === 'running'} onClick={() => recommend.run({ op: 'recommendAscent', design: candidate })}>{t(assisted ? 'flight.recommendAssisted' : 'flight.recommend')}</button>
        {(ascent.status === 'running' || recommend.status === 'running') && <button type="button" className="button" onClick={() => { ascent.cancel(); recommend.cancel(); }}>{t('forecast.cancel')}</button>}
        {recommended && <button type="button" className="button" onClick={() => setProgram(recommended.program)}>{t('flight.useRecommended')}</button>}
        <button type="button" className="button primary" disabled={!dirty} onClick={apply} data-cue-target="confirm">{t('flight.applyPlan')}</button>
        {dirty && <button type="button" className="button" onClick={() => { setLauncherId(applied?.launcherId ?? ''); setProgram(applied?.program ?? null); }}>{t('flight.discardPlan')}</button>}
      </div>
      <JobStatusLine status={ascent.status} error={ascent.error} busy={t('flight.previewing')}/><JobStatusLine status={recommend.status} error={recommend.error} busy={t('flight.searching')}/>
      {recommend.result && !recommend.result.ok && <p className="field-issue" role="alert">{t('flight.noRecommendation')}</p>}
      {recommended && <p role="status">{t('flight.recommendedNote')}</p>}
      {dirty && <p role="status" className="muted">{t('flight.unappliedNote')}</p>}
      {s.lastRefusal && <RefusalNote refusal={s.lastRefusal}/>}
    </section>
    {preview && <Panel title={t('flight.ascentPreview')}><AscentSummary preview={preview} definitionTitle={t('flight.ascentPreview')}/></Panel>}
    {allowsManeuvers(definition) && <BurnPlanner/>}
    <p className="muted">{t('flight.notAnimation')}</p>
  </div>;
}
