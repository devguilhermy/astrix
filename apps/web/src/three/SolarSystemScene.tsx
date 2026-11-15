import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { DoubleSide, PerspectiveCamera, type Intersection, type Material, type Object3D } from 'three';
import { useTranslation } from 'react-i18next';
import type { BodyId } from '@astrix/core';
import { Planet } from './space/Planet';
import { Skybox } from './space/Skybox';
import { useSpaceTexture } from './space/textures';
import { SceneLine } from './ScenePrimitives';
import type { ScenePoint } from './committedScene';
import { LOCATOR_RADIUS, PICK_RADIUS, labelOffset, mixTowardWhite, offsetFrom, onOrbit, ringThrough, sunDiameterRatio } from './solar/scale';
import './solar/solarScene.css';

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

const EARTH_POSITION = onOrbit(-1.5, -5.1, 12.5);
/** Sizes to scale with the Sun (radius 6 = 695,700 km). Distances compressed; directions kept from the schematic layout. Not an ephemeris. */
export const SOLAR_BODIES: readonly SolarBodyDefinition[] = [
  { id: 'SUN', name: { en: 'Sun', pt: 'Sol' }, position: [0, 0, 0], radius: 6, texture: 'sun-stereo-sdo-304-1024.jpg', color: '#ffce76', destination: 'SUN' },
  { id: 'MERCURY', name: { en: 'Mercury', pt: 'Mercúrio' }, position: onOrbit(2.5, 1.5, 8.5), radius: .021, orbitRadius: 8.5, texture: 'mercury-messenger-enhanced-1024.jpg', color: '#a5a19a' },
  { id: 'VENUS', name: { en: 'Venus', pt: 'Vênus' }, position: onOrbit(-2.8, 2.8, 10.5), radius: .0522, orbitRadius: 10.5, texture: 'venus-magellan-radar-1024.jpg', color: '#ccb386' },
  { id: 'EARTH', name: { en: 'Earth', pt: 'Terra' }, position: EARTH_POSITION, radius: .055, orbitRadius: 12.5, texture: 'earth-blue-marble-1024.png', color: '#4385b0', destination: 'EARTH' },
  { id: 'MOON', name: { en: 'Moon', pt: 'Lua' }, position: offsetFrom(EARTH_POSITION, [.73, .12, 0], .45), radius: .015, texture: 'moon-lro-1024.jpg', color: '#aeb0b2', destination: 'MOON' },
  { id: 'MARS', name: { en: 'Mars', pt: 'Marte' }, position: onOrbit(-6.4, -.8, 14.5), radius: .0293, orbitRadius: 14.5, texture: 'mars-viking-1024.jpg', color: '#b47555', destination: 'MARS' },
  { id: 'JUPITER', name: { en: 'Jupiter', pt: 'Júpiter' }, position: onOrbit(8.6, 2.1, 19), radius: .6166, orbitRadius: 19, texture: 'jupiter-voyager-1024.jpg', color: '#bcaa96' },
  { id: 'SATURN', name: { en: 'Saturn', pt: 'Saturno' }, position: onOrbit(-4.7, 10.6, 24), radius: .5198, orbitRadius: 24, texture: 'saturn-cassini-rgb-1024.jpg', color: '#caba93' },
  { id: 'URANUS', name: { en: 'Uranus', pt: 'Urano' }, position: onOrbit(-8.4, -11.3, 28.5), radius: .2204, orbitRadius: 28.5, texture: 'uranus-hubble-opal-1024.jpg', color: '#91bfc5' },
  { id: 'NEPTUNE', name: { en: 'Neptune', pt: 'Netuno' }, position: onOrbit(10.8, -12.7, 33), radius: .2136, orbitRadius: 33, texture: 'neptune-hubble-opal-1024.jpg', color: '#4878b1' },
];
export const SOLAR_OVERVIEW = { position: [0, 0, 0] as ScenePoint, radius: 16 };
const MOON = SOLAR_BODIES.find(body => body.id === 'MOON')!;
const RINGS = [
  ...SOLAR_BODIES.filter(body => body.orbitRadius).map(body => ({ id: body.id, points: ringThrough([0, 0, 0], body.position), color: mixTowardWhite(body.color, .35), opacity: .55, width: 1.6 })),
  { id: MOON.id, points: ringThrough(EARTH_POSITION, MOON.position, 96), color: mixTowardWhite(MOON.color, .35), opacity: .5, width: 1.2 },
];
const PICKED_BY_GLOBE = new Set(SOLAR_BODIES.filter(body => body.radius >= PICK_RADIUS).map(body => body.id));
const PICK_SEGMENTS: [number, number] = [16, 12];

