# API errors and cancellation

The HTTP boundary normalizes HTTP, network and malformed-response failures to the project's `ApiError`. Services reject typed errors; query/mutation hooks use rejected Promises so TanStack reports an error state. Pages decide how to show errors or navigate. Cancellation has separate AbortError/TanStack semantics and must not become an ordinary network failure.

## Problem Details

The delivered backend uses `application/problem+json` with the HTTP status and a symbolic error code:

```json
{
  "type":"urn:problem:validation-error",
  "title":"Bad Request",
  "status":400,
  "detail":"The request data is invalid",
  "instance":"/api/v1/auth/register",
  "code":"VALIDATION_FAILED",
  "errors":[{"field":"email","code":"VALIDATION_EMAIL","detail":"Enter a valid email"}]
}
```

Use the actual HTTP status even if the body says something else. Preserve `code`, `detail`, `instance` and optional `traceId`; do not manufacture trace identifiers. Parse field entries as `{field, code, detail}` and derive the form lookup `fieldErrors`. Malformed field entries do not turn an HTTP failure into a success.

| Failure | Expected caller behavior |
| --- | --- |
| 400 validation | Map known field names/aliases to inputs, with form-level fallback |
| 401 invalid login | Show credentials error; do not create a session |
| 401 current `/me` session | Clear the session and private cache |
| 403 | Show access failure; do not treat it as a retryable network issue |
| 409 registration conflict | Use symbolic duplicate code to select email/phone/identity field |
| 423 account locked / 429 limited | Show useful server/fallback text; do not silently loop a login POST |
| Network or 5xx query failure | Apply the query's transient retry policy; expose explicit retry UI |
| Malformed JSON/envelope/domain data | Report invalid response; do not render unchecked data |
| Unknown future code | Show a useful detail/title or generic fallback; keep the numeric status |
| Explicit cancellation/stale session | Stop/ignore obsolete work; do not show a success or ordinary failure for a new session |

Registration field mapping uses codes such as `USER_EMAIL_ALREADY_USED`, `USER_PHONE_ALREADY_USED`, and `USER_IDENTITY_NUMBER_ALREADY_USED`. Do not infer fields by matching English detail strings. Existing field alias/nested-path handling remains valid for validation entries.

`ApiError` is an object contract; `instanceof Error` alone is insufficient. Use the project's guard and the typed detail/title/code fields. Do not import the unrelated internal Next server ApiError type.

## Retry and cancellation

Default GET retry is at most one transient network/5xx retry. Rejected 4xx and invalid-response errors are not retried. `/me` can retain its explicit failure until the user requests profile retry. Mutations default to no retry because repeated writes can duplicate work.

GET forwards TanStack's signal to the service and Axios. Mutation signal is a controlled input; `cancelQueries` does not automatically cancel a mutation. The provider owns pending-login cancellation and generation checks. If a transport ignores abort, a late response must still fail the generation check before it changes session state, private cache, or UI feedback.

## Error presentation and evidence

Forms show field errors next to labeled controls and form-level errors in an alert. Catalog/category loading and failure states stay independent. Product/cart failure must not display an add-success message. A server category lookup distinguishes an unknown category (404 boundary) from an API failure (error boundary).

Tests cover HTTP status precedence, malformed responses, field mapping, retries, cancellation and stale responses. Local HTTP stand-ins can establish caller behavior under a scenario; live endpoint authorization, deployed contracts and release coordination require separate backend evidence.
