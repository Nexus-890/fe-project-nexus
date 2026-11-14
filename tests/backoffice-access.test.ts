import assert from "node:assert/strict";
import test from "node:test";
import { backofficeMenu, canAccessBackofficePath, hasBackofficeAccess, readBackofficeRoles, resolveRoleLanding } from "../features/backofficeAccess";

const token = (claims: unknown) => `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;

test("back-office access uses the flat JWT roles and never privileges or nested realm roles", () => {
  assert.deepEqual(readBackofficeRoles(token({ roles: ["BUYER"], privileges: ["ORDER.LIST", "ADMIN"], realm_access: { roles: ["ADMIN"] } })), ["BUYER"]);
  assert.equal(hasBackofficeAccess(readBackofficeRoles(token({ roles: ["BUYER"], privileges: ["ORDER.LIST"] }))), false);
  assert.deepEqual(readBackofficeRoles(token({ roles: ["SELLER", "BUYER", "ADMIN", "SELLER", "unknown"] })), ["BUYER", "SELLER", "ADMIN"]);
  for (const value of [null, "", "invalid", token({ roles: "ADMIN" }), token({ privileges: ["ADMIN"] })]) assert.deepEqual(readBackofficeRoles(value), []);
});

test("role menu and direct-route guards agree for seller, admin, support and mixed roles", () => {
  assert.deepEqual(backofficeMenu(["SELLER"]).map((item) => item.label), ["Products", "Auctions", "Sales", "Bank accounts", "Payout history"]);
  assert.deepEqual(backofficeMenu(["SUPPORT_STAFF"]).map((item) => item.label), ["Users", "Orders", "Event log", "Health"]);
  assert.ok(backofficeMenu(["ADMIN"]).some((item) => item.href === "/backoffice/stock"));
  assert.equal(canAccessBackofficePath("/backoffice/stock", ["SELLER"]), false);
  assert.equal(canAccessBackofficePath("/backoffice/products/new", ["ADMIN"]), false);
  assert.equal(canAccessBackofficePath("/backoffice/products/id?tab=images", ["BUYER", "SELLER"]), true);
  assert.equal(canAccessBackofficePath("/backoffice/stock", ["SELLER", "ADMIN"]), true);
  assert.equal(canAccessBackofficePath("/backoffice/users", ["SUPPORT_STAFF"]), true);
  assert.equal(canAccessBackofficePath("/backoffice/configuration", ["SUPPORT_STAFF"]), false);
  assert.equal(canAccessBackofficePath("/backoffice", ["BUYER"]), false);
  assert.equal(canAccessBackofficePath("/backoffice/products-elsewhere", ["SELLER"]), false);
  for (const path of ["/backoffice/auctions", "/backoffice/auctions/new", "/backoffice/auctions/id", "/backoffice/bank-accounts", "/backoffice/payouts"]) {
    assert.equal(canAccessBackofficePath(path, ["SELLER"]), true);
    assert.equal(canAccessBackofficePath(path, ["BUYER"]), false);
    assert.equal(canAccessBackofficePath(path, ["SUPPORT_STAFF"]), false);
  }
  assert.equal(canAccessBackofficePath("/backoffice/admin-payouts", ["ADMIN"]), true);
  assert.equal(canAccessBackofficePath("/backoffice/admin-payouts", ["SELLER"]), false);
});

test("role landing preserves allowed return destinations and replaces forbidden ones", () => {
  for (const roles of [["SELLER"], ["ADMIN"], ["SUPPORT_STAFF"], ["BUYER", "SELLER"]] as const) assert.equal(resolveRoleLanding(undefined, roles), "/backoffice");
  assert.equal(resolveRoleLanding(undefined, ["BUYER"]), "/");
  assert.equal(resolveRoleLanding("/", ["SELLER"]), "/", "an explicitly requested shop home remains a shop destination");
  assert.equal(resolveRoleLanding("/backoffice/products/id?tab=images", ["SELLER"]), "/backoffice/products/id?tab=images");
  assert.equal(resolveRoleLanding("/backoffice/stock", ["SELLER"]), "/backoffice");
  assert.equal(resolveRoleLanding("/backoffice/products", ["BUYER"]), "/");
  assert.equal(resolveRoleLanding("/orders?status=PAID", ["BUYER", "SELLER"]), "/orders?status=PAID");
  assert.equal(resolveRoleLanding("/orders", ["SELLER"]), "/backoffice");
  assert.equal(resolveRoleLanding("https://outside.example", ["BUYER"]), "/");
});
