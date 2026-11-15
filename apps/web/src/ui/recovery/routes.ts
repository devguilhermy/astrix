export type PlayView='solar'|'explore'|'prepare'|'play'|'journal'|'gmat'|'help'|'missing';
const routes:readonly string[]=['solar','explore','prepare','play','journal','gmat','help'];
const withSlash=(basePath:string)=>basePath.endsWith('/')?basePath:`${basePath}/`;
/** Hash navigation only changes presentation; it never starts or advances a flight. */
export function readPlayView(hash:string):PlayView {
  const route=hash.replace(/^#/,'');
  return !route||route==='home'?'explore':routes.includes(route)?route as PlayView:'missing';
}
/** GMAT interchange is the only view with its own path (`<base>gmat`); every other view is a hash. */
export function isGmatPath(pathname:string,basePath='/'):boolean { return pathname===`${withSlash(basePath)}gmat`; }
export function readLocationView(pathname:string,hash:string,basePath='/'):PlayView {
  return isGmatPath(pathname,basePath)?'gmat':readPlayView(hash);
}
export function viewUrl(view:PlayView,basePath='/'):string {
  const base=withSlash(basePath);
  return view==='gmat'?`${base}gmat`:`${base}#${view}`;
}
export function isKnownLocation(pathname:string,hash:string,basePath='/'):boolean {
  const base=withSlash(basePath);
  if(isGmatPath(pathname,basePath))return hash==='';
  return (pathname===base||pathname===`${base}index.html`)&&readPlayView(hash)!=='missing';
}
