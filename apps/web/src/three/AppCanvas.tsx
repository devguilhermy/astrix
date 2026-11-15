import { Component, useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type KeyboardEvent, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus, Plus, RotateCcw } from 'lucide-react';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { useTranslation } from 'react-i18next';
import { CONSTANTS, type BodyId, type Design, type TurnGameState } from '@astrix/core';
import { InstalledSpacecraft } from './spacecraft/InstalledSpacecraft';
import { BUS_GEOMETRY } from './spacecraft/slots';
import { Planet } from './space/Planet';
import { Skybox } from './space/Skybox';
import { SceneLine } from './ScenePrimitives';
import { committedScene, type CommittedScene, type ScenePoint, type SceneView } from './committedScene';
import { detectQuality } from './quality';
import './immersive.css';

export interface AppCanvasProps {
  design: Design | null;
  game: TurnGameState | null;
  body: BodyId;
  view: SceneView;
  reducedMotion: boolean;
}
type CameraAction = 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'reset';
type CameraMode = 'craft' | 'orbit';
const CAMERA_KEYS: Readonly<Record<string, CameraAction>> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '=': 'in', '-': 'out', '0': 'reset', Home: 'reset' };
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function SceneCamera({ scene, mode, view, command, reducedMotion }: { scene: CommittedScene; mode: CameraMode; view: SceneView; command: { action: CameraAction; id: number }; reducedMotion: boolean }) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const initial = useRef({ position: new Vector3(), target: new Vector3() });
  const appliedCommand = useRef(0);
  const craftView = !!scene.design && mode === 'craft';
  const span = Math.max(1, Math.hypot(...scene.craft));
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !controls.current) return;
    const mobile = size.width <= 900;
    const missionPanels = view === 'play' || view === 'prepare';
    const left = mobile ? 0 : missionPanels ? size.width >= 1100 ? 340 : 660 : 440;
    const right = !mobile && missionPanels && size.width >= 1100 ? 320 : 0;
    const openWidth = Math.max(180, size.width - left - right);
    const openHeight = mobile ? Math.max(150, size.height * .42 - 70) : size.height - 150;
    const centreX = (left + openWidth / 2) / size.width;
    const centreY = mobile ? (70 + openHeight / 2) / size.height : .48;
    camera.setViewOffset(size.width, size.height, (.5 - centreX) * size.width, (.5 - centreY) * size.height, size.width, size.height);
    const framing = Math.max(1, size.height / openHeight, size.height / openWidth * .85);
    const target = craftView ? new Vector3(...scene.craft) : new Vector3();
    let offset: Vector3;
    if (craftView) {
      const radial = target.clone().normalize();
      const tangent = new Vector3().crossVectors(radial, new Vector3(0, 1, 0));
      if (tangent.lengthSq() < .01) tangent.set(1, 0, 0);
      // A close hardware shot, not a camera travelling along a simulated trajectory.
      offset = radial.multiplyScalar(.72).addScaledVector(tangent.normalize(), .56).add(new Vector3(0, .32, 0)).normalize().multiplyScalar(1.15 * framing);
    } else {
      offset = new Vector3(2.4, 1.15, 3.5).normalize().multiplyScalar((scene.design ? Math.max(3.8, span * 2.1) : 3.8) * framing);
    }
    controls.current.target.copy(target);
    camera.position.copy(target).add(offset);
    camera.near = .002;
    camera.far = Math.max(2000, span * 40);
    camera.updateProjectionMatrix();
    controls.current.update();
    initial.current.position.copy(camera.position);
    initial.current.target.copy(target);
    invalidate();
  }, [camera, size.width, size.height, scene, span, craftView, view, invalidate]);
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
      spherical.radius = Math.max(craftView ? .45 : 1.25, Math.min(span * 25 + 20, spherical.radius));
      spherical.makeSafe();
      camera.position.copy(orbit.target).add(offset.setFromSpherical(spherical));
    }
    orbit.update();
    invalidate();
  }, [command, camera, craftView, span, invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping={!reducedMotion} dampingFactor={.15} minDistance={craftView ? .45 : 1.25} maxDistance={span * 25 + 20} keyEvents={false}/>;
}

function PhysicalWorld({ scene, orbitVisible }: { scene: CommittedScene; orbitVisible: boolean }) {
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
      <InstalledSpacecraft design={scene.design} telemetry={scene.current}/>
    </group>}
  </>;
}

