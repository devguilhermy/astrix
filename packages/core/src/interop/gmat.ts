import type { BodyId, OrbitChoice } from '../contracts';
import { CONSTANTS, type Vec3 } from '../physics';

export const MAX_TEXT_BYTES = 10 * 1024 * 1024;
export const MAX_SAMPLES = 100_000;
export const MAX_SEGMENTS = 256;
/** Display interpolation is refused across intervals longer than 120 seconds. */
export const MAX_INTERPOLATION_GAP_MS = 120_000;
export interface TrajectorySample { time: number; positionKm: Vec3; velocityKmSec?: Vec3 }
export interface TrajectorySegment { start: number; stop: number; samples: TrajectorySample[] }
export interface Trajectory { version: 1; source: 'CCSDS OEM 2.0' | 'GMAT ReportFile'; object: string; objectId?: string; body: BodyId; frame: 'EME2000'; timeSystem: 'UTC'; units: 'km, km/s'; segments: TrajectorySegment[] }

function linesOf(text: string): string[] {
 if (text.length > MAX_TEXT_BYTES) throw new Error('Input exceeds 10 MiB');
 const bytes = new TextEncoder().encode(text);
 if (bytes.byteLength > MAX_TEXT_BYTES) throw new Error('Input exceeds 10 MiB');
 let start = 0;
 for (let i = 0; i < bytes.length; i++) if (bytes[i] === 10) {
  const length = i - start - (i > start && bytes[i - 1] === 13 ? 1 : 0);
  if (length > 16384) throw new Error('Line exceeds 16 KiB');
  start = i + 1;
 }
 if (bytes.length - start > 16384) throw new Error('Line exceeds 16 KiB');
 return text.split(/\r?\n/);
}
export function utcMillis(value: string): number {
 const v = value.trim().replace(/^'|'$/g, '');
 if (/:60(?:[.,Z\s]|$)/.test(v)) throw new Error('Leap-second timestamps are unsupported');
 const fraction = /\.(\d+)(?:Z)?$/.exec(v)?.[1];
 if (fraction && /[1-9]/.test(fraction.slice(3))) throw new Error('UTC timestamps finer than milliseconds are unsupported');
 let iso = v;
 const gregorian = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/i.exec(v);
 if (gregorian) {
  const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(gregorian[2].toLowerCase()) + 1;
  iso = `${gregorian[3]}-${String(month).padStart(2,'0')}-${gregorian[1].padStart(2,'0')}T${gregorian[4]}:${gregorian[5]}:${gregorian[6]}${gregorian[7] ?? ''}Z`;
 } else if (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z?$/.test(v)) iso = v.endsWith('Z') ? v : `${v}Z`;
 else throw new Error(`Unsupported UTC timestamp: ${v}`);
 const ms = Date.parse(iso);
 if (!Number.isFinite(ms)) throw new Error(`Invalid UTC timestamp: ${v}`);
 const inputDay = iso.slice(0,10);
 if (new Date(ms).toISOString().slice(0,10) !== inputDay) throw new Error(`Invalid UTC date: ${v}`);
 return ms;
}
function numeric(value: string): number {
 if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) throw new Error(`Expected finite literal: ${value}`);
 const n = Number(value); if (!Number.isFinite(n)) throw new Error('Nonfinite value'); return n;
}
function assign(target: Record<string,string>, key: string, value: string): void {
 if (key in target) throw new Error(`Duplicate metadata: ${key}`); target[key] = value.trim();
}
function bodyOf(value: string): BodyId {
 if (value.toUpperCase() === 'EARTH') return 'EARTH';
 if (value.toUpperCase() === 'MARS') return 'MARS';
 throw new Error(`Unsupported center: ${value}`);
}
function addSample(samples: TrajectorySample[], sample: TrajectorySample): void {
 if (samples.length && sample.time <= samples[samples.length - 1].time) throw new Error('Samples must be strictly increasing');
 samples.push(sample);
}
export function parseOem(text: string): Trajectory {
 const lines = linesOf(text), header: Record<string,string> = {}, segments: TrajectorySegment[] = [];
 let metadata: Record<string,string> | null = null, samples: TrajectorySample[] | null = null, object = '', objectId = '', body: BodyId | undefined, count = 0;
 function finish() {
  if (!metadata || !samples || !samples.length) throw new Error('Empty or incomplete OEM segment');
  const required = ['OBJECT_NAME','OBJECT_ID','CENTER_NAME','REF_FRAME','TIME_SYSTEM','START_TIME','STOP_TIME'];
  for (const key of required) if (!metadata[key]) throw new Error(`Missing ${key}`);
  const allowed = [...required,'INTERPOLATION','INTERPOLATION_DEGREE'];
  for (const key of Object.keys(metadata)) if (!allowed.includes(key)) throw new Error(`Unsupported OEM metadata: ${key}`);
  const center = bodyOf(metadata.CENTER_NAME);
  if (metadata.REF_FRAME !== 'EME2000' || metadata.TIME_SYSTEM !== 'UTC') throw new Error('Only EME2000 / UTC is supported');
  if ((object && object !== metadata.OBJECT_NAME) || (objectId && objectId !== metadata.OBJECT_ID) || (body && body !== center)) throw new Error('Inconsistent segment object or center');
  object = metadata.OBJECT_NAME; objectId = metadata.OBJECT_ID; body = center;
  const start = utcMillis(metadata.START_TIME), stop = utcMillis(metadata.STOP_TIME);
  if (start > stop || samples[0].time < start || samples[samples.length - 1].time > stop) throw new Error('Samples outside segment bounds');
  if (segments.length && start <= segments[segments.length - 1].stop) throw new Error('Overlapping or backward segments unsupported');
  segments.push({start, stop, samples}); if (segments.length > MAX_SEGMENTS) throw new Error('Too many segments');
  metadata = null; samples = null;
 }
 for (const raw of lines) {
  const line = raw.trim(); if (!line || line.startsWith('COMMENT')) continue;
  if (line === 'META_START') { if (metadata && samples) finish(); if (metadata) throw new Error('Nested metadata'); metadata = {}; continue; }
  if (line === 'META_STOP') { if (!metadata || samples) throw new Error('Unexpected META_STOP'); samples = []; continue; }
  const kv = /^([A-Z][A-Z0-9_]*)\s*=\s*(.+)$/.exec(line);
  if (kv && !samples) { assign(metadata ?? header, kv[1], kv[2]); continue; }
  if (!samples) throw new Error(`Unsupported OEM line: ${line}`);
  const fields = line.split(/\s+/); if (fields.length !== 7) throw new Error('OEM state requires timestamp and six values');
  const values = fields.slice(1).map(numeric);
  addSample(samples, { time: utcMillis(fields[0]), positionKm: values.slice(0,3) as Vec3, velocityKmSec: values.slice(3,6) as Vec3 });
  if (++count > MAX_SAMPLES) throw new Error('Too many samples');
 }
 if (metadata) finish();
 if (header.CCSDS_OEM_VERS !== '2.0' || !segments.length || !body) throw new Error('Expected nonempty CCSDS OEM version 2.0');
 return {version:1, source:'CCSDS OEM 2.0', object, objectId, body, frame:'EME2000', timeSystem:'UTC', units:'km, km/s', segments};
}
/** Profile: whitespace-delimited GMAT headers <object>.UTCGregorian and <object>.<Earth|Mars>MJ2000Eq.X/Y/Z[/VX/VY/VZ]. */
export function parseReport(text: string, object: string): Trajectory {
 const rows = linesOf(text).map(x => x.trim()).filter(Boolean); if (rows.length < 2) throw new Error('Report has no data');
 const headers = rows[0].split(/\s+/); if (!object || !/^[A-Za-z][A-Za-z0-9_]*$/.test(object)) throw new Error('Select one spacecraft');
 const date = headers.indexOf(`${object}.UTCGregorian`);
 const centers = (['Earth','Mars'] as const).filter(center => ['X','Y','Z'].every(axis => headers.includes(`${object}.${center}MJ2000Eq.${axis}`)));
 if (date < 0 || centers.length !== 1 || new Set(headers).size !== headers.length) throw new Error('Report requires unique UTCGregorian and inertial X/Y/Z headers for selected object');
 const center = centers[0], cols = ['X','Y','Z','VX','VY','VZ'].map(axis => headers.indexOf(`${object}.${center}MJ2000Eq.${axis}`));
 if (cols.slice(3).some(x => x >= 0) && cols.slice(3).some(x => x < 0)) throw new Error('Velocity columns must be complete');
 const samples: TrajectorySample[] = [];
 for (const row of rows.slice(1)) {
  const fields = row.match(/'[^']*'|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d\d:\d\d:\d\d(?:\.\d+)?|\S+/gi) ?? [];
  if (fields.length !== headers.length) throw new Error('Report row does not match header');
  const xyz = cols.slice(0,3).map(i => numeric(fields[i])) as Vec3;
  const velocity = cols[3] >= 0 ? cols.slice(3).map(i => numeric(fields[i])) as Vec3 : undefined;
  addSample(samples,{time:utcMillis(fields[date]),positionKm:xyz,...(velocity ? {velocityKmSec:velocity} : {})});
  if (samples.length > MAX_SAMPLES) throw new Error('Too many samples');
 }
 if (!samples.length) throw new Error('Report has no samples');
 return {version:1,source:'GMAT ReportFile',object,body:bodyOf(center),frame:'EME2000',timeSystem:'UTC',units:'km, km/s',segments:[{start:samples[0].time,stop:samples[samples.length-1].time,samples}]};
}
export function sampleTrajectory(trajectory: Trajectory, time: number, out: Vec3 = [0,0,0]): Vec3 | null {
 const segment = trajectory.segments.find(s => time >= s.start && time <= s.stop && time >= s.samples[0].time && time <= s.samples[s.samples.length - 1].time);
 if (!segment) return null;
 const samples = segment.samples; let lo = 0, hi = samples.length - 1;
 while (lo < hi) { const mid = (lo + hi) >>> 1; if (samples[mid].time < time) lo = mid + 1; else hi = mid; }
 if (samples[lo].time === time) { const p = samples[lo].positionKm; out[0] = p[0]; out[1] = p[1]; out[2] = p[2]; return out; }
 if (!lo) return null;
 const a = samples[lo-1], b = samples[lo];
 if (b.time - a.time > MAX_INTERPOLATION_GAP_MS) return null;
 const f = (time-a.time)/(b.time-a.time);
 out[0] = a.positionKm[0] + f * (b.positionKm[0]-a.positionKm[0]);
 out[1] = a.positionKm[1] + f * (b.positionKm[1]-a.positionKm[1]);
 out[2] = a.positionKm[2] + f * (b.positionKm[2]-a.positionKm[2]);
 return out;
}
export function parseInitialOrbit(text: string, selected: string): OrbitChoice {
 const assignments: Record<string,Record<string,string>> = {}, spacecraft = new Set<string>(), frames = new Set<string>();
 for (const raw of linesOf(text)) {
  const line = raw.replace(/%.*/, '').trim(); if (!line) continue;
  const create = /^Create\s+(Spacecraft|CoordinateSystem)\s+([A-Za-z][A-Za-z0-9_]*(?:\s+[A-Za-z][A-Za-z0-9_]*)*)\s*;$/.exec(line);
  if (create) { for (const name of create[2].split(/\s+/)) { const set = create[1] === 'Spacecraft' ? spacecraft : frames; if (set.has(name) || spacecraft.has(name) || frames.has(name)) throw new Error('Duplicate object'); set.add(name); } continue; }
  const a = /^(?:GMAT\s+)?([A-Za-z][A-Za-z0-9_]*)\.([A-Za-z][A-Za-z0-9_]*)\s*=\s*([^;]+);$/.exec(line);
  if (!a) throw new Error('Unsupported script statement; export OEM for complete trajectories');
  assign(assignments[a[1]] ??= {}, a[2], a[3]);
 }
 if (!spacecraft.has(selected)) throw new Error('Select a declared spacecraft');
 for (const [name, props] of Object.entries(assignments)) {
  if (!spacecraft.has(name) && !frames.has(name)) throw new Error(`Undeclared object ${name}`);
  const allowed = spacecraft.has(name) ? ['DateFormat','Epoch','CoordinateSystem','DisplayStateType','SMA','ECC','INC','RAAN','AOP','TA'] : ['Origin','Axes'];
  for (const key of Object.keys(props)) if (!allowed.includes(key)) throw new Error(`Unsupported property ${name}.${key}`);
 }
 const p = assignments[selected] ?? {};
 for (const key of ['DateFormat','Epoch','CoordinateSystem','DisplayStateType','SMA','ECC','INC','RAAN','AOP','TA']) if (!p[key]) throw new Error(`Missing ${selected}.${key}`);
 if (p.DateFormat !== 'UTCGregorian' || p.DisplayStateType !== 'Keplerian' || !/^'[^']+'$/.test(p.Epoch)) throw new Error('Only literal UTCGregorian Keplerian states are supported');
 let body: BodyId;
 if (p.CoordinateSystem === 'EarthMJ2000Eq' && !frames.has(p.CoordinateSystem)) body = 'EARTH';
 else { const f = assignments[p.CoordinateSystem]; if (!frames.has(p.CoordinateSystem) || !f || f.Axes !== 'MJ2000Eq' || !f.Origin) throw new Error('Unsupported or unresolved coordinate system'); body = bodyOf(f.Origin); }
 const smaKm = numeric(p.SMA), ecc = numeric(p.ECC), inclinationDeg = numeric(p.INC), raanDeg = numeric(p.RAAN), argPeriapsisDeg = numeric(p.AOP), trueAnomalyDeg = numeric(p.TA);
 if (smaKm <= 0 || ecc < 0 || ecc >= 1 || inclinationDeg < 0 || inclinationDeg > 180 || smaKm*(1-ecc) <= CONSTANTS[body].radius.v) throw new Error('Unsupported orbit or periapsis below surface');
 return {body,epochUTC:new Date(utcMillis(p.Epoch)).toISOString(),frame:'MJ2000Eq',smaKm,ecc,inclinationDeg,raanDeg,argPeriapsisDeg,trueAnomalyDeg};
}
export function exportInitialOrbit(o: OrbitChoice): string {
 const date = new Date(utcMillis(o.epochUTC));
 const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const epoch = `${String(date.getUTCDate()).padStart(2,'0')} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} ${date.toISOString().slice(11,23)}`;
 const frame = o.body === 'EARTH' ? 'EarthMJ2000Eq' : 'AstrixMarsFrame';
 return [`% ASTRIX initial conditions only; no force model or maneuver dynamics.`, ...(o.body === 'MARS' ? ['Create CoordinateSystem AstrixMarsFrame;', 'GMAT AstrixMarsFrame.Origin = Mars;', 'GMAT AstrixMarsFrame.Axes = MJ2000Eq;'] : []), 'Create Spacecraft Astrix;', 'GMAT Astrix.DateFormat = UTCGregorian;', `GMAT Astrix.Epoch = '${epoch}';`, `GMAT Astrix.CoordinateSystem = ${frame};`, 'GMAT Astrix.DisplayStateType = Keplerian;', ...Object.entries({SMA:o.smaKm,ECC:o.ecc,INC:o.inclinationDeg,RAAN:o.raanDeg,AOP:o.argPeriapsisDeg,TA:o.trueAnomalyDeg}).map(([k,v]) => `GMAT Astrix.${k} = ${v};`), ''].join('\n');
}
