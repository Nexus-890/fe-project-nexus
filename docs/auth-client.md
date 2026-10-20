# Auth client and in-memory session

## Scope and contracts

This is the plumbing for the sign-up page, sign-in page, and signed-in header,
not the implementation of those components. The access token is kept only in
`AuthProvider` memory. It is not stored in localStorage, sessionStorage, Redux
persist, or a TanStack cache persister. A full page refresh returns the app to
the anonymous state; the refresh-token flow and server-side token revocation
are outside the scope of this issue.

Sprint 1 auth request/success contracts are temporary handwritten types based on the issue and API
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

Validation errors follow the shared backend contract in
[GlobalExceptionHandler](../../be-project-nexus/lib/common-web/src/main/java/com/group5/common_web/exception/GlobalExceptionHandler.java).
The handler resolves annotation messages through
[ErrorCode](../../be-project-nexus/lib/common-core/src/main/java/com/group5/common_core/constant/ErrorCode.java) and emits an
RFC 7807 problem with `errors: Array<{field: string; message: string}>`, keeping
one message per field:

```json
{
  "type": "urn:problem:validation-error",
  "title": "Validation Failed",
  "status": 400,
  "detail": "The request data is invalid",
  "instance": "/api/v1/auth/register",
  "errors": [{ "field": "email", "message": "cannot be blank!" }]
}
```

`ProblemDetails.errors` describes this wire contract. The client retains valid
entries and derives `ApiError.fieldErrors: Record<string, string[]>` for form
consumers; the example becomes `{email: ["cannot be blank!"]}`. `fieldErrors`
is a frontend lookup, not a property emitted by the current backend. Older
`fieldErrors`/`errors` records remain accepted as a compatibility fallback;
the current backend array takes precedence. Malformed entries are ignored.
Domain and malformed-body errors can provide form-level `detail` without an
`errors` array.

Core error fields are `type`, `title`, `status`, `detail`, and `instance`, with
optional `traceId` when backend tracing is available. The actual HTTP response
status determines the error status, even if the body contains a different value.
The stub emits the same validation array, message from `FIELD_REQUIRED`, and
request-path `instance`; its trace identifier is fixture-only, not a real span.
Success payloads remain draft auth contracts; this change does not introduce
the generic `APIResponse<T>` success wrapper without implemented auth endpoints.

