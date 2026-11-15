import { describe, expect, it } from 'bun:test';
import {
  FIXED_STEP, MAX_FRAME_DELTA, SPEED_LIMITS, arriveTolerance, autopilotGoal, avoidRadius, consumeFrame, copyFlightState, createFlightState, idleInput,
  isFlightActive, limitClosingSpeed, pushOutside, standOffDistance, stepFlight, sweepMove, type AutopilotStatus, type FlightBody, type FlightInput, type FlightState,
} from './flightMath';
import { distance3, length3, rotate3, vec3, type Vec3 } from './vecMath';

/** Plan §11.3 radii on compressed orbits; positions are illustrative points on those orbits. */
const BODIES: readonly FlightBody[] = [
  { id: 'SUN', position: [0, 0, 0], radius: 6 },
  { id: 'MERCURY', position: [7.2, 0, 4.5], radius: .021 },
  { id: 'VENUS', position: [-7.4, 0, 7.4], radius: .0522 },
  { id: 'EARTH', position: [-1.5, 0, -12.4], radius: .055 },
  { id: 'MOON', position: [-1.05, .05, -12.4], radius: .015 },
  { id: 'MARS', position: [-14.4, 0, -1.7], radius: .0293 },
  { id: 'JUPITER', position: [18.4, 0, 4.5], radius: .6166 },
  { id: 'SATURN', position: [-9.2, 0, 22.1], radius: .5198 },
  { id: 'URANUS', position: [-16.6, 0, -23.1], radius: .2204 },
  { id: 'NEPTUNE', position: [21.6, 0, -24.9], radius: .2136 },
];
const body = (id: string) => BODIES.find(item => item.id === id)!;
const input = (patch: Partial<FlightInput> = {}): FlightInput => ({ ...idleInput(), ...patch });
/** Reads the status as the full union: `stepFlight` mutates it, which control-flow narrowing cannot see. */
const statusOf = (state: FlightState): AutopilotStatus => state.autopilot;
const facing = (from: Vec3, to: readonly [number, number, number]) => {
  // Orientation whose −Z axis points from `from` toward `to`, by yaw then pitch.
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
  const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
  return [cy * sp, sy * cp, -sy * sp, cy * cp] as [number, number, number, number];
};
function insideAny(position: readonly [number, number, number]): string | null {
  for (const item of BODIES) if (distance3(position, item.position) < avoidRadius(item.radius) * (1 - 1e-9)) return item.id;
  return null;
}
/** Deterministic pseudo-random sequence for the property test. */
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
}

describe('collision avoidance', () => {
  it('never lets the ship inside any avoidance sphere, even at speeds far beyond every limit', () => {
    const random = lcg(11);
    for (let trial = 0; trial < 200; trial++) {
      const goal = BODIES[trial % BODIES.length];
      const start: Vec3 = [goal.position[0] + (random() - .5) * 8, goal.position[1] + (random() - .5) * 2, goal.position[2] + (random() - .5) * 8];
      pushOutside(start, start, BODIES);
      const state = createFlightState(start, facing(start, goal.position));
      const speed = [1, 50, 1000][trial % 3];
      const direction = vec3(goal.position[0] - start[0], goal.position[1] - start[1], goal.position[2] - start[2]);
      const length = length3(direction);
      for (let axis = 0; axis < 3; axis++) state.velocity[axis] = direction[axis] / length * speed;
      for (let step = 0; step < 90; step++) {
        stepFlight(state, input({ thrust: 1 }), BODIES, { speedLimit: 1e6, target: null }, FIXED_STEP);
        expect(insideAny(state.position)).toBeNull();
      }
    }
  });

  it('stops a single step that would tunnel straight through the Moon on its near surface', () => {
    const moon = body('MOON');
    const from: Vec3 = [moon.position[0] - 1, moon.position[1], moon.position[2]];
    const velocity: Vec3 = [200, 0, 0];
    const out = sweepMove(vec3(), from, velocity, FIXED_STEP, [moon]);
    expect(distance3(out, moon.position)).toBeCloseTo(avoidRadius(moon.radius), 9);
    expect(out[0]).toBeLessThan(moon.position[0]);
    expect(velocity[0]).toBeCloseTo(0, 9);
  });

  it('holds a ship thrusting straight at Jupiter on its avoidance sphere', () => {
    const jupiter = body('JUPITER');
    const start: Vec3 = [jupiter.position[0] - 4, jupiter.position[1] + .1, jupiter.position[2]];
    const state = createFlightState(start, facing(start, jupiter.position));
    let minimum = Infinity;
    for (let step = 0; step < 60 * 20; step++) {
      stepFlight(state, input({ thrust: 1 }), BODIES, { speedLimit: SPEED_LIMITS[5], target: null }, FIXED_STEP);
      minimum = Math.min(minimum, distance3(state.position, jupiter.position));
    }
    expect(minimum).toBeGreaterThanOrEqual(avoidRadius(jupiter.radius) * (1 - 1e-9));
    expect(minimum).toBeLessThan(avoidRadius(jupiter.radius) * 1.01);
  });

  it('slows a head-on approach so the speed never exceeds the proximity allowance', () => {
    const earth = body('EARTH');
    const start: Vec3 = [earth.position[0], earth.position[1], earth.position[2] + 2];
    const state = createFlightState(start, facing(start, earth.position));
    for (let step = 0; step < 60 * 10; step++) {
      stepFlight(state, input({ thrust: 1 }), BODIES, { speedLimit: SPEED_LIMITS[5], target: null }, FIXED_STEP);
      const clearance = distance3(state.position, earth.position) - avoidRadius(earth.radius);
      expect(length3(state.velocity)).toBeLessThanOrEqual(.0015 + 1.5 * (clearance + length3(state.velocity) * FIXED_STEP) + 1e-9);
    }
  });
});

