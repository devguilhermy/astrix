import { describe, expect, test } from 'bun:test';
import { applyFrameProbe, classifyStaticTier, medianOf, QUALITY_PROFILES } from './quality';
import { pixelBudgetDpr, stepPixelBudget, type PixelBudgetState } from './pixelBudget';

describe('rendering policy',()=>{
 test('integrated Intel hardware starts at the low-end profile',()=>{
  expect(classifyStaticTier({renderer:'ANGLE Intel UHD Graphics 620 Direct3D11',hardwareConcurrency:4,devicePixelRatio:2})).toBe('LOW');
 });
 test('the frame probe only downgrades one tier',()=>{
  expect(applyFrameProbe('HIGH',34)).toBe('MEDIUM');
  expect(applyFrameProbe('MEDIUM',34)).toBe('LOW');
  expect(applyFrameProbe('LOW',34)).toBe('LOW');
  expect(applyFrameProbe('MEDIUM',16)).toBe('MEDIUM');
  expect(applyFrameProbe('HIGH',null)).toBe('HIGH');
 });
 test('median handles empty, odd and even samples without mutating input',()=>{
  const input=[30,10,20];expect(medianOf(input)).toBe(20);expect(input).toEqual([30,10,20]);
  expect(medianOf([40,10])).toBe(25);expect(medianOf([])).toBeNull();
 });
 test('all device pixel ratio caps remain within the product policy',()=>{
  for(const profile of Object.values(QUALITY_PROFILES)){
   expect(profile.dprMax).toBeGreaterThanOrEqual(1);expect(profile.dprMax).toBeLessThanOrEqual(1.5);
  }
 });
 test('invalid CPU-like timing does not reduce the GPU pixel budget',()=>{
  const state:PixelBudgetState={step:2,slow:0,fast:0,changedAt:0};
  expect(stepPixelBudget(state,Number.NaN,10000)).toBe(state);
  expect(stepPixelBudget(state,-1,10000)).toBe(state);
  expect(pixelBudgetDpr(1000,1000,1.5,2,1000000)).toBe(1);
 });
});
