import type { BusId } from '@astrix/core';
import { BUS_GEOMETRY } from './slots';
import { CATEGORY_COLOURS, SURFACES } from './materials';
import type { RoomProjection } from './model';

export function BusFrame({ busId }: { busId: BusId }) {
  const [x, y, z] = BUS_GEOMETRY[busId].dimensions;
  const t = x * .035;
  if (busId === 'CREW_CAPSULE') return <group>
    <mesh position={[0, y * .2, 0]}><cylinderGeometry args={[x * .16, x / 2, y * .6, 40, 1, true]}/><meshPhysicalMaterial {...SURFACES.ceramic} transparent opacity={.28} depthWrite={false} side={2}/></mesh>
    <mesh position={[0, -y * .3, 0]}><cylinderGeometry args={[x * .5, x * .5, y * .4, 32, 1, true]}/><meshPhysicalMaterial {...SURFACES.foil} transparent opacity={.23} depthWrite={false} side={2}/></mesh>
    {[-.5, -.1].map(height => <mesh key={height} position={[0, y * height, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[x * .5 - t / 2, t / 2, 6, 40]}/><meshPhysicalMaterial {...SURFACES.rail}/></mesh>)}
    {[-1, 1].map(side => <mesh key={side} position={[side * x * .48, -y * .3, 0]}><boxGeometry args={[t, y * .4, t]}/><meshPhysicalMaterial {...SURFACES.rail}/></mesh>)}
  </group>;
  return <group>
    {[-1, 1].flatMap(a => [-1, 1].map(b => <mesh key={`rail:${a}:${b}`} position={[a * (x - t) / 2, 0, b * (z - t) / 2]}><boxGeometry args={[t, y, t]}/><meshPhysicalMaterial {...SURFACES.rail}/></mesh>))}
    {Array.from({ length: busId === 'CUBESAT_3U' ? 4 : 3 }, (_, i) => {
      const sections = busId === 'CUBESAT_3U' ? 3 : 2;
      const height = -y / 2 + t / 2 + (y - t) * i / sections;
      return <group key={i}>
        {[-1, 1].map(side => <mesh key={`x:${side}`} position={[side * (x - t) / 2, height, 0]}><boxGeometry args={[t, t, z]}/><meshPhysicalMaterial {...SURFACES.rail}/></mesh>)}
        {[-1, 1].map(side => <mesh key={`z:${side}`} position={[0, height, side * (z - t) / 2]}><boxGeometry args={[x, t, t]}/><meshPhysicalMaterial {...SURFACES.rail}/></mesh>)}
      </group>;
    })}
    <mesh position={[-x * .485, 0, 0]}><boxGeometry args={[x * .015, y * .93, z * .91]}/><meshPhysicalMaterial {...SURFACES.foil}/></mesh>
    {Array.from({ length: 9 }, (_, i) => <mesh key={`foil:${i}`} position={[-x * .495, (i - 4) * y * .1, 0]} rotation={[.06 * (i % 2 ? 1 : -1), 0, 0]}><boxGeometry args={[x * .007, y * .007, z * .9]}/><meshPhysicalMaterial {...SURFACES.foil} roughness={i % 2 ? .55 : .25}/></mesh>)}
  </group>;
}

/** Three stacked U cells for 3U; the other buses show abstract BAY fractions. */
export function RoomVolumes({ busId, room }: { busId: BusId; room: RoomProjection }) {
  const [x, y, z] = BUS_GEOMETRY[busId].dimensions;
  const n = room.cells.length;
  const height = y * .84 / n;
  const width = x * (busId === 'CREW_CAPSULE' ? .32 : .82);
  const depth = z * (busId === 'CREW_CAPSULE' ? .32 : .82);
  return <group name="room-budget" userData={{ used: room.used, capacity: room.capacity, overflow: room.overflow, abstractUnits: busId === 'CUBESAT_3U' ? 'U' : 'BAY' }}>
    {room.cells.map((cell, i) => <group key={i} position={[0, -y * .42 + height * (i + .5), 0]}>
      <mesh><boxGeometry args={[width, height * .96, depth]}/><meshBasicMaterial color="#78a7c1" wireframe transparent opacity={.14} depthWrite={false}/></mesh>
      {cell.fills.map((fill, j) => <mesh key={`${fill.partId}:${j}`} position={[0, -height / 2 + height * (fill.start + fill.amount / 2) / cell.capacity, 0]}>
        <boxGeometry args={[width * .97, height * fill.amount / cell.capacity * .94, depth * .97]}/>
        <meshBasicMaterial color={CATEGORY_COLOURS[fill.category]} transparent opacity={fill.preview ? .12 : .075} wireframe={fill.preview} depthWrite={false}/>
      </mesh>)}
    </group>)}
    {room.overflow > 0 && <mesh position={[0, y * .52 + y * .12 * room.overflow / room.capacity, 0]} userData={{ overflow: room.overflow }}>
      <boxGeometry args={[width, y * .24 * room.overflow / room.capacity, depth]}/><meshBasicMaterial color="#ff555f" transparent opacity={.45} depthWrite={false}/>
    </mesh>}
    {room.previewOverflow > 0 && <mesh position={[0, y * .52 + y * .24 * room.overflow / room.capacity + y * .12 * room.previewOverflow / room.capacity, 0]} userData={{ previewOverflow: room.previewOverflow }}>
      <boxGeometry args={[width, y * .24 * room.previewOverflow / room.capacity, depth]}/><meshBasicMaterial color="#ff555f" wireframe transparent opacity={.65} depthWrite={false}/>
    </mesh>}
  </group>;
}
