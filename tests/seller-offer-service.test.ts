import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { getSellerOffers, parseSellerOfferState, sendSellerOffer } from "../service/sellerOfferService";

const auctionId = "a2250000-0000-4000-8000-000000000099";
const bidderId = "b2250000-0000-4000-8000-000000000002";
const candidate = { bidderId, displayName: "B***B", amount: 4800000 };
const offer = { ...candidate, id: "c2250000-0000-4000-8000-000000000001", status: "OFFERED", offeredAt: "2026-11-14T03:00:00Z", expiresAt: "2026-11-15T03:00:00Z", respondedAt: null, orderId: null, paymentDueAt: null };
const initial = { auctionId, canOffer: true, eligibilityUnavailable: false, candidate, offers: [] };
const opened = { auctionId, canOffer: false, eligibilityUnavailable: false, candidate: null, offers: [offer] };
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const listen = async (server: Server) => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
};
const close = async (server: Server) => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); };

test("seller offer GET never writes; explicit bodyless POST sends no bidder, amount or invented version precondition", async () => {
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
    const result = await sendSellerOffer(auctionId, { context });
    assert.equal(result.offers[0].bidderId, bidderId); assert.equal(result.offers[0].amount, "4800000.00"); assert.equal(result.canOffer, false);
    assert.deepEqual(calls, [
      { method: "GET", path: `/api/v1/auctions/${auctionId}/second-chance-offers`, auth: "Bearer first-seller", version: undefined, body: "" },
      { method: "POST", path: `/api/v1/auctions/${auctionId}/second-chance-offers`, auth: "Bearer rotated-seller", version: undefined, body: "" },
    ]);
  } finally { await close(server); }
});

test("offer parsing rejects mismatched auctions, repeated bidders, wrong prices/deadlines and overlapping OFFERED offers", () => {
  for (const value of [
    { ...initial, auctionId: bidderId }, { ...initial, candidate: { ...candidate, amount: "4800000" } },
    { ...initial, candidate: { ...candidate, amount: 0 } }, { ...initial, candidate: { ...candidate, amount: 1.001 } },
    { ...opened, canOffer: true, candidate }, { ...opened, offers: [offer, offer] },
    { ...opened, offers: [offer, { ...offer, id: auctionId }] },
    { ...opened, offers: [offer, { ...offer, id: auctionId, bidderId: auctionId }] },
    { ...opened, offers: [{ ...offer, expiresAt: offer.offeredAt }] },
    { ...opened, offers: [{ ...offer, status: "ACCEPTED" }] },
    { ...opened, offers: [{ ...offer, status: "OPEN" }] },
    { ...opened, offers: [{ ...offer, status: ["OFFERED"] }] },
    { ...opened, offers: [{ ...offer, respondedAt: offer.offeredAt }] },
    { ...opened, eligibilityUnavailable: undefined }, { ...opened, eligibilityUnavailable: "true" },
    { ...initial, eligibilityUnavailable: true },
  ]) assert.throws(() => parseSellerOfferState(value, auctionId), invalid);
});

test("seller offer state distinguishes eligibility outage from exhausted bidders and retains history", () => {
  const expired = { ...offer, status: "EXPIRED" };
  for (const history of [[], [expired]]) {
    const outage = parseSellerOfferState({ ...opened, eligibilityUnavailable: true, offers: history }, auctionId);
    assert.equal(outage.eligibilityUnavailable, true);
    assert.equal(outage.canOffer, false); assert.equal(outage.candidate, null);
    assert.equal(outage.offers.length, history.length);
    const exhausted = parseSellerOfferState({ ...opened, offers: history }, auctionId);
    assert.equal(exhausted.eligibilityUnavailable, false);
  }
  assert.equal(parseSellerOfferState(initial, auctionId).eligibilityUnavailable, false);
});

