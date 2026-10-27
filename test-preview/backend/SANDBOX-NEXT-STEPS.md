# Sandbox setup and deployment status

Status: local development only. No backend is deployed, no HTTPS endpoint has been created, and the browser client is not connected. POS API does not offer Sandbox, so these Sandbox tests concern Orders API and CASH Payments API only. Do not enable real payments.

## Current implementation

The local adapter uses SQLite to persist staff, sessions, immutable cash attempt payloads, and Square IDs. Staff passwords use scrypt with per-user random salt; sessions use random opaque identifiers stored hashed; POST requests require a matching CSRF token; the localhost-only HTTP adapter rejects untrusted origins. The user/password bootstrap values and Square Sandbox token are supplied through runtime environment variables, not committed to git. These tests do not validate a public deployment and the dev server must not be bound to a public interface.

This is not complete production authentication: roles, per-IP protections, durable audit records, revocation management, secure enrollment, robust session lifecycle, cross-device card/cash locks, secure HTTPS termination, and origin and cookie behavior on the intended domains remain unimplemented or unreviewed. Current bootstrap values may be read from process environment and must be provisioned securely. No production token is supported by the Sandbox-only service.

Tests: `node staff-auth.test.mjs`, `node server.test.mjs`, `node persistence.test.mjs`, `node service.test.mjs`, `node card-verification.test.mjs` and `node ../square-pos.test.cjs`. Mock Square responses only. Authenticated users can currently submit arbitrary prices, so an authoritative server-owned product catalog, tax configuration and price computation must be implemented before real use. The Square response is compared with submitted expected totals, but that does not prove that the submitted price was authorized. Card verification still has no trusted server-owned attempt creation, proof-of-association, payment-ID claim, or wired endpoint.

## Square Sandbox prerequisites

1. Sign in to Square Developer Dashboard and open the 723 application. In Sandbox, use its generated Sandbox test account and a Sandbox location.
2. Provision the Sandbox token and location into the eventual service's secret/environment facility directly, not in chat, the browser, or the repository. Test-only staff login setup also requires a secure enrollment procedure. Never use a production token for this phase.
3. Once an authenticated HTTPS backend exists, send prepared test orders and cash payments through it. Compare Square's returned line items, applied modifiers, tax lines, amount, location, currency and status. Test 8.25%, 7.25%, mixed rates, included toppings, non-taxable modifiers, duplicate attempts, timeouts and replay. Square may round differently than 723; mismatches must be held for review, never silently charged.

## Proposed hosting: Render, paid service with persistent storage

A paid Render web service with a persistent disk for SQLite is a possible low-volume Sandbox deployment, subject to security review. Render lists web service instances starting around $7/month and persistent disks at $0.25/GB/month. A single always-on 1 GB disk plus $7 instance suggests approximately $7.25/month before bandwidth, taxes, backups, and plan changes. Free Render web services do not support persistent disks and can lose local data, so they are unsuitable for the current SQLite design. A managed database and backup plan would change the estimate.

This is a proposal, not a configured service. Render requires binding to 0.0.0.0 and its assigned PORT; the current server intentionally listens on localhost only and must not simply be exposed. Before deployment, implement and review staff onboarding, HTTPS/secure cookies and CSRF for actual origins, rate limiting, payment-claim uniqueness, secret provisioning, durable backups, error recovery and authoritative prices. Then create a separate Sandbox web service and persistent database, set only the Sandbox environment variables in the provider secret manager, connect a separate HTTPS test UI, validate access and tests, and keep all production flags disabled. Do not add or use production credentials at this stage. Estimated price should be checked on the provider checkout before purchasing.

References: https://render.com/pricing ; https://render.com/docs/disks ; https://render.com/docs/free ; https://developer.squareup.com/docs/devtools/sandbox/overview ; https://developer.squareup.com/docs/pos-api/what-it-does
