import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { evaluateJourneyStage, launchReadiness, listScenarios, nextBoundary } from '@astrix/core';
import { STAGES, useMission } from '../../store';
import { SettingsButton } from '../panels/Overlays';
import { RefusalNote } from '../panels/Review';
import { Modal } from '../primitives';
import { guideContext } from '../guide/CapcomCard';
import { nextSteps } from '../guide/nextSteps';
import { showStep } from '../guide/showStep';
import { goForLaunch } from '../phases/Journey';
import { HelpMenu } from './HelpMenu';
const stageKeys={NEED_GOALS:'need',CONCEPT:'concept',REQUIREMENTS:'requirements',DESIGN:'design',BUILD_VERIFY:'verify',IMPLEMENT:'implement',REVIEW:'finalReview'} as const;
export function TopBar({onHome,onChoose}:{onHome:()=>void;onChoose:()=>void}){
 const s=useMission(),{t,i18n}=useTranslation(),[refused,setRefused]=useState(false),d=s.design,x=s.telemetry,ctx=guideContext(s);
 if(!d||!ctx)return null;
 const scenario=listScenarios().find(item=>item.id===d.scenarioId)!,issues=evaluateJourneyStage(d,ctx.artifacts,s.activeStage,s.signoffs,s.sim),step=nextSteps(ctx)[0];
 const urgent=step&&(['SCI-PAYLOAD-01','LAUNCH-MASS-01','POWER-ECLIPSE-01','GROUND-RADIO-01'].includes(step.id)||s.cues.active.some(c=>c.id===step.id&&c.severity===3));
 const canGo=(s.players.length===1||Object.values(s.signoffs).every(Boolean))&&s.activeStage==='BUILD_VERIFY'&&s.artifacts?.verifiedRevision!==d.revision&&!launchReadiness(d,s.signoffs).some(r=>r.code!=='SIGNOFF_BLOCKED')&&!issues.some(b=>!['VERIFY','SIGNOFF_BLOCKED'].includes(b.id));
 const needsGuide=!s.sim&&!canGo&&(!!issues.length||!!urgent)&&step;
 const boundary=s.sim?nextBoundary(s.sim):null;
 const label=s.sim?x?.ended?t('flow.finalReview'):x?.capturePending?t('ui.command.CAPTURE_CONFIRM'):s.pendingDecisions.length?t('ui.decision'):x?.cruise?t('flow.boundary.ARRIVAL'):s.advancing?t('ui.cancel'):s.running?t('ui.pause'):s.levelId==='EXPERT'?t('ui.resume'):boundary?t(`flow.boundary.${boundary.kind}`):t('flow.advance'):canGo?t('hud.goForLaunch'):needsGuide?`${t('hud.showMe')}: ${t(i18n.exists(step.titleKey)?step.titleKey:step.hintKey,step.values)}`:s.activeStage==='IMPLEMENT'?t('flow.launch'):t('flow.next');
 const primary=()=>{
  if(!s.sim){if(canGo){goForLaunch();return;}if(needsGuide){showStep(step);return;}if(s.activeStage==='IMPLEMENT'){if(launchReadiness(d,s.signoffs).length){setRefused(true);return;}s.launch(d.revision);}else s.completeStage();return;}
  if(x?.ended){s.setStage('REVIEW');return;}if(x?.capturePending){s.decide([{kind:'CAPTURE_CONFIRM'}]);return;}if(s.pendingDecisions.length){document.getElementById('decision-heading')?.focus();return;}if(x?.cruise){s.skipCruise();return;}if(s.advancing){s.cancelAdvance();return;}if(s.running){s.pause();return;}s.levelId==='ASPIRING'?s.advanceToEvent():s.resume();
 };
 const blocked=s.pauseReasons.some(reason=>!['manual','self-paced'].includes(reason));
 const chapter=STAGES.indexOf(s.activeStage)<3?'briefing':s.activeStage==='DESIGN'?'build':s.activeStage==='BUILD_VERIFY'||s.activeStage==='IMPLEMENT'&&!s.sim?'test':s.activeStage==='REVIEW'?'debrief':'fly';
 return <><header className="top-bar" data-hud-zone="top" data-cue-target="topbar"><button className="brand" onClick={onHome}>ASTRIX</button><div className="topbar-mission"><h1 id="simulator-heading" tabIndex={-1}>{t(scenario.nameKey)}</h1><small>{t(s.levelId==='ASPIRING'?'flow.aspiring':'flow.expert')} · {t(`hud.chapter.${chapter}`)}</small></div><ol className="chapter-progress" aria-label={t('hud.journey')}>{STAGES.map((stage,index)=><li key={stage} aria-current={stage===s.activeStage?'step':undefined}><span id={`stage-${stage}`} aria-label={t(`flow.${stageKeys[stage]}`)} title={t(`flow.${stageKeys[stage]}`)}>{index<STAGES.indexOf(s.activeStage)?'●':index===STAGES.indexOf(s.activeStage)?'◉':'○'}</span></li>)}</ol><button id="mission-primary" className="button primary" data-cue-target="primary" title={label} disabled={!!s.sim&&!x?.ended&&blocked&&!s.pendingDecisions.length} onClick={primary}>{label}</button><HelpMenu onChoose={onChoose}/><SettingsButton/></header>{refused&&<Modal title={t('flow.launch')} onClose={()=>setRefused(false)}>{launchReadiness(d,s.signoffs).map((issue,index)=><RefusalNote key={index} refusal={issue}/>)}</Modal>}</>;
}
