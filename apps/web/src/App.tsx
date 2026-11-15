import { useState } from 'react';
import { PlayApp } from './ui/play/PlayApp';
import { HostLobby } from './ui/multiplayer/HostLobby';
import { JoinRoom } from './ui/multiplayer/JoinRoom';
import { roomClient } from './multiplayer/client';

/** Decision-based play is the only game runtime; LAN browsers render host-owned turns. */
export function App({basePath='/'}:{basePath?:string}) {
  const [lobby,setLobby]=useState(true);
  if(location.pathname==='/join')return <JoinRoom onHome={()=>{roomClient().exit();location.assign('/');}} mission={<PlayApp remote guest onLobby={()=>roomClient().exit()}/>}/>;
  if(location.pathname==='/host')return lobby?<HostLobby onHome={()=>{roomClient().exit();location.assign('/');}} onMission={()=>setLobby(false)}/>:<PlayApp remote onLobby={()=>setLobby(true)}/>;
  const base=basePath.endsWith('/')?basePath:`${basePath}/`;
  if(location.pathname!==base&&location.pathname!==`${base}index.html`)return <main className="recovery-screen"><h1>404 · ASTRIX</h1><a href={base}>ASTRIX</a></main>;
  return <PlayApp basePath={basePath}/>;
}
