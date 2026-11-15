import type { ActorContext, ActorRole, AscentProgram, BuiltinMissionId, BurnSpec, Budgets, Command, CueEngineState, Design, Digest, HistorySample, JourneyStage, LevelId, MissionArtifacts, MissionId, OrbitChoice, Phase, Refusal, ResolvedMissionDefinition, RoleId, ScoreBreakdown, SimEvent, SimState, TeamStats, Telemetry } from '@astrix/core';
import type { QuickDesignConfig, TurnGameState } from '@astrix/core';
/** Largest accepted wire frame, in UTF-8 bytes, for every intent except those that carry a mission definition. */
export const MAX_CLIENT_FRAME_BYTES = 8192;
/** Largest accepted frame for START_DEFINITION / SUBMIT_DEFINITION; the definition itself is bounded separately by core. */
export const MAX_DEFINITION_FRAME_BYTES = 40960;
export const ROLES: readonly RoleId[] = ['SCIENCE','SPACECRAFT','LAUNCH_ORBIT','GROUND_COMMS'];
export const WARPS = [1,10,100,1000,10000] as const;
export const STAGES: readonly JourneyStage[] = ['NEED_GOALS','CONCEPT','REQUIREMENTS','DESIGN','BUILD_VERIFY','IMPLEMENT','REVIEW'];
export const SUBSTEPS:Record<JourneyStage,readonly string[]> = {NEED_GOALS:['brief'],CONCEPT:['bus'],REQUIREMENTS:['requirements'],DESIGN:['equipment','orbit','trajectory'],BUILD_VERIFY:['readiness','signoffs'],IMPLEMENT:['operations'],REVIEW:['results']};
export type PauseReason = 'manual'|'decision'|'explanation'|'handoff'|'settings'|'hidden'|'chooser'|'graphics'|'home'|'self-paced'|'viewer'|'tour'|'error'|'route'|'host-stall'|'host-display-disconnected'|`controller-disconnected:${string}`|`learning:${string}`;
export interface SessionActor extends ActorContext { readonly playerId:string; readonly deviceId?:string; readonly isHost?:boolean }
export interface SessionPlayer { readonly id:string; readonly name:string; readonly roles:readonly RoleId[]; readonly ready:boolean; readonly acknowledged:boolean; readonly connected:boolean }
export interface DesignNote { readonly id:string; readonly revision:number; readonly actor:ActorRole; readonly player:number|null; readonly playerId:string; readonly kind:'CONCERN'|'SIDEBAR'; readonly target:'mass'|'power'|'budget'|'data'; readonly text:string; readonly resolved:boolean; readonly resolvedBy?:string }
export interface RosterChange { readonly before:readonly (readonly RoleId[])[]; readonly after:readonly (readonly RoleId[])[]; readonly beforePlayers:readonly Pick<SessionPlayer,'id'|'name'|'roles'>[]; readonly afterPlayers:readonly Pick<SessionPlayer,'id'|'name'|'roles'>[]; readonly time:number; readonly actorId:string }
export interface AcceptedTrade { readonly revision:number; readonly actor:ActorRole; readonly player:number|null; readonly playerId:string; readonly description:string; readonly before:Budgets; readonly after:Budgets }
export interface Approval { readonly role:RoleId; readonly playerId:string; readonly designRevisionReviewed:number; readonly dependencyFingerprint:string; readonly rosterRevision:number; readonly acceptedSeq:number }
export interface Decision { readonly id:string; readonly event:SimEvent; readonly owner:RoleId }
export interface PracticeCheckpoint { id:number; name:'launch'|'arrival'|'decision'; time:number; snapshot:{design:Design;sim:SimState;events:readonly SimEvent[];pendingDecisions:readonly SimEvent[];decisions:readonly Decision[];team:TeamStats;signoffs:Record<RoleId,boolean>;approvals:readonly Approval[];cues:CueEngineState} }
export type DesignEdit = {kind:'ADD_PART'|'REMOVE_PART';partId:string}|{kind:'SET_RIDE';rideId:string}|{kind:'SET_ORBIT';orbit:OrbitChoice}|{kind:'SET_PROPELLANT';kg:number}|{kind:'SET_LAUNCHER';launcherId:string}|{kind:'SET_ASCENT';program:AscentProgram}|{kind:'SET_BURNS';burns:readonly BurnSpec[]};
export type SessionIntent =
 | {kind:'START_GAME';config:QuickDesignConfig}
 | {kind:'COMMIT_TURN'|'PROPOSE_TURN';decisionId:string;turnRevision:number;planId:string}
 | {kind:'RETRY_GAME';checkpointRevision?:number}
 | {kind:'LOCAL_RESTORE_GAME';game:unknown}
 | {kind:'START_MISSION';missionId:BuiltinMissionId;levelId:LevelId;retainHardware?:boolean}
 // A custom mission. The payload is untrusted: the reducer re-validates it with core and rebuilds it, never storing the caller's object.
 | {kind:'START_DEFINITION';definition:unknown;levelId:LevelId;retainHardware?:boolean}
 // Replace the active definition before launch. baseDigest must equal the active digest (stale submissions are refused).
 | {kind:'SUBMIT_DEFINITION';definition:unknown;baseDigest:Digest}
 // Host-only: name the one player who may submit definitions (null revokes).
 | {kind:'GRANT_AUTHORING';playerId:string|null}
 | {kind:'RESET_MISSION';keepDesign?:boolean}
 // Trusted static-mode preparation/evidence only; deliberately absent from the wire parser.
 | {kind:'LOCAL_RESTORE';state:SessionState}
 | {kind:'LOCAL_TRADE';description:string;revision:number;before:Budgets;after:Budgets;actor:ActorRole}
 | {kind:'INVALIDATE_BASELINE'}
 | {kind:'SET_STAGE';stage:JourneyStage}|{kind:'SET_SUBSTEP';step:string}|{kind:'SET_VIEW';view:Phase}
 | {kind:'CONFIRM_OBJECTIVE';confirmed?:boolean}|{kind:'SET_SEGMENT';segment:keyof MissionArtifacts['segments'];selected:boolean}
 | {kind:'RECORD_TRADE';edit:DesignEdit;description:string;baseRevision:number}
 | {kind:'QUOTE_DESIGN'|'COMMIT_DESIGN';edit:DesignEdit;baseRevision:number;quoteId?:string}
 | {kind:'FREEZE_BASELINE'|'VERIFY_BASELINE'|'COMPLETE_STAGE';designRevision:number}
 | {kind:'SIGN_OFF';role:RoleId;designRevision:number;rosterRevision:number}
 | {kind:'NOTE';category:DesignNote['kind'];target:DesignNote['target'];text:string;designRevision:number}|{kind:'RESOLVE_NOTE';noteId:string}
 | {kind:'LAUNCH';designRevision:number;rosterRevision:number}
 | {kind:'COMMANDS';commands:readonly Command[]}
 | {kind:'PAUSE';reason?:PauseReason}|{kind:'CLEAR_PAUSE';reason:PauseReason}|{kind:'RESUME'}
 | {kind:'SET_WARP';warp:number}|{kind:'ADVANCE_NEXT';targetSec?:number}|{kind:'CANCEL_ADVANCE'}|{kind:'SKIP_CRUISE'}
 | {kind:'ACK_DECISION';decisionId:string}|{kind:'ACK_LEARNING';stopId:string}
 | {kind:'SAVE_CHECKPOINT';name:PracticeCheckpoint['name']}|{kind:'RETRY_CHECKPOINT';checkpointId:number}
 | {kind:'END_MISSION';confirmationId:string}
 | {kind:'SET_TEAM';count:number}|{kind:'ADD_PLAYER';playerId:string;name:string}
 | {kind:'ASSIGN_ROLE';role:RoleId;playerId:string;rosterRevision:number}
 | {kind:'SET_READY';ready:boolean;rosterRevision:number}|{kind:'SET_PRESENCE';playerId:string;connected:boolean}
 | {kind:'ROTATE_FACILITATOR';rosterRevision:number};
