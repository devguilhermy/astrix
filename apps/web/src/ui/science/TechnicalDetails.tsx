import type { ReactNode } from 'react';
import { useMission } from '../../store';
export function TechnicalDetails({children}:{children:ReactNode}){const presentation=useMission(s=>s.settings.presentation);return presentation==='DETAILED'?<div className="technical-details">{children}</div>:null;}
