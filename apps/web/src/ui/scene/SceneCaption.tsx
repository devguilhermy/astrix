import { useTranslation } from 'react-i18next';
import { orbitAltitudes, type Design, type Telemetry } from '@astrix/core';
import { hohmann } from '@astrix/core/physics';
import type { SceneKind, SceneStage } from '../../three/missionScenes';
import { ExplainButton } from '../science/ExplainButton';
import { sceneFamily, type DefinitionLike } from '../missions/definitionView';

export function SceneCaption({ design, definition, stage, kind, preview, hasFlight, running, telemetry, technical, reviewing = false, referenceOnly = false }: { design: Design; definition: DefinitionLike; stage: SceneStage; kind: SceneKind; preview: boolean; hasFlight: boolean; running: boolean; telemetry: Telemetry | null; technical: boolean; reviewing?: boolean; referenceOnly?: boolean }) {
 const { t, i18n } = useTranslation();
 const family = sceneFamily(definition), descriptionKey = i18n.exists(`scene.descriptions.${definition.id}`) ? `scene.descriptions.${definition.id}` : 'scene.descriptions.custom', imaging = family === 'imager';
 const number = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 2 });
 const status = reviewing ? 'recorded' : referenceOnly ? 'returnReference' : preview ? (hasFlight ? 'previewPaused' : 'preview') : !hasFlight ? 'setup' : telemetry?.ended ? 'ended' : running ? 'live' : 'paused';
 const altitudes = design.orbit ? orbitAltitudes(design.orbit) : null;
 const scaleKey = referenceOnly ? 'scene.returnReferenceDetail' : kind === 'transfer' ? 'scene.transfer' : kind === 'orbit' ? 'scene.orbitScale' : kind === 'assembly' ? 'scene.assemblyScale' : kind === 'flight' ? 'scene.flightScale' : 'scene.launch';
 return <section className="scene-caption" aria-label={t('scene.region')}>
  <p className="scene-status" role="status"><span className="status-dot"/>{t(`scene.${status}`)}</p>
  <details><summary>{t('scene.limits')}</summary>
   <p id="scene-description">{t(descriptionKey)}</p>
   <p>{t(scaleKey)} <ExplainButton topic="scene-scale" context={`scene.${kind}`}/></p>
   {!referenceOnly && <p>{t(preview ? 'scene.equipment' : 'scene.built')}</p>}
   <p>{t('scene.installed')}: {design.parts.filter(part => part.qty > 0).map(part => `${t(`part.${part.partId}.name`)} × ${part.qty}`).join(' · ')}</p>
   {telemetry && <p>{t('scene.deploymentLabel')}: {t(`flow.deployment.${telemetry.deployment.wings}`)} / {t(`flow.deployment.${telemetry.deployment.antenna}`)}</p>}
   {design.orbit && altitudes && <p>{t('scene.apsidesLabel')}: {number.format(altitudes.altitudeKm)} / {number.format(altitudes.apoapsisAltitudeKm)} km · {design.orbit.frame} · {design.orbit.epochUTC}</p>}
   <p>{t('scene.surfaceLimits')}</p>
   {kind === 'orbit' && !reviewing && !referenceOnly && <p>{t('scene.arcLimits')}</p>}
   {kind === 'transfer' && <p>{t('flight.transferLimits')}{design.orbit && <> {t('scene.transferEpoch', { departure: design.orbit.epochUTC, arrival: new Date(Date.parse(design.orbit.epochUTC) + hohmann().transferSec * 1000).toISOString() })}</>}</p>}
   {telemetry && !referenceOnly && <p>{t('scene.illuminationLabel')}: {t(telemetry.sunlit ? 'ui.sunlit' : 'ui.inShadow')} · {t('scene.visibilityLabel')}: {t(telemetry.link.lineOfSight ? 'flow.yes' : 'flow.no')} · {t('scene.serviceLabel')}: {t(telemetry.link.stationAllocated ? 'flow.yes' : 'flow.no')} · {t('scene.transmissionLabel')}: {t(telemetry.downlinkActive ? 'flow.yes' : 'flow.no')}</p>}
   {imaging && telemetry?.instruments.length !== 0 && <p>{t('scene.footprint')}</p>}
   {family === 'radiation' && <p>{t(telemetry ? 'scene.radiation' : 'scene.radiationPreview')}</p>}
   {telemetry?.flight && <ul className="model-limits" aria-label={t('flight.modelLimits')}>{telemetry.flight.limits.map(key => <li key={key}>{t(key, { defaultValue: t('flight.modelLimitUnnamed', { key }) })}</li>)}</ul>}
   {telemetry && !referenceOnly && <dl className="scene-diagnostics">
    <div><dt>{t(telemetry.safe ? 'scene.safe' : 'scene.normal')}</dt><dd>{t(telemetry.inContact ? 'scene.contact' : 'scene.noContact')}</dd></div>
    <div><dt>{t('scene.instruments')}</dt><dd>{telemetry.instruments.filter(instrument => instrument.on && !instrument.lost).length} / {telemetry.instruments.length}</dd></div>
    {family === 'radiation' && <div><dt>{t('scene.dose')}</dt><dd>{number.format(telemetry.doseUGyH)} µGy/h <ExplainButton topic="radiation" context="scene.radiation"/></dd></div>}
    <div><dt>{t('scene.queue')}</dt><dd>{telemetry.queued}</dd></div>
    {technical && <>
     <div><dt>{t('scene.link')}</dt><dd>{t(`scene.states.${telemetry.link.mode}`)} · {number.format(telemetry.link.quality * 100)}%</dd></div>
     <div><dt>{t('scene.pointing')}</dt><dd>{t(`scene.states.${telemetry.pointing.state}`)} · {number.format(telemetry.pointing.quality * 100)}%</dd></div>
     <div><dt>{t('scene.recovery')}</dt><dd>{t(`scene.states.${telemetry.computer.state}`)} · {number.format(telemetry.computer.recoveryRemainingSec)} s</dd></div>
     {telemetry.thermal && <div><dt>{t('scene.temperature')}</dt><dd>{number.format(telemetry.thermal.temperatureK)} K</dd></div>}
     {telemetry.instruments.map(instrument => <div key={instrument.partId}><dt>{t(`part.${instrument.partId}.name`)} · {t('scene.duty')}</dt><dd>{number.format(instrument.dutyFraction * 100)}%</dd></div>)}
    </>}
   </dl>}
   <p>{t(`scene.stages.${stage}`)}</p>
  </details>
 </section>;
}
