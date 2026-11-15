import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type OrbitChoice, CONSTANTS } from '@astrix/core';
import { sampleTrajectory, type Trajectory } from '@astrix/core/interop/gmat';
import { advancedCopy } from './copy';
import { gmatExamples } from './examples';
import { usePlayCopy } from '../play/copy';
import { ExportPanel } from '../gmat/ExportPanel';

function portugueseError(message:string):string {
  if(/Moon|Luna|MOON/.test(message))return 'Estados centrados na Lua não são suportados neste intercâmbio.';
  if(/exceeds|Too many/.test(message))return 'O arquivo excede os limites de tamanho, linhas, amostras ou segmentos.';
  if(/Leap-second|timestamp|UTC/.test(message))return 'A data ou escala de tempo não pertence ao subconjunto UTC suportado.';
  if(/frame|center|metadata|EME2000/.test(message))return 'Confira o centro, quadro e metadados obrigatórios.';
  if(/script|statement|property|literal/.test(message))return 'Somente o subconjunto inerte de estado inicial é aceito; scripts não são executados.';
  return 'O arquivo não pertence ao perfil suportado. Confira os detalhes técnicos.';
}

/** Scientific interchange is independent of the gameplay renderer and never awards evidence. */
export function AdvancedTools({initialOrbit,onPrepare}:{initialOrbit?:OrbitChoice|null;onPrepare?:(orbit:OrbitChoice)=>void}) {
  const {i18n}=useTranslation(),c=advancedCopy[i18n.resolvedLanguage?.startsWith('pt')?'pt':'en'],p=usePlayCopy(),pt=i18n.resolvedLanguage?.startsWith('pt');
  const [kind,setKind]=useState<'oem'|'report'|'script'>('oem'),[object,setObject]=useState(''),[file,setFile]=useState<File|null>(null),[example,setExample]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Trajectory|OrbitChoice|null>(null),[viewing,setViewing]=useState(false);
  const worker=useRef<Worker|null>(null);
  useEffect(()=>()=>{worker.current?.terminate();},[]);
  const clear=()=>{worker.current?.terminate();worker.current=null;setBusy(false);setResult(null);setViewing(false);setError('');};
  const inspect=()=>{
    if(!file){setError(c.unsupported);return;}
    clear();setBusy(true);
    try {
      const w=new Worker(new URL('./parser.worker.ts',import.meta.url),{type:'module'});worker.current=w;
      w.onmessage=(event:MessageEvent<{result?:Trajectory|OrbitChoice;error?:string}>)=>{if(worker.current!==w)return;setBusy(false);setError(event.data.error??'');setResult(event.data.result??null);worker.current=null;w.terminate();};
      w.onerror=()=>{if(worker.current!==w)return;setBusy(false);setError(c.worker);worker.current=null;w.terminate();};
      w.postMessage({file,kind,object});
    }catch{setBusy(false);setError(c.worker);}
  };
  const orbit=result&&'smaKm'in result?result:null,trajectory=result&&'segments'in result?result:null;
  const chooseExample=async(name:string)=>{
    clear();setExample(name);
    const chosen=gmatExamples.find(item=>item.file===name);
    if(!chosen){setFile(null);return;}
    setKind(chosen.kind);setObject(chosen.object);setFile(null);
    try{
      const response=await fetch(`${import.meta.env.BASE_URL}gmat-examples/${chosen.file}`);
      if(!response.ok)throw new Error(String(response.status));
      setFile(new File([await response.blob()],chosen.file,{type:'text/plain'}));
    }catch{setError(pt?'Não foi possível carregar o exemplo.':'Could not load the example.');}
  };
  const chosenExample=gmatExamples.find(item=>item.file===example);
  return <section className="gmat-tools" aria-label={p('tools')}><h1>{p('tools')}</h1><p>{c.warning}</p><p>{pt?'Quadros EarthMJ2000Eq/MarsMJ2000Eq nos estados iniciais; OEM EME2000, UTC, km e km/s. Lua não suportada. Nenhum script é executado.':'Initial states use EarthMJ2000Eq/MarsMJ2000Eq; OEM uses EME2000, UTC, km and km/s. Moon interchange is unsupported. Uploaded scripts are never executed.'}</p>
    <div className="play-form"><label>{pt?'Exemplo da NASA':'NASA example'}<select value={example} onChange={event=>void chooseExample(event.target.value)}><option value="">{pt?'Escolher um exemplo…':'Choose an example…'}</option>{gmatExamples.map(item=><option key={item.file} value={item.file}>{item.file}</option>)}</select>{chosenExample&&<small className="muted">{pt?chosenExample.pt:chosenExample.en}</small>}</label>
      <label>{c.format}<select value={kind} onChange={event=>{clear();setExample('');setKind(event.target.value as typeof kind);}}><option value="oem">CCSDS OEM 2.0 KVN</option><option value="report">GMAT ReportFile</option><option value="script">GMAT initial-state script</option></select></label>
      {kind!=='oem'&&<label>{c.object}<input value={object} onChange={event=>{clear();setObject(event.target.value);}}/></label>}
      <label>{c.file}<input key={example} type="file" accept=".txt,.oem,.script,text/plain" onChange={event=>{clear();setExample('');setFile(event.target.files?.[0]??null);}}/></label>
      <div className="button-wrap"><button className="button primary" disabled={busy||!file} onClick={inspect}>{c.parse}</button>{busy&&<button className="button" onClick={clear}>{c.cancel}</button>}</div>
    </div>
    {busy&&<p role="status">{pt?'Inspecionando arquivo…':'Inspecting file…'}</p>}
    {error&&<div role="alert" className="play-notice danger"><p>{pt?portugueseError(error):error}</p>{pt&&<details><summary>{c.detail}</summary><p lang="en">{error}</p></details>}</div>}
    {orbit&&<section className="play-section"><h2>{c.preview}</h2><p>{orbit.body} · {orbit.frame} · {orbit.epochUTC}</p><dl><dt>SMA</dt><dd>{orbit.smaKm} km</dd><dt>e</dt><dd>{orbit.ecc}</dd><dt>i</dt><dd>{orbit.inclinationDeg}°</dd><dt>RAAN / AOP / TA</dt><dd>{orbit.raanDeg}° / {orbit.argPeriapsisDeg}° / {orbit.trueAnomalyDeg}°</dd></dl>
      {onPrepare&&<p>{pt?'Importar abre uma nova preparação compatível. A órbita precisa passar nos limites do catálogo e na referência; ela não substitui um voo em andamento.':'Import opens a new compatible preparation. The orbit must pass catalogue constraints and a reference flight; it never replaces an active flight.'}</p>}
      {onPrepare&&<button className="button primary" onClick={()=>onPrepare(orbit)}>{pt?'Preparar nova missão com este estado':'Prepare a new mission with this state'}</button>}
    </section>}
    {trajectory&&<section className="play-section"><h2>{c.preview}</h2><p>{trajectory.source} · {trajectory.object} · {trajectory.body} · {trajectory.frame} · {trajectory.timeSystem} · {trajectory.units}</p><p>{trajectory.segments.length} {c.segments} · {trajectory.segments.reduce((sum,segment)=>sum+segment.samples.length,0)} {c.samples}</p><button className="button" onClick={()=>setViewing(!viewing)}>{viewing?p('close'):c.viewer}</button>{viewing&&<TrajectoryView trajectory={trajectory}/>}</section>}
    <ExportPanel initial={initialOrbit}/>
  </section>;
}

