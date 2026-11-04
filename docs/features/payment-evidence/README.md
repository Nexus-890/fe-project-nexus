# Payment browser evidence — 2026-11-04

Captured by `npm run test:payment` against the real Next.js application and the
local Postman dependency simulation. All nine scenarios passed in 33.2 seconds.

- [Mobile, 375×812 viewport](payment-mobile-375x812.png): full page; tests also assert that the complete QR fits in the initial viewport with no horizontal scrolling.
- [Desktop, 1440px viewport](payment-desktop-1440.png).
- [Expired state, 375×812 viewport](payment-expired-375x812.png).

The screenshots use two fixture shops with a combined amount of 350,000 VND.
The deterministic QR-shaped image tests image loading and layout; it is not a
live bank-transfer QR. See the [simulation context](../../../postman/simulations/payment.context.yaml)
for the tested behavior and integration limits.
