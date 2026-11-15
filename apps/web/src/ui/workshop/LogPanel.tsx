import { useTranslation } from 'react-i18next';
import { listParts } from '@astrix/core';
import { useMission } from '../../store';
import { CommandReceipt } from '../phases/FlightControls';
import { ExplainButton } from '../science/ExplainButton';
import { topicForContext } from '../science/registry';
export function LogPanel(){
 const s=useMission(),{t}=useTranslation();if(!s.design)return null;
 return <div className="phase-content"><section id="command-queue" data-cue-target="command-queue"><h2>{t('ui.commands')}</h2><ExplainButton topic="command-transport"/><ol>{s.telemetry?.commandQueue.slice(-30).map(entry=><CommandReceipt key={entry.id} entry={entry} parts={listParts(s.design!.busId)}/>)}</ol></section><section><h2>{t('ui.events')}</h2>{s.events.length?s.events.slice(-50).reverse().map((event,index)=><article key={index}><span className="number">T+{event.t.toFixed(0)} s</span><h3>{t(`event.${event.kind}.title`,event.values)}</h3><details><summary>{t('hud.details')}</summary><p>{t(`event.${event.kind}.body`,event.values)}</p></details><ExplainButton topic={topicForContext(`event.${event.kind}`)}/></article>):<p>{t('ui.noEvents')}</p>}</section></div>;
}
