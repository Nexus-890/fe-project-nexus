import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { auctionStateChanged, hasCurrentAuctionResult, reconcileAuctionStatus, selectLatestAuctionState } from "../features/auctionStateReconciliation";
import { parseAuctionState } from "../service/auctionService";

const raw = {
  auctionId: "a1000000-0000-4000-8000-000000000001", currentPrice: 9850, bidIncrement: 50,
  bidCount: 18, leaderBidderName: "j***n", status: "ACTIVE",
  endAt: "2026-11-13T11:05:00Z", serverTime: "2026-11-13T11:00:00Z",
};
const state = parseAuctionState(raw, 100, 100);

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
});
