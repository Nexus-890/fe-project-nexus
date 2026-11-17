import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { createRating, getOrderRating, getSellerReputation } from "../service/ratingService";
import type { ApiContext } from "../types/commonRequestType";

const buyerId = "68000000-0000-4000-8000-000000000003";
const sellerId = "68000000-0000-4000-8000-000000000004";
const orderId = "68000000-0000-4000-8000-000000000002";
const otherId = "68000000-0000-4000-8000-000000000005";
const body = { orderId, score: 4, comment: "Well packed." };
const rating = { ...body, id: "68000000-0000-4000-8000-000000000006", auctionId: null, raterName: "B***r", ratedByMe: true, createdAt: "2026-11-14T01:00:00Z" };
const reputation = { userId: sellerId, score: 78, trustLevel: "TRUSTED", totalTransaction: 42, successfulTransaction: 40, failedTransaction: 2, ratingCount: 20, policyVersion: "reputation-policy-1" };
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const pageEnvelope = (data: unknown, number = 0, totalPages = 1) => ({ ...envelope(data), page: { number, size: 100, totalElements: totalPages * 100, totalPages } });
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
};
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
};

test("rating write omits caller and target identities and validates its masked own-rating response", async () => {
  const calls: Array<{ method?: string; url?: string; auth?: string; body: unknown }> = [];
  let result: unknown = rating;
  const server = createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    calls.push({ method: request.method, url: request.url, auth: request.headers.authorization, body: JSON.parse(raw) });
    response.writeHead(201, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope(result)));
  });
  let token = "initial-buyer";
  const context: ApiContext = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    assert.deepEqual(await createRating({ ...body, fromUserId: otherId, toUserId: buyerId } as typeof body, buyerId, { context, auth: false, params: { attacker: true } }), rating);
    assert.deepEqual(calls[0], { method: "POST", url: "/api/v1/ratings", auth: "Bearer initial-buyer", body });
    token = "renewed-buyer";
    await createRating(body, buyerId, { context });
    assert.equal(calls[1].auth, "Bearer renewed-buyer");
    for (const changed of [{ ratedByMe: false }, { orderId: otherId }, { orderId: null }, { score: 3 }, { comment: "Changed" }, { raterName: "Buyer full name" }, { fromUserId: otherId }, { toUserId: sellerId }]) {
      result = { ...rating, ...changed };
      await assert.rejects(createRating(body, buyerId, { context }), invalid);
    }
    const before = calls.length;
    for (const changed of [{ score: 0 }, { score: 5.5 }, { score: 6 }, { orderId: "invalid" }, { comment: "a".repeat(1001) }]) {
      await assert.rejects(createRating({ ...body, ...changed }, buyerId, { context }), invalid);
    }
    assert.equal(calls.length, before);
  } finally { await close(server); }
});

test("rating lookup reads every page before treating a completed order as unrated", async () => {
  const queries: string[] = [];
  let found = true;
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://nexus.test");
    queries.push(url.search);
    assert.equal(request.headers.authorization, "Bearer buyer");
    const number = Number(url.searchParams.get("page"));
    const data = number === 0 ? [{ ...rating, ratedByMe: false }, { ...rating, id: otherId, orderId: null, ratedByMe: false }] : found ? [rating] : [];
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(pageEnvelope(data, number, 2)));
  });
  const context: ApiContext = { baseUrl: await listen(server), getAccessToken: () => "buyer" };
  try {
    assert.deepEqual(await getOrderRating(sellerId, buyerId, orderId, { context, auth: false, params: { userId: otherId, page: 99 } }), rating);
    assert.deepEqual(queries, [`?userId=${sellerId}&page=0&size=100`, `?userId=${sellerId}&page=1&size=100`]);
    found = false;
    await assert.rejects(getOrderRating(sellerId, buyerId, orderId, { context }), invalid);
  } finally { await close(server); }
});

