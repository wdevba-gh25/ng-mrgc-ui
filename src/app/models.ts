export type DispatchMode = 'Sequential' | 'Burst' | 'Concurrent';
export type ScenarioSeverity = 'Normal' | 'Degraded' | 'Severe';
export type OperatorOutcome = 'Completed' | 'Failed' | 'Timed Out';
export type BackendHealth = 'Unknown' | 'Healthy' | 'Unavailable';
export type CallStage =
  | 'Call detected'
  | 'Routing...'
  | 'Operator available'
  | 'Call connected'
  | 'Connection lost';

export interface ScenarioForm {
  scenarioType: string;
  requestCount: number;
  dispatchMode: DispatchMode;
  severity: ScenarioSeverity;
  degradedUpstream: boolean;
  intermittentTimeout: boolean;
  failedRefreshBurst: boolean;
  collapseBackend: boolean;
  collapseAfterSec: number;
}

export interface DispatchRequest {
  requestId: string;
  callerId: string;
  scenarioType: string;
  severity: ScenarioSeverity;
  degradedUpstream: boolean;
  intermittentTimeout: boolean;
  failedRefreshBurst: boolean;
  plannedOutcome?: OperatorOutcome;
}

export interface TelemetryEvent {
  eventType: 'CustomEvent';
  eventName: 'CallStatusChanged';
  fromStage: string;
  toOutcome: OperatorOutcome;
  reason: string;
}

export interface DispatchResult {
  requestId: string;
  callerId: string;
  receivedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  technicalFinishedAt: string;
  technicalDurationMs: number;
  queueWaitSec: number;
  callDurationSec: number;
  outcome: OperatorOutcome;
  operatorName: string | null;
  correlationId: string;
  notes: string;
  telemetryEvent?: TelemetryEvent;
}

export interface CallLedgerItem {
  requestId: string;
  callerId: string;
  scenarioType: string;
  receivedAt: string;
  stage: CallStage;
  outcome: OperatorOutcome | null | 'Live';
  operatorName: string | null;
  queueWaitSec: number | null;
  callDurationSec: number | null;
  elapsedLabel: string;
  notes: string;
  isFinal: boolean;
  sortOrder?: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  collapseScheduled?: boolean;
  collapseAt?: string | null;
}

export interface CollapseResponse {
  scheduled: boolean;
  seconds: number;
  collapseAt: string;
  message: string;
}
