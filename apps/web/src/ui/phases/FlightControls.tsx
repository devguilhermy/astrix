import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { issueCommand, telemetry as readTelemetry, type Command, type CommandQueueEntry, type PartDef } from '@astrix/core';
import { useMission } from '../../store';
import { NumberValue } from '../primitives';
import { RefusalNote } from '../panels/Review';

export function CommandButton({command,label,icon}:{command:Command;label:string;icon?:ReactNode}) {
 const {t,i18n}=useTranslation(),sim=useMission(s=>s.sim),current=useMission(s=>s.telemetry);
 const role=useMission(s=>s.players.length===1?'ALL':s.activeRole);
 if(!sim||!current)return null;
 const quote=issueCommand(sim,command,role),after=quote.ok?readTelemetry(quote.value):null;
 const receipt=after?.commandQueue.find(entry=>!current.commandQueue.some(previous=>previous.id===entry.id));
 const format=(value:number)=>new Intl.NumberFormat(i18n.language,{maximumFractionDigits:1}).format(value);
 return <div className="command-preview">
  <button className="button" disabled={!quote.ok&&quote.code==='ROLE_LOCKED'} aria-disabled={!quote.ok} onClick={()=>useMission.getState().command(command)}>{icon}{label}</button>
  {quote.ok&&after?<p className="small muted">{receipt?.transport==='ONBOARD'&&receipt.status==='IN_TRANSIT'?t('flow.onboardPreview',{seconds:format(Math.max(0,(receipt.applyAt??after.t)-receipt.issuedAt))}):receipt?.status==='WAITING_CONTACT'?t('receipt.waitPreview'):receipt?.status==='IN_TRANSIT'?t('receipt.transitPreview',{seconds:format(Math.max(0,(receipt.applyAt??after.t)-(receipt.transmittedAt??after.t)))}):t('ui.powerPreview',{beforeGen:format(current.genW),afterGen:format(after.genW),beforeLoad:format(current.loadW),afterLoad:format(after.loadW)})}</p>:!quote.ok?<RefusalNote refusal={quote}/>:null}
 </div>;
}
export function CommandReceipt({entry,parts}:{entry:CommandQueueEntry;parts:readonly PartDef[]}) {
 const {t}=useTranslation(),command=entry.command,pending=entry.status==='WAITING_CONTACT'||entry.status==='IN_TRANSIT';
 const times=entry.transport==='ONBOARD'?[['receipt.issued',entry.issuedAt],['flow.onboardDue',entry.applyAt],['receipt.resolved',entry.resolvedAt],['receipt.expiry',entry.expiresAt]] as const:[['receipt.issued',entry.issuedAt],['receipt.transmitted',entry.transmittedAt],['receipt.arrival',entry.applyAt],['receipt.resolved',entry.resolvedAt],['receipt.expiry',entry.expiresAt]] as const;
 return <li>
  <div className="spread"><strong>{t(`ui.command.${command.kind}`)}</strong><span className={`chip ${pending?'warning':''}`}>{entry.transport==='ONBOARD'&&entry.status==='IN_TRANSIT'?t('flow.onboardInProgress'):entry.transport==='ONBOARD'&&entry.status==='DELIVERED'?t('flow.onboardCompleted'):t(`receipt.${entry.status}`)}</span></div>
  <p>{t(entry.actor.role==='ALL'?'flow.solo':`role.${entry.actor.role}`)}{entry.actor.playerId&&` · ${t('flow.player',{number:entry.actor.playerId})}`} · {t(entry.transport==='ONBOARD'?'flow.onboard':'flow.ground')}</p>
  <dl>{times.map(([key,value])=>value!==null&&<div key={key} className="receipt-time"><dt>{t(key)}</dt><dd>T+ <NumberValue value={value} unit="s"/></dd></div>)}</dl>
  {command.kind==='POINT'&&<span>{t(`ui.${command.mode}`)}</span>}
  {(command.kind==='INSTRUMENT'||command.kind==='DUTY_CYCLE')&&<span>{t(parts.find(part=>part.id===command.partId)!.nameKey)} · {command.kind==='INSTRUMENT'?t(command.on?'ui.on':'ui.off'):<NumberValue value={command.fraction*100} unit="%"/>}</span>}
  {(command.kind==='DOWNLINK'||command.kind==='SAFE')&&<span>{t(command.on?'ui.on':'ui.off')}</span>}
  {command.kind==='HEATER'&&<span>{t(`technical.heater.${command.mode}`)}</span>}
  {command.kind==='LINK_MODE'&&<span>{t(`technical.link.${command.mode}`)}</span>}
  {entry.refusal&&<RefusalNote refusal={entry.refusal}/>}
 </li>;
}
