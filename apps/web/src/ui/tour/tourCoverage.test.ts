import { beforeEach, expect, test } from 'bun:test';
import { listParts, missionRequirements } from '@astrix/core';
import { STAGES, SUBSTEPS, WARPS, useMission } from '../../store';
import { english, portuguese } from '../../i18n/resources';
import { tours, stepsForTour } from './tours';

/** Intentional user-facing inventory: adding a controller option requires adding its tour. */
const controlCoverage = [
 'control-context','primary','control-explain','control-requirements','requirements-explain','requirements-evidence',
 'control-checklist','checklist-items','control-close','control-slots','control-stage',
 'chapter-briefing','chapter-build','chapter-test','chapter-fly','chapter-debrief',
 'control-panel-mission','control-panel-readiness','control-panel-review','control-panel-log',
 'slot-exploded','slot-dimensions','slot-turntable',
 'control-flight','timeline-edge','timeline-contact','timeline-advance','timeline-toggle',
 'hotbar-sun','hotbar-target','hotbar-earth','hotbar-downlink','hotbar-safe','hotbar-deploy',
 'pilot','pilot-rollLeft','pilot-pitchUp','pilot-rollRight','pilot-yawLeft','pilot-pitchDown','pilot-yawRight',
 'time-warp','time-event','receipts','choice-tour','choice-preview','confirm','choice-cancel',
];
beforeEach(()=>{useMission.getState().resetMission();useMission.getState().setTeam(1);useMission.getState().startScenario('FIRST_LIGHT','ASPIRING');});
test('every named controller option has a tour step, not a whole-panel replacement',()=>{
 const targets=new Set(Object.values(tours).flatMap(steps=>steps.flatMap(step=>[step.target,...(step.compactTarget?[step.compactTarget]:[])])));
 for(const target of controlCoverage)expect(targets.has(target)).toBe(true);
 for(const category of ['BATTERY','SOLAR','COMPUTER','STORAGE','ADCS','RADIO','INSTRUMENT','PROPULSION','THERMAL'])expect(targets.has(`slot-${category}`)).toBe(true);
 for(const id of ['mass','power','budget','data','comms','time','crew'])expect(targets.has(`resource-${id}`)).toBe(true);
});
test('every mission stage/substep and every clock speed is explicitly named',()=>{
 const ids=new Set(tours.welcome.map(step=>step.id));
 for(const stage of STAGES)for(const substep of SUBSTEPS[stage])expect(ids.has(`view-${stage}-${substep}`)).toBe(true);
 for(const speed of WARPS)expect(tours.flight.find(step=>step.id===`warp-${speed}`)?.values?.speed).toBe(speed);
});
test('every tour step has English and Portuguese copy and stable unique identity',()=>{
 for(const steps of Object.values(tours)) {
  expect(new Set(steps.map(step=>step.id)).size).toBe(steps.length);
  for(const step of steps) {
   expect(english[step.key]).toBeTruthy();expect(portuguese[step.key]).toBeTruthy();
   if(step.titleKey){expect(english[step.titleKey]).toBeTruthy();expect(portuguese[step.titleKey]).toBeTruthy();}
  }
 }
});
test('actual bus categories, installed components and requirements receive steps without mutating the mission',()=>{
 const s=useMission.getState(),before=JSON.stringify({design:s.design,artifacts:s.artifacts,telemetry:s.telemetry});
 const steps=stepsForTour('welcome',s),targets=new Set(steps.map(step=>step.target));
 for(const category of new Set(listParts(s.design!.busId).map(part=>part.category)))expect(targets.has(`slot-${category}`)).toBe(true);
 for(const part of s.design!.parts)expect(targets.has(`component-${part.partId}`)).toBe(true);
 const detailed={...s,settings:{...s.settings,presentation:'DETAILED' as const}},detailedTargets=new Set(stepsForTour('welcome',detailed).map(step=>step.target));
 for(const requirement of missionRequirements(s.design!))expect(detailedTargets.has(`requirement-${requirement.id}`)).toBe(true);
 expect(JSON.stringify({design:s.design,artifacts:s.artifacts,telemetry:s.telemetry})).toBe(before);
});
