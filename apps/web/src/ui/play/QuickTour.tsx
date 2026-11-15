import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, CircleHelp, X } from 'lucide-react';
import './quickTour.css';

type TourView='solar'|'explore'|'prepare'|'play';
type Step={targets:readonly string[];en:[string,string];pt:[string,string]};
const tours:Record<TourView,readonly Step[]>={
 solar:[{targets:['.immersive-scene-controls'],en:['Explore first','Choose a body or move the camera. Open the mission board when you’re ready. Exploring never advances a mission.'],pt:['Explore primeiro','Escolha um astro ou mova a câmera. Abra as missões quando quiser. Explorar não avança uma missão.']}],
 explore:[{targets:['[data-tour="mission-board"]'],en:['Choose what to discover','Prepare a suggested mission, or use Design & Play to choose a goal and compare equipment.'],pt:['Escolha o que descobrir','Prepare uma missão sugerida ou use Projetar e jogar para escolher uma meta e comparar equipamentos.']}],
 prepare:[{targets:['[data-tour="preparation-config"]','.context-panel-switch'],en:['Make a few meaningful choices','Choose the goal, ambition, hardware and approach. The spacecraft and constraints update with your design.'],pt:['Faça escolhas importantes','Escolha meta, ambição, equipamentos e estratégia. A nave e os limites acompanham seu projeto.']},{targets:['[data-tour="preparation-start"]','.context-panel-switch'],en:['Check, then play','Review the constraints and readiness in the other panel. Play becomes available when this design has a demonstrated feasible path.'],pt:['Verifique e jogue','Revise os limites e a prontidão no outro painel. Jogar fica disponível quando este projeto tem um caminho viável demonstrado.']}],
 play:[{targets:['[data-tour="resources"]'],en:['Read your resources','These are the current mission values, not the preview. The resource grid remains visible when panels close.'],pt:['Acompanhe seus recursos','Estes são os valores atuais da missão, não a previsão. A grade de recursos permanece visível com os painéis fechados.']},{targets:['[data-tour="turn-actions"]'],en:['Preview before you commit','Select a plan to inspect its consequences. Only Commit advances the mission. Keep your camera where you want it.'],pt:['Veja antes de confirmar','Selecione um plano para examinar as consequências. Só Confirmar avança a missão. Mantenha a câmera como preferir.']}],
};
const KEY='astrix.quick-tour.v1';
type Progress={skipped:boolean;seen:string[]};
function readProgress():Progress {try{const value=JSON.parse(localStorage.getItem(KEY)??'null');return {skipped:value?.skipped===true,seen:Array.isArray(value?.seen)?value.seen.filter((item:unknown):item is string=>typeof item==='string'):[]};}catch{return {skipped:false,seen:[]};}}
type Box={left:number;top:number;width:number;height:number};
function targetBox(selectors:readonly string[]):Box|null {
 for(const selector of selectors){const element=document.querySelector<HTMLElement>(selector);if(!element||element.closest('[hidden],[inert]')||!element.getClientRects().length)continue;
  const r=element.getBoundingClientRect();let left=Math.max(8,r.left),top=Math.max(8,r.top),right=Math.min(innerWidth-8,r.right),bottom=Math.min(innerHeight-8,r.bottom);
  for(let parent=element.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(/auto|scroll|hidden|clip/.test(`${style.overflowX} ${style.overflowY}`)){const p=parent.getBoundingClientRect();left=Math.max(left,p.left);top=Math.max(top,p.top);right=Math.min(right,p.right);bottom=Math.min(bottom,p.bottom);}}
  if(right-left>10&&bottom-top>10)return {left,top,width:right-left,height:bottom-top};
 }
 return null;
}

