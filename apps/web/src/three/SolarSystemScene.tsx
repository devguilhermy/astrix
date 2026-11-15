import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { DoubleSide, type Material } from 'three';
import { useTranslation } from 'react-i18next';
import type { BodyId } from '@astrix/core';
import { Planet } from './space/Planet';
import { Skybox } from './space/Skybox';
import { useSpaceTexture } from './space/textures';
import { SceneLine } from './ScenePrimitives';
import type { ScenePoint } from './committedScene';

export type SolarBodyId = 'SUN' | 'MERCURY' | 'VENUS' | 'EARTH' | 'MOON' | 'MARS' | 'JUPITER' | 'SATURN' | 'URANUS' | 'NEPTUNE';
export interface SolarBodyDefinition {
  id: SolarBodyId;
  name: { en: string; pt: string };
  position: ScenePoint;
  radius: number;
  orbitRadius?: number;
  texture: string | null;
  color: string;
  destination?: BodyId;
}

/** Authored display positions and radii. Neither an ephemeris nor a distance model. */
export const SOLAR_BODIES: readonly SolarBodyDefinition[] = [
  { id: 'SUN', name: { en: 'Sun', pt: 'Sol' }, position: [0, 0, 0], radius: 1.3, texture: 'sun-stereo-sdo-304-1024.jpg', color: '#ffce76' },
  { id: 'MERCURY', name: { en: 'Mercury', pt: 'Mercúrio' }, position: [2.5, 0, 1.5], radius: .17, orbitRadius: 2.92, texture: 'mercury-messenger-enhanced-1024.jpg', color: '#a5a19a' },
  { id: 'VENUS', name: { en: 'Venus', pt: 'Vênus' }, position: [-2.8, 0, 2.8], radius: .28, orbitRadius: 3.96, texture: 'venus-magellan-radar-1024.jpg', color: '#ccb386' },
  { id: 'EARTH', name: { en: 'Earth', pt: 'Terra' }, position: [-1.5, 0, -5.1], radius: .3, orbitRadius: 5.32, texture: 'earth-blue-marble-1024.png', color: '#4385b0', destination: 'EARTH' },
  { id: 'MOON', name: { en: 'Moon', pt: 'Lua' }, position: [-.77, .12, -5.1], radius: .12, texture: 'moon-lro-1024.jpg', color: '#aeb0b2', destination: 'MOON' },
  { id: 'MARS', name: { en: 'Mars', pt: 'Marte' }, position: [-6.4, 0, -.8], radius: .22, orbitRadius: 6.45, texture: 'mars-viking-1024.jpg', color: '#b47555', destination: 'MARS' },
  { id: 'JUPITER', name: { en: 'Jupiter', pt: 'Júpiter' }, position: [8.6, 0, 2.1], radius: .86, orbitRadius: 8.85, texture: 'jupiter-voyager-1024.jpg', color: '#bcaa96' },
  { id: 'SATURN', name: { en: 'Saturn', pt: 'Saturno' }, position: [-4.7, 0, 10.6], radius: .72, orbitRadius: 11.6, texture: 'saturn-cassini-rgb-1024.jpg', color: '#caba93' },
  { id: 'URANUS', name: { en: 'Uranus', pt: 'Urano' }, position: [-8.4, 0, -11.3], radius: .48, orbitRadius: 14.08, texture: 'uranus-hubble-opal-1024.jpg', color: '#91bfc5' },
  { id: 'NEPTUNE', name: { en: 'Neptune', pt: 'Netuno' }, position: [10.8, 0, -12.7], radius: .47, orbitRadius: 16.67, texture: 'neptune-hubble-opal-1024.jpg', color: '#4878b1' },
];
export const SOLAR_OVERVIEW = { position: [0, 0, 0] as ScenePoint, radius: 18 };
const ORBIT_RINGS = SOLAR_BODIES.filter(body => body.orbitRadius).map(body => ({ id: body.id, points: Array.from({ length: 161 }, (_, i): ScenePoint => {
  const angle = i / 160 * Math.PI * 2;
  return [Math.cos(angle) * body.orbitRadius!, 0, Math.sin(angle) * body.orbitRadius!];
}) }));

/** Switching a previously untextured material to a map requires new shader defines. */
function refreshMappedMaterial(material: Material) {
  material.needsUpdate = true;
}

