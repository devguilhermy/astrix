import { realpath, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
export const publicHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Referrer-Policy':'no-referrer', 'Cache-Control':'no-store',
};
export async function serveStatic(root:string, pathname:string):Promise<Response> {
  let path:string;try{path=decodeURIComponent(pathname);}catch{return new Response('Bad path',{status:400,headers:publicHeaders});}
  if(path.includes('\0')||path.includes('\\')||path.split('/').some(part=>part==='..'||part.startsWith('.')))return new Response('Not found',{status:404,headers:publicHeaders});
  const relative=['/','/join','/host','/gmat'].includes(path)?'index.html':path.replace(/^\/+/, '');
  try {
    const absolute=await realpath(resolve(root,relative));
    if(!absolute.startsWith(root+sep)||(await stat(absolute)).isDirectory()||absolute.endsWith('.map'))throw new Error('Not public');
    return new Response(Bun.file(absolute),{headers:publicHeaders});
  }catch{return new Response('Not found',{status:404,headers:publicHeaders});}
}
