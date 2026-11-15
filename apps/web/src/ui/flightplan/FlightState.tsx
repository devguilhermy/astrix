import { useTranslation } from 'react-i18next';
import type { BurnReceipt, FlightTelemetry, Telemetry } from '@astrix/core';
import { useMission } from '../../store';
import { CommandButton } from '../phases/FlightControls';
import { ExplainButton } from '../science/ExplainButton';
import { allowsManeuvers } from '../missions/definitionView';
import { BurnPlanner } from './BurnPlanner';
import { OrbitSummary, Row, TrajectoryEvents, formatClock, useNumbers } from './parts';
import './flightplan.css';

export function BurnReceipts({ receipts }: { receipts: readonly BurnReceipt[] }) {
  const { t } = useTranslation(), number = useNumbers(3);
  if (!receipts.length) return <p className="muted">{t('flight.burn.noReceipts')}</p>;
  return <ol className="burn-receipts" aria-label={t('flight.burn.receipts')}>{receipts.map(receipt => <li key={`${receipt.id}:${receipt.atSec}`} data-status={receipt.status}>
    <div className="spread"><strong>{receipt.id}</strong><span className={`chip ${receipt.status === 'EXECUTED' ? 'state-MET' : receipt.status === 'PARTIAL' ? 'warning' : 'state-FAILED'}`}>{t(`flight.burn.receipt.${receipt.status}`)}</span></div>
    <small>T+ {formatClock(receipt.atSec)} · {t(`flight.burn.source.${receipt.source}`)} · {t('flight.burn.requested')} {number.format(receipt.requestedDvKms)} km/s · {t('flight.burn.achievedDv')} {number.format(receipt.achievedDvKms)} km/s · {number.format(receipt.propellantUsedKg)} kg</small>
    {receipt.reason && <small className="field-issue">{t(`refusal.${receipt.reason}`, { defaultValue: receipt.reason })}</small>}
  </li>)}</ol>;
}

function AscentBlock({ flight }: { flight: FlightTelemetry }) {
  const { t } = useTranslation(), number = useNumbers(2), ascent = flight.ascent;
  if (!ascent) return null;
  return <section aria-label={t('flight.ascent')}><h3>{t('flight.ascent')}</h3><dl className="kv-grid">
    <Row label={t('flight.ascentStage')}>{ascent.stageIndex + 1}</Row>
    <Row label={t('flight.thrust')}>{number.format(ascent.thrustKN)} kN · {number.format(ascent.throttle * 100)}%</Row>
    <Row label={t('flight.dynamicPressure')}>{number.format(ascent.dynamicPressurePa / 1000)} kPa</Row>
    <Row label={t('flight.downrange')}>{number.format(ascent.downrangeKm)} km</Row>
    <Row label={t('flight.flightPath')}>{number.format(ascent.flightPathDeg)}°</Row>
    <Row label={t('flight.cutoff')}>{t(`flight.cutoff.${ascent.cutoff}`)}</Row>
    {ascent.separatedAtSec !== null && <Row label={t('flight.separated')}>T+ {formatClock(ascent.separatedAtSec)}</Row>}
  </dl></section>;
}

/** Actual simulated flight state: nothing here is predicted or animated; forecasts live in the burn planner. */
export function FlightStatePanel({ telemetry }: { telemetry: Telemetry }) {
  const { t } = useTranslation(), number = useNumbers(2), definition = useMission(state => state.definition), flight = telemetry.flight;
  if (!flight) return null;
  const stage = flight.mass.stage;
  return <section className="flight-state" id="flight-state" aria-labelledby="flight-state-heading" data-cue-target="flight-state">
    <header className="spread"><h2 id="flight-state-heading">{t('flight.stateTitle')}</h2><ExplainButton topic="orbit-height" context="flight.state"/></header>
    <p><span className="chip">{t(`flight.missionPhase.${flight.phase}`)}</span> <span className="muted">{t('flight.stateActual')}</span></p>
    <dl className="kv-grid">
      <Row label={t('flight.centralBody')}>{t(`flight.body.${flight.view.central.body}`)}</Row>
      <Row label={t('flight.altitude')}>{number.format(flight.view.altitudeKm)} km</Row>
      <Row label={t('flight.speed')}>{number.format(flight.view.speedKms)} km/s</Row>
      <Row label={t('flight.totalMass')}>{number.format(flight.mass.totalKg)} kg</Row>
      <Row label={t('flight.craftPropellant')}>{number.format(flight.mass.spacecraftPropellantKg)} kg</Row>
      {stage && <Row label={t('flight.upperStage')}>{t(stage.attached ? 'flight.attached' : 'flight.separatedState')} · {number.format(stage.propellantKg)} kg · {t('flight.restarts', { count: stage.restartsLeft })}</Row>}
    </dl>
    <AscentBlock flight={flight}/>
    {stage?.attached && <div className="button-wrap"><CommandButton command={{ kind: 'SEPARATE_STAGE' }} label={t('flight.separateStage')}/></div>}
    <section aria-label={t('flight.orbitTitle')}><h3>{t('flight.orbitTitle')}</h3><OrbitSummary orbit={flight.orbit}/></section>
    <section aria-label={t('flight.burn.receipts')}><h3>{t('flight.burn.receipts')}</h3><BurnReceipts receipts={flight.burns}/></section>
    {allowsManeuvers(definition) && <details className="flight-burns" open><summary>{t('flight.burn.titleFlight')}</summary><BurnPlanner/></details>}
    <details><summary>{t('flight.trajectoryEvents')}</summary><TrajectoryEvents events={flight.trajectoryEvents} limit={24} label={t('flight.trajectoryEvents')}/></details>
    <details><summary>{t('hud.modelLimits')}</summary><ul>{flight.limits.map(key => <li key={key}>{t(key, { defaultValue: t('flight.modelLimitUnnamed', { key }) })}</li>)}</ul></details>
  </section>;
}
