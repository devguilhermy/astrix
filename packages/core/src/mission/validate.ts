// Strict, total validation of untrusted mission definitions. Never throws; every field is rebuilt from checked scalars.
import type { BodyId, BusId, OrbitChoice, RoleId } from '../contracts';
import { PART_BY_ID, RIDES, rideOffersOrbit } from '../catalog';
import { LAUNCHER_BY_ID } from '../flight/launchers';
import { CONSTANTS } from '../physics';
import { BUILTIN_BY_ID } from './builtins';
import { canonicalJson, deepFreeze, digestOf } from './digest';
import { DEFINITION_SCHEMA_VERSION, MAX_DEFINITION_BYTES } from './types';
import type { DefinitionIssue, DefinitionIssueCode, DefinitionResult, FailureCause, Label, MissionDefinition, ObjectiveDef, ObjectiveSpec, ProductMetric, Range, TrajectorySpec } from './types';

const BUSES: readonly BusId[] = ['CUBESAT_3U', 'SMALLSAT', 'CREW_CAPSULE'];
const ROLES: readonly RoleId[] = ['SCIENCE', 'SPACECRAFT', 'LAUNCH_ORBIT', 'GROUND_COMMS'];
const FAILURES: readonly FailureCause[] = ['BATTERY_DEPLETED', 'CAPTURE_FAILED', 'OBJECTIVE_MISSED', 'THERMAL_SURVIVAL', 'CREW_SUPPORT_LOST', 'SURFACE_IMPACT', 'ASCENT_FAILED', 'DEADLINE_MISSED'];
const METRICS: readonly ProductMetric[] = ['IMAGES', 'MAPS', 'ANY_SCIENCE'];
const MAX_DEPTH = 8, MAX_ARRAY = 64, MAX_STRING = 600, MAX_DURATION_SEC = 120 * 86400;
/** Parker-class perihelia are out of scope: the reduced thermal and power models are not stated below a quarter of an astronomical unit. */
const MIN_PERIHELION_KM = 0.25 * CONSTANTS.EARTH.distanceKm.v;
const ID = /^[A-Za-z0-9._-]{1,32}$/, MISSION_ID = /^[a-z0-9][a-z0-9._-]{2,47}$/, UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

class Ctx {
 readonly issues: DefinitionIssue[] = [];
 add(path: string, code: DefinitionIssueCode, message: string): void { if (this.issues.length < 64) this.issues.push({ path, code, message }); }
 shape(v: unknown, path: string, required: readonly string[], optional: readonly string[] = []): Rec | null {
  if (!isRec(v)) { this.add(path, 'TYPE', 'Expected an object'); return null; }
  let ok = true;
  for (const key of required) if (!Object.hasOwn(v, key)) { this.add(`${path}.${key}`, 'EMPTY_REQUIRED', 'Required field is missing'); ok = false; }
  for (const key of Object.keys(v)) if (!required.includes(key) && !optional.includes(key)) { this.add(`${path}.${key}`, 'UNKNOWN_FIELD', 'Unknown field'); ok = false; }
  return ok ? v : null;
 }
 num(v: unknown, path: string, min: number, max: number, unit = ''): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) { this.add(path, 'TYPE', 'Expected a finite number'); return null; }
  if (v < min || v > max) { this.add(path, 'RANGE', `Expected ${min}..${max}${unit ? ` ${unit}` : ''}`); return null; }
  return v;
 }
 int(v: unknown, path: string, min: number, max: number): number | null { const n = this.num(v, path, min, max); if (n !== null && !Number.isInteger(n)) { this.add(path, 'TYPE', 'Expected an integer'); return null; } return n; }
 bool(v: unknown, path: string): boolean | null { if (typeof v !== 'boolean') { this.add(path, 'TYPE', 'Expected a boolean'); return null; } return v; }
 str(v: unknown, path: string, max: number, pattern?: RegExp): string | null {
  if (typeof v !== 'string' || v.length === 0 || v.length > max) { this.add(path, 'TYPE', `Expected a string of 1..${max} characters`); return null; }
  if (pattern && !pattern.test(v)) { this.add(path, 'TYPE', 'Unsupported characters or format'); return null; }
  return v;
 }
 member<T extends string>(v: unknown, path: string, values: readonly T[]): T | null { if (typeof v !== 'string' || !values.some(x => x === v)) { this.add(path, 'UNKNOWN_REF', `Expected one of ${values.join(', ')}`); return null; } return v as T; }
 arr(v: unknown, path: string, min: number, max: number): unknown[] | null {
  if (!Array.isArray(v)) { this.add(path, 'TYPE', 'Expected an array'); return null; }
  if (v.length < min || v.length > max) { this.add(path, 'RANGE', `Expected ${min}..${max} entries`); return null; }
  return v;
 }
 range(v: unknown, path: string, lo: number, hi: number): Range | null {
  const r = this.shape(v, path, ['min', 'max']); if (!r) return null;
  const min = this.num(r.min, `${path}.min`, lo, hi), max = this.num(r.max, `${path}.max`, lo, hi);
  if (min === null || max === null) return null;
  if (min > max) { this.add(path, 'CONTRADICTION', 'min exceeds max'); return null; }
  return { min, max };
 }
 /** Text is normalized (whitespace/control characters) so identical visible text has identical identity. */
 text(v: unknown, path: string, max: number): string | null {
  if (typeof v !== 'string') { this.add(path, 'TYPE', 'Expected text'); return null; }
  const clean = v.replace(/\p{White_Space}+/gu, ' ').replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
  if (clean.length === 0 || clean.length > max) { this.add(path, 'TYPE', `Expected 1..${max} visible characters`); return null; }
  return clean;
 }
 label(v: unknown, path: string, custom: boolean): Label | null {
  const r = this.shape(v, path, [], ['key', 'text']); if (!r) return null;
  const text = r.text === undefined ? undefined : this.text(r.text, `${path}.text`, 200);
  const key = r.key === undefined ? undefined : this.str(r.key, `${path}.key`, 80, /^[A-Za-z0-9_.-]+$/);
  if (custom && key !== undefined) { this.add(`${path}.key`, 'UNSUPPORTED', 'Custom missions carry text, not translation keys'); return null; }
  if (text === undefined && key === undefined) { this.add(path, 'EMPTY_REQUIRED', 'A label needs text'); return null; }
  if (text === null || key === null) return null;
  return { ...(key === undefined ? {} : { key }), ...(text === undefined ? {} : { text }) };
 }
}

