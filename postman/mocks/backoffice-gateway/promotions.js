/* Explicit HTTP simulation for #269 UI checks; not evidence of BE quota/DB behavior. */
exports.createPromotionFixture = ({ ok, problem, list, bodyOf, randomUUID }) => {
  let events = [], vouchers = [], wallet = [], registrations = [], usages = [];
  const reset = () => { events = []; vouchers = []; wallet = []; registrations = []; usages = []; };
  const quote = (buyer, subtotal, codes = []) => {
    let discountAmount = 0, platform = false;
    const shops = new Set();
    const quotes = codes.map((code) => {
      const value = vouchers.find((row) => row.voucher.code === code)?.voucher;
      let reason = !value || value.status !== "ACTIVE" ? "NOT_ELIGIBLE" : !wallet.some((row) => row.customerId === buyer && row.voucher.id === value.id && row.status === "CLAIMED") ? "NOT_CLAIMED" : subtotal < (value.minOrderAmount || 0) ? "MIN_ORDER_NOT_MET" : value.sourceType === "SHOP" ? shops.has(value.ownerSellerId) ? "STACKING" : null : platform ? "STACKING" : null;
      const amount = reason ? 0 : Math.min(subtotal - discountAmount, value.discountType === "FIXED" ? value.discountValue : Math.floor(subtotal * value.discountValue / 100), value.maxDiscountAmount ?? Infinity);
      if (!reason) { discountAmount += amount; if (value.sourceType === "SHOP") shops.add(value.ownerSellerId); else platform = true; }
      return { code, sourceType: value?.sourceType ?? null, applied: !reason, discountAmount: amount, reason, missingAmount: reason === "MIN_ORDER_NOT_MET" ? value.minOrderAmount - subtotal : null };
    });
    return { discountAmount, vouchers: quotes };
  };
  const apply = (order, codes, buyer) => {
    const subtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0), result = quote(buyer, subtotal, codes);
    order.subtotal = subtotal; order.discountAmount = result.discountAmount; order.shippingFee = 10000; order.taxAmount = 0;
    order.totalAmount = subtotal + 10000 - result.discountAmount;
    order.vouchers = result.vouchers.filter((row) => row.applied).map((row) => {
      const value = vouchers.find((v) => v.voucher.code === row.code).voucher;
      const sellerFunded = row.discountAmount * (value.sellerFundingPercent || 0) / 100;
      usages.push({ id: randomUUID(), voucherId: value.id, orderId: order.orderId, status: "RESERVED", eligibleAmount: subtotal, discountAmount: row.discountAmount, sellerFunded, platformFunded: row.discountAmount - sellerFunded, reservedAt: new Date().toISOString(), reservedUntil: new Date(Date.now() + 3600000).toISOString() });
      return { code: row.code, discountAmount: row.discountAmount, sellerFunded, platformFunded: row.discountAmount - sellerFunded };
    });
  };
  const handle = (req, res, url, claims) => {
    const path = url.pathname.replace(/^\/api/, ""), method = req.method, roles = claims?.roles || [];
    const admin = roles.includes("ADMIN"), seller = roles.includes("SELLER"), buyer = roles.includes("BUYER");
    if (!path.startsWith("/v1/promotions/") && !path.startsWith("/v1/vouchers")) return false;
    const done = (fn) => { fn(); return true; };
    if (path === "/v1/vouchers" && method === "GET") return done(() => list(res, vouchers.filter((row) => row.voucher.status === "ACTIVE").map((row) => row.voucher), url));
    if (!claims) return done(() => problem(res, 401, "Sign in first"));
    const data = bodyOf(req), now = new Date().toISOString();
    if (path === "/v1/vouchers/me") return done(() => list(res, wallet.filter((row) => row.customerId === claims.sub && (!url.searchParams.get("status") || row.status === url.searchParams.get("status"))), url));
    if (path === "/v1/vouchers/manage") return done(() => list(res, vouchers.filter(({ voucher: v }) => (admin || v.ownerSellerId === claims.sub || v.sourceType === "EVENT") && (!url.searchParams.get("sourceType") || v.sourceType === url.searchParams.get("sourceType")) && (!url.searchParams.get("status") || v.status === url.searchParams.get("status"))), url));
    if (path === "/v1/vouchers" && method === "POST") {
      if (!(admin || seller && data.sourceType === "SHOP")) return done(() => problem(res, 403, "Role cannot create this source"));
      const value = { voucher: { ...data, id: randomUUID(), ownerSellerId: data.sourceType === "SHOP" ? claims.sub : null, status: "DRAFT", termsVersion: 1, claimCount: 0, committedUses: 0, committedDiscount: 0, createdAt: now, updatedAt: now }, productIds: [] };
      vouchers.push(value); return done(() => ok(res, value, 201));
    }
    const match = /^\/v1\/vouchers\/([^/]+)(.*)$/.exec(path);
    if (match) {
      const value = vouchers.find((row) => row.voucher.id === match[1]); if (!value) return done(() => problem(res, 404, "Voucher not found"));
      const v = value.voucher, suffix = match[2];
      if (suffix === "/claim") {
        if (!buyer) return done(() => problem(res, 403, "Buyer required"));
        if (wallet.some((row) => row.customerId === claims.sub && row.voucher.id === v.id)) return done(() => problem(res, 409, "Voucher already claimed", "COMMERCE_VOUCHER_ALREADY_CLAIMED"));
        const row = { id: randomUUID(), customerId: claims.sub, status: "CLAIMED", claimedAt: now, expiresAt: v.validUntil, voucher: { ...v } };
        wallet.push(row); v.claimCount++; return done(() => ok(res, row, 201));
      }
      if (suffix.startsWith("/sellers")) {
        const registration = registrations.find((r) => r.eventId === v.eventId && r.sellerId === claims.sub && r.status === "APPROVED");
        if (!seller || !registration) return done(() => problem(res, 403, "Approved registration required"));
        if (method === "DELETE") return done(() => ok(res, null, 204));
        if (data.acceptedTermsVersion !== v.termsVersion) return done(() => problem(res, 409, "Terms changed", "COMMERCE_VOUCHER_TERMS_CHANGED"));
        return done(() => ok(res, { id: randomUUID(), voucherId: v.id, eventSellerId: registration.id, status: "ACTIVE", acceptedTermsVersion: v.termsVersion, acceptedTermsSnapshot: v.termsText, sellerFundingPercentSnapshot: v.sellerFundingPercent, acceptedAt: now }, 201));
      }
      if (!admin && v.ownerSellerId !== claims.sub) return done(() => problem(res, 403, "Voucher owner required"));
      if (suffix === "/usages") return done(() => list(res, usages.filter((row) => row.voucherId === v.id), url));
      if (suffix === "/status") v.status = data.status;
      else if (suffix === "/products") value.productIds = data.productIds;
      else if (method === "PUT") Object.assign(v, data, { updatedAt: now });
      return done(() => ok(res, value));
    }
    if (path === "/v1/promotions/events" && method === "GET") return done(() => list(res, events.filter((e) => !url.searchParams.get("status") || e.status === url.searchParams.get("status")), url));
    if (path === "/v1/promotions/events" && method === "POST" && admin) { const row = { ...data, id: randomUUID(), status: "DRAFT", registrationOpenRequested: false, createdAt: now, updatedAt: now }; events.push(row); return done(() => ok(res, row, 201)); }
    const review = /^\/v1\/promotions\/event-sellers\/([^/]+)$/.exec(path);
    if (review && admin) { const row = registrations.find((r) => r.id === review[1]); Object.assign(row, data, { reviewedBy: claims.sub, reviewedAt: now }); return done(() => ok(res, row)); }
    const eventMatch = /^\/v1\/promotions\/events\/([^/]+)(.*)$/.exec(path);
    if (eventMatch) {
      const row = events.find((e) => e.id === eventMatch[1]); if (!row) return done(() => problem(res, 404, "Event not found"));
      const suffix = eventMatch[2];
      if (suffix === "/registrations" && seller) { const registration = { id: randomUUID(), eventId: row.id, sellerId: claims.sub, status: "PENDING", registeredAt: now }; registrations.push(registration); return done(() => ok(res, registration, 201)); }
      if (suffix === "/registrations/me" && method === "DELETE" && seller) return done(() => ok(res, null, 204));
      if (!admin) return done(() => problem(res, 403, "Admin required"));
      if (suffix === "/sellers") return done(() => list(res, registrations.filter((r) => r.eventId === row.id), url));
      if (suffix === "/status") { row.status = data.status === "OPEN" ? "REGISTRATION_OPEN" : "CANCELED"; row.registrationOpenRequested = data.status === "OPEN"; }
      else if (method === "PUT") Object.assign(row, data, { updatedAt: now });
      return done(() => ok(res, row));
    }
    return done(() => problem(res, 403, "Promotion role required"));
  };
  return { reset, quote, apply, handle };
};
