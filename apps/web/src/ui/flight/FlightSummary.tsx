import { useTranslation } from 'react-i18next';
import type { TimelineForecast } from '@astrix/core';
import { useMission } from '../../store';

export function nextTimelineEdge(forecast:TimelineForecast|null,time:number) {
 if(!forecast)return null;
 let edge:{kind:'SUNLIGHT'|'ECLIPSE'|'CONTACT';time:number}|null=null;
 for(const window of forecast.windows) {
  if(!['SUNLIGHT','ECLIPSE','CONTACT'].includes(window.kind)||window.startSec<=time+1e-6)continue;
  if(!edge||window.startSec<edge.time)edge={kind:window.kind as 'SUNLIGHT'|'ECLIPSE'|'CONTACT',time:window.startSec};
 }
 return edge;
}
export function FlightSummary({forecast}:{forecast:TimelineForecast|null}) {
 const {t,i18n}=useTranslation(),s=useMission(),x=s.telemetry;
 if(!x||x.ended)return null;
 const edge=nextTimelineEdge(forecast,x.t),format=new Intl.NumberFormat(i18n.language,{maximumFractionDigits:0});
 const contact=x.inContact?x.t:x.link.nextOpportunitySec!==null?x.t+x.link.nextOpportunitySec:x.nextPassSec!==null&&x.nextPassSec!==undefined?x.t+x.nextPassSec:null;
 return <div className="flight-summary" data-cue-target="flight-summary">
  <span data-cue-target="timeline-edge">{edge?t('control.edge',{kind:t(`flight.lane${edge.kind}`),time:format.format(edge.time)}):t('control.noEdge')}</span><button type="button" className="button" data-cue-target="timeline-advance" disabled={!edge||s.advancing||!!s.pendingDecisions.length||!!x.capturePending||!!x.cruise} onClick={()=>{if(edge)s.advanceToEvent(edge.time);}}>{edge?t('control.advanceEdge',{kind:t(`flight.lane${edge.kind}`)}):t('flight.next')}</button>
  <span className="next-contact" data-cue-target="timeline-contact">{x.inContact?t('ui.connected'):contact===null?t('control.noContact'):t('control.nextContact',{time:format.format(contact)})}</span>
 </div>;
}
