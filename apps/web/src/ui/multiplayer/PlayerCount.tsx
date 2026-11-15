import { useState } from 'react';
import { User, Users } from 'lucide-react';
import { setPlayers } from '../../multiplayer/client';
import { useLanCopy, useLanError } from './copy';
import './multiplayer.css';

export type Seats=1|2|3|4;
const COUNTS:readonly Seats[]=[1,2,3,4];

/** Party size including the host person; the same segmented pattern as the destination tabs and LevelToggle. */
export function PlayerCount({value,onChange,disabled=false}:{value:Seats;onChange:(count:Seats)=>void;disabled?:boolean}) {
  const c=useLanCopy();
  return <fieldset className="player-count"><legend>{c('players')}</legend><div className="player-count-options">{COUNTS.map(count=>{const Icon=count===1?User:Users;return <button key={count} type="button" aria-pressed={value===count} disabled={disabled} onClick={()=>{if(count!==value)onChange(count);}}><Icon size={17} aria-hidden="true"/>{count}</button>;})}</div><small>{c(value===1?'soloNote':'playersNote')}</small></fieldset>;
}

/** "x of y players joined": the host sees it beside Play mission, phones read it while waiting. */
export function PartyLine({joined,seats}:{joined:number;seats:Seats}) {
  const c=useLanCopy();
  return <p className="party-line" role="status">{c('joined',{joined,seats})}{joined<seats&&<> — {c('openLater')}</>}</p>;
}

/** LAN host on Design & Play: change the count before or after start; a refused lowering explains itself here. */
export function PartyControls({seats,joined,disabled=false}:{seats:Seats;joined:number;disabled?:boolean}) {
  const errorCopy=useLanError(),[error,setError]=useState<string|null>(null);
  return <div className="party-controls"><PlayerCount value={seats} disabled={disabled} onChange={count=>{setError(null);void setPlayers(count).catch(cause=>setError(cause instanceof Error?cause.message:'NETWORK'));}}/><PartyLine joined={joined} seats={seats}/>{error&&<p className="lan-error" role="alert">{errorCopy(error)}</p>}</div>;
}