Sources:
- [Catalogue](https://drive.google.com/file/d/1KIJsr87F-6TWieBbie9CVzgCBTPsM4Zk/view)
- [Business Rules](https://docs.google.com/spreadsheets/d/1x2ulrpa9n5Xmgb8G7b3zJ9sisHjYJG7wGycalQGHB-U/edit)
- [SRS](https://drive.google.com/file/d/1nw7_WwZoWhjgA1WiZJzu37ps_MisI5Ls/view)

## File responsibilities

| File | Responsibility |
| --- | --- |
| `types/auth/{request,response}/type.ts` and `types/common/{request,response}/type.ts` | Request/response contracts, RFC 7807, typed errors, and `ApiResult<T>` |
| `lib/api-client.ts` | Scoped Axios GET/POST adapter; reads the latest token and returns typed results/errors |
| `configs/api.ts` | Sole env URL source and Axios factory and anonymous client; API origin, 15-second timeout, JSON Accept header |
| `lib/api-result.ts` | Converts failure results into rejected Promises for TanStack |
| `hooks/api-query-options.ts` | GET request/options types, path interpolation, typed errors and shared `fetchQuery` configuration |
| `hooks/useApiQuery.ts` | Source-shaped custom GET hook with request/options, four generics and `select` |
| `service/auth.ts` | `register`, `login`, and `me`; validates responses at runtime |
| `hooks/auth/useMeQuery.ts` | Profile query keyed by session generation; does not fetch automatically without a token |
| `providers/AuthProvider.tsx` | Owns the token and login/register mutations; clears the session and cache on logout |
| `hooks/auth/useAuth.ts` | Exposes auth context to components and reports a missing provider |
| `providers/AppProviders.tsx` | Creates a stable QueryClient with source defaults and composes both providers |
| `app/layout.tsx` | Mounts the provider without adding fetch/state logic to the route |
| `tests/fixtures/auth-stub.ts` | In-memory fake backend for building UI before the real API is available |
| `tests/auth-api.test.ts` | Transport, endpoint, fixture, and typed-error regression tests |
| `tests/auth-query.test.ts` | Query cache, enable/disable, cancellation, and error-adapter tests |
| `tests/browser/AuthProbe.tsx` | React consumer for browser session testing, not a production auth page |
| `tests/browser/auth-acceptance.mjs` | Playwright suite covering 14 session, storage, and race-condition checks |
| `scripts/test-auth.mjs` | Typechecks auth and runs Node tests without adding a test dependency |
| `scripts/auth-smoke.mjs` | Creates/removes a temporary smoke route to reproduce acceptance tests |

## Execution flow

```text
Root layout → AppProviders → QueryClientProvider → AuthProvider → feature

GET: useMeQuery → useApiQuery → useQuery → service/auth.me → apiClient.get → Axios
     → typed result → runtime profile validation → user in query cache

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
import { useAuth } from "@/hooks/auth/useAuth";
import type { LoginRequest } from "@/types/auth/request/type";

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

## Reference-source integration

The working API/TanStack parts from `web-first.zip` are integrated into the
existing files rather than duplicated under new provider/hook names:

- Axios 1.20 client: API URL, JSON Accept header, 15-second default timeout.
- GET request object: `queryKey`, `url`, `pathParams`, `query`, `config`.
- Separate TanStack options: `enabled`, `select`, `staleTime`, `retry`, etc.
- Four generics: response, selected result, path parameters, query parameters.
- QueryClient defaults: queries stale for 30 seconds, inactive cache retained
  for 5 minutes, no refetch on window focus, one retry; mutations never retry.

The typed GET adapter narrows the retry default to transient network/5xx errors,
so a 400/401 is not repeated. Auth profile queries explicitly disable retries
and use a 60-second stale time. `select` transforms the observer's result, not
the raw response stored in QueryCache.

```tsx
"use client";
import { useApiQuery } from "@/hooks/useApiQuery";

interface Product { id: string; name: string }

export function useProductName(productId: string, search: string) {
  return useApiQuery<Product, string, { productId: string }, { search: string }>({
    queryKey: ["product", productId, { search }],
    url: "/api/product/:productId",
    pathParams: { productId },
    query: { search },
    config: { timeout: 10_000 },
  }, {
    enabled: Boolean(productId),
    select: (product) => product.name,
  });
}
```

This is an API usage example, not an added product page or fixture endpoint.
Include every changing path/query value in the query key. Path values are
URL-encoded; a missing value rejects with a typed `invalid-response` error.
The default client is anonymous. Protected feature queries must pass
`client: useAuth().api.client`, use non-secret account/session keys, and mark
`meta: { requiresAuth: true }` so signOut removes them. The `/me` implementation
already handles the session key, validation and enabled state.

Request config supports Axios settings such as headers, timeout, credentials
and parameter serialization. URL, origin, method, transport, authentication,
cancellation and response parsing remain owned by the typed client. Caller
headers cannot replace the provider's current token or add Bearer to the public
auth endpoints. Axios uses its supported custom-fetch adapter for the existing
in-memory fixture, not a second HTTP implementation.

The reference's Next.js-internal `ApiError` import is replaced by this project's
RFC 7807 error type. Its unfinished demo components/routes, missing imports,
`.env`, Git metadata and unused dependencies are not copied. This change does
The auth UI is implemented at `app/(auth)/sign-up/page.tsx` and
`app/(auth)/sign-in/page.tsx` with React Hook Form + Zod validation. The forms
submit through `useAuth().register/signIn`, map typed backend errors next to
inputs, and route successful registration to `/sign-in` or sign-in to `/`.
Endpoint paths remain colocated in `service/auth.ts`; this does not add refresh
tokens or a generic mutation wrapper.

## Configuration and stub

For a backend without browser CORS, leave `NEXT_PUBLIC_API_URL` empty and set
`API_PROXY_TARGET=http://localhost:8080` in `.env.local`. Next proxies browser
`/api/v1/...` requests to this target; server-side catalog calls use the target
directly. Set `NEXT_PUBLIC_AUTH_STUB=false` to use real login and profile data.
Restart Next after changing configuration.

Alternatively, `NEXT_PUBLIC_API_URL` is the API **origin** for direct requests
when the backend allows CORS, including Authorization and JSON preflight.
Endpoint paths already contain `/api/v1`; do not add that prefix twice.
The previous `NEXT_PUBLIC_API_BASE_URL` remains a fallback.

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

### Recorded verification (2026-10-07)

- `npm run test:auth`: 30/30 tests passed; strict auth typecheck passed.
  Includes native Axios GET/POST, defaults/timeout, current-token headers, protected request
  configuration, encoded path/query params, select, cancellation and profile validation.
  Also covers the common-web validation array, field lookup normalization, malformed
  entries, HTTP-status precedence, legacy compatibility, and the stub wire contract.
- ESLint on all changed auth files: passed.
- Playwright: 14 checks passed with no browser console/page errors, including
  logout during pending requests, account switching, 401, and recovery after 503.
- Whole-repository lint/typecheck/build still fail: stories have quote errors
  and UI/Storybook dependencies are missing in the baseline. Those unrelated
  issues were not changed as part of this issue.

Keeping the token in memory avoids storing it in web storage; it does not mean
page runtime JavaScript is inaccessible during an XSS attack.
