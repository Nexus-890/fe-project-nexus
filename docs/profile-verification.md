# Profile verification

Current setup note — 2026-11-05: `npm run test:profile` now starts the frontend on
port 3103 and the profile API/Keycloak stand-ins on port 3913. It follows the
Keycloak redirect/callback before profile requests; fixture login no longer
calls `/api/v1/auth/login`. PUT 401 clears local authentication and returns to
sign-in without a remote logout redirect. The dated runs below remain historical;
the [simulation context](../postman/simulations/profile.context.yaml) records the
migrated setup and its separately recorded evidence.

Current merged-state check on 2026-11-05 passed all 9 browser scenarios in 38.0
seconds. The simulation recorded profile GET 200 (23)/503 (2), PUT 200 (2)/400
(1)/401 (1)/503 (1), and eight successful OIDC token exchanges. These checks
exercise frontend behavior with stand-ins; the historical live run below does
not validate today's real Keycloak/backend integration.

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
