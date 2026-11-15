import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { defaultQuickDesign, listParts, missionOffers, quickDesignBrief, quickKitOptions, type MissionOffer, type QuickDesignConfig, type QuickDesignBrief, type ReadinessCertificate } from '@astrix/core';
import { labelText } from '../missions/definitionView';
import { Duration, Evidence } from './Evidence';
import { usePlayCopy } from './copy';

export function Preparation({config,onChange,onPlay,disabled=false,busy=false}:{config:QuickDesignConfig;onChange:(config:QuickDesignConfig)=>void;onPlay:()=>void;disabled?:boolean;busy?:boolean}) {
  const c=usePlayCopy(),{t,i18n}=useTranslation(),number=new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:2});
  const offers=missionOffers(undefined,config.levelId),offer=offers.find(item=>item.missionId===config.missionId);
  const computed=useMemo(()=>{try{return {brief:quickDesignBrief(config),error:null};}catch(error){return {brief:null,error:error instanceof Error?error.message:String(error)};}},[config]);
  const kits=useMemo(()=>quickKitOptions(config),[config]);
  const [certificate,setCertificate]=useState<ReadinessCertificate|null>(null),[checkError,setCheckError]=useState<string|null>(null),[checking,setChecking]=useState(true),[check,setCheck]=useState(0);
  const [panel,setPanel]=useState<'choices'|'preview'>('choices');
  const generation=useRef(0);
  useEffect(()=>{
    const current=++generation.current;setCertificate(null);setCheckError(null);setChecking(true);
    if(!computed.brief){setChecking(false);return;}
    let worker:Worker|null=null;
    const timer=window.setTimeout(()=>{
      if(current!==generation.current)return;
      worker?.terminate();setChecking(false);setCheckError(c('unfinished'));
    },60000);
    const delay=window.setTimeout(()=>{
      try {
        worker=new Worker(new URL('./game.worker.ts',import.meta.url),{type:'module'});
        worker.onmessage=(event:MessageEvent<{id:number;result?:ReadinessCertificate;error?:string}>)=>{
          if(current!==generation.current||event.data.id!==current)return;
          clearTimeout(timer);worker?.terminate();setChecking(false);
          if(event.data.result&&event.data.result.identity===computed.brief?.identity)setCertificate(event.data.result);
          else setCheckError(event.data.error??c('checkError'));
        };
        worker.onerror=()=>{if(current!==generation.current)return;clearTimeout(timer);worker?.terminate();setChecking(false);setCheckError(c('checkError'));};
        worker.postMessage({kind:'certify',id:current,config});
      }catch(error){clearTimeout(timer);setChecking(false);setCheckError(error instanceof Error?error.message:String(error));}
    },100);
    return()=>{generation.current++;clearTimeout(timer);clearTimeout(delay);worker?.terminate();};
  },[config,computed.brief,check]);
  const brief=computed.brief,status=checking?'CHECKING':certificate?.status??(brief?.compatible?'NO_VIABLE_PLAN':'INCOMPATIBLE');
  const ready=!!certificate&&certificate.identity===brief?.identity&&['READY','STRETCHED'].includes(certificate.status)&&!checking;
  const chooseGoal=(missionId:string)=>onChange({...defaultQuickDesign(missionId as QuickDesignConfig['missionId'],config.levelId),ambition:config.ambition,kit:config.kit,approach:config.approach});
  return <section className={`preparation contextual-workspace active-${panel}`} aria-label={c('designPlay')}>
    <div className="context-panel-switch" aria-label={c('missionPanels')}><button aria-pressed={panel==='choices'} aria-controls="preparation-choices-panel" onClick={()=>setPanel('choices')}>{c('designPlay')}</button><button aria-pressed={panel==='preview'} aria-controls="preparation-brief-panel" onClick={()=>setPanel('preview')}>{c('constraints')}</button></div>
    <div id="preparation-choices-panel" className="context-panel choices-panel"><div className="panel-scroll preparation-choices"><header className="play-page-heading"><h1>{c('designPlay')}</h1><p>{c('designIntro')}</p></header>
    <label className="play-goal-label">{c('mission')}<select value={config.missionId} onChange={event=>chooseGoal(event.target.value)}>{(['EARTH','MOON','MARS'] as const).map(body=><optgroup key={body} label={c(body)}>{offers.filter(item=>item.destination===body).map(item=><option key={item.missionId} value={item.missionId}>{t(item.titleKey)}</option>)}</optgroup>)}</select></label>
    {offer&&<h2 className="preparation-selected-title">{t(offer.titleKey)}</h2>}
    {offer&&<p className="preparation-goal">{t(offer.descriptionKey)}</p>}
    <fieldset><legend>{c('ambition')}</legend><div className="preparation-options">{(['SHORT','STANDARD','AMBITIOUS'] as const).map(value=><label key={value}><input type="radio" name="ambition" checked={config.ambition===value} onChange={()=>onChange({...config,ambition:value})}/><span>{c(value)}</span></label>)}</div></fieldset>
    <fieldset><legend>{c('kit')}</legend>{kits.length===1?<p>{c('fixedKit')}</p>:<div className="preparation-options vertical">{kits.map(value=><label key={value}><input type="radio" name="kit" checked={config.kit===value} onChange={()=>onChange({...config,kit:value})}/><span><strong>{c(value)}</strong><small>{c(`${value}_KIT`)}</small></span></label>)}</div>}</fieldset>
    <fieldset><legend>{c('approach')}</legend><div className="preparation-options vertical">{(['CAUTIOUS','BALANCED','FAST'] as const).map(value=><label key={value}><input type="radio" name="approach" checked={config.approach===value} onChange={()=>onChange({...config,approach:value})}/><span><strong>{c(value)}</strong><small>{c(`${value}_APPROACH`)}</small></span></label>)}</div></fieldset>
    <p className="muted">{c('constraintNote')}</p>
  </div></div><aside id="preparation-brief-panel" className="context-panel preview-panel" aria-label={c('constraints')}><div className="panel-scroll preparation-brief"><h2>{c('constraints')}</h2>
    {brief&&<><h3>{labelText(t,brief.design.definition.name)}</h3><Evidence items={brief.target} definition={brief.design.definition}/><dl className="brief-limits"><dt>{c('cost')}</dt><dd className={brief.budgets.cost.used>brief.budgets.cost.limit?'danger-text':''}>{number.format(brief.budgets.cost.used)} / {number.format(brief.budgets.cost.limit)}</dd><dt>{c('fit')}</dt><dd>{number.format(brief.budgets.massKg.used)} / {number.format(brief.budgets.massKg.limit)} kg</dd><dt>{c('volume')}</dt><dd>{number.format(brief.budgets.volume.used)} / {number.format(brief.budgets.volume.limit)} {brief.budgets.volume.unit}</dd><dt>{c('deadline')}</dt><dd><Duration seconds={brief.deadlineSec}/></dd></dl></>}
    <div className={`readiness readiness-${status.toLowerCase()}`} role="status" aria-live="polite" aria-busy={checking}><strong>{c(status)}</strong><p>{checking?c('checkNote'):ready?c('readinessNote'):checkError?c('unfinished'):c('noPlan')}</p></div>
    {computed.error&&<p role="alert">{computed.error}</p>}{checkError&&<div className="play-notice warning"><p>{c('checkError')}</p><details><summary>{c('details')}</summary><p>{checkError}</p></details><button className="button" onClick={()=>setCheck(value=>value+1)}>{c('recheck')}</button></div>}
    {!!brief?.blockers.length&&<section><h3>{c('blockers')}</h3><ul>{brief.blockers.map((block,index)=><li key={`${block.code}-${index}`}>{t(`refusal.${block.code}`,block.values)}</li>)}</ul></section>}
    {!!certificate?.reasons.length&&<ul className="readiness-reasons">{certificate.reasons.map(reason=><li key={reason}>{c(reason)}</li>)}</ul>}
    {certificate&&ready&&<><h3>{c('margins')}</h3><dl><dt>{c('fuel')}</dt><dd>{number.format(certificate.margins.fuelKg)} kg</dd><dt>{c('energy')}</dt><dd>{number.format(certificate.margins.energyWh)} Wh</dd><dt>{c('timeRemaining')}</dt><dd><Duration seconds={certificate.margins.deadlineSec}/></dd></dl></>}
    {brief&&<PreparationDetails brief={brief} certificate={certificate}/>}
  </div><div className="panel-action">
    <button className="button primary play-start" disabled={!ready||disabled||busy} onClick={onPlay}>{busy?c('resolving'):c('play')}</button>
  </div></aside></section>;
}
function PreparationDetails({brief,certificate}:{brief:QuickDesignBrief;certificate:ReadinessCertificate|null}) {
  const c=usePlayCopy(),{t,i18n}=useTranslation(),parts=listParts(brief.design.busId),number=new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:2});
  return <details className="play-details"><summary>{c('details')}</summary><h3>{c('hardware')}</h3><p>{c('hardwareQuantities')}</p>
    <ul className="hardware-manifest">{brief.design.parts.map((installed,index)=>{
      const part=parts.find(item=>item.id===installed.partId);
      return <li key={`${installed.partId}-${index}`}><strong>{installed.qty} × {part?t(part.nameKey):installed.partId}</strong>{part&&<><p>{t(part.descKey)}</p><small>{number.format(part.massKg.v*installed.qty)} kg · {c('cost')}: {number.format(part.cost.v*installed.qty)} · {number.format(part.powerW.v*installed.qty)} W{installed.propellantKg!==undefined&&<> · {c('fuel')}: {number.format(installed.propellantKg)} kg</>}</small></>}</li>;
    })}</ul><p>{brief.design.rideId??brief.design.launch?.launcherId}</p>
    {brief.design.orbit&&<p>{brief.design.orbit.body} · {brief.design.orbit.frame} · {brief.design.orbit.epochUTC} · SMA {brief.design.orbit.smaKm} km</p>}
    {certificate&&<><h3>{c('proof')}</h3><p>{c('referenceTurns')}: {certificate.turns} · {c('rules')}: {certificate.rulesVersion} / {certificate.modelVersion} · {certificate.policyVersion}</p><p>{c('seed')}: {brief.config.seed}</p><p className="identity">{certificate.identity}</p></>}
  </details>;
}

