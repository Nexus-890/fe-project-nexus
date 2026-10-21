# Profile page

Signed-in users can open `/profile`, read their current profile, edit supported
personal details, and save without leaving the page. A successful save updates
the form, account avatar initials/name, and header name from the same shared user
query. This change is frontend only.

## Structure and navigation

- `app/(account)/profile/page.tsx` provides the route and page metadata.
- `features/account/ProfilePage.tsx` composes four separate main cards:
  `ReputationCard`, `PersonalInformationCard`, `ChangePasswordCard`, and
  `PenaltyHistoryCard`.
- The cards, sidebar, footer, avatar, and Skeleton live in
  `ui/components/organisms/Account/`. The feature files compose the page and
  coordinate its data; form validation lives in `lib/profile-schema.ts`.
- `AvatarCard` is a separate sidebar card using the shadcn Avatar and its initials
  fallback. The sidebar and page display shadcn Skeleton components while loading.
- The UI uses Tailwind CSS and shadcn Card, Button, Input, Textarea, Select, Label,
  Avatar, and Skeleton components.
- `route/index.ts` centralizes routes and navigation data. The header name and
  “My Nexus” link to `/profile`; the sidebar renders `ACCOUNT_NAVIGATION.map()`.
  Reputation and Security link to their card anchors. Unimplemented destinations
  are visibly pending. Repeated fields, gender options, reputation thresholds,
  statistics, and table headings also render from data with `.map()`.

`ProfilePage` renders `ProfileSkeleton` while its client-side `/me` request is
pending. There is no route-level `loading.tsx`: that convention creates a Suspense
fallback for route navigation/streaming and does not track a request started by
`useEffect`.

## API and state

`features/account/api.ts` revalidates `GET /api/v1/users/me` on entry through the
existing auth `/me` query. Loading, retry, and save operations use the active
session's client. `service/account.ts` defines the relative endpoint path and
sends `PUT /api/v1/users/me` with bearer authentication; the configured API base
URL comes from the existing environment configuration.

The form submits only changed fields supported by the backend DTO. The service
allowlists those fields and validates the returned `UserResponse` before updating
the shared query. An earlier GET is cancelled before the saved response enters
the cache, and results from an ended session cannot populate a later session.
Cancel restores the latest saved values. A failed save preserves edits; a failed
load offers a retry.

The types match the current Java `UserResponse` and `UpdateProfileRequest`:

| Field | GET/PUT response | Editable through current PUT |
| --- | --- | --- |
| `id` | UUID string | No |
| `fullName` | string | Yes; trimmed, 1–150 characters |
| `email` | string | Yes; trimmed, lowercase, valid email, 1–255 characters |
| `phone` | string | No; read-only in the form |
| `gender` | `MALE \| FEMALE \| OTHER \| null` | Yes; one of the three enum values |
| `address` | string or null | Yes; trimmed |
| `dateOfBirth` | `YYYY-MM-DD` or null | Yes; valid date, not in the future |
| `roles` | string array of backend-defined role codes | No |
| `status` | `ACTIVE \| LOCKED \| DELETED` | No |
| `createdAt` | ISO offset date-time string | No |

Omitted or null update fields retain their backend values. The form prevents
clearing an existing birth date because the current API cannot clear it.
`identityNumber` is stored in the backend entity but omitted from `UserResponse`;
the UI shows “Kept private” without inventing or exposing a value.

Backend validation errors use Problem Details with
`errors: [{ field, message }]`. The existing API client normalizes these errors;
the form displays each known field's message next to its input and connects it
with `aria-describedby`. Duplicate-email 409 errors map to the email field.
Missing or expired sessions redirect to `/sign-in`, including a 401 during save.
The current token is held in memory and saved to localStorage as
`nexus.accessToken`. A reload restores it and fetches `/users/me` before showing
the profile. Sign-out or a current-session 401 clears the saved token and private
cache. Passwords are not saved in localStorage.

## Backend dependencies

The current PUT intentionally ignores `phone`; it has no phone field or phone
validation in `UpdateProfileRequest`. Phone remains read-only in this FE-only
scope. Supporting real phone changes and a real backend phone 400 response
requires a future backend contract change.

`PENDING_ACCOUNT_ENDPOINTS` in `service/account.ts` records these proposed paths:

| Feature | Proposed endpoint, pending backend confirmation | Current UI |
| --- | --- | --- |
| Avatar | `/api/v1/users/me/avatar` | Initials avatar; photo actions disabled |
| Password | `/api/v1/users/me/password` | Password fields and update action disabled |
| Reputation | `/api/v1/users/me/reputation` | Unavailable score/statistics shown as `—` |
| Penalties | `/api/v1/users/me/penalties` | Pending empty state |

These constants do not trigger requests. Their methods and DTOs still need
backend agreement. The UI does not show fabricated scores, trust levels,
transaction statistics, or penalties.

## Verification with the real backend

| Requirement | Evidence / status |
| --- | --- |
| Profile populated from GET on entry | Live browser GET returned 200 and populated the existing backend values. |
| Save updates values and header name | Live browser PUT returned 200 and updated the shared profile state; temporary edits were restored. |
| Field-level 400 errors | Client validation and Problem Details mapping remain supported. The backend has no phone update field, so phone validation is not a live acceptance scenario. |
| Edit phone | Deferred by the agreed FE-only scope; phone is read-only and excluded from PUT. |
| No session | Check `/profile` while signed out and confirm the sign-in redirect. |
| Reload and sign-out | A live browser check restored the profile after reload and confirmed sign-out removed `nexus.accessToken`. |
| Invalid stored token | The live backend returned 401; the browser removed the saved token and returned to sign-in. |
| Loading, failure, and cancellation | The UI supports Skeleton, retry, preserved edits after a failed save, and Cancel; verify these against actual responses when reproducing the flow. |
| 375×812 layout | The recorded live browser profile check had no horizontal overflow. Recheck after layout changes. |

Start the backend and frontend manually, then run `npm run test:profile`
against `http://localhost:3000`. On 21 October 2026, all 5 browser scenarios
passed, and `npm run test:auth` passed 44 unit tests. The local business services
use the seeded
physical databases `nexus_demo_user_db`, `nexus_demo_catalog_db`, and
`nexus_demo_commerce_db` through database-name settings in the existing backend
local environment file. Profile reads and writes use `nexus_demo_user_db`.

See [profile verification](profile-verification.md) for startup ports, exact
manual steps, and the recorded real login/GET/PUT evidence. The browser command
does not need a separate backend fixture or services running on hidden ports.
