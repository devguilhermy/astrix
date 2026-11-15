import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronUp, Eye, History, ListChecks, Target } from 'lucide-react';
import { telemetry, turnDecision, type TurnGameState, type TurnResult } from '@astrix/core';
import type { SessionState } from '@astrix/session';
import { labelText } from '../missions/definitionView';
import { Duration, Evidence, FlightContext } from './Evidence';
import type { AttemptRecord } from './persistence';
import { usePlayCopy } from './copy';
import { Receipt } from './Receipt';
import { planIcons } from './planIcons';
import type { TurnMoment } from './turnMoments';
import { MissionReport } from './report/MissionReport';
import { TurnResultCard } from './feedback/TurnResultCard';

export function TurnWorkspace({game,onCommit,onInspectPlan,onCheckpoint,onRetry,onRedesign,onTools,busy,disabled,host,proposals=[],roster=[],journal,hints,moments,selectedTurn,onSelectTurn}:{game:TurnGameState;onCommit:(planId:string)=>void;onInspectPlan?:()=>void;onCheckpoint:()=>void;onRetry:()=>void;onRedesign:()=>void;onTools:()=>void;busy:boolean;disabled:boolean;host:boolean;proposals?:SessionState['turnProposals'];roster?:SessionState['roster'];journal:readonly AttemptRecord[];hints:boolean;moments:readonly TurnMoment[];selectedTurn:number|null;onSelectTurn:(index:number)=>void}) {
  const c=usePlayCopy(),{t,i18n}=useTranslation(),decision=useMemo(()=>turnDecision(game),[game]),current=useMemo(()=>telemetry(game.sim),[game]);
  const [selected,setSelected]=useState(''),[preview,setPreview]=useState<TurnResult|null>(null),[previewing,setPreviewing]=useState(false),[previewError,setPreviewError]=useState(''),[refresh,setRefresh]=useState(0);
  const [panel,setPanel]=useState<'choices'|'preview'>('choices'),[lastOpen,setLastOpen]=useState(false);
  const job=useRef(0);
  useEffect(()=>{setSelected('');setPreview(null);setPreviewError('');setPanel(game.receipts.at(-1)?.interrupted?'preview':'choices');},[decision.id,decision.revision]);
  useEffect(()=>{setLastOpen(false);},[selected]);
  useEffect(()=>{
    const id=++job.current;setPreview(null);setPreviewError('');
    if(!selected||decision.terminal){setPreviewing(false);return;}
    setPreviewing(true);let worker:Worker|null=null;
    const timer=window.setTimeout(()=>{if(id!==job.current)return;worker?.terminate();setPreviewing(false);setPreviewError(c('technicalError'));},60000);
    try {
      worker=new Worker(new URL('./game.worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(event:MessageEvent<{id:number;result?:TurnResult;error?:string}>)=>{if(id!==job.current||event.data.id!==id)return;clearTimeout(timer);worker?.terminate();setPreviewing(false);if(event.data.result)setPreview(event.data.result);else setPreviewError(event.data.error??c('technicalError'));};
      worker.onerror=()=>{if(id!==job.current)return;clearTimeout(timer);worker?.terminate();setPreviewing(false);setPreviewError(c('technicalError'));};
      worker.postMessage({kind:'preview',id,game,planId:selected});
    }catch{clearTimeout(timer);setPreviewing(false);setPreviewError(c('technicalError'));}
    return()=>{job.current++;clearTimeout(timer);worker?.terminate();};
  },[game,selected,refresh,decision.terminal]);
  const plan=decision.plans.find(item=>item.id===selected),receipt=game.receipts.at(-1),number=new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:2});
  if(decision.terminal)return <MissionReport game={game} journal={journal} moments={moments} selectedTurn={selectedTurn} onSelectTurn={onSelectTurn} onRetry={onRetry} onRedesign={onRedesign} onTools={onTools} disabled={disabled||busy||!host}/>;
  const validPreview=preview?.ok&&preview.value.receipt.decisionId===decision.id&&preview.value.receipt.planId===selected;
  const fuel=current.flight?current.flight.mass.spacecraftPropellantKg+(current.flight.mass.stage?.attached?current.flight.mass.stage.propellantKg:0):typeof game.sim.propellantKg==='number'?game.sim.propellantKg:0;
  const latest=moments.at(-1),collapsed=!!selected&&!lastOpen;
  const lastTurn=latest&&<section className="last-turn" aria-labelledby="last-turn-heading" aria-live="polite"><header className="last-turn-heading"><h2 id="last-turn-heading" className="icon-heading"><History size={18} aria-hidden="true"/>{c('lastTurn')}</h2>{selected&&<button className="text-button" aria-expanded={!collapsed} aria-controls="last-turn-card" onClick={()=>setLastOpen(open=>!open)}>{collapsed?<ChevronDown size={17} aria-hidden="true"/>:<ChevronUp size={17} aria-hidden="true"/>}{c(collapsed?'showLastTurn':'hideLastTurn')}</button>}</header><div id="last-turn-card"><TurnResultCard game={game} moment={latest} compact={collapsed}/></div></section>;
  return <section className={`turn-workspace contextual-workspace active-${panel}`} aria-label={c('titlePlay')}>
    <div className="context-panel-switch" aria-label={c('missionPanels')}><button aria-pressed={panel==='choices'} aria-controls="turn-choices-panel" onClick={()=>setPanel('choices')}>{c('thinking')}</button><button aria-pressed={panel==='preview'} aria-controls="turn-preview-panel" onClick={()=>setPanel('preview')}>{c('preview')}</button></div>
    <section id="turn-choices-panel" className="context-panel choices-panel">
      <div className="panel-scroll">
        <header className="play-page-heading"><h1>{labelText(t,game.design.definition.name)}</h1><p>{c('elapsed')}: <Duration seconds={current.t}/> · {c(game.config.ambition)}{game.assisted&&<> · <strong>{c('assisted')}</strong></>}</p><p className="mission-deadline">{c('timeRemaining')}: <Duration seconds={current.clock.remainingSec}/></p></header>
        <section className="turn-objective" aria-label={c('objective')}><h2 className="icon-heading"><Target size={17} aria-hidden="true"/>{c('objective')}</h2><Evidence items={decision.objective} definition={game.design.definition}/></section>
        <ImminentWarnings game={game}/>
        {receipt?.interrupted&&<p className="play-notice warning" role="status">{c('interrupted')}</p>}
        <section className="turn-choices"><h2 className="icon-heading"><ListChecks size={18} aria-hidden="true"/>{c('thinking')}</h2><p>{c('decisionIntro')}</p>{hints&&game.revision<3&&<p className="inline-guidance">{c(game.revision===0?'firstHint':game.revision===1?'secondHint':'thirdHint')}</p>}
          {proposals.length>0&&<section className="crew-proposals"><h3>{c('proposals')}</h3><ul>{proposals.filter(item=>item.decisionId===decision.id&&item.turnRevision===decision.revision).map(proposal=><li key={proposal.playerId}>{roster.find(player=>player.id===proposal.playerId)?.name??proposal.playerId}: <strong>{c(decision.plans.find(item=>item.id===proposal.planId)?.kind??proposal.planId)}</strong></li>)}</ul></section>}
          <details className="play-details"><summary>{c('details')}</summary><dl><dt>{c('fuel')}</dt><dd>{number.format(fuel)} kg</dd><dt>{c('stored')}</dt><dd>{number.format(current.storedMB)} / {number.format(current.storageMB)} MB</dd><dt>{c('seed')}</dt><dd>{game.config.seed}</dd><dt>{c('rules')}</dt><dd>{game.rulesVersion} / {game.modelVersion}</dd></dl><p>{current.mode} · {current.clock.phase}</p>{current.thermal&&<p>{number.format(current.thermal.temperatureK)} K · {number.format(current.thermal.heaterW)} W</p>}{current.crew&&<dl><dt>O₂ / N₂</dt><dd>{number.format(current.crew.oxygenKg)} / {number.format(current.crew.nitrogenKg)} kg</dd><dt>CO₂</dt><dd>{number.format(current.crew.co2MmHg)} mmHg</dd></dl>}<p className="identity">{game.identity}</p><FlightContext game={game}/></details>
        </section>
      </div>
    </section>
    <aside id="turn-preview-panel" className="context-panel preview-panel" data-tour="turn-preview" aria-label={c('preview')} aria-busy={previewing||busy}>
      <div className="panel-scroll turn-preview">{lastTurn}<h2 className="icon-heading"><Eye size={18} aria-hidden="true"/>{c('preview')}</h2>{!selected&&<p>{c('selectPlan')}</p>}{previewing&&<p role="status">{c('previewing')}</p>}
        {plan&&<article className="plan-detail"><h3>{c(plan.kind)}</h3>{game.config.levelId==='ASPIRING'&&plan.recommended&&<p className="plan-recommendation">{c('recommendedPlan')}</p>}<p>{c(`plan.${plan.kind}`)}</p><p><Duration seconds={plan.expectedElapsedSec}/> · {c(plan.nextBoundary)}</p>{plan.warnings.map((warning,index)=><p className="danger-text" key={index}>{c(warning)}</p>)}</article>}
        {previewError&&<div role="alert"><p>{c('technicalError')}</p><button className="button" onClick={()=>setRefresh(value=>value+1)}>{c('recheck')}</button></div>}
        {preview&&!preview.ok&&<p role="alert">{c('technicalError')} <small>{preview.code}</small></p>}
        {preview?.ok&&<><Receipt receipt={preview.value.receipt} definition={game.design.definition} preview/><p className="muted">{c('previewNote')}</p></>}
        <details className="turn-last-receipt" key={receipt?.id??'first'} open={receipt?.interrupted||undefined}><summary>{c('receipt')}</summary>{receipt?<Receipt receipt={receipt} definition={game.design.definition}/>:<p>{c('noReceipt')}</p>}{game.config.levelId==='ASPIRING'&&game.revision>0&&host&&<button className="text-button" disabled={disabled||busy} onClick={onCheckpoint}>{c('checkpoint')}</button>}</details>
      </div>
    </aside>
    <section className="turn-action-dock" data-tour="turn-actions" aria-label={c('thinking')}>
      <fieldset className="turn-plans"><legend className="sr-only">{c('selectPlan')}</legend>{decision.plans.map(option=>{const Icon=planIcons[option.kind];return <label key={option.id} className={selected===option.id?'selected':''} title={c(`plan.${option.kind}`)}><input type="radio" name="turn-plan" value={option.id} checked={selected===option.id} disabled={busy} aria-label={`${c(option.kind)}${game.config.levelId==='ASPIRING'&&option.recommended?` · ${c('recommendedPlan')}`:''}`} onChange={()=>{setSelected(option.id);setPanel('preview');onInspectPlan?.();}}/><Icon size={15} aria-hidden="true"/><span>{c(`action.${option.kind}`)}</span></label>;})}</fieldset>
      <div className="panel-action"><button className="button primary turn-commit" disabled={disabled||busy||previewing||!validPreview||!plan} onClick={()=>{if(plan&&validPreview)onCommit(plan.id);}}><Check size={17} aria-hidden="true"/>{busy?c('resolving'):host?`${c('commit')}: ${plan?c(plan.kind):c('selectPlan')}`:c('propose')}</button>{busy&&<p role="status">{c('resolveNote')}</p>}{!host&&<p>{c('phoneNote')}</p>}</div>
    </section>
  </section>;
}

