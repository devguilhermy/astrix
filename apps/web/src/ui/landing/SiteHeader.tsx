import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Compass, FileText, GraduationCap, Wrench } from 'lucide-react';
import { usePlayCopy } from '../play/copy';
import { scienceUrl } from '../recovery/routes';

/** Plain left clicks route in-app; modified clicks keep the real href (new tab, copy link). */
export const inApp=(action:()=>void)=>(event:MouseEvent<HTMLAnchorElement>)=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();action();};

export interface SiteNavigation {onHome:()=>void;onOpen:(view:'solar'|'journal')=>void;onGmat:()=>void;onScience:()=>void;onQuiz:()=>void}

/** Public pages (landing, rendered docs) share one header whose nav mirrors the simulator tabs. */
export function SiteHeader({base,current,onHome,onOpen,onGmat,onScience,onQuiz}:SiteNavigation&{base:string;current?:'science'|'quiz'}) {
 const {i18n}=useTranslation(), p=usePlayCopy(), pt=i18n.resolvedLanguage?.startsWith('pt');
 return <header className="home-top">
  <a className="home-brand-link" href={`${base}#home`} onClick={inApp(onHome)} aria-label={`ASTRIX11 · ${p('landing')}`}><img className="home-brand" src={`${base}assets/logo.png`} width="512" height="426" alt="ASTRIX11"/></a>
  <nav className="home-nav" aria-label={p('menu')}>
   <a href={`${base}#solar`} onClick={inApp(()=>onOpen('solar'))}><Compass size={17} aria-hidden="true"/>{p('explore')}</a>
   <a href={`${base}#journal`} onClick={inApp(()=>onOpen('journal'))}><BookOpen size={17} aria-hidden="true"/>{p('journal')}</a>
   <a href={`${base}gmat`} onClick={inApp(onGmat)}><Wrench size={17} aria-hidden="true"/>{p('tools')}</a>
   <a href={scienceUrl(undefined,base)} onClick={inApp(onScience)} aria-current={current==='science'?'page':undefined}><FileText size={17} aria-hidden="true"/>{p('science')}</a>
   <a href={`${base}quiz`} onClick={inApp(onQuiz)} aria-current={current==='quiz'?'page':undefined}><GraduationCap size={17} aria-hidden="true"/>Quiz</a>
  </nav>
  <label>{pt?'Idioma':'Language'}<select value={pt?'pt-BR':'en'} onChange={event=>void i18n.changeLanguage(event.target.value)}><option value="en">English</option><option value="pt-BR">Português</option></select></label>
 </header>;
}
