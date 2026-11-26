/* Local simulation of the #272 manual payout contract for #271.
 * No money moves and the PNG is a fixture pattern, not a scannable bank QR.
 * Production never imports this handler.
 */
const zlib = require("node:zlib");

function createManualPayoutFixture({ ok, problem, list, bodyOf, randomUUID, seller, payouts, getBankAccounts = () => [], verifyBank = () => {}, switchBank = () => {} }) {
  const system = "00000000-0000-0000-0000-000000000000";
  const base = "/v1/payments/manual-payouts";
  const sources = [{ id: "platform-main", alias: "Nexus payout account VCB 8899" }];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const evidenceTypes = ["image/jpeg", "image/png", "application/pdf"];
  const unresolved = ["OPEN", "UNDER_REVIEW", "WAITING_SELLER"];
  let requests, keys, transactions, config, offset, counter, files;
  const now = () => Date.now() + offset;
  const stamp = () => new Date(now() + counter++).toISOString();
  const minor = (value) => BigInt(value.replace(".", ""));
  const decimal = (value) => `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
  const respond = (res, data, status = 200) => { ok(res, data, status); return true; };
  const reject = (res, status, detail, code, extra) => { problem(res, status, detail, code, extra); return true; };
  const latest = (row) => row.manual.attempts.at(-1) || null;
  const openCases = (row) => row.manual.cases.filter((entry) => unresolved.includes(entry.status));
  const openDispute = (row) => openCases(row).find((entry) => entry.kind === "SELLER_DISPUTE") || null;
  const enabled = () => config.enabled && !config.automaticJobsEnabled;
  const verifiedBank = (sellerId) => getBankAccounts().find((bank) => bank.sellerId === sellerId && bank.active && bank.isDefault && bank.verificationStatus === "VERIFIED");
  const recipientOf = (bank) => bank ? { bankCode: bank.bankCode, holderName: bank.accountHolderName, accountLast4: bank.accountLast4, bankId: bank.id, bankVersion: bank.version } : null;
  const blockedReason = (row, bank) => !bank ? "BANK_NOT_READY" : minor(row.netAmount) % 100n ? "UNSUPPORTED_AMOUNT" : null;
  const sellerEvents = ["CREATED", "HELD", "RELEASED", "RETRIED", "MANUAL_CLAIMED", "QR_ISSUED", "CLAIM_RELEASED", "MANUAL_CONFIRMED", "MANUAL_PROBLEM", "MANUAL_RESOLVED",
    "RECEIPT_CONFIRMED", "RECEIPT_DISPUTED", "DISPUTE_REVIEWED", "CONFIRMATION_CORRECTED", "READINESS_CHECKED"];

  function reset() { requests = []; keys = new Map(); transactions = []; config = { enabled: true, automaticJobsEnabled: false, leaseSeconds: 300, qrSeconds: 600 }; offset = 0; counter = 0; files = new Map(); }

  function log(row, event, fromStatus, actor, extra = {}) {
    const attempt = latest(row), occurredAt = stamp();
    row.updatedAt = occurredAt;
    row.manual.history.push({ id: randomUUID(), event, attemptId: extra.attemptId === undefined ? attempt?.id ?? null : extra.attemptId, caseId: extra.caseId ?? null,
      actorId: actor.id, actorRole: actor.role, reason: extra.reason ?? null, occurredAt });
    if (sellerEvents.includes(event)) row.history.push({ id: randomUUID(), event, fromStatus, toStatus: row.status, attemptNo: attempt?.attemptNo ?? 0, amount: row.netAmount,
      sellerBankId: row.sellerBankId, recipientAccountLast4: row.manual.recipient?.accountLast4 ?? null, provider: attempt ? "manual" : null, providerReference: null, providerStatus: null,
      errorCode: null, errorMessage: null, simulated: false, actorId: actor.id, occurredAt });
  }

  function openCase(row, kind, reason, explanation, actor) {
    const entry = { id: randomUUID(), attemptId: latest(row)?.id ?? null, kind, status: "OPEN", reason, explanation, version: 0, createdAt: stamp(), reportedBy: actor.id };
    row.manual.cases.push(entry);
    return entry;
  }
  const closeCase = (entry) => { entry.status = "RESOLVED"; entry.version++; };

  function seed(body) {
    const sellerId = body.sellerId || seller;
    if (body.bankVerified) verifyBank(sellerId);
    const bank = verifiedBank(sellerId);
    const orderAmount = body.orderAmount || "100000.00", shippingFee = body.shippingFee || "5000.00";
    const createdAt = body.createdAt || stamp();
    const row = { id: randomUUID(), orderId: body.orderId || randomUUID(), sellerId, orderAmount, shippingFee, platformFeeRate: "0.0000", platformFee: "0.00", netAmount: decimal(minor(orderAmount) - minor(shippingFee)),
      currency: "VND", status: "PENDING", attemptCount: 0, recipientAccountLast4: null, providerReference: null, createdAt, updatedAt: createdAt, sellerBankId: bank?.id ?? null,
      executionMode: "MANUAL", confirmationSource: null, version: 0, history: [], manual: { recipient: recipientOf(bank), attempts: [], cases: [], history: [], blockedReason: null } };
    row.manual.blockedReason = blockedReason(row, bank);
    log(row, "CREATED", null, { id: system, role: "SYSTEM" });
    if (row.manual.blockedReason) { row.status = "ON_HOLD"; row.manual.recipient = null; log(row, "HELD", "PENDING", { id: system, role: "SYSTEM" }, { reason: row.manual.blockedReason }); }
    payouts.rows().push(row);
    return row;
  }

  function uncertain(row, attempt, actor, reason, existing) {
    const before = row.status;
    attempt.state = "UNKNOWN"; attempt.version++; row.status = "UNKNOWN"; row.manual.blockedReason = "RECONCILIATION_REQUIRED"; row.version++;
    const entry = existing || (openCases(row).length ? null : openCase(row, "STAFF_EXCEPTION", "RECONCILIATION_REQUIRED", reason, actor));
    log(row, "MANUAL_PROBLEM", before, actor, { reason, caseId: entry?.id ?? null });
  }

  function settleClock(row) {
    const attempt = latest(row), actor = { id: system, role: "SYSTEM" };
    if (!attempt) return;
    if (attempt.state === "CLAIMED" && Date.parse(attempt.claimExpiresAt) <= now()) {
      attempt.state = "NOT_SENT"; attempt.version++; row.status = row.manual.blockedReason ? "ON_HOLD" : "PENDING"; row.version++;
      log(row, "CLAIM_RELEASED", "PROCESSING", actor, { reason: "Claim lease expired" });
    }
    if (attempt.state === "QR_ISSUED" && Date.parse(attempt.qrExpiresAt) <= now()) uncertain(row, attempt, actor, "QR deadline expired or reviewed bank changed");
  }

  function actions(row, actor) {
    if (row.sellerId === actor.id) return [];
    const attempt = latest(row), result = [], current = now();
    if (enabled() && row.status === "PENDING") result.push("CLAIM");
    if (row.status === "ON_HOLD") result.push("READINESS_CHECK");
    if (actor.admin && ["FAILED", "RETURNED"].includes(row.status) && !openCases(row).length) result.push("RETRY");
    if (attempt) {
      const owner = attempt.claimedBy === actor.id;
      if (owner && attempt.state === "CLAIMED") { result.push("RELEASE"); if (enabled() && Date.parse(attempt.claimExpiresAt) > current) result.push("ISSUE_QR"); }
      if (!owner && actor.admin && attempt.state === "CLAIMED") result.push("RELEASE");
      if (owner && attempt.state === "QR_ISSUED" && Date.parse(attempt.qrExpiresAt) > current) result.push("READ_QR", "CONFIRM_TRANSFER");
      if (owner && ["QR_ISSUED", "UNKNOWN", "SUCCEEDED"].includes(attempt.state)) result.push("UPLOAD_EVIDENCE", "REPORT_PROBLEM");
      if (actor.admin && openCases(row).length) { result.push("RESOLVE"); if (openDispute(row)) result.push("REVIEW_DISPUTE"); if (!result.includes("UPLOAD_EVIDENCE")) result.push("UPLOAD_EVIDENCE"); }
    }
    if (row.manual.blockedReason && row.status !== "UNKNOWN") { const claim = result.indexOf("CLAIM"); if (claim >= 0) result.splice(claim, 1); if (!result.includes("READINESS_CHECK")) result.push("READINESS_CHECK"); }
    return result;
  }

  function attemptView(attempt) {
    return attempt && { id: attempt.id, attemptNo: attempt.attemptNo, state: attempt.state, version: attempt.version, claimedBy: attempt.claimedBy, claimExpiresAt: attempt.claimExpiresAt,
      qrExpiresAt: attempt.qrExpiresAt, reference: attempt.reference, receiptStatus: attempt.receiptStatus, receiptVersion: attempt.receiptVersion, sellerConfirmedAt: attempt.sellerConfirmedAt };
  }

  function view(row, actor, full) {
    const attempt = latest(row);
    const { bankId, bankVersion, ...recipient } = row.manual.recipient || {};
    const proofVisible = attempt && (attempt.claimedBy === actor.id || actor.admin && row.manual.cases.length > 0);
    const defaultBank = verifiedBank(row.sellerId);
    const changed = full && attempt && defaultBank && !["PENDING", "ON_HOLD"].includes(row.status) && (defaultBank.id !== bankId || defaultBank.version !== bankVersion);
    return { id: row.id, orderId: row.orderId, sellerId: row.sellerId, status: row.status, executionMode: "MANUAL", confirmationSource: row.confirmationSource,
      orderAmount: row.orderAmount, shippingFee: row.shippingFee, platformFee: row.platformFee, netAmount: row.netAmount, currency: row.currency, version: row.version,
      blockedReason: row.status === "SUCCEEDED" ? null : row.manual.blockedReason, allowedActions: actions(row, actor), serverTime: new Date(now()).toISOString(), createdAt: row.createdAt, updatedAt: row.updatedAt,
      currentAttempt: attemptView(attempt), evidence: full && proofVisible ? attempt.evidence.map(({ uploader, ...file }) => file) : [],
      cases: [...row.manual.cases].reverse().map(({ attemptId, reportedBy, ...entry }) => ({ ...entry, explanation: full ? entry.explanation : "" })),
      history: full ? [...row.manual.history].reverse() : [], ...(row.manual.recipient ? { recipient } : {}),
      ...(changed ? { sellerDefaultRecipient: { bankCode: defaultBank.bankCode, holderName: defaultBank.accountHolderName, accountLast4: defaultBank.accountLast4 } } : {}) };
  }

  function receipt(row) {
    if (row.executionMode !== "MANUAL") return null;
    const attempt = latest(row);
    if (!attempt) return null;
    const dispute = openDispute(row) || [...row.manual.cases].reverse().find((entry) => entry.kind === "SELLER_DISPUTE") || null;
    const succeeded = row.status === "SUCCEEDED" && attempt.state === "SUCCEEDED";
    const allowed = succeeded ? [...(attempt.receiptStatus !== "CONFIRMED" ? ["CONFIRM_RECEIPT"] : []), ...(openDispute(row) ? [] : ["OPEN_DISPUTE"])] : [];
    return { attemptId: attempt.id, attemptState: attempt.state, receiptStatus: attempt.receiptStatus, receiptVersion: attempt.receiptVersion, hasOpenDispute: !!openDispute(row),
      allowedActions: allowed, dispute: dispute && { id: dispute.id, status: dispute.status, reason: dispute.reason } };
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
    let file = null;
    for (const part of raw.split(`--${boundary}`)) {
      const name = /name="([^"]+)"/.exec(part)?.[1];
      const fileName = /filename="([^"]*)"/.exec(part)?.[1];
      if (name !== "file" || fileName === undefined) continue;
      const split = part.indexOf("\r\n\r\n"), content = part.slice(split + 4).replace(/\r\n$/, "");
      file = { fileName, contentType: (/Content-Type: ([^\r\n]+)/i.exec(part)?.[1] || "").trim().toLowerCase(), size: Buffer.byteLength(content, "latin1"), head: content.slice(0, 8) };
    }
    return { file };
  }
  const signatureMatches = (file) => file.contentType === "application/pdf" ? file.head.startsWith("%PDF") : file.contentType === "image/png" ? /^.{1,3}PNG/s.test(file.head) : /^[ÿ�]/.test(file.head);

  function idempotent(req, res, actor, operation, resource, payload) {
    const key = req.headers["idempotency-key"];
    if (typeof key !== "string" || !uuid.test(key)) { reject(res, 400, "A UUID Idempotency-Key is required", "MANUAL_PAYOUT_IDEMPOTENCY_KEY_REQUIRED"); return { done: true }; }
    const previous = keys.get(key.toLowerCase()), canonical = JSON.stringify(payload);
    if (previous) {
      if (previous.actor === actor.id && previous.operation === operation && previous.resource === resource && previous.payload === canonical) return { replay: true };
      reject(res, 409, "This idempotency key belongs to another request", "MANUAL_PAYOUT_IDEMPOTENCY_CONFLICT"); return { done: true };
    }
    return { commit: () => keys.set(key.toLowerCase(), { actor: actor.id, operation, resource, payload: canonical }) };
  }

  function conflict(res, row, actor, detail) {
    return reject(res, 409, detail, "MANUAL_PAYOUT_CONFLICT", { currentVersion: row.version, payoutStatus: row.status, allowedActions: actions(row, actor) });
  }

  function proofOk(attempt, ids, min) {
    return Array.isArray(ids) && ids.length >= min && ids.length <= 3 && new Set(ids).size === ids.length && ids.every((id) => attempt.evidence.some((file) => file.id === id));
  }

  function validFacts(body, attempt) {
    const transferred = Date.parse(body.transferredAt);
    return sources.some((entry) => entry.id === body.sourceAccountId) && typeof body.bankTransferReference === "string" && /^[A-Za-z0-9._/-]{1,120}$/.test(body.bankTransferReference) &&
      Number.isFinite(transferred) && transferred <= now() + 60000 && (!attempt.qrIssuedAt || transferred >= Date.parse(attempt.qrIssuedAt));
  }

  function settleSent(row, attempt, body, actor, before, reason, caseId) {
    attempt.state = "SUCCEEDED"; attempt.receiptStatus = "AWAITING_CONFIRMATION"; attempt.receiptVersion++; attempt.version++;
    attempt.confirmation = { sourceAccountId: body.sourceAccountId, amount: body.amount, bankTransferReference: body.bankTransferReference, transferredAt: new Date(Date.parse(body.transferredAt)).toISOString() };
    Object.assign(row, { status: "SUCCEEDED", confirmationSource: "MANUAL_STAFF_CONFIRMED", recipientAccountLast4: row.manual.recipient.accountLast4 });
    row.manual.blockedReason = null; row.version++;
    transactions.push({ payoutId: row.id, attemptNo: attempt.attemptNo, type: "PAYOUT", amount: row.netAmount, reference: body.bankTransferReference, confirmationSource: "MANUAL_STAFF_CONFIRMED", simulated: true });
    log(row, caseId ? "MANUAL_RESOLVED" : "MANUAL_CONFIRMED", before, actor, { reason, caseId });
  }

  function handle(req, res, url, claims) {
    const route = url.pathname.replace(/^\/api/, "");
    if (route === "/test/manual-payouts/evidence" && req.method === "GET") return respond(res, { requests, transactions, payouts: payouts.rows().filter((row) => row.executionMode === "MANUAL").map((row) => view(row, { id: system, admin: true }, true)), simulated: true });
    if (route === "/test/manual-payouts/seed" && req.method === "POST") { const body = bodyOf(req); const rows = Array.from({ length: body.count || 1 }, () => seed(body)); return respond(res, rows.map((row) => ({ id: row.id, orderId: row.orderId, sellerId: row.sellerId }))); }
    if (route === "/test/manual-payouts/config" && req.method === "POST") { Object.assign(config, bodyOf(req)); return respond(res, config); }
    if (route === "/test/manual-payouts/clock" && req.method === "POST") { offset += Number(bodyOf(req).advanceSeconds || 0) * 1000; return respond(res, { serverTime: new Date(now()).toISOString() }); }
    if (route === "/test/manual-payouts/bank-change" && req.method === "POST") {
      const row = payouts.rows().find((entry) => entry.id === bodyOf(req).payoutId), attempt = row && latest(row);
      if (!row) return reject(res, 404, "Payout missing", "MANUAL_PAYOUT_NOT_FOUND");
      if (bodyOf(req).accountLast4) switchBank(row.sellerId, bodyOf(req).accountLast4);
      if (attempt?.state === "QR_ISSUED") uncertain(row, attempt, { id: system, role: "SYSTEM" }, "Reviewed bank changed after QR issuance");
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
    if (!claims) return reject(res, 401, "Sign in first", "UNAUTHENTICATED");

    if (sellerRoute) {
      const row = payouts.rows().find((entry) => entry.id === sellerRoute[1] && entry.executionMode === "MANUAL");
      if (!actor.seller || !row || row.sellerId !== actor.id) return reject(res, 404, "Payout not found", "MANUAL_PAYOUT_NOT_FOUND");
      const attempt = row.manual.attempts.find((entry) => entry.id === sellerRoute[2]);
      if (!attempt) return reject(res, 404, "Attempt not found", "MANUAL_PAYOUT_NOT_FOUND");
      const confirming = sellerRoute[3] === "receipt-confirmations";
      const gate = idempotent(req, res, actor, sellerRoute[3], attempt.id, body);
      if (gate.done) return true;
      if (gate.replay) return respond(res, receipt(row));
      if (!Number.isSafeInteger(body.expectedReceiptVersion) || body.expectedReceiptVersion < 0) return reject(res, 400, "expectedReceiptVersion is required", "VALIDATION_FAILED");
      const allowed = receipt(row).allowedActions;
      if (attempt !== latest(row) || body.expectedReceiptVersion !== attempt.receiptVersion) return conflict(res, row, actor, "The receipt changed. Review the latest state.");
      if (confirming) {
        if (!allowed.includes("CONFIRM_RECEIPT")) return conflict(res, row, actor, "Receipt cannot be confirmed now");
        attempt.receiptStatus = "CONFIRMED"; attempt.sellerConfirmedAt = stamp(); attempt.receiptVersion++;
        const dispute = openDispute(row); if (dispute) closeCase(dispute);
        log(row, "RECEIPT_CONFIRMED", row.status, { id: actor.id, role: "SELLER" }, { caseId: dispute?.id ?? null });
      } else {
        const explanation = typeof body.explanation === "string" ? body.explanation.trim() : "";
        if (!["NOT_RECEIVED", "INCORRECT_AMOUNT", "CONFIRMATION_MISTAKE"].includes(body.reason) || explanation.length < 1 || explanation.length > 1000) return reject(res, 400, "Choose a reason and explain it", "VALIDATION_FAILED");
        if (!allowed.includes("OPEN_DISPUTE")) return conflict(res, row, actor, "A seller case is already open");
        if (attempt.receiptStatus === "CONFIRMED" && body.reason !== "CONFIRMATION_MISTAKE") return reject(res, 400, "A confirmed receipt can only be disputed as a confirmation mistake", "VALIDATION_FAILED");
        const entry = openCase(row, "SELLER_DISPUTE", body.reason, explanation, actor);
        attempt.receiptStatus = "DISPUTED"; attempt.receiptVersion++; row.version++;
        log(row, "RECEIPT_DISPUTED", row.status, { id: actor.id, role: "SELLER" }, { reason: body.reason, caseId: entry.id });
      }
      gate.commit();
      return respond(res, receipt(row), confirming ? 200 : 201);
    }

    if (!actor.staff) return reject(res, 403, "Administrator or support staff role required", "FORBIDDEN");
    if (route === `${base}/capabilities` && req.method === "GET")
      return respond(res, { enabled: config.enabled, executionMode: "MANUAL", automaticJobsEnabled: config.automaticJobsEnabled, serverTime: new Date(now()).toISOString(),
        sourceAccounts: sources, allowedActions: actor.admin ? ["EXECUTE", "RECONCILE"] : ["EXECUTE"] });
    if (route === base && req.method === "GET") {
      const statuses = url.searchParams.getAll("status"), sellerId = url.searchParams.get("sellerId"), from = url.searchParams.get("from"), to = url.searchParams.get("to");
      const rows = payouts.rows().filter((row) => row.executionMode === "MANUAL");
      rows.forEach(settleClock);
      const views = rows.filter((row) => {
        const attempt = latest(row), active = attempt && ["CLAIMED", "QR_ISSUED"].includes(attempt.state);
        return (!statuses.length || statuses.includes(row.status)) && (!sellerId || row.sellerId === sellerId) &&
          (url.searchParams.get("claimedBy") !== "me" || active && attempt.claimedBy === actor.id) && (!url.searchParams.get("receiptStatus") || attempt?.receiptStatus === url.searchParams.get("receiptStatus")) &&
          (url.searchParams.get("hasOpenDispute") !== "true" || !!openDispute(row)) && (url.searchParams.get("needsReview") !== "true" || row.status === "UNKNOWN" || openCases(row).length > 0) &&
          (!from || Date.parse(row.createdAt) >= Date.parse(from)) && (!to || Date.parse(row.createdAt) <= Date.parse(to));
      }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).map((row) => view(row, actor, false));
      if (!url.searchParams.get("size")) url.searchParams.set("size", "20");
      list(res, views, url); return true;
    }
    const match = /^\/v1\/payments\/manual-payouts\/([^/]+)(?:\/(readiness-check|claims|retries)|\/attempts\/([^/]+)\/(qr-issuances|qr|release|evidence|confirmation|problems|resolution)(?:\/([^/]+))?|\/attempts\/([^/]+)\/receipt-disputes\/([^/]+)\/reviews)?$/.exec(route);
    const row = match && payouts.rows().find((entry) => entry.id === match[1] && entry.executionMode === "MANUAL");
    if (!row) return reject(res, 404, "Manual payout not found", "MANUAL_PAYOUT_NOT_FOUND");
    settleClock(row);
    const payoutCommand = match[2], attemptId = match[3] || match[6], attemptCommand = match[4] || (match[7] ? "reviews" : null), trailing = match[5] || match[7];
    if (!payoutCommand && !attemptCommand && req.method === "GET") return respond(res, view(row, actor, true));
    const attempt = attemptId ? row.manual.attempts.find((entry) => entry.id === attemptId) : null;
    if (attemptId && !attempt) return reject(res, 404, "Attempt not found for this payout", "MANUAL_PAYOUT_NOT_FOUND");
    const owner = attempt && attempt.claimedBy === actor.id;

    if (attemptCommand === "qr" && req.method === "GET") {
      if (!actions(row, actor).includes("READ_QR")) return conflict(res, row, actor, "Only the owner of a live QR can read it");
      return binary(res, "image/png", png(`${attempt.reference}|${row.netAmount}|${row.manual.recipient.accountLast4}`));
    }
    if (attemptCommand === "evidence" && trailing && req.method === "GET") {
      const file = attempt.evidence.find((entry) => entry.id === trailing);
      if (!file) return reject(res, 404, "Evidence not found for this attempt", "MANUAL_PAYOUT_NOT_FOUND");
      if (!owner && !actor.admin) return reject(res, 403, "Evidence is private to its executor and Admin reconciliation", "FORBIDDEN");
      return binary(res, file.contentType, files.get(file.id));
    }
    if (req.method !== "POST") return reject(res, 405, "Method not allowed", "METHOD_NOT_ALLOWED");
    if (row.sellerId === actor.id) return reject(res, 403, "Staff cannot execute or reconcile their own seller payout", "FORBIDDEN");
    const adminOnly = payoutCommand === "retries" || ["resolution", "reviews"].includes(attemptCommand);
    if (adminOnly && !actor.admin) return reject(res, 403, "Only an administrator can reconcile, correct or retry", "FORBIDDEN");

    if (attemptCommand === "evidence") {
      const form = multipart(req), expectedVersion = Number(url.searchParams.get("expectedAttemptVersion"));
      if (!form?.file) return reject(res, 400, "A multipart file is required", "VALIDATION_FAILED");
      if (!url.searchParams.has("expectedAttemptVersion") || !Number.isSafeInteger(expectedVersion)) return reject(res, 400, "expectedAttemptVersion is required", "VALIDATION_FAILED");
      const gate = idempotent(req, res, actor, "evidence", attempt.id, { fileName: form.file.fileName, size: form.file.size, version: expectedVersion });
      if (gate.done) return true;
      if (gate.replay) return respond(res, view(row, actor, true));
      if (!actions(row, actor).includes("UPLOAD_EVIDENCE") || attempt !== latest(row)) return conflict(res, row, actor, "Evidence cannot be added to this attempt now");
      if (expectedVersion !== attempt.version) return conflict(res, row, actor, "The attempt changed. Review the latest state.");
      if (attempt.evidence.length >= 3) return conflict(res, row, actor, "This attempt already has 3 evidence files");
      if (form.file.size > 10 * 1024 * 1024) return reject(res, 413, "Evidence files are limited to 10 MiB", "PAYLOAD_TOO_LARGE");
      if (!evidenceTypes.includes(form.file.contentType) || !signatureMatches(form.file)) return reject(res, 415, "Only JPEG, PNG or PDF evidence is accepted", "UNSUPPORTED_MEDIA_TYPE");
      const file = { id: randomUUID(), contentType: form.file.contentType, size: form.file.size, createdAt: stamp(), uploader: actor.id };
      files.set(file.id, form.file.contentType === "application/pdf" ? Buffer.from("%PDF-1.4\n%fixture\n") : form.file.contentType === "image/png" ? png(file.id) : Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
      attempt.evidence.push(file); attempt.version++; gate.commit();
      log(row, "EVIDENCE_UPLOADED", row.status, actor);
      return respond(res, view(row, actor, true), 201);
    }

    const resource = attempt ? attempt.id : row.id;
    const gate = idempotent(req, res, actor, payoutCommand || attemptCommand, `${resource}:${trailing || ""}`, body);
    if (gate.done) return true;
    if (gate.replay) return respond(res, view(row, actor, true));
    const versions = attemptCommand === "resolution" ? [body.expectedPayoutVersion, body.expectedAttemptVersion, body.expectedCaseVersion]
      : attemptCommand === "reviews" ? [body.expectedAttemptVersion, body.expectedCaseVersion] : [attempt ? body.expectedAttemptVersion : body.expectedPayoutVersion];
    if (versions.some((entry) => !Number.isSafeInteger(entry) || entry < 0)) return reject(res, 400, "An exact expected version is required", "VALIDATION_FAILED");
    if (attemptCommand === "resolution" ? body.expectedPayoutVersion !== row.version || body.expectedAttemptVersion !== attempt.version : versions[0] !== (attempt ? attempt.version : row.version))
      return conflict(res, row, actor, "This payout changed. Review the latest owner, state and version.");
    const allowed = actions(row, actor), need = (action, detailText) => allowed.includes(action) && (!attempt || attempt === latest(row)) ? null : conflict(res, row, actor, detailText);
    const before = row.status;

    if (payoutCommand === "readiness-check") {
      if (need("READINESS_CHECK", "Only a blocked payout can be rechecked")) return true;
      const bank = verifiedBank(row.sellerId), reason = blockedReason(row, bank);
      if (!reason) { row.status = "PENDING"; row.sellerBankId = bank.id; row.manual.recipient = recipientOf(bank); row.manual.blockedReason = null; row.version++; log(row, "RELEASED", before, actor); }
      else { row.manual.blockedReason = reason; log(row, "READINESS_CHECKED", before, actor, { reason }); }
      gate.commit(); return respond(res, view(row, actor, true));
    }
    if (payoutCommand === "claims") {
      const latestBank = verifiedBank(row.sellerId);
      if (!enabled()) return reject(res, 503, "New manual payout work is disabled", "MANUAL_PAYOUT_DISABLED");
      if (need("CLAIM", "Only a pending payout can be claimed")) return true;
      if (!latestBank || latestBank.id !== row.manual.recipient?.bankId || latestBank.version !== row.manual.recipient?.bankVersion) return conflict(res, row, actor, "The seller bank changed. Run a readiness check first.");
      const attemptNo = row.manual.attempts.length + 1;
      row.manual.attempts.push({ id: randomUUID(), attemptNo, state: "CLAIMED", version: 0, claimedBy: actor.id, reference: `NXP${row.id.replace(/-/g, "").slice(0, 16).toUpperCase()}${String(attemptNo).padStart(4, "0")}`,
        claimExpiresAt: new Date(now() + config.leaseSeconds * 1000).toISOString(), qrExpiresAt: null, qrIssuedAt: null, receiptStatus: "NOT_REQUESTED", receiptVersion: 0, sellerConfirmedAt: null, evidence: [], confirmation: null });
      row.status = "PROCESSING"; row.version++; row.attemptCount = attemptNo; gate.commit();
      log(row, "MANUAL_CLAIMED", before, actor);
      return respond(res, view(row, actor, true), 201);
    }
    if (attemptCommand === "qr-issuances") {
      if (!enabled()) return reject(res, 503, "New QR issuance is disabled", "MANUAL_PAYOUT_DISABLED");
      if (need("ISSUE_QR", "Only the owner of a live claim can issue its QR")) return true;
      attempt.state = "QR_ISSUED"; attempt.qrIssuedAt = stamp(); attempt.qrExpiresAt = new Date(now() + config.qrSeconds * 1000).toISOString();
      attempt.version++; gate.commit(); log(row, "QR_ISSUED", before, actor);
      return respond(res, view(row, actor, true), 201);
    }
    if (attemptCommand === "release") {
      if (need("RELEASE", "Only an unissued claim can be released")) return true;
      attempt.state = "NOT_SENT"; attempt.version++; row.status = row.manual.blockedReason ? "ON_HOLD" : "PENDING"; row.version++; gate.commit();
      log(row, "CLAIM_RELEASED", before, actor, { reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null });
      return respond(res, view(row, actor, true));
    }
    if (attemptCommand === "confirmation") {
      if (need("CONFIRM_TRANSFER", "Only the owner of a live QR can record its transfer")) return true;
      if (!validFacts(body, attempt) || typeof body.amount !== "string" || !/^\d{1,17}\.\d{2}$/.test(body.amount))
        return reject(res, 400, "Source account, bank reference and a transfer time after QR issuance are required", "VALIDATION_FAILED");
      if (body.amount !== row.netAmount) return reject(res, 400, `The transferred amount must equal the net ${row.netAmount}`, "VALIDATION_FAILED");
      if (!proofOk(attempt, body.evidenceIds, 1)) return reject(res, 400, "Attach 1-3 evidence files uploaded to this attempt", "VALIDATION_FAILED");
      settleSent(row, attempt, body, actor, before, null, null); gate.commit();
      return respond(res, view(row, actor, true));
    }
    if (attemptCommand === "problems") {
      if (need("REPORT_PROBLEM", "Only the owning executor can report a problem on this attempt")) return true;
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!reason || reason.length > 1000 || body.evidenceIds !== undefined && !proofOk(attempt, body.evidenceIds, 0)) return reject(res, 400, "Explain the problem", "VALIDATION_FAILED");
      const entry = openCase(row, "STAFF_EXCEPTION", "STAFF_REPORTED", reason, actor);
      if (attempt.state !== "SUCCEEDED") uncertain(row, attempt, actor, reason, entry);
      else { attempt.version++; row.version++; log(row, "MANUAL_PROBLEM", before, actor, { reason, caseId: entry.id }); }
      gate.commit();
      return respond(res, view(row, actor, true));
    }
    if (attemptCommand === "resolution") {
      if (need("RESOLVE", "This attempt has nothing to reconcile")) return true;
      const entry = openCases(row).find((item) => item.id === body.caseId);
      if (!entry || entry.version !== body.expectedCaseVersion) return conflict(res, row, actor, "The case changed or is already resolved");
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!reason || !proofOk(attempt, body.evidenceIds, 1)) return reject(res, 400, "A reason and 1-3 of this attempt's evidence files are required", "VALIDATION_FAILED");
      const closeAll = () => openCases(row).forEach(closeCase);
      if (body.outcome === "CONFIRMED_SENT" && attempt.state === "UNKNOWN") {
        if (!validFacts(body, attempt) || body.amount !== row.netAmount) return reject(res, 400, "A sent outcome needs the bank facts for the exact net amount", "VALIDATION_FAILED");
        closeCase(entry); settleSent(row, attempt, body, actor, before, reason, entry.id);
      } else if (body.outcome === "CONFIRMED_SENT" && attempt.state === "SUCCEEDED" && row.status === "SUCCEEDED" && entry.kind === "STAFF_EXCEPTION") {
        closeCase(entry); attempt.version++; row.version++; log(row, "MANUAL_RESOLVED", before, actor, { reason, caseId: entry.id });
      } else if (body.outcome === "CONFIRMED_NOT_SENT" && attempt.state === "UNKNOWN") {
        closeAll(); attempt.state = "NOT_SENT"; attempt.version++; row.status = "FAILED"; row.manual.blockedReason = null; row.version++;
        log(row, "MANUAL_RESOLVED", before, actor, { reason, caseId: entry.id });
      } else if (body.outcome === "CONFIRMED_RETURNED" && attempt.state === "SUCCEEDED" && row.status === "SUCCEEDED") {
        closeAll(); attempt.state = "RETURNED"; attempt.version++; row.status = "RETURNED"; row.version++;
        transactions.push({ payoutId: row.id, attemptNo: attempt.attemptNo, type: "PAYOUT_RETURN", amount: row.netAmount, simulated: true });
        log(row, "MANUAL_RESOLVED", before, actor, { reason, caseId: entry.id });
      } else if (body.outcome === "CONFIRMATION_RECORDED_IN_ERROR" && attempt.state === "SUCCEEDED" && row.status === "SUCCEEDED") {
        closeAll(); attempt.state = "CONFIRMATION_CORRECTED"; attempt.version++; row.status = "FAILED"; row.confirmationSource = null; row.version++;
        transactions.push({ payoutId: row.id, attemptNo: attempt.attemptNo, type: "PAYOUT_CORRECTION", amount: row.netAmount, simulated: true });
        log(row, "CONFIRMATION_CORRECTED", before, actor, { reason, caseId: entry.id });
      } else return conflict(res, row, actor, "This outcome does not match the attempt state");
      gate.commit();
      return respond(res, view(row, actor, true));
    }
    if (attemptCommand === "reviews") {
      if (need("REVIEW_DISPUTE", "There is no unresolved seller case")) return true;
      const dispute = openDispute(row), reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (!dispute || dispute.id !== trailing || dispute.version !== body.expectedCaseVersion) return conflict(res, row, actor, "The seller case changed");
      if (!["REQUEST_INFORMATION", "TRANSFER_EVIDENCE_PROVIDED"].includes(body.action) || !reason) return reject(res, 400, "Choose a review action and add a reason", "VALIDATION_FAILED");
      if (body.action === "TRANSFER_EVIDENCE_PROVIDED" && !proofOk(attempt, body.evidenceIds, 1)) return reject(res, 400, "Attach the transfer evidence you provided", "VALIDATION_FAILED");
      dispute.status = body.action === "REQUEST_INFORMATION" ? "WAITING_SELLER" : "UNDER_REVIEW"; dispute.version++; row.version++; gate.commit();
      log(row, "DISPUTE_REVIEWED", before, actor, { reason: `${body.action}: ${reason}`, caseId: dispute.id });
      return respond(res, view(row, actor, true));
    }
    if (payoutCommand === "retries") {
      if (need("RETRY", "Only a reconciled failed or returned payout can be retried")) return true;
      const bank = verifiedBank(row.sellerId), reason = blockedReason(row, bank);
      row.status = reason ? "ON_HOLD" : "PENDING"; row.manual.blockedReason = reason; if (!reason) row.manual.recipient = recipientOf(bank); row.version++; gate.commit();
      log(row, "RETRIED", before, actor, { reason: typeof body.reason === "string" ? body.reason.trim() : null, attemptId: null });
      return respond(res, view(row, actor, true));
    }
    return reject(res, 404, "Unknown manual payout command", "MANUAL_PAYOUT_NOT_FOUND");
  }
  reset();
  payouts.setManualView(receipt);
  return { reset, handle, receipt };
}
module.exports = { createManualPayoutFixture };