function TrajectoryView({trajectory}:{trajectory:Trajectory}) {
  const {i18n}=useTranslation(),pt=i18n.resolvedLanguage?.startsWith('pt'),c=advancedCopy[pt?'pt':'en'];
  const start=trajectory.segments[0].samples[0].time,end=trajectory.segments.at(-1)!.samples.at(-1)!.time;
  const [time,setTime]=useState(start),[playing,setPlaying]=useState(false),[plane,setPlane]=useState<'XY'|'XZ'>('XY');
  useEffect(()=>{setTime(start);setPlaying(false);},[start,trajectory]);
  useEffect(()=>{if(!playing)return;let previous=performance.now();const id=window.setInterval(()=>{const now=performance.now(),delta=now-previous;previous=now;setTime(value=>{const next=Math.min(end,value+delta);if(next===end)setPlaying(false);return next;});},100);return()=>clearInterval(id);},[playing,end]);
  const geometry=useMemo(()=>{
    const count=trajectory.segments.reduce((sum,segment)=>sum+segment.samples.length,0),stride=Math.max(1,Math.ceil(count/1200));
    let extent=CONSTANTS[trajectory.body].radius.v*1.2;
    for(const segment of trajectory.segments)for(const sample of segment.samples)extent=Math.max(extent,Math.abs(sample.positionKm[0]),Math.abs(sample.positionKm[plane==='XY'?1:2]));
    const scale=160/extent,paths:string[]=[];
    for(const segment of trajectory.segments){let path='';for(let index=0;index<segment.samples.length;index++){
      const sample=segment.samples[index],gap=index>0&&sample.time-segment.samples[index-1].time>120000;
      if(gap&&path){paths.push(path);path='';}
      if(index%stride!==0&&index!==segment.samples.length-1&&!gap)continue;
      const x=200+sample.positionKm[0]*scale,y=180-sample.positionKm[plane==='XY'?1:2]*scale;
      path+=`${path?'L':'M'}${x.toFixed(2)},${y.toFixed(2)} `;
    }if(path)paths.push(path);}
    return {paths,scale,radius:CONSTANTS[trajectory.body].radius.v*scale};
  },[trajectory,plane]);
  const position=sampleTrajectory(trajectory,time);
  return <div className="trajectory-view"><p>{pt?'Referência externa, sem recursos, objetivos ou pontuação. Projeção cartesiana; o caminho é amostrado para exibição.':'External reference only: no resources, objectives or score. Cartesian projection; the displayed path is sampled.'}</p>
    <label>{pt?'Projeção':'Projection'}<select value={plane} onChange={event=>setPlane(event.target.value as typeof plane)}><option>XY</option><option>XZ</option></select></label>
    <svg viewBox="0 0 400 360" role="img" aria-label={pt?'Trajetória externa e posição selecionada':'External trajectory and selected position'}><circle cx="200" cy="180" r={geometry.radius} fill="#284857"/>{geometry.paths.map((path,index)=><path key={index} d={path} fill="none" stroke="#72dce5" strokeWidth="1.5"/>)}{position&&<circle cx={200+position[0]*geometry.scale} cy={180-position[plane==='XY'?1:2]*geometry.scale} r="4" fill="#f1b777"/>}</svg>
    <p>{new Date(time).toISOString()} · {((time-start)/1000).toFixed(1)} s</p>{!position&&<p role="status">{c.gap}</p>}
    <label>{c.time}<input type="range" min={start} max={end} step="1" value={time} onChange={event=>{setPlaying(false);setTime(Number(event.target.value));}}/></label><button className="button" onClick={()=>setPlaying(!playing)} disabled={time>=end&&!playing}>{playing?c.pause:c.play}</button><button className="button" onClick={()=>{setPlaying(false);setTime(start);}}>{pt?'Voltar ao início':'Return to start'}</button>
    {position&&<p className="number">{position.map(value=>value.toFixed(3)).join(', ')} km</p>}<p>{pt?'Interpolação linear apenas em intervalos de até 120 segundos; sem extrapolação nem linhas sobre lacunas.':'Linear interpolation only across intervals up to 120 seconds; no extrapolation or lines across gaps.'}</p>
  </div>;
}
