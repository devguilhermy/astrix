import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef, type RefObject } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import type { OrbitChoice } from '@astrix/core';
import { radians, rotatePerifocal } from '@astrix/core/physics';
import type { MissionSceneDefinition, SceneKind } from '../missionScenes';
import { relativePosition, renderDirection } from '../space/FloatingOrigin';
import { useMissionPose } from '../space/useMissionPose';
import { approachFactor, cameraClearance } from './approach';
import { CAMERA_DISTANCE_RESPONSE, CAMERA_RECENTER_RESPONSE, CAMERA_UP_RESPONSE, isCloseShot, useCameraMode, type CameraMode } from './modes';

export type CameraAction = 'left' | 'right' | 'up' | 'down' | 'panLeft' | 'panRight' | 'panUp' | 'panDown' | 'zoomIn' | 'zoomOut' | 'fit' | 'reset' | 'focus' | 'body' | 'plane' | 'station';
export interface CameraBridge { execute(action: CameraAction): void }
interface CameraPose { position: [number, number, number]; target: [number, number, number]; up: [number, number, number] }
const poses = new Map<string, CameraPose>();

/** Chase/free/quick-look PATTERN: Void Protocol CameraController.tsx @218625d
 * (1102 LOC), owner-authorized selected reuse under Apache-2.0. Scene/input gates are ASTRIX-specific.
 * R3F delta is wall time: never multiply the camera clock by simulation warp.
 */
