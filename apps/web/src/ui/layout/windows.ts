import { create } from 'zustand';
import { clampRectangle, compactSheetBounds, defaultRectangle, MINIMUM_SIZE, PANEL_IDS, sheetRectangle, type LayoutClass, type PanelId, type Rectangle } from './panelLayout';

export interface WindowIntent {
 visibility: 'EXPANDED' | 'COLLAPSED';
 preferredDesktop: Rectangle | null;
 compactHeight: number;
 compactExpanded: boolean;
 order: number;
 focusTarget: HTMLElement | null;
 scrollPositions: Record<string, number>;
}
interface WindowsState {
 windows: Record<PanelId, WindowIntent>;
 bounds: Rectangle;
 layout: LayoutClass;
 compactWindow: PanelId | null;
 announcement: { id: PanelId; action: 'collapsed' | 'expanded' } | null;
 revision: number;
 setViewport(bounds: Rectangle, layout: LayoutClass): void;
 setGeometry(id: PanelId, geometry: Rectangle): void;
 setPosition(id: PanelId, position: Pick<Rectangle, 'x' | 'y'>): void;
 setCompactHeight(id: PanelId, height: number): void;
 toggleExpanded(id: PanelId): void;
 collapse(id: PanelId): void;
 expand(id: PanelId): void;
 raise(id: PanelId): void;
 resetLayout(): void;
}
const freshWindows = (): Record<PanelId, WindowIntent> => ({
 mission: { visibility: 'EXPANDED', preferredDesktop: null, compactHeight: 420, compactExpanded: false, order: 23, focusTarget: null, scrollPositions: {} },
 readiness: { visibility: 'COLLAPSED', preferredDesktop: null, compactHeight: 340, compactExpanded: false, order: 22, focusTarget: null, scrollPositions: {} },
 review: { visibility: 'COLLAPSED', preferredDesktop: null, compactHeight: 280, compactExpanded: false, order: 21, focusTarget: null, scrollPositions: {} },
 log: { visibility: 'COLLAPSED', preferredDesktop: null, compactHeight: 280, compactExpanded: false, order: 20, focusTarget: null, scrollPositions: {} },
 part: { visibility: 'COLLAPSED', preferredDesktop: null, compactHeight: 360, compactExpanded: false, order: 19, focusTarget: null, scrollPositions: {} },
});
const nextOrder = (windows: Record<PanelId, WindowIntent>) => Math.max(...PANEL_IDS.map(id => windows[id].order)) + 1;

export const useWindows = create<WindowsState>((set, get) => ({
 windows: freshWindows(), bounds: { x: 10, y: 180, width: 1260, height: 610 }, layout: 'desktop', compactWindow: 'mission', announcement: null, revision: 0,
 setViewport(bounds, layout) {
  const state = get(), old = state.bounds;
  if (old.x === bounds.x && old.y === bounds.y && old.width === bounds.width && old.height === bounds.height && state.layout === layout) return;
  let compactWindow = state.compactWindow;
  if (layout !== 'desktop' && typeof document !== 'undefined') {
   const focused = PANEL_IDS.find(id => state.windows[id].visibility === 'EXPANDED' && document.getElementById(`floating-${id}`)?.contains(document.activeElement));
   if (focused) compactWindow = focused;
  }
  set({ bounds, layout, compactWindow });
 },
 setGeometry(id, geometry) {
  set(state => ({ windows: { ...state.windows, [id]: { ...state.windows[id], preferredDesktop: { ...geometry } } } }));
 },
 setPosition(id, position) {
  set(state => ({ windows: { ...state.windows, [id]: { ...state.windows[id], preferredDesktop: { ...(state.windows[id].preferredDesktop ?? defaultRectangle(id, state.bounds)), x: position.x, y: position.y } } } }));
 },
 setCompactHeight(id, height) {
  if (!Number.isFinite(height)) return;
  set(state => ({ windows: { ...state.windows, [id]: { ...state.windows[id], compactHeight: Math.max(1, height), compactExpanded: false } } }));
 },
 toggleExpanded(id) {
  set(state => ({ windows: { ...state.windows, [id]: { ...state.windows[id], compactExpanded: !state.windows[id].compactExpanded } } }));
 },
 collapse(id) {
  const state = get(), entry = state.windows[id];
  if (entry.visibility === 'COLLAPSED') return;
  const panel = typeof document === 'undefined' ? null : document.getElementById(`floating-${id}`);
  const focused = typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null;
  const inside = !!focused && !!panel?.contains(focused);
  const remaining = PANEL_IDS.filter(candidate => candidate !== id && state.windows[candidate].visibility === 'EXPANDED');
  set({ windows: { ...state.windows, [id]: { ...entry, visibility: 'COLLAPSED', focusTarget: inside ? focused : entry.focusTarget } },
   compactWindow: state.compactWindow === id ? remaining.sort((a, b) => state.windows[b].order - state.windows[a].order)[0] ?? null : state.compactWindow,
   announcement: { id, action: 'collapsed' } });
  if (inside) queueMicrotask(() => document.getElementById(`window-handle-${id}`)?.focus());
 },
 expand(id) {
  const state = get(), wasCollapsed = state.windows[id].visibility === 'COLLAPSED';
  set({ windows: { ...state.windows, [id]: { ...state.windows[id], visibility: 'EXPANDED', order: nextOrder(state.windows) } }, compactWindow: id,
   announcement: wasCollapsed ? { id, action: 'expanded' } : state.announcement });
 },
 raise(id) {
  const state = get();
  if (state.windows[id].order === Math.max(...PANEL_IDS.map(candidate => state.windows[candidate].order))) return;
  set({ windows: { ...state.windows, [id]: { ...state.windows[id], order: nextOrder(state.windows) } } });
 },
 resetLayout() {
  const state = get(), windows = freshWindows();
  for (const id of PANEL_IDS) {
   windows[id].focusTarget = state.windows[id].focusTarget;
   windows[id].scrollPositions = state.windows[id].scrollPositions;
  }
  set({ windows, compactWindow: 'mission', revision: state.revision + 1, announcement: null });
 },
}));

