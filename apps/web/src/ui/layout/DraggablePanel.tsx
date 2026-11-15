// Collapse-in-place header pattern from Void Protocol AuraStrip.tsx, pin 218625d; owner-authorized project Apache-2.0 reuse.
// Tracked placement follows Void Protocol DraggablePanel.tsx + utils/panelPlacement.ts at the same pin.
import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Phase } from '@astrix/core';
import { clampRectangle, compactSheetBounds, MINIMUM_SIZE, moveRectangle, resizeRectangle, sheetRectangle, type LayoutClass, type PanelId, type Point, type Rectangle, type ResizeEdge } from './panelLayout';
import { effectiveRectangle, useWindows } from './windows';
import { useWindowCopy } from './windowCopy';
import { followsTrackedTarget, placeBesideBounds, type Placement } from './panelPlacement';
import { getTrackedTarget, setTracking, subscribeTrackedTarget } from './trackedTargets';
import './windows.css';

/** HUD surfaces a tracked panel should avoid covering. */
const OCCUPIED = '[data-hud-zone], .floating-panel, .scene-camera, .scene-workbench, .scene-caption';
function occupiedRects(self: HTMLElement): Rectangle[] {
 const rects: Rectangle[] = [];
 for (const element of document.querySelectorAll<HTMLElement>(OCCUPIED)) {
  if (element === self || self.contains(element) || element.contains(self)) continue;
  const r = element.getBoundingClientRect();
  if (r.width > 0 && r.height > 0) rects.push({ x: r.left, y: r.top, width: r.width, height: r.height });
 }
 return rects;
}

