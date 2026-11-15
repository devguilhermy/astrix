/** Unmodified NASA GMAT sample inputs, served from `<base>gmat-examples/` (copied by scripts/prepare-public.ts). */
export interface GmatExample {
  readonly file: string;
  readonly kind: 'oem' | 'report' | 'script';
  /** Spacecraft to select for script and ReportFile imports. */
  readonly object: string;
  readonly en: string;
  readonly pt: string;
}

export const gmatExamples: readonly GmatExample[] = [
  { file: 'Tut_SimulatingAnOrbit.script', kind: 'script', object: 'Sat', en: 'Simulating an Orbit tutorial: Earth LEO with force model, burn and propagation', pt: 'Tutorial de simulação de órbita: LEO da Terra com modelo de forças, manobra e propagação' },
  { file: 'Ex_HohmannTransfer.script', kind: 'script', object: 'DefaultSC', en: 'Hohmann transfer targeted with two burns', pt: 'Transferência de Hohmann com duas manobras' },
  { file: 'Ex_MarsOrbit.script', kind: 'script', object: 'MarsOrbiter', en: 'Constellation propagated around Mars', pt: 'Constelação propagada ao redor de Marte' },
  { file: 'Ex_OEMPropagation.script', kind: 'script', object: 'EphSat', en: 'Spacecraft propagated from an OEM ephemeris', pt: 'Espaçonave propagada a partir de uma efeméride OEM' },
  { file: 'SampleOEMEphem.oem', kind: 'oem', object: '', en: 'Sample CCSDS OEM ephemeris (Earth, EME2000, UTC)', pt: 'Efeméride CCSDS OEM de exemplo (Terra, EME2000, UTC)' },
];
