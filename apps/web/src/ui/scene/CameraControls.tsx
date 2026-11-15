import { useEffect, useLayoutEffect, type RefObject, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CameraAction, CameraBridge } from '../../three/camera/CameraRig';
import { CAMERA_MODES, useCameraMode, type CameraMode } from '../../three/camera/modes';
import { acceptsFlightKeys } from '../flight/PilotControls';
import { useMission } from '../../store';

const alternatives: readonly CameraAction[] = ['left', 'right', 'up', 'down', 'panLeft', 'panRight', 'panUp', 'panDown', 'focus', 'body', 'plane', 'station', 'reset'];
export function CameraControls({ bridge, effectiveMode: mode, exploring, touch, ready, onExplore, onMounted }: { bridge: RefObject<CameraBridge | null>; effectiveMode: CameraMode; exploring: boolean; touch: boolean; ready: boolean; onExplore(value: boolean): void; onMounted(): void }) {
 const { t } = useTranslation();
 useLayoutEffect(() => { onMounted(); }, [onMounted]);
 useEffect(() => {
  const keys = (event: globalThis.KeyboardEvent) => {
   if (!ready || event.repeat || event.altKey || event.ctrlKey || event.metaKey || !acceptsFlightKeys(event.target) || useMission.getState().pauseReasons.includes('home')) return;
   const key = event.key.toLowerCase();
   if (key === 'v') useCameraMode.getState().cycle();
   else if (key === 'k') useCameraMode.getState().setMode('INSPECT');
   else if (key === 'm') useCameraMode.getState().setMode('MAP');
   else if (key === 'f') bridge.current?.execute('fit');
   else if (key === 'r') bridge.current?.execute('reset');
   else return;
   event.preventDefault();
  };
  window.addEventListener('keydown', keys);
  return () => { window.removeEventListener('keydown', keys); };
 }, [bridge, ready]);
 function scopedKeys(event: KeyboardEvent<HTMLElement>) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'Escape' && exploring) { event.preventDefault(); onExplore(false); return; }
  const arrows: Record<string, CameraAction> = event.shiftKey ? { ArrowLeft: 'panLeft', ArrowRight: 'panRight', ArrowUp: 'panUp', ArrowDown: 'panDown' } : { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  const action = arrows[event.key] ?? (event.key === '+' || event.key === '=' ? 'zoomIn' : event.key === '-' ? 'zoomOut' : null);
  if (action && event.target instanceof HTMLElement && !event.target.closest('select')) { event.preventDefault(); bridge.current?.execute(action); }
 }
 return <section className={`scene-camera${exploring ? ' is-exploring' : ''}`} data-cue-target="camera" aria-label={t('scene.controls')} onKeyDown={scopedKeys}>
  <div className="camera-widget"><label><span className="sr-only">{t('flight.camera')}</span><select disabled={!ready} value={mode ?? ''} onChange={event => useCameraMode.getState().setMode(event.target.value as typeof CAMERA_MODES[number])}><option value="" disabled>{t('flight.camera')}</option>{CAMERA_MODES.map(value => <option key={value} value={value}>{t(`flight.${value}`)}</option>)}</select></label><button type="button" disabled={!ready} aria-label={t('scene.zoomOut')} onClick={() => bridge.current?.execute('zoomOut')}>−</button><button type="button" disabled={!ready} aria-label={t('scene.zoomIn')} onClick={() => bridge.current?.execute('zoomIn')}>+</button><button type="button" disabled={!ready} onClick={() => bridge.current?.execute('fit')}>{t('scene.fit')}</button></div>
  {touch && <button type="button" className="scene-explore" aria-pressed={exploring} onClick={() => onExplore(!exploring)}>{t(exploring ? 'scene.done' : 'scene.explore')}</button>}
  <details><summary>{t('scene.controls')}</summary><p>{t('scene.cameraOnly')}</p><p>{t('flight.cameraKeys')}</p><p>{t('flight.cameraAutomatic')}</p>{touch && <p>{t('scene.touch')}</p>}<div className="scene-camera-buttons">{alternatives.map(action => <button type="button" key={action} disabled={!ready} onClick={() => bridge.current?.execute(action)}>{t(action === 'body' || action === 'plane' || action === 'station' ? `flight.${action}` : `scene.${action}`)}</button>)}</div></details>
  {mode === 'CINEMATIC' && <button type="button" className="scene-explore" onClick={() => useCameraMode.getState().setMode('INSPECT')}>{t('flight.skipShot')}</button>}
 </section>;
}
