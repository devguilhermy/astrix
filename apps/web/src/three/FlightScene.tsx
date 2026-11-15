import { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, Line, LineBasicMaterial, LineDashedMaterial, Vector3 } from 'three';
import { useTranslation } from 'react-i18next';
import { moonState, type BurnReceipt, type Design, type HistorySample, type StateVector, type Telemetry } from '@astrix/core';
import { SpacecraftModel } from './spacecraft/SpacecraftModel';
import { Planet } from './space/Planet';
import { relativePosition, renderAttitude, renderDirection, type KmVector } from './space/FloatingOrigin';
import { useMissionPose } from './space/useMissionPose';
import { isCloseShot, type CameraMode } from './camera/modes';
import { useQualityProfile } from './quality';
import { useFlightTrail } from './flight/flightTrail';
import { useFlightPreview } from './flight/previewStore';
import { MOON_RADIUS_KM, cross, moonSoiRadiusKm, ringPoints, type Vec3 } from './flight/flightState';
import { SceneLine } from './ScenePrimitives';

const point = (p: readonly number[]): [number, number, number] => [p[0]!, p[2]!, -p[1]!];
const MAX_LINE = 2048;

/** A polyline whose points are world-frame km, re-expressed relative to the floating origin every frame. */
function PathLine({ read, color, opacity, dashed = false }: { read: () => readonly Vec3[]; color: string; opacity: number; dashed?: boolean }) {
  const readPose = useMissionPose(), { invalidate } = useThree();
  const line = useMemo(() => {
    const geometry = new BufferGeometry();
    const attribute = new Float32BufferAttribute(new Float32Array(MAX_LINE * 3), 3);
    attribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', attribute);
    geometry.setDrawRange(0, 0);
    const material = dashed ? new LineDashedMaterial({ color, transparent: true, opacity, dashSize: 1, gapSize: 1 }) : new LineBasicMaterial({ color, transparent: true, opacity });
    const object = new Line(geometry, material);
    object.frustumCulled = false;
    return { object, geometry, material };
  }, [color, opacity, dashed]);
  const last = useRef<{ points: readonly Vec3[] | null; origin: KmVector | null; length: number }>({ points: null, origin: null, length: -1 });
  const scratch = useMemo(() => new Vector3(), []);
  useEffect(() => () => { line.geometry.dispose(); line.material.dispose(); }, [line]);
  useEffect(() => { invalidate(); }, [invalidate, line]);
  useFrame(() => {
    const pose = readPose(), points = read(), origin = pose.originKm;
    const previous = last.current;
    if (previous.points === points && previous.origin === origin && previous.length === points.length) return;
    previous.points = points; previous.origin = origin; previous.length = points.length;
    const attribute = line.geometry.getAttribute('position'), count = Math.min(points.length, MAX_LINE), stride = points.length > MAX_LINE ? points.length / MAX_LINE : 1;
    for (let i = 0; i < count; i++) {
      const source = points[Math.min(points.length - 1, Math.floor(i * stride))]!;
      relativePosition(scratch, source, origin);
      attribute.setXYZ(i, scratch.x, scratch.y, scratch.z);
    }
    attribute.needsUpdate = true;
    line.geometry.setDrawRange(0, count);
    if (line.material instanceof LineDashedMaterial) {
      line.object.computeLineDistances();
      const span = Math.max(1e-9, pose.regime?.radiusKm ?? 1);
      line.material.dashSize = span * .02; line.material.gapSize = span * .012; line.material.needsUpdate = true;
    }
  });
  return <primitive object={line.object}/>;
}

