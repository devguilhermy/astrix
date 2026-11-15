import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DefinitionIssue } from '@astrix/core';
import { MAX_DEFINITION_BYTES } from '@astrix/core';
import { deleteEntry, exportDraftText, freshId, importMissionText, readLibrary, saveDraft, type DraftDefinition, type LibraryEntry, type LibraryError } from './library';
import { downloadText } from './download';
import { IssueText } from './fields';

/** Storage and validation failures are always shown with their cause; nothing is reported as saved unless it was. */
export function LibraryErrorNotice({ error, onGoto }: { error: LibraryError; onGoto?: (issue: DefinitionIssue) => void }) {
  const { t } = useTranslation();
  return <section className="library-error" role="alert"><h2>{t(`library.error.${error.code}`)}</h2>
    {error.detail && <p className="muted"><span lang="en">{error.detail}</span></p>}
    {error.issues && <ul className="issue-list">{error.issues.slice(0, 12).map((issue, index) => <li key={index}>{onGoto ? <button type="button" className="text-button" onClick={() => onGoto(issue)}><code>{issue.path || t('studio.root')}</code></button> : <code>{issue.path || t('studio.root')}</code>} <IssueText issue={issue}/></li>)}{error.issues.length > 12 && <li>{t('library.moreIssues', { count: error.issues.length - 12 })}</li>}</ul>}
  </section>;
}

/** Saved drafts with import/export. Selection is by library id so setup can re-resolve the current draft at start. */
export function LibraryPanel({ selected, onSelect, onOpen, refreshKey = 0 }: { selected: string | null; onSelect: (id: string | null) => void; onOpen: (draft: DraftDefinition) => void; refreshKey?: number }) {
  const { t, i18n } = useTranslation(), [version, setVersion] = useState(0), [error, setError] = useState<LibraryError | null>(null), [notice, setNotice] = useState(''), file = useRef<HTMLInputElement>(null), pasteId = useId();
  void refreshKey; void version;
  const read = readLibrary(), entries: readonly LibraryEntry[] = read.ok ? read.value : [];
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' });
  const refresh = () => setVersion(value => value + 1);
  const importText = (text: string) => {
    if (text.length > MAX_DEFINITION_BYTES * 2) { setError({ code: 'TOO_LARGE', detail: String(MAX_DEFINITION_BYTES) }); return; }
    const result = importMissionText(text, entries);
    if (!result.ok) { setError(result.error); setNotice(''); return; }
    const saved = saveDraft(result.value.draft);
    if (!saved.ok) { setError(saved.error); return; }
    setError(null); setNotice(t(result.value.renamed ? 'library.importedRenamed' : 'library.imported', { id: result.value.draft.id })); onSelect(result.value.draft.id); refresh();
  };
  const exportEntry = (entry: LibraryEntry) => {
    const result = exportDraftText(entry.draft);
    if (!result.ok) { setError(result.error); return; }
    try { downloadText(`${entry.id}.astrix-mission.json`, result.value.text); setError(null); setNotice(t('studio.exported', { name: `${entry.id}.astrix-mission.json` })); } catch (cause) { setError({ code: 'WRITE_FAILED', detail: cause instanceof Error ? cause.message : String(cause) }); }
  };
  const duplicate = (entry: LibraryEntry) => {
    const id = freshId(entry.id, new Set(entries.map(item => item.id))), copy: DraftDefinition = { ...structuredClone(entry.draft), id, revision: 1, derivedFrom: null };
    const saved = saveDraft(copy);
    if (!saved.ok) { setError(saved.error); return; }
    setError(null); setNotice(t('library.duplicated', { id })); refresh();
  };
  const remove = (entry: LibraryEntry) => {
    if (!window.confirm(t('library.deleteConfirm', { id: entry.id }))) return;
    const result = deleteEntry(entry.id);
    if (!result.ok) { setError(result.error); return; }
    if (selected === entry.id) onSelect(null);
    setError(null); setNotice(t('library.deleted', { id: entry.id })); refresh();
  };
  return <section className="library-panel" aria-labelledby="library-heading">
    <h3 id="library-heading">{t('library.title')}</h3>
    {!read.ok && <LibraryErrorNotice error={read.error}/>}
    {error && <LibraryErrorNotice error={error}/>}
    {notice && <p role="status">{notice}</p>}
    {read.ok && entries.length === 0 && <p className="muted">{t('library.empty')}</p>}
    {entries.length > 0 && <ul className="library-list">{entries.map(entry => {
      const latest = entry.published.at(-1);
      return <li key={entry.id} data-selected={selected === entry.id || undefined}>
        <label><input type="radio" name="library-mission" checked={selected === entry.id} onChange={() => onSelect(entry.id)}/> <strong>{entry.draft.name.text || entry.id}</strong></label>
        <small>{entry.id} · {t('library.revisions', { count: entry.published.length, latest: latest?.revision ?? 0 })} · {date.format(entry.updatedAt)}</small>
        <div className="button-wrap"><button type="button" className="button" onClick={() => onOpen(entry.draft)}>{t('library.open')}</button><button type="button" className="button" onClick={() => duplicate(entry)}>{t('library.duplicate')}</button><button type="button" className="button" onClick={() => exportEntry(entry)}>{t('library.export')}</button><button type="button" className="button" onClick={() => remove(entry)}>{t('library.delete')}</button></div>
      </li>;
    })}</ul>}
    <div className="library-import"><h4>{t('library.importTitle')}</h4><p className="muted">{t('library.importNote', { kb: MAX_DEFINITION_BYTES / 1024 })}</p>
      <input ref={file} type="file" accept="application/json,.json" aria-label={t('library.chooseFile')} onChange={async event => {
        const chosen = event.target.files?.[0]; event.target.value = '';
        if (!chosen) return;
        if (chosen.size > MAX_DEFINITION_BYTES * 2) { setError({ code: 'TOO_LARGE', detail: `${chosen.name}: ${chosen.size} B` }); return; }
        try { importText(await chosen.text()); } catch (cause) { setError({ code: 'WRITE_FAILED', detail: cause instanceof Error ? cause.message : String(cause) }); }
      }}/>
      <details><summary>{t('library.paste')}</summary><label htmlFor={pasteId} className="sr-only">{t('library.paste')}</label><textarea id={pasteId} rows={4} spellCheck={false} onBlur={event => { const text = event.target.value.trim(); if (text) { importText(text); event.target.value = ''; } }}/><small>{t('library.pasteHint')}</small></details>
    </div>
  </section>;
}
