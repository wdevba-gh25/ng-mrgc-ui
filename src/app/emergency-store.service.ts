import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { EmergencyApiService } from './emergency-api.service';
import { BackendHealth, CallLedgerItem, DispatchRequest, DispatchResult, OperatorOutcome, ScenarioForm } from './models';

const defaultForm: ScenarioForm = {
  scenarioType: 'Regional flooding',
  requestCount: 25,
  dispatchMode: 'Sequential',
  severity: 'Degraded',
  degradedUpstream: true,
  intermittentTimeout: true,
  failedRefreshBurst: true,
  collapseBackend: false,
  collapseAfterSec: 120
};

const operators = ['J. ALVAREZ', 'H. MENDEZ', 'R. PATERSON', 'M. SINGH', 'A. ROMERO', 'T. NGUYEN'];
const ACTIVE_LIMIT = 3;

interface PlannedCall {
  payload: DispatchRequest;
  finalOutcome: OperatorOutcome;
  operatorName: string | null;
}

@Injectable({ providedIn: 'root' })
export class EmergencyStoreService {
  private readonly api = inject(EmergencyApiService);
  private readonly destroyRef = inject(DestroyRef);

  private offlineRetryTimer: ReturnType<typeof setInterval> | null = null;
  private healthWatchTimer: ReturnType<typeof setInterval> | null = null;
  private retryCycleMs = 656;
  private activeRunId = 0;

  private waitingCalls: PlannedCall[] = [];
  private activeIds = new Set<string>();
  private finalizedSort = 0;

  readonly scenario = signal<ScenarioForm>({ ...defaultForm });
  readonly ledger = signal<CallLedgerItem[]>([]);
  readonly backendHealth = signal<BackendHealth>('Unknown');
  readonly offlineMode = signal(false);
  readonly retryCountdownMs = signal(0);
  readonly running = signal(false);
  readonly totalRequests = signal(0);
  readonly completedCalls = signal(0);
  readonly failedCalls = signal(0);
  readonly timedOutCalls = signal(0);
  readonly controlsOpen = signal(false);

