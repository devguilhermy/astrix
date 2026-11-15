// Adapted from Void Protocol components/ui/TourSpotlight.tsx, pin 218625d (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence).
import { useLayoutEffect, useState } from 'react';
import { resolveCueTarget } from '../guide/cueTargets';

/** Spotlights the first visible candidate anchor; with none, the card centres over a plain dim. */
export function TourSpotlight({targets}:{targets:readonly string[]}) {
 const [rect,setRect]=useState<DOMRect|null>(null),key=targets.join('|');
 useLayoutEffect(()=>{
  let frame=0;
  const track=()=>{
   let box:DOMRect|null=null;
   for(const target of key.split('|')){const el=resolveCueTarget(target);if(el){const rect=el.getBoundingClientRect();if(rect.width&&rect.height){box=rect;break;}}}
   setRect(old=>box&&old&&box.x===old.x&&box.y===old.y&&box.width===old.width&&box.height===old.height?old:box);
   const card=document.querySelector<HTMLElement>('.tour-dialog');
   if(card){
    const width=Math.min(340,window.innerWidth-24),height=card.getBoundingClientRect().height,compact=window.innerWidth<900;
    const left=box?box.right+width+20<window.innerWidth?box.right+12:box.left-width-12:(window.innerWidth-width)/2;
    // Anchored cards sit beside the target; on compact screens above it so the bottom controller stays visible.
    const top=compact?(box?.top??window.innerHeight)-height-12:box?box.top:(window.innerHeight-height)/2;
    card.style.left=`${Math.max(12,Math.min(window.innerWidth-width-12,left))}px`;
    card.style.top=`${Math.max(12,Math.min(window.innerHeight-height-12,top))}px`;
    card.style.width=`${width}px`;
   }
   frame=requestAnimationFrame(track);
  };
  track();
  return()=>cancelAnimationFrame(frame);
 },[key]);
 return rect?<div className="tour-cutout" aria-hidden="true" style={{left:Math.max(0,rect.x-5),top:Math.max(0,rect.y-5),width:Math.min(window.innerWidth,rect.width+10),height:rect.height+10}}/>:<div className="tour-dim" aria-hidden="true"/>;
}