test("a valid empty or another rater's list is unrated while unmasked or malformed lists reject", async () => {
  let result: unknown = { ...envelope([]), page: { number: 0, size: 100, totalElements: 0, totalPages: 0 } };
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
  });
  const context = { baseUrl: await listen(server) };
  try {
    assert.equal(await getOrderRating(sellerId, buyerId, orderId, { context }), null);
    result = pageEnvelope([{ ...rating, ratedByMe: false }]);
    assert.equal(await getOrderRating(sellerId, buyerId, orderId, { context }), null);
    for (result of [envelope([]), pageEnvelope([{ ...rating, ratedByMe: undefined }]), pageEnvelope([{ ...rating, ratedByMe: "true" }]), pageEnvelope([{ ...rating, score: 9 }]), pageEnvelope([rating], 2), pageEnvelope([{ ...rating, createdAt: "yesterday" }]), pageEnvelope([{ ...rating, fromUserId: sellerId }]), pageEnvelope([{ ...rating, raterName: "Actual Buyer Name" }]), pageEnvelope([{ ...rating, auctionId: "invalid" }])]) {
      await assert.rejects(getOrderRating(sellerId, buyerId, orderId, { context }), invalid);
    }
  } finally { await close(server); }
});

test("reputation reads the protected seller resource and rejects invalid trust scores or identity", async () => {
  let result: unknown = reputation;
  const server = createServer((request, response) => {
    assert.equal(request.url, `/api/v1/reputations/${sellerId}`);
    assert.equal(request.headers.authorization, "Bearer buyer");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope(result)));
  });
  const context = { baseUrl: await listen(server), getAccessToken: () => "buyer" };
  try {
    assert.deepEqual(await getSellerReputation(sellerId, { context, auth: false, params: { userId: otherId } }), reputation);
    for (const changed of [{ userId: otherId }, { score: 101 }, { score: -1 }, { score: 78.5 }, { trustLevel: "unknown" }, { failedTransaction: -1 }, { successfulTransaction: 43 }, { ratingCount: -1 }, { ratingCount: 1.5 }, { policyVersion: " " }]) {
      result = { ...reputation, ...changed };
      await assert.rejects(getSellerReputation(sellerId, { context }), invalid);
    }
  } finally { await close(server); }
});

test("rating HTTP failures preserve Problem Details and never become an unrated order", async () => {
  let status = 403;
  const server = createServer((_request, response) => {
    response.writeHead(status, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({ title: "Rating rejected", status, code: "RATING_TEST", detail: "Wait for completion.", errors: [{ field: "score", code: "RATING_SCORE", detail: "Choose a valid score." }] }));
  });
  const options = { context: { baseUrl: await listen(server) } };
  try {
    for (status of [401, 403, 404, 409, 503]) for (const request of [() => createRating(body, buyerId, options), () => getOrderRating(sellerId, buyerId, orderId, options), () => getSellerReputation(sellerId, options)]) {
      await assert.rejects(request(), (error: unknown) => {
        assert.ok(isApiError(error));
        assert.equal(error.status, status);
        assert.equal(error.code, "RATING_TEST");
        assert.equal(error.detail, "Wait for completion.");
        assert.deepEqual(error.fieldErrors?.score, ["Choose a valid score."]);
        return true;
      });
    }
  } finally { await close(server); }
});

test("rating cancellation remains AbortError for read and write requests", async () => {
  const server = createServer(() => {});
  const context = { baseUrl: await listen(server) };
  try {
    for (const request of [
      (signal: AbortSignal) => createRating(body, buyerId, { context, signal }),
      (signal: AbortSignal) => getOrderRating(sellerId, buyerId, orderId, { context, signal }),
      (signal: AbortSignal) => getSellerReputation(sellerId, { context, signal }),
    ]) {
      const controller = new AbortController();
      const pending = request(controller.signal);
      controller.abort();
      await assert.rejects(pending, (error: unknown) => error instanceof Error && error.name === "AbortError");
    }
  } finally { await close(server); }
});