function checkDepth(v: unknown, depth: number): boolean {
 if (depth > MAX_DEPTH) return false;
 if (Array.isArray(v)) return v.length <= MAX_ARRAY && v.every(item => checkDepth(item, depth + 1));
 if (typeof v === 'object' && v !== null) return Object.values(v).every(item => checkDepth(item, depth + 1));
 return typeof v !== 'string' || v.length <= MAX_STRING;
}

function parseOrbit(c: Ctx, v: unknown, path: string, body: BodyId, epoch: string): OrbitChoice | null {
 const o = c.shape(v, path, ['body', 'epochUTC', 'frame', 'smaKm', 'ecc', 'inclinationDeg', 'raanDeg', 'argPeriapsisDeg', 'trueAnomalyDeg']); if (!o) return null;
 const ob = c.member(o.body, `${path}.body`, ['EARTH', 'MARS', 'SUN']), frame = o.frame === 'MJ2000Eq' ? 'MJ2000Eq' as const : null;
 if (!frame) c.add(`${path}.frame`, 'UNSUPPORTED', 'Only MJ2000Eq is supported');
 const sma = c.num(o.smaKm, `${path}.smaKm`, 1, 1e9, 'km'), ecc = c.num(o.ecc, `${path}.ecc`, 0, 0.999999999), inc = c.num(o.inclinationDeg, `${path}.inclinationDeg`, 0, 180, 'deg'), raan = c.num(o.raanDeg, `${path}.raanDeg`, 0, 360, 'deg'), argp = c.num(o.argPeriapsisDeg, `${path}.argPeriapsisDeg`, 0, 360, 'deg'), ta = c.num(o.trueAnomalyDeg, `${path}.trueAnomalyDeg`, 0, 360, 'deg');
 if (typeof o.epochUTC !== 'string' || o.epochUTC !== epoch) c.add(`${path}.epochUTC`, 'CONTRADICTION', 'Orbit epoch must equal the mission epoch');
 if (ob !== null && ob !== body) c.add(`${path}.body`, 'CONTRADICTION', 'Orbit body must equal the start body');
 if (!frame || ob === null || sma === null || ecc === null || inc === null || raan === null || argp === null || ta === null || ob !== body || o.epochUTC !== epoch) return null;
 if (sma * (1 - ecc) <= CONSTANTS[ob].radius.v) { c.add(path, 'RANGE', 'Periapsis must be above the surface'); return null; }
 if (ob === 'SUN' && sma * (1 - ecc) < MIN_PERIHELION_KM) { c.add(path, 'RANGE', 'Perihelion must stay at or beyond 0.25 AU'); return null; }
 return { body: ob, epochUTC: epoch, frame, smaKm: sma, ecc, inclinationDeg: inc, raanDeg: raan, argPeriapsisDeg: argp, trueAnomalyDeg: ta };
}

function instrumentMetrics(bus: BusId, partIds: readonly string[]): ReadonlySet<string> {
 const found = new Set<string>();
 for (const id of partIds) { const p = PART_BY_ID[id]; if (p && p.busId === bus && p.category === 'INSTRUMENT') { found.add('ANY_SCIENCE'); if (p.metric) found.add(p.metric); } }
 return found;
}

