import { describe, expect, test } from 'bun:test';
import { createStarterDesign, missionById } from '../mission/library';
import { quoteSetAscent, quoteSetBurns } from '../design';
import { recommendAscentProgram, previewAscent } from '../flight/preview';
import { recommendBurns } from '../flight/recommend';
import { runAscent } from '../flight/ascentRun';
import { LAUNCHER_BY_ID } from '../flight/launchers';
import { designMassKg } from '../design';
import { createSim } from './state';
import { telemetry } from './selectors';
import { runTrajectory, startState, previewBurn } from './trajectoryForecast';
import { totalMassKg, orbitTelemetry } from './trajectory';
import { accepted, advanceTo } from './testSupport';
import type { Design } from '../contracts';

const G0 = 9.80665e-3;
const withProgram = (design: Design, program: Parameters<typeof quoteSetAscent>[1]): Design => accepted(quoteSetAscent(design, program, 'ALL')).next;

describe('powered ascent', () => {
 test('the same program gives the same flight, and mass never increases while flying', () => {
  const design = createStarterDesign(missionById('STAY_IN_ORBIT'), 'ASPIRING'), a = previewAscent(design), b = previewAscent(design);
  if (!a.final || !b.final) throw new Error('Orbital launcher must produce a final flight state');
  expect(a.final.central.rKm).toEqual(b.final.central.rKm);
  expect(a.samples.length).toBeGreaterThan(10);
  for (let i = 1; i < a.samples.length; i++) expect(a.samples[i].massKg).toBeLessThanOrEqual(a.samples[i - 1].massKg + 1e-9);
 });
 test('learning payloads fit their launchers', () => {
  for (const id of ['UP_AND_BACK', 'STAY_IN_ORBIT', 'EARTH_TO_MOON'] as const) { const design = createStarterDesign(missionById(id), 'ASPIRING'); expect(designMassKg(design)).toBeLessThanOrEqual(LAUNCHER_BY_ID[design.launch!.launcherId].payloadLimitKg); }
 });
 test('whole-substep integration: splitting the same flight into different frames reaches the same state', () => {
  const design = createStarterDesign(missionById('STAY_IN_ORBIT'), 'ASPIRING'), plan = design.launch!, mass = designMassKg(design);
  const fine = runAscent(design.definition, plan, mass, 1), coarse = runAscent(design.definition, plan, mass, 10);
  expect(fine.outcome).toBe(coarse.outcome);
  expect(Math.abs(fine.tEnd - coarse.tEnd)).toBeLessThan(1e-6);
  for (let i = 0; i < 3; i++) { expect(Math.abs(fine.r[i] - coarse.r[i])).toBeLessThan(1e-6); expect(Math.abs(fine.v[i] - coarse.v[i])).toBeLessThan(1e-9); }
 });
 test('the recommended program for the sounding rocket peaks inside the authored 80-120 km band', () => {
  const design = createStarterDesign(missionById('UP_AND_BACK'), 'ASPIRING'), rec = recommendAscentProgram(design);
  expect('program' in rec).toBe(true);
  if ('program' in rec) { expect(rec.preview.apogeeAltKm).toBeGreaterThan(80); expect(rec.preview.apogeeAltKm).toBeLessThan(120); expect(rec.preview.outcome).toBe('SUBORBITAL_RETURN'); }
 });
 test('the recommended program for the small orbital rocket reaches a bound orbit above the atmosphere', () => {
  const design = createStarterDesign(missionById('STAY_IN_ORBIT'), 'ASPIRING'), rec = recommendAscentProgram(design);
  expect('program' in rec).toBe(true);
  if ('program' in rec) { expect(rec.preview.outcome).toBe('ORBIT'); expect(rec.preview.perigeeAltKm!).toBeGreaterThan(150); }
 });
});

describe('success is flown evidence, not a label', () => {
 const fly = (design: Design) => { const state = advanceTo(createSim(design, design.definition.environment.seed), 5400); return { state, t: telemetry(state) }; };
 test('the starter sounding program overshoots the band and the mission fails on the evidence', () => {
  const { t } = fly(createStarterDesign(missionById('UP_AND_BACK'), 'ASPIRING'));
  expect(t.ended).toBe(true);
  expect(t.outcome).toBe('FAILURE');
  expect(t.evidence.find(e => e.id === 'UP_AND_BACK.apogee')!.state).toBe('FAILED');
 });
 test('the recommended program meets both objectives and the run succeeds', () => {
  const base = createStarterDesign(missionById('UP_AND_BACK'), 'ASPIRING'), rec = recommendAscentProgram(base);
  if (!('program' in rec)) throw new Error('no recommendation');
  const { t } = fly(withProgram(base, rec.program));
  expect(t.evidence.map(e => e.state)).toEqual(['MET', 'MET']);
  expect(t.outcome).toBe('SUCCESS');
 });
});

