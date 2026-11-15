import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleExclamationPoint } from 'lucide-react';
import type { TurnGameState, TurnReceipt } from '@astrix/core';
import { Duration } from '../Evidence';
import { usePlayCopy } from '../copy';
import { planIcons } from '../planIcons';
import { turnMoments, type TurnMoment } from '../turnMoments';
import { useFeedbackCopy } from './copy';
import { formatSigned } from './format';
import { inventoryOf, turnLevels, type Level } from './levels';
import { ObservationFrame } from './ObservationFrame';
import { ReadingChart } from './ReadingChart';
import { SignalStrip } from './SignalStrip';
import './feedback.css';

/** The material event that stopped an interrupted plan: the receipt's last auto-pause event. */
function interruptionOf(receipt: TurnReceipt | undefined): TurnReceipt['events'][number] | undefined {
  if (!receipt?.interrupted) return undefined;
  for (let index = receipt.events.length - 1; index >= 0; index--) if (receipt.events[index]!.autoPause) return receipt.events[index];
  return undefined;
}

/** What one committed turn did: headline, the simulated frame, reading or signal, resource deltas and objective progress. */
export function TurnResultCard({ game, moment, compact = false }: { game: TurnGameState; moment: TurnMoment; compact?: boolean }) {
  const fc = useFeedbackCopy(), c = usePlayCopy(), { t, i18n } = useTranslation(), locale = i18n.resolvedLanguage;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const receipt = game.receipts.find(item => item.id === moment.receiptId) ?? game.receipts.find(item => item.revision === moment.index);
  const moments = useMemo(() => turnMoments(game), [game]);
  const levels = useMemo(() => turnLevels(game.receipts, moment.index, inventoryOf(game)), [game, moment.index]);
  const Icon = planIcons[moment.kind], plan = c(`action.${moment.kind}`), interruption = interruptionOf(receipt);
  const headline = moment.interrupted ? fc('headInterrupted', { plan }) : fc(`head.${moment.kind}`);
  const cause = interruption ? t(`event.${interruption.kind}.title`, { ...interruption.values, defaultValue: t(`failure.${interruption.kind}.title`, { defaultValue: interruption.kind }) }) : null;
  const before = moments.find(item => item.index === moment.index - 1)?.progress ?? 0, after = moment.progress;
  if (compact) {
    const summary = moment.deliveredMB > 0 ? fc('returned', { value: number.format(moment.deliveredMB) }) : moment.capturedMB > 0 ? fc('captured', { value: number.format(moment.capturedMB) }) : `${c('energy')} ${formatSigned(moment.delta.energyWh, locale)} Wh`;
    return <article className="fb-card fb-card-compact">
      <Icon size={18} aria-hidden="true"/>
      <p><strong>{fc('turnN', { index: moment.index })} · {plan}</strong><span>{summary}</span><span className="fb-muted"><Duration seconds={moment.endSec - moment.startSec}/></span>{moment.interrupted && <span className="fb-card-flag"><TriangleExclamationPoint size={16} aria-hidden="true"/>{fc('timeline.interrupted')}</span>}</p>
      <span className="fb-card-progress"><span className="fb-visually-hidden">{fc('progress')}: </span>{percent.format(after)}</span>
    </article>;
  }
  const instrument = game.design.definition.objectives.some(item => item.spec.kind === 'INSTRUMENT_HOURS');
  const frame = !instrument && moment.capturedMB > 0 && moment.frame !== null, reading = instrument && (moment.capturedMB > 0 || moment.kind === 'OBSERVE'), signal = moment.deliveredMB > 0;
  const deltas: [string, number, string][] = [['fuel', moment.delta.fuelKg, 'kg'], ['energy', moment.delta.energyWh, 'Wh'], ['stored', moment.delta.storedMB, 'MB'], ['data', moment.delta.deliveredMB, 'MB']];
  const bars: [string, Level, string][] | null = levels ? [['energy', levels.energyWh, 'Wh'], ['stored', levels.storedMB, 'MB'], ...(levels.fuelKg ? [['fuel', levels.fuelKg, 'kg'] as [string, Level, string]] : [])] : null;
  return <article className="fb-card">
    <header className="fb-card-head">
      <span className={`fb-card-icon${moment.interrupted ? ' fb-card-icon-alert' : ''}`}><Icon size={20} aria-hidden="true"/></span>
      <div><p className="fb-card-turn">{fc('turnN', { index: moment.index })} · {plan} · <Duration seconds={moment.endSec - moment.startSec}/></p><h3>{headline}</h3></div>
    </header>
    {cause && <p className="fb-card-cause"><TriangleExclamationPoint size={16} aria-hidden="true"/>{fc('cause', { cause })}</p>}
    {receipt && receipt.outcome !== 'PROVISIONAL' && <p className={`fb-card-outcome${receipt.outcome === 'SUCCESS' ? ' fb-card-outcome-met' : ''}`}>{fc(`outcome.${receipt.outcome}`)}</p>}
    {frame && <ObservationFrame game={game} moment={moment}/>}
    {reading && <ReadingChart moment={moment}/>}
    {signal && <SignalStrip returnedMB={moment.deliveredMB} remainingMB={levels?.storedMB.after ?? 0}/>}
    {!frame && !reading && !signal && bars && <div className="fb-levels" role="group" aria-label={fc('levels')}>
      <p className="fb-levels-legend" aria-hidden="true"><span className="fb-levels-before">{fc('before')}</span><span className="fb-levels-after">{fc('after')}</span></p>
      {bars.map(([key, level, unit]) => <div key={key} className="fb-level">
        <span className="fb-level-label">{c(key)}</span>
        <span className="fb-level-bars" aria-hidden="true"><span className="fb-level-before" style={{ width: `${level.max > 0 ? level.before / level.max * 100 : 0}%` }}/><span className="fb-level-after" style={{ width: `${level.max > 0 ? level.after / level.max * 100 : 0}%` }}/></span>
        <output>{number.format(level.before)} → {number.format(level.after)} {unit}</output>
      </div>)}
    </div>}
    <dl className="fb-deltas" title={fc('changes')}>{deltas.map(([key, value, unit]) => <div key={key} className={value > 0 ? 'fb-delta-up' : value < 0 ? 'fb-delta-down' : ''}><dt>{c(key)}</dt><dd>{formatSigned(value, locale)} {unit}</dd></div>)}</dl>
    <div className="fb-progress">
      <p><span>{fc('progress')}</span><output>{percent.format(before)} → {percent.format(after)}</output></p>
      <span className="fb-progress-track" aria-hidden="true"><span className="fb-progress-after" style={{ width: `${after * 100}%` }}/><span className="fb-progress-before" style={{ left: `${before * 100}%` }}/></span>
    </div>
  </article>;
}
