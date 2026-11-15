import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppCanvas } from '../../three/AppCanvas';
import { liveMission, useMission } from '../../store';
import { useSimLoop } from '../../loop/useSimLoop';
import { TopBar } from '../shell/TopBar';
import { ResourceGrid } from '../hud/ResourceGrid';
import { MissionControl } from '../guide/MissionControl';
import { CueHighlight } from '../guide/CueHighlight';
import { TourHost } from '../tour/TourHost';
import { DecisionOverlay } from '../flight/DecisionOverlay';
import { EventToasts } from '../flight/EventToasts';
import { Goal } from '../phases/Goal';
import { DesignScreen } from '../phases/Design';
import { LaunchScreen } from '../phases/Launch';
import { OperateScreen } from '../phases/Operate';
import { ReportScreen } from '../phases/Report';
import { JourneyWorkshop } from '../phases/Journey';
import { TechnicalForecast } from '../phases/TechnicalSystems';
import { BudgetsPanel } from '../panels/Budgets';
import { GlobalRefusal, ReviewCoach } from '../panels/Review';
import { Handoff } from '../panels/Overlays';
import { DraggablePanel } from '../layout/DraggablePanel';
import { useWindowViewport } from '../layout/useWindowViewport';
import { useWindows } from '../layout/windows';
import { useWindowCopy } from '../layout/windowCopy';
import { LogPanel } from '../workshop/LogPanel';
import { PartInspector } from '../inspector/PartInspector';
import { ErrorBoundary } from '../recovery/ErrorBoundary';
import { configureAudio, playCue } from '../../audio/cues';
import { unlockAudio } from '../../audio/tones';
import { subscribeGameEvents } from '../../store/events';
import { trajectoryViewer } from '../advanced/trajectoryStore';
import { useShellCopy } from './copy';
const stageKeys={NEED_GOALS:'need',CONCEPT:'concept',REQUIREMENTS:'requirements',DESIGN:'design',BUILD_VERIFY:'verify',IMPLEMENT:'implement',REVIEW:'finalReview'} as const;
export interface SimulatorProps {active:boolean;onReady:()=>void;onFailure:(error?:unknown)=>void;onHome:()=>void;onChoose:()=>void;onModuleReady:()=>void}
export function Simulator({active,onReady,onFailure,onHome,onChoose,onModuleReady}:SimulatorProps){
 useSimLoop();
 useWindowViewport(active);
 const {t}=useTranslation(),c=useShellCopy(),s=useMission(),view=s.activeView,viewer=trajectoryViewer(state=>state.active),announcement=useWindows(state=>state.announcement),windowCopy=useWindowCopy();
 const previousStage=useRef<string|null>(null),[sceneReady,setSceneReady]=useState(false);
 const ready=useCallback(()=>{setSceneReady(true);onReady();},[onReady]);
 useEffect(()=>{if(!active){previousStage.current=null;return;}document.title=`${t(`flow.${stageKeys[s.activeStage]}`)} — ASTRIX`;history.replaceState(null,'',`#mission/${s.activeStage.toLowerCase()}`);},[active,s.activeStage,t]);
 useEffect(()=>{if(!active){previousStage.current=null;return;}const initial=previousStage.current===null||previousStage.current===s.activeStage;previousStage.current=s.activeStage;let second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{const heading=document.getElementById(initial?'simulator-heading':'journey-heading');if(heading?.isConnected&&!heading.closest('[hidden],[inert]'))heading.focus();else document.getElementById('simulator-heading')?.focus();});});return()=>{cancelAnimationFrame(first);if(second)cancelAnimationFrame(second);};},[active,s.activeStage]);
 useEffect(()=>{onModuleReady();},[onModuleReady]);
 useEffect(()=>{configureAudio(s.settings);},[s.settings]);
 useEffect(()=>{const unlock=()=>unlockAudio();document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);};},[]);
 useEffect(()=>subscribeGameEvents(event=>{if(event.kind==='FAILURE')playCue('failure');else if(event.kind==='OBJECTIVE_MET')playCue('success');else if(event.kind==='SOLAR_STORM_START')playCue('storm');else if(event.kind==='PASS_START')playCue('passStart');else if(event.kind==='PASS_END')playCue('passEnd');else if(event.autoPause)playCue('decision');}),[]);
 return <div className={`app floating-studio phase-${view} stage-${s.activeStage}`}>
  <div className="space-stage"><AppCanvas onReady={ready} onFailure={onFailure}/></div>
  {s.design&&<><div className="studio-interface"><div className="interface-header"><TopBar onHome={onHome} onChoose={onChoose}/></div>{!viewer&&<>
   <ResourceGrid/>
   <ErrorBoundary scope="layout" onError={()=>useMission.getState().pause('error')} onRetry={()=>useMission.getState().clearPauseReason('error')}>
    <main className="floating-workspace">
     <DraggablePanel id="mission" phase={view} title={t('hud.workshop')} badge={s.pendingDecisions.length}><div key={liveMission.generation} id="workspace-panel" aria-labelledby="journey-heading"><h2 id="journey-heading" tabIndex={-1} className="sr-only">{t(`flow.${stageKeys[s.activeStage]}`)}</h2>
      {s.activeStage==='NEED_GOALS'&&<Goal/>}
      {s.activeStage==='DESIGN'&&(view==='DESIGN'?<DesignScreen/>:<LaunchScreen/>)}
      {s.activeStage==='IMPLEMENT'&&s.sim&&<OperateScreen/>}
      {s.activeStage==='REVIEW'&&s.telemetry?.ended&&<ReportScreen/>}
      <JourneyWorkshop/>
      {s.levelId==='ASPIRING'&&s.practiceCheckpoints.length>0&&<details className="practice-checkpoints"><summary>{c('practice')}</summary>{s.assisted&&<p>{c('assisted')}</p>}{s.practiceCheckpoints.map(checkpoint=><button className="button" key={`${checkpoint.name}-${checkpoint.id}`} onClick={()=>{if(window.confirm(`${c('retry')} — ${c(checkpoint.name==='launch'?'checkpointLaunch':checkpoint.name==='arrival'?'checkpointArrival':'checkpointDecision')}?`))s.retryCheckpoint(checkpoint.id);}}>{c('retry')} · {c(checkpoint.name==='launch'?'checkpointLaunch':checkpoint.name==='arrival'?'checkpointArrival':'checkpointDecision')} · {Math.round(checkpoint.time)} s</button>)}</details>}
     </div></DraggablePanel>
     <DraggablePanel id="readiness" phase={view} title={t('hud.details')}><div id="budgets"><BudgetsPanel/>{s.budgets&&<TechnicalForecast budgets={s.budgets}/>}</div></DraggablePanel>
     <DraggablePanel id="review" phase={view} title={t('ui.panelReview')} badge={s.cues.active.filter(cue=>cue.severity===3).length}><ReviewCoach/></DraggablePanel>
     <DraggablePanel id="log" phase={view} title={t('ui.events')} badge={s.events.length}><LogPanel/></DraggablePanel>
     <PartInspector/>
    </main>
   </ErrorBoundary>
   <MissionControl/>
   {s.activeStage==='IMPLEMENT'&&s.sim&&<><DecisionOverlay/><EventToasts/></>}
   <CueHighlight/><TourHost ready={active&&sceneReady}/><GlobalRefusal/>
  </>}</div>{!viewer&&<Handoff/>}</>}
  <div className="sr-only" aria-live="polite">{s.events.at(-1)?t(`event.${s.events.at(-1)!.kind}.title`,s.events.at(-1)!.values):''}</div>
  <div className="sr-only" aria-live="polite">{announcement?`${windowCopy[announcement.id]}: ${t(`hud.${announcement.action}`)}`:''}</div>
 </div>;
}