test("closed history allows only a different next bidder and accepted history preserves its new order/payment deadline", () => {
  assert.equal(parseSellerOfferState({ ...initial, candidate: { ...candidate, amount: 99999999999999 } }, auctionId).candidate?.amount, "99999999999999.00");
  const pending = parseSellerOfferState({ ...opened, offers: [{ ...offer, status: "ACCEPTED", respondedAt: "2026-11-14T04:00:00Z", paymentDueAt: "2026-11-15T04:00:00Z" }] }, auctionId);
  assert.equal(pending.offers[0].orderId, null, "order projection can arrive after accept");
  const declined = { ...offer, status: "DECLINED", respondedAt: "2026-11-14T04:00:00Z" };
  const expired = { ...offer, status: "EXPIRED" };
  for (const closed of [declined, expired]) {
    const result = parseSellerOfferState({ ...initial, candidate: { ...candidate, bidderId: auctionId, amount: 4600000 }, offers: [closed] }, auctionId);
    assert.equal(result.candidate?.bidderId, auctionId); assert.equal(result.candidate?.amount, "4600000.00");
  }
  const result = parseSellerOfferState({ ...opened, offers: [{ ...offer, status: "ACCEPTED", respondedAt: "2026-11-14T04:00:00Z", orderId: auctionId, paymentDueAt: "2026-11-14T04:15:00Z" }] }, auctionId);
  assert.equal(result.offers[0].orderId, auctionId); assert.equal(result.offers[0].paymentDueAt, "2026-11-14T04:15:00Z");
});

test("ACCEPTED history permits a later candidate, OFFERED row and multiple accepted orders", () => {
  const accepted = { ...offer, status: "ACCEPTED", respondedAt: "2026-11-14T04:00:00Z", orderId: auctionId, paymentDueAt: "2026-11-14T04:15:00Z" };
  const next = { bidderId: "b2250000-0000-4000-8000-000000000003", displayName: "C***C", amount: 4600000 };
  const nextOffer = { ...offer, ...next, id: auctionId, offeredAt: "2026-11-14T04:15:01Z", expiresAt: "2026-11-15T04:15:01Z" };
  const eligible = parseSellerOfferState({ ...initial, candidate: next, offers: [accepted] }, auctionId);
  assert.equal(eligible.candidate?.amount, "4600000.00"); assert.equal(eligible.offers[0].status, "ACCEPTED");
  const waiting = parseSellerOfferState({ ...opened, offers: [accepted, nextOffer] }, auctionId);
  assert.deepEqual(waiting.offers.map((row) => row.status), ["OFFERED", "ACCEPTED"]);
  const nextAccepted = { ...nextOffer, status: "ACCEPTED", respondedAt: "2026-11-14T04:16:00Z", orderId: next.bidderId, paymentDueAt: "2026-11-14T04:31:00Z" };
  assert.equal(parseSellerOfferState({ ...opened, offers: [accepted, nextAccepted] }, auctionId).offers.length, 2);
  assert.throws(() => parseSellerOfferState({ ...opened, offers: [accepted, { ...nextAccepted, orderId: accepted.orderId }] }, auctionId), invalid, "each accepted offer creates its own order");
  assert.throws(() => parseSellerOfferState({ ...initial, offers: [accepted] }, auctionId), invalid, "a previously offered bidder cannot be offered again");
  assert.throws(() => parseSellerOfferState({ ...initial, candidate: { ...candidate, bidderId: bidderId.toUpperCase() }, offers: [accepted] }, auctionId), invalid);
  assert.throws(() => parseSellerOfferState({ ...initial, candidate: next, offers: [nextOffer] }, auctionId), invalid, "OFFERED still blocks a new candidate");
});

type FixtureRequest = IncomingMessage & { body?: unknown };
type FixtureEvidence = {
  offers: { id: string; bidderId: string; amount: number; status: string; orderId: string | null; paymentDueAt: string | null }[];
  orders: { orderId: string; userId: string; totalAmount: number; status: string; paymentDueAt: string }[];
  emails: unknown[];
  penalties: { bidderId: string; reason: string }[];
  available: number;
  canOffer: boolean;
  eligibilityUnavailable: boolean;
  originalWinnerId: string;
  auctionStatus: string;
};
const loadFixture = createRequire(path.join(process.cwd(), "package.json"));
const { createOfferFixture } = loadFixture("./postman/mocks/backoffice-gateway/offers.js") as {
  createOfferFixture: (options: {
    ok: (res: ServerResponse, data: unknown, status?: number) => void;
    problem: (res: ServerResponse, status: number, detail: string) => void;
    bodyOf: (req: FixtureRequest) => Record<string, unknown>;
    randomUUID: () => string;
    seller: string;
  }) => { handle: (req: FixtureRequest, res: ServerResponse, url: URL, claims: { sub: string; roles: string[] } | null) => boolean; evidence: () => FixtureEvidence; reset: () => void };
};

