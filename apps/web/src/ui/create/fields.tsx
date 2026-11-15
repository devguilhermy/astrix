import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DefinitionIssue } from '@astrix/core';

/** JSON path of a field in the definition, e.g. `objectives[1].spec.targetMB`; identical to the engine's issue paths. */
export type DraftPath = string;
interface StudioFields { issues: readonly DefinitionIssue[]; readOnly: boolean }
const FieldContext = createContext<StudioFields>({ issues: [], readOnly: false });
export const FieldProvider = FieldContext.Provider;
export const fieldId = (path: DraftPath) => `f-${path.replace(/[^a-zA-Z0-9]+/g, '-')}`;
export function issuesAt(issues: readonly DefinitionIssue[], path: DraftPath, includeChildren = false): readonly DefinitionIssue[] {
  return issues.filter(issue => issue.path === path || (includeChildren && (issue.path.startsWith(`${path}.`) || issue.path.startsWith(`${path}[`))));
}
export function IssueText({ issue }: { issue: DefinitionIssue }) {
  const { t } = useTranslation();
  return <span className="field-issue"><strong>{t(`studio.issue.${issue.code}`, { defaultValue: issue.code })}</strong> <span lang="en">{issue.message}</span></span>;
}
function Shell({ path, label, hint, unit, children, wide = false }: { path: DraftPath; label: ReactNode; hint?: ReactNode; unit?: string; children: (props: { id: string; invalid: boolean; describedBy: string | undefined; disabled: boolean }) => ReactNode; wide?: boolean }) {
  const { issues, readOnly } = useContext(FieldContext), own = issuesAt(issues, path), id = fieldId(path), described = [hint ? `${id}-hint` : '', own.length ? `${id}-issues` : ''].filter(Boolean).join(' ') || undefined;
  return <div className={`field${wide ? ' wide' : ''}`} data-invalid={own.length > 0 || undefined}>
    <label htmlFor={id}>{label}{unit && <span className="field-unit"> ({unit})</span>}</label>
    {children({ id, invalid: own.length > 0, describedBy: described, disabled: readOnly })}
    {hint && <small id={`${id}-hint`}>{hint}</small>}
    {own.length > 0 && <ul id={`${id}-issues`} className="field-issues" role="alert">{own.map((issue, index) => <li key={index}><IssueText issue={issue}/></li>)}</ul>}
  </div>;
}
export function TextField({ path, label, value, onChange, hint, maxLength, multiline = false, placeholder }: { path: DraftPath; label: ReactNode; value: string; onChange: (value: string) => void; hint?: ReactNode; maxLength?: number; multiline?: boolean; placeholder?: string }) {
  return <Shell path={path} label={label} hint={hint} wide={multiline}>{({ id, invalid, describedBy, disabled }) => multiline
    ? <textarea id={id} rows={3} value={value} maxLength={maxLength} placeholder={placeholder} aria-invalid={invalid || undefined} aria-describedby={describedBy} disabled={disabled} onChange={event => onChange(event.target.value)}/>
    : <input id={id} type="text" value={value} maxLength={maxLength} placeholder={placeholder} aria-invalid={invalid || undefined} aria-describedby={describedBy} disabled={disabled} onChange={event => onChange(event.target.value)}/>}</Shell>;
}
/** Invalid numeric text enters the draft as NaN, so execution cannot silently use a previous value or a zero default. */
export function NumberField({ path, label, value, onChange, unit, hint, step, min, max, nullable = false }: { path: DraftPath; label: ReactNode; value: number | null; onChange: (value: number | null) => void; unit?: string; hint?: ReactNode; step?: number; min?: number; max?: number; nullable?: boolean }) {
  const { t } = useTranslation(), [text, setText] = useState(value === null ? '' : String(value)), [bad, setBad] = useState(false);
  useEffect(() => { if (bad && Number.isNaN(value)) return; const parsed = text.trim() === '' ? null : Number(text); if (parsed !== value && !(Number.isNaN(parsed) && bad)) setText(value === null ? '' : String(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Shell path={path} label={label} unit={unit} hint={hint}>{({ id, invalid, describedBy, disabled }) => <>
    <input id={id} type="text" inputMode="decimal" value={text} step={step} min={min} max={max} aria-invalid={invalid || bad || undefined} aria-describedby={describedBy} disabled={disabled} onChange={event => {
      const next = event.target.value;
      setText(next);
      if (next.trim() === '') { setBad(!nullable); onChange(nullable ? null : Number.NaN); return; }
      const parsed = Number(next);
      if (Number.isFinite(parsed)) { setBad(false); onChange(parsed); } else { setBad(true); onChange(Number.NaN); }
    }}/>
    {bad && <small role="alert" className="field-issue">{t('studio.notANumber')}</small>}
  </>}</Shell>;
}
export function SelectField<T extends string>({ path, label, value, options, onChange, hint, render }: { path: DraftPath; label: ReactNode; value: T; options: readonly T[]; onChange: (value: T) => void; hint?: ReactNode; render: (option: T) => string }) {
  return <Shell path={path} label={label} hint={hint}>{({ id, invalid, describedBy, disabled }) =>
    <select id={id} value={value} aria-invalid={invalid || undefined} aria-describedby={describedBy} disabled={disabled} onChange={event => { const next = options.find(option => option === event.target.value); if (next !== undefined) onChange(next); }}>{options.map(option => <option key={option} value={option}>{render(option)}</option>)}</select>}</Shell>;
}
export function CheckField({ path, label, checked, onChange, hint }: { path: DraftPath; label: ReactNode; checked: boolean; onChange: (value: boolean) => void; hint?: ReactNode }) {
  const { readOnly } = useContext(FieldContext), id = fieldId(path);
  return <div className="field check"><label><input id={id} type="checkbox" checked={checked} disabled={readOnly} onChange={event => onChange(event.target.checked)}/> {label}</label>{hint && <small>{hint}</small>}</div>;
}
export function CheckGroup<T extends string>({ path, legend, values, options, onChange, render, hint }: { path: DraftPath; legend: ReactNode; values: readonly T[]; options: readonly T[]; onChange: (values: T[]) => void; render: (option: T) => string; hint?: ReactNode }) {
  const { issues, readOnly } = useContext(FieldContext), own = issuesAt(issues, path, true), id = useId();
  return <fieldset className="field check-group" data-invalid={own.length > 0 || undefined} aria-describedby={own.length ? `${id}-issues` : undefined}><legend>{legend}</legend>{hint && <small>{hint}</small>}
    <div className="check-grid">{options.map(option => <label key={option}><input type="checkbox" checked={values.includes(option)} disabled={readOnly} onChange={event => onChange(event.target.checked ? [...values, option] : values.filter(item => item !== option))}/> {render(option)}</label>)}</div>
    {own.length > 0 && <ul id={`${id}-issues`} className="field-issues" role="alert">{own.map((issue, index) => <li key={index}><IssueText issue={issue}/></li>)}</ul>}</fieldset>;
}
export function Group({ title, children, description }: { title: ReactNode; children: ReactNode; description?: ReactNode }) {
  return <fieldset className="studio-group"><legend>{title}</legend>{description && <p className="muted">{description}</p>}<div className="field-grid">{children}</div></fieldset>;
}

type Token = string | number;
export function tokens(path: DraftPath): Token[] {
  return [...path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map(match => match[2] !== undefined ? Number(match[2]) : match[1]!);
}
function isIndexable(value: unknown): value is Record<string | number, unknown> { return typeof value === 'object' && value !== null; }
export function getAt(root: unknown, path: DraftPath): unknown {
  let current: unknown = root;
  for (const token of tokens(path)) { if (!isIndexable(current)) return undefined; current = current[token]; }
  return current;
}
/** Immutable deep set along a JSON path. Missing intermediate containers are created (arrays for numeric tokens). */
export function setAt<T>(root: T, path: DraftPath, value: unknown): T {
  const walk = (node: unknown, index: number): unknown => {
    const list = tokens(path);
    if (index === list.length) return value;
    const token = list[index]!, clone: Record<string | number, unknown> | unknown[] = Array.isArray(node) ? [...node] : isIndexable(node) ? { ...node } : typeof token === 'number' ? [] : {};
    Reflect.set(clone, token, walk(isIndexable(node) ? node[token] : undefined, index + 1));
    return clone;
  };
  return walk(root, 0) as T;
}
