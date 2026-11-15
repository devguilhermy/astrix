import { describe, expect, it } from 'bun:test';
import { Points } from 'three';
import { copyFlightState, createFlightState, FIXED_STEP, idleInput, stepFlight } from './flightMath';
import { createThrusters, portDemand, sampleThrusters, stepThrusters, THRUSTER_PORTS } from './thrusterMath';
import { ThrusterJets } from './ThrusterJets';
import { cross3, quatFromRotationVector, vec3, type Vec3 } from './vecMath';

describe('Explore correction jets', () => {
  it('produces balanced torque couples and translation for both signs of all three axes', () => {
    for (const turning of [true, false]) for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const rotation = vec3(), translation = vec3(), force = vec3(), torque = vec3();
      (turning ? rotation : translation)[axis] = sign;
      for (const port of THRUSTER_PORTS) {
        const level = portDemand(port, rotation, translation);
        const reaction: Vec3 = port.exhaust.map(value => -value * level) as Vec3;
        const moment = cross3(vec3(), port.position, reaction);
        for (let component = 0; component < 3; component++) {
          force[component] += reaction[component];
          torque[component] += moment[component];
        }
      }
      const result = turning ? torque : force;
      const balanced = turning ? force : torque;
      expect(result[axis] * sign).toBeGreaterThan(0);
      for (let component = 0; component < 3; component++) {
        expect(balanced[component]).toBeCloseTo(0, 10);
        if (component !== axis) expect(result[component]).toBeCloseTo(0, 10);
      }
    }
  });

  it('fires the opposite correction on drag release, in the rotated ship frame', () => {
    for (const steer of ['steerPitch', 'steerYaw'] as const) for (const sign of [-1, 1]) {
      const state = createFlightState([0, 0, 0], quatFromRotationVector([0, 0, 0, 1], .3, 1.4, -.7));
      const before = copyFlightState(createFlightState(), state), thrusters = createThrusters(), input = idleInput();
      const axis = steer === 'steerPitch' ? 0 : 1;
      const expectedSign = steer === 'steerPitch' ? sign : -sign;
      input[steer] = sign * .04;
      stepFlight(state, input, [], { speedLimit: .3, target: null }, FIXED_STEP);
      sampleThrusters(thrusters, before, state, false, .3, FIXED_STEP);
      expect(thrusters.rotation[axis] * expectedSign).toBeGreaterThan(0);
      copyFlightState(before, state);
      input[steer] = 0;
      stepFlight(state, input, [], { speedLimit: .3, target: null }, FIXED_STEP);
      sampleThrusters(thrusters, before, state, false, .3, FIXED_STEP);
      expect(thrusters.rotation[axis] * expectedSign).toBeLessThan(0);
    }
  });

  it('does not vent for idle or passive coasting, but vents against velocity when braking', () => {
    const before = createFlightState(), state = createFlightState(), thrusters = createThrusters();
    before.velocity[0] = .1;
    copyFlightState(state, before);
    stepFlight(state, idleInput(), [], { speedLimit: .3, target: null }, FIXED_STEP);
    sampleThrusters(thrusters, before, state, false, .3, FIXED_STEP);
    expect(thrusters.translation).toEqual([0, 0, 0]);
    expect(stepThrusters(thrusters, FIXED_STEP, false)).toBe(false);
    const brake = { ...idleInput(), brake: true };
    copyFlightState(before, state);
    stepFlight(state, brake, [], { speedLimit: .3, target: null }, FIXED_STEP);
    sampleThrusters(thrusters, before, state, true, .3, FIXED_STEP);
    expect(thrusters.translation[0]).toBeLessThan(0);
  });

  it('lets gas linger after release, then clears every puff so demand rendering can sleep', () => {
    for (const reduced of [false, true]) {
      const jets = new ThrusterJets(), thrusters = createThrusters();
      thrusters.rotation[1] = 1;
      for (let tick = 0; tick < 12; tick++) {
        stepThrusters(thrusters, FIXED_STEP, reduced);
        jets.step(thrusters, FIXED_STEP, reduced);
      }
      const gas = jets.children.find(child => child instanceof Points) as Points;
      expect(gas.geometry.getAttribute('alpha').array.some(value => value > .05)).toBe(true);
      thrusters.rotation.fill(0);
      stepThrusters(thrusters, FIXED_STEP, reduced);
      jets.step(thrusters, FIXED_STEP, reduced);
      expect(jets.active).toBe(true);
      for (let tick = 0; tick < 90; tick++) {
        stepThrusters(thrusters, FIXED_STEP, reduced);
        jets.step(thrusters, FIXED_STEP, reduced);
      }
      expect(thrusters.active).toBe(false);
      expect(jets.active).toBe(false);
      expect(gas.geometry.getAttribute('alpha').array.every(value => value === 0)).toBe(true);
      jets.dispose();
    }
  });
});
