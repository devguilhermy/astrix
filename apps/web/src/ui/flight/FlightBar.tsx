import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listParts, nextBoundary } from '@astrix/core';
import { useMission, WARPS } from '../../store';
import { CommandReceipt } from '../phases/FlightControls';
import { RefusalNote } from '../panels/Review';
import { Hotbar } from './Hotbar';
import { Timeline } from './Timeline';
import { usePilot } from './pilotState';
import './flight.css';

export function FlightBar() {
 const { t } = useTranslation();
 const sim = useMission(state => state.sim), telemetry = useMission(state => state.telemetry), design = useMission(state => state.design);
 const running = useMission(state => state.running), warp = useMission(state => state.warp), advancing = useMission(state => state.advancing);
 const decisions = useMission(state => state.pendingDecisions.length), refusal = useMission(state => state.lastRefusal);
 const [timelineOpen, setTimelineOpen] = useState(() => typeof matchMedia === 'function' ? matchMedia('(min-width: 900px)').matches : true);
 const deck = useRef<HTMLElement>(null);
 useLayoutEffect(() => {
  const element = deck.current;
  if (!element) return;
  const rail = document.querySelector<HTMLElement>('.resource-grid');
  const measure = () => {
   const railBounds = rail?.getBoundingClientRect();
   const clearance = window.innerWidth >= 900 && railBounds?.width ? railBounds.right + 8 : 8;
   const left = `${clearance}px`;
   if (element.style.getPropertyValue('--flight-rail-clearance') !== left) element.style.setProperty('--flight-rail-clearance', left);
   const bounds = element.getBoundingClientRect();
   const inset = `${bounds.width > 0 ? Math.max(0, window.innerHeight - bounds.top) : 0}px`;
   if (document.documentElement.style.getPropertyValue('--flight-hud-inset') !== inset) document.documentElement.style.setProperty('--flight-hud-inset', inset);
  };
  const observer = new ResizeObserver(measure);
  observer.observe(element);
  if (rail) observer.observe(rail);
  window.addEventListener('resize', measure);
  measure();
  return () => { observer.disconnect(); window.removeEventListener('resize', measure); document.documentElement.style.removeProperty('--flight-hud-inset'); };
 }, [!!sim, !!telemetry, !!design]);
 useEffect(() => () => { usePilot.getState().setEnabled(false); }, []);
 useEffect(() => {
  const media = matchMedia('(min-width: 900px)'), change = () => setTimelineOpen(media.matches);
  media.addEventListener('change', change);
  return () => { media.removeEventListener('change', change); };
 }, []);
 if (!sim || !telemetry || !design) return null;
 const boundary = nextBoundary(sim);
 const closed = !!telemetry.ended || !!decisions;
 return <section ref={deck} className="flight-bar" data-hud-zone="bottom" aria-label={t('flight.deck')}>
  <details className="flight-timeline-shell" open={timelineOpen} onToggle={event => setTimelineOpen(event.currentTarget.open)}><summary>{t('flight.timelineToggle')}</summary><Timeline/></details>
  <div className="flight-bar-row"><Hotbar/>
   <div className="flight-time" data-cue-target="time" role="group" aria-label={t('ui.time')}>
    <button type="button" className="button" disabled={closed || telemetry.cruise || telemetry.capturePending || advancing} onClick={() => running ? useMission.getState().pause('manual') : useMission.getState().resume()}>{t(running ? 'flight.pause' : 'flight.play')}</button>
    <label>{t('flight.warp')} <select value={warp} onChange={event => useMission.getState().setWarp(Number(event.target.value))}>{WARPS.map(speed => <option key={speed} value={speed}>{speed.toLocaleString()}×</option>)}</select></label>
    {telemetry.cruise ? <button type="button" className="button" disabled={closed} onClick={() => useMission.getState().skipCruise()}>{t('flight.skipCruise')}</button> : <button type="button" className="button" disabled={closed || !boundary} onClick={() => advancing ? useMission.getState().cancelAdvance() : useMission.getState().advanceToEvent()}>{t(advancing ? 'flight.cancel' : 'flight.next')}{!advancing && boundary && ` · ${t(`flow.boundary.${boundary.kind}`, { defaultValue: t('flight.happened') })}`}</button>}
    {!running && <span className="clock-state" role="status">{t(decisions ? 'flight.decision' : 'flight.paused')}</span>}
   </div>
  </div>
  <div className="flight-secondary"><details className="flight-receipts"><summary>{t('flight.receipt')} · {telemetry.queued}</summary><ol>{telemetry.commandQueue.slice(-8).map(entry => <CommandReceipt key={entry.id} entry={entry} parts={listParts(design.busId)}/>)}</ol></details>{refusal && <RefusalNote refusal={refusal}/>}</div>
 </section>;
}
