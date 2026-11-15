import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMission } from '../../store';
import { ExplainButton } from '../science/ExplainButton';
import { nextSteps, journeySteps, type GuideContext } from './nextSteps';
import { showStep } from './showStep';
import { requestCue } from './cueStore';
import { useWindows } from '../layout/windows';
export function guideContext(s:ReturnType<typeof useMission.getState>):GuideContext|null {
 return s.design&&s.artifacts?{design:s.design,artifacts:s.artifacts,stage:s.activeStage,signoffs:s.signoffs,cues:s.cues.active,sim:s.sim,telemetry:s.telemetry,decisions:s.pendingDecisions}:null;
}
export function CapcomCard(){
 const s=useMission(),{t,i18n}=useTranslation(),ctx=guideContext(s);
 const compact=useWindows(state=>state.layout!=='desktop');
 const [desktopOpen,setDesktopOpen]=useState(s.levelId==='ASPIRING'),[compactOpen,setCompactOpen]=useState(false);
 const open=compact?compactOpen:desktopOpen,setOpen=compact?setCompactOpen:setDesktopOpen;
 useEffect(()=>{setDesktopOpen(s.levelId==='ASPIRING');setCompactOpen(false);},[s.attemptId,s.levelId]);
 if(!ctx)return null;
 const steps=nextSteps(ctx),step=steps[0],all=journeySteps(ctx),done=all.filter(item=>item.done(ctx)).length;
 const title=step?t(i18n.exists(step.titleKey)?step.titleKey:step.hintKey,step.values):t(s.activeStage==='IMPLEMENT'&&!s.sim?'flow.launch':'flow.next');
 return <aside className="capcom-card" data-hud-zone="right" data-cue-target="capcom" aria-label="CAPCOM">
  <button className="capcom-summary" aria-expanded={open} aria-controls="capcom-body" onClick={()=>setOpen(!open)}><strong>CAPCOM</strong><span>{title}</span><span aria-hidden="true">{open?'⌃':'⌄'}</span></button>
  <div id="capcom-body" hidden={!open}><span className="eyebrow">{t('hud.nextStep')} · {done}/{all.length}</span><h2>{title}</h2>
   {step&&<><span className="chip">{t(`role.${step.owner}`)}</span><div className="button-wrap"><button className="button" onClick={()=>showStep(step)}>{t('hud.showMe')}</button><ExplainButton topic={step.sceneTarget==='INSTRUMENT'?'science-return':'mission-design'} context={`capcom.${step.id}`}/></div></>}
   {!step&&<button className="button" onClick={()=>{document.getElementById('mission-primary')?.focus();requestCue('primary');}}>{t('hud.showMe')}</button>}
   <details><summary>{t('hud.checklist')}</summary><ol>{all.map(item=><li key={item.id}><span aria-label={t(item.done(ctx)?'hud.done':'hud.pending')}>{item.done(ctx)?'✓':'○'}</span> {t(i18n.exists(item.titleKey)?item.titleKey:item.hintKey,item.values)}</li>)}</ol></details>
  </div>
 </aside>;
}
