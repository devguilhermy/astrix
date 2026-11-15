import { Component, useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type KeyboardEvent, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus, Plus, RotateCcw } from 'lucide-react';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { useTranslation } from 'react-i18next';
import { CONSTANTS, type BodyId, type Design, type TurnGameState } from '@astrix/core';
import { InstalledSpacecraft } from './spacecraft/InstalledSpacecraft';
import { ComponentDetails } from './spacecraft/ComponentDetails';
import { ComponentPicker } from './spacecraft/ComponentPicker';
import { installedInstances } from './spacecraft/model';
import { BUS_GEOMETRY } from './spacecraft/slots';
import { Planet } from './space/Planet';
import { Skybox } from './space/Skybox';
import { SceneLine } from './ScenePrimitives';
import { committedScene, type CommittedScene, type ScenePoint, type SceneView } from './committedScene';
import { SOLAR_BODIES, SOLAR_OVERVIEW, SolarSystemCaption, SolarSystemScene, type SolarBodyId } from './SolarSystemScene';
import { detectQuality } from './quality';
import './immersive.css';

export interface AppCanvasProps {
  design: Design | null;
  game: TurnGameState | null;
  body: BodyId;
  view: SceneView;
  reducedMotion: boolean;
  onSelectDestination?: (body: BodyId) => void;
}
type CameraAction = 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'reset';
type CameraMode = 'craft' | 'orbit';
const CAMERA_KEYS: Readonly<Record<string, CameraAction>> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '=': 'in', '-': 'out', '0': 'reset', Home: 'reset' };
const INITIAL_CAMERA: { position: ScenePoint; fov: number; near: number; far: number } = { position: [2.4, 1.15, 3.5], fov: 38, near: .002, far: 2000 };
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function SceneCamera({ scene, mode, view, command, reducedMotion, solarFocus }: { scene: CommittedScene; mode: CameraMode; view: SceneView; command: { action: CameraAction; id: number }; reducedMotion: boolean; solarFocus?: { position: ScenePoint; radius: number; overview: boolean } }) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const initial = useRef({ position: new Vector3(), target: new Vector3() });
  const appliedCommand = useRef(0);
  const framedContext = useRef<string | null>(null);
  const craftView = !!scene.design && mode === 'craft';
  const span = solarFocus ? Math.max(1, solarFocus.radius) : Math.max(1, Math.hypot(...scene.craft));
  const minimum = solarFocus ? solarFocus.overview ? .4 : solarFocus.radius * 1.15 : craftView ? .45 : 1.25;
  const context = solarFocus ? ['solar', ...solarFocus.position, solarFocus.radius].join(':') : [scene.identity, scene.body, mode].join(':');
  const maximum = Math.max(span * 25 + 20, controls.current ? camera.position.distanceTo(controls.current.target) : 0);
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !controls.current) return;
    const mobile = size.width <= 900;
    const missionPanels = view === 'prepare' || view === 'play' && !scene.current?.ended;
    const resources = view === 'play' && !!scene.current;
    const top = resources ? 180 : 70;
    const left = mobile || solarFocus ? 0 : missionPanels ? size.width >= 1280 ? 526 : 28 + Math.min(510, size.width * .4) + Math.min(480, size.width * .36) : Math.min(676, size.width - 16);
    const right = !mobile && missionPanels && size.width >= 1280 ? 496 : 0;
    const openWidth = Math.max(180, size.width - left - right);
    const openHeight = solarFocus ? Math.max(180, size.height - 230) : mobile ? Math.max(96, (resources ? Math.max(size.height * .42, 308) : size.height * .42) - top) : size.height - (resources ? 280 : 150);
    const centreX = (left + openWidth / 2) / size.width;
    const centreY = solarFocus ? .47 : mobile || resources ? (top + openHeight / 2) / size.height : .48;
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
    camera.near = .002;
    camera.far = Math.max(2000, span * 40);
    camera.updateProjectionMatrix();
    controls.current.update();
    initial.current.position.copy(target).add(offset);
    initial.current.target.copy(target);
    invalidate();
  }, [camera, size.width, size.height, scene, span, craftView, view, solarFocus, context, invalidate]);
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
    invalidate();
  }, [command, camera, minimum, maximum, invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={!!solarFocus} enableDamping={!reducedMotion} dampingFactor={.15} minDistance={minimum} maxDistance={maximum} keyEvents={false}/>;
}

