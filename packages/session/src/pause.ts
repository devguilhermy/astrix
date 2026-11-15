import type { PauseReason, SessionActor, SessionState } from './contracts';
const localReasons:readonly PauseReason[]=['explanation','handoff','settings','hidden','chooser','graphics','home','viewer','tour','error','route'];
export function isSharedPause(state:SessionState,reason:PauseReason,actor:SessionActor):boolean {
 if(state.mode==='LOCAL')return true;
 if(reason==='handoff'||reason==='tour')return false;
 if(localReasons.includes(reason))return !!actor.isHost&&reason!=='explanation';
 return true;
}
export function blocksResume(reason:PauseReason):boolean {return reason!=='manual'&&reason!=='self-paced';}
export function addReason(reasons:readonly PauseReason[],reason:PauseReason):readonly PauseReason[]{return reasons.includes(reason)?reasons:[...reasons,reason];}
