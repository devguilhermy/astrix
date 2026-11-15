import { afterEach, describe, expect, it } from 'bun:test';
import { createSim, createStarterDesign, quoteAddPart, telemetry, type AttitudeQuaternion } from '@astrix/core';
import { liveMission, useMission } from '../../store';
import { pilotInput, usePilot } from './pilotState';

function flight() {
 const installed = quoteAddPart(createStarterDesign('FIRST_LIGHT', 'ASPIRING'), 'CAM_EO', 'ALL');
 if (!installed.ok) throw new Error(`Pilot fixture installation refused: ${installed.code}`);
 const design = installed.value.next;
 const sim = createSim(design, 42), current = telemetry(sim);
 liveMission.state = sim; liveMission.telemetry = current; liveMission.generation++;
 useMission.setState({ design, sim, telemetry: current, players: [['SCIENCE', 'SPACECRAFT', 'LAUNCH_ORBIT', 'GROUND_COMMS']], activeStage: 'IMPLEMENT', activeRole: 'SPACECRAFT', warp: 1, running: false, pendingDecisions: [], pauseReasons: [], explanation: null, handoff: null });
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
  useMission.setState({ warp: 100 });
  pilotInput.begin(); pilotInput.drag(50, 50);
  expect(useMission.getState().telemetry!.commandQueue.length).toBe(0);
  useMission.setState({ warp: 10 });
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
