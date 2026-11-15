import { expect, test } from 'bun:test';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveStatic } from './static';
test('only built public files and known SPA routes are served',async()=>{
 const root=await mkdtemp(join(tmpdir(),'astrix-static-'));
 try{
  await writeFile(join(root,'index.html'),'built app');await writeFile(join(root,'bundle.js'),'public bundle');await writeFile(join(root,'bundle.js.map'),'private map');await writeFile(join(root,'.secret'),'private');await symlink('/etc/passwd',join(root,'outside'));
  expect(await(await serveStatic(root,'/join')).text()).toBe('built app');expect(await(await serveStatic(root,'/host')).text()).toBe('built app');expect(await(await serveStatic(root,'/gmat')).text()).toBe('built app');expect(await(await serveStatic(root,'/quiz')).text()).toBe('built app');expect(await(await serveStatic(root,'/bundle.js')).text()).toBe('public bundle');
  for(const path of ['/science','/science/INDEX.md','/science/plans/X.md'])expect(await(await serveStatic(root,path)).text()).toBe('built app');
  for(const path of ['/../package.json','/%2e%2e/package.json','/.secret','/bundle.js.map','/outside','/not-a-route','/%00','/bad%'])expect((await serveStatic(root,path)).status).toBeGreaterThanOrEqual(400);
  const response=await serveStatic(root,'/');expect(response.headers.get('Content-Security-Policy')).toContain("connect-src 'self'");expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
 }finally{await rm(root,{recursive:true,force:true});}
});
