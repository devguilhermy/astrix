import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMission } from '../../store';
import { Modal } from '../primitives';
import { getQualityOverride, setQualityOverride, useQuality, type QualityOverride } from '../../three/quality';
import { Settings, ChevronRight, RotateCcw } from '../icons';
import { useWindows } from '../layout/windows';
import { TeamSetup } from '../phases/Goal';
export function SettingsButton() {
 const {t,i18n}=useTranslation(),settings=useMission(s=>s.settings),warp=useMission(s=>s.warp);
 const [open,setOpen]=useState(false),[quality,setQuality]=useState(getQualityOverride),tier=useQuality();
 const close=useCallback(()=>{setOpen(false);useMission.getState().clearPauseReason('settings');},[]);
 return <>
  <button className="icon-button" aria-label={t('ui.settings')} onClick={()=>{useMission.getState().pause('settings');setOpen(true);}}><Settings size={20}/></button>
  {open&&<Modal title={t('ui.settings')} onClose={close}><div className="settings-fields">
   <label>{t('ui.language')}<select value={i18n.resolvedLanguage?.startsWith('pt')?'pt-BR':'en'} onChange={e=>void i18n.changeLanguage(e.target.value)}>{['en','pt-BR'].map(locale=><option key={locale} value={locale}>{new Intl.DisplayNames([locale],{type:'language'}).of(locale)}</option>)}</select></label>
   <label>{t('flow.display')}<select value={settings.presentation} onChange={e=>useMission.getState().setSettings({presentation:e.target.value as 'GUIDED'|'DETAILED'})}><option value="GUIDED">{t('flow.guided')}</option><option value="DETAILED">{t('flow.detailed')}</option></select></label><TeamSetup/>
   <label>{t('flow.playback')}<select value={warp} onChange={e=>useMission.getState().setWarp(Number(e.target.value))}>{[1,10,100,1000,10000].map(value=><option key={value} value={value}>{value}×</option>)}</select></label>
   <label>{t('ui.quality')}<select value={quality} onChange={e=>{const q=e.target.value as QualityOverride;setQuality(q);setQualityOverride(q);}}>{(['AUTO','LOW','MEDIUM','HIGH'] as const).map(q=><option key={q} value={q}>{t(`ui.${q}`)}</option>)}</select><span className="chip">{t(`ui.${tier}`)}</span></label>
   <label className="checkbox-label"><input type="checkbox" checked={settings.reducedMotion} onChange={e=>useMission.getState().setSettings({reducedMotion:e.target.checked})}/>{t('ui.reducedMotion')}</label>
   <label className="checkbox-label"><input type="checkbox" checked={settings.sound} onChange={e=>useMission.getState().setSettings({sound:e.target.checked})}/>{t('ui.sound')}</label>
   <label>{t('ui.uiVolume')}<input type="range" min={0} max={1} step={.05} value={settings.uiVolume} onChange={e=>useMission.getState().setSettings({uiVolume:Number(e.target.value)})}/></label>
   <label>{t('ui.alertVolume')}<input type="range" min={0} max={1} step={.05} value={settings.alertVolume} onChange={e=>useMission.getState().setSettings({alertVolume:Number(e.target.value)})}/></label>
   <button className="button" onClick={()=>useWindows.getState().resetLayout()}><RotateCcw size={17}/>{t('ui.resetLayout')}</button>
  </div></Modal>}
 </>;
}
export function Handoff() {
 const handoff=useMission(s=>s.handoff),players=useMission(s=>s.players),{t}=useTranslation(),dismiss=useMission(s=>s.dismissHandoff);
 const close=useCallback(()=>dismiss(),[dismiss]);
 if(!handoff)return null;
 return <Modal title={t('ui.handoff')} onClose={close}><h3>{t('ui.handoffBody',{role:t(`role.${handoff}`),number:players.findIndex(roles=>roles.includes(handoff))+1})}</h3><p>{t('ui.roleMap')}</p><button className="button primary" onClick={dismiss}>{t('ui.ready')}<ChevronRight size={17}/></button></Modal>;
}
