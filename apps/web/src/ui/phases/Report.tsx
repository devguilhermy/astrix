import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { history, listParts, missionRequirements, orbitAltitudes, attemptAudit, type HistorySample } from '@astrix/core';
import { USGS_MISSIONS, type ScienceTopicId } from '@astrix/data';
import { useMission, readBest } from '../../store';
import { usePreviewSnapshot } from '../../three/previewSnapshots';
import { Panel, NumberValue } from '../primitives';
import { ExplainButton } from '../science/ExplainButton';
import { TechnicalDetails } from '../science/TechnicalDetails';
import { TeachingCard } from '../science/TeachingCard';
import { BudgetComparison } from '../panels/Budgets';
import { RequirementTarget } from './RequirementTarget';
import { CommandReceipt } from './FlightControls';
import { reviewPlayback } from '../advanced/reviewPlayback';
import { Star, ArrowUpRight } from '../icons';
import { useWorkbench } from '../../three/spacecraft/workbenchState';
import { requestCue } from '../guide/cueStore';
import { showWindow } from '../layout/windows';

function HistoryChart({samples,field,title,topic}:{samples:readonly HistorySample[];field:'socPct'|'downlinkedMB'|'doseUGyH';title:string;topic:ScienceTopicId}) {
 const {t,i18n}=useTranslation(),max=Math.max(1,...samples.map(s=>s[field])),start=samples[0]?.t??0,end=samples.at(-1)?.t??1;
 const format=new Intl.NumberFormat(i18n.language,{maximumFractionDigits:1});
 const path=samples.map((sample,i)=>`${i?'L':'M'}${30+(sample.t-start)/Math.max(1,end-start)*410},${145-sample[field]/max*120}`).join(' ');
 const context=field==='socPct'?'chart.battery':field==='downlinkedMB'?'chart.downlink':'chart.dose';
 return <figure className="chart" id={field==='doseUGyH'?'dose-chart':undefined}>
  <div className="spread"><figcaption>{title}</figcaption><ExplainButton topic={topic} context={context}/></div>
  <svg viewBox="0 0 470 180" role="img" aria-label={title}>
   <path d="M30 20V145H445M30 85H445M30 25H445" stroke="#24364a" fill="none"/>
   <path d={path} stroke="#6de0e8" strokeWidth="2" fill="none"/>
   <text x="4" y="28">{format.format(max)}</text><text x="10" y="148">{0}</text>
   <text x="30" y="168">{format.format(start/86400)} d</text><text x="395" y="168">{format.format(end/86400)} d</text>
  </svg><p className="small muted">{t('ui.calculated')}</p>
 </figure>;
}
export function ReportScreen() {
 const {t}=useTranslation(),hasRun=useMission(state=>!!state.sim&&!!state.design&&!!state.telemetry?.ended);
 return hasRun?<FlightReport/>:<div className="phase-content" id="report"><h1>{t('ui.report')}</h1><p>{t('flow.reviewOnly')}</p></div>;
}
function FlightReport() {
 const {t,i18n}=useTranslation(),design=useMission(s=>s.design)!,sim=useMission(s=>s.sim)!,telemetry=useMission(s=>s.telemetry)!;
 const score=useMission(s=>s.review)!,acceptedTrades=useMission(s=>s.acceptedTrades),budgets=useMission(s=>s.budgets)!,image=usePreviewSnapshot(design);
 const samples=useMemo(()=>history(sim),[sim]),failure=score.firstFailure,parts=listParts(design.busId);
 const [sampleIndex,setSampleIndex]=useState(()=>Math.max(0,samples.length-1)),[eventTime,setEventTime]=useState<number|null>(null),sample=samples[Math.min(sampleIndex,Math.max(0,samples.length-1))],replaySample=reviewPlayback(state=>state.sample);
 const referenceOrbitOnly=design.scenarioId==='CREW_PATHFINDER'&&!!sample&&['DEORBIT','RECOVERY','COMPLETE'].includes(sample.phase);
 useEffect(()=>()=>reviewPlayback.getState().exit(),[]);
 const format=new Intl.NumberFormat(i18n.language,{maximumFractionDigits:2}),identity=score.identity,provisional=score.outcome==='PROVISIONAL';
 const firstSample=samples[0],lastSample=samples.at(-1),queue=telemetry.commandQueue,relevant=queue.filter(entry=>['POINT','INSTRUMENT','DOWNLINK'].includes(entry.command.kind)),receipts=[...new Set([...queue.filter(entry=>entry.command.kind==='INSTRUMENT'&&entry.status==='DELIVERED').slice(0,1),...queue.filter(entry=>entry.command.kind==='DOWNLINK'&&entry.status==='DELIVERED').slice(0,1),...queue.filter(entry=>entry.transport==='ONBOARD').slice(-1),...relevant.slice(-4)])].sort((a,b)=>a.issuedAt-b.issuedAt),lastTrade=acceptedTrades.at(-1);
 const executed=receipts.find(entry=>entry.command.kind==='DOWNLINK'&&entry.status==='DELIVERED')??receipts.find(entry=>entry.command.kind==='INSTRUMENT'&&entry.status==='DELIVERED'),beforeAction=executed?.resolvedAt==null?undefined:samples.filter(item=>item.t<=executed.resolvedAt!).at(-1),afterAction=executed?.resolvedAt==null?undefined:samples.find(item=>item.t>executed.resolvedAt!);
 const nextExperiment=design.scenarioId==='STORM_WATCH'?'flow.experimentStorm':design.scenarioId==='RED_RELAY'?'flow.experimentMars':design.scenarioId==='CREW_PATHFINDER'?'flow.experimentCrew':telemetry.storedMB>0?'flow.experimentStored':'flow.experimentFirst';
 const audit=attemptAudit(sim),salient=audit.entries.filter(entry=>entry.kind!=='PASS_START'&&entry.kind!=='PASS_END'),milestones=salient.filter(entry=>['OBJECTIVE_MET','FAILURE','CREW_SUPPORT_LOST','MISSION_END','SESSION_ENDED','REWIND'].includes(entry.kind)),timeline=[...new Set([...salient.slice(0,12),...milestones,...salient.slice(-12)])].sort((a,b)=>a.t-b.t);
 const redesign=()=>{
  const category=design.scenarioId==='RED_RELAY'?'PROPULSION':design.scenarioId==='CREW_PATHFINDER'?'SOLAR':design.scenarioId==='STORM_WATCH'?'INSTRUMENT':telemetry.storedMB>0?'RADIO':'INSTRUMENT';
  useMission.getState().resetMission(true);
  useWorkbench.getState().selectCategory(category);
  useWorkbench.getState().setHoveredCategory(category);
  showWindow('mission',`[data-cue-target="parts-${category}"]`);
  requestCue(`parts-${category}`);
 };
 return <div className="phase-content report-screen" id="report">
  <header className="phase-title"><span className="eyebrow">{t('ui.report')}</span><h1>{t(`report.${score.outcome}`)}</h1><ExplainButton topic="science-return"/></header>
  <p>{t(provisional?'report.live':'ui.endReason')}</p>
  <p className="chip">{t(identity.assisted?'report.assisted':'report.unassisted')}</p>
  {score.scienceAchieved&&<p>{t('report.scienceMet')}</p>}
  <div className="score-hero" data-cue-target="score"><div><span className="score-number">{format.format(score.total)}</span><span className="muted"> / 100</span><p>{t('ui.score')}</p><div className="stars" aria-label={`${score.stars} / 5`}>{Array.from({length:5},(_,index)=><Star key={index} size={23} fill={index<score.stars?'currentColor':'none'} className={index<score.stars?'earned':''}/>)}</div>{!provisional&&!identity.assisted&&!telemetry.endedByTeam&&<p>{t('ui.best',{score:Math.max(score.total,readBest(design.scenarioId,identity.levelId,identity.rulesVersion))})}</p>}</div>{image&&<img className="report-spacecraft" src={image} alt={t('ui.reportImage')}/>}</div>
  <details><summary>{t('report.identity')}</summary><Panel title={t('report.identity')}><dl>
   <dt>{t('flow.level')}</dt><dd>{t(identity.levelId==='ASPIRING'?'flow.aspiring':'flow.expert')}</dd>
   <dt>{t('report.rules')}</dt><dd>{identity.rulesVersion}</dd>
   <dt>{t('report.seed')}</dt><dd className="number">{identity.seed}</dd>
   <dt>{t('report.intervention')}</dt><dd><NumberValue value={score.interventionEnergyWh} unit="Wh"/></dd>
  </dl></Panel></details>
  <p>{t('hud.causalResult',{value:format.format(telemetry.objective.value),target:format.format(telemetry.objective.target)})}</p>
  {failure&&<p>{t(failure.causeKey)}</p>}<p>{t(`hud.experiment.${design.scenarioId}`)}</p>
  <details><summary>{t('ui.outcome')}</summary><Panel title={t('ui.outcome')}>
   <TeachingCard topic="outcome-replay" context="review.outcome" values={{[t(telemetry.objective.metricKey)]:`${format.format(telemetry.objective.value)} / ${format.format(telemetry.objective.target)}`}}/>
   <p>{t('ui.choiceRecord',{parts:format.format(design.parts.reduce((sum,p)=>sum+p.qty,0)),used:format.format(budgets.cost.used),limit:format.format(budgets.cost.limit),altitude:format.format(orbitAltitudes(design.orbit!).altitudeKm)})}</p>
   {telemetry.crew&&<p>{telemetry.crew.earlyReturn&&telemetry.crew.phase==='COMPLETE'?t('flow.recoveredEarly'):t('flow.crewOutcome')} · {t('flow.orbitDuration')}: <NumberValue value={telemetry.crew.orbitSec/3600} unit="h"/> / 72 h</p>}
   {lastTrade&&<section><h3>{t('flow.acceptedTrade')}</h3><p>{t(parts.find(p=>p.id===lastTrade.description)?.nameKey??`flow.tradeKind.${lastTrade.description}`)} · r{lastTrade.revision} → r{lastTrade.revision+1} · {t(lastTrade.actor==='ALL'?'flow.solo':`role.${lastTrade.actor}`)}{lastTrade.player!==null&&` · ${t('flow.player',{number:lastTrade.player+1})}`}</p><BudgetComparison before={lastTrade.before} after={lastTrade.after}/></section>}
   <section><h3>{t('flow.recordedCommands')}</h3>{receipts.length?<ol>{receipts.map(entry=><CommandReceipt key={entry.id} entry={entry} parts={parts}/>)}</ol>:<p>{t('flow.noRecordedCommands')}</p>}{beforeAction&&afterAction&&executed&&<><p>{t('flow.samplesAroundAction',{command:t(`ui.command.${executed.command.kind}`)})} · T+ <NumberValue value={beforeAction.t} unit="s"/> → T+ <NumberValue value={afterAction.t} unit="s"/></p><p>{t('flow.recordedStorage')}: <NumberValue value={beforeAction.storedPct} unit="%"/> → <NumberValue value={afterAction.storedPct} unit="%"/>{design.scenarioId!=='STORM_WATCH'&&<> · {t('flow.recordedReturned')}: <NumberValue value={beforeAction.downlinkedMB} unit="MB"/> → <NumberValue value={afterAction.downlinkedMB} unit="MB"/></>}</p></>}{firstSample&&lastSample&&<><p>{t('flow.historyEndpoints')} · T+ <NumberValue value={firstSample.t} unit="s"/> → T+ <NumberValue value={lastSample.t} unit="s"/></p><p>{t('flow.recordedStorage')}: <NumberValue value={firstSample.storedPct} unit="%"/> → <NumberValue value={lastSample.storedPct} unit="%"/>{design.scenarioId!=='STORM_WATCH'&&<> · {t('flow.recordedReturned')}: <NumberValue value={firstSample.downlinkedMB} unit="MB"/> → <NumberValue value={lastSample.downlinkedMB} unit="MB"/></>}</p></>}<p>{t('flow.causationLimit')}</p></section>
   {missionRequirements(design,sim).map(r=><p key={r.id}>{r.id} · {t(`flow.result.${r.result}`)} · {r.id==='CREW-SUPPORT-01'?<><RequirementTarget requirement={r} busId={design.busId}/> · {t('flow.actualFlight')}: {r.actual===null?t('flow.unknown'):<NumberValue value={r.actual} unit="h" digits={2}/>}</>:<>{r.actual!==null?<NumberValue value={r.actual} digits={2}/>:r.method==='configuration'?t(r.result==='PASS'?(r.id==='SCI-PAYLOAD-01'?'flow.installed':'flow.configured'):r.result==='FAIL'?(r.id==='SCI-PAYLOAD-01'?'flow.notInstalled':'flow.notConfigured'):'flow.unknown'):t('flow.unknown')} / <RequirementTarget requirement={r} busId={design.busId}/></>}</p>)}
   <p>{t('flow.historyLimit')}</p><details><summary>{t('flow.notes')}</summary>{attemptAudit(sim).entries.map((entry,index)=><p key={index}>T+{entry.t.toFixed(0)} s · {entry.kind} · {entry.actor?.role??t('flow.unknown')} · r{entry.revision}</p>)}</details>
   {design.scenarioId==='CREW_PATHFINDER'&&<p>{t('flow.recoveryPositionUnmodeled')}</p>}
   <p>{t(design.scenarioId==='STORM_WATCH'?'ui.observedMeasurements':'ui.observedResult',{value:format.format(telemetry.objective.value),target:format.format(telemetry.objective.target)})}</p>
   <ExplainButton topic="science-return"/>
   {failure&&<section className="failure-story"><h3>{t('report.firstFailure')}</h3><h4>{t(failure.causeKey)}</h4>
    {failure.facts.map((fact,i)=><div key={i} className="spread"><p>{t(fact.key,Object.fromEntries(Object.entries(fact.values).map(([key,value])=>[key,typeof value==='number'?format.format(value):value])))}</p><ExplainButton topic="mission-failure"/></div>)}
    {failure.advice.map(key=><div className="spread" key={key}><p>{t(key)}</p><ExplainButton topic="mission-failure"/></div>)}
   </section>}<p>{t(nextExperiment)}</p>
   <details><summary>{t('ui.parts')}</summary><ul>{design.parts.map(part=><li key={part.partId}>{t(parts.find(item=>item.id===part.partId)!.nameKey)} × {part.qty}</li>)}</ul><ExplainButton topic="systems-tradeoffs"/></details>
  </Panel></details>
  {sample&&<section data-cue-target="replay"><h2>{t('flow.replayHistory')}</h2><details><summary>{t('hud.modelLimits')}</summary><p>{t('flow.replayIsolation')}</p></details><label>{t('ui.time')}<input type="range" min={0} max={samples.length-1} value={Math.min(sampleIndex,samples.length-1)} onChange={e=>{const index=Number(e.target.value);setSampleIndex(index);setEventTime(null);reviewPlayback.getState().select(samples[index]);}}/></label><button className="button" onClick={()=>{reviewPlayback.getState().exit();setSampleIndex(samples.length-1);setEventTime(null);}}>{t('flow.returnFinal')}</button>{replaySample?<><p>{eventTime!==null&&Math.abs(eventTime-sample.t)>1e-6?t('flow.approximateSample'):t('flow.recordedSample')} · T+ <NumberValue value={sample.t} unit="s"/> · <NumberValue value={sample.socPct} unit="%"/>{design.scenarioId!=='STORM_WATCH'&&<> · <NumberValue value={sample.downlinkedMB} unit="MB"/></>}</p><p>{t(referenceOrbitOnly?'flow.referenceOrbitCoordinates':'flow.recordedPosition')}: {sample.positionKm.map(value=>format.format(value)).join(', ')} km</p>{referenceOrbitOnly&&<p>{t('flow.recoveryPositionUnmodeled')}</p>}</>:<p>{t('flow.finalView')}</p>}<p>{t('flow.timelineLimit')}</p><ol><li><button className="text-button" onClick={()=>{setSampleIndex(0);setEventTime(null);reviewPlayback.getState().select(samples[0]);}}>{t('flow.firstRetainedSample')} · T+ <NumberValue value={samples[0].t} unit="s"/></button></li>{timeline.map((entry,index)=><li key={index}><button className="text-button" onClick={()=>{let nearest=0;for(let i=1;i<samples.length;i++)if(Math.abs(samples[i].t-entry.t)<Math.abs(samples[nearest].t-entry.t))nearest=i;setSampleIndex(nearest);setEventTime(entry.t);reviewPlayback.getState().select(samples[nearest]);}}>T+ <NumberValue value={entry.t} unit="s"/> · {i18n.exists(`event.${entry.kind}.title`)?t(`event.${entry.kind}.title`):entry.kind.startsWith('COMMAND_')?`${t(`flow.audit.${entry.kind}`)} · ${t(`ui.command.${entry.detail.split(':').at(-1)}`)}`:entry.kind}</button></li>)}</ol></section>}
  <HistoryChart samples={samples} field="socPct" title={t('ui.batteryChart')} topic="battery-storage"/>
  {design.scenarioId!=='STORM_WATCH'&&<HistoryChart samples={samples} field="downlinkedMB" title={t('ui.returnChart')} topic="data-return"/>}
  <TechnicalDetails>
   <HistoryChart samples={samples} field="doseUGyH" title={t('ui.doseChart')} topic="radiation"/>
   <Panel title={t('ui.weights')}><ExplainButton topic="model-assumptions"/><dl>{score.components.map(component=><div key={component.key} className="score-component"><dt>{t(component.key)}</dt><dd><NumberValue value={component.value*100} unit="%"/> × <NumberValue value={component.weight*100} unit="%"/></dd></div>)}</dl></Panel>
  </TechnicalDetails>
  {design.scenarioId==='RED_RELAY'&&<Panel title={t('ui.realMissions')}><ExplainButton topic="source-evidence"/><p className="small muted">{t('ui.usgsHeuristic')}</p>
   {USGS_MISSIONS.map(mission=><article className="real-mission" key={mission.name}><h3>{mission.name}</h3><p>{t('ui.products',{count:mission.count})}</p>{mission.products.map(product=><a key={product.link} href={product.link} target="_blank" rel="noreferrer">{product.title}<ArrowUpRight size={15}/></a>)}</article>)}
  </Panel>}
  <div className="phase-actions"><button className="button primary" data-cue-target="redesign" onClick={redesign}>{t('flow.redesign')}</button><button className="button" onClick={()=>useMission.getState().startScenario(design.scenarioId,design.levelId)}>{t('flow.repeat')}</button><button className="button" onClick={event=>useMission.getState().openExplanation('source-evidence','ui.source-evidence',event.currentTarget)}>{t('ui.sources')}</button></div>
 </div>;
}
