import { useTranslation } from 'react-i18next';
import { labelText } from '../missions/definitionView';
import { useMission } from '../../store';
import { SettingsButton } from '../panels/Overlays';
import { HelpMenu } from './HelpMenu';
export function TopBar({onHome,onChoose}:{onHome:()=>void;onChoose:()=>void}) {
 const s=useMission(),{t}=useTranslation();
 if(!s.design)return null;
 return <header className="top-bar" data-hud-zone="top" data-cue-target="topbar"><button className="brand" onClick={onHome}>ASTRIX</button><div className="topbar-mission"><h1 id="simulator-heading" tabIndex={-1}>{labelText(t,s.definition.name)}</h1><small>{t(s.levelId==='ASPIRING'?'flow.aspiring':'flow.expert')}</small></div><HelpMenu onChoose={onChoose}/><SettingsButton/></header>;
}
