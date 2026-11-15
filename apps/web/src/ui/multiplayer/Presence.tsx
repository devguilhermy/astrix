import { useTranslation } from 'react-i18next';
import { useRoomSession } from '../../multiplayer/session';
import { useLanCopy, useLanError } from './copy';
export function Presence(){
  const room=useRoomSession(),c=useLanCopy(),errorCopy=useLanError(),{t}=useTranslation();
  if(room.status==='local')return null;
  return <div className="lan-presence" aria-label={c('assign')} style={{display:'flex',flexWrap:'wrap',gap:'.35rem .75rem',fontSize:'.8rem',maxWidth:'100%'}}>
    <span role="status" aria-live="polite">{c(room.status==='connected'?'connected':room.status==='reconnecting'||room.status==='connecting'?'reconnecting':'offline')}</span>
    {room.error&&<span role="status">{errorCopy(room.error)}</span>}
    {room.snapshot?.roster.map(player=><span key={player.id} style={{overflowWrap:'anywhere'}}>{player.name} · {player.roles.map(role=>t(`role.${role}`)).join(', ')||c('assign')} · {c(!player.connected?'reconnecting':player.ready?'ready':'notReady')}</span>)}
  </div>;
}
