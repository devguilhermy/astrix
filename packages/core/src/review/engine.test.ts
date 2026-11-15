// Adapted from Void Protocol (© Guilhermy), apps/web/src/advisor/engine.test.ts @ 218625d.
// Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
// VP world fixtures are replaced by pure ASTRIX snapshots; every engine behavior is retained.
import { describe, expect, it } from 'bun:test';
import type { CueEngineState, ReviewSnapshot } from '../contracts';
import { createStarterDesign } from '../catalog';
import { quoteRemovePart } from '../design';
import { evaluateCues, evaluateRules, type CuePreferences } from './engine';
import { designSnapshot, type CueRule } from './rules';

const empty: CueEngineState = { lastRaised: {}, clearPending: {}, active: [] };
const prefs: CuePreferences = { guidance: 'all', dismissed: [] };
const snap = (active: boolean): ReviewSnapshot => ({ phase: 'DESIGN', active });
const rule: CueRule = { id: 'critical', category: 'alert', severity: 3, mandatory: true, role: 'SPACECRAFT', cooldownSec: 10, clearAfterSec: 5, target: 'battery', glossaryId: 'energy-budget', detect: s => s.active ? { params: { value: 4 } } : null };

describe('pure cue evaluation', () => {
 it('raises critical alerts with params and exact target', () => {
  const state = evaluateRules(empty, snap(true), [rule], prefs, 100);
  expect(state.active).toMatchObject([{ id: 'critical', severity: 3, role: 'SPACECRAFT', params: { value: 4 }, target: 'battery', glossaryId: 'energy-budget', firstRaisedSec: 100 }]);
 });
 it('enforces cooldown after hysteresis clearing', () => {
  let state = evaluateRules(empty, snap(true), [rule], prefs, 100);
  state = evaluateRules(state, snap(false), [rule], prefs, 101); expect(state.active).toHaveLength(1);
  state = evaluateRules(state, snap(false), [rule], prefs, 107); expect(state.active).toHaveLength(0);
  state = evaluateRules(state, snap(true), [rule], prefs, 108); expect(state.active).toHaveLength(0);
  state = evaluateRules(state, snap(true), [rule], prefs, 111); expect(state.active).toHaveLength(1);
 });
 it('honors clearing hysteresis and cancels pending clear when the condition returns', () => {
  let state = evaluateRules(empty, snap(true), [rule], prefs, 100);
  state = evaluateRules(state, snap(false), [rule], prefs, 101);
  state = evaluateRules(state, snap(false), [rule], prefs, 105); expect(state.active).toHaveLength(1);
  state = evaluateRules(state, snap(true), [rule], prefs, 106); expect(state.clearPending).toEqual({});
  expect(state.active[0].firstRaisedSec).toBe(100);
  state = evaluateRules(state, snap(false), [rule], prefs, 107);
  state = evaluateRules(state, snap(false), [rule], prefs, 112); expect(state.active).toHaveLength(0);
 });
 it('honors applicability while keeping applicable teaching cues', () => {
  const restricted: CueRule = { ...rule, applies: s => s.phase === 'OPERATE' };
  const teach: CueRule = { ...rule, id: 'teach', mandatory: false, category: 'teach', severity: 1 };
  const state = evaluateRules(empty, snap(true), [restricted, teach], prefs, 100);
  expect(state.active.map(c => c.ruleId)).toEqual(['teach']);
 });
 it('filters tips and teach in alerts-only guidance', () => {
  const tip: CueRule = { ...rule, id: 'tip', category: 'tip', severity: 1, mandatory: false };
  expect(evaluateRules(empty, snap(true), [rule, tip], { guidance: 'alerts', dismissed: [] }, 100).active.map(c => c.ruleId)).toEqual(['critical']);
 });
 it('keeps mandatory alerts even if dismissed', () => {
  const tip: CueRule = { ...rule, id: 'tip', mandatory: false, category: 'tip', severity: 1 };
  const state = evaluateRules(empty, snap(true), [rule, tip], { guidance: 'all', dismissed: ['critical', 'tip'] }, 100);
  expect(state.active.map(c => c.ruleId)).toEqual(['critical']);
 });
 it('caps all alerts plus two tips/teach and retains hidden active history', () => {
  const rules: CueRule[] = [
   ...[1, 2, 3].map(i => ({ ...rule, id: `alert-${i}` })),
   ...[1, 2, 3, 4].map(i => ({ ...rule, id: `tip-${i}`, mandatory: false, category: 'tip' as const, severity: 1 as const })),
  ];
  const state = evaluateRules(empty, snap(true), rules, prefs, 100);
  expect(state.active.filter(c => c.category === 'alert')).toHaveLength(3);
  expect(state.active.filter(c => c.category !== 'alert')).toHaveLength(2);
  expect(state.tracked).toHaveLength(7);
  const clone = structuredClone(state);
  const next = evaluateRules(clone, snap(true), rules.slice(0, 3).concat(rules.slice(5)), prefs, 110);
  expect(next.active.find(c => c.ruleId === 'tip-3')?.firstRaisedSec).toBe(100);
 });
 it('raises independent alerts simultaneously in stable severity/age/id order', () => {
  const state = evaluateRules(empty, snap(true), [{ ...rule, id: 'z' }, { ...rule, id: 'a' }, { ...rule, id: 'less', severity: 2 }], prefs, 100);
  expect(state.active.map(c => c.ruleId)).toEqual(['a', 'z', 'less']);
  expect(empty).toEqual({ lastRaised: {}, clearPending: {}, active: [] });
 });
 it('uses authored mission rules and removes cues outside applicable phases', () => {
  const starter = createStarterDesign('FIRST_LIGHT', 'ASPIRING');
  const removed = quoteRemovePart(starter, 'RADIO_UHF', 'ALL');
  if (!removed.ok) throw new Error(removed.code);
  const cues = evaluateCues(empty, designSnapshot(removed.value.next), 0);
  expect(cues.active.some(c => c.ruleId === 'NO_RADIO' && c.severity === 3 && c.role === 'GROUND_COMMS')).toBe(true);
  expect(evaluateCues(cues, { ...designSnapshot(removed.value.next), phase: 'REPORT' }, 10).active).toEqual([]);
 });
});

it('clears and re-raises discrete critical design reviews at the same simulated timestamp', () => {
 const healthy = createStarterDesign('FIRST_LIGHT', 'ASPIRING');
 const removed = quoteRemovePart(healthy, 'RADIO_UHF', 'ALL');
 if (!removed.ok) throw new Error(removed.code);
 let cues = evaluateCues(empty, designSnapshot(removed.value.next), 0);
 expect(cues.active.some(c => c.ruleId === 'NO_RADIO')).toBe(true);
 cues = evaluateCues(cues, designSnapshot(healthy), 0);
 expect(cues.active.some(c => c.ruleId === 'NO_RADIO')).toBe(false);
 cues = evaluateCues(cues, designSnapshot(removed.value.next), 0);
 expect(cues.active.some(c => c.ruleId === 'NO_RADIO')).toBe(true);
});
