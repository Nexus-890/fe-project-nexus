# Profile verification

## Develop integration — 2026-11-05

Merged develop at `0d0a36a4` into the profile branch. The profile feature,
components, schema and types use the flat frontend structure. Profile requests
use the single shared HTTP boundary and the current Keycloak session. The
provider updates the shared profile cache after a successful save and rejects
responses from an ended session.

Verification against this integration:

- Type generation and generated DTO drift check passed.
- Lint and regenerated-route typecheck passed.
- Unit/transport suite passed 78/78, including five profile regression tests.
- Catalog/cart/auth acceptance browser suite passed 30/30.
- Dedicated OIDC browser suite passed 11/11.
- Production build passed after the initial security reminder was acknowledged by retry.
- Profile browser suite passed 9/9 against the real Next frontend and local
  Postman profile/Keycloak stand-ins, covering PKCE sign-in, authenticated GET,
  partial PUT, shared header updates, validation, Cancel, loading, retry,
  expiry and the 375×812 layout.

The installed Next.js 16.4.0 emitted its existing security upgrade reminder
on first startup for isolated test output; retrying allowed verification to
continue. Dependency upgrades are a separate change from this conflict merge.

The simulation log confirmed eight provider token exchanges (200), 23 profile
GETs (200), two GET failures (503), two successful PUTs, and PUT 400/401/503
failures. No application password-login API call occurred. These results
establish behavior against local stand-ins; the historical live backend result
below predates the Keycloak migration and is not current integration evidence.


## Historical response-contract verification — 2026-11-03

The review finding was reproduced: the old API client passed the entire
`{code, message, data}` success envelope to the login/profile DTO guards.
The client now extracts `data` and normalizes current backend validation
`errors: [{field, code, detail}]` into form messages. Unit and browser fixtures
model the backend source on `origin/develop` at `6e92bbac`.

Verification on the profile branch with these changes:

- `npm run test:auth`: 41/41 tests passed, including malformed enveloped DTOs,
  register/login/GET/PUT envelopes, current 400 errors, and legacy payloads.
- `npm run test:profile`: 9/9 browser tests passed against the local Postman
  simulation. Login, profile GET, and successful PUT explicitly assert envelopes;
  changed names update the form and header. The 400 case uses `detail`.
- Simulation request events confirmed 8 successful login calls, 23 successful
  profile GETs, 2 successful PUTs, and the exercised 400/401/503 failures.
- `npm run lint` and `npm run build` passed.
- Existing auth browser acceptance passed 14/14 session, Bearer, storage/cache,
  race-condition, expiry, and retry checks with no browser errors.
- The 375×812 browser check found no horizontal overflow or clipped layout text.

These results exercise the real frontend against local fixtures; the backend
source was inspected without rerunning a live backend. The injected phone
error tests placement only because phone is read-only in the current update DTO.
The historical backend run below predates this contract and does not verify
current backend connectivity.

## Historical verification — 2026-10-20

Validated on 2026-10-20 with the real Next.js frontend and a local stateful
Postman simulation based on this repository's backend DTOs. Run
`npm run test:profile` to reproduce. All 9 browser tests passed.

- Signed-out access redirects to `/sign-in`.
- Login followed by clicking the header name opens `/profile`.
- An authenticated GET on entry populates all existing profile values.
- PUT sends only changed fields supported by `UpdateProfileRequest`; phone
  is read-only and omitted. Successful responses update the header and form.
- Cancel restores saved values without submitting.
- Blank names and future birth dates are rejected before making a PUT.
- An injected phone 400 message is associated with the phone input.
- A delayed GET displays the shadcn Skeleton loading state.
- GET 503 can be retried; PUT 503 preserves edits and can be retried.
- PUT 401 returns to sign-in.
- At 375×812 the document has no horizontal overflow or clipped layout text.

The phone error is deliberately injected to exercise FE validation mapping;
the current backend does not support editing phone. Avatar upload, password,
reputation, and penalty endpoints remain pending backend availability. This
simulation run does not establish live backend connectivity.

## Real backend verification

On 2026-10-20, the running backend gateway at `http://localhost:8080` was tested
with the demo buyer credentials read from
`be-project-nexus/infra/staging/.env.example`. That directory supplies demo
credentials; no remote staging host is configured there.

The real browser flow at `http://localhost:3000` passed:

- POST `/api/v1/auth/login`: 200, followed by authenticated GET profile: 200.
- Clicking the header name opened `/profile`; form name, email, and phone
  matched the backend response.
- Save Changes sent PUT `/api/v1/users/me`: 200. It resubmitted the existing
  name, and the entire returned profile matched the original data.
- Browser calls used the Next origin through `API_PROXY_TARGET`; direct
  backend preflight currently returns 401 without CORS headers.
- The loaded profile had no horizontal overflow at 375×812.

The local `.env.local` uses an empty public API URL,
`API_PROXY_TARGET=http://localhost:8080`, and `NEXT_PUBLIC_AUTH_STUB=false`.
No demo password or access token was added to frontend env or source.

Mobile (375×812 viewport, full page):

![Profile on mobile](screenshots/profile-mobile-375x812.png)

Desktop (1440px viewport, full page):

![Profile on desktop](screenshots/profile-desktop-1440.png)
