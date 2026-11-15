import { expect, test } from 'bun:test';
import { isKnownLocation, readLocationView, readPlayView, viewUrl } from './routes';

test('turn-based presentation routes respect the deployed base',()=>{
  for(const hash of ['', '#home','#solar','#explore','#prepare','#play','#journal','#gmat','#help']) {
    expect(isKnownLocation('/',hash)).toBe(true);
    expect(isKnownLocation('/astrix/index.html',hash,'/astrix/')).toBe(true);
  }
  for(const hash of ['#studio','#setup/mission','#mission/implement','#missing','#play/extra','#toString','#__proto__'])expect(isKnownLocation('/',hash)).toBe(false);
  expect(isKnownLocation('/missing','#explore')).toBe(false);
  expect(isKnownLocation('/another/','#play','/astrix/')).toBe(false);
  expect(readPlayView('#play')).toBe('play');
  expect(readPlayView('#solar')).toBe('solar');
  expect(readPlayView('#home')).toBe('explore');
});

test('GMAT interchange has its own path under the deployed base',()=>{
  expect(isKnownLocation('/gmat','')).toBe(true);
  expect(isKnownLocation('/astrix/gmat','','/astrix/')).toBe(true);
  expect(isKnownLocation('/gmat','#play')).toBe(false);
  expect(isKnownLocation('/gmat/extra','')).toBe(false);
  expect(readLocationView('/gmat','')).toBe('gmat');
  expect(readLocationView('/','#gmat')).toBe('gmat');
  expect(readLocationView('/','#solar')).toBe('solar');
  expect(viewUrl('gmat','/')).toBe('/gmat');
  expect(viewUrl('solar','/astrix')).toBe('/astrix/#solar');
});
