import { useEffect, useState } from 'react';
import { PlayApp } from './ui/play/PlayApp';
import { HostLobby } from './ui/multiplayer/HostLobby';
import { JoinRoom } from './ui/multiplayer/JoinRoom';
import { roomClient } from './multiplayer/client';
import { Home } from './ui/landing/Home';
import { hasSeenMissionLesson, MissionDesignLesson } from './ui/landing/MissionDesignLesson';
import { isGmatPath } from './ui/recovery/routes';

/** Decision-based play is the only game runtime; LAN browsers render host-owned turns. */
export function App({basePath='/'}:{basePath?:string}) {
  const base=basePath.endsWith('/')?basePath:`${basePath}/`;
  const readEntry=():'home'|'learn'|'simulator'=>isGmatPath(location.pathname,base)?'simulator':location.hash==='#learn'?'learn':!location.hash||location.hash==='#home'?'home':'simulator';
  const [lobby,setLobby]=useState(true);
  const [entry,setEntry]=useState(readEntry);
  const [entered,setEntered]=useState(()=>isGmatPath(location.pathname,base)||!!location.hash&&!['#home','#learn'].includes(location.hash));
  const [lessonReturn,setLessonReturn]=useState('#solar');
  useEffect(()=>{
    const route=()=>{const next=readEntry();setEntry(next);if(next==='simulator')setEntered(true);};
    window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
    return()=>{window.removeEventListener('hashchange',route);window.removeEventListener('popstate',route);};
  },[base]);
  // pushState does not fire popstate; the entry and the simulator view both resync from the location.
  const go=(url:string)=>{history.pushState(null,'',url);window.dispatchEvent(new PopStateEvent('popstate'));};
  const launchSimulator=(hash='#solar')=>{setEntered(true);setEntry('simulator');go(`${base}${hash}`);};
  const learn=()=>{setLessonReturn(entered&&entry==='simulator'?location.hash||'#solar':'#solar');setEntry('learn');go(`${base}#learn`);};
  const enter=()=>hasSeenMissionLesson()?launchSimulator():learn();
  const home=()=>{setEntry('home');go(`${base}#home`);};
  const gmat=()=>{setEntered(true);setEntry('simulator');go(`${base}gmat`);};
  if(location.pathname==='/join')return <JoinRoom onHome={()=>{roomClient().exit();location.assign('/');}} mission={<PlayApp remote guest onLobby={()=>roomClient().exit()}/>}/>;
  if(location.pathname==='/host')return lobby?<HostLobby onHome={()=>{roomClient().exit();location.assign('/');}} onMission={()=>setLobby(false)}/>:<PlayApp remote onLobby={()=>setLobby(true)}/>;
  if(location.pathname!==base&&location.pathname!==`${base}index.html`&&!isGmatPath(location.pathname,base))return <main className="recovery-screen"><img src={`${base}assets/logo.png`} width="180" alt="ASTRIX11"/><h1>404 · ASTRIX11</h1><a href={base}>ASTRIX11</a></main>;
  return <>{entry==='home'&&<Home onEnter={enter} onLearn={learn} onGmat={gmat}/>} {entry==='learn'&&<MissionDesignLesson onFinish={()=>launchSimulator(lessonReturn)} onHome={home}/>}<div hidden={entry!=='simulator'}>{entered&&<PlayApp basePath={basePath} onLanding={home} onLearn={learn}/>}</div></>;
}
