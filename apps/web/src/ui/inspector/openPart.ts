import { useWorkbench } from '../../three/spacecraft/workbenchState';
import { showWindow, useWindows } from '../layout/windows';

let opener: HTMLElement | null = null;

/** Opens the component sheet. Viewing is device-local: it never installs, removes or commands anything. */
export function openPartDetails(partId: string, from: HTMLElement | null = null): void {
  const active = typeof document === 'undefined' ? null : document.activeElement;
  opener = from ?? (active instanceof HTMLElement && active !== document.body ? active : null);
  useWorkbench.getState().inspect(partId);
  showWindow('part', '#part-inspector-heading');
}

/** Closes the sheet and returns keyboard focus to whatever opened it. */
export function closePartDetails(): void {
  const panel = document.getElementById('floating-part'), inside = !!panel?.contains(document.activeElement);
  useWorkbench.getState().inspect(null);
  useWindows.getState().collapse('part');
  const back = opener?.isConnected ? opener : document.getElementById('mission-primary');
  opener = null;
  if (inside) requestAnimationFrame(() => back?.focus({ preventScroll: true }));
}
