import { useTranslation } from 'react-i18next';
import { evaluateJourneyStage, missionMaturity, missionRequirements, listScenarios, listRides, disposalScreen, launchReadiness } from '@astrix/core';
import { useMission } from '../../store';
import { RefusalNote, Signoffs } from '../panels/Review';
import { ExplainButton } from '../science/ExplainButton';
import { Collaboration } from './Collaboration';
import { DryRun } from '../forecast/DryRun';
import { showWindow } from '../layout/windows';
import { requestCue } from '../guide/cueStore';

export function goForLaunch():void {
 const s=useMission.getState();
 if(s.players.length===1)s.signOff();
 if(useMission.getState().verifyBaseline())useMission.getState().completeStage();
}
export function JourneyWorkshop(){
 const {t}=useTranslation(),s=useMission(),d=s.design,a=s.artifacts;
 if(!d||!a)return null;
 const requirements=missionRequirements(d,s.sim),disposal=disposalScreen(d),scenario=listScenarios().find(item=>item.id===d.scenarioId)!;
 const readiness=launchReadiness(d,s.signoffs),detailed=s.settings.presentation==='DETAILED';
 return <div className="journey-task">
  {s.activeStage==='NEED_GOALS'&&<label id="objective" data-cue-target="objective"><input type="checkbox" checked={a.objectiveConfirmed} onChange={e=>s.updateArtifacts({objectiveConfirmed:e.target.checked})}/>{t('hud.acceptMission')}</label>}
  {s.activeStage==='CONCEPT'&&<section id="segments" data-cue-target="segments"><h1>{t('hud.connectedMission')}</h1><div className="segment-cards">{(['launch','space','ground','user'] as const).map((segment,index)=><label key={segment}><span aria-hidden="true">{['↗','◇','⌁','◎'][index]}</span><input type="checkbox" checked={a.segments[segment]} onChange={event=>s.updateArtifacts({segments:{...a.segments,[segment]:event.target.checked}})}/>{t(`flow.segment.${segment}`)}</label>)}</div><ExplainButton topic="mission-segments"/><details><summary>{t('hud.details')}</summary><dl><dt>{t('flow.segment.launch')}</dt><dd>{t(listRides(d.busId,scenario.body).find(r=>r.id===d.rideId)?.nameKey??'flow.unknown')}</dd><dt>{t('flow.segment.space')}</dt><dd>{t('hud.buildInSpace')}</dd><dt>{t('flow.segment.ground')}</dt><dd>{t(`flow.station.${d.stationId}`)}</dd><dt>{t('flow.segment.user')}</dt><dd>{t(scenario.objectiveKey)}</dd></dl><p>{t('flow.story')}</p></details></section>}
  {s.activeStage==='DESIGN'&&<section id="trade" data-cue-target="trade"><div className="button-wrap"><button className="button" onClick={()=>s.setSubstep(s.activeSubstep==='orbit'?'equipment':'orbit')}>{t(s.activeSubstep==='orbit'?'hud.backToParts':'hud.chooseOrbit')}</button><button id="baseline" data-cue-target="freeze" className="button" onClick={()=>s.freezeBaseline()}>{a.baselineRevision===d.revision?'✓ ':''}{t('flow.freeze')}</button></div>{s.players.length>1&&<Collaboration/>}{a.baselineRevision!==null&&detailed&&<p>{t('flow.baselineRevision',{revision:a.baselineRevision})}</p>}<ExplainButton topic="systems-tradeoffs"/></section>}
  {!s.sim&&(s.activeStage==='BUILD_VERIFY'||s.activeStage==='IMPLEMENT')&&<section className="preflight-iteration"><p>{t('hud.forecastIteration')}</p><button className="button" data-cue-target="return-build" onClick={()=>{s.setStage('DESIGN');useMission.getState().setSubstep('equipment');showWindow('mission','#parts');requestCue('parts');}}>{t('hud.returnBuild')}</button></section>}
  {s.activeStage==='BUILD_VERIFY'&&<section id="readiness" data-cue-target="readiness"><h1>{t('hud.testAndLaunch')}</h1><DryRun/><section id="verification" data-cue-target="verification"><h2>{t('hud.checklist')}</h2><ul className="readiness-checklist">{[['mass',s.budgets!.massKg.used<=s.budgets!.massKg.limit],['room',s.budgets!.volume.used<=s.budgets!.volume.limit],['power',!!s.budgets!.power&&s.budgets!.power.avgGenW>=s.budgets!.power.avgLoadW],['eclipse',!!s.budgets!.power&&s.budgets!.power.usableBatteryWh>=s.budgets!.power.eclipseWh],['radio',requirements.find(r=>r.id==='GROUND-RADIO-01')?.result==='PASS'],['pointing',!s.cues.active.some(c=>c.severity===3&&c.ruleId.includes('POINT'))],['disposal',disposal.status!=='UNKNOWN']].map(([key,pass])=><li key={String(key)} data-pass={pass&&!(key==='disposal'&&disposal.status==='NOT_APPLICABLE')}><span>{key==='disposal'&&disposal.status==='NOT_APPLICABLE'?t('hud.na'):pass?'✓':'○'}</span>{t(`hud.check.${key}`)}</li>)}</ul>{s.players.length>1&&<Signoffs/>}{readiness.filter(issue=>issue.code!=='SIGNOFF_BLOCKED').map((issue,index)=><RefusalNote key={index} refusal={issue}/>)}<ExplainButton topic="concept-maturity"/></section><details><summary>{t('hud.modelLimits')}</summary><p>{t('flow.disposalLimit')}</p><p>{disposal.years?t('flow.disposalEstimate',{low:disposal.years[0].toFixed(1),high:disposal.years[1].toFixed(1)}):t('flow.disposalUnknown')}</p>{d.rideId==='RIDE_CUBESAT_DISPENSER'&&<p>{t('flow.dispenserFit')}</p>}<ExplainButton topic="disposal-screening"/>{missionMaturity(d,a,s.signoffs).evidence.map(e=><p key={e.id}>{e.id} · {t(`flow.evidence.${e.state}`)} · {e.provenance}</p>)}</details></section>}
  {s.activeStage==='IMPLEMENT'&&!s.sim&&<section><h1>{t('flow.launch')}</h1><p>{t('hud.launchReady')}</p><ExplainButton topic="launch-commission"/>{evaluateJourneyStage(d,a,s.activeStage,s.signoffs).map((issue,index)=><p key={index}>{t(issue.messageKey,issue.values)}</p>)}</section>}
 </div>;
}
