export type PlayView='explore'|'prepare'|'play'|'journal'|'gmat'|'help'|'missing';
const routes:readonly string[]=['explore','prepare','play','journal','gmat','help'];
/** Hash navigation only changes presentation; it never starts or advances a flight. */
export function readPlayView(hash:string):PlayView {
  const route=hash.replace(/^#/,'');
  return !route||route==='home'?'explore':routes.includes(route)?route as PlayView:'missing';
}
export function isKnownLocation(pathname:string,hash:string,basePath='/'):boolean {
  const base=basePath.endsWith('/')?basePath:`${basePath}/`;
  return (pathname===base||pathname===`${base}index.html`)&&readPlayView(hash)!=='missing';
}
