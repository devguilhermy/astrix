import { useTranslation } from 'react-i18next';
import { Duration } from './Evidence';
import { usePlayCopy } from './copy';
import type { AttemptRecord } from './persistence';

/** Side-by-side table of two comparable attempts of the same mission, level and seed. */
export function Comparison({previous,current}:{previous:AttemptRecord;current:AttemptRecord}) {
  const c=usePlayCopy(),{i18n}=useTranslation(),number=new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:2});
  const rows:[string,string,string][]=[['kit',c(previous.config.kit),c(current.config.kit)],['ambition',c(previous.config.ambition),c(current.config.ambition)],['approach',c(previous.config.approach),c(current.config.approach)],['fuel',`${number.format(previous.fuelKg)} kg`,`${number.format(current.fuelKg)} kg`],['energy',`${number.format(previous.energyWh)} Wh`,`${number.format(current.energyWh)} Wh`],['data',`${number.format(previous.deliveredMB)} MB`,`${number.format(current.deliveredMB)} MB`]];
  return <div className="comparison-table"><table><thead><tr><th scope="col">{c('constraints')}</th><th scope="col">{c('previous')}</th><th scope="col">{c('current')}</th></tr></thead><tbody>{rows.map(([key,a,b])=><tr key={key}><th scope="row">{c(key)}</th><td>{a}</td><td>{b}</td></tr>)}<tr><th scope="row">{c('elapsed')}</th><td><Duration seconds={previous.elapsedSec}/></td><td><Duration seconds={current.elapsedSec}/></td></tr><tr><th scope="row">{c('progress')}</th><td>{c(previous.outcome==='SUCCESS'?'success':'failure')}{previous.assisted&&` · ${c('assisted')}`}</td><td>{c(current.outcome==='SUCCESS'?'success':'failure')}{current.assisted&&` · ${c('assisted')}`}</td></tr></tbody></table></div>;
}