/** Presentation only: never sends a session intent, changes a design or commits a turn. */
export function QuickTour({view,enabled,onReveal}:{view:string;enabled:boolean;onReveal:()=>void}) {
 const {i18n}=useTranslation(),pt=i18n.resolvedLanguage?.startsWith('pt');
 const steps=view in tours?tours[view as TourView]:[];
 const [progress,setProgress]=useState(readProgress),[running,setRunning]=useState(false),[index,setIndex]=useState(0),[box,setBox]=useState<Box|null>(null),[cardSize,setCardSize]=useState({width:320,height:220});
 const card=useRef<HTMLElement>(null),trigger=useRef<HTMLButtonElement>(null),opener=useRef<HTMLElement|null>(null),manual=useRef(false);
 useEffect(()=>{setIndex(0);manual.current=false;setRunning(enabled&&!progress.skipped&&!progress.seen.includes(view)&&steps.length>0);},[view,enabled]);
 const save=(next:Progress)=>{setProgress(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* Optional presentation progress cannot block play. */}};
 const close=(skip=false)=>{save({skipped:progress.skipped||skip,seen:[...new Set([...progress.seen,view])]});setRunning(false);if(manual.current&&opener.current?.isConnected)opener.current.focus({preventScroll:true});};
 useEffect(()=>{
  if(!running||!steps[index]){setBox(null);return;}
  let frame=0;
  const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const next=targetBox(steps[index].targets);setBox(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);});};
  measure();window.addEventListener('resize',measure);document.addEventListener('scroll',measure,true);
  const observer=new MutationObserver(measure);observer.observe(document.querySelector('.play-app')??document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','data-panels-open','style']});
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',measure);document.removeEventListener('scroll',measure,true);};
 },[running,index,view]);
 useEffect(()=>{const element=card.current;if(!element)return;const observer=new ResizeObserver(()=>{const r=element.getBoundingClientRect();setCardSize(previous=>previous.width===r.width&&previous.height===r.height?previous:{width:r.width,height:r.height});});observer.observe(element);return()=>observer.disconnect();},[running,!!box]);
 useEffect(()=>{if(!running)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('[aria-modal="true"]')){event.preventDefault();close(true);}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[running,progress,view]);
 useEffect(()=>{if(running&&box&&manual.current)card.current?.focus({preventScroll:true});},[running,!!box,index]);
 if(!steps.length)return null;
 const step=steps[index],text=step?.[pt?'pt':'en'];
 const width=Math.min(cardSize.width,typeof innerWidth==='number'?innerWidth-24:320),height=cardSize.height;
 let left=12,top=96;
 if(box&&typeof innerWidth==='number'){
  if(box.left+box.width+width+24<innerWidth){left=box.left+box.width+12;top=box.top;}
  else if(box.left>width+24){left=box.left-width-12;top=box.top;}
  else if(box.top>height+24){left=box.left;top=box.top-height-12;}
  else {left=box.left;top=box.top+box.height+12;}
  left=Math.max(12,Math.min(innerWidth-width-12,left));top=Math.max(12,Math.min(innerHeight-height-12,top));
 }
 return <><button ref={trigger} className="quick-tour-trigger" onClick={()=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;manual.current=true;onReveal();setIndex(0);setRunning(true);}}><CircleHelp size={18} aria-hidden="true"/>{pt?'Guia rápido':'Quick tour'}</button>
 {running&&box&&text&&<div className="quick-tour-layer"><div className="quick-tour-highlight" style={{left:box.left-3,top:box.top-3,width:box.width+6,height:box.height+6}} aria-hidden="true"/><section ref={card} className="quick-tour-card" role="region" aria-label={pt?'Guia rápido':'Quick tour'} tabIndex={-1} style={{left,top}}><header><span>{index+1} / {steps.length}</span><button className="icon-button" onClick={()=>close(true)} aria-label={pt?'Pular guia':'Skip tour'}><X size={19}/></button></header><h2>{text[0]}</h2><p>{text[1]}</p><footer><button className="button" disabled={index===0} onClick={()=>setIndex(value=>value-1)} aria-label={pt?'Voltar':'Back'}><ArrowLeft size={18}/></button><button className="text-button" onClick={()=>close(true)}>{pt?'Pular guia':'Skip tour'}</button><button className="button primary" onClick={()=>index+1===steps.length?close():setIndex(value=>value+1)}>{index+1===steps.length?<Check size={18}/>:<ArrowRight size={18}/>} {pt?index+1===steps.length?'Pronto':'Próximo':index+1===steps.length?'Done':'Next'}</button></footer></section></div>}
 </>;
}
