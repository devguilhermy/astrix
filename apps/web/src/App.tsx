import { useEffect, useState } from 'react';
import { PlayApp } from './ui/play/PlayApp';
import { HostLobby } from './ui/multiplayer/HostLobby';
import { JoinRoom } from './ui/multiplayer/JoinRoom';
import { roomClient } from './multiplayer/client';
import { Home } from './ui/landing/Home';
import { hasSeenMissionLesson, MissionDesignLesson } from './ui/landing/MissionDesignLesson';
import { GmatPage } from './ui/gmat/GmatPage';

/** Decision-based play is the only game runtime; LAN browsers render host-owned turns. */
export function App({basePath='/'}:{basePath?:string}) {
  const [lobby,setLobby]=useState(true);
  const [entry,setEntry]=useState<'home'|'learn'|'simulator'>(()=>location.hash==='#learn'?'learn':!location.hash||location.hash==='#home'?'home':'simulator');
  const [entered,setEntered]=useState(()=>!!location.hash&&!['#home','#learn'].includes(location.hash));
  const [lessonReturn,setLessonReturn]=useState('#solar');
  useEffect(()=>{
    const route=()=>{const next=location.hash==='#learn'?'learn':!location.hash||location.hash==='#home'?'home':'simulator';setEntry(next);if(next==='simulator')setEntered(true);};
    window.addEventListener('hashchange',route);window.addEventListener('popstate',route);
    return()=>{window.removeEventListener('hashchange',route);window.removeEventListener('popstate',route);};
  },[]);
  const launchSimulator=(hash='#solar')=>{setEntered(true);setEntry('simulator');location.hash=hash;};
  const learn=()=>{setLessonReturn(entered&&entry==='simulator'?location.hash:'#solar');setEntry('learn');location.hash='learn';};
  const enter=()=>hasSeenMissionLesson()?launchSimulator():learn();
  const home=()=>{setEntry('home');location.hash='home';};
  if(location.pathname==='/join')return <JoinRoom onHome={()=>{roomClient().exit();location.assign('/');}} mission={<PlayApp remote guest onLobby={()=>roomClient().exit()}/>}/>;
  if(location.pathname==='/host')return lobby?<HostLobby onHome={()=>{roomClient().exit();location.assign('/');}} onMission={()=>setLobby(false)}/>:<PlayApp remote onLobby={()=>setLobby(true)}/>;
  if(location.pathname==='/gmat')return <GmatPage basePath={basePath}/>;
  const base=basePath.endsWith('/')?basePath:`${basePath}/`;
  if(location.pathname!==base&&location.pathname!==`${base}index.html`)return <main className="recovery-screen"><img src={`${base}assets/logo.png`} width="180" alt="ASTRIX11"/><h1>404 · ASTRIX11</h1><a href={base}>ASTRIX11</a></main>;
  return <>{entry==='home'&&<Home onEnter={enter} onLearn={learn}/>} {entry==='learn'&&<MissionDesignLesson onFinish={()=>launchSimulator(lessonReturn)} onHome={home}/>}<div hidden={entry!=='simulator'}>{entered&&<PlayApp basePath={basePath} onLanding={home} onLearn={learn}/>}</div></>;
}
