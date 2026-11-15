import { describe, expect, test } from 'bun:test';
import { computeBudgets, createStarterDesign, createSim, telemetry, quoteAddPart } from '@astrix/core';
import { resourceModel, RESOURCE_ORDER, capacityStatus, reserveStatus } from './resourceModel';
describe('phase-aware resource model',()=>{
 test('thresholds distinguish tight capacity from low reserves',()=>{
  expect(capacityStatus(89,100)).toBe('fits');expect(capacityStatus(90,100)).toBe('tight');expect(capacityStatus(101,100)).toBe('over');expect(capacityStatus(1,0)).toBe('unknown');
  expect(reserveStatus(99,100)).toBe('short');expect(reserveStatus(100,100)).toBe('low');expect(reserveStatus(120,100)).toBe('enough');
 });
 test('every mission keeps seven resources and uncrewed n/a without inventing a runway',()=>{
  for(const id of ['FIRST_LIGHT','STORM_WATCH','RED_RELAY','CREW_PATHFINDER'] as const){const d=createStarterDesign(id,'ASPIRING'),m=resourceModel(d,computeBudgets(d),null);expect(m.map(item=>item.id)).toEqual([...RESOURCE_ORDER]);expect(m.every(item=>item.mode==='forecast')).toBe(true);if(id!=='CREW_PATHFINDER'){expect(m[6].value).toBeNull();expect(m[6].status).toBe('na');}}
 });
 test('live battery, stored data and remaining clock use telemetry rather than planning budgets',()=>{
  const starter=createStarterDesign('FIRST_LIGHT','ASPIRING');
  const camera=quoteAddPart(starter,'CAM_EO','ALL');
  if(!camera.ok)throw new Error(camera.code);
  const d=camera.value.next,b=computeBudgets(d),x=telemetry(createSim(d,1)),m=resourceModel(d,b,x);
  expect(m.every(item=>item.mode==='live')).toBe(true);expect(m[1].value).toBe(x.socWh);expect(m[1].limit).toBe(x.capacityWh);expect(m[1].unit).toBe('Wh');expect(m[3].value).toBe(x.storedMB);expect(m[5].value).toBe(x.clock.remainingSec/86400);
  expect(m[1].detail.filter(item=>item.unit==='W').map(item=>item.value)).toEqual([x.genW,x.loadW]);expect(m[1].detail.some(item=>item.unit==='Wh')).toBe(true);
 });
 test('preview deltas derive from the actual quote and never mutate the design',()=>{
  const d=createStarterDesign('FIRST_LIGHT','ASPIRING'),before=JSON.stringify(d),b=computeBudgets(d),quote=quoteAddPart(d,'CAM_EO','ALL');
  if(!quote.ok)throw new Error(quote.code);
  const after=computeBudgets(quote.value.next),m=resourceModel(d,b,null,after);
  expect(m[0].delta).toBe(after.massKg.used-b.massKg.used);expect(m[2].delta).toBe(after.cost.used-b.cost.used);expect(JSON.stringify(d)).toBe(before);
 });
});
