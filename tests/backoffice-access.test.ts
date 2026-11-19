import assert from "node:assert/strict";
import test from "node:test";
import { backofficeMenu, canAccessBackofficePath, hasBackofficeAccess, readBackofficeRoles, readBackofficeSubject, resolveAuctionWorkspace, resolvePromotionWorkspace, resolveRoleLanding, sellerAuctionHref } from "../features/backofficeAccess";

const token = (claims: unknown) => `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;

test("back-office access uses the flat JWT roles and never privileges or nested realm roles", () => {
  assert.deepEqual(readBackofficeRoles(token({ roles: ["BUYER"], privileges: ["ORDER.LIST", "ADMIN"], realm_access: { roles: ["ADMIN"] } })), ["BUYER"]);
  assert.equal(hasBackofficeAccess(readBackofficeRoles(token({ roles: ["BUYER"], privileges: ["ORDER.LIST"] }))), false);
  assert.deepEqual(readBackofficeRoles(token({ roles: ["SELLER", "BUYER", "ADMIN", "SELLER", "unknown"] })), ["BUYER", "SELLER", "ADMIN"]);
  for (const value of [null, "", "invalid", token({ roles: "ADMIN" }), token({ privileges: ["ADMIN"] })]) assert.deepEqual(readBackofficeRoles(value), []);
});

test("role menu and direct-route guards agree for seller, admin, support and mixed roles", () => {
  assert.deepEqual(backofficeMenu(["SELLER"]).map((item) => item.label), ["Vouchers", "Products", "Auctions", "Sales", "Bank accounts", "Payout history"]);
  assert.deepEqual(backofficeMenu(["SUPPORT_STAFF"]).map((item) => item.label), ["Users", "Orders", "Payments", "Manual payouts", "Refunds", "Shipments", "Auctions", "Event Logs", "System Health"]);
  assert.ok(backofficeMenu(["ADMIN"]).some((item) => item.href === "/backoffice/stock"));
  assert.equal(canAccessBackofficePath("/backoffice/stock", ["SELLER"]), false);
  assert.equal(canAccessBackofficePath("/backoffice/promotions", ["SELLER"]), false);
  assert.equal(canAccessBackofficePath("/backoffice/promotions", ["ADMIN"]), true);
  assert.equal(canAccessBackofficePath("/backoffice/vouchers", ["SELLER"]), true);
  assert.equal(canAccessBackofficePath("/backoffice/vouchers", ["SUPPORT_STAFF"]), false);
  assert.equal(canAccessBackofficePath("/backoffice/products/new", ["ADMIN"]), false);
  assert.equal(canAccessBackofficePath("/backoffice/products/id?tab=images", ["BUYER", "SELLER"]), true);
  assert.equal(canAccessBackofficePath("/backoffice/stock", ["SELLER", "ADMIN"]), true);
  assert.equal(canAccessBackofficePath("/backoffice/users", ["SUPPORT_STAFF"]), true);
  assert.equal(canAccessBackofficePath("/backoffice/configuration", ["SUPPORT_STAFF"]), false);
  for (const roles of [["SELLER"], ["ADMIN"], ["SUPPORT_STAFF"]] as const)
    for (const pathname of ["/backoffice/auctions", "/backoffice/auctions/92000000-0000-4000-8000-000000000001"])
      assert.equal(canAccessBackofficePath(pathname, roles), true);
  assert.equal(canAccessBackofficePath("/backoffice/auctions-elsewhere", ["ADMIN"]), false);
  assert.equal(canAccessBackofficePath("/backoffice", ["BUYER"]), false);
  assert.equal(canAccessBackofficePath("/backoffice/products-elsewhere", ["SELLER"]), false);
  for (const path of ["/backoffice/auctions", "/backoffice/auctions/new", "/backoffice/auctions/id", "/backoffice/bank-accounts", "/backoffice/payouts"]) {
    assert.equal(canAccessBackofficePath(path, ["SELLER"]), true);
    assert.equal(canAccessBackofficePath(path, ["BUYER"]), false);
  }
  for (const path of ["/backoffice/bank-accounts", "/backoffice/payouts"])
    assert.equal(canAccessBackofficePath(path, ["SUPPORT_STAFF"]), false);
  assert.equal(canAccessBackofficePath("/backoffice/admin-payouts", ["ADMIN"]), true);
  assert.equal(canAccessBackofficePath("/backoffice/admin-payouts", ["SELLER"]), false);
  assert.equal(canAccessBackofficePath("/backoffice/payouts", ["ADMIN"]), true);
  assert.equal(canAccessBackofficePath("/backoffice/payouts?view=seller", ["BUYER"]), false);
  for (const roles of [["ADMIN"], ["SELLER", "ADMIN"]] as const)
    assert.equal(backofficeMenu(roles).filter((item) => item.href === "/backoffice/payouts").length, 1);
  for (const roles of [["ADMIN"], ["SUPPORT_STAFF"], ["SELLER", "SUPPORT_STAFF"]] as const) assert.equal(canAccessBackofficePath("/backoffice/manual-payouts", roles), true);
  for (const roles of [["SELLER"], ["BUYER"], []] as const) assert.equal(canAccessBackofficePath("/backoffice/manual-payouts", roles), false);
  assert.equal(readBackofficeSubject(token({ sub: "68000000-0000-4000-8000-000000000004" })), "68000000-0000-4000-8000-000000000004");
  for (const value of [null, "invalid", token({ sub: 4 })]) assert.equal(readBackofficeSubject(value), null);
});

test("shared auction workspace gives management precedence and one menu entry for every role combination", () => {
  const roles = ["BUYER", "SELLER", "ADMIN", "SUPPORT_STAFF"] as const;
  for (let mask = 0; mask < 16; mask++) {
    const selected = roles.filter((_role, index) => mask & 1 << index);
    const staff = selected.includes("ADMIN") || selected.includes("SUPPORT_STAFF");
    assert.equal(resolveAuctionWorkspace(selected), staff ? "manage" : selected.includes("SELLER") ? "seller" : null);
    assert.equal(resolveAuctionWorkspace([...selected].reverse()), resolveAuctionWorkspace(selected), "claim order cannot change dispatch");
    const menu = backofficeMenu(selected);
    assert.equal(new Set(menu.map((item) => item.href)).size, menu.length, "mixed roles must not repeat menu links");
    assert.equal(menu.filter((item) => item.href === "/backoffice/auctions").length, staff || selected.includes("SELLER") ? 1 : 0);
  }
  assert.equal(resolveAuctionWorkspace(readBackofficeRoles(token({ roles: ["BUYER"], privileges: ["ADMIN", "AUCTION.LIST"] }))), null);
});

test("an explicit seller view preserves mixed-role auction navigation without granting another role", () => {
  const id = "92000000-0000-4000-8000-000000000001";
  for (const roles of [["ADMIN", "SELLER"], ["SUPPORT_STAFF", "SELLER"], ["ADMIN", "SUPPORT_STAFF", "SELLER"]] as const) {
    assert.equal(resolveAuctionWorkspace(roles), "manage");
    assert.equal(resolveAuctionWorkspace(roles, "seller"), "seller");
    for (const reference of [undefined, "new", id]) {
      const expectedPath = `/backoffice/auctions${reference ? `/${reference}` : ""}?view=seller`;
      assert.equal(sellerAuctionHref(roles, reference), expectedPath);
      assert.equal(canAccessBackofficePath(expectedPath, roles), true);
      assert.equal(resolveRoleLanding(expectedPath, roles), expectedPath);
    }
  }
  for (const roles of [["ADMIN"], ["SUPPORT_STAFF"]] as const)
    assert.equal(resolveAuctionWorkspace(roles, "seller"), "manage", "a query parameter cannot add a Seller role");
  assert.equal(resolveAuctionWorkspace(["BUYER"], "seller"), null);
  assert.equal(resolveAuctionWorkspace(["SELLER"], "manage"), "seller", "a query parameter cannot add staff access");
  assert.equal(sellerAuctionHref(["SELLER"], id), `/backoffice/auctions/${id}`);
  assert.equal(sellerAuctionHref(["BUYER", "SELLER"], "new"), "/backoffice/auctions/new");
});

test("managed auction access never grants seller creation without a Seller role", () => {
  for (const roles of [["ADMIN"], ["SUPPORT_STAFF"], ["ADMIN", "SUPPORT_STAFF"], ["BUYER"]] as const) {
    for (const path of ["/backoffice/auctions/new", "/backoffice/auctions/new/?draft=true", "/backoffice/auctions/%6eew"])
      assert.equal(canAccessBackofficePath(path, roles), false);
    assert.equal(resolveRoleLanding("/backoffice/auctions/new", roles), roles.some((role) => role === "BUYER") ? "/" : "/backoffice");
  }
  for (const roles of [["SELLER"], ["ADMIN", "SELLER"], ["SUPPORT_STAFF", "SELLER"]] as const) {
    assert.equal(canAccessBackofficePath("/backoffice/auctions/new", roles), true);
    assert.equal(resolveRoleLanding("/backoffice/auctions/new?demo=3", roles), "/backoffice/auctions/new?demo=3");
  }
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

test("Admin-only audit, moderation and delivery routes reject every role combination without ADMIN", () => {
  const roles = ["BUYER", "SELLER", "ADMIN", "SUPPORT_STAFF"] as const;
  for (let mask = 0; mask < 16; mask++) {
    const selected = roles.filter((_role, index) => mask & 1 << index);
    const allowed = selected.includes("ADMIN");
    const fallback = hasBackofficeAccess(selected) ? "/backoffice" : "/";
    for (const path of ["/backoffice/audit-logs", "/backoffice/seller-applications", "/backoffice/reputations", "/backoffice/rating-disputes", "/backoffice/notification-deliveries"]) {
      assert.equal(canAccessBackofficePath(path, selected), allowed, `${selected.join(",") || "anonymous"}: ${path}`);
      assert.equal(canAccessBackofficePath(`${path}/?view=admin`, selected), allowed);
      assert.equal(backofficeMenu(selected).some((item) => item.href === path), allowed);
      assert.equal(resolveRoleLanding(`${path}?view=admin`, selected), allowed ? `${path}?view=admin` : fallback);
      assert.equal(canAccessBackofficePath(`${path}-elsewhere`, selected), false);
    }
  }
});

test("event logs, legacy event alias and health share Admin/Support direct-route authorization", () => {
  const roles = ["BUYER", "SELLER", "ADMIN", "SUPPORT_STAFF"] as const;
  for (let mask = 0; mask < 16; mask++) {
    const selected = roles.filter((_role, index) => mask & 1 << index);
    const allowed = selected.includes("ADMIN") || selected.includes("SUPPORT_STAFF");
    const fallback = hasBackofficeAccess(selected) ? "/backoffice" : "/";
    for (const path of ["/backoffice/event-logs", "/backoffice/event-log", "/backoffice/health"]) {
      assert.equal(canAccessBackofficePath(path, selected), allowed, `${selected.join(",") || "anonymous"}: ${path}`);
      assert.equal(canAccessBackofficePath(`${path}/?view=admin`, selected), allowed);
      assert.equal(resolveRoleLanding(path, selected), allowed ? path : fallback);
      assert.equal(canAccessBackofficePath(`${path}-elsewhere`, selected), false);
    }
    assert.equal(backofficeMenu(selected).filter((item) => item.href === "/backoffice/event-logs").length, allowed ? 1 : 0);
    assert.equal(backofficeMenu(selected).some((item) => item.href === "/backoffice/event-log"), false, "legacy alias is not a duplicate menu item");
    assert.equal(backofficeMenu(selected).filter((item) => item.href === "/backoffice/health").length, allowed ? 1 : 0);
  }
});

test("a mixed ADMIN and SELLER account can open the seller voucher workspace without granting a role", () => {
  assert.equal(resolvePromotionWorkspace(["ADMIN", "SELLER"]), "admin");
  assert.equal(resolvePromotionWorkspace(["SELLER", "ADMIN"], "seller"), "seller");
  assert.equal(canAccessBackofficePath("/backoffice/vouchers?view=seller", ["ADMIN", "SELLER"]), true);
  assert.equal(resolvePromotionWorkspace(["SELLER"]), "seller");
  assert.equal(resolvePromotionWorkspace(["SELLER"], "admin"), "seller", "a query parameter cannot add the Admin role");
  assert.equal(resolvePromotionWorkspace(["ADMIN"], "seller"), "admin", "a query parameter cannot add the Seller role");
  assert.equal(resolvePromotionWorkspace(["BUYER"], "seller"), null);
  assert.equal(resolvePromotionWorkspace(["SUPPORT_STAFF"]), null);
});
