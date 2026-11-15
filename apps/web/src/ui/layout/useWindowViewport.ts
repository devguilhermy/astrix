import { useLayoutEffect } from 'react';
import { layoutClass } from './panelLayout';
import { useWindows } from './windows';

/** One HUD measurement authority; panels never reserve a second chrome strip. */
export function useWindowViewport(active=true):void {
 useLayoutEffect(()=>{
  if(!active)return;
  let frame=0;
  const safeArea=document.createElement('div');safeArea.className='window-safe-area-probe';safeArea.setAttribute('aria-hidden','true');document.body.appendChild(safeArea);
  const measure=()=>{
   const visual=window.visualViewport,x=visual?.offsetLeft??0,y=visual?.offsetTop??0,width=visual?.width??window.innerWidth,height=visual?.height??window.innerHeight;
   const safe=getComputedStyle(safeArea),left=parseFloat(safe.paddingLeft)||0,right=parseFloat(safe.paddingRight)||0,top=parseFloat(safe.paddingTop)||0,bottom=parseFloat(safe.paddingBottom)||0;
   const header=document.querySelector<HTMLElement>('.interface-header')?.getBoundingClientRect();
   const resources=document.querySelector<HTMLElement>('.resource-grid')?.getBoundingClientRect();
   const capcom=document.querySelector<HTMLElement>('.capcom-card')?.getBoundingClientRect();
   const flightElement=document.querySelector<HTMLElement>('.flight-bar');
   const flight=flightElement?.getBoundingClientRect();
   const chrome=width<900?Math.max(header?.bottom??0,resources?.bottom??0,capcom?.bottom??0):header?.bottom??48;
   const fixedFlight=flightElement&&getComputedStyle(flightElement).position==='fixed';
   const deckTop=flight&&flight.width>0&&flight.height>0?(fixedFlight?flight.top:y+height-flight.height):y+height;
   const workspaceTop=chrome+top+8;
   const workspaceBottom=Math.min(y+height-bottom,deckTop)-8;
   const available=Math.max(0,workspaceBottom-workspaceTop);
   const layout=layoutClass({width,height},available,visual?.scale??1);
   document.documentElement.dataset.windowLayout=layout;
   const props:Record<string,number>={'--window-header-height':header?.height??48,'--window-viewport-x':x,'--window-viewport-y':y+top,'--window-viewport-width':width,'--window-chrome-height':chrome,'--hud-top':header?.bottom??48,'--hud-resources-bottom':resources?.bottom??48};
   for(const [property,value] of Object.entries(props))document.documentElement.style.setProperty(property,`${value}px`);
   useWindows.getState().setViewport({x:x+left+8,y:workspaceTop,width:Math.max(0,width-left-right-16),height:available},layout);
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  const observed=new Set<Element>(),observer=new ResizeObserver(schedule);
  const bind=()=>{for(const el of document.querySelectorAll('.interface-header,.resource-grid,.capcom-card,.flight-bar'))if(!observed.has(el)){observed.add(el);observer.observe(el);}schedule();};
  observer.observe(safeArea);const mutations=new MutationObserver(bind);const root=document.querySelector('.floating-studio');if(root)mutations.observe(root,{childList:true,subtree:true});bind();measure();
  let flightInset=document.documentElement.style.getPropertyValue('--flight-hud-inset');
  const flightPositionObserver=new MutationObserver(()=>{
   const next=document.documentElement.style.getPropertyValue('--flight-hud-inset');
   if(next!==flightInset){flightInset=next;schedule();}
  });
  flightPositionObserver.observe(document.documentElement,{attributes:true,attributeFilter:['style']});
  window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();mutations.disconnect();flightPositionObserver.disconnect();safeArea.remove();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);delete document.documentElement.dataset.windowLayout;for(const property of ['--window-header-height','--window-viewport-x','--window-viewport-y','--window-viewport-width','--window-chrome-height','--hud-top','--hud-resources-bottom'])document.documentElement.style.removeProperty(property);};
 },[active]);
}
