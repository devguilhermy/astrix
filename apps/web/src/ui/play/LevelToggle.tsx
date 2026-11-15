import { useId } from 'react';
import type { QuickDesignConfig } from '@astrix/core';
import { Gauge, Rocket, type LucideIcon } from 'lucide-react';
import { usePlayCopy } from './copy';

type LevelId=QuickDesignConfig['levelId'];
const levels:readonly {id:LevelId;Icon:LucideIcon;note:string}[]=[{id:'ASPIRING',Icon:Rocket,note:'aspiringNote'},{id:'EXPERT',Icon:Gauge,note:'expertNote'}];

/** Challenge level as two pressed-state buttons; the selected level is described on one line beneath. */
export function LevelToggle({value,onChange}:{value:LevelId;onChange:(level:LevelId)=>void}) {
  const c=usePlayCopy(),id=useId(),selected=levels.find(level=>level.id===value)??levels[0]!;
  return <div className="level-toggle"><span id={`${id}-label`} className="level-toggle-label">{c('level')}</span>
    <div role="group" className="level-toggle-options" aria-labelledby={`${id}-label`} aria-describedby={`${id}-note`}>{levels.map(({id:level,Icon})=><button key={level} type="button" aria-pressed={value===level} onClick={()=>onChange(level)}><Icon size={17} aria-hidden="true"/>{c(level)}</button>)}</div>
    <p id={`${id}-note`} className="level-note">{c(selected.note)}</p>
  </div>;
}
