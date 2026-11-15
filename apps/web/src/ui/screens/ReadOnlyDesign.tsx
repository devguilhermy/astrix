import { useMission } from '../../store';
import { useShellCopy } from './copy';
export function ReadOnlyDesign(){const c=useShellCopy();return <aside className="readonly-notice"><p>{c('readOnly')}</p><button className="button" onClick={()=>{if(window.confirm(c('confirmReset')))useMission.getState().resetMission(true);}}>{c('redesign')}</button></aside>;}
