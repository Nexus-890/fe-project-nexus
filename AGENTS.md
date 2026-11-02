<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Nexus frontend agent instructions

## Before changing code

1. Read `docs/ai/index.md` and choose the documents for this task.
2. Read relevant source and tests; documentation is context, not proof.
3. Inspect the branch and working tree; preserve unrelated user changes.
4. Read installed Next.js guides for the framework APIs you will use.
5. For API work, compare delivered OpenAPI with its controller and DTOs.
6. Record the relevant baseline and distinguish existing failures.
7. Follow authorized work through implementation and verification.

## Architecture

- Keep production source folders flat; use descriptive filenames.
- Preserve Next route nesting, documentation topics and required resources.
- `app` owns route params, layouts and boundaries; delegate to features.
- `features` owns page state, orchestration, schemas and UI feedback.
- `components` owns rendering/local interaction and shared UI helpers.
- `service` owns named async API functions, endpoint parsing and mapping.
- `configs/api.ts` is the sole Axios/API configuration and HTTP boundary.
- `hooks/useApi.ts` owns shared query/mutation behavior through services.
- `hooks/useAuth.ts` reads the provider's auth context.
- `providers/Provider.tsx` owns QueryClient and scoped auth lifecycle.
- `configs/queryKeys.ts` owns shared cache keys; never include tokens.
- Wire DTOs are generated; application models/context/props are distinct.
- Do not restore nested service/type folders or obsolete API wrappers.

## Implementation rules

- Follow `docs/ai/coding-rules.md`, including function/export conventions.
- Services do not call hooks; hooks never run at module scope.
- Server features use pure services, not runtime imports from client hooks.
- Keep request data separate from TanStack options and cache controls.
- Preserve cancellation, typed errors, envelope/page parsing and bodyless 204.
- Public requests omit Bearer; private calls read the current scoped token.
- Preserve auth generations, private-cache cleanup and late-response guards.
- Keep the token in memory; do not add session persistence implicitly.
- Preserve formatter, tree/URL/page helpers, validation and UI behavior.
- Move or merge useful functions before deleting their old files.
- Share helpers; do not duplicate code to force a flat folder layout.
- Use semantic UI tokens from `app/globals.css` and visible keyboard focus.
- Production code must not import tests or silently enable mock behavior.
- Update imports, component aliases, scripts, fixtures and docs together.

## Verification and handoff

- Run `npm run generate:types` after delivered OpenAPI changes.
- Run `npm run generate:types:check` to detect generated DTO drift.
- Run lint, typecheck, unit tests, relevant browser checks and build.
- Use `docs/ai/task-workflow.md` for commands and evidence requirements.
- Check actual behavior, including auth races and changed helper outputs.
- Keep generated route types isolated from stale or active dev output.
- Treat mock/simulation evidence separately from live backend evidence.
- Report checks actually run, failures, scope and unresolved dependencies.
- Do not delete tests, weaken assertions or change business rules to pass.
- Keep ADR/release approval pending until the actual owners record it.
- Finish authorized reversible work before presenting the reviewable result.
- Do not publish, merge, deploy or send messages without authorization.
