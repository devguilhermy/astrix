import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Mesh, MeshStandardMaterial, WebGLRenderer } from 'three';
import { useTranslation } from 'react-i18next';
import { CONSTANTS, createStarterDesign, listScenarios, type Design, type HistorySample, type Telemetry } from '@astrix/core';
import { liveMission, useMission } from '../store';
import { OrbitScene } from './OrbitScene';
import { TransferScene, type TransferPlayback } from './TransferScene';
import { AssemblyScene } from './AssemblyScene';
import { LaunchScene, type LaunchPresentation } from './LaunchScene';
import { AdaptivePixelBudget } from './AdaptivePixelBudget';
import { detectQuality, getQualityTier, runFrameProbeOnce, useQualityProfile } from './quality';
import { WebGLFailureNotice } from './WebGLFailureNotice';
import { ApplicationErrorPanel } from '../ui/primitives/ApplicationErrorPanel';
import { PreviewSnapshot } from './previewSnapshots';
import { CameraRig, type CameraBridge } from './camera/CameraRig';
import { prepareMissionScene, sceneKind, sceneRadius, type SceneKind } from './missionScenes';
import { CameraControls } from '../ui/scene/CameraControls';
import { SceneCaption } from '../ui/scene/SceneCaption';
import { trajectoryViewer } from '../ui/advanced/trajectoryStore';
import { TrajectoryScene } from './TrajectoryScene';
import { reviewPlayback } from '../ui/advanced/reviewPlayback';
import '../ui/scene/scene.css';
import { SpaceBackdrop } from './space/SpaceBackdrop';
import { MissionPoseProvider } from './space/useMissionPose';
import { getSpaceTextureBytes } from './space/textures';
import { isCloseShot, resolveCameraMode, useCameraMode, type CameraMode } from './camera/modes';
import { PilotDragSurface } from '../ui/flight/PilotControls';
import { usePilot } from '../ui/flight/pilotState';
import { PartTracker } from './spacecraft/PartTracker';
import { BUS_GEOMETRY } from './spacecraft/slots';

interface AppCanvasProps { onReady?(): void; onFailure?(error?: unknown): void }
class RenderBoundary extends Component<{ children: ReactNode; onFailure(error?: unknown): void }, { failed: boolean; error?: unknown }> {
 state: { failed: boolean; error?: unknown } = { failed: false };
 static getDerivedStateFromError(error: unknown) { return { failed: true, error }; }
 componentDidCatch(error: Error) { this.props.onFailure(error); }
 render() { return this.state.failed ? <ApplicationErrorPanel renderer error={this.state.error}/> : this.props.children; }
}
function CommittedDraw({ identity, ready, onReady, onFailure }: { identity: string; ready: boolean; onReady?: () => void; onFailure(error?: unknown): void }) {
 const invalidate = useThree(state => state.invalidate);
 const acknowledged = useRef<{ identity: string; callback: () => void } | null>(null);
 const measuredAt = useRef(0);
 useEffect(() => { invalidate(); }, [identity, ready, onReady, invalidate]);
 useFrame(({ gl, scene, camera }) => {
  if (gl.getContext().isContextLost()) return;
  try {
   // Positive priority owns the existing root's draw, not a second renderer/loop.
   gl.render(scene, camera);
   if (performance.now() - measuredAt.current > 1000 || measuredAt.current === 0) {
    measuredAt.current = performance.now();
    const maps = new Set<string>(); let bytes = 0;
    scene.traverse(object => {
     if (!(object instanceof Mesh)) return;
     for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof MeshStandardMaterial) || !material.map || maps.has(material.map.uuid)) continue;
      const image = material.map.image as {width?: number; height?: number} | undefined;
      if (!image?.width || !image.height) continue;
      maps.add(material.map.uuid); bytes += image.width * image.height * 4 * (material.map.generateMipmaps ? 4 / 3 : 1);
     }
    });
    Object.assign(gl.domElement.dataset, {qualityTier:getQualityTier(), drawCalls:String(gl.info.render.calls), textureCount:String(gl.info.memory.textures), surfaceTextureBytesEstimate:String(Math.round(bytes + getSpaceTextureBytes())), textureBytesEstimate:String(Math.round(bytes + getSpaceTextureBytes()))});
   }
   if (ready && onReady && gl.info.render.calls > 0 && !gl.getContext().isContextLost() && (acknowledged.current?.identity !== identity || acknowledged.current?.callback !== onReady)) {
    acknowledged.current = { identity, callback: onReady };
    onReady();
   }
  } catch (error) { onFailure(error); }
 }, 1);
 return null;
}
function MissionComposition({ design, kind, mode, live, preview, telemetry, reviewSample, referenceOnly, presentation, reducedMotion, onComplete, onStage, transferPlayback, onTransferComplete }: { design: Design; kind: SceneKind; mode: CameraMode; live: boolean; preview: boolean; telemetry: Telemetry | null; reviewSample: HistorySample | null; referenceOnly: boolean; presentation: LaunchPresentation; reducedMotion: boolean; onComplete(): void; onStage(stage: number): void; transferPlayback: TransferPlayback | null; onTransferComplete(): void }) {
 const invalidate = useThree(state => state.invalidate);
 useEffect(() => { invalidate(); }, [design, kind, mode, live, preview, telemetry, reviewSample, referenceOnly, presentation, reducedMotion, invalidate]);
 return <>
  <ambientLight intensity={.09}/><SpaceBackdrop design={design} live={live} planet={kind !== 'transfer'} sunDisc={kind !== 'transfer'} body={kind === 'launch' ? 'EARTH' : undefined}/>
  {kind === 'assembly' ? <AssemblyScene design={design} previewEquipment reducedMotion={reducedMotion}/> : kind === 'launch' ? <LaunchScene design={design} presentation={presentation} reducedMotion={reducedMotion} previewEquipment={preview} onComplete={onComplete} onStage={onStage}/> : kind === 'transfer' ? <TransferScene design={design} playback={transferPlayback} onComplete={onTransferComplete}/> : <OrbitScene design={design} live={live} previewEquipment={preview} telemetry={telemetry} reviewSample={reviewSample} referenceOnly={referenceOnly} mode={mode} reducedMotion={reducedMotion}/>}
 </>;
}

