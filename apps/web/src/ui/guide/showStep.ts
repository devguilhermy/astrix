import { useMission } from '../../store';
import { useWorkbench } from '../../three/spacecraft/workbenchState';
import { showWindow } from '../layout/windows';
import { requestCue } from './cueStore';
import type { NextStep } from './nextSteps';
export function showStep(step:NextStep):void {
 const state=useMission.getState();
 const orbit=step.section==='orbit'||['orbit','rides','fuel-planner'].includes(step.target);
 if(!state.sim){
  if(step.target==='objective')state.setStage('NEED_GOALS');
  else if(step.target==='segments')state.setStage('CONCEPT');
  else if(step.target==='requirements')state.setStage('REQUIREMENTS');
  else if(orbit||step.section||step.target==='baseline'||step.target==='freeze'||step.target==='parts'||step.target.startsWith('part-'))state.setStage('DESIGN');
  const current=useMission.getState();
  if(current.activeStage==='DESIGN')current.setSubstep(orbit?'orbit':'equipment');
 }
 if(step.sceneTarget){useWorkbench.getState().selectCategory(step.sceneTarget);useWorkbench.getState().setHoveredCategory(step.sceneTarget);}
 if(step.panel)showWindow(step.panel,`[data-cue-target="${step.target}"], [id="${step.target}"]`);
 requestCue(step.target);
}
