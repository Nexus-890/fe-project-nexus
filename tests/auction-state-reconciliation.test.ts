import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { AUCTION_STREAM_SILENCE_MS, auctionStateChanged, getAuctionMineInterval, hasCurrentAuctionResult, isAuctionStreamHealthy, reconcileAuctionStatus, selectLatestAuctionState } from "../features/auctionStateReconciliation";
import type { ApiError } from "../types/commonResponseType";
import { parseAuctionState } from "../service/auctionService";

const raw = {
  auctionId: "a1000000-0000-4000-8000-000000000001", currentPrice: 9850, bidIncrement: 50,
  bidCount: 18, leaderBidderName: "j***n", status: "ACTIVE",
  endAt: "2026-11-13T11:05:00Z", serverTime: "2026-11-13T11:00:00Z",
};
const state = parseAuctionState(raw, 100, 100);

test("opening a stream allows its first 15-second heartbeat and two missed beats restore polling", () => {
  assert.equal(AUCTION_STREAM_SILENCE_MS, 30_000);
  let lastActivityAt = 0;
  assert.equal(isAuctionStreamHealthy(lastActivityAt, 0, 1), true);
  assert.equal(isAuctionStreamHealthy(lastActivityAt, 14_999, 1), true);
  lastActivityAt = 15_000;
  assert.equal(isAuctionStreamHealthy(lastActivityAt, 29_000, 1), true);
  assert.equal(isAuctionStreamHealthy(lastActivityAt, 30_001, 1), true);
  assert.equal(isAuctionStreamHealthy(lastActivityAt, 44_999, 1), true);
  assert.equal(isAuctionStreamHealthy(lastActivityAt, 45_000, 1), false);
  assert.equal(isAuctionStreamHealthy(lastActivityAt, 45_001, 1), false);
  assert.equal(isAuctionStreamHealthy(0, 29_999, 1), true);
  assert.equal(isAuctionStreamHealthy(0, 30_000, 1), false);
});

test("closed, reconnecting and invalid stream clocks never suppress the fallback", () => {
  for (const readyState of [0, 2]) assert.equal(isAuctionStreamHealthy(15_000, 29_000, readyState), false);
  for (const lastActivityAt of [null, -1, NaN, Infinity]) assert.equal(isAuctionStreamHealthy(lastActivityAt, 29_000, 1), false);
  for (const now of [-1, NaN, Infinity]) assert.equal(isAuctionStreamHealthy(0, now, 1), false);
  // The UI's sampled clock can precede an event received in the same render frame.
  assert.equal(isAuctionStreamHealthy(15_010, 15_000, 1), true);
});

test("newer pushed price is retained when an older REST request completes afterwards", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const key = ["auction", state.auctionId];
  client.setQueryData(key, state);
  let finish!: (value: typeof state) => void;
  const request = client.fetchQuery({ queryKey: key, queryFn: async () => {
    const incoming = await new Promise<typeof state>((resolve) => { finish = resolve; });
    return selectLatestAuctionState(client.getQueryData(key), incoming);
  } });
  const pushed = parseAuctionState({ ...raw, currentPrice: 9900, bidCount: 19, serverTime: "2026-11-13T11:00:01Z" }, 1100, 1100);
  client.setQueryData(key, selectLatestAuctionState(client.getQueryData(key), pushed));
  assert.equal(client.getQueryData<typeof state>(key)?.currentPrice, "9900.00");
  finish(state);
  await request;
  assert.equal(client.getQueryData<typeof state>(key)?.currentPrice, "9900.00");
  client.clear();
});

test("fresh server timestamps cannot regress cached bid count, price, end time or settled status", () => {
  const newerClock = { ...state, serverTime: "2026-11-13T11:00:01Z" };
  for (const changed of [
    { currentPrice: "9800.00" }, { bidCount: 17 }, { endAt: "2026-11-13T11:04:59Z" },
    { status: "SCHEDULED" as const }, { serverTime: "2026-11-13T10:59:59Z", currentPrice: "9900.00" },
  ]) assert.equal(selectLatestAuctionState(state, { ...newerClock, ...changed }), state);
  const ended = { ...state, status: "ENDED" as const };
  const won = { ...newerClock, status: "WON" as const };
  assert.equal(selectLatestAuctionState(ended, newerClock), ended);
  assert.equal(selectLatestAuctionState(ended, won), won);
  assert.equal(selectLatestAuctionState(won, newerClock), won);
  const settled = { ...won, status: "SETTLED" as const };
  assert.equal(selectLatestAuctionState(won, settled), settled);
  assert.equal(selectLatestAuctionState(settled, won), settled);
});

