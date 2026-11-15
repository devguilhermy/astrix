import { useTranslation } from 'react-i18next';
import { listParts, type SimEvent } from '@astrix/core';
import { useMission } from '../../store';
import { Panel, NumberValue } from '../primitives';
import { ExplainButton } from '../science/ExplainButton';
import { TechnicalDetails } from '../science/TechnicalDetails';
import { TeachingCard } from '../science/TeachingCard';
import { AlertIcon } from '../icons';
import { topicForContext } from '../science/registry';
import { CommandButton } from './FlightControls';
import { TechnicalSystems } from './TechnicalSystems';
import { openPartDetails } from '../inspector/openPart';

export function DecisionCard({event}:{event:SimEvent}) {
 const {t,i18n}=useTranslation(),telemetry=useMission(s=>s.telemetry)!,design=useMission(s=>s.design)!,decide=useMission(s=>s.decide),parts=listParts(design.busId),format=new Intl.NumberFormat(i18n.language,{maximumFractionDigits:2});
 const topic=topicForContext(`event.${event.kind}`);
 const off=telemetry.instruments.filter(instrument=>instrument.on&&!instrument.lost).map(instrument=>({kind:'INSTRUMENT',partId:instrument.partId,on:false}) as const);
 const monitor=telemetry.instruments.filter(instrument=>instrument.on&&!instrument.lost&&parts.find(part=>part.id===instrument.partId)?.metric!=='RADIATION_HOURS').map(instrument=>({kind:'INSTRUMENT',partId:instrument.partId,on:false}) as const);
 const low=['BROWNOUT','BATTERY_LOW','BATTERY_AGING'].includes(event.kind),storm=event.kind==='SOLAR_STORM_START',storage=event.kind==='STORAGE_NEAR_FULL',pass=event.kind==='PASS_START';
 return <Panel className="decision-card" title={<><AlertIcon size={20}/>{t('ui.decision')}</>} id="mission-decision">
  <div className="spread"><h2 id="decision-heading" tabIndex={-1}>{t(`event.${event.kind}.title`,event.values)}</h2><ExplainButton topic={topic}/></div>
  <TeachingCard topic={topic} context={`event.${event.kind}`} values={{[t('ui.shadowBattery')]:`${format.format(telemetry.socWh)} Wh`}}/>
  <details><summary>{t('hud.details')}</summary><p>{t(`event.${event.kind}.body`,event.values)}</p><p>{t('ui.decisionCost')}</p></details>
  <dl><dt>{t('ui.shadowBattery')}</dt><dd><NumberValue value={telemetry.socWh} unit="Wh"/> / <NumberValue value={telemetry.capacityWh} unit="Wh"/></dd>
   <dt>{t('ui.storage')}</dt><dd><NumberValue value={telemetry.storedMB} unit="MB"/> / <NumberValue value={telemetry.storageMB} unit="MB"/></dd>
   <dt>{t('ui.generation')}</dt><dd><NumberValue value={telemetry.genW} unit="W"/> / <NumberValue value={telemetry.loadW} unit="W"/></dd>
   <dt>{t('ui.contact')}</dt><dd>{t(telemetry.inContact?'ui.connected':'ui.noContact')}</dd>
  </dl>
  <div className="button-wrap">
   {(storm||low)&&<button className="button" onClick={()=>decide([{kind:'SAFE',on:true}])}>{t('ui.protect')}</button>}
   {low&&!telemetry.safe&&<button className="button" onClick={()=>decide([{kind:'POINT',mode:'SUN'}])}>{t('ui.charge')}</button>}
   {storm&&<button className="button" onClick={()=>decide(monitor)}>{t('ui.monitorOnly')}</button>}
   {(storage||low)&&<button className="button" onClick={()=>decide(off)}>{t('ui.pauseInstruments')}</button>}
   {(storage||pass)&&<><button className="button" onClick={()=>decide([{kind:'POINT',mode:'EARTH'}])}>{t('ui.pointHome')}</button><button className="button" onClick={()=>decide([{kind:'DOWNLINK',on:true}])}>{t('ui.send')}</button></>}
   {event.kind==='LINK_DEGRADED'&&<button className="button" onClick={()=>decide([{kind:'LINK_MODE',mode:'ROBUST'}])}>{t('technical.link.ROBUST')}</button>}
   {event.kind==='POINTING_DEGRADED'&&<button className="button" onClick={()=>decide([{kind:'REACQUIRE_POINTING'}])}>{t('ui.command.REACQUIRE_POINTING')}</button>}
   <button className="button" onClick={()=>decide([])}>{t('ui.continuePaused')}</button>
  </div>
 </Panel>;
}
export function OperateScreen() {
 const {t,i18n}=useTranslation(),telemetry=useMission(s=>s.telemetry),design=useMission(s=>s.design),format=new Intl.NumberFormat(i18n.language,{maximumFractionDigits:2});
 if(!telemetry||!design)return null;
 const parts=listParts(design.busId);
 return <div className="phase-content">
  <header className="phase-title"><h1>{t('phase.OPERATE')}</h1><ExplainButton topic="operational-cycle"/></header>
  <section id="science-return" data-cue-target="science-return"><h2>{t('ui.instrument')}</h2>{telemetry.instruments.map(instrument=><div key={instrument.partId} className="instrument-row"><strong>{t(parts.find(part=>part.id===instrument.partId)!.nameKey)}</strong><span className="chip">{t(instrument.lost?'ui.lost':instrument.on?'ui.on':'ui.off')}</span><CommandButton command={{kind:'INSTRUMENT',partId:instrument.partId,on:!instrument.on}} label={t(instrument.on?'ui.off':'ui.on')}/><ExplainButton topic="instrument-risk"/></div>)}</section>
  {telemetry.crew&&<section><h2>{t('flow.crew')}</h2><TeachingCard topic="crew-inventories" context="operations.crew.stores" values={{[t('flow.runway')]:`${format.format(telemetry.crew.daysRemaining)} d`}}/><TeachingCard topic="crew-atmosphere" context="operations.crew.atmosphere" values={{'CO₂':`${format.format(telemetry.crew.co2MmHg)} mmHg`}}/><TeachingCard topic="crew-procedures" context="operations.crew.procedures"/><TeachingCard topic="crew-return" context="operations.crew.return"/><p>{t('flow.runway')}: <NumberValue value={telemetry.crew.daysRemaining} unit="d"/> · {t(`flow.store.${telemetry.crew.limiting}`)}</p><p>O₂: <NumberValue value={telemetry.crew.oxygenKg} unit="kg"/> · H₂O: <NumberValue value={telemetry.crew.waterKg} unit="kg"/> · CO₂: <NumberValue value={telemetry.crew.co2MmHg} unit="mmHg"/></p><p>{t('flow.fan')}: {t(telemetry.crew.fanOn?'ui.on':'ui.off')} · {t(`flow.phase.${telemetry.crew.phase}`)}</p><div className="button-wrap"><CommandButton command={{kind:'CREW_FAN',on:!telemetry.crew.fanOn}} label={t('flow.fan')}/><CommandButton command={{kind:'CREW_CARTRIDGE'}} label={t('flow.cartridge')}/><CommandButton command={{kind:'CREW_ISOLATE',isolated:true}} label={t('flow.isolate')}/><CommandButton command={{kind:'CREW_REPRESSURIZE'}} label={t('flow.repressurize')}/><CommandButton command={{kind:'CREW_PRIORITIZE_POWER',on:true}} label={t('flow.priorityPower')}/><CommandButton command={{kind:'CREW_DEORBIT'}} label={t('flow.deorbit')}/></div></section>}
  {telemetry.crew&&<details><summary>{t('hud.details')}</summary><p>{t('flow.returnPolicy')}</p><p>{telemetry.crew.returnWindowOpen?t('flow.returnOpen'):telemetry.crew.nextReturnWindowSec===null?t('flow.unknown'):t('flow.returnNext',{seconds:Math.ceil(telemetry.crew.nextReturnWindowSec)})}</p><p>{t('flow.fanWorking')}: {t(telemetry.crew.fanWorking?'ui.on':'ui.off')} · CO₂: <NumberValue value={telemetry.crew.co2AverageMmHg} unit="mmHg"/> · O₂: <NumberValue value={telemetry.crew.inspiredOxygenAverageMmHg} unit="mmHg"/></p></details>}
  {telemetry.cruise&&<section id="cruise"><h2>{t('ui.cruise')}</h2><ExplainButton topic="transfer-orbits"/><details><summary>{t('hud.modelLimits')}</summary><p>{t('ui.cruiseBody')}</p></details></section>}
  {!telemetry.cruise&&<details open={telemetry.levelId==='EXPERT'||undefined}><summary>{t('hud.subsystems')}</summary><TechnicalSystems telemetry={telemetry}/></details>}
  <details><summary>{t('flow.asFlown')}</summary><p>{design.rideId} · {design.stationId} · r{design.revision}</p><p>{t('inspector.componentsHint')}</p><ul className="as-flown-parts">{design.parts.map(part=>{const name=t(parts.find(item=>item.id===part.partId)!.nameKey);return <li key={part.partId}><button type="button" className="text-button" aria-label={t('inspector.inspect',{name})} onClick={event=>openPartDetails(part.partId,event.currentTarget)}>{name}</button> × {part.qty}</li>;})}</ul></details>
  <TeachingCard topic="pointing" context="operations.pointing"/><TeachingCard topic="command-transport" context="operations.command-transport"/>
  <TechnicalDetails><dl><dt>{t('ui.generation')}</dt><dd><NumberValue value={telemetry.genW} unit="W"/> / <NumberValue value={telemetry.loadW} unit="W"/></dd><dt>{t('ui.dose')}</dt><dd><NumberValue value={telemetry.doseUGyH} unit="µGy/h"/></dd><dt>{t('ui.progress')}</dt><dd><NumberValue value={telemetry.downlinkedMB} unit="MB"/></dd></dl></TechnicalDetails>
 </div>;
}
