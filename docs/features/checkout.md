# Checkout address and order summary — #150

Implemented on 2026-11-04 from `develop` at `0d0a36a4`, after #129 supplied
the cart route and shared `useCart`. The route is `/checkout`; the Cart summary
now links there after cart edits finish. This change implements address/quote
review. [Place order #151](place-order.md) extends it with order creation,
idempotency and a group payment handoff; QR initiation belongs to #152.

## Behavior and UI

The supplied UI guides the desktop layout: shipping address, delivery and
payment sections on the left, with compact item and total cards on the right.
Mobile stacks these sections. The existing shop header and semantic orange
tokens are reused. The form is expanded because this task needs a validated
address, not an unimplemented saved-address book. Only the supported SePay
VietQR method is presented; there is no invented card processor, delivery SLA
or inventory reservation timer. All money remains VND.

- Name, phone and address line start from the authenticated `/users/me` profile.
  Locality selections always start empty. Profile absence/errors do not produce
  a partially authenticated checkout.
- All six fields have validation, associated errors and an announced summary.
  Invalid submission focuses the first invalid field and makes no preview or
  order request. Phone punctuation is allowed but 8–15 digits are required.
- Province changes clear district and ward; district changes clear ward. Each
  child query is filtered by its parent's code. Code strings, including leading
  zeroes, are retained separately from display names for the future order flow.
- Complete valid destinations automatically request a preview. Changing any
  address field selects a new query; obsolete requests are canceled. A pending,
  failed, unavailable or obsolete quote never shows a final payable amount.
- Item quantity and price always come from the Cart snapshot. Optional catalog
  names/images have a fallback and cannot replace snapshot prices. Exact decimal
  helpers validate line totals, subtotal and `subtotal + shipping + tax = total
  + discount`. The returned preview must match every current Cart line.
- A null shipping fee means unavailable, not zero. Problem Details preserve
  `code`/`detail`; `VALIDATION_FAILED` fields are mapped to the matching controls.
  Other failures expose the server detail and an explicit retry.
- Anonymous checkout redirects to `/sign-in?returnTo=%2Fcheckout`; authenticated
  empty carts redirect to `/cart`. Session keys, private-query metadata and
  generation checks prevent late quote results after logout/account changes.
- Review address confirms the current form locally. #151 enables Place order
  once the current address is reviewed and the quote is ready.

## Ownership

`app/(shop)/checkout/page.tsx` delegates to `features/CheckoutPage.tsx`.
The feature owns form/quote/redirect state; `checkoutSchema.ts` validates and
maps fields. `CheckoutSummary.tsx` owns optional metadata queries.
`components/AddressForm.tsx` and `OrderSummary.tsx` render data and callbacks.
`service/checkoutService.ts` owns HTTP and runtime parsing through the existing
`configs/api.ts`; shared hooks and `configs/queryKeys.ts` own query behavior.

The issue's older `ui/components/organisms` paths are adapted to the current
flat component architecture. No duplicate old component tree is restored.

## API dependencies and mock boundary

| Request | Current integration |
| --- | --- |
| GET `/api/v1/users/me` | Delivered; existing auth provider supplies profile data |
| GET `/api/v1/carts/me` | Delivered; shared `useCart` supplies the snapshot |
| GET `/api/v1/shipping/provinces` | #201 pending; provisional `data: [{code,name}]` with sibling page metadata |
| GET `/api/v1/shipping/districts?provinceCode=...` | #201 pending; same provisional list shape |
| GET `/api/v1/shipping/wards?districtCode=...` | #201 pending; same provisional list shape |
| POST `/api/v1/checkout/preview` | #188 delivered contract; numeric item/amount fields normalized into decimal strings |

The preview request follows #188's delivered contract: `shippingAddress` contains
`recipientName`, `phoneNumber`, `addressLine`, `city`, `district`, `ward` and
`countryCode: "VN"`, alongside `paymentMethod: "SEPAY"`. The form's three codes
are retained locally, not sent as undocumented fields to the names-only contract.
Order creation also uses the delivered names-only address contract; code-based
shipping integration still needs an agreed backend contract.
The inspected #188 implementation currently returns `shippingFee: null`, so
ward-sensitive fees remain a simulation assumption until #188/#201 integrate.
There are no changes to delivered OpenAPI or generated DTOs.

Production uses the normal configured API origin and never imports or silently
enables mock code. The explicit local [Postman simulation](../../postman/simulations/checkout.sim.yaml)
reuses the repository OIDC fixture and adds a checkout API stand-in. Its
[context](../../postman/simulations/checkout.context.yaml) records provenance,
observed caller behavior and unresolved contracts. It is not live BE/GHN evidence.

## Verification

The pre-change baseline passed generated-type drift and all 73 unit tests.
The final implementation passed generated-type drift, source lint, fresh-route
typecheck, all 82 unit/service tests, 30 default browser regressions, 11 OIDC
browser scenarios, all 13 checkout scenarios and the isolated production build
including `/checkout`. Existing `.next-profile-run` is unrelated generated output;
lint explicitly ignores it without changing source rules.

```powershell
npm run generate:types:check
npm run lint -- --ignore-pattern '.next-profile-run/**'
npm run typecheck
npm run test:unit
npm run test:browser
npm run test:auth:browser
npm run test:checkout
$env:NEXUS_TEST_DIST_DIR = '.next-verify-build'
npm run build
```

The checkout browser suite runs the actual Next application and real HTTP
dependencies from a local Postman simulation. It verifies redirects, two-line
totals, no-request validation, cascading codes, quote races, errors/retries,
missing fees, malformed responses, logout and the 375×812 layout/44px controls.
No live backend/carrier request, order write, payment, merge or deployment is
part of this verification. Shipping/preview contract reconciliation remains
required before release against the real services.

Screenshots `checkout-desktop-1440.png` and `checkout-mobile-375x812.png` were
visually reviewed and copied with the simulation logs to the chat's local
visualization folder under `checkout-150`. These are explicit fixture views,
ready to attach to a future merge request. Browser assertions also verify no
horizontal scroll and controls at least 44×44px at 375×812. Initial browser/build
attempts stopped at the existing Next.js 16.4.0 security reminder; unchanged
retries passed. That dependency advisory remains a separate upgrade follow-up.

## Open the local UI

From `fe-project-nexus`, run `npm run dev:checkout`, then visit
`http://127.0.0.1:3103/checkout`. This explicit development command starts the
local Postman simulation on port 3913 and Next on 3103, checks port availability,
and stops its own children with Ctrl+C. It does not change `.env` or enable
fixtures in production. It uses the already installed Postman CLI.

Use Continue to sign in, then the local fixture account `buyer@nexus.local`
with fixture password `Fixture-pass-123!`. These are test-only values. Choose
Ho Chi Minh City → District 4 → Ward 4 for the 30,000 VND fee, or Ward 5 for the
45,000 VND scenario. The cart has two lines totaling 425,000 VND. Reloading
requires signing in again because the application keeps authentication in memory.
The process prints the existing framework advisory if a startup retry is needed.
