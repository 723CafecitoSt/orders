# Local HTTPS integration, not deployment-ready

This phase adds `src/sandbox-api.mjs`, deliberately restricted to Wrangler localhost `APP_MODE=local_test`, and leaves the actual Worker entry point disabled. It offers login/logout, catalog, order create/get, attempt reserve/get, and admin-only mark uncertain. It never connects to Square or marks any payment completed. D1 uniqueness keeps uncertain operations locked; reconciliation and releasing locks requires provider proof and an audited state machine, neither implemented. Rate limits here use a single local fixed bucket only: they are NOT a public IP or distributed abuse control.

`test-client.mjs` is an experimental, default-off, memory-only browser adapter restricted to localhost HTTPS. It is not wired into the POS interface. Cross-origin bearer tokens remain exposed to page scripts and XSS, and security headers, CSP, session design, origin configuration and browser integration require review. The real GitHub Pages frontend is not connected.

## Tests performed

15 node tests passed. Wrangler 4.154.0 local workerd with a fresh local D1 applied all four migrations. Local HTTPS HTTP tests passed: allowlisted Origin and CORS preflight, disallowed origin, login, rejected unauthenticated and invalid CSRF requests, catalog, order server pricing and persistence, competing concurrent retries, conflicting attempts, cashier denied admin endpoint, logout/revocation and local login throttling. Wrangler's self-signed certificate was accepted by disabling certificate verification only in the local test process; this does not test public certificate validation, browser/CORS behavior or remote network security. Existing Node tests verify mixed tax rates, quantities, topping and modifier calculations. No real or sandbox Square payment was created.

## Known security blockers

- Audit writes are separate from mutations: an audit failure after a successful mutation can produce an error response despite a committed change. Make audit and critical state changes atomic and test failure injection.
- Audit is incomplete for rejected attempts, admin investigation and reconciliation; no safe employee onboarding, admin management or audit retention policy exists.
- Local source throttling is not a production IP limiter; add a trusted source signal, account/IP abuse protection and cleanup/bounds for rate rows. Review concurrency and account enumeration.
- Security review of session handling, session lifetime, CSRF/CORS, CSP, secrets, XSS, request size streaming, error paths, and employee permissions is still required. Do not deploy this endpoint publicly.
- The database permits one attempt per order and does not safely release attempts or verify Square status. Implement provider-backed reconciliation and audit before allowing retry with a new key.
- POS interface is not connected; catalog synchronization and simulation UX still need work. The local test adapter is not a deployed GitHub Pages integration.

## Remote D1 test migration procedure — DO NOT RUN YET

1. Identify Cloudflare account, exact test D1 database name and immutable ID; confirm it is not production. Inspect schema and applied migration history, and review the four SQL migration files and existing data.
2. Create a backup/export, verify recovery to a separate test database and record its bookmark. Compare the intended schema with that database; check 0004 table names for conflicts and storage limits. Review the effects of all pending migrations and rollback/recovery method.
3. Prepare a separate Worker configuration with that test database ID, no production bindings or credentials, no real payments, and no automatic deployment. Review permissions and exact frontend origin.
4. Request explicit authorization identifying the database, SQL files and backup before running remote migration. Verify the migration list and schema immediately afterward, and perform only non-payment test queries. Deployment itself also needs separate authorization and security review.
