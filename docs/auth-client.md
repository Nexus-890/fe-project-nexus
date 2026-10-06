# Auth client and in-memory session

## Scope and contracts

This is the plumbing for the sign-up page, sign-in page, and signed-in header,
not the implementation of those components. The access token is kept only in
`AuthProvider` memory. It is not stored in localStorage, sessionStorage, Redux
persist, or a TanStack cache persister. A full page refresh returns the app to
the anonymous state; the refresh-token flow and server-side token revocation
are outside the scope of this issue.

Sprint 1 contracts are temporary handwritten types based on the issue and API
catalogue. This is an exception to the OpenAPI type-generation rule in
CONTRIBUTING.md. When the backend publishes OpenAPI, reconcile or regenerate
the types and update the fixtures in the same change.

| Method/path | Result |
| --- | --- |
| POST `/api/v1/auth/register` | 201 `UserResponse`; does not sign in automatically |
| POST `/api/v1/auth/login` | 200 `{accessToken, expiresIn, tokenType: "Bearer"}` |
| GET `/api/v1/users/me` | 200 `UserResponse`; requires Bearer authentication |

`RegisterRequest` includes `identityNumber`, `address`, and the other required
fields. Responses do not include password, passwordHash, or identityNumber.
The frontend does not select or send a default role. The gender, roles, and
status enums are not finalized, so wire values remain strings rather than
assuming database enum values.

`fieldErrors: Record<string, string[]>` is a provisional RFC 7807 extension used
by the fixture. The parser also normalizes an `errors` record if the backend
uses that name; it does not assume every backend has the same error shape.
Core error fields are `type`, `title`, `status`, `detail`, and `instance`, with
`traceId` as an extension. The actual HTTP response status determines the error
status.

