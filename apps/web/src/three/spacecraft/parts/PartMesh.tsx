import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, InstancedMesh, Matrix4, Mesh, MeshPhysicalMaterial } from 'three';
import type { Telemetry } from '@astrix/core';
import { SURFACES, type Surface } from '../materials';
import type { PartSlot } from '../slots';

function Material({ surface }: { surface: Surface }) {
  return <meshPhysicalMaterial {...SURFACES[surface]}/>;
}
function Box({ size, position = [0, 0, 0], surface = 'rail' }: { size: [number, number, number]; position?: [number, number, number]; surface?: Surface }) {
  return <mesh position={position}><boxGeometry args={size}/><Material surface={surface}/></mesh>;
}
function Cylinder({ radius, length, position = [0, 0, 0], surface = 'rail', axis = 'z' }: { radius: number; length: number; position?: [number, number, number]; surface?: Surface; axis?: 'y' | 'z' }) {
  return <mesh position={position} rotation={axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]}><cylinderGeometry args={[radius, radius, length, 20]}/><Material surface={surface}/></mesh>;
}

/** Solar cell plane is YZ: its illuminated front-face normal is body +X. */
function SolarPanel({ height, width, thickness }: { height: number; width: number; thickness: number }) {
  const rows = 6, columns = 4;
  const cells = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!cells.current) return;
    const matrix = new Matrix4();
    for (let i = 0; i < rows * columns; i++) {
      const row = Math.floor(i / columns), column = i % columns;
      matrix.makeTranslation(thickness * .6, (row - (rows - 1) / 2) * height / rows, (column - (columns - 1) / 2) * width / columns);
      cells.current.setMatrixAt(i, matrix);
    }
    cells.current.instanceMatrix.needsUpdate = true;
    cells.current.computeBoundingSphere();
  }, [height, width, thickness]);
  return <group>
    <Box size={[thickness, height, width]} surface="rail"/>
    <instancedMesh ref={cells} args={[undefined, undefined, rows * columns]}>
      <boxGeometry args={[thickness * .16, height / rows * .91, width / columns * .91]}/>
      <Material surface="solar"/>
    </instancedMesh>
    {[-1, 1].map(side => <Box key={side} size={[thickness * .1, height * .94, width * .006]} position={[thickness * .71, 0, side * width * .27]} surface="cellWire"/>)}
  </group>;
}

