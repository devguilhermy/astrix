import { useTranslation } from 'react-i18next';
import { listParts, type Budgets, type Telemetry } from '@astrix/core';
import { useMission } from '../../store';
import { Panel, NumberValue } from '../primitives';
import { ExplainButton } from '../science/ExplainButton';
import { CommandButton } from './FlightControls';

export function TechnicalForecast({budgets}:{budgets:Budgets}) {
 const {t}=useTranslation(),technical=budgets.technical;
 if(!technical)return null;
 return <section id="technical-forecast" className="budget-group">
  <div className="spread"><h3>{t('technical.forecast')}</h3><ExplainButton topic="power-aging"/></div>
  <dl><dt>{t('technical.bolGeneration')}</dt><dd><NumberValue value={technical.bolGenerationW} unit="W"/></dd>
   <dt>{t('technical.eolGeneration')}</dt><dd><NumberValue value={technical.eolGenerationW} unit="W"/></dd>
   <dt>{t('technical.eolReserve')}</dt><dd><NumberValue value={technical.eolUsableBatteryWh} unit="Wh"/> / <NumberValue value={technical.eclipseRequiredWh} unit="Wh"/></dd>
   <dt>{t('technical.thermalBounds')}</dt><dd><NumberValue value={technical.thermalColdEquilibriumK} unit="K"/> – <NumberValue value={technical.thermalHotEquilibriumK} unit="K"/></dd>
   <dt>{t('technical.recordingRequired')}</dt><dd><NumberValue value={technical.recordingRequiredMB} unit="MB"/></dd>
   <dt>{t('technical.minimumLink')}</dt><dd><NumberValue value={technical.minimumLinkKbps} unit="kbps"/></dd>
   {technical.planningCaptureKms>0&&<><dt>{t('technical.captureUpper')}</dt><dd><NumberValue value={technical.planningCaptureKms} unit="km/s" digits={3}/><ExplainButton topic="capture-reserve"/></dd></>}
  </dl><p className="small muted">{t('technical.assumptions')}</p>
 </section>;
}

