import { describe, expect, it } from 'bun:test';
import { computeBudgets, quoteAddPart, quoteRemovePart } from './design';
import { createStarterDesign } from './catalog';
import { createMissionArtifacts, evaluateJourneyStage, missionRequirements } from './journey';
import { createSim } from './sim/state';
import { issueCommand } from './sim/commands';
import { telemetry } from './sim/selectors';
import { stepSim } from './sim/step';

const signed = { SCIENCE: true, SPACECRAFT: true, LAUNCH_ORBIT: true, GROUND_COMMS: true } as const;
describe('revision-bound journey', () => {
 it('requires an actual trade and current frozen baseline', () => {
  const d = createStarterDesign('FIRST_LIGHT', 'ASPIRING');
  const a = createMissionArtifacts(d);
  expect(evaluateJourneyStage(d, a, 'DESIGN', signed).map(x => x.id)).toEqual(['TRADE', 'BASELINE']);
  const frozen = { ...a, trade: { revision: d.revision, description: 'battery comparison', before: computeBudgets(d), after: { ...computeBudgets(d), cost: { ...computeBudgets(d).cost, used: computeBudgets(d).cost.used + 1 } }, actor: 'ALL' as const }, baselineRevision: d.revision, verifiedRevision: d.revision };
  expect(evaluateJourneyStage(d, frozen, 'DESIGN', signed)).toEqual([]);
  expect(evaluateJourneyStage({ ...d, revision: d.revision + 1 }, frozen, 'IMPLEMENT', signed).map(x => x.id)).toContain('BASELINE');
  expect(missionRequirements(d).find(r => r.id === 'SCI-QUALITY-01')?.result).toBe('NOT_EVALUATED');
 });
 it('onboard crew procedures do not require ground contact', () => {
  const d = createStarterDesign('CREW_PATHFINDER', 'ASPIRING');
  const s = createSim(d, 17);
  const result = issueCommand(s, { kind: 'CREW_FAN', on: false }, 'SPACECRAFT');
  expect(result.ok).toBe(true);
  if (result.ok) { expect(telemetry(result.value).crew?.fanOn).toBe(true); expect(telemetry(result.value).commandQueue.at(-1)?.transport).toBe('ONBOARD'); expect(telemetry(result.value).commandQueue.at(-1)?.status).toBe('IN_TRANSIT'); }
 });
});

it('keeps CubeSat wings stowed until the onboard deployment actually executes', () => {
 let d = createStarterDesign('FIRST_LIGHT', 'ASPIRING');
 const removed = quoteRemovePart(d, 'SOLAR_BODY', 'ALL'); if (!removed.ok) throw new Error(removed.code); d = removed.value.next;
 for (const id of ['SOLAR_WINGS', 'CAM_EO']) { const q = quoteAddPart(d, id, 'ALL'); if (!q.ok) throw new Error(q.code); d = q.value.next; }
 let s = createSim(d, 42), before = telemetry(s);
 expect(before.deployment.wings).toBe('STOWED');
 const issued = issueCommand(s, { kind: 'DEPLOY', system: 'WINGS' }, 'SPACECRAFT'); if (!issued.ok) throw new Error(issued.code);
 expect(telemetry(issued.value).deployment.wings).toBe('STOWED');
 s = stepSim(issued.value, 30).state;
 expect(telemetry(s).deployment.wings).toBe('DEPLOYED');
});

it('cannot bypass the brief, segment and meaningful trade evidence at launch', () => {
 const d = createStarterDesign('CREW_PATHFINDER', 'ASPIRING'), b = computeBudgets(d);
 const artifacts = { ...createMissionArtifacts(d), trade: { revision: d.revision, description: 'no change', before: b, after: b, actor: 'ALL' as const }, baselineRevision: d.revision, verifiedRevision: d.revision };
 const ids = evaluateJourneyStage(d, artifacts, 'IMPLEMENT', signed).map(x => x.id);
 expect(ids).toContain('OBJECTIVE'); expect(ids).toContain('TRADE');
});