interface Gesture {
 pointerId: number; target: HTMLElement; start: Point; origin: Rectangle; current: Rectangle;
 edge: ResizeEdge | 'move'; layout: LayoutClass; bounds: Rectangle;
}
const EDGES: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/** `track`: on desktop the panel sits beside its tracked 3D object (`trackedTargets`, keyed by panel id) until moved by hand. */
export function DraggablePanel({ id, title, phase, children, badge = 0, track = false }: { id: PanelId; title: string; phase?: Phase; active?: boolean; children: ReactNode; badge?: number; track?: boolean }) {
 const copy = useWindowCopy(), instructions = useId(), optionsId = useId();
 const ref = useRef<HTMLElement>(null), body = useRef<HTMLDivElement>(null), optionsButton = useRef<HTMLButtonElement>(null);
 const gesture = useRef<Gesture | null>(null);
 const [draft, setDraft] = useState<Rectangle | null>(null), [options, setOptions] = useState(false);
 const entry = useWindows(state => state.windows[id]), viewportBounds = useWindows(state => state.bounds);
 const layout = useWindows(state => state.layout), compactWindow = useWindows(state => state.compactWindow);
 const bounds = useMemo(() => layout === 'compact' ? compactSheetBounds(viewportBounds) : viewportBounds, [layout, viewportBounds]);
 const revision = useWindows(state => state.revision);
 const collapsed = entry.visibility === 'COLLAPSED' || (layout !== 'desktop' && compactWindow !== id);
 const toggle = () => { cancelGesture(); if (collapsed) useWindows.getState().expand(id); else useWindows.getState().collapse(id); }; 
 const trackId = track ? id : null;
 const subscribeTracking = useCallback((listener: () => void) => trackId ? subscribeTrackedTarget(trackId, listener) : () => {}, [trackId]);
 const isTracking = useSyncExternalStore(subscribeTracking, () => !!trackId && getTrackedTarget(trackId)?.isTracking === true);
 const following = isTracking && layout === 'desktop';
 const placed = useRef<Placement | null>(null);
 const displayed = (): Rectangle => { const base = effectiveRectangle(id); return following && placed.current ? { ...base, x: placed.current.x, y: placed.current.y } : base; };
 const rectangle = draft ?? displayed(), view = phase ?? 'default';
 const boundsRef = useRef(bounds);
 boundsRef.current = bounds;
 const cancelGesture = useCallback(() => {
  const current = gesture.current;
  gesture.current = null; setDraft(null);
  if (current?.target.hasPointerCapture(current.pointerId)) current.target.releasePointerCapture(current.pointerId);
 }, []);
 useLayoutEffect(() => {
  cancelGesture();
  return cancelGesture;
 }, [collapsed, layout, bounds, revision, cancelGesture]);
 useLayoutEffect(() => {
  const escape = (event: KeyboardEvent) => {
   if (event.key !== 'Escape' || !gesture.current) return;
   event.preventDefault(); event.stopPropagation(); cancelGesture();
  };
  window.addEventListener('keydown', escape, true);
  return () => window.removeEventListener('keydown', escape, true);
 }, [cancelGesture]);
 useLayoutEffect(() => {
  if (body.current) body.current.scrollTop = useWindows.getState().windows[id].scrollPositions[view] ?? 0;
 }, [id, view, revision]);
 useLayoutEffect(() => {
  if (collapsed) setOptions(false);
 }, [collapsed]);
 // Beside the tracked silhouette every time the scene publishes it; direct DOM writes, no React render per frame.
 useLayoutEffect(() => {
  const element = ref.current;
  if (!following || !trackId || !element) { placed.current = null; return; }
  let occupied: Rectangle[] = [], measuredAt = -Infinity;
  const place = () => {
   const target = getTrackedTarget(trackId);
   if (!followsTrackedTarget(target, !!gesture.current) || !target?.rect) return;
   const now = performance.now();
   if (now - measuredAt > 250) { occupied = occupiedRects(element); measuredAt = now; }
   const next = placeBesideBounds(target.rect, { width: element.offsetWidth, height: element.offsetHeight }, boundsRef.current, occupied, placed.current?.side);
   const moved = !placed.current || placed.current.x !== next.x || placed.current.y !== next.y;
   placed.current = next;
   if (moved) { element.style.left = `${next.x}px`; element.style.top = `${next.y}px`; }
  };
  place();
  const unsubscribe = subscribeTrackedTarget(trackId, place), resize = new ResizeObserver(place);
  resize.observe(element);
  return () => { unsubscribe(); resize.disconnect(); };
 }, [following, trackId, collapsed]);
 const startGesture = (event: ReactPointerEvent<HTMLElement>, edge: Gesture['edge']) => {
  if (layout === 'reading' || event.button !== 0 || !event.isPrimary || gesture.current) return;
  event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true });
  event.currentTarget.setPointerCapture(event.pointerId);
  const origin = displayed();
  gesture.current = { pointerId: event.pointerId, target: event.currentTarget, start: { x: event.clientX, y: event.clientY }, origin,
   current: origin, edge, layout, bounds };
  setDraft(origin);
 };
 const pointerMove = (event: ReactPointerEvent<HTMLElement>) => {
  const current = gesture.current;
  if (!current || current.pointerId !== event.pointerId) return;
  event.preventDefault(); event.stopPropagation();
  const delta = { x: event.clientX - current.start.x, y: event.clientY - current.start.y };
  // A real drag hands the position to the player; a press without movement keeps following.
  if (trackId && Math.hypot(delta.x, delta.y) > 3) setTracking(trackId, false);
  current.current = current.layout !== 'desktop'
   ? sheetRectangle(current.origin.height - delta.y, current.bounds, id)
   : current.edge === 'move'
    ? clampRectangle({ ...current.origin, x: current.origin.x + delta.x, y: current.origin.y + delta.y }, current.bounds, collapsed ? { width: 180, height: 44 } : MINIMUM_SIZE[id])
    : resizeRectangle(current.origin, current.edge, delta, current.bounds, MINIMUM_SIZE[id]);
  setDraft(current.current);
 };
 const pointerUp = (event: ReactPointerEvent<HTMLElement>) => {
  const current = gesture.current;
  if (!current || current.pointerId !== event.pointerId) return;
  event.stopPropagation();
  const changed = current.current.x !== current.origin.x || current.current.y !== current.origin.y || current.current.width !== current.origin.width || current.current.height !== current.origin.height;
  if (changed && current.layout === 'desktop') {
   if (collapsed) useWindows.getState().setPosition(id, current.current);
   else useWindows.getState().setGeometry(id, current.current);
  }
  else if (changed) useWindows.getState().setCompactHeight(id, current.current.height);
  cancelGesture();
 };
 const pointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
  if (gesture.current?.pointerId !== event.pointerId) return;
  event.stopPropagation(); cancelGesture();
 };
 const pointerHandlers = { onPointerMove: pointerMove, onPointerUp: pointerUp,
  onPointerCancel: pointerCancel, onLostPointerCapture: pointerCancel };
 return <section ref={ref} id={`floating-${id}`} className={`floating-panel floating-${id}`}
  data-layout={layout} data-collapsed={collapsed} data-active={!collapsed} data-cue-target={id === 'mission' ? 'workshop' : id} aria-label={title}
  style={layout === 'reading' ? { zIndex: entry.order } : { left: rectangle.x, top: rectangle.y, width: rectangle.width, height: rectangle.height, zIndex: entry.order }}
  onFocusCapture={event => {
   useWindows.getState().raise(id);
   const target = event.target as HTMLElement;
   if (useWindows.getState().windows[id].focusTarget !== target) useWindows.setState(state => ({ windows: { ...state.windows, [id]: { ...state.windows[id], focusTarget: target } } }));
  }} onPointerDownCapture={() => useWindows.getState().raise(id)}
  onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
  <div className="window-title-row" onDoubleClick={toggle}>
   <button id={`window-handle-${id}`} type="button" className="panel-drag-handle" aria-label={layout === 'reading' ? title : `${layout === 'desktop' ? copy.move : copy.size}: ${title}`} aria-describedby={instructions} aria-expanded={!collapsed} aria-controls={`window-body-${id}`} onClick={event => { if (event.detail === 0) toggle(); }}
    onPointerDown={event => startGesture(event, 'move')} {...pointerHandlers}
    onKeyDown={event => {
     if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || layout === 'reading') return;
     event.preventDefault(); event.stopPropagation();
     const state = useWindows.getState(), origin = displayed();
     if (trackId && layout === 'desktop') setTracking(trackId, false);
     if (layout === 'desktop') {
      const next = moveRectangle(origin, event.key, event.shiftKey, bounds, collapsed ? { width: 180, height: 44 } : MINIMUM_SIZE[id]);
      if (collapsed) state.setPosition(id, next);
      else state.setGeometry(id, next);
     }
     else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') state.setCompactHeight(id, sheetRectangle(origin.height + (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 40 : 10), bounds, id).height);
    }}><span className="drag-grip" aria-hidden="true"/><span className="panel-title"><span className="panel-title-text">{title}</span>{badge > 0 && <span className="panel-badge">{badge}</span>}</span></button>
   <button ref={optionsButton} type="button" className="window-title-action" aria-label={`${copy.options}: ${title}`} aria-expanded={options} aria-controls={optionsId}
    onClick={() => { if(collapsed)useWindows.getState().expand(id);setOptions(value => !value); }}><span aria-hidden="true">⋯</span></button>
   <button type="button" className="window-title-action" aria-label={`${collapsed ? copy.expand : copy.collapse}: ${title}`} aria-expanded={!collapsed} aria-controls={`window-body-${id}`} onClick={toggle}><span aria-hidden="true">{collapsed ? '⌄' : '⌃'}</span></button>
  </div>
  <p id={instructions} className="sr-only">{layout === 'desktop' ? copy.instructions : layout === 'reading' ? copy.reading : copy.sheetInstructions}</p>
  <div ref={body} id={`window-body-${id}`} hidden={collapsed} className="floating-panel-body" onScroll={event => {
   const scrollTop = event.currentTarget.scrollTop;
   useWindows.setState(state => ({ windows: { ...state.windows, [id]: { ...state.windows[id], scrollPositions: { ...state.windows[id].scrollPositions, [view]: scrollTop } } } }));
  }}>
   {options && <WindowOptions id={id} optionsId={optionsId} onClose={() => { setOptions(false); optionsButton.current?.focus(); }}/>} 
   {children}
  </div>
  {!collapsed && layout !== 'reading' && (layout === 'desktop' ? EDGES : ['n'] as ResizeEdge[]).map(edge => <div key={edge} className={`window-resize-handle resize-${edge}`} aria-hidden="true"
   onPointerDown={event => startGesture(event, edge)} {...pointerHandlers}/>)}
 </section>;
}

