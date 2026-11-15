import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import type { Design, Telemetry } from '@astrix/core';
import { BusFrame, RoomVolumes } from './BusFrame';
import { Dimensions } from './Dimensions';
import { PartMesh } from './parts/PartMesh';
import { BUS_GEOMETRY, SPACECRAFT_SLOTS, type PartSlot } from './slots';
import { installedInstances, isSlotClick, previewInstance, roomProjection, snapProgress, type PartInstance } from './model';
import { useWorkbench } from './workbenchState';
import { openPartDetails } from '../../ui/inspector/openPart';

export interface SpacecraftModelProps {
  design: Design | null;
  /** Show only the actual workbench proposal, never inferred mission equipment. */
  previewEquipment?: boolean;
  telemetry?: Telemetry | null;
  workbench?: boolean;
  reducedMotion?: boolean;
  /** Clicking an installed component opens its details. Off for snapshots and storyboards that share the event system. */
  inspectable?: boolean;
}
interface AnimatedInstance { instance: PartInstance; present: boolean; entering: boolean }

type PickHandler = (event: ThreeEvent<PointerEvent>) => void;
interface PickHandlers { onPointerDown?: PickHandler; onPointerMove?: PickHandler; onPointerUp?: PickHandler; onPointerCancel?: () => void; onPointerOver?: PickHandler; onPointerOut?: () => void }
/** A press-and-release without a drag picks; drags stay with the camera. Pointer-only: keyboard users use the component lists. */
function useClickPick(onPick: (() => void) | null): PickHandlers {
  const down = useRef<{ id: number; point: readonly [number, number]; moved: boolean } | null>(null);
  const canvas = useThree(state => state.gl.domElement);
  if (!onPick) return {};
  return {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      down.current = { id: event.pointerId, point: [event.clientX, event.clientY], moved: false };
    },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => { if (down.current && !isSlotClick(down.current.point, [event.clientX, event.clientY])) down.current.moved = true; },
    onPointerUp: (event: ThreeEvent<PointerEvent>) => {
      const start = down.current;
      down.current = null;
      if (!start || start.id !== event.pointerId || start.moved || !isSlotClick(start.point, [event.clientX, event.clientY])) return;
      event.stopPropagation();
      onPick();
    },
    onPointerCancel: () => { down.current = null; },
    onPointerOver: (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); canvas.style.cursor = 'pointer'; },
    onPointerOut: () => { canvas.style.cursor = ''; },
  };
}

function EquipmentInstance({ entry, exploded, reducedMotion, telemetry, highlighted, proposal = false, inspectable = false }: { entry: AnimatedInstance; exploded: boolean; reducedMotion: boolean; telemetry: Telemetry | null; highlighted: boolean; proposal?: boolean; inspectable?: boolean }) {
  const root = useRef<Group>(null);
  const elapsed = useRef(entry.entering || !entry.present ? 0 : .28);
  const explosion = useRef(exploded ? 1 : 0);
  const { instance, present } = entry;
  const size = Math.max(...BUS_GEOMETRY[instance.slot.busId].dimensions);
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    elapsed.current = entry.entering || !present ? 0 : .28;
    invalidate();
  }, [entry.entering, present, invalidate]);
  useLayoutEffect(() => { invalidate(); }, [exploded, reducedMotion, invalidate]);
  useFrame((state, delta) => {
    if (!root.current) return;
    elapsed.current += delta;
    const progress = snapProgress(elapsed.current, reducedMotion);
    const target = exploded ? 1 : 0;
    explosion.current = reducedMotion ? target : explosion.current + (target - explosion.current) * (1 - Math.exp(-14 * Math.min(delta, .1)));
    const detached = present ? entry.entering ? 1 - progress : 0 : progress;
    const spread = explosion.current;
    root.current.position.set(
      instance.position[0] * (1 + spread * .4) + instance.slot.outward[0] * size * (.5 * spread + .35 * detached),
      instance.position[1] * (1 + spread * .4) + instance.slot.outward[1] * size * (.5 * spread + .35 * detached),
      instance.position[2] * (1 + spread * .4) + instance.slot.outward[2] * size * (.5 * spread + .35 * detached),
    );
    if (progress < 1 || Math.abs(target - spread) > .0001) state.invalidate();
  });
  const pick = useClickPick(inspectable && present && !proposal ? () => openPartDetails(instance.part.id, null) : null);
  return <group ref={root} position={[...instance.position]} name={proposal ? `proposal:${instance.part.id}` : `part:${instance.part.id}:${instance.index}`} userData={{ partId: instance.part.id, installed: present && !proposal, proposal, category: instance.part.category }} {...pick}>
    <PartMesh slot={instance.slot} telemetry={telemetry} ghost={!present || proposal} highlighted={highlighted} reducedMotion={reducedMotion}/>
  </group>;
}

