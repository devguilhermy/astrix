// Bounds for a player-authored ascent program. One definition is shared by design quotes, launch readiness, preview and the wire parser.
import type { AscentProgram } from '../mission/types';
import type { LauncherDef } from './types';

export const PROGRAM_BOUNDS = {
 azimuthDeg: { min: 0, max: 360 }, verticalSec: { min: 2, max: 60 }, kickDeg: { min: 0, max: 30 }, kickSec: { min: 1, max: 120 },
 stage1LoadFraction: { min: 0.05, max: 1 }, stage2CoastSec: { min: 0, max: 1800 }, insertionAltKm: { min: 150, max: 2000 },
} as const;
const inside = (x: unknown, b: { min: number; max: number }): boolean => typeof x === 'number' && Number.isFinite(x) && x >= b.min && x <= b.max;
/** Returns the first offending field, or null when the program is physically meaningful for this launcher. */
export function ascentProgramIssue(p: unknown, launcher?: LauncherDef): keyof AscentProgram | null {
 if (typeof p !== 'object' || p === null) return 'azimuthDeg';
 const q = p as Record<string, unknown>;
 for (const key of Object.keys(PROGRAM_BOUNDS) as (keyof typeof PROGRAM_BOUNDS)[]) if (!inside(q[key], PROGRAM_BOUNDS[key])) return key;
 if (typeof q.holdUpperStage !== 'boolean') return 'holdUpperStage';
 if (launcher && launcher.stages.length < 2 && q.holdUpperStage) return 'holdUpperStage';
 return null;
}
