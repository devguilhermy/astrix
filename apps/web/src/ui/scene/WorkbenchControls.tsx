import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { listParts, type Design } from '@astrix/core';
import { useWorkbench } from '../../three/spacecraft/workbenchState';
import { requestCue } from '../guide/cueStore';
import { openPartDetails } from '../inspector/openPart';

export function WorkbenchControls({ design, reducedMotion }: { design: Design; reducedMotion: boolean }) {
 const { t } = useTranslation();
 const workbench = useWorkbench();
 const categories = useMemo(() => [...new Set(listParts(design.busId).map(part => part.category))], [design.busId]);
 const installed = useMemo(() => { const parts = listParts(design.busId); return design.parts.map(item => parts.find(part => part.id === item.partId)).filter(part => !!part); }, [design]);
 return <details className="scene-workbench" data-cue-target="spacecraft">
  <summary>{t('flight.slots')}</summary>
  <p>{t('flight.slotHint')}</p>
  <div className="workbench-toggles"><label><input type="checkbox" checked={workbench.exploded} onChange={event => workbench.setExploded(event.target.checked)}/>{t('flight.exploded')}</label><label><input type="checkbox" checked={workbench.dimensions} onChange={event => workbench.setDimensions(event.target.checked)}/>{t('flight.dimensions')}</label><label><input type="checkbox" checked={workbench.turntable && !reducedMotion} disabled={reducedMotion} onChange={event => workbench.setTurntable(event.target.checked)}/>{t('flight.turntable')}</label></div>
  <div className="workbench-categories">{categories.map(category => <button type="button" key={category} aria-pressed={workbench.selectedCategory === category} aria-label={t('flight.slot', { category: t(`flight.cat${category}`) })} onPointerEnter={() => workbench.setHoveredCategory(category)} onPointerLeave={() => workbench.setHoveredCategory(null)} onFocus={() => workbench.setHoveredCategory(category)} onBlur={() => workbench.setHoveredCategory(null)} onClick={() => { workbench.selectCategory(category); requestCue('parts'); }}>{t(`flight.cat${category}`)}</button>)}</div>
  {installed.length > 0 && <><p>{t('inspector.componentsHint')}</p><div className="workbench-categories" role="group" aria-label={t('inspector.components')}>{installed.map(part => <button type="button" key={part.id} aria-pressed={workbench.inspectedPartId === part.id} aria-label={t('inspector.inspect', { name: t(part.nameKey) })} onClick={event => openPartDetails(part.id, event.currentTarget)}>{t(part.nameKey)}</button>)}</div></>}
 </details>;
}
