// Adapted from Void Protocol (© Guilhermy), apps/web/src/advisor/cueTone.ts @ 218625d.
// Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
import type { ActiveCue } from '@astrix/core';
export type CueTone='alert_3'|'alert_2'|'tip'|'teach';
export function cueToneOf(cue:Pick<ActiveCue,'category'|'severity'>):CueTone{if(cue.category==='alert')return cue.severity===3?'alert_3':'alert_2';return cue.category==='tip'?'tip':'teach';}
