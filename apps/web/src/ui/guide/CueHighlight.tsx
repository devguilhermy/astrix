// Adapted from Void Protocol components/ui/CueHighlight.tsx, pin 218625d (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence).
import { useEffect, useState } from 'react';
import { useCueStore } from './cueStore';
import { resolveCueTarget } from './cueTargets';
export function CueHighlight(){
 const {target,expires,clear}=useCueStore(),[rect,setRect]=useState<DOMRect|null>(null);
 useEffect(()=>{
  if(!target){setRect(null);return;}
  let frame=0;
  const track=()=>{if(Date.now()>=expires){clear();return;}const el=resolveCueTarget(target);const box=el?.getBoundingClientRect()??null;setRect(old=>old?.x===box?.x&&old?.y===box?.y&&old?.width===box?.width&&old?.height===box?.height?old:box);frame=requestAnimationFrame(track);};
  track();return()=>cancelAnimationFrame(frame);
 },[target,expires,clear]);
 return rect?<div className="cue-highlight" aria-hidden="true" style={{left:rect.x-4,top:rect.y-4,width:rect.width+8,height:rect.height+8}}/>:null;
}
