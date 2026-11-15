import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type KeyboardEvent, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ScenePortalContext, SceneHtml } from './SceneHtml';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus, Plus, RotateCcw } from 'lucide-react';
import { PerspectiveCamera, Spherical, Vector3, type DirectionalLight, type Group } from 'three';
import { useTranslation } from 'react-i18next';
import { CONSTANTS, type BodyId, type Design, type TurnGameState } from '@astrix/core';
import { turnMoments, type TurnMoment } from '../ui/play/turnMoments';
import { InstalledSpacecraft } from './spacecraft/InstalledSpacecraft';
import { ComponentDetails } from './spacecraft/ComponentDetails';
import { ComponentPicker } from './spacecraft/ComponentPicker';
import { installedInstances } from './spacecraft/model';
import { Planet } from './space/Planet';
import { Skybox } from './space/Skybox';
import { SceneLine, type SceneLineObject } from './ScenePrimitives';
import { EARTH_MARKER_RADIUS, committedScene, type CommittedScene, type ScenePoint, type SceneView } from './committedScene';
import { SOLAR_BODIES, SOLAR_OVERVIEW, SolarSystemCaption, SolarSystemScene, type SolarBodyId } from './SolarSystemScene';
import { TurnFeedback, feedbackGeometry } from './feedback/TurnFeedback';
import { TurnMarkers } from './feedback/TurnMarkers';
import { turnEventText } from './feedback/turnLabels';
import { LaunchStack } from './playback/LaunchStack';
import { usePlayback, usePlaybackFrame, type PlaybackControl, type PlaybackTargets } from './playback/PlaybackController';
import { PlaybackTransport } from './playback/Transport';
import { detectQuality } from './quality';
import { ExploreFlight, ExploreHud, type ExploreTelemetry } from './explore';
import './immersive.css';

export interface AppCanvasProps {
  design: Design | null;
  game: TurnGameState | null;
  body: BodyId;
  view: SceneView;
  reducedMotion: boolean;
  onSelectDestination?: (body: BodyId) => void;
  moments?: readonly TurnMoment[];
  selectedTurn?: number | null;
  onSelectTurn?: (index: number) => void;
  solarBody: SolarBodyId | 'SYSTEM';
  onSolarBody: (id: SolarBodyId | 'SYSTEM') => void;
}
type CameraAction = 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'reset';
type CameraMode = 'craft' | 'orbit';
interface SolarFocus { position: ScenePoint; radius: number; overview: boolean }
const CAMERA_KEYS: Readonly<Record<string, CameraAction>> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '=': 'in', '-': 'out', '0': 'reset', Home: 'reset' };
const INITIAL_CAMERA: { position: ScenePoint; fov: number; near: number; far: number } = { position: [2.4, 1.15, 3.5], fov: 38, near: .002, far: 2000 };
const SUN_DISPLAY_RADIUS = SOLAR_BODIES.find(item => item.id === 'SUN')?.radius ?? 1;
const NO_MOMENTS: readonly TurnMoment[] = [];
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const clampScratch = new Vector3();
/** Pushes the camera back outside a sphere so user zoom and orbit cannot enter a body. */
function keepOutside(position: Vector3, centre: readonly number[], radius: number): boolean {
  clampScratch.set(position.x - centre[0]!, position.y - centre[1]!, position.z - centre[2]!);
  const distance = clampScratch.length();
  if (distance >= radius) return false;
  if (distance < 1e-9) clampScratch.set(0, 0, 1);
  clampScratch.setLength(radius);
  position.set(centre[0]! + clampScratch.x, centre[1]! + clampScratch.y, centre[2]! + clampScratch.z);
  return true;
}

