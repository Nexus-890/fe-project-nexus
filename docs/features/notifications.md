# Header notifications

`ShopLayout` mounts `NotificationBellFeature` only for an authenticated session. The feature owns the protected queries/mutation; `NotificationBell` renders the shadcn Popover, Badge and ScrollArea. The bell is available on mobile and desktop. Account navigation and the bell link to `/notifications`, where a signed-in user controls notification channels.

## Requests

All services use the common origin from `NEXT_PUBLIC_API_URL` through `configs/api.ts`, current scoped Bearer token and abort signal:

| Service | Request | Result |
| --- | --- | --- |
| `getNotifications` | `GET /api/v1/notifications?page=0&size=10` | Latest ten notifications, newest first, with page metadata |
| `getUnreadNotificationCount` | `GET /api/v1/notifications/unread-count` | Total unread count across all notifications |
| `markNotificationRead` | `PATCH /api/v1/notifications/{id}/read` | Bodyless 204, then refetch list/count |
| `markAllNotificationsRead` | `PATCH /api/v1/notifications/read-all` | Bodyless 204, then refetch list/count |
| `getNotificationPreferences` | `GET /api/v1/notifications/preferences` | Full preference matrix with mandatory flags |
| `updateNotificationPreferences` | `PUT /api/v1/notifications/preferences` | Sparse `{preferences:[{notificationType,channel,enabled}]}` changes; full saved matrix |
| `watchNotifications` | `GET /api/v1/notifications/stream` | Private SSE snapshot events; refetch current inbox and count |
| `getNotificationDeliveries` | `GET /api/v1/notifications/deliveries` | Administrator list filtered by status/channel/created range/error code |
| `getNotificationDelivery` | `GET /api/v1/notifications/deliveries/{id}` | Administrator delivery summary and individual attempts |

## Preferences and live updates

The settings page displays the server's EMAIL/IN_APP choices. Required transaction choices remain enabled and disabled for editing. Saving sends only changed rows, preserves edits after failure and replaces the displayed matrix with the validated server response. It does not ask for browser push permission: in-app updates use the private event stream while the application is open.

The shared HTTP boundary opens SSE with the current in-memory Bearer token in the header. Tokens never enter URLs or cache keys. It validates the stream content type, parses partial UTF-8/multiline SSE frames, renews once on an initial 401 and rejects late data from another auth generation. The feature refetches list/count when an opaque revision changes, reconnects with capped backoff, and reopens after token renewal. The backend sends a durable initial snapshot on every connection, so reconnecting does not depend on receiving every transient event. Logout aborts the stream and pending reads; an interrupted connection shows an unavailable message in the bell. Mark-read refreshes only the inbox/count and preserves unsaved preferences edits.

## Delivery administration

`/backoffice/notification-deliveries` is visible to ADMIN and uses protected, session-scoped queries. Its status/channel/error/date filters reset pagination. The detail panel displays attempt number, result, timestamps, symbolic error and whether retry is possible. Inspecting delivery status does not initiate another delivery.

`tests/notification-settings-api.test.ts` covers the new parsers, filters, sparse changes, real HTTP SSE renewal, split frames, cancellation and session isolation. `tests/notification-settings.spec.ts` exercises settings, save failures, live bell refresh, delivery filters/detail recovery and support access denial against explicit browser HTTP stand-ins. Run the latter with `node scripts/test-browser.mjs --config playwright.notification-settings.config.ts`; these fixtures are distinct from live backend evidence.

Wire types are generated from `be-project-nexus/docs/api/openapi/notification-service.yaml`. Rows contain `id`, `type`, `title`, `content`, `readAt` and `createdAt`; `readAt: null` means unread. Runtime parsers reject malformed list/count responses. Loading, empty and error states are explicit; retry refetches both queries.

## Read actions

Opening an unread row expands its content and marks it read. The badge and row status refresh from the backend after success; opening an already-read row sends no PATCH. Mark-all updates all unread notifications, including records outside the latest ten, and the refreshed count becomes zero. Failed writes preserve the displayed count/read status and show an error so the user can try again.

The single-row path uses `:id`, replaced with the encoded notification ID. Both PATCH requests omit a body and accept `204 No Content` without requiring JSON. During a write and its subsequent refetch, mark-all and unread rows are disabled so another unread row cannot expand without recording a read operation.

The routes match the merged notification-service controller, service and delivered OpenAPI, including #109. The implementation enforces `NOTIFICATION.VIEW` and JWT ownership, preserves an existing `readAt` on repeated requests, and returns bodyless 204 for both actions. Generated notification types include both PATCH operations. Live integration requires a running backend containing these routes.

## Session isolation and verification

Private query keys include the session ID and carry `meta.requiresAuth`. Logout unmounts the bell, cancels/removes private queries through the provider and aborts a pending mutation. A late mutation cannot update a newer session. No notification request is made while signed out.

`tests/notification-api.test.ts` verifies the service contract, including the configured PATCH paths, token, bodyless 204, errors and cancellation. Browser scenarios in `tests/notification.spec.ts` exercise the real sign-in/provider/header against the local stateful HTTP fixture, including read/count changes, write failures, pending actions and logout. These checks verify frontend behavior against stand-ins; live backend availability remains a separate integration check.

The browser fixture registers the access token returned by the gateway session exchange before the callback loads the profile, and checks that the refresh cookie is HttpOnly. The gateway stand-in performs the Keycloak exchange. Logout cancellation cases abort the external redirect and assert that the document remains unchanged while pending requests are canceled; the separate OIDC suite verifies the normal end-session redirect. `NEXUS_TEST_APP_PORT`, `NEXUS_TEST_API_PORT` and `NEXUS_TEST_PROVIDER_PORT` isolate browser runs from other worktrees without changing production configuration.

For repeatable HTTP verification using the actual notification service and shared Axios boundary, follow the [local Postman simulation instructions](../../postman/README.md). The [simulation context](../../postman/simulations/notification.context.yaml) records the inspected backend contract, observed results and remaining live-integration limit.
