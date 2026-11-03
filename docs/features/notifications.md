# Header notifications

`ShopLayout` mounts `NotificationBellFeature` only for an authenticated session. The feature owns the protected queries/mutation; `NotificationBell` renders the shadcn Popover, Badge and ScrollArea. The bell is available on mobile and desktop. This feature covers the header only; it does not add notification history or preferences pages.

## Requests

All services use the common origin from `NEXT_PUBLIC_API_URL` through `configs/api.ts`, current scoped Bearer token and abort signal:

| Service | Request | Result |
| --- | --- | --- |
| `getNotifications` | `GET /api/v1/notifications?page=0&size=10` | Latest ten notifications, newest first, with page metadata |
| `getUnreadNotificationCount` | `GET /api/v1/notifications/unread-count` | Total unread count across all notifications |
| `markNotificationRead` | `PATCH /api/v1/notifications/{id}/read` | Bodyless 204, then refetch list/count |
| `markAllNotificationsRead` | `PATCH /api/v1/notifications/read-all` | Bodyless 204, then refetch list/count |

Wire types are generated from `be-project-nexus/docs/api/openapi/notification-service.yaml`. Rows contain `id`, `type`, `title`, `content`, `readAt` and `createdAt`; `readAt: null` means unread. Runtime parsers reject malformed list/count responses. Loading, empty and error states are explicit; retry refetches both queries.

## Read actions

Opening an unread row expands its content and marks it read. The badge and row status refresh from the backend after success; opening an already-read row sends no PATCH. Mark-all updates all unread notifications, including records outside the latest ten, and the refreshed count becomes zero. Failed writes preserve the displayed count/read status and show an error so the user can try again.

The single-row path uses `:id`, replaced with the encoded notification ID. Both PATCH requests omit a body and accept `204 No Content` without requiring JSON. During a write and its subsequent refetch, mark-all and unread rows are disabled so another unread row cannot expand without recording a read operation.

The routes were verified against `origin/develop` notification-service controller/service at `f449eeec` on 2026-11-03. That implementation enforces `NOTIFICATION.VIEW` and JWT ownership, preserves an existing `readAt` on repeated requests, and returns bodyless 204 for both actions. The backend snapshot and generated read DTOs on this feature branch predate #109; use a backend containing #109 for live integration. No backend source was changed for this frontend fix.

## Session isolation and verification

Private query keys include the session ID and carry `meta.requiresAuth`. Logout unmounts the bell, cancels/removes private queries through the provider and aborts a pending mutation. A late mutation cannot update a newer session. No notification request is made while signed out.

`tests/notification-api.test.ts` verifies the service contract, including the configured PATCH paths, token, bodyless 204, errors and cancellation. Browser scenarios in `tests/notification.spec.ts` exercise the real sign-in/provider/header against the local stateful HTTP fixture, including read/count changes, write failures, pending actions and logout. These checks verify frontend behavior against stand-ins; live backend availability remains a separate integration check.

For repeatable HTTP verification using the actual notification service and shared Axios boundary, follow the [local Postman simulation instructions](../../postman/README.md). The [simulation context](../../postman/simulations/notification.context.yaml) records the inspected backend contract, observed results and remaining live-integration limit.
