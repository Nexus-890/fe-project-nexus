# Admin users, seller applications, logs and health (#227)

The existing `/backoffice` shell now uses the supplied `06 · Admin.png` horizontal navigation, compact tables, white surfaces and project semantic tokens. The issue's merged #231 and #264 frontend criteria are included. Seller, auction, stock and payout workspaces retain their routes.

| Route | Frontend access | Behavior |
| --- | --- | --- |
| `/backoffice/users` | ADMIN, SUPPORT_STAFF | Name/email search, role/status filters, sorting and pagination. Admin creates, edits, deletes, sets password, replaces roles and unlocks; Support only searches and edits. |
| `/backoffice/seller-applications` | ADMIN | Status queue, approval confirmation, mandatory rejection reason and authoritative refetch. Uses existing seller feature flag. |
| `/backoffice/event-logs` | ADMIN, SUPPORT_STAFF | Delivered metadata/date/search filters, pagination, full payload/envelope/original JSON inspector and current-page JSON export. |
| `/backoffice/audit-logs` | ADMIN | Immutable audit reads, actor/action/entity/date filters and current-page CSV export. |
| `/backoffice/health` | ADMIN, SUPPORT_STAFF | All reported services and brokers, UP/DOWN/UNKNOWN, broker failure/recovery times and refresh every 10 seconds. |

The previous `/backoffice/event-log` URL redirects to `/backoffice/event-logs`. JWT flat roles control menus, direct-route access and mutation availability; profile roles and privileges cannot grant a workspace. Backend authorization remains required. Private query keys include the auth session and all filters; session transitions abort requests, clear private cache and suppress late callbacks. User mutation credentials are scrubbed and their mutation cache is collected immediately.

## API dependencies

Delivered `notification-service` OpenAPI and matching controllers provide log/detail/audit/system-health/broker-health operations. There are no new backend endpoints or public resources in this MR, so gateway permission registration and public-endpoint configuration are unchanged.

Users list/detail exist in `develop` at `c502e351`. User writes and the role picker follow the exact unmerged #211 controller/DTO/OpenAPI at commit `4d54e30851b8d922861e90055f5aa41e174284dc`, captured in [the frontend snapshot](../api/admin-user-211.openapi.yaml). The generator keeps this snapshot distinct from delivered user DTOs. Deploy #211 before claiming live user-management acceptance. A 404/403/409/503 remains visible; production never falls back to fixtures.

Seller #210 is absent from develop. The existing [contract handoff](../api/seller-application-210.md) now includes Admin list and decision DTOs. `NEXT_PUBLIC_SELLER_APPLICATION_ENABLED` defaults to `false` and must remain disabled until a compatible backend implements the complete lifecycle. Enable it explicitly for the local browser simulation. Existing `/become-a-seller` handles duplicate 409, stored pending state, rejected reason/reapplication and new sign-in after approval. This MR reuses that implementation.

The screenshot's trust scores/identity projections, audit IP/change diffs and health latency/SLA/uptime history are absent from the delivered response contracts. The UI displays available account status, event metadata and health states. No synthetic production metrics or extra backend operations are added. Health uses the issue's 10 seconds instead of the screenshot's 30 seconds.

## Verification

From `fe-project-nexus`, use Node/npm, Postman CLI 1.73.0+ and Chrome:

```powershell
npm run generate:types:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:admin
npm run test:account -- --grep "application|rejection|duplicate|seller token|seller back office"
npm run test:catalog
npm run build -- --webpack
```

Admin browser checks run the actual Next application against the existing local Postman Keycloak/backoffice simulation, extended by `postman/mocks/backoffice-gateway/admin.js`. Default ports are 3110/3920; set `NEXUS_BACKOFFICE_APP_PORT` and `NEXUS_BACKOFFICE_API_PORT` to avoid another running checkout. It explicitly enables the seller flag only in the test server. The frontend is never a simulation member. Screenshots at 1440 and 375 pixels and request events are written under ignored `test-results/`.

The simulation enforces synthetic role rules and models #211 writes and #210 decisions to exercise the caller. It cannot prove actual PostgreSQL persistence, gateway/JWT enforcement, duplicate submission under concurrency, seller role provisioning or Keycloak unlock/password behavior. These require deployed #210/#211 and a live acceptance run. No backend service is changed by this frontend MR; Maven and `ddl-auto: validate` are not frontend gates.

On 2026-11-16, verification from base `develop c502e351` passed generated-type drift, lint (no warnings), isolated route typecheck, all 407 unit tests, 7 Admin browser scenarios, 8 buyer seller-application browser scenarios, 58 general shop browser scenarios (62 configured skips), and `npm run build -- --webpack`. Browser suites use local HTTP simulations. The general suite was run with `--output test-results/catalog-regression` to keep its output separate from Admin evidence. The build initially exposed an existing Auctions list route exporting an optional `auctionId` feature prop; a thin no-props route wrapper fixes the PageProps check without changing auction behavior.
