import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Battery, Clock, Database, Radio, Scale, Users, Wallet, type LucideIcon } from 'lucide-react';
import { computeBudgets, telemetry, type TurnGameState } from '@astrix/core';
import { resourceModel, type ResourceId, type ResourceModel } from '../hud/resourceModel';
import { Duration } from './Evidence';
import { usePlayCopy } from './copy';

const icons:Record<ResourceId,LucideIcon>={mass:Scale,power:Battery,budget:Wallet,data:Database,comms:Radio,time:Clock,crew:Users};

export function MissionResources({game}:{game:TurnGameState}) {
  const {t}=useTranslation();
  const budgets=useMemo(()=>computeBudgets(game.design),[game.design]);
  const resources=useMemo(()=>resourceModel(game.design.definition,game.design,budgets,telemetry(game.sim)),[game.design,game.sim,budgets]);
  return <section className="mission-resources" data-tour="resources" aria-label={t('hud.resources')}><ul>{resources.map(resource=><MissionResourceCell key={resource.id} resource={resource}/>)}</ul></section>;
}

export function MissionResourceCell({resource}:{resource:ResourceModel}) {
  const c=usePlayCopy(),{t,i18n}=useTranslation(),Icon=icons[resource.id];
  const label=c(`resource.${resource.id}`),status=t(`hud.status.${resource.status}`);
  const number=useMemo(()=>new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:1,notation:'compact'}),[i18n.resolvedLanguage]);
  const exact=useMemo(()=>new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:3}),[i18n.resolvedLanguage]);
  const known=resource.status!=='na'&&resource.status!=='unknown'&&resource.value!==null;
  const measurable=known&&resource.limit!==null&&resource.limit>0;
  const descriptionLabel=resource.id==='data'?c('stored'):resource.id==='time'?c('timeRemaining'):label;
  const description=known?`${descriptionLabel}: ${exact.format(resource.value!)}${resource.limit!==null?` / ${exact.format(resource.limit)}`:''} ${resource.unit} · ${status}`:`${descriptionLabel}: ${status}`;
  return <li className={`mission-resource resource-${resource.id} resource-${resource.status}`} title={description}>
    <span className="mission-resource-label"><Icon size={14} aria-hidden="true"/><span>{label}</span></span>
    <output aria-label={description}>{!known?status:resource.id==='comms'?c(resource.value===1?'contactAvailable':'contactUnavailable'):resource.unit==='d'?<Duration seconds={resource.value!*86400}/>:<>{number.format(resource.value!)}{resource.limit!==null&&<> / {number.format(resource.limit)}</>}{resource.unit&&` ${resource.unit}`}</>}</output>
    {measurable?<div className="mission-resource-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={resource.limit!} aria-valuenow={Math.min(resource.limit!,Math.max(0,resource.value!))} aria-valuetext={description}><span style={{width:`${resource.fill*100}%`}}/></div>:<span className="mission-resource-meter unavailable" aria-hidden="true"/>}
    <span className="sr-only">{status}</span>
  </li>;
}
