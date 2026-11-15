// Adapted from Void Protocol components/ui/TourSpotlight.tsx, pin 218625d (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence).
import { useLayoutEffect, useState } from 'react';
export function TourSpotlight({target,fallbackTarget}:{target:string;fallbackTarget?:string}){
 const [rect,setRect]=useState<DOMRect|null>(null);
 useLayoutEffect(()=>{
  let frame=0;
  const track=()=>{
   const nodes=[...document.querySelectorAll<HTMLElement>('[data-cue-target]')];
   const el=nodes.find(node=>node.dataset.cueTarget===target&&node.getClientRects().length&&!node.closest('[hidden]'))??nodes.find(node=>node.dataset.cueTarget===fallbackTarget&&node.getClientRects().length&&!node.closest('[hidden]'))??document.getElementById(target);
   const box=el?.getClientRects().length?el.getBoundingClientRect():null;
   setRect(old=>old?.x===box?.x&&old?.y===box?.y&&old?.width===box?.width&&old?.height===box?.height?old:box);
   const card=document.querySelector<HTMLElement>('.tour-dialog');
   if(card){const width=Math.min(340,window.innerWidth-24),height=card.getBoundingClientRect().height,compact=window.innerWidth<900;
    const left=box?box.right+width+20<window.innerWidth?box.right+12:box.left-width-12:(window.innerWidth-width)/2;
    const top=compact?window.innerHeight-height-12:box?box.top:(window.innerHeight-height)/2;
    card.style.left=`${Math.max(12,Math.min(window.innerWidth-width-12,left))}px`;card.style.top=`${Math.max(12,Math.min(window.innerHeight-height-12,top))}px`;card.style.width=`${width}px`;
   }
   frame=requestAnimationFrame(track);
  };track();return()=>cancelAnimationFrame(frame);
 },[target,fallbackTarget]);
 return rect?<div className="tour-cutout" aria-hidden="true" style={{left:Math.max(0,rect.x-5),top:Math.max(0,rect.y-5),width:Math.min(window.innerWidth,rect.width+10),height:rect.height+10}}/>:<div className="tour-dim" aria-hidden="true"/>;
}
