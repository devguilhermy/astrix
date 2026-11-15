import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type OrbitChoice } from '@astrix/core';
import { type Trajectory } from '@astrix/core/interop/gmat';
import { trajectoryViewer, type GmatSubject } from './trajectoryStore';
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
  const [kind,setKind]=useState<'oem'|'report'|'script'>('oem'),[object,setObject]=useState(''),[file,setFile]=useState<File|null>(null),[example,setExample]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Trajectory|OrbitChoice|null>(null),[skipped,setSkipped]=useState({statements:0,commands:0});
  const worker=useRef<Worker|null>(null),pendingExample=useRef(''),imported=useRef<GmatSubject|null>(null),shown=trajectoryViewer(state=>state.subject);
  useEffect(()=>()=>{worker.current?.terminate();},[]);
  // A cleared or failed import must not leave its stale data in the 3D view.
  const clear=()=>{pendingExample.current='';worker.current?.terminate();worker.current=null;setBusy(false);setResult(null);setError('');if(imported.current&&trajectoryViewer.getState().subject===imported.current)trajectoryViewer.getState().exit();imported.current=null;};
  const show=(value:Trajectory|OrbitChoice,label=object)=>{imported.current='segments'in value?{kind:'trajectory',trajectory:value,origin:'import'}:{kind:'orbit',orbit:value,label,origin:'import'};trajectoryViewer.getState().show(imported.current);};
  // Inputs are passed explicitly so an example can be parsed in the same step that sets the form state.
  const inspect=(input={file,kind,object})=>{
    if(!input.file){setError(c.unsupported);return;}
    clear();setBusy(true);
    try {
      const w=new Worker(new URL('./parser.worker.ts',import.meta.url),{type:'module'});worker.current=w;
      w.onmessage=(event:MessageEvent<{result?:Trajectory|OrbitChoice;error?:string;ignoredStatements?:number;missionCommands?:number}>)=>{if(worker.current!==w)return;setBusy(false);setError(event.data.error??'');setResult(event.data.result??null);setSkipped({statements:event.data.ignoredStatements??0,commands:event.data.missionCommands??0});if(event.data.result)show(event.data.result,input.object);worker.current=null;w.terminate();};
      w.onerror=()=>{if(worker.current!==w)return;setBusy(false);setError(c.worker);worker.current=null;w.terminate();};
      w.postMessage(input);
    }catch{setBusy(false);setError(c.worker);}
  };
  const orbit=result&&'smaKm'in result?result:null,trajectory=result&&'segments'in result?result:null;
  const inScene=!!imported.current&&shown===imported.current;
  const sceneButton=result&&<p className="gmat-scene-note">{inScene?(pt?'Exibido na vista 3D.':'Shown in the 3D view.'):<button className="button" onClick={()=>show(result)}>{pt?'Mostrar na vista 3D':'Show in the 3D view'}</button>}</p>;
  const chooseExample=async(name:string)=>{
    clear();setExample(name);pendingExample.current=name;
    const chosen=gmatExamples.find(item=>item.file===name);
    if(!chosen){setFile(null);return;}
    setKind(chosen.kind);setObject(chosen.object);setFile(null);setBusy(true);
    try{
      const response=await fetch(chosen.url);
      // A host answers a missing file with the app's index.html; never feed that to the parser.
      if(!response.ok||response.headers.get('content-type')?.includes('text/html'))throw new Error(String(response.status));
      const loaded=new File([await response.blob()],chosen.file,{type:'text/plain'});
      if(pendingExample.current!==name)return;
      setFile(loaded);inspect({file:loaded,kind:chosen.kind,object:chosen.object});
    }catch{if(pendingExample.current!==name)return;setBusy(false);setError(pt?`Não foi possível carregar o exemplo ${chosen.file}.`:`Could not load example ${chosen.file}.`);}
  };
  const chosenExample=gmatExamples.find(item=>item.file===example);
  return <section className="gmat-tools" aria-label={p('tools')}><h1>{p('tools')}</h1><p>{c.warning}</p><p>{pt?'Quadros EarthMJ2000Eq/MarsMJ2000Eq e um quadro MJ2000Eq centrado no Sol nos estados iniciais; OEM EME2000, UTC, km e km/s. Lua não suportada. Nenhum script é executado.':'Initial states use EarthMJ2000Eq/MarsMJ2000Eq or a Sun-centred MJ2000Eq frame; OEM uses EME2000, UTC, km and km/s. Moon interchange is unsupported. Uploaded scripts are never executed.'}</p>
    <div className="play-form"><label>{pt?'Exemplo':'Example'}<select value={example} onChange={event=>void chooseExample(event.target.value)}><option value="">{pt?'Escolher um exemplo…':'Choose an example…'}</option>{(['astrix','nasa'] as const).map(group=><optgroup key={group} label={group==='nasa'?(pt?'Exemplos do GMAT da NASA':'NASA GMAT samples'):(pt?'Arquivos ASTRIX no perfil suportado':'ASTRIX files in the supported profile')}>{gmatExamples.filter(item=>item.group===group).map(item=><option key={item.file} value={item.file}>{item.file}</option>)}</optgroup>)}</select>{chosenExample&&<small className="muted">{pt?chosenExample.pt:chosenExample.en}</small>}</label>
      <label>{c.format}<select value={kind} onChange={event=>{clear();setExample('');setKind(event.target.value as typeof kind);}}><option value="oem">CCSDS OEM 1.0/2.0 KVN</option><option value="report">GMAT ReportFile</option><option value="script">GMAT script (initial state)</option></select></label>
      {kind!=='oem'&&<label>{c.object}<input value={object} onChange={event=>{clear();setObject(event.target.value);}}/></label>}
      <label>{c.file}<input key={example} type="file" accept=".txt,.oem,.script,text/plain" onChange={event=>{clear();setExample('');setFile(event.target.files?.[0]??null);}}/></label>
      <div className="button-wrap"><button className="button primary" disabled={busy||!file} onClick={()=>inspect()}>{c.parse}</button>{busy&&<button className="button" onClick={clear}>{c.cancel}</button>}</div>
    </div>
    {busy&&<p role="status">{pt?'Inspecionando arquivo…':'Inspecting file…'}</p>}
    {error&&<div role="alert" className="play-notice danger"><p>{pt?portugueseError(error):error}</p>{pt&&<details><summary>{c.detail}</summary><p lang="en">{error}</p></details>}</div>}
    {orbit&&<section className="play-section"><h2>{c.preview}</h2><p>{orbit.body} · {orbit.frame} · {orbit.epochUTC}</p><dl><dt>SMA</dt><dd>{orbit.smaKm} km</dd><dt>e</dt><dd>{orbit.ecc}</dd><dt>i</dt><dd>{orbit.inclinationDeg}°</dd><dt>RAAN / AOP / TA</dt><dd>{orbit.raanDeg}° / {orbit.argPeriapsisDeg}° / {orbit.trueAnomalyDeg}°</dd></dl>{sceneButton}
      {skipped.statements>0&&<p className="play-notice warning">{pt?`Somente o estado inicial de ${object} foi lido. ${skipped.statements} outras instruções (forças, propagadores, manobras, saídas e ${skipped.commands} comandos da sequência da missão) foram ignoradas e não são reproduzidas.`:`Only ${object}'s initial state was read. ${skipped.statements} other statements (force models, propagators, burns, outputs and ${skipped.commands} mission-sequence commands) were ignored and are not reproduced.`}</p>}
      {onPrepare&&<p>{pt?'Importar abre uma nova preparação compatível. A órbita precisa passar nos limites do catálogo e na referência; ela não substitui um voo em andamento.':'Import opens a new compatible preparation. The orbit must pass catalogue constraints and a reference flight; it never replaces an active flight.'}</p>}
      {onPrepare&&<button className="button primary" onClick={()=>onPrepare(orbit)}>{pt?'Preparar nova missão com este estado':'Prepare a new mission with this state'}</button>}
    </section>}
    {trajectory&&<section className="play-section"><h2>{c.preview}</h2><p>{trajectory.source} · {trajectory.object} · {trajectory.body} · {trajectory.frame} · {trajectory.timeSystem} · {trajectory.units}</p><p>{trajectory.segments.length} {c.segments} · {trajectory.segments.reduce((sum,segment)=>sum+segment.samples.length,0)} {c.samples}</p>{sceneButton}</section>}
    <ExportPanel initial={initialOrbit}/>
  </section>;
}