export function AppCanvas({ onReady, onFailure: reportFailure }: AppCanvasProps) {
 const { t } = useTranslation();
 const stage = useMission(state => state.activeStage), substep = useMission(state => state.activeSubstep), activeView = useMission(state => state.activeView);
 const activeDesign = useMission(state => state.design), scenarioId = useMission(state => state.scenarioId), levelId = useMission(state => state.levelId);
 const previewMissionId = useMission(state => state.previewMissionId), previewLevelId = useMission(state => state.previewLevelId);
 const viewer = trajectoryViewer(state => state.active), external = trajectoryViewer(state => state.trajectory);
 const selectedSample = reviewPlayback(state => state.sample);
 const sim = useMission(state => state.sim), telemetry = useMission(state => state.telemetry), running = useMission(state => state.running), reducedMotion = useMission(state => state.settings.reducedMotion);
 const quality = useQualityProfile(), bridge = useRef<CameraBridge | null>(null);
 const requestedMode = useCameraMode(state => state.mode), pilot = usePilot(state => state.enabled);
 const cameraSource = useCameraMode(state => state.source);
 const warp = useMission(state => state.warp), advancing = useMission(state => state.advancing);
 const [launchStage, setLaunchStage] = useState(0);
 const attempt = useMission(state => state.attemptId), latestEvent = useMission(state => state.events.at(-1)), pendingDecision = useMission(state => state.pendingDecisions.length);
 const briefingShot = useRef(''), eventShot = useRef('');
 const [transferPlayback, setTransferPlayback] = useState<TransferPlayback | null>(null);
 const previousCruise = useRef({ active: false, t: 0, generation: -1 });
 const [failed, setFailed] = useState(false), [domReady, setDomReady] = useState(false), [cameraReady, setCameraReady] = useState(false), [exploring, setExploring] = useState(false);
 const [surfaceError, setSurfaceError] = useState('');
 const [touch, setTouch] = useState(() => typeof matchMedia === 'function' && matchMedia('(any-pointer: coarse)').matches);
 const [presentation, setPresentation] = useState<LaunchPresentation>('IDLE');
 const preview = previewMissionId !== null, mission = previewMissionId ?? activeDesign?.scenarioId ?? scenarioId;
 const selectedLevel = preview ? previewLevelId ?? levelId : activeDesign?.levelId ?? levelId;
 const starter = useMemo(() => createStarterDesign(mission, selectedLevel), [mission, selectedLevel]);
 const design = preview ? starter : activeDesign ?? starter;
 const kit = prepareMissionScene(mission);
 const live = !preview && !!sim && (stage === 'IMPLEMENT' || stage === 'REVIEW');
 const reviewSample = !viewer && stage === 'REVIEW' && !preview ? selectedSample : null;
 const crewPhase = reviewSample?.phase ?? (live ? telemetry?.crew?.phase : undefined);
 const referenceOnly = !viewer && mission === 'CREW_PATHFINDER' && (crewPhase === 'DEORBIT' || crewPhase === 'RECOVERY' || crewPhase === 'COMPLETE');
 const baseKind = transferPlayback ? 'transfer' : reviewSample ? (reviewSample.phase === 'CRUISE' ? 'transfer' : 'orbit') : stage === 'IMPLEMENT' && !sim ? 'launch' : stage === 'DESIGN' && (substep === 'orbit' || activeView === 'LAUNCH_ORBIT') ? 'orbit' : sceneKind(stage, mission, live && !!telemetry?.cruise);
 const mode = viewer ? 'MAP' : resolveCameraMode(requestedMode, baseKind, live ? warp : 1, advancing, reducedMotion, cameraSource);
 const kind: SceneKind = baseKind === 'assembly' && mode === 'MAP' ? 'orbit' : baseKind;
 const externalRadius = useMemo(() => {
  if (!external) return 0;
  let max = 1;
  for (const segment of external.segments) for (const sample of segment.samples) max = Math.max(max, Math.hypot(...sample.positionKm) / CONSTANTS[external.body].radius.v);
  return max * 1.65 * 1.1;
 }, [external]);
 const radius = viewer ? externalRadius : isCloseShot(mode, kind) && kind !== 'launch' ? Math.max(...BUS_GEOMETRY[design.busId].dimensions) * .001 * 1.25 : sceneRadius(kit, kind, design);
 const identity = viewer ? `viewer:${external?.source}:${external?.object}:${external?.body}` : `${reviewSample ? 'review' : preview ? 'preview' : 'active'}:${mission}:${selectedLevel}:${kind}:${liveMission.generation}`;
 const readyIdentity = `${identity}:${stage}:${design.revision}`;
 const starters = useMemo(() => listScenarios().map(scenario => createStarterDesign(scenario.id, selectedLevel)), [selectedLevel]);
 const onFailure = useCallback((error?: unknown) => { setFailed(true); reportFailure?.(error); }, [reportFailure]);
 const onDomMounted = useCallback(() => { setDomReady(true); }, []);
 const onCameraMounted = useCallback(() => { setCameraReady(true); }, []);
 const onComplete = useCallback(() => { setPresentation('COMPLETE'); }, []);
 const onTransferComplete = useCallback(() => { setTransferPlayback(null); }, []);
 useEffect(() => {
  const key = `${attempt}:${mission}:${selectedLevel}`;
  if (!preview && stage === 'NEED_GOALS' && !reducedMotion && cameraSource === 'AUTO' && briefingShot.current !== key) { briefingShot.current = key; useCameraMode.getState().setMode('CINEMATIC', 'AUTO'); }
 }, [attempt, mission, selectedLevel, preview, stage, reducedMotion, cameraSource]);
 useEffect(() => {
  if (!latestEvent || preview || stage !== 'IMPLEMENT' || reducedMotion || pendingDecision || warp > 100 || pilot || cameraSource === 'USER') return;
  const key = `${liveMission.generation}:${latestEvent.kind}:${latestEvent.t}`;
  if (eventShot.current !== key && ['DEPLOYMENT_DONE', 'PASS_START', 'CAPTURE_DONE'].includes(latestEvent.kind)) { eventShot.current = key; useCameraMode.getState().setMode('CINEMATIC', 'AUTO'); }
 }, [latestEvent, preview, stage, reducedMotion, pendingDecision, warp, pilot, cameraSource]);
 useLayoutEffect(() => {
  const previous = previousCruise.current;
  if (!preview && stage === 'IMPLEMENT' && !reducedMotion && previous.active && !telemetry?.cruise && previous.generation === liveMission.generation && telemetry) setTransferPlayback({ fromSec: previous.t, toSec: telemetry.t });
  if (reducedMotion || preview || stage !== 'IMPLEMENT') setTransferPlayback(null);
  previousCruise.current = { active: !!telemetry?.cruise, t: telemetry?.t ?? 0, generation: liveMission.generation };
 }, [telemetry?.cruise, telemetry?.t, preview, stage, reducedMotion]);
 useEffect(() => {
  const media = matchMedia('(any-pointer: coarse)');
  const update = () => { setTouch(media.matches); };
  media.addEventListener('change', update);
  return () => { media.removeEventListener('change', update); };
 }, []);
 useEffect(() => {
  const report = (event: Event) => setSurfaceError(String((event as CustomEvent<string>).detail));
  window.addEventListener('astrix-surface-error', report);
  return () => window.removeEventListener('astrix-surface-error', report);
 }, []);
 useEffect(() => { setPresentation('IDLE'); setExploring(false); }, [identity]);
 useEffect(() => { if (reducedMotion && presentation === 'PLAYING') setPresentation('COMPLETE'); }, [reducedMotion, presentation]);
 useEffect(() => { if (running && live) runFrameProbeOnce(); }, [running, live]);
 useEffect(() => { if (stage !== 'REVIEW') reviewPlayback.getState().exit(); }, [stage]);
 return <div className={`canvas-shell mission-scene${exploring ? ' is-exploring' : ''}`} role="region" aria-label={t('scene.region')} aria-describedby="scene-description" data-camera-mode={mode} data-scene-mission={mission} data-scene-stage={stage} data-scene-preview={preview} data-scene-reference-only={referenceOnly} data-review-time={reviewSample?.t} data-review-phase={reviewSample?.phase}>
  <RenderBoundary onFailure={onFailure}><MissionPoseProvider design={design} kind={kind} mode={mode} live={live} telemetry={live ? telemetry : null} reviewSample={reviewSample}><Canvas className="scene-renderer" aria-hidden="true" frameloop={failed ? 'never' : !viewer && !reviewSample && live && running ? 'always' : 'demand'} dpr={[1, quality.dprMax]} gl={defaults => {
   try { return new WebGLRenderer({ ...defaults, antialias: quality.msaa, alpha: true, logarithmicDepthBuffer: true, powerPreference: 'low-power' }); }
   catch (error) { queueMicrotask(() => onFailure(error)); throw error; }
  }} camera={{ position: [5, 3.6, 6.8], fov: 43, near: .0000001, far: 1e9 }} onCreated={({ gl }) => { gl.setClearColor('#02050b', 0); detectQuality(gl.getContext()); }} fallback={<ApplicationErrorPanel renderer/>}>
   {viewer ? <><SpaceBackdrop design={design} planet={false}/><TrajectoryScene/></> : <MissionComposition design={design} kind={kind} mode={mode} live={live} preview={preview} telemetry={live ? telemetry : null} reviewSample={reviewSample} referenceOnly={referenceOnly} presentation={presentation} reducedMotion={reducedMotion} onComplete={onComplete} onStage={setLaunchStage} transferPlayback={transferPlayback} onTransferComplete={onTransferComplete}/>}
   {!viewer && starters.map(item => <PreviewSnapshot key={`${item.scenarioId}:${item.levelId}`} design={item}/>)}
   {!viewer && activeDesign && <PreviewSnapshot key={`built:${activeDesign.scenarioId}:${activeDesign.levelId}`} design={activeDesign}/>}
   <CameraRig identity={identity} kit={kit} kind={viewer ? 'orbit' : kind} mode={mode} radius={radius} orbit={viewer ? null : design.orbit} reducedMotion={reducedMotion} interactive={(!touch || exploring) && !pilot} bridge={bridge} onMounted={onCameraMounted} viewer={viewer}/>
   {!viewer && <PartTracker/>}
   <CommittedDraw identity={readyIdentity} ready={domReady && cameraReady && !failed} onReady={onReady} onFailure={onFailure}/>
   <WebGLFailureNotice onFailure={onFailure}/><AdaptivePixelBudget enabled={live && running}/>
  </Canvas></MissionPoseProvider></RenderBoundary>
  {!preview && live && stage === 'IMPLEMENT' && <PilotDragSurface/>}
  <section className="scene-dom">
   <CameraControls bridge={bridge} effectiveMode={mode} exploring={exploring} touch={touch} ready={cameraReady && !failed} onExplore={setExploring} onMounted={onDomMounted}/>
   {!viewer && kind === 'launch' && <section className="scene-launch-presentation" aria-label={t('scene.launch')}><p role="status">{t(`flight.launchStage${launchStage}`)}</p><p>{t(reducedMotion ? 'flight.launchStatic' : 'scene.launch')}</p><div className="button-wrap"><button type="button" onClick={() => setPresentation(presentation === 'PLAYING' ? 'COMPLETE' : 'PLAYING')}>{t(presentation === 'PLAYING' ? 'scene.skip' : presentation === 'COMPLETE' ? 'scene.replay' : 'scene.play')}</button>{presentation !== 'COMPLETE' && <button type="button" onClick={onComplete}>{t('scene.skip')}</button>}</div></section>}
   {transferPlayback && <section className="scene-launch-presentation"><p>{t('flight.timeLapse')}</p><button type="button" onClick={onTransferComplete}>{t('scene.skip')}</button></section>}
   {!viewer && <SceneCaption design={design} mission={mission} stage={stage} kind={kind} preview={preview} hasFlight={!!sim} running={running} telemetry={live && !reviewSample ? telemetry : null} technical={selectedLevel === 'EXPERT'} reviewing={!!reviewSample} referenceOnly={referenceOnly}/>}
   {reviewSample && <p role="status">{t('scene.recorded')} · t={reviewSample.t.toFixed(1)} s · {t(`flow.phase.${reviewSample.phase}`, {defaultValue: reviewSample.phase})}. {t(referenceOnly ? 'scene.recordedReference' : reviewSample.phase === 'CRUISE' ? 'flight.transferLimits' : 'scene.recordedPose')}</p>}
   {surfaceError && <p role="status">{t('scene.surfaceUnavailable', {file: surfaceError})}</p>}
  </section>
  {failed && <ApplicationErrorPanel renderer/>}
 </div>;
}