export type TransportCode = 'BAD_MESSAGE'|'VERSION_MISMATCH'|'ROOM_FULL'|'JOIN_LOCKED'|'KICKED'|'UNAUTHORIZED'|'ROLE_NOT_ASSIGNED'|'STALE_DESIGN'|'STALE_ROSTER'|'STALE_ATTEMPT'|'STALE_EPOCH'|'INTENT_EXPIRED'|'RATE_LIMITED'|'HOST_ONLY'|'OUTCOME_UNKNOWN'|'DUPLICATE_ID'|'NOT_FOUND';
export interface SessionRefusal {readonly ok:false;readonly code:Refusal['code']|TransportCode;readonly values:Readonly<Record<string,string|number>>}
export type IntentResult = {readonly ok:true;readonly seq:number;readonly receiptIds:readonly string[];readonly quote?:{quoteId:string;baseRevision:number;before:Budgets;after:Budgets;affectedRoles:readonly RoleId[]}}|{readonly ok:false;readonly refusal:SessionRefusal};
export interface IntentEnvelope { readonly id:string; readonly epoch:string; readonly attemptId:number; readonly rosterRevision:number; readonly intent:SessionIntent }
export interface SessionState {
 readonly game:TurnGameState|null;
 readonly turnProposals:readonly {playerId:string;decisionId:string;turnRevision:number;planId:string}[];
 readonly epoch:string;readonly seq:number;readonly rosterRevision:number;readonly mode:'LOCAL'|'LAN';readonly participantMode:'SOLO'|'TEAM';readonly roster:readonly SessionPlayer[];readonly approvals:readonly Approval[];
 readonly missionId:MissionId;readonly definition:ResolvedMissionDefinition;readonly authorPlayerId:string|null;readonly levelId:LevelId;readonly attemptId:number;readonly artifacts:MissionArtifacts|null;readonly activeStage:JourneyStage;readonly furthestStage:number;readonly activeSubstep:string;readonly activeView:Phase;
 readonly players:readonly (readonly RoleId[])[];readonly facilitator:number;readonly signoffs:Record<RoleId,boolean>;readonly team:TeamStats;readonly design:Design|null;readonly budgets:Budgets|null;readonly cues:CueEngineState;
 readonly designNotes:readonly DesignNote[];readonly rosterHistory:readonly RosterChange[];readonly acceptedTrades:readonly AcceptedTrade[];readonly sim:SimState|null;readonly telemetry:Telemetry|null;readonly running:boolean;readonly warp:number;readonly historyVersion:number;readonly events:readonly SimEvent[];readonly pendingDecisions:readonly SimEvent[];readonly decisions:readonly Decision[];readonly pauseReasons:readonly PauseReason[];readonly pauseOwners:Readonly<Record<string,string>>;readonly advancing:boolean;readonly advanceMessage:'event'|'limit'|null;readonly advanceTarget:number|null;readonly advanceWork:number;readonly practiceCheckpoints:readonly PracticeCheckpoint[];readonly nextCheckpointId:number;readonly assisted:boolean;
 readonly pauseRoles:Readonly<Record<string,ActorRole>>;
 readonly results:Readonly<Record<string,{fingerprint:string;result:IntentResult}>>;readonly quotes:Readonly<Record<string,{playerId:string;role:ActorRole;baseRevision:number;edit:DesignEdit;attemptId:number;expiresSeq:number}>>;readonly replay:readonly ReplayEntry[];
}
export type SessionReplaySnapshot = Omit<SessionState,'replay'|'results'>;
export type ReplayEntry = {kind:'INTENT';seq:number;actor:SessionActor;intent:SessionIntent}|{kind:'TICK';seq:number;dtSec:number;simulated?:true}|{kind:'CHECKPOINT';seq:number;snapshot:SessionReplaySnapshot};
export interface SessionOptions {epoch?:string;mode?:SessionState['mode'];participantMode?:SessionState['participantMode'];hostPlayerId?:string;hostName?:string}
export interface SnapshotViewer {readonly playerId?:string;readonly isHost?:boolean}
export type SessionSnapshot = Omit<SessionState,'results'|'quotes'|'replay'|'practiceCheckpoints'|'nextCheckpointId'|'advanceTarget'|'advanceWork'> & {readonly protocol:3;readonly practiceCheckpoints:readonly Pick<PracticeCheckpoint,'id'|'name'|'time'>[];readonly review:ScoreBreakdown|null};
export interface HistoryPage {readonly entries:readonly HistorySample[];readonly cursor:string|null;readonly attemptId:number;readonly epoch:string}
