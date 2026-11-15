import type { MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Compass, FileText, GraduationCap, Wrench } from 'lucide-react';
import { usePlayCopy } from '../play/copy';
import { scienceUrl } from '../recovery/routes';
import '../header/header.css';

/** Plain left clicks route in-app; modified clicks keep the real href (new tab, copy link). */
export const inApp=(action:()=>void)=>(event:MouseEvent<HTMLAnchorElement>)=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();action();};

export interface SiteNavigation {onHome:()=>void;onOpen:(view:'solar'|'journal')=>void;onGmat:()=>void;onScience:()=>void;onQuiz:()=>void}

/** Public pages share the simulator's header bar (`header.css`); the tabs link into the simulator and the reference pages. */
export function SiteHeader({base,current,onHome,onOpen,onGmat,onScience,onQuiz,children}:SiteNavigation&{base:string;current?:'science'|'quiz';children?:ReactNode}) {
 const {i18n}=useTranslation(), p=usePlayCopy(), pt=i18n.resolvedLanguage?.startsWith('pt');
 return <header className="site-header">
  <a className="site-brand" href={`${base}#home`} onClick={inApp(onHome)} aria-label={`ASTRIX11 · ${p('landing')}`}><img src={`${base}assets/logo.png`} width="512" height="426" alt="ASTRIX11"/></a>
  <nav className="site-nav" aria-label={p('menu')}>
   <a href={`${base}#solar`} onClick={inApp(()=>onOpen('solar'))}><Compass size={17} aria-hidden="true"/>{p('explore')}</a>
   <a href={`${base}#journal`} onClick={inApp(()=>onOpen('journal'))}><BookOpen size={17} aria-hidden="true"/>{p('journal')}</a>
   <a href={`${base}gmat`} onClick={inApp(onGmat)}><Wrench size={17} aria-hidden="true"/>{p('tools')}</a>
   <a href={scienceUrl(undefined,base)} onClick={inApp(onScience)} aria-current={current==='science'?'page':undefined}><FileText size={17} aria-hidden="true"/>{p('science')}</a>
   <a href={`${base}quiz`} onClick={inApp(onQuiz)} aria-current={current==='quiz'?'page':undefined}><GraduationCap size={17} aria-hidden="true"/>Quiz</a>
  </nav>
  <div className="site-header-actions">{children}<button className="language-button" onClick={()=>void i18n.changeLanguage(pt?'en':'pt-BR')}>{pt?'English':'Português'}</button></div>
 </header>;
}
