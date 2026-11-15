import { isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SiteHeader, inApp, type SiteNavigation } from '../landing/SiteHeader';
import { SCIENCE_INDEX, isSciencePath, readScienceDoc, scienceUrl } from '../recovery/routes';
import '../landing/home.css';
import './docs.css';

const copy = {
 en: {loading:'Loading document…', missing:'Document not found', missingNote:'This address is not part of the ASTRIX11 documentation.', index:'Documentation index', raw:'View Markdown source', english:''},
 pt: {loading:'Carregando documento…', missing:'Documento não encontrado', missingNote:'Este endereço não faz parte da documentação do ASTRIX11.', index:'Índice da documentação', raw:'Ver fonte Markdown', english:'A documentação técnica está escrita em inglês.'},
};

type Page={doc:string|null;state:'loading'}|{doc:string;state:'ready';text:string}|{doc:string|null;state:'missing'};

const plainText=(node:ReactNode):string=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(plainText).join(''):isValidElement<{children?:ReactNode}>(node)?plainText(node.props.children):'';
/** GitHub-style heading anchors, so `#section` links written for the repository keep working here. */
const slug=(value:string)=>value.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s/g,'-');
const scrollToHash=()=>{const id=decodeURIComponent(location.hash.slice(1));if(id)document.getElementById(id)?.scrollIntoView();};

/** Renders the shipped `docs/*.md` files; the raw files stay available at `<base>docs/`. */
export function DocsPage({base,onNavigate,...navigation}:SiteNavigation&{base:string;onNavigate:(url:string)=>void}) {
 const {i18n}=useTranslation(), c=copy[i18n.resolvedLanguage?.startsWith('pt')?'pt':'en'];
 const [doc,setDoc]=useState(()=>readScienceDoc(location.pathname,base));
 const [page,setPage]=useState<Page>({doc,state:'loading'});
 const screen=useRef<HTMLElement>(null), article=useRef<HTMLElement>(null), navigated=useRef(false);
 useEffect(()=>{
  const route=()=>{if(!isSciencePath(location.pathname,base))return;const next=readScienceDoc(location.pathname,base);setDoc(current=>{if(current===next)scrollToHash();else navigated.current=true;return next;});};
  window.addEventListener('popstate',route);return()=>window.removeEventListener('popstate',route);
 },[base]);
 useEffect(()=>{
  if(!doc){setPage({doc,state:'missing'});return;}
  setPage({doc,state:'loading'});
  const abort=new AbortController();
  fetch(`${base}docs/${doc.split('/').map(encodeURIComponent).join('/')}`,{signal:abort.signal})
   // Dev and SPA hosts answer unknown files with index.html; only real Markdown counts.
   .then(async response=>response.ok&&!response.headers.get('content-type')?.includes('text/html')?setPage({doc,state:'ready',text:await response.text()}):setPage({doc,state:'missing'}))
   .catch(()=>{if(!abort.signal.aborted)setPage({doc,state:'missing'});});
  return()=>abort.abort();
 },[doc,base]);
 useEffect(()=>{
  if(page.state==='loading')return;
  const heading=page.state==='ready'?/^#\s+(.+)$/m.exec(page.text)?.[1]:c.missing;
  document.title=`${heading??page.doc} — ASTRIX11`;
  if(location.hash)scrollToHash();else screen.current?.scrollTo(0,0);
  if(navigated.current){navigated.current=false;article.current?.focus({preventScroll:true});}
 },[page,c.missing]);
 const components=useMemo<Components>(()=>{
  const source=new URL(`${base}docs/${doc??SCIENCE_INDEX}`,location.origin), docsRoot=`${base}docs/`;
  const heading=(Tag:'h1'|'h2'|'h3'|'h4')=>({children}:{children?:ReactNode})=><Tag id={slug(plainText(children))}>{children}</Tag>;
  return {
   h1:heading('h1'),h2:heading('h2'),h3:heading('h3'),h4:heading('h4'),
   a:({href,children})=>{
    if(!href||href.startsWith('#'))return <a href={href}>{children}</a>;
    const target=new URL(href,source);
    if(target.origin!==location.origin)return <a href={target.href} target="_blank" rel="noreferrer">{children}</a>;
    if(target.pathname.startsWith(docsRoot)&&target.pathname.endsWith('.md')){
     const url=`${scienceUrl(decodeURIComponent(target.pathname.slice(docsRoot.length)),base)}${target.hash}`;
     return <a href={url} onClick={inApp(()=>onNavigate(url))}>{children}</a>;
    }
    return <a href={target.href}>{children}</a>;
   },
   img:({src,alt})=><img src={typeof src==='string'?new URL(src,source).href:undefined} alt={alt??''} loading="lazy"/>,
   table:({children})=><div className="docs-table"><table>{children}</table></div>,
  };
 },[doc,base,onNavigate]);
 const raw=page.doc?`${base}docs/${page.doc}`:null;
 return <main className="home-screen docs-screen" ref={screen}>
  <SiteHeader base={base} current="science" {...navigation}/>
  <article className="docs-article" ref={article} tabIndex={-1} aria-busy={page.state==='loading'}>
   {page.state==='loading'&&<p className="docs-status">{c.loading}</p>}
   {page.state==='missing'&&<><h1>{c.missing}</h1><p>{c.missingNote}</p></>}
   {page.state==='ready'&&<>{c.english&&<p className="docs-status" lang={i18n.resolvedLanguage}>{c.english}</p>}<Markdown remarkPlugins={[remarkGfm]} components={components}>{page.text}</Markdown></>}
  </article>
  <footer className="docs-footer">
   {page.doc!==SCIENCE_INDEX&&<a href={scienceUrl(undefined,base)} onClick={inApp(navigation.onScience)}>{c.index}</a>}
   {page.state==='ready'&&raw&&<a href={raw}>{c.raw}</a>}
  </footer>
 </main>;
}