describe('impulsive burns and finite propellant', () => {
 const raise = (): Design => { const d = createStarterDesign(missionById('RAISE_YOUR_ORBIT'), 'ASPIRING'); return accepted(quoteSetBurns(d, recommendBurns(d), 'ALL')).next; };
 test('the recommended two-burn raise reaches the target band and the fuel debit obeys the rocket equation', () => {
  const design = raise(), start = startState(design), run = runTrajectory(design, 2 * 86400);
  expect(design.burns.length).toBe(2);
  const receipts = run.final.traj.receipts;
  expect(receipts.map(r => r.status)).toEqual(['EXECUTED', 'EXECUTED']);
  const orbit = orbitTelemetry(run.final);
  expect(orbit.periapsisAltKm).toBeGreaterThan(760); expect(orbit.periapsisAltKm).toBeLessThan(840);
  expect(orbit.ecc).toBeLessThan(0.01);
  const achieved = receipts.reduce((n, r) => n + r.achievedDvKms, 0), isp = run.final.ispSec;
  expect(Math.abs(isp * G0 * Math.log(totalMassKg(start) / totalMassKg(run.final)) - achieved)).toBeLessThan(1e-9 * 1 + 1e-6);
 });
 test('a burn the tanks cannot fund is partial or refused, and propellant is never created or negative', () => {
  const design = raise(), starved: Design = { ...design, parts: design.parts.map(p => p.partId === 'SS_PROP_BI' ? { ...p, propellantKg: 1 } : p) };
  const run = runTrajectory(starved, 2 * 86400), first = run.final.traj.receipts[0];
  expect(['PARTIAL', 'REFUSED']).toContain(first.status);
  expect(first.achievedDvKms).toBeLessThan(first.requestedDvKms);
  expect(run.final.propellantKg).toBeGreaterThanOrEqual(0);
  expect(run.final.propellantKg).toBeLessThanOrEqual(1);
 });
 test('previewing a burn never mutates the design or session state', () => {
  const base = createStarterDesign(missionById('RAISE_YOUR_ORBIT'), 'ASPIRING'), burns = recommendBurns(base), before = JSON.stringify(base), preview = previewBurn(base, burns[0]);
  expect(preview.burnId).toBe(burns[0].id);
  expect(preview.feasible).toBe(true);
  expect(preview.propellantKg).toBeGreaterThan(0);
  if (!preview.before || !preview.after) throw new Error('Feasible burn must have before and after states');
  expect(preview.after.speedKms).toBeGreaterThan(preview.before.speedKms);
  expect(JSON.stringify(base)).toBe(before);
 });
 test('a duplicate burn id is refused by the preview', () => {
  const design = raise(), preview = previewBurn(design, design.burns[0]);
  expect(preview.feasible).toBe(false);
  expect(preview.refusal).toBe('BURN_DUPLICATE_ID');
 });
});

describe('Earth-Moon patched conics', () => {
 test('the lunar learning flyby crosses into the Moon region exactly once on the recommended aim and stays above the surface', () => {
  const base = createStarterDesign(missionById('MEET_THE_MOON'), 'ASPIRING'), design = accepted(quoteSetBurns(base, recommendBurns(base), 'ALL')).next;
  expect(design.burns.length).toBe(1);
  const run = runTrajectory(design, 8 * 86400), kinds = run.events.map(e => e.kind);
  expect(kinds.filter(k => k === 'SOI_ENTRY').length).toBe(1);
  const closest = run.final.traj.encounter!.closestKm;
  expect(closest).toBeGreaterThan(3000); expect(closest).toBeLessThan(30000);
  for (const sample of run.samples) { expect(Number.isFinite(sample.earth[0] + sample.earth[1] + sample.earth[2])).toBe(true); if (sample.moon) expect(Math.hypot(...sample.moon)).toBeGreaterThan(1737.4); }
 });
});
