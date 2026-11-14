import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { getSellerOffers, parseSellerOfferState, sendSellerOffer } from "../service/sellerOfferService";

const auctionId = "a2250000-0000-4000-8000-000000000099";
const bidderId = "b2250000-0000-4000-8000-000000000002";
const candidate = { bidderId, displayName: "Bidder B", amount: 4800000 };
const offer = { ...candidate, id: "c2250000-0000-4000-8000-000000000001", status: "OPEN", offeredAt: "2026-11-14T03:00:00Z", expiresAt: "2026-11-15T03:00:00Z", respondedAt: null, orderId: null, paymentDueAt: null };
const initial = { auctionId, version: 0, canOffer: true, candidate, offers: [] };
const opened = { auctionId, version: 1, canOffer: false, candidate: null, offers: [offer] };
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
};
const close = async (server: Server) => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); };

test("seller offer GET never writes; explicit POST sends no bidder/amount and binds confirmation to the reviewed version", async () => {
  const calls: { method?: string; path?: string; auth?: string; version?: string; body: string }[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    calls.push({ method: request.method, path: request.url, auth: request.headers.authorization, version: request.headers["if-match"] as string | undefined, body: Buffer.concat(chunks).toString() });
    response.writeHead(request.method === "POST" ? 201 : 200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope(request.method === "POST" ? opened : initial)));
  });
  let token = "first-seller";
  const context = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    const first = await getSellerOffers(auctionId, { context, auth: false });
    assert.equal(first.candidate?.amount, "4800000.00"); assert.deepEqual(first.offers, []);
    assert.equal(calls.length, 1, "opening the dialog must not send an offer");
    token = "rotated-seller";
    const result = await sendSellerOffer(auctionId, first.version, { context, config: { headers: { "If-Match": '"999"' } } });
    assert.equal(result.offers[0].bidderId, bidderId); assert.equal(result.offers[0].amount, "4800000.00"); assert.equal(result.canOffer, false);
    assert.deepEqual(calls, [
      { method: "GET", path: `/api/v1/auctions/${auctionId}/second-chance-offers`, auth: "Bearer first-seller", version: undefined, body: "" },
      { method: "POST", path: `/api/v1/auctions/${auctionId}/second-chance-offers`, auth: "Bearer rotated-seller", version: '"0"', body: "" },
    ]);
  } finally { await close(server); }
});

test("offer parsing rejects mismatched auctions, repeated bidders, wrong prices/deadlines and overlapping open offers", () => {
  for (const value of [
    { ...initial, auctionId: bidderId }, { ...initial, version: -1 }, { ...initial, candidate: { ...candidate, amount: "4800000" } },
    { ...initial, candidate: { ...candidate, amount: 0 } }, { ...initial, candidate: { ...candidate, amount: 1.001 } },
    { ...opened, canOffer: true, candidate }, { ...opened, offers: [offer, offer] },
    { ...opened, offers: [offer, { ...offer, id: auctionId }] },
    { ...opened, offers: [offer, { ...offer, id: auctionId, bidderId: auctionId }] },
    { ...opened, offers: [{ ...offer, expiresAt: "2026-11-14T04:00:00Z" }] },
    { ...opened, offers: [{ ...offer, status: "ACCEPTED" }] },
    { ...opened, offers: [{ ...offer, respondedAt: offer.offeredAt }] },
  ]) assert.throws(() => parseSellerOfferState(value, auctionId), invalid);
});

test("closed history allows only a different next bidder and accepted history preserves its new order/payment deadline", () => {
  const declined = { ...offer, status: "DECLINED", respondedAt: "2026-11-14T04:00:00Z" };
  const expired = { ...offer, status: "EXPIRED" };
  for (const closed of [declined, expired]) {
    const result = parseSellerOfferState({ ...initial, version: 2, candidate: { ...candidate, bidderId: auctionId, amount: 4600000 }, offers: [closed] }, auctionId);
    assert.equal(result.candidate?.bidderId, auctionId); assert.equal(result.candidate?.amount, "4600000.00");
  }
  const result = parseSellerOfferState({ ...opened, version: 2, offers: [{ ...offer, status: "ACCEPTED", respondedAt: "2026-11-14T04:00:00Z", orderId: auctionId, paymentDueAt: "2026-11-14T04:15:00Z" }] }, auctionId);
  assert.equal(result.offers[0].orderId, auctionId); assert.equal(result.offers[0].paymentDueAt, "2026-11-14T04:15:00Z");
});

test("missing backend, authorization, stale version and conflict remain failures without automatic offer retries", async () => {
  let status = 404, requests = 0;
  const server = createServer((_, response) => {
    requests++; response.writeHead(status, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({ title: "Offer rejected", status, code: "AUCTION_OFFER_UNAVAILABLE", detail: "No offer was sent." }));
  });
  const context = { baseUrl: await listen(server) };
  try {
    for (const responseStatus of [404, 403, 409, 412, 501, 503]) {
      status = responseStatus;
      await assert.rejects(sendSellerOffer(auctionId, 0, { context }), (error: unknown) => isApiError(error) && error.status === responseStatus && error.detail === "No offer was sent.");
    }
    assert.equal(requests, 6);
  } finally { await close(server); }
});

test("invalid auction/version never writes and a successful envelope with no created open offer is refused", async () => {
  let requests = 0;
  const context = { fetch: async () => { requests++; return Response.json(envelope(initial)); } };
  await assert.rejects(getSellerOffers("not-an-auction", { context }), invalid);
  for (const version of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(sendSellerOffer(auctionId, version, { context }), invalid);
  assert.equal(requests, 0);
  await assert.rejects(sendSellerOffer(auctionId, 0, { context }), invalid);
  assert.equal(requests, 1);
});

test("offer cancellation stays AbortError and late success from an old seller session is discarded", async () => {
  const controller = new AbortController(); let sent!: () => void;
  const started = new Promise<void>((resolve) => { sent = resolve; });
  const pending = sendSellerOffer(auctionId, 0, { signal: controller.signal, context: { fetch: async (_input, init) => {
    sent(); return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Canceled", "AbortError")), { once: true }));
  } } });
  await started; controller.abort(); await assert.rejects(pending, { name: "AbortError" });
  let generation = 1;
  await assert.rejects(sendSellerOffer(auctionId, 0, { context: { getAccessToken: () => "seller", getSessionId: () => generation, fetch: async () => { generation++; return Response.json(envelope(opened), { status: 201 }); } } }),
    (error: unknown) => isApiError(error) && error.kind === "aborted");
});
