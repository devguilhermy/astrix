import { describe, expect, it } from 'bun:test';
import {
  BASE_FOV, CAMERA_CLEARANCE, CHASE_OFFSET, LOOK_PITCH_LIMIT, LOOK_RECENTER_DELAY, SHAKE_AMPLITUDE, applyLook, createLook, desiredCamera, dragToLook,
  dragToSteer, easeCamera, fovFor, keepCameraClear, recenterLook, shakeOffset, type LookState,
} from './cameraMath';
import { distance3, length3, quatFromAxisAngle, quatIdentity, rotate3, vec3, type Vec3 } from './vecMath';

describe('drag mapping', () => {
  it('turns the view by the field of view for a drag across the full viewport height', () => {
    const turn = dragToLook(0, 800, 55, 800);
    expect(turn.pitch).toBeCloseTo(55 * Math.PI / 180, 12);
    expect(dragToLook(400, 0, 55, 800).yaw).toBeCloseTo(27.5 * Math.PI / 180, 12);
  });

  it('look drags grab the sky: dragging right turns the view left, dragging down looks up', () => {
    const look = applyLook(createLook(), dragToLook(100, 0, 55, 800).yaw, dragToLook(0, 100, 55, 800).pitch);
    const q = desiredOrientation(look);
    const view = rotate3(vec3(), q, [0, 0, -1]);
    expect(view[0]).toBeLessThan(0);
    expect(view[1]).toBeGreaterThan(0);
  });

  it('steer drags move the nose with the pointer', () => {
    const steer = dragToSteer(10, -10);
    expect(steer.yaw).toBeGreaterThan(0);
    expect(steer.pitch).toBeGreaterThan(0);
  });

  it('clamps pitch and wraps yaw', () => {
    const look = applyLook(createLook(), 7, 9);
    expect(look.pitch).toBe(LOOK_PITCH_LIMIT);
    expect(look.yaw).toBeCloseTo(7 - 2 * Math.PI, 12);
    expect(look.idle).toBe(0);
  });
});

describe('free look recentering', () => {
  it('waits, then eases back to the nose', () => {
    const look = applyLook(createLook(), .5, .3);
    recenterLook(look, LOOK_RECENTER_DELAY / 2, false);
    expect(look.yaw).toBe(.5);
    for (let frame = 0; frame < 60 * 8; frame++) recenterLook(look, 1 / 60, false);
    expect(look.yaw).toBe(0);
    expect(look.pitch).toBe(0);
  });

  it('never moves the view on its own under reduced motion', () => {
    const look = applyLook(createLook(), .5, .3);
    for (let frame = 0; frame < 60 * 8; frame++) recenterLook(look, 1 / 60, true);
    expect(look.yaw).toBe(.5);
    expect(look.pitch).toBe(.3);
  });
});

describe('camera rig', () => {
  it('places the chase camera behind and above the ship and the cockpit at its nose', () => {
    const offset = vec3(), orientation = quatIdentity();
    desiredCamera(offset, orientation, quatIdentity(), createLook(), 'chase', 0);
    expect(offset).toEqual([...CHASE_OFFSET]);
    desiredCamera(offset, orientation, quatIdentity(), createLook(), 'cockpit', 0);
    expect(offset[2]).toBeLessThan(0);
    expect(length3(offset)).toBeLessThan(.002);
  });

  it('eases the chase offset at any frame rate but snaps under reduced motion and in the cockpit', () => {
    const desired: Vec3 = [0, .0035, .014];
    const turned = quatFromAxisAngle(quatIdentity(), [0, 1, 0], .6);
    const thirty = vec3(), sixty = vec3();
    const q30 = quatIdentity(), q60 = quatIdentity();
    for (let frame = 0; frame < 15; frame++) easeCamera(thirty, q30, desired, turned, 1 / 30, 'chase', false);
    for (let frame = 0; frame < 30; frame++) easeCamera(sixty, q60, desired, turned, 1 / 60, 'chase', false);
    expect(thirty[2]).toBeCloseTo(sixty[2], 12);
    expect(thirty[2]).toBeLessThan(desired[2]);
    const reduced = vec3(), qReduced = quatIdentity();
    easeCamera(reduced, qReduced, desired, turned, 1 / 60, 'chase', true);
    expect(reduced).toEqual(desired);
    expect(qReduced).toEqual([...turned]);
    const cockpit = vec3(), qCockpit = quatIdentity();
    easeCamera(cockpit, qCockpit, desired, turned, 1 / 60, 'cockpit', false);
    expect(cockpit).toEqual(desired);
  });

  it('shakes only in the chase view, only under thrust, never under reduced motion', () => {
    const out = vec3();
    let peak = 0;
    for (let frame = 0; frame < 600; frame++) peak = Math.max(peak, length3(shakeOffset(out, frame / 60, 1, 1, 'chase', false)));
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(SHAKE_AMPLITUDE * Math.SQRT2 + 1e-12);
    expect(shakeOffset(out, 1.3, 1, 1, 'chase', true)).toEqual([0, 0, 0]);
    expect(shakeOffset(out, 1.3, 1, 1, 'cockpit', false)).toEqual([0, 0, 0]);
    expect(shakeOffset(out, 1.3, 0, 1, 'chase', false)).toEqual([0, 0, 0]);
  });

  it('widens the field of view with speed except under reduced motion', () => {
    expect(fovFor(1, false)).toBeGreaterThan(BASE_FOV);
    expect(fovFor(1, true)).toBe(BASE_FOV);
    expect(fovFor(0, false)).toBe(BASE_FOV);
  });

  it('keeps the camera outside a body it would otherwise enter', () => {
    const sun = { id: 'SUN', position: [0, 0, 0] as const, radius: 6 };
    const point: Vec3 = [5, 0, 0];
    keepCameraClear(point, [sun]);
    expect(distance3(point, sun.position)).toBeCloseTo(6 + CAMERA_CLEARANCE, 12);
    const outside: Vec3 = [9, 0, 0];
    keepCameraClear(outside, [sun]);
    expect(outside).toEqual([9, 0, 0]);
  });
});

function desiredOrientation(look: LookState) {
  const offset = vec3(), orientation = quatIdentity();
  desiredCamera(offset, orientation, quatIdentity(), look, 'chase', 0);
  return orientation;
}
