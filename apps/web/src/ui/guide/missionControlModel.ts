import { evaluateJourneyStage, launchReadiness, nextBoundary, type JourneyStage } from '@astrix/core';
import type { MissionStore } from '../../store';
import { nextSteps, type GuideContext } from './nextSteps';

export const stageKeys = { NEED_GOALS:'need', CONCEPT:'concept', REQUIREMENTS:'requirements', DESIGN:'design', BUILD_VERIFY:'verify', IMPLEMENT:'implement', REVIEW:'finalReview' } as const;
export const chapters = [
 { id:'briefing', stages:['NEED_GOALS','CONCEPT','REQUIREMENTS'] },
 { id:'build', stages:['DESIGN'] }, { id:'test', stages:['BUILD_VERIFY'] },
 { id:'fly', stages:['IMPLEMENT'] }, { id:'debrief', stages:['REVIEW'] },
] as const;
export function guideContext(s: MissionStore): GuideContext | null {
 return s.design && s.artifacts ? { design:s.design, artifacts:s.artifacts, stage:s.activeStage, signoffs:s.signoffs, cues:s.cues.active, sim:s.sim, telemetry:s.telemetry, decisions:s.pendingDecisions } : null;
}
export function canVisitStage(s: MissionStore, target: JourneyStage, stages: readonly JourneyStage[]): boolean {
 if (s.sim) return target === 'IMPLEMENT' || target === 'REVIEW' && !!s.telemetry?.ended;
 const current = stages.indexOf(s.activeStage), index = stages.indexOf(target);
 return index >= 0 && index <= s.furthestStage && !!s.design && !!s.artifacts &&
  (index <= current || !stages.slice(current,index).some(stage => evaluateJourneyStage(s.design!,s.artifacts!,stage,s.signoffs).length));
}
export type PrimaryKind = 'guide'|'go'|'continue'|'launch'|'review'|'capture'|'decision'|'arrival'|'cancel'|'pause'|'resume'|'advance';
export function primaryAction(s: MissionStore) {
 const ctx = guideContext(s), step = ctx ? nextSteps(ctx)[0] : undefined;
 const boundary = s.sim ? nextBoundary(s.sim) : null;
 if (s.sim) {
  const kind: PrimaryKind = s.telemetry?.ended ? 'review' : s.telemetry?.capturePending ? 'capture' : s.pendingDecisions.length ? 'decision' : s.telemetry?.cruise ? 'arrival' : s.advancing ? 'cancel' : s.running ? 'pause' : s.levelId === 'EXPERT' ? 'resume' : 'advance';
  return { kind, step, boundary, blocked:!s.telemetry?.ended && s.pauseReasons.some(reason => !['manual','self-paced'].includes(reason)) && !s.pendingDecisions.length };
 }
 const issues = ctx ? evaluateJourneyStage(ctx.design,ctx.artifacts,s.activeStage,s.signoffs) : [];
 const urgent = step && (['SCI-PAYLOAD-01','LAUNCH-MASS-01','POWER-ECLIPSE-01','GROUND-RADIO-01'].includes(step.id) || s.cues.active.some(cue => cue.id === step.id && cue.severity === 3));
 const canGo = !!s.design && (s.players.length === 1 || Object.values(s.signoffs).every(Boolean)) && s.activeStage === 'BUILD_VERIFY' && s.artifacts?.verifiedRevision !== s.design.revision && !launchReadiness(s.design,s.signoffs).some(issue => issue.code !== 'SIGNOFF_BLOCKED') && !issues.some(issue => !['VERIFY','SIGNOFF_BLOCKED'].includes(issue.id));
 return { kind:(canGo ? 'go' : (issues.length || urgent) && step ? 'guide' : s.activeStage === 'IMPLEMENT' ? 'launch' : 'continue') as PrimaryKind, step, boundary, blocked:false };
}
