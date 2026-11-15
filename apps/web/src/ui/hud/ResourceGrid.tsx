// Responsive badge grid adapted from Void Protocol components/ui/ResourceGrid.tsx, pin 218625d (owner-authorized reuse under project Apache-2.0; upstream pin declares no licence).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMission } from '../../store';
import { useProposal } from '../workshop/proposalStore';
import { ResourceBadge } from './ResourceBadge';
import { resourceModel } from './resourceModel';
export function ResourceGrid(){
 const s=useMission(),proposal=useProposal(),{t}=useTranslation(),[compact,setCompact]=useState(false);
 if(!s.design||!s.budgets)return null;
 const models=resourceModel(s.definition,s.design,s.budgets,s.telemetry,proposal.revision===s.design.revision?proposal.after:null);
 return <section className="resource-grid" data-hud-zone="left" data-cue-target="resources" data-icons={compact} aria-label={t('hud.resources')}><header><span>{t(s.sim?'hud.live':'hud.forecast')}</span><button data-cue-target="resources-compact" aria-label={t('hud.compactResources')} aria-pressed={compact} onClick={()=>setCompact(!compact)}>◫</button></header><div>{models.map(model=><ResourceBadge key={model.id} model={model}/>)}</div></section>;
}
