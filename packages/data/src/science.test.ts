import { describe, expect, test } from 'bun:test';
import { SCIENCE_BINDINGS, SCIENCE_TOPICS } from './index';
import english from '../../../apps/web/src/i18n/locales/en.json';
import portuguese from '../../../apps/web/src/i18n/locales/pt-BR.json';
import { learningEnglish, learningPortuguese } from '../../../apps/web/src/i18n/learning';
import type { ScienceTopic } from './contracts';

const required = ['mission-goal','mission-design','concept-maturity','systems-tradeoffs','mass-volume','cubesat-size','smallsat-class','launch-rides','game-budget','energy-budget','battery-storage','eclipse','solar-distance','data-return','data-storage','ground-contact','radio-links','pointing','orbit-height','orbit-shape','inclination','orbital-period','coverage','kepler-orbits','propulsion','specific-impulse','rocket-equation','transfer-orbits','capture-burn','light-time','command-delay','radiation','safe-mode','instrument-risk','model-assumptions','source-evidence','safety-margins','science-return','mission-failure'] as const;
const locales: readonly Readonly<Record<string, string>>[] = [{ ...english, ...learningEnglish }, { ...portuguese, ...learningPortuguese }];
const descriptors: readonly (keyof ScienceTopic)[] = ['titleKey','summaryKey','contextKey','consequenceKey','deeperKey','limitationsKey','diagramKey'];

describe('science content is concrete, bilingual and connected', () => {
  test('every topic has both depths, trade-offs, diagram text, evidence and valid related ids', () => {
    for (const [id, topic] of Object.entries(SCIENCE_TOPICS)) {
      expect(topic.id).toBe(id);
      expect(topic.target?.length ?? 0).toBeGreaterThan(0);
      expect(topic.sourceIds.length).toBeGreaterThan(0);
      expect(topic.related.length).toBeGreaterThan(0);
      expect(['orbit','energy','data','transfer','radiation','spacecraft']).toContain(topic.diagramId);
      for (const key of descriptors) for (const locale of locales) {
        const text = locale[String(topic[key])];
        expect(text, `${id} ${String(key)}`).toBeString();
        expect(text!.trim().length).toBeGreaterThan(0);
      }
      for (const related of topic.related) expect(related in SCIENCE_TOPICS).toBe(true);
    }
  });
  test('every registered context resolves to at least one valid topic', () => {
    for (const [context, ids] of Object.entries(SCIENCE_BINDINGS)) {
      expect(ids.length, context).toBeGreaterThan(0);
      for (const id of ids) expect(id in SCIENCE_TOPICS, `${context}: ${id}`).toBe(true);
    }
    for (const id of required) expect(SCIENCE_BINDINGS[`ui.${id}`]).toEqual([id]);
  });
  test('explicit contexts include all advanced scientific units and shipped categories', () => {
    for (const context of [
      'category.BATTERY','category.SOLAR','category.COMPUTER','category.STORAGE','category.ADCS','category.RADIO','category.INSTRUMENT','category.PROPULSION',
      'field.massKg','field.volume','field.cost','field.powerW','field.generationW','field.capacityWh','field.storageMB','field.rateKbps','field.ispSec','field.tankKg','field.altitudeKm','field.apoapsisAltitudeKm','field.inclinationDeg','field.periodMin','field.eclipseFrac','field.contactMinPerDay','field.marginPct','field.lightTimeSec','field.doseUGyH',
      'command.queue','command.SAFE','command.CAPTURE_CONFIRM','chart.battery','chart.downlink','chart.dose','source.radlab','source.donki','source.usgs','source.assumptions'
    ]) expect(SCIENCE_BINDINGS[context]?.length, context).toBeGreaterThan(0);
  });
  test('crew procedures, journey evidence and deployment have specific teaching bindings', () => {
    expect(SCIENCE_BINDINGS['mission.CREW_PATHFINDER']).toContain('crew-inventories');
    expect(SCIENCE_BINDINGS['command.CREW_FAN']).toContain('crew-atmosphere');
    expect(SCIENCE_BINDINGS['command.CREW_DEORBIT']).toContain('crew-return');
    expect(SCIENCE_BINDINGS['event.DEPLOYMENT_ANOMALY']).toContain('deployment');
    expect(SCIENCE_BINDINGS['requirement.SCI-QUALITY-01']).toContain('model-assumptions');
    expect(SCIENCE_BINDINGS['refusal.PROFILE_FORBIDS']).toBeUndefined();
  });
});
