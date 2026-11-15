import { useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { CONSTANTS, bodyRotationAngle, type BodyId } from '@astrix/core';
import { sunDirection, type Vec3 } from '@astrix/core/physics';
import { sampleTrajectory } from '@astrix/core/interop/gmat';
import { PLAYBACK_SPEEDS, trajectoryViewer, type GmatSubject } from '../../ui/advanced/trajectoryStore';
import { Planet } from '../space/Planet';
import { Skybox } from '../space/Skybox';
import { SceneLine } from '../ScenePrimitives';
import { SceneHtml } from '../SceneHtml';
import './gmat-scene.css';
import { apsides, frameOf, orbitPath, orbitPeriodSec, orbitStateAt, subjectRange, toScene, trajectoryRuns } from './geometry';

type CameraAction = 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'reset';
const ORBIT = '#76dce8', PAST = '#e1be7e', CRAFT = '#fff2b4';
const bodyOf = (subject: GmatSubject): BodyId => subject.kind === 'orbit' ? subject.orbit.body : subject.trajectory.body;
const km = (value: number, pt: boolean) => `${new Intl.NumberFormat(pt ? 'pt-BR' : 'en', { maximumFractionDigits: 0 }).format(value)} km`;

function GmatCamera({ frame, identity, sun, command, reducedMotion }: { frame: { centre: [number, number, number]; radius: number }; identity: GmatSubject; sun: readonly number[] | null; command: { action: CameraAction; id: number }; reducedMotion: boolean }) {
 const { camera, size, invalidate } = useThree(), ready = useThree(state => state.controls), extent = frame.radius;
 const controls = useRef<ComponentRef<typeof OrbitControls>>(null), home = useRef(new Vector3()), applied = useRef(command.id);
 useLayoutEffect(() => {
  if (!(camera instanceof PerspectiveCamera) || !controls.current) return;
  // Centre the subject in the area left open by the GMAT panel (desktop) or above the bottom sheet (mobile).
  // Top leaves room for the caption, bottom for the transport.
  const mobile = size.width <= 900, left = mobile ? 0 : Math.min(676, size.width - 16), top = mobile ? 64 : 130;
  const openWidth = Math.max(180, size.width - left), openHeight = mobile ? Math.max(120, size.height * .42 - top) : Math.max(180, size.height - top - 190);
  camera.setViewOffset(size.width, size.height, (.5 - (left + openWidth / 2) / size.width) * size.width, (.5 - (top + openHeight / 2) / size.height) * size.height, size.width, size.height);
  const framing = Math.max(1, size.height / openHeight, size.height / openWidth * .85);
  // Look from the sunlit side when the Sun direction is known, slightly above the equator.
  home.current.set(1.4, .9, 2.2).normalize();
  if (sun) home.current.add(new Vector3(sun[0], sun[1], sun[2]).normalize().multiplyScalar(1.4)).add(new Vector3(0, .5, 0)).normalize();
  home.current.multiplyScalar(extent * 3 * framing).add(new Vector3(...frame.centre));
  camera.position.copy(home.current); controls.current.target.set(...frame.centre);
  camera.near = .01; camera.far = Math.max(2000, extent * 60); camera.updateProjectionMatrix();
  controls.current.update(); invalidate();
 // Re-frame on a new subject only, not every time the Sun direction moves during playback.
 // `ready`: makeDefault controls register after the first layout pass; frame once they exist.
 }, [camera, size.width, size.height, frame, extent, identity, ready, invalidate]);
 useLayoutEffect(() => {
  if (!controls.current || command.id === applied.current) return;
  applied.current = command.id;
  if (command.action === 'reset') { camera.position.copy(home.current); controls.current.target.set(...frame.centre); }
  else {
   const offset = camera.position.clone().sub(controls.current.target), s = new Spherical().setFromVector3(offset);
   if (command.action === 'left') s.theta -= .2; if (command.action === 'right') s.theta += .2;
   if (command.action === 'up') s.phi -= .16; if (command.action === 'down') s.phi += .16;
   if (command.action === 'in') s.radius *= .82; if (command.action === 'out') s.radius /= .82;
   s.radius = Math.max(1.15, Math.min(extent * 30, s.radius)); s.makeSafe();
   camera.position.copy(controls.current.target).add(offset.setFromSpherical(s));
  }
  controls.current.update(); invalidate();
 }, [command, camera, frame, extent, invalidate]);
 return <OrbitControls ref={controls} makeDefault enableDamping={!reducedMotion} dampingFactor={.15} minDistance={1.15} maxDistance={extent * 30} keyEvents={false}/>;
}

/** External GMAT data drawn around its central body. Display only: never touches a mission. */
export function GmatScene({ subject, command, reducedMotion, pt }: { subject: GmatSubject; command: { action: CameraAction; id: number }; reducedMotion: boolean; pt: boolean }) {
 const time = trajectoryViewer(s => s.time), invalidate = useThree(s => s.invalidate);
 const body = bodyOf(subject), radiusKm = CONSTANTS[body].radius.v;
 const geometry = useMemo(() => {
  if (subject.kind === 'orbit') {
   const path = orbitPath(subject.orbit).map(p => toScene(p, radiusKm)), { periapsis, apoapsis } = apsides(subject.orbit);
   return { kind: 'orbit' as const, path, periapsis: toScene(periapsis, radiusKm), apoapsis: toScene(apoapsis, radiusKm), frame: frameOf(path), extent: Math.max(1.3, ...path.map(p => Math.hypot(...p))) };
  }
  const runs = trajectoryRuns(subject.trajectory).map(run => run.map(s => ({ time: s.time, point: toScene(s.positionKm, radiusKm) })));
  return { kind: 'trajectory' as const, runs, frame: frameOf(runs.flat().map(s => s.point)), extent: Math.max(1.3, ...runs.flat().map(s => Math.hypot(...s.point))) };
 }, [subject, radiusKm]);
 const position: Vec3 | null = subject.kind === 'orbit' ? orbitStateAt(subject.orbit, time).position : sampleTrajectory(subject.trajectory, time);
 const craft = position ? toScene(position, radiusKm) : null;
 // Split each run at the current time: travelled history in gold, the rest in cyan.
 const runs = useMemo(() => geometry.kind === 'trajectory' ? geometry.runs.map(run => {
  const split = run.findIndex(s => s.time > time);
  return split < 0 ? { past: run.map(s => s.point), future: [] } : { past: run.slice(0, split).map(s => s.point), future: run.slice(Math.max(0, split - 1)).map(s => s.point) };
 }) : [], [geometry, time]);
 const iso = new Date(time).toISOString();
 const sun = useMemo(() => body === 'SUN' ? undefined : sunDirection(body, 0, undefined, iso), [body, iso]);
 const light = useMemo<[number, number, number]>(() => sun ? toScene(sun, .1) : [0, 0, 0], [sun]);
 // Equatorial reference circle just outside the orbit, so the orbit's tilt reads against it.
 const equator = useMemo(() => Array.from({ length: 128 }, (_, k) => [Math.cos(k / 128 * Math.PI * 2) * geometry.extent * 1.08, 0, Math.sin(k / 128 * Math.PI * 2) * geometry.extent * 1.08] as [number, number, number]), [geometry.extent]);
 const dot = geometry.extent * .012;
 const outward = (p: readonly number[]): [number, number, number] => { const k = 1 + geometry.extent * .07 / Math.hypot(...p); return [p[0]! * k, p[1]! * k, p[2]! * k]; };
 useEffect(() => { invalidate(); }, [time, subject, invalidate]);
 const label = subject.kind === 'orbit' ? subject.label : subject.trajectory.object;
 return <>
  <color attach="background" args={['#030812']}/>
  <Skybox/>
  <ambientLight intensity={body === 'SUN' ? .45 : .2}/>
  {body === 'SUN' ? <pointLight position={[0, 0, 0]} intensity={3.4} decay={0}/> : <directionalLight position={light} intensity={3.3}/>}
  <Planet body={body} radiusKm={1} sunDirection={sun} rotationRad={body === 'SUN' ? 0 : bodyRotationAngle(body, 0, iso)}/>
  <SceneLine points={equator} color="#8fc0e2" opacity={.35} closed dashed/>
  {geometry.kind === 'orbit' && <>
   <SceneLine points={geometry.path} color={ORBIT} opacity={.9} width={1.5} closed/>
   <mesh position={geometry.periapsis}><sphereGeometry args={[dot, 12, 8]}/><meshBasicMaterial color="#ffac51"/></mesh>
   <mesh position={geometry.apoapsis}><sphereGeometry args={[dot, 12, 8]}/><meshBasicMaterial color="#82b7ff"/></mesh>
   <SceneHtml position={outward(geometry.periapsis)} center zIndexRange={[2, 2]} style={{ pointerEvents: 'none' }}><span className="scene-fb-label">{pt ? 'Periapse' : 'Periapsis'} · {km((Math.hypot(...geometry.periapsis) - 1) * radiusKm, pt)}</span></SceneHtml>
   <SceneHtml position={outward(geometry.apoapsis)} center zIndexRange={[2, 2]} style={{ pointerEvents: 'none' }}><span className="scene-fb-label">{pt ? 'Apoapse' : 'Apoapsis'} · {km((Math.hypot(...geometry.apoapsis) - 1) * radiusKm, pt)}</span></SceneHtml>
  </>}
  {runs.map((run, index) => <group key={index}>
   {run.past.length > 1 && <SceneLine points={run.past} color={PAST} opacity={.95} width={2}/>}
   {run.future.length > 1 && <SceneLine points={run.future} color={ORBIT} opacity={.75} width={1.5}/>}
  </group>)}
  {craft && <>
   <SceneLine points={[[0, 0, 0], craft]} color={CRAFT} opacity={.35}/>
   <mesh position={craft} raycast={() => null}><sphereGeometry args={[dot * 1.4, 16, 12]}/><meshBasicMaterial color={CRAFT}/></mesh>
   <SceneHtml position={craft} center zIndexRange={[3, 3]} style={{ pointerEvents: 'none', transform: 'translateY(-18px)' }}><span className="scene-fb-label">{label}</span></SceneHtml>
  </>}
  <GmatCamera frame={geometry.frame} identity={subject} sun={sun ? light : null} command={command} reducedMotion={reducedMotion}/>
  <SceneHtml position={[0, -1, 0]} center zIndexRange={[1, 1]} style={{ pointerEvents: 'none', transform: 'translateY(14px)' }}><span className="scene-fb-label gmat-body-label">{{ EARTH: pt ? 'Terra' : 'Earth', MARS: pt ? 'Marte' : 'Mars', SUN: pt ? 'Sol' : 'Sun', MOON: pt ? 'Lua' : 'Moon' }[body]}</span></SceneHtml>
 </>;
}

const copy = {
 en: { orbit: 'Initial state · two-body conic', trajectory: 'Sampled external trajectory', sma: 'SMA', ecc: 'e', inc: 'i', angles: 'RAAN / AOP / TA', period: 'Period', pe: 'Periapsis altitude', ap: 'Apoapsis altitude', altitude: 'Altitude', speed: 'Speed', segments: 'Segments', samples: 'Samples', span: 'Span', facts: 'Orbit details', note: 'External reference only: no resources, objectives or score. The conic is ASTRIX two-body motion from the imported state, not GMAT propagation; sampled trajectories are linearly interpolated only across gaps up to 120 s.', gap: 'No state in this gap', play: 'Play', pause: 'Pause', start: 'Return to start', speedLabel: 'Playback speed', time: 'Time' },
 pt: { orbit: 'Estado inicial · cônica de dois corpos', trajectory: 'Trajetória externa amostrada', sma: 'SMA', ecc: 'e', inc: 'i', angles: 'RAAN / AOP / TA', period: 'Período', pe: 'Altitude do periapse', ap: 'Altitude do apoapse', altitude: 'Altitude', speed: 'Velocidade', segments: 'Segmentos', samples: 'Amostras', span: 'Duração', facts: 'Detalhes da órbita', note: 'Apenas referência externa: sem recursos, objetivos ou pontuação. A cônica é o movimento de dois corpos do ASTRIX a partir do estado importado, não a propagação do GMAT; trajetórias amostradas só são interpoladas linearmente em lacunas de até 120 s.', gap: 'Sem estado nesta lacuna', play: 'Reproduzir', pause: 'Pausar', start: 'Voltar ao início', speedLabel: 'Velocidade da reprodução', time: 'Tempo' },
};
function duration(seconds: number): string {
 const d = Math.floor(seconds / 86400), h = Math.floor(seconds % 86400 / 3600), m = Math.floor(seconds % 3600 / 60), s = Math.floor(seconds % 60);
 return d ? `${d} d ${h} h ${m} min` : h ? `${h} h ${m} min` : `${m} min ${s} s`;
}

export function GmatCaption({ subject, pt }: { subject: GmatSubject; pt: boolean }) {
 const time = trajectoryViewer(s => s.time), c = copy[pt ? 'pt' : 'en'], body = bodyOf(subject), radiusKm = CONSTANTS[body].radius.v;
 const [start] = subjectRange(subject), number = new Intl.NumberFormat(pt ? 'pt-BR' : 'en', { maximumFractionDigits: 4 });
 const state = subject.kind === 'orbit' ? orbitStateAt(subject.orbit, time) : null, position = state?.position ?? (subject.kind === 'trajectory' ? sampleTrajectory(subject.trajectory, time) : null);
 const name = { EARTH: pt ? 'Terra' : 'Earth', MARS: pt ? 'Marte' : 'Mars', SUN: pt ? 'Sol' : 'Sun', MOON: pt ? 'Lua' : 'Moon' }[body];
 return <div className="immersive-scene-caption gmat-scene-caption">
  <strong>{subject.kind === 'orbit' ? subject.label : subject.trajectory.object} · {name}</strong>
  <span>{subject.kind === 'orbit' ? c.orbit : `${subject.trajectory.source} · ${c.trajectory}`}</span>
  <span>{new Date(time).toISOString().replace('.000Z', 'Z')} · T+{duration((time - start) / 1000)}{position ? ` · ${c.altitude} ${km(Math.hypot(...position) - radiusKm, pt)}` : ` · ${c.gap}`}{state ? ` · ${c.speed} ${number.format(Math.hypot(...state.velocity))} km/s` : ''}</span>
  <details>
   <summary>{c.facts}</summary>
   {subject.kind === 'orbit' ? <dl>
    <dt>{c.sma}</dt><dd className="number">{km(subject.orbit.smaKm, pt)}</dd>
    <dt>{c.ecc}</dt><dd className="number">{number.format(subject.orbit.ecc)}</dd>
    <dt>{c.inc}</dt><dd className="number">{number.format(subject.orbit.inclinationDeg)}°</dd>
    <dt>{c.angles}</dt><dd className="number">{number.format(subject.orbit.raanDeg)}° / {number.format(subject.orbit.argPeriapsisDeg)}° / {number.format(subject.orbit.trueAnomalyDeg)}°</dd>
    <dt>{c.period}</dt><dd className="number">{duration(orbitPeriodSec(subject.orbit))}</dd>
    <dt>{c.pe}</dt><dd className="number">{km(subject.orbit.smaKm * (1 - subject.orbit.ecc) - radiusKm, pt)}</dd>
    <dt>{c.ap}</dt><dd className="number">{km(subject.orbit.smaKm * (1 + subject.orbit.ecc) - radiusKm, pt)}</dd>
   </dl> : <dl>
    <dt>{c.segments}</dt><dd className="number">{subject.trajectory.segments.length}</dd>
    <dt>{c.samples}</dt><dd className="number">{subject.trajectory.segments.reduce((n, s) => n + s.samples.length, 0)}</dd>
    <dt>{c.span}</dt><dd className="number">{duration((subjectRange(subject)[1] - start) / 1000)}</dd>
    <dt>Frame</dt><dd className="number">{subject.trajectory.frame} · {subject.trajectory.timeSystem}</dd>
   </dl>}
   <p>{c.note}</p>
  </details>
 </div>;
}

export function GmatTransport({ subject, pt }: { subject: GmatSubject; pt: boolean }) {
 const { time, playing, speed, seek, play, setSpeed } = trajectoryViewer(), c = copy[pt ? 'pt' : 'en'], [start, end] = subjectRange(subject);
 useEffect(() => {
  if (!playing) return;
  let previous = performance.now(), frame = 0;
  const tick = (now: number) => {
   const state = trajectoryViewer.getState(), advanced = state.time + (now - previous) * state.speed;
   previous = now;
   // A conic repeats; sampled data stops at its last sample.
   if (subject.kind === 'orbit') state.seek(start + (advanced - start) % (end - start));
   else if (advanced >= end) { state.seek(end); state.play(false); return; }
   else state.seek(advanced);
   frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
 }, [playing, subject, start, end]);
 return <div className="scene-fb-transport gmat-transport" role="group" aria-label={c.time}>
  <div className="scene-fb-transport-row">
   <button type="button" onClick={() => { if (!playing && time >= end && subject.kind === 'trajectory') seek(start); play(!playing); }} aria-label={playing ? c.pause : c.play} title={playing ? c.pause : c.play}>{playing ? <Pause size={17} strokeWidth={1.8}/> : <Play size={17} strokeWidth={1.8}/>}</button>
   <div className="scene-fb-speeds" role="group" aria-label={c.speedLabel}>{PLAYBACK_SPEEDS.map(value => <button key={value} type="button" aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value < 60 ? `${value}×` : value < 3600 ? `${value / 60} min/s` : `${value / 3600} h/s`}</button>)}</div>
   <button type="button" onClick={() => { play(false); seek(start); }} aria-label={c.start} title={c.start}><RotateCcw size={17} strokeWidth={1.8}/></button>
  </div>
  <label className="gmat-scrubber"><span className="sr-only">{c.time}</span><input type="range" min={start} max={end} step={1000} value={time} onChange={event => { play(false); seek(Number(event.target.value)); }}/></label>
 </div>;
}
