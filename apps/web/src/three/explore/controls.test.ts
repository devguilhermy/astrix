import { describe, expect, it } from 'bun:test';
import { applyDeadzone, createExploreControls, keyBindingFor } from './controls';
import { DEFAULT_SPEED_TIER, SPEED_LIMITS, idleInput } from './flightMath';
import { dragToSteer } from './cameraMath';

describe('keyboard bindings', () => {
  it('maps physical keys to flight controls', () => {
    expect(keyBindingFor('KeyW', 'other', false)).toEqual({ kind: 'hold', control: 'thrust' });
    expect(keyBindingFor('ArrowUp', 'other', false)).toEqual({ kind: 'hold', control: 'pitchUp' });
    expect(keyBindingFor('KeyP', 'other', false)).toEqual({ kind: 'command', command: 'autopilot' });
    expect(keyBindingFor('KeyZ', 'other', false)).toBeNull();
  });

  it('leaves fields, modified shortcuts and button activation to the page', () => {
    expect(keyBindingFor('KeyW', 'field', false)).toBeNull();
    expect(keyBindingFor('ArrowDown', 'field', false)).toBeNull();
    expect(keyBindingFor('KeyW', 'other', true)).toBeNull();
    expect(keyBindingFor('Space', 'button', false)).toBeNull();
    expect(keyBindingFor('Enter', 'button', false)).toBeNull();
    expect(keyBindingFor('KeyW', 'button', false)).toEqual({ kind: 'hold', control: 'thrust' });
    expect(keyBindingFor('Space', 'other', false)).toEqual({ kind: 'hold', control: 'brake' });
  });
});

describe('steering pad deadzone', () => {
  it('ignores small deflections and reaches full scale at the rim', () => {
    expect(applyDeadzone(.05, .05)).toEqual([0, 0]);
    const [x, y] = applyDeadzone(1, 0);
    expect(x).toBeCloseTo(1, 12);
    expect(y).toBe(0);
    expect(applyDeadzone(.56, 0)[0]).toBeCloseTo(.5, 12);
  });
});

describe('control store', () => {
  it('holds a control while any of its sources is pressed', () => {
    const controls = createExploreControls();
    const input = idleInput();
    controls.press('key:KeyA', 'yawLeft');
    controls.press('key:ArrowLeft', 'yawLeft');
    controls.release('key:KeyA');
    expect(controls.readInput(input, dragToSteer, true).yaw).toBe(-1);
    controls.release('key:ArrowLeft');
    expect(controls.readInput(input, dragToSteer, true).yaw).toBe(0);
    expect(controls.active()).toBe(false);
  });

  it('combines keys and the pad, clamped to full deflection', () => {
    const controls = createExploreControls();
    controls.press('pad:1', 'pitchUp');
    controls.setStick(0, 1);
    controls.press('pad:2', 'thrust');
    const input = controls.readInput(idleInput(), dragToSteer, true);
    expect(input.pitch).toBe(1);
    expect(input.thrust).toBe(1);
    controls.releaseAll();
    expect(controls.active()).toBe(false);
  });

  it('routes drags as Void Protocol does: steering by default, looking in free look and on autopilot', () => {
    const controls = createExploreControls();
    expect(controls.getSnapshot().dragMode).toBe('steer');
    // Autopilot: the drag only turns the view and never reaches the heading.
    controls.setAutopilot('engaged');
    controls.drag(7, 3);
    expect(controls.readInput(idleInput(), dragToSteer, true).steerYaw).toBe(0);
    expect(controls.takeLook({ dx: 0, dy: 0 })).toEqual({ dx: 7, dy: 3 });
    controls.setAutopilot('off');
    // Free look (L): the drag looks around.
    controls.command('dragMode');
    expect(controls.getSnapshot().dragMode).toBe('look');
    controls.drag(12, -4);
    expect(controls.takeLook({ dx: 0, dy: 0 })).toEqual({ dx: 12, dy: -4 });
    expect(controls.readInput(idleInput(), dragToSteer, true).steerYaw).toBe(0);
    controls.command('dragMode');
    controls.drag(10, 0);
    expect(controls.readInput(idleInput(), dragToSteer, false).steerYaw).toBe(0);
    expect(controls.readInput(idleInput(), dragToSteer, true).steerYaw).toBeCloseTo(dragToSteer(10, 0).yaw, 12);
    expect(controls.readInput(idleInput(), dragToSteer, true).steerYaw).toBe(0);
    expect(controls.takeLook({ dx: 0, dy: 0 })).toEqual({ dx: 0, dy: 0 });
  });

  it('applies commands to an immutable snapshot and clamps the speed tier', () => {
    const controls = createExploreControls();
    const first = controls.getSnapshot();
    expect(first.speedTier).toBe(DEFAULT_SPEED_TIER);
    for (let i = 0; i < 20; i++) controls.command('speedUp');
    expect(controls.getSnapshot().speedTier).toBe(SPEED_LIMITS.length - 1);
    for (let i = 0; i < 20; i++) controls.command('speedDown');
    expect(controls.getSnapshot().speedTier).toBe(0);
    controls.command('camera');
    expect(controls.getSnapshot().camera).toBe('cockpit');
    expect(first.camera).toBe('chase');
    controls.command('autopilot');
    expect(controls.getSnapshot().autopilot).toBe('engaged');
    controls.command('cancel');
    expect(controls.getSnapshot().autopilot).toBe('off');
  });

  it('notifies listeners on every change but keeps the snapshot identity for held inputs', () => {
    const controls = createExploreControls();
    let calls = 0;
    const unsubscribe = controls.subscribe(() => { calls++; });
    const snapshot = controls.getSnapshot();
    controls.press('key:KeyW', 'thrust');
    controls.setStick(.5, 0);
    controls.drag(1, 1);
    expect(calls).toBe(3);
    expect(controls.getSnapshot()).toBe(snapshot);
    controls.command('help');
    expect(controls.getSnapshot()).not.toBe(snapshot);
    unsubscribe();
    controls.command('help');
    expect(calls).toBe(4);
  });

  it('resets to boarding defaults', () => {
    const controls = createExploreControls();
    controls.command('camera');
    controls.command('pad');
    expect(controls.getSnapshot().pad).toBe(false);
    controls.press('key:KeyW', 'thrust');
    controls.reset();
    expect(controls.getSnapshot()).toEqual({ speedTier: DEFAULT_SPEED_TIER, camera: 'chase', dragMode: 'steer', autopilot: 'off', help: false, pad: true });
    expect(controls.active()).toBe(false);
  });
});
