import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { turnDebrief, type TurnGameState } from '@astrix/core';
import { labelText, objectiveTarget } from '../../missions/definitionView';
import { Comparison } from '../Comparison';
import { Duration, Evidence, ScienceLibrary } from '../Evidence';
import { Receipt } from '../Receipt';
import { ScienceConnection } from '../ScienceConnection';
import { usePlayCopy } from '../copy';
import { attemptRecord, comparable, type AttemptRecord } from '../persistence';
import type { TurnMoment } from '../turnMoments';
import { useFeedbackCopy } from '../feedback/copy';
import { TurnResultCard } from '../feedback/TurnResultCard';
import { ScoreSummary } from './ScoreSummary';
import { effectiveTurn, rovingIndex } from './timeline';
import { TurnTimeline } from './TurnTimeline';
import '../feedback/feedback.css';
import './report.css';

type Sheet = 'result' | 'turns' | 'science';
type Tab = 'turn' | 'science' | 'compare';
const sheets: readonly Sheet[] = ['result', 'turns', 'science'];
const tabs: readonly Tab[] = ['turn', 'science', 'compare'];

/**
 * End-of-mission report on the turn workspace grid, so the scene stays visible:
 * result and score on the left, turn / science / comparison detail on the right and
 * a flight timeline docked along the bottom. One switched sheet at ≤ 900 px.
 */
export function MissionReport({ game, journal, moments, selectedTurn, onSelectTurn, onRetry, onRedesign, onTools, disabled }: {
  game: TurnGameState; journal: readonly AttemptRecord[]; moments: readonly TurnMoment[];
  selectedTurn: number | null; onSelectTurn: (index: number) => void;
  onRetry: () => void; onRedesign: () => void; onTools: () => void; disabled: boolean;
}) {
  const c = usePlayCopy(), fc = useFeedbackCopy(), { t } = useTranslation(), id = useId();
  const definition = game.design.definition;
  const result = useMemo(() => turnDebrief(game), [game]), record = useMemo(() => attemptRecord(game), [game]);
  const previous = [...journal].reverse().find(item => item.id !== record.id && comparable(item, record));
  const [active, setActive] = useState<Sheet>('result'), [tab, setTab] = useState<Tab>('turn'), tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const current = effectiveTurn(moments, selectedTurn), moment = moments.find(item => item.index === current);
  useEffect(() => { if (current !== null && current !== selectedTurn) onSelectTurn(current); }, [current, selectedTurn]);
  const showSheet = (sheet: Sheet) => { setActive(sheet); if (sheet === 'turns') setTab('turn'); else if (sheet === 'science') setTab('science'); };
  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = rovingIndex(index, event.key, tabs.length);
    if (next === null) return;
    event.preventDefault();
    setTab(tabs[next]!);
    tabButtons.current[next]?.focus();
  };
  const met = result.evidence.filter(item => item.state === 'MET').map(item => {
    const objective = definition.objectives.find(candidate => candidate.id === item.id), summary = objective ? objectiveTarget(objective) : null;
    return summary ? t(summary.key, { ...summary.values, body: typeof summary.values.body === 'string' ? c(summary.values.body) : undefined }) : item.kind;
  });
  const instrument = definition.objectives.some(item => item.spec.kind === 'INSTRUMENT_HOURS');
  const outcome = result.outcome === 'SUCCESS' ? c('success') : result.outcome === 'INCOMPLETE' ? fc('report.incomplete') : c('failure');
  return <section className={`mission-report contextual-workspace active-${active}`} aria-label={fc('report.title')}>
    <div className="context-panel-switch" role="group" aria-label={fc('report.views')}>
      {sheets.map(sheet => <button key={sheet} type="button" aria-pressed={active === sheet} aria-controls={`${id}-${sheet === 'result' ? 'result' : sheet === 'turns' ? 'timeline' : 'detail'}`} onClick={() => showSheet(sheet)}>{fc(`report.${sheet}`)}</button>)}
    </div>
    <section id={`${id}-result`} className="context-panel report-result">
      <div className="panel-scroll">
        <header className="report-heading">
          <p className="report-eyebrow">{c('complete')}</p>
          <h1 className={result.outcome === 'SUCCESS' ? 'report-outcome-met' : 'report-outcome-missed'}>{outcome}</h1>
          <p className="report-meta"><strong>{labelText(t, definition.name)}</strong><span>{c('elapsed')}: <Duration seconds={result.elapsedSec}/></span>{result.assisted && <span className="report-badge">{c('assisted')}</span>}</p>
        </header>
        <ScoreSummary game={game}/>
        <h2 className="report-subhead">{fc('report.objectives')}</h2>
        <Evidence items={result.evidence} definition={definition}/>
        <p className="report-discovery"><Sparkles size={16} aria-hidden="true"/><span><strong>{c('discovery')}:</strong> {met.length ? met.join(' · ') : c('noDiscovery')}</span></p>
        {result.cause && <p className="report-cause">{t(result.cause, { defaultValue: t(`failure.${result.cause}.title`, { defaultValue: c(result.cause) }) })}</p>}
        {result.advice.length > 0 && <ul className="report-advice">{result.advice.map((advice, index) => <li key={index}>{t(advice, { defaultValue: c(advice) })}</li>)}</ul>}
      </div>
      <div className="panel-action report-actions">
        <button type="button" className="button primary" onClick={onRedesign} disabled={disabled}>{c('redesign')}</button>
        <button type="button" className="button" onClick={onRetry} disabled={disabled}>{c('retry')}</button>
        <button type="button" className="text-button" onClick={onTools}>{c('tools')}</button>
      </div>
    </section>
    <aside id={`${id}-detail`} className="context-panel report-detail" aria-label={fc('report.detail')}>
      <div className="report-tabs" role="tablist" aria-label={fc('report.detail')}>
        {tabs.map((item, index) => <button key={item} ref={element => { tabButtons.current[index] = element; }} type="button" role="tab" id={`${id}-tab-${item}`} aria-selected={tab === item} aria-controls={`${id}-panel`} tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)} onKeyDown={event => moveTab(event, index)}>{fc(`report.${item}`)}</button>)}
      </div>
      <div className="panel-scroll" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`}>
        {tab === 'turn' && <>
          {moment ? <TurnResultCard game={game} moment={moment}/> : <p className="fb-muted">{fc('report.noTurns')}</p>}
          {result.receipts.length > 0 && <details className="report-receipts"><summary>{fc('report.allReceipts', { count: result.receipts.length })}</summary>{result.receipts.map(receipt => <section key={receipt.id} className="report-receipt"><Receipt receipt={receipt} definition={definition}/></section>)}</details>}
        </>}
        {tab === 'science' && <>
          {met.length > 0 && <p className="report-note">{c('journalNote')}</p>}
          <ScienceConnection definition={definition}/>
          <ScienceLibrary discoveryIds={instrument ? ['radiation', 'source-evidence'] : ['data-return', 'kepler-orbits', 'energy-budget']}/>
        </>}
        {tab === 'compare' && <section className="report-compare">
          <h2>{c('comparison')}</h2>
          {previous ? <><p className="report-note">{c('compareNote')}</p><Comparison previous={previous} current={record}/></> : <p className="report-note">{c('noComparison')}</p>}
        </section>}
      </div>
    </aside>
    <section id={`${id}-timeline`} className="report-timeline">
      <TurnTimeline moments={moments} selected={current} onSelect={onSelectTurn}/>
    </section>
  </section>;
}