export function MissionBoard({offers,onChoose,onDesign}:{offers:readonly MissionOffer[];onChoose:(offer:MissionOffer)=>void;onDesign:()=>void}) {
  const c=usePlayCopy(),{t}=useTranslation(),[more,setMore]=useState(false),primary=offers.slice(0,3),remaining=offers.slice(3);
  return <><div className="board-title"><h1>{c('welcome')}</h1><p>{c('intro')}</p><button className="button primary" onClick={onDesign}>{c('designPlay')}</button></div><div className="mission-board">{primary.map((offer,index)=><article key={offer.missionId} className="mission-offer">{index===0&&offer.missionId==='FIRST_SIGNAL'&&<p className="mission-recommendation">{c('recommended')}</p>}<h2>{t(offer.titleKey)}</h2><p>{t(offer.descriptionKey)}</p><p className="offer-goal">{t(offer.goalKey)}</p><p className="muted">{offer.estimatedTurns[0]}–{offer.estimatedTurns[1]} {c('turns')}</p><button className="button" onClick={()=>onChoose(offer)}>{c('offer')}</button></article>)}</div>{remaining.length>0&&<section className="more-missions"><button className="text-button" aria-expanded={more} onClick={()=>setMore(!more)}>{c('moreMissions')} ({remaining.length})</button>{more&&<ul>{remaining.map(offer=><li key={offer.missionId}><div><strong>{t(offer.titleKey)}</strong><p>{t(offer.descriptionKey)}</p></div><button className="button" onClick={()=>onChoose(offer)}>{c('offer')}</button></li>)}</ul>}</section>}</>;
}
