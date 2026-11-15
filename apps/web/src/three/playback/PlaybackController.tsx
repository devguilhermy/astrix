import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Quaternion, Vector3, type DirectionalLight, type Group } from 'three';
import { bodyRotationAngle, type TurnGameState } from '@astrix/core';
import type { TurnMoment } from '../../ui/play/turnMoments';
import { clearedCraft, type CommittedScene, type ScenePoint, type SceneView } from '../committedScene';
import { setSceneSegment, type SceneLineObject } from '../ScenePrimitives';
import { replayingText } from '../feedback/turnLabels';
import { LAUNCH_PLUME } from './LaunchStack';
import { createPlaybackSample, playbackPath, sampleAt, type PlaybackPath } from './playbackPath';
import { missionTimeAt, playbackClock, readPlaybackSpeed, writePlaybackSpeed, type PlaybackClock, type PlaybackSpeed } from './playbackClock';

/** The turn the scene is replaying now; `key` changes for every turn started. */
export interface PlaybackTurnRun { key: string; index: number; path: PlaybackPath; clock: PlaybackClock }
/** Everything the in-Canvas driver needs; the DOM transport reads `PlaybackState`. */
export interface PlaybackControl {
  turn: PlaybackTurnRun | null;
  paused: boolean;
  speed: PlaybackSpeed;
  onTick: (progress: number, missionT: number) => void;
  onEnd: () => void;
}
export interface PlaybackFeedback { key: number; index: number | null; animate: boolean }
export interface PlaybackState {
  control: PlaybackControl | null;
  active: boolean;
  paused: boolean;
  speed: PlaybackSpeed;
  progress: number;
  missionT: number | null;
  turn: number | null;
  announcement: string;
  feedback: PlaybackFeedback;
  canReplay: boolean;
  canReplayFlight: boolean;
  togglePause: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  skip: () => void;
  replay: () => void;
  replayFlight: () => void;
}
interface Run { id: number; turns: readonly number[]; position: number; flight: boolean }

const storage = () => typeof window === 'undefined' ? null : window.localStorage;

/**
 * Replay is presentation of committed history only: it starts after the engine resolved the
 * turn, never changes state and can be skipped. A commit in this session replays that turn;
 * loading, resuming and reduced motion show the end state immediately.
 */
