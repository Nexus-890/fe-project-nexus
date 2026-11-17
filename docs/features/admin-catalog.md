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

## System configuration — #217

The delivered config-service contract is generated from
`docs/api/openapi/config-service.yaml`. GET `/api/v1/system/configs` returns
`key`, `value`, `defaultValue`, `description`, `service`, `applyMode` and
`configuredValue`, together with page metadata. PUT `/api/v1/system/configs/{key}`
returns only `{key,value}`, so the FE uses a dedicated short-response parser and
invalidates the full list after a successful save.

The service filter uses the delivered `service` field; there is no invented
`group` field. `KEYCLOAK_MANAGED` rows are shown as read-only with their effective
and configured values. Backend 400 errors such as `CONFIG_VALUE_INVALID` and
`CONFIG_KEY_EXTERNALLY_MANAGED` remain visible. 503 displays unavailable/retry.

No new `nexus.*` configuration key or backend endpoint is introduced. Existing
`NEXT_PUBLIC_API_URL` / `API_PROXY_TARGET` origin configuration is reused.
Gateway permissions from #217 cover the delivered config-service routes.

## Initial verification before the #217 develop merge

- Baseline typecheck passed. Generated DTO check initially found existing commerce
  and shipment drift; the generator resynchronizes both from delivered specs.
- 416 unit/transport tests passed, including PATCH null/omission semantics, DELETE
  204, backend 400/409 messages, warehouse bodies and ledger filtering.
- 8 Admin browser scenarios passed against the explicit Postman HTTP simulation:
  create/read/edit/move/delete; deletion conflicts and invalid depth; warehouse
  CRUD/status; SKU intake, refreshed balances and paginated ledger; config
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

The configuration flow now uses the delivered #217 contract. See the review
verification below for current evidence and its limits.

## Review verification, 2026-11-17

- Merged develop `89e26477`, generated config-service DTOs, and removed the obsolete
  proposal and generated proposal types. Regenerated user DTO drift introduced by
  the same develop merge.
- 419 unit/transport tests passed; 9 Admin browser scenarios passed, including
  short PUT response, list refetch, service filtering, wrong-type 400, boolean
  save, Keycloak read-only and preserving another setting’s unsaved draft.
- `npm run test:admin-config-live` passed against the packaged config-service:
  57 GET rows, distinct Keycloak effective/source values, successful short PUT,
  persisted reread, CONFIG_VALUE_INVALID and CONFIG_KEY_EXTERNALLY_MANAGED 400s.
  This runs the actual Spring controller, service, JWT validation and state file
  with isolated state; Keycloak and owner refresh use controlled HTTP dependencies.
  It does not certify the deployed gateway or a live Keycloak realm. Build the BE
  jar first with `config-service/.\mvnw.cmd verify`; set JAVA_HOME to JDK 21 or
  NEXUS_TEST_JAVA to the desired Java executable, then run the FE command.
- Config-service Maven verify passed 46 tests. Catalog full verify was rerun after
  the develop merge: 99 tests passed, 39 errors because Testcontainers could not
  find Docker. This run does not re-establish PostgreSQL/Kafka startup. The
  category security/response-contract subset passed 17 tests.
- Default browser regression passed 58 scenarios with 72 environment-gated skips.
  Final lint, generated DTO drift check, regenerated-route typecheck and production
  Webpack build passed. Desktop 1440px and mobile 375px screenshots were inspected.
