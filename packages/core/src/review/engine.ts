// Adapted from Void Protocol (© Guilhermy), apps/web/src/advisor/engine.ts @ 218625d.
// Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
// Domain references become ASTRIX strings; explicit serializable state replaces augmented arrays.
import type { ActiveCue, CueEngineState, ReviewSnapshot } from '../contracts';
import { CUE_RULES, type CueRule } from './rules';

export interface EngineState extends CueEngineState { readonly tracked: readonly ActiveCue[] }
export interface CuePreferences { readonly guidance: 'all' | 'alerts'; readonly dismissed: readonly string[] }
const allGuidance: CuePreferences = { guidance: 'all', dismissed: [] };
const priority = (a: ActiveCue, b: ActiveCue): number => b.severity - a.severity || a.firstRaisedSec - b.firstRaisedSec || a.ruleId.localeCompare(b.ruleId);

/** Rule injection is a deterministic test seam; the game uses evaluateCues below. */
export function evaluateRules(prev: CueEngineState, snapshot: ReviewSnapshot, rules: readonly CueRule[], prefs: CuePreferences, nowSec: number): EngineState {
 const lastRaised = { ...prev.lastRaised }, clearPending: Record<string, number> = {};
 const tracked = 'tracked' in prev ? (prev as EngineState).tracked : prev.active;
 const activeMap = new Map(tracked.map(c => [c.ruleId, c]));
 const active: ActiveCue[] = [];
 for (const rule of rules) {
  if (rule.applies && !rule.applies(snapshot)) continue;
  const filtered = prefs.dismissed.includes(rule.id) || prefs.guidance === 'alerts' && rule.category !== 'alert';
  if (!rule.mandatory && filtered) continue;
  const instance = rule.detect(snapshot), old = activeMap.get(rule.id);
  if (instance !== null) {
   const last = lastRaised[rule.id];
   if (!old && last !== undefined && nowSec - last < rule.cooldownSec) continue;
   if (!old) lastRaised[rule.id] = nowSec;
   active.push({ id: rule.id, ruleId: rule.id, category: rule.category, severity: rule.severity, role: rule.role, params: instance.params,
    target: instance.target ?? rule.target, fix: instance.fix ?? rule.fix, glossaryId: instance.glossaryId ?? rule.glossaryId, firstRaisedSec: old?.firstRaisedSec ?? nowSec });
  } else if (old && rule.clearAfterSec > 0) {
   const since = prev.clearPending[rule.id] ?? nowSec;
   if (nowSec - since < rule.clearAfterSec) { clearPending[rule.id] = since; active.push(old); }
  }
 }
 active.sort(priority);
 const visible: ActiveCue[] = [];
 let others = 0;
 for (const cue of active) if (cue.category === 'alert' || others++ < 2) visible.push(cue);
 return { lastRaised, clearPending, active: visible, tracked: active };
}
export function evaluateCues(prev: CueEngineState, snap: ReviewSnapshot, nowSec: number): CueEngineState { return evaluateRules(prev, snap, CUE_RULES, allGuidance, nowSec); }