test("heartbeat clock updates avoid supporting reads while price, count, end and settlement changes refresh them", () => {
  assert.equal(selectLatestAuctionState(state, { ...state, receivedAt: 1100 }), state);
  assert.equal(auctionStateChanged(state, { ...state, serverTime: "2026-11-13T11:00:01Z", receivedAt: 1100 }), false);
  for (const changed of [{ currentPrice: "9900.00" }, { bidCount: 19 }, { endAt: "2026-11-13T11:10:00Z" }, { status: "ENDED" as const }])
    assert.equal(auctionStateChanged(state, { ...state, ...changed }), true);
});

test("ENDED remains pending until a settlement result and stale own snapshots are not final", () => {
  assert.equal(reconcileAuctionStatus("ACTIVE", "ENDED"), "ENDED");
  assert.equal(reconcileAuctionStatus("ENDED", "ACTIVE"), "ENDED");
  assert.equal(reconcileAuctionStatus("WON", "ENDED"), "WON");
  assert.equal(hasCurrentAuctionResult("WON", "ACTIVE"), false);
  assert.equal(hasCurrentAuctionResult("WON", "ENDED"), false);
  assert.equal(hasCurrentAuctionResult("WON", "WON"), true);
  assert.equal(hasCurrentAuctionResult("WON", "SETTLED"), true);
  assert.equal(hasCurrentAuctionResult("SETTLED", "WON"), false);
  assert.equal(reconcileAuctionStatus("SETTLED", "PAYMENT_TIMEOUT"), "PAYMENT_TIMEOUT");
  assert.equal(hasCurrentAuctionResult("SETTLED", "PAYMENT_TIMEOUT"), true);
});

test("private winner polling survives the final result until the actual order reference arrives", () => {
  const input = { status: "WON" as const, visible: true, now: Date.parse("2026-11-13T11:00:00Z"), error: null };
  const pending = { auctionStatus: "ACTIVE" as const, won: false, orderId: null, paymentDueAt: null };
  assert.equal(getAuctionMineInterval({ ...input, own: pending }), 2000);
  const won = { ...pending, auctionStatus: "WON" as const, won: true, paymentDueAt: "2026-11-14T11:00:00Z" };
  assert.equal(getAuctionMineInterval({ ...input, own: won }), 2000);
  // The public result can stay WON while #172/#173 finish the private projection.
  assert.equal(getAuctionMineInterval({ ...input, own: { ...won, auctionStatus: "SETTLED" } }), 2000);
  assert.equal(getAuctionMineInterval({ ...input, own: { ...won, auctionStatus: "SETTLED", orderId: "a1000000-0000-4000-8000-000000000002" } }), false);
  assert.equal(getAuctionMineInterval({ ...input, status: "SETTLED", own: { ...won, orderId: "a1000000-0000-4000-8000-000000000002" } }), 2000);
});

test("winner reconciliation closes for timeout, expired deadline, verified loss, absence and hidden tabs", () => {
  const input = { status: "WON" as const, visible: true, now: Date.parse("2026-11-13T11:00:00Z"), error: null };
  const winner = { auctionStatus: "WON" as const, won: true, orderId: null, paymentDueAt: "2026-11-14T11:00:00Z" };
  assert.equal(getAuctionMineInterval({ ...input, own: { ...winner, auctionStatus: "PAYMENT_TIMEOUT" } }), false);
  assert.equal(getAuctionMineInterval({ ...input, status: "SETTLED", own: { ...winner, auctionStatus: "PAYMENT_TIMEOUT" } }), false);
  assert.equal(getAuctionMineInterval({ ...input, own: { ...winner, paymentDueAt: "2026-11-13T11:00:00Z" } }), false);
  assert.equal(getAuctionMineInterval({ ...input, own: { ...winner, won: false } }), false);
  assert.equal(getAuctionMineInterval({ ...input, own: null }), false);
  assert.equal(getAuctionMineInterval({ ...input, own: winner, visible: false }), false);
  assert.equal(getAuctionMineInterval({ ...input, own: undefined }), 2000);
});

test("private settlement retries transient failures without polling permanent access errors", () => {
  const input = { status: "WON" as const, visible: true, now: 0, own: { auctionStatus: "WON" as const, won: true, orderId: null } };
  const error: ApiError = { kind: "http", status: 503, title: "Unavailable" };
  assert.equal(getAuctionMineInterval({ ...input, error }), 2000);
  assert.equal(getAuctionMineInterval({ ...input, error: { ...error, kind: "network", status: 0 } }), 2000);
  for (const status of [408, 429]) assert.equal(getAuctionMineInterval({ ...input, error: { ...error, status } }), 2000);
  for (const status of [400, 401, 403, 404]) assert.equal(getAuctionMineInterval({ ...input, error: { ...error, status } }), false);
  assert.equal(getAuctionMineInterval({ ...input, error: { ...error, kind: "invalid-response", status: 0 } }), false);
  assert.equal(getAuctionMineInterval({ ...input, status: "ACTIVE", own: { auctionStatus: "ACTIVE", won: false }, error: null }), 15_000);
});
