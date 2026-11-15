import { describe, expect, test } from 'bun:test';
import { frameBrightness, frameLight, frameWindow, lonSpanFor, sliceRects } from './frameWindow';
import { formatCoordinates } from './format';
import { seriesPoints, seriesRange } from './series';
import { turnLevels } from './levels';

describe('simulated frame window',()=>{
  test('16:10 rectangle centred on the ground point, sized to the map resolution',()=>{
    expect(lonSpanFor(2048)).toBe(36);expect(lonSpanFor(1024)).toBe(60);
    const window=frameWindow({latDeg:0,lonDeg:0},2048);
    expect(window.lonSpanDeg).toBe(36);expect(window.latSpanDeg).toBeCloseTo(22.5,9);
    expect(window.v0).toBeCloseTo((90-11.25)/180,9);expect(window.v1).toBeCloseTo((90+11.25)/180,9);
    expect(window.slices).toHaveLength(1);
    expect(window.slices[0]!.u0).toBeCloseTo(.45,9);expect(window.slices[0]!.u1).toBeCloseTo(.55,9);
    expect(window.slices[0]).toMatchObject({x0:0,x1:1});
    const wide=frameWindow({latDeg:-12.4,lonDeg:-48.2},1024);
    expect(wide.lonSpanDeg).toBe(60);expect(wide.latSpanDeg).toBeCloseTo(37.5,9);
    expect(wide.slices[0]!.u0).toBeCloseTo((-48.2-30+180)/360,9);
  });
  test('centre latitude is clamped so the window never leaves ±90°',()=>{
    const north=frameWindow({latDeg:89,lonDeg:10},1024),south=frameWindow({latDeg:-90,lonDeg:10},2048);
    expect(north.centerLatDeg).toBeCloseTo(90-18.75,9);expect(north.v0).toBeCloseTo(0,9);
    expect(south.centerLatDeg).toBeCloseTo(-90+11.25,9);expect(south.v1).toBeCloseTo(1,9);
    for(const window of [north,south]){expect(window.v0).toBeGreaterThanOrEqual(-1e-12);expect(window.v1).toBeLessThanOrEqual(1+1e-12);}
  });
  test('a window crossing ±180° is drawn as two contiguous slices',()=>{
    const east=frameWindow({latDeg:0,lonDeg:175},2048);
    expect(east.slices).toHaveLength(2);
    expect(east.slices[0]!.u0).toBeCloseTo(337/360,9);expect(east.slices[0]!.u1).toBe(1);
    expect(east.slices[0]!.x1).toBeCloseTo(23/36,9);expect(east.slices[1]!.x0).toBeCloseTo(23/36,9);
    expect(east.slices[1]!.u0).toBe(0);expect(east.slices[1]!.u1).toBeCloseTo(13/360,9);
    const west=frameWindow({latDeg:0,lonDeg:-170},2048);
    expect(west.slices[0]!.u0).toBeCloseTo(352/360,9);expect(west.slices[0]!.x1).toBeCloseTo(8/36,9);
    expect(west.slices[1]!.u1).toBeCloseTo(28/360,9);expect(west.slices[1]!.x1).toBe(1);
    const wrapped=frameWindow({latDeg:0,lonDeg:190},2048);
    expect(wrapped.centerLonDeg).toBeCloseTo(-170,9);
    const rects=sliceRects(east,2048,1024,640,400);
    expect(rects[0]!.sx).toBeCloseTo(337/360*2048,6);expect(rects[0]!.dw+rects[1]!.dw).toBeCloseTo(640,6);
    expect(rects[0]!.sw+rects[1]!.sw).toBeCloseTo(36/360*2048,6);expect(rects[0]!.sh).toBeCloseTo(22.5/180*1024,6);
  });
  test('brightness curve and lighting label follow the Sun elevation',()=>{
    expect(frameBrightness(-90)).toBeCloseTo(.18,9);expect(frameBrightness(-6)).toBeCloseTo(.18,9);
    expect(frameBrightness(3)).toBeCloseTo(.18+.82*.5,9);expect(frameBrightness(12)).toBeCloseTo(1,9);expect(frameBrightness(60)).toBeCloseTo(1,9);
    expect(frameBrightness(Number.NaN)).toBeCloseTo(.18,9);
    expect(frameBrightness(0)).toBeLessThan(frameBrightness(6));
    expect(frameLight(-20)).toBe('night');expect(frameLight(-6)).toBe('twilight');expect(frameLight(5)).toBe('twilight');expect(frameLight(6)).toBe('day');
  });
  test('coordinates use hemisphere letters in each language',()=>{
    expect(formatCoordinates(-12.44,-48.2,'en')).toBe('12.4°S 48.2°W');
    expect(formatCoordinates(-12.44,-48.2,'pt-BR')).toBe('12,4°S 48,2°O');
    expect(formatCoordinates(3.06,120,'pt-BR')).toBe('3,1°N 120,0°L');
    expect(formatCoordinates(-0.01,0,'en')).toBe('0.0°N 0.0°E');
  });
});

describe('chart and level geometry',()=>{
  test('series points span the width or sit at equal column centres',()=>{
    expect(seriesRange([3,Number.NaN,1,2])).toEqual({min:1,max:3});expect(seriesRange([])).toBeNull();
    expect(seriesPoints([0,50,100],100,20)).toBe('0,20 50,10 100,0');
    expect(seriesPoints([0,100],4,10,{range:{min:0,max:100},pad:1,centred:true})).toBe('1,9 3,1');
    expect(seriesPoints([5,5],10,10)).toBe('0,5 10,5');
    expect(seriesPoints([1,Number.NaN,1],10,10,{centred:true})).toBe('1.67,5 8.33,5');
  });
  test('before and after levels are rebuilt backwards from the latest inventory',()=>{
    const receipts=[{revision:1,delta:{fuelKg:-2,energyWh:-10,storedMB:17.5,deliveredMB:0}},{revision:2,delta:{fuelKg:0,energyWh:-5,storedMB:-1.69,deliveredMB:1.69}}];
    const inventory={energyWh:85,capacityWh:120,storedMB:15.81,storageMB:64,fuelKg:8};
    const second=turnLevels(receipts,2,inventory)!,first=turnLevels(receipts,1,inventory)!;
    expect(second.energyWh).toEqual({before:90,after:85,max:120});
    expect(second.storedMB.before).toBeCloseTo(17.5,9);expect(second.storedMB.after).toBeCloseTo(15.81,9);
    expect(first.energyWh).toEqual({before:100,after:90,max:120});
    expect(first.storedMB.before).toBeCloseTo(0,9);expect(first.fuelKg).toEqual({before:10,after:8,max:10});
    expect(turnLevels(receipts,3,inventory)).toBeNull();
    expect(turnLevels(receipts,1,{...inventory,fuelKg:0})!.fuelKg).toEqual({before:2,after:0,max:2});
    expect(turnLevels([{revision:1,delta:{fuelKg:0,energyWh:0,storedMB:0,deliveredMB:0}}],1,{...inventory,fuelKg:0})!.fuelKg).toBeNull();
  });
});
