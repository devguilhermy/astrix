import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import qrcode from 'qrcode-generator';
import { ROLES } from '@astrix/session';
import { roomApi, roomClient, connectSavedRoom, requestId, type LobbyInfo } from '../../multiplayer/client';
import { useRoomSession } from '../../multiplayer/session';
import { useLanCopy, useLanError } from './copy';
import { usePlayCopy } from '../play/copy';
import { Presence } from './Presence';
import './multiplayer.css';
export function HostLobby({onHome,onMission}:{onHome:()=>void;onMission:()=>void}) {
  const c=useLanCopy(),p=usePlayCopy(),errorCopy=useLanError(),{t}=useTranslation(),room=useRoomSession();
  const [lobby,setLobby]=useState<LobbyInfo|null>(null),[error,setError]=useState<string|null>(null),[copied,setCopied]=useState(false),heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{document.title=`${c('lobby')} — ASTRIX11`;heading.current?.focus();},[t]);
  useEffect(()=>{let active=true;void(async()=>{try{
    const fragment=new URLSearchParams(location.hash.slice(1)),capability=fragment.get('host');
    if(capability){history.replaceState(null,'',location.pathname);const result=await roomApi<{credential:string}>('host',{capability});await roomClient().start({credential:result.credential,host:true});}
    else if(room.status==='local')await connectSavedRoom();
  }catch(cause){if(active)setError(cause instanceof Error?cause.message:'NETWORK');}})();return()=>{active=false;};},[]);
  useEffect(()=>{if(!room.identity?.host)return;let active=true;const refresh=()=>void roomApi<LobbyInfo>('lobby').then(value=>{if(active)setLobby(value);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'NETWORK');});refresh();const timer=window.setInterval(refresh,1500);return()=>{active=false;clearInterval(timer);};},[room.identity?.credential]);
  const joinUrl=lobby?`${location.origin}/join#room=${encodeURIComponent(lobby.roomId)}&token=${encodeURIComponent(lobby.token)}`:'';
  const qr=useMemo(()=>{if(!joinUrl)return '';const encoder=qrcode(0,'M');encoder.addData(joinUrl);encoder.make();return encoder.createDataURL(5,20);},[joinUrl]);
  const admin=(action:'lock'|'unlock'|'host-only'|'solo'|'team')=>void roomApi('admin',{action}).then(()=>roomApi<LobbyInfo>('lobby')).then(setLobby).catch(cause=>setError(cause instanceof Error?cause.message:'NETWORK'));
  const snapshot=room.snapshot;
  return <main className="lan-screen"><div className="lan-content"><header className="lan-header"><img className="lan-logo" src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="ASTRIX11" width="512" height="426"/><div className="lan-actions"><button className="button" onClick={onHome}>{c('home')}</button><button className="button primary" disabled={!room.identity?.host} onClick={onMission}>{p('home')}</button></div></header><h1 ref={heading} tabIndex={-1}>{c('lobby')}</h1><p className="lan-notice">{c('trusted')}</p><p>{p('hostCommit')}</p>
    {(!room.identity?.host||room.status==='local')&&<p>{c('bootstrap')}</p>}<Presence/>{!room.storageAvailable&&<p role="status">{c('storage')}</p>}
    {(error||room.error)&&<p className="lan-error" role="alert">{errorCopy(error??room.error)}</p>}
    {room.status!=='connected'&&room.identity&&<button className="button" onClick={()=>roomClient().retryNow()}>{c('retry')}</button>}
    {lobby&&<><p>{lobby.devices.length}/4 {c('devices')} · {c('room')} {lobby.roomId.slice(0,6)}</p><p>{c('wifi')}</p>
      {!lobby.locked&&<section className="lan-invitation"><img className="lan-qr" src={qr} alt={c('qr')} width="220" height="220"/><div><label>{c('url')}<input readOnly value={`${location.origin}/join`} onFocus={event=>event.target.select()}/></label><label>{c('room')}<input readOnly value={lobby.roomId} onFocus={event=>event.target.select()}/></label><label>{c('token')}<input readOnly value={lobby.token} onFocus={event=>event.target.select()}/></label>{navigator.clipboard?.writeText&&<button className="button" onClick={()=>void navigator.clipboard.writeText(joinUrl).then(()=>setCopied(true)).catch(()=>setCopied(false))}>{c(copied?'copied':'copy')}</button>}<small>{c('expires')}</small></div></section>}
      <div className="lan-actions"><button className="button" disabled={room.status!=='connected'} onClick={()=>{roomClient().send({type:'ROTATE_JOIN_TOKEN',id:requestId()});setCopied(false);}}>{c('rotate')}</button><button className="button" onClick={()=>admin(lobby.locked?'unlock':'lock')}>{c(lobby.locked?'unlock':'lock')}</button></div>
      <section><h2>{c('pending')}</h2>{lobby.pending.length===0?<p>{c('empty')}</p>:<ul>{lobby.pending.map(player=><li key={player.id}><span>{player.name} </span><button className="button" disabled={room.status!=='connected'} onClick={()=>roomClient().send({type:'ADMIT',id:requestId(),pendingDeviceId:player.id,playerId:player.id})}>{c('approve')}</button></li>)}</ul>}</section>
      {snapshot&&<section><h2>{c('assign')}</h2><p>{p('phoneNote')}</p><div className="lan-assignments">{ROLES.map(role=><label key={role}>{t(`role.${role}`)}<select disabled={room.status!=='connected'} value={snapshot.roster.find(player=>player.roles.includes(role))?.id??snapshot.roster[0]?.id??'host'} onChange={event=>roomClient().send({type:'ASSIGN_ROLE',id:requestId(),role,playerId:event.target.value,rosterRevision:snapshot.rosterRevision})}>{snapshot.roster.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></label>)}</div><ul>{lobby.devices.map(device=><li key={device.id}>{snapshot.roster.find(player=>player.id===device.playerId)?.name??device.playerId} · {c(device.connected?'connected':'reconnecting')} {!device.host&&<button className="button" disabled={room.status!=='connected'} onClick={()=>roomClient().send({type:'KICK',id:requestId(),deviceId:device.id})}>{c('kick')}</button>}</li>)}</ul></section>}
      {!snapshot?.game&&<label>{c('mode')}<select value={lobby.participantMode} disabled={lobby.devices.length>1} onChange={event=>admin(event.target.value==='SOLO'?'solo':'team')}><option value="TEAM">{c('team')}</option><option value="SOLO">{c('solo')}</option></select></label>}
    </>}<p>{p('lanSave')}</p></div></main>;
}