function parseObjective(c: Ctx, v: unknown, path: string, d: { custom: boolean; duration: number; crew: boolean; bodies: readonly string[]; patched: boolean; bus: BusId; required: readonly string[]; ids: ReadonlyMap<string, string> }): ObjectiveDef | null {
 const o = c.shape(v, path, ['id', 'label', 'required', 'owner', 'deadlineSec', 'dwellSec', 'spec']); if (!o) return null;
 const id = c.str(o.id, `${path}.id`, 32, ID), label = c.label(o.label, `${path}.label`, d.custom), required = c.bool(o.required, `${path}.required`), owner = c.member(o.owner, `${path}.owner`, ROLES);
 const deadline = o.deadlineSec === null ? null : c.num(o.deadlineSec, `${path}.deadlineSec`, 1, d.duration, 's'), dwell = c.num(o.dwellSec, `${path}.dwellSec`, 0, d.duration, 's');
 const s = isRec(o.spec) ? o.spec : null; if (!s) { c.add(`${path}.spec`, 'TYPE', 'Expected an object'); return null; }
 const sp = `${path}.spec`;
 let spec: ObjectiveSpec | null = null;
 const needsPatched = (): boolean => { if (!d.patched) c.add(sp, 'PHASE_INCOMPATIBLE', 'This evaluator needs the patched-conic trajectory model'); return d.patched; };
 switch (s.kind) {
  case 'DELIVERED_PRODUCT': {
   const r = c.shape(s, sp, ['kind', 'metric', 'targetMB']); const metric = r ? c.member(r.metric, `${sp}.metric`, METRICS) : null, target = r ? c.num(r.targetMB, `${sp}.targetMB`, 1e-3, 1e7, 'MB') : null;
   if (metric && target !== null) { if (!instrumentMetrics(d.bus, d.required).has(metric)) c.add(sp, 'PHASE_INCOMPATIBLE', `No required instrument on this bus produces ${metric}`); else spec = { kind: 'DELIVERED_PRODUCT', metric, targetMB: target }; }
   break;
  }
  case 'INSTRUMENT_HOURS': {
   const r = c.shape(s, sp, ['kind', 'metric', 'targetHours', 'windowStartSec', 'windowEndSec']);
   const hours = r ? c.num(r.targetHours, `${sp}.targetHours`, 1e-3, 1e4, 'h') : null, a = r ? c.num(r.windowStartSec, `${sp}.windowStartSec`, 0, d.duration, 's') : null, b = r ? c.num(r.windowEndSec, `${sp}.windowEndSec`, 0, d.duration, 's') : null;
   if (r && r.metric !== 'RADIATION_HOURS') c.add(`${sp}.metric`, 'UNSUPPORTED', 'Only RADIATION_HOURS has an evidence producer');
   else if (r && hours !== null && a !== null && b !== null) {
    if (a >= b) c.add(sp, 'CONTRADICTION', 'Window start must precede its end'); else if (hours * 3600 > b - a + 1e-6) c.add(sp, 'CONTRADICTION', 'Target hours exceed the window'); else if (!instrumentMetrics(d.bus, d.required).has('RADIATION_HOURS')) c.add(sp, 'PHASE_INCOMPATIBLE', 'No required radiation instrument'); else spec = { kind: 'INSTRUMENT_HOURS', metric: 'RADIATION_HOURS', targetHours: hours, windowStartSec: a, windowEndSec: b };
   }
   break;
  }
  case 'APOGEE_BAND': {
   const r = needsPatched() ? c.shape(s, sp, ['kind', 'minAltKm', 'maxAltKm']) : null, lo = r ? c.num(r.minAltKm, `${sp}.minAltKm`, 1, 1e6, 'km') : null, hi = r ? c.num(r.maxAltKm, `${sp}.maxAltKm`, 1, 1e6, 'km') : null;
   if (lo !== null && hi !== null) { if (lo > hi) c.add(sp, 'CONTRADICTION', 'min exceeds max'); else spec = { kind: 'APOGEE_BAND', minAltKm: lo, maxAltKm: hi }; }
   break;
  }
  case 'RETURN_BOUNDARY': {
   const r = needsPatched() ? c.shape(s, sp, ['kind', 'altitudeKm', 'afterObjectiveId']) : null, alt = r ? c.num(r.altitudeKm, `${sp}.altitudeKm`, 0, 1000, 'km') : null, after = r ? c.str(r.afterObjectiveId, `${sp}.afterObjectiveId`, 32, ID) : null;
   if (alt !== null && after !== null) { if (d.ids.get(after) !== 'APOGEE_BAND') c.add(`${sp}.afterObjectiveId`, 'UNKNOWN_REF', 'Must name an earlier APOGEE_BAND objective'); else spec = { kind: 'RETURN_BOUNDARY', altitudeKm: alt, afterObjectiveId: after }; }
   break;
  }
  case 'BOUND_ORBIT': {
   const r = needsPatched() ? c.shape(s, sp, ['kind', 'body', 'periapsisAltKm', 'apoapsisAltKm', 'minSafePeriapsisAltKm'], ['inclinationDeg']) : null;
   const body = r ? c.member(r.body, `${sp}.body`, ['EARTH', 'MOON'] as const) : null, peri = r ? c.range(r.periapsisAltKm, `${sp}.periapsisAltKm`, 0, 1e6) : null, apo = r ? c.range(r.apoapsisAltKm, `${sp}.apoapsisAltKm`, 0, 1e6) : null, safe = r ? c.num(r.minSafePeriapsisAltKm, `${sp}.minSafePeriapsisAltKm`, 0, 1e6, 'km') : null;
   const inc = r && r.inclinationDeg !== undefined ? c.range(r.inclinationDeg, `${sp}.inclinationDeg`, 0, 180) : undefined;
   if (body && !d.bodies.includes(body)) c.add(`${sp}.body`, 'PHASE_INCOMPATIBLE', 'Body is not modelled by this mission');
   else if (body && peri && apo && safe !== null && inc !== null) {
    if (peri.min < safe) c.add(sp, 'CONTRADICTION', 'Periapsis band dips below the safe periapsis'); else if (apo.max < peri.min) c.add(sp, 'CONTRADICTION', 'Apoapsis band lies below the periapsis band'); else spec = { kind: 'BOUND_ORBIT', body, periapsisAltKm: peri, apoapsisAltKm: apo, minSafePeriapsisAltKm: safe, ...(inc ? { inclinationDeg: inc } : {}) };
   }
   break;
  }
  case 'ESCAPE': {
   const r = needsPatched() ? c.shape(s, sp, ['kind', 'body', 'minPeriapsisAltKm', 'minExcessSpeedKms']) : null, peri = r ? c.num(r.minPeriapsisAltKm, `${sp}.minPeriapsisAltKm`, 0, 1e5, 'km') : null, vinf = r ? c.num(r.minExcessSpeedKms, `${sp}.minExcessSpeedKms`, 0, 20, 'km/s') : null;
   if (r && r.body !== 'EARTH') c.add(`${sp}.body`, 'UNSUPPORTED', 'Escape is evaluated about Earth'); else if (peri !== null && vinf !== null) spec = { kind: 'ESCAPE', body: 'EARTH', minPeriapsisAltKm: peri, minExcessSpeedKms: vinf };
   break;
  }
  case 'ENTRY_INTERFACE': {
   const r = needsPatched() ? c.shape(s, sp, ['kind', 'body', 'altitudeKm']) : null, alt = r ? c.num(r.altitudeKm, `${sp}.altitudeKm`, 0, 400, 'km') : null;
   if (r && r.body !== 'EARTH') c.add(`${sp}.body`, 'UNSUPPORTED', 'Entry interface is evaluated about Earth'); else if (alt !== null) spec = { kind: 'ENTRY_INTERFACE', body: 'EARTH', altitudeKm: alt };
   break;
  }
  case 'ENCOUNTER_DISTANCE': {
   const r = needsPatched() ? c.shape(s, sp, ['kind', 'body', 'minDistanceKm', 'maxDistanceKm']) : null, lo = r ? c.num(r.minDistanceKm, `${sp}.minDistanceKm`, CONSTANTS.MOON.radius.v, 1e6, 'km') : null, hi = r ? c.num(r.maxDistanceKm, `${sp}.maxDistanceKm`, CONSTANTS.MOON.radius.v, 1e6, 'km') : null;
   if (r && r.body !== 'MOON') c.add(`${sp}.body`, 'UNSUPPORTED', 'Encounters are evaluated about the Moon'); else if (!d.bodies.includes('MOON')) c.add(sp, 'PHASE_INCOMPATIBLE', 'The Moon is not modelled by this mission'); else if (lo !== null && hi !== null) { if (lo > hi) c.add(sp, 'CONTRADICTION', 'min exceeds max'); else spec = { kind: 'ENCOUNTER_DISTANCE', body: 'MOON', minDistanceKm: lo, maxDistanceKm: hi }; }
   break;
  }
  case 'PROPELLANT_RESERVE': {
   const r = c.shape(s, sp, ['kind', 'inventory', 'minKg']), kg = r ? c.num(r.minKg, `${sp}.minKg`, 0, 1e5, 'kg') : null;
   if (r && r.inventory !== 'SPACECRAFT') c.add(`${sp}.inventory`, 'UNSUPPORTED', 'Only the spacecraft inventory is evaluated'); else if (kg !== null) spec = { kind: 'PROPELLANT_RESERVE', inventory: 'SPACECRAFT', minKg: kg };
   break;
  }
  case 'CREW_SUPPORT_THROUGH_RECOVERY': if (c.shape(s, sp, ['kind'])) { if (!d.crew) c.add(sp, 'PHASE_INCOMPATIBLE', 'Requires crew support'); else spec = { kind: 'CREW_SUPPORT_THROUGH_RECOVERY' }; } break;
  case 'CREW_ORBIT_HOURS': {
   const r = c.shape(s, sp, ['kind', 'hours']), hours = r ? c.num(r.hours, `${sp}.hours`, 1e-3, 1e4, 'h') : null;
   if (hours !== null) { if (!d.crew) c.add(sp, 'PHASE_INCOMPATIBLE', 'Requires crew support'); else spec = { kind: 'CREW_ORBIT_HOURS', hours }; }
   break;
  }
  default: c.add(`${sp}.kind`, 'UNSUPPORTED', 'Unknown evaluator'); return null;
 }
 if (id === null || label === null || required === null || owner === null || dwell === null || (o.deadlineSec !== null && deadline === null) || spec === null) return null;
 return { id, label, required, owner, deadlineSec: deadline, dwellSec: dwell, spec };
}

