# Mission Control Hardening Recommendations

## Short Term (this week)
1. **Type-check in CI**
   - Enable `tsc --noEmit` and fail build on type errors (currently build skips type validation).
2. **Schema validation for APIs**
   - Add Zod validation in critical routes (`/api/tasks`, `/api/produce`, `/api/content-pipeline`).
3. **Unify queue state model**
   - Move from in-memory `queueRunning` flag to DB-lock based queue worker for restart safety.
4. **Error envelopes**
   - Standardize API error shape `{ error, code, details? }` and display in UI toasts.

## Medium Term (2-4 weeks)
1. **Background jobs worker**
   - Move heavy/long-running orchestration into dedicated worker process.
2. **Idempotency keys for task creation**
   - Prevent duplicate creates under retries/network flakes.
3. **Audit + tracing**
   - Correlate `task_id`, `agent_id`, and request IDs across logs/routes.
4. **Rate-limit/backoff layer**
   - Centralized backoff policy for Replicate/OpenRouter calls.

## Long Term
1. **Role-based permissions**
   - Separate admin/system actions from user-level actions.
2. **Contract tests for agent loops**
   - Simulate queue, producer, review gates, and backlog pressure in integration tests.
3. **Feature flags**
   - Runtime toggles for loop controls and auto behaviors.

## Observed Fragility Areas
- Dynamic data rendering in dashboard metrics (fixed with defensive coercion).
- Immediate wake trigger path for review notifications (partially hardened, still worth central event queue).
- Queue lifecycle split between in-memory and DB state.
- Multiple task creation paths required consistent dedupe/gating enforcement.
