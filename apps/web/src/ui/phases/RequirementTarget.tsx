import { useTranslation } from 'react-i18next';
import { listParts, type BusId, type RequirementEvidence } from '@astrix/core';
import { NumberValue } from '../primitives';

export function RequirementTarget({requirement,busId}:{requirement:RequirementEvidence;busId:BusId}){
 const {t}=useTranslation(),target=requirement.target;
 if(typeof target==='number')return <NumberValue value={target} unit={requirement.unit} digits={2}/>;
 const part=listParts(busId).find(item=>item.id===target);
 return <>{part?t(part.nameKey):t(`flow.target.${target}`,{defaultValue:target})}</>;
}
