import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { listParts } from '@astrix/core';
import { useMission } from '../../store';
import { useWorkbench } from '../../three/spacecraft/workbenchState';
import { DraggablePanel } from '../layout/DraggablePanel';
import { showWindow, useWindows } from '../layout/windows';
import { NumberValue } from '../primitives';
import { ExplainButton } from '../science/ExplainButton';
import { categoryTopic } from '../phases/Design';
import { partIcons } from '../icons';
import { liveReadings, partSpecs, partTraits, type DetailRow } from './partDetails';
import { closePartDetails } from './openPart';
import './inspector.css';

function Row({ row, prefix }: { row: DetailRow; prefix: 'spec' | 'live' }) {
  const { t } = useTranslation();
  return <><dt>{t(`inspector.${prefix}.${row.key}`)}{row.assumed && <span aria-hidden="true">*</span>}</dt>
    <dd>{row.textKey ? t(`inspector.value.${row.textKey}`) : <NumberValue value={row.value ?? 0} unit={row.unit === '' ? t('ui.budgetUnits') : row.unit} digits={row.digits ?? 2}/>}</dd></>;
}

export function PartInspector() {
  const { t } = useTranslation();
  const partId = useWorkbench(state => state.inspectedPartId);
  const design = useMission(state => state.design), telemetry = useMission(state => state.telemetry), sim = useMission(state => state.sim);
  const attemptId = useMission(state => state.attemptId), stage = useMission(state => state.activeStage);
  const layout = useWindows(state => state.layout), compactWindow = useWindows(state => state.compactWindow);
  const part = design && partId ? listParts(design.busId).find(item => item.id === partId) ?? null : null;
  useEffect(() => { useWorkbench.getState().inspect(null); }, [attemptId]);
  useEffect(() => { if (partId && !part) useWorkbench.getState().inspect(null); }, [partId, part]);
  // A phone sheet is transient: opening another sheet closes component details instead of leaving an unreachable header.
  useEffect(() => { if (partId && layout !== 'desktop' && compactWindow !== 'part') useWorkbench.getState().inspect(null); }, [partId, layout, compactWindow]);
  if (!design || !part) return null;
  const qty = design.parts.filter(item => item.partId === part.id).reduce((sum, item) => sum + item.qty, 0);
  const specs = partSpecs(part, design), traits = partTraits(part), live = liveReadings(part, sim ? telemetry : null, qty > 0);
  const name = t(part.nameKey), Icon = partIcons[part.category];
  return <DraggablePanel id="part" title={`${t('inspector.title')}: ${name}`}>
    <article className="part-inspector" aria-labelledby="part-inspector-heading">
      <header className="part-inspector-head"><Icon size={22} aria-hidden="true"/><div><h2 id="part-inspector-heading" tabIndex={-1}>{name}</h2>
        <p className="muted">{t(`flight.cat${part.category}`)} · {t('inspector.owner')}: {t(`role.${part.role}`)}</p></div>
        <span className="chip">{qty ? t('inspector.installed', { qty }) : t('inspector.notInstalled')}</span></header>
      <p>{t(part.descKey)}</p>
      {sim && <section aria-labelledby="part-live"><h3 id="part-live">{t('inspector.live')}</h3>
        {live.length ? <dl className="part-readings" aria-live="off">{live.map(row => <Row key={row.key} row={row} prefix="live"/>)}</dl> : <p className="muted">{t('inspector.liveNone')}</p>}</section>}
      <section aria-labelledby="part-specs"><h3 id="part-specs">{t('inspector.specs')}</h3>
        <dl className="part-readings">{specs.map(row => <Row key={row.key} row={row} prefix="spec"/>)}</dl>
        {specs.some(row => row.assumed) && <p className="small muted">{t('inspector.assumed')}</p>}</section>
      {traits.length > 0 && <section aria-labelledby="part-traits"><h3 id="part-traits">{t('inspector.traits')}</h3><ul className="part-traits">{traits.map(trait => <li key={trait}>{t(`inspector.trait.${trait}`)}</li>)}</ul></section>}
      <div className="button-wrap">
        <ExplainButton topic={categoryTopic[part.category]}/>
        {!sim && stage === 'DESIGN' && <button type="button" className="button" onClick={() => { useWorkbench.getState().selectCategory(part.category); showWindow('mission', `#part-${part.id}`); }}>{t('inspector.findInWorkshop')}</button>}
        <button type="button" className="button" onClick={closePartDetails}>{t('inspector.close')}</button>
      </div>
    </article>
  </DraggablePanel>;
}
