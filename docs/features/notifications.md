# Header notifications

`ShopLayout` mounts `NotificationBellFeature` only for an authenticated session. The feature owns the protected queries/mutation; `NotificationBell` renders the shadcn Popover, Badge and ScrollArea. The bell is available on mobile and desktop. This feature covers the header only; it does not add notification history or preferences pages.

## Delivered reads

Both services use the common origin from `NEXT_PUBLIC_API_URL` through `configs/api.ts`, current scoped Bearer token and abort signal:

| Service | Request | Result |
| --- | --- | --- |
| `getNotifications` | `GET /api/v1/notifications?page=0&size=10` | Latest ten notifications, newest first, with page metadata |
| `getUnreadNotificationCount` | `GET /api/v1/notifications/unread-count` | Total unread count across all notifications |

Wire types are generated from `be-project-nexus/docs/api/openapi/notification-service.yaml`. Rows contain `id`, `type`, `title`, `content`, `readAt` and `createdAt`; `readAt: null` means unread. Runtime parsers reject malformed list/count responses. Loading, empty and error states are explicit; retry refetches both queries.

## Pending mutation URLs

Per the requested integration policy, `NOTIFICATION_ENDPOINTS.read` and `NOTIFICATION_ENDPOINTS.readAll` in `service/notificationService.ts` are intentionally empty strings. The checked-out backend implements only the two GET operations. The draft mutation specification is not treated as an implemented endpoint.

When those APIs become available, fill the two relative paths. The single-row path uses `:id`, which the service replaces with the encoded notification ID. Both functions send a bodyless PATCH and accept the expected `204 No Content`. The UI enables each action based on its configured URL and refetches list/count after a successful update.

While URLs are empty, mark-all is disabled and opening a row only expands its content. Neither action invents a read timestamp or lowers the unread count. Direct service calls with an empty URL reject locally before any HTTP request, preventing accidental calls to the backend origin root.

## Session isolation and verification

Private query keys include the session ID and carry `meta.requiresAuth`. Logout unmounts the bell, cancels/removes private queries through the provider and aborts a pending mutation. A late mutation cannot update a newer session. No notification request is made while signed out.

`tests/notification-api.test.ts` verifies the service contract, including empty URLs and configured PATCH/204 behavior. Browser scenarios in `tests/notification.spec.ts` exercise the real sign-in/provider/header against the local HTTP fixture. These checks verify frontend behavior against stand-ins; live backend availability remains a separate integration check.
