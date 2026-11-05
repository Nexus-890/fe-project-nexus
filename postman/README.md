# Profile browser simulation

`npm run test:profile` starts the real Next.js application on port 3103 and a
local Postman simulation on port 3913. Install the Postman CLI (1.70.0+) and
Google Chrome before running it. No Postman login, workspace, deployment, or
live backend is used.

The locally authored `mocks/profile-gateway` fixture comes from the backend
in this same repository:

- `be-project-nexus/user-service/.../iam/UserController.java`
- `be-project-nexus/user-service/.../iam/dto/UserResponse.java`
- `be-project-nexus/user-service/.../iam/dto/UpdateProfileRequest.java`

The simulation also reuses the locally authored `mocks/oidc-keycloak` member
derived from the committed realm and OIDC protocol fixture. The frontend
redirects to its provider form and processes the callback; the API fixture
does not expose a password-login replacement.

This is our repository's API contract, so discovery of an external owner's
published mock was unnecessary. The mock preserves the actual `/api/v1/...`
URLs: the simulation routes the first `/api` segment to the member, whose
handler receives `/v1/...`. User writes persist in namespaced `pm.state`,
and the profile endpoints compare the Bearer token hash issued by the Keycloak
member through shared namespaced state. Other calls return
501 instead of inventing product behavior.

The fixture account is `lan.nguyen@example.com` / `profile-password`, entered
on the local provider form.
`POST /api/__test/reset` resets state; `POST /api/__test/control` injects
`getDelayMs`, `getStatus`, or `putStatus`. `GET /api/__test/requests` exposes
the calls for request assertions. These routes exist only inside this local
fixture, never in the application.
`GET /keycloak/test/reset` resets the provider member too; the browser setup
calls both resets before each scenario.

`putStatus: 400` injects a phone field error to verify the FE error renderer.
The current backend does **not** accept phone in `UpdateProfileRequest`:
the page keeps it read-only, and tests assert it is omitted from PUT. This
injected error exercises a future backend extension and does not establish
that the current real backend validates phone during profile updates.

The suite covers OIDC sign-in, header navigation, authenticated GET on profile
entry, exact changed PUT fields, stateful saves, shared header updates, cancel,
client validation, phone error placement, loading skeleton, retryable failures,
session expiry, and 375×812 layout.
Screenshots and traces are under `test-results/profile`; request events are
in `profile-simulation.ndjson`. Generated logs and browser output are ignored
by Git. Real backend connectivity remains a separate integration check.
