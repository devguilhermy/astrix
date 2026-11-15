import type { ActorContext, RoleId } from '@astrix/core';
import type { HistoryPage, IntentEnvelope, IntentResult, SessionSnapshot } from './contracts';
export const PROTOCOL_VERSION = 3 as const;
export type ClientMessage =
 | {type:'HELLO';protocol:3;buildId:string;lastSeq:number}
 | ({type:'INTENT';actor:ActorContext}&IntentEnvelope)
 | {type:'READY';ready:boolean;rosterRevision:number}
 | {type:'ASSIGN_ROLE';id:string;role:RoleId;playerId:string;rosterRevision:number}
 | {type:'ADMIT';id:string;pendingDeviceId:string;playerId:string}
 | {type:'KICK';id:string;deviceId:string}
 | {type:'ROTATE_JOIN_TOKEN';id:string}
 | {type:'ROTATE_FACILITATOR';id:string;rosterRevision:number}
 | {type:'GET_HISTORY';id:string;cursor:string|null}
 | {type:'GET_RESULTS';ids:readonly string[]}
 | {type:'PING';nonce:string};
export type ServerMessage =
 | {type:'WELCOME';protocol:3;buildId:string;deviceId:string;playerId:string;epoch:string;snapshot:SessionSnapshot}
 | {type:'SNAPSHOT';snapshot:SessionSnapshot}
 | ({type:'RESULT';id:string}&IntentResult)
 | {type:'QUOTE';id:string;quoteId:string;baseRevision:number;before:NonNullable<SessionSnapshot['budgets']>;after:NonNullable<SessionSnapshot['budgets']>;affectedRoles:readonly RoleId[]}
 | {type:'HISTORY';id:string;page:HistoryPage}
 | {type:'PONG';nonce:string;seq:number}
 | {type:'ROOM_CLOSED';reason:'HOST_STOPPED'|'RESTARTED'};
export type ParseResult = {ok:true;value:ClientMessage}|{ok:false;error:'BAD_MESSAGE'};
export { parseClientMessage, messageByteLimit } from './validation';
