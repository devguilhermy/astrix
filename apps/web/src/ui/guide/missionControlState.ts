import { create } from 'zustand';
export type ControlTray = 'requirements'|'slots'|'checklist'|'flight';
export const useMissionControl = create<{ tray:ControlTray|null; setTray(tray:ControlTray|null):void }>(set => ({ tray:null, setTray:tray => set({tray}) }));
export function revealControl(target:string): void {
 const tray = target.startsWith('requirement') ? 'requirements' : target.startsWith('slot') || target === 'spacecraft' || target.startsWith('component-')&&!['component-close','component-find'].includes(target) ? 'slots' : target.startsWith('checklist') ? 'checklist' : ['hotbar','time-','pilot','receipts'].some(prefix => target.startsWith(prefix)) || target==='timeline'||target==='timeline-toggle' ? 'flight' : null;
 if (tray) useMissionControl.getState().setTray(tray);
 requestAnimationFrame(() => {
  const element = document.querySelector<HTMLElement>(`[data-cue-target="${target}"],[id="${target}"]`);
  if (!element) return;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
  element.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
 });
}
