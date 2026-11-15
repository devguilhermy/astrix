/**
 * Wall-clock pacing of a turn replay. Presentation only: the replay never changes mission
 * state, and long turns are time-lapsed between their first and last orbit.
 */
export const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const;
export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number];
export const PLAYBACK_SPEED_KEY = 'astrix.playback.speed';
/** Share of the wall time given to the first and to the last orbit of a time-lapsed turn. */
const EDGE_SHARE = .35;

export interface PlaybackClock {
  startSec: number;
  endSec: number;
  periodSec: number;
  orbits: number;
  /** Wall seconds at 1×. */
  wallSec: number;
}

/** Orbits flown in the turn; a launch counts as one. */
export function playbackOrbits(elapsedSec: number, periodSec: number, launch: boolean): number {
  if (launch) return 1;
  return periodSec > 0 && Number.isFinite(periodSec) && elapsedSec > 0 ? elapsedSec / periodSec : 0;
}

/** `clamp(6 + 3 × min(orbits, 6), 6, 24)` seconds at 1×. */
export function wallDuration(orbits: number): number {
  return Math.min(24, Math.max(6, 6 + 3 * Math.min(Number.isFinite(orbits) ? orbits : 0, 6)));
}

export function playbackClock(startSec: number, endSec: number, periodSec: number, launch: boolean): PlaybackClock {
  const elapsed = Math.max(0, endSec - startSec), orbits = playbackOrbits(elapsed, periodSec, launch);
  return { startSec, endSec: startSec + elapsed, periodSec, orbits, wallSec: wallDuration(orbits) };
}

/**
 * Mission time shown after `wallSec` of replay at 1×. Up to three orbits the map is linear;
 * beyond, the first orbit takes the first 35 %, the last orbit the last 35 %, and the rest
 * is time-lapsed through the middle 30 %.
 */
export function missionTimeAt(clock: PlaybackClock, wallSec: number): number {
  const f = Math.min(1, Math.max(0, clock.wallSec > 0 ? wallSec / clock.wallSec : 1)), elapsed = clock.endSec - clock.startSec;
  if (clock.orbits <= 3) return clock.startSec + f * elapsed;
  const period = clock.periodSec;
  if (f <= EDGE_SHARE) return clock.startSec + f / EDGE_SHARE * period;
  if (f >= 1 - EDGE_SHARE) return clock.endSec - period + (f - (1 - EDGE_SHARE)) / EDGE_SHARE * period;
  return clock.startSec + period + (f - EDGE_SHARE) / (1 - 2 * EDGE_SHARE) * (elapsed - 2 * period);
}

export function isPlaybackSpeed(value: unknown): value is PlaybackSpeed {
  return PLAYBACK_SPEEDS.includes(value as PlaybackSpeed);
}

/** The chosen speed persists between sessions; anything unreadable means 1×. */
export function readPlaybackSpeed(storage: Pick<Storage, 'getItem'> | null | undefined): PlaybackSpeed {
  try {
    const value = Number(storage?.getItem(PLAYBACK_SPEED_KEY));
    return isPlaybackSpeed(value) ? value : 1;
  } catch {
    return 1;
  }
}

export function writePlaybackSpeed(storage: Pick<Storage, 'setItem'> | null | undefined, speed: PlaybackSpeed): void {
  try { storage?.setItem(PLAYBACK_SPEED_KEY, String(speed)); } catch { /* Private browsing: the speed simply is not remembered. */ }
}
