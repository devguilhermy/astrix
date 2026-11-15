import { useEffect } from 'react';
import { useMission } from '../store';
export function useSimLoop():void{
 useEffect(()=>{
  let frame=0,last=performance.now(),published=last;
  const tick=(now:number)=>{
   const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
   const state=useMission.getState();
   if(state.running){state.advance(dt*state.warp,now-published>=100);if(now-published>=100)published=now;}
   frame=requestAnimationFrame(tick);
  };
  const visibility=()=>{const state=useMission.getState();if(document.hidden)state.pause('hidden');else state.clearPauseReason('hidden');};
  if(document.hidden)useMission.getState().pause('hidden');
  frame=requestAnimationFrame(tick);document.addEventListener('visibilitychange',visibility);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);};
 },[]);
}
