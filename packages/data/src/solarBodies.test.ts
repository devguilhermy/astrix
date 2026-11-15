import { describe, expect, test } from 'bun:test';
import { SOLAR_FACT_IDS, SOLAR_FACT_SOURCES, SOLAR_FACTS, SOLAR_FACTS_RETRIEVED } from './index';
import type { SolarFact, SolarFactId } from './contracts';

const ids: readonly SolarFactId[] = ['SUN','MERCURY','VENUS','EARTH','MOON','MARS','JUPITER','SATURN','URANUS','NEPTUNE'];
const numeric = ['massE24Kg','diameterKm','gravityMs2','escapeKms','dayHours','distanceE6Km','orbitDays','meanTempC','moons'] as const satisfies readonly (keyof SolarFact)[];
const nasaUrl = /^https:\/\/(science\.nasa\.gov|nssdc\.gsfc\.nasa\.gov)\//;
// NSSDCA Planetary Fact Sheet - Metric as printed on 2026-11-15 (plan §5.8): mass, diameter, gravity, escape, day, distance, orbit, temperature, moons, rings, magnetic field.
const sheet: Readonly<Record<Exclude<SolarFactId, 'SUN'>, readonly [number, number, number, number, number, number, number, number, number, boolean, boolean]>> = {
  MERCURY:[0.330,4879,3.7,4.3,4222.6,57.9,88.0,167,0,false,true], VENUS:[4.87,12104,8.9,10.4,2802.0,108.2,224.7,464,0,false,false],
  EARTH:[5.97,12756,9.8,11.2,24.0,149.6,365.2,15,1,false,true], MOON:[0.073,3475,1.6,2.4,708.7,0.384,27.3,-20,0,false,false],
  MARS:[0.642,6792,3.7,5.0,24.7,228.0,687.0,-65,2,false,false], JUPITER:[1898,142984,23.1,59.5,9.9,778.5,4331,-110,95,true,true],
  SATURN:[568,120536,9.0,35.5,10.7,1432.0,10747,-140,274,true,true], URANUS:[86.8,51118,8.7,21.3,17.2,2867.0,30589,-195,28,true,true],
  NEPTUNE:[102,49528,11.0,23.5,16.1,4515.0,59800,-200,16,true,true]
};

describe('solar body facts are complete, sourced and bilingual', () => {
  test('all ten bodies are present in display order', () => {
    expect([...SOLAR_FACT_IDS]).toEqual([...ids]);
    expect(Object.keys(SOLAR_FACTS).sort()).toEqual([...ids].sort());
  });
  test('every number is finite or explicitly null', () => {
    for (const id of ids) for (const key of numeric) {
      const value = SOLAR_FACTS[id][key];
      if (value === null) expect(['distanceE6Km','orbitDays','moons'], `${id} ${key}`).toContain(key);
      else expect(Number.isFinite(value), `${id} ${key}`).toBe(true);
    }
    for (const key of ['distanceE6Km','orbitDays','moons'] as const) expect(SOLAR_FACTS.SUN[key]).toBeNull();
  });
  test('planet and Moon values match the NSSDCA sheet exactly', () => {
    expect(SOLAR_FACTS.EARTH.diameterKm).toBe(12756);
    for (const [id, row] of Object.entries(sheet) as [Exclude<SolarFactId, 'SUN'>, (typeof sheet)['EARTH']][]) {
      const fact = SOLAR_FACTS[id];
      expect([fact.massE24Kg,fact.diameterKm,fact.gravityMs2,fact.escapeKms,fact.dayHours,fact.distanceE6Km,fact.orbitDays,fact.meanTempC,fact.moons,fact.rings,fact.magneticField], id).toEqual([...row]);
      expect(fact.distanceFrom, id).toBe(id === 'MOON' ? 'EARTH' : 'SUN');
    }
  });
  test('Sun values come from the NSSDCA Sun fact sheet', () => {
    const sun = SOLAR_FACTS.SUN;
    expect(sun.kind).toBe('STAR');
    expect(sun.diameterKm).toBe(2 * 695_700);
    expect([sun.massE24Kg, sun.gravityMs2, sun.escapeKms, sun.dayHours]).toEqual([1_988_400, 274.0, 617.6, 609.12]);
    expect(sun.meanTempC).toBeCloseTo(5772 - 273.15, 6);
    expect(sun.factSheetUrl).toBe('https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html');
  });
  test('every URL points to NASA Science or NSSDCA and every fact sheet is a listed source', () => {
    const sheets = SOLAR_FACT_SOURCES.map(source => source.url);
    for (const url of sheets) expect(url).toMatch(nasaUrl);
    for (const id of ids) {
      const fact = SOLAR_FACTS[id];
      expect(sheets, id).toContain(fact.factSheetUrl);
      expect(fact.exploredBy.length, id).toBeGreaterThan(0);
      for (const { name, url } of fact.exploredBy) { expect(name.trim().length).toBeGreaterThan(0); expect(url).toMatch(nasaUrl); expect(url).toBe(`https://science.nasa.gov/${id.toLowerCase()}/`); }
    }
    expect(SOLAR_FACTS_RETRIEVED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const source of SOLAR_FACT_SOURCES) expect(source.retrieved).toBe(SOLAR_FACTS_RETRIEVED);
  });
  test('both languages are non-empty', () => {
    for (const id of ids) {
      const { en, pt } = SOLAR_FACTS[id].sentence;
      expect(en.trim().length, id).toBeGreaterThan(0);
      expect(pt.trim().length, id).toBeGreaterThan(0);
      expect(pt, id).not.toBe(en);
    }
  });
});
