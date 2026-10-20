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
The existing auth implementation holds tokens in memory, so a full browser
refresh also returns to sign-in; persistent sessions are outside this change.

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

## Acceptance evidence for the merge request

| Requirement | Evidence / status |
| --- | --- |
| Profile populated from GET on entry | Browser test verifies authenticated GET and existing values in the form. |
| Save updates values and header name | Browser test checks partial PUT body, returned form values, and header name. |
| Field-level 400 errors | Error mapping associates an injected phone 400 with the phone input. This validates FE handling only; the current BE cannot produce that phone validation flow. |
| Edit phone | Deferred by the agreed FE-only scope; phone is read-only and excluded from PUT. |
| No session | Browser tests verify sign-in redirect and save-time 401 handling. |
| Loading, failure, and cancellation | Skeleton, load retry, preserved edits after save failure, and Cancel are covered. |
| 375×812 layout | Browser assertions check document width and visible text clipping; mobile screenshot attached below. |

Validation reported for this implementation: `npm run lint` and `npm run build`
passed; `npm run test:auth` passed 38 tests after the develop integration. `npm run test:profile` runs the real
Next.js frontend against a local stateful Postman HTTP simulation based on the
repository's backend DTOs. See [profile verification](profile-verification.md)
for the browser results and the subsequent successful login/GET/PUT check
against the running backend using the staging demo buyer account.

The screenshots use simulation data to demonstrate the layout:

![Profile at a 375×812 viewport, full page](screenshots/profile-mobile-375x812.png)

![Profile at a 1440px desktop viewport, full page](screenshots/profile-desktop-1440.png)
