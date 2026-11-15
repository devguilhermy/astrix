import { Pause, Play, RotateCcw, Route, SkipForward } from 'lucide-react';
import { missionClock } from '../feedback/turnLabels';
import { PLAYBACK_SPEEDS } from './playbackClock';
import type { PlaybackState } from './PlaybackController';

/** DOM replay controls at the bottom centre of the open scene area. Every control is a 44 px button. */
export function PlaybackTransport({ playback, ended, pt }: { playback: PlaybackState; ended: boolean; pt: boolean }) {
  const { active, paused, speed, progress, missionT } = playback;
  const percent = Math.round(progress * 100);
  return <div className="scene-fb-transport" role="group" aria-label={pt ? 'Reprodução do turno' : 'Turn replay'} data-active={active}>
    <div className="scene-fb-transport-row">
      <button type="button" disabled={!active} onClick={playback.togglePause} aria-label={paused || !active ? pt ? 'Continuar reprodução' : 'Resume replay' : pt ? 'Pausar reprodução' : 'Pause replay'} title={paused ? pt ? 'Continuar' : 'Resume' : pt ? 'Pausar' : 'Pause'}>
        {paused || !active ? <Play size={17} strokeWidth={1.8}/> : <Pause size={17} strokeWidth={1.8}/>}
      </button>
      <div className="scene-fb-speeds" role="group" aria-label={pt ? 'Velocidade da reprodução' : 'Replay speed'}>
        {PLAYBACK_SPEEDS.map(value => <button key={value} type="button" aria-pressed={speed === value} onClick={() => playback.setSpeed(value)}>{value}×</button>)}
      </div>
      <button type="button" disabled={!active} onClick={playback.skip} aria-label={pt ? 'Pular para o fim' : 'Skip to the end'} title={pt ? 'Pular' : 'Skip'}><SkipForward size={17} strokeWidth={1.8}/></button>
      <button type="button" disabled={!playback.canReplay} onClick={playback.replay} title={pt ? 'Reproduzir o turno' : 'Replay the turn'}><RotateCcw size={17} strokeWidth={1.8}/><span>{pt ? 'Repetir' : 'Replay'}</span></button>
      {ended && <button type="button" disabled={!playback.canReplayFlight} onClick={playback.replayFlight} title={pt ? 'Reproduzir todos os turnos em ordem' : 'Replay every turn in order'}><Route size={17} strokeWidth={1.8}/><span>{pt ? 'Repetir o voo' : 'Replay flight'}</span></button>}
    </div>
    {active && <div className="scene-fb-progress">
      <span className="scene-fb-bar" role="progressbar" aria-label={pt ? 'Progresso da reprodução' : 'Replay progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }}/></span>
      <span className="scene-fb-time">{missionT === null ? '' : missionClock(missionT)}</span>
    </div>}
    <p className="scene-fb-transport-status" role="status">{playback.announcement}</p>
  </div>;
}
