import { useEffect, useLayoutEffect, useMemo, useRef, type JSX } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, PerspectiveCamera, type Group, type Mesh } from 'three';
import { defaultQuickDesign, quickDesignBrief } from '@astrix/core';
import { SpacecraftModel } from '../spacecraft/SpacecraftModel';
import {
  CHASE_OFFSET, FAR_PLANE, LOOK_RECENTER_DELAY, NEAR_PLANE, applyLook, cameraSettled, createLook, desiredCamera, dragToLook, dragToSteer,
  easeCamera, fovFor, keepCameraClear, recenterLook, shakeOffset, type LookState,
} from './cameraMath';
import { exploreControls, keyBindingFor, type KeyTarget } from './controls';
import {
  FIXED_STEP, consumeFrame, copyFlightState, createFlightState, idleInput, interpolatePose, isFlightActive, pushOutside, speedLimitFor, stepFlight,
  type FlightInput, type FlightState, type StepClock,
} from './flightMath';
import { TELEMETRY_INTERVAL, buildTelemetry, telemetryDiffers } from './telemetry';
import { addScaled3, add3, copy3, length3, normalize3, rotate3, sub3, vec3, quatIdentity, type Quat, type Vec3 } from './vecMath';
import { approachFactor } from '../camera/approach';
import type { ExploreBody, ExploreTelemetry } from './index';

/** Model metres to scene units. The SmallSat with deployed wings spans about 4.4 m, drawn 0.0066 units wide: enlarged, not to scale. */
const SHIP_SCALE = .0015;
const ENGINE_OFFSET = .0011;
const BEARING_GAP = .005;
const BEARING_LENGTH = .02;
const FOV_RESPONSE = 4;

interface Sim {
  clock: StepClock;
  state: FlightState;
  previous: FlightState;
  input: FlightInput;
  renderPosition: Vec3;
  renderOrientation: Quat;
  look: LookState;
  lookDelta: { dx: number; dy: number };
  cameraOffset: Vec3;
  cameraOrientation: Quat;
  desiredOffset: Vec3;
  desiredOrientation: Quat;
  shake: Vec3;
  scratch: Vec3;
  bearingPoint: Vec3;
  asleep: boolean;
  dragging: boolean;
  telemetryClock: number;
  lastTelemetry: ExploreTelemetry | null;
}

const steerRadians = (dx: number, dy: number) => dragToSteer(dx, dy);

function keyTarget(target: EventTarget | null): KeyTarget {
  if (!(target instanceof Element)) return 'other';
  if (target.closest('input, select, textarea, [contenteditable="true"], [contenteditable=""]')) return 'field';
  if (target.closest('button, a[href], summary, [role="button"]')) return 'button';
  return 'other';
}

/** Inside <Canvas>, rendered in the solar view next to SolarSystemScene. Takes over the camera while boarded. */
export function ExploreFlight(props: { boarded: boolean; bodies: readonly ExploreBody[]; target: string | null; reducedMotion: boolean; onTelemetry: (telemetry: ExploreTelemetry) => void }): JSX.Element | null {
  return props.boarded ? <BoardedFlight bodies={props.bodies} target={props.target} reducedMotion={props.reducedMotion} onTelemetry={props.onTelemetry}/> : null;
}

