import { listScenarios, planCrewSupport, type Budgets, type Design, type Telemetry } from '@astrix/core';
import type { ScienceTopicId } from '@astrix/data';
export const RESOURCE_ORDER = ['mass','power','budget','data','comms','time','crew'] as const;
export type ResourceId = typeof RESOURCE_ORDER[number];
export interface ResourceValue {key:string;value:number|null;unit:string}
export interface ResourceModel {
 id:ResourceId; mode:'forecast'|'live'; value:number|null; limit:number|null; unit:string;
 fill:number; status:'fits'|'tight'|'over'|'enough'|'low'|'short'|'na'|'unknown';
 delta:number|null; previewFill:number|null; deltas?:ResourceValue[]; detail:ResourceValue[]; topic:ScienceTopicId;
 changes:readonly string[]; direction?:'up'|'down'|'steady'; secondary?:ResourceValue;
}
export function capacityStatus(value:number,limit:number):ResourceModel['status'] {return limit<=0?'unknown':value>limit?'over':value>=limit*.9?'tight':'fits';}
export function reserveStatus(value:number,need:number):ResourceModel['status'] {return need<=0?'unknown':value<need?'short':value<need*1.2?'low':'enough';}
const ratio=(value:number|null,limit:number|null)=>value===null||!limit?0:Math.max(0,Math.min(1,value/limit));
export function resourceModel(design:Design,b:Budgets,x:Telemetry|null,proposal?:Budgets|null):ResourceModel[] {
 const scenario=listScenarios().find(s=>s.id===design.scenarioId)!;
 const mode=x?'live':'forecast';
 const crew=design.scenarioId==='CREW_PATHFINDER'?planCrewSupport(design):null;
 const remaining=x?x.clock.remainingSec/86400:scenario.durationDays.v;
 const duration=x?x.clock.plannedSec/86400:scenario.durationDays.v;
 const changes:Record<ResourceId,readonly string[]>={mass:['COMPUTER','INSTRUMENT','BATTERY'],power:['SOLAR','BATTERY','INSTRUMENT'],budget:['COMPUTER','INSTRUMENT','RADIO'],data:['INSTRUMENT','STORAGE','RADIO'],comms:['RADIO'],time:['orbit'],crew:['crew']};
 const make=(id:ResourceId,value:number|null,limit:number|null,unit:string,status:ResourceModel['status'],topic:ScienceTopicId,detail:ResourceValue[],after:number|null|undefined=null):ResourceModel=>({id,mode,value,limit,unit,status,topic,detail,changes:changes[id],fill:ratio(value,limit),delta:after!=null&&value!==null?after-value:null,previewFill:after==null?null:ratio(after,limit)});
 const models=[
  make('mass',x?.mass.retainedKg??b.massKg.used,b.massKg.limit,'kg',capacityStatus(x?.mass.retainedKg??b.massKg.used,b.massKg.limit),'mass-volume',[{key:'hud.room',value:b.volume.used,unit:b.volume.unit},{key:'hud.roomLimit',value:b.volume.limit,unit:b.volume.unit},{key:'flow.launchMass',value:x?.mass.launchKg??b.massKg.used,unit:'kg'}],!x?proposal?.massKg.used:null),
  make('power',x?x.socWh:b.power?.avgGenW??null,x?x.capacityWh:b.power?.avgLoadW??null,x?'Wh':'W',x?x.capacityWh<=0?'unknown':x.socWh<x.capacityWh*.1?'short':x.socWh<x.capacityWh*.25?'low':'enough':b.power?reserveStatus(b.power.avgGenW,b.power.avgLoadW):'unknown','energy-budget',x?[{key:'flow.generationLoad',value:x.genW,unit:'W'},{key:'hud.load',value:x.loadW,unit:'W'},{key:'flow.batteryEnergy',value:x.socWh,unit:'Wh'},{key:'hud.capacity',value:x.capacityWh,unit:'Wh'}]:[{key:'flow.averageGenerationLoad',value:b.power?.avgGenW??null,unit:'W'},{key:'hud.load',value:b.power?.avgLoadW??null,unit:'W'},{key:'ui.shadowBattery',value:b.power?.usableBatteryWh??null,unit:'Wh'},{key:'ui.eclipse',value:b.power?.eclipseWh??null,unit:'Wh'}],!x?proposal?.power?.avgGenW:null),
  make('budget',b.cost.used,b.cost.limit,'',capacityStatus(b.cost.used,b.cost.limit),'game-budget',[],!x?proposal?.cost.used:null),
  make('data',x?x.storedMB:b.data?.genMBPerDay??null,x?x.storageMB:b.data?.downMBPerDay??null,x?'MB':'MB/d',x?capacityStatus(x.storedMB,x.storageMB):b.data?reserveStatus(b.data.downMBPerDay,b.data.genMBPerDay):'unknown','data-storage',[{key:'ui.storage',value:x?.storageMB??b.data?.storageMB??null,unit:'MB'},{key:'hud.delivered',value:x?.objective.value??null,unit:scenario.metric==='RADIATION_HOURS'?'h':'MB'},{key:'hud.target',value:scenario.target.v,unit:scenario.metric==='RADIATION_HOURS'?'h':'MB'}],!x?proposal?.data?.genMBPerDay:null),
  make('comms',x?x.inContact?1:0:b.orbit?.contactMinPerDay??null,x?1:null,x?'':'min/d',x?x.inContact?'enough':'low':!b.orbit?'unknown':b.orbit.contactMinPerDay>0?'enough':'short','ground-contact',[{key:'hud.queue',value:x?.queued??null,unit:''},{key:'flow.nextContact',value:x?.link.nextOpportunitySec??null,unit:'s'},{key:'ui.commandDelay',value:x?.lightTimeSec??null,unit:'s'},{key:'hud.rate',value:x?.link.activeRateKbps??null,unit:'kb/s'}],!x?proposal?.orbit?.contactMinPerDay:null),
  make('time',remaining,duration,'d',remaining<=0?'short':remaining<duration*.1?'low':'enough','mission-goal',[{key:'hud.duration',value:duration,unit:'d'}]),
  make('crew',x?.crew?.daysRemaining??crew?.runwayDays??null,crew?crew.totalSec/86400:null,'d',!crew?'na':(x?.crew?.daysRemaining??crew.runwayDays)===null?'unknown':reserveStatus((x?.crew?.daysRemaining??crew.runwayDays)!,Math.max(.001,remaining)),'crew-inventories',[{key:'flow.oxygen',value:x?.crew?.oxygenKg??crew?.oxygenKg??null,unit:'kg'},{key:'flow.nitrogen',value:x?.crew?.nitrogenKg??crew?.nitrogenKg??null,unit:'kg'},{key:'flow.water',value:x?.crew?.waterKg??crew?.waterKg??null,unit:'kg'},{key:'flow.food',value:x?.crew?.foodKg??crew?.foodKg??null,unit:'kg'},{key:'flow.scrubber',value:x?.crew?.scrubberKg??crew?.scrubberKg??null,unit:'kg'},{key:'hud.crewCount',value:crew?.crewCount??null,unit:''},{key:'hud.orbitTime',value:crew?crew.plannedOrbitSec/3600:null,unit:'h'},{key:'hud.returnBurn',value:crew?crew.burnSec/60:null,unit:'min'},{key:'hud.recoveryTime',value:crew?crew.recoverySec/3600:null,unit:'h'},{key:'hud.supportNeed',value:crew?crew.totalSec/3600:null,unit:'h'}]),
 ];
 const power=models[1];
 if(proposal&&!x){
  power.previewFill=proposal.power?ratio(proposal.power.avgGenW,proposal.power.avgLoadW):null;
  power.deltas=[{key:'hud.generation',value:proposal.power&&b.power?proposal.power.avgGenW-b.power.avgGenW:null,unit:'W'},{key:'hud.load',value:proposal.power&&b.power?proposal.power.avgLoadW-b.power.avgLoadW:null,unit:'W'},{key:'hud.capacity',value:proposal.power&&b.power?proposal.power.usableBatteryWh-b.power.usableBatteryWh:null,unit:'Wh'}].filter(item=>item.value!==null&&Math.abs(item.value)>.001);
  models[3].deltas=[{key:'ui.storage',value:proposal.data&&b.data?proposal.data.storageMB-b.data.storageMB:null,unit:'MB'},{key:'hud.delivered',value:proposal.data&&b.data?proposal.data.downMBPerDay-b.data.downMBPerDay:null,unit:'MB/d'}].filter(item=>item.value!==null&&Math.abs(item.value)>.001);
  models[3].previewFill=proposal.data?ratio(proposal.data.genMBPerDay,proposal.data.downMBPerDay):null;
 }
 if(x)power.direction=x.genW>x.loadW?'up':x.genW<x.loadW?'down':'steady';
 if(x)models[3].secondary={key:'hud.delivered',value:x.objective.value,unit:scenario.metric==='RADIATION_HOURS'?'h':'MB'};
 return models;
}