function parseTrajectory(c: Ctx, v: unknown, path: string, startBody: BodyId | null): TrajectorySpec | null {
 if (!isRec(v)) { c.add(path, 'TYPE', 'Expected an object'); return null; }
 if (v.model === 'MARS_ANALYTIC_CRUISE') { if (!c.shape(v, path, ['model'])) return null; if (startBody !== 'MARS') { c.add(path, 'CONTRADICTION', 'The analytic cruise needs a Mars start'); return null; } return { model: 'MARS_ANALYTIC_CRUISE' }; }
 if (v.model === 'HELIOCENTRIC_CONIC') { if (!c.shape(v, path, ['model'])) return null; if (startBody !== 'SUN') { c.add(path, 'CONTRADICTION', 'The heliocentric conic needs a Sun start'); return null; } return { model: 'HELIOCENTRIC_CONIC' }; }
 if (v.model !== 'PATCHED_CONICS') { c.add(`${path}.model`, 'UNSUPPORTED', 'Unknown trajectory model'); return null; }
 const r = c.shape(v, path, ['model', 'bodies', 'maneuvers']); if (!r) return null;
 const list = c.arr(r.bodies, `${path}.bodies`, 1, 2), m = c.shape(r.maneuvers, `${path}.maneuvers`, ['allowed', 'maxBurns']);
 const bodies: ('EARTH' | 'MOON')[] = [];
 for (const [i, b] of (list ?? []).entries()) { const body = c.member(b, `${path}.bodies[${i}]`, ['EARTH', 'MOON'] as const); if (body && !bodies.includes(body)) bodies.push(body); }
 const allowed = m ? c.bool(m.allowed, `${path}.maneuvers.allowed`) : null, burns = m ? c.int(m.maxBurns, `${path}.maneuvers.maxBurns`, 0, 16) : null;
 if (!bodies.includes('EARTH')) c.add(`${path}.bodies`, 'CONTRADICTION', 'Earth is always modelled (the Moon is a patch of it)');
 if (startBody === 'MARS') c.add(path, 'CONTRADICTION', 'A Mars start needs the analytic cruise model');
 if (startBody === 'SUN') c.add(path, 'CONTRADICTION', 'A Sun start needs the heliocentric conic model');
 if (allowed === false && burns !== null && burns > 0) c.add(`${path}.maneuvers.maxBurns`, 'CONTRADICTION', 'Burns are disallowed');
 if (allowed === true && burns === 0) c.add(`${path}.maneuvers.maxBurns`, 'CONTRADICTION', 'Burns are allowed but the limit is zero');
 if (!bodies.includes('EARTH') || allowed === null || burns === null || startBody === 'MARS' || startBody === 'SUN' || (allowed === false && burns > 0) || (allowed && burns === 0)) return null;
 return { model: 'PATCHED_CONICS', bodies: bodies.sort(), maneuvers: { allowed, maxBurns: burns } };
}