export function CameraRig({ identity, kit, kind, mode, radius, orbit, reducedMotion, interactive, bridge, onMounted, viewer = false }: {
 identity: string; kit: MissionSceneDefinition; kind: SceneKind; mode: CameraMode; radius: number; orbit: OrbitChoice | null;
 reducedMotion: boolean; interactive: boolean; bridge: RefObject<CameraBridge | null>; onMounted(): void; viewer?: boolean;
}) {
 const { camera, scene, gl, size, invalidate } = useThree();
 const readPose = useMissionPose();
 const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
 const scratch = useMemo(() => ({ offset: new Vector3(), right: new Vector3(), up: new Vector3(0, 1, 0), delta: new Vector3(), previous: new Vector3(), target: new Vector3(), desired: new Vector3(), radial: new Vector3(), tangent: new Vector3(), planet: new Vector3(), spherical: new Spherical() }), []);
 const bounds = useRef(radius);
 const framing = useRef(1);
 const moved = useRef(false);
 const idleSince = useRef(0);
 const tracking = useRef({ discontinuity: -1, mode, identity });
 const chaseDistance = useRef(radius * 3.2);
 const shotElapsed = useRef(0);
 const close = isCloseShot(mode, kind) && !viewer;
 const poseKey = `${identity}:${mode}`;
 bounds.current = radius;
 const save = useCallback(() => {
  const control = controls.current;
  if (!control) return;
  poses.set(poseKey, { position: camera.position.toArray(), target: control.target.toArray(), up: camera.up.toArray() });
  if (poses.size > 80) poses.delete(poses.keys().next().value!);
 }, [camera, poseKey]);
 const fit = useCallback((reset: boolean) => {
  const control = controls.current;
  if (!control || !(camera instanceof PerspectiveCamera)) return;
  const half = Math.min(Math.atan(Math.tan(camera.fov * Math.PI / 360) * framing.current), Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
  const distance = bounds.current / Math.sin(half) * 1.08;
  scratch.offset.copy(camera.position).sub(control.target);
  if (reset || scratch.offset.lengthSq() < 1e-20) scratch.offset.fromArray(kit.camera.direction);
  control.target.set(0, 0, 0);
  camera.up.set(0, 1, 0);
  camera.position.copy(scratch.offset.normalize().multiplyScalar(distance));
  chaseDistance.current = distance;
  control.update();
  save();
  invalidate();
 }, [camera, invalidate, kit.camera.direction, save, scratch]);
 const constrain = useCallback(() => {
  const control = controls.current;
  if (!control) return;
  scratch.previous.copy(control.target);
  control.target.clampLength(0, bounds.current * 1.15);
  camera.position.add(scratch.delta.copy(control.target).sub(scratch.previous));
  if (!viewer && kind !== 'transfer' && kind !== 'launch') {
   const pose = readPose();
   relativePosition(scratch.planet, [0, 0, 0], pose.originKm);
   scratch.delta.copy(camera.position).sub(scratch.planet);
   const clearance = cameraClearance(kit.radiusKm, camera.near);
   if (scratch.delta.lengthSq() < clearance * clearance) camera.position.copy(scratch.planet).add(scratch.delta.setLength(clearance));
  }
 }, [camera, kind, kit.radiusKm, readPose, scratch, viewer]);
 const frameClearBand = useCallback(() => {
  if (!(camera instanceof PerspectiveCamera) || !size.width || !size.height) return;
  const canvas = gl.domElement.getBoundingClientRect();
  let top = 0, bottom = 0, left = 0, right = 0;
  if (document.documentElement.dataset.windowLayout !== 'reading' && canvas.height > 0) {
   for (const element of document.querySelectorAll<HTMLElement>('[data-hud-zone]')) {
    const box = element.getBoundingClientRect();
    if (box.bottom <= canvas.top || box.top >= canvas.bottom || box.right <= canvas.left || box.left >= canvas.right) continue;
    const zone = element.dataset.hudZone;
    if (zone === 'bottom') bottom = Math.max(bottom, canvas.bottom - box.top);
    else if (box.width > canvas.width * .65 || zone === 'top') top = Math.max(top, box.bottom - canvas.top);
    else if (zone === 'left' || element.classList.contains('resource-grid')) left = Math.max(left, box.right - canvas.left);
    else if (zone === 'right') right = Math.max(right, canvas.right - box.left);
   }
  }
  const sy = size.height / Math.max(canvas.height, 1), sx = size.width / Math.max(canvas.width, 1);
  top = Math.max(0, top * sy); bottom = Math.max(0, bottom * sy);
  left = Math.max(0, left * sx); right = Math.max(0, right * sx);
  framing.current = Math.max(1 / Math.max(size.width, size.height), Math.min((size.height - top - bottom) / size.height, (size.width - left - right) / size.width));
  camera.aspect = size.width / size.height;
  camera.setViewOffset(size.width, size.height, (right - left) / 2, (bottom - top) / 2, size.width, size.height);
  camera.updateProjectionMatrix();
  invalidate();
 }, [camera, gl, invalidate, size.height, size.width]);
 useLayoutEffect(() => {
  frameClearBand();
  const observer = new ResizeObserver(frameClearBand);
  const bind = () => { for (const node of document.querySelectorAll('[data-hud-zone]')) observer.observe(node); frameClearBand(); };
  bind();
  const mutations = new MutationObserver(bind);
  const root = document.querySelector('.floating-studio') ?? gl.domElement.parentElement;
  if (root) mutations.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', frameClearBand);
  return () => { observer.disconnect(); mutations.disconnect(); window.removeEventListener('resize', frameClearBand); };
 }, [frameClearBand, gl]);
 useLayoutEffect(() => {
  const control = controls.current;
  if (!control) return;
  const saved = poses.get(poseKey);
  moved.current = !!saved;
  camera.near = close ? .0000001 : viewer ? .1 : 1;
  camera.far = Math.max(1e9, radius * 30);
  camera.updateProjectionMatrix();
  if (saved) {
   camera.position.fromArray(saved.position); camera.up.fromArray(saved.up); control.target.fromArray(saved.target); control.update();
   chaseDistance.current = camera.position.distanceTo(control.target);
  } else fit(true);
  tracking.current = { discontinuity: -1, mode, identity };
  shotElapsed.current = 0;
  invalidate();
  return save;
 }, [poseKey, camera, close, fit, identity, invalidate, mode, radius, save, viewer]);
 useEffect(() => {
  gl.domElement.style.touchAction = interactive ? 'none' : 'pan-y pinch-zoom';
  const down = (event: PointerEvent) => { if (event.button === 1 && mode === 'CHASE') useCameraMode.getState().setQuickLook(true); };
  const up = () => { useCameraMode.getState().setQuickLook(false); idleSince.current = performance.now(); };
  gl.domElement.addEventListener('pointerdown', down); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  return () => { gl.domElement.style.touchAction = 'auto'; gl.domElement.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
 }, [gl, interactive, mode]);
 useEffect(() => {
  bridge.current = { execute(action) {
   const control = controls.current;
   if (!control) return;
   moved.current = true;
   idleSince.current = performance.now();
   if (action === 'fit' || action === 'body' || action === 'reset') { fit(action === 'reset'); return; }
   const damping = control.enableDamping;
   control.enableDamping = false;
   if (action === 'plane' && orbit) {
    renderDirection(scratch.delta, rotatePerifocal([0, 0, 1], radians(orbit.inclinationDeg), radians(orbit.raanDeg), radians(orbit.argPeriapsisDeg)));
    const distance = camera.position.distanceTo(control.target);
    camera.position.copy(control.target).add(scratch.delta.multiplyScalar(distance));
   } else if (action === 'focus' || action === 'station') {
    const subject = scene.getObjectByName(action === 'station' ? 'mission-station' : 'mission-spacecraft');
    if (subject?.visible) {
     scene.updateMatrixWorld(true); subject.getWorldPosition(scratch.delta);
     scratch.offset.copy(camera.position).sub(control.target); control.target.copy(scratch.delta); camera.position.copy(control.target).add(scratch.offset);
    }
   } else if (action.startsWith('pan')) {
    camera.updateMatrixWorld();
    scratch.right.setFromMatrixColumn(camera.matrixWorld, 0); scratch.up.setFromMatrixColumn(camera.matrixWorld, 1);
    scratch.delta.copy(action === 'panLeft' || action === 'panRight' ? scratch.right : scratch.up).multiplyScalar(camera.position.distanceTo(control.target) * .065 * (action === 'panLeft' || action === 'panDown' ? -1 : 1));
    camera.position.add(scratch.delta); control.target.add(scratch.delta);
   } else {
    scratch.offset.copy(camera.position).sub(control.target); scratch.spherical.setFromVector3(scratch.offset);
    if (action === 'zoomIn' || action === 'zoomOut') scratch.spherical.radius *= action === 'zoomIn' ? .82 : 1.22;
    else if (action === 'left' || action === 'right') scratch.spherical.theta += action === 'left' ? .16 : -.16;
    else scratch.spherical.phi += action === 'up' ? -.12 : .12;
    scratch.spherical.phi = Math.max(.08, Math.min(Math.PI - .08, scratch.spherical.phi));
    scratch.spherical.radius = Math.max(control.minDistance, Math.min(control.maxDistance, scratch.spherical.radius));
    camera.position.copy(control.target).add(scratch.offset.setFromSpherical(scratch.spherical));
    chaseDistance.current = scratch.spherical.radius;
   }
   constrain(); control.update(); control.enableDamping = damping; save(); invalidate();
  } };
  onMounted();
  return () => { bridge.current = null; };
 }, [bridge, camera, constrain, fit, invalidate, onMounted, orbit, save, scene, scratch]);
 useFrame((_, wallDelta) => {
  const control = controls.current;
  if (!control || viewer || kind === 'launch' || (mode !== 'CHASE' && mode !== 'CINEMATIC')) return;
  const pose = readPose();
  if (useCameraMode.getState().quickLook || performance.now() - idleSince.current < 3000) return;
  relativePosition(scratch.target, pose.positionKm, pose.originKm);
  renderDirection(scratch.radial, pose.positionKm).normalize();
  renderDirection(scratch.tangent, pose.velocityKmSec).normalize();
  if (scratch.radial.lengthSq() < .5) scratch.radial.set(0, 1, 0);
  if (scratch.tangent.lengthSq() < .5) scratch.tangent.set(0, 0, 1);
  let distance = Math.max(radius * 1.6, chaseDistance.current);
  if (mode === 'CINEMATIC') {
   shotElapsed.current = Math.min(3, shotElapsed.current + Math.min(.1, wallDelta));
   const progress = shotElapsed.current / 3, eased = progress * progress * (3 - 2 * progress);
   if (kind === 'assembly') distance = Math.exp(Math.log(kit.radiusKm * 3) * (1 - eased) + Math.log(distance) * eased);
   scratch.tangent.applyAxisAngle(scratch.radial, .45 * (1 - eased));
   if (shotElapsed.current >= 3) useCameraMode.getState().setMode(kind === 'assembly' ? 'WORKBENCH' : 'CHASE', 'AUTO');
   else invalidate();
  }
  scratch.desired.copy(scratch.target).addScaledVector(scratch.tangent, -distance).addScaledVector(scratch.radial, distance * .35);
  const snap = reducedMotion || pose.discontinuity !== tracking.current.discontinuity || wallDelta > .5;
  camera.position.lerp(scratch.desired, snap ? 1 : approachFactor(CAMERA_DISTANCE_RESPONSE, wallDelta));
  control.target.lerp(scratch.target, snap ? 1 : approachFactor(CAMERA_RECENTER_RESPONSE, wallDelta));
  camera.up.lerp(scratch.radial, snap ? 1 : approachFactor(CAMERA_UP_RESPONSE, wallDelta)).normalize();
  tracking.current.discontinuity = pose.discontinuity;
  constrain(); control.update();
  if (!snap && camera.position.distanceToSquared(scratch.desired) > radius * radius * 1e-7) invalidate();
 });
 return <OrbitControls ref={controls} domElement={gl.domElement} makeDefault enabled={interactive} enableDamping={!reducedMotion} dampingFactor={.12}
  minDistance={close ? Math.max(.0000005, radius * .5) : viewer ? 2.1 : kind === 'transfer' ? 1e5 : kit.radiusKm * 1.02}
  maxDistance={mode === 'CINEMATIC' && kind === 'assembly' ? kit.radiusKm * 6 : Math.max(radius * 30, close ? .1 : 24)} minPolarAngle={.08} maxPolarAngle={Math.PI - .08} enablePan screenSpacePanning
  onStart={() => { moved.current = true; idleSince.current = performance.now(); }} onChange={constrain} onEnd={() => { idleSince.current = performance.now(); save(); }} keyEvents={false}/>;
}
