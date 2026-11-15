import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import qrcode from 'qrcode-generator';
import { listMissions, validateMissionDefinition, type BuiltinMissionId, type LevelId } from '@astrix/core';
import { labelText } from '../missions/definitionView';
import { readLibrary } from '../create/library';
import { LibraryErrorNotice } from '../create/LibraryPanel';
import type { LibraryError } from '../create/library';
import { ROLES } from '@astrix/session';
import { roomApi, roomClient, connectSavedRoom, requestId, type LobbyInfo } from '../../multiplayer/client';
import { useRoomSession } from '../../multiplayer/session';
import { useLanCopy, useLanError } from './copy';
import { Presence } from './Presence';
import './multiplayer.css';
export function HostLobby({onHome,onMission}:{onHome:()=>void;onMission:()=>void}){
  const c=useLanCopy(),errorCopy=useLanError(),{t}=useTranslation(),room=useRoomSession();
  const [lobby,setLobby]=useState<LobbyInfo|null>(null),[error,setError]=useState<string|null>(null),[copied,setCopied]=useState(false),[scenario,setScenario]=useState<string>('FIRST_LIGHT'),[startProblem,setStartProblem]=useState<LibraryError|null>(null),[level,setLevel]=useState<LevelId>('ASPIRING');
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{document.title=`${t('lan.lobby')} — ASTRIX`;heading.current?.focus();},[t]);
  useEffect(()=>{let active=true;void(async()=>{try{
    const fragment=new URLSearchParams(location.hash.slice(1)),capability=fragment.get('host');
    if(capability){history.replaceState(null,'',location.pathname);const result=await roomApi<{credential:string}>('host',{capability});await roomClient().start({credential:result.credential,host:true});}
    else if(room.status==='local')await connectSavedRoom();
  }catch(cause){if(active)setError(cause instanceof Error?cause.message:'NETWORK');}})();return()=>{active=false;};},[]);
  useEffect(()=>{if(!room.identity?.host)return;let active=true;const refresh=()=>void roomApi<LobbyInfo>('lobby').then(value=>{if(active)setLobby(value);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'NETWORK');});refresh();const timer=window.setInterval(refresh,1500);return()=>{active=false;clearInterval(timer);};},[room.identity?.credential]);
  const joinUrl=lobby?`${location.origin}/join#room=${encodeURIComponent(lobby.roomId)}&token=${encodeURIComponent(lobby.token)}`:'';
  const qr=useMemo(()=>{if(!joinUrl)return '';const encoder=qrcode(0,'M');encoder.addData(joinUrl);encoder.make();return encoder.createDataURL(5,20);},[joinUrl]);
  const admin=(action:'lock'|'unlock'|'host-only'|'solo'|'team')=>void roomApi('admin',{action}).then(()=>roomApi<LobbyInfo>('lobby')).then(setLobby).catch(cause=>setError(cause instanceof Error?cause.message:'NETWORK'));
  const library=readLibrary(),saved=library.ok?library.value:[];
  const startMission=()=>{
   if(!scenario.startsWith('lib:')){setStartProblem(null);roomClient().intent({kind:'START_MISSION',missionId:scenario as BuiltinMissionId,levelId:level},hostActor);return;}
   const entry=saved.find(item=>`lib:${item.id}`===scenario),checked=entry?validateMissionDefinition(entry.draft):null;
   if(!checked||!checked.ok){setStartProblem({code:'INVALID',...(checked&&!checked.ok?{issues:checked.issues}:{})});return;}
   setStartProblem(null);roomClient().intent({kind:'START_DEFINITION',definition:checked.definition,levelId:level},hostActor);
  };
  const snapshot=room.snapshot,hostActor={playerId:room.identity?.playerId??'host',role:'SCIENCE' as const,isHost:true};
  return <main className="lan-screen"><div className="lan-content"><div className="lan-actions"><button className="button" onClick={onHome}>{c('home')}</button>{snapshot?.design&&<button className="button" onClick={onMission}>{c('openMission')}</button>}</div><h1 ref={heading} tabIndex={-1}>{c('lobby')}</h1><p className="lan-notice">{c('trusted')}</p>
    {(!room.identity?.host||room.status==='local')&&<p>{c('bootstrap')}</p>}
    <Presence/>{!room.storageAvailable&&<p role="status">{c('storage')}</p>}
    {(error||room.error)&&<p className="lan-error" role="alert">{errorCopy(error??room.error)}</p>}
    {room.status!=='connected'&&room.identity&&<button className="button" onClick={()=>roomClient().retryNow()}>{c('retry')}</button>}
    {lobby&&<><p>{lobby.devices.length}/4 {c('devices')} · {c('room')} {lobby.roomId.slice(0,6)}</p><p>{c('wifi')}</p>
      {!lobby.locked&&<section className="lan-invitation"><img className="lan-qr" src={qr} alt={c('qr')} width="220" height="220"/><div><label>{c('url')}<input readOnly value={`${location.origin}/join`} onFocus={event=>event.target.select()}/></label><label>{c('room')}<input readOnly value={lobby.roomId} onFocus={event=>event.target.select()}/></label><label>{c('token')}<input readOnly value={lobby.token} onFocus={event=>event.target.select()}/></label>{navigator.clipboard?.writeText&&<button className="button" onClick={()=>void navigator.clipboard.writeText(joinUrl).then(()=>setCopied(true)).catch(()=>setCopied(false))}>{c(copied?'copied':'copy')}</button>}<small>{c('expires')}</small></div></section>}
      <div className="lan-actions"><button className="button" disabled={room.status!=='connected'} onClick={()=>{roomClient().send({type:'ROTATE_JOIN_TOKEN',id:requestId()});setCopied(false);}}>{c('rotate')}</button><button className="button" onClick={()=>admin(lobby.locked?'unlock':'lock')}>{c(lobby.locked?'unlock':'lock')}</button></div>
      <section><h2>{c('pending')}</h2>{lobby.pending.length===0?<p>{c('empty')}</p>:<ul>{lobby.pending.map(p=><li key={p.id}><span>{p.name} </span><button className="button" disabled={room.status!=='connected'} onClick={()=>roomClient().send({type:'ADMIT',id:requestId(),pendingDeviceId:p.id,playerId:p.id})}>{c('approve')}</button></li>)}</ul>}</section>
      {snapshot&&<><section><h2>{c('assign')}</h2><div className="lan-assignments">{ROLES.map(role=><label key={role}>{t(`role.${role}`)}<select disabled={room.status!=='connected'||snapshot.running} value={snapshot.roster.find(p=>p.roles.includes(role))?.id??'host'} onChange={event=>roomClient().send({type:'ASSIGN_ROLE',id:requestId(),role,playerId:event.target.value,rosterRevision:snapshot.rosterRevision})}>{snapshot.roster.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>)}</div><ul>{lobby.devices.map(d=><li key={d.id}>{snapshot.roster.find(p=>p.id===d.playerId)?.name??d.playerId} · {c(d.connected?'connected':'reconnecting')} {!d.host&&<button className="button" disabled={room.status!=='connected'} onClick={()=>roomClient().send({type:'KICK',id:requestId(),deviceId:d.id})}>{c('kick')}</button>}</li>)}</ul></section>
      {snapshot.running&&<p>{c('pauseRoles')}</p>}
      <label><span>{c('ready')}</span><input type="checkbox" checked={snapshot.roster.find(p=>p.id==='host')?.ready??false} disabled={room.status!=='connected'} onChange={event=>roomClient().send({type:'READY',ready:event.target.checked,rosterRevision:snapshot.rosterRevision})}/></label>
      {!snapshot.design&&<section><label>{c('mode')}<select value={lobby.participantMode} disabled={lobby.devices.length>1} onChange={event=>admin(event.target.value==='SOLO'?'solo':'team')}><option value="TEAM">{c('team')}</option><option value="SOLO">{c('solo')}</option></select></label><label>{c('scenario')}<select value={scenario} onChange={event=>setScenario(event.target.value)}><optgroup label={t('setup.track.LEARN')}>{listMissions({origin:'LEARNING'}).map(s=><option key={s.id} value={s.id}>{labelText(t,s.name)}</option>)}</optgroup><optgroup label={t('setup.track.CHALLENGE')}>{listMissions({origin:'BUILTIN'}).map(s=><option key={s.id} value={s.id}>{labelText(t,s.name)}</option>)}</optgroup>{saved.length>0&&<optgroup label={t('library.title')}>{saved.map(entry=><option key={entry.id} value={`lib:${entry.id}`}>{entry.draft.name.text||entry.id}</option>)}</optgroup>}</select></label><label>{c('level')}<select value={level} onChange={event=>setLevel(event.target.value as LevelId)}><option value="ASPIRING">{t('flow.aspiring')}</option><option value="EXPERT">{t('flow.expert')}</option></select></label><p>{c('readyHint')}</p><button className="button primary" disabled={room.status!=='connected'||snapshot.roster.some(p=>!p.connected||!p.acknowledged||!p.ready)} onClick={()=>startMission()}>{c('start')}</button>{startProblem&&<LibraryErrorNotice error={startProblem}/>}</section>}
      <div className="lan-actions"><button className="button" disabled={room.status!=='connected'} onClick={()=>roomClient().intent({kind:'PAUSE',reason:'manual'},hostActor)}>{c('pause')}</button>{snapshot.pauseReasons.filter(reason=>['host-stall','host-display-disconnected','hidden','home','graphics','settings','route','viewer'].includes(reason)).map(reason=><button key={reason} className="button" disabled={room.status!=='connected'} onClick={()=>roomClient().intent({kind:'CLEAR_PAUSE',reason},hostActor)}>{c('clearStop')} ({t(`lan.stop.${reason}`)})</button>)}<button className="button" disabled={room.status!=='connected'} onClick={()=>roomClient().intent({kind:'RESUME'},hostActor)}>{c('resume')}</button><button className="button" onClick={()=>{if(window.confirm(c('hostOnlyConfirm')))admin('host-only');}}>{c('hostOnly')}</button></div></>}
    </>}<p>{c('guide')}</p></div></main>;
}