function PhysicalWorld({ scene, orbitVisible, selectedKey, view, onInspect, onClose }: { scene: CommittedScene; orbitVisible: boolean; selectedKey: string | null; view: SceneView; onInspect: (key: string) => void; onClose: () => void }) {
  const sun = scene.current?.sunDir;
  const light: ScenePoint = sun ? [sun[0] * 8, sun[2] * 8, -sun[1] * 8] : [5, 3, 5];
  const size = scene.design ? Math.max(...BUS_GEOMETRY[scene.design.busId].dimensions) : 1;
  const clearance: ScenePoint[] = scene.marker ? [scene.marker, scene.craft] : [];
  return <>
    <color attach="background" args={['#030812']}/>
    <Skybox/>
    <ambientLight intensity={.7}/>
    <directionalLight position={light} intensity={3.3}/>
    <directionalLight position={[-3, 2, -4]} intensity={.85} color="#8db5de"/>
    <Planet body={scene.body} radiusKm={1} sunDirection={sun} rotationRad={scene.rotation}/>
    {scene.moon && <group position={scene.moon}><Planet body="MOON" radiusKm={CONSTANTS.MOON.radius.v / scene.radiusKm} sunDirection={sun} lowResolution/></group>}
    {scene.earth && <group position={scene.earth}><Planet body="EARTH" radiusKm={CONSTANTS.EARTH.radius.v / scene.radiusKm} sunDirection={sun} lowResolution/></group>}
    {orbitVisible && scene.orbit.length > 1 && <SceneLine points={scene.orbit} color="#e1be7e" opacity={.35}/>}
    {scene.trail.length > 1 && <SceneLine points={scene.trail} color="#76dce8" opacity={.8}/>}
    {scene.marker && <group position={scene.marker}><mesh><sphereGeometry args={[.012, 12, 8]}/><meshBasicMaterial color="#b5f5ff" depthTest={false}/></mesh></group>}
    {scene.marker && <SceneLine points={clearance} color="#a7d2de" opacity={.45}/>}
    {scene.design && <group position={scene.craft} quaternion={scene.attitude} scale={.25 / size}>
      <InstalledSpacecraft design={scene.design} telemetry={scene.current} selectedKey={selectedKey} view={view} onInspect={onInspect} onClose={onClose}/>
    </group>}
  </>;
}

