import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BatteryCharging, Camera, Check, CornerDownLeft, Eye, Flag, ListChecks, Navigation, Orbit, Radio, Rocket, Square, Target, Wrench, type LucideIcon } from 'lucide-react';
import { telemetry, turnDecision, turnDebrief, type TurnGameState, type TurnPlanKind, type TurnReceipt, type TurnResult } from '@astrix/core';
import type { SessionState } from '@astrix/session';
import { labelText, objectiveTarget } from '../missions/definitionView';
import { Duration, Evidence, FlightContext, ScienceLibrary } from './Evidence';
import { attemptRecord, comparable, type AttemptRecord } from './persistence';
import { usePlayCopy } from './copy';
import { ScienceConnection } from './ScienceConnection';
const planIcons:Record<TurnPlanKind,LucideIcon>={LAUNCH:Rocket,MANEUVER:Navigation,COAST:Orbit,OBSERVE:Camera,TRANSMIT:Radio,RECHARGE:BatteryCharging,RECOVER:Wrench,CAPTURE:Target,RETURN:CornerDownLeft,FINISH:Flag,ABORT:Square};

export function TurnWorkspace({game,onCommit,onInspectPlan,onCheckpoint,onRetry,onRedesign,onTools,busy,disabled,host,proposals=[],roster=[],journal,hints}:{game:TurnGameState;onCommit:(planId:string)=>void;onInspectPlan?:()=>void;onCheckpoint:()=>void;onRetry:()=>void;onRedesign:()=>void;onTools:()=>void;busy:boolean;disabled:boolean;host:boolean;proposals?:SessionState['turnProposals'];roster?:SessionState['roster'];journal:readonly AttemptRecord[];hints:boolean}) {
  const c=usePlayCopy(),{t,i18n}=useTranslation(),decision=useMemo(()=>turnDecision(game),[game]),current=useMemo(()=>telemetry(game.sim),[game]);
  const [selected,setSelected]=useState(''),[preview,setPreview]=useState<TurnResult|null>(null),[previewing,setPreviewing]=useState(false),[previewError,setPreviewError]=useState(''),[refresh,setRefresh]=useState(0);
  const [panel,setPanel]=useState<'choices'|'preview'>('choices');
  const job=useRef(0);
  useEffect(()=>{setSelected('');setPreview(null);setPreviewError('');setPanel(game.receipts.at(-1)?.interrupted?'preview':'choices');},[decision.id,decision.revision]);
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
  if(decision.terminal)return <Debrief game={game} journal={journal} onRetry={onRetry} onRedesign={onRedesign} onTools={onTools} disabled={disabled||busy||!host}/>;
  const validPreview=preview?.ok&&preview.value.receipt.decisionId===decision.id&&preview.value.receipt.planId===selected;
  const fuel=current.flight?current.flight.mass.spacecraftPropellantKg+(current.flight.mass.stage?.attached?current.flight.mass.stage.propellantKg:0):typeof game.sim.propellantKg==='number'?game.sim.propellantKg:0;
  return <section className={`turn-workspace contextual-workspace active-${panel}`} aria-label={c('titlePlay')}>
    <div className="context-panel-switch" aria-label={c('missionPanels')}><button aria-pressed={panel==='choices'} aria-controls="turn-choices-panel" onClick={()=>setPanel('choices')}>{c('thinking')}</button><button aria-pressed={panel==='preview'} aria-controls="turn-preview-panel" onClick={()=>setPanel('preview')}>{c('preview')}</button></div>
    <section id="turn-choices-panel" className="context-panel choices-panel">
      <div className="panel-scroll">
        <header className="play-page-heading"><h1>{labelText(t,game.design.definition.name)}</h1><p>{c('elapsed')}: <Duration seconds={current.t}/> · {c(game.config.ambition)}{game.assisted&&<> · <strong>{c('assisted')}</strong></>}</p><p className="mission-deadline">{c('timeRemaining')}: <Duration seconds={current.clock.remainingSec}/></p></header>
        <section className="turn-objective" aria-label={c('objective')}><h2 className="icon-heading"><Target size={17} aria-hidden="true"/>{c('objective')}</h2><Evidence items={decision.objective} definition={game.design.definition}/></section>
        <p className="mission-fuel">{c('fuel')}: <output>{number.format(fuel)} kg</output></p>
        <ImminentWarnings game={game}/>
        {receipt?.interrupted&&<p className="play-notice warning" role="status">{c('interrupted')}</p>}
        <section className="turn-choices"><h2 className="icon-heading"><ListChecks size={18} aria-hidden="true"/>{c('thinking')}</h2><p>{c('decisionIntro')}</p>{hints&&game.revision<3&&<p className="inline-guidance">{c(game.revision===0?'firstHint':game.revision===1?'secondHint':'thirdHint')}</p>}
          {proposals.length>0&&<section className="crew-proposals"><h3>{c('proposals')}</h3><ul>{proposals.filter(item=>item.decisionId===decision.id&&item.turnRevision===decision.revision).map(proposal=><li key={proposal.playerId}>{roster.find(player=>player.id===proposal.playerId)?.name??proposal.playerId}: <strong>{c(decision.plans.find(item=>item.id===proposal.planId)?.kind??proposal.planId)}</strong></li>)}</ul></section>}
          <details className="play-details"><summary>{c('details')}</summary><dl><dt>{c('stored')}</dt><dd>{number.format(current.storedMB)} / {number.format(current.storageMB)} MB</dd><dt>{c('seed')}</dt><dd>{game.config.seed}</dd><dt>{c('rules')}</dt><dd>{game.rulesVersion} / {game.modelVersion}</dd></dl><p>{current.mode} · {current.clock.phase}</p>{current.thermal&&<p>{number.format(current.thermal.temperatureK)} K · {number.format(current.thermal.heaterW)} W</p>}{current.crew&&<dl><dt>O₂ / N₂</dt><dd>{number.format(current.crew.oxygenKg)} / {number.format(current.crew.nitrogenKg)} kg</dd><dt>CO₂</dt><dd>{number.format(current.crew.co2MmHg)} mmHg</dd></dl>}<p className="identity">{game.identity}</p><FlightContext game={game}/></details>
        </section>
      </div>
    </section>
    <aside id="turn-preview-panel" className="context-panel preview-panel" data-tour="turn-preview" aria-label={c('preview')} aria-busy={previewing||busy}>
      <div className="panel-scroll turn-preview"><h2 className="icon-heading"><Eye size={18} aria-hidden="true"/>{c('preview')}</h2>{!selected&&<p>{c('selectPlan')}</p>}{previewing&&<p role="status">{c('previewing')}</p>}
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

function Receipt({receipt,definition,preview=false}:{receipt:TurnReceipt;definition:TurnGameState['design']['definition'];preview?:boolean}) {
  const c=usePlayCopy(),{t,i18n}=useTranslation(),number=new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:2,signDisplay:'exceptZero'});
  let interruption:TurnReceipt['events'][number]|undefined;
  if(receipt.interrupted)for(let index=receipt.events.length-1;index>=0;index--)if(receipt.events[index].autoPause){interruption=receipt.events[index];break;}
  return <div className="turn-receipt"><p><strong>{c(receipt.boundary)}</strong> · <Duration seconds={receipt.elapsedSec}/></p>{receipt.interrupted&&<p className="danger-text">{c('interrupted')}</p>}<dl><dt>{c('fuel')}</dt><dd>{number.format(receipt.delta.fuelKg)} kg</dd><dt>{c('energy')}</dt><dd>{number.format(receipt.delta.energyWh)} Wh</dd><dt>{c('stored')}</dt><dd>{number.format(receipt.delta.storedMB)} MB</dd><dt>{c('data')}</dt><dd>{number.format(receipt.delta.deliveredMB)} MB</dd></dl>
    <p>{c(receipt.summary)}</p>
    {interruption&&<p className="danger-text"><strong>{t(`event.${interruption.kind}.title`,{...interruption.values,defaultValue:t(`failure.${interruption.kind}.title`,{defaultValue:interruption.kind})})}</strong> {t(`event.${interruption.kind}.body`,{...interruption.values,defaultValue:''})}</p>}
    {!preview&&<><Evidence items={receipt.evidence} definition={definition}/><p className="muted">{c('receiptNote')}</p></>}
    <details><summary>{c('details')}</summary>{receipt.events.length>0&&<ul className="receipt-events">{receipt.events.slice(-8).map((event,index)=><li key={`${event.kind}-${event.t}-${index}`}><strong>{t(`event.${event.kind}.title`,{...event.values,defaultValue:t(`failure.${event.kind}.title`,{defaultValue:event.kind})})}</strong><p>{t(`event.${event.kind}.body`,{...event.values,defaultValue:''})}</p></li>)}</ul>}<p>{c('actualDuration')}: <Duration seconds={receipt.elapsedSec}/></p><p>{receipt.id}</p></details>
  </div>;
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

