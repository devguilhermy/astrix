import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrbitChoice } from '@astrix/core';
import { buildExport, defaultDraft, draftFromOrbit, type ExportBody, type ExportDraft } from './exportModel';
import './gmat.css';

const copy = {
  en: {
    title: 'Export initial conditions', intro: 'Writes a GMAT script with one spacecraft, a UTCGregorian epoch and a Keplerian state. No force model, maneuver or propagation is included.',
    body: 'Central body', epoch: 'Epoch (UTC)', periapsis: 'Periapsis altitude', apoapsis: 'Apoapsis altitude', script: 'GMAT script', download: 'Download script',
    exact: 'Re-imported through the same parser: every element matches exactly.', mismatch: 'Re-imported through the same parser: elements differ. Do not use this file.', invalid: 'Cannot export',
  },
  pt: {
    title: 'Exportar condições iniciais', intro: 'Gera um script GMAT com uma espaçonave, época UTCGregorian e estado kepleriano. Sem modelo de forças, manobras ou propagação.',
    body: 'Corpo central', epoch: 'Época (UTC)', periapsis: 'Altitude do periapse', apoapsis: 'Altitude do apoapse', script: 'Script GMAT', download: 'Baixar script',
    exact: 'Reimportado pelo mesmo leitor: todos os elementos coincidem exatamente.', mismatch: 'Reimportado pelo mesmo leitor: os elementos diferem. Não use este arquivo.', invalid: 'Não é possível exportar',
  },
} as const;

const fields: { key: keyof Omit<ExportDraft, 'body' | 'epochUTC'>; label: string; unit: string }[] = [
  { key: 'sma', label: 'SMA', unit: 'km' }, { key: 'ecc', label: 'ECC', unit: '' }, { key: 'inc', label: 'INC', unit: '°' },
  { key: 'raan', label: 'RAAN', unit: '°' }, { key: 'aop', label: 'AOP', unit: '°' }, { key: 'ta', label: 'TA', unit: '°' },
];

/** Starts from the active design's orbit when there is one. */
export function ExportPanel({ initial }: { initial?: OrbitChoice | null }) {
  const { i18n } = useTranslation(), c = copy[i18n.resolvedLanguage?.startsWith('pt') ? 'pt' : 'en'];
  const [draft, setDraft] = useState<ExportDraft>(() => initial ? draftFromOrbit(initial) : defaultDraft);
  const built = useMemo(() => buildExport(draft), [draft]);
  const set = (patch: Partial<ExportDraft>) => setDraft(value => ({ ...value, ...patch }));
  const download = () => {
    if (!built.ok) return;
    const url = URL.createObjectURL(new Blob([built.script], { type: 'text/plain' })), link = document.createElement('a');
    link.href = url; link.download = `astrix-${draft.body.toLowerCase()}-initial-state.script`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="play-section gmat-export" aria-labelledby="gmat-export-title">
    <h2 id="gmat-export-title">{c.title}</h2>
    <p>{c.intro}</p>
    <div className="gmat-export-grid">
      <label>{c.body}<select value={draft.body} onChange={event => set({ body: event.target.value as ExportBody })}><option value="EARTH">Earth · EarthMJ2000Eq</option><option value="MARS">Mars · AstrixMarsFrame (MJ2000Eq)</option></select></label>
      <label>{c.epoch}<input type="text" value={draft.epochUTC} spellCheck={false} onChange={event => set({ epochUTC: event.target.value })}/></label>
      {fields.map(field => <label key={field.key}><span>{field.label}{field.unit && <span className="muted"> ({field.unit})</span>}</span><input type="text" inputMode="decimal" value={draft[field.key]} spellCheck={false} onChange={event => set({ [field.key]: event.target.value })}/></label>)}
    </div>
    {built.ok
      ? <>
        <dl><dt>{c.periapsis}</dt><dd className="number">{built.periapsisAltKm.toFixed(1)} km</dd><dt>{c.apoapsis}</dt><dd className="number">{built.apoapsisAltKm.toFixed(1)} km</dd></dl>
        <p role="status" className={built.roundTrip === 'exact' ? 'gmat-ok' : 'gmat-bad'}>{built.roundTrip === 'exact' ? c.exact : c.mismatch}</p>
        <label className="gmat-script">{c.script}<textarea readOnly rows={Math.min(18, built.script.split('\n').length)} value={built.script} spellCheck={false}/></label>
        <div className="button-wrap"><button className="button primary" onClick={download}>{c.download}</button></div>
      </>
      : <div role="alert" className="play-notice danger"><p><strong>{c.invalid}:</strong> {built.error}</p></div>}
  </section>;
}
