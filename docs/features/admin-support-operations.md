# Admin and Support order operations (#230 / #261)

The Admin Figma reference is `06 · Admin.png`. Orders use the existing compact
back-office navigation, white cards, neutral table headers and orange actions.
Payments, refunds and shipment screens extend the same design system. Tables
scroll inside their own container on smaller screens.

## Delivered frontend

| Route | Behavior | Access |
| --- | --- | --- |
| `/backoffice/orders` | All orders, buyer/seller/status/type/date filters, paging, items and status history; change status with a reason | Admin and Support read; Admin writes |
| `/backoffice/payments` | Default UNRECONCILED queue, status filter or complete order lookup | Admin and Support |
| `/backoffice/refunds` | Lookup by order, record full/partial refund, confirm completed manual bank transfer | Admin and Support |
| `/backoffice/shipments` | List/filter/page, create from paid order, normal status update or reasoned override, paged history | Admin and Support |
| `/backoffice/payouts`, `/backoffice/admin-payouts` | Existing Admin payout filters/detail/history/retry and bank verification queue | Admin; Seller has an own-history view at the shared payouts URL |

Order links carry `orderId` to each operations page. Dates use Vietnam calendar
boundaries. All reads use session-scoped query keys, private-query metadata and
AbortSignal. Writes use the existing `useAdminAction` cancellation, synchronous
submission lock and current-session guard. Successful writes refresh operations
data; order changes also refresh shared detail/history caches. No token is stored
in a key or persisted for these screens.

The API boundary reads resources from `data`, preserves sibling `page` and
renders Problem Details `code`, `detail` and field `errors[].detail`. An invalid
order transition is HTTP 409 `COMMERCE_ILLEGAL_TRANSITION` in this backend (the
issue abbreviates it to `ILLEGAL_TRANSITION`). Refunds belong to payment-service;
shipment paths stay under `/api/v1/shipments`.

Refund and shipment creation capture an Idempotency-Key for each submitted body;
an unchanged retry during that workspace's lifetime reuses the key. Writes are
not automatically retried. Refund completion requires explicit confirmation that
the manual transfer succeeded. Shipment recipients/fees/parcel data come from
the backend snapshot. No payout creation or amount-editing control is added.

## Backend dependencies and evidence limits

Controller/DTO/OpenAPI inspection on 2026-11-17 confirms the orders, payment
reads, refunds and shipment operations used here. No backend endpoint or config
key is introduced by this frontend change.

The backend in `develop` still lacks the two Admin collection GETs required by
#261: `/api/v1/payments/payouts` and
`/api/v1/payments/seller-bank-accounts`. Existing frontend consumers and explicit
Postman simulations describe these follow-up contracts. The bank verification
write already accepts `expectedVersion`; the existing frontend preserves that
concurrency check. #261 owns delivering the collection APIs and their gateway
permissions. Until then Admin payout/verification collection reads
can return API failures; production does not fall back to simulations.

The payout journey uses automatic creation only after funded completed orders,
masked bank details, exact ON_HOLD/UNKNOWN/FAILED/RETURNED needs-action statuses,
newest-first history with simulated steps labelled, and retry only for FAILED
or RETURNED. Existing retry keys survive a resend and a double click produces a
single attempt. Seller and Support direct visits to the Admin page are denied.

Run from `fe-project-nexus`:

```powershell
npm ci
npm run generate:types:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:operations
npm run test:catalog
npm run build
```

`test:operations` uses the Postman CLI, Chrome, ports 3110/3920 and an explicit
HTTP/OIDC simulation. Test-only `/test/operations/reset` activates operation
fixtures; production code never imports them. Browser checks cover Admin versus
Support writes, filters/paging, 409, refund resend/confirmation, shipment
creation/update/override, payout states/rejection/retry and 375/768/1440 layouts.
Screenshots are written to ignored `test-results/operations/screenshots`.
The existing seller payout journey is included in the same command.

Local simulation results do not establish real bank transfers, live carrier
delivery, Kafka propagation, PostgreSQL validation or deployed gateway policy.
Docker was unavailable during this task, so live service/PostgreSQL checks and
the full #261 backend journey remain unverified.
