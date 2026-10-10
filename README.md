This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Auth client

See [Auth client and in-memory session](docs/auth-client.md) for API contracts,
file responsibilities, TanStack Query flows, the stub, and testing instructions.

```bash
npm run test:auth
NEXT_PUBLIC_AUTH_STUB=true npm run dev
```

The access token is kept in memory only; a page reload does not restore the
session in Sprint 1.

## Development

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Catalog pages

Home is `app/(shop)/page.tsx`; category listings are
`app/(shop)/categories/[slug]/page.tsx`, and search results are
`app/(shop)/search/page.tsx`. Routes delegate to `features/`.
Each page feature has its own folder: `features/home`, `features/category`,
`features/search`, and `features/shop`. Shared catalog parsing and tree helpers
live in `lib/catalog-model.ts`; shared UI lives under `ui/components`.

Authentication pages live outside the shop chrome under `app/(auth)`: sign-up is
`/sign-up` and sign-in is `/sign-in`. Both forms use the shared `AuthProvider`,
`react-hook-form`, and Zod. Draft auth paths are kept in `service/auth.ts`,
alongside the other auth endpoint paths.
The home feature currently renders the API-backed category tree only. Product
listing and paging stay in the category and search features until the products
endpoint is available. The shared header owns search navigation and renders the
authenticated or anonymous actions.
The public catalog uses the existing anonymous Axios/TanStack adapters.
The shop layout feature consumes `useAuth()`; browsing does not require authentication.

Set `NEXT_PUBLIC_API_URL` in your local env to the common backend origin.
`.env.example` leaves it empty for you to configure. `configs/api.ts` is the
only module reading the API URL; `NEXT_PUBLIC_API_BASE_URL` is retained as a
legacy fallback. There is no catalog-specific origin. Service modules append
their endpoint paths to this configuration. For server-side category slug
resolution, configure an absolute common API origin accessible to Next and the
browser. Restart Next after changing env.

Architecture:

```text
app/**/page.tsx         -> renders the page feature only
features/              -> route params, page state and orchestration
hooks/useApiQuery.ts    -> project-wide custom query hook for all features
configs/query-keys.ts   -> shared query key registry
service/               -> auth/catalog endpoint calls using configs/api.ts
configs/api.ts         -> common env URL and Axios configuration
ui/components/         -> atoms, molecules, organisms, templates and primitives
types/<domain>/request/type.ts
types/<domain>/response/type.ts
```

`CategoryPage` is a server feature to preserve the not-found behavior. It uses
TanStack `fetchQuery` with the shared `apiQueryOptions` adapter and catalog service;
React hooks run only in client features. Header/category navigation UI receives
props; the feature owns auth/query state. Shared transport/query/component
contracts are in `types/api/type.ts`, `types/query/type.ts`, and `types/ui/type.ts`.

### Shared custom query hook

Every client feature imports the same `useApiQuery` hook and supplies its service.
The category tree has a small shared `useCategoryTree` wrapper so Home and the
client-side search page use one query key and one service contract. Response
types are inferred from the service return type. TanStack options such as `enabled`, `select`,
`staleTime`, `retry`, and `refetchOnWindowFocus` are passed as the second argument.

```tsx
"use client";

import { useApiQuery } from "@/hooks/useApiQuery";
import { getProducts } from "@/service/catalog";
import { queryKeys } from "@/configs/query-keys";

export function Example() {
  const filters = { page: 0, size: 12 };
  const products = useApiQuery({
    queryKey: queryKeys.catalog.products(filters),
    service: (signal) => getProducts(filters, signal),
  }, {
    staleTime: 30_000,
    select: (response) => response.content,
  });

  // products.data is ProductSummary[] | undefined.
  return <p>{products.data?.length ?? 0} products</p>;
}
```

Other teams supply their own service in exactly the same way. Services return
`Promise<ApiResult<T>>` and forward `signal` to the API client. The common adapter
turns failed results into TanStack errors and supports cancellation. All changing
request parameters belong in the query key so different requests use separate
cache entries. The earlier URL-based request form remains available for existing
callers; new features use service callbacks to keep endpoint logic in `service/`.

The tree renders three levels from `GET /api/v1/categories/tree`.
Category and search requests include a zero-based API page and size 12;
search also sends the optional `q` and category filters.
The URL uses one-based pages (`?page=2`); malformed page values resolve to page 1.
Product responses currently follow the existing draft
`{content, page, size, totalElements}` contract. Confirm page indexing and sort
with the backend when the products endpoint is implemented. Product images
remain explicit placeholders because the draft response has no image field.
No production catalog fixture or promotional data is injected.

Unknown slugs use Next's not-found boundary; API failures use an error boundary
with Next 16.3's `retry()`. Category and product loading/errors are rendered
independently. The category and search pagers preserve other query parameters
and browser history; Clear All returns the default listing state.

### Catalog verification

```bash
npm run test:auth       # 34 auth + catalog model/transport checks
npm run test:catalog    # 8 browser scenarios using an isolated test API
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

The Playwright suite uses installed Google Chrome, ports 3911/3102 and a
temporary test build directory. Screenshots appear under `test-results/`.
Test servers start with the configuration in
`playwright.config.ts`; do not point these tests at a real backend.

Verified on 2026-10-10: build, lint, typecheck, 34 unit/integration checks and
8 browser scenarios passed. Mobile checks cover 375x812, horizontal overflow,
and 44x44 application controls. Real V3 seed acceptance and independent
reviewer verification remain pending: the checked-out backend has category
controllers but no products controller. The older baseline-failure note in
`docs/auth-client.md` describes its earlier verification date.

The provided MockAPI resources were checked with read-only requests (three
root categories and 34 product rows). A temporary array adapter passed three
browser scenarios before removal, as requested. The final service uses only
the task's backend endpoints and paginated product response; it does not adapt
MockAPI arrays. Set `NEXT_PUBLIC_API_URL` to a backend providing that contract.