/** Image provenance for one body's globe, shown with that body's details. */
export function solarImageNote(id: SolarBodyId, pt: boolean): string {
  const iceYear = id === 'URANUS' ? '2017' : '2018';
  return id === 'URANUS' || id === 'NEPTUNE' ? pt ? `NASA / ESA Hubble OPAL ${iceYear}, STScI, CC BY 4.0. Filtros RGB de contraste realçado, não cores naturais. Preto indica polos não observados, não uma superfície física; há artefatos de mosaico próximos às lacunas.` : `NASA / ESA Hubble OPAL ${iceYear}, STScI, CC BY 4.0. Contrast-enhanced RGB filters, not natural-eye color. Black marks unobserved poles, not a physical surface; mosaicking artifacts remain near gaps.`
    : id === 'SATURN' ? pt ? 'Saturno: mapa RGB original Cassini ISS de 11 de agosto de 2011, NASA PDS; Li / West / Jiang / Knowles. Preto indica dados ausentes por obstrução dos anéis na faixa equatorial ou lacunas polares, não a cor física do planeta.' : 'Saturn: original Cassini ISS RGB map, August 11, 2011, NASA PDS; Li / West / Jiang / Knowles. Black marks data missing from ring-obstructed equatorial observations or polar gaps, not the planet’s physical color.'
    : id === 'SUN' ? pt ? 'Sol: composição STEREO + SDO de 2011 em ultravioleta extremo a 304 Å, com preenchimento polar. Não é luz visível nem uma observação atual.' : 'Sun: 2011 STEREO + SDO extreme-ultraviolet 304 Å composite with polar gap fill. Not visible light or a current observation.'
    : id === 'MERCURY' ? pt ? 'Mercúrio: mosaico MESSENGER com cores realçadas para mostrar geologia; não é a cor vista pelo olho humano.' : 'Mercury: MESSENGER enhanced-color geological mosaic; not human-eye color.'
    : id === 'VENUS' ? pt ? 'Vênus: mapa de radar da superfície Magellan, com preenchimento de lacunas; não são nuvens nem fotografia em luz visível.' : 'Venus: Magellan radar surface map with gap fill; not clouds or visible-light photography.'
    : id === 'MOON' ? pt ? 'Lua: mapa global real LRO, NASA SVS CGI Moon Kit. Não é uma fotografia atual.' : 'Moon: genuine LRO global map from the NASA SVS CGI Moon Kit. Not a current photograph.'
    : pt ? 'Mapa global de arquivo NASA / USGS. As cores dependem do instrumento e do processamento; não é uma observação atual.' : 'Archival NASA / USGS global map. Colors depend on the instrument and processing; not a current observation.';
}

/** Ray hits are distance-ordered. A pick sphere wins unless the ray reaches a visible small globe behind it;
 * a visible large globe occludes everything behind it.
 */
function pickedBody(intersections: readonly Intersection[]): SolarBodyId | null {
  let first: SolarBodyId | null = null;
  for (const hit of intersections) {
    let node: Object3D | null = hit.object, pick = false, id: SolarBodyId | undefined;
    for (; node && !id; node = node.parent) { pick ||= node.userData.solarPick === true; id = node.userData.solarBody; }
    if (!id) continue;
    first ??= id;
    if (!pick) return PICKED_BY_GLOBE.has(id) ? first : id;
  }
  return first;
}

/** Switching a previously untextured material to a map requires new shader defines. */
function refreshMappedMaterial(material: Material) {
  material.needsUpdate = true;
}

