# Angular Signals Emergency Surge Demo

Frontend-only emergency command dashboard built with Angular 20 Signals.

## What changed in this revision

- Removed P95 and technical telemetry from the operator-facing UI.
- Kept the Boston Hospital command shell and operator dashboard feel.
- Switched the ledger to business outcomes: Completed, Failed, Timed Out.
- Added offline contingency mode with automatic retry countdown.
- Concurrent runs now preserve partial outcomes instead of dropping the whole batch.
- The backend-facing technical latency still exists in the API payload for later Azure observability work, but it is intentionally hidden from operators.

## Local run

```bash
npm install
npm start
```

The app expects the Node backend at `http://localhost:4001`.
