import type { BodyId, Design, DesignPart, LevelId, ObjectiveDef, OrbitChoice, Refusal, ResolvedMissionDefinition } from './contracts';
import type { BuiltinMissionId, Digest, ObjectiveSpec } from './mission/types';
import { FLIGHT_MODEL_VERSION } from './mission/types';
import { canonicalJson, deepFreeze, digestOf, sha256Hex } from './mission/digest';
import { createStarterDesign, listMissions, missionById } from './mission/library';
import { computeBudgets, launchReadiness, planPropellant, quoteSetOrbit, refusal, ROLES } from './design';
import { PART_BY_ID } from './catalog';
import { recommendAscentProgram } from './flight/preview';
import { recommendBurns } from './flight/recommend';
import { RULES_VERSION } from './models';
import type { MissionOffer, QuickDesignBrief, QuickDesignConfig, QuickKit } from './gameplayTypes';

export const TURN_POLICY_VERSION = 'onboard-plans-1';
const LEVEL_IDS = ['ASPIRING','EXPERT'];
const MISSIONS = new Set(listMissions().map(d => d.id));
const configFields = ['missionId','levelId','ambition','kit','approach','seed','initialOrbit'];
function validOrbit(value: unknown): value is OrbitChoice {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 const o = value as OrbitChoice;
 return Object.keys(o).every(k => ['body','epochUTC','frame','smaKm','ecc','inclinationDeg','raanDeg','argPeriapsisDeg','trueAnomalyDeg'].includes(k)) && ['EARTH','MARS'].includes(o.body) && o.frame === 'MJ2000Eq' && typeof o.epochUTC === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(o.epochUTC) && Number.isFinite(Date.parse(o.epochUTC)) && new Date(o.epochUTC).toISOString()===(o.epochUTC.includes('.')?o.epochUTC:o.epochUTC.replace(/Z$/,'.000Z')) && [o.smaKm,o.ecc,o.inclinationDeg,o.raanDeg,o.argPeriapsisDeg,o.trueAnomalyDeg].every(Number.isFinite) && o.smaKm > 0 && o.ecc >= 0 && o.ecc < 1 && o.inclinationDeg >= 0 && o.inclinationDeg <= 180 && [o.raanDeg,o.argPeriapsisDeg,o.trueAnomalyDeg].every(n => n >= 0 && n <= 360);
}
export function validateQuickDesignConfig(value: unknown): value is QuickDesignConfig {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 const c = value as QuickDesignConfig;
 return Object.keys(c).every(k => configFields.includes(k)) && MISSIONS.has(c.missionId) && LEVEL_IDS.includes(c.levelId) && ['SHORT','STANDARD','AMBITIOUS'].includes(c.ambition) && ['LIGHT','ENDURANCE','SCIENCE'].includes(c.kit) && ['CAUTIOUS','BALANCED','FAST'].includes(c.approach) && Number.isInteger(c.seed) && c.seed >= 0 && c.seed <= 0xffffffff && (c.initialOrbit === undefined || validOrbit(c.initialOrbit));
}
export function defaultQuickDesign(missionId: BuiltinMissionId = 'FIRST_SIGNAL', levelId: LevelId = 'ASPIRING'): QuickDesignConfig {
 const d = missionById(missionId);
 return { missionId,levelId,ambition: 'STANDARD',kit: 'ENDURANCE',approach: 'BALANCED',seed: d.environment.seed };
}
export function missionOffers(destination?: BodyId, levelId: LevelId = 'ASPIRING'): MissionOffer[] {
 return listMissions().map(d => {
  const destination: BodyId = d.trajectory.model === 'MARS_ANALYTIC_CRUISE' ? 'MARS' : d.trajectory.bodies.includes('MOON') ? 'MOON' : 'EARTH';
  const estimatedTurns:readonly[number,number]=d.id==='FIRST_SIGNAL'?[4,6]:d.id==='UP_AND_BACK'?[1,2]:d.id==='STAY_IN_ORBIT'?[3,6]:d.id==='RAISE_YOUR_ORBIT'||d.id==='LEAVE_ORBIT_SAFELY'?[3,5]:d.id==='PAST_EARTH'?[2,4]:d.id==='MEET_THE_MOON'?[4,8]:d.id==='EARTH_TO_MOON'?[8,14]:[8,24];
  return { missionId: d.id as BuiltinMissionId,destination,titleKey: d.name.key!,descriptionKey: d.description.key!,goalKey: d.objectiveSummary.key!,estimatedTurns,config: defaultQuickDesign(d.id as BuiltinMissionId,levelId) };
 }).filter(o => !destination || o.destination === destination).sort((a,b)=>(a.missionId==='FIRST_SIGNAL'?-2:a.missionId==='UP_AND_BACK'||a.missionId==='STAY_IN_ORBIT'?-1:0)-(b.missionId==='FIRST_SIGNAL'?-2:b.missionId==='UP_AND_BACK'||b.missionId==='STAY_IN_ORBIT'?-1:0));
}
function ambitionSpec(spec: ObjectiveSpec, factor: number): ObjectiveSpec {
 switch (spec.kind) {
  case 'DELIVERED_PRODUCT': return { ...spec,targetMB: spec.targetMB*factor };
  case 'INSTRUMENT_HOURS': return { ...spec,targetHours: Math.min((spec.windowEndSec-spec.windowStartSec)/3600,spec.targetHours*factor) };
  case 'ESCAPE': return { ...spec,minExcessSpeedKms: spec.minExcessSpeedKms*factor };
  case 'APOGEE_BAND': return factor<1?{...spec,minAltKm:60,maxAltKm:100}:factor>1?{...spec,minAltKm:100,maxAltKm:140}:spec;
  case 'ENTRY_INTERFACE': return {...spec,altitudeKm:spec.altitudeKm+(factor<1?20:factor>1?-20:0)};
  case 'ENCOUNTER_DISTANCE': return factor<1?{...spec,minDistanceKm:15000,maxDistanceKm:30000}:factor>1?{...spec,minDistanceKm:3000,maxDistanceKm:8000}:spec;
  default: return spec;
 }
}
function makeParts(d: Design, c: QuickDesignConfig): DesignPart[] {
 // These fresh owned records are mutable while assembling the candidate; published designs are frozen later.
 let p = d.parts.map(item => ({ ...item }));
 const add = (id: string, qty = 1, propellantKg?: number) => { if (!p.some(i => i.partId === id)) p.push({ partId:id,qty,...(propellantKg === undefined ? {} : { propellantKg }) }); };
 const replace = (old: string, id: string) => { p = p.filter(i => i.partId !== old); add(id); };
 const science = d.definition.objectives.some(o => o.spec.kind === 'DELIVERED_PRODUCT');
 for (const id of d.definition.vehicle.requiredPartIds) add(id);
 if (d.busId === 'CUBESAT_3U') {
  if (c.kit !== 'LIGHT' || c.levelId === 'EXPERT' || c.missionId === 'FIRST_LIGHT') replace('SOLAR_BODY','SOLAR_WINGS');
  if (c.kit === 'ENDURANCE' || c.levelId === 'EXPERT') add('BATT_40');
  if (c.missionId === 'FIRST_LIGHT' || science && (c.kit === 'SCIENCE'||c.levelId==='EXPERT')) replace('RADIO_UHF','RADIO_SBAND');
  if (science && c.kit === 'SCIENCE') { const cam = p.find(i => i.partId === 'CAM_EO'); if (cam) cam.qty = 2; }
  if (c.levelId === 'EXPERT') {
   add('HEATER_6');
   if (c.missionId === 'FIRST_LIGHT') { p = p.filter(i => i.partId !== 'EPS_BATT_20'); const radio = p.find(i => i.partId === 'RADIO_SBAND'); if (radio) radio.qty = 4; }
  }
 } else if (d.busId === 'SMALLSAT') {
  if (c.kit !== 'LIGHT' || c.levelId === 'EXPERT') replace('SS_SOLAR_400','SS_SOLAR_800');
  if (c.missionId === 'RED_RELAY') {
   add('SS_PROP_MONO',1,0); const batt = p.find(i => i.partId === 'SS_BATT_300'); if (batt) batt.qty = 2;
  }
  if (c.kit === 'SCIENCE' && science) { const mapper = p.find(i => i.partId === 'SS_MAPPER'); if (mapper) mapper.qty = 2; }
  if (c.levelId === 'EXPERT') { add('SS_HEATER_60'); if(c.missionId!=='RED_RELAY')add('SS_RADIATOR'); }
 } else if (c.kit === 'ENDURANCE') { const battery = p.find(i => i.partId === 'CREW_BATTERY'); if (battery) battery.qty = 2; }
 // Fuel is tangible inventory. Endurance carries more; lighter/science packages pay less mass/cost.
 p = p.map(i => i.propellantKg && i.partId !== 'CREW_PROPULSION' ? { ...i,propellantKg: Math.min(PART_BY_ID[i.partId].tankKg?.v ?? 0,i.propellantKg*(c.kit === 'LIGHT' ? .8 : c.kit === 'ENDURANCE' ? 1.1 : 1)) } : i);
 return p;
}
/** Cheap physical-loadout comparison: no budgets, ascent search or reference run.
 * Keep the player's selected representative when multiple labels mean identical hardware. */