export function TechnicalSystems({telemetry}:{telemetry:Telemetry}) {
 const {t}=useTranslation(),design=useMission(s=>s.design)!;
 if(telemetry.levelId!=='EXPERT')return null;
 const {thermal,powerLife,pointing,link,computer,capture}=telemetry,parts=listParts(design.busId);
 return <section className="technical-systems" aria-label={t('technical.systems')}>
  <p className="learning-note">{t('technical.onboard')}</p>
  {thermal&&<Panel id="technical-thermal" title={t('science.thermal-control.title')}>
   <div className="spread"><strong><NumberValue value={thermal.temperatureK} unit="K"/></strong><ExplainButton topic="thermal-control"/></div>
   <dl><dt>{t('technical.operatingRange')}</dt><dd><NumberValue value={thermal.operatingMinK} unit="K"/> – <NumberValue value={thermal.operatingMaxK} unit="K"/></dd>
    <dt>{t('technical.trend')}</dt><dd><NumberValue value={thermal.trendKPerHour} unit="K/h"/></dd>
    <dt>{t('technical.thermalState')}</dt><dd>{t(thermal.inhibited?'technical.inhibited':'technical.operating')}</dd>
    <dt>{t('technical.heatBalance')}</dt><dd><NumberValue value={thermal.externalW+thermal.internalW+thermal.heaterW} unit="W"/> / <NumberValue value={thermal.radiatedW} unit="W"/></dd>
    <dt>{t('technical.heaterDraw')}</dt><dd><NumberValue value={thermal.heaterW} unit="W"/></dd>
    <dt>{t('ui.command.HEATER')}</dt><dd>{t(`technical.heater.${thermal.heaterMode}`)}</dd>
    <dt>{t('technical.survivalDwell')}</dt><dd><NumberValue value={thermal.survivalDwellSec} unit="s"/></dd>
   </dl><div className="button-wrap">{(['OFF','ON','AUTO'] as const).map(mode=><CommandButton key={mode} command={{kind:'HEATER',mode}} label={t(`technical.heater.${mode}`)}/>)}</div>
  </Panel>}
  <Panel id="technical-power" title={t('science.power-aging.title')}>
   <ExplainButton topic="power-aging"/><dl><dt>{t('technical.arrayFactor')}</dt><dd><NumberValue value={powerLife.arrayFactor*100} unit="%"/></dd>
    <dt>{t('technical.batteryFactor')}</dt><dd><NumberValue value={powerLife.batteryFactor*100} unit="%"/></dd>
    <dt>{t('technical.nominalCapacity')}</dt><dd><NumberValue value={powerLife.nominalCapacityWh} unit="Wh"/></dd>
    <dt>{t('technical.capacityDiscarded')}</dt><dd><NumberValue value={powerLife.capacityLostWh} unit="Wh"/></dd>
   </dl><p className="small muted">{t('technical.accelerated')}</p>
  </Panel>
  <Panel id="technical-pointing" title={t('science.pointing-recovery.title')}>
   <ExplainButton topic="pointing-recovery"/><dl><dt>{t('technical.requested')}</dt><dd>{telemetry.attitude.hold==='MANUAL'?t('hud.manualAttitude'):t(`ui.${telemetry.attitude.hold}`)}</dd>
    <dt>{t('technical.pointingState')}</dt><dd>{t(`technical.pointing.${pointing.state}`)}</dd>
    <dt>{t('technical.settleRemaining')}</dt><dd><NumberValue value={pointing.remainingSec} unit="s"/></dd>
    <dt>{t('technical.pointingQuality')}</dt><dd><NumberValue value={pointing.quality*100} unit="%"/></dd>
    <dt>{t('hud.panelSun')}</dt><dd><NumberValue value={telemetry.attitude.panelSunDeg} unit="°"/></dd>
    <dt>{t('hud.instrumentTarget')}</dt><dd><NumberValue value={telemetry.attitude.instrumentTargetDeg} unit="°"/></dd>
    <dt>{t('hud.antennaEarth')}</dt><dd><NumberValue value={telemetry.attitude.antennaEarthDeg} unit="°"/></dd>
    <dt>{t('hud.attitudeRate')}</dt><dd><NumberValue value={telemetry.attitude.rateRadSec} unit="rad/s"/></dd>
   </dl><CommandButton command={{kind:'REACQUIRE_POINTING'}} label={t('ui.command.REACQUIRE_POINTING')}/>
  </Panel>
  <Panel id="technical-link" title={t('science.link-resilience.title')}>
   <ExplainButton topic="link-resilience"/><dl><dt>{t('technical.geometry')}</dt><dd>{t(link.lineOfSight?'ui.connected':'ui.noContact')}</dd>
    <dt>{t('technical.allocation')}</dt><dd>{t(link.stationAllocated?'technical.available':'technical.unavailable')}</dd>
    <dt>{t('technical.uplink')}</dt><dd>{t(link.uplinkAvailable?'technical.available':'technical.unavailable')}</dd>
    <dt>{t('technical.linkQuality')}</dt><dd><NumberValue value={link.quality*100} unit="%"/></dd>
    <dt>{t('technical.linkReason')}</dt><dd>{t(`technical.linkReason.${link.unavailableReason}`)}</dd>
    <dt>{t('technical.normalRobust')}</dt><dd><NumberValue value={link.normalRateKbps} unit="kbps"/> / <NumberValue value={link.robustRateKbps} unit="kbps"/></dd>
    <dt>{t('technical.activeRate')}</dt><dd><NumberValue value={link.activeRateKbps} unit="kbps"/></dd>
    <dt>{t('ui.command.LINK_MODE')}</dt><dd>{t(`technical.link.${link.mode}`)}</dd>
    {link.nextOpportunitySec!==null&&<><dt>{t('technical.nextOpportunity')}</dt><dd><NumberValue value={link.nextOpportunitySec} unit="s"/></dd></>}
   </dl><div className="button-wrap">{(['NORMAL','ROBUST'] as const).map(mode=><CommandButton key={mode} command={{kind:'LINK_MODE',mode}} label={t(`technical.link.${mode}`)}/>)}</div>
  </Panel>
  <Panel id="technical-computer" title={t('science.onboard-recovery.title')}>
   <ExplainButton topic="onboard-recovery"/><dl><dt>{t('technical.computerState')}</dt><dd>{t(`technical.computer.${computer.state}`)}</dd>
    <dt>{t('technical.cooldown')}</dt><dd><NumberValue value={computer.cooldownRemainingSec} unit="s"/></dd>
    <dt>{t('technical.recoveryRemaining')}</dt><dd><NumberValue value={computer.recoveryRemainingSec} unit="s"/></dd>
    <dt>{t('technical.bootCost')}</dt><dd><NumberValue value={computer.bootEnergyWh} unit="Wh"/> + <NumberValue value={computer.bootPowerW} unit="W"/></dd>
    <dt>{t('technical.resetsRecoveries')}</dt><dd>{computer.resets} / {computer.recoveries}</dd>
   </dl><CommandButton command={{kind:'RECOVER_COMPUTER'}} label={t('ui.command.RECOVER_COMPUTER')}/>
  </Panel>
  <Panel id="technical-duty" title={t('technical.duty')}>
   <ExplainButton topic="energy-budget"/>{telemetry.instruments.map(instrument=><fieldset key={instrument.partId}>
    <legend>{t(parts.find(part=>part.id===instrument.partId)!.nameKey)} · <NumberValue value={instrument.dutyFraction*100} unit="%"/></legend>
    <div className="button-wrap">{[0,.25,.5,.75,1].map(fraction=><CommandButton key={fraction} command={{kind:'DUTY_CYCLE',partId:instrument.partId,fraction}} label={`${fraction*100}%`}/>)}</div>
   </fieldset>)}<p className="small muted">{t('technical.dutyNote')}</p>
  </Panel>
  {capture&&<Panel id="technical-capture" title={t('science.capture-reserve.title')}>
   <ExplainButton topic="capture-reserve"/><dl><dt>{t('technical.captureNominal')}</dt><dd><NumberValue value={capture.nominalKms} unit="km/s" digits={3}/></dd>
    <dt>{t('technical.captureUpper')}</dt><dd><NumberValue value={capture.planningKms} unit="km/s" digits={3}/></dd>
    <dt>{t('technical.captureReserve')}</dt><dd><NumberValue value={capture.reserveKms} unit="km/s" digits={3}/></dd>
    <dt>{t('technical.captureAvailable')}</dt><dd><NumberValue value={capture.availableKms} unit="km/s" digits={3}/></dd>
    {!telemetry.cruise&&!telemetry.capturePending&&<><dt>{t('technical.captureRealized')}</dt><dd><NumberValue value={capture.realizedKms} unit="km/s" digits={3}/></dd></>}
   </dl><p className="small muted">{t('technical.captureNote')}</p>
  </Panel>}
  <a href="/docs/TECHNICAL_MODELS.md" target="_blank" rel="noreferrer">{t('technical.parameterEvidence')}</a>
 </section>;
}