describe('flight integration', () => {
  it('runs the same fixed steps at 30 and 60 frames per second', () => {
    const run = (fps: number) => {
      const clock = { accumulator: 0, alpha: 0 };
      const state = createFlightState([30, 0, 0]);
      let steps = 0;
      for (let frame = 0; frame < fps * 2; frame++) {
        const count = consumeFrame(clock, 1 / fps);
        for (let i = 0; i < count; i++, steps++) stepFlight(state, input({ thrust: 1, yaw: .5 }), BODIES, { speedLimit: .3, target: null }, FIXED_STEP);
      }
      return { state, steps };
    };
    const thirty = run(30), sixty = run(60);
    expect(thirty.steps).toBe(sixty.steps);
    expect(thirty.state.position[0]).toBe(sixty.state.position[0]);
    expect(thirty.state.position[2]).toBe(sixty.state.position[2]);
  });

  it('does not replay a long pause as a burst of steps', () => {
    const clock = { accumulator: 0, alpha: 0 };
    expect(consumeFrame(clock, 5)).toBe(Math.floor(MAX_FRAME_DELTA / FIXED_STEP + 1e-9));
    expect(consumeFrame(clock, Number.NaN)).toBe(0);
  });

  it('respects the speed limit under thrust and decays smoothly when the limit is lowered', () => {
    const state = createFlightState([30, 0, 0]);
    for (let step = 0; step < 600; step++) {
      stepFlight(state, input({ thrust: 1 }), BODIES, { speedLimit: 1, target: null }, FIXED_STEP);
      expect(length3(state.velocity)).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(length3(state.velocity)).toBeCloseTo(1, 6);
    stepFlight(state, input({ thrust: 1 }), BODIES, { speedLimit: .08, target: null }, FIXED_STEP);
    const afterOne = length3(state.velocity);
    expect(afterOne).toBeGreaterThan(.08);
    expect(afterOne).toBeLessThan(1);
    for (let step = 0; step < 240; step++) stepFlight(state, input({ thrust: 1 }), BODIES, { speedLimit: .08, target: null }, FIXED_STEP);
    expect(length3(state.velocity)).toBeLessThan(.08 * 1.001);
  });

  it('coasts to rest with damping, brakes much faster, and then lets the frame loop sleep', () => {
    const coast = createFlightState([30, 0, 0]), brake = createFlightState([30, 0, 0]);
    coast.velocity[2] = -.3;
    brake.velocity[2] = -.3;
    for (let step = 0; step < 60; step++) {
      stepFlight(coast, input(), BODIES, { speedLimit: .3, target: null }, FIXED_STEP);
      stepFlight(brake, input({ brake: true }), BODIES, { speedLimit: .3, target: null }, FIXED_STEP);
    }
    expect(length3(coast.velocity)).toBeLessThan(.3);
    expect(length3(brake.velocity)).toBeLessThan(length3(coast.velocity) / 20);
    for (let step = 0; step < 60 * 15; step++) stepFlight(coast, input(), BODIES, { speedLimit: .3, target: null }, FIXED_STEP);
    expect(length3(coast.velocity)).toBe(0);
    expect(isFlightActive(coast)).toBe(false);
  });

  it('turns right for positive yaw, raises the nose for positive pitch, and steers by drag radians', () => {
    const forward = (state: FlightState) => rotate3(vec3(), state.orientation, [0, 0, -1]);
    const yaw = createFlightState([30, 0, 0]);
    for (let step = 0; step < 30; step++) stepFlight(yaw, input({ yaw: 1 }), BODIES, { speedLimit: .3, target: null }, FIXED_STEP);
    expect(forward(yaw)[0]).toBeGreaterThan(.1);
    const pitch = createFlightState([30, 0, 0]);
    for (let step = 0; step < 30; step++) stepFlight(pitch, input({ pitch: 1 }), BODIES, { speedLimit: .3, target: null }, FIXED_STEP);
    expect(forward(pitch)[1]).toBeGreaterThan(.1);
    const steer = createFlightState([30, 0, 0]);
    stepFlight(steer, input({ steerYaw: Math.PI / 2 }), BODIES, { speedLimit: .3, target: null }, FIXED_STEP);
    expect(forward(steer)[0]).toBeCloseTo(1, 6);
  });
});

describe('autopilot', () => {
  it('flies around the Sun to Mars, never enters a body and stops at the stand-off distance', () => {
    const mars = body('MARS');
    const start: Vec3 = [-mars.position[0] * 1.3, .02, -mars.position[2] * 1.3];
    const state = createFlightState(start, facing(start, [0, 0, 0]));
    state.autopilot = 'engaged';
    let steps = 0;
    while (statusOf(state) === 'engaged' && steps < 60 * 120) {
      stepFlight(state, input(), BODIES, { speedLimit: SPEED_LIMITS[5], target: mars }, FIXED_STEP);
      expect(insideAny(state.position)).toBeNull();
      steps++;
    }
    expect(statusOf(state)).toBe('arrived');
    expect(length3(state.velocity)).toBe(0);
    expect(Math.abs(distance3(state.position, mars.position) - standOffDistance(mars.radius))).toBeLessThanOrEqual(arriveTolerance(mars.radius) + 1e-9);
    const nose = rotate3(vec3(), state.orientation, [0, 0, -1]);
    const toMars = vec3(mars.position[0] - state.position[0], mars.position[1] - state.position[1], mars.position[2] - state.position[2]);
    expect((nose[0] * toMars[0] + nose[1] * toMars[1] + nose[2] * toMars[2]) / length3(toMars)).toBeGreaterThan(.95);
  });

  it('lets a course that passes clear of a body keep its speed', () => {
    const moon = body('MOON');
    const position: Vec3 = [moon.position[0] - .5, moon.position[1] + .1, moon.position[2]];
    const velocity: Vec3 = [1, 0, 0];
    limitClosingSpeed(velocity, position, [moon]);
    expect(velocity[0]).toBe(1);
    const headOn: Vec3 = [1, -.2, 0];
    limitClosingSpeed(headOn, position, [moon]);
    expect(length3(headOn)).toBeLessThan(length3([1, -.2, 0]));
  });

  it('approaches a small body from the side the ship is on', () => {
    const moon = body('MOON');
    const goal = autopilotGoal(vec3(), [moon.position[0] + 1, moon.position[1], moon.position[2]], moon);
    expect(goal[0]).toBeGreaterThan(moon.position[0]);
    expect(distance3(goal, moon.position)).toBeCloseTo(standOffDistance(moon.radius), 9);
    expect(standOffDistance(moon.radius)).toBeGreaterThan(avoidRadius(moon.radius));
  });

  it('hands control back on any manual input and switches off without a target', () => {
    const mars = body('MARS');
    const state = createFlightState([0, 0, 20]);
    state.autopilot = 'engaged';
    stepFlight(state, input(), BODIES, { speedLimit: .3, target: mars }, FIXED_STEP);
    expect(statusOf(state)).toBe('engaged');
    const copy = copyFlightState(createFlightState(), state);
    stepFlight(state, input({ yaw: 1 }), BODIES, { speedLimit: .3, target: mars }, FIXED_STEP);
    expect(statusOf(state)).toBe('off');
    stepFlight(copy, input(), BODIES, { speedLimit: .3, target: null }, FIXED_STEP);
    expect(statusOf(copy)).toBe('off');
  });
});
