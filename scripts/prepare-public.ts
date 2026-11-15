import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Keep source evidence and licence notices available on every static deployment.
const root = resolve(import.meta.dir, '..');
const target = resolve(root, 'apps/web/public');
await mkdir(target, { recursive: true });
await cp(resolve(root, 'docs'), resolve(target, 'docs'), { recursive: true });
for (const name of ['LICENSE', 'CREDITS.md', 'THIRD_PARTY_NOTICES.txt']) {
  await cp(resolve(root, name), resolve(target, name));
}