function Equipment({ slot, telemetry }: { slot: PartSlot; telemetry: Telemetry | null }) {
  const [x, y, z] = slot.size;
  switch (slot.shape) {
    case 'body-solar':
      return <SolarPanel height={y} width={z} thickness={x}/>;
    case 'wings': {
      const state = telemetry?.deployment.wings;
      const fold = state === 'STOWED' ? Math.PI / 2 : state === 'ANOMALOUS' ? Math.PI / 4 : 0;
      return <group>{[-1, 1].map(side => <group key={side} rotation={[0, side * fold, 0]}>
        <Box size={[x, y * .05, z * .55]} position={[0, 0, side * z * .3]} surface="rail"/>
        <group position={[0, 0, side * z * .72]}><SolarPanel height={y} width={z} thickness={x}/></group>
      </group>)}</group>;
    }
    case 'battery':
      return <group><Box size={[x, y, z]} surface="dark"/>{[-1, 0, 1].map(i => <Cylinder key={i} radius={Math.min(x / 8, y * .43)} length={z * .9} position={[i * x * .28, y * .15, 0]} surface="foil"/>)}<Box size={[x * .8, y * .09, z * .08]} position={[0, y * .55, z * .3]} surface="copper"/></group>;
    case 'computer':
    case 'storage':
      return <group><Box size={[x, y * .3, z]} surface="circuit"/>{[-1, 0, 1].map(i => <Box key={i} size={[x * .22, y * .6, z * .42]} position={[i * x * .29, y * .4, 0]} surface="dark"/>)}{[-1, 1].map(side => <Box key={side} size={[x * .94, y * .15, z * .035]} position={[0, 0, side * z * .48]} surface="copper"/>)}</group>;
    case 'magnetic-adcs':
      return <group><Box size={[x, y * .3, z]} surface="circuit"/>{[-1, 1].map(side => <Cylinder key={side} radius={y * .24} length={z * .85} position={[side * x * .35, y * .3, 0]} surface="copper"/>)}</group>;
    case 'wheel-adcs':
      return <group><Box size={[x, y * .25, z]} surface="dark"/>{[-1, 1].map(side => <Cylinder key={side} radius={Math.min(x, z) * .22} length={y * .65} position={[side * x * .25, y * .28, 0]} axis="y" surface="rail"/>)}<Cylinder radius={x * .16} length={z * .55} position={[0, y * .4, 0]} surface="dark"/></group>;
    case 'whip': {
      const folded = telemetry?.deployment.antenna === 'STOWED' ? Math.PI / 2 : telemetry?.deployment.antenna === 'ANOMALOUS' ? Math.PI / 4 : 0;
      return <group><Box size={[x, y, z]} surface="dark"/>{[-1, 1].map(side => <group key={side} rotation={[0, side * folded, 0]}><Cylinder radius={x * .025} length={z * 3.4} position={[side * x * .38, 0, z * 2.1]} surface="rail"/></group>)}</group>;
    }
    case 'patch':
      return <group><Box size={[x, y, z]} surface="dark"/><Box size={[x * .88, y * .85, z * .18]} position={[0, 0, z * .57]} surface="ceramic"/><Box size={[x * .64, y * .62, z * .02]} position={[0, 0, z * .67]} surface="copper"/></group>;
    case 'dish': {
      const folded = telemetry?.deployment.antenna === 'STOWED' ? Math.PI / 2 : telemetry?.deployment.antenna === 'ANOMALOUS' ? Math.PI / 4 : 0;
      return <group rotation={[folded, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[Math.min(x, y) / 2, z * .55, 32, 1, true]}/><meshPhysicalMaterial {...SURFACES.ceramic} side={2}/></mesh>
        <Cylinder radius={x * .025} length={z * .9} position={[0, 0, z * .3]} surface="rail"/>
        <Cylinder radius={x * .08} length={z * .12} position={[0, 0, z * .78]} surface="copper"/>
      </group>;
    }
    case 'optical':
      return <group><Box size={[x, y, z * .55]} position={[0, 0, -z * .15]} surface="dark"/><Cylinder radius={Math.min(x, y) * .46} length={z * .78} surface="dark"/><Cylinder radius={Math.min(x, y) * .37} length={z * .035} position={[0, 0, z * .41]} surface="lens"/><Cylinder radius={Math.min(x, y) * .22} length={z * .008} position={[0, 0, z * .432]} surface="solar"/></group>;
    case 'radiation':
      return <group><Box size={[x, y, z * .8]} surface="ceramic"/>{[-1, 0, 1].map(i => <Cylinder key={i} radius={x * .105} length={z * .3} position={[i * x * .27, 0, z * .52]} surface="copper"/>)}</group>;
    case 'magnetometer':
      return <group><Cylinder radius={x * .08} length={z * 3} position={[0, 0, z]} surface="rail"/><Box size={[x, y, z * .55]} position={[0, 0, z * 2.6]} surface="ceramic"/></group>;
    case 'propulsion':
      return <group>{[-1, 1].map(side => <mesh key={side} position={[side * x * .25, y * .12, 0]} scale={[x * .22, y * .36, z * .43]}><sphereGeometry args={[1, 20, 14]}/><Material surface="rail"/></mesh>)}
        <Box size={[x * .78, y * .07, z * .15]} position={[0, -y * .12, 0]} surface="copper"/>
        <mesh position={[0, -y * .42, 0]}><coneGeometry args={[x * .2, y * .42, 24, 1, true]}/><meshPhysicalMaterial {...SURFACES.dark} side={2}/></mesh>
      </group>;
    case 'radiator':
      return <group><Box size={[x, y, z]} surface="ceramic"/>{[-2, -1, 0, 1, 2].map(i => <Box key={i} size={[x * .15, y * .95, z * .012]} position={[-x * .56, 0, i * z * .18]} surface="rail"/>)}</group>;
    case 'heater':
      return <group><Box size={[x, y, z]} surface="thermal"/>{[-2, -1, 0, 1, 2].map(i => <Box key={i} size={[x * .2, y * .035, z * .85]} position={[x * .6, i * y * .17, 0]} surface="copper"/>)}</group>;
    case 'support':
      return <group><Box size={[x, y, z]} surface="ceramic"/>{[-1, 1].map(side => <Cylinder key={side} radius={x * .18} length={y * .85} position={[side * x * .23, 0, z * .54]} axis="y" surface="rail"/>)}<Box size={[x * .6, y * .5, z * .05]} position={[0, 0, -z * .53]} surface="dark"/></group>;
    case 'disposal':
      return <group><Box size={[x, y, z]} surface="rail"/><Box size={[x * .85, y * .45, z * .25]} position={[0, 0, -z * .65]} surface="foil"/>{[-1, 1].map(side => <Cylinder key={side} radius={y * .12} length={x * .4} position={[side * x * .26, 0, 0]} surface="dark"/>)}</group>;
  }
}

export function PartMesh({ slot, telemetry = null, ghost = false, highlighted = false, reducedMotion = false, children }: { slot: PartSlot; telemetry?: Telemetry | null; ghost?: boolean; highlighted?: boolean; reducedMotion?: boolean; children?: ReactNode }) {
  const root = useRef<Group>(null);
  const materials = useRef<MeshPhysicalMaterial[]>([]);
  const elapsed = useRef(0);
  useLayoutEffect(() => {
    materials.current = [];
    root.current?.traverse(object => {
      if (object instanceof Mesh) {
        const list = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of list) {
          if (!(material instanceof MeshPhysicalMaterial)) continue;
          material.transparent = ghost;
          material.depthWrite = !ghost;
          material.opacity = ghost ? .28 : 1;
          material.emissive.set(highlighted || ghost ? '#39b8cc' : '#000000');
          material.emissiveIntensity = highlighted ? .4 : ghost ? .2 : 0;
          material.needsUpdate = true;
          materials.current.push(material);
        }
      }
    });
  }, [slot, ghost, highlighted, telemetry]);
  useFrame((state, delta) => {
    if (!ghost || reducedMotion) return;
    elapsed.current += Math.min(delta, .1);
    const opacity = .24 + Math.sin(elapsed.current * 3.5) * .07;
    for (const material of materials.current) material.opacity = opacity;
    state.invalidate();
  });
  return <group ref={root}><Equipment slot={slot} telemetry={telemetry}/>{children}</group>;
}
