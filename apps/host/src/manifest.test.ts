import { expect, test } from 'bun:test';
import { EXPECTED_MANIFEST, manifestProblem } from './manifest';

test('the host accepts only the exact protocol, rules and flight-model contract', () => {
  expect(manifestProblem(JSON.stringify(EXPECTED_MANIFEST))).toBeNull();
  expect(manifestProblem(JSON.stringify({ ...EXPECTED_MANIFEST, extra: 'ignored' }))).toBeNull();
  expect(manifestProblem(null)).toContain('missing');
  expect(manifestProblem('{')).toContain('JSON');
  expect(manifestProblem('[]')).toContain('object');
  for (const key of ['schema', 'protocol', 'rules', 'flightModel'] as const) expect(manifestProblem(JSON.stringify({ ...EXPECTED_MANIFEST, [key]: EXPECTED_MANIFEST[key] + 1 }))).toContain(key);
  expect(manifestProblem(JSON.stringify({ ...EXPECTED_MANIFEST, protocol: String(EXPECTED_MANIFEST.protocol) }))).toContain('protocol');
  expect(EXPECTED_MANIFEST.protocol).toBe(2);
});
