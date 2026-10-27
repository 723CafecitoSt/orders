# Browser integration status

## Browser installation
Attempted the installed Playwright CLI to install Chromium 151.0.7922.34. Downloads from cdn.playwright.dev yielded zero-byte or truncated archives, so installation failed. No Chromium, Chrome or Firefox binary was found under /usr or /opt, and the Playwright executable path did not exist. No browser UI or visual test was run. A supported local browser environment with network access to the Playwright browser binaries is required; do not declare the UI flow complete.

## Local changes and tests
The opt-in local POS adapter has a Restore pending order button. The saved draft includes the original order number, date, notes and items so it can be restored after a reload; this remains untested in a browser. The adapter adds Print Kitchen Ticket for the most recent connected order, 80 mm CSS, a localStorage log of print-dialog attempts and an explicit confirmation and REPRINT label on repeat. That log is device-local, not a shared or authenticated D1 print audit. A print-dialog attempt does not establish that paper was printed. No physical printer was tested.

Migration 0007 introduces staff station access. Admins can access both; cashiers require explicit access entries. API routes check the station on reads and status changes. Provisioning UI and remote security review are not implemented. This local migration was applied only to fresh disposable Wrangler D1, never remotely.

A local fixture creates admin and unprivileged test staff, matching the actual POS product and modifier IDs for Latte, Waffle, Caramel, Nutella, milk and temperature. Wrangler HTTPS + D1 API test confirms Iced Latte + Caramel and Waffle + Nutella, first waffle topping included, total $17.32 at 8.25% for both, station routing and denied access for an employee without permission. Another API test confirms order persistence, separate sessions, Ready state, stale-update rejection and duplicate order rejection. The 19 Node tests pass. These are API and Node tests, NOT button or browser tests; local certificate checks were disabled only in test processes.

## Remaining blockers
- Actual UI->D1->two kitchen browser test including the order number and visual ticket was not performed. Server-generated human order number and catalogue sync/authorized tax override are not implemented. Local UI and D1 require compatible catalog IDs and rates.
- Restore after reload, print CSS/dialog, error cases and two independent phone/tablet sessions need real browser tests. Print log is local to one device and cannot prevent duplicate printing on two devices. No exactly-once printing guarantee.
- Kitchen retains a 500-row limit; ordering newer items first is not pagination or archiving. Station permissions require secure admin provisioning and test coverage of allowed and denied status updates. Kitchen data separation, permissions, HTTPS sessions, rate limiting and audit require security review.
- Worker deployment remains locked; no remote D1 migration, Square Sandbox transaction or real payment occurred. These changes are not for customer use.
