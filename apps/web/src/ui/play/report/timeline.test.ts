import { describe, expect, test } from 'bun:test';
import type { TurnMoment } from '../turnMoments';
import { chipBadges, defaultTurn, effectiveTurn, rovingIndex } from './timeline';

function moment(index:number,change:Partial<TurnMoment['delta']>={}):TurnMoment {
  const delta={fuelKg:0,energyWh:0,storedMB:0,deliveredMB:0,...change};
  return {index,receiptId:`r${index}`,kind:'COAST',startSec:index*100,endSec:index*100+100,interrupted:false,delta,capturedMB:Math.max(0,delta.storedMB+delta.deliveredMB),deliveredMB:Math.max(0,delta.deliveredMB),progress:0,body:'EARTH',positionKm:null,frame:null,stationKm:null,passKm:null,inContact:false,doseUGyH:[],socPct:null};
}

describe('report timeline',()=>{
  test('default selection is the last turn that captured or returned data, otherwise the last turn',()=>{
    expect(defaultTurn([])).toBeNull();
    expect(defaultTurn([moment(1),moment(2,{energyWh:-4})])).toBe(2);
    expect(defaultTurn([moment(1),moment(2,{storedMB:17.5}),moment(3,{storedMB:-1.69,deliveredMB:1.69}),moment(4,{energyWh:8})])).toBe(3);
    expect(defaultTurn([moment(1,{storedMB:4}),moment(2,{fuelKg:-1})])).toBe(1);
    expect(defaultTurn([moment(1,{storedMB:-2,deliveredMB:1})])).toBe(1);
  });
  test('an explicit selection wins only while that turn exists',()=>{
    const moments=[moment(1,{storedMB:3}),moment(2)];
    expect(effectiveTurn(moments,2)).toBe(2);
    expect(effectiveTurn(moments,null)).toBe(1);
    expect(effectiveTurn(moments,7)).toBe(1);
    expect(effectiveTurn([],3)).toBeNull();
  });
  test('roving index moves one chip per arrow without wrapping and jumps with Home and End',()=>{
    expect(rovingIndex(0,'ArrowRight',4)).toBe(1);expect(rovingIndex(1,'ArrowDown',4)).toBe(2);
    expect(rovingIndex(3,'ArrowRight',4)).toBe(3);expect(rovingIndex(0,'ArrowLeft',4)).toBe(0);
    expect(rovingIndex(2,'ArrowUp',4)).toBe(1);
    expect(rovingIndex(2,'Home',4)).toBe(0);expect(rovingIndex(0,'End',4)).toBe(3);
    expect(rovingIndex(1,'Enter',4)).toBeNull();expect(rovingIndex(0,'ArrowRight',0)).toBeNull();
  });
  test('chips show at most two deltas, data first',()=>{
    expect(chipBadges(moment(1,{storedMB:-1.69,deliveredMB:1.69,energyWh:-3}))).toEqual([{kind:'data',value:1.69,unit:'MB'},{kind:'energy',value:-3,unit:'Wh'}]);
    expect(chipBadges(moment(2,{storedMB:17.5,fuelKg:-.4,energyWh:-12}))).toEqual([{kind:'stored',value:17.5,unit:'MB'},{kind:'fuel',value:-.4,unit:'kg'}]);
    expect(chipBadges(moment(3,{energyWh:.001}))).toEqual([]);
  });
});
