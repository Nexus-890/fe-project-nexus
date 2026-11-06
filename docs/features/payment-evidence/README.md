# Payment browser evidence — 2026-11-04

Captured against the real Next.js application and the local Postman dependency
simulation. The original QR/countdown run passed all nine scenarios in 33.2 seconds.

- [Mobile, 375×812 viewport](payment-mobile-375x812.png): full page; tests also assert that the complete QR fits in the initial viewport with no horizontal scrolling.
- [Desktop, 1440px viewport](payment-desktop-1440.png).
- [Expired state, 375×812 viewport](payment-expired-375x812.png).
- [Confirmed group and paid order list, 375×812 viewport](payment-confirmed.png).
- [Canceled group, 375×812 viewport](payment-canceled.png).

The #153 run covered eighteen scenarios: seventeen passed in the full run, and
the remaining cadence/confirmation scenario passed on a targeted rerun after
replacing a coarse URL assertion with navigation-event timing. Confirmation
occurs inside three seconds of the final successful PATCH response, using each
child order's status while the mock group's own status remains PENDING. The
suite also observes zero polls during thirty real seconds of hidden visibility.
Only the browser visibility properties/event are controlled for that check;
the app, elapsed time and HTTP dependency requests run normally.

The screenshots use two fixture shops with a combined amount of 350,000 VND.
The deterministic QR-shaped image tests image loading and layout; it is not a
live bank-transfer QR. See the [simulation context](../../../postman/simulations/payment.context.yaml)
for the tested behavior and integration limits.
