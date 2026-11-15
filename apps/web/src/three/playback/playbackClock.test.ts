import { describe, expect, test } from 'bun:test';
import { PLAYBACK_SPEED_KEY, missionTimeAt, playbackClock, playbackOrbits, readPlaybackSpeed, wallDuration, writePlaybackSpeed } from './playbackClock';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, values };
}

describe('playback clock', () => {
  test('wall duration is 6 s plus 3 s per orbit, between 6 and 24 s', () => {
    expect(wallDuration(0)).toBe(6);
    expect(wallDuration(1)).toBe(9);
    expect(wallDuration(3)).toBe(15);
    expect(wallDuration(6)).toBe(24);
    expect(wallDuration(40)).toBe(24);
    expect(wallDuration(Number.NaN)).toBe(6);
  });

  test('a launch counts as one orbit', () => {
    expect(playbackOrbits(420, 5400, true)).toBe(1);
    expect(playbackOrbits(10800, 5400, false)).toBe(2);
    expect(playbackOrbits(100, 0, false)).toBe(0);
  });

  test('up to three orbits the time map is linear', () => {
    const clock = playbackClock(1000, 1000 + 2 * 5400, 5400, false);
    expect(clock.wallSec).toBe(12);
    expect(missionTimeAt(clock, 0)).toBe(1000);
    expect(missionTimeAt(clock, 6)).toBeCloseTo(1000 + 5400, 6);
    expect(missionTimeAt(clock, 12)).toBeCloseTo(1000 + 10800, 6);
    expect(missionTimeAt(clock, 99)).toBeCloseTo(1000 + 10800, 6);
  });

  test('beyond three orbits the first and last orbit keep 35 % each and the middle is time-lapsed', () => {
    const period = 5400, clock = playbackClock(0, 16 * period, period, false);
    expect(clock.wallSec).toBe(24);
    expect(missionTimeAt(clock, .35 * 24)).toBeCloseTo(period, 6);
    expect(missionTimeAt(clock, .65 * 24)).toBeCloseTo(15 * period, 6);
    expect(missionTimeAt(clock, .5 * 24)).toBeCloseTo(8 * period, 6);
    expect(missionTimeAt(clock, 24)).toBeCloseTo(16 * period, 6);
    let previous = -1;
    for (let wall = 0; wall <= 24; wall += .25) {
      const t = missionTimeAt(clock, wall);
      expect(t).toBeGreaterThanOrEqual(previous);
      previous = t;
    }
  });

  test('the chosen speed persists under astrix.playback.speed', () => {
    const storage = memoryStorage();
    expect(readPlaybackSpeed(storage)).toBe(1);
    writePlaybackSpeed(storage, 4);
    expect(storage.values.get(PLAYBACK_SPEED_KEY)).toBe('4');
    expect(readPlaybackSpeed(storage)).toBe(4);
    expect(readPlaybackSpeed(memoryStorage({ [PLAYBACK_SPEED_KEY]: '3' }))).toBe(1);
    expect(readPlaybackSpeed(null)).toBe(1);
    expect(readPlaybackSpeed({ getItem: () => { throw new Error('denied'); } })).toBe(1);
  });
});