/** Procedural launch-vehicle schematic, oriented along the simulated velocity. Stage presence comes from telemetry. */
function AscentStack({ telemetry, direction }: { telemetry: Telemetry | null; direction: Vec3 }) {
  const root = useRef<Group>(null), plume = useRef<Group>(null), upright = useMemo(() => new Vector3(0, 1, 0), []), target = useMemo(() => new Vector3(), []);
  const flight = telemetry?.flight ?? null, ascent = flight?.ascent ?? null;
  const fullStack = !flight || (!!ascent && ascent.separatedAtSec === null);
  const burning = !!ascent && ascent.thrustKN > 0;
  useEffect(() => {
    if (!root.current) return;
    renderDirection(target, direction).normalize();
    root.current.quaternion.setFromUnitVectors(upright, target);
  }, [direction, target, upright]);
  useFrame(() => { if (plume.current) plume.current.scale.y = Math.max(.05, ascent?.throttle ?? 0); });
  return <group ref={root}>
    {fullStack && <mesh position={[0, .0125, 0]}><cylinderGeometry args={[.0015, .0015, .025, 16]}/><meshStandardMaterial color="#e4e8f0" metalness={.2} roughness={.65}/></mesh>}
    <mesh position={[0, fullStack ? .031 : .006, 0]}><cylinderGeometry args={[.0012, .0012, .012, 16]}/><meshStandardMaterial color="#cdd5e0" metalness={.2} roughness={.65}/></mesh>
    <mesh position={[0, fullStack ? .0395 : .0145, 0]}><coneGeometry args={[.0012, .005, 16]}/><meshStandardMaterial color="#9fb0c5" metalness={.3} roughness={.5}/></mesh>
    {burning && <group ref={plume} position={[0, fullStack ? 0 : -.0005, 0]}><mesh position={[0, -.006, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[.0013, .012, 14, 1, true]}/><meshBasicMaterial color="#ffb35c" transparent opacity={.85}/></mesh></group>}
  </group>;
}

const toEarthFrame = (state: StateVector, epochUTC: string): Vec3 => {
  if (state.body !== 'MOON') return state.rKm;
  const moon = moonState(state.epochSec, epochUTC).r;
  return [moon[0] + state.rKm[0], moon[1] + state.rKm[1], moon[2] + state.rKm[2]];
};

export function FlightScene({ design, live, preview, telemetry, reviewSample, mode, reducedMotion }: { design: Design; live: boolean; preview: boolean; telemetry: Telemetry | null; reviewSample: HistorySample | null; mode: CameraMode; reducedMotion: boolean }) {
  const { t } = useTranslation(), readPose = useMissionPose(), { invalidate } = useThree(), quality = useQualityProfile();
  const epoch = design.definition.environment.epochUTC, lunar = design.definition.trajectory.model === 'PATCHED_CONICS' && design.definition.trajectory.bodies.includes('MOON');
  const close = isCloseShot(mode, 'flight');
  const moonGroup = useRef<Group>(null), soiGroup = useRef<Group>(null), craft = useRef<Group>(null), attitude = useRef<Group>(null), encounter = useRef<Group>(null), burnPreview = useRef<Group>(null);
  const moonSun = useMemo<[number, number, number]>(() => [1, 0, 0], []);
  const ring = useMemo(() => {
    if (!lunar) return [] as [number, number, number][];
    const state = moonState(0, epoch), radius = Math.hypot(...state.r), normal = cross(state.r, state.v);
    return ringPoints([0, 0, 0], radius, normal, 192).map(point);
  }, [lunar, epoch]);
  const burnReceipts = telemetry?.flight?.burns ?? [];
  const lastReceipts = useRef<readonly BurnReceipt[]>([]);
  lastReceipts.current = burnReceipts;
  const receiptRefs = useRef<(Group | null)[]>([]);
  const trailKey = `${live ? 'live' : 'idle'}:${design.definitionDigest}:${design.revision}`;
  useEffect(() => { void trailKey; const redraw = () => invalidate(); const unsubscribe = [useFlightTrail.subscribe(redraw), useFlightPreview.subscribe(redraw)]; return () => unsubscribe.forEach(fn => fn()); }, [invalidate, trailKey]);
  useFrame(() => {
    const pose = readPose(), flight = pose.flight, origin = pose.originKm;
    if (!flight) return;
    // Actual path: record one state per accepted sample, only while the run is live.
    if (pose.telemetry && !pose.recorded) useFlightTrail.getState().push(`${design.definitionDigest}:${design.levelId}:${design.revision}`, flight.t, flight.earthKm as Vec3, Math.max(.05, (pose.regime?.radiusKm ?? 1) * 1e-3));
    if (moonGroup.current) {
      moonGroup.current.visible = !!flight.moonKm;
      if (flight.moonKm) relativePosition(moonGroup.current.position, flight.moonKm, origin);
    }
    if (soiGroup.current) {
      const show = !!flight.moonKm && (pose.regime?.id === 'transfer' || pose.regime?.id === 'moon');
      soiGroup.current.visible = show;
      if (flight.moonKm) relativePosition(soiGroup.current.position, flight.moonKm, origin);
    }
    if (flight.moonKm) { const sun = pose.sunDir; moonSun[0] = sun[0]; moonSun[1] = sun[1]; moonSun[2] = sun[2]; }
    if (craft.current) relativePosition(craft.current.position, pose.positionKm, origin);
    if (attitude.current && pose.attitude) renderAttitude(attitude.current.quaternion, pose.attitude.q);
    const forecast = useFlightPreview.getState().forecast;
    if (encounter.current) {
      const closest = forecast?.encounter;
      const sample = closest ? forecast.samples.reduce((best, item) => Math.abs(item.t - closest.atSec) < Math.abs(best.t - closest.atSec) ? item : best, forecast.samples[0]!) : null;
      encounter.current.visible = !!sample?.moon;
      if (sample?.moon) relativePosition(encounter.current.position, sample.moon, origin);
    }
    const burn = useFlightPreview.getState().burn;
    if (burnPreview.current) {
      burnPreview.current.visible = !!burn?.before;
      if (burn?.before) relativePosition(burnPreview.current.position, toEarthFrame(burn.before.central, epoch), origin);
    }
    lastReceipts.current.forEach((receipt, index) => {
      const group = receiptRefs.current[index];
      if (!group) return;
      group.visible = receipt.status === 'EXECUTED' || receipt.status === 'PARTIAL';
      relativePosition(group.position, toEarthFrame(receipt.before, epoch), origin);
    });
  });
  const pose = readPose();
  const velocity = pose.flight?.velocityKms, direction: Vec3 = velocity && velocity.some(Boolean) ? velocity : pose.flight?.earthKm ?? [0, 0, 1];
  const stackVisible = !!pose.flight && (pose.flight.phase === 'PRELAUNCH' || pose.flight.phase === 'ASCENT' || (!!telemetry?.flight?.mass.stage?.attached && close));
  return <>
    <group ref={moonGroup} name="moon"><Planet body="MOON" radiusKm={MOON_RADIUS_KM} sunDirection={moonSun} lowResolution/>{quality.labelBudget > 0 && !close && <Html center style={{ pointerEvents: 'none', fontSize: '11px', color: '#c9d6df', whiteSpace: 'nowrap' }}>{t('flight.moon')}</Html>}</group>
    <group ref={soiGroup} name="moon-soi"><mesh><sphereGeometry args={[moonSoiRadiusKm(), 48, 24]}/><meshBasicMaterial color="#9ad7e8" wireframe transparent opacity={.07} depthWrite={false}/></mesh></group>
    {ring.length > 0 && <SceneLine points={ring} color="#8da4b5" opacity={.28} closed/>}
    <PathLine read={() => useFlightTrail.getState().points} color="#7ff0ff" opacity={.95}/>
    {!reviewSample && <PathLine read={() => useFlightPreview.getState().forecast?.samples.map(sample => sample.earth) ?? []} color="#ffd27a" opacity={.8} dashed/>}
    <group ref={encounter} name="forecast-encounter" visible={false}><mesh><sphereGeometry args={[MOON_RADIUS_KM * 1.04, 24, 12]}/><meshBasicMaterial color="#ffd27a" wireframe transparent opacity={.35} depthWrite={false}/></mesh>{quality.labelBudget > 1 && <Html center style={{ pointerEvents: 'none', fontSize: '10px', color: '#ffd27a', whiteSpace: 'nowrap' }}>{t('flight.moonAtEncounter')}</Html>}</group>
    <group ref={burnPreview} name="burn-preview" visible={false}><mesh><sphereGeometry args={[(pose.regime?.radiusKm ?? 1) * .008, 12, 8]}/><meshBasicMaterial color="#ffd27a" depthTest={false}/></mesh></group>
    {burnReceipts.map((receipt, index) => <group key={`${receipt.id}:${receipt.atSec}`} ref={element => { receiptRefs.current[index] = element; }}><mesh><sphereGeometry args={[(pose.regime?.radiusKm ?? 1) * .006, 10, 6]}/><meshBasicMaterial color="#ff9d6b" depthTest={false}/></mesh></group>)}
    <group ref={craft} name="mission-spacecraft">
      {close ? <>
        {stackVisible && <AscentStack telemetry={telemetry} direction={direction}/>}
        {(!stackVisible || (telemetry?.flight?.phase !== 'PRELAUNCH' && telemetry?.flight?.phase !== 'ASCENT')) && <group ref={attitude} scale={.001}><SpacecraftModel design={design} previewEquipment={preview} telemetry={telemetry} reducedMotion={reducedMotion} inspectable/></group>}
      </> : <>
        <sprite scale={[.022, .022, 1]}><spriteMaterial color={telemetry?.safe ? '#ffc16c' : '#e7faff'} sizeAttenuation={false} depthTest={false}/></sprite>
        {quality.labelBudget > 0 && <Html center style={{ pointerEvents: 'none', fontSize: '11px', color: '#c9edf0', whiteSpace: 'nowrap', transform: 'translateY(-18px)' }}>{t('scene.focus')}</Html>}
      </>}
    </group>
  </>;
}
