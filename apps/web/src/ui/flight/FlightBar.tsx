import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { nextBoundary, type TimelineForecast } from '@astrix/core';
import { useMission, WARPS } from '../../store';
import { RefusalNote } from '../panels/Review';
import { Hotbar } from './Hotbar';
import { Timeline } from './Timeline';
import { usePilot } from './pilotState';
import { showWindow } from '../layout/windows';
import './flight.css';

export function FlightBar({forecast}:{forecast:TimelineForecast|null}) {
 const {t}=useTranslation(),s=useMission(),x=s.telemetry;
 useEffect(()=>()=>usePilot.getState().setEnabled(false),[]);
 if(!s.sim||!x||!s.design)return null;
 const boundary=nextBoundary(s.sim),closed=!!x.ended||!!s.pendingDecisions.length;
 return <section className="flight-bar" aria-label={t('flight.deck')}>
  <details className="flight-timeline-shell" data-cue-target="timeline-toggle"><summary>{t('flight.timelineToggle')}</summary><Timeline forecast={forecast}/></details>
  <div className="flight-bar-row"><Hotbar/>
   <div className="flight-time" data-cue-target="time" role="group" aria-label={t('ui.time')}>
    <label data-cue-target="time-warp">{t('flight.warp')}<select value={s.warp} onChange={event=>s.setWarp(Number(event.target.value))}>{WARPS.map(speed=><option key={speed} value={speed}>{speed.toLocaleString()}×</option>)}</select></label>
    {!x.cruise&&!x.capturePending&&<button type="button" className="button" data-cue-target="time-event" disabled={closed||!boundary} onClick={()=>s.advancing?s.cancelAdvance():s.advanceToEvent()}>{t(s.advancing?'flight.cancel':'flight.next')}{!s.advancing&&boundary&&` · ${t(`flow.boundary.${boundary.kind}`,{defaultValue:t('flight.happened')})}`}</button>}
    {!s.running&&<span className="clock-state" role="status">{t(s.pendingDecisions.length?'flight.decision':'flight.paused')}</span>}
   </div>
  </div>
  <button type="button" className="button" data-cue-target="receipts" onClick={()=>showWindow('log')}>{t('flight.receipt')} · {x.queued}</button>
  {s.lastRefusal&&<RefusalNote refusal={s.lastRefusal}/>}
 </section>;
}