function ImminentWarnings({game}:{game:TurnGameState}) {
  const {i18n}=useTranslation(),pt=i18n.resolvedLanguage?.startsWith('pt'),t=telemetry(game.sim),warnings:string[]=[];
  if(t.capacityWh>0&&t.socWh/t.capacityWh<=.2)warnings.push(pt?'A reserva de energia está baixa; uma perda de energia pode encerrar a operação.':'Energy reserve is low; loss of power can end operations.');
  if(t.storageMB>0&&t.storedMB/t.storageMB>=.9)warnings.push(pt?'O armazenamento está quase cheio. Observações adicionais podem ser perdidas antes da transmissão.':'Storage is nearly full. Additional observations can be lost before transmission.');
  if(t.thermal&&(t.thermal.temperatureK<=t.thermal.survivalMinK||t.thermal.temperatureK>=t.thermal.survivalMaxK))warnings.push(pt?'A temperatura está fora dos limites de sobrevivência. Confira o estado térmico antes de confirmar.':'Temperature is outside survival limits. Review the thermal state before committing.');
  if(t.thermal?.inhibited)warnings.push(pt?'Os instrumentos estão inibidos pela temperatura. Uma observação pode não produzir dados.':'Payload is thermally inhibited. An observation may produce no data.');
  if(t.computer.state!=='RUNNING')warnings.push(pt?'O computador não está operando; comandos científicos não podem ser executados normalmente.':'The computer is not running; ordinary science commands cannot execute.');
  if(t.pointing.faulted)warnings.push(pt?'O apontamento está degradado. Reaquisição compatível exige tempo e energia.':'Pointing is degraded. Supported reacquisition costs time and energy.');
  if(t.crew&&(t.crew.limiting!=='NONE'||t.crew.leakActive))warnings.push(pt?`Suporte da tripulação exige atenção: ${t.crew.limiting}.`:`Crew support needs attention: ${t.crew.limiting}.`);
  if(t.flight?.orbit.impacts)warnings.push(pt?'A trajetória intercepta a superfície. Reveja as opções de manobra antes de avançar.':'The trajectory intersects the surface. Review maneuver choices before advancing.');
  return warnings.length?<aside className="play-notice warning" role="status"><ul>{warnings.map(warning=><li key={warning}>{warning}</li>)}</ul></aside>:null;
}
