# Address book — #219 / merged #265

`/addresses` uses the existing account sidebar, orange primary tokens and the
shared checkout address form. Buyers can add, edit and remove delivery addresses,
then make one default. The UI shows the ten-address limit and preserves server
409/404/validation responses. Destructive removal requires confirmation. Province
and ward codes stay separate from labels, including leading zeroes.

Checkout loads the default address, allows selecting another saved destination or
entering a new one, and offers **Save this address**. Selecting or editing an
address clears its review and recalculates the quote through the existing preview
path. A failed address-book read leaves manual checkout available. Saves are
explicit and independent of order placement; no address is persisted implicitly.
Late address responses and writes cannot update another session's private cache.

## API dependency

Backend #210 is absent from the inspected `develop` user-service controller and
delivered `docs/api/openapi/user-service.yaml`. These are **provisional** frontend
contracts for the issue's permitted mocked integration. They do not add or claim
backend endpoints. Reconcile them with #210 and regenerate wire DTOs when its
OpenAPI is delivered.

| Method and path | Provisional request / response |
| --- | --- |
| GET `/api/v1/users/me/addresses` | Envelope `data: SavedAddress[]` |
| POST `/api/v1/users/me/addresses` | Address input; 201 envelope `SavedAddress` |
| PUT `/api/v1/users/me/addresses/{id}` | Address input; 200 envelope `SavedAddress` |
| PATCH `/api/v1/users/me/addresses/{id}/default` | No body; 200 envelope `SavedAddress` with `isDefault: true` |
| DELETE `/api/v1/users/me/addresses/{id}` | Bodyless 204 |

Address input contains `recipientName`, `phoneNumber`, `addressLine`,
`provinceCode`, `provinceName`, `wardCode`, `wardName` and `isDefault`.
`SavedAddress` adds `id`. IDs are encoded as path segments. All operations use
the current scoped Bearer through the existing HTTP boundary. Ownership comes
from the authenticated principal; the client sends no `userId`.

A nonempty list must contain unique IDs and exactly one default; malformed
responses are rejected. #210 must enforce the ten-address limit (11th returns
409), atomically keep exactly one default, and return 404 for another buyer's
address. Frontend controls and the dependency fixture do not establish backend
ownership enforcement or database concurrency guarantees.

## Verification

`tests/address-book.test.ts` exercises real local HTTP for endpoint methods,
current Bearer, allowlisted request bodies, encoded IDs, bodyless deletion,
409/404 preservation, malformed response rejection and cancellation. It compares
saved and manually entered destinations and observes identical preview bodies
containing the original province/ward codes. Browser scenarios in
`tests/account-addresses.spec.ts` exercise the real Next application against the
explicit account dependency simulation.

Run from `fe-project-nexus`:

```powershell
npm run test:unit
node scripts/test-browser.mjs --config playwright.account.config.ts
```

The account simulation reuses the existing Keycloak/session and checkout
dependencies. `postman/mocks/account-api/addresses.js` models the missing #210
address operations. Production never imports it or falls back to fixture data.
Live user-service/PostgreSQL ownership, the real GHN fee and cross-user rejection
remain #210 integration checks.