function SceneCamera({ scene, mode, view, command, reducedMotion, solarFocus }: { scene: CommittedScene; mode: CameraMode; view: SceneView; command: { action: CameraAction; id: number }; reducedMotion: boolean; solarFocus?: SolarFocus }) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const initial = useRef({ position: new Vector3(), target: new Vector3() });
  const appliedCommand = useRef(0);
  const framedContext = useRef<string | null>(null);
  const craftView = !!scene.design && mode === 'craft';
  const span = solarFocus ? Math.max(1, solarFocus.radius) : Math.max(1, Math.hypot(...scene.craft));
  // Solar bodies range from radius 0.015 to the Sun's 6: stay outside the focused body, and outside the Sun in the overview.
  const minimum = solarFocus ? solarFocus.overview ? SUN_DISPLAY_RADIUS * 1.15 : solarFocus.radius * 1.15 : craftView ? .45 : 1.25;
  const context = solarFocus ? ['solar', ...solarFocus.position, solarFocus.radius].join(':') : [scene.identity, scene.body, mode].join(':');
  const maximum = Math.max(span * 25 + 20, solarFocus ? 120 : 0, controls.current ? camera.position.distanceTo(controls.current.target) : 0);
  const clamp = useCallback(() => {
    let moved = false;
    if (solarFocus) for (const item of SOLAR_BODIES) moved = keepOutside(camera.position, item.position, item.radius * 1.05 + .002) || moved;
    else {
      moved = keepOutside(camera.position, [0, 0, 0], scene.shell + .03);
      const second = scene.moon ?? scene.earth;
      if (second) moved = keepOutside(camera.position, second, scene.secondaryRadius * 1.03) || moved;
    }
    if (moved) invalidate();
  }, [camera, solarFocus, scene, invalidate]);
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !controls.current) return;
    const mobile = size.width <= 900;
    const ended = view === 'play' && !!scene.current?.ended;
    const missionPanels = view === 'prepare' || view === 'play';
    const resources = view === 'play' && !!scene.current;
    const bodySelected = !!solarFocus && !solarFocus.overview;
    const top = resources ? 132 : 64, bottom = ended ? 200 : 100;
    const left = mobile || solarFocus ? 0 : missionPanels ? size.width >= 1280 ? 526 : 28 + Math.min(510, size.width * .4) + Math.min(480, size.width * .36) : Math.min(676, size.width - 16);
    const right = mobile ? 0 : bodySelected ? 496 : missionPanels && size.width >= 1280 ? 496 : 0;
    const openWidth = Math.max(180, size.width - left - right);
    // At 900 px and below a selected body's panel is a bottom sheet over the lower 55 %.
    const openHeight = solarFocus ? mobile && bodySelected ? Math.max(120, size.height * .45 - 64) : Math.max(180, size.height - 230) : mobile ? Math.max(96, (resources ? Math.max(size.height * .42, 308) : size.height * .42) - top) : Math.max(180, size.height - top - bottom);
    const centreX = (left + openWidth / 2) / size.width;
    const centreY = solarFocus ? mobile && bodySelected ? (64 + openHeight / 2) / size.height : .47 : (top + openHeight / 2) / size.height;
    camera.setViewOffset(size.width, size.height, (.5 - centreX) * size.width, (.5 - centreY) * size.height, size.width, size.height);
    const framing = Math.max(1, size.height / openHeight, size.height / openWidth * (solarFocus ? 1.05 : .85));
    const target = solarFocus ? new Vector3(...solarFocus.position) : craftView ? new Vector3(...scene.craft) : new Vector3();
    let offset: Vector3;
    if (craftView) {
      const radial = target.clone().normalize();
      const tangent = new Vector3().crossVectors(radial, new Vector3(0, 1, 0));
      if (tangent.lengthSq() < .01) tangent.set(1, 0, 0);
      // A close hardware shot, not a camera travelling along a simulated trajectory.
      offset = radial.multiplyScalar(.72).addScaledVector(tangent.normalize(), .56).add(new Vector3(0, .32, 0)).normalize().multiplyScalar(1.15 * framing);
    } else {
      const distance = solarFocus ? solarFocus.radius * (solarFocus.overview ? mobile ? 3.2 : 1.9 : 5.5) : scene.design ? Math.max(3.8, span * 2.1) : 3.8;
      offset = (solarFocus?.overview ? new Vector3(1.2, 3, 2.5) : new Vector3(2.4, 1.15, 3.5)).normalize().multiplyScalar(distance * framing);
    }
    if (framedContext.current !== context) {
      controls.current.target.copy(target);
      camera.position.copy(target).add(offset);
      framedContext.current = context;
    } else {
      // Follow accepted positions without replacing the user's orbit, zoom or pan.
      const delta = target.clone().sub(initial.current.target);
      camera.position.add(delta);
      controls.current.target.add(delta);
    }
    // The near plane stays below the smallest focus distance (Moon radius 0.015 × 1.15).
    camera.near = solarFocus ? Math.min(.002, minimum * .1) : .002;
    camera.far = Math.max(2000, span * 40, solarFocus ? 600 : 0);
    camera.updateProjectionMatrix();
    controls.current.update();
    clamp();
    initial.current.position.copy(target).add(offset);
    initial.current.target.copy(target);
    invalidate();
  }, [camera, size.width, size.height, scene, span, craftView, view, solarFocus, context, minimum, clamp, invalidate]);
  useLayoutEffect(() => {
    if (!controls.current || command.id === appliedCommand.current) return;
    appliedCommand.current = command.id;
    const orbit = controls.current;
    if (command.action === 'reset') {
      camera.position.copy(initial.current.position);
      orbit.target.copy(initial.current.target);
    } else {
      const offset = camera.position.clone().sub(orbit.target);
      const spherical = new Spherical().setFromVector3(offset);
      if (command.action === 'left') spherical.theta -= .2;
      if (command.action === 'right') spherical.theta += .2;
      if (command.action === 'up') spherical.phi -= .16;
      if (command.action === 'down') spherical.phi += .16;
      if (command.action === 'in') spherical.radius *= .82;
      if (command.action === 'out') spherical.radius /= .82;
      spherical.radius = Math.max(minimum, Math.min(maximum, spherical.radius));
      spherical.makeSafe();
      camera.position.copy(orbit.target).add(offset.setFromSpherical(spherical));
    }
    orbit.update();
    clamp();
    invalidate();
  }, [command, camera, minimum, maximum, clamp, invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={!!solarFocus} enableDamping={!reducedMotion} dampingFactor={.15} minDistance={minimum} maxDistance={maximum} keyEvents={false} onChange={clamp}/>;
}

function PhysicalWorld({ scene, orbitVisible, selectedKey, view, onInspect, onClose, playback, followCraft, pt }: { scene: CommittedScene; orbitVisible: boolean; selectedKey: string | null; view: SceneView; onInspect: (key: string) => void; onClose: () => void; playback: PlaybackControl | null; followCraft: boolean; pt: boolean }) {
  const craft = useRef<Group>(null), hardware = useRef<Group>(null), stack = useRef<Group>(null), marker = useRef<Group>(null), planet = useRef<Group>(null), secondary = useRef<Group>(null);
  const light = useRef<DirectionalLight>(null), tether = useRef<SceneLineObject>(null), trail = useRef<SceneLineObject>(null), head = useRef<SceneLineObject>(null);
  // One stable Sun direction: the planets read it every frame, the replay rewrites it in place.
  const sun = useMemo<[number, number, number]>(() => [1, 0, 0], []);
  const targets = useMemo<PlaybackTargets>(() => ({ craft, hardware, stack, marker, tether, planet, secondary, light, trail, head, sun }), [sun]);
  usePlaybackFrame(scene, playback, targets, { followCraft, showHardware: !!selectedKey });
  const sunDir = scene.current?.sunDir;
  const lightPosition = useMemo<ScenePoint>(() => sunDir ? [sunDir[0] * 8, sunDir[2] * 8, -sunDir[1] * 8] : [5, 3, 5], [sunDir]);
  const clearance = useMemo<ScenePoint[]>(() => scene.marker ? [scene.marker, scene.craft] : [], [scene.marker, scene.craft]);
  const headPoints = useMemo<ScenePoint[]>(() => [[0, 0, 0], [0, 0, 1e-6]], []);
  const second = scene.moon ?? scene.earth;
  const solar = scene.body === 'SUN';
  const earthSun = useMemo<[number, number, number] | undefined>(() => scene.earth ? [-scene.earth[0], scene.earth[2], -scene.earth[1]] : undefined, [scene.earth]);
  const planetSun = scene.current ? sun : undefined;
  return <>
    <color attach="background" args={['#030812']}/>
    <Skybox/>
    <ambientLight intensity={solar ? .45 : .7}/>
    {solar ? <pointLight position={[0, 0, 0]} intensity={3.4} decay={0}/> : <directionalLight ref={light} position={lightPosition} intensity={3.3}/>}
    <directionalLight position={[-3, 2, -4]} intensity={.85} color="#8db5de"/>
    <Planet ref={planet} body={scene.body} radiusKm={1} sunDirection={planetSun} rotationRad={scene.rotation}/>
    {solar && <sprite scale={[.02, .02, 1]} raycast={() => null}><spriteMaterial color="#ffd38a" sizeAttenuation={false} depthWrite={false}/></sprite>}
    {second && <group ref={secondary} position={second}>
      {scene.body === 'EARTH' && <Planet body="MOON" radiusKm={CONSTANTS.MOON.radius.v / scene.radiusKm} sunDirection={planetSun} lowResolution/>}
      {scene.body === 'MOON' && <Planet body="EARTH" radiusKm={CONSTANTS.EARTH.radius.v / scene.radiusKm} sunDirection={planetSun} lowResolution/>}
      {solar && <>
        <Planet body="EARTH" radiusKm={EARTH_MARKER_RADIUS} sunDirection={earthSun} lowResolution/>
        <sprite scale={[.014, .014, 1]} raycast={() => null}><spriteMaterial color="#66b8ec" sizeAttenuation={false} depthTest={false} depthWrite={false}/></sprite>
        <SceneHtml center zIndexRange={[2, 2]} style={{ pointerEvents: 'none', transform: 'translateY(-18px)' }}><span className="scene-fb-label">{pt ? 'Terra (ampliada)' : 'Earth (enlarged)'}</span></SceneHtml>
      </>}
    </group>}
    {solar && scene.earthOrbit.length > 1 && <SceneLine points={scene.earthOrbit} color="#8fc0e2" opacity={.55} width={1.2} closed/>}
    {orbitVisible && scene.orbit.length > 1 && <SceneLine points={scene.orbit} color="#e1be7e" opacity={.7} width={1.5}/>}
    {scene.trail.length > 1 && <SceneLine ref={trail} points={scene.trail} color="#76dce8" opacity={.8} width={2}/>}
    <SceneLine ref={head} points={headPoints} color="#76dce8" opacity={.8} width={2}/>
    {scene.marker && <group ref={marker} position={scene.marker}><mesh><sphereGeometry args={[.012, 12, 8]}/><meshBasicMaterial color="#b5f5ff" depthTest={false}/></mesh></group>}
    {scene.marker && <SceneLine ref={tether} points={clearance} color="#a7d2de" opacity={.45}/>}
    {scene.design && <>
      <group ref={craft} position={scene.craft} quaternion={scene.attitude} scale={scene.craftScale}>
        <group ref={hardware}><InstalledSpacecraft design={scene.design} telemetry={scene.current} selectedKey={selectedKey} view={view} onInspect={onInspect} onClose={onClose}/></group>
      </group>
      {scene.marker && <group ref={stack} position={scene.craft} visible={false}><LaunchStack scale={scene.hullRadius * 2}/></group>}
    </>}
  </>;
}

/** One persistent world. Only React props from accepted decisions change the physical state. */
export function AppCanvas({ design, game, body, view, reducedMotion, onSelectDestination, moments: givenMoments, selectedTurn = null, onSelectTurn, solarBody: solarSelection, onSolarBody }: AppCanvasProps) {
  const { i18n } = useTranslation();
  const pt = !!i18n.resolvedLanguage?.startsWith('pt');
  const scene = useMemo(() => committedScene(design, game, body, view), [design, game, body, view]);
  const moments = useMemo(() => givenMoments ?? (game ? turnMoments(game) : NO_MOMENTS), [givenMoments, game]);
  const [failed, setFailed] = useState(false), [retry, setRetry] = useState(0), [mode, setMode] = useState<CameraMode>('craft');
  const [command, setCommand] = useState<{ action: CameraAction; id: number }>({ action: 'reset', id: 0 });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Labels render into a host that exists before the Canvas mounts (see SceneHtml).
  const [labelHost, setLabelHost] = useState<HTMLDivElement | null>(null);
  const labelPortal = useMemo(() => labelHost ? { current: labelHost as HTMLElement } : undefined, [labelHost]);
  // Explore flight: presentation only; it never advances mission time.
  const [boarded, setBoarded] = useState(false);
  const [flightTarget, setFlightTarget] = useState<string | null>(null);
  const [flightTelemetry, setFlightTelemetry] = useState<ExploreTelemetry | null>(null);
  const solarBody = SOLAR_BODIES.find(item => item.id === solarSelection);
  const solarFocus = useMemo<SolarFocus | undefined>(() => view === 'solar' ? solarBody ? { position: solarBody.position, radius: solarBody.radius, overview: false } : { ...SOLAR_OVERVIEW, overview: true } : undefined, [view, solarBody]);
  const componentSelect = useRef<HTMLButtonElement>(null);
  const installed = useMemo(() => scene.design ? installedInstances(scene.design) : [], [scene.design]);
  const selected = installed.find(instance => instance.key === selectedKey);
  const inspect = useCallback((key: string) => { setSelectedKey(key || null); setMode('craft'); }, []);
  const closeDetails = useCallback(() => { setSelectedKey(null); componentSelect.current?.focus({ preventScroll: true }); }, []);
  const act = useCallback((action: CameraAction) => setCommand(previous => ({ action, id: previous.id + 1 })), []);
  const ended = view === 'play' && !!scene.current?.ended;
  const flying = boarded && view === 'solar' && !failed;
  useEffect(() => { if (view !== 'solar' || failed) setBoarded(false); }, [view, failed]);
  const board = useCallback(() => { setFlightTarget(solarBody?.id ?? null); setFlightTelemetry(null); setBoarded(true); onSolarBody('SYSTEM'); }, [solarBody, onSolarBody]);
  const leave = useCallback(() => setBoarded(false), []);
  // At mission end the camera opens on the whole flight, once per mission identity.
  const orbitDefaulted = useRef<string | null>(null);
  useEffect(() => {
    if (!ended || orbitDefaulted.current === scene.identity) return;
    orbitDefaulted.current = scene.identity;
    setMode('orbit');
  }, [ended, scene.identity]);
  const playback = usePlayback({ game, scene, moments, reducedMotion, view, selectedTurn, onSelectTurn, pt });
  const latest = moments.at(-1) ?? null;
  const shown = ended ? moments.find(item => item.index === selectedTurn) ?? latest : latest;
  const geometry = useMemo(() => feedbackGeometry(scene, shown, shown === latest), [scene, shown, latest]);
  const animateFeedback = playback.feedback.animate && playback.feedback.index === shown?.index;
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (flying) return;
    if (event.target instanceof Element && event.target.closest('select, input, textarea, [contenteditable="true"]')) return;
    const action = CAMERA_KEYS[event.key];
    if (!action || failed) return;
    event.preventDefault(); act(action);
  };
  const fallback = <div className="immersive-scene-fallback" role="status"><strong>{pt ? 'A vista 3D está indisponível' : 'The 3D view is unavailable'}</strong><p>{pt ? 'A missão, os dados e todos os controles dos painéis continuam funcionando.' : 'Your mission, data and all panel controls still work.'}</p><button type="button" onClick={() => { setFailed(false); setRetry(value => value + 1); }}>{pt ? 'Tentar 3D novamente' : 'Retry 3D'}</button></div>;
  const name = ({ EARTH: pt ? 'Terra' : 'Earth', MOON: pt ? 'Lua' : 'Moon', MARS: pt ? 'Marte' : 'Mars', SUN: pt ? 'Sol' : 'Sun' })[scene.body];
  const number = new Intl.NumberFormat(pt ? 'pt-BR' : 'en', { maximumFractionDigits: 1 });
  const megabytes = new Intl.NumberFormat(pt ? 'pt-BR' : 'en', { maximumFractionDigits: 2 });
  const eventLine = geometry && !playback.active ? turnEventText(geometry.moment, !!geometry.moment.stationKm && geometry.moment.body === scene.body && scene.body !== 'SUN', pt, megabytes) : '';
  const transport = view === 'play' && scene.physical && !!scene.design && moments.length > 0 && !reducedMotion && !failed;
  const actions = [
    { action: 'left', Icon: ChevronLeft, label: pt ? 'Girar câmera à esquerda' : 'Orbit camera left' },
    { action: 'right', Icon: ChevronRight, label: pt ? 'Girar câmera à direita' : 'Orbit camera right' },
    { action: 'up', Icon: ChevronUp, label: pt ? 'Girar câmera para cima' : 'Orbit camera up' },
    { action: 'down', Icon: ChevronDown, label: pt ? 'Girar câmera para baixo' : 'Orbit camera down' },
    { action: 'in', Icon: Plus, label: pt ? 'Aproximar câmera' : 'Zoom camera in' },
    { action: 'out', Icon: Minus, label: pt ? 'Afastar câmera' : 'Zoom camera out' },
    { action: 'reset', Icon: RotateCcw, label: pt ? 'Redefinir câmera' : 'Reset camera' },
  ] as const;
  return <section className="immersive-scene" data-view={view} data-hardware={!!scene.design} data-debrief={ended} data-transport={transport} data-solar-body={view === 'solar' && !!solarBody} data-flying={flying} tabIndex={0} onKeyDown={keyboard} aria-label={flying ? pt ? 'Vista espacial 3D. Você está a bordo da nave de exploração; os controles de voo estão no painel de voo.' : '3D space view. You are aboard the exploration ship; flight controls are in the flight panel.' : pt ? 'Vista espacial 3D. Setas giram a câmera; mais e menos aproximam; zero redefine.' : '3D space view. Arrow keys orbit; plus and minus zoom; zero resets.'} aria-keyshortcuts={flying ? undefined : 'ArrowLeft ArrowRight ArrowUp ArrowDown + - 0'}>
    <div className="immersive-scene-render">
      <div className="immersive-scene-labels" ref={setLabelHost}/>
      {failed ? fallback : labelPortal && <ScenePortalContext.Provider value={labelPortal}><SceneBoundary key={retry} fallback={fallback} onFailure={() => setFailed(true)}><Canvas frameloop="demand" dpr={[1, 1.5]} camera={INITIAL_CAMERA} gl={{ antialias: true, powerPreference: 'low-power', logarithmicDepthBuffer: true }} fallback={null} onCreated={({ gl }) => {
        detectQuality(gl.getContext());
        gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); setFailed(true); }, { once: true });
      }}>
        {view === 'solar' ? <>
          <SolarSystemScene selected={flying ? 'SYSTEM' : solarSelection} onFocus={flying ? setFlightTarget : onSolarBody}/>
          <ExploreFlight boarded={flying} bodies={SOLAR_BODIES} target={flightTarget} reducedMotion={reducedMotion} onTelemetry={setFlightTelemetry}/>
        </> : <>
          <PhysicalWorld scene={scene} orbitVisible={mode === 'orbit'} selectedKey={selected?.key ?? null} view={view} onInspect={inspect} onClose={closeDetails} playback={playback.control} followCraft={mode === 'craft' && !!scene.design} pt={pt}/>
          {geometry && !playback.active && <TurnFeedback scene={scene} geometry={geometry} animateKey={playback.feedback.key} animate={animateFeedback} reducedMotion={reducedMotion} pt={pt}/>}
          {ended && !playback.active && <TurnMarkers scene={scene} moments={moments} selected={shown?.index ?? null} onSelect={onSelectTurn} pt={pt}/>}
        </>}
        {!flying && <SceneCamera scene={scene} mode={mode} view={view} command={command} reducedMotion={reducedMotion} solarFocus={solarFocus}/>}
      </Canvas></SceneBoundary></ScenePortalContext.Provider>}
    </div>
    {failed && selected && scene.design && <div className="immersive-component-fallback"><ComponentDetails part={selected.part} design={scene.design} current={scene.current} onClose={closeDetails}/></div>}
    {view === 'solar' && !flying && <SolarSystemCaption body={solarBody}/>}
    {view === 'solar' && !failed && <ExploreHud boarded={flying} onBoard={board} onLeave={leave} telemetry={flightTelemetry} bodies={SOLAR_BODIES} target={flightTarget} onTarget={setFlightTarget} reducedMotion={reducedMotion}/>}
    {view !== 'solar' && <div className="immersive-scene-caption">
      <strong>{name}{scene.physical ? ` · T+${number.format(scene.current!.t)} s` : scene.design ? pt ? ' · Prévia do equipamento' : ' · Equipment preview' : pt ? ' · Destino' : ' · Destination'}</strong>
      <span>{scene.physical && scene.current?.flight ? `${number.format(scene.current.flight.view.altitudeKm)} km · ${number.format(scene.current.flight.view.speedKms)} km/s` : scene.physical && scene.current ? scene.body === 'SUN' ? `${megabytes.format(Math.hypot(...scene.current.positionKm) / 149597870.7)} AU ${pt ? 'do Sol' : 'from the Sun'}` : `${number.format(scene.altitudeKm)} km` : scene.cruise ? pt ? 'Transferência analítica; trajetória espacial não representada.' : 'Analytic transfer; no spatial transfer path is modelled.' : pt ? 'Contexto do destino; não é uma trajetória de voo.' : 'Destination context, not a flight trajectory.'}</span>
      {view === 'play' && <p className="scene-fb-event" role="status">{eventLine}</p>}
      <details><summary>{pt ? 'Escala e fontes' : 'Scale & sources'}</summary><p>{scene.physical ? pt ? `Estado fixo na decisão confirmada. Ciano: histórico amostrado e posição real. Dourado na vista orbital: cônica osculante, não previsão. Equipamento ampliado; afastamento da superfície esquemático. Distâncias planetárias em escala comum. A reprodução interpola entre amostras registradas; turnos longos são acelerados.${scene.body === 'SUN' ? ' Vista centrada no Sol: unidades de raio solar; o marcador da Terra está ampliado cerca de 55 vezes e sua órbita é esquemática.' : ''}` : `Fixed at the committed decision. Cyan: sampled history and actual position. Gold in orbit view: osculating conic, not a forecast. Hardware enlarged; surface clearance schematic. Planetary distances share one scale. Replay interpolates between recorded samples; long turns are time-lapsed.${scene.body === 'SUN' ? ' Sun-centred view in solar radii; the Earth marker is enlarged about 55 times and its orbit is schematic.' : ''}` : pt ? 'Composição e separação do equipamento ilustrativas. Apenas componentes do projeto; nenhum voo é simulado nesta vista.' : 'Equipment composition and separation are illustrative. Only design components are shown; this view does not simulate flight.'}</p><p>{pt ? 'Mapas históricos locais: NASA Blue / Black Marble, Viking, LRO Moon Kit e STEREO + SDO 304 Å. Estrelas: NASA SVS, ESA / Gaia / DPAC. Não são observações atuais.' : 'Local historical maps: NASA Blue / Black Marble, Viking, LRO Moon Kit and STEREO + SDO 304 Å. Stars: NASA SVS, ESA / Gaia / DPAC. Not current observations.'} <a href={`${import.meta.env.BASE_URL}textures/asset-sources.json`} target="_blank" rel="noreferrer">{pt ? 'Proveniência dos arquivos' : 'Asset provenance'}</a></p></details>
    </div>}
    {!flying && <div className="immersive-scene-controls">
      {transport && <PlaybackTransport playback={playback} ended={ended} pt={pt}/>}
      <div className="scene-fb-camera" role="group" aria-label={pt ? 'Controles da câmera, sem avançar o tempo da missão' : 'Camera controls; never advance mission time'}>
        {view === 'solar' && <div className="immersive-camera-modes"><select className="immersive-component-select" aria-label={pt ? 'Explorar um astro' : 'Explore a celestial body'} value={solarSelection} onChange={event => onSolarBody(event.target.value as SolarBodyId | 'SYSTEM')}><option value="SYSTEM">{pt ? 'Sistema solar' : 'Solar system'}</option>{SOLAR_BODIES.map(item => <option key={item.id} value={item.id}>{item.name[pt ? 'pt' : 'en']}</option>)}</select><button type="button" onClick={() => onSolarBody('SYSTEM')}>{pt ? 'Visão geral' : 'Overview'}</button>{solarBody?.destination && onSelectDestination && <button type="button" onClick={() => onSelectDestination(solarBody.destination!)}>{pt ? 'Missões neste destino' : 'Missions here'}</button>}</div>}
        {scene.design && <div className="immersive-camera-modes"><button type="button" aria-pressed={mode === 'craft'} onClick={() => setMode('craft')}>{pt ? 'Equipamento' : 'Spacecraft'}</button><button type="button" aria-pressed={mode === 'orbit'} onClick={() => setMode('orbit')}>{pt ? 'Órbita' : 'Orbit'}</button><ComponentPicker instances={installed} selectedKey={selected?.key ?? null} onSelect={inspect} triggerRef={componentSelect}/></div>}
        <div className="immersive-camera-buttons">{actions.map(({ action, Icon, label }) => <button type="button" key={action} title={label} aria-label={label} disabled={failed} onClick={() => act(action)}><Icon size={17} strokeWidth={1.6}/></button>)}</div>
      </div>
    </div>}
  </section>;
}