  readonly headerCompletedCalls = computed(() => this.completedCalls());
  readonly visibleLedger = computed(() => {
    const items = this.ledger();
    const active = items.filter((item) => !item.isFinal && this.activeIds.has(item.requestId)).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    const finished = items.filter((item) => item.isFinal).sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0));
    const waiting = items.filter((item) => !item.isFinal && !this.activeIds.has(item.requestId)).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    const activeVisible = active.slice(0, ACTIVE_LIMIT);
    return [...activeVisible, ...finished, ...waiting];
  });
  readonly statusBanner = computed(() => {
    if (this.offlineMode()) return 'Critical';
    if (this.running()) return 'Live';
    if (this.backendHealth() === 'Healthy') return 'Ready';
    if (this.backendHealth() === 'Unavailable') return 'Degraded';
    return 'Waiting';
  });

  constructor() {
    this.startHealthWatch();
    void this.checkHealth();
    this.destroyRef.onDestroy(() => {
      this.stopOfflineLoop();
      this.stopHealthWatch();
      this.activeRunId++;
    });
  }

  async checkHealth(): Promise<void> {
    try {
      await this.api.healthCheck();
      this.setHealthy(false);
    } catch {
      this.enterOfflineMode();
    }
  }

  updateScenario(patch: Partial<ScenarioForm>): void {
    this.scenario.update((current) => ({ ...current, ...patch }));
  }

  toggleControls(): void {
    this.controlsOpen.update((value) => !value);
  }

  resetScenario(): void {
    this.activeRunId++;
    this.running.set(false);
    this.controlsOpen.set(false);
    this.stopOfflineLoop();
    this.offlineMode.set(false);
    this.backendHealth.set('Unknown');
    this.ledger.set([]);
    this.totalRequests.set(0);
    this.completedCalls.set(0);
    this.failedCalls.set(0);
    this.timedOutCalls.set(0);
    this.scenario.set({ ...defaultForm });
    this.waitingCalls = [];
    this.activeIds.clear();
    this.finalizedSort = 0;
    void this.api.cancelCollapse().catch(() => undefined);
    void this.checkHealth();
  }

  async runScenario(): Promise<void> {
    if (this.offlineMode() || this.running()) return;

    const scenario = this.scenario();
    const runId = ++this.activeRunId;

    this.running.set(true);
    this.controlsOpen.set(false);
    this.ledger.set([]);
    this.completedCalls.set(0);
    this.failedCalls.set(0);
    this.timedOutCalls.set(0);
    this.totalRequests.set(scenario.requestCount);
    this.waitingCalls = [];
    this.activeIds.clear();
    this.finalizedSort = 0;

    if (scenario.collapseBackend) {
      try {
        await this.api.scheduleCollapse(scenario.collapseAfterSec, scenario.scenarioType);
      } catch {
        // ignore collapse schedule failure
      }
    }

    this.waitingCalls = this.buildPlan(scenario).map((planned) => {
      this.upsertLedger({
        requestId: planned.payload.requestId,
        callerId: planned.payload.callerId,
        scenarioType: planned.payload.scenarioType,
        receivedAt: new Date().toISOString(),
        stage: 'Call detected',
        outcome: 'Live',
        operatorName: null,
        queueWaitSec: null,
        callDurationSec: null,
        elapsedLabel: '00:00',
        notes: 'Incoming emergency call detected.',
        isFinal: false,
        sortOrder: 0
      });
      return planned;
    });

    try {
      await this.pumpQueue(runId);
    } finally {
      if (runId === this.activeRunId) {
        this.running.set(false);
      }
    }
  }

  private async pumpQueue(runId: number): Promise<void> {
    while (runId === this.activeRunId && !this.offlineMode()) {
      while (this.activeIds.size < ACTIVE_LIMIT && this.waitingCalls.length > 0) {
        const next = this.waitingCalls.shift()!;
        this.activeIds.add(next.payload.requestId);
        void this.runCallLifecycle(next, runId);
      }

      const allFinal = this.ledger().every((item) => item.isFinal);
      if (this.waitingCalls.length === 0 && this.activeIds.size === 0 && allFinal) {
        break;
      }

      await this.delay(250);
    }
  }

  private async runCallLifecycle(planned: PlannedCall, runId: number): Promise<void> {
    const payload = planned.payload;
    const requestId = payload.requestId;

    try {
      await this.delay(3000);
      if (!this.canContinue(requestId, runId)) return;
      this.patchLedger(requestId, {
        stage: 'Routing...',
        elapsedLabel: '00:03',
        notes: 'Routing intake to the next available operator.'
      });

      if (planned.finalOutcome === 'Timed Out') {
        await this.delay(3000);
        if (!this.canContinue(requestId, runId)) return;
        const result = await this.api.simulateOne(payload);
        if (!this.canContinue(requestId, runId)) return;
        this.timedOutCalls.update((n) => n + 1);
        this.finalizeCall(requestId, result, {
          stage: 'Routing...',
          operatorName: null,
          elapsedLabel: this.formatDuration(result.queueWaitSec),
        });
        return;
      }

      await this.delay(3000);
      if (!this.canContinue(requestId, runId)) return;
      this.patchLedger(requestId, {
        stage: 'Operator available',
        operatorName: planned.operatorName,
        elapsedLabel: '00:06',
        notes: 'Operator slot assigned under current surge conditions.'
      });

      await this.delay(3000);
      if (!this.canContinue(requestId, runId)) return;
      this.patchLedger(requestId, {
        stage: 'Call connected',
        outcome: 'Live',
        operatorName: planned.operatorName,
        elapsedLabel: '00:09',
        notes: 'Operator connected. Active intake in progress.'
      });

      const result = await this.api.simulateOne(payload);
      if (!this.canContinue(requestId, runId)) return;

      if (result.outcome === 'Completed') {
        this.completedCalls.update((n) => n + 1);
      } else {
        this.failedCalls.update((n) => n + 1);
      }

      this.finalizeCall(requestId, result, {
        stage: 'Call connected',
        operatorName: result.operatorName ?? planned.operatorName,
        elapsedLabel: this.formatDuration(result.callDurationSec)
      });
    } catch {
      this.patchLedger(requestId, {
        stage: 'Connection lost',
        notes: 'Dispatch backend became unreachable during active intake.',
        outcome: 'Live',
        isFinal: false
      });
      this.enterOfflineMode();
    } finally {
      this.activeIds.delete(requestId);
    }
  }

  private finalizeCall(requestId: string, result: DispatchResult, patch: Partial<CallLedgerItem>): void {
    this.finalizedSort += 1;
    this.patchLedger(requestId, {
      outcome: result.outcome,
      queueWaitSec: result.queueWaitSec,
      callDurationSec: result.callDurationSec,
      notes: result.notes,
      isFinal: true,
      sortOrder: this.finalizedSort,
      ...patch
    });
  }

  private buildPlan(scenario: ScenarioForm): PlannedCall[] {
    const total = scenario.requestCount;
    const timeoutTarget = scenario.intermittentTimeout ? this.computeOutcomeCount(total, 'timeout') : 0;
    const failedTarget = scenario.failedRefreshBurst ? this.computeOutcomeCount(total, 'failed', timeoutTarget) : 0;
    const timeoutIndexes = this.pickUniqueIndexes(total, timeoutTarget, new Set<number>());
    const failedIndexes = this.pickUniqueIndexes(total, failedTarget, timeoutIndexes);

    return Array.from({ length: total }, (_, idx) => {
      const index = idx + 1;
      let finalOutcome: OperatorOutcome = 'Completed';
      if (timeoutIndexes.has(index)) finalOutcome = 'Timed Out';
      else if (failedIndexes.has(index)) finalOutcome = 'Failed';

      const requestId = `CALL-${String(index).padStart(3, '0')}`;
      return {
        payload: {
          requestId,
          callerId: this.buildCallerId(),
          scenarioType: scenario.scenarioType,
          severity: scenario.severity,
          degradedUpstream: scenario.degradedUpstream,
          intermittentTimeout: finalOutcome === 'Timed Out',
          failedRefreshBurst: finalOutcome === 'Failed',
          plannedOutcome: finalOutcome
        },
        finalOutcome,
        operatorName: finalOutcome === 'Timed Out' ? null : this.pickOperator(requestId)
      };
    });
  }

  private computeOutcomeCount(total: number, kind: 'timeout' | 'failed', alreadyReserved = 0): number {
    if (total === 25 && kind === 'timeout') return 5;
    if (total === 25 && kind === 'failed') return 4;
    if (kind === 'timeout') return Math.max(1, Math.round(total * 0.2));
    return Math.max(1, Math.round((total - alreadyReserved) * 0.2));
  }

  private pickUniqueIndexes(total: number, count: number, excluded: Set<number>): Set<number> {
    const available = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !excluded.has(n));
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    return new Set(available.slice(0, Math.min(count, available.length)));
  }

  private pickOperator(seed: string): string {
    const index = seed.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % operators.length;
    return operators[index];
  }

  private canContinue(requestId: string, runId: number): boolean {
    return !this.offlineMode() && runId === this.activeRunId && this.activeIds.has(requestId);
  }

  private setHealthy(resetState: boolean): void {
    const wasOffline = this.offlineMode();
    this.stopOfflineLoop();
    this.offlineMode.set(false);
    this.backendHealth.set('Healthy');
    this.retryCountdownMs.set(0);
    if (resetState && wasOffline) {
      this.activeRunId++;
      this.running.set(false);
      this.ledger.set([]);
      this.totalRequests.set(0);
      this.completedCalls.set(0);
      this.failedCalls.set(0);
      this.timedOutCalls.set(0);
      this.waitingCalls = [];
      this.activeIds.clear();
      this.finalizedSort = 0;
    }
  }

  private enterOfflineMode(): void {
    if (this.offlineMode()) return;
    this.backendHealth.set('Unavailable');
    this.offlineMode.set(true);
    this.running.set(false);
    this.startOfflineLoop();
  }

  private startOfflineLoop(): void {
    if (this.offlineRetryTimer) return;
    this.scheduleRetryWindow();
    this.offlineRetryTimer = setInterval(async () => {
      const next = this.retryCountdownMs() - 1;
      this.retryCountdownMs.set(Math.max(next, 0));
      if (next > 0) return;
      try {
        await this.api.healthCheck();
        this.setHealthy(true);
      } catch {
        this.scheduleRetryWindow();
      }
    }, 1);
  }

  private scheduleRetryWindow(): void {
    this.retryCountdownMs.set(this.retryCycleMs);
  }

  private stopOfflineLoop(): void {
    if (this.offlineRetryTimer) {
      clearInterval(this.offlineRetryTimer);
      this.offlineRetryTimer = null;
    }
    this.retryCountdownMs.set(0);
  }

  private startHealthWatch(): void {
    if (this.healthWatchTimer) return;
    this.healthWatchTimer = setInterval(async () => {
      if (this.offlineMode()) return;
      try {
        await this.api.healthCheck();
        this.backendHealth.set('Healthy');
      } catch {
        this.enterOfflineMode();
      }
    }, 2000);
  }

  private stopHealthWatch(): void {
    if (this.healthWatchTimer) {
      clearInterval(this.healthWatchTimer);
      this.healthWatchTimer = null;
    }
  }

  private buildCallerId(): string {
    return `11${this.randomBetween(100000000, 999999999)}`;
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private upsertLedger(item: CallLedgerItem): void {
    this.ledger.update((items) => {
      const index = items.findIndex((entry) => entry.requestId === item.requestId);
      if (index === -1) return [...items, item];
      const next = [...items];
      next[index] = item;
      return next;
    });
  }

  private patchLedger(requestId: string, patch: Partial<CallLedgerItem>): void {
    this.ledger.update((items) => items.map((item) => item.requestId === requestId ? { ...item, ...patch } : item));
  }

  private formatDuration(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
