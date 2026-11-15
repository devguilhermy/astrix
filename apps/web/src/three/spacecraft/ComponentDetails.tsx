import { useEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import { X } from 'lucide-react';
import { Vector3 } from 'three';
import { useTranslation } from 'react-i18next';
import type { Design, PartDef, Telemetry } from '@astrix/core';
import { liveReadings, partSpecs, partTraits, type DetailRow } from '../../ui/inspector/partDetails';
import type { SceneView } from '../committedScene';

interface ComponentDetailsProps { part: PartDef; design: Design; current: Telemetry | null; onClose: () => void }

/** Shared pure catalogue/readings model; never reads legacy mission or window stores. */
export function ComponentDetails({ part, design, current, onClose }: ComponentDetailsProps) {
  const { t, i18n } = useTranslation();
  const close = useRef<HTMLButtonElement>(null);
  const quantity = design.parts.filter(item => item.partId === part.id).reduce((sum, item) => sum + item.qty, 0);
  const specs = partSpecs(part, design), readings = liveReadings(part, current, quantity > 0), traits = partTraits(part);
  useEffect(() => { close.current?.focus({ preventScroll: true }); }, [part.id]);
  const rows = (values: readonly DetailRow[], prefix: 'spec' | 'live') => values.map(row => <div key={row.key}>
    <dt>{t(`inspector.${prefix}.${row.key}`)}{row.assumed && <span aria-hidden="true">*</span>}</dt>
    <dd>{row.textKey ? t(`inspector.value.${row.textKey}`) : `${new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: row.digits ?? 2 }).format(row.value ?? 0)} ${row.unit === '' ? t('ui.budgetUnits') : row.unit ?? ''}`}</dd>
  </div>);
  return <article className="immersive-component-panel" aria-label={t('inspector.opened', { name: t(part.nameKey) })} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <header><div><h2>{t(part.nameKey)}</h2><span>{t('inspector.installed', { qty: quantity })}</span></div><button type="button" ref={close} onClick={onClose} aria-label={t('inspector.close')} title={t('inspector.close')}><X size={18}/></button></header>
    <p>{t(part.descKey)}</p>
    <section><h3>{t('inspector.live')}</h3>{current ? <><p className="immersive-component-time">{i18n.resolvedLanguage?.startsWith('pt') ? 'Estado na decisão confirmada' : 'State at the committed decision'} · T+{new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(current.t)} s</p><dl>{rows(readings, 'live')}</dl></> : <p>{t('inspector.liveNone')}</p>}</section>
    <details><summary>{t('inspector.specs')}</summary><dl>{rows(specs, 'spec')}</dl>{specs.some(row => row.assumed) && <p>{t('inspector.assumed')}</p>}</details>
    {traits.length > 0 && <details><summary>{t('inspector.traits')}</summary><ul>{traits.map(trait => <li key={trait}>{t(`inspector.trait.${trait}`)}</li>)}</ul></details>}
  </article>;
}

/** Follows the selected part's world transform; constrained to the unobscured scene. */
export function AnchoredComponentDetails({ view, ...props }: ComponentDetailsProps & { view: SceneView }) {
  const projected = useRef(new Vector3());
  return <Html zIndexRange={[5, 5]} style={{ pointerEvents: 'auto' }} calculatePosition={(object, camera, size) => {
    projected.current.setFromMatrixPosition(object.matrixWorld).project(camera);
    const x = (projected.current.x + 1) * size.width / 2;
    const y = (1 - projected.current.y) * size.height / 2;
    const mobile = size.width <= 900, mission = view === 'play' || view === 'prepare';
    const left = mobile ? 12 : mission ? size.width >= 1100 ? 352 : 672 : 452;
    const right = size.width - (!mobile && mission && size.width >= 1100 ? 332 : 12);
    const width = Math.min(292, right - left);
    const height = mobile ? Math.max(90, size.height * .42 - 100) : Math.min(420, size.height * .52);
    const preferredX = x + 18 + width <= right ? x + 18 : x - width - 18;
    return [Math.max(left, Math.min(right - width, preferredX)), Math.max(82, Math.min((mobile ? size.height * .42 - 8 : size.height - 110) - height, y - 24))];
  }}><ComponentDetails {...props}/></Html>;
}
