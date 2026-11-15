import { expect, test } from 'bun:test';
import { isKnownLocation, isSciencePath, readLocationView, readPlayView, readScienceDoc, scienceUrl, viewUrl } from './routes';

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

test('rendered docs map science paths onto safe docs/*.md files',()=>{
  expect(readScienceDoc('/science')).toBe('INDEX.md');
  expect(readScienceDoc('/astrix/science/','/astrix/')).toBe('INDEX.md');
  expect(readScienceDoc('/science/plans/EXPLORE_SHIP_PLAN.md')).toBe('plans/EXPLORE_SHIP_PLAN.md');
  expect(readScienceDoc('/science/PROJECT%20NOTES.md')).toBe('PROJECT NOTES.md');
  for(const path of ['/science/../LICENSE.md','/science/%2e%2e/x.md','/science/.hidden.md','/science/plans//x.md','/science/x.txt','/science/%E0.md','/science/a%5Cb.md'])expect(readScienceDoc(path)).toBeNull();
  expect(readScienceDoc('/sciencefair/x.md')).toBeNull();
  expect(isSciencePath('/science/x.txt')).toBe(true);
  expect(isSciencePath('/sciencefair')).toBe(false);
  expect(scienceUrl(undefined,'/astrix')).toBe('/astrix/science');
  expect(scienceUrl('plans/A B.md','/')).toBe('/science/plans/A%20B.md');
});
