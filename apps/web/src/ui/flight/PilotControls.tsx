import { useEffect, useRef, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { issueCommand, telemetry as readTelemetry, type Command } from '@astrix/core';
import { useMission } from '../../store';
import { RefusalNote } from '../panels/Review';
import { pilotAllowed, pilotInput, usePilot, type PilotAxis } from './pilotState';

const KEY_AXES: Readonly<Record<string, PilotAxis>> = { w: 'pitchUp', s: 'pitchDown', a: 'yawLeft', d: 'yawRight', q: 'rollLeft', e: 'rollRight' };
const AXES: readonly PilotAxis[] = ['rollLeft', 'pitchUp', 'rollRight', 'yawLeft', 'pitchDown', 'yawRight'];
export const acceptsFlightKeys = (target: EventTarget | null) => !(target instanceof HTMLElement) || (!target.closest('input, select, textarea, [contenteditable="true"], [role="dialog"], [role="alertdialog"]') && !document.querySelector('[aria-modal="true"]'));

export function PilotControls() {
 const { t } = useTranslation();
 const enabled = usePilot(state => state.enabled);
 const target = usePilot(state => state.target);
 const telemetry = useMission(state => state.telemetry);
 const warp = useMission(state => state.warp);
 const sim = useMission(state => state.sim);
 const actor = useMission(state => state.players.length === 1 ? 'ALL' : state.activeRole);
 useEffect(() => {
  if (!enabled) return;
  let frame = 0, previous = performance.now();
  const loop = (now: number) => { pilotInput.tick(now, (now - previous) / 1000); previous = now; frame = requestAnimationFrame(loop); };
  frame = requestAnimationFrame(loop);
  const down = (event: KeyboardEvent) => {
   const axis = KEY_AXES[event.key.toLowerCase()];
   if (!axis || !acceptsFlightKeys(event.target) || event.altKey || event.ctrlKey || event.metaKey || !pilotAllowed()) return;
   event.preventDefault(); pilotInput.hold(axis);
  };
  const up = (event: KeyboardEvent) => { const axis = KEY_AXES[event.key.toLowerCase()]; if (axis) pilotInput.unhold(axis); };
  const release = () => pilotInput.release();
  const visibility = () => { if (document.hidden) release(); };
  window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', release); document.addEventListener('visibilitychange', visibility);
  return () => { cancelAnimationFrame(frame); release(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', visibility); };
 }, [enabled]);
 if (!telemetry) return null;
 const preview: Command = { kind: 'ATTITUDE_TARGET', q: target ?? telemetry.attitude.target };
 const quote = sim ? issueCommand(sim, preview, actor) : null;
 const after = quote?.ok ? readTelemetry(quote.value) : null;
 const receipt = after?.commandQueue.find(entry => !telemetry.commandQueue.some(previous => previous.id === entry.id));
 const disabled = !pilotAllowed();
 function toggle() {
  if (warp > 10) useMission.getState().setWarp(10);
  if (useMission.getState().warp <= 10) usePilot.getState().setEnabled(warp > 10 || !enabled);
 }
 return <section className="flight-pilot" data-cue-target="pilot" aria-label={t('flight.pilot')}>
  <button type="button" className="button" aria-pressed={enabled} onClick={toggle}>{t(warp > 10 ? 'flight.pilotSlow' : enabled ? 'flight.pilotOff' : 'flight.pilot')} <kbd>P</kbd></button>
  {enabled && <div className="pilot-expanded">
   <p id="pilot-instructions">{t('flight.pilotHelp')}</p>
   {warp > 10 && <p role="status">{t('flight.pilotWarp')}</p>}
   <div className="pilot-pad" aria-describedby="pilot-instructions">{AXES.map(axis => <button key={axis} type="button" disabled={disabled} aria-label={t(`flight.${axis}`)} title={t(`flight.${axis}`)}
    onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pilotInput.hold(axis); }}
    onPointerUp={() => pilotInput.unhold(axis)} onPointerCancel={() => pilotInput.unhold(axis)} onLostPointerCapture={() => pilotInput.unhold(axis)}
    onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); pilotInput.hold(axis); } }}
    onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); pilotInput.unhold(axis); } }} onBlur={() => pilotInput.unhold(axis)}>{axis === 'pitchUp' ? '↑' : axis === 'pitchDown' ? '↓' : axis === 'yawLeft' ? '←' : axis === 'yawRight' ? '→' : axis === 'rollLeft' ? '↶' : '↷'}</button>)}</div>
   <dl className="attitude-gauges">{(['panelSunDeg', 'instrumentTargetDeg', 'antennaEarthDeg'] as const).map((key, index) => <div key={key}><dt>{t(['flight.panelAngle', 'flight.targetAngle', 'flight.earthAngle'][index])}</dt><dd>{telemetry.attitude[key].toFixed(1)}°</dd></div>)}<div><dt>{t('flight.attitudeRate')}</dt><dd>{(telemetry.attitude.rateRadSec * 180 / Math.PI).toFixed(2)}°/s</dd></div><div><dt>{t('flight.hold')}</dt><dd>{t(telemetry.attitude.hold === 'MANUAL' ? 'flight.manual' : `ui.${telemetry.attitude.hold}`)}</dd></div></dl>
   <p className="small">{t('flight.pilotPreview')} {t('flight.pilotTransport')}</p>
   {after && <p className="small">{t('ui.powerPreview', { beforeGen: telemetry.genW.toFixed(1), afterGen: after.genW.toFixed(1), beforeLoad: telemetry.loadW.toFixed(1), afterLoad: after.loadW.toFixed(1) })}</p>}
   {receipt && <p className="small">{t(receipt.status === 'WAITING_CONTACT' ? 'receipt.waitPreview' : receipt.transport === 'ONBOARD' ? 'flow.onboardPreview' : 'receipt.transitPreview', { seconds: Math.max(0, (receipt.applyAt ?? after!.t) - after!.t).toFixed(1) })}</p>}
   {quote && !quote.ok && <RefusalNote refusal={quote}/>}
  </div>}
 </section>;
}

/** Only this transparent scene layer captures steering drags. Panels remain ordinary DOM.
 * Camera orbit owns all gestures when pilot mode is off; there is no global drag trap.
 */
export function PilotDragSurface() {
 const { t } = useTranslation();
 const enabled = usePilot(state => state.enabled);
 const warp = useMission(state => state.warp);
 const pending = useMission(state => state.pendingDecisions.length);
 const pointer = useRef<{ id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null>(null);
 if (!enabled || warp > 10 || pending) return null;
 const finish = (event: PointerEvent<HTMLDivElement>) => {
  if (pointer.current?.id !== event.pointerId) return;
  const moved = pointer.current.moved;
  pointer.current = null;
  if (moved) pilotInput.finishDrag(); else pilotInput.release();
 };
 return <div className="pilot-drag-surface" role="presentation" aria-label={t('flight.pilot')} onPointerDown={event => {
  if (event.button !== 0 || !pilotAllowed()) return;
  event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
  pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
  pilotInput.begin(); usePilot.setState({ dragging: true });
 }} onPointerMove={event => {
  const active = pointer.current;
  if (!active || active.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >= 5) active.moved = true;
  if (active.moved) pilotInput.drag(event.clientX - active.x, event.clientY - active.y);
  active.x = event.clientX; active.y = event.clientY;
 }} onPointerUp={finish} onPointerCancel={event => { pointer.current = null; pilotInput.release(); event.currentTarget.releasePointerCapture(event.pointerId); }} onLostPointerCapture={finish}/>;
}
