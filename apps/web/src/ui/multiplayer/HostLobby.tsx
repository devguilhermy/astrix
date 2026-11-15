import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ROLES } from '@astrix/session';
import { roomApi, roomClient, connectSavedRoom, requestId } from '../../multiplayer/client';
import { useRoomSession } from '../../multiplayer/session';
import { useLanCopy, useLanError } from './copy';
import { usePlayCopy } from '../play/copy';
import { Presence } from './Presence';
import { Admission, useLobby } from './Invitation';
import './multiplayer.css';
export function HostLobby({onHome,onMission}:{onHome:()=>void;onMission:()=>void}) {
  const c=useLanCopy(),p=usePlayCopy(),errorCopy=useLanError(),{t}=useTranslation(),room=useRoomSession(),heading=useRef<HTMLHeadingElement>(null);
  const {lobby,error,fail,refresh}=useLobby();
  useEffect(()=>{document.title=`${c('lobby')} — ASTRIX11`;heading.current?.focus();},[t]);
  useEffect(()=>{let active=true;void(async()=>{try{
    const fragment=new URLSearchParams(location.hash.slice(1)),capability=fragment.get('host');
    if(capability){history.replaceState(null,'',location.pathname);const result=await roomApi<{credential:string}>('host',{capability});await roomClient().start({credential:result.credential,host:true});}
    else if(room.status==='local')await connectSavedRoom();
  }catch(cause){if(active)fail(cause);}})();return()=>{active=false;};},[]);
  const snapshot=room.snapshot;
  return <main className="lan-screen"><div className="lan-content"><header className="lan-header"><img className="lan-logo" src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="ASTRIX11" width="512" height="426"/><div className="lan-actions"><button className="button" onClick={onHome}>{c('home')}</button><button className="button primary" disabled={!room.identity?.host} onClick={onMission}>{p('home')}</button></div></header><h1 ref={heading} tabIndex={-1}>{c('lobby')}</h1><p className="lan-notice">{c('trusted')}</p><p>{p('hostCommit')}</p>
    {(!room.identity?.host||room.status==='local')&&<p>{c('bootstrap')}</p>}<Presence/>{!room.storageAvailable&&<p role="status">{c('storage')}</p>}
    {(error||room.error)&&<p className="lan-error" role="alert">{errorCopy(error??room.error)}</p>}
    {room.status!=='connected'&&room.identity&&<button className="button" onClick={()=>roomClient().retryNow()}>{c('retry')}</button>}
    {lobby&&<><p>{lobby.devices.length}/{lobby.seats} {c('devices')} · {c('room')} {lobby.roomId.slice(0,6)}</p>{lobby.seats>1&&<p>{c('wifi')}</p>}
      <Admission lobby={lobby} refresh={refresh} fail={fail}/>
      {snapshot&&<section><h2>{c('assign')}</h2><p>{p('phoneNote')}</p><div className="lan-assignments">{ROLES.map(role=><label key={role}>{t(`role.${role}`)}<select disabled={room.status!=='connected'} value={snapshot.roster.find(player=>player.roles.includes(role))?.id??snapshot.roster[0]?.id??'host'} onChange={event=>roomClient().send({type:'ASSIGN_ROLE',id:requestId(),role,playerId:event.target.value,rosterRevision:snapshot.rosterRevision})}>{snapshot.roster.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></label>)}</div><ul>{lobby.devices.map(device=><li key={device.id}>{snapshot.roster.find(player=>player.id===device.playerId)?.name??device.playerId} · {c(device.connected?'connected':'reconnecting')} {!device.host&&<button className="button" disabled={room.status!=='connected'} onClick={()=>roomClient().send({type:'KICK',id:requestId(),deviceId:device.id})}>{c('kick')}</button>}</li>)}</ul></section>}
    </>}<p>{p('lanSave')}</p></div></main>;
}
