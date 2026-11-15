import { useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import type { Design, Telemetry } from '@astrix/core';
import { BusFrame } from './BusFrame';
import { installedInstances, isSlotClick, type PartInstance } from './model';
import { PartMesh } from './parts/PartMesh';
import { AnchoredComponentDetails } from './ComponentDetails';
import type { SceneView } from '../committedScene';

interface InstalledSpacecraftProps {
  design: Design;
  telemetry: Telemetry | null;
  selectedKey: string | null;
  view: SceneView;
  onInspect: (key: string) => void;
  onClose: () => void;
}
function InstalledPart({ instance, design, telemetry, selectedKey, view, onInspect, onClose }: InstalledSpacecraftProps & { instance: PartInstance }) {
  const canvas = useThree(state => state.gl.domElement);
  const down = useRef<{ id: number; point: readonly [number, number]; moved: boolean } | null>(null);
  const selected = selectedKey === instance.key;
  const pointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    down.current = { id: event.pointerId, point: [event.clientX, event.clientY], moved: false };
  };
  return <group position={[...instance.position]} name={`installed:${instance.key}`} userData={{ installed: true, partId: instance.part.id }} onPointerDown={pointerDown}
    onPointerMove={event => { if (down.current && !isSlotClick(down.current.point, [event.clientX, event.clientY])) down.current.moved = true; }}
    onPointerUp={event => {
      const start = down.current; down.current = null;
      if (!start || start.id !== event.pointerId || start.moved || !isSlotClick(start.point, [event.clientX, event.clientY])) return;
      event.stopPropagation(); onInspect(instance.key);
    }}
    onPointerCancel={() => { down.current = null; }}
    onPointerOver={event => { event.stopPropagation(); canvas.style.cursor = 'pointer'; }}
    onPointerOut={() => { canvas.style.cursor = ''; }}>
    <PartMesh slot={instance.slot} telemetry={telemetry} highlighted={selected} reducedMotion/>
    {selected && <AnchoredComponentDetails part={instance.part} design={design} current={telemetry} view={view} onClose={onClose}/>}
  </group>;
}

/** Paid hardware only, in metres. No pilot, workbench, proposals or simulation clock. */
export function InstalledSpacecraft(props: InstalledSpacecraftProps) {
  const installed = useMemo(() => installedInstances(props.design), [props.design]);
  return <group name="committed-spacecraft-hardware" userData={{ units: 'm', schematic: true }}>
    <BusFrame busId={props.design.busId}/>
    {installed.map(instance => <InstalledPart key={instance.key} instance={instance} {...props}/>)}
  </group>;
}