/** One persistent world. Only React props from accepted decisions change the physical state. */
export function AppCanvas({ design, game, body, view, reducedMotion }: AppCanvasProps) {
  const { i18n } = useTranslation();
  const pt = i18n.resolvedLanguage?.startsWith('pt');
  const scene = useMemo(() => committedScene(design, game, body, view), [design, game, body, view]);
  const [failed, setFailed] = useState(false), [retry, setRetry] = useState(0), [mode, setMode] = useState<CameraMode>('craft');
  const [command, setCommand] = useState<{ action: CameraAction; id: number }>({ action: 'reset', id: 0 });
  const act = useCallback((action: CameraAction) => setCommand(previous => ({ action, id: previous.id + 1 })), []);
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
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
  return <section className="immersive-scene" data-view={view} data-hardware={!!scene.design} tabIndex={0} onKeyDown={keyboard} aria-label={pt ? 'Vista espacial 3D. Setas giram a câmera; mais e menos aproximam; zero redefine.' : '3D space view. Arrow keys orbit; plus and minus zoom; zero resets.'} aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - 0">
    <div className="immersive-scene-render">
      {failed ? fallback : <SceneBoundary key={retry} fallback={fallback} onFailure={() => setFailed(true)}><Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [2.4, 1.15, 3.5], fov: 38, near: .002, far: 2000 }} gl={{ antialias: true, powerPreference: 'low-power', logarithmicDepthBuffer: true }} fallback={fallback} onCreated={({ gl }) => {
        detectQuality(gl.getContext());
        gl.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); setFailed(true); }, { once: true });
      }}>
        <PhysicalWorld scene={scene} orbitVisible={mode === 'orbit'}/>
        <SceneCamera scene={scene} mode={mode} view={view} command={command} reducedMotion={reducedMotion}/>
      </Canvas></SceneBoundary>}
    </div>
    <div className="immersive-scene-caption">
      <strong>{name}{scene.physical ? ` · T+${number.format(scene.current!.t)} s` : scene.design ? pt ? ' · Prévia do equipamento' : ' · Equipment preview' : pt ? ' · Destino' : ' · Destination'}</strong>
      <span>{scene.physical && scene.current?.flight ? `${number.format(scene.current.flight.view.altitudeKm)} km · ${number.format(scene.current.flight.view.speedKms)} km/s` : scene.cruise ? pt ? 'Transferência analítica; trajetória espacial não representada.' : 'Analytic transfer; no spatial transfer path is modelled.' : pt ? 'Contexto do destino; não é uma trajetória de voo.' : 'Destination context, not a flight trajectory.'}</span>
      <details><summary>{pt ? 'Escala e fontes' : 'Scale & sources'}</summary><p>{scene.physical ? pt ? 'Estado fixo na decisão confirmada. Ciano: histórico amostrado e posição real. Dourado na vista orbital: cônica osculante, não previsão. Equipamento ampliado; afastamento da superfície esquemático. Distâncias planetárias em escala comum.' : 'Fixed at the committed decision. Cyan: sampled history and actual position. Gold in orbit view: osculating conic, not a forecast. Hardware enlarged; surface clearance schematic. Planetary distances share one scale.' : pt ? 'Composição e separação do equipamento ilustrativas. Apenas componentes do projeto; nenhum voo é simulado nesta vista.' : 'Equipment composition and separation are illustrative. Only design components are shown; this view does not simulate flight.'}</p><p>{pt ? 'Mapas históricos locais: NASA Blue / Black Marble e Viking. Estrelas: NASA SVS, ESA / Gaia / DPAC. Lua: esfera sem textura; não é um mapa lunar.' : 'Local historical maps: NASA Blue / Black Marble and Viking. Stars: NASA SVS, ESA / Gaia / DPAC. Moon: untextured sphere, not a lunar surface map.'} <a href={`${import.meta.env.BASE_URL}textures/asset-sources.json`} target="_blank" rel="noreferrer">{pt ? 'Proveniência dos arquivos' : 'Asset provenance'}</a></p></details>
    </div>
    <div className="immersive-scene-controls" role="group" aria-label={pt ? 'Controles da câmera, sem avançar o tempo da missão' : 'Camera controls; never advance mission time'}>
      {scene.design && <div className="immersive-camera-modes"><button type="button" aria-pressed={mode === 'craft'} onClick={() => setMode('craft')}>{pt ? 'Equipamento' : 'Spacecraft'}</button><button type="button" aria-pressed={mode === 'orbit'} onClick={() => setMode('orbit')}>{pt ? 'Órbita' : 'Orbit'}</button></div>}
      <div className="immersive-camera-buttons">{actions.map(({ action, Icon, label }) => <button type="button" key={action} title={label} aria-label={label} disabled={failed} onClick={() => act(action)}><Icon size={17} strokeWidth={1.6}/></button>)}</div>
    </div>
  </section>;
}
