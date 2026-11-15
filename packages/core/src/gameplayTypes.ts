import type { BodyId, Budgets, Design, LevelId, MissionOutcome, ObjectiveEvidence, OrbitChoice, Refusal, SimEvent, SimState, Telemetry } from './contracts';
import type { BuiltinMissionId, Digest } from './mission/types';

export type QuickAmbition = 'SHORT' | 'STANDARD' | 'AMBITIOUS';
export type QuickKit = 'LIGHT' | 'ENDURANCE' | 'SCIENCE';
export type QuickApproach = 'CAUTIOUS' | 'BALANCED' | 'FAST';
export interface QuickDesignConfig { missionId: BuiltinMissionId; levelId: LevelId; ambition: QuickAmbition; kit: QuickKit; approach: QuickApproach; seed: number; initialOrbit?: OrbitChoice }
export interface MissionOffer { missionId: BuiltinMissionId; destination: BodyId; titleKey: string; descriptionKey: string; goalKey: string; estimatedTurns: readonly [number, number]; config: QuickDesignConfig }
export interface QuickDesignBrief { config: QuickDesignConfig; identity: Digest; design: Design; budgets: Budgets; compatible: boolean; blockers: readonly Refusal[]; target: readonly ObjectiveEvidence[]; deadlineSec: number; reasons: readonly string[] }
export type ReadinessStatus = 'INCOMPATIBLE' | 'OVER_LIMITS' | 'CHECKING' | 'NO_VIABLE_PLAN' | 'READY' | 'STRETCHED';
export interface ReadinessCertificate { identity: Digest; rulesVersion: number; modelVersion: number; policyVersion: string; status: ReadinessStatus; reasons: readonly string[]; witness: readonly string[]; outcome: MissionOutcome; margins: { fuelKg: number; energyWh: number; deadlineSec: number }; turns: number }
export type TurnPlanKind = 'LAUNCH' | 'MANEUVER' | 'COAST' | 'OBSERVE' | 'TRANSMIT' | 'RECHARGE' | 'RECOVER' | 'CAPTURE' | 'RETURN' | 'FINISH' | 'ABORT';
export interface TurnPlan { id: string; kind: TurnPlanKind; title: string; description: string; expectedElapsedSec: number; nextBoundary: string; recommended: boolean; warnings: readonly string[] }
export interface TurnDecision { id: string; revision: number; phase: string; objective: readonly ObjectiveEvidence[]; plans: readonly TurnPlan[]; terminal: boolean }
export interface TurnReceipt { id: string; decisionId: string; planId: string; revision: number; elapsedSec: number; boundary: string; interrupted: boolean; summary: string; events: readonly SimEvent[]; delta: { fuelKg: number; energyWh: number; storedMB: number; deliveredMB: number }; evidence: readonly ObjectiveEvidence[]; outcome: MissionOutcome }
export interface TurnGameState { schema: 1; rulesVersion: number; modelVersion: number; identity: Digest; config: QuickDesignConfig; design: Design; sim: SimState; revision: number; receipts: readonly TurnReceipt[]; commits: readonly { key: string; decisionId: string; planId: string; revision: number }[]; assisted: boolean; rewinds: readonly number[] }
export interface TurnCommitRequest { decisionId: string; baseRevision: number; planId: string; idempotencyKey: string }
export interface TurnResolution { state: TurnGameState; receipt: TurnReceipt; telemetry: Telemetry }
export type TurnResult = { ok: true; value: TurnResolution } | { ok: false; code: 'STALE_DECISION' | 'DUPLICATE_KEY' | 'INVALID_PLAN' | 'INVALID_REQUEST' | 'RESOLUTION_ERROR'; message: string };
export interface TurnDebrief { outcome: MissionOutcome; evidence: readonly ObjectiveEvidence[]; receipts: readonly TurnReceipt[]; discoveries: readonly string[]; cause: string | null; advice: readonly string[]; assisted: boolean; identity: Digest; elapsedSec: number }
