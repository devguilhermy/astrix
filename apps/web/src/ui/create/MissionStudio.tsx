import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { listLaunchers, listParts, listRides, missionById, orbitAltitudes, validateMissionDefinition, withOrbitAltitudes, type BodyId, type BusId, type DefinitionIssue, type FailureCause, type MissionDefinition, type ObjectiveDef, type ResolvedMissionDefinition, type RoleId } from '@astrix/core';
import { useMission } from '../../store';
import { ObjectiveList } from '../missions/ObjectiveList';
import { labelText } from '../missions/definitionView';
import { CheckField, CheckGroup, FieldProvider, Group, NumberField, SelectField, TextField, fieldId, getAt, setAt, type DraftPath } from './fields';
import { BUS_IDS, FAILURE_CAUSES, OBJECTIVE_KINDS, ROLE_IDS, STATION_IDS, kindDescriptor, newObjective, type FieldDescriptor, type ObjectiveKind } from './objectiveKinds';
import { exportDraftText, publishDraft, readLibrary, saveDraft, type DraftDefinition, type LibraryError } from './library';
import { LibraryErrorNotice } from './LibraryPanel';
import { downloadText } from './download';
import { slugId } from './blank';
import './studio.css';

type SectionId = 'identity' | 'vehicle' | 'environment' | 'start' | 'trajectory' | 'objectives' | 'termination' | 'review';
const SECTIONS: readonly SectionId[] = ['identity', 'vehicle', 'environment', 'start', 'trajectory', 'objectives', 'termination', 'review'];
const DAY = 86400, HOUR = 3600;

