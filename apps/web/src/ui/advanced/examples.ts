/**
 * Example inputs: ASTRIX-authored files in the supported profile, and unmodified NASA GMAT samples (Apache-2.0).
 * Each `new URL(literal, import.meta.url)` makes Vite serve the fixture in dev and emit it as a hashed asset in builds.
 */
export interface GmatExample {
  readonly group: 'astrix' | 'nasa';
  readonly file: string;
  readonly url: string;
  readonly kind: 'oem' | 'report' | 'script';
  /** Spacecraft to select for script and ReportFile imports. */
  readonly object: string;
  readonly en: string;
  readonly pt: string;
}

export const gmatExamples: readonly GmatExample[] = [
  { group: 'astrix', file: 'astrix-earth-initial-state.script', url: new URL('../../../../../scripts/fixtures/gmat/astrix-earth-initial-state.script', import.meta.url).href, kind: 'script', object: 'Astrix', en: 'Earth initial state exported by ASTRIX (Keplerian, EarthMJ2000Eq)', pt: 'Estado inicial da Terra exportado pelo ASTRIX (kepleriano, EarthMJ2000Eq)' },
  { group: 'astrix', file: 'astrix-mars-initial-state.script', url: new URL('../../../../../scripts/fixtures/gmat/astrix-mars-initial-state.script', import.meta.url).href, kind: 'script', object: 'Astrix', en: 'Mars initial state exported by ASTRIX (Keplerian, Mars MJ2000Eq frame)', pt: 'Estado inicial de Marte exportado pelo ASTRIX (kepleriano, quadro MJ2000Eq de Marte)' },
  { group: 'astrix', file: 'earth-gaps.oem', url: new URL('../../../../../scripts/fixtures/gmat/earth-gaps.oem', import.meta.url).href, kind: 'oem', object: '', en: 'Earth OEM with two segments and a gap, to check the viewer', pt: 'OEM da Terra com dois segmentos e uma lacuna, para testar o visualizador' },
  { group: 'astrix', file: 'mars-irregular.txt', url: new URL('../../../../../scripts/fixtures/gmat/mars-irregular.txt', import.meta.url).href, kind: 'report', object: 'Probe', en: 'Mars ReportFile with irregular sample times', pt: 'ReportFile de Marte com tempos de amostra irregulares' },
  { group: 'nasa', file: 'Tut_SimulatingAnOrbit.script', url: new URL('../../../../../scripts/fixtures/gmat/nasa-samples/Tut_SimulatingAnOrbit.script', import.meta.url).href, kind: 'script', object: 'Sat', en: 'Simulating an Orbit tutorial: reads Sat’s Keplerian initial state; the force model and propagation are ignored', pt: 'Tutorial de simulação de órbita: lê o estado inicial kepleriano de Sat; modelo de forças e propagação são ignorados' },
  { group: 'nasa', file: 'Ex_HohmannTransfer.script', url: new URL('../../../../../scripts/fixtures/gmat/nasa-samples/Ex_HohmannTransfer.script', import.meta.url).href, kind: 'script', object: 'DefaultSC', en: 'Hohmann transfer: DefaultSC sets no state (GMAT default), so the import is refused', pt: 'Transferência de Hohmann: DefaultSC não define estado (padrão do GMAT), então a importação é recusada' },
  { group: 'nasa', file: 'Ex_MarsOrbit.script', url: new URL('../../../../../scripts/fixtures/gmat/nasa-samples/Ex_MarsOrbit.script', import.meta.url).href, kind: 'script', object: 'MarsOrbiter', en: 'Mars constellation: reads MarsOrbiter’s TAIModJulian Keplerian state (MPS1–MPS4 also work)', pt: 'Constelação em Marte: lê o estado kepleriano TAIModJulian de MarsOrbiter (MPS1–MPS4 também funcionam)' },
  { group: 'nasa', file: 'Ex_OEMPropagation.script', url: new URL('../../../../../scripts/fixtures/gmat/nasa-samples/Ex_OEMPropagation.script', import.meta.url).href, kind: 'script', object: 'EphSat', en: 'EphSat takes its trajectory from an ephemeris file, so there is no initial state to import; use SampleOEMEphem.oem', pt: 'EphSat obtém a trajetória de um arquivo de efeméride, então não há estado inicial; use SampleOEMEphem.oem' },
  { group: 'nasa', file: 'SampleOEMEphem.oem', url: new URL('../../../../../scripts/fixtures/gmat/nasa-samples/SampleOEMEphem.oem', import.meta.url).href, kind: 'oem', object: '', en: 'Sample CCSDS OEM 1.0 ephemeris: two days around Earth at 60 s steps (EME2000, UTC)', pt: 'Efeméride CCSDS OEM 1.0 de exemplo: dois dias ao redor da Terra a cada 60 s (EME2000, UTC)' },
];
