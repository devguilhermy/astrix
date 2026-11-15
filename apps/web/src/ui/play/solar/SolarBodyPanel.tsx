import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { BodyId } from '@astrix/core';
import { SOLAR_FACT_IDS, SOLAR_FACT_SOURCES, SOLAR_FACTS, type SolarFactId } from '@astrix/data';
import { ArrowDownToLine, ChevronLeft, ChevronRight, Clock, ExternalLink, Image as ImageIcon, Moon, MoveHorizontal, Orbit, Rocket, Ruler, Thermometer, Weight, X, type LucideIcon } from 'lucide-react';
import { solarImageNote } from '../../../three/SolarSystemScene';
import { useSolarCopy } from './copy';
import './solar.css';

const MISSION_BODIES: readonly SolarFactId[] = ['SUN', 'EARTH', 'MOON', 'MARS'] satisfies readonly BodyId[];
/** Bars span ±log10(200) around Earth: wide enough for the Sun's 109× diameter and Mercury's 176× day. */
const LOG_SPAN = Math.log10(200);

export function SolarBodyPanel({ body, onSelect, onMissions }: { body: SolarFactId; onSelect: (id: SolarFactId | 'SYSTEM') => void; onMissions?: (destination: BodyId) => void }) {
  const c = useSolarCopy();
  const { i18n } = useTranslation();
  const pt = i18n.resolvedLanguage?.startsWith('pt') ?? false;
  const locale = pt ? 'pt-BR' : 'en';
  const titleId = useId();
  const fact = SOLAR_FACTS[body], earth = SOLAR_FACTS.EARTH, sun = body === 'SUN';
  const source = SOLAR_FACT_SOURCES.find(item => item.url === fact.factSheetUrl);
  const index = SOLAR_FACT_IDS.indexOf(body);
  const previous = SOLAR_FACT_IDS[(index + SOLAR_FACT_IDS.length - 1) % SOLAR_FACT_IDS.length]!, next = SOLAR_FACT_IDS[(index + 1) % SOLAR_FACT_IDS.length]!;
  const name = c(`body.${body}`);
  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value);
  const facts: readonly [LucideIcon, string, string][] = [
    [Ruler, c('diameter'), `${number(fact.diameterKm)} km`],
    [Weight, c('mass'), `${number(fact.massE24Kg)} ${c('massUnit')}`],
    [ArrowDownToLine, c('gravity'), `${number(fact.gravityMs2)} m/s²`],
    [Clock, c(sun ? 'rotation' : 'day'), c('hours', { value: number(fact.dayHours) })],
    [Orbit, c('year'), fact.orbitDays === null ? c('notApplicable') : c(fact.distanceFrom === 'EARTH' ? 'daysAroundEarth' : 'days', { value: number(fact.orbitDays) })],
    [MoveHorizontal, c('distance'), fact.distanceE6Km === null ? c('solarCentre') : c(fact.distanceFrom === 'EARTH' ? 'fromEarth' : 'fromSun', { value: number(fact.distanceE6Km) })],
    [Thermometer, c(sun ? 'effectiveTemperature' : 'temperature'), sun ? `${number(Math.round(fact.meanTempC + 273.15))} K (${number(Math.round(fact.meanTempC))} °C)` : `${number(fact.meanTempC)} °C`],
    [Moon, c('moons'), fact.moons === null ? c('notApplicable') : number(fact.moons)]
  ];
  const comparisons: readonly [string, number][] = [
    [c('compareDiameter'), fact.diameterKm / earth.diameterKm],
    [c('compareGravity'), fact.gravityMs2 / earth.gravityMs2],
    [c(sun ? 'compareRotation' : 'compareDay'), fact.dayHours / earth.dayHours]
  ];
  const destination = MISSION_BODIES.includes(body) ? body as BodyId : null;
  return <aside className="dossier context-panel" aria-labelledby={titleId} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onSelect('SYSTEM'); } }}>
    <header className="dossier-header">
      <div className="dossier-title">
        <h2 id={titleId}>{name}</h2>
        <span className="dossier-kind">{c(`kind.${fact.kind}`)}</span>
      </div>
      <nav className="dossier-nav" aria-label={c('bodyNav')}>
        <button type="button" onClick={() => onSelect(previous)} aria-label={c('previous', { name: c(`body.${previous}`) })} title={c(`body.${previous}`)}><ChevronLeft size={20} aria-hidden="true"/></button>
        <button type="button" onClick={() => onSelect(next)} aria-label={c('next', { name: c(`body.${next}`) })} title={c(`body.${next}`)}><ChevronRight size={20} aria-hidden="true"/></button>
        <button type="button" onClick={() => onSelect('SYSTEM')} aria-label={c('close')} title={c('close')}><X size={20} aria-hidden="true"/></button>
      </nav>
    </header>
    <div className="panel-scroll dossier-scroll">
      <p className="dossier-sentence">{pt ? fact.sentence.pt : fact.sentence.en}</p>
      <h3 className="sr-only">{c('facts')}</h3>
      <dl className="dossier-facts">
        {facts.map(([Icon, label, value]) => <div className="dossier-fact" key={label}><dt><Icon size={15} aria-hidden="true"/>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <section className="dossier-compare">
        <h3>{c('compare')}</h3>
        {body === 'EARTH' ? <p className="dossier-muted">{c('compareReference')}</p> : <>
          <ul>
            {comparisons.map(([label, ratio]) => {
              const extent = Math.min(1, Math.abs(Math.log10(ratio)) / LOG_SPAN);
              const ratioText = new Intl.NumberFormat(locale, ratio >= 10 ? { maximumFractionDigits: 0 } : { maximumSignificantDigits: 2 }).format(ratio);
              return <li key={label}><span className="dossier-compare-label">{label}</span><span className="dossier-bar" aria-hidden="true"><span className="dossier-bar-fill" data-side={ratio >= 1 ? 'up' : 'down'} style={{ width: `max(2px, ${(extent * 50).toFixed(2)}%)` }}/></span><span className="dossier-ratio">{c('ratio', { value: ratioText })}</span></li>;
            })}
          </ul>
          <p className="dossier-muted">{c('compareScale')}</p>
        </>}
      </section>
      <ul className="dossier-flags">
        <li data-on={fact.rings}>{c('rings')}: <strong>{c(fact.rings ? 'yes' : 'no')}</strong></li>
        <li data-on={fact.magneticField}>{c('magneticField')}: <strong>{c(fact.magneticField ? 'yes' : 'no')}</strong></li>
      </ul>
      <section className="dossier-explored">
        <h3>{c('exploredBy')}</h3>
        <ul>{fact.exploredBy.map(item => <li key={item.name}><a href={item.url} target="_blank" rel="noreferrer" title={c('exploredByNote')}>{c(`explorer.${item.name}`, { defaultValue: item.name })}<ExternalLink size={13} aria-hidden="true"/></a></li>)}</ul>
      </section>
      <p className="dossier-note"><ImageIcon size={15} aria-hidden="true"/><span><strong>{c('imageNote')}:</strong> {solarImageNote(body, pt)}</span></p>
      <p className="dossier-note dossier-scale">{c('scale')}</p>
      {source && <p className="dossier-source">{c('source')} <a href={source.url} target="_blank" rel="noreferrer">{c(`source.${source.id}`)}</a>, {c('retrieved', { date: source.retrieved })}</p>}
    </div>
    {destination ? onMissions && <div className="panel-action dossier-action"><button type="button" className="button primary" onClick={() => onMissions(destination)}><Rocket size={17} aria-hidden="true"/>{c('missionsHere')}</button></div>
      : <div className="panel-action dossier-action"><p className="dossier-muted">{c('explorationOnly')}</p></div>}
  </aside>;
}
