import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmergencyStoreService } from './emergency-store.service';
import { ScenarioForm } from './models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="shell">
      <nav class="topbar panel">
        <div class="brand-wrap">
          <div class="brand-mark">BH</div>
          <div>
            <p class="eyebrow">Emergency operations command</p>
            <h1>Boston Hospital Surge Command</h1>
            <p class="subcopy">Supervisor console for critical incident intake, routing pressure, and operator outcomes</p>
          </div>
        </div>

        <div class="operator-chip">
          <div class="avatar">WB</div>
          <div>
            <p class="operator-name">Walter B.</p>
            <p class="operator-role">Emergency shift supervisor</p>
          </div>
        </div>

        <div class="top-metrics header-grid">
          <div class="metric-card">
            <span>Backend</span>
            <strong [class.ok]="store.backendHealth() === 'Healthy'" [class.bad]="store.offlineMode()">
              {{ store.offlineMode() ? 'Offline' : store.backendHealth() }}
            </strong>
          </div>
          <div class="metric-card">
            <span>Completed calls</span>
            <strong>{{ store.headerCompletedCalls() }}</strong>
          </div>
          <div class="metric-card">
            <span>Status</span>
            <strong [class.bad]="store.offlineMode()">{{ store.statusBanner() }}</strong>
          </div>
          <div class="metric-card">
            <span>Total requests</span>
            <strong>{{ store.totalRequests() }}</strong>
          </div>
          <div class="metric-card">
            <span>Failed</span>
            <strong>{{ store.failedCalls() }}</strong>
          </div>
          <div class="metric-card">
            <span>Timed out</span>
            <strong>{{ store.timedOutCalls() }}</strong>
          </div>
        </div>
      </nav>

      <section class="controls-shell">
        <div class="panel controls-shell-head">
          <div>
            <p class="eyebrow">Scenario control</p>
            <h3>Critical Incident Simulator</h3>
            <p class="selected-scenario">Selected scenario: {{ store.scenario().scenarioType }}</p>
          </div>

          <div class="controls-toolbar">
            <button type="button" class="main-action" [disabled]="store.running() || store.offlineMode()" (click)="runFromButton($event)">Run scenario</button>
            <button type="button" class="main-action secondary" [disabled]="store.running()" (click)="resetFromButton($event)">Reset</button>
            <button type="button" class="toggle-arrow" (click)="toggleControls($event)" [attr.aria-expanded]="store.controlsOpen()">
              {{ store.controlsOpen() ? '▴' : '▾' }}
            </button>
          </div>
        </div>

        <section class="panel controls-panel" *ngIf="store.controlsOpen() && !store.offlineMode()">
          <div class="section-head compact-head">
            <div>
              <p class="eyebrow">Controls</p>
            </div>
          </div>

          <div class="form-grid">
            <label>
              <span>Scenario type</span>
              <select [ngModel]="store.scenario().scenarioType" (ngModelChange)="update('scenarioType', $event)">
                <option>Regional flooding</option>
                <option>Tornado outbreak</option>
                <option>Factory fire</option>
                <option>Refinery fire</option>
                <option>Earthquake</option>
                <option>Citywide blackout</option>
                <option>Power outage</option>
                <option>Mass casualty incident</option>
              </select>
            </label>

            <label>
              <span>Emergency calls</span>
              <select [ngModel]="store.scenario().requestCount" (ngModelChange)="updateNumber('requestCount', $event)">
                <option [ngValue]="5">5</option>
                <option [ngValue]="10">10</option>
                <option [ngValue]="25">25</option>
                <option [ngValue]="50">50</option>
                <option [ngValue]="100">100</option>
              </select>
            </label>

            <label>
              <span>Intake pressure</span>
              <select [ngModel]="store.scenario().dispatchMode" (ngModelChange)="update('dispatchMode', $event)">
                <option [ngValue]="'Sequential'">Sequential intake</option>
                <option [ngValue]="'Burst'">Heavy surge</option>
                <option [ngValue]="'Concurrent'">Mass incident</option>
              </select>
            </label>

            <label>
              <span>Severity</span>
              <select [ngModel]="store.scenario().severity" (ngModelChange)="update('severity', $event)">
                <option>Normal</option>
                <option>Degraded</option>
                <option>Severe</option>
              </select>
            </label>
          </div>

          <div class="toggle-grid">
            <label class="toggle-item"><input type="checkbox" [ngModel]="store.scenario().degradedUpstream" (ngModelChange)="update('degradedUpstream', $event)"> Degraded upstream response</label>
            <label class="toggle-item"><input type="checkbox" [ngModel]="store.scenario().intermittentTimeout" (ngModelChange)="update('intermittentTimeout', $event)"> No operator available before timeout</label>
            <label class="toggle-item"><input type="checkbox" [ngModel]="store.scenario().failedRefreshBurst" (ngModelChange)="update('failedRefreshBurst', $event)"> Caller hang up / interrupted live call</label>
            <label class="toggle-item"><input type="checkbox" [ngModel]="store.scenario().collapseBackend" (ngModelChange)="update('collapseBackend', $event)"> Simulate backend collapse / power outage</label>
          </div>

          <div class="form-grid collapse-grid" *ngIf="store.scenario().collapseBackend">
            <label>
              <span>Collapse after seconds</span>
              <input type="number" min="5" max="600" [ngModel]="store.scenario().collapseAfterSec" (ngModelChange)="updateNumber('collapseAfterSec', $event)">
            </label>
          </div>
        </section>
      </section>

      <section class="panel ledger-panel" *ngIf="!store.offlineMode(); else offlineLedger">
        <div class="section-head compact-head">
          <div>
            <p class="eyebrow">Call ledger</p>
            <h3>Live request status panel</h3>
          </div>
        </div>

        <div class="table-wrap latest-three">
          <table>
            <thead>
              <tr>
                <th>Call ID</th>
                <th>Caller ID</th>
                <th>Received</th>
                <th>Stage</th>
                <th>Outcome</th>
                <th>Operator</th>
                <th>Elapsed</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of store.visibleLedger()">
                <td>{{ item.requestId }}</td>
                <td>{{ item.callerId }}</td>
                <td>{{ formatClock(item.receivedAt) }}</td>
                <td><span class="stage-pill" [class.stage-alert]="item.stage === 'Connection lost'">{{ item.stage }}</span></td>
                <td>
                  <span class="status-pill" [class.pending]="item.outcome === 'Live'" [class.bad]="item.outcome === 'Failed' || item.outcome === 'Timed Out'">
                    {{ item.outcome || 'Live' }}
                  </span>
                </td>
                <td>{{ item.operatorName || 'Unassigned' }}</td>
                <td>{{ item.elapsedLabel }}</td>
                <td>{{ item.notes }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <ng-template #offlineLedger>
        <section class="panel offline-ledger narrow">
          <div class="section-head">
            <div>
              <p class="eyebrow">Call ledger</p>
              <h3>Live request status panel</h3>
            </div>
          </div>
          <div class="offline-box">
            <div class="offline-status">STATUS: CRITICAL</div>
            <p class="offline-line">Dispatch backend unreachable.</p>
            <p class="offline-line">Operator intake paused. Command console switched to contingency mode.</p>
            <p class="offline-retry">Retry in {{ store.retryCountdownMs() }} ms...</p>
          </div>
        </section>
      </ng-template>
    </main>
  `
})
export class AppComponent implements OnInit {
  readonly store = inject(EmergencyStoreService);

  ngOnInit(): void {
    void this.store.checkHealth();
  }

  update<K extends keyof ScenarioForm>(field: K, value: ScenarioForm[K]): void {
    this.store.updateScenario({ [field]: value } as Partial<ScenarioForm>);
  }

  updateNumber<K extends keyof ScenarioForm>(field: K, value: number | string): void {
    this.store.updateScenario({ [field]: Number(value) } as Partial<ScenarioForm>);
  }

  toggleControls(event: MouseEvent): void {
    event.stopPropagation();
    this.store.toggleControls();
  }

  async runFromButton(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    await this.store.runScenario();
  }

  resetFromButton(event: MouseEvent): void {
    event.stopPropagation();
    this.store.resetScenario();
  }

  formatClock(value: string): string {
    return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }
}
