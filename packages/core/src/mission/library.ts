// Built-in catalogue accessors, definition revision/export/import, and starter designs bound to a definition.
import type { Design, DesignPart } from '../contracts';
import { RULES_VERSION } from '../models';
import { BUILTIN_BY_ID, BUILTIN_DEFINITIONS } from './builtins';
import { canonicalJson, sha256Hex } from './digest';
import { validateMissionDefinition } from './validate';
import { MAX_DEFINITION_BYTES } from './types';
import type { AscentProgram, BuiltinMissionId, DefinitionResult, Label, MissionDefinition, MissionOrigin, ObjectiveDef, ResolvedMissionDefinition } from './types';

export const listMissions = (filter: { origin?: MissionOrigin } = {}): readonly ResolvedMissionDefinition[] => BUILTIN_DEFINITIONS.filter(d => !filter.origin || d.origin === filter.origin);
export function missionById(id: BuiltinMissionId): ResolvedMissionDefinition {
 const definition = BUILTIN_BY_ID[id];
 if (!definition) throw new RangeError(`Unknown built-in mission ${String(id)}; custom definitions travel with the session or design`);
 return definition;
}
export const definitionOf = (design: Pick<Design, 'definition'>): ResolvedMissionDefinition => design.definition;

export interface CopyText { readonly name: string; readonly description: string; readonly objectiveSummary: string; readonly objectiveLabels?: Readonly<Record<string, string>>; readonly notes?: string }
const textLabel = (text: string): Label => ({ text });
/** A custom, editable copy. Built-ins use translation keys, so the caller supplies the visible text. The result is a draft until validated. */
export function editAsCopy(source: ResolvedMissionDefinition, text: CopyText, options: { readonly id?: string } = {}): MissionDefinition {
 const slug = source.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'mission';
 // Independent copies must not overwrite each other: callers pass a unique id; the default is only unique per (source, text) pair.
 const id = options.id ?? `user.${slug}-${sha256Hex(canonicalJson({ d: source.digest, t: text })).slice(0, 8)}`;
 const objectives: ObjectiveDef[] = source.objectives.map(o => ({ ...o, label: textLabel(text.objectiveLabels?.[o.id] ?? o.label.text ?? o.id) }));
 const { learning: _learning, digest: _digest, ...rest } = source;
 // Learning presets can list a shared ascent failure; a custom copy keeps only failures possible from its start.
 const termination = {...source.termination,failOn:source.termination.failOn.filter(cause=>cause!=='ASCENT_FAILED'||source.start.kind==='SURFACE_LAUNCH')};
 return { ...rest, id, revision: 1, origin: 'CUSTOM', derivedFrom: { id: source.id, digest: source.digest }, name: textLabel(text.name), description: textLabel(text.description), objectiveSummary: textLabel(text.objectiveSummary), ...(text.notes ? { notes: text.notes } : {}), objectives, termination };
}
/** A published revision of an existing custom mission: same identity, strictly the next revision. */
export function reviseDefinition(previous: ResolvedMissionDefinition, next: unknown): DefinitionResult {
 const result = validateMissionDefinition(next);
 if (!result.ok) return result;
 if (previous.origin !== 'CUSTOM' || result.definition.origin !== 'CUSTOM' || result.definition.id !== previous.id) return { ok: false, issues: [{ path: 'id', code: 'CONTRADICTION', message: 'A revision keeps the identity of the mission it revises' }] };
 if (result.definition.revision !== previous.revision + 1) return { ok: false, issues: [{ path: 'revision', code: 'CONTRADICTION', message: `Expected revision ${previous.revision + 1}` }] };
 return result;
}
export function exportMissionDefinition(definition: ResolvedMissionDefinition): string { return canonicalJson({ format: 'astrix.mission', schema: 1, definition }); }
export function importMissionDefinition(text: string): DefinitionResult {
 if (new TextEncoder().encode(text).length > MAX_DEFINITION_BYTES + 256) return { ok: false, issues: [{ path: '$', code: 'SIZE', message: `File exceeds ${MAX_DEFINITION_BYTES} bytes` }] };
 let parsed: unknown;
 try { parsed = JSON.parse(text); } catch { return { ok: false, issues: [{ path: '$', code: 'TYPE', message: 'Not valid JSON' }] }; }
 if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false, issues: [{ path: '$', code: 'TYPE', message: 'Expected an object' }] };
 const envelope = parsed as Record<string, unknown>;
 if (envelope.format !== 'astrix.mission' || Object.keys(envelope).some(k => !['format', 'schema', 'definition'].includes(k))) return { ok: false, issues: [{ path: '$.format', code: 'UNKNOWN_FIELD', message: 'Not an ASTRIX mission file' }] };
 if (envelope.schema !== 1) return { ok: false, issues: [{ path: '$.schema', code: 'SCHEMA_VERSION', message: `Unsupported file schema ${String(envelope.schema)}` }] };
 return validateMissionDefinition(envelope.definition);
}

const SMALL_PROGRAM: AscentProgram = { azimuthDeg: 90, verticalSec: 8, kickDeg: 12, kickSec: 10, stage1LoadFraction: 1, stage2CoastSec: 5, insertionAltKm: 200, holdUpperStage: false };
const LEGACY_PARTS: Readonly<Record<'CUBESAT_3U' | 'SMALLSAT' | 'CREW_CAPSULE', readonly string[]>> = {
 CUBESAT_3U: ['EPS_BATT_20', 'SOLAR_BODY', 'OBC', 'ADCS_MAG', 'RADIO_UHF'], SMALLSAT: ['SS_BATT_300', 'SS_SOLAR_400', 'SS_OBC', 'SS_ADCS', 'SS_XBAND'],
 CREW_CAPSULE: ['CREW_BATTERY', 'CREW_SOLAR', 'CREW_COMPUTER', 'CREW_ADCS', 'CREW_RADIO', 'CREW_OBSERVER', 'CREW_SUPPORT', 'CREW_HEATER', 'CREW_PROPULSION'],
};
/** The starter design embeds the resolved definition by reference; no registry is involved. */
export function createStarterDesign(definition: ResolvedMissionDefinition, levelId: Design['levelId']): Design {
 const learning = definition.learning, start = definition.start, bus = definition.vehicle.busId;
 const parts: readonly DesignPart[] = learning ? learning.starter.parts.map(p => ({ ...p })) : LEGACY_PARTS[bus].map(partId => ({ partId, qty: 1, ...(partId === 'CREW_PROPULSION' ? { propellantKg: 500 } : {}) }));
 const provided = start.kind === 'PROVIDED_ORBIT';
 return {
  missionId: definition.id, definitionDigest: definition.digest, definition, levelId, rulesVersion: RULES_VERSION, busId: bus, parts,
  rideId: provided ? learning?.starter.rideId ?? definition.vehicle.allowedRideIds[0] ?? null : null,
  orbit: provided ? { ...start.orbit } : null,
  launch: provided ? null : { launcherId: learning?.starter.launcherId ?? start.launcherIds[0], program: { ...(learning?.starter.program ?? SMALL_PROGRAM) } },
  burns: learning ? learning.starter.burns.map(b => ({ ...b })) : [], stationId: definition.environment.stationId, revision: 0,
 };
}
