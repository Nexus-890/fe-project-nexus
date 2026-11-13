# Account password pages (#219)

The profile's **Change password** button opens Keycloak's account console at
`/realms/{realm}/account/#/account-security/signing-in`. Choose **Update** next to
Password. The console starts Keycloak's `UPDATE_PASSWORD` action, which uses the
Nexus login theme, validates the realm's existing password policy and keeps all
password entry on Keycloak. **Back to Nexus Web** returns to `/profile` through
the `nexus-web` referrer. The gateway cookie restores the frontend session after
returning. No password endpoint, password form, token in a URL or persistent
authentication storage is added to the frontend.

`createPasswordAccountUrl` uses the existing `NEXT_PUBLIC_KEYCLOAK_URL`,
`NEXT_PUBLIC_KEYCLOAK_REALM` and `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` configuration.
It only returns to the current application's `/profile`; the provider allows
HTTPS or loopback HTTP and rejects URL credentials. The application's origin
must be in the client's allowed redirect URIs, as it is for the existing OIDC
callback. There are no new `nexus.*` configuration keys.

## Keycloak theme and reset email

`be-project-nexus/infra/local-dev/keycloak/themes/nexus/login` inherits the
installed Keycloak 26.7.5 `keycloak.v2` templates. Its CSS uses the same orange,
surface, border, radius, type and focus values as `app/globals.css`, the existing
Nexus logo and a self-hosted Geist font with its OFL license. Inherited forms
preserve policy errors, password visibility, CSRF actions, accessible labels and
the reset flow. Expired-action messages explain how to request a new reset email.
The theme covers sign-in, forgotten password, update-password and error pages.
The account console itself keeps Keycloak's account theme.

Compose mounts the Nexus theme read-only. The realm import selects `loginTheme:
nexus`, enables **Forgot password?** and sends reset email to local Mailpit
(`mailpit:1025`, sender `accounts@nexus.local`, no SMTP credentials). These are
development-only SMTP settings. Email verification policy remains owned by #210.
The three imported demo users keep their verified-email flags and credentials.

Start `postgres`, `mailpit` and `auth-service` from the local-dev Compose stack,
then run the documented Keycloak seed command. Import settings apply only to a
new realm: for an existing realm, restart `auth-service` to mount the theme and
use Realm settings in the Keycloak Admin Console to select **Themes → Login theme
→ nexus**, enable **Login → Forgot password**, and set **Email** to the Mailpit
settings above. Do not delete a database volume to update an existing realm.
Production SMTP and the deployed client's redirect origins must be configured
for that environment.

## Verification

`npm run test:auth` discovers `tests/password-account.test.ts`, which checks the
credential-settings destination, exact profile referrer, deployed provider path,
encoded realm and rejection of unsafe URL configurations. Existing OIDC tests
exercise the shared authority validation after its extraction.

For live acceptance, start the frontend and the Keycloak/gateway/user-service
stack, sign in with a seeded buyer, open Profile → Change password, choose Update
and submit a short password. Confirm the policy error remains on a Nexus-themed
Keycloak page. Save a valid password and use Back to Nexus Web; confirm `/profile`
loads. Sign out, choose Forgot password on Keycloak, submit the account email and
open Mailpit at `http://localhost:8025`. Follow the email once, reset the password,
then confirm reuse fails. Open an expired reset link and confirm the message
explains how to request a new email. These live checks require the real services;
unit or frontend fixture results do not establish email delivery or reset-token
semantics.

On 2026-11-13, `npm run test:auth` passed 279 tests including all three password
URL tests and existing OIDC cases. Scoped ESLint, `git diff --check`, the offline
realm suite (10 passed, three Unix-only skips), and Keycloak's
`test-keycloak.py --config-only` passed. `npm run test:profile` passed all 12
browser cases, including the password button's account-console destination,
safe profile referrer and mobile layout. Its account-console navigation is
intercepted by the test; it does not exercise the provider's actual pages.
The first browser attempt ended when Next stopped its dev server for its
one-time dependency advisory; rerunning the same command passed.
The Docker daemon was unavailable, so
the real account-console return, email delivery, policy page rendering and
expired/single-use reset links remain live verification requirements.

Upstream compatibility references: [Keycloak 26.7.5 login theme](https://github.com/keycloak/keycloak/tree/26.7.5/themes/src/main/resources/theme/keycloak.v2/login),
[account security route](https://github.com/keycloak/keycloak/blob/26.7.5/js/apps/account-ui/src/routes.tsx)
and [validated account referrer](https://github.com/keycloak/keycloak/blob/26.7.5/services/src/main/java/org/keycloak/services/resources/account/AccountConsole.java).
