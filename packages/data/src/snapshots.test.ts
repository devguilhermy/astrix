import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { RADLAB_PROFILE, DONKI_SNAPSHOT, USGS_MISSIONS, EXTRA_SOURCES } from './index';
import raw from '../snapshots/raw/radlab.json';
import rawProvenance from '../snapshots/raw/radlab.provenance.json';
import usgs from '../snapshots/usgs-missions.json';
import { extractMissions, reduceRadlab } from '../../../scripts/snapshot-data';

describe('committed measured snapshots', () => {
  test('raw instrument readings reproduce the complete hourly profile and sample statistics', () => {
    const reduced = reduceRadlab(raw, RADLAB_PROFILE.retrieved);
    expect<readonly { hour: string; meanUGyH: number }[]>(reduced.hourly).toEqual(RADLAB_PROFILE.hourly);
    expect(reduced.stats).toEqual(RADLAB_PROFILE.stats);
    expect(reduced.hourly).toHaveLength(48);
    expect(reduced.hourly.reduce((n, hour) => n + hour.n, 0)).toBe(1886);
    expect(reduced.stats.n).toBe(1886);
    expect(reduced.stats.min).toBeCloseTo(1.21, 2);
    expect(reduced.stats.median).toBeCloseTo(4.59, 2);
    expect(reduced.stats.max).toBeCloseTo(527.29, 2);
    expect(reduced.hourly[0]!.hour).toBe('2024-05-10T00:00:00Z');
    expect(reduced.hourly[47]!.hour).toBe('2024-05-11T23:00:00Z');
    expect(reduced.hourly.every(h => h.n > 0 && Number.isFinite(h.meanUGyH))).toBe(true);
  });
  test('raw acquisition provenance is bound to actual response bytes', () => {
    const bytes = readFileSync(new URL('../snapshots/raw/radlab.json', import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(rawProvenance.sha256);
    expect(rawProvenance.url).toBe(RADLAB_PROFILE.url);
    expect(rawProvenance.retrieved).toBe(RADLAB_PROFILE.retrieved);
    expect(Number.isFinite(Date.parse(rawProvenance.retrieved))).toBe(true);
  });
  test('missing measured hours fail rather than fabricating samples', () => {
    expect(() => reduceRadlab({ ...raw, data: raw.data.slice(0, 10) }, RADLAB_PROFILE.retrieved)).toThrow('Incomplete RadLab');
  });
  test('DONKI preserves distinct shock and bulk analyses and the May geomagnetic records', () => {
    expect(DONKI_SNAPSHOT.cme.activityID).toBe('2024-05-20T05:36:00-CME-001');
    expect(DONKI_SNAPSHOT.cme.cmeAnalyses.map(a => a.speed)).toEqual([2678, 1927]);
    expect(DONKI_SNAPSHOT.cme.cmeAnalyses[0]!.note).toContain('SHOCK');
    expect(DONKI_SNAPSHOT.cme.cmeAnalyses[1]!.note).toContain('bulk');
    expect(DONKI_SNAPSHOT.gst.some(g => g.gstID === '2024-05-10T15:00:00-GST-001')).toBe(true);
    expect(DONKI_SNAPSHOT.gst.flatMap(g => g.allKpIndex).some(k => k.kpIndex === 9)).toBe(true);
    expect(DONKI_SNAPSHOT.url.every(u => u.startsWith('https://ccmc.gsfc.nasa.gov/'))).toBe(true);
  });
  test('USGS preserves authoritative facets but explicitly qualifies product attribution', () => {
    expect(USGS_MISSIONS.length).toBeGreaterThan(0);
    expect(usgs.attribution).toContain('heuristic');
    expect(usgs.total).toBe(1643);
    expect(usgs.sampledRecords).toBe(1000);
    for (const mission of usgs.missions) {
      expect(mission.count).toBe(usgs.missionFacets[mission.name as keyof typeof usgs.missionFacets]);
      expect(mission.products.length).toBeLessThanOrEqual(3);
      expect(mission.attribution).toBe('heuristic-title-name');
      expect(mission.products.every(p => p.link.startsWith('https://astrogeology.usgs.gov/'))).toBe(true);
    }
  });
  test('generic Mars titles and other-world place names are not attributed to every mission', () => {
    const missions = extractMissions({ facets: { missikey: { facet: usgs.missionFacets } }, results: [
      { title: 'Mars global map', name: 'mars_global', onlink: 'https://example.org/global', thumb: '' },
      { title: 'Mars Odyssey THEMIS mosaic', name: 'themis_mosaic', onlink: 'https://example.org/themis', thumb: '' },
      { title: 'Venus Geologic Map of the Themis Regio Quadrangle', name: 'venus_themis_regio', onlink: 'https://example.org/venus', thumb: '' }
    ], total: 3 });
    expect(missions.find(m => m.name === 'Mars Odyssey')!.products).toHaveLength(1);
    expect(missions.find(m => m.name === 'Mars 2020')!.products).toHaveLength(0);
  });
  test('missing mission counts fail rather than fabricating zero-count facets', () => {
    expect(() => extractMissions({ facets: { missikey: { facet: {} } }, results: [], total: 0 })).toThrow('Missing or invalid USGS mission facet');
  });
  test('SI references retain verified exact NIST URLs and no runtime network requirement', () => {
    expect(EXTRA_SOURCES.find(s => s.id === 'si-c')!.url).toBe('https://physics.nist.gov/cgi-bin/cuu/Value?c');
    expect(EXTRA_SOURCES.find(s => s.id === 'si-gn')!.url).toBe('https://physics.nist.gov/cgi-bin/cuu/Value?gn');
    expect(EXTRA_SOURCES.every(s => s.retrieved.length > 0 && s.title.length > 0)).toBe(true);
  });
});
