import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { orbitAltitudes, quoteSetOrbit, withOrbitAltitudes, type OrbitChoice } from '@astrix/core';
import { exportInitialOrbit, sampleTrajectory, type Trajectory } from '@astrix/core/interop/gmat';
import { useMission } from '../../store';
import { advancedCopy } from './copy';
import { TeachingCard } from '../science/TeachingCard';
import { trajectoryViewer } from './trajectoryStore';

function intervalRange(trajectory: Trajectory): string {
 let min = Infinity, max = 0;
 for (const segment of trajectory.segments) for (let i = 1; i < segment.samples.length; i++) {
  const seconds = (segment.samples[i].time - segment.samples[i-1].time) / 1000;
  min = Math.min(min, seconds); max = Math.max(max, seconds);
 }
 return Number.isFinite(min) ? `${min}–${max} s` : 'N/A';
}

function portugueseError(message: string): string {
 if (/exceeds|Too many/.test(message)) return 'O arquivo excede os limites de tamanho, linha, amostras ou segmentos.';
 if (/Leap-second/.test(message)) return 'Segundos intercalares não são suportados; use timestamps UTC sem segundo 60.';
 if (/timestamp|UTC date/.test(message)) return 'A data UTC é inválida ou usa um formato não suportado.';
 if (/strictly increasing|backward|Overlapping/.test(message)) return 'Os tempos devem avançar e os segmentos não podem se sobrepor.';
 if (/Missing|incomplete|no data|no samples|Empty|nonempty/.test(message)) return 'Faltam metadados ou amostras obrigatórias; confira o perfil selecionado.';
 if (/metadata|center|frame|CoordinateSystem|EME2000|TIME_SYSTEM/.test(message)) return 'Centro, quadro, escala de tempo ou metadados não são suportados ou são inconsistentes.';
 if (/Report|columns|header/.test(message)) return 'O relatório não identifica exclusivamente as colunas UTC e cartesianas exigidas para a espaçonave selecionada.';
 if (/spacecraft|Spacecraft|object|Object/.test(message)) return 'Selecione uma espaçonave declarada e não ambígua.';
 if (/script|statement|property|literal|Keplerian/.test(message)) return 'O script não pertence ao subconjunto de estado inicial; use OEM para visualizar uma missão completa.';
 if (/orbit|periapsis/.test(message)) return 'A órbita deve ser elíptica, com inclinação válida e periastro acima da superfície.';
 if (/finite|numeric|values/.test(message)) return 'Os valores de estado devem ser números finitos literais.';
 if (/ORBIT_NOT_OFFERED|RIDE_MISMATCH|ROLE_LOCKED|INVALID_PARAMETER/.test(message)) return 'A órbita não passou nas regras atuais de missão, lançador ou autorização.';
 return 'Não foi possível importar o arquivo ou aplicar a órbita com as opções atuais.';
}

