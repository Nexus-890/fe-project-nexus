import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getCartQuantity,
  getCartSubtotal,
  multiplyCartMoney,
} from "../features/cartUtils";
import type { CartItem } from "../types/cartResponseType";

const item = (unitPrice: string, quantity: number): CartItem => ({
  id: "line", productId: "product", skuId: "sku", unitPrice, quantity,
});

test("cart totals use the snapshot unit price and update immediately with quantity", () => {
  const items = [item("150000.00", 2)];
  assert.equal(getCartSubtotal(items), "300000.00");
  assert.equal(getCartSubtotal([{ ...items[0], quantity: 3 }]), "450000.00");
  assert.equal(getCartQuantity(items), 2);
  assert.equal(getCartQuantity([{ ...items[0], quantity: 3 }]), 3);
  assert.equal(multiplyCartMoney("150000.00", 2), "300000.00");
});

test("decimal totals stay exact across cents, numeric(19,2) values and large quantities", () => {
  assert.equal(multiplyCartMoney("0.10", 3), "0.30");
  assert.equal(getCartSubtotal([item("0.1", 3), item("0.2", 2)]), "0.70");
  assert.equal(multiplyCartMoney("99999999999999999.99", 2), "199999999999999999.98");
  assert.equal(multiplyCartMoney("0.01", Number.MAX_SAFE_INTEGER), "90071992547409.91");
  assert.equal(multiplyCartMoney("12", 0), "0.00");
});

test("empty cart totals and counts are zero", () => {
  assert.equal(getCartSubtotal([]), "0.00");
  assert.equal(getCartQuantity([]), 0);
});

test("invalid money and unsafe quantities fail instead of silently rounding totals", () => {
  for (const value of ["-1", "1.234", "NaN", "Infinity", "1e2", "", ".5"])
    assert.throws(() => multiplyCartMoney(value, 1), RangeError);
  for (const quantity of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => multiplyCartMoney("1.00", quantity), RangeError);
    assert.throws(() => getCartQuantity([item("1.00", quantity)]), RangeError);
  }
  assert.throws(
    () => getCartQuantity([item("1", Number.MAX_SAFE_INTEGER), item("1", 1)]),
    RangeError,
  );
});
