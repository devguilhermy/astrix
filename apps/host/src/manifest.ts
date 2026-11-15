// Refuses to host a web build whose wire/rules contracts differ from this host's source. The build emits astrix-build.json next to index.html.
import { FLIGHT_MODEL_VERSION, RULES_VERSION } from '@astrix/core';
import { PROTOCOL_VERSION } from '@astrix/session';
export const MANIFEST_FILE = 'astrix-build.json';
export interface BuildManifest { readonly schema: 1; readonly protocol: number; readonly rules: number; readonly flightModel: number }
export const EXPECTED_MANIFEST: BuildManifest = { schema: 1, protocol: PROTOCOL_VERSION, rules: RULES_VERSION, flightModel: FLIGHT_MODEL_VERSION };
/** Pure check: null when the manifest text matches exactly, otherwise a one-line reason. Extra keys are ignored. */
export function manifestProblem(text: string | null): string | null {
  if (text === null) return `${MANIFEST_FILE} is missing`;
  let value: unknown;
  try { value = JSON.parse(text); } catch { return `${MANIFEST_FILE} is not valid JSON`; }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return `${MANIFEST_FILE} is not an object`;
  const record = value as Record<string, unknown>;
  for (const key of ['schema', 'protocol', 'rules', 'flightModel'] as const) if (record[key] !== EXPECTED_MANIFEST[key]) return `${MANIFEST_FILE} ${key} is ${JSON.stringify(record[key])}, this host needs ${EXPECTED_MANIFEST[key]}`;
  return null;
}
export async function verifyBuild(dist: string): Promise<void> {
  const file = Bun.file(`${dist}/${MANIFEST_FILE}`), text = (await file.exists()) ? await file.text() : null, problem = manifestProblem(text);
  if (problem) throw new Error(`Stale or foreign web build (${problem}). Rebuild online with \`bun run build\`, then run \`bun run host\`.`);
}
