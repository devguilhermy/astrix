import { parseInitialOrbit, parseOem, parseReport } from '@astrix/core/interop/gmat';

self.onmessage = async (event: MessageEvent<{ file: File; kind: 'oem'|'report'|'script'; object: string }>) => {
 try {
  const {file, kind, object} = event.data;
  if (file.size > 10 * 1024 * 1024) throw new Error('Input exceeds 10 MiB');
  const text = await file.text();
  const result = kind === 'oem' ? parseOem(text) : kind === 'report' ? parseReport(text, object) : parseInitialOrbit(text, object);
  self.postMessage({result});
 } catch (error) { self.postMessage({error: error instanceof Error ? error.message : String(error)}); }
};
