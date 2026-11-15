import { useLayoutEffect } from 'react';
import { closedControllerHeight, layoutClass } from './panelLayout';
import { useWindows } from './windows';

/** One measurement authority for header, resources and the bottom controller. */
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
   const control=document.querySelector<HTMLElement>('.mission-control')?.getBoundingClientRect();
   const baseElement=document.querySelector<HTMLElement>('.mission-control-base'),base=baseElement?.getBoundingClientRect();
   const notice=baseElement?.querySelector<HTMLElement>('.pause-explanation')?.getBoundingClientRect();
   const chrome=width<900?Math.max(header?.bottom??48,resources?.bottom??48):header?.bottom??48;
   const workspaceTop=chrome+top+8;
   // Expanded trays and transient status text never choose fixed vs reading mode.
   const baseHeight=closedControllerHeight(base?.height??(width<900?200:112),notice?.height??0,baseElement?parseFloat(getComputedStyle(baseElement).rowGap)||0:0);
   const closedBottom=y+height-bottom-baseHeight-16;
   const layout=layoutClass({width,height},Math.max(0,closedBottom-workspaceTop),visual?.scale??1);
   document.documentElement.dataset.windowLayout=layout;
   const controlTop=control&&control.width>0?y+height-bottom-control.height-8:y+height-bottom-baseHeight-8;
   const available=Math.max(0,controlTop-8-workspaceTop);
   const props:Record<string,number>={'--window-header-height':header?.height??48,'--window-viewport-x':x,'--window-viewport-y':y+top,'--window-viewport-width':width,'--window-chrome-height':chrome,'--hud-top':header?.bottom??48,'--hud-resources-bottom':resources?.bottom??48,'--mission-control-inset':height-(controlTop-y),'--flight-hud-inset':height-(controlTop-y)};
   for(const [property,value] of Object.entries(props))document.documentElement.style.setProperty(property,`${value}px`);
   useWindows.getState().setViewport({x:x+left+8,y:workspaceTop,width:Math.max(0,width-left-right-16),height:available},layout);
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  const observed=new Set<Element>(),observer=new ResizeObserver(schedule);
  const bind=()=>{for(const el of document.querySelectorAll('.interface-header,.resource-grid,.mission-control,.mission-control-base'))if(!observed.has(el)){observed.add(el);observer.observe(el);}schedule();};
  observer.observe(safeArea);const mutations=new MutationObserver(bind);const root=document.querySelector('.floating-studio');if(root)mutations.observe(root,{childList:true,subtree:true});bind();measure();
  window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();mutations.disconnect();safeArea.remove();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);delete document.documentElement.dataset.windowLayout;for(const property of ['--window-header-height','--window-viewport-x','--window-viewport-y','--window-viewport-width','--window-chrome-height','--hud-top','--hud-resources-bottom','--mission-control-inset','--flight-hud-inset'])document.documentElement.style.removeProperty(property);};
 },[active]);
}