export function quickKitOptions(config:QuickDesignConfig):readonly QuickKit[] {
 if(!validateQuickDesignConfig(config))throw new RangeError('Unsupported quick-design configuration');
 const starter=createStarterDesign(missionById(config.missionId),config.levelId),seen=new Set<string>(),options:QuickKit[]=[];
 const kits:QuickKit[]=[config.kit,...(['LIGHT','ENDURANCE','SCIENCE'] as const).filter(kit=>kit!==config.kit)];
 for(const kit of kits){
  const parts=makeParts(starter,{...config,kit});
  parts.sort((a,b)=>a.partId<b.partId?-1:a.partId>b.partId?1:0);
  const signature=canonicalJson(parts);
  if(!seen.has(signature)){seen.add(signature);options.push(kit);}
 }
 return options;
}
const compiled = new Map<string, QuickDesignBrief>();
export function quickDesignBrief(config: QuickDesignConfig): QuickDesignBrief {
 if (!validateQuickDesignConfig(config)) throw new RangeError('Unsupported quick-design configuration');
 const cacheKey = canonicalJson({ config,rules:RULES_VERSION,model:FLIGHT_MODEL_VERSION,policy:TURN_POLICY_VERSION,definition:missionById(config.missionId).digest });
 const cached = compiled.get(cacheKey); if (cached) return cached;
 const source = missionById(config.missionId), factor = config.ambition === 'SHORT' ? .6 : config.ambition === 'AMBITIOUS' ? 1.8 : 1;
 const objectives: ObjectiveDef[] = source.objectives.map(o => {
  let spec = ambitionSpec(o.spec,factor);
  if (config.missionId === 'RAISE_YOUR_ORBIT' && spec.kind === 'BOUND_ORBIT') {
   const target = config.ambition === 'SHORT' ? 600 : config.ambition === 'AMBITIOUS' ? 1200 : 800;
   spec = { ...spec,periapsisAltKm:{min:target-40,max:target+40},apoapsisAltKm:{min:target-40,max:target+40} };
  }
  return { ...o,spec,dwellSec:o.dwellSec*factor };
 });
 const raw = { ...source,objectives,environment:{...source.environment,seed:config.seed},termination:{...source.termination,endOnSuccess:!source.support.crew} };
 const definition: ResolvedMissionDefinition = deepFreeze({ ...raw,digest:digestOf(raw) });
 let design = createStarterDesign(definition,config.levelId);
 design = { ...design,parts:makeParts(design,config) };
 const blockers: Refusal[] = [];
 if (config.initialOrbit) {
  const o = config.initialOrbit;
  if (source.start.kind !== 'PROVIDED_ORBIT' || o.body !== source.start.body) blockers.push(refusal('ORBIT_NOT_OFFERED',{ride:design.rideId??''}));
  else {
   // A new mission gets the imported epoch explicitly; the ride still has to offer this orbit.
   const rawImport = { ...definition,environment:{...definition.environment,epochUTC:o.epochUTC},start:{...source.start,orbit:o,initialPhase:'OPERATIONS' as const} };
   const imported = deepFreeze({ ...rawImport,digest:digestOf(rawImport) });
   design = { ...design,definition:imported,definitionDigest:imported.digest };
   const q = quoteSetOrbit(design,o,'ALL'); if (q.ok) design = q.value.next; else blockers.push(q);
  }
 }
 if (config.missionId === 'RED_RELAY') {
  // Shorter-eclipse orbit consumes more capture fuel; it is never an uncharged shortcut.
  if (config.levelId === 'EXPERT' && design.orbit && !config.initialOrbit) { const r = source.start; if (r.kind === 'PROVIDED_ORBIT') { const orbit = { ...design.orbit,smaKm:CONSTANT_MARS_RADIUS+5200,ecc:4800/(CONSTANT_MARS_RADIUS+5200) }; const q = quoteSetOrbit(design,orbit,'ALL'); if(q.ok) design=q.value.next; } }
  const q = planPropellant(design,'ALL'); if (q.ok) design=q.value.next; else blockers.push(q);
 }
 if (design.launch) {
  const rec = recommendAscentProgram(design,config.approach);
  if ('program' in rec) design = { ...design,launch:{...design.launch,program:rec.program} }; else blockers.push(rec);
 }
 if (!blockers.length) design = { ...design,burns:recommendBurns(design,config.approach) };
 blockers.push(...launchReadiness(design,Object.fromEntries(ROLES.map(r=>[r,true])) as Record<typeof ROLES[number],boolean>));
 const identity = `sha256:${sha256Hex(canonicalJson({ config,design,policy:TURN_POLICY_VERSION,model:FLIGHT_MODEL_VERSION,rules:RULES_VERSION }))}` as Digest;
 const target:QuickDesignBrief['target'] = design.definition.objectives.map(o => {
  const s=o.spec,detail:Record<string,number|string>={};
  let target:number|null=null,unit='',source:QuickDesignBrief['target'][number]['source']='ORBIT_STATE';
  switch(s.kind){
   case 'DELIVERED_PRODUCT':target=s.targetMB;unit='MB';source='DELIVERED_DATA';break;
   case 'INSTRUMENT_HOURS':target=s.targetHours;unit='h';source='CLOCK';Object.assign(detail,{windowStartSec:s.windowStartSec,windowEndSec:s.windowEndSec});break;
   case 'APOGEE_BAND':target=(s.minAltKm+s.maxAltKm)/2;unit='km';source='ASCENT_STATE';Object.assign(detail,{minAltKm:s.minAltKm,maxAltKm:s.maxAltKm});break;
   case 'RETURN_BOUNDARY':target=s.altitudeKm;unit='km';source='ASCENT_STATE';break;
   case 'ENTRY_INTERFACE':target=s.altitudeKm;unit='km';break;
   case 'BOUND_ORBIT':target=(s.periapsisAltKm.min+s.periapsisAltKm.max)/2;unit='km';Object.assign(detail,{periapsisMinKm:s.periapsisAltKm.min,periapsisMaxKm:s.periapsisAltKm.max,apoapsisMinKm:s.apoapsisAltKm.min,apoapsisMaxKm:s.apoapsisAltKm.max});break;
   case 'ESCAPE':target=s.minExcessSpeedKms;unit='km/s';break;
   case 'ENCOUNTER_DISTANCE':target=(s.minDistanceKm+s.maxDistanceKm)/2;unit='km';source='ENCOUNTER';Object.assign(detail,{minDistanceKm:s.minDistanceKm,maxDistanceKm:s.maxDistanceKm});break;
   case 'PROPELLANT_RESERVE':target=s.minKg;unit='kg';source='PROPELLANT';break;
   case 'CREW_ORBIT_HOURS':target=s.hours;unit='h';source='CREW';break;
   case 'CREW_SUPPORT_THROUGH_RECOVERY':unit='h';source='CREW';break;
  }
  return {id:o.id,kind:s.kind,required:o.required,owner:o.owner,state:'IN_PROGRESS',progress:0,actual:null,target,unit,source,dwellHeldSec:0,dwellRequiredSec:o.dwellSec,metAtSec:null,detail};
 });
 const result: QuickDesignBrief = deepFreeze({config:structuredClone(config),identity,design,budgets:computeBudgets(design),compatible:!blockers.some(b=>['RIDE_MISMATCH','ORBIT_NOT_OFFERED','UNSUPPORTED_RULES'].includes(b.code)),blockers,target,deadlineSec:design.definition.environment.durationSec,reasons:[`${config.kit}_KIT`,`${config.approach}_APPROACH`]});
 if (compiled.size>=128) compiled.delete(compiled.keys().next().value!); compiled.set(cacheKey,result); return result;
}
const CONSTANT_MARS_RADIUS = 3396.2;
