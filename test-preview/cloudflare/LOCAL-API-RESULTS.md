# Local-only Worker API and catalog consistency

No public Worker, remote migration, or real charge was made. The existing `src/worker.mjs` remains locked. `src/local-api.mjs` refuses requests unless APP_MODE is `local_test` and the URL origin is exactly http://127.0.0.1:8797; it is an integration harness, not a public HTTPS design. Its login returns a bearer token for local testing; no production cookie or cross-origin frontend strategy is provided. There is no public API, Square integration, staff onboarding, source/IP rate limiting, audited recovery or production-ready session architecture.

## What was tested

- Wrangler local D1 applied migration 0003 after 0001 and 0002. D1 `batch` reads the catalog and its revision in one transaction. SQL triggers bump revision for catalog writes. Inserting an order checks the same revision and rejects stale reads; saved orders keep their own snapshot.
- Workerd plus local D1: local test HTTP routes checked login and bad password, invalid CSRF, unauthorized requests, server-priced order, a client-submitted fake price, duplicate order rejection, concurrent identical reservation and conflicting operation rejection, and logout. Fake data only; no remote resources.
- Eleven Node tests passed, including a simulated catalog update between the read and insert. Node SQLite adapter tests are separate from Wrangler local D1 tests.
- A local Node `pbkdf2Sync` benchmark of 600,000 SHA-256 iterations used 80.4–85.4 ms process CPU across five samples. This is not Cloudflare's measured WebCrypto CPU accounting. The Worker Free plan's advertised limit is 10 ms CPU per HTTP request with some runtime flexibility. Do not infer compatibility from local tests, and do not reduce password hashing strength merely to fit the limit. Benchmark under an authorized isolated Cloudflare test before choosing a reviewed alternative.

## Remaining security work

- Account-specific lockout is not a comprehensive rate limiter: it needs concurrency review, IP/source protection and abuse-resistant account recovery. A local fixture provisioned employees only for testing; secure staff enrollment and roles in authenticated routes remain unfinished.
- Cross-site browser sessions between GitHub Pages and the Worker require a reviewed HTTPS origin/CORS, CSRF and session architecture; browser token handling, content security policy, cookies and cross-site restrictions are not complete. The local Origin check and CSRF checks do not establish public safety.
- Test separate devices and fail-closed operations against real D1 after authorization. The schema prevents multiple attempts per order even after a confirmed failure; a reconciled, auditable recovery state machine is not implemented. Never retry uncertain payments with new keys. No automatic resolution, Square secrets, external transaction or verification backend exists.
- Review all migrations, production existing data and rollback/recovery; do not run remote migrations or deploy the local test harness. Actual Cloudflare CPU/limits, runtime telemetry, concurrency under load, D1 backups and Sandbox Square order/tax rounding must be evaluated before production.
- Before any remote activity, verify the exact D1 test database ID and test account in the Cloudflare dashboard, review all SQL, and obtain explicit user authorization for that specific migration. Do not alter GitHub main or production Pages.
