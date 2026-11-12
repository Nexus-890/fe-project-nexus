import assert from "node:assert/strict";
import test from "node:test";
import { getCheckoutDestination, getCheckoutFieldErrors, previewMatchesCart, validateCheckoutAddress } from "../features/checkoutSchema";
import type { CheckoutAddress, CheckoutPreview } from "../types/checkoutType";
import type { CartItem } from "../types/cartResponseType";

const address: CheckoutAddress = {
  recipientName: " Buyer ", phoneNumber: "+84 912 345 678", addressLine: " 10 Main Street ",
  provinceCode: "202", wardCode: "00123",
};
test("checkout validates every required field, trims text and preserves locality codes including leading zeroes", () => {
  const blank = Object.fromEntries(Object.keys(address).map((key) => [key, " "])) as CheckoutAddress;
  assert.deepEqual(Object.keys(validateCheckoutAddress(blank)), Object.keys(address));
  assert.ok(validateCheckoutAddress({ ...address, phoneNumber: "abc123" }).phoneNumber);
  assert.ok(validateCheckoutAddress({ ...address, phoneNumber: "+------" }).phoneNumber);
  assert.ok(validateCheckoutAddress({ ...address, phoneNumber: "1------" }).phoneNumber);
  assert.deepEqual(validateCheckoutAddress({ ...address, recipientName: "N".repeat(150), addressLine: "A".repeat(500) }), {});
  assert.ok(validateCheckoutAddress({ ...address, recipientName: "N".repeat(151) }).recipientName);
  assert.ok(validateCheckoutAddress({ ...address, addressLine: "A".repeat(501) }).addressLine);
  const destination = getCheckoutDestination(address,
    [{ code: "202", name: "City" }], [{ code: "00123", name: "Ward" }]);
  assert.equal(destination?.recipientName, "Buyer");
  assert.equal(destination?.addressLine, "10 Main Street");
  assert.equal(destination?.wardCode, "00123");
  assert.equal(destination?.ward, "Ward");
  assert.equal(getCheckoutDestination(address, [{ code: "201", name: "Other province" }], []), null);
});

test("checkout maps Problem Details fields by code and known paths, leaving unknown fields at form level", () => {
  const error = { kind: "http" as const, status: 400, code: "VALIDATION_FAILED", title: "Invalid address",
    errors: [
      { field: "shippingAddress.phoneNumber", code: "VALIDATION_PATTERN", detail: "Use a local phone number" },
      { field: "shippingAddress.ward", code: "VALIDATION_REQUIRED", detail: "Select a ward" },
      { field: "unrecognized", code: "VALIDATION_REQUIRED", detail: "Another validation issue" },
      { field: "__proto__", code: "VALIDATION_REQUIRED", detail: "Untrusted field" },
    ],
  };
  assert.deepEqual(getCheckoutFieldErrors(error), { phoneNumber: "Use a local phone number", wardCode: "Select a ward" });
  assert.deepEqual(getCheckoutFieldErrors({ ...error, code: "UNRECOGNIZED_FUTURE_CODE" }), {});
});

test("a shipping quote must match every snapshot cart line before its total can be rendered", () => {
  const items: CartItem[] = [{ id: "line-1", productId: "product", skuId: "sku", quantity: 2, unitPrice: "150000.00", lineTotal: "300000.00", productName: "Fixture product" }];
  const preview: CheckoutPreview = {
    items: [{ itemId: "line-1", productId: "product", skuId: "sku", quantity: 2, unitPrice: "150000.00", lineTotal: "300000.00" }],
    subtotal: "300000.00", shippingFee: "30000.00", taxAmount: "0.00", discountAmount: "0.00", total: "330000.00", issues: [],
  };
  assert.equal(previewMatchesCart(preview, items), true);
  assert.equal(previewMatchesCart(preview, [{ ...items[0], quantity: 3 }]), false);
  assert.equal(previewMatchesCart(preview, [{ ...items[0], unitPrice: "160000.00" }]), false);
  assert.equal(previewMatchesCart(preview, [{ ...items[0], id: "different-line" }]), false);
  assert.equal(previewMatchesCart(preview, []), false);
});
