# Task workflow

## Before editing

1. Read [AGENTS.md](../../AGENTS.md) and use the [task router](index.md). Read the source and tests for the actual behavior; load additional documents only when they answer a concrete question.
2. Check the branch and working tree. Preserve unrelated user work. For framework changes, read the relevant installed guides under `node_modules/next/dist/docs`.
3. Establish the contract from the delivered OpenAPI/controller and identify consumers. Separate intended contract changes from regressions.
4. Record the baseline checks relevant to the task and any existing failure. A historical README result is not a current baseline.
5. For a move/rebuild, inventory functions, callers, expected outputs and test coverage. Identify the destination before deleting any old file.

## While editing

Keep a focused ownership boundary. Services, hooks, provider, feature state and component rendering each have the responsibilities in [architecture](architecture.md). Update import paths, generator aliases and test/smoke runner paths in the same migration.

Keep useful helpers even when the old folder disappears. Preserve formatter precision, pagination rules, URL encoding, category lookup, form validation, auth generations and cache isolation. Remove obsolete adapters only after their callers have migrated and equivalent behavior has evidence.

Prefer a small coherent change over adding a permanent compatibility layer. Wire-contract cutover must update parsers, types and fixtures together. Coordinate release with BE owners as required by [ADR-008](../../../be-project-nexus/docs/adr/ADR-008-api-contract.md); this document does not record that approval as granted.

## Verification

Run checks that cover the behavior changed, then the required project gates:

```powershell
npm run generate:types
npm run generate:types:check
npm run lint
npm run typecheck
npm run test:auth
npm run test:catalog
npm run build
```

The browser runner prepares/cleans the smoke route and runs configured `tests/*.spec.ts` scenarios, including the auth acceptance harness. Confirm actual execution; a file ending `.mjs` is not discovered merely because Playwright runs `*.spec.ts`. Keep unit script aliases compatible when renaming commands. Check Storybook separately when touching its config/consumers; demo stories do not cover the application UI.

`npm run typecheck` regenerates Next route types in the isolated `.next-typecheck` output and checks source against those fresh types with the runner's temporary TypeScript configuration. Historical `.next` output is not the route-contract source for this command. Do not delete another running dev server's output or exclude the freshly regenerated types to hide a failure.

`npm run build` uses the active build output's generated types through a temporary configuration, restores the checked-in tsconfig afterwards and keeps TypeScript checks enabled. Set `NEXUS_TEST_DIST_DIR` to an isolated directory when verifying alongside another dev server. The [rebuild report](verification.md) records the executed checks and remaining integration limits.

For API changes, verify request method/path/body/query, auth headers, error/204 handling, cancellation, cache callbacks, session transitions and relevant UI outcomes. Use real HTTP stand-ins for serialization/timeout/retry checks. Validate against the real backend when the environment is available, and distinguish that evidence from fixtures/simulation.

Search for stale paths, internal Next ApiError imports, direct Axios outside config/service, module-scope hooks, hardcoded cart origins, and production imports from tests. Check local Markdown links.

## Reporting and handoff

Report the behavior changed, checks actually run, results, and remaining limits. Record command/date/scope; never claim an unrun gate passed. Record failing baseline separately from regressions introduced by the change. Do not weaken assertions, delete regression tests, add demo business data, or change product behavior just to make tests pass.

Release approval, live service availability and pending backend capabilities remain explicit dependencies. Finish authorized local work and present a concrete diff; do not add routine confirmation loops for reversible edits.
