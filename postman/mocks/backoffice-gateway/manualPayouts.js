/* Explicit local simulation of the proposed #272 manual payout contract for #271.
 * No money moves and the PNG is a fixture pattern, not a scannable bank QR.
 * Production never imports this handler.
 */
const zlib = require("node:zlib");

function createManualPayoutFixture({ ok, problem, list, bodyOf, randomUUID, seller, payouts, getBankAccounts = () => [], verifyBank = () => {} }) {
  const system = "00000000-0000-0000-0000-000000000000";
  const base = "/v1/payments/manual-payouts";
  const banks = { "970436": "Vietcombank", "970415": "VietinBank", "970418": "BIDV" };
  const sources = [{ id: "9a000000-0000-4000-8000-000000000001", alias: "Nexus payout account VCB 8899" }];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const evidenceTypes = ["image/jpeg", "image/png", "application/pdf"];
  let requests, keys, transactions, config, offset, counter, files;
  const now = () => Date.now() + offset;
  const stamp = () => new Date(now() + counter++).toISOString();
  const minor = (value) => BigInt(value.replace(".", ""));
  const decimal = (value) => `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
  const respond = (res, data, status = 200) => { ok(res, data, status); return true; };
  const reject = (res, status, detail, code) => { problem(res, status, detail, code); return true; };
  const latest = (row) => row.manual.attempts.at(-1) || null;
  const openDispute = (row) => row.manual.dispute && row.manual.dispute.status !== "RESOLVED" ? row.manual.dispute : null;
  const verifiedBank = (sellerId) => getBankAccounts().find((bank) => bank.sellerId === sellerId && bank.active && bank.isDefault && bank.verificationStatus === "VERIFIED");
  const recipientOf = (bank) => bank ? { bankName: banks[bank.bankCode] || `Bank ${bank.bankCode}`, holderName: bank.accountHolderName, accountLast4: bank.accountLast4, bankId: bank.id, bankVersion: bank.version } : null;
  const blockedReason = (row, bank) => !bank ? "The seller has no verified default bank account." : minor(row.netAmount) % 100n ? "The net amount is not a whole VND amount and cannot be paid manually." : null;

  function reset() { requests = []; keys = new Map(); transactions = []; config = { newWorkEnabled: true, leaseSeconds: 300, qrSeconds: 600 }; offset = 0; counter = 0; files = new Map(); }

  function log(row, event, fromStatus, actor, extra = {}) {
    const attempt = latest(row);
    row.manual.history.push({ id: randomUUID(), event, fromStatus, toStatus: row.status, attemptNo: attempt?.attemptNo ?? 0, attemptState: attempt?.state ?? null, amount: row.netAmount,
      actorId: actor.id, actorRole: actor.role, confirmationSource: null, reference: attempt?.reference ?? null, reason: null, simulated: true, occurredAt: stamp(), ...extra });
    const sellerEvents = { CREATED: "CREATED", HELD: "HELD", RELEASED: "RELEASED", CLAIMED: "CLAIMED", CLAIM_RELEASED: "CLAIM_RELEASED", QR_ISSUED: "QR_ISSUED", STAFF_CONFIRMED: "STAFF_CONFIRMED",
      PROBLEM_REPORTED: "PROBLEM_REPORTED", EXPIRED: "TIMED_OUT", BANK_CHANGED: "TIMED_OUT", RESOLVED_SENT: "RECONCILED", RESOLVED_NOT_SENT: "FAILED", RESOLVED_RETURNED: "RETURNED",
      CONFIRMATION_CORRECTED: "CONFIRMATION_CORRECTED", RETRIED: "RETRIED", RECEIPT_CONFIRMED: "RECEIPT_CONFIRMED", RECEIPT_DISPUTED: "RECEIPT_DISPUTED", DISPUTE_REVIEWED: "DISPUTE_REVIEWED", DISPUTE_RESOLVED: "DISPUTE_REVIEWED" };
    if (sellerEvents[event]) row.history.push({ id: randomUUID(), event: sellerEvents[event], fromStatus, toStatus: row.status, attemptNo: attempt?.attemptNo ?? 0, amount: row.netAmount,
      sellerBankId: row.sellerBankId, recipientAccountLast4: row.manual.recipient?.accountLast4 ?? null, provider: null, providerReference: row.providerReference, providerStatus: null,
      errorCode: null, errorMessage: null, simulated: true, actorId: actor.id, occurredAt: row.manual.history.at(-1).occurredAt });
  }

  function seed(body) {
    const sellerId = body.sellerId || seller;
    if (body.bankVerified) verifyBank(sellerId);
    const bank = verifiedBank(sellerId);
    const orderAmount = body.orderAmount || "100000.00", shippingFee = body.shippingFee || "5000.00";
    const net = minor(orderAmount) - minor(shippingFee);
    const row = { id: randomUUID(), orderId: body.orderId || randomUUID(), sellerId, orderAmount, shippingFee, platformFeeRate: "0.0000", platformFee: "0.00", netAmount: decimal(net),
      currency: "VND", status: "PENDING", attemptCount: 0, recipientAccountLast4: null, providerReference: null, createdAt: body.createdAt || stamp(), sellerBankId: bank?.id ?? null,
      executionMode: "MANUAL", confirmationSource: null, version: 0, history: [], manual: { recipient: recipientOf(bank), attempts: [], dispute: null, exception: null, history: [], blockedReason: null } };
    row.manual.blockedReason = blockedReason(row, bank);
    log(row, "CREATED", null, { id: system, role: "SYSTEM" });
    if (row.manual.blockedReason) { row.status = "ON_HOLD"; row.manual.recipient = null; log(row, "HELD", "PENDING", { id: system, role: "SYSTEM" }, { reason: row.manual.blockedReason }); }
    payouts.rows().push(row);
    return row;
  }

  function settleClock(row) {
    const attempt = latest(row);
    if (!attempt) return;
    if (attempt.state === "CLAIMED" && Date.parse(attempt.leaseExpiresAt) < now()) {
      attempt.state = "NOT_SENT"; attempt.version++; row.status = "PENDING"; row.version++;
      log(row, "CLAIM_RELEASED", "PROCESSING", { id: system, role: "SYSTEM" }, { reason: "The claim lease expired before any QR was issued." });
    }
    if (attempt.state === "QR_ISSUED" && Date.parse(attempt.qrDeadline) < now()) {
      attempt.state = "UNKNOWN"; attempt.version++; row.status = "UNKNOWN"; row.version++;
      log(row, "EXPIRED", "PROCESSING", { id: system, role: "SYSTEM" }, { reason: "The QR deadline passed. A saved QR may still work in a banking app, so reconciliation is required." });
    }
  }

  function actions(row, actor) {
    if (!actor.staff || row.executionMode !== "MANUAL" || row.sellerId === actor.id) return [];
    const attempt = latest(row), mine = attempt?.ownerId === actor.id, result = [];
    if (row.status === "ON_HOLD") result.push("READINESS_CHECK");
    if (row.status === "PENDING" && config.newWorkEnabled) result.push("CLAIM");
    if (attempt && mine && attempt.state === "CLAIMED") { if (config.newWorkEnabled) result.push("ISSUE_QR"); result.push("RELEASE"); }
    if (attempt && mine && attempt.state === "QR_ISSUED") { result.push("VIEW_QR"); if (attempt.evidence.length < 3) result.push("UPLOAD_EVIDENCE"); result.push("CONFIRM", "REPORT_PROBLEM"); }
    if (attempt && mine && attempt.state === "SUCCEEDED" && !row.manual.exception) result.push("REPORT_PROBLEM");
    if (actor.admin) {
      const resolvable = attempt && (attempt.state === "UNKNOWN" || attempt.state === "SUCCEEDED" && (row.manual.exception || openDispute(row)));
      if (resolvable) { result.push("RESOLVE"); if (!result.includes("UPLOAD_EVIDENCE") && attempt.evidence.length < 3) result.push("UPLOAD_EVIDENCE"); }
      if (openDispute(row)) result.push("REVIEW_DISPUTE");
      if (["FAILED", "RETURNED"].includes(row.status)) result.push("RETRY");
    }
    return result;
  }

  function summary(row, actor) {
    const attempt = latest(row), active = attempt && ["CLAIMED", "QR_ISSUED", "UNKNOWN"].includes(attempt.state) ? attempt : null;
    return { id: row.id, orderId: row.orderId, sellerId: row.sellerId, status: row.status, executionMode: row.executionMode, netAmount: row.netAmount, currency: "VND", version: row.version,
      claimedBy: active?.ownerId ?? null, claimedByMe: active?.ownerId === actor.id, receiptStatus: attempt?.receiptStatus ?? null, hasOpenDispute: !!openDispute(row),
      needsReview: row.status === "UNKNOWN" || !!row.manual.exception || !!openDispute(row), blockedReason: row.status === "ON_HOLD" ? row.manual.blockedReason : null, createdAt: row.createdAt };
  }

  function detail(row, actor) {
    const attempt = latest(row);
    const { bankId, bankVersion, ...recipient } = row.manual.recipient || {};
    return { ...summary(row, actor), orderAmount: row.orderAmount, shippingFee: row.shippingFee, platformFeeRate: row.platformFeeRate, platformFee: row.platformFee,
      confirmationSource: row.confirmationSource, recipient: row.manual.recipient ? recipient : null, serverTime: new Date(now()).toISOString(),
      attempt: attempt && { id: attempt.id, attemptNo: attempt.attemptNo, state: attempt.state, version: attempt.version, ownerId: attempt.ownerId, ownedByMe: attempt.ownerId === actor.id,
        reference: attempt.reference, leaseExpiresAt: attempt.leaseExpiresAt, qrDeadline: attempt.qrDeadline, receiptStatus: attempt.receiptStatus, receiptVersion: attempt.receiptVersion,
        evidence: attempt.evidence.map(({ uploader, ...file }) => file), confirmation: attempt.confirmation },
      dispute: row.manual.dispute && { ...row.manual.dispute }, allowedActions: actions(row, actor), history: [...row.manual.history].reverse() };
  }

  function sellerAttempt(row) {
    if (row.executionMode !== "MANUAL") return null;
    const attempt = latest(row);
    if (!attempt) return null;
    const staffConfirmed = attempt.state === "SUCCEEDED" && attempt.confirmation, dispute = row.manual.dispute;
    const allowed = staffConfirmed ? [...(["AWAITING_CONFIRMATION", "DISPUTED"].includes(attempt.receiptStatus) ? ["CONFIRM_RECEIPT"] : []), ...(openDispute(row) ? [] : ["DISPUTE_RECEIPT"])] : [];
    return { attemptId: attempt.id, attemptNo: attempt.attemptNo, state: attempt.state, receiptStatus: attempt.receiptStatus, receiptVersion: attempt.receiptVersion,
      staffConfirmedAt: attempt.confirmation?.recordedAt ?? null, sellerConfirmedAt: attempt.sellerConfirmedAt ?? null,
      dispute: dispute && { id: dispute.id, status: dispute.status, reason: dispute.reason, explanation: dispute.explanation, version: dispute.version, openedAt: dispute.openedAt }, allowedSellerActions: allowed };
  }

  function png(seedText) {
    const size = 33, raw = Buffer.alloc((size * 3 + 1) * size);
    let hash = 0; for (const char of seedText) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const finder = [[0, 0], [size - 7, 0], [0, size - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7 && (x === fx || x === fx + 6 || y === fy || y === fy + 6 || x >= fx + 2 && x <= fx + 4 && y >= fy + 2 && y <= fy + 4));
      hash = (hash * 1103515245 + 12345) >>> 0;
      const dark = finder || (hash >>> 16) % 2 === 0, offset = y * (size * 3 + 1) + 1 + x * 3;
      raw[offset] = raw[offset + 1] = raw[offset + 2] = dark ? 0 : 255;
    }
    const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    const crc = (buffer) => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const chunk = (type, data) => { const length = Buffer.alloc(4), sum = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type), data]); length.writeUInt32BE(data.length); sum.writeUInt32BE(crc(body)); return Buffer.concat([length, body, sum]); };
    const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  }
  const binary = (res, type, data) => { res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store, private", "Content-Disposition": "inline" }); res.end(data); return true; };

  function multipart(req) {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("latin1") : typeof req.body === "string" ? req.body : "";
    const contentType = String(req.headers["content-type"] || "");
    const boundary = /boundary=([^;]+)/.exec(contentType)?.[1];
    if (!contentType.startsWith("multipart/form-data") || !boundary) return null;
    const fields = {};
    let file = null;
    for (const part of raw.split(`--${boundary}`)) {
      const name = /name="([^"]+)"/.exec(part)?.[1];
      if (!name) continue;
      const split = part.indexOf("\r\n\r\n"), content = part.slice(split + 4).replace(/\r\n$/, "");
      const fileName = /filename="([^"]*)"/.exec(part)?.[1];
      if (fileName !== undefined) file = { fileName, contentType: (/Content-Type: ([^\r\n]+)/i.exec(part)?.[1] || "").trim().toLowerCase(), size: Buffer.byteLength(content, "latin1"), head: content.slice(0, 8) };
      else fields[name] = content;
    }
    return { fields, file };
  }
  const signatureMatches = (file) => file.contentType === "application/pdf" ? file.head.startsWith("%PDF") : file.contentType === "image/png" ? /^.{1,3}PNG/s.test(file.head) : /^[ÿ�]/.test(file.head);

  function idempotent(req, res, actor, operation, resource, payload) {
    const key = req.headers["idempotency-key"];
    if (typeof key !== "string" || !uuid.test(key)) { reject(res, 400, "A UUID Idempotency-Key is required", "PAYMENT_MANUAL_PAYOUT_IDEMPOTENCY_KEY_REQUIRED"); return { done: true }; }
    const previous = keys.get(key.toLowerCase()), canonical = JSON.stringify(payload);
    if (previous) {
      if (previous.actor === actor.id && previous.operation === operation && previous.resource === resource && previous.payload === canonical) return { replay: true };
      reject(res, 409, "This idempotency key belongs to another request", "PAYMENT_MANUAL_PAYOUT_IDEMPOTENCY_CONFLICT"); return { done: true };
    }
    return { commit: () => keys.set(key.toLowerCase(), { actor: actor.id, operation, resource, payload: canonical }) };
  }

  function handle(req, res, url, claims) {
    const route = url.pathname.replace(/^\/api/, "");
    if (route === "/test/manual-payouts/evidence" && req.method === "GET") return respond(res, { requests, transactions, payouts: payouts.rows().filter((row) => row.executionMode === "MANUAL").map((row) => detail(row, { id: system, staff: true, admin: true })), simulated: true });
    if (route === "/test/manual-payouts/seed" && req.method === "POST") { const body = bodyOf(req); const rows = Array.from({ length: body.count || 1 }, () => seed(body)); return respond(res, rows.map((row) => ({ id: row.id, orderId: row.orderId, sellerId: row.sellerId }))); }
    if (route === "/test/manual-payouts/config" && req.method === "POST") { Object.assign(config, bodyOf(req)); return respond(res, config); }
    if (route === "/test/manual-payouts/clock" && req.method === "POST") { offset += Number(bodyOf(req).advanceSeconds || 0) * 1000; return respond(res, { serverTime: new Date(now()).toISOString() }); }
    if (route === "/test/manual-payouts/bank-change" && req.method === "POST") {
      const row = payouts.rows().find((entry) => entry.id === bodyOf(req).payoutId), attempt = row && latest(row);
      if (!row) return reject(res, 404, "Payout missing", "PAYMENT_MANUAL_PAYOUT_NOT_FOUND");
      if (attempt?.state === "QR_ISSUED") { attempt.state = "UNKNOWN"; attempt.version++; row.status = "UNKNOWN"; row.version++; log(row, "BANK_CHANGED", "PROCESSING", { id: system, role: "SYSTEM" }, { reason: "The seller bank account changed after the QR was issued." }); }
      return respond(res, { status: row.status });
    }
    const sellerRoute = /^\/v1\/payments\/payouts\/([^/]+)\/manual-attempts\/([^/]+)\/(receipt-confirmations|receipt-disputes)$/.exec(route);
    if (!route.startsWith(base) && !sellerRoute) return false;
    const roles = claims?.roles || [];
    const actor = { id: claims?.sub, admin: roles.includes("ADMIN"), staff: roles.includes("ADMIN") || roles.includes("SUPPORT_STAFF"), seller: roles.includes("SELLER") };
    actor.role = actor.admin ? "ADMIN" : "SUPPORT_STAFF";
    const isMultipart = String(req.headers["content-type"] || "").startsWith("multipart/form-data");
    const body = req.method === "POST" && !isMultipart ? bodyOf(req) : {};
    requests.push({ method: req.method, path: route, actor: claims?.sub || null, roles, query: Object.fromEntries([...new Set(url.searchParams.keys())].map((key) => [key, url.searchParams.getAll(key).length > 1 ? url.searchParams.getAll(key) : url.searchParams.get(key)])),
      idempotencyKey: req.headers["idempotency-key"] || null, ...(req.method === "POST" && !isMultipart ? { body } : {}) });
    if (!claims) return reject(res, 401, "Sign in first", "PAYMENT_MANUAL_PAYOUT_UNAUTHENTICATED");

    if (sellerRoute) {
      const row = payouts.rows().find((entry) => entry.id === sellerRoute[1] && entry.executionMode === "MANUAL");
      if (!actor.seller || !row || row.sellerId !== actor.id) return reject(res, 404, "Payout not found", "PAYMENT_MANUAL_PAYOUT_NOT_FOUND");
      const attempt = row.manual.attempts.find((entry) => entry.id === sellerRoute[2]);
      if (!attempt) return reject(res, 404, "Attempt not found", "PAYMENT_MANUAL_PAYOUT_NOT_FOUND");
      const confirming = sellerRoute[3] === "receipt-confirmations";
      const gate = idempotent(req, res, actor, sellerRoute[3], attempt.id, body);
      if (gate.done) return true;
      if (gate.replay) return respond(res, payouts.snapshot(row));
      if (!Number.isSafeInteger(body.expectedReceiptVersion) || body.expectedReceiptVersion < 0) return reject(res, 400, "expectedReceiptVersion is required", "PAYMENT_MANUAL_PAYOUT_VERSION_REQUIRED");
      if (attempt !== latest(row) || attempt.state !== "SUCCEEDED" || !attempt.confirmation) return reject(res, 409, "This attempt was corrected or superseded", "PAYMENT_MANUAL_PAYOUT_ATTEMPT_SUPERSEDED");
      if (body.expectedReceiptVersion !== attempt.receiptVersion) return reject(res, 409, "The receipt changed. Review the latest state.", "PAYMENT_MANUAL_PAYOUT_VERSION_CONFLICT");
      if (confirming) {
        if (!["AWAITING_CONFIRMATION", "DISPUTED"].includes(attempt.receiptStatus)) return reject(res, 409, "Receipt is already confirmed", "PAYMENT_MANUAL_PAYOUT_STATE_CONFLICT");
        attempt.receiptStatus = "CONFIRMED"; attempt.sellerConfirmedAt = stamp(); attempt.receiptVersion++;
        const dispute = openDispute(row); if (dispute) { dispute.status = "RESOLVED"; dispute.version++; }
        log(row, "RECEIPT_CONFIRMED", row.status, { id: actor.id, role: "SELLER" });
      } else {
        const explanation = typeof body.explanation === "string" ? body.explanation.trim() : "";
        if (!["NOT_RECEIVED", "INCORRECT_AMOUNT", "CONFIRMATION_MISTAKE"].includes(body.reason) || explanation.length < 1 || explanation.length > 1000) return reject(res, 400, "Choose a reason and explain it", "PAYMENT_MANUAL_PAYOUT_INVALID_DISPUTE");
        if (!openDispute(row)) {
          row.manual.dispute = { id: randomUUID(), status: "OPEN", reason: body.reason, explanation, version: 0, openedAt: stamp() };
          attempt.receiptStatus = "DISPUTED"; attempt.receiptVersion++; row.version++;
          log(row, "RECEIPT_DISPUTED", row.status, { id: actor.id, role: "SELLER" }, { reason: `${body.reason}: ${explanation}` });
        }
      }
      gate.commit();
      return respond(res, payouts.snapshot(row), confirming ? 200 : 201);
    }

    if (!actor.staff) return reject(res, 403, "Administrator or support staff role required", "PAYMENT_MANUAL_PAYOUT_FORBIDDEN");
    if (route === `${base}/capabilities` && req.method === "GET")
      return respond(res, { canExecute: true, canReconcile: actor.admin, newWorkEnabled: config.newWorkEnabled, automaticJobsEnabled: false, serverTime: new Date(now()).toISOString(),
        claimLeaseSeconds: config.leaseSeconds, qrIssuanceSeconds: config.qrSeconds, sourceAccounts: sources });
    if (route === base && req.method === "GET") {
      const statuses = url.searchParams.getAll("status"), sellerId = url.searchParams.get("sellerId"), from = url.searchParams.get("from"), to = url.searchParams.get("to");
      const rows = payouts.rows().filter((row) => row.executionMode === "MANUAL");
      rows.forEach(settleClock);
      const views = rows.map((row) => summary(row, actor)).filter((row) => (!statuses.length || statuses.includes(row.status)) && (!sellerId || row.sellerId === sellerId) &&
        (url.searchParams.get("claimedBy") !== "me" || row.claimedByMe) && (!url.searchParams.get("receiptStatus") || row.receiptStatus === url.searchParams.get("receiptStatus")) &&
        (url.searchParams.get("hasOpenDispute") !== "true" || row.hasOpenDispute) && (url.searchParams.get("needsReview") !== "true" || row.needsReview) &&
        (!from || Date.parse(row.createdAt) >= Date.parse(from)) && (!to || Date.parse(row.createdAt) <= Date.parse(to)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      if (!url.searchParams.get("size")) url.searchParams.set("size", "20");
      list(res, views, url); return true;
    }
    const match = /^\/v1\/payments\/manual-payouts\/([^/]+)(?:\/(readiness-check|claims|retries)|\/attempts\/([^/]+)\/(qr-issuances|qr|release|evidence|confirmation|problems|resolution)(?:\/([^/]+))?|\/attempts\/([^/]+)\/receipt-disputes\/([^/]+)\/reviews)?$/.exec(route);
    const row = match && payouts.rows().find((entry) => entry.id === match[1] && entry.executionMode === "MANUAL");
    if (!row) return reject(res, 404, "Manual payout not found", "PAYMENT_MANUAL_PAYOUT_NOT_FOUND");
    settleClock(row);
    const payoutCommand = match[2], attemptId = match[3] || match[6], attemptCommand = match[4] || (match[7] ? "reviews" : null), trailing = match[5] || match[7];
    if (!payoutCommand && !attemptCommand && req.method === "GET") return respond(res, detail(row, actor));
    const attempt = attemptId ? row.manual.attempts.find((entry) => entry.id === attemptId) : null;
    if (attemptId && !attempt) return reject(res, 404, "Attempt not found for this payout", "PAYMENT_MANUAL_PAYOUT_NOT_FOUND");
    const owner = attempt && attempt.ownerId === actor.id;

    if (attemptCommand === "qr" && req.method === "GET") {
      if (!owner) return reject(res, 409, "Only the owning executor can read this QR", "PAYMENT_MANUAL_PAYOUT_NOT_OWNER");
      if (attempt.state !== "QR_ISSUED") return reject(res, 409, "No active QR for this attempt", "PAYMENT_MANUAL_PAYOUT_STATE_CONFLICT");
      return binary(res, "image/png", png(`${attempt.reference}|${row.netAmount}|${row.manual.recipient.accountLast4}`));
    }
    if (attemptCommand === "evidence" && trailing && req.method === "GET") {
      const file = attempt.evidence.find((entry) => entry.id === trailing);
      if (!file) return reject(res, 404, "Evidence not found for this attempt", "PAYMENT_MANUAL_PAYOUT_NOT_FOUND");
      if (file.uploader !== actor.id && !actor.admin) return reject(res, 403, "Evidence is private to its uploader and Admin reconciliation", "PAYMENT_MANUAL_PAYOUT_FORBIDDEN");
      return binary(res, file.contentType, files.get(file.id));
    }
    if (req.method !== "POST") return reject(res, 405, "Method not allowed", "PAYMENT_MANUAL_PAYOUT_METHOD");
    if (row.sellerId === actor.id) return reject(res, 403, "Staff cannot execute or reconcile their own seller payout", "PAYMENT_MANUAL_PAYOUT_SELF_PAYOUT");
    const adminOnly = payoutCommand === "retries" || ["resolution", "reviews"].includes(attemptCommand);
    if (adminOnly && !actor.admin) return reject(res, 403, "Only an administrator can reconcile, correct or retry", "PAYMENT_MANUAL_PAYOUT_ADMIN_REQUIRED");

    if (attemptCommand === "evidence") {
      const form = multipart(req);
      if (!form?.file) return reject(res, 400, "A multipart file is required", "PAYMENT_MANUAL_PAYOUT_EVIDENCE_REQUIRED");
      const gate = idempotent(req, res, actor, "evidence", attempt.id, { fileName: form.file.fileName, size: form.file.size, version: form.fields.expectedAttemptVersion });
      if (gate.done) return true;
      if (gate.replay) return respond(res, detail(row, actor));
      if (!actions(row, actor).includes("UPLOAD_EVIDENCE")) return reject(res, 409, "Evidence cannot be added to this attempt now", "PAYMENT_MANUAL_PAYOUT_STATE_CONFLICT");
      if (Number(form.fields.expectedAttemptVersion) !== attempt.version) return reject(res, 409, "The attempt changed. Review the latest state.", "PAYMENT_MANUAL_PAYOUT_VERSION_CONFLICT");
      if (form.file.size > 10 * 1024 * 1024) return reject(res, 413, "Evidence files are limited to 10 MiB", "PAYMENT_MANUAL_PAYOUT_EVIDENCE_TOO_LARGE");
      if (!evidenceTypes.includes(form.file.contentType) || !signatureMatches(form.file)) return reject(res, 415, "Only JPEG, PNG or PDF evidence is accepted", "PAYMENT_MANUAL_PAYOUT_EVIDENCE_TYPE");
      const file = { id: randomUUID(), fileName: form.file.fileName, contentType: form.file.contentType, size: form.file.size, uploadedAt: stamp(), uploader: actor.id };
      files.set(file.id, form.file.contentType === "application/pdf" ? Buffer.from("%PDF-1.4\n%fixture\n") : form.file.contentType === "image/png" ? png(file.id) : Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
      attempt.evidence.push(file); attempt.version++; gate.commit();
      log(row, "EVIDENCE_UPLOADED", row.status, actor);
      return respond(res, detail(row, actor), 201);
    }

    const resource = attempt ? attempt.id : row.id;
    const gate = idempotent(req, res, actor, payoutCommand || attemptCommand, `${resource}:${trailing || ""}`, body);
    if (gate.done) return true;
    if (gate.replay) return respond(res, detail(row, actor));
    const expected = attempt ? body.expectedAttemptVersion : body.expectedPayoutVersion;
    if (!Number.isSafeInteger(expected) || expected < 0) return reject(res, 400, "An exact expected version is required", "PAYMENT_MANUAL_PAYOUT_VERSION_REQUIRED");
    const current = attempt ? attempt.version : row.version;
    if (expected !== current) return reject(res, 409, "This payout changed. Review the latest owner, state and version.", "PAYMENT_MANUAL_PAYOUT_VERSION_CONFLICT");
    const allowed = actions(row, actor), need = (action, detailText) => allowed.includes(action) ? null : reject(res, 409, detailText, attempt && !owner && ["ISSUE_QR", "RELEASE", "CONFIRM", "REPORT_PROBLEM"].includes(action) ? "PAYMENT_MANUAL_PAYOUT_NOT_OWNER" : "PAYMENT_MANUAL_PAYOUT_STATE_CONFLICT");
    const before = row.status;

    if (payoutCommand === "readiness-check") {
      if (need("READINESS_CHECK", "Only an on-hold payout can be rechecked")) return true;
      const bank = verifiedBank(row.sellerId), reason = blockedReason(row, bank);
      if (!reason) { row.status = "PENDING"; row.sellerBankId = bank.id; row.manual.recipient = recipientOf(bank); row.manual.blockedReason = null; row.version++; log(row, "RELEASED", before, actor); }
      else { row.manual.blockedReason = reason; log(row, "READINESS_CHECKED", before, actor, { reason }); }
      gate.commit(); return respond(res, detail(row, actor));
    }
    if (payoutCommand === "claims") {
      const latestBank = verifiedBank(row.sellerId);
      if (!config.newWorkEnabled) return reject(res, 503, "New manual payout work is disabled", "PAYMENT_MANUAL_PAYOUT_DISABLED");
      if (row.status === "PROCESSING") return reject(res, 409, "Another executor already claimed this payout", "PAYMENT_MANUAL_PAYOUT_ALREADY_CLAIMED");
      if (need("CLAIM", "Only a pending payout can be claimed")) return true;
      if (!latestBank || latestBank.id !== row.manual.recipient?.bankId || latestBank.version !== row.manual.recipient?.bankVersion) return reject(res, 409, "The seller bank changed. Run a readiness check first.", "PAYMENT_MANUAL_PAYOUT_BANK_CHANGED");
      row.manual.attempts.push({ id: randomUUID(), attemptNo: row.manual.attempts.length + 1, state: "CLAIMED", version: 0, ownerId: actor.id, reference: null,
        leaseExpiresAt: new Date(now() + config.leaseSeconds * 1000).toISOString(), qrDeadline: null, receiptStatus: "NOT_REQUESTED", receiptVersion: 0, evidence: [], confirmation: null });
      row.status = "PROCESSING"; row.version++; row.attemptCount = row.manual.attempts.length; gate.commit();
      log(row, "CLAIMED", before, actor);
      return respond(res, detail(row, actor), 201);
    }
    if (attemptCommand === "qr-issuances") {
      if (!config.newWorkEnabled) return reject(res, 503, "New QR issuance is disabled", "PAYMENT_MANUAL_PAYOUT_DISABLED");
      if (need("ISSUE_QR", "Only the owner of a live claim can issue its QR")) return true;
      attempt.state = "QR_ISSUED"; attempt.reference = `NEXUS${row.id.slice(0, 8).toUpperCase()}A${attempt.attemptNo}`; attempt.qrDeadline = new Date(now() + config.qrSeconds * 1000).toISOString(); attempt.leaseExpiresAt = null;
      attempt.version++; gate.commit(); log(row, "QR_ISSUED", before, actor);
      return respond(res, detail(row, actor), 201);
    }
    if (attemptCommand === "release") {
      if (need("RELEASE", "Only an unissued claim can be released")) return true;
      attempt.state = "NOT_SENT"; attempt.version++; row.status = "PENDING"; row.version++; gate.commit();
      log(row, "CLAIM_RELEASED", before, actor, { reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Released before QR issuance" });
      return respond(res, detail(row, actor));
    }
    if (attemptCommand === "confirmation") {
      if (need("CONFIRM", "Only the owner of an issued QR can record its transfer")) return true;
      const source = sources.find((entry) => entry.id === body.sourceAccountId), transferred = Date.parse(body.transferredAt);
      if (!source || typeof body.bankTransferReference !== "string" || !/^[A-Za-z0-9._-]{4,64}$/.test(body.bankTransferReference) || !Number.isFinite(transferred) || transferred > now() + 60000)
        return reject(res, 400, "Source account, bank reference and a past transfer time are required", "PAYMENT_MANUAL_PAYOUT_INVALID_CONFIRMATION");
      if (body.amount !== row.netAmount) return reject(res, 400, `The transferred amount must equal the frozen net ${row.netAmount}`, "PAYMENT_MANUAL_PAYOUT_AMOUNT_MISMATCH");
      if (!Array.isArray(body.evidenceIds) || body.evidenceIds.length < 1 || body.evidenceIds.length > 3 || body.evidenceIds.some((id) => !attempt.evidence.some((file) => file.id === id)))
        return reject(res, 400, "Attach 1-3 evidence files uploaded to this attempt", "PAYMENT_MANUAL_PAYOUT_EVIDENCE_REQUIRED");
      const day = new Date(transferred).toISOString().slice(0, 10);
      if (payouts.rows().some((entry) => entry.manual?.attempts.some((other) => other.confirmation && other.confirmation.sourceAccountId === source.id && other.confirmation.bankTransferReference === body.bankTransferReference && other.confirmation.transferredAt.slice(0, 10) === day)))
        return reject(res, 409, "This bank reference is already recorded for another transfer", "PAYMENT_MANUAL_PAYOUT_REFERENCE_REUSED");
      attempt.state = "SUCCEEDED"; attempt.receiptStatus = "AWAITING_CONFIRMATION"; attempt.version++;
      attempt.confirmation = { sourceAccountId: source.id, amount: body.amount, bankTransferReference: body.bankTransferReference, transferredAt: new Date(transferred).toISOString(), recordedAt: stamp() };
      Object.assign(row, { status: "SUCCEEDED", confirmationSource: "MANUAL_STAFF_CONFIRMED", providerReference: body.bankTransferReference, recipientAccountLast4: row.manual.recipient.accountLast4 }); row.version++;
      transactions.push({ payoutId: row.id, attemptNo: attempt.attemptNo, type: "PAYOUT", amount: row.netAmount, reference: body.bankTransferReference, confirmationSource: "MANUAL_STAFF_CONFIRMED", simulated: true });
      gate.commit(); log(row, "STAFF_CONFIRMED", before, actor, { confirmationSource: "MANUAL_STAFF_CONFIRMED", reference: body.bankTransferReference });
      return respond(res, detail(row, actor));
    }
    if (attemptCommand === "problems") {
      if (need("REPORT_PROBLEM", "Only the owning executor can report a problem on this attempt")) return true;
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!["UNCERTAIN_OUTCOME", "WRONG_AMOUNT", "WRONG_RECIPIENT", "SUSPECTED_DUPLICATE"].includes(body.kind) || !reason || reason.length > 1000) return reject(res, 400, "Choose a problem type and explain it", "PAYMENT_MANUAL_PAYOUT_INVALID_PROBLEM");
      if (attempt.state === "QR_ISSUED") { attempt.state = "UNKNOWN"; row.status = "UNKNOWN"; } else row.manual.exception = { kind: body.kind, reason };
      attempt.version++; row.version++; gate.commit(); log(row, "PROBLEM_REPORTED", before, actor, { reason: `${body.kind}: ${reason}` });
      return respond(res, detail(row, actor));
    }
    if (attemptCommand === "resolution") {
      if (need("RESOLVE", "This attempt has nothing to reconcile")) return true;
      const reason = typeof body.reason === "string" ? body.reason.trim() : "", proof = Array.isArray(body.evidenceIds) ? body.evidenceIds : [];
      if (!reason || proof.some((id) => !attempt.evidence.some((file) => file.id === id))) return reject(res, 400, "A reason and this attempt's evidence are required", "PAYMENT_MANUAL_PAYOUT_INVALID_RESOLUTION");
      if (body.outcome !== "CONFIRMED_SENT" && !proof.length) return reject(res, 400, "This outcome needs evidence", "PAYMENT_MANUAL_PAYOUT_EVIDENCE_REQUIRED");
      if (body.outcome === "CONFIRMED_SENT" && attempt.state === "UNKNOWN") {
        attempt.state = "SUCCEEDED"; attempt.receiptStatus = "AWAITING_CONFIRMATION";
        attempt.confirmation = { sourceAccountId: sources[0].id, amount: row.netAmount, bankTransferReference: attempt.reference, transferredAt: stamp(), recordedAt: stamp() };
        Object.assign(row, { status: "SUCCEEDED", confirmationSource: "MANUAL_STAFF_CONFIRMED", providerReference: attempt.reference, recipientAccountLast4: row.manual.recipient.accountLast4 });
        transactions.push({ payoutId: row.id, attemptNo: attempt.attemptNo, type: "PAYOUT", amount: row.netAmount, reference: attempt.reference, confirmationSource: "MANUAL_STAFF_CONFIRMED", simulated: true });
        log(row, "RESOLVED_SENT", before, actor, { reason, confirmationSource: "MANUAL_STAFF_CONFIRMED" });
      } else if (body.outcome === "CONFIRMED_NOT_SENT" && attempt.state === "UNKNOWN") {
        attempt.state = "NOT_SENT"; row.status = "FAILED"; log(row, "RESOLVED_NOT_SENT", before, actor, { reason });
      } else if (body.outcome === "CONFIRMED_RETURNED" && attempt.state === "SUCCEEDED") {
        attempt.state = "RETURNED"; row.status = "RETURNED"; row.manual.exception = null;
        transactions.push({ payoutId: row.id, attemptNo: attempt.attemptNo, type: "PAYOUT_RETURN", amount: row.netAmount, simulated: true });
        log(row, "RESOLVED_RETURNED", before, actor, { reason });
      } else if (body.outcome === "CONFIRMATION_RECORDED_IN_ERROR" && attempt.state === "SUCCEEDED") {
        const dispute = openDispute(row);
        if (!dispute || dispute.id !== body.disputeId || dispute.version !== body.expectedDisputeVersion) return reject(res, 409, "A correction needs the current open case", "PAYMENT_MANUAL_PAYOUT_VERSION_CONFLICT");
        attempt.state = "CONFIRMATION_CORRECTED"; row.status = "FAILED"; row.confirmationSource = null; row.manual.exception = null; dispute.status = "RESOLVED"; dispute.version++;
        transactions.push({ payoutId: row.id, attemptNo: attempt.attemptNo, type: "PAYOUT_CORRECTION", amount: row.netAmount, simulated: true });
        log(row, "CONFIRMATION_CORRECTED", before, actor, { reason });
      } else return reject(res, 409, "This outcome does not match the attempt state", "PAYMENT_MANUAL_PAYOUT_STATE_CONFLICT");
      attempt.version++; row.version++; gate.commit();
      return respond(res, detail(row, actor));
    }
    if (attemptCommand === "reviews") {
      if (need("REVIEW_DISPUTE", "There is no unresolved seller case")) return true;
      const dispute = openDispute(row), note = typeof body.note === "string" ? body.note.trim() : "";
      if (dispute.id !== trailing || dispute.version !== body.expectedDisputeVersion) return reject(res, 409, "The seller case changed", "PAYMENT_MANUAL_PAYOUT_VERSION_CONFLICT");
      if (!["REQUEST_INFORMATION", "TRANSFER_EVIDENCE_PROVIDED"].includes(body.decision) || !note) return reject(res, 400, "Choose a review decision and add a note", "PAYMENT_MANUAL_PAYOUT_INVALID_REVIEW");
      dispute.status = "WAITING_SELLER"; dispute.version++; attempt.version++; row.version++; gate.commit();
      log(row, "DISPUTE_REVIEWED", before, actor, { reason: `${body.decision}: ${note}` });
      return respond(res, detail(row, actor));
    }
    if (payoutCommand === "retries") {
      if (need("RETRY", "Only a reconciled failed or returned payout can be retried")) return true;
      const bank = verifiedBank(row.sellerId), reason = blockedReason(row, bank);
      row.status = reason ? "ON_HOLD" : "PENDING"; row.manual.blockedReason = reason; if (!reason) row.manual.recipient = recipientOf(bank); row.version++; gate.commit();
      log(row, "RETRIED", before, actor, { reason: typeof body.reason === "string" ? body.reason.trim() : null });
      return respond(res, detail(row, actor));
    }
    return reject(res, 404, "Unknown manual payout command", "PAYMENT_MANUAL_PAYOUT_NOT_FOUND");
  }
  reset();
  payouts.setManualView(sellerAttempt);
  return { reset, handle, sellerAttempt };
}
module.exports = { createManualPayoutFixture };
