import { expect, test } from 'bun:test';
import { parseInitialOrbit } from '@astrix/core/interop/gmat';
import { buildExport, defaultDraft, SPACECRAFT } from './exportModel';

test('exported script imports back to the same state for both bodies', () => {
  for (const body of ['EARTH', 'MARS'] as const) {
    const built = buildExport({ ...defaultDraft, body, sma: body === 'MARS' ? '4200.5' : '7000' });
    if (!built.ok) throw new Error(built.error);
    expect(built.roundTrip).toBe('exact');
    expect(parseInitialOrbit(built.script, SPACECRAFT)).toEqual(built.orbit);
  }
});

test('rejects drafts the importer would refuse, with the field named', () => {
  expect(buildExport({ ...defaultDraft, sma: '' })).toEqual({ ok: false, error: 'SMA is required' });
  expect(buildExport({ ...defaultDraft, ecc: 'abc' })).toMatchObject({ ok: false, error: 'ECC must be a finite number' });
  expect(buildExport({ ...defaultDraft, sma: '6000' })).toMatchObject({ ok: false });   // periapsis below Earth's surface
  expect(buildExport({ ...defaultDraft, ecc: '1' })).toMatchObject({ ok: false });      // not a bound orbit
  expect(buildExport({ ...defaultDraft, epochUTC: '2024-02-30T00:00:00Z' })).toMatchObject({ ok: false });
});
