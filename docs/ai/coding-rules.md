# Coding rules

## Files, functions and exports

- Place code in the flat folders defined by [architecture](architecture.md). Use a meaningful filename, such as `catalogResponseType.ts`, `catalogService.ts`, or `signInSchema.ts`.
- Use camelCase for functions/variables, PascalCase for components and types, and a `use` prefix for React hooks.
- Declare the main page/component/provider with a named function and export it as default. Keep named exports for reusable hooks, service functions and helpers.
- Declare generic hooks as `export function useApiQuery<...>(request, options)` and `export function useApiMutation<...>(request, options)`.
- Use named async function values for service calls, for example `export const getProducts = async (...) => ...`. Give request/response boundaries concrete domain types; infer types inside the function.
- Use concise arrow helpers/callbacks, destructuring, early returns, and async/await as in the reference. Use Promise.all for independent asynchronous work, not operations whose order matters.
- Import symbols used only in types with `import type`. Keep formatting consistent with the existing lint setup.
- Explain business decisions and non-obvious constraints in comments. Do not copy tutorial comments, typos, or inaccurate descriptions from the sample.

## API and hooks

- Use the single `configs/api.ts` and pure functions in `service`. Do not create per-feature Axios clients, transport factories or another `api.ts`.
- Services own endpoint path/body/query, response validation and mapping. They do not call React hooks, render JSX, redirect, show toasts, or manage query cache.
- Client consumers use the two generic hooks in `hooks/useApi.ts`. Do not add an endpoint hook that only forwards one service call.
- Never call a React hook at module scope, in a conditional branch, or inside an ordinary async function.
- Separate request data from TanStack options. Preserve the reference names `invalidateKey` and `removeKey`.
- Include every changing path/query/filter in the query key. Private keys use a non-secret session identifier and protected-query metadata, never a token.
- Forward controlled AbortSignal values. Cancellation remains distinct from a network failure; it is not automatically retried or shown as an ordinary error.
- Do not override origin/auth/adapter/parsing with arbitrary request config. Public endpoints never attach Bearer; private calls read the current scoped token.
- Throw normalized typed API errors from service/HTTP boundaries. Do not add an ApiResult/unwrap/adapter chain around each request. An auth UI facade may return a result union to forms.
- Preserve callback arguments and optimistic-update options when wrapping TanStack. `onMutateResult` is the result of onMutate; the callback context is TanStack's context.

## Types and validation

- Run `npm run generate:types` when delivered OpenAPI changes. Do not hand-edit `types/userGeneratedType.ts`, `catalogGeneratedType.ts`, or `commerceGeneratedType.ts`, or maintain a competing handwritten wire DTO.
- Flat request/response files expose domain types. Clearly separate numeric wire money from normalized decimal-string models.
- Treat incoming JSON as unknown until the relevant parser validates it. A generic assertion does not validate runtime data.
- Keep component/route props next to their owner when not reused. Do not place Next route params in an HTTP request type.
- Keep the behavior of `formatVND`, money normalization, URL/tree/page helpers and form schemas when moving or rewriting functions. Share one implementation instead of duplicating helpers across pages.
- A guard must describe the value it actually checked. A parser may return a different normalized model; a type predicate must not claim that numeric wire values were already strings.

## UI and boundaries

- Follow the [design system](../ui/design-system.md). Use semantic tokens and keep visible keyboard focus.
- Preserve the logical component dependency hierarchy while using a flat physical folder.
- Keep route modules thin. Server features may call pure services; never pull a client-hook module into a server helper.
- Preserve existing public URLs, redirect aliases, SKU/quantity/gallery interactions, error states and accessibility semantics.
- Mock selection belongs in explicit development/test setup and is blocked in production. Production code never imports test files.

## Changes and evidence

Update affected fixtures, imports, scripts, generators and docs with the code. Read [task workflow](task-workflow.md) before reporting completion. Passing mock tests establish behavior against that mock; they do not establish live backend compatibility or approval to release.