function Debrief({game,journal,onRetry,onRedesign,onTools,disabled}:{game:TurnGameState;journal:readonly AttemptRecord[];onRetry:()=>void;onRedesign:()=>void;onTools:()=>void;disabled:boolean}) {
  const c=usePlayCopy(),{t}=useTranslation(),result=turnDebrief(game),record=attemptRecord(game),previous=[...journal].reverse().find(item=>item.id!==record.id&&comparable(item,record));
  return <section className="debrief"><header className="play-page-heading"><h1>{c('complete')}</h1><p>{labelText(t,game.design.definition.name)}</p><h2>{c(result.outcome==='SUCCESS'?'success':'failure')}</h2>{result.assisted&&<p>{c('assisted')}</p>}<p>{c('elapsed')}: <Duration seconds={result.elapsedSec}/></p></header><Evidence items={result.evidence} definition={game.design.definition}/>
    <section className="discovery-payoff"><h2>{c('discovery')}</h2>{result.discoveries.length?<><p>{c('journalNote')}</p><ul>{result.evidence.filter(item=>item.state==='MET').map(item=>{const objective=game.design.definition.objectives.find(candidate=>candidate.id===item.id),summary=objective?objectiveTarget(objective):null;return <li key={item.id}>{summary?t(summary.key,{...summary.values,body:typeof summary.values.body==='string'?c(summary.values.body):undefined}):item.kind}</li>;})}</ul><ScienceLibrary discoveryIds={game.design.definition.objectives.some(item=>item.spec.kind==='INSTRUMENT_HOURS')?['radiation','source-evidence']:['data-return','kepler-orbits','energy-budget']}/></>:<p>{c('noDiscovery')}</p>}{result.cause&&<p>{t(result.cause,{defaultValue:t(`failure.${result.cause}.title`,{defaultValue:c(result.cause)})})}</p>}{result.advice.length>0&&<ul>{result.advice.map((advice,index)=><li key={index}>{t(advice,{defaultValue:c(advice)})}</li>)}</ul>}</section>
    <ScienceConnection definition={game.design.definition}/>
    <section className="comparison"><h2>{c('comparison')}</h2>{previous?<><p>{c('compareNote')}</p><Comparison previous={previous} current={record}/></>:<p>{c('noComparison')}</p>}</section>
    <div className="debrief-actions"><button className="button primary" onClick={onRedesign} disabled={disabled}>{c('redesign')}</button><button className="button" onClick={onRetry} disabled={disabled}>{c('retry')}</button><button className="text-button" onClick={onTools}>{c('tools')}</button></div>
    <details><summary>{c('receipt')} ({result.receipts.length})</summary>{result.receipts.map(receipt=><section key={receipt.id}><Receipt receipt={receipt} definition={game.design.definition}/></section>)}</details>
  </section>;
}
export function Comparison({previous,current}:{previous:AttemptRecord;current:AttemptRecord}) {
  const c=usePlayCopy(),{i18n}=useTranslation(),number=new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:2});
  const rows:[string,string,string][]=[['kit',c(previous.config.kit),c(current.config.kit)],['ambition',c(previous.config.ambition),c(current.config.ambition)],['approach',c(previous.config.approach),c(current.config.approach)],['fuel',`${number.format(previous.fuelKg)} kg`,`${number.format(current.fuelKg)} kg`],['energy',`${number.format(previous.energyWh)} Wh`,`${number.format(current.energyWh)} Wh`],['data',`${number.format(previous.deliveredMB)} MB`,`${number.format(current.deliveredMB)} MB`]];
  return <div className="comparison-table"><table><thead><tr><th scope="col">{c('constraints')}</th><th scope="col">{c('previous')}</th><th scope="col">{c('current')}</th></tr></thead><tbody>{rows.map(([key,a,b])=><tr key={key}><th scope="row">{c(key)}</th><td>{a}</td><td>{b}</td></tr>)}<tr><th scope="row">{c('elapsed')}</th><td><Duration seconds={previous.elapsedSec}/></td><td><Duration seconds={current.elapsedSec}/></td></tr><tr><th scope="row">{c('progress')}</th><td>{c(previous.outcome==='SUCCESS'?'success':'failure')}{previous.assisted&&` · ${c('assisted')}`}</td><td>{c(current.outcome==='SUCCESS'?'success':'failure')}{current.assisted&&` · ${c('assisted')}`}</td></tr></tbody></table></div>;
}
