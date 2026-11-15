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
/** Rendered documentation lives under `<base>science/<doc>.md`; the raw Markdown stays at `<base>docs/<doc>.md`. */
export const SCIENCE_INDEX='INDEX.md';
const scienceRoot=(basePath:string)=>`${withSlash(basePath)}science`;
export function isSciencePath(pathname:string,basePath='/'):boolean {
  const root=scienceRoot(basePath);
  return pathname===root||pathname.startsWith(`${root}/`);
}
/** Doc path relative to `docs/`, or null when the path is outside the route or not a safe `.md` file. */
export function readScienceDoc(pathname:string,basePath='/'):string|null {
  const root=scienceRoot(basePath);
  if(pathname===root||pathname===`${root}/`)return SCIENCE_INDEX;
  if(!pathname.startsWith(`${root}/`))return null;
  let doc:string;
  try{doc=decodeURIComponent(pathname.slice(root.length+1));}catch{return null;}
  return doc.endsWith('.md')&&doc.split('/').every(part=>part!==''&&!part.startsWith('.')&&!part.includes('\\'))?doc:null;
}
export function scienceUrl(doc?:string,basePath='/'):string {
  return doc?`${scienceRoot(basePath)}/${doc.split('/').map(encodeURIComponent).join('/')}`:scienceRoot(basePath);
}
export function isKnownLocation(pathname:string,hash:string,basePath='/'):boolean {
  const base=withSlash(basePath);
  if(isGmatPath(pathname,basePath))return hash==='';
  return (pathname===base||pathname===`${base}index.html`)&&readPlayView(hash)!=='missing';
}
