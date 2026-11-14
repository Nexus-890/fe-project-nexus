# Address book — #219 / merged #265

`/addresses` uses the account sidebar, orange primary tokens and the shared
checkout address form. Buyers can add, edit and remove delivery addresses, then
choose a default. The UI displays the ten-address limit and preserves server
409/404/validation responses. Destructive removal requires confirmation.

Checkout preselects the default address, supports another saved destination or
manual entry, and offers **Save this address**. Editing or selecting an address
clears its review and recalculates the quote through the existing preview path.
An unavailable address book leaves manual checkout usable. Saves are explicit
and independent of order placement. Late responses cannot update another
session's private cache.

## Contract correction — 2026-11-14

The earlier provisional #210 contract used by this MR is superseded by the
backend source on `origin/fsa_VinhDP/feature/210-accounts-passwords-verification-address-book`
at commit `1e480dda`. Its `AddressController`, `AddressRequest`, `AddressResponse`
and delivered OpenAPI were inspected together. The immutable frontend contract
snapshot is `docs/api/account-210.openapi.json`; generated request/response
schemas are in `types/account210GeneratedType.ts`. This source branch is an
integration dependency until the compatible backend version is available.

| Method and path | #210 request / response |
| --- | --- |
| GET `/api/v1/users/me/addresses` | Envelope `data: Address[]` with sibling `page` metadata |
| POST `/api/v1/users/me/addresses` | `AddressRequest`; 201 envelope `Address` |
| PUT `/api/v1/users/me/addresses/{id}` | `AddressRequest`; 200 envelope `Address` |
| POST `/api/v1/users/me/addresses/{id}/default` | No body; 200 envelope `Address` with `isDefault: true` |
| DELETE `/api/v1/users/me/addresses/{id}` | Bodyless 204 |

The wire request contains `recipientName`, **`phone`**, `addressLine`,
`provinceCode`, `provinceName`, `wardCode`, `wardName` and optional/null
`isDefault`. The UI retains `phoneNumber` for compatibility with checkout; the
service explicitly maps it to/from `phone`. Wire `Address` adds UUID `id`,
`createdAt` and `updatedAt`; the parser validates and retains both timestamps.
It rejects the previous `phoneNumber` wire shape. Making default uses **POST**;
the previous assumed PATCH contract is removed.

Phone whitespace, parentheses and hyphens are stripped before 7–15 digit
validation. Saved addresses use the backend's 255-character street limit,
150-character recipient limit, 100-character locality names and positive
numeric locality codes of at most nine digits. Leading-zero codes are rejected
by #210; the earlier preservation example did not represent that backend
contract. Existing order checkout validation remains separate. Backend field
errors for `phone` appear on the UI phone control.

A nonempty list must contain unique IDs and exactly one default. The backend
makes the first saved address default, keeps the current default when update
`isDefault` is false/omitted, atomically changes the default on true, and promotes
the most recently updated remaining address when deleting the default. The
service enforces the ten-address limit under the owner's row lock and resolves
address ownership by JWT subject; another buyer's address returns 404. Read
access requires `PROFILE.VIEW`; mutations require `PROFILE.UPDATE`. Client calls
send the current scoped Bearer and never send an ownership `userId`.

## Verification

`tests/address-book.test.ts` uses typed #210 wire fixtures over real local HTTP
and checks request bodies, current Bearer, POST default, encoded IDs, bodyless
delete, timestamp/old-shape rejection, missing page metadata, 409/404 and phone
field mapping, cancellation and saved-address validation. It compares saved and
manually entered destinations and observes identical checkout preview bodies.
`tests/account-addresses.spec.ts` checks the real frontend against explicit
stateful HTTP dependencies; save/default requests are asserted as `phone`/POST.

```powershell
npm run test:unit
node scripts/test-browser.mjs --config playwright.account.config.ts
```

`postman/mocks/account-api/addresses.js` now follows the inspected #210 controller
and DTOs, including UUIDs, timestamps, list metadata and default ordering. It
rejects the obsolete PATCH default method. Production never imports it or falls
back to fixture data. Historical browser passes before this correction only
established the earlier stand-in's behavior; they did not verify #210
compatibility. Live PostgreSQL ownership/concurrency and the real GHN quote
remain integration checks against the compatible running backend.