export function effectiveRectangle(id: PanelId, state = useWindows.getState()): Rectangle {
 const entry = state.windows[id];
 const expanded = entry.visibility === 'EXPANDED' && (state.layout === 'desktop' || state.compactWindow === id);
 const preferred = entry.preferredDesktop ?? defaultRectangle(id, state.bounds);
 if (state.layout === 'desktop') {
  if (!expanded) return clampRectangle({ ...preferred, width: 220, height: 44 }, state.bounds, { width: 180, height: 44 });
  return clampRectangle(preferred, state.bounds, MINIMUM_SIZE[id]);
 }
 if (expanded) return sheetRectangle(entry.compactHeight, compactSheetBounds(state.bounds), id, entry.compactExpanded);
 const index = PANEL_IDS.indexOf(id);
 return { x: state.bounds.x + (index % 2) * state.bounds.width / 2, y: state.bounds.y + state.bounds.height - 88 + Math.floor(index / 2) * 44, width: state.bounds.width / 2, height: 44 };
}

/** Programmatic reveal must precede focus; the next animation frame sees React's expanded DOM. */
export function expandWindow(id: PanelId, options: { focus?: boolean } = {}): void {
 useWindows.getState().expand(id);
 if (options.focus === false || typeof document === 'undefined') return;
 requestAnimationFrame(() => {
  const state = useWindows.getState();
  if (state.windows[id].visibility !== 'EXPANDED' || (state.layout !== 'desktop' && state.compactWindow !== id)) return;
  document.getElementById(`window-handle-${id}`)?.focus({ preventScroll: state.layout !== 'reading' });
 });
}

export function showWindow(id: PanelId, target?: string | HTMLElement): void {
 expandWindow(id, { focus: false });
 requestAnimationFrame(() => {
  const state = useWindows.getState();
  if (state.windows[id].visibility !== 'EXPANDED' || (state.layout !== 'desktop' && state.compactWindow !== id)) return;
  const panel = document.getElementById(`floating-${id}`);
  const element = typeof target === 'string' ? panel?.querySelector<HTMLElement>(target) : target;
  const focus = element?.isConnected && panel?.contains(element) ? element : document.getElementById(`window-handle-${id}`);
  if (!focus) return;
  if (!focus.matches('button,input,select,textarea,a[href],[tabindex]')) focus.tabIndex = -1;
  for(let parent=focus.parentElement;parent&&parent!==panel;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
  focus.focus({ preventScroll: true });
  if (focus !== document.getElementById(`window-handle-${id}`)) focus.scrollIntoView({ block: 'nearest', inline: 'nearest' });
 });
}
