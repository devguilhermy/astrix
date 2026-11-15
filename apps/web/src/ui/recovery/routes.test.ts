import { expect, test } from 'bun:test';
import { isKnownLocation } from './routes';

test('known screens are accepted at the deployed base without accepting missing pages', () => {
  expect(isKnownLocation('/', '#home')).toBe(true);
  expect(isKnownLocation('/index.html', '#setup/mission')).toBe(true);
  expect(isKnownLocation('/studio/', '#mission/build_verify', '/studio/')).toBe(true);
  expect(isKnownLocation('/studio/index.html', '#mission/implement', '/studio/')).toBe(true);
  for (const hash of ['#missing', '#setup/missing', '#mission/missing', '#mission/design/extra', '#setup/toString', '#mission/__proto__']) {
    expect(isKnownLocation('/', hash), hash).toBe(false);
  }
  expect(isKnownLocation('/missing', '#home')).toBe(false);
  expect(isKnownLocation('/studio/missing/', '#home', '/studio/')).toBe(false);
  expect(isKnownLocation('/another/', '#home', '/studio/')).toBe(false);
});
