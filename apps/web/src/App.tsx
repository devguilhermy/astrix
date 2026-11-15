import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { liveMission, useMission, type LiveMission, type MissionStore } from './store';
import { Home } from './ui/screens/Home';
import { Wizard, emptyDraft, readDraft, saveDraft, type SetupDraft } from './ui/screens/Wizard';
import { useShellCopy } from './ui/screens/copy';
import { Modal } from './ui/primitives';
import { ScienceDrawer } from './ui/science/ScienceDrawer';
import { NotFound } from './ui/recovery/NotFound';
import { isKnownLocation, useRouteStatus } from './ui/recovery/routes';
import './shell.css';
const Simulator=lazy(()=>import('./ui/screens/Simulator').then(module=>({default:module.Simulator})));
type Screen='HOME'|'WIZARD'|'PREPARING'|'SIMULATOR'|'FAILED';
type PreparationStage='CANDIDATE'|'COMMITTED';
interface EntryAttempt {token:number;draft:SetupDraft;stage:PreparationStage;previous:{store:MissionStore;live:LiveMission}|null}
class EntryBoundary extends Component<{children:ReactNode;onFailure:(error:unknown)=>void},{error:unknown}>{state:{error:unknown}={error:null};static getDerivedStateFromError(error:unknown){return {error};}componentDidCatch(error:unknown){this.props.onFailure(error);}render(){return this.state.error?null:this.props.children;}}
export function App({basePath='/'}:{basePath?:string}){
 const c=useShellCopy(),{t,i18n}=useTranslation(),settings=useMission(s=>s.settings),design=useMission(s=>s.design);
 const {notFound,showHome}=useRouteStatus(basePath);
 const [screen,setScreen]=useState<Screen>(()=>!notFound&&location.hash.startsWith('#setup/')?'WIZARD':'HOME'),[mounted,setMounted]=useState(false),[moduleReady,setModuleReady]=useState(false),[error,setError]=useState<unknown>(null),[draft,setDraft]=useState<SetupDraft>(()=>readDraft('astrix.setup.draft.v1')??emptyDraft),[hasDraft,setHasDraft]=useState(()=>!!readDraft('astrix.setup.draft.v1')),[hasLast,setHasLast]=useState(()=>!!readDraft('astrix.setup.last.v1'));
 const token=useRef(0),pending=useRef<EntryAttempt|null>(null),screenRef=useRef(screen),[readyCallback,setReadyCallback]=useState<()=>void>(()=>()=>{});screenRef.current=screen;
 useEffect(()=>{document.documentElement.lang=i18n.resolvedLanguage??'en';},[i18n.resolvedLanguage]);useEffect(()=>{document.documentElement.dataset.reducedMotion=String(settings.reducedMotion);},[settings.reducedMotion]);
 const updateDraft=(next:SetupDraft)=>{setDraft(next);saveDraft('astrix.setup.draft.v1',next);setHasDraft(true);};
 const rollback=useCallback((attempt:EntryAttempt|null)=>{if(!attempt?.previous)return;Object.assign(liveMission,attempt.previous.live);useMission.setState({...attempt.previous.store,sim:attempt.previous.live.state,telemetry:attempt.previous.live.telemetry,running:false,advancing:false},true);},[]);
 const failure=useCallback((cause:unknown)=>{const attempt=pending.current;token.current++;pending.current=null;rollback(attempt);useMission.getState().cancelPreview();useMission.getState().pause('graphics');setError(cause);if(attempt||screenRef.current==='SIMULATOR')setScreen('FAILED');},[rollback]);
 const complete=useCallback((id:number,stage:PreparationStage):void=>{const attempt=pending.current;if(!attempt||attempt.token!==id||id!==token.current||attempt.stage!==stage)return;if(stage==='CANDIDATE'){attempt.previous={store:useMission.getState(),live:{...liveMission}};try{const d=attempt.draft;useMission.getState().startScenario(d.mission!,d.level!);useMission.getState().setTeam(d.players);for(const [role,player] of Object.entries(d.assignments))useMission.getState().assignRole(role as keyof SetupDraft['assignments'],player);attempt.stage='COMMITTED';setReadyCallback(()=>()=>complete(id,'COMMITTED'));}catch(cause){failure(cause);}return;}saveDraft('astrix.setup.last.v1',attempt.draft);setHasLast(true);pending.current=null;setScreen('SIMULATOR');},[failure]);
 const prepare=()=>{if(!draft.level||!draft.mission)return;if(design&&!window.confirm(t('flow.confirmReplace')))return;if(error){setScreen('FAILED');return;}const id=++token.current;pending.current={token:id,draft,stage:'CANDIDATE',previous:null};useMission.getState().previewScenario(draft.mission,draft.level);setScreen('PREPARING');setMounted(true);setReadyCallback(()=>()=>complete(id,'CANDIDATE'));};
 const cancel=()=>{const attempt=pending.current;token.current++;pending.current=null;rollback(attempt);useMission.getState().cancelPreview();setScreen('WIZARD');};
 const home=useCallback(()=>{useMission.getState().pause('home');showHome();setScreen('HOME');requestAnimationFrame(()=>document.getElementById('home-heading')?.focus());},[showHome]);
 const setup=useCallback(()=>{useMission.getState().pause('home');history.pushState(null,'',`${basePath}#setup/mission`);setScreen('WIZARD');},[basePath]);
 const returnMission=()=>{if(error){setScreen('FAILED');return;}useMission.getState().clearPauseReason('home');useMission.getState().cancelPreview();setScreen('SIMULATOR');};
 useEffect(()=>{
  const navigate=()=>{
   // Browser navigation is explicit cancellation, not permission to commit behind another screen.
   const attempt=pending.current;
   if(attempt){token.current++;pending.current=null;rollback(attempt);useMission.getState().cancelPreview();useMission.getState().pause('home');setScreen('HOME');}
   if(!isKnownLocation(location.pathname,location.hash,basePath))return;
   const hash=location.hash;
   if(hash.startsWith('#setup')){
    useMission.getState().pause('home');setScreen('WIZARD');
   }else if(hash.startsWith('#mission/')){
    const state=useMission.getState();
    if(!state.design){home();return;}
    state.setStage(hash.slice('#mission/'.length).toUpperCase() as MissionStore['activeStage']);
    history.replaceState(null,'',`${basePath}#mission/${useMission.getState().activeStage.toLowerCase()}`);
    state.clearPauseReason('home');state.cancelPreview();setScreen(error?'FAILED':'SIMULATOR');
   }else home();
  };
  window.addEventListener('hashchange',navigate);window.addEventListener('popstate',navigate);
  return()=>{window.removeEventListener('hashchange',navigate);window.removeEventListener('popstate',navigate);};
 },[basePath,home,rollback,error]);
 return <><div className="app-route-hidden" hidden={notFound} inert={notFound}>{mounted&&<div className="simulator-persistent" hidden={notFound||screen==='HOME'||screen==='WIZARD'}><EntryBoundary onFailure={failure}><Suspense fallback={null}><Simulator active={!notFound&&screen==='SIMULATOR'} onReady={readyCallback} onFailure={failure} onHome={home} onChoose={setup} onModuleReady={()=>setModuleReady(true)}/></Suspense></EntryBoundary></div>}
 {screen==='HOME'&&<Home onSetup={()=>{updateDraft(emptyDraft);setup();}} onContinue={setup} onLast={()=>{const last=readDraft('astrix.setup.last.v1');if(last)updateDraft(last);setup();}} onReturn={returnMission} hasDraft={hasDraft} hasLast={hasLast}/>}
 {screen==='WIZARD'&&<Wizard draft={draft} onChange={updateDraft} onStart={prepare} onHome={home}/>}
 {screen==='PREPARING'&&<Modal title={c('preparing')} onClose={cancel} className="preparation-modal"><section aria-busy="true"><p role="status" aria-live="polite">{c(moduleReady?'scene':'module')}</p><progress aria-label={c('preparing')}/><button className="button" onClick={cancel}>{c('cancel')}</button></section></Modal>}
 {screen==='FAILED'&&<Modal title={c('failed')} onClose={home}><p>{c(design?'failureNote':'failureNoPrior')}</p><pre>{error instanceof Error?error.message:String(error??'WebGL')}</pre><button className="button" onClick={home}>{c('home')}</button></Modal>}<ScienceDrawer/></div>{notFound&&<NotFound onHome={home}/>}</>;
}
