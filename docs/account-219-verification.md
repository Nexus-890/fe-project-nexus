# Account UI #219 verification

Implementation starts from `origin/develop` at `09b3cf6f`, in an isolated
worktree. Existing unrelated backend changes in the original checkout were
preserved. Scope follows the merged frontend subtasks in #219: password pages,
check-email/resend, profile OTP, buyer seller applications and saved addresses
including checkout reuse. New pages use existing account navigation, semantic
tokens, form controls and responsive layouts.

## Contract boundary

The delivered user-service OpenAPI/controllers do not contain #210's email,
phone, seller-application or address-book APIs. The FE boundaries and Postman
stand-ins explicitly document their provisional paths and data. No production
fallback enables a mock. A missing operation remains a visible API error.
The existing profile PUT and checkout/order bodies retain their delivered
contracts; saved addresses feed the same validated locality/destination path.

See [verification](features/account-verification.md),
[seller applications](features/seller-application.md),
[address book](features/address-book.md), and
[Keycloak password pages](features/password-pages.md).

## Executed checks

Checks run across 2026-11-13–14 (Asia/Saigon):

- Baseline `npm run lint` and `npm run test:auth`: passed; 266 baseline tests.
- Changed frontend lint, typecheck, generated DTO drift check and 282 unit tests:
  passed. New cases cover endpoint parsing, current Bearer/public resend,
  cancellation, ownership/rate-limit error preservation, password URLs and
  saved-address versus typed quote request equality.
- `npm run test:profile`: 12 passed, including password settings navigation
  with a fixed `/profile` return and no frontend password inputs.
- `npm run test:auth:browser`: 25 passed, including registration's check-email
  destination and existing cookie renewal/account-isolation regressions.
- `npm run test:catalog`: 55 passed, 38 existing configured skips; account specs
  are isolated in their own configuration.
- `npm run test:checkout`: 24 passed, covering existing quote/review/order
  placement, idempotent retries, conflicts and logout races with the new picker.
- `npm run test:account`: final run 16 passed on 2026-11-14, after correcting
  test-only locators; six address and ten verification/seller/registration
  scenarios. Seven screenshots cover desktop/mobile account pages and checkout.
  Visual review found no horizontal overflow; verification inputs use 44px
  minimum touch height. Postman logs recorded the expected successful writes
  and modeled 400/409/429 failures, as detailed in the simulation context.
- Offline realm checks: 10 passed, three Unix-only skips; Keycloak config-only
  verification passed.
- Final `npm run lint`, `npm run typecheck`, `npm run generate:types:check`,
  282 unit tests and isolated `npm run build`: passed. Production build
  generated 28 pages with the test-only routes removed.

Browser and build commands must run sequentially in this worktree: the existing
browser runner temporarily creates test-only routes and restores tsconfig.
An overlapping build correctly refused production auth stubs; it is not valid
production-build evidence. Initial dev attempts also exited at Next's existing
one-time advisory; unchanged retries ran the checks above. Dependencies were
installed with `npm ci` after Turbopack rejected an external node_modules link.
The installed Next version reports an existing security advisory. This change
does not upgrade dependencies; the final unchanged build retry exited 0.

## Live acceptance still required

Docker's daemon is unavailable, so no service was started against PostgreSQL
with `ddl-auto: validate`; no Java service source is changed. Keycloak/Mailpit
password policy, reset delivery, one-use/expired links and actual account-console
return remain unverified. Email sign-in gating, seeded verified accounts, OTP
hashing/lifetime/attempt/send limits, admin-only seller role assignment and
database address ownership/default/capacity guarantees belong to #210 and need
real integration acceptance. The realm's `verifyEmail` flag is preserved until
that backend flow is delivered.

The simulation uses existing local OIDC/session/checkout members and explicit
provisional account handlers. It establishes frontend behavior against those
stand-ins; see [simulation context](../postman/simulations/account.context.yaml)
for its assumptions and request evidence. It does not establish backend policy.
