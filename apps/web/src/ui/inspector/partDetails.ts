import type { Design, PartCategory, PartDef, Q, Telemetry } from '@astrix/core';
import type { ScienceTopicId } from '@astrix/data';

export const categoryTopic:Record<PartCategory,ScienceTopicId>={BATTERY:'battery-storage',SOLAR:'solar-distance',COMPUTER:'mission-design',STORAGE:'data-storage',ADCS:'pointing',RADIO:'radio-links',INSTRUMENT:'science-return',PROPULSION:'propulsion',THERMAL:'thermal-control'};

/** One labelled reading. `textKey` values are localized by the caller; numbers keep their own unit and precision. */
export interface DetailRow {
  readonly key: string;
  readonly value?: number;
  readonly unit?: string;
  readonly digits?: number;
  readonly textKey?: string;
  /** True when the catalogue value is an authored teaching assumption rather than a cited source. */
  readonly assumed?: boolean;
}

const quantity = (key: string, q: Q | undefined, unit: string, digits = 2): DetailRow[] =>
  q ? [{ key, value: q.v, unit, digits, assumed: q.p.kind === 'assumption' }] : [];

/** Catalogue characteristics of one part, in display order. Never inferred: absent fields are omitted. */
export function partSpecs(part: PartDef, design: Pick<Design, 'busId'>): readonly DetailRow[] {
  return [
    ...quantity('mass', part.massKg, 'kg'),
    ...quantity('volume', part.volume, design.busId === 'CUBESAT_3U' ? 'U' : 'bay'),
    ...quantity('cost', part.cost, '', 0),
    ...quantity('power', part.powerW, 'W'),
    ...quantity('generation', part.generationW, 'W'),
    ...quantity('capacity', part.capacityWh, 'Wh'),
    ...quantity('storage', part.storageMB, 'MB', 0),
    ...quantity('rate', part.rateKbps, 'kb/s'),
    ...quantity('txPower', part.txPowerW, 'W'),
    ...quantity('isp', part.ispSec, 's', 0),
    ...quantity('tank', part.tankKg, 'kg'),
    ...quantity('heater', part.heaterW, 'W'),
    ...quantity('slewRate', part.slewRateDegSec, '°/s'),
    ...quantity('accuracy', part.accuracyDeg, '°'),
    ...quantity('cone', part.coneHalfAngleDeg, '°'),
    ...quantity('beam', part.beamHalfAngleDeg, '°'),
  ];
}

/** Operating constraints the simulator enforces for this part. */
export function partTraits(part: PartDef): readonly string[] {
  return [
    part.unique && 'unique',
    part.finePointing && 'finePointing',
    part.directional && 'directional',
    part.requiresTarget && 'requiresTarget',
    part.requiresLight && 'requiresLight',
  ].filter((trait): trait is string => !!trait);
}

const status = (key: string, textKey: string): DetailRow => ({ key, textKey });
const degrees = (radians: number) => radians * 180 / Math.PI;

/**
 * Live readings from core telemetry only. Returns an empty list before launch or for an uninstalled part,
 * so the panel never presents catalogue values as flight state.
 */
export function liveReadings(part: PartDef, telemetry: Telemetry | null, installed: boolean): readonly DetailRow[] {
  if (!telemetry || !installed) return [];
  const x = telemetry;
  switch (part.category) {
    case 'SOLAR': return [
      { key: 'generationNow', value: x.genW, unit: 'W', digits: 1 },
      status('light', x.sunlit ? 'sunlit' : 'shadow'),
      { key: 'panelSun', value: x.attitude.panelSunDeg, unit: '°', digits: 0 },
      ...(x.deployment.wings !== 'NOT_APPLICABLE' ? [status('deployment', `deploy.${x.deployment.wings}`)] : []),
    ];
    case 'BATTERY': return [
      { key: 'charge', value: x.capacityWh > 0 ? x.socWh / x.capacityWh * 100 : 0, unit: '%', digits: 0 },
      { key: 'energy', value: x.socWh, unit: 'Wh', digits: 1 },
      { key: 'capacityNow', value: x.capacityWh, unit: 'Wh', digits: 1 },
      { key: 'load', value: x.loadW, unit: 'W', digits: 1 },
    ];
    case 'STORAGE': return [
      { key: 'stored', value: x.storedMB, unit: 'MB', digits: 0 },
      { key: 'storageNow', value: x.storageMB, unit: 'MB', digits: 0 },
      { key: 'delivered', value: x.downlinkedMB, unit: 'MB', digits: 1 },
    ];
    case 'RADIO': return [
      status('contact', x.inContact ? 'inContact' : 'noContact'),
      status('downlink', x.downlinkActive ? 'active' : x.downlinkRequested ? 'requested' : 'idle'),
      { key: 'linkRate', value: x.link.activeRateKbps, unit: 'kb/s', digits: 1 },
      { key: 'antennaEarth', value: x.attitude.antennaEarthDeg, unit: '°', digits: 0 },
      ...(x.deployment.antenna !== 'NOT_APPLICABLE' ? [status('deployment', `deploy.${x.deployment.antenna}`)] : []),
    ];
    case 'INSTRUMENT': {
      const instrument = x.instruments.find(item => item.partId === part.id);
      return [
        status('power', instrument?.lost ? 'lost' : instrument?.on ? 'on' : 'off'),
        ...(instrument ? [{ key: 'duty', value: instrument.dutyFraction * 100, unit: '%', digits: 0 }] : []),
        { key: 'targetAngle', value: x.attitude.instrumentTargetDeg, unit: '°', digits: 0 },
      ];
    }
    case 'ADCS': return [
      status('hold', `hold.${x.attitude.hold}`),
      status('pointing', `pointing.${x.pointing.state}`),
      { key: 'slewNow', value: degrees(x.attitude.rateRadSec), unit: '°/s', digits: 2 },
    ];
    case 'COMPUTER': return [
      status('computer', `computer.${x.computer.state}`),
      { key: 'resets', value: x.computer.resets, digits: 0 },
    ];
    case 'THERMAL': return x.thermal ? [
      { key: 'temperature', value: x.thermal.temperatureK - 273.15, unit: '°C', digits: 1 },
      { key: 'heaterNow', value: x.thermal.heaterW, unit: 'W', digits: 1 },
    ] : [];
    case 'PROPULSION': return x.capture ? [
      { key: 'propellant', value: x.capture.propellantKg, unit: 'kg', digits: 2 },
      { key: 'deltaV', value: x.capture.availableKms * 1000, unit: 'm/s', digits: 0 },
    ] : [];
  }
}
