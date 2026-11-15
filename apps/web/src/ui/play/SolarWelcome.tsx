import { usePlayCopy } from './copy';
import { ArrowRight } from 'lucide-react';

export function SolarWelcome({onMissions}:{onMissions:()=>void}) {
  const c=usePlayCopy();
  return <section className="solar-welcome"><h1>{c('solarTitle')}</h1><p>{c('solarIntro')}</p><p className="muted">{c('solarMissionNote')}</p><button className="button primary" onClick={onMissions}>{c('chooseMission')}<ArrowRight size={17} aria-hidden="true"/></button></section>;
}
