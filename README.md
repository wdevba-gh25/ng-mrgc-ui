# Angular Signals Emergency Surge Demo, Frontend

## Overview

This frontend is a **supervisor-facing emergency operations dashboard** built to simulate how a healthcare-oriented emergency intake module could behave under extreme pressure scenarios.

The goal of the demo is not to reproduce a full emergency platform. The goal is to provide a compact, believable, and visually understandable MVP that can quickly prove product value in situations where a client already has a triage platform for normal incidents, but lacks a dedicated module for **large-scale emergency events**.

This project is intentionally **frontend-first**, but it is structured to support further growth into a larger operational UI with richer service integration, stronger domain separation, more advanced dashboards, and real platform connectivity.

---

## Why a Supervisor Dashboard Instead of an Operator Dashboard?

This MVP was intentionally designed as a **supervisor dashboard**, not as a single-operator screen.

That decision was product-driven.

The client scenario behind this concept was not to replace the detailed workflow of one operator. Instead, the objective was to demonstrate how a meaningful new module could quickly add value to an existing healthcare triage platform that already handles normal incidents, but does not yet include a dedicated operational surface for **large-scale emergency situations**.

A supervisor-facing dashboard is the more strategic MVP because it can:

- provide immediate visibility into incoming call pressure
- highlight active, unresolved, failed, and timed-out calls
- surface degraded conditions and backend outages
- support staffing, escalation, and fatigue-related decisions
- fit naturally as a pluggable module inside an existing SaaS healthcare or CRM platform

If approved as a future product direction, this dashboard could later be fed through API integration with the client’s existing platform, for example by consuming:

- real operator rosters
- operator availability
- staffing assignments
- queue pressure indicators
- incident metadata
- CRM-linked case context, where appropriate

That is why this MVP should be understood as a **pluggable emergency command module**, not as a replacement for the client’s current triage workflows.

---

## Why Technical Telemetry Was Removed from the Operator/Supervisor UI

Earlier versions of the demo exposed technical concepts such as latency-oriented indicators and other implementation-facing elements.

Those were intentionally removed from the supervisor-facing UI.

The reason is simple: a supervisor should make decisions based on **operational clarity**, not on developer-oriented telemetry.

For this MVP, the supervisor should understand the situation through:

- header summary
- backend status
- active calls
- final call outcomes
- offline/critical state

Technical telemetry such as percentiles, request timing analysis, and deeper observability signals belong to:

- backend logs
- Azure Monitor / Application Insights
- KQL / technical dashboards
- future support/admin views

That separation makes the product more believable and more useful.

---

## Why the Live Event Log Was Removed

The live event log was removed from the supervisor view because it introduced too much noise without improving the supervisor’s ability to understand the situation quickly.

For this MVP, the most important operational surfaces are:

- the summary in the header
- the current active calls
- the historical call ledger
- backend availability

A constantly growing event stream distracted from those core decisions.

Technical event streams remain better suited for backend logs and observability tooling than for the main supervisor console.

---

## Why Visible Simulation Modes Were Simplified

Earlier iterations exposed technical simulation labels such as:

- Sequential
- Concurrent
- Burst

Those terms were removed from the visible UI because they describe **implementation behavior**, not supervisor-facing business concepts.

A real supervisor does not think in terms of "concurrent" or "burst" mode. A supervisor thinks in terms of:

- incoming call pressure
- queue growth
- operator saturation
- unresolved calls
- failed or timed-out outcomes

For this reason, the visible model was simplified into a clearer supervisor-oriented flow.

Internally, the demo currently behaves as a **queue-driven sequential simulation** so the lifecycle of active calls, waiting calls, and final outcomes remains easy to follow.

More advanced intake patterns could be added later, but they would require additional complexity in:

- arrival-pattern modeling
- operator assignment
- priority handling
- routing rules
- UI behavior and explanation

For this MVP, clarity was more important than exposing every simulation mechanism.

---

## Why a Queue-Based UI Model Was Introduced

As the narrative matured, it became clear that replacing active rows too early broke the supervisor story.

To solve that, the frontend introduced a simple queue-oriented model.

At a high level, the UI distinguishes between:

- incoming calls
- active calls
- finalized calls

Only a limited number of active calls remain visible in the main active area at a time. New calls wait until one of the current visible calls reaches a final outcome.

This improves continuity and makes the dashboard more believable for a supervisor who needs to understand what is happening **now**, not just see the latest arrivals replacing everything else.

This was not added as unnecessary complexity. It was added because it improves operational clarity.

---

## Final Outcome Model

The dashboard uses business-oriented outcomes instead of raw technical statuses.

### Completed
The operator successfully attends the call, supports the caller, dispatches emergency help, and closes the interaction.

### Failed
The operator attended the call, but the interaction was lost before successful completion, for example due to communication interruption or similar disruption during the live call.

### Timed Out
The call reached the backend intake system, but no operator picked it up in time because the system was saturated, no operator became available, or routing did not complete before the timeout threshold.

### Total Requests
The total number of incoming emergency calls received by the intake system, regardless of whether they were completed, failed, or timed out.

These categories are mutually consistent by design.

---

## Offline / Critical Mode

This MVP also includes an intentionally dramatic **offline mode**.

When the backend becomes unreachable, the dashboard switches into a critical state that emphasizes:

- backend unreachability
- retry loop behavior
- lack of active operational continuity
- recovery only when the backend becomes available again

This mode exists because failure and recovery are part of the product story. The purpose of the demo is not only to show a healthy system, but to show what the command surface looks like under instability.

---

## What Was Intentionally Left Out

To keep the MVP focused and shippable within the available time, several production-oriented capabilities were intentionally left out of this version, including:

- SignalR or similar real-time push infrastructure
- Redis or distributed caching
- distributed messaging/event-bus patterns
- persistent storage
- deeper role and authorization models
- richer audit/history services
- advanced operator assignment rules
- real platform integrations

These omissions were intentional.

Adding them at this stage would have increased complexity significantly and would have shifted the project away from its primary purpose: **a compact, credible, understandable supervisor-console MVP**.

---

## Growth Path

Although this version is not built for true high-throughput production traffic, the architecture is intentionally clear enough to evolve in that direction.

The current structure already separates key concerns such as:

- scenario control
- queue handling
- active call lifecycle
- outcome classification
- backend availability
- supervisor-facing visibility
- observability hooks

That means the frontend can later evolve toward:

- richer state management
- real API integration
- multi-supervisor and operator-specific views
- stronger component/domain separation
- real-time updates
- live staffing data
- larger-scale operational modules

While this is not a distributed application today, its structure leaves a clear path to evolve in that direction if the use case demands it.

---

## Code Highlights

These are the areas most worth reviewing when reading the frontend code:

- queue-driven lifecycle logic for incoming, active, and finalized calls
- supervisor header counters derived from call outcomes
- staged call progression for active calls
- offline/critical mode behavior
- scenario-control panel behavior and UX decisions
- outcome-driven ledger rendering

---

## Running the Frontend

Use the usual Angular workflow for local development.

Typical flow:

```bash
npm install
ng serve
```

The frontend expects the backend demo to be running locally for the full simulation experience.
