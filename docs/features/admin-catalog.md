# Admin categories, warehouses, stock and configuration — #228

The Admin workspace now has `/backoffice/categories`, `/backoffice/warehouses`,
`/backoffice/stock` and `/backoffice/configuration`. The existing back-office layout
enforces ADMIN access before mounting these features. The API remains the security
boundary. No token is stored in a query key or persistent browser storage.

The category and configuration layouts follow the supplied `06 · Admin.png` design.
Warehouse and stock screens reuse the same semantic colours, borders, typography,
forms and table controls. Tables scroll within their panels on narrow screens.

## Delivered API integration

| Area | Operations |
| --- | --- |
| Categories | Public GET tree and detail; authenticated POST, PATCH and DELETE |
| Warehouses | Authenticated GET list and detail, POST and PUT detail |
| Inventory | Authenticated POST intake, GET balances, GET movements |

Category parents exclude the category itself and all its descendants. Moving to
the root sends `parentId: null`. The backend validates depth and other move rules;
400 and 409 Problem Details remain visible in the editor. Deletion requires an
inline confirmation and accepts the empty 204 response. The catalogue response now
includes the stored nullable description so editing never replaces it with a
fabricated empty field. This is an additive DTO/spec change, without a migration.

Warehouses have immutable codes and editable names, addresses and statuses
(`ACTIVE`, `INACTIVE`, `MAINTENANCE`). The list supports text and status filters.
Stock intake retains the public product/SKU picker and optional default warehouse,
adds a named warehouse selector and rejects intake into an explicitly selected
non-active warehouse. Intake invalidates balances, movement pages and availability.
Movement pages retain their SKU/warehouse filters and show references and reasons,
including historical adjustment records. No adjustment form or write was added (D18).

Writes use the shared HTTP client, generic mutation hook, abort signal, duplicate
submission lock and auth generation guard. Protected queries use session keys and
`requiresAuth` metadata. Category writes invalidate the public tree cache as well.

## Pending configuration backend — #217

There is no delivered SYS-01/SYS-02 controller or OpenAPI on develop as of
2026-11-17. Per the agreed scope, this change implements the FE and leaves BE to
#217. ADR-009 proposes GET `/api/v1/system/configs` and PUT
`/api/v1/system/configs/{key}`. The exact DTO and gateway routing still require
agreement with that owner.

The explicit FE [schema proposal](../api/system-config-217-proposal.openapi.json)
defines `{key, value, defaultValue, description, group}` and PUT `{value}`, with
string, number and boolean scalar values. Its generated file is labelled as a
proposal, separate from delivered wire types. A real backend response is required:
production never supplies fixture keys or reports a local-only save as successful.
404/503 displays an unavailable state with retry. Each key has its own save and
discard control, so partial multi-key saves are avoided. Backend 400 type errors
preserve the edited value and display the backend message.

No new `nexus.*` configuration key or backend endpoint is introduced. Existing
`NEXT_PUBLIC_API_URL` / `API_PROXY_TARGET` origin configuration is reused. Existing
gateway permissions and public endpoint entries already cover delivered category,
warehouse and inventory endpoints; proposed SYS routes must be delivered by #217.

## Verification, 2026-11-17

- Baseline typecheck passed. Generated DTO check initially found existing commerce
  and shipment drift; the generator resynchronizes both from delivered specs.
- 416 unit/transport tests passed, including PATCH null/omission semantics, DELETE
  204, backend 400/409 messages, warehouse bodies and ledger filtering.
- 8 Admin browser scenarios passed against the explicit Postman HTTP simulation:
  create/read/edit/move/delete; deletion conflicts and invalid depth; warehouse
  CRUD/status; SKU intake, refreshed balances and paginated ledger; proposed config
  saves/type errors/unavailable retry; SELLER and SUPPORT_STAFF access denial.
- The final WH-03 detail-read scenario also passed independently after adding the
  authenticated warehouse detail query. Default browser regression passed 58
  scenarios, with 71 intentionally skipped by that suite's environment gates.
- Final lint, route-regenerated typecheck, generated DTO check and production
  build passed. Next's CLI emitted a security upgrade reminder during startup;
  final commands ran in CI mode without changing dependencies or application
  security settings.
- Desktop 1440px and mobile 375px screenshots are generated in ignored
  `test-results/admin-catalog/`. These are fixture UI checks, not live BE evidence.
- `catalog-service` Maven verify passed: 150 tests, zero failures/errors, with
  `.\mvnw.cmd verify '-Duser.timezone=UTC'`. The unqualified first run failed because
  PostgreSQL rejected the host JVM's `Asia/Saigon` alias. UTC applies to this test
  process only; application defaults are unchanged. PostgreSQL tests start the
  Spring context with `ddl-auto=validate`; category description creation/read is
  asserted against persisted data.

System configuration cannot be marked integrated end to end until #217 is
delivered and the proposed contract is reconciled. Live browser-to-gateway checks
remain distinct from the passing simulation and PostgreSQL service tests.
