import { commandRole } from '@astrix/core';
import type { Command, RoleId, SimEvent } from '@astrix/core';
import type { SessionActor, SessionState } from './contracts';
export function canAct(state:SessionState,actor:SessionActor,role?:RoleId):boolean {
 const player=state.roster.find(p=>p.id===actor.playerId);
 if(!player)return false;
 if(actor.role==='ALL')return state.participantMode==='SOLO'&&player.roles.length===4;
 return player.roles.includes(actor.role)&&(!role||actor.role===role);
}
export function decisionOwner(event:SimEvent,command?:Command):RoleId {
 if(command&&(event.kind==='COMMAND_EXPIRED'||event.kind==='COMMAND_REFUSED'))return commandRole(command);
 switch(event.kind){
 case 'LIFTOFF':case 'STAGE_SEPARATION':case 'ORBIT_INSERTION':case 'BURN_EXECUTED':case 'SOI_ENTRY':case 'SOI_EXIT':case 'ENCOUNTER_CLOSEST':case 'SURFACE_IMPACT':case 'ENTRY_INTERFACE':case 'ASCENT_FAILED':case 'CAPTURE_DONE':case 'CAPTURE_BURN':case 'MISSION_END':case 'CREW_DEORBIT':case 'CREW_RECOVERY':return 'LAUNCH_ORBIT';
 case 'PASS_START':case 'PASS_END':case 'GROUND_OUTAGE':case 'LINK_DEGRADED':case 'LINK_RECOVERED':case 'COMMAND_EXPIRED':case 'COMMAND_REFUSED':return 'GROUND_COMMS';
 case 'STORAGE_NEAR_FULL':case 'OBJECTIVE_MET':return 'SCIENCE';
 default:return 'SPACECRAFT';
 }
}
