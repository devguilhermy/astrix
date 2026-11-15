// Adapted from Void Protocol advisor/cueTargets.ts, pin 218625d (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence).
export function resolveCueTarget(target:string):HTMLElement|null {
 const candidates=[...document.querySelectorAll<HTMLElement>('[data-cue-target]')].filter(el=>el.dataset.cueTarget===target);
 const exact=document.getElementById(target);
 if(exact)candidates.unshift(exact);
 const visible=candidates.find(el=>el.getClientRects().length>0&&!el.closest('[hidden],[inert]'));
 if(visible)return visible;
 for(const el of candidates){const handle=el.closest('.floating-panel')?.querySelector<HTMLElement>('.panel-drag-handle');if(handle?.getClientRects().length)return handle;}
 return null;
}
