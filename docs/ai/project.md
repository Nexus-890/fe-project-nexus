# Project context

Nexus is a marketplace with an auction channel. The repository contains Spring Cloud business services in `be-project-nexus` and this Next.js frontend in `fe-project-nexus`. The frontend implements authentication forms, the shop shell, category browsing, product listings/details, SKU/quantity selection, add-to-cart and the Cart page. Backend services for orders, payments, shipping, inventory, notifications and auctions do not imply corresponding frontend screens exist.

## Runtime and dependencies

The frontend uses the installed Next.js 16 App Router, React 19, TypeScript with strict checking, Tailwind CSS 4, Axios, and TanStack Query 5. Forms use React Hook Form and Zod. Component primitives use Base UI; icons use Lucide. Check `package.json` and the lockfile for exact installed versions before adopting framework APIs.

One `configs/api.ts` owns API configuration and HTTP behavior. Pure API functions live in the flat `service` folder. Client features use the generic hooks in `hooks/useApi.ts`; server category resolution calls the same service without importing a client hook. Query keys are shared through `configs/queryKeys.ts`.

## Product scope

| Area | Source scope |
| --- | --- |
| Authentication | Registration, login, profile loading/retry, signed-in header, logout; in-memory access token |
| Home | Public category tree/navigation |
| Category/search | API product listings, category filters, URL paging, loading/error/empty states |
| Product detail | Product images, SKU choice, price formatting, quantity, anonymous sign-in prompt |
| Cart | Authenticated add and Cart page/header count with snapshot totals, optimistic edit/remove and rollback; blank service origin, merged BE update/remove source pending compatible build/auth/response contract; checkout disabled |
| Search/sort contract | UI query state exists; the delivered products controller currently accepts categoryId/page/size, so real q/sort behavior remains a backend contract dependency |
| Local fixtures | Explicit development/test stand-ins; never evidence that the real backend implemented a feature |

## Ownership and evidence

The backend gateway is the intended common entry point. Configure its origin using `NEXT_PUBLIC_API_URL`; endpoint paths include `/api/v1`. Server category lookup needs an absolute origin reachable from Next, and browser calls need appropriate backend CORS configuration.

The delivered OpenAPI files under `be-project-nexus/docs/api/openapi` are the wire-contract inputs. The older `docs/api/*.yaml` drafts describe future operations and must not override delivered DTOs. [ADR-008](../../../be-project-nexus/docs/adr/ADR-008-api-contract.md) still records release approval/cutover coordination as pending. No approved release date is inferred here.

User-visible routes, format helpers, tree/URL/page helpers, form validation, and auth race protections are preserved during the rebuild. Follow [functional requirements](../requirement/functional.md) for the behavior to retain and [workflow](task-workflow.md) for evidence required before claiming completion.
