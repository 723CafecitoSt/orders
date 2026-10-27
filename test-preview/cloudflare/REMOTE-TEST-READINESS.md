# Remote test readiness — blocked, do not deploy

Only local work is implemented. The public Worker entry point remains locked and all payments are disabled. `src/sandbox-api.mjs` and browser adapter only accept localhost, so this is not a deployable test backend. No Cloudflare resource, remote D1, production website or Square account was modified.

## Pagination added locally
Kitchen API uses a descending rowid cursor, maximum 100 records per page, and returns nextCursor. The kitchen UI has Newer/Older buttons. On polling an older page, the user must return to the newest page to see new items. Wrangler local D1 HTTPS test created two orders and validated two pages with limit 1 and rejected invalid page size. Local test also covered two sessions and kitchen state conflict. It did not test 500+ items or an actual browser. Deleting/rebuilding table rows, concurrent inserts while paginating and retention must be reviewed before operational use.

## Critical blockers for safe remote testing
- Design and review isolated HTTPS Worker with strict origin and safe session management, trusted source IP rate limiting, session revocation/expiry, employee provisioning, CSRF, CORS, log privacy and security monitoring. Local-only auth and shared rate bucket are not a remotely safe setup. Independently review before any public deployment; Access policy and private bindings are not configured.
- Define independent GitHub Pages test origin and test D1 ID, separate configuration from production, disable payment endpoints at build and runtime, establish secrets only in Cloudflare. No such deployment has been prepared or verified.
- Make backend catalog authoritative and synchronize UI IDs, pricing and tax selection with D1, including administrator authorization and preserving historical snapshots. Current UI hardcodes local endpoint and rejects rate disagreements. Human order numbers are not server-authoritative.
- Guarantee retry safety and reconcile duplicate requests by matching immutable request identity; localStorage pending draft restoration and remote disconnection have not been tested on browsers. Printing attempt log is local-only and cannot detect prints on another device.
- Complete pagination browser QA, authorization assignment UI and audit of denied actions. Physical ticket print, browser dialog, recovery after network failure, two real device sessions and mobile compatibility remain untested.

## Manual test checklist for later, not yet possible
1. Confirm an isolated test URL and test-only credentials through a secure channel; verify production data does not appear.
2. On Samsung, sign in and create Iced Latte + Caramel and Waffle + Nutella, confirm displayed taxes and total, save once.
3. On the second device sign in with Beverage permission, find the latte and mark Ready; repeat for Food with authorized Food account.
4. Reload both devices and verify status; repeat a request after a temporary disconnect and check there is exactly one saved order.
5. Open each 80 mm print preview, cancel and retry; verify the reprint notice. Only confirm physical output after inspecting paper.

The first eventual Cloudflare step is to identify the test D1 database and account on the dashboard without changing it. Do not apply migrations or deploy until the above blockers are resolved and the user specifically authorizes them.
