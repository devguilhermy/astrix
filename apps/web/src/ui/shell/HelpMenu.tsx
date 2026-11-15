import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SCIENCE_TOPICS } from '@astrix/data';
import { useMission, ROLES } from '../../store';
import { Modal } from '../primitives';
import { AdvancedTools } from '../advanced/AdvancedTools';
import { useTourStore } from '../tour/tourStore';
import { tours, type TourId } from '../tour/tours';
import { isScienceTopicId } from '../science/registry';
export function HelpMenu({onChoose}:{onChoose:()=>void}) {
 const {t}=useTranslation(),s=useMission(),[open,setOpen]=useState(false);
 const topics=Object.keys(SCIENCE_TOPICS).filter(isScienceTopicId).map(id=>({id,topic:SCIENCE_TOPICS[id]}));
 return <><button className="icon-button" aria-label={t('hud.help')} aria-haspopup="dialog" onClick={()=>{s.pause('settings');setOpen(true);}}>?</button>{open&&<Modal title={t('hud.help')} onClose={()=>{setOpen(false);s.clearPauseReason('settings');}}>
  <h3>{t('ui.tour')}</h3><div className="button-wrap">{(Object.keys(tours) as TourId[]).map(id=><button className="button" key={id} disabled={id==='flight'&&(!s.sim||!!s.telemetry?.ended)||id==='build'&&s.activeStage!=='DESIGN'||id==='launch'&&!['BUILD_VERIFY','IMPLEMENT'].includes(s.activeStage)||id==='debrief'&&s.activeStage!=='REVIEW'||id==='choice'&&!document.querySelector('[data-cue-target="choice-tour"]')} onClick={()=>{setOpen(false);s.clearPauseReason('settings');requestAnimationFrame(()=>useTourStore.getState().start(id));}}>{t(`hud.tour.${id}`)}</button>)}</div>
  <details><summary>{t('hud.modelLimits')}</summary><div className="topic-list">{topics.map(({id,topic})=><button className="text-button" key={id} onClick={event=>{setOpen(false);s.clearPauseReason('settings');s.openExplanation(id,'help.model-limits',event.currentTarget);}}>{t(topic.titleKey)}</button>)}</div></details>
  <button className="button" onClick={event=>{setOpen(false);s.clearPauseReason('settings');s.openExplanation('mission-design','help.manual',event.currentTarget);}}>{t('hud.manual')}</button>
  {s.players.length>1&&<label>{t('ui.activeRole')}<select value={s.activeRole} onChange={event=>s.setActiveRole(event.target.value as typeof s.activeRole)}>{ROLES.map(role=><option value={role} key={role}>{t(`role.${role}`)} · {t('flow.player',{number:s.players.findIndex(roles=>roles.includes(role))+1})}</option>)}</select></label>}
  <details><summary>{t('flow.advanced')}</summary><AdvancedTools/></details>
  <button className="button" onClick={()=>{setOpen(false);s.clearPauseReason('settings');onChoose();}}>{t('flow.newAttempt')}</button>
  {s.sim&&!s.telemetry?.ended&&<button className="button" onClick={()=>{if(window.confirm(t('flow.endConfirm'))){s.endMission();setOpen(false);s.clearPauseReason('settings');}}}>{t('flow.end')}</button>}
 </Modal>}</>;
}
