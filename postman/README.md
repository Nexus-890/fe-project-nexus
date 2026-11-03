# Notification read-status verification

This local simulation models notification reads from the delivered OpenAPI and
the bodyless PATCH/204 operations in `origin/develop`'s `NotificationController`.
It is synthetic and does not verify a running backend, gateway privileges or JWT
validation. Published owner mocks were not searched because the CLI is signed out.

From `fe-project-nexus`, start the dependency in one terminal:

```powershell
postman simulation run postman/simulations/notification.sim.yaml --port 3915 --output ndjson --no-history
```

In a second terminal, run the real notification service against that HTTP server:

```powershell
node scripts/verify-notifications.mjs
```

The script compiles the checked-out notification service and its shared HTTP
boundary into a temporary directory. It verifies newest-ten paging, read/count
refetch, idempotent reads, read-all, no PATCH body, current Bearer, encoded IDs and
400/401/403/404/503 handling with no hidden mutation retry. It resets the synthetic
state before each run. The simulation uses header routing because the service's
base URL accepts origins only; the runner supplies `x-mock-slug: notifications`.
Set `NEXUS_NOTIFICATION_SIM_URL` when using a different local port. Stop the
simulation with Ctrl+C when finished. Do not commit its NDJSON request logs.
