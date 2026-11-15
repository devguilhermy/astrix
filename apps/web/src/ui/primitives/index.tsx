import { useEffect, useId, useRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '../icons';
import { UI_CARD_CLASS } from './classes';
export function Panel({title,children,className='',id}:{title?:ReactNode;children:ReactNode;className?:string;id?:string}){return <section id={id} className={`${UI_CARD_CLASS} ${className}`}>{title&&<header className="panel-heading">{title}</header>}{children}</section>;}
export function ActionButton({children,blocked,onBlocked,className='',onClick,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{blocked?:boolean;onBlocked?:()=>void}){return <button type="button" {...props} aria-disabled={blocked||undefined} className={`button ${className}`} onClick={e=>blocked?onBlocked?.():onClick?.(e)}>{children}</button>;}
export function Meter({label,value,limit,detail,intent='capacity'}:{label:ReactNode;value:number;limit:number;detail?:ReactNode;intent?:'capacity'|'reserve'|'progress'}){
 const pct=limit>0?100*value/limit:0;
 const state=intent==='progress'
  ? pct>=100?'success':''
  : intent==='reserve'
   ? pct<=0?'danger':pct<=20?'warning':''
   : pct>=100?'danger':pct>90?'warning':'';
 return <div className="meter-row">
  <div className="spread"><span>{label}</span><span className="number">{detail??`${value.toFixed(2)} / ${limit.toFixed(2)}`}</span></div>
  <div role={intent==='progress'?'progressbar':'meter'} aria-label={typeof label==='string'?label:undefined} aria-valuenow={Math.min(limit,Math.max(0,value))} aria-valuemin={0} aria-valuemax={limit} className={`meter ${state}`}>
   <span style={{width:`${Math.min(100,Math.max(0,pct))}%`}}/>
  </div>
 </div>;
}
export function Modal({title,children,onClose,className=''}:{title:string;children:ReactNode;onClose:()=>void;className?:string}) {
 const id=useId(),ref=useRef<HTMLElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const opener=document.activeElement instanceof HTMLElement?document.activeElement:null,el=ref.current;
  if(!el)return;
  const inerted:{node:HTMLElement;previous:boolean}[]=[];
  // Inert every unrelated branch, including the scene, header and floating panels.
  for(let branch:HTMLElement|null=el.parentElement;branch&&branch!==document.body;branch=branch.parentElement){
   for(const sibling of Array.from(branch.parentElement?.children??[])){
    if(sibling!==branch&&sibling instanceof HTMLElement){inerted.push({node:sibling,previous:sibling.inert});sibling.inert=true;}
   }
  }
  const items=()=>Array.from(el.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')).filter(node=>node.getClientRects().length&&!node.closest('[inert]'));
  (items()[0]??el).focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();}
   if(event.key==='Tab'){
    const nodes=items(),first=nodes[0],last=nodes.at(-1);
    if(!first){event.preventDefault();el.focus();}
    else if(event.shiftKey&&(document.activeElement===first||document.activeElement===el)){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  };
  el.addEventListener('keydown',key);
  return()=>{
   el.removeEventListener('keydown',key);
   for(const {node,previous} of inerted)node.inert=previous;
   const visible=(node:HTMLElement|null)=>!!node?.isConnected&&!!node.getClientRects().length&&!node.closest('[hidden],[inert]');
   const fallback=document.querySelector<HTMLElement>('.interface-header button, main button');
   if(visible(opener))opener!.focus();else if(visible(fallback))fallback!.focus();
  };
 },[]);
 return <div className="modal-scrim" onMouseDown={event=>{if(event.target===event.currentTarget)close.current();}}>
  <section ref={ref} tabIndex={-1} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={id}>
   <header className="modal-heading"><h2 id={id}>{title}</h2><Close onClose={onClose}/></header>{children}
  </section>
 </div>;
}
function Close({onClose}:{onClose:()=>void}){const{t}=useTranslation();return <button className="icon-button" onClick={onClose} aria-label={t('ui.close')}><X size={20}/></button>;}
export function NumberValue({value,unit='',digits=1}:{value:number;unit?:string;digits?:number}){const{i18n}=useTranslation();return <span className="number">{new Intl.NumberFormat(i18n.language,{maximumFractionDigits:digits}).format(value)}{unit&&` ${unit}`}</span>;}
