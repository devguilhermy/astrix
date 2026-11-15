import { useTranslation } from 'react-i18next';
import { listLaunchers, type Design, type Telemetry } from '@astrix/core';
import { BurnReceipts } from './FlightState';
import { OrbitSummary, Row, TrajectoryEvents, formatClock, useNumbers } from './parts';

/** Planned versus flown, from the recorded run: the burn plan the player froze, the receipts that resulted, and the trajectory events. */
export function FlightRecord({ telemetry, design }: { telemetry: Telemetry; design: Design }) {
  const { t } = useTranslation(), number = useNumbers(2), flight = telemetry.flight;
  if (!flight) return null;
  const receipts = new Map(flight.burns.map(receipt => [receipt.id, receipt]));
  return <section className="flight-record" aria-labelledby="flight-record-heading"><h3 id="flight-record-heading">{t('report.flightRecord')}</h3>
    <dl className="kv-grid">
      <Row label={t('report.finalPhase')}>{t(`flight.missionPhase.${flight.phase}`)}</Row>
      <Row label={t('flight.centralBody')}>{t(`flight.body.${flight.view.central.body}`)}</Row>
      <Row label={t('flight.totalMass')}>{number.format(flight.mass.totalKg)} kg</Row>
      <Row label={t('flight.craftPropellant')}>{number.format(flight.mass.spacecraftPropellantKg)} kg</Row>
    </dl>
    <h4>{t('report.finalOrbit')}</h4><OrbitSummary orbit={flight.orbit}/>
    {design.launch && <><h4>{t('report.plannedAscent')}</h4><p className="muted">{t('report.plannedAscentNote', { launcher: t(listLaunchers().find(item => item.id === design.launch!.launcherId)?.nameKey ?? design.launch.launcherId), azimuth: number.format(design.launch.program.azimuthDeg), coast: number.format(design.launch.program.stage2CoastSec), insertion: number.format(design.launch.program.insertionAltKm) })}</p></>}
    <h4>{t('report.plannedVsFlown')}</h4>
    {design.burns.length === 0 ? <p className="muted">{t('flight.burn.nonePlanned')}</p> : <table className="plan-table"><thead><tr><th scope="col">{t('flight.burn.id')}</th><th scope="col">{t('flight.burn.requested')}</th><th scope="col">{t('flight.burn.achievedDv')}</th><th scope="col">{t('report.outcome')}</th></tr></thead><tbody>{design.burns.map(burn => { const receipt = receipts.get(burn.id), planned = Math.hypot(...burn.dv); return <tr key={burn.id}><th scope="row">{burn.id}</th><td>{number.format(planned)} km/s</td><td>{receipt ? `${number.format(receipt.achievedDvKms)} km/s · T+ ${formatClock(receipt.atSec)}` : t('report.notFlown')}</td><td>{receipt ? t(`flight.burn.receipt.${receipt.status}`) : t('report.notFlown')}</td></tr>; })}</tbody></table>}
    <h4>{t('flight.burn.receipts')}</h4><BurnReceipts receipts={flight.burns}/>
    <h4>{t('flight.trajectoryEvents')}</h4><TrajectoryEvents events={flight.trajectoryEvents} limit={40} label={t('flight.trajectoryEvents')}/>
  </section>;
}