/** One persistent world. Only React props from accepted decisions change the physical state. */
export function AppCanvas({ design, game, body, view, reducedMotion, onSelectDestination }: AppCanvasProps) {
  const { t, i18n } = useTranslation();
  const pt = i18n.resolvedLanguage?.startsWith('pt');
  const scene = useMemo(() => committedScene(design, game, body, view), [design, game, body, view]);
  const [failed, setFailed] = useState(false), [retry, setRetry] = useState(0), [mode, setMode] = useState<CameraMode>('craft');
  const [command, setCommand] = useState<{ action: CameraAction; id: number }>({ action: 'reset', id: 0 });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [solarSelection, setSolarSelection] = useState<SolarBodyId | 'SYSTEM'>('SYSTEM');
  const solarBody = SOLAR_BODIES.find(item => item.id === solarSelection);
  const solarFocus = useMemo(() => view === 'solar' ? solarBody ? { position: solarBody.position, radius: solarBody.radius, overview: false } : { ...SOLAR_OVERVIEW, overview: true } : undefined, [view, solarBody]);
  const componentSelect = useRef<HTMLButtonElement>(null);
  const installed = useMemo(() => scene.design ? installedInstances(scene.design) : [], [scene.design]);
  const selected = installed.find(instance => instance.key === selectedKey);
  const inspect = useCallback((key: string) => { setSelectedKey(key || null); setMode('craft'); }, []);
  const closeDetails = useCallback(() => { setSelectedKey(null); componentSelect.current?.focus({ preventScroll: true }); }, []);
  const act = useCallback((action: CameraAction) => setCommand(previous => ({ action, id: previous.id + 1 })), []);
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest('select, input, textarea, [contenteditable="true"]')) return;
    const action = CAMERA_KEYS[event.key];
    if (!action || failed) return;
    event.preventDefault(); act(action);
  };
  const fallback = <div className="immersive-scene-fallback" role="status"><strong>{pt ? 'A vista 3D está indisponível' : 'The 3D view is unavailable'}</strong><p>{pt ? 'A missão, os dados e todos os controles dos painéis continuam funcionando.' : 'Your mission, data and all panel controls still work.'}</p><button type="button" onClick={() => { setFailed(false); setRetry(value => value + 1); }}>{pt ? 'Tentar 3D novamente' : 'Retry 3D'}</button></div>;
  const name = ({ EARTH: pt ? 'Terra' : 'Earth', MOON: pt ? 'Lua' : 'Moon', MARS: pt ? 'Marte' : 'Mars' })[scene.body];
  const number = new Intl.NumberFormat(pt ? 'pt-BR' : 'en', { maximumFractionDigits: 1 });
  const actions = [
    { action: 'left', Icon: ChevronLeft, label: pt ? 'Girar câmera à esquerda' : 'Orbit camera left' },
    { action: 'right', Icon: ChevronRight, label: pt ? 'Girar câmera à direita' : 'Orbit camera right' },
    { action: 'up', Icon: ChevronUp, label: pt ? 'Girar câmera para cima' : 'Orbit camera up' },
    { action: 'down', Icon: ChevronDown, label: pt ? 'Girar câmera para baixo' : 'Orbit camera down' },
    { action: 'in', Icon: Plus, label: pt ? 'Aproximar câmera' : 'Zoom camera in' },
    { action: 'out', Icon: Minus, label: pt ? 'Afastar câmera' : 'Zoom camera out' },
    { action: 'reset', Icon: RotateCcw, label: pt ? 'Redefinir câmera' : 'Reset camera' },
  ] as const;
  return <section className="immersive-scene" data-view={view} data-hardware={!!scene.design} data-debrief={view === 'play' && !!scene.current?.ended} tabIndex={0} onKeyDown={keyboard} aria-label={pt ? 'Vista espacial 3D. Setas giram a câmera; mais e menos aproximam; zero redefine.' : '3D space view. Arrow keys orbit; plus and minus zoom; zero resets.'} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - 0">
    <div className="immersive-scene-render">
      {failed ? fallback : <SceneBoundary key={retry} fallback={fallback} onFailure={() => setFailed(true)}><Canvas frameloop="demand" dpr={[1, 1.5]} camera={INITIAL_CAMERA} gl={{ antialias: true, powerPreference: 'low-power', logarithmicDepthBuffer: true }} fallback={null} onCreated={({ gl }) => {
        detectQuality(gl.getContext());
        gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); setFailed(true); }, { once: true });
      }}>
        {view === 'solar' ? <SolarSystemScene selected={solarSelection} onFocus={setSolarSelection}/> : <PhysicalWorld scene={scene} orbitVisible={mode === 'orbit'} selectedKey={selected?.key ?? null} view={view} onInspect={inspect} onClose={closeDetails}/>}
        <SceneCamera scene={scene} mode={mode} view={view} command={command} reducedMotion={reducedMotion} solarFocus={solarFocus}/>
      </Canvas></SceneBoundary>}
    </div>
    {failed && selected && scene.design && <div className="immersive-component-fallback"><ComponentDetails part={selected.part} design={scene.design} current={scene.current} onClose={closeDetails}/></div>}
    {view === 'solar' && <SolarSystemCaption body={solarBody}/>}
    {view !== 'solar' && <div className="immersive-scene-caption">
      <strong>{name}{scene.physical ? ` · T+${number.format(scene.current!.t)} s` : scene.design ? pt ? ' · Prévia do equipamento' : ' · Equipment preview' : pt ? ' · Destino' : ' · Destination'}</strong>
      <span>{scene.physical && scene.current?.flight ? `${number.format(scene.current.flight.view.altitudeKm)} km · ${number.format(scene.current.flight.view.speedKms)} km/s` : scene.cruise ? pt ? 'Transferência analítica; trajetória espacial não representada.' : 'Analytic transfer; no spatial transfer path is modelled.' : pt ? 'Contexto do destino; não é uma trajetória de voo.' : 'Destination context, not a flight trajectory.'}</span>
      <details><summary>{pt ? 'Escala e fontes' : 'Scale & sources'}</summary><p>{scene.physical ? pt ? 'Estado fixo na decisão confirmada. Ciano: histórico amostrado e posição real. Dourado na vista orbital: cônica osculante, não previsão. Equipamento ampliado; afastamento da superfície esquemático. Distâncias planetárias em escala comum.' : 'Fixed at the committed decision. Cyan: sampled history and actual position. Gold in orbit view: osculating conic, not a forecast. Hardware enlarged; surface clearance schematic. Planetary distances share one scale.' : pt ? 'Composição e separação do equipamento ilustrativas. Apenas componentes do projeto; nenhum voo é simulado nesta vista.' : 'Equipment composition and separation are illustrative. Only design components are shown; this view does not simulate flight.'}</p><p>{pt ? 'Mapas históricos locais: NASA Blue / Black Marble, Viking e LRO Moon Kit. Estrelas: NASA SVS, ESA / Gaia / DPAC. Não são observações atuais.' : 'Local historical maps: NASA Blue / Black Marble, Viking and LRO Moon Kit. Stars: NASA SVS, ESA / Gaia / DPAC. Not current observations.'} <a href={`${import.meta.env.BASE_URL}textures/asset-sources.json`} target="_blank" rel="noreferrer">{pt ? 'Proveniência dos arquivos' : 'Asset provenance'}</a></p></details>
    </div>}
    <div className="immersive-scene-controls" role="group" aria-label={pt ? 'Controles da câmera, sem avançar o tempo da missão' : 'Camera controls; never advance mission time'}>
      {view === 'solar' && <div className="immersive-camera-modes"><select className="immersive-component-select" aria-label={pt ? 'Explorar um astro' : 'Explore a celestial body'} value={solarSelection} onChange={event => setSolarSelection(event.target.value as SolarBodyId | 'SYSTEM')}><option value="SYSTEM">{pt ? 'Sistema solar' : 'Solar system'}</option>{SOLAR_BODIES.map(item => <option key={item.id} value={item.id}>{item.name[pt ? 'pt' : 'en']}</option>)}</select><button type="button" onClick={() => setSolarSelection('SYSTEM')}>{pt ? 'Visão geral' : 'Overview'}</button>{solarBody?.destination && onSelectDestination && <button type="button" onClick={() => onSelectDestination(solarBody.destination!)}>{pt ? 'Missões neste destino' : 'Missions here'}</button>}</div>}
      {scene.design && <div className="immersive-camera-modes"><button type="button" aria-pressed={mode === 'craft'} onClick={() => setMode('craft')}>{pt ? 'Equipamento' : 'Spacecraft'}</button><button type="button" aria-pressed={mode === 'orbit'} onClick={() => setMode('orbit')}>{pt ? 'Órbita' : 'Orbit'}</button><ComponentPicker instances={installed} selectedKey={selected?.key ?? null} onSelect={inspect} triggerRef={componentSelect}/></div>}
      <div className="immersive-camera-buttons">{actions.map(({ action, Icon, label }) => <button type="button" key={action} title={label} aria-label={label} disabled={failed} onClick={() => act(action)}><Icon size={17} strokeWidth={1.6}/></button>)}</div>
    </div>
  </section>;
}
