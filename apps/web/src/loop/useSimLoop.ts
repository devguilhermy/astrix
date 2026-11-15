import { useEffect } from 'react';
import { tickLocalSession, useMission } from '../store';
export function useSimLoop():void {
 useEffect(()=>{
  let frame=0,last=performance.now(),published=last;
  const tick=(now:number)=>{
   const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
   if(!useMission.getState().remoteMode){tickLocalSession(dt,now-published>=100);if(now-published>=100)published=now;}
   frame=requestAnimationFrame(tick);
  };
  const visibility=()=>{const state=useMission.getState();if(state.remoteMode)return;if(document.hidden)state.pause('hidden');else state.clearPauseReason('hidden');};
  if(document.hidden&&!useMission.getState().remoteMode)useMission.getState().pause('hidden');
  frame=requestAnimationFrame(tick);document.addEventListener('visibilitychange',visibility);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);};
 },[]);
}
