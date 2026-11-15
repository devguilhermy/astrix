import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Satellite } from 'lucide-react';
import { partIcons as icons } from './partIcons';
import type { PartInstance } from './model';
import './componentPicker.css';


/** Selects installed hardware for inspection; never changes the spacecraft. */
export function ComponentPicker({ instances, selectedKey, onSelect, triggerRef }: { instances: readonly PartInstance[]; selectedKey: string | null; onSelect: (key: string) => void; triggerRef: RefObject<HTMLButtonElement | null> }) {
  const { t } = useTranslation(), id = useId();
  const [open, setOpen] = useState(false), [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 360, maxHeight: 360 });
  const list = useRef<HTMLDivElement>(null), search = useRef({ text: '', time: 0 });
  const selected = instances.find(item => item.key === selectedKey);
  const Icon = selected ? icons[selected.part.category] : Satellite;
  const title = (item: PartInstance) => `${t(item.part.nameKey)}${item.index > 0 ? ` (${item.index + 1})` : ''}`;
  const close = (restore = false) => { setOpen(false); if (restore) triggerRef.current?.focus({ preventScroll: true }); };
  const show = (last = false) => { setActive(last ? instances.length - 1 : Math.max(0, instances.findIndex(item => item.key === selectedKey))); setOpen(true); };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect(); if (!r) return;
      const width = Math.min(380, innerWidth - 24), above = r.top - 20, below = innerHeight - r.bottom - 20;
      const height = Math.min(400, Math.max(above, below));
      setPosition({ left: Math.max(12, Math.min(innerWidth - width - 12, r.right - width)), top: above >= below ? Math.max(12, r.top - height - 8) : r.bottom + 8, width, maxHeight: height });
    };
    place(); list.current?.focus({ preventScroll: true });
    window.addEventListener('resize', place); document.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true); };
  }, [open, triggerRef]);
  useEffect(() => { if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [open, active]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (event.target instanceof Node && !list.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside); document.addEventListener('focusin', outside);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); };
  }, [open, triggerRef]);
  const choose = (index: number) => { const item = instances[index]; if (!item) return; close(true); onSelect(item.key); };
  const keydown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Tab') { event.preventDefault(); close(true); return; }
    if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); return; }
    let next = active;
    if (event.key === 'ArrowDown') next = (active + 1) % instances.length;
    else if (event.key === 'ArrowUp') next = (active - 1 + instances.length) % instances.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = instances.length - 1;
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now(); search.current = { text: (now - search.current.time < 700 ? search.current.text : '') + event.key.toLocaleLowerCase(), time: now };
      for (let offset = 1; offset <= instances.length; offset++) { const index = (active + offset) % instances.length; if (title(instances[index]).toLocaleLowerCase().startsWith(search.current.text)) { next = index; break; } }
    } else return;
    event.preventDefault(); setActive(next);
  };
  return <>
    <button type="button" ref={triggerRef} className="component-picker-trigger" aria-label={t('inspector.components')} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} disabled={!instances.length} title={t('inspector.componentsHint')} onClick={() => open ? close() : show()} onKeyDown={event => { event.stopPropagation(); if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(event.key === 'ArrowUp'); } }}><Icon size={18} aria-hidden="true"/><span>{selected ? title(selected) : t('inspector.components')}</span><ChevronDown size={16} aria-hidden="true"/></button>
    {open && createPortal(<div ref={list} id={id} className="component-picker-list" role="listbox" tabIndex={-1} aria-label={t('inspector.components')} aria-activedescendant={`${id}-${active}`} style={position} onKeyDown={keydown}>
      {instances.map((item, index) => { const ItemIcon = icons[item.part.category]; return <div key={item.key} id={`${id}-${index}`} role="option" aria-selected={item.key === selectedKey} aria-labelledby={`${id}-${index}-title`} aria-describedby={`${id}-${index}-description`} data-index={index} data-active={active === index} className="component-picker-option" onPointerMove={() => setActive(index)} onClick={() => choose(index)}><ItemIcon size={22} aria-hidden="true"/><span><strong id={`${id}-${index}-title`}>{title(item)}</strong><span id={`${id}-${index}-description`}>{t(item.part.descKey)}</span></span>{item.key === selectedKey && <Check size={18} aria-hidden="true"/>}</div>; })}
    </div>, document.body)}
  </>;
}
