import { beforeEach, describe, expect, test } from 'bun:test';
import { computeBudgets, quoteAddPart } from '@astrix/core';
import { useMission } from './index';

beforeEach(()=>{useMission.getState().resetMission();useMission.getState().setTeam(1);});
describe('guarded journey',()=>{
 test('beginning an attempt cannot launch or skip the objective',()=>{
  useMission.getState().startMission('FIRST_LIGHT','ASPIRING');const s=useMission.getState();expect(s.activeStage).toBe('NEED_GOALS');expect(s.sim).toBeNull();s.setStage('REVIEW');expect(useMission.getState().activeStage).toBe('NEED_GOALS');expect(s.completeStage()).toBe(false);
  s.updateArtifacts({objectiveConfirmed:true});expect(useMission.getState().completeStage()).toBe(true);expect(useMission.getState().activeStage).toBe('CONCEPT');
 });
 test('a stale quoted edit cannot replace a newer design',()=>{
  useMission.getState().startMission('FIRST_LIGHT','ASPIRING');const s=useMission.getState(),design=s.design!,old=quoteAddPart(design,'STORAGE_32G','ALL');expect(old.ok).toBe(true);if(!old.ok)return;const next=quoteAddPart(design,'SOLAR_WINGS','ALL');expect(next.ok).toBe(true);if(!next.ok)return;expect(s.applyDesign(next)).toBe(true);const current=useMission.getState().design,record=useMission.getState().acceptedTrades.at(-1)!;expect(record.actor).toBe('ALL');expect(record.revision).toBe(design.revision);expect(record.before.massKg.used).toBe(computeBudgets(design).massKg.used);expect(record.after.massKg.used).toBe(computeBudgets(next.value.next).massKg.used);expect(useMission.getState().applyDesign(old)).toBe(false);expect(useMission.getState().design).toBe(current);expect(useMission.getState().acceptedTrades).toHaveLength(1);
 });
 test('freeze and verification are distinct revision-bound evidence',()=>{
  useMission.getState().startMission('FIRST_LIGHT','ASPIRING');const s=useMission.getState(),design=s.design!,quote=quoteAddPart(design,'STORAGE_32G','ALL');expect(quote.ok).toBe(true);if(!quote.ok)return;s.recordTrade('storage',design.revision,computeBudgets(design),computeBudgets(quote.value.next),'ALL');expect(useMission.getState().freezeBaseline()).toBe(true);expect(useMission.getState().artifacts?.verifiedRevision).toBeNull();
 });
 test('attempt identity changes for new attempts, not preference changes',()=>{
  useMission.getState().startMission('FIRST_LIGHT','EXPERT');const id=useMission.getState().attemptId;useMission.getState().setSettings({presentation:'GUIDED'});expect(useMission.getState().attemptId).toBe(id);useMission.getState().startMission('FIRST_LIGHT','ASPIRING');expect(useMission.getState().attemptId).toBeGreaterThan(id);
 });
 test('roster changes preserve immutable earlier snapshots',()=>{
  const s=useMission.getState();s.startMission('FIRST_LIGHT','ASPIRING');s.setTeam(2);const previous=useMission.getState().rosterHistory.at(-1)!;const saved=structuredClone(previous);s.assignRole('SCIENCE',1);expect(previous).toEqual(saved);expect(useMission.getState().players[1]).toContain('SCIENCE');expect(useMission.getState().rosterHistory.at(-1)?.before).toEqual(saved.after);
 });
});