export function validateMissionDefinition(raw: unknown): DefinitionResult {
 const c = new Ctx();
 try {
  if (!checkDepth(raw, 0)) return { ok: false, issues: [{ path: '$', code: 'DEPTH', message: 'Definition exceeds depth, array or string bounds' }] };
  if (new TextEncoder().encode(canonicalJson(raw)).length > MAX_DEFINITION_BYTES) return { ok: false, issues: [{ path: '$', code: 'SIZE', message: `Definition exceeds ${MAX_DEFINITION_BYTES} bytes` }] };
 } catch { return { ok: false, issues: [{ path: '$', code: 'TYPE', message: 'Definition is not plain finite JSON' }] }; }
 if (!isRec(raw)) return { ok: false, issues: [{ path: '$', code: 'TYPE', message: 'Expected an object' }] };
 if (raw.schema !== DEFINITION_SCHEMA_VERSION) return { ok: false, issues: [{ path: 'schema', code: 'SCHEMA_VERSION', message: `Unsupported schema ${String(raw.schema)}` }] };
 // Built-in identities are reserved: the exact built-in content is accepted, anything else claiming one is not.
 if (raw.origin === 'BUILTIN' || raw.origin === 'LEARNING') {
  const builtin = typeof raw.id === 'string' && Object.hasOwn(BUILTIN_BY_ID, raw.id) ? BUILTIN_BY_ID[raw.id as keyof typeof BUILTIN_BY_ID] : undefined;
  return builtin && builtin.origin === raw.origin && digestOf(raw) === builtin.digest ? { ok: true, definition: builtin } : { ok: false, issues: [{ path: 'origin', code: 'CONTRADICTION', message: 'Built-in content cannot be redefined; copy it as a custom mission' }] };
 }
 const top = c.shape(raw, '$', ['schema', 'id', 'revision', 'origin', 'derivedFrom', 'name', 'description', 'objectiveSummary', 'vehicle', 'environment', 'start', 'trajectory', 'support', 'objectives', 'termination'], ['author', 'notes', 'digest', 'learning']);
 if (!top) return { ok: false, issues: c.issues };
 if (top.origin !== 'CUSTOM') c.add('origin', 'UNSUPPORTED', 'Only CUSTOM definitions can be authored');
 if (top.learning !== undefined) c.add('learning', 'UNSUPPORTED', 'Learning profiles are authored built-in content');
 const id = c.str(top.id, 'id', 48, MISSION_ID), revision = c.int(top.revision, 'revision', 1, 1e6);
 if (id !== null && Object.hasOwn(BUILTIN_BY_ID, id.toUpperCase())) c.add('id', 'CONTRADICTION', 'Identity is reserved by a built-in mission');
 let derivedFrom: MissionDefinition['derivedFrom'] = null;
 if (top.derivedFrom !== null) { const r = c.shape(top.derivedFrom, 'derivedFrom', ['id', 'digest']); const did = r ? c.str(r.id, 'derivedFrom.id', 48) : null, dd = r ? c.str(r.digest, 'derivedFrom.digest', 71, /^sha256:[0-9a-f]{64}$/) : null; if (did && dd) derivedFrom = { id: did, digest: dd as `sha256:${string}` }; }
 const name = c.label(top.name, 'name', true), description = c.label(top.description, 'description', true), summary = c.label(top.objectiveSummary, 'objectiveSummary', true);
 const author = top.author === undefined ? undefined : c.text(top.author, 'author', 40), notes = top.notes === undefined ? undefined : c.text(top.notes, 'notes', 600);

 const env = c.shape(top.environment, 'environment', ['epochUTC', 'seed', 'durationSec', 'stationId', 'stationAllocationStartSec', 'storm', 'scheduledFaults', 'commLightTime']);
 const epoch = env ? c.str(env.epochUTC, 'environment.epochUTC', 24, UTC) : null;
 if (epoch && (!Number.isFinite(Date.parse(epoch)) || new Date(epoch).toISOString()!==(epoch.includes('.')?epoch:epoch.replace(/Z$/,'.000Z')) || Date.parse(epoch) < Date.parse('2000-01-01T00:00:00Z') || Date.parse(epoch) > Date.parse('2100-01-01T00:00:00Z'))) c.add('environment.epochUTC', 'RANGE', 'Epoch must be a real UTC time in 2000..2100');
 const duration = env ? c.num(env.durationSec, 'environment.durationSec', 60, MAX_DURATION_SEC, 's') : null, seed = env ? c.int(env.seed, 'environment.seed', 0, 4294967295) : null;
 const stationId = env ? c.member(env.stationId, 'environment.stationId', ['GS_MIDLAT', 'DSN', 'CREW_RELAY'] as const) : null, allocation = env ? c.num(env.stationAllocationStartSec, 'environment.stationAllocationStartSec', 0, 86400, 's') : null;
 const faults = env ? c.bool(env.scheduledFaults, 'environment.scheduledFaults') : null, light = env ? c.bool(env.commLightTime, 'environment.commLightTime') : null;
 let storm: MissionDefinition['environment']['storm'] = null;
 if (env && env.storm !== null) {
  const r = c.shape(env.storm, 'environment.storm', ['startSec', 'endSec', 'dose']), a = r ? c.num(r.startSec, 'environment.storm.startSec', 0, MAX_DURATION_SEC) : null, b = r ? c.num(r.endSec, 'environment.storm.endSec', 0, MAX_DURATION_SEC) : null, dose = r ? c.member(r.dose, 'environment.storm.dose', ['RADLAB_HOURLY', 'MARS_ASSUMED'] as const) : null;
  if (a !== null && b !== null && dose) { if (a >= b || (duration !== null && b > duration)) c.add('environment.storm', 'CONTRADICTION', 'Storm window must be ordered and inside the mission'); else storm = { startSec: a, endSec: b, dose }; }
 }

 const vehicle = c.shape(top.vehicle, 'vehicle', ['busId', 'budget', 'requiredPartIds', 'minRecordingMB', 'minLinkKbps', 'allowedRideIds']);
 const bus = vehicle ? c.member(vehicle.busId, 'vehicle.busId', BUSES) : null, budget = vehicle ? c.num(vehicle.budget, 'vehicle.budget', 1, 1e6) : null;
 const requiredList = vehicle ? c.arr(vehicle.requiredPartIds, 'vehicle.requiredPartIds', 0, 12) : null, ridesList = vehicle ? c.arr(vehicle.allowedRideIds, 'vehicle.allowedRideIds', 0, 8) : null;
 const requiredParts: string[] = [], rideIds: string[] = [];
 for (const [i, p] of (requiredList ?? []).entries()) { const part = typeof p === 'string' ? PART_BY_ID[p] : undefined; if (!part || (bus && part.busId !== bus)) c.add(`vehicle.requiredPartIds[${i}]`, 'UNKNOWN_REF', 'Unknown part for this bus'); else if (!requiredParts.includes(part.id)) requiredParts.push(part.id); }
 for (const [i, r] of (ridesList ?? []).entries()) { const ride = typeof r === 'string' ? RIDES.find(x => x.id === r) : undefined; if (!ride || (bus && !ride.busIds.includes(bus))) c.add(`vehicle.allowedRideIds[${i}]`, 'UNKNOWN_REF', 'Unknown ride for this bus'); else if (!rideIds.includes(ride.id)) rideIds.push(ride.id); }
 const recording = vehicle ? c.num(vehicle.minRecordingMB, 'vehicle.minRecordingMB', 0, 1e7, 'MB') : null, link = vehicle ? c.num(vehicle.minLinkKbps, 'vehicle.minLinkKbps', 0, 1e6, 'kbps') : null;

 let start: MissionDefinition['start'] | null = null;
 const startRaw = isRec(top.start) ? top.start : null;
 if (!startRaw) c.add('start', 'TYPE', 'Expected an object');
 else if (startRaw.kind === 'PROVIDED_ORBIT') {
  const r = c.shape(startRaw, 'start', ['kind', 'body', 'orbit', 'orbitOptions'], ['stage','initialPhase']), body = r ? c.member(r.body, 'start.body', ['EARTH', 'MARS', 'SUN'] as const) : null;
  if (r && r.orbitOptions !== 'RIDE') c.add('start.orbitOptions', 'UNSUPPORTED', 'Only ride-offered parking orbits are supported');
  const initialPhase=r?.initialPhase===undefined?undefined:c.member(r.initialPhase,'start.initialPhase',['OPERATIONS'] as const);
  const orbit = r && body && epoch ? parseOrbit(c, r.orbit, 'start.orbit', body, epoch) : null;
  let stage: { launcherId: string; propellantKg: number } | undefined;
  if (r && r.stage !== undefined) {
   const sr = c.shape(r.stage, 'start.stage', ['launcherId', 'propellantKg']), lid = sr ? c.str(sr.launcherId, 'start.stage.launcherId', 40) : null, launcher = lid ? LAUNCHER_BY_ID[lid] : undefined;
   if (lid && !launcher) c.add('start.stage.launcherId', 'UNKNOWN_REF', 'Unknown launcher');
   const top2 = launcher ? launcher.stages[launcher.stages.length - 1] : null, kg = sr && top2 ? c.num(sr.propellantKg, 'start.stage.propellantKg', 0, top2.propellantKg, 'kg') : null;
   if (lid && launcher && top2 && kg !== null) { if (launcher.stages.length < 2 || top2.restarts === 0) c.add('start.stage', 'UNSUPPORTED', 'The launcher has no restartable upper stage'); else stage = { launcherId: lid, propellantKg: kg }; }
   if (body === 'MARS' || body === 'SUN') c.add('start.stage', 'PHASE_INCOMPATIBLE', 'An attached upper stage is an Earth-orbit start');
  }
  if (body && orbit && bus) {
   if (rideIds.length === 0) c.add('vehicle.allowedRideIds', 'EMPTY_REQUIRED', 'A provided-orbit mission needs at least one ride');
   else if (!rideIds.some(rid => rideOffersOrbit(rid, bus, body, orbit))) c.add('start.orbit', 'CONTRADICTION', 'No allowed ride offers this orbit');
  }
  if (body && orbit && initialPhase!==null && !(r && r.stage !== undefined && !stage)) start = { kind: 'PROVIDED_ORBIT', body, orbit, orbitOptions: 'RIDE', ...(initialPhase?{initialPhase}:{}), ...(stage ? { stage } : {}) };
 } else if (startRaw.kind === 'SURFACE_LAUNCH') {
  const r = c.shape(startRaw, 'start', ['kind', 'site', 'launcherIds']), site = r ? c.shape(r.site, 'start.site', ['name', 'latDeg', 'lonDeg']) : null;
  const sn = site ? c.label(site.name, 'start.site.name', true) : null, lat = site ? c.num(site.latDeg, 'start.site.latDeg', -80, 80, 'deg') : null, lon = site ? c.num(site.lonDeg, 'start.site.lonDeg', -180, 180, 'deg') : null;
  const lids = r ? c.arr(r.launcherIds, 'start.launcherIds', 1, 3) : null, launcherIds: string[] = [];
  for (const [i, l] of (lids ?? []).entries()) { if (typeof l === 'string' && LAUNCHER_BY_ID[l]) { if (!launcherIds.includes(l)) launcherIds.push(l); } else c.add(`start.launcherIds[${i}]`, 'UNKNOWN_REF', 'Unknown launcher'); }
  if (rideIds.length) c.add('vehicle.allowedRideIds', 'CONTRADICTION', 'A surface launch uses launchers, not rides');
  if (sn && lat !== null && lon !== null && launcherIds.length) start = { kind: 'SURFACE_LAUNCH', site: { name: sn, latDeg: lat, lonDeg: lon }, launcherIds };
 } else c.add('start.kind', 'UNSUPPORTED', 'Unknown start');
 const trajectory = parseTrajectory(c, top.trajectory, 'trajectory', start && start.kind === 'PROVIDED_ORBIT' ? start.body : start ? 'EARTH' : null);
 if (start?.kind === 'SURFACE_LAUNCH' && trajectory?.model !== 'PATCHED_CONICS' && trajectory) c.add('trajectory', 'CONTRADICTION', 'A surface launch needs the patched-conic model');
 if (storm && start?.kind === 'PROVIDED_ORBIT' && start.body === 'SUN') c.add('environment.storm', 'UNSUPPORTED', 'Sun-centred missions have no storm dose replay; their dose is an assumed background');

 const sup = c.shape(top.support, 'support', ['crew']), crew = sup ? c.bool(sup.crew, 'support.crew') : null;
 if (crew !== null && bus && (crew !== (bus === 'CREW_CAPSULE'))) c.add('support.crew', 'CONTRADICTION', 'Crew support belongs to the crew capsule bus, and the capsule needs it');
 if (crew && start && start.kind !== 'PROVIDED_ORBIT') c.add('support.crew', 'PHASE_INCOMPATIBLE', 'Crew missions start from a provided orbit');
 if (stationId && start) {
  const expected = crew ? 'CREW_RELAY' : start.kind === 'PROVIDED_ORBIT' && (start.body === 'MARS' || start.body === 'SUN') ? 'DSN' : 'GS_MIDLAT';
  if (stationId !== expected) c.add('environment.stationId', 'CONTRADICTION', `This mission requires station ${expected}`);
 }
 if (light === false && trajectory?.model === 'PATCHED_CONICS' && trajectory.bodies.includes('MOON')) c.add('environment.commLightTime', 'CONTRADICTION', 'Lunar missions use geometric light time');
 if (light === true && trajectory?.model !== 'PATCHED_CONICS') c.add('environment.commLightTime', 'UNSUPPORTED', 'Mars and Sun-centred missions always use planetary light time');

 const objectives: ObjectiveDef[] = [], list = c.arr(top.objectives, 'objectives', 1, 12), ids = new Map<string, string>();
 if (list && duration !== null && bus && crew !== null && trajectory) {
  for (const [i, item] of list.entries()) {
   const parsed = parseObjective(c, item, `objectives[${i}]`, { custom: true, duration, crew, bodies: trajectory.model === 'PATCHED_CONICS' ? trajectory.bodies : trajectory.model === 'HELIOCENTRIC_CONIC' ? ['SUN'] : ['MARS'], patched: trajectory.model === 'PATCHED_CONICS', bus, required: requiredParts, ids });
   if (parsed) { if (ids.has(parsed.id)) c.add(`objectives[${i}].id`, 'CONTRADICTION', 'Duplicate objective id'); else { ids.set(parsed.id, parsed.spec.kind); objectives.push(parsed); } }
  }
  if (objectives.length === list.length && !objectives.some(o => o.required)) c.add('objectives', 'EMPTY_REQUIRED', 'At least one objective must be required');
  // Each of these kinds reads one qualifying-observation pool; a second goal of the same kind would double count it.
  for (const kind of ['DELIVERED_PRODUCT', 'INSTRUMENT_HOURS'] as const) if (objectives.filter(o => o.spec.kind === kind).length > 1) c.add('objectives', 'CONTRADICTION', `At most one ${kind} objective is supported per mission`);
 }
 const term = c.shape(top.termination, 'termination', ['endOnSuccess', 'failOn']), endOnSuccess = term ? c.bool(term.endOnSuccess, 'termination.endOnSuccess') : null, failList = term ? c.arr(term.failOn, 'termination.failOn', 0, FAILURES.length) : null;
 const failOn: FailureCause[] = [];
 for (const [i, f] of (failList ?? []).entries()) { const cause = c.member(f, `termination.failOn[${i}]`, FAILURES); if (cause && !failOn.includes(cause)) failOn.push(cause); }
 if (failOn.includes('CAPTURE_FAILED') && trajectory?.model !== 'MARS_ANALYTIC_CRUISE') c.add('termination.failOn', 'PHASE_INCOMPATIBLE', 'CAPTURE_FAILED applies to the analytic Mars capture');
 if (failOn.includes('CREW_SUPPORT_LOST') && crew === false) c.add('termination.failOn', 'PHASE_INCOMPATIBLE', 'CREW_SUPPORT_LOST needs crew support');
 if ((failOn.includes('ASCENT_FAILED')) && start && start.kind !== 'SURFACE_LAUNCH') c.add('termination.failOn', 'PHASE_INCOMPATIBLE', 'ASCENT_FAILED needs a surface launch');

 if (c.issues.length || !id || revision === null || !name || !description || !summary || !env || epoch === null || duration === null || seed === null || stationId === null || allocation === null || faults === null || light === null || !vehicle || !bus || budget === null || recording === null || link === null || !start || !trajectory || crew === null || endOnSuccess === null || objectives.length !== (list?.length ?? -1) || author === null || notes === null) return { ok: false, issues: c.issues.length ? c.issues : [{ path: '$', code: 'TYPE', message: 'Definition is incomplete' }] };
 const definition: MissionDefinition = {
  schema: 1, id, revision, origin: 'CUSTOM', derivedFrom, ...(author ? { author } : {}), name, description, objectiveSummary: summary, ...(notes ? { notes } : {}),
  vehicle: { busId: bus, budget, requiredPartIds: requiredParts, minRecordingMB: recording, minLinkKbps: link, allowedRideIds: rideIds },
  environment: { epochUTC: epoch, seed, durationSec: duration, stationId, stationAllocationStartSec: allocation, storm, scheduledFaults: faults, commLightTime: light },
  start, trajectory, support: { crew }, objectives, termination: { endOnSuccess, failOn },
 };
 return { ok: true, definition: deepFreeze({ ...definition, digest: digestOf(definition) }) };
}