export function usePlayback({ game, scene, moments, reducedMotion, view, selectedTurn, onSelectTurn, pt }: {
  game: TurnGameState | null; scene: CommittedScene; moments: readonly TurnMoment[]; reducedMotion: boolean; view: SceneView;
  selectedTurn: number | null; onSelectTurn?: (index: number) => void; pt: boolean;
}): PlaybackState {
  const [run, setRun] = useState<Run | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(() => readPlaybackSpeed(storage()));
  const [progress, setProgress] = useState<{ value: number; t: number | null }>({ value: 0, t: null });
  const [announcement, setAnnouncement] = useState('');
  const [feedback, setFeedback] = useState<PlaybackFeedback>({ key: 0, index: null, animate: false });
  const ended = !!scene.current?.ended;
  const enabled = !reducedMotion && view === 'play' && scene.physical && !!game && moments.length > 0;
  const latest = moments.at(-1) ?? null;
  const ids = useRef(0);
  const live = useRef({ moments, onSelectTurn, pt, reducedMotion, view, run });
  live.current = { moments, onSelectTurn, pt, reducedMotion, view, run };

  const start = useCallback((turns: readonly number[], flight: boolean) => {
    const { moments: list, onSelectTurn: select, pt: portuguese, reducedMotion: reduced } = live.current;
    const first = list.find(moment => moment.index === turns[0]);
    if (reduced || !first) return;
    setRun({ id: ++ids.current, turns, position: 0, flight });
    setPaused(false);
    setProgress({ value: 0, t: first.startSec });
    setAnnouncement(replayingText(first, portuguese));
    if (flight) select?.(first.index);
  }, []);
  const finish = useCallback((natural: boolean) => {
    const current = live.current.run;
    if (!current) return;
    setRun(null);
    setPaused(false);
    setProgress({ value: 0, t: null });
    setAnnouncement(live.current.pt ? 'Reprodução concluída' : 'Replay finished');
    setFeedback(previous => ({ key: previous.key + 1, index: current.turns.at(-1) ?? null, animate: natural && !live.current.reducedMotion }));
  }, []);

  // A commit in this session (same identity, higher revision) replays the new turn.
  const seen = useRef<{ identity: string; revision: number } | null>(null);
  useEffect(() => {
    const previous = seen.current;
    seen.current = game ? { identity: game.identity, revision: game.revision } : null;
    const committed = !!game && !!previous && previous.identity === game.identity && game.revision > previous.revision;
    const newest = live.current.moments.at(-1);
    if (!committed || !newest) {
      setRun(null);
      setFeedback(prior => ({ key: prior.key + 1, index: newest?.index ?? null, animate: false }));
      return;
    }
    if (live.current.reducedMotion || live.current.view !== 'play') {
      setRun(null);
      setFeedback(prior => ({ key: prior.key + 1, index: newest.index, animate: false }));
      return;
    }
    start([newest.index], false);
  }, [game?.identity, game?.revision, start]);
  useEffect(() => { if (!enabled && run) setRun(null); }, [enabled, run]);

  const momentIndex = run ? run.turns[run.position] ?? null : null;
  const moment = momentIndex === null ? null : moments.find(item => item.index === momentIndex) ?? null;
  const turn = useMemo<PlaybackTurnRun | null>(() => {
    if (!run || !moment || !game) return null;
    const path = playbackPath(game, moment, { body: scene.body, radiusKm: scene.radiusKm, epochUTC: scene.epochUTC, latest: moment === moments.at(-1) });
    return { key: `${run.id}:${run.position}`, index: moment.index, path, clock: playbackClock(moment.startSec, moment.endSec, path.periodSec, path.launch) };
  }, [run, moment, game, scene.body, scene.radiusKm, scene.epochUTC, moments]);

  const advance = useCallback(() => {
    const current = live.current.run;
    if (!current) return;
    if (current.position + 1 >= current.turns.length) { finish(true); return; }
    const position = current.position + 1, next = live.current.moments.find(item => item.index === current.turns[position]);
    setRun({ ...current, position });
    if (next) {
      setAnnouncement(replayingText(next, live.current.pt));
      if (current.flight) live.current.onSelectTurn?.(next.index);
    }
  }, [finish]);
  // A turn without two recorded keyframes in this scene has nothing to replay.
  useEffect(() => { if (run && (!turn || turn.path.keyframes.length < 2)) advance(); }, [run, turn, advance]);

  const lastTick = useRef(0);
  const onTick = useCallback((value: number, t: number) => {
    const now = performance.now();
    if (now - lastTick.current < 100 && value < 1) return;
    lastTick.current = now;
    setProgress({ value, t });
  }, []);
  const control = useMemo<PlaybackControl | null>(() => turn && turn.path.keyframes.length >= 2 ? { turn, paused, speed, onTick, onEnd: advance } : null, [turn, paused, speed, onTick, advance]);
  const setSpeed = useCallback((next: PlaybackSpeed) => { setSpeedState(next); writePlaybackSpeed(storage(), next); }, []);
  const replayTarget = ended && selectedTurn !== null && moments.some(item => item.index === selectedTurn) ? selectedTurn : latest?.index ?? null;
  return {
    control, active: !!run, paused, speed, progress: progress.value, missionT: progress.t, turn: momentIndex, announcement, feedback,
    canReplay: enabled && replayTarget !== null, canReplayFlight: enabled && ended,
    togglePause: () => setPaused(value => !value),
    setSpeed,
    skip: () => finish(false),
    replay: () => { if (enabled && replayTarget !== null) start([replayTarget], false); },
    replayFlight: () => { if (enabled && ended) start(moments.map(item => item.index), true); },
  };
}

export interface PlaybackTargets {
  craft: RefObject<Group | null>;
  hardware: RefObject<Group | null>;
  stack: RefObject<Group | null>;
  marker: RefObject<Group | null>;
  tether: RefObject<SceneLineObject | null>;
  planet: RefObject<Group | null>;
  secondary: RefObject<Group | null>;
  light: RefObject<DirectionalLight | null>;
  trail: RefObject<SceneLineObject | null>;
  head: RefObject<SceneLineObject | null>;
  /** Stable core-frame Sun direction read by the planets every frame. */
  sun: [number, number, number];
}

const UP = new Vector3(0, 1, 0);
const radialScratch = new Vector3(), offsetScratch = new Vector3(), quaternionScratch = new Quaternion();
const isLaunchPhase = (phase: string | null) => phase === 'PRELAUNCH' || phase === 'ASCENT';

/**
 * Applies the replay imperatively inside `useFrame`: hardware, cyan marker, tether, body
 * rotation, Sun direction, secondary body and the growing trail. React state is untouched
 * except for the throttled transport callback. The Canvas stays on demand and is
 * invalidated only while playing; the committed end state is restored afterwards.
 */
