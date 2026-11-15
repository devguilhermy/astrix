import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { defaultQuickDesign, missionById, missionOffers, quickDesignBrief, turnDecision, type BodyId, type OrbitChoice, type QuickDesignConfig, type TurnGameState } from '@astrix/core';
import { BookOpen, CircleHelp, Compass, Menu, PanelLeftClose, PanelLeftOpen, Radio, Rocket, Settings, Wrench } from 'lucide-react';
import { useRoomSession } from '../../multiplayer/session';
import { roomClient } from '../../multiplayer/client';
import { AdvancedTools } from '../advanced/AdvancedTools';
import { Preparation, MissionBoard } from './Preparation';
import { TurnWorkspace } from './TurnWorkspace';
import { ScienceLibrary, Duration } from './Evidence';
import { useTurnAuthority } from './authority';
import { exportGame, exportText, parseSave, readSave, recordAttempt, writeSave, type AttemptRecord, type SavedGame, type SaveIssue } from './persistence';
import { usePlayCopy } from './copy';
import { labelText } from '../missions/definitionView';
import { readPlayView, type PlayView } from '../recovery/routes';
import { Journal } from './Journal';
import { SolarWelcome } from './SolarWelcome';
import { MissionResources } from './MissionResources';
import { ReplaceSaveDialog } from './ReplaceSaveDialog';
import { QuickTour } from './QuickTour';
import './play.css';

const AppCanvas=lazy(()=>import('../../three/AppCanvas').then(module=>({default:module.AppCanvas})));

