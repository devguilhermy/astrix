import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SceneHtml } from '../SceneHtml';
import { useFrame, useThree } from '@react-three/fiber';
import { DoubleSide, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import type { TurnMoment } from '../../ui/play/turnMoments';
import { clearedCraft, renderPoint, type CommittedScene, type ScenePoint } from '../committedScene';
import { GroundDish, ObservationTarget, SceneLine } from '../ScenePrimitives';
import { PULSE_COUNT, PULSE_TOTAL_SEC, STATIC_RING_PHASES, nadirPoint, pulseRadius, pulseState, signalTarget, type SignalTarget } from './signalPath';

const WAVE = '#ffb164';
const FOOTPRINT = '#63e2d3';
const SCALE_IN_SEC = .6;
const Z = new Vector3(0, 0, 1), Y = new Vector3(0, 1, 0);

/** Where one turn's feedback is drawn: the displayed hardware, the true marker and the attitude. */
export interface FeedbackGeometry { moment: TurnMoment; source: ScenePoint; marker: ScenePoint; attitude: readonly number[] }

/**
 * The latest turn uses the committed scene exactly; an earlier turn (selected at mission end)
 * is placed from its recorded end position with the same schematic clearance.
 */
export function feedbackGeometry(scene: CommittedScene, moment: TurnMoment | null, latest: boolean): FeedbackGeometry | null {
  if (!moment || !scene.physical || !scene.design || moment.body !== scene.body) return null;
  const attitude = scene.attitude.toArray();
  if (latest && scene.marker) return { moment, source: scene.craft, marker: scene.marker, attitude };
  if (!moment.positionKm) return null;
  const marker = renderPoint(moment.positionKm, scene.radiusKm);
  const altitudeKm = Math.hypot(...moment.positionKm) - scene.radiusKm;
  return { moment, source: clearedCraft(marker, altitudeKm, scene.hullRadius, scene.shell), marker, attitude };
}

/** Restarts a one-shot animation whenever `animateKey` changes, unless motion is reduced. */
function useOneShot(animateKey: number, animate: boolean, reducedMotion: boolean) {
  const invalidate = useThree(state => state.invalidate);
  const [playing, setPlaying] = useState(false);
  const elapsed = useRef(0);
  useLayoutEffect(() => {
    elapsed.current = 0;
    setPlaying(animate && !reducedMotion);
    invalidate();
  }, [animateKey, animate, reducedMotion, invalidate]);
  return { playing, elapsed, stop: () => setPlaying(false) };
}

const along = (source: ScenePoint, target: ScenePoint, phase: number): ScenePoint => [source[0] + (target[0] - source[0]) * phase, source[1] + (target[1] - source[1]) * phase, source[2] + (target[2] - source[2]) * phase];

function SignalWaves({ source, target, stationCentre, animateKey, animate, reducedMotion, pt }: { source: ScenePoint; target: SignalTarget; stationCentre: ScenePoint; animateKey: number; animate: boolean; reducedMotion: boolean; pt: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  const { playing, elapsed, stop } = useOneShot(animateKey, animate, reducedMotion);
  const rings = useRef<(Mesh | null)[]>([]);
  const end = target.point;
  const facing = useMemo(() => {
    const direction = new Vector3(end[0] - source[0], end[1] - source[1], end[2] - source[2]);
    return direction.lengthSq() > 0 ? new Quaternion().setFromUnitVectors(Z, direction.normalize()) : new Quaternion();
  }, [source, end]);
  const dish = useMemo(() => {
    const outward = new Vector3(end[0] - stationCentre[0], end[1] - stationCentre[1], end[2] - stationCentre[2]);
    return outward.lengthSq() > 0 ? new Quaternion().setFromUnitVectors(Y, outward.normalize()) : new Quaternion();
  }, [end, stationCentre]);
  useFrame((_, delta) => {
    if (!playing) return;
    elapsed.current += Math.min(delta, .1);
    rings.current.forEach((ring, index) => {
      if (!ring) return;
      const state = pulseState(elapsed.current, index);
      ring.visible = !!state;
      if (!state) return;
      ring.position.set(source[0] + (end[0] - source[0]) * state.phase, source[1] + (end[1] - source[1]) * state.phase, source[2] + (end[2] - source[2]) * state.phase);
      ring.scale.setScalar(pulseRadius(state.phase));
      (ring.material as MeshBasicMaterial).opacity = state.opacity;
    });
    if (elapsed.current >= PULSE_TOTAL_SEC) stop();
    invalidate();
  });
  return <group name="signal-waves">
    {playing ? Array.from({ length: PULSE_COUNT }, (_, index) => <mesh key={index} ref={mesh => { rings.current[index] = mesh; }} visible={false} quaternion={facing} raycast={() => null}>
      <ringGeometry args={[.9, 1, 48]}/><meshBasicMaterial color={WAVE} transparent opacity={0} side={DoubleSide} depthWrite={false}/>
    </mesh>) : <>
      <SceneLine points={[source, end]} color={WAVE} opacity={.5} width={1.5} dashed/>
      {STATIC_RING_PHASES.map(phase => <mesh key={phase} position={along(source, end, phase)} quaternion={facing} scale={pulseRadius(phase)} raycast={() => null}>
        <ringGeometry args={[.9, 1, 48]}/><meshBasicMaterial color={WAVE} transparent opacity={.55} side={DoubleSide} depthWrite={false}/>
      </mesh>)}
    </>}
    {target.kind === 'station' && <group position={end} quaternion={dish} scale={.5}><GroundDish/></group>}
    {target.kind === 'boresight' && <SceneHtml position={end} center zIndexRange={[2, 2]} style={{ pointerEvents: 'none' }}><span className="scene-fb-label">{pt ? 'para a Terra' : 'to Earth'}</span></SceneHtml>}
  </group>;
}

function ObservationFootprint({ source, marker, animateKey, animate, reducedMotion }: { source: ScenePoint; marker: ScenePoint; animateKey: number; animate: boolean; reducedMotion: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  const { playing, elapsed, stop } = useOneShot(animateKey, animate, reducedMotion);
  const root = useRef<Group>(null);
  const nadir = useMemo(() => nadirPoint(marker), [marker]);
  const facing = useMemo(() => new Quaternion().setFromUnitVectors(Z, new Vector3(...nadir).normalize()), [nadir]);
  useFrame((_, delta) => {
    if (!playing || !root.current) return;
    elapsed.current += Math.min(delta, .1);
    const x = Math.min(1, elapsed.current / SCALE_IN_SEC);
    root.current.scale.setScalar(Math.max(.001, 1 - (1 - x) ** 3));
    if (x >= 1) stop();
    invalidate();
  });
  return <group name="observation-footprint">
    <group ref={root} position={nadir} quaternion={facing} scale={playing ? .001 : 1}><ObservationTarget radius={.09} color={FOOTPRINT}/></group>
    <SceneLine points={[source, nadir]} color={FOOTPRINT} opacity={.6} width={1.2}/>
  </group>;
}

/**
 * Committed-turn feedback in the scene: transmission waves toward the receiver and the
 * observation footprint beneath the spacecraft. Animated once after a turn in this session,
 * static on load, resume, at mission end and under reduced motion.
 */
export function TurnFeedback({ scene, geometry, animateKey, animate, reducedMotion, pt }: { scene: CommittedScene; geometry: FeedbackGeometry; animateKey: number; animate: boolean; reducedMotion: boolean; pt: boolean }) {
  const { moment, source, marker, attitude } = geometry;
  const target = useMemo(() => moment.deliveredMB > 0 ? signalTarget({ momentBody: moment.body, sceneBody: scene.body, stationKm: moment.stationKm, radiusKm: scene.radiusKm, source, attitude, earth: scene.body === 'SUN' ? scene.earth : null }) : null,
    [moment, scene.body, scene.radiusKm, scene.earth, source, attitude]);
  const stationCentre = useMemo<ScenePoint>(() => scene.body === 'MOON' && scene.earth ? scene.earth : [0, 0, 0], [scene.body, scene.earth]);
  // Data comes down during a station pass, which often ends before the turn does. The signal is
  // then drawn from where the spacecraft was over the station, not through the planet.
  const pass = useMemo<ScenePoint | null>(() => {
    if (target?.kind !== 'station' || moment.inContact || !moment.passKm) return null;
    return clearedCraft(renderPoint(moment.passKm, scene.radiusKm), Math.hypot(...moment.passKm) - scene.radiusKm, scene.hullRadius, scene.shell);
  }, [target, moment, scene.radiusKm, scene.hullRadius, scene.shell]);
  return <group name={`turn-feedback-${moment.index}`}>
    {moment.capturedMB > 0 && <ObservationFootprint source={source} marker={marker} animateKey={animateKey} animate={animate} reducedMotion={reducedMotion}/>}
    {target && <SignalWaves source={pass ?? source} target={target} stationCentre={stationCentre} animateKey={animateKey} animate={animate} reducedMotion={reducedMotion} pt={pt}/>}
    {pass && <group position={pass}>
      <mesh raycast={() => null}><sphereGeometry args={[.022, 16, 10]}/><meshBasicMaterial color={WAVE} transparent opacity={.9} depthWrite={false}/></mesh>
      <SceneHtml center zIndexRange={[2, 2]} style={{ pointerEvents: 'none', transform: 'translateY(-18px)' }}><span className="scene-fb-label">{pt ? 'Passagem sobre a estação' : 'Pass over the station'}</span></SceneHtml>
    </group>}
  </group>;
}