function WindowOptions({ id, optionsId, onClose }: { id: PanelId; optionsId: string; onClose(): void }) {
 const copy = useWindowCopy(), layout = useWindows(state => state.layout), viewportBounds = useWindows(state => state.bounds);
 const bounds = useMemo(() => layout === 'compact' ? compactSheetBounds(viewportBounds) : viewportBounds, [layout, viewportBounds]);
 const entry = useWindows(state => state.windows[id]);
 const shown = getTrackedTarget(id)?.isTracking && layout === 'desktop' ? document.getElementById(`floating-${id}`)?.getBoundingClientRect() : undefined;
 // A following panel's live position comes from the DOM; nudges start where the player sees it.
 const effective = shown ? { ...effectiveRectangle(id), x: Math.round(shown.left), y: Math.round(shown.top) } : effectiveRectangle(id), [numeric, setNumeric] = useState<Rectangle>(effective);
 useLayoutEffect(() => {
  setNumeric({ x: effective.x, y: effective.y, width: effective.width, height: effective.height });
 }, [effective.x, effective.y, effective.width, effective.height]);
 const commit = (next: Rectangle) => {
  // Explicit geometry is a manual placement: stop following a tracked object.
  if (layout === 'desktop') { setTracking(id, false); useWindows.getState().setGeometry(id, clampRectangle(next, bounds, MINIMUM_SIZE[id])); }
  else useWindows.getState().setCompactHeight(id, next.height);
  setNumeric(layout === 'desktop' ? clampRectangle(next, bounds, MINIMUM_SIZE[id]) : sheetRectangle(next.height, bounds, id));
 };
 return <section id={optionsId} className="window-options" aria-label={copy.options} onKeyDown={event => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
 }}>
  <strong>{copy.options}</strong>
  <p>{layout === 'desktop' ? copy.geometryNote : layout === 'reading' ? copy.reading : copy.compactNote}</p>
  {layout !== 'reading' && <>
  {layout === 'desktop' && <fieldset><legend>{copy.move}</legend><div className="window-option-buttons">
   {(['Left', 'Right', 'Up', 'Down'] as const).map(direction => <button key={direction} type="button" onClick={() => commit(moveRectangle(effectiveRectangle(id), `Arrow${direction}`, true, bounds, MINIMUM_SIZE[id]))}>{copy[direction.toLowerCase() as 'left' | 'right' | 'up' | 'down']}</button>)}
  </div></fieldset>}
  <fieldset><legend>{copy.size}</legend><div className="window-option-buttons">
   {(layout === 'desktop' ? ['narrower', 'wider', 'shorter', 'taller'] as const : ['shorter', 'taller'] as const).map(action => <button key={action} type="button" onClick={() => {
    const origin = effectiveRectangle(id);
    commit({ ...origin, width: origin.width + (action === 'wider' ? 40 : action === 'narrower' ? -40 : 0), height: origin.height + (action === 'taller' ? 40 : action === 'shorter' ? -40 : 0) });
   }}>{copy[action]}</button>)}
  </div></fieldset>
  {layout !== 'desktop' && <button type="button" onClick={() => { useWindows.getState().toggleExpanded(id); setNumeric(effectiveRectangle(id)); }}>{entry.compactExpanded ? copy.restoreSize : copy.expand}</button>}
  <form className="window-numeric-geometry" onSubmit={event => { event.preventDefault(); commit(numeric); }}>
   {(layout === 'desktop' ? ['x', 'y', 'width', 'height'] as const : ['height'] as const).map(field => <label key={field}>{copy[field]}<input type="number" step="1" required value={Number.isFinite(numeric[field]) ? numeric[field] : ''}
    min={field === 'width' || field === 'height' ? 1 : undefined} onChange={event => { const value = event.currentTarget.valueAsNumber; setNumeric(previous => ({ ...previous, [field]: value })); }}/></label>)}
   <button type="submit">{copy.apply}</button>
  </form>
  </>}
  <button type="button" onClick={onClose}>{copy.close}</button>
 </section>;
}