function SolarBody({ body, selected, onFocus }: { body: SolarBodyDefinition; selected: boolean; onFocus: (id: SolarBodyId) => void }) {
  const image = useSpaceTexture(body.id === 'EARTH' || body.id === 'MARS' || body.id === 'MOON' ? null : body.texture);
  const { i18n } = useTranslation();
  const canvas = useThree(state => state.gl.domElement);
  const down = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const pointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation(); down.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  };
  return <group name={`solar-${body.id.toLowerCase()}`} position={body.position} onPointerDown={pointerDown}
    onPointerMove={event => { const start = down.current; if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) start.moved = true; }}
    onPointerUp={event => { const start = down.current; down.current = null; if (start && start.id === event.pointerId && !start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5) { event.stopPropagation(); onFocus(body.id); } }}
    onPointerCancel={() => { down.current = null; }}
    onPointerOver={event => { event.stopPropagation(); canvas.style.cursor = 'pointer'; }} onPointerOut={() => { canvas.style.cursor = ''; }}>
    {body.id === 'EARTH' || body.id === 'MARS' || body.id === 'MOON' ? <Planet body={body.id} radiusKm={body.radius} sunDirection={[-body.position[0], body.position[2], -body.position[1]]} lowResolution/> : <mesh>
      <sphereGeometry args={[body.radius, 64, 32]}/>
      {body.id === 'SUN' ? <meshBasicMaterial map={image?.texture ?? null} color={image ? '#ffffff' : body.color} toneMapped={false} onUpdate={refreshMappedMaterial}/> : <meshStandardMaterial map={image?.texture ?? null} color={image ? '#ffffff' : body.color} roughness={.9} onUpdate={refreshMappedMaterial}/>}
    </mesh>}
    {body.id === 'SATURN' && <mesh rotation={[-1.1, 0, .3]}><ringGeometry args={[body.radius * 1.3, body.radius * 2.05, 96]}/><meshStandardMaterial color="#c7baa2" transparent opacity={.6} side={DoubleSide}/></mesh>}
    {selected && <mesh raycast={() => null}><sphereGeometry args={[body.radius * 1.07, 24, 12]}/><meshBasicMaterial color="#c6edf2" wireframe transparent opacity={.12} depthWrite={false}/></mesh>}
    <Html position={[0, body.radius + .16, 0]} center zIndexRange={[1, 1]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}><span className="solar-body-label" data-selected={selected}>{body.name[i18n.resolvedLanguage?.startsWith('pt') ? 'pt' : 'en']}</span></Html>
  </group>;
}

/** Static educational overview: camera changes never advance either orbital or mission time. */
export function SolarSystemScene({ selected, onFocus }: { selected: SolarBodyId | 'SYSTEM'; onFocus: (id: SolarBodyId) => void }) {
  return <>
    <color attach="background" args={['#030812']}/><Skybox/>
    <ambientLight intensity={.7}/><pointLight position={[0, 0, 0]} intensity={8} decay={1}/>
    {ORBIT_RINGS.map(orbit => <SceneLine key={orbit.id} points={orbit.points} color="#93abc5" opacity={.13} closed/>)}
    {SOLAR_BODIES.map(body => <SolarBody key={body.id} body={body} selected={selected === body.id} onFocus={onFocus}/>)}
  </>;
}

