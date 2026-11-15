import { afterEach, describe, expect, it } from 'bun:test';
import { quoteAddPart, type AttitudeQuaternion } from '@astrix/core';
import { useMission } from '../../store';
import { pilotInput, usePilot } from './pilotState';

function flight() {
 const s=useMission.getState();s.resetMission();s.setTeam(1);s.startScenario('FIRST_LIGHT','ASPIRING');s.addPart('CAM_EO');
 s.updateArtifacts({objectiveConfirmed:true});
 for(let stage=0;stage<3;stage++)expect(s.completeStage()).toBe(true);
 const design=useMission.getState().design!,quote=quoteAddPart(design,'MAG','ALL');
 if(!quote.ok)throw new Error(`Pilot fixture comparison refused: ${quote.code}`);
 s.recordTradeQuote('MAG',quote);expect(s.freezeBaseline()).toBe(true);expect(s.completeStage()).toBe(true);
 s.signOff();expect(s.verifyBaseline()).toBe(true);expect(s.completeStage()).toBe(true);s.launch();
 s.setWarp(1);s.setActiveRole('SPACECRAFT');
 const current=useMission.getState().telemetry!;
 usePilot.getState().setEnabled(true);
 return current;
}
afterEach(() => { pilotInput.release(); usePilot.getState().setEnabled(false); });

describe('continuous attitude input through real store/core commands', () => {
 it('throttles a drag and never rotates published physical attitude itself', () => {
  const before = flight(), q: AttitudeQuaternion = [...before.attitude.q];
  pilotInput.begin(); pilotInput.drag(20, 0);
  const first = useMission.getState().telemetry!;
  expect(first.commandQueue.length).toBe(1);
  for (let i = 0; i < 20; i++) pilotInput.drag(2, 1);
  expect(useMission.getState().telemetry!.commandQueue.length).toBe(1);
  expect(useMission.getState().telemetry!.attitude.q).toEqual(q);
  pilotInput.tick(performance.now() + 1000, .016);
  const after = useMission.getState().telemetry!;
  // Waiting targets coalesce; already transmitted targets remain immutable.
  expect(after.commandQueue.length).toBe(first.commandQueue[0].status === 'WAITING_CONTACT' ? 1 : 2);
  expect(after.attitude.q).toEqual(q);
 });
 it('rejects steering over 10× and supports continuous keyboard/touch hold input', () => {
  flight();
  useMission.getState().setWarp(100);
  pilotInput.begin(); pilotInput.drag(50, 50);
  expect(useMission.getState().telemetry!.commandQueue.length).toBe(0);
  useMission.getState().setWarp(10);
  pilotInput.hold('pitchUp'); pilotInput.tick(performance.now(), .1);
  const command = useMission.getState().telemetry!.commandQueue[0].command;
  expect(command.kind).toBe('ATTITUDE_TARGET');
  if (command.kind === 'ATTITUDE_TARGET') {
   expect(Math.hypot(...command.q)).toBeCloseTo(1, 12);
   expect(command.q).not.toEqual([0, 0, 0, 1]);
  }
 });
});

it('preserves a quick native key or touch tap before the next animation frame', () => {
 const before = flight(), original: AttitudeQuaternion = [...before.attitude.q];
 pilotInput.hold('yawLeft');
 pilotInput.unhold('yawLeft');
 const first = useMission.getState().telemetry!;
 expect(first.commandQueue.length).toBe(1);
 expect(first.commandQueue[0].command.kind).toBe('ATTITUDE_TARGET');
 expect(first.attitude.q).toEqual(original);
 // A second genuine tap is retained, but cannot bypass the global wall throttle.
 pilotInput.hold('yawLeft');
 pilotInput.unhold('yawLeft');
 expect(useMission.getState().telemetry!.commandQueue.length).toBe(1);
});
