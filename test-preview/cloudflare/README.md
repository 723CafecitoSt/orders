# 723 Order Station — Cloudflare Sandbox scaffold

**NOT READY TO DEPLOY.** This is an incomplete development scaffold. The Worker deliberately returns HTTP 503 and never accepts orders, sessions, secrets, or payments. Do not publish, connect GitHub Builds, configure credentials or use with customers yet. Existing GitHub Pages and `main` are untouched. The previous cash and Square simulations remain in `test-preview/index.html`.

## What exists

- `migrations/0001_schema.sql` defines employees, sessions, catalog, groups, modifiers, orders, and attempts with database uniqueness constraints. It has been tested in local SQLite, not D1.
- `src/pricing.mjs` calculates server-owned base prices, authorized modifiers, included choices and 0%, 7.25%, 8.25% tax with per-rate cent rounding. It has unit tests; catalog editing, loading the catalog from D1 and order APIs are not connected.
- `src/worker.mjs` is locked and rejects every request. It has no authentication, CORS, CSRF, Square Sandbox API or payment endpoints.
- `wrangler.jsonc` uses a placeholder D1 ID, disables workers.dev and preview URLs, and is not a deployment authorization.

## Work required before security review

1. Implement staff authentication and secure enrollment compatible with Web Crypto, session expiry/revocation and account/IP throttling within Workers Free CPU limits. Adapt existing scrypt credentials via a reviewed migration, never silently reset accounts. Create sessions with HttpOnly, Secure cookies and explicit trusted origin controls.
2. Implement strict allowlisted origins, CORS preflight, CSRF validation on all state changes, a secure browser integration, password and secret management. No secrets in Github, URLs, logs, or frontend.
3. Wire D1-backed server-owned catalog and tax rules, authorize admin updates, snapshots and immutable order histories. Protect against manipulated prices, quantities, free modifier ordering, tax classifications and stale catalog revisions.
4. Implement atomic D1 reservation and stable idempotency across retries, cash and card and devices. The unique database indexes are a foundation, not an implemented transaction flow. Never release an uncertain attempt based only on a timeout or browser callback.
5. Implement Square Sandbox Orders and CASH Payments from server-owned snapshots, compare Square's returned total and tax breakdown before proceeding, and reconcile timeouts with the same idempotency keys. Never configure production tokens; block all real payments. Handle non-taxable modifiers and rounding mismatches by refusing and reviewing.
6. Add mocked tests, Wrangler/Miniflare integration tests with actual local D1, HTTPS browser tests, concurrent/replay/security tests, failure recovery and a security review. Square POS API cannot be tested in Sandbox; use simulation until explicitly authorized real test.

## First steps on Cloudflare — safe account preparation only

1. Open https://dash.cloudflare.com/ and sign in or create a Cloudflare account. Choose the **Free** Workers plan; do not buy a paid plan.
2. In the menu, open **Storage & databases > D1 SQL Database** and choose **Create database**. Name it `723-order-sandbox`. It is a separate test database; do not put real customer data in it. Creating a database does not deploy this Worker.
3. Tell the developer when the database exists. The developer must complete and review the unfinished items above. Do not create a public Worker or apply migrations yet.
4. After the code has been reviewed, the developer will supply a revised checklist for creating a private preview, applying the reviewed migration and configuring secrets. Neither `workers_dev: false` nor a branch name is a substitute for an access policy.

## GitHub branch policy (after review, not now)

Cloudflare Workers Builds may deploy on push, and defaults may point to the repository's default branch. In Workers & Pages, connect `723CafecitoSt/orders` only after review. Under the Worker settings, explicitly configure branch control for `test/editable-prices-modifiers`; disable other branches and automatic deployment until the deployment settings and audience are reviewed. Use a separate test Worker and a separate D1 database; GitHub Pages stays unchanged. Do not connect `main` or change its Pages settings. Never run `wrangler deploy` without the user's authorization. Creating a preview can still expose an endpoint, so enforce access controls before any preview.

## Planned secrets (not implemented or requested yet)

- `SQUARE_SANDBOX_ACCESS_TOKEN`: Square-issued Sandbox token, set personally in Cloudflare secrets only after the backend is implemented and reviewed. Never send it in chat.
- `SQUARE_SANDBOX_LOCATION_ID`: Sandbox location identifier; configuration can be a variable if it is not sensitive, but keep it separate from production.
- Other session/enrollment secrets are not specified yet; select them only once the authentication architecture is implemented and reviewed. No production Square credentials should be set.

See https://developers.cloudflare.com/workers/configuration/secrets/ and https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/.

## Limits and outages

As of October 2026, the Free Workers allowance is 100,000 requests/day and 10 ms CPU/request; D1 includes 5 million rows read/day, 100,000 rows written/day and 5 GB total storage. Check current terms before use. When limits or connectivity fail, the existing client may prepare an order offline, but do not initiate a payment. An uncertain payment must remain locked: reconnect, inspect Square, and reconcile using the same stored operation and idempotency key; never create a fresh attempt simply because of a timeout. The scaffold does not yet implement this reconciliation.