test("HTTP offer simulation retains accepted B after payment timeout and offers C once at C's own price", async () => {
  const seller = "68000000-0000-4000-8000-000000000002";
  const json = (res: ServerResponse, data: unknown, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  const fixture = createOfferFixture({ ok: (res, data, status) => json(res, envelope(data), status),
    problem: (res, status, detail) => json(res, { title: "Rejected", status, detail }, status),
    bodyOf: (req) => req.body as Record<string, unknown> ?? {}, randomUUID, seller });
  const server = createServer(async (request: FixtureRequest, response) => {
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    request.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    const claims = request.headers.authorization === "Bearer seller" ? { sub: seller, roles: ["SELLER"] } : null;
    const url = new URL(request.url!, "http://fixture.test"); url.pathname = url.pathname.replace(/^\/api/, "");
    if (!fixture.handle(request, response, url, claims)) json(response, { title: "Unknown fixture route", status: 501 }, 501);
  });
  const origin = await listen(server);
  const context = { baseUrl: origin, getAccessToken: () => "seller" };
  const control = async (status: string) => {
    const response = await fetch(`${origin}/test/offer-response`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    assert.equal(response.status, 200); return (await response.json()).data as FixtureEvidence;
  };
  try {
    await getSellerOffers(auctionId, { context });
    assert.equal(fixture.evidence().emails.length, 0, "inspection never sends an offer");
    const offeredB = await sendSellerOffer(auctionId, { context });
    assert.equal(offeredB.offers[0].status, "OFFERED");
    assert.equal(fixture.evidence().available, 4);
    await assert.rejects(sendSellerOffer(auctionId, { context }), (error: unknown) => isApiError(error) && error.status === 409);
    const acceptedB = await control("ACCEPTED");
    assert.equal(acceptedB.auctionStatus, "WON"); assert.equal(acceptedB.orders[0].status, "PENDING");
    await assert.rejects(sendSellerOffer(auctionId, { context }), (error: unknown) => isApiError(error) && error.status === 409, "current unpaid acceptance is ineligible");
    const timedOutB = await control("PAYMENT_TIMEOUT");
    assert.equal(timedOutB.offers[0].status, "ACCEPTED"); assert.equal(timedOutB.orders[0].status, "CANCELED");
    assert.equal(timedOutB.available, 5); assert.equal(timedOutB.auctionStatus, "PAYMENT_TIMEOUT");
    assert.equal(timedOutB.penalties.length, 1); assert.equal(timedOutB.penalties[0].bidderId, bidderId);
    const next = await getSellerOffers(auctionId, { context });
    assert.equal(next.candidate?.displayName, "C***C"); assert.equal(next.candidate?.amount, "4600000.00");
    const offeredC = await sendSellerOffer(auctionId, { context });
    assert.deepEqual(offeredC.offers.map((row) => row.status), ["OFFERED", "ACCEPTED"]);
    assert.equal(offeredC.offers[0].amount, "4600000.00"); assert.equal(offeredC.offers[1].amount, "4800000.00");
    assert.equal(fixture.evidence().emails.length, 2);
    assert.equal(fixture.evidence().offers.some((row) => row.bidderId === fixture.evidence().originalWinnerId), false);
    const acceptedC = await control("ACCEPTED");
    assert.equal(acceptedC.orders.length, 2); assert.equal(acceptedC.orders[1].totalAmount, 4600000);
    assert.equal((await getSellerOffers(auctionId, { context })).offers.filter((row) => row.status === "ACCEPTED").length, 2);
    const paid = await control("PAID");
    assert.equal(paid.auctionStatus, "SETTLED"); assert.equal(paid.orders[1].status, "PAID");
    await assert.rejects(sendSellerOffer(auctionId, { context }), (error: unknown) => isApiError(error) && error.status === 409);
  } finally { await close(server); }
});

test("simulated decline and 24-hour expiry release their hold without penalty or automatic next email", () => {
  const fixture = createOfferFixture({ ok: () => {}, problem: () => {}, bodyOf: (req) => req.body as Record<string, unknown> ?? {}, randomUUID, seller: auctionId });
  const response = {} as ServerResponse;
  const claims = { sub: auctionId, roles: ["SELLER"] };
  const send = () => fixture.handle({ method: "POST", headers: {}, body: {} } as FixtureRequest, response, new URL(`http://fixture.test/v1/auctions/${auctionId}/second-chance-offers`), claims);
  const respond = (status: string) => fixture.handle({ method: "POST", headers: {}, body: { status } } as FixtureRequest, response, new URL("http://fixture.test/test/offer-response"), claims);
  send();
  respond("DECLINED");
  assert.equal(fixture.evidence().available, 5); assert.equal(fixture.evidence().penalties.length, 0); assert.equal(fixture.evidence().emails.length, 1);
  send();
  const expiring = parseSellerOfferState(fixture.evidence(), auctionId).offers[0];
  assert.equal(Date.parse(expiring.expiresAt) - Date.parse(expiring.offeredAt), 86_400_000);
  respond("EXPIRED");
  assert.equal(fixture.evidence().available, 5); assert.equal(fixture.evidence().penalties.length, 0); assert.equal(fixture.evidence().emails.length, 2);
  const state = parseSellerOfferState(fixture.evidence(), auctionId);
  assert.equal(state.candidate?.displayName, "D***D");
  send(); respond("DECLINED");
  assert.equal(fixture.evidence().canOffer, false, "exhausted bidders leave no send action");
  assert.equal(fixture.evidence().offers.length, 3);
});

test("missing backend, authorization and eligibility conflict remain failures without automatic offer retries", async () => {
  let status = 404, requests = 0;
  const server = createServer((_, response) => {
    requests++; response.writeHead(status, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({ title: "Offer rejected", status, code: "AUCTION_OFFER_UNAVAILABLE", detail: "No offer was sent." }));
  });
  const context = { baseUrl: await listen(server) };
  try {
    for (const responseStatus of [404, 403, 409, 501, 503]) {
      status = responseStatus;
      await assert.rejects(sendSellerOffer(auctionId, { context }), (error: unknown) => isApiError(error) && error.status === responseStatus && error.detail === "No offer was sent.");
    }
    assert.equal(requests, 5);
  } finally { await close(server); }
});

test("invalid auction never writes and a successful envelope with no created OFFERED offer is refused", async () => {
  let requests = 0;
  const context = { fetch: async () => { requests++; return Response.json(envelope(initial)); } };
  await assert.rejects(getSellerOffers("not-an-auction", { context }), invalid);
  await assert.rejects(sendSellerOffer("not-an-auction", { context }), invalid);
  assert.equal(requests, 0);
  await assert.rejects(sendSellerOffer(auctionId, { context }), invalid);
  assert.equal(requests, 1);
});

test("offer cancellation stays AbortError and late success from an old seller session is discarded", async () => {
  const controller = new AbortController(); let sent!: () => void;
  const started = new Promise<void>((resolve) => { sent = resolve; });
  const pending = sendSellerOffer(auctionId, { signal: controller.signal, context: { fetch: async (_input, init) => {
    sent(); return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Canceled", "AbortError")), { once: true }));
  } } });
  await started; controller.abort(); await assert.rejects(pending, { name: "AbortError" });
  let generation = 1;
  await assert.rejects(sendSellerOffer(auctionId, { context: { getAccessToken: () => "seller", getSessionId: () => generation, fetch: async () => { generation++; return Response.json(envelope(opened), { status: 201 }); } } }),
    (error: unknown) => isApiError(error) && error.kind === "aborted");
});