function PickableSlot({ slot, installed, highlighted, exploded, reducedMotion }: { slot: PartSlot; installed: boolean; highlighted: boolean; exploded: boolean; reducedMotion: boolean }) {
  const root = useRef<Mesh>(null);
  const spread = useRef(exploded ? 1 : 0);
  const invalidate = useThree(state => state.invalidate);
  const size = Math.max(...BUS_GEOMETRY[slot.busId].dimensions);
  useLayoutEffect(() => { invalidate(); }, [exploded, reducedMotion, invalidate]);
  useFrame((state, delta) => {
    if (!root.current) return;
    const target = exploded ? 1 : 0;
    spread.current = reducedMotion ? target : spread.current + (target - spread.current) * (1 - Math.exp(-14 * Math.min(delta, .1)));
    root.current.position.set(
      slot.position[0] * (1 + spread.current * .4) + slot.outward[0] * size * .5 * spread.current,
      slot.position[1] * (1 + spread.current * .4) + slot.outward[1] * size * .5 * spread.current,
      slot.position[2] * (1 + spread.current * .4) + slot.outward[2] * size * .5 * spread.current,
    );
    if (Math.abs(target - spread.current) > .0001) state.invalidate();
  });
  const pick = useClickPick(() => { useWorkbench.getState().selectCategory(slot.category); openPartDetails(slot.partId, null); });
  return <mesh ref={root} position={[...slot.position]} name={`slot:${slot.partId}`} userData={{ partId: slot.partId, category: slot.category, installed }}
    {...pick}
    onPointerOver={event => { pick.onPointerOver?.(event); useWorkbench.getState().setHoveredCategory(slot.category); }}
    onPointerOut={() => { pick.onPointerOut?.(); if (useWorkbench.getState().hoveredCategory === slot.category) useWorkbench.getState().setHoveredCategory(null); }}>
    <boxGeometry args={[slot.size[0] * 1.12, slot.size[1] * 1.12, slot.size[2] * 1.12]}/>
    <meshBasicMaterial color={highlighted ? '#89f1ff' : '#5f9bb5'} wireframe transparent opacity={highlighted ? .8 : installed ? 0 : .18} depthWrite={false}/>
  </mesh>;
}

function Craft({ design, previewEquipment, telemetry, workbench, reducedMotion, inspectable }: Required<Omit<SpacecraftModelProps, 'design'>> & { design: Design }) {
  const hovered = useWorkbench(state => workbench ? state.hoveredCategory : null);
  const selected = useWorkbench(state => workbench ? state.selectedCategory : null);
  const proposalId = useWorkbench(state => previewEquipment ? state.previewPartId : null);
  // The component whose details panel is open stays lit, so the panel beside it reads as attached.
  const inspected = useWorkbench(state => inspectable ? state.inspectedPartId : null);
  const explodedSetting = useWorkbench(state => workbench && state.exploded);
  const dimensions = useWorkbench(state => workbench && state.dimensions);
  const exploded = workbench && explodedSetting;
  const installed = useMemo(() => installedInstances(design), [design]);
  const previewId = previewEquipment ? proposalId : null;
  const preview = useMemo(() => previewInstance(design, previewId), [design, previewId]);
  const room = useMemo(() => workbench ? roomProjection(design, previewId) : null, [design, previewId, workbench]);
  const [entries, setEntries] = useState<readonly AnimatedInstance[]>(() => installed.map(instance => ({ instance, present: true, entering: false })));
  const initial = useRef(installed);
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    if (!workbench || reducedMotion) {
      initial.current = installed;
      setEntries(installed.map(instance => ({ instance, present: true, entering: false })));
      invalidate();
      return;
    }
    if (initial.current === installed) return;
    initial.current = installed;
    setEntries(previous => {
      const keys = new Set(installed.map(instance => instance.key));
      const previousByKey = new Map(previous.map(entry => [entry.instance.key, entry]));
      return [
        ...installed.map(instance => ({ instance, present: true, entering: !previousByKey.get(instance.key)?.present })),
        ...previous.filter(entry => !keys.has(entry.instance.key)).map(entry => ({ ...entry, present: false, entering: false })),
      ];
    });
    invalidate();
    const timeout = setTimeout(() => {
      setEntries(previous => previous.filter(entry => entry.present));
      invalidate();
    }, 290);
    return () => clearTimeout(timeout);
  }, [installed, workbench, reducedMotion, invalidate]);
  useLayoutEffect(() => { invalidate(); }, [hovered, selected, inspected, proposalId, dimensions, invalidate]);
  return <group name="spacecraft-body-metres" userData={{ units: 'm', panelNormal: '+X', opticalBoresight: '+Z', antennaBoresight: '+Z' }}>
    <BusFrame busId={design.busId}/>
    {room && <RoomVolumes busId={design.busId} room={room}/>}
    {entries.map(entry => <EquipmentInstance key={entry.instance.key} entry={entry} exploded={exploded} reducedMotion={reducedMotion || !workbench} telemetry={telemetry} inspectable={inspectable} highlighted={inspected === entry.instance.part.id || workbench && (hovered === entry.instance.part.category || selected === entry.instance.part.category)}/>)}
    {preview && <EquipmentInstance entry={{ instance: preview, present: true, entering: false }} proposal exploded={exploded} reducedMotion={reducedMotion} telemetry={telemetry} highlighted={false}/>}
    {workbench && SPACECRAFT_SLOTS[design.busId].map(slot => <PickableSlot key={slot.partId} slot={slot} installed={installed.some(instance => instance.part.id === slot.partId)} highlighted={slot.partId === inspected || slot.category === hovered || slot.category === selected} exploded={exploded} reducedMotion={reducedMotion}/>)}
    {workbench && dimensions && <Dimensions busId={design.busId}/>}
  </group>;
}

/** Geometry is in metres, with the body's axes unchanged. Callers own world pose and km conversion. */
export function SpacecraftModel({ design, previewEquipment = false, telemetry = null, workbench = false, reducedMotion = false, inspectable = false }: SpacecraftModelProps) {
  return design ? <Craft key={`${design.busId}:${design.definitionDigest}`} design={design} previewEquipment={previewEquipment} telemetry={telemetry} workbench={workbench} reducedMotion={reducedMotion} inspectable={inspectable}/> : null;
}