type View=PlayView;
type Replacement={kind:'start';config:QuickDesignConfig}|{kind:'import';document:NonNullable<SavedGame['document']>};
interface Preferences {hints:boolean;reducedMotion:boolean}
function readPreferences():Preferences {
  try{const saved=JSON.parse(localStorage.getItem('astrix.settings')??'{}');return {hints:saved.hints!==false,reducedMotion:typeof saved.reducedMotion==='boolean'?saved.reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};}
  catch{return {hints:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};}
}
export function PlayApp({remote=false,guest=false,onLobby,onLanding,onLearn,basePath='/'}:{remote?:boolean;guest?:boolean;onLobby?:()=>void;onLanding?:()=>void;onLearn?:()=>void;basePath?:string}) {
  const c=usePlayCopy(),{t,i18n}=useTranslation(),authority=useTurnAuthority(remote),room=useRoomSession(),game=authority.game;
  const [view,setView]=useState<View>(()=>remote?'explore':readPlayView(location.hash)),[destination,setDestination]=useState<BodyId>('EARTH'),[config,setConfig]=useState<QuickDesignConfig>(()=>defaultQuickDesign()),[preferences,setPreferences]=useState(readPreferences);
  const [saved,setSaved]=useState<SavedGame|null>(null),[journal,setJournal]=useState<readonly AttemptRecord[]>([]),[saveIssue,setSaveIssue]=useState<SaveIssue|null>(null),[allowReplace,setAllowReplace]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[importError,setImportError]=useState('');
  const [panelsOpen,setPanelsOpen]=useState(true);
  const [replacement,setReplacement]=useState<Replacement|null>(null);
  const replacementRef=useRef<Replacement|null>(null);
  const candidate=useMemo(()=>{if(view!=='prepare')return null;try{return quickDesignBrief(config).design;}catch{return null;}},[config,view]);
  const journalRef=useRef(journal),lastBoundary=useRef<TurnGameState|null>(null),previousGame=useRef<TurnGameState|null>(null),operation=useRef(false),heading=useRef<HTMLElement>(null),lastGame=useRef(game);journalRef.current=journal;
  const navigate=useCallback((next:View)=>{setView(next);setError('');if(!remote)history.pushState(null,'',`${basePath}#${next}`);},[remote,basePath]);
  useEffect(()=>{document.documentElement.lang=i18n.resolvedLanguage??'en';},[i18n.resolvedLanguage]);
  useEffect(()=>{document.documentElement.dataset.reducedMotion=String(preferences.reducedMotion);},[preferences.reducedMotion]);
  useEffect(()=>{replacementRef.current=null;setReplacement(null);document.querySelector<HTMLDetailsElement>('.play-menu')?.removeAttribute('open');},[view]);
  useEffect(()=>{if((onLanding||onLearn)&&(!location.hash||location.hash==='#home'||location.hash==='#learn'))return;setPanelsOpen(true);document.title=`${c(view==='solar'?'solarTitle':view==='explore'?'home':view==='prepare'?'designPlay':view === 'play' ? 'titlePlay' : view==='gmat'?'tools':view==='journal'?'journal':'help')} — ASTRIX11`;const frame=requestAnimationFrame(()=>heading.current?.focus());return()=>cancelAnimationFrame(frame);},[view,i18n.resolvedLanguage]);
  useEffect(()=>{if(remote)return;const timer=window.setTimeout(()=>{const next=readSave();setSaved(next);setJournal(next.document?.journal??[]);previousGame.current=next.document?.game??null;},0);return()=>clearTimeout(timer);},[remote]);
  useEffect(()=>{if(remote)return;const route=()=>setView(readPlayView(location.hash));window.addEventListener('hashchange',route);window.addEventListener('popstate',route);return()=>{window.removeEventListener('hashchange',route);window.removeEventListener('popstate',route);};},[remote]);
  useEffect(()=>{
    if(!game||lastBoundary.current===game)return;
    lastBoundary.current=game;
    const next=turnDecision(game).terminal?recordAttempt(journalRef.current,game):journalRef.current;
    if(next!==journalRef.current){journalRef.current=next;setJournal(next);}
    if(remote)return;
    const problem=writeSave(game,next);setSaveIssue(problem);
    if(!problem)setSaved({document:{format:'astrix-turn-save',version:1,game,journal:next},issue:null,backup:previousGame.current?{format:'astrix-turn-save',version:1,game:previousGame.current,journal:next}:null,legacy:saved?.legacy??{}});
    previousGame.current=game;
  },[game,remote]);
  useEffect(()=>{
    if(!remote)return;
    if(game&&game!==lastGame.current){if(!lastGame.current||game.revision===0||view==='explore')setView('play');lastGame.current=game;}
  },[game,remote,view]);
  useEffect(()=>{if(error||saveIssue||authority.unknown||authority.result&&!authority.result.ok||game?.receipts.at(-1)?.interrupted)setPanelsOpen(true);},[error,saveIssue,authority.unknown,authority.result,game?.revision]);
  const setPreference=(key:keyof Preferences,value:boolean)=>{const next={...preferences,[key]:value};setPreferences(next);try{const prior=JSON.parse(localStorage.getItem('astrix.settings')??'{}');delete prior.context;localStorage.setItem('astrix.settings',JSON.stringify({...prior,...next}));}catch{/* Preferences do not affect authority or boundary saves. */}};
  const archive=()=>{if(!game)return;const next=recordAttempt(journalRef.current,game);journalRef.current=next;setJournal(next);};
  const act=(action:()=>void)=>{
    if(operation.current||authority.pending||!authority.connected)return;
    operation.current=true;setBusy(true);setError('');
    window.setTimeout(()=>{try{action();}catch(cause){setError(cause instanceof Error?cause.message:String(cause));}finally{operation.current=false;setBusy(false);}},0);
  };
  const canStart=authority.host&&(remote||!!saved)&&!(!remote&&saved?.issue&&saved.issue.code!=='STORAGE'&&!allowReplace);
  const requestReplacement=(next:Replacement)=>{if(operation.current||authority.pending)return;replacementRef.current=next;setReplacement(next);};
  const cancelReplacement=()=>{replacementRef.current=null;setReplacement(null);};
  const executeStart=(intended:QuickDesignConfig)=>{
    if(!canStart)return;
    act(()=>{const result=authority.dispatch({kind:'START_GAME',config:intended});if(result&&!result.ok){setError(result.refusal.code);return;}if(result?.ok)archive();navigate('play');});
  };
  const start=()=>{
    if(!canStart)return;
    if(!remote&&(game||saved?.document)){requestReplacement({kind:'start',config});return;}
    executeStart(config);
  };
  const restore=(document:NonNullable<SavedGame['document']>)=>act(()=>{
    const result=authority.dispatch({kind:'LOCAL_RESTORE_GAME',game:document.game});
    if(result&&!result.ok){setError(result.refusal.code);return;}
    journalRef.current=document.journal;setJournal(document.journal);setConfig(document.game.config);setAllowReplace(true);navigate('play');
  });
  const confirmReplacement=()=>{
    const pending=replacementRef.current;if(!pending)return;
    replacementRef.current=null;setReplacement(null);
    if(pending.kind==='start')executeStart(pending.config);else restore(pending.document);
  };
  const retry=(checkpoint=false)=>{
    if(!game)return;
    act(()=>{const result=authority.dispatch(checkpoint?{kind:'RETRY_GAME',checkpointRevision:Math.max(0,game.revision-1)}:{kind:'RETRY_GAME'});if(result&&!result.ok)setError(result.refusal.code);else{if(result?.ok)archive();navigate('play');}});
  };
  const commit=(planId:string)=>{
    if(!game)return;
    const decision=turnDecision(game);
    act(()=>{const result=authority.dispatch({kind:authority.host?'COMMIT_TURN':'PROPOSE_TURN',decisionId:decision.id,turnRevision:decision.revision,planId});if(result&&!result.ok)setError(result.refusal.code);});
  };
  const importFile=async(file:File)=>{
    setImportError('');
    try{if(file.size>4*1024*1024)throw new Error('4 MiB');const document=parseSave(await file.text());if(game||saved?.document){requestReplacement({kind:'import',document});return;}restore(document);}catch(cause){setImportError(cause instanceof Error?cause.message:String(cause));}
  };
  const importedOrbit=(orbit:OrbitChoice)=>{
    const offers=missionOffers(orbit.body,config.levelId),offer=offers.find(item=>item.config.missionId==='FIRST_SIGNAL')??offers.find(item=>item.config.missionId==='RED_RELAY')??offers[0];
    if(!offer){setError(c('INCOMPATIBLE'));return;}
    setConfig({...offer.config,initialOrbit:orbit});setDestination(orbit.body);navigate('prepare');
  };
  const offers=missionOffers(destination,config.levelId),working=busy||authority.pending;
  const showResources=view==='play'&&!!game;
  const errorCode=error??'';
  const focusContent=()=>{setPanelsOpen(true);requestAnimationFrame(()=>heading.current?.focus());};
  return <div className="play-app" data-resources={showResources}><a className="play-skip" href="#play-main" onClick={event=>{event.preventDefault();focusContent();}}>{t('ui.skipToContent',{defaultValue:i18n.resolvedLanguage?.startsWith('pt')?'Ir ao conteúdo':'Skip to content'})}</a><header className="play-header"><button className="play-brand" onClick={()=>onLanding?onLanding():navigate('explore')} aria-label={`ASTRIX11 · ${c(onLanding?'landing':'home')}`}><img src={`${import.meta.env?.BASE_URL??'./'}assets/logo.png`} alt="ASTRIX11"/></button><nav className="play-top-nav" aria-label={c('menu')}><button className={view==='solar'?'active':''} onClick={()=>navigate('solar')}><Compass size={17} aria-hidden="true"/>{c('explore')}</button>{game&&<button className={view==='play'?'active':''} onClick={()=>navigate('play')}><Rocket size={17} aria-hidden="true"/>{c('returnToMission')}</button>}<button className={view==='journal'?'active':''} onClick={()=>navigate('journal')}><BookOpen size={17} aria-hidden="true"/>{c('journal')}</button></nav><div className="play-header-actions"><button className="language-button" onClick={()=>void i18n.changeLanguage(i18n.resolvedLanguage?.startsWith('pt')?'en':'pt-BR')}>{i18n.resolvedLanguage?.startsWith('pt')?'English':'Português'}</button><details className="play-menu"><summary aria-label={c('menu')}><Menu size={22}/></summary><div><button className="mission-menu-link" onClick={()=>navigate('solar')}><Compass size={17} aria-hidden="true"/>{c('explore')}</button><button className="mission-menu-link" onClick={()=>navigate('journal')}><BookOpen size={17} aria-hidden="true"/>{c('journal')}</button><button onClick={()=>navigate('gmat')}><Wrench size={17} aria-hidden="true"/>{c('tools')}</button><button onClick={()=>navigate('help')}><CircleHelp size={17} aria-hidden="true"/>{c('help')}</button>{onLearn&&<button onClick={onLearn}><BookOpen size={17} aria-hidden="true"/>{c('designEssentials')}</button>}{onLobby&&<button onClick={onLobby}><Radio size={17} aria-hidden="true"/>{c(guest?'pairAgain':'lobby')}</button>}<a href={`${(import.meta.env?.BASE_URL??'./')}docs/INDEX.md`}>{c('science')}</a></div></details></div></header>
    <Suspense fallback={<div className="immersive-scene" aria-busy="true"/>}><AppCanvas design={candidate} game={game} body={candidate?.orbit?.body??destination} view={view} reducedMotion={preferences.reducedMotion} onSelectDestination={body=>{setDestination(body);navigate('explore');}}/></Suspense>
    {showResources&&game&&<MissionResources game={game}/>}
    <QuickTour view={view==='play'&&(!game||turnDecision(game).terminal)?'none':view} enabled={preferences.hints&&!guest&&!replacement} onReveal={()=>setPanelsOpen(true)}/>
    <div className={`play-overlays play-view-${view}`}>
    <div className="play-overlay-toolbar"><button className="panel-visibility" aria-expanded={panelsOpen} aria-controls="play-main" onClick={()=>setPanelsOpen(open=>!open)}>{panelsOpen?<PanelLeftClose size={18}/>:<PanelLeftOpen size={18}/>}<span>{c(panelsOpen?'hidePanels':'showPanels')}</span></button></div>
    <main id="play-main" ref={heading} tabIndex={-1} hidden={!panelsOpen&&!(view==='play'&&game)} data-panels-open={panelsOpen} className={`play-main ${view==='prepare'||view==='play'&&game?'contextual-main':'document-panel'}`}>
      <div className="play-system-notices">
      {remote&&<section className="play-network" aria-live="polite"><Radio size={16}/><p>{authority.connected?c(guest?'phoneNote':'hostCommit'):c('offline')}</p>{!authority.connected&&<button className="button" onClick={()=>roomClient().retryNow()}>{c('reconnect')}</button>}</section>}
      {(errorCode||authority.result&&!authority.result.ok)&&<div className="play-notice danger" role="alert"><p>{c('technicalError')}</p><small>{errorCode||(!authority.result?.ok&&authority.result?.refusal.code)}</small></div>}
      {authority.unknown&&<p role="status" className="play-notice warning">{t('lan.unknown')}</p>}
      {!remote&&saved?.issue&&<section className="play-notice warning" aria-labelledby="save-problem"><h2 id="save-problem">{c(saved.issue.code==='STORAGE'?'unavailable':'saveProblem')}</h2><p>{c('saveProblemNote')}</p><details><summary>{c('details')}</summary><p>{saved.issue.detail}</p></details><div className="button-wrap">{saved.issue.raw&&<button className="button" onClick={()=>exportText('astrix-unreadable-save.json',saved.issue!.raw!)}>{c('exportStored')}</button>}{saved.backup&&<button className="button" onClick={()=>restore(saved.backup!)}>{c('restorePrevious')}</button>}{saved.issue.code!=='STORAGE'&&!allowReplace&&<button className="button" onClick={()=>setAllowReplace(true)}>{c('confirmNew')}</button>}</div></section>}
      {!remote&&saved&&Object.keys(saved.legacy).length>0&&view==='explore'&&<section className="legacy-work"><p>{c('legacy')}</p><button className="text-button" onClick={()=>exportText('astrix-legacy-work.json',JSON.stringify(saved.legacy,null,2))}>{c('exportLegacy')}</button></section>}
      {!remote&&saveIssue&&<section className="play-notice danger" role="alert"><p>{c('saveError')}</p><div className="button-wrap"><button className="button" onClick={()=>{if(game)setSaveIssue(writeSave(game,journalRef.current));}}>{c('saveAgain')}</button>{game&&<button className="button" onClick={()=>exportGame(game,journalRef.current)}>{c('export')}</button>}</div></section>}
      </div>
      {view==='solar'&&<SolarWelcome onMissions={()=>navigate('explore')}/>}
      {view==='explore'&&<>{guest?<><h1>{c('mission')}</h1><p>{game?c('phoneNote'):c('pending')}</p>{game&&<button className="button primary" onClick={()=>navigate('play')}>{c('returnToMission')}</button>}</>:<><div className="board-filters"><fieldset><legend>{c('destination')}</legend><div className="destination-tabs">{(['EARTH','MOON','MARS'] as const).map(body=><button key={body} aria-pressed={destination===body} onClick={()=>setDestination(body)}>{c(body)}</button>)}</div></fieldset><label>{c('level')}<select value={config.levelId} onChange={event=>setConfig({...config,levelId:event.target.value as QuickDesignConfig['levelId']})}><option value="ASPIRING">{c('ASPIRING')}</option><option value="EXPERT">{c('EXPERT')}</option></select></label></div><p className="level-note">{c(config.levelId==='ASPIRING'?'aspiringNote':'expertNote')}</p><MissionBoard offers={offers} onChoose={offer=>{setConfig(offer.config);navigate('prepare');}} onDesign={()=>{setConfig(offers[0]?.config??defaultQuickDesign('FIRST_SIGNAL',config.levelId));navigate('prepare');}}/>
        {!remote&&saved?.document&&!game&&<section className="resume-attempt"><button className="button" onClick={()=>restore(saved.document!)}>{c('resume')}</button><p>{labelText(t,missionById(saved.document.game.config.missionId).name)} · <Duration seconds={saved.document.game.sim.t}/></p></section>}
      </>}</>}
      {view==='prepare'&&!guest&&<Preparation config={config} onChange={setConfig} onPlay={start} disabled={!authority.connected||!remote&&(!saved||!!saved.issue&&saved.issue.code!=='STORAGE'&&!allowReplace)} busy={working}/>}
      {view==='play'&&game&&<TurnWorkspace game={game} onCommit={commit} onInspectPlan={()=>setPanelsOpen(true)} onCheckpoint={()=>retry(true)} onRetry={()=>retry()} onRedesign={()=>{archive();setConfig(game.config);navigate('prepare');}} onTools={()=>navigate('gmat')} busy={working} disabled={!authority.connected} host={authority.host} proposals={authority.state?.turnProposals} roster={authority.state?.roster} journal={journal} hints={preferences.hints}/>}
      {view==='play'&&!game&&<section className="empty-state"><h1>{c('thinking')}</h1><p>{remote?c('pending'):c('intro')}</p><button className="button" onClick={()=>navigate('explore')}>{c('home')}</button></section>}
      {view === 'journal' && <Journal attempts={journal}/>}
      {view==='gmat'&&<AdvancedTools initialOrbit={game?.design.orbit??config.initialOrbit} onPrepare={authority.host?importedOrbit:undefined}/>}
      {view==='help'&&<section className="play-help"><h1>{c('help')}</h1><p>{c('helpText')}</p>{onLearn&&<button className="button" onClick={onLearn}><BookOpen size={18} aria-hidden="true"/>{c('designEssentials')}</button>}<h2 className="icon-heading"><Settings size={18} aria-hidden="true"/>{t('ui.settings',{defaultValue:i18n.resolvedLanguage?.startsWith('pt')?'Preferências':'Preferences'})}</h2><label><input type="checkbox" checked={preferences.hints} onChange={event=>setPreference('hints',event.target.checked)}/>{c('hints')}</label><label><input type="checkbox" checked={preferences.reducedMotion} onChange={event=>setPreference('reducedMotion',event.target.checked)}/>{c('reducedMotion')}</label><ScienceLibrary/></section>}
      {(view==='missing'||view==='prepare'&&guest)&&<section className="empty-state"><h1>{c('notFound')}</h1><button className="button" onClick={()=>navigate('explore')}>{c('home')}</button></section>}
    <footer className="play-footer"><details open={importError?true:undefined}><summary><span>{remote?c('lanSave'):game&&!saveIssue?c('saved'):c('sourceNote')}</span></summary><div className="button-wrap">{!remote&&game&&<button className="text-button" onClick={()=>exportGame(game,journalRef.current)}>{c('export')}</button>}{!remote&&<label className="import-save-label">{c('importSave')}<input type="file" accept=".json,application/json" onChange={event=>{const file=event.target.files?.[0];if(file)void importFile(file);event.target.value='';}}/></label>}<button className="text-button" onClick={()=>navigate('gmat')}>{c('tools')}</button></div>{importError&&<p role="alert">{c('importFailure')} <small>{importError}</small></p>}</details></footer>
    </main>
    </div>
    {replacement&&<ReplaceSaveDialog busy={working} onCancel={cancelReplacement} onConfirm={confirmReplacement}/>}
  </div>;
}
