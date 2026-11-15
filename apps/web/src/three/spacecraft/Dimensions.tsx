import { Html, Line } from '@react-three/drei';
import type { BusId } from '@astrix/core';
import { BUS_GEOMETRY } from './slots';

export function Dimensions({ busId }: { busId: BusId }) {
  const { dimensions: [x, y, z], approximate } = BUS_GEOMETRY[busId];
  const colour = '#bed8e8';
  const label = (value: number) => `${approximate ? '≈ ' : ''}${Number(value.toFixed(3))} m`;
  const offset = Math.max(x, y, z) * .15;
  const style = { color: colour, fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'nowrap' as const, background: '#081520dd', borderRadius: '3px', padding: '2px 4px', pointerEvents: 'none' as const };
  return <group name="bus-dimensions">
    <Line points={[[x / 2 + offset, -y / 2, z / 2 + offset], [x / 2 + offset, y / 2, z / 2 + offset]]} color={colour} lineWidth={1}/>
    <Line points={[[-x / 2, -y / 2 - offset, z / 2 + offset], [x / 2, -y / 2 - offset, z / 2 + offset]]} color={colour} lineWidth={1}/>
    <Line points={[[x / 2 + offset, -y / 2 - offset, -z / 2], [x / 2 + offset, -y / 2 - offset, z / 2]]} color={colour} lineWidth={1}/>
    {[-1, 1].map(side => <group key={side}>
      <Line points={[[x / 2 + offset * .8, side * y / 2, z / 2 + offset], [x / 2 + offset * 1.2, side * y / 2, z / 2 + offset]]} color={colour} lineWidth={1}/>
      <Line points={[[side * x / 2, -y / 2 - offset * .8, z / 2 + offset], [side * x / 2, -y / 2 - offset * 1.2, z / 2 + offset]]} color={colour} lineWidth={1}/>
      <Line points={[[x / 2 + offset * .8, -y / 2 - offset, side * z / 2], [x / 2 + offset * 1.2, -y / 2 - offset, side * z / 2]]} color={colour} lineWidth={1}/>
    </group>)}
    <Html position={[x / 2 + offset * 1.2, 0, z / 2 + offset]} center style={style}>{label(y)}</Html>
    <Html position={[0, -y / 2 - offset * 1.3, z / 2 + offset]} center style={style}>{label(x)}</Html>
    <Html position={[x / 2 + offset * 1.4, -y / 2 - offset, 0]} center style={style}>{label(z)}</Html>
  </group>;
}
