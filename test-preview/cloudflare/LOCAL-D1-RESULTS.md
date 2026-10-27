# Local D1 integration results — 723 Order Station

The published test Worker remains locked and returns HTTP 503. No remote migration, deployment, credentials or Square requests were performed.

Using Wrangler 4.154.0, `wrangler d1 migrations apply 723-order-sandbox --local --config wrangler.local.jsonc` applied migrations 0001 and 0002 to a local emulated D1 database, not the user's remote database. A separate local-only Worker harness exercised the Cloudflare workerd runtime and the D1 binding: created a mock employee, wrong-password rejection, login, cashier access, admin rejection, CSRF token rejection, order persisted using server-owned prices, same-attempt concurrent requests, competing different attempts for one order, uncertain state and logout. The Worker returned `{ok:true}`. Tests use fake data and no Square connection. `npm test` also passed ten node tests with an SQLite adapter; those are distinct from local D1 integration.

## Local procedure only

From this directory: `npm ci`; create `wrangler.local.jsonc` by copying `wrangler.jsonc`, replacing the database ID with `00000000-0000-4000-8000-000000000000`, main with `test/local-d1-worker.mjs`, and `APP_MODE` with `local_test`. This configuration is for local testing only; never deploy it. Run `npx wrangler d1 migrations apply 723-order-sandbox --local --config wrangler.local.jsonc`, then `npx wrangler dev --local --config wrangler.local.jsonc --ip 127.0.0.1`. Make a local request; no token is required in that isolated harness. The production-configured `src/worker.mjs` rejects every request. `.wrangler`, dev config and secret files must not be committed.

## Remote test migration — not ready

First complete security review and migration review. Verify the exact Cloudflare account and the ID of the explicitly test-only D1 database, then replace the placeholder only in a local config or dedicated staging config. Inspect and back up existing test data and verify isolation. Review the SQL and migration ordering and idempotency. Only after the user's instruction and verification, use the reviewed `wrangler d1 migrations apply ... --remote` against the exact test database; inspect applied migration records and schema afterward. Do not run `--remote` against production, do not deploy any Worker or modify main, and do not run the local harness remotely. Exact commands and bindings must be finalized after the database identity is checked.

## Remaining before exposure or customer use

- The current worker is intentionally locked: auth, D1, catalog, order and attempt modules have only been integrated in a local test harness, not as public API endpoints. No frontend HTTPS integration, CORS or browser cookie design is implemented.
- Authentication code is a development candidate. The existing Node scrypt hashes are not migrated and employee enrollment has not been designed. The 600,000-iteration PBKDF2 candidate requires real CPU benchmarking against the Free 10ms limit. Per-account lockout needs concurrency, source/IP abuse controls, recovery, audit and independent security review. CSRF token checks and roles alone are not a complete web security implementation.
- Catalog reads use multiple parallel queries and may observe mixed versions during updates; make catalog snapshots transactional or versioned. Add authoritative stable per-order calculations, roles, safe employee management, CSRF/origin validation and cross-site session policies. Legacy orders must be migrated non-destructively.
- The initial per-order unique attempt constraint prevents safe new attempts even after verified cancellation; design reconciliation without enabling duplicates. No Square Sandbox backend, external call, idempotent provider operation, secure server secrets or production credentials exists.
- Check D1 write/CPU quotas and contention in realistic use, and verify no-cost usage. No claim of production or Sandbox readiness is made.