function SolarBody({ body, selected, hovered, pt }: { body: SolarBodyDefinition; selected: boolean; hovered: boolean; pt: boolean }) {
  const image = useSpaceTexture(body.id === 'EARTH' || body.id === 'MARS' || body.id === 'MOON' ? null : body.texture);
  const dot = useRef<HTMLSpanElement>(null);
  const located = body.radius < LOCATOR_RADIUS;
  // The dot gives way once the globe itself spans a few pixels.
  useFrame(({ camera, size }) => {
    if (!dot.current || !(camera instanceof PerspectiveCamera)) return;
    const distance = Math.hypot(camera.position.x - body.position[0], camera.position.y - body.position[1], camera.position.z - body.position[2]);
    dot.current.style.opacity = body.radius / (distance * Math.tan(camera.fov * Math.PI / 360)) * size.height / 2 > 3.5 ? '0' : '';
  });
  return <group name={`solar-${body.id.toLowerCase()}`} position={body.position} userData={{ solarBody: body.id }}>
    {body.id === 'EARTH' || body.id === 'MARS' || body.id === 'MOON' ? <Planet body={body.id} radiusKm={body.radius} sunDirection={[-body.position[0], body.position[2], -body.position[1]]} lowResolution/> : <mesh>
      <sphereGeometry args={[body.radius, 64, 32]}/>
      {body.id === 'SUN' ? <meshBasicMaterial map={image?.texture ?? null} color={image ? '#ffffff' : body.color} toneMapped={false} onUpdate={refreshMappedMaterial}/> : <meshStandardMaterial map={image?.texture ?? null} color={image ? '#ffffff' : body.color} roughness={.9} onUpdate={refreshMappedMaterial}/>}
    </mesh>}
    {body.radius < PICK_RADIUS && <mesh visible={false} userData={{ solarPick: true }}><sphereGeometry args={[PICK_RADIUS, ...PICK_SEGMENTS]}/></mesh>}
    {body.id === 'SATURN' && <mesh rotation={[-1.1, 0, .3]}><ringGeometry args={[body.radius * 1.3, body.radius * 2.05, 128]}/><meshStandardMaterial color="#c7baa2" transparent opacity={.6} side={DoubleSide}/></mesh>}
    {selected && <mesh raycast={() => null}><sphereGeometry args={[body.radius * 1.07, 24, 12]}/><meshBasicMaterial color="#c6edf2" wireframe transparent opacity={.12} depthWrite={false}/></mesh>}
    {located && <Html center zIndexRange={[1, 1]} style={{ pointerEvents: 'none' }}><span ref={dot} className="solar-scale-dot" data-selected={selected} data-hovered={hovered} style={{ '--solar-scale-dot': mixTowardWhite(body.color, .35) } as CSSProperties}/></Html>}
    {/* The Moon's label sits below it so it never covers Earth's. */}
    <Html position={[0, (body.id === 'MOON' ? -1 : 1) * labelOffset(body.radius), 0]} center zIndexRange={[1, 1]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}><span className="solar-body-label solar-scale-label" data-selected={selected} data-hovered={hovered}>{body.name[pt ? 'pt' : 'en']}</span></Html>
  </group>;
}

/** Static educational overview: camera changes never advance either orbital or mission time. */
export function SolarSystemScene({ selected, onFocus }: { selected: SolarBodyId | 'SYSTEM'; onFocus: (id: SolarBodyId) => void }) {
  const { i18n } = useTranslation();
  const pt = !!i18n.resolvedLanguage?.startsWith('pt');
  const canvas = useThree(state => state.gl.domElement);
  const [hovered, setHovered] = useState<SolarBodyId | null>(null);
  const down = useRef<{ id: number; x: number; y: number; body: SolarBodyId; moved: boolean } | null>(null);
  useEffect(() => {
    canvas.style.cursor = hovered ? 'pointer' : '';
    return () => { canvas.style.cursor = ''; };
  }, [canvas, hovered]);
  const pointerDown = (event: ThreeEvent<PointerEvent>) => {
    const body = event.button === 0 ? pickedBody(event.intersections) : null;
    if (!body) return;
    event.stopPropagation(); down.current = { id: event.pointerId, x: event.clientX, y: event.clientY, body, moved: false };
  };
  const pointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation(); setHovered(pickedBody(event.intersections));
    const start = down.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) start.moved = true;
  };
  const pointerUp = (event: ThreeEvent<PointerEvent>) => {
    const start = down.current; down.current = null;
    if (!start || start.id !== event.pointerId || start.moved || Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 5 || pickedBody(event.intersections) !== start.body) return;
    event.stopPropagation(); onFocus(start.body);
  };
  return <>
    <color attach="background" args={['#030812']}/><Skybox/>
    {/* No falloff: every planet is lit the same at compressed distances. */}
    <ambientLight intensity={.5}/><pointLight position={[0, 0, 0]} intensity={3.4} decay={0}/>
    {RINGS.map(ring => { const active = ring.id === selected || ring.id === hovered; return <SceneLine key={ring.id} points={ring.points} color={ring.color} opacity={active ? .95 : ring.opacity} width={active ? 2.6 : ring.width} closed/>; })}
    <group onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { down.current = null; }} onPointerOut={() => setHovered(null)}>
      {SOLAR_BODIES.map(body => <SolarBody key={body.id} body={body} selected={selected === body.id} hovered={hovered === body.id} pt={pt}/>)}
    </group>
  </>;
}

