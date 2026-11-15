import { describe, expect, test } from 'bun:test';
import { english, portuguese } from './resources';
import uiManifest from './uiKeys.json';
import { CORE_I18N_KEYS, CATALOG_I18N_KEYS } from '@astrix/core/i18nKeys';
import { listParts, listRides, listScenarios, listSources, listAssumptions, listOrbitPresets, createStarterDesign } from '@astrix/core';
import { SCIENCE_BINDINGS, SCIENCE_TOPICS } from '@astrix/data';


describe('complete bilingual mission content', () => {
  test('locales contain identical non-empty flat-key sets', () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(portuguese).sort());
    for (const locale of [english, portuguese]) for (const [key, text] of Object.entries(locale)) {
      expect(typeof text, key).toBe('string');
      expect(text.trim().length, key).toBeGreaterThan(0);
    }
  });
  test('every interpolation variable is preserved in the translation', () => {
    for (const key of Object.keys(english)) {
      const a = [...english[key]!.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map(m => m[1]!.trim()).sort();
      const b = [...portuguese[key]!.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map(m => m[1]!.trim()).sort();
      expect(b, key).toEqual(a);
    }
  });
  test('every engine and final UI manifest key is translated', () => {
    for (const key of [...CORE_I18N_KEYS, ...CATALOG_I18N_KEYS, ...Object.keys(uiManifest)]) {
      expect(english[key], `en:${key}`).toBeString(); expect(portuguese[key], `pt-BR:${key}`).toBeString();
    }
  });
  test('all disclosed assumptions have full translations and localized string values', () => {
    for (const assumption of listAssumptions()) {
      expect(english[`assumption.${assumption.key}`], `en:${assumption.key}`).toBeString();
      expect(portuguese[`assumption.${assumption.key}`], `pt-BR:${assumption.key}`).toBeString();
      if (typeof assumption.value === 'string') {
        expect(english[`assumptionValue.${assumption.key}`], `en:${assumption.key}`).toBeString();
        expect(portuguese[`assumptionValue.${assumption.key}`], `pt-BR:${assumption.key}`).toBeString();
      }
    }
  });
  test('every scientific catalogue descriptor and emitted core context has concrete help', () => {
    const contexts: string[] = [];
    for (const bus of ['CUBESAT_3U','SMALLSAT'] as const) {
      for (const part of listParts(bus)) contexts.push(`part.${part.id}`, `category.${part.category}`);
      for (const body of ['EARTH','MARS'] as const) for (const ride of listRides(bus, body)) contexts.push(`ride.${ride.id}`);
    }
    for (const scenario of listScenarios()) {
      contexts.push(`mission.${scenario.id}`, `metric.${scenario.metric}`);
      for (const preset of listOrbitPresets(createStarterDesign(scenario.id, 'ASPIRING'))) contexts.push(`preset.${preset.id}`);
    }
    for (const key of CORE_I18N_KEYS) {
      if (/^(cue|event|failure)\./.test(key)) contexts.push(key.split('.').slice(0,2).join('.'));
      if (/^(refusal|fact|advice|score)\./.test(key)) contexts.push(key);
    }
    for (const context of contexts) {
      const ids = SCIENCE_BINDINGS[context];
      expect(ids?.length, context).toBeGreaterThan(0);
      for (const id of ids ?? []) expect(id in SCIENCE_TOPICS, `${context}: ${id}`).toBe(true);
    }
  });
  test('science sources are real registry references, with unique identities', () => {
    const sources = listSources(), ids = new Set(sources.map(s => s.id));
    expect(ids.size).toBe(sources.length);
    for (const topic of Object.values(SCIENCE_TOPICS)) for (const source of topic.sourceIds) expect(ids.has(source), `${topic.id}: ${source}`).toBe(true);
  });
});