Sources:
- [Catalogue](https://drive.google.com/file/d/1KIJsr87F-6TWieBbie9CVzgCBTPsM4Zk/view)
- [Business Rules](https://docs.google.com/spreadsheets/d/1x2ulrpa9n5Xmgb8G7b3zJ9sisHjYJG7wGycalQGHB-U/edit)
- [SRS](https://drive.google.com/file/d/1nw7_WwZoWhjgA1WiZJzu37ps_MisI5Ls/view)

## File responsibilities

| File | Responsibility |
| --- | --- |
| `types/api.ts` | Request/response contracts, RFC 7807, typed errors, and `ApiResult<T>` |
| `lib/api-client.ts` | HTTP GET/POST; reads the latest token through a getter and parses responses/errors |
| `configs/api.ts` | Re-exports the new factory, replacing the unfinished Vite/Redux/refresh client |
| `lib/api-result.ts` | Converts failure results into rejected Promises for TanStack |
| `hooks/api-query-options.ts` | Shared GET configuration for the hook and `fetchQuery` |
| `hooks/useApiQuery.ts` | Thin custom GET hook; leaves loading and cache management to TanStack |
| `features/auth/api.ts` | `register`, `login`, and `me`; validates responses at runtime |
| `features/auth/useMeQuery.ts` | Profile query keyed by session generation; does not fetch automatically without a token |
| `features/auth/AuthProvider.tsx` | Owns the token and login/register mutations; clears the session and cache on logout |
| `features/auth/useAuth.ts` | Exposes auth context to components and reports a missing provider |
| `providers/AppProviders.tsx` | Creates a stable QueryClient and composes both providers |
| `app/layout.tsx` | Mounts the provider without adding fetch/state logic to the route |
| `features/auth/testing/stub.ts` | In-memory fake backend for building UI before the real API is available |
| `tests/auth-api.test.ts` | Transport, endpoint, fixture, and typed-error regression tests |
| `tests/auth-query.test.ts` | Query cache, enable/disable, cancellation, and error-adapter tests |
| `tests/browser/AuthProbe.tsx` | React consumer for browser session testing, not a production auth page |
| `tests/browser/auth-acceptance.mjs` | Playwright suite covering 14 session, storage, and race-condition checks |
| `scripts/test-auth.mjs` | Typechecks auth and runs Node tests without adding a test dependency |
| `scripts/auth-smoke.mjs` | Creates/removes a temporary smoke route to reproduce acceptance tests |

## Execution flow

```text
Root layout → AppProviders → QueryClientProvider → AuthProvider → feature

GET: useMeQuery → useApiQuery → useQuery → authApi.me → apiClient.get

Login: useAuth.signIn → useMutation → authApi.login
       → Provider updates the token in memory → GET /me through QueryClient
       → user in query cache → useAuth.user

Register: useAuth.register → useMutation → authApi.register
          → ApiResult<UserResponse> returned to the caller; session unchanged

Logout: invalidate generation → abort login → clear token/context
        → cancel/remove private queries → reset mutation observers
```

The token getter reads the provider's memory cell at request time;
`lib/api-client.ts` does not call React hooks. Context owns the token, while
the profile comes from the query cache to avoid divergent copies of user
state. Query keys use a non-secret generation value, never the token. Late
responses from an old session cannot update the new session.

The transport returns `{ok:true,data}` or `{ok:false,error}`. Query/mutation
adapters throw typed error objects so TanStack recognizes failures.
`useAuth.signIn/register` catch those errors and return `ApiResult` to the page.
The client does not throw error strings, show toasts, or redirect. Cancellation
preserves AbortSignal semantics. The login mutation returns only UserResponse,
never a LoginResponse containing the token, so the token does not enter
MutationCache. Mutation observers reset after completion; `gcTime: 0` removes
credentials when the mutation is no longer in use.

## Usage on auth pages

```tsx
"use client";
import { useAuth } from "@/features/auth/useAuth";
import type { LoginRequest } from "@/types/api";

export function useSignInForm() {
  const { signIn, status, user, signOut } = useAuth();
  async function submit(credentials: LoginRequest) {
    const result = await signIn(credentials);
    if (!result.ok) {
      // Map result.error.fieldErrors to the form; detail is a form-level error.
      return result.error;
    }
    // The sign-in page decides whether to redirect, not the transport/provider.
    return result.data;
  }
  return { submit, status, user, signOut };
}
```

`status` is `anonymous | authenticating | authenticated | error`; `user` and
`accessToken` are null after signOut. Do not read the token on the server to
render the header: the signed-in header must be a Client Component using
`useAuth()`. If login issues a token but `/me` fails with a network/5xx error,
the token is retained and status becomes `error`. Call `useAuth().retryProfile()`
to fetch the profile again. The GET hook does not automatically repeat an
initial failed request before an explicit retry. Only a 401 from the current
session expires it; a signIn failure before a token is issued leaves the app
anonymous.

## Configuration and stub

`NEXT_PUBLIC_API_BASE_URL` is the API **origin**, for example
`http://localhost:8080`. Endpoint paths already contain `/api/v1`; do not add
that prefix twice. Requests use the same origin by default. If the frontend
and backend have different origins, the backend must configure CORS for the
Authorization header.

To build UI before the real API is available:

```bash
NEXT_PUBLIC_AUTH_STUB=true npm run dev
```

The stub has no default account: register first, then log in with the same form
data. Fake tokens are generated at runtime. Stub data is kept in memory and
removed on reload. The stub cannot be enabled in production; the provider
reports an error instead of simulating a successful login. The provider's
transport/baseUrl props are initialization settings; remount it to change them.

## Testing

```bash
npm run test:auth
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

`test:auth` typechecks the provider, hooks, and API, but does not check unrelated
UI/Storybook code. A passing targeted suite does not establish that the whole
repository builds successfully.

Reproduce browser smoke checks with a temporary route:

```bash
node scripts/auth-smoke.mjs prepare
npm run dev
# Open /auth-smoke and inspect the controls and state/evidence JSON.
# After testing:
node scripts/auth-smoke.mjs cleanup
```

To run the automated suite with an available Playwright runner, import
`runAuthAcceptance` from `tests/browser/auth-acceptance.mjs`, then call
`await runAuthAcceptance(page, "http://localhost:3101")` with a Playwright `Page`.
Start the server on the matching port: `npm run dev -- --port 3101`.
Playwright is not added to application dependencies solely for smoke testing.

Acceptance checks cover unchanged web storage, the correct Bearer token on
/me, no Bearer on public endpoints, typed 400 errors, cleared user/token/cache
after signOut, no session resurrection after logout during pending login/me
requests, no old profile cache when switching users, session clearing on 401,
and the anonymous state after a full page refresh.

### Recorded verification (2026-10-06)

- `npm run test:auth`: 16/16 tests passed; strict auth typecheck passed.
- ESLint on all changed auth files: passed.
- Playwright: 14 checks passed with no browser console/page errors, including
  logout during pending requests, account switching, 401, and recovery after 503.
- Whole-repository lint/typecheck/build still fail: stories have quote errors
  and UI/Storybook dependencies are missing in the baseline. Those unrelated
  issues were not changed as part of this issue.

Keeping the token in memory avoids storing it in web storage; it does not mean
page runtime JavaScript is inaccessible during an XSS attack.
