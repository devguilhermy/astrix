import { expect, test } from 'bun:test';
import { isKnownLocation, readPlayView } from './routes';

test('turn-based presentation routes respect the deployed base',()=>{
  for(const hash of ['', '#home','#explore','#prepare','#play','#journal','#gmat','#help']) {
    expect(isKnownLocation('/',hash)).toBe(true);
    expect(isKnownLocation('/astrix/index.html',hash,'/astrix/')).toBe(true);
  }
  for(const hash of ['#studio','#setup/mission','#mission/implement','#missing','#play/extra','#toString','#__proto__'])expect(isKnownLocation('/',hash)).toBe(false);
  expect(isKnownLocation('/missing','#explore')).toBe(false);
  expect(isKnownLocation('/another/','#play','/astrix/')).toBe(false);
  expect(readPlayView('#play')).toBe('play');
  expect(readPlayView('#home')).toBe('explore');
});