export function AdvancedTools() {
 const {i18n} = useTranslation(), c = advancedCopy[i18n.resolvedLanguage?.startsWith('pt') ? 'pt' : 'en'];
 const design = useMission(s => s.design), actor = useMission(s => s.actor), applyDesign = useMission(s => s.applyDesign), pauseMission = useMission(s => s.pause), clearPause = useMission(s => s.clearPauseReason);
 const active = trajectoryViewer(s => s.active), trajectory = trajectoryViewer(s => s.trajectory), time = trajectoryViewer(s => s.time), playing = trajectoryViewer(s => s.playing);
 const [kind,setKind] = useState<'oem'|'report'|'script'>('oem'), [object,setObject] = useState(''), [file,setFile] = useState<File|null>(null), [busy,setBusy] = useState(false), [error,setError] = useState(''), [result,setResult] = useState<Trajectory|OrbitChoice|null>(null);
 const worker = useRef<Worker|null>(null);
 useEffect(() => () => { worker.current?.terminate(); }, []);
 useEffect(() => {
  if (!active || !playing || !trajectory) return;
  let last = performance.now();
  const id = window.setInterval(() => { const now = performance.now(), current = trajectoryViewer.getState(), end = trajectory.segments[trajectory.segments.length-1].samples.at(-1)!.time; const next = Math.min(end,current.time + (now-last)); last = now; current.seek(next); if (next >= end) current.play(false); }, 250);
  return () => window.clearInterval(id);
 }, [active,playing,trajectory]);
 const inspect = () => {
  if (!file) { setError(c.unsupported); return; }
  worker.current?.terminate(); setError(''); setResult(null); setBusy(true);
  const w = new Worker(new URL('./parser.worker.ts', import.meta.url), {type:'module'}); worker.current = w;
  w.onmessage = (event: MessageEvent<{result?:Trajectory|OrbitChoice;error?:string}>) => { setBusy(false); setError(event.data.error ?? ''); setResult(event.data.result ?? null); w.terminate(); if (worker.current === w) worker.current = null; };
  w.onerror = () => { setBusy(false); setError(c.worker); w.terminate(); worker.current = null; };
  w.postMessage({file,kind,object});
 };
 const orbit = result && 'smaKm' in result ? result : null;
 const imported = result && 'segments' in result ? result : null;
 const interval = useMemo(() => imported ? intervalRange(imported) : '', [imported]);
 const pt = i18n.resolvedLanguage?.startsWith('pt'), number = new Intl.NumberFormat(i18n.resolvedLanguage, {maximumFractionDigits: 4});
 const bodyName = (body: string) => body === 'EARTH' ? (pt ? 'Terra' : 'Earth') : (pt ? 'Marte' : 'Mars');
 const teachingValues: Record<string, string | number> = orbit ? {
  [pt ? 'Corpo' : 'Body']: bodyName(orbit.body),
  [pt ? 'Época UTC' : 'UTC epoch']: orbit.epochUTC,
  [pt ? 'Semieixo maior' : 'Semi-major axis']: `${number.format(orbit.smaKm)} km`,
  [pt ? 'Excentricidade' : 'Eccentricity']: number.format(orbit.ecc),
  [pt ? 'Inclinação' : 'Inclination']: `${number.format(orbit.inclinationDeg)}°`,
 } : imported ? {
  [pt ? 'Corpo' : 'Body']: bodyName(imported.body),
  [pt ? 'Segmentos' : 'Segments']: imported.segments.length,
  [pt ? 'Amostras' : 'Samples']: imported.segments.reduce((n,s)=>n+s.samples.length,0),
  [pt ? 'Intervalo entre amostras' : 'Sample interval']: interval,
 } : {[pt ? 'Formato' : 'Format']:kind};
 const apply = (candidate:OrbitChoice) => { if (!design) return; const quote = quoteSetOrbit(design,candidate,actor()); if (!quote.ok) { setError(`${quote.code}: ${JSON.stringify(quote.values)}`); return; } if (!applyDesign(quote)) setError(c.stale); else setError(''); };
 const download = () => { if (!design?.orbit) return; const url = URL.createObjectURL(new Blob([exportInitialOrbit(design.orbit)],{type:'text/plain'})); const a = document.createElement('a'); a.href=url; a.download='astrix-initial.script'; a.click(); URL.revokeObjectURL(url); };
 return <section aria-label={c.title}><h3>{c.title}</h3><p>{c.warning}</p>
  <label>{c.format} <select value={kind} onChange={e => {setKind(e.target.value as typeof kind); setResult(null);}}><option value="oem">CCSDS OEM 2.0 KVN</option><option value="report">GMAT ReportFile</option><option value="script">GMAT initial-state script</option></select></label>
  <TeachingCard topic={active ? 'viewer-provenance' : kind === 'script' ? 'initial-orbit-state' : 'external-trajectories'} context={active ? 'advanced.viewer' : `advanced.${kind}`} values={teachingValues}/>
  {kind !== 'oem' && <label>{c.object} <input value={object} onChange={e=>setObject(e.target.value)}/></label>}
  <label>{c.file} <input type="file" accept=".txt,.oem,.script,text/plain" onChange={e=>{setFile(e.target.files?.[0] ?? null);setResult(null);}}/></label>
  <button type="button" disabled={busy} onClick={inspect}>{c.parse}</button>{busy && <button type="button" onClick={()=>{worker.current?.terminate();worker.current=null;setBusy(false);}}>{c.cancel}</button>}
  {error && <p role="alert">{c.error}: {i18n.resolvedLanguage?.startsWith('pt') && error !== c.unsupported && error !== c.worker && error !== c.stale ? <>{portugueseError(error)} <small>{c.detail}: {error}</small></> : error}</p>}
  {orbit && <div><h4>{c.preview}</h4><p>{orbit.body} · {orbit.frame} · {orbit.epochUTC} · SMA {orbit.smaKm} km · e {orbit.ecc} · i {orbit.inclinationDeg}° · RAAN {orbit.raanDeg}° · AOP {orbit.argPeriapsisDeg}° · TA {orbit.trueAnomalyDeg}°</p><button type="button" onClick={()=>apply(orbit)}>{c.apply}</button>{design?.orbit && <button type="button" onClick={()=>{const alt = orbitAltitudes(orbit); apply(withOrbitAltitudes(design.orbit!,alt.altitudeKm,alt.apoapsisAltitudeKm,orbit.inclinationDeg));}}>{c.shape}</button>}</div>}
  {imported && <div><h4>{c.preview}</h4><p>{imported.source} · {imported.object} {imported.objectId && `(${imported.objectId})`} · {imported.body} · {imported.frame} · {imported.timeSystem} · {imported.units} · {imported.segments.length} {c.segments} · {imported.segments.reduce((n,s)=>n+s.samples.length,0)} {c.samples} · {c.interval} {interval}</p><button type="button" onClick={()=>{pauseMission('viewer');trajectoryViewer.getState().open(imported);}}>{c.viewer}</button></div>}
  {design?.orbit && <button type="button" onClick={download}>{c.export}</button>}
  {active && trajectory && <div><p>{trajectory.source} · {trajectory.object} · {trajectory.body} · {new Date(time).toISOString()} · {c.elapsed} {((time-trajectory.segments[0].samples[0].time)/1000).toFixed(1)} s · {i18n.resolvedLanguage?.startsWith('pt') ? 'Interpolação linear só até 120 segundos; sem extrapolação. Linhas limitadas podem omitir segmentos.' : 'Linear interpolation only up to 120 seconds; no extrapolation. Bounded path lines may omit segments.'}</p>{!sampleTrajectory(trajectory,time) && <p role="status">{c.gap}</p>}<label>{c.time}<input type="range" min={trajectory.segments[0].samples[0].time} max={trajectory.segments.at(-1)!.samples.at(-1)!.time} value={time} onChange={e=>trajectoryViewer.getState().seek(Number(e.target.value))}/></label><button type="button" onClick={()=>trajectoryViewer.getState().play(!playing)}>{playing?c.pause:c.play}</button><button type="button" onClick={()=>{trajectoryViewer.getState().exit();clearPause('viewer');}}>{c.close}</button></div>}
 </section>;
}
