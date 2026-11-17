# Buyer API integration in a browser

This opt-in suite runs the real Next application against real catalog, commerce
and rating service jars and dedicated PostgreSQL 18 databases. Identity/session
protocols and unrelated header/cart/notification/shipment dependencies use the
existing local stand-ins. Changed product/order/rating/reputation calls always
reach the jars; a missing jar produces a failure instead of fixture data.

Build the three services from this checkout. Start them on loopback ports 4932
(catalog), 4933 (commerce) and 4939 (rating), each against its own migrated test
database with `spring.jpa.hibernate.ddl-auto=validate`. Disable Config Server,
Eureka and Kafka listeners/relay for this focused run. Configure their JWT issuer
as `http://127.0.0.1:3993/keycloak/realms/nexus`, audience `nexus-services`, and
JWK URL `http://127.0.0.1:3993/keycloak/realms/nexus/protocol/openid-connect/certs`.
Keep catalog products/detail/category tree GETs public using its normal security
endpoint configuration. Catalog also requires the existing storage configuration;
these test products have no images and never call storage.

The test config starts Postman OIDC, the local routing adapter and Next on
3993/3994/3190. It does not start or stop the jars/database. The JDBC helper needs
Java 21 and the installed PostgreSQL JDBC jar in `.m2`, or an explicit
`NEXUS_LIVE_POSTGRES_DRIVER` path. From `fe-project-nexus`:

```powershell
$env:NEXUS_LIVE_CATALOG_JDBC_URL='jdbc:postgresql://127.0.0.1:55496/nexus220_catalog'
$env:NEXUS_LIVE_COMMERCE_JDBC_URL='jdbc:postgresql://127.0.0.1:55496/nexus220_commerce'
$env:NEXUS_LIVE_RATING_JDBC_URL='jdbc:postgresql://127.0.0.1:55496/nexus220_rating'
$env:NEXUS_LIVE_JDBC_USER='postgres'
$env:NEXUS_LIVE_JDBC_PASSWORD=''
npm run test:browser -- --config playwright.buyer-live.config.ts
```

Use isolated disposable databases: the seed helper resets only its fixed test
order/rating IDs and adds 14 uniquely named catalog products. It rejects remote
JDBC URLs. Optional `NEXUS_LIVE_*_ORIGIN` values select different loopback service
ports; keep JWT issuer/Next/provider origins consistent when changing defaults.

The suite checks database-backed search/sort/paging and unmatched queries, then
logs in with a signed token and confirms a real delivered order, rates its seller,
reloads and reads persisted reputation. It inspects committed database rows for
one completion/history/outbox event and one rating/outbox event.

After confirmation, a test-only explicit step copies the committed
`OrderCompleted` payload from commerce outbox into rating eligibility. This
models event delivery; this browser suite does **not** exercise Kafka delivery,
receipt-email transport, payouts, real Keycloak or reputation recomputation.
The seller's display fixture uses policy version `reputation-policy-1`, zero
activity counters and an explicit adjustment offset of 28 to produce 78/TRUSTED.
This is a seeded test snapshot, not evidence of historical transactions or an
admin-adjustment audit workflow.
Commerce Kafka/listener and rating consumer tests cover their own boundaries
separately. The attachment records sanitized method/path/status evidence, with
no credentials, cookies or tokens.
