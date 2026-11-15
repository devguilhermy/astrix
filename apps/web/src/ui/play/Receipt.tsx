import { useTranslation } from 'react-i18next';
import type { TurnGameState, TurnReceipt } from '@astrix/core';
import { Duration, Evidence } from './Evidence';
import { usePlayCopy } from './copy';

/** Full committed (or previewed) turn receipt: boundary, deltas, interruption cause, evidence and events. */
export function Receipt({receipt,definition,preview=false}:{receipt:TurnReceipt;definition:TurnGameState['design']['definition'];preview?:boolean}) {
  const c=usePlayCopy(),{t,i18n}=useTranslation(),number=new Intl.NumberFormat(i18n.resolvedLanguage,{maximumFractionDigits:2,signDisplay:'exceptZero'});
  let interruption:TurnReceipt['events'][number]|undefined;
  if(receipt.interrupted)for(let index=receipt.events.length-1;index>=0;index--)if(receipt.events[index].autoPause){interruption=receipt.events[index];break;}
  return <div className="turn-receipt"><p><strong>{c(receipt.boundary)}</strong> · <Duration seconds={receipt.elapsedSec}/></p>{receipt.interrupted&&<p className="danger-text">{c('interrupted')}</p>}<dl><dt>{c('fuel')}</dt><dd>{number.format(receipt.delta.fuelKg)} kg</dd><dt>{c('energy')}</dt><dd>{number.format(receipt.delta.energyWh)} Wh</dd><dt>{c('stored')}</dt><dd>{number.format(receipt.delta.storedMB)} MB</dd><dt>{c('data')}</dt><dd>{number.format(receipt.delta.deliveredMB)} MB</dd></dl>
    <p>{c(receipt.summary)}</p>
    {interruption&&<p className="danger-text"><strong>{t(`event.${interruption.kind}.title`,{...interruption.values,defaultValue:t(`failure.${interruption.kind}.title`,{defaultValue:interruption.kind})})}</strong> {t(`event.${interruption.kind}.body`,{...interruption.values,defaultValue:''})}</p>}
    {!preview&&<><Evidence items={receipt.evidence} definition={definition}/><p className="muted">{c('receiptNote')}</p></>}
    <details><summary>{c('details')}</summary>{receipt.events.length>0&&<ul className="receipt-events">{receipt.events.slice(-8).map((event,index)=><li key={`${event.kind}-${event.t}-${index}`}><strong>{t(`event.${event.kind}.title`,{...event.values,defaultValue:t(`failure.${event.kind}.title`,{defaultValue:event.kind})})}</strong><p>{t(`event.${event.kind}.body`,{...event.values,defaultValue:''})}</p></li>)}</ul>}<p>{c('actualDuration')}: <Duration seconds={receipt.elapsedSec}/></p><p>{receipt.id}</p></details>
  </div>;
}
