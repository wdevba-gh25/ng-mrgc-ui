# Architecture-UI

## Emergency Surge Demo, Frontend / Supervisor Console Architecture

This diagram focuses on the **UI architecture**, not on infrastructure or deployment.

The purpose of this view is to show how the frontend was structured around:
- supervisor-first interaction design
- queue-driven call visibility
- clear operational summary
- distinct offline/critical behavior
- separation between operator-facing state and technical telemetry

```text
+----------------------------------------------------------------------------------+
|                          Supervisor Dashboard Shell                              |
|----------------------------------------------------------------------------------|
| Brand / Hospital Identity | Backend Status | Counters | Supervisor Identity      |
+-------------------------------------------+--------------------------------------+
                                            |
                                            v
+----------------------------------------------------------------------------------+
|                           Scenario Control Shell                                 |
|----------------------------------------------------------------------------------|
| Title: Critical Incident Simulator                                               |
| Selected Scenario                                                                |
| Run Scenario | Reset | Toggle Details                                            |
+-------------------------------------------+--------------------------------------+
                                            |
                                            v
+----------------------------------------------------------------------------------+
|                        Scenario Control Details Panel                            |
|----------------------------------------------------------------------------------|
| Scenario Type | Emergency Calls | Intake Pressure | Severity                     |
| Degraded Upstream | No Operator Available | Caller Hang Up | Collapse Backend     |
+-------------------------------------------+--------------------------------------+
                                            |
                                            v
+---------------------------+     +-----------------------------------------------+
|      Header Summary       |     |               Call Ledger                     |
|---------------------------|     |-----------------------------------------------|
| Backend                   |     | Active Calls, max 3 visible / pinned          |
| Completed Calls           |     | Waiting Calls remain queued                   |
| Total Requests            |     | Finalized Calls move to history               |
| Failed                    |     | Stages and outcomes shown per row             |
| Timed Out                 |     +----------------------+------------------------+
| Status                    |                            |
+-------------+-------------+                            v
              |                      +--------------------------------------------+
              |                      |        Call Lifecycle / Queue Model        |
              |                      |--------------------------------------------|
              |                      | waitingCalls                               |
              |                      | activeCalls                                |
              |                      | finishedCalls                              |
              |                      +----------------------+---------------------+
              |                                             |
              |                                             v
              |                        +------------------------------------------+
              |                        |         Active Call Stage Flow           |
              |                        |------------------------------------------|
              |                        | Call detected                            |
              |                        | Routing...                               |
              |                        | Operator available                       |
              |                        | Call connected                           |
              |                        | Final outcome                            |
              |                        +----------------------+-------------------+
              |                                             |
              |                                             v
              |                       +-------------------------------------------+
              |                       |        Final Outcome Classification       |
              |                       |-------------------------------------------|
              |                       | Completed                                 |
              |                       | Failed                                    |
              |                       | Timed out                                 |
              |                       +----------------------+--------------------+
              |                                             |
              v                                             v
+-----------------------------+         +------------------------------------------+
|     Offline / Critical UI   |         |      Frontend State / Services          |
|-----------------------------|         |------------------------------------------|
| Server unreachable          |         | Scenario state                           |
| Retry loop / countdown      |         | Queue orchestration                      |
| Critical visual treatment   |         | Counter synchronization                  |
| Recovery resets dashboard   |         | API adapter to backend                   |
+-----------------------------+         +----------------------+-------------------+
                                                              |
                                                              v
                                          +----------------------------------------+
                                          |          Backend Simulation API         |
                                          |----------------------------------------|
                                          | /health                                |
                                          | /simulate/dispatch                     |
                                          | /simulate/collapse                     |
                                          +----------------------------------------+
```

## Main UI Design Decisions

### Supervisor-first instead of operator-first
The UI was intentionally designed as a **supervisor console**, not a single-operator screen.

This makes the dashboard better suited to:
- large-scale event oversight
- queue pressure monitoring
- operator fatigue/escalation decisions
- integration as a pluggable module inside an existing triage or CRM platform

### Queue-based active visibility
Calls are not replaced immediately in the visible active area.

The UI keeps:
- waiting calls
- active calls
- finished calls

This prevents active calls from disappearing before they reach a final outcome and makes the supervisor view more believable.

### Header as operational summary
The header was used as the primary operational summary surface so the supervisor can immediately see:
- backend status
- completed calls
- total requests
- failed calls
- timed out calls
- overall status

### Technical telemetry removed from the visible supervisor surface
Developer-facing telemetry such as percentile metrics or verbose event logs was intentionally removed from the main supervisor UI to preserve operational clarity.

### Offline mode as a first-class UI state
The frontend treats backend loss as a distinct command-state, not just a generic error.
That makes the product narrative much stronger under failure and recovery scenarios.

## Growth Path

This UI architecture is intentionally compact, but it leaves room to evolve toward:
- richer state management
- real-time updates
- operator-specific dashboards
- staffing overlays
- role-based views
- live platform integrations
- more advanced call classification and routing logic
