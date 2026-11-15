import { useMemo } from 'react';
import { SceneHtml } from '../SceneHtml';
import type { TurnMoment } from '../../ui/play/turnMoments';
import { renderPoint, type CommittedScene } from '../committedScene';
import { turnName } from './turnLabels';

const SELECTED = '#ffb16b';

/**
 * Numbered turn positions on the flown trail at mission end. Each label is a button, so the
 * markers are reachable by keyboard as well as by pointer; the selected one is enlarged and orange.
 */
export function TurnMarkers({ scene, moments, selected, onSelect, pt }: { scene: CommittedScene; moments: readonly TurnMoment[]; selected: number | null; onSelect?: (index: number) => void; pt: boolean }) {
  const markers = useMemo(() => moments.filter(moment => moment.positionKm && moment.body === scene.body).map(moment => ({ moment, position: renderPoint(moment.positionKm!, scene.radiusKm) })), [moments, scene.body, scene.radiusKm]);
  return <group name="turn-markers">
    {markers.map(({ moment, position }) => {
      const active = moment.index === selected;
      return <group key={moment.index} position={position}>
        <mesh scale={active ? .034 : .02} raycast={() => null}><sphereGeometry args={[1, 16, 10]}/><meshBasicMaterial color={active ? SELECTED : '#d5eef2'} depthTest={false} transparent opacity={.95}/></mesh>
        <SceneHtml center zIndexRange={[3, 3]} style={{ pointerEvents: 'none' }}>
          <button type="button" className="scene-fb-marker" data-selected={active} aria-pressed={active} aria-label={turnName(moment, pt)} title={turnName(moment, pt)} disabled={!onSelect}
            onClick={() => onSelect?.(moment.index)}><span aria-hidden="true">{moment.index}</span></button>
        </SceneHtml>
      </group>;
    })}
  </group>;
}