export function SolarSystemCaption({ body }: { body: SolarBodyDefinition | undefined }) {
  const { i18n } = useTranslation();
  const pt = i18n.resolvedLanguage?.startsWith('pt');
  const ratio = body && sunDiameterRatio(body.id);
  const fraction = ratio && new Intl.NumberFormat(pt ? 'pt-BR' : 'en', { maximumFractionDigits: ratio < 20 ? 1 : 0 }).format(ratio);
  return <div className="immersive-scene-caption">
    <strong>{body ? body.name[pt ? 'pt' : 'en'] : pt ? 'Sistema solar · ASTRIX11' : 'Solar system · ASTRIX11'}</strong>
    <span>{pt ? 'Tamanhos em escala com o Sol. Distâncias comprimidas. Não é uma efeméride.' : 'Sizes are to scale with the Sun. Distances are compressed. Not an ephemeris.'}</span>
    {body && <span className="solar-scale-fraction">{body.id === 'SUN' ? pt ? 'Sol: 1.391.400 km de diâmetro, a referência de todos os tamanhos' : 'Sun: 1,391,400 km across, the reference for every size' : pt ? `${body.name.pt}: 1/${fraction} do diâmetro do Sol` : `${body.name.en}: 1/${fraction} of the Sun's diameter`}</span>}
    <details><summary>{pt ? 'Escala, imagens e fontes' : 'Scale, imagery & sources'}</summary>
      <p>{pt ? 'Explore o Sol, os oito planetas e a Lua. Todos os globos compartilham uma escala de tamanho, definida pelo diâmetro de 1.391.400 km do Sol (NASA NSSDCA): a Terra tem 1/109 dele e Júpiter cerca de 1/10. Nessa escala a Terra ficaria a 215 raios solares do Sol, por isso as distâncias são comprimidas, as órbitas são guias circulares e as posições são esquemáticas; a Lua aparece muito mais perto da Terra do que está. Os anéis de Saturno mantêm suas proporções e os mundos pequenos têm um ponto de localização. O sistema permanece fixo; mover a câmera não simula o tempo.' : 'Explore the Sun, the eight planets and the Moon. Every globe shares one size scale, set by the Sun’s 1,391,400 km diameter (NASA NSSDCA): Earth is 1/109 of it and Jupiter about 1/10. At that scale Earth would sit 215 Sun radii from the Sun, so distances are compressed, orbits are circular guides and positions are schematic; the Moon is drawn much closer to Earth than it is. Saturn’s rings keep their proportions, and small worlds carry a locator dot. The layout is fixed; camera movement does not simulate time.'}</p>
      <p>{pt ? 'Os globos usam mapas de arquivo NASA / USGS, ESA e STScI, não observações atuais; o painel de cada astro indica a origem da imagem.' : 'Globes use archival NASA / USGS, ESA and STScI maps, not current observations; each body’s panel names its image source.'} <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">Hubble OPAL: NASA / ESA / STScI · CC BY 4.0</a></p>
      <p>{pt ? 'Missões disponíveis no Sol, na Terra, na Lua e em Marte. Estrelas: NASA SVS / ESA / Gaia / DPAC.' : 'Missions are available at the Sun, Earth, Moon and Mars. Stars: NASA SVS / ESA / Gaia / DPAC.'} <a href={`${import.meta.env.BASE_URL}textures/asset-sources.json`} target="_blank" rel="noreferrer">{pt ? 'Proveniência dos arquivos' : 'Asset provenance'}</a></p>
    </details>
  </div>;
}
