import type { MeshPhysicalMaterialParameters } from 'three';
import type { PartCategory } from '@astrix/core';

/** Independently authored procedural surfaces; no external models or textures. */
export const SURFACES = {
  rail: { color: '#afbac4', metalness: .88, roughness: .29 },
  dark: { color: '#202a33', metalness: .72, roughness: .42 },
  foil: { color: '#d6a542', metalness: .93, roughness: .38, clearcoat: .25, clearcoatRoughness: .45 },
  solar: { color: '#102d62', metalness: .62, roughness: .17, clearcoat: .9, clearcoatRoughness: .12 },
  cellWire: { color: '#aab4ce', metalness: .88, roughness: .24 },
  circuit: { color: '#18584d', metalness: .2, roughness: .65 },
  ceramic: { color: '#e5e5df', metalness: .12, roughness: .7 },
  copper: { color: '#c68843', metalness: .88, roughness: .3 },
  lens: { color: '#124c70', metalness: .15, roughness: .035, transmission: .5, thickness: .004, ior: 1.5, clearcoat: 1 },
  thermal: { color: '#8f4d2c', metalness: .35, roughness: .65 },
} satisfies Record<string, MeshPhysicalMaterialParameters>;
export type Surface = keyof typeof SURFACES;
export const CATEGORY_COLOURS: Readonly<Record<PartCategory, string>> = {
  BATTERY: '#dfb65b', SOLAR: '#6086ee', COMPUTER: '#58bcad', STORAGE: '#a790dc',
  ADCS: '#d7dce5', RADIO: '#65bfe5', INSTRUMENT: '#83db8b', PROPULSION: '#df9873', THERMAL: '#d9a8ab',
};