function sectionOf(path: string): SectionId {
  const head = path.split(/[.[]/)[0];
  switch (head) {
    case 'vehicle': return 'vehicle';
    case 'environment': return 'environment';
    case 'start': return 'start';
    case 'trajectory': case 'support': return 'trajectory';
    case 'objectives': return 'objectives';
    case 'termination': return 'termination';
    default: return 'identity';
  }
}
export type DraftValidation = { ok: true; definition: ResolvedMissionDefinition } | { ok: false; issues: readonly DefinitionIssue[] };
function validateDraft(draft: DraftDefinition): DraftValidation {
  return validateMissionDefinition(draft);
}

export interface StudioProps {
  initial: DraftDefinition;
  /** Fly the validated definition; the studio never starts an attempt with an invalid draft. */
  onPlay: (definition: ResolvedMissionDefinition) => void;
  onClose: () => void;
}
export function MissionStudio({ initial, onPlay, onClose }: StudioProps) {
  const { t } = useTranslation(), reducedMotion = useMission(state => state.settings.reducedMotion);
  const [draft, setDraft] = useState<DraftDefinition>(initial), [section, setSection] = useState<SectionId>('identity'), [saved, setSaved] = useState<{ at: number; json: string } | null>(null), [error, setError] = useState<LibraryError | null>(null), [notice, setNotice] = useState('');
  const [idTouched, setIdTouched] = useState(() => initial.id !== 'user.untitled' && !initial.id.startsWith('user.untitled'));
  const heading = useRef<HTMLHeadingElement>(null);
  const deferred = useDeferredValue(draft), checked = useMemo(() => validateDraft(deferred), [deferred]);
  const issues = checked.ok ? [] : checked.issues, json = useMemo(() => JSON.stringify(draft), [draft]), dirty = saved?.json !== json;
  useEffect(() => { heading.current?.focus(); document.title = `${t('studio.title')} — ASTRIX`; }, [t]);
  const set = (path: DraftPath, value: unknown) => { setDraft(current => setAt(current, path, value)); setNotice(''); };
  const setMany = (updates: readonly (readonly [DraftPath, unknown])[]) => { setDraft(current => updates.reduce((next, [path, value]) => setAt(next, path, value), current)); setNotice(''); };
  const nameText = labelText(t, draft.name);
  const counts = (id: SectionId) => issues.filter(issue => sectionOf(issue.path) === id).length;
  const save = (): boolean => {
    const result = saveDraft(draft);
    if (!result.ok) { setError(result.error); setNotice(''); return false; }
    setError(null); setSaved({ at: Date.now(), json }); setNotice(t('studio.savedLocal', { count: result.value.length })); return true;
  };
  const publish = () => {
    if (!save()) return;
    const result = publishDraft(draft.id);
    if (!result.ok) { setError(result.error); return; }
    // Publishing may bump the revision to keep the id's history strictly increasing; the draft follows it.
    const entry = result.value.entries.find(item => item.id === draft.id);
    if (entry) { setDraft(entry.draft); setSaved({ at: Date.now(), json: JSON.stringify(entry.draft) }); }
    setError(null); setNotice(t('studio.published', { revision: result.value.definition.revision }));
  };
  const exportFile = () => {
    const result = exportDraftText(draft);
    if (!result.ok) { setError(result.error); return; }
    setError(null);
    try {
      downloadText(`${draft.id}.astrix-mission.json`, result.value.text);
      setNotice(t('studio.exported', { name: `${draft.id}.astrix-mission.json` }));
    } catch (cause) { setError({ code: 'WRITE_FAILED', detail: cause instanceof Error ? cause.message : String(cause) }); }
  };
  const play = () => {
    const current = validateDraft(draft);
    if (current.ok) onPlay(current.definition);
    else { setError({ code: 'INVALID', issues: current.issues }); setSection('review'); }
  };
  const close = () => { if (dirty && !window.confirm(t('studio.discardConfirm'))) return; onClose(); };
  const goto = (issue: DefinitionIssue) => { setSection(sectionOf(issue.path)); requestAnimationFrame(() => document.getElementById(fieldId(issue.path))?.focus()); };
  const library = readLibrary();
  const sectionLabel = (id: SectionId) => t(`studio.section.${id}`);
  return <main className="studio" data-reduced={reducedMotion || undefined}>
    <header className="studio-header">
      <div><h1 tabIndex={-1} ref={heading}>{nameText || t('studio.untitled')}</h1><p className="muted">{t('studio.subtitle')}</p></div>
      <p className="studio-status" role="status"><span className={`chip ${checked.ok ? 'state-MET' : 'state-FAILED'}`}>{checked.ok ? t('studio.valid') : t('studio.invalid', { count: issues.length })}</span> <span>{dirty ? t('studio.unsaved') : t('studio.saved')}</span> {notice && <span>{notice}</span>}</p>
      <div className="button-wrap studio-actions">
        <button type="button" className="button primary" onClick={play} aria-describedby="studio-play-hint">{t('studio.fly')}</button>
        <button type="button" className="button" onClick={save}>{t('studio.save')}</button>
        <button type="button" className="button" onClick={publish}>{t('studio.publish')}</button>
        <button type="button" className="button" onClick={exportFile}>{t('studio.export')}</button>
        <button type="button" className="button" onClick={close}>{t('studio.close')}</button>
      </div>
      <p id="studio-play-hint" className="sr-only">{checked.ok ? t('studio.flyReady') : t('studio.flyBlocked')}</p>
    </header>
    {error && <LibraryErrorNotice error={error} onGoto={goto}/>}
    <div className="studio-body">
      <nav className="studio-nav" aria-label={t('studio.sections')}>
        <label className="studio-nav-select"><span className="sr-only">{t('studio.sections')}</span><select value={section} onChange={event => { const next = SECTIONS.find(item => item === event.target.value); if (next) setSection(next); }}>{SECTIONS.map(id => <option key={id} value={id}>{sectionLabel(id)}{counts(id) ? ` (${counts(id)})` : ''}</option>)}</select></label>
        <ul>{SECTIONS.map(id => <li key={id}><button type="button" aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>{sectionLabel(id)}{counts(id) > 0 && <small className="badge" aria-label={t('studio.issueCount', { count: counts(id) })}>{counts(id)}</small>}</button></li>)}</ul>
      </nav>
      <FieldProvider value={{ issues, readOnly: false }}>
        <div className="studio-section" role="region" aria-label={sectionLabel(section)}>
          {section === 'identity' && <IdentitySection draft={draft} set={set} setMany={setMany} idTouched={idTouched} setIdTouched={setIdTouched} taken={library.ok ? library.value.map(entry => entry.id) : []}/>}
          {section === 'vehicle' && <VehicleSection draft={draft} set={set}/>}
          {section === 'environment' && <EnvironmentSection draft={draft} set={set} setMany={setMany}/>}
          {section === 'start' && <StartSection draft={draft} setMany={setMany}/>}
          {section === 'trajectory' && <TrajectorySection draft={draft} set={set} setMany={setMany}/>}
          {section === 'objectives' && <ObjectivesSection draft={draft} set={set}/>}
          {section === 'termination' && <TerminationSection draft={draft} set={set}/>}
          {section === 'review' && <ReviewSection draft={draft} checked={checked} goto={goto}/>}
        </div>
      </FieldProvider>
    </div>
  </main>;
}

interface SectionProps { draft: DraftDefinition; set: (path: DraftPath, value: unknown) => void }
interface ManyProps extends SectionProps { setMany: (updates: readonly (readonly [DraftPath, unknown])[]) => void }
const bodyName = (t: (key: string) => string, body: string) => t(`studio.body.${body}`);

function IdentitySection({ draft, set, setMany, idTouched, setIdTouched, taken }: ManyProps & { idTouched: boolean; setIdTouched: (value: boolean) => void; taken: readonly string[] }) {
  const { t } = useTranslation();
  const text = (label: { key?: string; text?: string }) => label.text ?? (label.key ? t(label.key) : '');
  const duplicate = taken.includes(draft.id);
  return <>
    <Group title={t('studio.group.identity')} description={t('studio.identityNote')}>
      <TextField path="name.text" label={t('studio.f.name')} value={text(draft.name)} maxLength={200} onChange={value => setMany([['name', { text: value }], ...(idTouched ? [] : [['id', slugId(value)] as const])])}/>
      <TextField path="objectiveSummary.text" label={t('studio.f.objectiveSummary')} hint={t('studio.f.objectiveSummaryHint')} value={text(draft.objectiveSummary)} maxLength={200} onChange={value => set('objectiveSummary', { text: value })}/>
      <TextField path="description.text" label={t('studio.f.description')} value={text(draft.description)} maxLength={200} multiline onChange={value => set('description', { text: value })}/>
      <TextField path="id" label={t('studio.f.id')} hint={duplicate ? t('studio.idExists') : t('studio.f.idHint')} value={draft.id} maxLength={48} onChange={value => { setIdTouched(true); set('id', value); }}/>
      <TextField path="author" label={t('studio.f.author')} value={draft.author ?? ''} maxLength={40} onChange={value => set('author', value === '' ? undefined : value)}/>
      <TextField path="notes" label={t('studio.f.notes')} hint={t('studio.f.notesHint')} value={draft.notes ?? ''} maxLength={600} multiline onChange={value => set('notes', value === '' ? undefined : value)}/>
    </Group>
    <p className="muted">{t('studio.revisionNote', { revision: draft.revision })}{draft.derivedFrom && <> {t('studio.derivedFrom', { id: draft.derivedFrom.id })}</>}</p>
  </>;
}

function VehicleSection({ draft, set }: SectionProps) {
  const { t } = useTranslation(), body: BodyId = draft.start.kind === 'PROVIDED_ORBIT' ? draft.start.body : 'EARTH';
  const parts = listParts(draft.vehicle.busId), rides = draft.start.kind === 'PROVIDED_ORBIT' ? listRides(draft.vehicle.busId, body) : [];
  return <>
    <Group title={t('studio.group.vehicle')} description={t('studio.vehicleNote')}>
      <SelectField path="vehicle.busId" label={t('studio.f.bus')} value={draft.vehicle.busId} options={BUS_IDS} render={id => t(`studio.bus.${id}`)} onChange={(busId: BusId) => { set('vehicle.busId', busId); set('vehicle.requiredPartIds', []); set('vehicle.allowedRideIds', []); }}/>
      <NumberField path="vehicle.budget" label={t('studio.f.budget')} unit={t('studio.unit.cost')} value={draft.vehicle.budget} step={10} min={0} onChange={value => set('vehicle.budget', value ?? 0)}/>
      <NumberField path="vehicle.minRecordingMB" label={t('studio.f.minRecording')} unit="MB" hint={t('studio.f.minRecordingHint')} value={draft.vehicle.minRecordingMB} step={1} min={0} onChange={value => set('vehicle.minRecordingMB', value ?? 0)}/>
      <NumberField path="vehicle.minLinkKbps" label={t('studio.f.minLink')} unit="kb/s" hint={t('studio.f.minLinkHint')} value={draft.vehicle.minLinkKbps} step={1} min={0} onChange={value => set('vehicle.minLinkKbps', value ?? 0)}/>
    </Group>
    <CheckGroup path="vehicle.requiredPartIds" legend={t('studio.f.requiredParts')} hint={t('studio.f.requiredPartsHint')} values={draft.vehicle.requiredPartIds} options={parts.map(part => part.id)} render={id => t(`part.${id}.name`)} onChange={values => set('vehicle.requiredPartIds', values)}/>
    {draft.start.kind === 'PROVIDED_ORBIT' && rides.length > 0 && <CheckGroup path="vehicle.allowedRideIds" legend={t('studio.f.allowedRides')} hint={t('studio.f.allowedRidesHint')} values={draft.vehicle.allowedRideIds} options={rides.map(ride => ride.id)} render={id => t(`ride.${id}.name`)} onChange={values => set('vehicle.allowedRideIds', values)}/>}
  </>;
}

function EnvironmentSection({ draft, set, setMany }: ManyProps) {
  const { t } = useTranslation(), env = draft.environment, storm = env.storm;
  return <>
    <Group title={t('studio.group.environment')}>
      <TextField path="environment.epochUTC" label={t('studio.f.epoch')} hint={t('studio.f.epochHint')} value={env.epochUTC} onChange={value => setMany([['environment.epochUTC', value], ...(draft.start.kind === 'PROVIDED_ORBIT' ? [['start.orbit.epochUTC', value] as const] : [])])}/>
      <NumberField path="environment.seed" label={t('studio.f.seed')} hint={t('studio.f.seedHint')} value={env.seed} step={1} onChange={value => set('environment.seed', Math.trunc(value ?? 0))}/>
      <NumberField path="environment.durationSec" label={t('studio.f.duration')} unit={t('studio.unit.days')} hint={t('studio.f.durationHint')} value={env.durationSec / DAY} step={0.5} min={0} onChange={value => set('environment.durationSec', Math.round((value ?? 0) * DAY))}/>
      <SelectField path="environment.stationId" label={t('studio.f.station')} value={env.stationId} options={STATION_IDS} render={id => t(`flow.station.${id}`)} onChange={value => set('environment.stationId', value)}/>
      <NumberField path="environment.stationAllocationStartSec" label={t('studio.f.stationStart')} unit="s" hint={t('studio.f.stationStartHint')} value={env.stationAllocationStartSec} step={60} min={0} onChange={value => set('environment.stationAllocationStartSec', value ?? 0)}/>
      <CheckField path="environment.scheduledFaults" label={t('studio.f.faults')} hint={t('studio.f.faultsHint')} checked={env.scheduledFaults} onChange={value => set('environment.scheduledFaults', value)}/>
    </Group>
    <Group title={t('studio.group.storm')} description={t('studio.stormNote')}>
      <CheckField path="environment.storm" label={t('studio.f.storm')} checked={!!storm} onChange={on => set('environment.storm', on ? { startSec: 3600, endSec: 7200, dose: 'RADLAB_HOURLY' } : null)}/>
      {storm && <>
        <NumberField path="environment.storm.startSec" label={t('studio.f.stormStart')} unit="s" value={storm.startSec} step={60} min={0} onChange={value => set('environment.storm.startSec', value ?? 0)}/>
        <NumberField path="environment.storm.endSec" label={t('studio.f.stormEnd')} unit="s" value={storm.endSec} step={60} min={0} onChange={value => set('environment.storm.endSec', value ?? 0)}/>
        <SelectField path="environment.storm.dose" label={t('studio.f.stormDose')} value={storm.dose} options={['RADLAB_HOURLY', 'MARS_ASSUMED'] as const} render={id => t(`studio.dose.${id}`)} onChange={value => set('environment.storm.dose', value)}/>
      </>}
    </Group>
  </>;
}

function StartSection({ draft, setMany }: Omit<ManyProps, 'set'>) {
  const { t } = useTranslation(), start = draft.start, launchers = listLaunchers();
  const switchTo = (kind: MissionDefinition['start']['kind']) => {
    if (kind === start.kind) return;
    if (kind === 'SURFACE_LAUNCH') setMany([['start', { kind, site: { name: { text: t('studio.defaultSite') }, latDeg: 28.5, lonDeg: -80.6 }, launcherIds: launchers.slice(0, 1).map(item => item.id) }], ['vehicle.allowedRideIds', []], ['trajectory', { model: 'PATCHED_CONICS', bodies: ['EARTH'], maneuvers: { allowed: true, maxBurns: 4 } }]]);
    else setMany([['start', missionById('FIRST_SIGNAL').start], ['trajectory', { model: 'PATCHED_CONICS', bodies: ['EARTH'], maneuvers: { allowed: false, maxBurns: 1 } }]]);
  };
  return <>
    <Group title={t('studio.group.start')} description={t('studio.startNote')}>
      <SelectField path="start.kind" label={t('studio.f.startKind')} value={start.kind} options={['PROVIDED_ORBIT', 'SURFACE_LAUNCH'] as const} render={kind => t(`studio.start.${kind}`)} onChange={switchTo}/>
    </Group>
    {start.kind === 'PROVIDED_ORBIT' && <ProvidedOrbitFields draft={draft} start={start} setMany={setMany}/>}
    {start.kind === 'SURFACE_LAUNCH' && <>
      <Group title={t('studio.group.site')} description={t('studio.siteNote')}>
        <TextField path="start.site.name.text" label={t('studio.f.siteName')} value={start.site.name.text ?? (start.site.name.key ? t(start.site.name.key) : '')} maxLength={200} onChange={value => setMany([['start.site.name', { text: value }]])}/>
        <NumberField path="start.site.latDeg" label={t('studio.f.lat')} unit="°" value={start.site.latDeg} step={0.1} min={-90} max={90} onChange={value => setMany([['start.site.latDeg', value ?? 0]])}/>
        <NumberField path="start.site.lonDeg" label={t('studio.f.lon')} unit="°" value={start.site.lonDeg} step={0.1} min={-180} max={180} onChange={value => setMany([['start.site.lonDeg', value ?? 0]])}/>
      </Group>
      <CheckGroup path="start.launcherIds" legend={t('studio.f.launchers')} hint={t('studio.f.launchersHint')} values={start.launcherIds} options={launchers.map(item => item.id)} render={id => t(launchers.find(item => item.id === id)?.nameKey ?? id)} onChange={values => setMany([['start.launcherIds', values]])}/>
    </>}
  </>;
}
function ProvidedOrbitFields({ draft, start, setMany }: { draft: DraftDefinition; start: Extract<DraftDefinition['start'], { kind: 'PROVIDED_ORBIT' }>; setMany: ManyProps['setMany'] }) {
  const { t } = useTranslation(), heights = orbitAltitudes(start.orbit);
  const retarget = (hp: number, ha: number, inclination: number) => { try { setMany([['start.orbit', withOrbitAltitudes(start.orbit, hp, Math.max(hp, ha), inclination)]]); } catch { /* The engine reports unsupported shapes through issues at start.orbit. */ } };
  return <Group title={t('studio.group.orbit')} description={t('studio.orbitNote')}>
    <SelectField path="start.body" label={t('studio.f.body')} value={start.body} options={['EARTH', 'MARS'] as const} render={id => bodyName(t, id)} onChange={body => setMany([['start.body', body], ['start.orbit.body', body]])}/>
    <SelectField path="start.orbitOptions" label={t('studio.f.orbitOptions')} value={start.orbitOptions} options={['RIDE', 'FREE_LEO'] as const} hint={t('studio.f.orbitOptionsHint')} render={id => t(`studio.orbitOptions.${id}`)} onChange={value => setMany([['start.orbitOptions', value]])}/>
    <NumberField path="start.orbit.smaKm" label={t('studio.f.periapsisAlt')} unit="km" value={Math.round(heights.altitudeKm * 10) / 10} step={10} onChange={value => retarget(value ?? 0, heights.apoapsisAltitudeKm, start.orbit.inclinationDeg)}/>
    <NumberField path="start.orbit.ecc" label={t('studio.f.apoapsisAlt')} unit="km" value={Math.round(heights.apoapsisAltitudeKm * 10) / 10} step={10} onChange={value => retarget(heights.altitudeKm, value ?? 0, start.orbit.inclinationDeg)}/>
    <NumberField path="start.orbit.inclinationDeg" label={t('studio.f.inclination')} unit="°" value={start.orbit.inclinationDeg} step={0.5} min={0} max={180} onChange={value => setMany([['start.orbit.inclinationDeg', value ?? 0]])}/>
    <NumberField path="start.orbit.raanDeg" label={t('studio.f.raan')} unit="°" value={start.orbit.raanDeg} step={1} onChange={value => setMany([['start.orbit.raanDeg', value ?? 0]])}/>
    <NumberField path="start.orbit.argPeriapsisDeg" label={t('studio.f.argPeriapsis')} unit="°" value={start.orbit.argPeriapsisDeg} step={1} onChange={value => setMany([['start.orbit.argPeriapsisDeg', value ?? 0]])}/>
    <NumberField path="start.orbit.trueAnomalyDeg" label={t('studio.f.trueAnomaly')} unit="°" value={start.orbit.trueAnomalyDeg} step={1} onChange={value => setMany([['start.orbit.trueAnomalyDeg', value ?? 0]])}/>
    <p className="muted wide">{t('studio.providedLabel')} {draft.vehicle.allowedRideIds.length === 0 && t('studio.noRides')}</p>
  </Group>;
}

function TrajectorySection({ draft, set, setMany }: ManyProps) {
  const { t } = useTranslation(), trajectory = draft.trajectory, legacyOffered = draft.start.kind === 'PROVIDED_ORBIT' && draft.start.body === 'MARS';
  return <>
    <Group title={t('studio.group.trajectory')} description={t('studio.trajectoryNote')}>
      <SelectField path="trajectory.model" label={t('studio.f.trajectoryModel')} value={trajectory.model} options={legacyOffered ? ['PATCHED_CONICS', 'MARS_ANALYTIC_CRUISE'] as const : ['PATCHED_CONICS'] as const} render={id => t(`studio.model.${id}`)} onChange={model => set('trajectory', model === 'PATCHED_CONICS' ? { model, bodies: ['EARTH'], maneuvers: { allowed: false, maxBurns: 1 } } : { model })}/>
      {trajectory.model === 'PATCHED_CONICS' && <>
        <CheckField path="trajectory.bodies" label={t('studio.f.moon')} hint={t('studio.f.moonHint')} checked={trajectory.bodies.includes('MOON')} onChange={on => set('trajectory.bodies', on ? ['EARTH', 'MOON'] : ['EARTH'])}/>
        <CheckField path="trajectory.maneuvers.allowed" label={t('studio.f.maneuvers')} hint={t('studio.f.maneuversHint')} checked={trajectory.maneuvers.allowed} onChange={on => set('trajectory.maneuvers.allowed', on)}/>
        {trajectory.maneuvers.allowed && <NumberField path="trajectory.maneuvers.maxBurns" label={t('studio.f.maxBurns')} hint={t('studio.f.maxBurnsHint')} value={trajectory.maneuvers.maxBurns} step={1} min={1} max={16} onChange={value => set('trajectory.maneuvers.maxBurns', Math.trunc(value ?? 1))}/>}
      </>}
      <CheckField path="support.crew" label={t('studio.f.crew')} hint={t('studio.f.crewHint')} checked={draft.support.crew} onChange={on => setMany([['support.crew', on]])}/>
    </Group>
    <p className="muted">{t('studio.modelLimitsNote')}</p>
  </>;
}

function RangeInputs({ base, label, unit, step, draftValue, set }: { base: DraftPath; label: string; unit: string; step: number | undefined; draftValue: unknown; set: SectionProps['set'] }) {
  const { t } = useTranslation(), range = typeof draftValue === 'object' && draftValue !== null && 'min' in draftValue && 'max' in draftValue && typeof draftValue.min === 'number' && typeof draftValue.max === 'number' ? { min: draftValue.min, max: draftValue.max } : { min: 0, max: 0 };
  return <>
    <NumberField path={`${base}.min`} label={`${label} · ${t('studio.min')}`} unit={unit} step={step} value={range.min} onChange={value => set(`${base}.min`, value ?? 0)}/>
    <NumberField path={`${base}.max`} label={`${label} · ${t('studio.max')}`} unit={unit} step={step} value={range.max} onChange={value => set(`${base}.max`, value ?? 0)}/>
  </>;
}

function ObjectiveFields({ objective, index, descriptor, others, set }: { objective: ObjectiveDef; index: number; descriptor: FieldDescriptor; others: readonly string[]; set: SectionProps['set'] }) {
  const { t } = useTranslation(), path = `objectives[${index}].spec.${descriptor.path}`, value = getAt(objective.spec, descriptor.path), label = t(`studio.spec.${descriptor.path}`, { defaultValue: descriptor.path });
  if (descriptor.type === 'number') return <NumberField path={path} label={label} unit={descriptor.unit} value={typeof value === 'number' ? value : 0} step={descriptor.step} min={descriptor.min} onChange={next => set(path, next ?? 0)}/>;
  if (descriptor.type === 'range') return <RangeInputs base={path} label={label} unit={descriptor.unit} step={descriptor.step} draftValue={value} set={set}/>;
  const options = descriptor.path === 'afterObjectiveId' ? others : descriptor.options;
  return <SelectField path={path} label={label} value={typeof value === 'string' ? value : options[0] ?? ''} options={options.length ? options : ['']} render={option => option === '' ? t('studio.none') : descriptor.path === 'body' ? bodyName(t, option) : descriptor.path === 'afterObjectiveId' ? option : t(`studio.enum.${option}`, { defaultValue: option })} onChange={next => set(path, next)}/>;
}

function ObjectivesSection({ draft, set }: SectionProps) {
  const { t } = useTranslation(), [kind, setKind] = useState<ObjectiveKind>('DELIVERED_PRODUCT'), list = draft.objectives;
  const move = (from: number, to: number) => { if (to < 0 || to >= list.length) return; const next = [...list]; const [item] = next.splice(from, 1); next.splice(to, 0, item!); set('objectives', next); };
  const requiredCount = list.filter(objective => objective.required).length;
  return <>
    <p className="muted">{t('studio.objectivesNote', { count: requiredCount })}</p>
    <ol className="objective-editor">{list.map((objective, index) => {
      const descriptor = kindDescriptor(objective.spec.kind), base = `objectives[${index}]`, others = list.filter((_, i) => i !== index).map(item => item.id);
      const labelValue = objective.label.text ?? (objective.label.key ? t(objective.label.key) : '');
      return <li key={`${objective.id}:${index}`} className="studio-card">
        <header><h3>{t(`objective.kind.${objective.spec.kind}`)}</h3>
          <div className="button-wrap"><button type="button" className="button" aria-label={t('studio.moveUp', { name: labelValue || objective.id })} disabled={index === 0} onClick={() => move(index, index - 1)}>↑</button><button type="button" className="button" aria-label={t('studio.moveDown', { name: labelValue || objective.id })} disabled={index === list.length - 1} onClick={() => move(index, index + 1)}>↓</button><button type="button" className="button" onClick={() => { if (window.confirm(t('studio.removeObjectiveConfirm'))) set('objectives', list.filter((_, i) => i !== index)); }}>{t('studio.remove')}</button></div></header>
        <div className="field-grid">
          <TextField path={`${base}.label.text`} label={t('studio.f.objectiveLabel')} value={labelValue} maxLength={200} onChange={value => set(`${base}.label`, { text: value })}/>
          <TextField path={`${base}.id`} label={t('studio.f.objectiveId')} value={objective.id} maxLength={32} onChange={value => set(`${base}.id`, value)}/>
          <CheckField path={`${base}.required`} label={t('studio.f.required')} hint={t('studio.f.requiredHint')} checked={objective.required} onChange={value => set(`${base}.required`, value)}/>
          <SelectField path={`${base}.owner`} label={t('studio.f.owner')} value={objective.owner} options={ROLE_IDS} render={(role: RoleId) => t(`role.${role}`)} onChange={value => set(`${base}.owner`, value)}/>
          <NumberField path={`${base}.deadlineSec`} label={t('studio.f.deadline')} unit={t('studio.unit.hours')} hint={t('studio.f.deadlineHint')} nullable value={objective.deadlineSec === null ? null : objective.deadlineSec / HOUR} step={0.5} min={0} onChange={value => set(`${base}.deadlineSec`, value === null ? null : Math.round(value * HOUR))}/>
          <NumberField path={`${base}.dwellSec`} label={t('studio.f.dwell')} unit={t('studio.unit.minutes')} hint={t('studio.f.dwellHint')} value={objective.dwellSec / 60} step={1} min={0} onChange={value => set(`${base}.dwellSec`, Math.round((value ?? 0) * 60))}/>
          {descriptor.fields.map(field => <ObjectiveFields key={field.path} objective={objective} index={index} descriptor={field} others={others} set={set}/>)}
        </div>
        <small>{t('studio.evidenceSource', { source: t(`studio.source.${descriptor.source}`) })}</small>
      </li>;
    })}</ol>
    <div className="studio-add">
      <label>{t('studio.addObjective')}<select value={kind} onChange={event => { const next = OBJECTIVE_KINDS.find(item => item.kind === event.target.value); if (next) setKind(next.kind); }}>{OBJECTIVE_KINDS.map(item => <option key={item.kind} value={item.kind}>{t(`objective.kind.${item.kind}`)}</option>)}</select></label>
      <button type="button" className="button" disabled={list.length >= 12} onClick={() => set('objectives', [...list, newObjective(kind, list.map(item => item.id))])}>{t('studio.add')}</button>
    </div>
    <p className="muted">{t('studio.notModeled')}</p>
  </>;
}

function TerminationSection({ draft, set }: SectionProps) {
  const { t } = useTranslation();
  return <Group title={t('studio.group.termination')} description={t('studio.terminationNote')}>
    <CheckField path="termination.endOnSuccess" label={t('studio.f.endOnSuccess')} hint={t('studio.f.endOnSuccessHint')} checked={draft.termination.endOnSuccess} onChange={value => set('termination.endOnSuccess', value)}/>
    <CheckGroup<FailureCause> path="termination.failOn" legend={t('studio.f.failOn')} hint={t('studio.f.failOnHint')} values={draft.termination.failOn} options={FAILURE_CAUSES} render={cause => t(`studio.failure.${cause}`)} onChange={values => set('termination.failOn', values)}/>
  </Group>;
}

function ReviewSection({ draft, checked, goto }: { draft: DraftDefinition; checked: DraftValidation; goto: (issue: DefinitionIssue) => void }) {
  const { t } = useTranslation();
  return <>
    <section aria-labelledby="studio-review-heading"><h2 id="studio-review-heading">{checked.ok ? t('studio.reviewValid') : t('studio.reviewInvalid', { count: checked.issues.length })}</h2>
      {checked.ok ? <p>{t('studio.reviewValidNote')} <span className="number" aria-label={t('studio.digest')}>{checked.definition.digest.slice(0, 19)}…</span></p>
        : <ul className="issue-list">{checked.issues.map((issue, index) => <li key={index}><button type="button" className="text-button" onClick={() => goto(issue)}><code>{issue.path || t('studio.root')}</code></button> <span className="field-issue"><strong>{t(`studio.issue.${issue.code}`, { defaultValue: issue.code })}</strong> <span lang="en">{issue.message}</span></span></li>)}</ul>}
    </section>
    <ObjectiveList definition={draft}/>
    <p className="muted">{t('studio.reviewRevision')}</p>
  </>;
}
