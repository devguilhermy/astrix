import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PROTOCOL_VERSION } from '@astrix/session';
import { roomApi, roomClient, connectSavedRoom, appBuildId } from '../../multiplayer/client';
import { saveCredential, useRoomSession } from '../../multiplayer/session';
import { useLanCopy, useLanError } from './copy';
import { Presence } from './Presence';
import './multiplayer.css';
export function JoinRoom({onHome,mission}:{onHome:()=>void;mission:ReactNode}){
  const c=useLanCopy(),errorCopy=useLanError(),{t}=useTranslation(),room=useRoomSession();
  const [invite]=useState(()=>{const params=new URLSearchParams(location.hash.slice(1));return {room:params.get('room')??'',token:params.get('token')??''};});
  const [roomId,setRoomId]=useState(invite.room),[token,setToken]=useState(invite.token),[name,setName]=useState(''),[pending,setPending]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{document.title=`${t('lan.join')} — ASTRIX11`;heading.current?.focus();},[t]);
  useEffect(()=>{history.replaceState(null,'',location.pathname);if(room.status==='local')void connectSavedRoom();},[]);
  useEffect(()=>{if(!pending)return;let active=true;const poll=()=>void roomApi<{status:'pending'|'admitted';deviceId?:string;playerId?:string}>('pair',{},pending).then(result=>{if(active&&result.status==='admitted'){setPending(null);void roomClient().start({credential:pending,host:false,deviceId:result.deviceId,playerId:result.playerId});}}).catch(cause=>{if(active){setPending(null);setError(cause instanceof Error?cause.message:'NETWORK');}});poll();const timer=window.setInterval(poll,2000);return()=>{active=false;clearInterval(timer);};},[pending]);
  const join=async()=>{setBusy(true);setError(null);try{
    const health=await fetch('/health',{cache:'no-store'});if(!health.ok)throw new Error('NETWORK');const info=await health.json();
    if(info.protocol!==PROTOCOL_VERSION||info.buildId!==appBuildId())throw new Error('VERSION_MISMATCH');
    const result=await roomApi<{credential:string}>('join',{roomId,token,name,protocol:PROTOCOL_VERSION,buildId:info.buildId});setToken('');setPending(result.credential);
  }catch(cause){setError(cause instanceof Error?cause.message:'NETWORK');}finally{setBusy(false);}};
  const me=room.snapshot?.roster.find(p=>p.id===room.identity?.playerId);
  const unavailable=['repair','ended','version','replaced'].includes(room.status);
  if(room.identity&&room.snapshot?.game)return <>{mission}</>;
  return <main className="lan-screen"><div className="lan-content"><header className="lan-header"><img className="lan-logo" src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="ASTRIX11" width="512" height="426"/><button className="button" onClick={onHome}>{c('home')}</button></header><h1 ref={heading} tabIndex={-1}>{c('join')}</h1><p className="lan-notice">{c('trusted')}</p><Presence/>
    {!room.storageAvailable&&<p role="status">{c('storage')}</p>}
    {(error||room.error)&&<p role="alert" className="lan-error">{errorCopy(error??room.error)}</p>}
    {unavailable&&<p role="status">{c(room.status==='version'?'version':room.status==='ended'?'ended':room.status==='replaced'?'replaced':'repair')}</p>}
    {Object.values(room.outcomes).includes('unknown')&&<p role="status">{c('unknown')}</p>}
    {pending?<p role="status">{c('waiting')}</p>:room.status==='local'||room.status==='repair'||room.status==='ended'?<form onSubmit={event=>{event.preventDefault();void join();}}><h2>{c('manual')}</h2><label>{c('room')}<input required value={roomId} maxLength={64} autoComplete="off" onChange={event=>setRoomId(event.target.value)}/></label><label>{c('token')}<input required value={token} maxLength={128} autoComplete="off" onChange={event=>setToken(event.target.value)}/></label><label>{c('name')}<input required value={name} maxLength={24} autoComplete="off" onChange={event=>setName(event.target.value)}/></label><button className="button primary" disabled={busy}>{c('pair')}</button></form>:null}
    {room.status==='connected'&&me&&<><p>{c('consoleNote')}</p><p>{me.name} · {me.roles.map(role=>t(`role.${role}`)).join(', ')||c('assign')}</p><p>{c('waiting')}</p></>}
    {(room.status==='connecting'||room.status==='reconnecting')&&<button className="button" onClick={()=>roomClient().retryNow()}>{c('retry')}</button>}
    {unavailable&&<button className="button" onClick={()=>{roomClient().exit();saveCredential(null);setError(null);}}>{c('repair')}</button>}
    <p>{c('guide')}</p></div></main>;
}