export function SolarSystemCaption({ body }: { body: SolarBodyDefinition | undefined }) {
  const { i18n } = useTranslation();
  const pt = i18n.resolvedLanguage?.startsWith('pt');
  const iceGiant = body?.id === 'URANUS' || body?.id === 'NEPTUNE';
  const iceYear = body?.id === 'URANUS' ? '2017' : '2018';
  const imageNote = iceGiant ? pt ? `NASA / ESA Hubble OPAL ${iceYear}, STScI, CC BY 4.0. Filtros RGB de contraste realçado, não cores naturais. Preto indica polos não observados, não uma superfície física; há artefatos de mosaico próximos às lacunas.` : `NASA / ESA Hubble OPAL ${iceYear}, STScI, CC BY 4.0. Contrast-enhanced RGB filters, not natural-eye color. Black marks unobserved poles, not a physical surface; mosaicking artifacts remain near gaps.` : !body ? pt ? 'Mapas de arquivo NASA / USGS, não observações atuais. Escolha um astro para ver a origem da imagem.' : 'Archival NASA / USGS maps, not current observations. Select a body for image context.' : body.id === 'SUN' ? pt ? 'Sol: composição STEREO + SDO de 2011 em ultravioleta extremo a 304 Å, com preenchimento polar. Não é luz visível nem uma observação atual.' : 'Sun: 2011 STEREO + SDO extreme-ultraviolet 304 Å composite with polar gap fill. Not visible light or a current observation.' : body.id === 'MERCURY' ? pt ? 'Mercúrio: mosaico MESSENGER com cores realçadas para mostrar geologia; não é a cor vista pelo olho humano.' : 'Mercury: MESSENGER enhanced-color geological mosaic; not human-eye color.' : body.id === 'VENUS' ? pt ? 'Vênus: mapa de radar da superfície Magellan, com preenchimento de lacunas; não são nuvens nem fotografia em luz visível.' : 'Venus: Magellan radar surface map with gap fill; not clouds or visible-light photography.' : body.id === 'MOON' ? pt ? 'Lua: mapa global real LRO, NASA SVS CGI Moon Kit. Não é uma fotografia atual.' : 'Moon: genuine LRO global map from the NASA SVS CGI Moon Kit. Not a current photograph.' : pt ? 'Mapa global de arquivo NASA / USGS. As cores dependem do instrumento e do processamento; não é uma observação atual.' : 'Archival NASA / USGS global map. Colors depend on the instrument and processing; not a current observation.';
  return <div className="immersive-scene-caption">
    <strong>{body ? body.name[pt ? 'pt' : 'en'] : pt ? 'Sistema solar · ASTRIX11' : 'Solar system · ASTRIX11'}</strong>
    <span>{pt ? 'Posições e tamanhos esquemáticos. Não é uma efeméride.' : 'Schematic positions and sizes. Not an ephemeris.'}</span>
    {body && <span className="solar-image-note">{body.id === 'SATURN' ? pt ? 'Cassini RGB 2011 · preto = sem dados' : 'Cassini RGB 2011 · black = no data' : iceGiant ? pt ? `Hubble OPAL ${iceYear} · cores realçadas; preto = sem dados` : `Hubble OPAL ${iceYear} · enhanced color; black = no data` : body.id === 'SUN' ? pt ? 'Composição ultravioleta extrema · arquivo 2011' : 'Extreme-ultraviolet composite · 2011 archive' : body.id === 'MERCURY' ? pt ? 'Cores geológicas realçadas' : 'Enhanced geological colors' : body.id === 'VENUS' ? pt ? 'Superfície em radar · não são nuvens' : 'Radar surface · not clouds' : pt ? 'Imagens de arquivo NASA / USGS' : 'Archival NASA / USGS imagery'}</span>}
    <details><summary>{pt ? 'Escala, imagens e fontes' : 'Scale, imagery & sources'}</summary>
      <p>{pt ? 'Explore o Sol, os oito planetas e a Lua. Raios, distâncias, órbitas circulares e anéis são ilustrativos e não compartilham uma escala física. O sistema permanece fixo; mover a câmera não simula o tempo.' : 'Explore the Sun, eight planets and the Moon. Radii, distances, circular orbit guides and rings are illustrative and do not share a physical scale. The layout is fixed; camera movement does not simulate time.'}</p>
      <p>{body?.id === 'SATURN' ? pt ? 'Saturno: mapa RGB original Cassini ISS de 11 de agosto de 2011, NASA PDS; Li / West / Jiang / Knowles. Preto indica dados ausentes por obstrução dos anéis na faixa equatorial ou lacunas polares, não a cor física do planeta.' : 'Saturn: original Cassini ISS RGB map, August 11, 2011, NASA PDS; Li / West / Jiang / Knowles. Black marks data missing from ring-obstructed equatorial observations or polar gaps, not the planet’s physical color.' : imageNote}</p>
      {iceGiant && <p><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">NASA / ESA / STScI · CC BY 4.0</a></p>}
      <p>{pt ? 'Missões disponíveis apenas na Terra, Lua e Marte. Estrelas: NASA SVS / ESA / Gaia / DPAC.' : 'Missions are available only at Earth, Moon and Mars. Stars: NASA SVS / ESA / Gaia / DPAC.'} <a href={`${import.meta.env.BASE_URL}textures/asset-sources.json`} target="_blank" rel="noreferrer">{pt ? 'Proveniência dos arquivos' : 'Asset provenance'}</a></p>
    </details>
  </div>;
}
