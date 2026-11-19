import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { createRatingDispute, createReputationRestriction, getRatingDisputes, getReputationRestrictions, resolveRatingDispute, revokeReputationRestriction } from "../service/ratingModerationService";
import { reputationRestrictionMessage } from "../features/reputationRestrictionMessage";

const userId = "68000000-0000-4000-8000-000000000004";
const id = "68000000-0000-4000-8000-000000000007";
const ratingId = "68000000-0000-4000-8000-000000000006";
const restriction = { id, userId, action: "BID" as const, reason: "Repeated payment violations", restrictedUntil: "2030-01-01T12:00:00Z", createdAt: "2026-11-19T01:00:00Z", createdBy: userId, active: true };
const dispute = { id, ratingId, userId, reason: "Unrelated review", status: "PENDING", createdAt: "2026-11-19T01:00:00Z", ratingScore: 1 };
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const page = (data: unknown) => ({ ...envelope(data), page: { number: 0, size: 20, totalElements: 1, totalPages: 1 } });
const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
};
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
};

test("restriction writes whitelist fields, read current token and serialize audit reason", async () => {
  const calls: { method?: string; url?: string; auth?: string; body: unknown }[] = [];
  const server = createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: raw ? JSON.parse(raw) : null });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(envelope(req.method === "DELETE" ? { ...restriction, active: false, revokedAt: "2026-11-19T02:00:00Z", revokedBy: userId, revocationReason: "Đã xác minh & gỡ" } : restriction)));
  });
  let token = "initial";
  const context = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    const untrusted = { ...restriction, createdBy: "attacker" };
    await createReputationRestriction(userId, untrusted, { context, auth: false, params: { attacker: true } });
    assert.deepEqual(calls[0], { method: "POST", url: `/api/v1/reputations/${userId}/restrictions`, auth: "Bearer initial", body: { action: "BID", reason: restriction.reason, restrictedUntil: restriction.restrictedUntil } });
    token = "rotated";
    await revokeReputationRestriction(userId, id, "Đã xác minh & gỡ", { context });
    assert.equal(calls[1].auth, "Bearer rotated");
    assert.equal(new URL(calls[1].url!, context.baseUrl).searchParams.get("reason"), "Đã xác minh & gỡ");
    assert.equal(calls[1].body, null);
  } finally { await close(server); }
});

test("moderation reads reject another user's restrictions and malformed status before HTTP", async () => {
  let calls = 0;
  let result: unknown = page([restriction]);
  const server = createServer((_, res) => { calls++; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(result)); });
  const options = { context: { baseUrl: await listen(server), getAccessToken: () => "admin" } };
  const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
  try {
    assert.equal((await getReputationRestrictions(userId, 0, options)).items[0].id, id);
    result = page([{ ...restriction, userId: ratingId }]);
    await assert.rejects(getReputationRestrictions(userId, 0, options), invalid);
    const before = calls;
    await assert.rejects(getRatingDisputes("invented", 0, options), invalid);
    await assert.rejects(getReputationRestrictions(userId, -1, options), invalid);
    assert.equal(calls, before);
  } finally { await close(server); }
});

test("disputes serialize only reason/decision and require the response to match", async () => {
  const bodies: unknown[] = [];
  let mismatch = false;
  const server = createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    bodies.push(JSON.parse(raw));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(envelope(req.method === "PATCH" ? { ...dispute, id: mismatch ? ratingId : id, status: "APPROVED", resolvedAt: "2026-11-19T02:00:00Z", resolvedBy: userId, resolutionReason: "Evidence verified" } : dispute)));
  });
  const options = { context: { baseUrl: await listen(server), getAccessToken: () => "scoped-user" } };
  try {
    await createRatingDispute(ratingId, { ...dispute }, options);
    await resolveRatingDispute(id, { status: "APPROVED", reason: "Evidence verified" }, options);
    assert.deepEqual(bodies, [{ reason: "Unrelated review" }, { status: "APPROVED", reason: "Evidence verified" }]);
    mismatch = true;
    await assert.rejects(resolveRatingDispute(id, { status: "APPROVED", reason: "Evidence verified" }, options), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  } finally { await close(server); }
});

test("restriction denial presents its reason and expiry without inventing a date", () => {
  const error = { kind: "http" as const, status: 403, title: "Restricted", code: "AUCTION_REPUTATION_RESTRICTED", extensions: { reason: "Payment violation", restrictedUntil: "2030-01-01T12:00:00Z" } };
  assert.match(reputationRestrictionMessage(error)!, /^Payment violation Restricted until /);
  assert.equal(reputationRestrictionMessage({ ...error, extensions: { restrictedUntil: "invalid" } }), "Your account is temporarily restricted from this action.");
  assert.equal(reputationRestrictionMessage({ ...error, code: "ANOTHER_ERROR" }), null);
});
