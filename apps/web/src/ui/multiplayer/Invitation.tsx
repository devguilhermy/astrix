import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import qrcode from 'qrcode-generator';
import { UserPlus } from 'lucide-react';
import { roomApi, roomClient, requestId, setPlayers, type LobbyInfo } from '../../multiplayer/client';
import { useRoomSession } from '../../multiplayer/session';
import { Modal } from '../primitives';
import { useLanCopy, useLanError } from './copy';
import { PlayerCount } from './PlayerCount';
import './multiplayer.css';

/** Rotate on open when less than this remains, so a scan from the panel never races expiry. */
const ROTATE_BELOW_MS=120000;

/** Host-only lobby state, polled while the caller is mounted (lobby page or the in-mission Invite control). */
export function useLobby() {
  const room=useRoomSession(),[lobby,setLobby]=useState<LobbyInfo|null>(null),[error,setError]=useState<string|null>(null);
  const fail=useCallback((cause:unknown)=>setError(cause instanceof Error?cause.message:'NETWORK'),[]);
  const refresh=useCallback(()=>roomApi<LobbyInfo>('lobby').then(value=>{setLobby(value);return value;}),[]);
  useEffect(()=>{if(!room.identity?.host)return;let active=true;const tick=()=>void roomApi<LobbyInfo>('lobby').then(value=>{if(active)setLobby(value);}).catch(cause=>{if(active)fail(cause);});tick();const timer=window.setInterval(tick,1500);return()=>{active=false;clearInterval(timer);};},[room.identity?.credential,fail]);
  return {lobby,error,setError,fail,refresh};
}

const clock=(ms:number)=>{const total=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;};

/** QR, join address, room and token, with a live expiry countdown. */
export function Invitation({lobby}:{lobby:LobbyInfo}) {
  const c=useLanCopy(),[copied,setCopied]=useState(false),[now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>setCopied(false),[lobby.token]);
  const joinUrl=`${location.origin}/join#room=${encodeURIComponent(lobby.roomId)}&token=${encodeURIComponent(lobby.token)}`;
  const qr=useMemo(()=>{const encoder=qrcode(0,'M');encoder.addData(joinUrl);encoder.make();return encoder.createDataURL(5,20);},[joinUrl]);
  return <section className="lan-invitation"><img className="lan-qr" src={qr} alt={c('qr')} width="220" height="220"/><div><label>{c('url')}<input readOnly value={`${location.origin}/join`} onFocus={event=>event.target.select()}/></label><label>{c('room')}<input readOnly value={lobby.roomId} onFocus={event=>event.target.select()}/></label><label>{c('token')}<input readOnly value={lobby.token} onFocus={event=>event.target.select()}/></label>{navigator.clipboard?.writeText&&<button className="button" onClick={()=>void navigator.clipboard.writeText(joinUrl).then(()=>setCopied(true)).catch(()=>setCopied(false))}>{c(copied?'copied':'copy')}</button>}<small role="timer">{c('expiresIn',{time:clock(lobby.expires-now)})} · {c('expires')}</small></div></section>;
}

/** Everything the host needs to admit players: count, invitation, pending requests and admission control. */
export function Admission({lobby,refresh,fail}:{lobby:LobbyInfo;refresh:()=>Promise<LobbyInfo>;fail:(cause:unknown)=>void}) {
  const c=useLanCopy(),room=useRoomSession(),online=room.status==='connected';
  const admin=(action:'lock'|'unlock')=>void roomApi('admin',{action}).then(refresh).catch(fail);
  return <div className="lan-admission">
    <PlayerCount value={lobby.seats} disabled={!online} onChange={count=>void setPlayers(count).then(refresh).catch(fail)}/>
    {lobby.seats>1&&(lobby.admissionOpen?<Invitation lobby={lobby}/>:<p role="status">{c(lobby.locked?'closed':'full')}</p>)}
    {lobby.seats>1&&<section><h2>{c('pending')}</h2>{lobby.pending.length===0?<p>{c('empty')}</p>:<ul className="lan-pending">{lobby.pending.map(player=><li key={player.id}><span>{player.name}</span><button className="button" disabled={!online||lobby.devices.length>=lobby.seats} onClick={()=>roomClient().send({type:'ADMIT',id:requestId(),pendingDeviceId:player.id,playerId:player.id})}>{c('approve')}</button><button className="button" disabled={!online} onClick={()=>roomClient().send({type:'KICK',id:requestId(),deviceId:player.id})}>{c('deny')}</button></li>)}</ul>}</section>}
    {lobby.seats>1&&<div className="lan-actions"><button className="button" disabled={!online||!lobby.admissionOpen} onClick={()=>roomClient().send({type:'ROTATE_JOIN_TOKEN',id:requestId()})}>{c('rotate')}</button><button className="button" onClick={()=>admin(lobby.locked?'unlock':'lock')}>{c(lobby.locked?'unlock':'lock')}</button></div>}
  </div>;
}

/** Header control on the remote host display: open seats stay invitable during the mission. */
export function InviteControl({host}:{host:boolean}) {
  return host?<HostInvite/>:null;
}
function HostInvite() {
  const c=useLanCopy(),errorCopy=useLanError(),{t}=useTranslation(),{lobby,error,setError,fail,refresh}=useLobby(),[open,setOpen]=useState(false),rotated=useRef(false);
  const openSeats=lobby?Math.max(0,lobby.seats-lobby.devices.length):0;
  useEffect(()=>{
    if(!open){rotated.current=false;return;}
    if(!lobby||rotated.current||!lobby.admissionOpen||lobby.expires-Date.now()>=ROTATE_BELOW_MS)return;
    rotated.current=true;roomClient().send({type:'ROTATE_JOIN_TOKEN',id:requestId()});void refresh().catch(fail);
  },[open,lobby,refresh,fail]);
  return <>
    <button className="header-tool invite-control" aria-haspopup="dialog" onClick={()=>{setError(null);setOpen(true);}}><UserPlus size={17} aria-hidden="true"/><span>{c('invite')}</span>{openSeats>0&&<small className="invite-badge">{t('lan.openSeats',{count:openSeats})}</small>}</button>
    {open&&<Modal title={c('invitePlayers')} onClose={()=>setOpen(false)} className="invite-dialog"><div className="lan-content">{error&&<p className="lan-error" role="alert">{errorCopy(error)}</p>}{lobby?<Admission lobby={lobby} refresh={refresh} fail={fail}/>:<p role="status" aria-busy="true">…</p>}</div></Modal>}
  </>;
}