export function usePlaybackFrame(scene: CommittedScene, control: PlaybackControl | null, targets: PlaybackTargets, { followCraft, showHardware }: { followCraft: boolean; showHardware: boolean }) {
  const { camera, invalidate } = useThree();
  const controls = useThree(state => state.controls) as unknown as { target: Vector3; update: () => void } | null;
  const wall = useRef(0), ended = useRef(false);
  const sample = useMemo(createPlaybackSample, []);
  const craft = useMemo<ScenePoint>(() => [0, 0, 0], []);

  const place = useCallback((position: readonly number[], marker: readonly number[] | null, phase: string | null, climbing: boolean) => {
    const stackShown = isLaunchPhase(phase) && !showHardware;
    const { craft: group, hardware, stack, marker: dot, tether } = targets;
    group.current?.position.set(position[0]!, position[1]!, position[2]!);
    if (hardware.current) hardware.current.visible = !stackShown;
    if (stack.current) {
      stack.current.visible = stackShown;
      stack.current.position.set(position[0]!, position[1]!, position[2]!);
      radialScratch.set(position[0]!, position[1]!, position[2]!);
      if (radialScratch.lengthSq() > 0) stack.current.quaternion.copy(quaternionScratch.setFromUnitVectors(UP, radialScratch.normalize()));
      // Leave the plume clear of the ground: it may not reach below the surface.
      const plume = stack.current.getObjectByName(LAUNCH_PLUME);
      if (plume) {
        const gap = Math.hypot(position[0]!, position[1]!, position[2]!) - scene.hullRadius - 1, length = .3 * scene.hullRadius * 2;
        plume.visible = stackShown && climbing && gap > .002;
        plume.scale.set(1, Math.min(1, Math.max(.01, gap / length)), 1);
      }
    }
    if (marker) {
      dot.current?.position.set(marker[0]!, marker[1]!, marker[2]!);
      setSceneSegment(tether.current, marker, position);
    }
  }, [targets, scene.hullRadius, showHardware]);

  const restore = useCallback(() => {
    const { craft: group, planet, secondary, light, trail, head, tether, sun } = targets;
    // Both moving segments are rewritten in place, so their first bounding sphere is stale.
    if (head.current) head.current.frustumCulled = false;
    if (tether.current) tether.current.frustumCulled = false;
    place(scene.craft, scene.marker, scene.phase, false);
    group.current?.quaternion.copy(scene.attitude);
    if (planet.current) planet.current.rotation.y = scene.rotation;
    const second = scene.moon ?? scene.earth;
    if (second) secondary.current?.position.set(...second);
    const sunDir = scene.current?.sunDir;
    if (sunDir) { sun[0] = sunDir[0]; sun[1] = sunDir[1]; sun[2] = sunDir[2]; light.current?.position.set(sunDir[0] * 8, sunDir[2] * 8, -sunDir[1] * 8); }
    if (trail.current) trail.current.geometry.instanceCount = Infinity;
    if (head.current) head.current.visible = false;
    invalidate();
  }, [targets, scene, place, invalidate]);

  const follow = useCallback((position: readonly number[]) => {
    if (!followCraft || !controls) return;
    offsetScratch.set(position[0]! - controls.target.x, position[1]! - controls.target.y, position[2]! - controls.target.z);
    camera.position.add(offsetScratch);
    controls.target.set(position[0]!, position[1]!, position[2]!);
    controls.update();
  }, [followCraft, controls, camera]);
  const key = control?.turn?.key ?? null;
  const played = useRef(false);
  useLayoutEffect(() => {
    wall.current = 0;
    ended.current = false;
    if (key !== null) played.current = true;
    invalidate();
  }, [key, invalidate]);
  useLayoutEffect(() => {
    if (key !== null) return;
    restore();
    // A replay of an earlier turn ends away from the committed position: bring the camera back with the hardware.
    if (played.current) { played.current = false; follow(scene.craft); }
  }, [key, restore, follow, scene.craft]);
  useEffect(() => { if (control && !control.paused) invalidate(); }, [control, invalidate]);

  useFrame((_, delta) => {
    const turn = control?.turn;
    if (!control || !turn || control.paused || ended.current) return;
    wall.current += Math.min(delta, .1) * control.speed;
    const done = wall.current >= turn.clock.wallSec, t = missionTimeAt(turn.clock, wall.current);
    if (!sampleAt(turn.path, t, sample)) return;
    const secondaryCentre = sample.secondary;
    clearedCraft(sample.position, sample.altitudeKm, scene.hullRadius, scene.shell, secondaryCentre ? { centre: secondaryCentre, radius: scene.secondaryRadius } : null, craft);
    // Spacecraft view follows the hardware without replacing the user's orbit or zoom.
    follow(craft);
    place(craft, sample.position, sample.phase, sample.climbing);
    const { craft: group, planet, secondary, light, trail, head, sun } = targets;
    group.current?.quaternion.set(sample.attitude[0], sample.attitude[1], sample.attitude[2], sample.attitude[3]);
    if (planet.current) planet.current.rotation.y = bodyRotationAngle(scene.body, sample.t, scene.epochUTC);
    if (secondaryCentre) secondary.current?.position.set(secondaryCentre[0], secondaryCentre[1], secondaryCentre[2]);
    sun[0] = sample.sunDir[0]; sun[1] = sample.sunDir[1]; sun[2] = sample.sunDir[2];
    light.current?.position.set(sun[0] * 8, sun[2] * 8, -sun[1] * 8);
    // The flown trail grows to the replay time; a head segment joins it to the hardware.
    let count = 0;
    while (count < scene.trailT.length && scene.trailT[count]! <= sample.t) count++;
    if (trail.current) trail.current.geometry.instanceCount = Math.max(0, count - 1);
    if (head.current) {
      head.current.visible = count > 0;
      if (count > 0) setSceneSegment(head.current, scene.trail[count - 1]!, sample.position);
    }
    control.onTick(Math.min(1, wall.current / turn.clock.wallSec), sample.t);
    if (done) { ended.current = true; control.onEnd(); } else invalidate();
  }, -2);
}
