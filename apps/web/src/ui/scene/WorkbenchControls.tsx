import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { listParts, type Design } from '@astrix/core';
import { useMission } from '../../store';
import { useWorkbench } from '../../three/spacecraft/workbenchState';
import { requestCue } from '../guide/cueStore';
import { openPartDetails } from '../inspector/openPart';
import { showWindow } from '../layout/windows';

export function WorkbenchControls({design,reducedMotion}:{design:Design;reducedMotion:boolean}) {
 const {t}=useTranslation(),workbench=useWorkbench(),stage=useMission(s=>s.activeStage),hasFlight=useMission(s=>!!s.sim);
 const parts=useMemo(()=>listParts(design.busId),[design.busId]);
 const categories=useMemo(()=>[...new Set(parts.map(part=>part.category))],[parts]);
 const installed=useMemo(()=>design.parts.map(item=>parts.find(part=>part.id===item.partId)).filter(part=>!!part),[design,parts]);
 return <section className="control-workbench" data-cue-target="spacecraft" aria-label={t('flight.slots')}>
  <p>{t(hasFlight?'control.viewOnly':'flight.slotHint')}</p>
  {!hasFlight&&<div className="workbench-toggles">
   <label data-cue-target="slot-exploded"><input type="checkbox" checked={workbench.exploded} onChange={event=>workbench.setExploded(event.target.checked)}/>{t('flight.exploded')}</label>
   <label data-cue-target="slot-dimensions"><input type="checkbox" checked={workbench.dimensions} onChange={event=>workbench.setDimensions(event.target.checked)}/>{t('flight.dimensions')}</label>
   <label data-cue-target="slot-turntable"><input type="checkbox" checked={workbench.turntable&&!reducedMotion} disabled={reducedMotion} onChange={event=>workbench.setTurntable(event.target.checked)}/>{t('flight.turntable')}{reducedMotion&&<small>{t('ui.reducedMotion')}</small>}</label>
  </div>}
  {!hasFlight&&<div className="workbench-categories">{categories.map(category=><button type="button" key={category} data-cue-target={`slot-${category}`} aria-pressed={workbench.selectedCategory===category} aria-label={t('flight.slot',{category:t(`flight.cat${category}`)})} onPointerEnter={()=>workbench.setHoveredCategory(category)} onPointerLeave={()=>workbench.setHoveredCategory(null)} onFocus={()=>workbench.setHoveredCategory(category)} onBlur={()=>workbench.setHoveredCategory(null)} onClick={()=>{workbench.selectCategory(category);if(stage==='DESIGN'){useMission.getState().setSubstep('equipment');showWindow('mission','#parts');}requestCue('parts');}}>{t(`flight.cat${category}`)}</button>)}</div>}
  {installed.length>0&&<><p>{t('inspector.componentsHint')}</p><div className="workbench-categories" role="group" aria-label={t('inspector.components')}>{installed.map(part=><button type="button" key={part.id} data-cue-target={`component-${part.id}`} aria-pressed={workbench.inspectedPartId===part.id} aria-label={t('inspector.inspect',{name:t(part.nameKey)})} onClick={event=>openPartDetails(part.id,event.currentTarget)}>{t(part.nameKey)}</button>)}</div></>}
 </section>;
}