function BoardedFlight({ bodies, target, reducedMotion, onTelemetry }: { bodies: readonly ExploreBody[]; target: string | null; reducedMotion: boolean; onTelemetry: (telemetry: ExploreTelemetry) => void }) {
  const camera = useThree(state => state.camera);
  const gl = useThree(state => state.gl);
  const invalidate = useThree(state => state.invalidate);
  const ship = useRef<Group>(null);
  const glow = useRef<Mesh>(null);
  const sim = useRef<Sim | null>(null);
  const targetBody = bodies.find(body => body.id === target) ?? null;
  const latest = useRef({ bodies, targetBody, reducedMotion, onTelemetry });
  const design = useMemo(() => quickDesignBrief(defaultQuickDesign('PAST_EARTH')).design, []);
  const bearing = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3));
    const line = new Line(geometry, new LineBasicMaterial({ color: '#ffc28c', transparent: true, opacity: .85 }));
    line.frustumCulled = false;
    line.visible = false;
    line.raycast = () => null;
    return line;
  }, []);
  useEffect(() => () => { bearing.geometry.dispose(); (bearing.material as LineBasicMaterial).dispose(); }, [bearing]);

  useLayoutEffect(() => {
    latest.current = { bodies, targetBody, reducedMotion, onTelemetry };
    invalidate();
  }, [bodies, targetBody, reducedMotion, onTelemetry, invalidate]);

  // Boarding: the ship appears where the chase camera would put it, so the view does not jump.
  useLayoutEffect(() => {
    const perspective = camera instanceof PerspectiveCamera ? camera : null;
    const saved = { near: camera.near, far: camera.far, fov: perspective?.fov ?? null };
    const orientation: Quat = [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w];
    const cameraPosition: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
    const spawn = sub3(vec3(), cameraPosition, rotate3(vec3(), orientation, CHASE_OFFSET));
    pushOutside(spawn, spawn, latest.current.bodies);
    const state = createFlightState(spawn, orientation);
    sim.current = {
      clock: { accumulator: 0, alpha: 0 },
      state,
      previous: copyFlightState(createFlightState(), state),
      input: idleInput(),
      renderPosition: copy3(vec3(), spawn),
      renderOrientation: [...state.orientation],
      look: createLook(),
      lookDelta: { dx: 0, dy: 0 },
      cameraOffset: sub3(vec3(), cameraPosition, spawn),
      cameraOrientation: [...state.orientation],
      desiredOffset: vec3(),
      desiredOrientation: quatIdentity(),
      shake: vec3(),
      scratch: vec3(),
      bearingPoint: vec3(),
      asleep: true,
      dragging: false,
      telemetryClock: TELEMETRY_INTERVAL,
      lastTelemetry: null,
    };
    exploreControls.reset({ pad: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches });
    perspective?.clearViewOffset();
    camera.near = NEAR_PLANE;
    camera.far = FAR_PLANE;
    if (perspective) perspective.updateProjectionMatrix();
    invalidate();
    return () => {
      sim.current = null;
      // Leave the store at boarding defaults, so the next boarding never shows the previous flight's settings.
      exploreControls.reset({ pad: false });
      camera.near = saved.near;
      camera.far = saved.far;
      if (perspective) {
        if (saved.fov !== null) perspective.fov = saved.fov;
        perspective.updateProjectionMatrix();
      }
      invalidate();
    };
  }, [camera, invalidate]);

  // A new or cleared target ends any autopilot run toward the old one.
  useEffect(() => {
    if (sim.current) sim.current.state.autopilot = 'off';
    exploreControls.setAutopilot('off');
  }, [target]);

  useEffect(() => exploreControls.subscribe(invalidate), [invalidate]);

  // Keyboard flight. Fields keep their keys; Space and Enter keep activating focused buttons.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const binding = keyBindingFor(event.code, keyTarget(event.target), event.ctrlKey || event.metaKey || event.altKey);
      if (!binding) return;
      if (binding.kind === 'command' && binding.command === 'cancel') { exploreControls.command('cancel'); return; }
      event.preventDefault();
      if (binding.kind === 'hold') exploreControls.press(`key:${event.code}`, binding.control);
      else if (!event.repeat) exploreControls.command(binding.command);
    };
    const up = (event: KeyboardEvent) => exploreControls.release(`key:${event.code}`);
    const releaseAll = () => exploreControls.releaseAll();
    const visibility = () => { if (document.hidden) exploreControls.releaseAll(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  // Mouse, pen and touch drag on the canvas: one pointer, captured, no pointer lock.
  useEffect(() => {
    const canvas = gl.domElement;
    let pointer: number | null = null, lastX = 0, lastY = 0;
    const previousCursor = canvas.style.cursor;
    canvas.style.cursor = 'grab';
    const down = (event: PointerEvent) => {
      if (pointer !== null || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      pointer = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      try { canvas.setPointerCapture(event.pointerId); } catch { /* Capture is best effort; window-level ends still release the drag. */ }
      canvas.style.cursor = 'grabbing';
      if (sim.current) sim.current.dragging = true;
      invalidate();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      exploreControls.drag(event.clientX - lastX, event.clientY - lastY);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const end = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      pointer = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = 'grab';
      if (sim.current) sim.current.dragging = false;
      invalidate();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end);
      canvas.removeEventListener('pointercancel', end);
      canvas.removeEventListener('lostpointercapture', end);
      canvas.style.cursor = previousCursor === 'grab' || previousCursor === 'grabbing' ? '' : previousCursor;
    };
  }, [gl, invalidate]);

  useFrame((frame, frameDelta) => {
    const s = sim.current;
    if (!s) return;
    const { bodies: flightBodies, targetBody: flightTarget, reducedMotion: reduced, onTelemetry: emit } = latest.current;
    const controls = exploreControls.getSnapshot();
    const state = s.state;

    // The store holds the pilot's request; the flight state holds what is actually flying.
    if (controls.autopilot === 'engaged' && state.autopilot !== 'engaged') {
      if (flightTarget) state.autopilot = 'engaged';
      else exploreControls.setAutopilot('off');
    } else if (controls.autopilot === 'off' && state.autopilot !== 'off') state.autopilot = 'off';

    // After the demand loop slept, the first delta spans the whole pause: run one step, not a burst.
    const delta = s.asleep ? FIXED_STEP : frameDelta;
    const limit = speedLimitFor(controls.speedTier);
    const steps = consumeFrame(s.clock, delta);
    for (let step = 0; step < steps; step++) {
      copyFlightState(s.previous, state);
      exploreControls.readInput(s.input, steerRadians, step === 0);
      stepFlight(state, s.input, flightBodies, { speedLimit: limit, target: flightTarget }, FIXED_STEP);
    }
    if (state.autopilot !== exploreControls.getSnapshot().autopilot) exploreControls.setAutopilot(state.autopilot);
    interpolatePose(s.renderPosition, s.renderOrientation, s.previous, state, s.clock.alpha);

    // Free look.
    const dt = Math.min(delta, .1);
    const lookDelta = exploreControls.takeLook(s.lookDelta);
    const fov = camera instanceof PerspectiveCamera ? camera.fov : 55;
    if (lookDelta.dx || lookDelta.dy) {
      const turn = dragToLook(lookDelta.dx, lookDelta.dy, fov, frame.size.height);
      applyLook(s.look, turn.yaw, turn.pitch);
    } else if (s.dragging) s.look.idle = 0;
    else recenterLook(s.look, dt, reduced);
    if (exploreControls.takeRecenter()) {
      if (reduced) { s.look.yaw = 0; s.look.pitch = 0; } else s.look.idle = LOOK_RECENTER_DELAY;
    }

    // Camera rig.
    const speed = length3(state.velocity);
    const speedFraction = Math.min(1, speed / limit);
    desiredCamera(s.desiredOffset, s.desiredOrientation, s.renderOrientation, s.look, controls.camera, speedFraction);
    easeCamera(s.cameraOffset, s.cameraOrientation, s.desiredOffset, s.desiredOrientation, dt, controls.camera, reduced);
    shakeOffset(s.shake, frame.clock.elapsedTime, state.thrust, speedFraction, controls.camera, reduced);
    rotate3(s.shake, s.cameraOrientation, s.shake);
    add3(s.scratch, s.renderPosition, s.cameraOffset);
    add3(s.scratch, s.scratch, s.shake);
    keepCameraClear(s.scratch, flightBodies);
    camera.position.set(s.scratch[0], s.scratch[1], s.scratch[2]);
    camera.quaternion.set(s.cameraOrientation[0], s.cameraOrientation[1], s.cameraOrientation[2], s.cameraOrientation[3]);
    let fovMoving = false;
    if (camera instanceof PerspectiveCamera) {
      const targetFov = fovFor(speedFraction, reduced);
      const nextFov = reduced ? targetFov : camera.fov + (targetFov - camera.fov) * approachFactor(FOV_RESPONSE, dt);
      fovMoving = Math.abs(nextFov - targetFov) > 1e-3;
      if (Math.abs(nextFov - camera.fov) > 1e-6) {
        camera.fov = fovMoving ? nextFov : targetFov;
        camera.updateProjectionMatrix();
      }
    }
    camera.updateMatrixWorld();

    // Ship, engine glow and target bearing.
    if (ship.current) {
      ship.current.position.set(s.renderPosition[0], s.renderPosition[1], s.renderPosition[2]);
      ship.current.quaternion.set(s.renderOrientation[0], s.renderOrientation[1], s.renderOrientation[2], s.renderOrientation[3]);
      ship.current.visible = controls.camera === 'chase';
    }
    if (glow.current) {
      const thrust = Math.max(0, state.thrust);
      glow.current.visible = thrust > .02;
      glow.current.scale.setScalar(.4 + thrust * .8);
    }
    const positions = bearing.geometry.getAttribute('position') as Float32BufferAttribute;
    if (flightTarget) {
      sub3(s.scratch, flightTarget.position, s.renderPosition);
      const centreDistance = length3(s.scratch);
      const room = centreDistance - flightTarget.radius - BEARING_GAP;
      bearing.visible = room > .002 && state.autopilot !== 'arrived';
      if (bearing.visible) {
        normalize3(s.scratch, s.scratch);
        addScaled3(s.bearingPoint, s.renderPosition, s.scratch, BEARING_GAP);
        positions.setXYZ(0, s.bearingPoint[0], s.bearingPoint[1], s.bearingPoint[2]);
        addScaled3(s.bearingPoint, s.bearingPoint, s.scratch, Math.min(BEARING_LENGTH, room));
        positions.setXYZ(1, s.bearingPoint[0], s.bearingPoint[1], s.bearingPoint[2]);
        positions.needsUpdate = true;
      }
    } else bearing.visible = false;

    // Keep rendering only while something moves; input and store changes wake the loop again.
    const lookOff = s.look.yaw !== 0 || s.look.pitch !== 0;
    const active = isFlightActive(state) || exploreControls.active() || s.dragging || fovMoving || (lookOff && !reduced)
      || !cameraSettled(s.cameraOffset, s.cameraOrientation, s.desiredOffset, s.desiredOrientation);
    s.asleep = !active;
    if (active) invalidate();

    s.telemetryClock += dt;
    if (s.telemetryClock >= TELEMETRY_INTERVAL || !active) {
      s.telemetryClock = 0;
      const telemetry = buildTelemetry(state.position, speed, flightBodies, controls.camera);
      if (telemetryDiffers(s.lastTelemetry, telemetry)) {
        s.lastTelemetry = telemetry;
        emit(telemetry);
      }
    }
  });

  return <>
    <group ref={ship} name="explore-ship">
      <group rotation={[0, Math.PI / 2, 0]} scale={SHIP_SCALE}>
        <SpacecraftModel design={design} reducedMotion/>
      </group>
      <mesh ref={glow} position={[0, 0, ENGINE_OFFSET]} visible={false} raycast={() => null}>
        <sphereGeometry args={[.00045, 12, 8]}/>
        <meshBasicMaterial color="#ffb36b" transparent opacity={.85} depthWrite={false} toneMapped={false}/>
      </mesh>
    </group>
    <primitive object={bearing}/>
  </>;
}
