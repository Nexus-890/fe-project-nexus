import assert from "node:assert/strict";
import { test } from "node:test";
import { createBuyerPreviewState, getBuyerPreviewAmounts, restoreBuyerPreviewState } from "../features/buyerPreviewState";

test("sample checkout preserves exact decimal and large amounts when calculating shipping and voucher", () => {
  const state = createBuyerPreviewState();
  state.items = [
    { ...state.items[0], unitPrice: "99999999999999999.99", quantity: 2 },
    { ...state.items[1], unitPrice: "0.10", quantity: 3 },
  ];
  state.delivery = "standard";
  state.couponApplied = true;
  assert.deepEqual(getBuyerPreviewAmounts(state), {
    subtotal: "200000000000000000.28", shipping: "32000.00", discount: "68000.00",
    total: "199999999999964000.28", quantity: 5,
  });
});

test("sample voucher never discounts more than the subtotal and an empty cart has no shipping or negative total", () => {
  const state = createBuyerPreviewState();
  state.items = [{ ...state.items[1], unitPrice: "0.10", quantity: 3 }];
  state.couponApplied = true;
  assert.deepEqual(getBuyerPreviewAmounts(state), {
    subtotal: "0.30", shipping: "49000.00", discount: "0.30", total: "49000.00", quantity: 3,
  });
  state.items = [];
  assert.deepEqual(getBuyerPreviewAmounts(state), {
    subtotal: "0.00", shipping: "0.00", discount: "0.00", total: "0.00", quantity: 0,
  });
});

test("sample choices survive serialized restoration with quantities, voucher, new address, delivery and payment intact", () => {
  const state = createBuyerPreviewState();
  state.items = state.items.slice(1).map((item) => ({ ...item, quantity: item.id === "preview-shirt" ? 3 : 1 }));
  state.saved = ["preview-shirt"];
  state.coupon = " nexus10 ";
  state.couponApplied = true;
  state.delivery = "standard";
  state.payment = "card";
  state.addresses.push({ id: "sample-test", label: "New sample address", line: "123 Preview Street, Ho Chi Minh City", badge: "Preview" });
  state.selectedAddress = "sample-test";

  const restored = restoreBuyerPreviewState(JSON.parse(JSON.stringify(state)));
  assert.ok(restored);
  assert.equal(restored.items.length, 2);
  assert.equal(restored.items[0].quantity, 3);
  assert.equal(restored.items[0].lineTotal, "897000.00");
  assert.deepEqual(restored.saved, ["preview-shirt"]);
  assert.equal(restored.selectedAddress, "sample-test");
  assert.equal(restored.addresses.at(-1)?.line, "123 Preview Street, Ho Chi Minh City");
  assert.equal(restored.payment, "card");
  assert.equal(restored.delivery, "standard");
  assert.equal(restored.couponApplied, true);
  assert.deepEqual(getBuyerPreviewAmounts(restored), {
    subtotal: "2796000.00", shipping: "32000.00", discount: "68000.00", total: "2760000.00", quantity: 4,
  });
});

test("restoring sample choices ignores injected prices, product identities, names and image URLs", () => {
  const canonical = createBuyerPreviewState();
  const stored = createBuyerPreviewState();
  stored.items[0] = { ...stored.items[0], quantity: 2, productId: "another-real-product", skuId: "another-sku", unitPrice: "0.01", lineTotal: "0.02", productName: "Injected product", imageUrl: "https://untrusted.example/track.png" };
  const restored = restoreBuyerPreviewState(stored);
  assert.ok(restored);
  assert.deepEqual(restored.items[0], { ...canonical.items[0], quantity: 2, lineTotal: "49980000.00" });
  stored.items[0].id = "unknown-item";
  assert.equal(restoreBuyerPreviewState(stored), null);
});

test("sample restore rejects unknown or duplicate IDs and quantities outside the supported cart range", () => {
  const original = createBuyerPreviewState();
  assert.equal(restoreBuyerPreviewState({ ...original, items: [original.items[0], original.items[0]] }), null);
  for (const quantity of [0, -1, 1.5, 1000, NaN, Infinity, "2", null]) {
    assert.equal(restoreBuyerPreviewState({ ...original, items: [{ ...original.items[0], quantity }] }), null);
  }
  assert.equal(restoreBuyerPreviewState({ ...original, items: [{ id: "unknown-item", quantity: 1 }] }), null);
  assert.equal(restoreBuyerPreviewState({ ...original, saved: ["unknown-item"] }), null);
});

test("sample restore rejects invalid selections and addresses instead of using a broken receipt", () => {
  const original = createBuyerPreviewState();
  for (const update of [
    { delivery: "unknown" }, { delivery: ["express"] }, { payment: "cash" }, { payment: ["bank"] },
    { selectedAddress: "missing-address" }, { addresses: [] }, { addresses: [original.addresses[0], original.addresses[0]] },
    { addresses: [{ ...original.addresses[0], line: "" }] }, { coupon: "a".repeat(33) },
    { couponApplied: "true" }, { items: null }, { saved: null },
  ]) assert.equal(restoreBuyerPreviewState({ ...original, ...update }), null);
  assert.equal(restoreBuyerPreviewState(null), null);
  assert.equal(restoreBuyerPreviewState([]), null);
  const rejectedVoucher = restoreBuyerPreviewState({ ...original, coupon: "INVALID", couponApplied: true });
  assert.ok(rejectedVoucher);
  assert.equal(rejectedVoucher.couponApplied, false);
});
